# Forward secrecy and multi-device — technical plan

This document scopes **Double Ratchet–style forward secrecy** and **multi-device key sync** for Gratonite. It is a **planning** artifact; implementation lives in `apps/web/src/lib/e2e.ts` and related API routes over time.

## Today (baseline)

- **1:1 DMs:** ECDH (P-256) → shared AES-GCM key; static key per pair until key rotation.
- **Group DMs:** Symmetric group key, distributed to members with per-user wrapping.
- **Attachments:** AES-GCM file encryption with IV + encrypted filename metadata (web).
- **Limitation:** Long-term key compromise can expose **past** messages for that epoch unless keys are rotated with a ratchet-like protocol.

## Goals

1. **Forward secrecy:** Compromise of a device state at time T should not reveal **all** prior messages (Signal-style property requires a ratchet or frequent DH steps).
2. **Post-compromise security:** Recovery after a bad state is rotated in.
3. **Multi-device:** Same logical user, multiple browsers/devices — consistent **identity** and **decryption** without copying raw private keys to the server.

## Non-goals (initial phases)

- Replacing federation transport security (TLS + HTTP signatures) — orthogonal.
- Server-side key escrow — excluded unless explicitly product-approved.

## Recommended phases

### Phase 0 — Research and threat model (1–2 weeks)

- Document exact threat model (device theft, malware, server compromise, network adversary).
- Choose library or spec: Signal Protocol patterns (X3DH + Double Ratchet) vs. simplified “hash ratchet” with periodic DH.
- Decide: **same** group key story for large groups vs. pairwise ratchets (cost).

### Phase 1 — Session state and persistence

- Define durable **session state** per peer (or per group) in IndexedDB: chain keys, root keys, message number counters.
- Migration path from current static AES keys for DMs (versioned `keyVersion` already exists in messages — extend).

### Phase 2 — Double Ratchet (DMs first)

- Implement ratchet for **1:1** only; group DM uses existing group key until Phase 4.
- Interop tests: two clients, message loss, out-of-order, replay.

### Phase 3 — Multi-device sync

- **Option A (common):** Primary device generates pre-keys; secondary devices enroll via **QR or signed pairing** from primary; server stores only **public** pre-key bundles.
- **Option B:** Password-wrapped export of key material (weaker UX, higher risk).

Server APIs must never store private keys.

### Phase 4 — Groups

- MLS (Messaging Layer Security) or Sender Keys — team decision; high complexity.

## Dependencies

- Stable attachment encryption and message pipeline (web + mobile parity).
- Clear product stance on **backup** (encrypted backup vs. none).

## References

- Signal Protocol overview (conceptual).
- RFC 9420 (MLS) if pursuing standard group encryption.

## Status

**Not started** — baseline remains ECDH + AES-GCM as implemented in `e2e.ts`.
