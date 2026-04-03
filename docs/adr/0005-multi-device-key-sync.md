# 5. Multi-Device Key Synchronisation

Date: 2026-07-15

## Status

Proposed

## Context

Gratonite users increasingly access the service from multiple devices
(web browser, desktop Electron app, and mobile). The current E2E scheme
(ADR 0001) assigns one ECDH key pair per device, stored in IndexedDB or
Expo SecureStore. This means:

- A DM sent to a user only encrypts to the recipient's **active** device key.
  Messages cannot be read on a second device unless the sender re-encrypts.
- A user who logs in on a new device has no access to historical messages.
- Group keys (ADR 0002) are tied to the encrypting device and not shared
  across the owner's devices.

This ADR defines how Gratonite will enable a single user to read and send E2E
messages from multiple devices, and how key material is distributed across them
in a server-opaque way.

## Decision

### Device registration

Each device generates a unique ECDH key pair on first launch. The **device
public key** is uploaded to the server:

```
POST /api/v1/users/@me/devices
{
  "deviceId": "<random UUIDv4>",
  "publicKey": "<JWK>",
  "deviceName": "Firefox on Windows",   // user-visible label
  "platform": "web" | "desktop" | "mobile"
}
```

The server stores the device record and the public key. The device list is
visible to the owning user (to review and revoke devices):

```
GET  /api/v1/users/@me/devices
DELETE /api/v1/users/@me/devices/{deviceId}
```

When a user sends a DM, the client fetches the recipient's device list and
encrypts a **per-device copy** of the message key envelope. All device copies
are submitted in a single `POST /messages` request. The server fans them out
to each device's message queue.

### Key sync envelope

When a new device comes online for the first time, it needs access to the user's
existing group keys (guild channel keys, ADR 0002) and, if Double Ratchet is
enabled, the ratchet root keys for in-progress conversations.

The sync mechanism uses a **key sync envelope** — a bundle of existing keys
re-encrypted to the new device's public key:

```json
{
  "deviceId": "<new device ID>",
  "encryptedKeys": [
    {
      "keyId": "<guild channel key ID or conversation key ID>",
      "keyType": "group" | "dm-session" | "ratchet-state",
      "ciphertext": "<base64 AES-GCM-256 ciphertext>",
      "iv": "<base64 12 bytes>",
      "wrappedBy": "<sender device ID>"
    }
  ]
}
```

The re-encryption is done **client-side** by an existing logged-in device; the
server relays the envelope but cannot decrypt it.

#### New-device bootstrap flow

1. New device publishes its public key via `POST /api/v1/users/@me/devices`.
2. Server notifies existing online devices of the new registration via WebSocket
   event `device_added`.
3. An existing device fetches the new device's public key, wraps all relevant
   keys in a key sync envelope, and uploads it via:
   ```
   POST /api/v1/users/@me/devices/{newDeviceId}/key-sync
   ```
4. The new device polls or listens for `key_sync_ready` event, downloads the
   envelope, and decrypts with its local private key.
5. If no existing device is online when the new device registers, the new device
   enters a "waiting for key sync" state and requests sync the next time an
   existing device comes online.

### Conflict resolution

Multiple devices may send messages simultaneously. Since the Double Ratchet
(ADR 0004) is per-device, each device has an independent chain. When another
device's messages arrive out of order (from the server's perspective), the
receiving device applies the standard DR message-key-skipping mechanism
(buffer up to `MAX_SKIP = 1000` skipped keys).

For group keys (ADR 0002), the server-side key version counter ensures that
all devices share the same key version. If a device is offline during a key
rotation, it will receive the new key in the key sync envelope on reconnect.

### Key revocation

When a device is revoked (`DELETE /api/v1/users/@me/devices/{deviceId}`):

1. The server immediately stops delivering new messages to that device.
2. The client triggers a **group key rotation** for all guild channels the user
   belongs to, so the revoked device cannot decrypt future messages.
3. The server marks all pending message envelopes addressed to the revoked
   device as "device_revoked" and drops them.

### Historical message access on new devices

Historical messages are **not** back-decryptable on new devices by design:
the server only stores ciphertext and does not hold plaintext or key material.
Users are informed of this limitation during device setup ("Messages sent
before this device was added are not available on this device").

An optional **message export** feature (future work) may allow users to package
and re-encrypt their message history for import on a new device, keeping the
server fully out of the loop.

## Implementation plan

| Phase | Work |
|-------|------|
| 1 | `POST/GET/DELETE /api/v1/users/@me/devices` endpoints + DB schema (`user_devices` table) |
| 2 | Multi-recipient message encryption on the client (fan-out per device) |
| 3 | Key sync envelope upload/download endpoints |
| 4 | WebSocket events: `device_added`, `key_sync_ready` |
| 5 | UI: device manager in user settings (name, last seen, revoke) |
| 6 | Group key rotation on device revocation |

Phases 1–4 are prerequisites. Phase 5 is the user-visible milestone. Phase 6
must be gated by thorough testing to avoid accidental key loss.

**Dependency:** Phase 2 requires both ADR 0004 (Double Ratchet) and this ADR's
Phase 1 to be complete. The Double Ratchet and multi-device tracks should be
scheduled together in the same release cycle.

## Consequences

### Positive

- Users can read and write E2E messages from any registered device.
- Device revocation limits damage from a stolen or compromised device.
- Server remains fully server-opaque: no plaintext or key material ever stored.

### Negative / risks

- **Complexity**: multi-recipient encryption adds latency to message sends.
  The client must fetch and cache device lists; the server must fan out envelopes.
- **Delivery gaps**: if an existing device never comes online to perform key
  sync, the new device may wait indefinitely for historical keys. Mitigation:
  allow the user to "force sync" from the settings page, which skips the
  waiting-for-online-device step and starts fresh (no historical keys).
- **Bootstrap race**: two new devices registering simultaneously may both wait
  for each other to perform key sync. Mitigation: server designates the oldest
  registered device as "primary sync device".
- **Group key rotation cost**: revoking a device in a large guild (thousands of
  members) triggers an expensive fan-out key rotation. Mitigation: batch and
  throttle rotation events; the server does not need to hold the new key, only
  its version number and the encrypted copies per member device.

## Open questions

- Q: Should the server enforce a maximum number of registered devices per user?
  A (proposed): soft cap of 10 devices; warn at 8; allow override by platform
  admin via instance config.
- Q: Should historical message access via export be in scope for the first
  multi-device release?
  A (proposed): No. Export is a separate feature tracked independently.
