# One-Click Self-Hosting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make self-hosting Gratonite a one-click experience — local desktop app for trying it, CLI installer for power users, deploy button for VPS users.

**Architecture:** Pre-built Docker images on GHCR pulled by an installer script that auto-generates all config. Federation works via the relay (already deployed at relay.gratonite.chat). Relay-assisted discovery lets local instances appear in the hub Discover page without a public IP.

**Tech Stack:** Bash (installer), GitHub Actions (image publishing), Docker Compose (orchestration), Tauri (desktop app — later phase)

---

## Chunk 1: GitHub Actions + GHCR Image Publishing

### Task 1: Create Docker image publish workflow

**Files:**
- Create: `.github/workflows/docker-publish.yml`
- Modify: `apps/api/Dockerfile` (already fixed — use `--no-frozen-lockfile`)
- Modify: `apps/web/Dockerfile` (already fixed — pnpm workspace support)
- Modify: `deploy/setup/Dockerfile` (already fixed — `--no-frozen-lockfile`)

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/docker-publish.yml
name: Publish Docker Images

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - 'apps/web/**'
      - 'deploy/setup/**'
      - 'packages/types/**'
      - '.github/workflows/docker-publish.yml'
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  OWNER: coodayea

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    strategy:
      matrix:
        include:
          - image: gratonite-api
            dockerfile: apps/api/Dockerfile
            context: .
          - image: gratonite-web
            dockerfile: apps/web/Dockerfile
            context: .
          - image: gratonite-setup
            dockerfile: deploy/setup/Dockerfile
            context: .

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: ${{ matrix.context }}
          file: ${{ matrix.dockerfile }}
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.OWNER }}/${{ matrix.image }}:latest
            ${{ env.REGISTRY }}/${{ env.OWNER }}/${{ matrix.image }}:sha-${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Commit the Dockerfiles fixes**

The Dockerfiles were already fixed during our testing session. Ensure these changes are committed:
- `apps/api/Dockerfile` — `--no-frozen-lockfile`
- `apps/web/Dockerfile` — pnpm workspace, `npx vite build`, correct dist path
- `deploy/setup/Dockerfile` — `--no-frozen-lockfile`
- `apps/api/drizzle/0000_initial.sql` — consolidated single migration
- `apps/api/drizzle/meta/_journal.json` — single entry journal
- `apps/api/src/routes/voice.ts` — LiveKit optional in production
- `deploy/setup/init.ts` — auto-generate MFA_ENCRYPTION_KEY
- `.dockerignore` — exclude node_modules, .git, desktop, mobile

```bash
git add .github/workflows/docker-publish.yml \
  apps/api/Dockerfile apps/web/Dockerfile deploy/setup/Dockerfile \
  apps/api/drizzle/ apps/api/src/routes/voice.ts \
  deploy/setup/init.ts .dockerignore
git commit -m "feat: GHCR image publishing + Dockerfile fixes for self-hosting"
```

- [ ] **Step 3: Push and verify images publish**

```bash
git push origin main
# Wait for GitHub Actions to complete
gh run list --repo CoodayeA/Gratonite --limit 2
# Verify images exist
# Visit https://github.com/CoodayeA/Gratonite/pkgs/container/gratonite-api
```

---

## Chunk 2: Self-Host Docker Compose + Config Templates

### Task 2: Update the canonical self-host docker-compose.yml

**Files:**
- Modify: `deploy/self-host/docker-compose.yml`
- Modify: `deploy/self-host/.env.example`
- Modify: `deploy/self-host/Caddyfile`

- [ ] **Step 1: Update docker-compose.yml to use GHCR images + add LiveKit**

Replace `deploy/self-host/docker-compose.yml` with:

```yaml
services:
  # First-run setup: migrations, keypair, admin account
  setup:
    image: ghcr.io/coodayea/gratonite-setup:latest
    env_file: .env
    environment:
      - DATABASE_URL=postgresql://${DB_USER:-gratonite}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-gratonite}
      - REDIS_URL=redis://redis:6379
    volumes:
      - instance-keys:/app/keys
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: "no"

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-gratonite}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-gratonite}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-gratonite}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy noeviction
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  api:
    image: ghcr.io/coodayea/gratonite-api:latest
    env_file: .env
    environment:
      - DATABASE_URL=postgresql://${DB_USER:-gratonite}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-gratonite}
      - REDIS_URL=redis://redis:6379
      - PORT=4000
      - NODE_ENV=production
    volumes:
      - instance-keys:/app/keys
      - uploads:/app/uploads
    depends_on:
      setup:
        condition: service_completed_successfully
    restart: unless-stopped

  web:
    image: ghcr.io/coodayea/gratonite-web:latest
    depends_on:
      - api
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports:
      - "${HTTP_PORT:-80}:80"
      - "${HTTPS_PORT:-443}:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - api
      - web
    restart: unless-stopped

  # Voice/video — optional, enable with: docker compose --profile voice up -d
  livekit:
    image: livekit/livekit-server:latest
    command:
      - --config-body
      - |
        port: 7880
        rtc:
          tcp_port: 7881
          udp_port: 7882
          use_external_ip: true
        keys:
          ${LIVEKIT_API_KEY:-devkey}: ${LIVEKIT_API_SECRET:-secret}
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
    profiles:
      - voice
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
  instance-keys:
  uploads:
  caddy-data:
  caddy-config:
```

- [ ] **Step 2: Update .env.example with all required vars**

Replace `deploy/self-host/.env.example`:

```bash
# === Instance Settings ===
INSTANCE_DOMAIN=chat.example.com
ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me

# === Database ===
DB_USER=gratonite
DB_PASSWORD=change-me-to-random
DB_NAME=gratonite

# === Secrets (auto-generated by installer, or set manually) ===
JWT_SECRET=
JWT_REFRESH_SECRET=
MFA_ENCRYPTION_KEY=

# === Federation ===
FEDERATION_ENABLED=true
FEDERATION_ALLOW_INBOUND=true
FEDERATION_ALLOW_OUTBOUND=true
FEDERATION_ALLOW_JOINS=true
FEDERATION_HUB_URL=https://gratonite.chat
RELAY_ENABLED=true
RELAY_URL=wss://relay.gratonite.chat

# === Voice (optional — enable with: docker compose --profile voice up -d) ===
# LIVEKIT_URL=ws://livekit:7880
# LIVEKIT_API_KEY=devkey
# LIVEKIT_API_SECRET=secret

# === Port overrides (for local hosting) ===
# HTTP_PORT=80
# HTTPS_PORT=443
```

- [ ] **Step 3: Update Caddyfile for local/server dual mode**

Replace `deploy/self-host/Caddyfile`:

```
{$INSTANCE_DOMAIN:localhost} {
    handle /api/* {
        reverse_proxy api:4000
    }
    handle /socket.io/* {
        reverse_proxy api:4000
    }
    handle /health {
        reverse_proxy api:4000
    }
    handle /.well-known/gratonite {
        reverse_proxy api:4000
    }
    handle /uploads/* {
        reverse_proxy api:4000
    }
    handle {
        reverse_proxy web:80
    }
    tls {$TLS_MODE:internal}
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }
    encode gzip
}
```

Note: `TLS_MODE` defaults to `internal` (self-signed for local). The installer sets it to the admin email for server mode (triggers Let's Encrypt).

- [ ] **Step 4: Commit**

```bash
git add deploy/self-host/
git commit -m "feat: update self-host configs with GHCR images, LiveKit, dual-mode TLS"
```

---

## Chunk 3: CLI Installer Script

### Task 3: Create the installer script

**Files:**
- Create: `deploy/install.sh`

- [ ] **Step 1: Write the installer script**

Create `deploy/install.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Gratonite Self-Host Installer
# Usage: curl -fsSL https://gratonite.chat/install | bash

GRATONITE_VERSION="latest"
GITHUB_RAW="https://raw.githubusercontent.com/CoodayeA/Gratonite/main"
INSTALL_DIR="$HOME/gratonite"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

info()  { echo -e "${PURPLE}[gratonite]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ─── Banner ───────────────────────────────────────────────────────────
echo ""
echo -e "${PURPLE}${BOLD}"
echo "   ██████╗ ██████╗  █████╗ ████████╗ ██████╗ ███╗   ██╗██╗████████╗███████╗"
echo "  ██╔════╝ ██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗████╗  ██║██║╚══██╔══╝██╔════╝"
echo "  ██║  ███╗██████╔╝███████║   ██║   ██║   ██║██╔██╗ ██║██║   ██║   █████╗  "
echo "  ██║   ██║██╔══██╗██╔══██║   ██║   ██║   ██║██║╚██╗██║██║   ██║   ██╔══╝  "
echo "  ╚██████╔╝██║  ██║██║  ██║   ██║   ╚██████╔╝██║ ╚████║██║   ██║   ███████╗"
echo "   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═══╝╚═╝   ╚═╝   ╚══════╝"
echo -e "${NC}"
echo -e "  ${BOLD}Self-Host Installer${NC}"
echo ""

# ─── OS Detection ─────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Linux*)  OS="linux" ;;
    Darwin*) OS="macos" ;;
    MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
    *) fail "Unsupported OS: $(uname -s)" ;;
  esac
  ARCH="$(uname -m)"
  info "Detected: $OS ($ARCH)"
}

# ─── Docker Check ─────────────────────────────────────────────────────
check_docker() {
  if command -v docker &>/dev/null && docker info &>/dev/null; then
    ok "Docker is running ($(docker --version | head -1))"
    return 0
  fi

  if command -v docker &>/dev/null; then
    warn "Docker is installed but not running."
    if [ "$OS" = "macos" ]; then
      echo "  Please start Docker Desktop and re-run this script."
      echo "  Download: https://docker.com/products/docker-desktop"
    elif [ "$OS" = "linux" ]; then
      echo "  Try: sudo systemctl start docker"
    fi
    exit 1
  fi

  warn "Docker is not installed."
  if [ "$OS" = "linux" ]; then
    read -p "  Install Docker now? [Y/n] " -n 1 -r; echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
      info "Installing Docker..."
      curl -fsSL https://get.docker.com | sh
      sudo usermod -aG docker "$USER"
      ok "Docker installed. You may need to log out and back in."
      if ! docker info &>/dev/null; then
        sudo systemctl start docker
      fi
    else
      fail "Docker is required. Install it from https://docker.com"
    fi
  elif [ "$OS" = "macos" ]; then
    echo "  Install Docker Desktop: https://docker.com/products/docker-desktop"
    echo "  Or install Colima:      brew install colima docker docker-compose && colima start"
    fail "Docker is required."
  else
    fail "Install Docker Desktop for Windows: https://docker.com/products/docker-desktop"
  fi
}

# ─── Docker Compose Check ────────────────────────────────────────────
check_compose() {
  if docker compose version &>/dev/null; then
    ok "Docker Compose available (plugin)"
    COMPOSE="docker compose"
  elif docker-compose version &>/dev/null; then
    ok "Docker Compose available (standalone)"
    COMPOSE="docker-compose"
  else
    fail "Docker Compose not found. Install it: https://docs.docker.com/compose/install/"
  fi
}

# ─── Mode Selection ───────────────────────────────────────────────────
select_mode() {
  echo ""
  echo -e "  ${BOLD}How are you hosting?${NC}"
  echo ""
  echo "    1) On this computer (local — no domain needed)"
  echo "    2) On a server with a domain (VPS / homelab)"
  echo ""
  read -p "  Choose [1/2]: " -n 1 -r MODE_CHOICE; echo
  echo ""

  case "$MODE_CHOICE" in
    1) MODE="local" ;;
    2) MODE="server" ;;
    *) fail "Invalid choice. Run the script again." ;;
  esac
}

# ─── Collect Config ──────────────────────────────────────────────────
collect_config() {
  if [ "$MODE" = "server" ]; then
    read -p "  Domain name (e.g. chat.example.com): " DOMAIN
    [ -z "$DOMAIN" ] && fail "Domain is required for server mode."

    read -p "  Admin email: " ADMIN_EMAIL
    [ -z "$ADMIN_EMAIL" ] && fail "Admin email is required."

    read -sp "  Admin password: " ADMIN_PASSWORD; echo
    [ -z "$ADMIN_PASSWORD" ] && fail "Admin password is required."

    TLS_MODE="$ADMIN_EMAIL"
    HTTP_PORT=80
    HTTPS_PORT=443
  else
    DOMAIN="localhost"
    ADMIN_EMAIL="admin@localhost"
    ADMIN_PASSWORD="$(openssl rand -hex 8)"
    TLS_MODE="internal"
    HTTP_PORT=8080
    HTTPS_PORT=8443
    info "Local mode — no domain needed"
  fi

  # Generate secrets
  DB_PASSWORD="$(openssl rand -hex 16)"
  JWT_SECRET="$(openssl rand -base64 48)"
  JWT_REFRESH_SECRET="$(openssl rand -base64 48)"
  MFA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
}

# ─── Create Files ────────────────────────────────────────────────────
create_files() {
  mkdir -p "$INSTALL_DIR"
  cd "$INSTALL_DIR"

  info "Downloading config files..."
  curl -fsSL "$GITHUB_RAW/deploy/self-host/docker-compose.yml" -o docker-compose.yml
  curl -fsSL "$GITHUB_RAW/deploy/self-host/Caddyfile" -o Caddyfile

  info "Generating .env..."
  cat > .env << ENVEOF
# Gratonite Instance Configuration
# Generated by installer on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

INSTANCE_DOMAIN=$DOMAIN
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$ADMIN_PASSWORD

DB_USER=gratonite
DB_PASSWORD=$DB_PASSWORD
DB_NAME=gratonite

JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
MFA_ENCRYPTION_KEY=$MFA_ENCRYPTION_KEY

FEDERATION_ENABLED=true
FEDERATION_ALLOW_INBOUND=true
FEDERATION_ALLOW_OUTBOUND=true
FEDERATION_ALLOW_JOINS=true
FEDERATION_HUB_URL=https://gratonite.chat
RELAY_ENABLED=true
RELAY_URL=wss://relay.gratonite.chat

TLS_MODE=$TLS_MODE
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
ENVEOF

  ok "Config files created in $INSTALL_DIR"
}

# ─── Start Services ──────────────────────────────────────────────────
start_services() {
  cd "$INSTALL_DIR"

  info "Pulling Docker images..."
  $COMPOSE pull

  info "Starting Gratonite..."
  $COMPOSE up -d

  info "Waiting for services to be ready..."
  local retries=30
  while [ $retries -gt 0 ]; do
    if $COMPOSE exec -T api wget -qO- http://localhost:4000/health 2>/dev/null | grep -q '"status":"ok"'; then
      break
    fi
    retries=$((retries - 1))
    sleep 2
  done

  if [ $retries -eq 0 ]; then
    warn "Services are starting but health check timed out. Check logs with:"
    echo "  cd $INSTALL_DIR && $COMPOSE logs -f"
    return
  fi

  ok "All services healthy!"
}

# ─── Success Message ─────────────────────────────────────────────────
print_success() {
  echo ""
  echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  if [ "$MODE" = "local" ]; then
    echo -e "  ${BOLD}Your Gratonite instance is running!${NC}"
    echo ""
    echo -e "  ${BOLD}URL:${NC}      https://localhost:$HTTPS_PORT"
    echo -e "  ${BOLD}Email:${NC}    $ADMIN_EMAIL"
    echo -e "  ${BOLD}Password:${NC} $ADMIN_PASSWORD"
    echo ""
    echo -e "  ${YELLOW}Note:${NC} Your browser will show a security warning"
    echo "  because the TLS certificate is self-signed."
    echo "  Click 'Advanced' → 'Proceed' — this is safe for localhost."
  else
    echo -e "  ${BOLD}Your Gratonite instance is running!${NC}"
    echo ""
    echo -e "  ${BOLD}URL:${NC}      https://$DOMAIN"
    echo -e "  ${BOLD}Email:${NC}    $ADMIN_EMAIL"
    echo ""
    echo "  TLS certificate was automatically obtained from Let's Encrypt."
  fi

  echo ""
  echo -e "  ${BOLD}Federation:${NC} Connected to relay.gratonite.chat"
  echo "  Your instance will appear in Discover after 48h."
  echo ""
  echo -e "  ${BOLD}Manage:${NC}"
  echo "    cd $INSTALL_DIR"
  echo "    $COMPOSE logs -f        # View logs"
  echo "    $COMPOSE restart        # Restart"
  echo "    $COMPOSE down           # Stop"
  echo "    $COMPOSE pull && $COMPOSE up -d  # Update"
  echo ""
  echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# ─── Main ────────────────────────────────────────────────────────────
main() {
  detect_os
  check_docker
  check_compose
  select_mode
  collect_config
  create_files
  start_services
  print_success
}

main "$@"
```

- [ ] **Step 2: Test installer locally in dry-run**

```bash
# Test that the script parses correctly
bash -n deploy/install.sh

# Test local mode manually (we already have Docker running)
cd ~/gratonite-test && bash "/Volumes/project bus/GratoniteFinalForm/deploy/install.sh"
```

- [ ] **Step 3: Commit**

```bash
git add deploy/install.sh
git commit -m "feat: one-click installer script for self-hosting"
```

---

## Chunk 4: Relay-Assisted Discovery

### Task 4: Add instance trust tracking to the relay

**Files:**
- Modify: `apps/relay/src/server.ts`
- Modify: `apps/relay/src/connections.ts`
- Modify: `apps/relay/src/health.ts`

- [ ] **Step 1: Track instance connection duration in Redis**

In `apps/relay/src/connections.ts`, after `addConnection()`, store the first-seen timestamp:

```typescript
// In addConnection method, after storing the WebSocket:
await this.redis.hsetnx(`instance:${domain}:meta`, 'firstSeen', Date.now().toString());
await this.redis.hset(`instance:${domain}:meta`, 'lastSeen', Date.now().toString());
```

- [ ] **Step 2: Add discovery eligibility endpoint to health server**

In `apps/relay/src/health.ts`, add a new endpoint `/instances` that returns connected instances with their eligibility:

```typescript
// GET /instances — returns connected instances and their discovery eligibility
// Only callable by the hub (verify via shared secret or instance signature)
app.get('/instances', async (req, res) => {
  const hubSecret = process.env.RELAY_HUB_SECRET;
  if (hubSecret && req.headers['x-hub-secret'] !== hubSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const domains = connections.getLocalDomains();
  const instances = [];

  for (const domain of domains) {
    const meta = await redis.hgetall(`instance:${domain}:meta`);
    const firstSeen = parseInt(meta.firstSeen || '0', 10);
    const connectedHours = (Date.now() - firstSeen) / 3600000;
    const reports = parseInt(meta.reports || '0', 10);

    instances.push({
      domain,
      connectedSince: meta.firstSeen,
      connectedHours: Math.floor(connectedHours),
      reports,
      discoveryEligible: connectedHours >= 48 && reports === 0,
      publicKeyPem: meta.publicKeyPem || null,
    });
  }

  res.json({ instances, relayDomain: RELAY_DOMAIN });
});
```

- [ ] **Step 3: Store public key on connection**

In `apps/relay/src/connections.ts`, save the public key when an instance connects:

```typescript
// In addConnection, also store the public key:
if (publicKeyPem) {
  await this.redis.hset(`instance:${domain}:meta`, 'publicKeyPem', publicKeyPem);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/relay/src/
git commit -m "feat: relay tracks instance uptime for discovery eligibility"
```

### Task 5: Hub polls relay for eligible instances

**Files:**
- Modify: `apps/api/src/federation/index.ts`
- Modify: `apps/api/src/routes/federation.ts`

- [ ] **Step 1: Add relay polling job**

In `apps/api/src/federation/index.ts`, add a BullMQ job that polls the relay every 5 minutes for eligible instances and auto-creates handshakes:

```typescript
// In initFederation(), after relay connection setup:
if (isHub()) {
  // Poll relay for discovery-eligible instances
  const relayPollQueue = new Queue('relay-instance-poll', { connection: redisConnection });
  await relayPollQueue.upsertJobScheduler('relay-poll-repeat', {
    every: 300000, // 5 minutes
  }, {
    name: 'relay-poll-tick',
  });

  new Worker('relay-instance-poll', async () => {
    await pollRelayForInstances();
  }, { connection: redisConnection });
}
```

- [ ] **Step 2: Implement pollRelayForInstances**

```typescript
async function pollRelayForInstances(): Promise<void> {
  const relayUrl = process.env.RELAY_URL;
  if (!relayUrl) return;

  // Convert wss://relay.gratonite.chat to https://relay.gratonite.chat
  const healthUrl = relayUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const hubSecret = process.env.RELAY_HUB_SECRET || '';

  try {
    const res = await fetch(`${healthUrl}/instances`, {
      headers: { 'x-hub-secret': hubSecret },
    });
    if (!res.ok) return;

    const { instances } = await res.json();

    for (const inst of instances) {
      if (!inst.discoveryEligible || inst.domain === getInstanceDomain()) continue;

      // Check if we already know this instance
      const existing = await db.query.federatedInstances.findFirst({
        where: eq(federatedInstances.baseUrl, `https://${inst.domain}`),
      });

      if (!existing && inst.publicKeyPem) {
        // Auto-create federated instance record (relay-verified)
        await db.insert(federatedInstances).values({
          baseUrl: `https://${inst.domain}`,
          publicKeyPem: inst.publicKeyPem,
          trustLevel: 'auto_discovered',
          status: 'active',
          trustScore: 50,
          inDiscover: false, // they still need to push guilds
          softwareVersion: 'unknown',
          lastSeenAt: new Date(),
        }).onConflictDoUpdate({
          target: federatedInstances.baseUrl,
          set: { lastSeenAt: new Date(), status: 'active' },
        });

        console.log(`[federation] Auto-discovered instance via relay: ${inst.domain}`);
      }
    }
  } catch (err) {
    console.error('[federation] Failed to poll relay for instances:', err);
  }
}

function isHub(): boolean {
  return getInstanceDomain() === new URL(getFederationHubUrl()).hostname;
}
```

- [ ] **Step 3: Allow relay-verified instances to register guilds without HTTP callback**

In `apps/api/src/routes/federation.ts`, modify the `POST /federation/discover/register` handler. Currently it requires `requireFederationAuth` which does HTTP signature verification. Add an alternative path for relay-verified instances:

At the top of the discover/register handler, before the existing auth check:
```typescript
// Check if this instance was auto-discovered via relay
// (its public key is already verified by the relay)
const relayVerified = instance && instance.trustLevel === 'auto_discovered';
```

The existing `requireFederationAuth` middleware already validates the HTTP signature using the stored public key, so relay-discovered instances can still authenticate — their key was stored when the relay reported them.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/federation/ apps/api/src/routes/federation.ts
git commit -m "feat: hub polls relay for discovery-eligible instances"
```

### Task 6: Auto-push guilds to hub on the self-hosted side

**Files:**
- Modify: `apps/api/src/federation/index.ts`

- [ ] **Step 1: Add periodic guild push to hub**

In `initFederation()`, add a job that pushes public guilds to the hub every hour:

```typescript
// For non-hub instances: push discoverable guilds to the hub
if (!isHub() && getFederationFlags().discoverRegistration !== false) {
  const discoverPushQueue = new Queue('discover-push', { connection: redisConnection });
  await discoverPushQueue.upsertJobScheduler('discover-push-repeat', {
    every: 3600000, // 1 hour
  }, {
    name: 'discover-push-tick',
  });

  new Worker('discover-push', async () => {
    await pushGuildsToHub();
  }, { connection: redisConnection });
}
```

- [ ] **Step 2: Implement pushGuildsToHub**

```typescript
async function pushGuildsToHub(): Promise<void> {
  const hubUrl = getFederationHubUrl();
  const domain = getInstanceDomain();

  // Get public guilds (discoverable, not private)
  const publicGuilds = await db.query.guilds.findMany({
    where: and(
      eq(guilds.isPrivate, false),
      // Only guilds with at least 1 member
    ),
    limit: 50,
  });

  if (publicGuilds.length === 0) return;

  const payload = publicGuilds.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description || '',
    iconUrl: g.iconHash ? `https://${domain}/api/v1/files/${g.iconHash}` : null,
    memberCount: 0, // TODO: count from guild_members
    tags: [],
    category: 'community',
  }));

  try {
    const { privateKey } = await loadInstanceKeys();
    const body = JSON.stringify({ guilds: payload });
    const signature = signRequest(privateKey, body, domain);

    const res = await fetch(`${hubUrl}/api/v1/federation/discover/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Instance-Domain': domain,
        'X-Signature': signature,
      },
      body,
    });

    if (res.ok) {
      console.log(`[federation] Pushed ${payload.length} guilds to hub Discover`);
    } else {
      console.warn(`[federation] Hub rejected discover push: ${res.status}`);
    }
  } catch (err) {
    console.error('[federation] Failed to push guilds to hub:', err);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/federation/
git commit -m "feat: self-hosted instances auto-push guilds to hub Discover"
```

---

## Chunk 5: Documentation

### Task 7: Write comprehensive self-hosting docs

**Files:**
- Modify: `docs/self-hosting.md` (rewrite as hub page)
- Create: `docs/self-hosting/local-cli.md`
- Create: `docs/self-hosting/vps-cli.md`
- Create: `docs/self-hosting/configuration.md`
- Create: `docs/self-hosting/federation.md`
- Create: `docs/self-hosting/updating.md`
- Create: `docs/self-hosting/troubleshooting.md`

- [ ] **Step 1: Rewrite docs/self-hosting.md as hub page**

Overview page linking to specific guides. Quick comparison table of local vs server mode. Links to each sub-page.

- [ ] **Step 2: Write local-cli.md**

Step-by-step for local hosting: install Docker → run installer → accept browser cert warning → log in. Screenshots of each step.

- [ ] **Step 3: Write vps-cli.md**

Step-by-step for VPS: create server → point domain → run installer → log in. Includes provider-specific tips for Hetzner, DigitalOcean, Vultr.

- [ ] **Step 4: Write configuration.md**

Every env var documented with description, default, required/optional.

- [ ] **Step 5: Write federation.md**

How federation works, the relay, discovery, trust levels, how to appear in Discover.

- [ ] **Step 6: Write updating.md and troubleshooting.md**

Update process (`docker compose pull && up -d`). Common issues table with fixes.

- [ ] **Step 7: Commit**

```bash
git add docs/
git commit -m "docs: comprehensive self-hosting documentation"
```

---

## Chunk 6: Host Installer Script on Landing Page

### Task 8: Serve install script from gratonite.chat/install

**Files:**
- Modify: Production Caddy config (on Hetzner server)
- Copy: `deploy/install.sh` to server

- [ ] **Step 1: Copy installer to server**

```bash
scp -i ~/.ssh/codex_gratonite_hetzner deploy/install.sh ferdinand@gratonite.chat:/home/ferdinand/gratonite-app/install.sh
```

- [ ] **Step 2: Add route to Caddy**

Add to production Caddyfile:
```
handle /install {
    root * /home/ferdinand/gratonite-app
    rewrite * /install.sh
    file_server
    header Content-Type "text/plain; charset=utf-8"
}
```

- [ ] **Step 3: Verify**

```bash
curl -fsSL https://gratonite.chat/install | head -5
# Should show the shebang and banner
```

- [ ] **Step 4: Commit docs referencing the URL**

Ensure all docs reference `curl -fsSL https://gratonite.chat/install | bash`.

---

## Future Chunks (separate plans)

### Desktop App (Tauri)
- Tauri project in `apps/desktop-host/` (separate from existing Electron desktop client)
- System tray with start/stop/update
- Bundled Docker orchestration
- Auto-update via GitHub releases

### VPS Deploy Button
- Web page at `gratonite.chat/deploy`
- Hetzner Cloud API integration
- DigitalOcean API integration
- Post-deploy webhook to confirm setup
