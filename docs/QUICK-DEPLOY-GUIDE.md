# Quick Deploy Reference

A condensed reference for deploying Gratonite. See [DEPLOY-TO-OWN-SERVER.md](DEPLOY-TO-OWN-SERVER.md) for the full guide.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ and pnpm
- A domain with DNS pointing to your server

## Commands

```bash
# 1. Clone
git clone https://github.com/CoodayeA/Gratonite.git && cd Gratonite

# 2. Configure
cp deploy/.env.example .env
# Edit .env: set DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, SMTP, domain, LiveKit
# Edit deploy/Caddyfile: replace domain names

# 3. Build
cd apps/api && pnpm install && pnpm run build && cd ../..
cd apps/web && pnpm install && pnpm run build && cd ../..

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
SMTP_HOST=               # e.g. smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@yourdomain.com
APP_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
LIVEKIT_URL=wss://livekit.yourdomain.com
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

## Updating

```bash
git pull
cd apps/api && pnpm install && pnpm run build && cd ../..
cd apps/web && pnpm install && pnpm run build && cd ../..
cd deploy && docker compose -f docker-compose.production.yml up -d --force-recreate api web
docker exec gratonite-api sh -c "cd /app && node dist/db/migrate.js"
```

## Useful Commands

```bash
docker logs -f gratonite-api           # API logs
docker logs -f gratonite-caddy         # Reverse proxy logs
docker restart gratonite-api           # Restart API
docker exec gratonite-postgres pg_dump -U gratonite gratonite > backup.sql  # DB backup
```
