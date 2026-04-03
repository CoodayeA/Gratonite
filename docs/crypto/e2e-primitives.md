# E2E cryptography — current implementation

This document is the **completed inventory** of end-to-end encryption as implemented in the repo today. It is not a roadmap. For future work (forward secrecy, multi-device), see [`../../ROADMAP.md`](../../ROADMAP.md).

## Primitives

| Mechanism | Detail |
|-----------|--------|
| Key agreement | ECDH **P-256** (`deriveKey` to AES-GCM) |
| Message encryption | **AES-GCM-256**, 12-byte IV prepended to ciphertext, base64 on the wire |
| File + filename | Same AES-GCM for bytes; filename encrypted as a nested encrypt string |

**Web:** [`apps/web/src/lib/e2e.ts`](../../apps/web/src/lib/e2e.ts), worker [`apps/web/src/workers/crypto.worker.ts`](../../apps/web/src/workers/crypto.worker.ts).  
**Mobile:** [`apps/mobile/src/lib/crypto.ts`](../../apps/mobile/src/lib/crypto.ts) (react-native-quick-crypto polyfill).

## Message and attachment wire formats

- **Plain string** — encrypted as a single base64 blob (DM text when no structured payload).
- **Structured attachments (`_e2e: 2`)** — JSON `{"_e2e":2,"text":...,"files":[{"id","iv","ef","mt"}]}` then encrypted as one string. Ciphertext files upload as `encrypted.bin` (`application/octet-stream`); see [`docs/mobile/E2E-ATTACHMENTS.md`](../mobile/E2E-ATTACHMENTS.md).

## Where long-term keys live

| Client | Storage |
|--------|---------|
| Web | ECDH key pair in **IndexedDB** (see `saveKeyPairToIndexedDB` / load helpers in `e2e.ts`) |
| Mobile | **expo-secure-store** (`apps/mobile/src/lib/crypto.ts`) |

Public keys are uploaded to the API (`POST /users/@me/public-key`); private keys never leave the device.

## DM (1:1)

1. Load or create local ECDH key pair.  
2. Fetch recipient public key; `deriveSharedKey(myPrivate, theirPublic)` → single **long-lived** AES-GCM key cached per peer.  
3. Encrypt/decrypt messages with that key.

Hook: [`apps/mobile/src/hooks/useE2E.ts`](../../apps/mobile/src/hooks/useE2E.ts) (and equivalent flow in web DM UI).

## Group DM

Group symmetric key from API (`/channels/:id/group-key`), decrypted with ECDH private key (`decryptGroupKey`), cached per channel — see `useE2E` group branch and [`apps/web/src/lib/e2e.ts`](../../apps/web/src/lib/e2e.ts) group helpers.

## Guild encrypted text channels

Per-channel AES-GCM group key, wrapped per member with ephemeral ECDH and stored server-side as `keyData[userId]` — **GET/POST**  
`/guilds/:guildId/channels/:channelId/encryption-keys`  
([`apps/api/src/routes/channels.ts`](../../apps/api/src/routes/channels.ts)). Clients decrypt their wrapped key with the private ECDH key, then use the group key for message/file encryption.

## Rotation and events

- **Guild channel keys:** Versioned uploads; clients use the latest version where their user id appears in `keyData`. Socket `GROUP_KEY_ROTATION_NEEDED` (web) prompts clients to refetch keys after membership changes — see web `ChannelChat.tsx` and [`apps/web/src/lib/socket.ts`](../../apps/web/src/lib/socket.ts).
- **DM shared keys:** No message-level ratchet; the same derived key is reused until keys are manually cleared or devices reset.

## Explicitly not implemented

- **Forward secrecy / Double Ratchet** — not shipped; static ECDH-derived session material.
- **Multi-device key sync** — not shipped; each device has its own key pair and wrapped group keys per channel version.

## Related ADRs

- [`../adr/0001-dm-symmetric-encryption.md`](../adr/0001-dm-symmetric-encryption.md)  
- [`../adr/0002-guild-channel-group-keys.md`](../adr/0002-guild-channel-group-keys.md)  
- [`../adr/0003-federation-delivery-surface.md`](../adr/0003-federation-delivery-surface.md)
