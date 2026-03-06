/**
 * e2e.ts — Client-side End-to-End Encryption utilities for Gratonite DMs.
 *
 * Uses the Web Crypto API (window.crypto.subtle) with ECDH P-256 for key
 * agreement and AES-GCM 256-bit for symmetric encryption. Private keys are
 * stored in IndexedDB and never sent to the server.
 *
 * Flow:
 *   1. On first DM open, generate an ECDH key pair (or load from IndexedDB).
 *   2. Upload the public key to /api/v1/users/@me/public-key.
 *   3. Fetch the partner's public key from /api/v1/users/:id/public-key.
 *   4. Derive a shared AES-GCM key via ECDH.
 *   5. Encrypt outgoing messages with the shared key; decrypt incoming ones.
 */

// ---------------------------------------------------------------------------
// Key pair generation
// ---------------------------------------------------------------------------

/**
 * Generate a new ECDH P-256 key pair.
 * The public key is exportable (for uploading to the server as JWK).
 * The private key is extractable only so it can be stored in IndexedDB.
 */
export async function generateKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey'],
  ) as Promise<CryptoKeyPair>;
}

// ---------------------------------------------------------------------------
// Import / export helpers
// ---------------------------------------------------------------------------

/**
 * Serialise a CryptoKey (public ECDH key) to a JWK JSON string for storage
 * and transmission.
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

/**
 * Deserialise a JWK JSON string back into a CryptoKey suitable for ECDH
 * public-key operations.
 */
export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString) as JsonWebKey;
  return crypto.subtle.importKey(
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

/**
 * Derive a symmetric AES-GCM 256-bit key from our private ECDH key and the
 * partner's public ECDH key. Both sides arrive at the same shared secret.
 */
export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext string with AES-GCM.
 *
 * Returns a base64 string containing a 12-byte random IV prepended to the
 * ciphertext. The IV is unique per message (random nonce) so the same
 * plaintext always produces different ciphertext.
 */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded AES-GCM ciphertext (IV-prepended format produced
 * by `encrypt`).
 */
export async function decrypt(key: CryptoKey, ciphertextBase64: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ---------------------------------------------------------------------------
// IndexedDB persistence
// ---------------------------------------------------------------------------

const DB_NAME = 'gratonite-e2e';
const STORE_NAME = 'keys';

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Public API — load or create key pair
// ---------------------------------------------------------------------------

/**
 * Load the user's ECDH key pair from IndexedDB, or generate a new one and
 * upload the public key to the server.
 *
 * Returns null if the operation fails for any reason (unsupported browser,
 * network error, etc.) — the caller should fall back to unencrypted mode.
 *
 * @param userId — The authenticated user's ID (used as the IndexedDB key).
 */
export async function getOrCreateKeyPair(
  userId: string,
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey } | null> {
  try {
    const db = await openKeyDB();

    // Try to load an existing key pair.
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const existing = await new Promise<{ publicKey: CryptoKey; privateKey: CryptoKey } | undefined>(
      (resolve, reject) => {
        const req = store.get(userId);
        req.onsuccess = () => resolve(req.result as { publicKey: CryptoKey; privateKey: CryptoKey } | undefined);
        req.onerror = () => reject(req.error);
      },
    );

    if (existing) return existing;

    // Generate a new key pair.
    const keyPair = await generateKeyPair();
    const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

    // Persist in IndexedDB.
    const writeTx = db.transaction(STORE_NAME, 'readwrite');
    writeTx.objectStore(STORE_NAME).put(keyPair, userId);

    // Upload the public key to the server (best-effort).
    await fetch('/api/v1/users/@me/public-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKeyJwk }),
      credentials: 'include',
    });

    return keyPair;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

/**
 * Returns true if the browser supports the Web Crypto API and IndexedDB —
 * the two requirements for E2E encryption.
 */
export function isE2ESupported(): boolean {
  return !!(window.crypto?.subtle && window.indexedDB);
}
