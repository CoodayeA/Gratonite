# Gratonite Self-Hosting Guide

Host your own Gratonite instance — a fully-featured community chat platform with real-time messaging, voice/video, guilds, DMs, threads, moderation, and end-to-end encrypted private messages.

---

## Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **RAM** | 1 GB | 2 GB+ |
| **Storage** | 10 GB | 20 GB+ (depends on file uploads) |
| **OS** | Any Linux with Docker | Ubuntu 22.04+ / Debian 12+ |
| **Docker** | Engine 24+ & Compose v2 | Latest stable |
| **Network** | Ports 80, 443 open | Static IP |
| **Domain** | Required | — |

You do **not** need Node.js, npm, or any build tools on your server. Everything runs inside Docker containers.

---

## Step 1: Prepare Your Server

### Install Docker

If Docker isn't installed yet:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for the group change to take effect
```

Verify:

```bash
docker --version    # Docker Engine 24+
docker compose version  # Docker Compose v2.x
```

### Point Your Domain

Create an **A record** for your domain pointing to your server's public IP:

```
chat.example.com.  A  203.0.113.1
```

If you also want `www`:
```
www.chat.example.com.  CNAME  chat.example.com.
```

Allow 5-10 minutes for DNS propagation. Verify with:

```bash
dig chat.example.com +short
# Should return your server's IP
```

### Open Firewall Ports

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## Step 2: Install Gratonite

```bash
git clone https://github.com/CoodayeA/Gratonite.git
cd Gratonite
```

---

## Step 3: Configure Your Instance

```bash
cp deploy/self-host/.env.example deploy/self-host/.env
```

Open `deploy/self-host/.env` in your editor and set the **4 required values**:

```bash
# REQUIRED: Your domain (no https://, no trailing slash)
INSTANCE_DOMAIN=chat.example.com

# REQUIRED: Admin account (created automatically on first run)
ADMIN_EMAIL=you@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=pick-a-strong-password-here

# REQUIRED: Database password (random, 16+ characters)
DB_PASSWORD=generate-a-random-password-here
```

**Generating a random password:**
```bash
openssl rand -base64 24
```

That's all you need. JWT secrets are auto-generated on first run. For the full list of options, see [Configuration Reference](#configuration-reference) below.

---

## Step 4: Launch

```bash
docker compose -f deploy/self-host/docker-compose.yml up -d
```

**What happens on first run:**

1. PostgreSQL and Redis start and pass health checks
2. The **setup container** runs:
   - Executes all 124 database migrations
   - Generates JWT signing secrets (if not provided)
   - Generates an Ed25519 instance keypair (for federation)
   - Creates your admin account
3. The **API** starts on port 4000 (internal)
4. The **web** SPA is served by nginx on port 80 (internal)
5. **Caddy** starts on ports 80/443, automatically obtains a Let's Encrypt TLS certificate, and reverse-proxies all traffic

**Check that setup completed:**

```bash
docker compose -f deploy/self-host/docker-compose.yml logs setup
```

You should see:
```
=== Gratonite Instance Setup ===
Running database migrations... done.
Generated JWT secrets.
Generating Ed25519 instance keypair... done.
Creating admin account: admin (you@example.com)... done.
=== Setup complete! ===
Your instance will be available at https://chat.example.com
```

**Check all containers are running:**

```bash
docker compose -f deploy/self-host/docker-compose.yml ps
```

All services should show `Up` or `running`.

---

## Step 5: Log In

Open `https://chat.example.com` in your browser.

Log in with the email and password you set in `.env`. You now have a fully functional Gratonite instance.

**First things to do:**
- Create your first guild (server)
- Invite friends via invite links
- Customize your profile
- Explore the admin panel at Settings > Admin

---

## Updating Your Instance

When a new version is released:

```bash
cd Gratonite
git pull
docker compose -f deploy/self-host/docker-compose.yml pull
docker compose -f deploy/self-host/docker-compose.yml up -d
```

The setup container will run any new database migrations automatically. Your data is preserved across updates.

---

## Backups & Restore

### Back Up Everything

```bash
# Database
docker compose -f deploy/self-host/docker-compose.yml exec postgres \
  pg_dump -U gratonite gratonite | gzip > backup-$(date +%Y%m%d).sql.gz

# File uploads
docker compose -f deploy/self-host/docker-compose.yml cp api:/app/uploads ./uploads-backup

# Instance keys (federation keypair)
docker compose -f deploy/self-host/docker-compose.yml cp api:/app/keys ./keys-backup
```

### Restore Database

```bash
gunzip -c backup-20260308.sql.gz | \
  docker compose -f deploy/self-host/docker-compose.yml exec -T postgres \
  psql -U gratonite gratonite
```

### Automated Backups (Recommended)

Add a cron job to back up nightly:

```bash
crontab -e
```

```
0 3 * * * cd /path/to/Gratonite && docker compose -f deploy/self-host/docker-compose.yml exec -T postgres pg_dump -U gratonite gratonite | gzip > /path/to/backups/gratonite-$(date +\%Y\%m\%d).sql.gz
```

---

## Configuration Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `INSTANCE_DOMAIN` | Your instance's public domain | `chat.example.com` |
| `ADMIN_EMAIL` | Admin account email | `admin@example.com` |
| `ADMIN_PASSWORD` | Admin account password | (strong password) |
| `DB_PASSWORD` | PostgreSQL password | (random, 16+ chars) |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | Auto-generated | Access token signing key (32+ chars) |
| `JWT_REFRESH_SECRET` | Auto-generated | Refresh token signing key (32+ chars) |

### Email (Optional)

Required for password resets and email notifications:

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `smtp.mailgun.org` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `noreply@chat.example.com` |
| `SMTP_PASS` | (your SMTP password) |
| `SMTP_FROM` | `Gratonite <noreply@chat.example.com>` |

### Voice & Video (Optional)

Requires [LiveKit](https://livekit.io). Start the voice profile:

```bash
docker compose -f deploy/self-host/docker-compose.yml --profile voice up -d
```

| Variable | Description |
|----------|-------------|
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `LIVEKIT_URL` | `ws://livekit:7880` (if using the bundled container) |

### Federation (Optional)

Connect your instance to other Gratonite instances:

| Variable | Default | Description |
|----------|---------|-------------|
| `FEDERATION_ENABLED` | `false` | Master switch for federation |
| `FEDERATION_ALLOW_INBOUND` | `true` | Accept requests from other instances |
| `FEDERATION_ALLOW_OUTBOUND` | `true` | Send requests to other instances |
| `FEDERATION_ALLOW_JOINS` | `true` | Allow remote users to join local guilds |
| `FEDERATION_ALLOW_REPLICATION` | `false` | Enable guild replication |
| `FEDERATION_DISCOVER_REGISTRATION` | `false` | Register with Gratonite Discover directory |
| `FEDERATION_HUB_URL` | `https://gratonite.chat` | Hub URL for Discover registration |

### Advanced

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | API internal port |
| `NODE_ENV` | `production` | Environment mode |
| `MAX_UPLOAD_SIZE` | `25000000` | Max file upload size in bytes (25 MB) |
| `LOG_LEVEL` | `info` | Logging verbosity |

---

## Federation

Federation lets your instance communicate with other Gratonite instances. Users on your instance can discover and visit guilds on remote instances, and your public guilds can appear on the [Gratonite Discover](https://gratonite.chat/app/discover) directory.

### Enabling Federation

In your `.env` file:

```bash
FEDERATION_ENABLED=true
```

Restart the API:

```bash
docker compose -f deploy/self-host/docker-compose.yml restart api
```

Your instance now has a public identity at `https://chat.example.com/.well-known/gratonite`.

### Joining Gratonite Discover

To list your public guilds on the main Gratonite Discover directory:

```bash
FEDERATION_ENABLED=true
FEDERATION_DISCOVER_REGISTRATION=true
```

Restart the API. Your instance will:
1. Handshake with `gratonite.chat` using its Ed25519 keypair
2. Push your discoverable guilds every 30 minutes
3. Your guilds appear in the "Self-Hosted Servers" section on Discover

### Security

- All instance-to-instance communication is signed with **Ed25519 HTTP Signatures**
- Inbound content is sanitized (HTML stripped, URLs validated, size limits enforced)
- You can block specific domains via the admin panel
- Federation is fully opt-in — disabled by default

See the [Federation Guide](federation-guide.md) for more details.

---

## Architecture

```
Internet
    │
    ▼
┌─────────┐
│  Caddy   │  :80/:443 — auto-HTTPS, reverse proxy
└────┬─────┘
     │
     ├──► /api/*           → API container (:4000)
     ├──► /socket.io/*     → API container (WebSocket)
     ├──► /uploads/*       → API container (static files)
     ├──► /.well-known/*   → API container (federation)
     └──► /*               → Web container (:80, nginx SPA)

┌──────────┐  ┌──────────┐
│ PostgreSQL│  │  Redis   │
│  :5432    │  │  :6379   │
└──────────┘  └──────────┘
```

All services communicate over a Docker bridge network. Only Caddy exposes ports to the internet.

---

## Troubleshooting

### Setup container fails

```bash
docker compose -f deploy/self-host/docker-compose.yml logs setup
```

| Error | Fix |
|-------|-----|
| `FATAL: password authentication failed` | Check `DB_PASSWORD` matches in `.env` |
| `Connection refused` on port 5432 | Postgres isn't ready yet — increase `retries` in healthcheck |
| `relation "users" already exists` | Migrations already ran — this is fine, setup will skip |

### Can't access the instance

1. **DNS not propagated:** `dig chat.example.com +short` should return your IP
2. **Firewall blocking:** Ensure ports 80 and 443 are open
3. **Caddy can't get cert:** Check `docker compose logs caddy` — ensure your domain resolves publicly
4. **Containers not running:** `docker compose ps` — all should show `Up`

### API errors

```bash
docker compose -f deploy/self-host/docker-compose.yml logs api --tail 50
```

| Error | Fix |
|-------|-----|
| `JWT_SECRET must be at least 32 characters` | Set or let setup auto-generate secrets |
| `CORS_ORIGIN must match APP_URL` | Set `APP_URL=https://chat.example.com` and `CORS_ORIGIN=https://chat.example.com` |

### Run migrations manually

If the setup container already exited but you need to run new migrations:

```bash
docker compose -f deploy/self-host/docker-compose.yml exec api node dist/db/migrate.js
```

### Reset everything (DESTRUCTIVE)

```bash
docker compose -f deploy/self-host/docker-compose.yml down -v
# This permanently deletes all data, keys, and uploads!
```

---

## Resource Usage

Typical resource usage for a small instance (< 100 users):

| Service | RAM | CPU |
|---------|-----|-----|
| API | ~200 MB | Low |
| Web (nginx) | ~10 MB | Minimal |
| PostgreSQL | ~100 MB | Low |
| Redis | ~30 MB | Minimal |
| Caddy | ~20 MB | Minimal |
| **Total** | **~360 MB** | — |

For larger instances (1000+ users), increase RAM to 4 GB and consider dedicated PostgreSQL hosting.

---

## Migrating from Another Platform

Gratonite supports account export and import for federation. If you're migrating from another Gratonite instance, users can export their account (profile, settings, friend list, guild memberships) and import it on your instance. See the [Federation Guide](federation-guide.md) for details.

---

## Getting Help

- **Issues:** [github.com/CoodayeA/Gratonite/issues](https://github.com/CoodayeA/Gratonite/issues)
- **Discussions:** [github.com/CoodayeA/Gratonite/discussions](https://github.com/CoodayeA/Gratonite/discussions)
- **Main instance:** [gratonite.chat](https://gratonite.chat)
