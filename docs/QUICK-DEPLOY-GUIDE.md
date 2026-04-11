# Quick Deploy Reference

A condensed reference for deploying Gratonite. See [DEPLOY-TO-OWN-SERVER.md](DEPLOY-TO-OWN-SERVER.md) for the full guide.

## Prerequisites

- Docker and Docker Compose
- Node.js 22+ and pnpm
- A domain with DNS pointing to your server

## Canonical Deploy Command

```bash
SERVER=178.156.253.237 USER=ferdinand SSH_KEY=~/.ssh/hetzner_key_new bash deploy/deploy.sh
```

## Manual Commands (Reference)

```bash
# 1. Clone
git clone https://github.com/CoodayeA/Gratonite.git && cd Gratonite

# 2. Configure
cp deploy/.env.example .env
# Edit .env: set DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, BULLBOARD_ADMIN_TOKEN, SMTP, domain, LiveKit
# Edit deploy/Caddyfile: replace domain names

# 3. Build
cd apps/api && pnpm install && pnpm run build && cd ../..
cd apps/web && npm install && npm run build:vite && cd ../..

# 4. Start
cd deploy && docker compose -f docker-compose.production.yml up -d

# 5. Migrate
docker exec gratonite-api sh -c "cd /app && node dist/db/migrate.js"

# 6. Verify
docker compose -f docker-compose.production.yml ps
curl https://api.yourdomain.com/health
```

## Required Environment Variables

```env
DB_PASSWORD=             # PostgreSQL password
JWT_SECRET=              # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_REFRESH_SECRET=      # (generate a different one)
BULLBOARD_ADMIN_TOKEN=   # dedicated admin/jobs token (do not reuse JWT secrets)
SMTP_HOST=               # e.g. smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@yourdomain.com
APP_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
LIVEKIT_URL=wss://api.yourdomain.com
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

## Updating

```bash
git pull
cd apps/api && pnpm install && pnpm run build && cd ../..
cd apps/web && npm install && npm run build:vite && cd ../..
cd deploy && docker compose -f docker-compose.production.yml up -d --force-recreate api web caddy livekit
docker exec gratonite-api sh -c "cd /app && node dist/db/migrate.js"
```

`deploy/deploy.sh` enforces guardrails:

- protects remote `.env` files during rsync
- aborts before restart if required env vars are missing/invalid
- checks Bull Board token passthrough exists in compose
- blocks deploys if a legacy public `gratonite-caddy-1` proxy is still bound to ports 80/443
- waits for `API_HEALTH_URL` (default: `https://api.gratonite.chat/health`) before reporting success

## Useful Commands

```bash
docker logs -f gratonite-api           # API logs
docker logs -f gratonite-caddy         # Reverse proxy logs
docker restart gratonite-api           # Restart API
docker exec gratonite-postgres pg_dump -U gratonite gratonite > backup.sql  # DB backup
```
