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
    true,
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
 * Load the user's ECDH key pair from IndexedDB, or generate a new one.
 *
 * Returns `{ keyPair, isNew }` where `isNew` is true when a fresh key pair
 * was generated (the caller is responsible for uploading the public key to
 * the server via `api.encryption.uploadPublicKey()`).
 *
 * Returns null if the operation fails for any reason (unsupported browser,
 * IndexedDB error, etc.) — the caller should fall back to unencrypted mode.
 *
 * @param userId — The authenticated user's ID (used as the IndexedDB key).
 */
export async function getOrCreateKeyPair(
  userId: string,
): Promise<{ keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }; isNew: boolean } | null> {
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

    if (existing) return { keyPair: existing, isNew: false };

    // Generate a new key pair.
    const keyPair = await generateKeyPair();

    // Persist in IndexedDB.
    const writeTx = db.transaction(STORE_NAME, 'readwrite');
    writeTx.objectStore(STORE_NAME).put(keyPair, userId);

    return { keyPair, isNew: true };
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

// ---------------------------------------------------------------------------
// File encryption / decryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a File or Blob with AES-GCM using the given key.
 * Returns the encrypted blob, a random IV, and the encrypted original filename.
 * Max recommended size: ~25 MB (reads entire file into memory).
 */
export async function encryptFile(
  key: CryptoKey,
  file: File,
): Promise<{ encryptedBlob: Blob; encryptedFilename: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buffer = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer);

  // Encrypt the filename so it's not visible in transit/storage
  const filenameEncrypted = await encrypt(key, file.name);

  return {
    encryptedBlob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    encryptedFilename: filenameEncrypted,
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypt an encrypted blob back into a File.
 * @param key    — AES-GCM key used to encrypt the file.
 * @param blob   — The encrypted blob.
 * @param ivB64  — Base64-encoded 12-byte IV.
 * @param encryptedFilename — Encrypted original filename (from encryptFile).
 */
export async function decryptFile(
  key: CryptoKey,
  blob: Blob,
  ivB64: string,
  encryptedFilename: string,
): Promise<File> {
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ciphertext = await blob.arrayBuffer();
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  const filename = await decrypt(key, encryptedFilename);
  return new File([plaintext], filename);
}

// ---------------------------------------------------------------------------
// Safety number computation (key verification)
// ---------------------------------------------------------------------------

/**
 * Compute a safety number for verifying identities between two users.
 * SHA-256 of deterministically-ordered raw public keys, formatted as a 60-digit number.
 */
export async function computeSafetyNumber(
  myPublicKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<string> {
  const myRaw = new Uint8Array(await crypto.subtle.exportKey('raw', myPublicKey));
  const theirRaw = new Uint8Array(await crypto.subtle.exportKey('raw', theirPublicKey));

  // Deterministic ordering: smaller raw key first
  let first: Uint8Array, second: Uint8Array;
  for (let i = 0; i < myRaw.length; i++) {
    if (myRaw[i] < theirRaw[i]) { first = myRaw; second = theirRaw; break; }
    if (myRaw[i] > theirRaw[i]) { first = theirRaw; second = myRaw; break; }
  }
  first ??= myRaw;
  second ??= theirRaw;

  const combined = new Uint8Array(first.length + second.length);
  combined.set(first, 0);
  combined.set(second, first.length);

  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', combined));
  // Convert to decimal digits and take first 60
  const digits = Array.from(hash).map(b => b.toString().padStart(3, '0')).join('');
  return digits.slice(0, 60);
}

// ---------------------------------------------------------------------------
// Group key management (GROUP_DM E2E)
// ---------------------------------------------------------------------------

/**
 * Generate a new symmetric AES-GCM 256-bit group key.
 * Used when initialising E2E encryption for a GROUP_DM channel.
 */
export async function generateGroupKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Export a group key as raw bytes, then encrypt it for a specific member
 * using an ephemeral ECDH key exchange with their public ECDH key.
 *
 * The output is a base64-encoded JSON blob containing:
 *   - `eph`: the ephemeral public key (JWK) used for the ECDH exchange
 *   - `iv`:  the AES-GCM IV (base64)
 *   - `ct`:  the AES-GCM ciphertext (base64)
 *
 * The recipient decrypts by performing the same ECDH derivation with their
 * private key and the ephemeral public key, then decrypting with AES-GCM.
 *
 * @param groupKey       — The symmetric group key to wrap.
 * @param memberPublicKey — The recipient's ECDH P-256 public key.
 * @returns              Base64-encoded encrypted key blob.
 */
export async function encryptGroupKey(groupKey: CryptoKey, memberPublicKey: CryptoKey): Promise<string> {
  // Export group key to raw bytes.
  const rawKey = await crypto.subtle.exportKey('raw', groupKey);

  // Generate an ephemeral ECDH key pair for this wrapping operation.
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey'],
  );

  // Derive a one-time wrapping key via ECDH between the ephemeral private key
  // and the member's public key.
  const wrappingKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: memberPublicKey },
    (ephemeral as CryptoKeyPair).privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  // Encrypt the raw group key bytes with the wrapping key.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, rawKey);

  // Export the ephemeral public key as JWK so the recipient can reconstruct
  // the ECDH shared secret.
  const ephPublicJwk = await crypto.subtle.exportKey('jwk', (ephemeral as CryptoKeyPair).publicKey);

  // Combine all fields into a single base64-encoded JSON blob.
  const combined = {
    eph: ephPublicJwk,
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
  return btoa(JSON.stringify(combined));
}

/**
 * Decrypt a group key that was encrypted by `encryptGroupKey`.
 *
 * @param encryptedBase64 — The base64 blob produced by `encryptGroupKey`.
 * @param myPrivateKey    — The calling user's ECDH P-256 private key.
 * @returns               The decrypted AES-GCM CryptoKey, or null on failure.
 */
export async function decryptGroupKey(
  encryptedBase64: string,
  myPrivateKey: CryptoKey,
): Promise<CryptoKey | null> {
  try {
    const combined = JSON.parse(atob(encryptedBase64)) as {
      eph: JsonWebKey;
      iv: string;
      ct: string;
    };

    // Import the sender's ephemeral public key.
    const ephPublicKey = await crypto.subtle.importKey(
      'jwk',
      combined.eph,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );

    // Derive the same wrapping key using our private key and the ephemeral public key.
    const wrappingKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: ephPublicKey },
      myPrivateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );

    // Decrypt the raw group key bytes.
    const iv = Uint8Array.from(atob(combined.iv), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(combined.ct), (c) => c.charCodeAt(0));
    const rawKey = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ct);

    // Import the raw bytes back as an AES-GCM key.
    return crypto.subtle.importKey(
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

/**
 * Encrypt a plaintext message with the group AES-GCM key.
 * Delegates to the shared `encrypt` utility — provided as a named alias for
 * call-site clarity.
 */
export async function encryptWithGroupKey(key: CryptoKey, plaintext: string): Promise<string> {
  return encrypt(key, plaintext);
}

/**
 * Decrypt a ciphertext message with the group AES-GCM key.
 * Delegates to the shared `decrypt` utility — provided as a named alias for
 * call-site clarity.
 */
export async function decryptWithGroupKey(key: CryptoKey, ciphertext: string): Promise<string> {
  return decrypt(key, ciphertext);
}
