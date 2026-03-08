# Gratonite Self-Hosted Instance

## Quick Start

1. Copy `.env.example` to `.env`
2. Edit `.env`: set your domain, email, and passwords
3. Run: `docker compose up -d`
4. Browse to `https://your-domain.com/`
5. Log in with the admin credentials from `.env`

## Configuration

See [Self-Hosting Guide](../../docs/federation/self-hosting-guide.md) for full documentation.

## Voice/Video (Optional)

```bash
docker compose --profile voice up -d
```

## Updating

```bash
docker compose pull && docker compose up -d
```

## Backups

```bash
# Database
docker compose exec postgres pg_dump -U gratonite gratonite | gzip > backup.sql.gz

# Uploads
docker compose cp api:/app/uploads ./uploads-backup
```
