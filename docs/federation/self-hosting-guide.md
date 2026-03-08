# Gratonite Self-Hosting Guide

Host your own Gratonite instance — a fully-featured community chat platform with real-time messaging, voice/video, guilds (servers), DMs, threads, moderation, and end-to-end encrypted private messages.

Everything runs in Docker containers. You do **not** need Node.js, npm, or any build tools on your server.

---

## What You Need

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **RAM** | 1 GB | 2 GB+ |
| **Storage** | 10 GB | 20 GB+ (depends on file uploads) |
| **OS** | Any Linux with Docker | Ubuntu 22.04+ / Debian 12+ |
| **Docker** | Engine 24+ & Compose v2 | Latest stable |
| **Network** | Ports 80, 443 open | Static IP |
| **Domain** | Required | — |

> **Don't have a server yet?** Any VPS provider works (Hetzner, DigitalOcean, Linode, Vultr, AWS Lightsail, etc.). Create the cheapest Linux instance they offer — 1 GB RAM is enough for small communities. Note the public IP address they give you.

> **Don't have a domain?** Buy one from any registrar (Namecheap, Cloudflare Registrar, Google Domains, etc.). You can use a subdomain like `chat.yourdomain.com` if you already own a domain.

---

## Step 1: Prepare Your Server

### 1a. Install Docker

SSH into your server and run:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

**Important:** Log out and log back in after running the above commands. The group change won't take effect until you do.

Verify Docker is installed:

```bash
docker --version          # Should show: Docker Engine 24.x or higher
docker compose version    # Should show: Docker Compose v2.x
```

If `docker compose version` doesn't work, you may need to install the Compose plugin separately:
```bash
sudo apt install docker-compose-plugin
```

### 1b. Point Your Domain to Your Server

Go to your domain registrar's DNS settings and create an **A record**:

| Type | Name | Value |
|------|------|-------|
| A | `chat` (or `@` for root domain) | Your server's public IP (e.g., `203.0.113.1`) |

**Example:** If your domain is `example.com` and you want `chat.example.com`:
- Type: `A`
- Name: `chat`
- Value: `203.0.113.1` (your server's IP)
- TTL: Auto or 300

Wait 5-10 minutes for DNS to propagate, then verify:

```bash
dig chat.example.com +short
# Should return your server's IP address
```

If `dig` isn't installed: `sudo apt install dnsutils`

### 1c. Open Firewall Ports

Your server needs ports 80 (HTTP) and 443 (HTTPS) open:

```bash
# Ubuntu / Debian (UFW)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# CentOS / RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

> **Note:** If you're using a cloud provider, you may also need to configure their firewall/security group to allow inbound traffic on ports 80 and 443. Check your provider's documentation.

---

## Step 2: Download Gratonite

```bash
git clone https://github.com/CoodayeA/Gratonite.git
cd Gratonite
```

---

## Step 3: Configure Your Instance

Copy the example config file:

```bash
cp deploy/self-host/.env.example deploy/self-host/.env
```

Open it in a text editor:

```bash
nano deploy/self-host/.env
```

You need to change **4 values**. Find these lines and replace the example values with your own:

```bash
# YOUR domain — no https://, no trailing slash
INSTANCE_DOMAIN=chat.example.com

# YOUR email and a strong password for the admin account
ADMIN_EMAIL=you@gmail.com
ADMIN_PASSWORD=pick-a-strong-password-here

# A random password for the database (see below for how to generate one)
DB_PASSWORD=paste-a-random-password-here
```

**How to generate a random database password:**

Open a second terminal and run:
```bash
openssl rand -base64 24
```

It will output something like `k7Rp3mNx9Qz2wYh8bLfT4jKv5nCs6dA`. Copy that and paste it as your `DB_PASSWORD`.

**Save and close** the file:
- In nano: Press `Ctrl+O`, then `Enter` to save, then `Ctrl+X` to exit.
- In vim: Press `Esc`, type `:wq`, then `Enter`.

> **That's all you need to set.** Everything else has sensible defaults:
> - JWT secrets are auto-generated on first run
> - HTTPS certificates are auto-obtained via Let's Encrypt
> - APP_URL and CORS_ORIGIN are auto-derived from your INSTANCE_DOMAIN
> - Database and Redis connections are pre-configured for the Docker network

---

## Step 4: Launch

```bash
docker compose -f deploy/self-host/docker-compose.yml up -d
```

This command:
1. Pulls all Docker images from GitHub Container Registry
2. Starts PostgreSQL and Redis
3. Runs the setup container (migrations, secrets, admin account)
4. Starts the API and web app
5. Starts Caddy (reverse proxy that handles HTTPS automatically)

It takes **1-3 minutes** on first run depending on your server's internet speed.

---

## Step 5: Verify Everything Worked

### Check setup completed

```bash
docker compose -f deploy/self-host/docker-compose.yml logs setup
```

You should see:
```
=== Gratonite Instance Setup ===
Running database migrations... done.
Generated JWT secrets.
Generating Ed25519 instance keypair... done.
Creating admin account: admin (you@gmail.com)... done.
=== Setup complete! ===
Your instance will be available at https://chat.example.com
```

### Check all containers are running

```bash
docker compose -f deploy/self-host/docker-compose.yml ps
```

You should see 5 services with status `Up` or `running`:
- `postgres` — database
- `redis` — cache
- `api` — backend API
- `web` — frontend web app
- `caddy` — reverse proxy / HTTPS

The `setup` container will show `exited (0)` — this is normal, it only runs once.

---

## Step 6: Log In

Open **https://chat.example.com** (replace with your actual domain) in your browser.

Log in with:
- **Email:** The `ADMIN_EMAIL` you set in Step 3
- **Password:** The `ADMIN_PASSWORD` you set in Step 3

**Congratulations — you now have your own Gratonite instance!**

### First Things to Do

1. **Create your first server** — Click the **+** button in the left sidebar to create a guild (server). Give it a name and icon.
2. **Create channels** — Inside your server, create text channels for your community (e.g., #general, #introductions, #random).
3. **Invite people** — Right-click your server name > **Create Invite** to generate a link you can share.
4. **Customize your profile** — Click your avatar in the bottom-left > **Settings** to set your display name, bio, and avatar.
5. **Explore admin settings** — Go to **Settings > Admin** to manage your instance (user management, moderation, etc.).

---

## Updating Your Instance

When a new version of Gratonite is released:

```bash
cd Gratonite
git pull
docker compose -f deploy/self-host/docker-compose.yml pull
docker compose -f deploy/self-host/docker-compose.yml up -d
```

The setup container automatically runs any new database migrations. Your data, uploads, and settings are preserved across updates.

---

## Backups & Restore

### Back Up Everything

Run these commands regularly (or set up the automated backup below):

```bash
# 1. Database (most important!)
docker compose -f deploy/self-host/docker-compose.yml exec postgres \
  pg_dump -U gratonite gratonite | gzip > backup-$(date +%Y%m%d).sql.gz

# 2. File uploads (avatars, attachments, etc.)
docker compose -f deploy/self-host/docker-compose.yml cp api:/app/uploads ./uploads-backup

# 3. Instance keys (your federation identity — important if using federation)
docker compose -f deploy/self-host/docker-compose.yml cp api:/app/keys ./keys-backup
```

### Restore a Database Backup

```bash
gunzip -c backup-20260308.sql.gz | \
  docker compose -f deploy/self-host/docker-compose.yml exec -T postgres \
  psql -U gratonite gratonite
```

### Automated Nightly Backups (Recommended)

Set up a cron job to back up your database every night at 3 AM:

```bash
crontab -e
```

Add this line (replace `/path/to/` with your actual paths):

```
0 3 * * * cd /path/to/Gratonite && docker compose -f deploy/self-host/docker-compose.yml exec -T postgres pg_dump -U gratonite gratonite | gzip > /path/to/backups/gratonite-$(date +\%Y\%m\%d).sql.gz
```

---

## Federation: Connect to Other Instances

Federation lets your Gratonite instance communicate with other Gratonite instances. Users on your instance can discover and visit servers hosted on other instances, and your public servers can appear on the [Gratonite Discover](https://gratonite.chat/app/discover) directory.

**Federation is completely optional and disabled by default.** Your instance works perfectly fine as a standalone platform.

### How to Enable Federation

**Step 1:** Open your `.env` file:

```bash
nano deploy/self-host/.env
```

**Step 2:** Find the federation section and change these values:

```bash
FEDERATION_ENABLED=true
FEDERATION_DISCOVER_REGISTRATION=true
```

**Step 3:** Save the file and restart the API:

```bash
docker compose -f deploy/self-host/docker-compose.yml restart api
```

**Step 4:** Verify federation is active:

```bash
curl https://your-domain.com/.well-known/gratonite
```

You should see a JSON response containing your instance's public key and federation endpoints. If you see this, federation is working.

### How to List Your Servers on Gratonite Discover

Once federation is enabled, you need to mark which of your servers should be publicly discoverable:

1. Open your Gratonite instance in a browser and log in
2. Go to a server you want to list publicly
3. Open **Server Settings** (click the server name > Server Settings)
4. Go to **Overview**
5. Enable the **"Listed in Server Discovery"** toggle
6. Optionally add a description and tags to help people find your server

Your discoverable servers will automatically sync to [gratonite.chat/app/discover](https://gratonite.chat/app/discover) every 30 minutes and appear in the **"Self-Hosted Servers"** section.

### How to Verify Your Servers Appear on Discover

After enabling federation and marking servers as discoverable, wait up to 30 minutes, then:

1. Visit [gratonite.chat/app/discover](https://gratonite.chat/app/discover)
2. Scroll to the **"Self-Hosted Servers"** section
3. Your servers should appear with their name, description, and member count

If they don't appear after 30 minutes, check:
- Federation is enabled: `curl https://your-domain.com/.well-known/gratonite` returns JSON
- Your server is marked as discoverable in Server Settings
- Check API logs: `docker compose -f deploy/self-host/docker-compose.yml logs api --tail 30`

### Federation Security

- All instance-to-instance communication is signed with **Ed25519 HTTP Signatures** — no instance can impersonate another
- Inbound content is sanitized (HTML stripped, URLs validated, size limits enforced)
- You can block specific domains via the admin panel
- Federation is fully opt-in — disabled by default

See the [Federation Guide](federation-guide.md) for more details.

---

## Configuration Reference

### Required Variables

These are the only values you **must** set. Everything else has sensible defaults.

| Variable | Description | Example |
|----------|-------------|---------|
| `INSTANCE_DOMAIN` | Your instance's public domain (no `https://`) | `chat.example.com` |
| `ADMIN_EMAIL` | Email for the admin account | `admin@example.com` |
| `ADMIN_PASSWORD` | Password for the admin account | (pick something strong) |
| `DB_PASSWORD` | PostgreSQL database password | (random, 16+ chars) |

### Auto-Generated (Don't Touch Unless You Know What You're Doing)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | Auto-generated | Access token signing key (32+ chars) |
| `JWT_REFRESH_SECRET` | Auto-generated | Refresh token signing key (32+ chars) |
| `APP_URL` | Auto-derived from `INSTANCE_DOMAIN` | Full URL of your instance |
| `CORS_ORIGIN` | Auto-derived from `INSTANCE_DOMAIN` | Allowed origin for cross-origin requests |

### Email (Optional)

Required for password resets and email notifications. Without this, users can still sign up and use the platform, but they won't be able to reset forgotten passwords.

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `smtp.mailgun.org` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `noreply@chat.example.com` |
| `SMTP_PASS` | (your SMTP password) |
| `SMTP_FROM` | `Gratonite <noreply@chat.example.com>` |

### Voice & Video (Optional)

Voice and video calls require [LiveKit](https://livekit.io). You can either use LiveKit Cloud (easiest) or self-host LiveKit.

Start the voice profile:

```bash
docker compose -f deploy/self-host/docker-compose.yml --profile voice up -d
```

| Variable | Description |
|----------|-------------|
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `LIVEKIT_URL` | `ws://livekit:7880` (if using the bundled container) |

### Federation (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `FEDERATION_ENABLED` | `false` | Master switch — enables all federation features |
| `FEDERATION_ALLOW_INBOUND` | `true` | Accept requests from other Gratonite instances |
| `FEDERATION_ALLOW_OUTBOUND` | `true` | Send requests to other Gratonite instances |
| `FEDERATION_ALLOW_JOINS` | `true` | Allow users from other instances to join your servers |
| `FEDERATION_ALLOW_REPLICATION` | `false` | Enable server replication for redundancy |
| `FEDERATION_DISCOVER_REGISTRATION` | `false` | Register your servers with the Gratonite Discover directory |
| `FEDERATION_HUB_URL` | `https://gratonite.chat` | Hub URL for Discover registration (only change for private networks) |

### Advanced

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | API internal port (no need to change) |
| `NODE_ENV` | `production` | Environment mode |
| `MAX_UPLOAD_SIZE` | `25000000` | Max file upload size in bytes (default: 25 MB) |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

---

## Architecture

Here's how the services connect:

```
Internet
    |
    v
+---------+
|  Caddy  |  :80/:443 -- auto-HTTPS, reverse proxy
+----+----+
     |
     +---> /api/*           -> API container (:4000)
     +---> /socket.io/*     -> API container (WebSocket, real-time)
     +---> /uploads/*       -> API container (file uploads)
     +---> /.well-known/*   -> API container (federation)
     +---> /*               -> Web container (:80, nginx SPA)

+----------+  +----------+
| PostgreSQL|  |  Redis   |
|  :5432    |  |  :6379   |
+----------+  +----------+
```

All services communicate over a private Docker bridge network. **Only Caddy exposes ports to the internet.** The database, Redis, API, and web containers are not directly accessible from outside.

| Service | Image | What It Does |
|---------|-------|-------------|
| **setup** | `ghcr.io/coodayea/gratonite-setup` | Runs once on first start: creates database tables, generates secrets, creates your admin account |
| **api** | `ghcr.io/coodayea/gratonite-api` | The backend: handles all API requests, WebSocket connections, real-time messaging |
| **web** | `ghcr.io/coodayea/gratonite-web` | The frontend: serves the React web app via nginx |
| **postgres** | `postgres:16-alpine` | Database: stores all your data (users, messages, servers, etc.) |
| **redis** | `redis:7-alpine` | Cache: rate limiting, session data, real-time pub/sub |
| **caddy** | `caddy:2-alpine` | Reverse proxy: handles HTTPS certificates automatically via Let's Encrypt |

---

## Troubleshooting

### Setup container fails

```bash
docker compose -f deploy/self-host/docker-compose.yml logs setup
```

| Error | Fix |
|-------|-----|
| `FATAL: password authentication failed` | The `DB_PASSWORD` in your `.env` doesn't match what PostgreSQL was initialized with. If this is a fresh install, run `docker compose -f deploy/self-host/docker-compose.yml down -v` to reset everything and try again. |
| `Connection refused` on port 5432 | PostgreSQL isn't ready yet. Wait 30 seconds and try `docker compose up -d` again. |
| `relation "users" already exists` | Migrations already ran — this is harmless. Setup will continue. |

### Can't access the instance in browser

1. **Check DNS:** Run `dig your-domain.com +short` — it should return your server's IP address. If not, your DNS record isn't set up correctly or hasn't propagated yet (wait 10 minutes).
2. **Check firewall:** Ensure ports 80 and 443 are open on both your OS firewall *and* your cloud provider's security group.
3. **Check Caddy:** Run `docker compose -f deploy/self-host/docker-compose.yml logs caddy` — if Caddy can't get a TLS certificate, it usually means your domain doesn't resolve to your server's IP yet.
4. **Check containers:** Run `docker compose -f deploy/self-host/docker-compose.yml ps` — all services should show `Up`.

### API errors

```bash
docker compose -f deploy/self-host/docker-compose.yml logs api --tail 50
```

| Error | Fix |
|-------|-----|
| `JWT_SECRET must be at least 32 characters` | Delete your `.env` and re-copy from `.env.example`. Leave `JWT_SECRET` and `JWT_REFRESH_SECRET` blank — they'll be auto-generated. |
| `APP_URL and CORS_ORIGIN are required` | Make sure `INSTANCE_DOMAIN` is set in your `.env` file. APP_URL and CORS_ORIGIN are auto-derived from it. |
| `Federation is not enabled` on federation endpoints | Set `FEDERATION_ENABLED=true` in `.env` and restart: `docker compose restart api` |

### Federation not working

1. **Check it's enabled:** `curl https://your-domain.com/.well-known/gratonite` should return JSON with your public key.
2. **Check logs:** `docker compose -f deploy/self-host/docker-compose.yml logs api --tail 30` — look for `[federation]` lines.
3. **Servers not on Discover:** Make sure `FEDERATION_DISCOVER_REGISTRATION=true` is set, you restarted the API, and your servers are marked as discoverable in Server Settings. Wait up to 30 minutes for the sync.

### Run migrations manually

If the setup container already exited but you need to run new migrations:

```bash
docker compose -f deploy/self-host/docker-compose.yml exec api node dist/db/migrate.js
```

### Reset everything (DESTRUCTIVE — deletes all data!)

```bash
docker compose -f deploy/self-host/docker-compose.yml down -v
# This permanently deletes ALL data: database, uploads, keys, everything.
# Only do this if you want a completely fresh start.
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

## Migrating from Another Instance

Gratonite supports account export and import. If you're migrating from another Gratonite instance, users can export their account (profile, settings, friend list, server memberships) and import it on your instance. See the [Federation Guide](federation-guide.md) for details.

---

## Getting Help

- **Issues:** [github.com/CoodayeA/Gratonite/issues](https://github.com/CoodayeA/Gratonite/issues)
- **Discussions:** [github.com/CoodayeA/Gratonite/discussions](https://github.com/CoodayeA/Gratonite/discussions)
- **Main instance:** [gratonite.chat](https://gratonite.chat)
