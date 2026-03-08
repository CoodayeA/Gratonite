/**
 * In-memory caches for E2E encryption keys.
 * Cleared on logout to prevent stale key material.
 */

// Other users' imported public CryptoKeys
const publicKeys = new Map<string, CryptoKey>();

// Derived shared DM keys (ECDH result with a specific recipient)
const sharedKeys = new Map<string, CryptoKey>();

// Group channel symmetric keys
const groupKeys = new Map<string, { version: number; key: CryptoKey }>();

export const publicKeyCache = {
  // --- Public keys ---
  getPublicKey(userId: string): CryptoKey | undefined {
    return publicKeys.get(userId);
  },
  setPublicKey(userId: string, key: CryptoKey): void {
    publicKeys.set(userId, key);
  },

  // --- Shared DM keys ---
  getSharedKey(recipientId: string): CryptoKey | undefined {
    return sharedKeys.get(recipientId);
  },
  setSharedKey(recipientId: string, key: CryptoKey): void {
    sharedKeys.set(recipientId, key);
  },

  // --- Group keys ---
  getGroupKey(channelId: string): { version: number; key: CryptoKey } | undefined {
    return groupKeys.get(channelId);
  },
  setGroupKey(channelId: string, version: number, key: CryptoKey): void {
    groupKeys.set(channelId, { version, key });
  },

  // --- Clear all caches (call on logout) ---
  clearAll(): void {
    publicKeys.clear();
    sharedKeys.clear();
    groupKeys.clear();
  },
};
