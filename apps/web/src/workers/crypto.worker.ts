/**
 * crypto.worker.ts — Web Worker that performs AES-GCM encrypt/decrypt
 * off the main thread so the UI stays responsive during E2E operations.
 *
 * Receives messages with { id, op, payload } and responds with { id, result }
 * or { id, error }. CryptoKey objects are structured-cloneable and can be
 * posted directly.
 */

type WorkerRequest =
  | { id: number; op: 'encrypt'; payload: { key: CryptoKey; plaintext: string } }
  | { id: number; op: 'decrypt'; payload: { key: CryptoKey; ciphertextBase64: string } }
  | { id: number; op: 'encryptFile'; payload: { key: CryptoKey; buffer: ArrayBuffer; filename: string } }
  | { id: number; op: 'decryptFile'; payload: { key: CryptoKey; buffer: ArrayBuffer; ivB64: string; encryptedFilename: string } };

// ---------------------------------------------------------------------------
// Core crypto operations (same logic as e2e.ts, duplicated here so the worker
// is fully self-contained with no imports)
// ---------------------------------------------------------------------------

async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}

async function decrypt(key: CryptoKey, ciphertextBase64: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function encryptFileOp(
  key: CryptoKey,
  buffer: ArrayBuffer,
  filename: string,
): Promise<{ encryptedBuffer: ArrayBuffer; encryptedFilename: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer);
  const encryptedFilename = await encrypt(key, filename);
  return {
    encryptedBuffer: ciphertext,
    encryptedFilename,
    iv: btoa(String.fromCharCode(...iv)),
  };
}

async function decryptFileOp(
  key: CryptoKey,
  buffer: ArrayBuffer,
  ivB64: string,
  encryptedFilename: string,
): Promise<{ decryptedBuffer: ArrayBuffer; filename: string }> {
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buffer);
  const filename = await decrypt(key, encryptedFilename);
  return { decryptedBuffer: plaintext, filename };
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, op, payload } = e.data;
  try {
    switch (op) {
      case 'encrypt': {
        const result = await encrypt(payload.key, payload.plaintext);
        self.postMessage({ id, result });
        break;
      }
      case 'decrypt': {
        const result = await decrypt(payload.key, payload.ciphertextBase64);
        self.postMessage({ id, result });
        break;
      }
      case 'encryptFile': {
        const result = await encryptFileOp(payload.key, payload.buffer, payload.filename);
        self.postMessage({ id, result }, [result.encryptedBuffer] as unknown as Transferable[]);
        break;
      }
      case 'decryptFile': {
        const result = await decryptFileOp(payload.key, payload.buffer, payload.ivB64, payload.encryptedFilename);
        self.postMessage({ id, result }, [result.decryptedBuffer] as unknown as Transferable[]);
        break;
      }
      default:
        self.postMessage({ id, error: `Unknown op: ${op}` });
    }
  } catch (err: any) {
    self.postMessage({ id, error: err?.message || 'Worker crypto error' });
  }
};
