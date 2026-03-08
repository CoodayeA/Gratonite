# Deploying Gratonite on a VPS

This guide covers deploying Gratonite to a fresh VPS (Hetzner, DigitalOcean, Linode, Vultr, etc.). It uses the Docker Compose setup described in [DEPLOY-TO-OWN-SERVER.md](DEPLOY-TO-OWN-SERVER.md).

## Server Requirements

- **OS:** Ubuntu 22.04 LTS (or Debian 12)
- **RAM:** 2 GB minimum (4 GB recommended)
- **Disk:** 20 GB minimum
- **Ports:** 22 (SSH), 80 (HTTP), 443 (HTTPS)

## Step 1: Provision a Server

Create a VPS with your provider. Most offer Ubuntu 22.04 images. Note your server's public IP address.

## Step 2: Initial Server Setup

```bash
ssh root@<your-server-ip>

# Create a non-root user
adduser deploy
usermod -aG sudo deploy

# Set up SSH key auth for the new user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh

# Configure firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable

# Log out and reconnect as the deploy user
exit
```

```bash
ssh deploy@<your-server-ip>
```

## Step 3: Install Docker

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in for group change to take effect
exit
ssh deploy@<your-server-ip>

# Verify
docker --version
docker compose version
```

## Step 4: Install Node.js and pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm

node --version   # should be v20.x
pnpm --version
```

## Step 5: Clone and Build

```bash
cd ~
git clone https://github.com/CoodayeA/Gratonite.git
cd Gratonite

# Build API
cd apps/api
pnpm install && pnpm run build
cd ../..

# Build web client
cd apps/web
pnpm install && pnpm run build
cd ../..
```

## Step 6: Configure

```bash
cp deploy/.env.example .env
nano .env
# Fill in DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, SMTP, domain, LiveKit
# See docs/DEPLOY-TO-OWN-SERVER.md for details on each variable
```

Edit the Caddyfile with your domain:

```bash
nano deploy/Caddyfile
```

## Step 7: Configure DNS

Point your domain to the server IP. See [DNS-CONFIGURATION.md](DNS-CONFIGURATION.md).

## Step 8: Start

```bash
cd ~/Gratonite/deploy
docker compose -f docker-compose.production.yml up -d
docker exec gratonite-api sh -c "cd /app && node dist/db/migrate.js"
```

## Step 9: Verify

```bash
# All containers healthy
docker compose -f docker-compose.production.yml ps

# API responds
curl https://api.yourdomain.com/health

# Visit https://yourdomain.com in a browser
```

## Maintenance

```bash
# View logs
docker logs -f gratonite-api
docker logs -f gratonite-caddy

# Restart a service
docker restart gratonite-api

# Database backup
docker exec gratonite-postgres pg_dump -U gratonite gratonite > ~/backup_$(date +%Y%m%d).sql

# Update to latest version
cd ~/Gratonite
git pull
cd apps/api && pnpm install && pnpm run build && cd ../..
cd apps/web && pnpm install && pnpm run build && cd ../..
cd deploy && docker compose -f docker-compose.production.yml up -d --force-recreate api web
docker exec gratonite-api sh -c "cd /app && node dist/db/migrate.js"
```

## Security Checklist

- [ ] Non-root user for SSH access
- [ ] SSH key authentication (disable password auth)
- [ ] Firewall enabled (UFW: 22, 80, 443 only)
- [ ] Strong DB and JWT secrets
- [ ] HTTPS enabled (handled automatically by Caddy)
- [ ] Automatic security updates: `sudo apt install unattended-upgrades`
- [ ] Regular database backups
- [ ] Optional: fail2ban for SSH brute-force protection
