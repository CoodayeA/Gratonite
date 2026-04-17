# Self-Hosting Gratonite

Run your own Gratonite instance without turning it into a weekend project.

This guide covers the checked-in Docker Compose self-host stack under `deploy/self-host/`.
If you want the guided installer instead, use:

```bash
curl -fsSL https://gratonite.chat/install | bash
```

## Prerequisites

- A Linux machine, VPS, homelab box, or local machine with Docker
- Docker and Docker Compose
- A domain name for public hosting, or `localhost` for local-only use

## Quick Start

```bash
git clone https://github.com/CoodayeA/Gratonite.git
cd Gratonite/deploy/self-host
cp .env.example .env
```

Edit `.env` and set at least:

- `INSTANCE_DOMAIN`
- `ADMIN_EMAIL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `TLS_MODE`

Then start the stack:

```bash
docker compose up -d
```

Open your instance:

- Server hosting: `https://your-domain.com/app/`
- Local hosting: `https://localhost/app/` unless you overrode `HTTPS_PORT`

The root path redirects to `/app/` automatically.

## First Login

The checked-in self-host compose flow seeds an admin account from `.env` on first run, so you can usually log in directly with:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

The repo also contains a `/setup` flow for first-run configuration scenarios, but the default compose path does not require you to complete it before signing in with the seeded admin account.

If you used the installer instead of manual compose, it prints generated admin credentials for you.

## What You Get By Default

The checked-in self-host stack starts with:

- chat, DMs, guilds, search, uploads, and the web app
- federation enabled by default
- relay connectivity enabled by default
- Discover registration enabled by default
- automatic TLS when `TLS_MODE` is set to an email address
- internal/self-signed TLS when `TLS_MODE=internal`

## Federation and Discovery

Federation is enabled by default in `deploy/self-host/.env.example`:

```env
FEDERATION_ENABLED=true
RELAY_ENABLED=true
FEDERATION_DISCOVER_REGISTRATION=true
```

That means a default instance:

- connects to `wss://relay.gratonite.chat`
- can communicate with other Gratonite instances
- can register public guilds for Discover
- can pull network guilds into the local Discover experience

If you want a more isolated instance, disable one or more of these values in `.env` before starting:

```env
FEDERATION_ENABLED=false
RELAY_ENABLED=false
FEDERATION_DISCOVER_REGISTRATION=false
```

## Voice and Video

Voice/video is optional and runs behind the `voice` profile:

```bash
docker compose --profile voice up -d
```

## Updating

```bash
docker compose pull
docker compose up -d
```

## Troubleshooting

### Collect a support bundle

From `deploy/self-host/`:

```bash
bash ./collect-logs.sh
```

On PowerShell:

```powershell
pwsh ./collect-logs.ps1
```

### Common checks

- `docker compose ps`
- `docker compose logs -f api`
- `docker compose logs -f caddy`
- `docker compose --profile voice ps`

### Current scope note

The checked-in self-host compose stack does not currently include bundled Cloudflare Tunnel or ngrok profiles. If you want to front Gratonite with a tunnel or external reverse proxy, treat that as your own hosting layer in front of the standard stack.

## Related Docs

- [`docs/self-hosting.md`](../self-hosting.md) — installer-first overview
- [`deploy/self-host/README.md`](../../deploy/self-host/README.md) — quick operator notes for the compose directory
- [`docs/self-hosting/federation.md`](federation.md) — federation behavior and trust model
- [`docs/self-hosting/troubleshooting.md`](troubleshooting.md) — deeper troubleshooting guide
