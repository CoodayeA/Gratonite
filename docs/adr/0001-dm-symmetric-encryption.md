# 1. Use ECDH P-256 + AES-GCM-256 for DM Symmetric Encryption

Date: 2026-04-03

## Status

Accepted

## Context

Gratonite provides end-to-end encrypted direct messages across web and mobile
clients. The primitives must work in both the Web Crypto API (browsers) and
react-native-quick-crypto (React Native via JSI) without native C add-ons or
WebAssembly shims. Both platforms support ECDH P-256 and AES-GCM-256.
Curve25519 was considered but lacks native Web Crypto support in all target
browsers.

## Decision

Use ECDH P-256 for key agreement and AES-GCM-256 for symmetric encryption.
Each user generates a long-lived ECDH key pair; the private key is stored
locally (IndexedDB on web, Expo SecureStore on mobile) and never sent to the
server. The public key is uploaded as JWK to `/api/v1/users/@me/public-key`.
Wire format is `base64(12-byte-IV || ciphertext)`, identical across both
clients.

## Consequences

- **Positive:** Single code path for web and mobile; no native compilation step.
- **Positive:** AES-GCM provides authenticated encryption (integrity + confidentiality).
- **Negative:** No forward secrecy — compromising a private key exposes all past
  messages. A future Double Ratchet or MLS integration would address this.
- **Negative:** P-256 is not post-quantum resistant; revisit when browser ML-KEM
  support matures.
