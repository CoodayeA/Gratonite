# Gratonite Federation Protocol

Technical reference for the Gratonite federation protocol.

## Overview

Gratonite federation allows independent instances to communicate, enabling:
- Cross-instance guild membership
- Federated messaging
- User profile portability
- Federated voice/video calls
- Relay-mediated NAT traversal

## Protocol Version

Current: `gratonite-federation/v1`

## Instance Discovery

Every federated instance exposes:

```
GET /.well-known/gratonite
```

Response:
```json
{
  "domain": "chat.example.com",
  "publicKeyPem": "-----BEGIN PUBLIC KEY-----...",
  "keyId": "https://chat.example.com/api/v1/federation/actor#main-key",
  "softwareVersion": "1.0.0",
  "endpoints": {
    "inbox": "/api/v1/federation/inbox",
    "users": "/api/v1/federation/users",
    "guilds": "/api/v1/federation/guilds",
    "sync": "/api/v1/federation/sync"
  },
  "federation": {
    "protocol": "gratonite-federation/v1",
    "features": {
      "enabled": true,
      "allowInbound": true,
      "allowOutbound": true,
      "allowJoins": true,
      "relayEnabled": true
    }
  },
  "relay": {
    "enabled": true,
    "connected": true,
    "relayDomain": "relay.gratonite.chat"
  }
}
```

## Authentication

All instance-to-instance requests use **HTTP Signatures** with Ed25519 keys.

### Signing

```
Signature: keyId="https://instance.com/api/v1/federation/actor#main-key",
           algorithm="ed25519",
           headers="(request-target) host date digest",
           signature="base64-encoded-signature"
```

The signing string is constructed from the specified headers. If a body is present, a `Digest: SHA-256=base64hash` header is included and verified.

### Verification

1. Extract `keyId` from the Signature header
2. Fetch the instance's `/.well-known/gratonite` endpoint
3. Verify the public key matches
4. Reconstruct the signing string
5. Verify the Ed25519 signature

## Activity Types

Activities are JSON payloads sent to the inbox endpoint (`POST /api/v1/federation/inbox`).

| Type | Direction | Description |
|------|-----------|-------------|
| `InstanceHello` | Both | Initial handshake |
| `InstanceHelloAck` | Response | Handshake acknowledgment |
| `GuildJoinRequest` | Inbound | Remote user wants to join a guild |
| `GuildJoinApproved` | Outbound | Join request accepted |
| `GuildJoinDenied` | Outbound | Join request rejected |
| `GuildLeave` | Inbound | Remote user leaving a guild |
| `MessageCreate` | Inbound | New message from remote user |
| `MessageUpdate` | Inbound | Message edit from remote user |
| `MessageDelete` | Inbound | Message deletion from remote user |
| `TypingStart` | Both | Typing indicator |
| `PresenceUpdate` | Both | User online/offline status |
| `UserProfileSync` | Inbound | Profile update for shadow user |
| `GuildMetadataSync` | Both | Guild info update |
| `VoiceJoinRequest` | Inbound | Remote user wants to join voice |
| `VoiceJoinApproved` | Outbound | Voice join accepted with token |
| `VoiceLeave` | Inbound | Remote user leaving voice |
| `VoiceStateUpdate` | Both | Mute/deafen state changes |
| `AccountTransfer` | Both | Account portability |

## Delivery

### Direct (HTTP POST)

Activities are delivered as signed HTTP POST requests to the target instance's inbox.

```
POST /api/v1/federation/inbox
Content-Type: application/json
Signature: keyId="...", algorithm="ed25519", headers="...", signature="..."

{
  "type": "MessageCreate",
  "origin": "https://sender.example.com",
  "timestamp": "2026-03-14T12:00:00.000Z",
  "payload": { ... }
}
```

Delivery retries with exponential backoff: 1min, 5min, 30min, 2hr, 12hr (max 5 attempts).

### Relay (E2E Encrypted)

When direct delivery fails, activities are encrypted and sent via the relay network.

#### Envelope Format

```json
{
  "v": 1,
  "from": "sender.example.com",
  "to": "recipient.example.com",
  "bucket": 16384,
  "payload": "base64-encrypted-padded-data",
  "signature": "base64-ed25519-signature",
  "ts": "2026-03-14T12:00:00.000Z",
  "id": "uuid",
  "hops": 0
}
```

#### Encryption

1. Convert Ed25519 keys to X25519 (Curve25519)
2. X25519 ECDH → raw shared secret
3. HKDF-SHA256 → AES-256-GCM key
4. Pad plaintext to bucket size (4KB, 16KB, or 64KB)
5. AES-256-GCM encrypt (12-byte IV prepended, 16-byte tag appended)
6. Sign the base64 payload with Ed25519

#### Traffic Padding

All envelopes are padded to fixed sizes to prevent content-size analysis:

| Bucket | Use Case |
|--------|----------|
| 4 KB | Typing, presence, small signals |
| 16 KB | Normal messages |
| 64 KB | Large payloads (embeds, metadata) |

Padding format: `[4-byte LE length][original data][random bytes to fill bucket]`

## Shadow Users

When a remote user joins a local guild, a **shadow user** is created:

- Username: `{username}_{domain}` (dots replaced with underscores, max 32 chars)
- Email: `federation+{uuid}@{local-domain}` (placeholder, cannot login)
- Password: `$federated${random}` (cannot authenticate)
- `isFederated: true`, `federationAddress: "user@remote.domain"`

Shadow users are tracked in both the `users` table (for local operations) and `remote_users` table (for federation metadata).

## Voice Federation

Federated voice uses relay-mediated LiveKit token exchange:

1. Remote user's instance sends `VoiceJoinRequest` (via relay if needed)
2. Guild-owning instance generates a time-limited LiveKit token
3. Token sent back as `VoiceJoinApproved`
4. Remote client connects directly to LiveKit server using the token
5. If NAT blocks WebRTC, the relay's TURN proxy provides credentials

Federated voice participants have identity format `fed:{domain}:{userId}` and limited permissions (publish audio, subscribe, but no data publishing).

## API Reference

### For Bot Developers

If you're building a bot that works across federated instances:

- Check `isFederated` on user objects to identify remote users
- Messages from federated users have `originInstanceId` set
- Federation addresses are in the format `username@domain`
- Use `GET /api/v1/federation/resolve/:address` to look up federated users

### For Instance Operators

- `GET /api/v1/federation/admin/stats` — Federation statistics
- `GET /api/v1/federation/admin/instances` — Connected instances
- `GET /api/v1/federation/admin/queue` — Activity delivery queue
- `POST /api/v1/federation/admin/blocks` — Block an instance domain
- `GET /api/v1/relays` — Available relay nodes
- `GET /api/v1/setup/status` — Instance setup status
