/**
 * useE2E — React hook for E2E encryption in DMs and Group DMs.
 *
 * Usage:
 *   const { encryptMessage, decryptMessage, isE2EReady } = useE2E({
 *     userId: currentUser.id,
 *     channelId,
 *     recipientId,        // for 1:1 DMs
 *     isGroupDm,          // for group DMs
 *     groupParticipantIds, // member IDs for group key generation
 *   });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getOrCreateKeyPair,
  importPublicKey,
  deriveSharedKey,
  encrypt,
  decrypt,
  decryptGroupKey,
  generateGroupKey,
  encryptGroupKey,
  exportPublicKey,
  loadKeyPairFromSecureStore,
} from '../lib/crypto';
import { publicKeyCache } from '../lib/publicKeyCache';
import { encryption as encryptionApi } from '../lib/api';

interface UseE2EOptions {
  userId: string | undefined;
  channelId: string;
  recipientId?: string;
  isGroupDm?: boolean;
  groupParticipantIds?: string[];
}

interface UseE2EResult {
  e2eKey: CryptoKey | null;
  isE2EReady: boolean;
  encryptMessage: (plaintext: string) => Promise<{ content?: string; encryptedContent?: string; isEncrypted?: boolean }>;
  decryptMessage: (encryptedContent: string) => Promise<string>;
}

export function useE2E({
  userId,
  channelId,
  recipientId,
  isGroupDm,
  groupParticipantIds,
}: UseE2EOptions): UseE2EResult {
  const [e2eKey, setE2eKey] = useState<CryptoKey | null>(null);
  const [isE2EReady, setIsE2EReady] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    initRef.current = false;
    setE2eKey(null);
    setIsE2EReady(false);
  }, [channelId, recipientId]);

  useEffect(() => {
    if (!userId || initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        // Ensure local keypair exists
        const keyPair = await getOrCreateKeyPair(userId, async (pubJwk) => {
          await encryptionApi.uploadPublicKey(pubJwk);
        });
        if (!keyPair) {
          setIsE2EReady(true);
          return;
        }

        if (isGroupDm) {
          // Group DM flow
          await initGroupE2E(keyPair, channelId, groupParticipantIds ?? []);
        } else if (recipientId) {
          // 1:1 DM flow
          await initDME2E(keyPair, recipientId);
        }
      } catch {
        // E2E init failed, fall back to plaintext
      } finally {
        setIsE2EReady(true);
      }
    })();

    return () => { initRef.current = false; };
  }, [userId, channelId, recipientId, isGroupDm]);

  const initDME2E = async (
    keyPair: { publicKey: CryptoKey; privateKey: CryptoKey },
    recipientId: string,
  ) => {
    // Check cache first
    const cached = publicKeyCache.getSharedKey(recipientId);
    if (cached) {
      setE2eKey(cached);
      return;
    }

    try {
      const res = await encryptionApi.getPublicKey(recipientId);
      if (!res?.publicKey) return; // Recipient has no key

      const theirKey = await importPublicKey(res.publicKey);
      publicKeyCache.setPublicKey(recipientId, theirKey);

      const shared = await deriveSharedKey(keyPair.privateKey, theirKey);
      publicKeyCache.setSharedKey(recipientId, shared);
      setE2eKey(shared);
    } catch {
      // Recipient has no key or fetch failed — plaintext fallback
    }
  };

  const initGroupE2E = async (
    keyPair: { publicKey: CryptoKey; privateKey: CryptoKey },
    channelId: string,
    participantIds: string[],
  ) => {
    // Check cache
    const cached = publicKeyCache.getGroupKey(channelId);
    if (cached) {
      setE2eKey(cached.key);
      return;
    }

    try {
      const res = await encryptionApi.getGroupKey(channelId);
      if (res?.keyData) {
        // Decrypt the group key with our private key
        const groupKey = await decryptGroupKey(res.keyData, keyPair.privateKey);
        if (groupKey) {
          publicKeyCache.setGroupKey(channelId, res.version ?? 1, groupKey);
          setE2eKey(groupKey);
          return;
        }
      }

      // No group key exists — generate one if we have participants
      if (participantIds.length > 0) {
        const groupKey = await generateGroupKey();

        // Encrypt for each participant
        for (const pid of participantIds) {
          try {
            const pubRes = await Promise.race([
              encryptionApi.getPublicKey(pid),
              new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
            ]);
            if (!pubRes?.publicKey) continue;
            const memberKey = await importPublicKey(pubRes.publicKey);
            const encryptedKey = await encryptGroupKey(groupKey, memberKey);
            await encryptionApi.setGroupKey(channelId, 1, encryptedKey);
          } catch {
            // Skip members without keys or timed out
          }
        }

        // Also encrypt for ourselves
        const selfEncrypted = await encryptGroupKey(groupKey, keyPair.publicKey);
        await encryptionApi.setGroupKey(channelId, 1, selfEncrypted);

        publicKeyCache.setGroupKey(channelId, 1, groupKey);
        setE2eKey(groupKey);
      }
    } catch {
      // Group key setup failed
    }
  };

  const encryptMessage = useCallback(async (plaintext: string) => {
    if (!e2eKey) {
      return { content: plaintext };
    }
    try {
      const encryptedContent = await encrypt(e2eKey, plaintext);
      return { encryptedContent, isEncrypted: true };
    } catch {
      return { content: plaintext };
    }
  }, [e2eKey]);

  const decryptMessage = useCallback(async (encryptedContent: string) => {
    if (!e2eKey) {
      return '[Decryption failed]';
    }
    try {
      return await decrypt(e2eKey, encryptedContent);
    } catch {
      return '[Decryption failed]';
    }
  }, [e2eKey]);

  return { e2eKey, isE2EReady, encryptMessage, decryptMessage };
}
