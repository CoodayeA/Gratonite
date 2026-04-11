# Deploying Gratonite on a VPS (Hetzner and Similar)

This guide is a VPS-oriented companion to [`DEPLOY-TO-OWN-SERVER.md`](DEPLOY-TO-OWN-SERVER.md).

For project production operations, the canonical deploy path is always `deploy/deploy.sh`.

## Server Requirements

- Ubuntu 22.04+ (or Debian 12)
- 2 GB RAM minimum (4 GB recommended)
- 20 GB disk minimum
- Open ports: 22, 80, 443

## 1) Provision and Harden the Server

```bash
ssh root@<your-server-ip>

adduser deploy
usermod -aG sudo deploy

mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh

ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

Reconnect as deploy user:

```bash
ssh deploy@<your-server-ip>
```

## 2) Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Re-login and verify:

```bash
docker --version
docker compose version
```

## 3) Configure DNS

Set DNS records first so Caddy can issue TLS certs.

Use [`DNS-CONFIGURATION.md`](DNS-CONFIGURATION.md) as the source of truth.

## 4) Prepare Deploy Access

From your local machine (where this repo is checked out):

```bash
ssh -i ~/.ssh/<your-deploy-key> deploy@<your-server-ip> "mkdir -p /home/deploy/gratonite-app"
```

Create `/home/deploy/gratonite-app/.env` on the server with required values (`DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BULLBOARD_ADMIN_TOKEN`, `MFA_ENCRYPTION_KEY`, `APP_URL`, `CORS_ORIGIN`, and optional SMTP/LiveKit values).

## 5) Run Canonical Deploy

From repo root on your local machine:

```bash
SERVER=<your-server-ip> USER=deploy SSH_KEY=~/.ssh/<your-deploy-key> bash deploy/deploy.sh
```

What this does:

- builds API and web locally
- stages `deploy/api` and `deploy/web/dist`
- rsyncs to server (without overwriting `.env`)
- runs remote preflight checks
- recreates `api`, `web`, `caddy`, `livekit`
- runs migrations
- checks health endpoint

## 6) Verify Deployment

```bash
ssh -i ~/.ssh/<your-deploy-key> deploy@<your-server-ip>
cd ~/gratonite-app

docker compose -f docker-compose.production.yml ps
curl -I https://api.<your-domain>/health
```

Primary user entry should be:

- `https://<your-domain>/app/`

## Maintenance

```bash
# Re-deploy latest
git pull
SERVER=<your-server-ip> USER=deploy SSH_KEY=~/.ssh/<your-deploy-key> bash deploy/deploy.sh

# Logs
ssh -i ~/.ssh/<your-deploy-key> deploy@<your-server-ip>
cd ~/gratonite-app
docker logs -f gratonite-api
docker logs -f gratonite-caddy

# Backup
docker exec gratonite-postgres pg_dump -U gratonite gratonite > ~/backup_$(date +%Y%m%d).sql
```

## Security Checklist

- Non-root SSH user
- SSH key auth enabled
- Firewall restricted to needed ports
- Strong DB/JWT secrets
- Dedicated `BULLBOARD_ADMIN_TOKEN`
- Regular backups
