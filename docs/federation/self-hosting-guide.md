# Gratonite Self-Hosting Guide

## Requirements

- A VPS or server with at least 1GB RAM (2GB recommended)
- A domain name pointed at your server (A record)
- Docker Engine 24+ and Docker Compose v2
- Ports 80 and 443 open (for HTTP/HTTPS via Caddy)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/CoodayeA/Gratonite.git && cd Gratonite

# 2. Copy and edit the environment file
cp deploy/self-host/.env.example deploy/self-host/.env
# Edit deploy/self-host/.env — set your domain, email, passwords

# 3. Start all services
docker compose -f deploy/self-host/docker-compose.yml up -d

# 4. Wait for setup to complete (check logs)
docker compose -f deploy/self-host/docker-compose.yml logs setup

# 5. Browse to your instance
# https://your-domain.com/
```

The setup container automatically:
- Runs database migrations
- Generates JWT secrets (if not provided)
- Generates an Ed25519 instance keypair (for federation)
- Creates the admin account

## Configuration Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `INSTANCE_DOMAIN` | Your instance's public domain | `chat.example.com` |
| `ADMIN_EMAIL` | Admin account email | `admin@example.com` |
| `ADMIN_PASSWORD` | Admin account password | (strong password) |
| `DB_PASSWORD` | PostgreSQL password | (random, 16+ chars) |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (auto-generated) | Access token signing key (32+ chars) |
| `JWT_REFRESH_SECRET` | (auto-generated) | Refresh token signing key (32+ chars) |
| `FEDERATION_ENABLED` | `false` | Enable federation with other instances |
| `SMTP_HOST` | — | SMTP server for email notifications |
| `LIVEKIT_URL` | — | LiveKit server for voice/video |

## DNS Setup

Create an A record pointing your domain to your server's IP:

```
chat.example.com.  IN  A  203.0.113.1
```

Caddy handles TLS automatically via Let's Encrypt.

## Updating Your Instance

```bash
cd Gratonite
git pull
docker compose -f deploy/self-host/docker-compose.yml pull
docker compose -f deploy/self-host/docker-compose.yml up -d
```

## Backups

### Database Backup
```bash
docker compose -f deploy/self-host/docker-compose.yml exec postgres \
  pg_dump -U gratonite gratonite | gzip > backup-$(date +%Y%m%d).sql.gz
```

### Database Restore
```bash
gunzip -c backup-20260308.sql.gz | docker compose -f deploy/self-host/docker-compose.yml exec -T postgres \
  psql -U gratonite gratonite
```

### File Uploads Backup
```bash
docker compose -f deploy/self-host/docker-compose.yml cp api:/app/uploads ./uploads-backup
```

## Troubleshooting

### Setup container fails
Check logs: `docker compose logs setup`
Common causes:
- Database not ready (increase healthcheck retries)
- Invalid DATABASE_URL format

### Can't access the instance
- Verify DNS: `dig chat.example.com`
- Check Caddy logs: `docker compose logs caddy`
- Ensure ports 80/443 are open in your firewall

### Migration errors
Run migrations manually:
```bash
docker compose exec api node dist/db/migrate.js
```

### Reset everything (DESTRUCTIVE)
```bash
docker compose -f deploy/self-host/docker-compose.yml down -v
# This deletes all data!
```
