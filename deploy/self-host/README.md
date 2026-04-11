# Gratonite Self-Hosted Instance

## Quick Start

1. Copy `.env.example` to `.env`
2. Edit `.env`: set your domain, email, and passwords
3. Run: `docker compose up -d`
4. Browse to `https://your-domain.com/app/`
5. Log in with the admin credentials from `.env`

## Configuration

See [Self-Hosting Guide](../../docs/self-hosting.md) for full documentation.

## Troubleshooting Bundle

Run from this directory to generate logs you can share for support:

```bash
bash ./collect-logs.sh
```

```powershell
pwsh ./collect-logs.ps1
```

## Federation

Federation is enabled by default. Your instance connects to the Gratonite relay and can communicate with other Gratonite instances.

**Discovery Registration** (`FEDERATION_DISCOVER_REGISTRATION=true` by default)  
When enabled, your instance registers its public guilds with the Gratonite hub and also pulls guilds from the hub into your local Discover page. This makes Discover useful from day one — even on a brand-new instance with no local guilds. Disable this if you want a fully isolated instance.

## Voice/Video (Optional)

```bash
docker compose --profile voice up -d
```

## Updating

```bash
docker compose pull && docker compose up -d
```

## What you get out of the box

After running `docker compose up -d`, your instance is immediately ready with:

- **Fully featured chat** — text channels, DMs, voice, and video (if LiveKit is configured)
- **Federation** — connected to the Gratonite relay network; users from other instances can join your servers
- **Discover page** — pre-populated with guilds from the Gratonite network (syncs on startup and every 30 minutes)
- **End-to-end encrypted federation traffic** via the relay
- **Admin panel** — available at `/admin` using your admin credentials
- **Mobile & desktop app compatible** — the official Gratonite apps work with any self-hosted instance out of the box

## Migrating from gratonite.chat (or another instance)

You don't need to create a new account when self-hosting. Import your existing account in a few steps:

1. On your **current instance**, go to **Settings → Account → Export Account** and download your `.json` export file.
2. On your **new self-hosted instance**, go to the registration page and click **"Already have a Gratonite account? Import it →"**
3. Upload the export file and review the preview (username, friends, servers).
4. Click **Import Account**. You'll be logged in automatically with a temporary password — save it and change it in **Settings → Security**.

## Backups

```bash
# Database
docker compose exec postgres pg_dump -U gratonite gratonite | gzip > backup.sql.gz

# Uploads
docker compose cp api:/app/uploads ./uploads-backup
```
