# Gratonite Federation Protocol v1

## Overview

The Gratonite Federation Protocol enables communication between independent Gratonite instances. It uses HTTP Signatures (Ed25519) for authentication and a custom activity-based messaging format optimized for real-time chat.

## Instance Discovery

### Well-Known Endpoint

```
GET https://instance.com/.well-known/gratonite
```

Response:
```json
{
  "domain": "instance.com",
  "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...",
  "keyId": "https://instance.com/api/v1/federation/actor#main-key",
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
      "allowReplication": false,
      "discoverRegistration": false
    }
  }
}
```

## HTTP Signatures

All instance-to-instance requests are signed using Ed25519 HTTP Signatures.

### Signing

The signing string is constructed from these headers:
- `(request-target)`: method and path
- `host`: target hostname
- `date`: RFC 2822 date
- `digest`: SHA-256 of request body (POST/PUT only)

### Signature Header Format
```
Signature: keyId="https://instance.com/api/v1/federation/actor#main-key",
           algorithm="ed25519",
           headers="(request-target) host date digest",
           signature="<base64-encoded-ed25519-signature>"
```

## Activity Types

### Instance Handshake

| Activity | Direction | Description |
|----------|-----------|-------------|
| `InstanceHello` | A -> B | Initial handshake request |
| `InstanceHelloAck` | B -> A | Handshake acknowledgment |

### Guild Operations

| Activity | Direction | Description |
|----------|-----------|-------------|
| `GuildJoinRequest` | A -> B | User on A wants to join guild on B |
| `GuildJoinApproved` | B -> A | Guild join approved |
| `GuildJoinDenied` | B -> A | Guild join denied |
| `GuildLeave` | A -> B | User leaving remote guild |
| `GuildMetadataSync` | B -> A | Guild info update |

### Messages

| Activity | Direction | Description |
|----------|-----------|-------------|
| `MessageCreate` | A -> B | New message in federated guild |
| `MessageUpdate` | A -> B | Message edited |
| `MessageDelete` | A -> B | Message deleted |
| `TypingStart` | A -> B | User started typing |

### User Operations

| Activity | Direction | Description |
|----------|-----------|-------------|
| `UserProfileSync` | A -> B | User profile update |
| `PresenceUpdate` | A -> B | User presence change |
| `AccountTransfer` | A -> B | Account export/import |

### Replication

| Activity | Direction | Description |
|----------|-----------|-------------|
| `ReplicaAck` | secondary -> primary | Sync cursor acknowledgment |

## Real-Time Federation

WebSocket namespace: `/federation/ws`

### Authentication
```json
{
  "instanceUrl": "https://instance-a.com",
  "signature": "<ed25519-signature-of-instanceUrl:timestamp>",
  "timestamp": "2026-03-08T12:00:00Z"
}
```

### Events
- `FED_MESSAGE_CREATE` -- forwarded message
- `FED_TYPING_START` -- typing indicator
- `FED_PRESENCE_UPDATE` -- presence change

## Content Safety

1. HTTP Signature verification on all requests
2. Domain validation (author domain must match signing instance)
3. HTML stripping and URL validation (HTTPS only)
4. Message size limit: 4000 characters
5. Request body limit: 1MB
6. Rate limiting: 100 req/min per instance
7. Trust scoring: new instances start at 50/100

## Federation Address Format

Users: `@username@instance.domain` (e.g., `@alice@chat.example.com`)
Guilds: `guild-id@instance.domain`
