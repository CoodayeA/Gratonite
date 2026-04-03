# Architecture Decision Records

This directory contains Architecture Decision Records for Gratonite. Each record captures a single decision, its context, and consequences as they exist in the current system.

Format: `NNNN-short-title.md` using [Michael Nygard's ADR format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## Records

| ADR | Decision |
|-----|----------|
| [0001](0001-dm-symmetric-encryption.md) | ECDH P-256 + AES-GCM-256 for DM and group symmetric encryption |
| [0002](0002-guild-channel-group-keys.md) | Per-channel wrapped group keys distributed via the encryption-keys endpoint |
| [0003](0003-federation-delivery-surface.md) | HTTP API + WebSocket (Socket.IO) as the federation delivery surface |
