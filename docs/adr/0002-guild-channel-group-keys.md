# 2. Per-Channel Wrapped Group Keys for Guild E2E Encryption

Date: 2026-04-03

## Status

Accepted

## Context

Guild text channels can opt into E2E encryption. Unlike 1:1 DMs — where both
parties derive a shared secret via ECDH — group channels need a single
symmetric key usable by every member but unreadable by the server. The key
must be distributable to N members and support rotation on membership change.

## Decision

Each encrypted channel has a symmetric AES-GCM-256 group key. The channel
creator generates this key client-side and wraps a copy for every member using
an ephemeral ECDH exchange against that member's public key. The wrapped copies
are uploaded as a JSON map (`userId → base64 blob`) via
`POST /guilds/:guildId/channels/:channelId/encryption-keys`.

Members retrieve the latest key version with the corresponding `GET` endpoint
and decrypt their copy using their ECDH private key. Key versions are
monotonically increasing integers; clients always use the highest version where
their own userId appears in `keyData`.

## Consequences

- **Positive:** Server stores only ciphertext; it cannot decrypt messages or keys.
- **Positive:** Key rotation on membership change limits forward exposure.
- **Negative:** Distribution scales linearly — one wrapped copy per member per version.
- **Negative:** Offline members must fetch the new key before decrypting recent messages.
