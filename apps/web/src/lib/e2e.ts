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
// Crypto Worker — offload encrypt/decrypt to a Web Worker so the UI stays
// responsive. Falls back to main thread if Workers are unavailable.
// ---------------------------------------------------------------------------

let _worker: Worker | null = null;
let _workerFailed = false;
let _nextId = 0;
const _pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

function getCryptoWorker(): Worker | null {
  if (_workerFailed) return null;
  if (_worker) return _worker;
  try {
    _worker = new Worker(
      new URL('../workers/crypto.worker.ts', import.meta.url),
      { type: 'module' },
    );
    _worker.onmessage = (e: MessageEvent) => {
      const { id, result, error } = e.data;
      const p = _pending.get(id);
      if (!p) return;
      _pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve(result);
    };
    _worker.onerror = () => {
      // Worker failed to load — mark as unavailable and reject all pending
      _workerFailed = true;
      _worker = null;
      for (const [, p] of _pending) p.reject(new Error('Worker unavailable'));
      _pending.clear();
    };
    return _worker;
  } catch {
    _workerFailed = true;
    return null;
  }
}

function postToWorker<T>(op: string, payload: Record<string, any>, transfer?: Transferable[]): Promise<T> | null {
  const w = getCryptoWorker();
  if (!w) return null;
  const id = _nextId++;
  return new Promise<T>((resolve, reject) => {
    _pending.set(id, { resolve, reject });
    w.postMessage({ id, op, payload }, transfer ?? []);
  });
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt (main-thread implementations kept as fallbacks)
// ---------------------------------------------------------------------------

async function _encryptMainThread(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}

async function _decryptMainThread(key: CryptoKey, ciphertextBase64: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypt a plaintext string with AES-GCM.
 * Uses a Web Worker when available; falls back to main thread.
 */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const workerResult = postToWorker<string>('encrypt', { key, plaintext });
  if (workerResult) {
    try { return await workerResult; } catch { /* fall through to main thread */ }
  }
  return _encryptMainThread(key, plaintext);
}

/**
 * Decrypt a base64-encoded AES-GCM ciphertext.
 * Uses a Web Worker when available; falls back to main thread.
 */
export async function decrypt(key: CryptoKey, ciphertextBase64: string): Promise<string> {
  const workerResult = postToWorker<string>('decrypt', { key, ciphertextBase64 });
  if (workerResult) {
    try { return await workerResult; } catch { /* fall through to main thread */ }
  }
  return _decryptMainThread(key, ciphertextBase64);
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
  options?: { createIfMissing?: boolean },
): Promise<{ keyPair: { publicKey: CryptoKey; privateKey: CryptoKey }; isNew: boolean } | null> {
  const createIfMissing = options?.createIfMissing ?? true;
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
    if (!createIfMissing) return null;

    // Generate a new key pair.
    const keyPair = await generateKeyPair();

    // Persist in IndexedDB — await the write so the key is durable before
    // we return. A fire-and-forget put() can silently lose the key if the
    // tab closes before the IDB transaction commits, causing permanent loss.
    await new Promise<void>((resolve, reject) => {
      const writeTx = db.transaction(STORE_NAME, 'readwrite');
      const req = writeTx.objectStore(STORE_NAME).put(keyPair, userId);
      req.onerror = () => reject(req.error);
      writeTx.oncomplete = () => resolve();
      writeTx.onerror = () => reject(writeTx.error);
      writeTx.onabort = () => reject(writeTx.error);
    });

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
// Previous key pair retrieval
// ---------------------------------------------------------------------------

/**
 * Load a previously saved "previous" key pair from IndexedDB.
 *
 * This is only populated when the user explicitly rotates or imports a key
 * bundle (the old key pair is stored under `${userId}_prev` before the new
 * one overwrites the primary slot). Returns null if no previous pair exists.
 */
export async function getPreviousKeyPair(
  userId: string,
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey } | null> {
  try {
    const idb = await openKeyDB();
    return await new Promise<{ publicKey: CryptoKey; privateKey: CryptoKey } | null>(
      (resolve, reject) => {
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(`${userId}_prev`);
        req.onsuccess = () =>
          resolve(
            (req.result as { publicKey: CryptoKey; privateKey: CryptoKey } | undefined) ?? null,
          );
        req.onerror = () => reject(req.error);
      },
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Key bundle export / import (Settings → Privacy)
// ---------------------------------------------------------------------------

/**
 * Export the user's ECDH key pair as a password-encrypted bundle (JSON).
 *
 * The private key is wrapped with AES-GCM using a PBKDF2-derived key so it
 * can be stored or transferred safely. The bundle is intended to be saved by
 * the user and imported on another device to restore decryption capability.
 */
export async function exportKeyBundle(userId: string, password: string): Promise<string> {
  const result = await getOrCreateKeyPair(userId, { createIfMissing: false });
  if (!result) throw new Error('No local encryption key available');

  const enc = new TextEncoder();
  const privateKeyBytes = await crypto.subtle.exportKey('pkcs8', result.keyPair.privateKey);
  const publicKeyBytes = await crypto.subtle.exportKey('spki', result.keyPair.publicKey);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const wrapKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedPrivKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrapKey,
    privateKeyBytes,
  );

  const bundle = {
    version: 1,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    encryptedPrivateKey: btoa(String.fromCharCode(...new Uint8Array(encryptedPrivKey))),
    publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKeyBytes))),
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Import a key bundle previously created by `exportKeyBundle` and store the
 * recovered key pair in IndexedDB, replacing any existing key for the user.
 *
 * The old key pair (if any) is saved under `${userId}_prev` so that messages
 * encrypted with the old shared key remain decryptable.
 */
export async function importKeyBundle(
  userId: string,
  bundleJson: string,
  password: string,
): Promise<{ publicKeyJwk: string }> {
  const bundle = JSON.parse(bundleJson) as {
    version: number;
    salt: string;
    iv: string;
    encryptedPrivateKey: string;
    publicKey: string;
  };
  if (bundle.version !== 1) throw new Error('Unsupported bundle version');

  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(bundle.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(bundle.iv), (c) => c.charCodeAt(0));
  const encryptedPrivBytes = Uint8Array.from(atob(bundle.encryptedPrivateKey), (c) =>
    c.charCodeAt(0),
  );
  const publicKeyBytes = Uint8Array.from(atob(bundle.publicKey), (c) => c.charCodeAt(0));

  const passKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const wrapKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  const privateKeyBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrapKey,
    encryptedPrivBytes,
  );

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey'],
  );
  const publicKey = await crypto.subtle.importKey(
    'spki',
    publicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );

  const idb = await openKeyDB();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Save current key (if any) as previous before overwriting.
    const readReq = store.get(userId);
    readReq.onsuccess = () => {
      if (readReq.result) store.put(readReq.result, `${userId}_prev`);
      store.put({ publicKey, privateKey }, userId);
    };
    readReq.onerror = () => reject(readReq.error);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return { publicKeyJwk: await exportPublicKey(publicKey) };
}

// ---------------------------------------------------------------------------
// File encryption / decryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a File or Blob with AES-GCM using the given key.
 * Uses a Web Worker when available; falls back to main thread.
 */
export async function encryptFile(
  key: CryptoKey,
  file: File,
): Promise<{ encryptedBlob: Blob; encryptedFilename: string; iv: string }> {
  const buffer = await file.arrayBuffer();
  const workerResult = postToWorker<{ encryptedBuffer: ArrayBuffer; encryptedFilename: string; iv: string }>(
    'encryptFile',
    { key, buffer, filename: file.name },
    [buffer],
  );
  if (workerResult) {
    try {
      const r = await workerResult;
      return {
        encryptedBlob: new Blob([r.encryptedBuffer], { type: 'application/octet-stream' }),
        encryptedFilename: r.encryptedFilename,
        iv: r.iv,
      };
    } catch { /* fall through */ }
  }
  // Main thread fallback
  const freshBuffer = await file.arrayBuffer(); // re-read since original was transferred
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, freshBuffer);
  const filenameEncrypted = await _encryptMainThread(key, file.name);
  return {
    encryptedBlob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    encryptedFilename: filenameEncrypted,
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypt an encrypted blob back into a File.
 * Uses a Web Worker when available; falls back to main thread.
 */
export async function decryptFile(
  key: CryptoKey,
  blob: Blob,
  ivB64: string,
  encryptedFilename: string,
): Promise<File> {
  const buffer = await blob.arrayBuffer();
  const workerResult = postToWorker<{ decryptedBuffer: ArrayBuffer; filename: string }>(
    'decryptFile',
    { key, buffer, ivB64, encryptedFilename },
    [buffer],
  );
  if (workerResult) {
    try {
      const r = await workerResult;
      return new File([r.decryptedBuffer], r.filename);
    } catch { /* fall through */ }
  }
  // Main thread fallback
  const freshBuffer = await blob.arrayBuffer();
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, freshBuffer);
  const filename = await _decryptMainThread(key, encryptedFilename);
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

// ---------------------------------------------------------------------------
// Web Worker bridge — offloads encrypt/decrypt to a background thread
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let workerReady = false;
let msgId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

/**
 * Initialise the E2E web worker. Call once at app startup.
 * Returns false if web workers are not supported.
 */
export function initE2EWorker(): boolean {
  if (worker) return true;
  if (typeof Worker === 'undefined') return false;

  try {
    worker = new Worker('/e2e-worker.js');
    worker.onmessage = (e: MessageEvent) => {
      const { id, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) {
        p.reject(new Error(error));
      } else {
        p.resolve(result);
      }
    };
    worker.onerror = () => {
      // Worker failed to load — fall back to main thread
      worker = null;
      workerReady = false;
    };
    workerReady = true;
    return true;
  } catch {
    return false;
  }
}

function workerCall<T>(action: string, payload: Record<string, unknown>, transfer?: Transferable[]): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('Worker not initialised'));
      return;
    }
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    if (transfer) {
      worker.postMessage({ id, action, payload }, transfer);
    } else {
      worker.postMessage({ id, action, payload });
    }
  });
}

/**
 * Returns true if the E2E worker is active and can accept operations.
 */
export function isWorkerReady(): boolean {
  return workerReady && worker !== null;
}

/**
 * Encrypt text using the worker (falls back to main thread if worker unavailable).
 */
export async function workerEncrypt(key: CryptoKey | string, plaintext: string): Promise<string> {
  if (!isWorkerReady() || typeof key !== 'string') {
    // Fall back to main-thread encryption
    return encrypt(key as CryptoKey, plaintext);
  }
  return workerCall<string>('encrypt', { keyId: key, plaintext });
}

/**
 * Decrypt text using the worker (falls back to main thread if worker unavailable).
 */
export async function workerDecrypt(key: CryptoKey | string, ciphertext: string): Promise<string> {
  if (!isWorkerReady() || typeof key !== 'string') {
    return decrypt(key as CryptoKey, ciphertext);
  }
  return workerCall<string>('decrypt', { keyId: key, ciphertext });
}

/**
 * Generate a key pair in the worker. Returns key IDs (references to keys held
 * inside the worker). Use workerExportPublicKey() to extract the public key JWK.
 */
export async function workerGenerateKeyPair(): Promise<{ publicKeyId: string; privateKeyId: string }> {
  return workerCall('generateKeyPair', {});
}

/**
 * Export a public key from the worker as a JWK string.
 */
export async function workerExportPublicKey(keyId: string): Promise<string> {
  return workerCall('exportPublicKey', { keyId });
}

/**
 * Import a public key JWK string into the worker. Returns the key ID.
 */
export async function workerImportPublicKey(jwkString: string): Promise<string> {
  return workerCall('importPublicKey', { jwkString });
}

/**
 * Derive a shared AES-GCM key in the worker. Returns the key ID.
 */
export async function workerDeriveSharedKey(privateKeyId: string, publicKeyId: string): Promise<string> {
  return workerCall('deriveSharedKey', { privateKeyId, publicKeyId });
}

/**
 * Release a key from the worker's memory when no longer needed.
 */
export async function workerReleaseKey(keyId: string): Promise<void> {
  await workerCall('releaseKey', { keyId });
}

/**
 * Terminate the worker and clean up.
 */
export function terminateE2EWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    workerReady = false;
    pending.clear();
  }
}
