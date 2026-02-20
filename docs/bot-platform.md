# Bot Platform Notes (Phase 6)

This document summarizes the bot platform backend behavior and storage.

## Database

- `oauth2_apps`: OAuth app registration + client secret hash
- `oauth2_codes`: authorization code grants
- `oauth2_tokens`: access/refresh/bot tokens (hashed)
- `bots`: app -> bot user mapping
- `slash_commands`: command definitions (global or per-guild)

## Token Storage

Tokens are stored as SHA-256 hashes. Raw tokens are only returned at creation/rotation time.

## Bot Users

Bot users are stored in `users` with `bot = true` and a generated email in the `bots.gratonite.local` domain.

## Gateway

Bots authenticate via `IDENTIFY` using the bot token. Intents are supported via `intents` bitfield.
