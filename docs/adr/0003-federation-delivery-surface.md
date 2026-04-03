# 3. HTTP + WebSocket Delivery Surface for Federation

Date: 2026-04-03

## Status

Accepted

## Context

Gratonite instances federate by exchanging activities (messages, presence,
guild metadata). The delivery mechanism must support request/response operations
(join requests, profile sync) and low-latency real-time events (typing, new messages).

## Decision

Federation uses two transport layers:

1. **HTTP API** — mounted at `/api/v1/federation`. Instances discover each
   other via `/.well-known/gratonite`. Requests are signed with per-instance
   RSA key pairs. Outbound activities queue in the database with retry.
2. **WebSocket (Socket.IO)** — the `/federation/ws` namespace for real-time
   event push. Connections authenticate via signed timestamp verified against
   the remote instance's public key.

Clients connect to their home instance's Socket.IO namespace (JWT auth) and
receive federated events through the same stream as local ones.

## Consequences

- **Positive:** Real-time delivery without polling; HTTP retry with idempotency keys.
- **Positive:** Clients are unaware of federation; the home instance proxies content.
- **Negative:** Two transports increase operational surface (monitoring, firewall, TLS).
- **Negative:** Retry and ordering guarantees are not yet formally specified.
