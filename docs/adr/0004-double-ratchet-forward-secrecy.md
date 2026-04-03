# 4. Double Ratchet Algorithm for Forward Secrecy in DMs

Date: 2026-07-15

## Status

Proposed

## Context

Gratonite DMs currently use a single static ECDH-derived session key per
conversation (see ADR 0001). While this provides confidentiality, it does not
provide **forward secrecy** or **break-in recovery**:

- If a user's private key is ever compromised, an attacker can decrypt all past
  messages that were captured in transit.
- There is no mechanism to "rotate" per-message keys so that each key derivation
  is independent and one leaked key does not expose the full conversation.

The Signal Protocol's **Double Ratchet Algorithm** is the industry standard
addressing both properties. It combines:

1. A **Diffie-Hellman (DH) ratchet** — each new message batch triggers a new
   ephemeral DH key exchange, limiting the blast radius of a compromised key.
2. A **symmetric-key ratchet** — within a DH epoch, each message advances a KDF
   chain so that keys cannot be re-derived in reverse.

Signal's reference implementations and `@stablelib/x25519` + `@stablelib/hkdf`
are production-ready, audited, and pure JS/TypeScript — compatible with both
Web Crypto and React Native environments.

## Decision

Adopt the Double Ratchet Algorithm for all new DM conversations. The migration
will proceed as follows:

### Protocol versioning

A `_e2e` wire-format version field distinguishes encryption generations:

| Value | Scheme | Notes |
|-------|--------|-------|
| `1`   | ECDH P-256 + AES-GCM-256 | Current; all existing conversations |
| `2`   | _(reserved)_ | — |
| `3`   | X25519 Double Ratchet + AES-GCM-256 | New conversations post-migration |

Old clients receive `_e2e: 1` messages and continue to decrypt with the existing
scheme. New clients detect `_e2e: 3` and apply Double Ratchet.

### Key primitives

| Primitive | Algorithm | Rationale |
|-----------|-----------|-----------|
| DH ratchet | X25519 (Curve25519) | Faster than P-256; constant-time; `@stablelib/x25519` works in both environments |
| KDF chain | HKDF-SHA-256 | Standard; `@stablelib/hkdf` available |
| Message encryption | AES-GCM-256 | Already deployed; no change |
| Initial key material | X3DH (Extended Triple DH) | Pre-key bundles on the server for async session init |

### Server-opaque ratchet state

The server stores **encrypted ratchet state blobs** per (user, conversation)
pair. Blobs are encrypted to the user's device key before upload — the server
never sees the ratchet root key or message keys. The API endpoint is:

```
PUT /api/v1/dm/{conversationId}/ratchet-state
GET /api/v1/dm/{conversationId}/ratchet-state
```

### Backward compatibility

- Existing `_e2e: 1` conversations are **not re-encrypted**. New messages in
  those conversations continue to use the old scheme until both parties are on
  a client that supports DR.
- A migration prompt is shown once per conversation on first open after upgrade.
- The client upgrades to `_e2e: 3` on the next message send when both parties
  have published X3DH pre-key bundles.

### Library choice

Use `@stablelib/x25519` + `@stablelib/hkdf` rather than a full Signal Protocol
library (e.g., `@privacyresearch/libsignal-protocol-typescript`) to avoid:

- Binary WASM blobs incompatible with React Native's JSI;
- Transitive dependency on legacy `protobufjs` versions;
- Opaque error handling that complicates debugging.

The Double Ratchet state machine will be implemented in
`apps/web/src/lib/crypto/DoubleRatchet.ts` and mirrored in
`apps/mobile/src/lib/crypto/DoubleRatchet.ts`.

## Prerequisites before implementation begins

1. **X3DH pre-key endpoint**: `POST /api/v1/users/@me/prekeys` — upload signed
   pre-key bundle (identity key, signed pre-key, one-time pre-keys).
2. **Ratchet state storage**: DB schema + API endpoints for encrypted state blobs.
3. **Message schema migration**: wire format update to include `_e2e: 3`,
   `ratchetHeader` (DH public key + message counter), and nonce.
4. **Mobile parity**: `apps/mobile/src/lib/crypto/DoubleRatchet.ts` must ship
   in the same release as the web client.
5. **Security audit**: engage an external auditor before enabling in production.

## Consequences

### Positive

- Forward secrecy: a compromised device key does not expose past messages.
- Break-in recovery: after a compromise is resolved, the ratchet heals within
  one message exchange.
- Future-proof: the same primitive underpins WhatsApp, Signal, and Matrix
  Megolm — well-understood by security researchers.

### Negative / risks

- **Complexity**: Double Ratchet is significantly more complex than the current
  static-key scheme. The implementation must be extensively tested.
- **Out-of-order messages**: the DH ratchet must buffer up to N skipped message
  keys; the current simple scheme has no such requirement.
- **Multi-device**: the ratchet is per-device by default. Combined with ADR 0005
  (multi-device key sync), each device maintains an independent ratchet state
  per conversation. This requires a key-distribution mechanism for new messages
  sent while a device is offline.
- **Migration complexity**: existing conversations must remain decryptable.
  Dual-decryption path must be maintained for the lifetime of `_e2e: 1`
  conversations.

## Open questions

- Q: Should Gratonite implement X3DH for initial key exchange or a simpler
  ECDH handshake with ephemeral keys?
  A (proposed): X3DH for async session init (pre-key bundles on server);
  fall back to interactive ECDH if pre-key bundle is unavailable.
- Q: How many one-time pre-keys should the server accept per user?
  A (proposed): 100 per device; server signals "low pre-keys" at < 10.
