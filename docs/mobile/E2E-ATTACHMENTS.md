# Mobile: E2E attachments

## Summary

**Web** and **mobile** encrypt file attachments for DMs and encrypted guild channels before upload using the same primitives (`encryptFile`, `_e2e: 2` JSON, `attachmentIds`). See [`docs/crypto/e2e-primitives.md`](../crypto/e2e-primitives.md).

## Implementation

| Area | Location |
|------|----------|
| Crypto | [`apps/mobile/src/lib/crypto.ts`](../../apps/mobile/src/lib/crypto.ts) |
| DM / group DM | [`apps/mobile/src/screens/app/DirectMessageScreen.tsx`](../../apps/mobile/src/screens/app/DirectMessageScreen.tsx) |
| Guild encrypted channels | [`apps/mobile/src/screens/guild/ChannelChatScreen.tsx`](../../apps/mobile/src/screens/guild/ChannelChatScreen.tsx) |
| API uploads | `encrypted.bin` / `application/octet-stream` per [`apps/api`](../../apps/api/) file routes |

## Remaining QA

- Broader manual QA on image/video pickers across iOS/Android builds.
- Automated E2E (Maestro) coverage for encrypted attach flows when feasible.
