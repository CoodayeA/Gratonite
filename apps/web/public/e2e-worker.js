/**
 * e2e-worker.js — Web Worker for E2E encryption/decryption operations.
 *
 * Moves CPU-intensive crypto operations off the main thread to prevent
 * UI jank when encrypting/decrypting messages and files.
 *
 * Protocol:
 *   Main thread sends: { id, action, payload }
 *   Worker responds:   { id, result } or { id, error }
 *
 * Actions:
 *   - encrypt:     Encrypt plaintext with AES-GCM key
 *   - decrypt:     Decrypt ciphertext with AES-GCM key
 *   - deriveKey:   Derive shared AES-GCM key from ECDH key pair
 *   - generateKeyPair: Generate ECDH P-256 key pair
 *   - exportPublicKey: Export public key as JWK string
 *   - importPublicKey: Import JWK string as public key
 *   - encryptFile: Encrypt a file blob
 *   - decryptFile: Decrypt an encrypted file blob
 */

// In-memory key cache (CryptoKey objects cannot be postMessage'd in all browsers,
// so we keep them in the worker and reference by ID)
const keyStore = new Map();
let keyCounter = 0;

function storeKey(key) {
  const id = `key_${++keyCounter}`;
  keyStore.set(id, key);
  return id;
}

function getKey(keyId) {
  const key = keyStore.get(keyId);
  if (!key) throw new Error(`Key not found: ${keyId}`);
  return key;
}

// ---------------------------------------------------------------------------
// Crypto operations (mirror of e2e.ts logic)
// ---------------------------------------------------------------------------

async function generateKeyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey'],
  );
  const pubId = storeKey(pair.publicKey);
  const privId = storeKey(pair.privateKey);
  return { publicKeyId: pubId, privateKeyId: privId };
}

async function exportPublicKey(keyId) {
  const key = getKey(keyId);
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

async function importPublicKey(jwkString) {
  const jwk = JSON.parse(jwkString);
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
  return storeKey(key);
}

async function deriveSharedKey(myPrivateKeyId, theirPublicKeyId) {
  const myPrivateKey = getKey(myPrivateKeyId);
  const theirPublicKey = getKey(theirPublicKeyId);
  const sharedKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return storeKey(sharedKey);
}

async function encrypt(keyId, plaintext) {
  const key = getKey(keyId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  // Convert to base64
  let binary = '';
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}

async function decrypt(keyId, ciphertextBase64) {
  const key = getKey(keyId);
  const binary = atob(ciphertextBase64);
  const combined = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function encryptFile(keyId, fileData, fileName) {
  const key = getKey(keyId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, fileData);

  // Encrypt the filename
  const encryptedFilename = await encrypt(keyId, fileName);

  let ivBinary = '';
  for (let i = 0; i < iv.length; i++) ivBinary += String.fromCharCode(iv[i]);

  return {
    encryptedData: ciphertext,
    encryptedFilename,
    iv: btoa(ivBinary),
  };
}

async function decryptFile(keyId, encryptedData, ivB64, encryptedFilename) {
  const key = getKey(keyId);
  const ivBinary = atob(ivB64);
  const iv = new Uint8Array(ivBinary.length);
  for (let i = 0; i < ivBinary.length; i++) iv[i] = ivBinary.charCodeAt(i);

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData);
  const filename = await decrypt(keyId, encryptedFilename);

  return { decryptedData: plaintext, filename };
}

function releaseKey(keyId) {
  keyStore.delete(keyId);
  return true;
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async function (e) {
  const { id, action, payload } = e.data;

  try {
    let result;

    switch (action) {
      case 'generateKeyPair':
        result = await generateKeyPair();
        break;

      case 'exportPublicKey':
        result = await exportPublicKey(payload.keyId);
        break;

      case 'importPublicKey':
        result = await importPublicKey(payload.jwkString);
        break;

      case 'deriveSharedKey':
        result = await deriveSharedKey(payload.privateKeyId, payload.publicKeyId);
        break;

      case 'encrypt':
        result = await encrypt(payload.keyId, payload.plaintext);
        break;

      case 'decrypt':
        result = await decrypt(payload.keyId, payload.ciphertext);
        break;

      case 'encryptFile':
        result = await encryptFile(payload.keyId, payload.fileData, payload.fileName);
        self.postMessage({ id, result }, [result.encryptedData]);
        return;

      case 'decryptFile':
        result = await decryptFile(payload.keyId, payload.encryptedData, payload.iv, payload.encryptedFilename);
        self.postMessage({ id, result }, [result.decryptedData]);
        return;

      case 'releaseKey':
        result = releaseKey(payload.keyId);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err.message || 'Worker error' });
  }
};
