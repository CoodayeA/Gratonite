# Self-Hosting Gratonite with Docker Compose

This is the canonical guide for running your own Gratonite instance. The production deployment uses **Docker Compose** with **Caddy** as a reverse proxy (automatic HTTPS).

## Prerequisites

- A Linux server (Ubuntu 22.04+ recommended) with at least 2 GB RAM
- Docker Engine and Docker Compose installed ([docs.docker.com/engine/install](https://docs.docker.com/engine/install/))
- A domain name with DNS pointing to your server (see [DNS-CONFIGURATION.md](DNS-CONFIGURATION.md))

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/CoodayeA/Gratonite.git
cd Gratonite
```

### 2. Create your environment file

```bash
cp deploy/.env.example .env
```

Edit `.env` and fill in your values:

```env
# Database
DB_PASSWORD=your-strong-db-password

# JWT (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=generate-a-random-64-char-hex-string
JWT_REFRESH_SECRET=generate-a-different-random-64-char-hex-string

# SMTP — see docs/SMTP-CONFIGURATION.md
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com

# URLs — replace with your domain
APP_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com

# LiveKit (required for voice/video)
LIVEKIT_URL=wss://livekit.yourdomain.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
```

### 3. Build the application

```bash
# Build the API
cd apps/api
pnpm install && pnpm run build
cd ../..

# Build the web client
cd apps/web
pnpm install && pnpm run build
cd ../..
```

### 4. Update the Caddyfile

Edit `deploy/Caddyfile` and replace the domain names with your own:

```caddyfile
yourdomain.com {
    reverse_proxy gratonite-web:80
}

api.yourdomain.com {
    reverse_proxy gratonite-api:4000
}
```

### 5. Start everything

```bash
cd deploy
docker compose -f docker-compose.production.yml up -d
```

This starts:
- **PostgreSQL 16** — database
- **Redis 7** — caching and real-time state
- **API** — Node.js backend on port 4000
- **Web** — Nginx serving the built React app
- **Caddy** — reverse proxy with automatic HTTPS

### 6. Run database migrations

```bash
docker exec gratonite-api sh -c "cd /app && node dist/db/migrate.js"
```

### 7. Verify

```bash
# Check all containers are running
docker compose -f docker-compose.production.yml ps

# Test the API health endpoint
curl https://api.yourdomain.com/health
```

Visit `https://yourdomain.com` — you should see the Gratonite app.

## Updating

To deploy a new version:

```bash
git pull
cd apps/api && pnpm install && pnpm run build && cd ../..
cd apps/web && pnpm install && pnpm run build && cd ../..
cd deploy
docker compose -f docker-compose.production.yml up -d --force-recreate api web
docker exec gratonite-api sh -c "cd /app && node dist/db/migrate.js"
```

## Data & Backups

Database data is stored in the `postgres_data` Docker volume. To back up:

```bash
docker exec gratonite-postgres pg_dump -U gratonite gratonite > backup_$(date +%Y%m%d).sql
```

File uploads are stored in the `api_uploads` volume.

## Architecture

```
Internet
  │
  ▼
Caddy (ports 80/443, auto-HTTPS)
  ├── yourdomain.com      → Nginx (static web build)
  └── api.yourdomain.com  → Node.js API (:4000)
                                ├── PostgreSQL (:5432)
                                └── Redis (:6379)
```

## Troubleshooting

**Containers won't start:**
```bash
docker compose -f docker-compose.production.yml logs api
docker compose -f docker-compose.production.yml logs caddy
```

**Database connection errors:**
- Verify `DB_PASSWORD` in `.env` matches what PostgreSQL was initialized with
- If changing passwords, delete the `postgres_data` volume and restart (data loss)

**CORS errors in the browser:**
- Ensure `CORS_ORIGIN` exactly matches the URL you access the app from (including `https://`)

**SSL certificate not provisioning:**
- Ensure DNS A records point to your server
- Check Caddy logs: `docker logs gratonite-caddy`

## Related Docs

- [DNS-CONFIGURATION.md](DNS-CONFIGURATION.md) — DNS setup
- [SMTP-CONFIGURATION.md](SMTP-CONFIGURATION.md) — email configuration
- [QUICK-DEPLOY-GUIDE.md](QUICK-DEPLOY-GUIDE.md) — quick reference
