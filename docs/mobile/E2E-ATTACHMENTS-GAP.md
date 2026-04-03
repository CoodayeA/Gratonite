# Mobile: E2E attachment parity gap

## Summary

**Web** encrypts file attachments for DMs and encrypted channels before upload using `encryptFile` in [`apps/web/src/lib/e2e.ts`](../../apps/web/src/lib/e2e.ts), with encrypted filename and IV metadata sent alongside the message.

**Mobile** (`apps/mobile`) historically sent uploads as **plaintext** files and, in some paths, only surfaced the file URL in the message body until the full attachment pipeline matched the web API.

## Product goal

- Same security story as web: **no plaintext media on server** for encrypted conversations.
- Same API surface: `attachmentIds` + encrypted metadata on `POST` message create, consistent with web.

## Engineering notes

- React Native / Expo must use **Web Crypto–compatible** or **native** crypto for AES-GCM with the same keys derived from the existing E2E stack (`useE2E`, `encryptionApi`).
- Align with [`apps/api`](../api/) message validation for attachment ownership and size limits.
- Add tests or manual QA matrix for image/video/document pickers.

## Status

**Tracked** under roadmap execution [Phase A3 — E2E attachments completion](../EXECUTION-PLAN.md#a3--e2e-attachments-completion-not-invention).
