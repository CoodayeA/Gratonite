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
    ok "Docker is running"
    return 0
  fi

  if command -v docker &>/dev/null; then
    warn "Docker is installed but not running."
    if [ "$OS" = "macos" ]; then
      echo ""
      echo "  Please start Docker Desktop and re-run this script."
      echo "  Download: https://docker.com/products/docker-desktop"
    elif [ "$OS" = "linux" ]; then
      echo ""
      echo "  Try: sudo systemctl start docker"
    fi
    exit 1
  fi

  warn "Docker is not installed."
  if [ "$OS" = "linux" ]; then
    echo ""
    read -rp "  Install Docker now? [Y/n] " DOCKER_INSTALL
    if [[ "${DOCKER_INSTALL:-Y}" =~ ^[Yy]$ ]]; then
      info "Installing Docker..."
      curl -fsSL https://get.docker.com | sh
      sudo usermod -aG docker "$USER" 2>/dev/null || true
      ok "Docker installed."
      # Start docker daemon
      if command -v systemctl &>/dev/null; then
        sudo systemctl start docker 2>/dev/null || true
        sudo systemctl enable docker 2>/dev/null || true
      fi
      # Verify it works
      if ! docker info &>/dev/null; then
        warn "Docker installed but may need a re-login for group permissions."
        echo "  Run: newgrp docker && curl -fsSL https://gratonite.chat/install | bash"
        exit 0
      fi
    else
      fail "Docker is required. Install it from https://docker.com"
    fi
  elif [ "$OS" = "macos" ]; then
    echo ""
    echo "  Install Docker Desktop: https://docker.com/products/docker-desktop"
    echo "  Or with Homebrew:       brew install --cask docker"
    echo "  Or use Colima:          brew install colima docker docker-compose && colima start"
    fail "Docker is required."
  else
    fail "Install Docker Desktop for Windows: https://docker.com/products/docker-desktop"
  fi
}

# ─── Docker Compose Check ────────────────────────────────────────────
check_compose() {
  if docker compose version &>/dev/null 2>&1; then
    ok "Docker Compose available"
    COMPOSE="docker compose"
  elif command -v docker-compose &>/dev/null; then
    ok "Docker Compose available"
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
  read -rp "  Choose [1/2]: " MODE_CHOICE
  echo ""

  case "${MODE_CHOICE:-1}" in
    1) MODE="local" ;;
    2) MODE="server" ;;
    *) fail "Invalid choice. Run the script again." ;;
  esac
}

# ─── Collect Config ──────────────────────────────────────────────────
collect_config() {
  if [ "$MODE" = "server" ]; then
    read -rp "  Domain name (e.g. chat.example.com): " DOMAIN
    [ -z "${DOMAIN:-}" ] && fail "Domain is required for server mode."

    read -rp "  Admin email: " ADMIN_EMAIL
    [ -z "${ADMIN_EMAIL:-}" ] && fail "Admin email is required."

    read -rsp "  Admin password: " ADMIN_PASSWORD; echo
    [ -z "${ADMIN_PASSWORD:-}" ] && fail "Admin password is required."

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
  if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    warn "Existing installation found at $INSTALL_DIR"
    read -rp "  Overwrite config? Your data (DB, uploads) will be kept. [y/N] " OVERWRITE
    if [[ ! "${OVERWRITE:-N}" =~ ^[Yy]$ ]]; then
      info "Keeping existing config. Starting services..."
      return
    fi
  fi

  mkdir -p "$INSTALL_DIR"
  cd "$INSTALL_DIR"

  info "Downloading config files..."
  curl -fsSL "$GITHUB_RAW/deploy/self-host/docker-compose.yml" -o docker-compose.yml
  curl -fsSL "$GITHUB_RAW/deploy/self-host/Caddyfile" -o Caddyfile

  info "Generating .env with secure secrets..."
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

  chmod 600 .env
  ok "Config files created in $INSTALL_DIR"
}

# ─── Start Services ──────────────────────────────────────────────────
start_services() {
  cd "$INSTALL_DIR"

  info "Pulling Docker images (this may take a minute on first run)..."
  $COMPOSE pull --quiet 2>/dev/null || $COMPOSE pull

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
    printf "."
  done
  echo ""

  if [ $retries -eq 0 ]; then
    warn "Services are starting but health check timed out."
    echo "  This is normal on first run — migrations take a moment."
    echo "  Check status with: cd $INSTALL_DIR && $COMPOSE logs -f"
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
    echo "  Click 'Advanced' then 'Proceed' — this is safe for localhost."
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
  echo "  Your guilds will appear in Discover after 48h."
  echo ""
  echo -e "  ${BOLD}Voice/Video:${NC} Enable with:"
  echo "    cd $INSTALL_DIR && $COMPOSE --profile voice up -d"
  echo ""
  echo -e "  ${BOLD}Manage:${NC}"
  echo "    cd $INSTALL_DIR"
  echo "    $COMPOSE logs -f                       # View logs"
  echo "    $COMPOSE restart                       # Restart"
  echo "    $COMPOSE down                          # Stop"
  echo "    $COMPOSE pull && $COMPOSE up -d        # Update"
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
