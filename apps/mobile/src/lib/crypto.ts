/**
 * crypto.ts — Mobile E2E Encryption utilities for Gratonite.
 *
 * Port of apps/web/src/lib/e2e.ts using react-native-quick-crypto (JSI)
 * and expo-secure-store instead of Web Crypto API + IndexedDB.
 *
 * ECDH P-256 key exchange, AES-GCM 256-bit symmetric encryption.
 * Wire format is identical to the web client for cross-platform compatibility.
 */

import { subtle, getRandomValues } from './cryptoPolyfill';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';

// ---------------------------------------------------------------------------
// Key pair generation
// ---------------------------------------------------------------------------

export async function generateKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  return subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey'],
  ) as Promise<CryptoKeyPair>;
}

// ---------------------------------------------------------------------------
// Import / export helpers
// ---------------------------------------------------------------------------

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString) as JsonWebKey;
  return subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
}

// ---------------------------------------------------------------------------
// Shared key derivation
// ---------------------------------------------------------------------------

export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt  (wire format: base64(12-byte-IV || ciphertext))
// ---------------------------------------------------------------------------

export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return Buffer.from(combined).toString('base64');
}

export async function decrypt(key: CryptoKey, ciphertextBase64: string): Promise<string> {
  const combined = new Uint8Array(Buffer.from(ciphertextBase64, 'base64'));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ---------------------------------------------------------------------------
// Group key management
// ---------------------------------------------------------------------------

export async function generateGroupKey(): Promise<CryptoKey> {
  return subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptGroupKey(groupKey: CryptoKey, memberPublicKey: CryptoKey): Promise<string> {
  const rawKey = await subtle.exportKey('raw', groupKey);

  const ephemeral = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey'],
  );

  const wrappingKey = await subtle.deriveKey(
    { name: 'ECDH', public: memberPublicKey },
    (ephemeral as CryptoKeyPair).privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const iv = getRandomValues(new Uint8Array(12));
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, rawKey);

  const ephPublicJwk = await subtle.exportKey('jwk', (ephemeral as CryptoKeyPair).publicKey);

  const combined = {
    eph: ephPublicJwk,
    iv: Buffer.from(iv).toString('base64'),
    ct: Buffer.from(new Uint8Array(encrypted)).toString('base64'),
  };
  return Buffer.from(JSON.stringify(combined)).toString('base64');
}

export async function decryptGroupKey(
  encryptedBase64: string,
  myPrivateKey: CryptoKey,
): Promise<CryptoKey | null> {
  try {
    const combined = JSON.parse(Buffer.from(encryptedBase64, 'base64').toString('utf-8')) as {
      eph: JsonWebKey;
      iv: string;
      ct: string;
    };

    const ephPublicKey = await subtle.importKey(
      'jwk',
      combined.eph,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );

    const wrappingKey = await subtle.deriveKey(
      { name: 'ECDH', public: ephPublicKey },
      myPrivateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );

    const iv = new Uint8Array(Buffer.from(combined.iv, 'base64'));
    const ct = new Uint8Array(Buffer.from(combined.ct, 'base64'));
    const rawKey = await subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ct);

    return subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SecureStore persistence
// ---------------------------------------------------------------------------

const PRIVATE_KEY_STORE = 'gratonite_e2e_private_key';
const PUBLIC_KEY_STORE = 'gratonite_e2e_public_key';
const KEY_UPLOADED_STORE = 'gratonite_e2e_key_uploaded';

export async function saveKeyPairToSecureStore(
  publicKey: CryptoKey,
  privateKey: CryptoKey,
): Promise<void> {
  const pubJwk = await subtle.exportKey('jwk', publicKey);
  const privJwk = await subtle.exportKey('jwk', privateKey);
  await SecureStore.setItemAsync(PUBLIC_KEY_STORE, JSON.stringify(pubJwk));
  await SecureStore.setItemAsync(PRIVATE_KEY_STORE, JSON.stringify(privJwk));
}

export async function loadKeyPairFromSecureStore(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
} | null> {
  try {
    const pubJson = await SecureStore.getItemAsync(PUBLIC_KEY_STORE);
    const privJson = await SecureStore.getItemAsync(PRIVATE_KEY_STORE);
    if (!pubJson || !privJson) return null;

    const publicKey = await subtle.importKey(
      'jwk',
      JSON.parse(pubJson),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      [],
    );
    const privateKey = await subtle.importKey(
      'jwk',
      JSON.parse(privJson),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey'],
    );
    return { publicKey, privateKey };
  } catch {
    return null;
  }
}

export async function clearKeyPairFromSecureStore(): Promise<void> {
  await SecureStore.deleteItemAsync(PRIVATE_KEY_STORE);
  await SecureStore.deleteItemAsync(PUBLIC_KEY_STORE);
  await SecureStore.deleteItemAsync(KEY_UPLOADED_STORE);
}

export async function getOrCreateKeyPair(
  userId: string,
  uploadFn: (publicKeyJwk: string) => Promise<void>,
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey } | null> {
  try {
    const existing = await loadKeyPairFromSecureStore();
    if (existing) {
      // Ensure key is uploaded
      const uploaded = await SecureStore.getItemAsync(KEY_UPLOADED_STORE);
      if (uploaded !== 'true') {
        const pubJwk = await exportPublicKey(existing.publicKey);
        await uploadFn(pubJwk);
        await SecureStore.setItemAsync(KEY_UPLOADED_STORE, 'true');
      }
      return existing;
    }

    const keyPair = await generateKeyPair();
    await saveKeyPairToSecureStore(keyPair.publicKey, keyPair.privateKey);

    const pubJwk = await exportPublicKey(keyPair.publicKey);
    await uploadFn(pubJwk);
    await SecureStore.setItemAsync(KEY_UPLOADED_STORE, 'true');

    return keyPair;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Safety number computation (key verification)
// ---------------------------------------------------------------------------

export async function computeSafetyNumber(
  myPublicKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<string> {
  const myRaw = new Uint8Array(await subtle.exportKey('raw', myPublicKey));
  const theirRaw = new Uint8Array(await subtle.exportKey('raw', theirPublicKey));

  let first: Uint8Array = myRaw;
  let second: Uint8Array = theirRaw;
  for (let i = 0; i < myRaw.length; i++) {
    if (myRaw[i] < theirRaw[i]) { first = myRaw; second = theirRaw; break; }
    if (myRaw[i] > theirRaw[i]) { first = theirRaw; second = myRaw; break; }
  }

  const combined = new Uint8Array(first.length + second.length);
  combined.set(first, 0);
  combined.set(second, first.length);

  const hash = new Uint8Array(await subtle.digest('SHA-256', combined));
  const digits = Array.from(hash).map(b => b.toString().padStart(3, '0')).join('');
  return digits.slice(0, 60);
}
