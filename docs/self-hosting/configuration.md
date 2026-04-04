# Configuration Reference

All configuration is done through environment variables in the `.env` file located at `~/gratonite/.env`. The installer generates this file automatically, but you can edit it at any time.

After changing any value, restart the instance:

```bash
cd ~/gratonite
docker compose restart
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `INSTANCE_DOMAIN` | Yes | — | Your domain (e.g. `chat.example.com`) or `localhost` for local mode |
| `ADMIN_EMAIL` | Yes | — | Admin account email address |
| `ADMIN_USERNAME` | Yes | `admin` | Admin account username (created on first run) |
| `ADMIN_PASSWORD` | Yes | — | Admin account password (created on first run) |
| `DB_USER` | Yes | `gratonite` | PostgreSQL database user |
| `DB_PASSWORD` | Yes | — | PostgreSQL database password |
| `DB_NAME` | Yes | `gratonite` | PostgreSQL database name |
| `JWT_SECRET` | No | Auto-generated | Secret key for signing access tokens. Auto-generated on first run if left blank |
| `JWT_REFRESH_SECRET` | No | Auto-generated | Secret key for signing refresh tokens. Auto-generated on first run if left blank |
| `MFA_ENCRYPTION_KEY` | No | Auto-generated | Encryption key for MFA TOTP secrets. Auto-generated on first run if left blank |
| `BULLBOARD_ADMIN_TOKEN` | No | Auto-generated | Admin token for the Bull Board jobs dashboard. Auto-generated on first run if left blank |
| `FEDERATION_ENABLED` | No | `true` | Enable or disable federation entirely |
| `FEDERATION_ALLOW_INBOUND` | No | `true` | Allow other instances to send messages to this instance |
| `FEDERATION_ALLOW_OUTBOUND` | No | `true` | Allow this instance to send messages to other instances |
| `FEDERATION_ALLOW_JOINS` | No | `true` | Allow users from other instances to join guilds on this instance |
| `FEDERATION_HUB_URL` | No | `https://gratonite.chat` | URL of the federation hub for discovery registration |
| `FEDERATION_DISCOVER_REGISTRATION` | No | `true` | Controls both the push (registering your public guilds with the hub) and the pull (syncing hub guilds into your local `remote_guilds` table for the Discover page). The pull job runs on startup (after 5 seconds) and then every 30 minutes. Set to `false` for a fully isolated instance |
| `RELAY_ENABLED` | No | `true` | Connect to the federation relay |
| `RELAY_URL` | No | `wss://relay.gratonite.chat` | WebSocket URL of the federation relay |
| `TLS_MODE` | No | `internal` (local), `email` (server) | TLS certificate mode. `internal` uses a self-signed cert, `email` uses Let's Encrypt |
| `HTTP_PORT` | No | `80` (server), `8080` (local) | HTTP listen port |
| `HTTPS_PORT` | No | `443` (server), `8443` (local) | HTTPS listen port |
| `LIVEKIT_URL` | No | — | LiveKit server URL for voice/video (e.g. `ws://livekit:7880`). Set automatically when using the voice profile |
| `LIVEKIT_API_KEY` | No | — | LiveKit API key. Auto-generated when using the voice profile |
| `LIVEKIT_API_SECRET` | No | — | LiveKit API secret. Auto-generated when using the voice profile |
| `SMTP_HOST` | No | — | SMTP server hostname for sending emails |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | — | SMTP authentication username |
| `SMTP_PASS` | No | — | SMTP authentication password |
| `SMTP_FROM` | No | — | Sender email address for outgoing emails (e.g. `noreply@chat.example.com`) |

## Notes

- **Secrets** (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `MFA_ENCRYPTION_KEY`, `BULLBOARD_ADMIN_TOKEN`) are auto-generated on first run if left blank. Once generated, do not change them or existing sessions, MFA setups, and Bull Board access will break.
- **Database credentials** (`DB_USER`, `DB_PASSWORD`, `DB_NAME`) are used by both the API and the PostgreSQL container. Changing them after first run requires manually updating the database as well.
- **Admin credentials** are only used during initial setup. After the admin account is created, changing these values in `.env` has no effect. Use the app to change your password.
- **SMTP** is optional. Without it, email features (password reset, email notifications) are disabled but everything else works normally.
- **LiveKit** variables are set automatically when you run `docker compose --profile voice up -d`. You only need to set them manually if you are running LiveKit externally.
