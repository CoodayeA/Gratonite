#!/usr/bin/env bash
set -euo pipefail

# Gratonite Self-Host Installer
# Usage: curl -fsSL https://gratonite.chat/install | bash
# Or:    bash <(curl -fsSL https://gratonite.chat/install)

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

STEP=0
TOTAL_STEPS=7

step()  { STEP=$((STEP + 1)); echo -e "${PURPLE}[${STEP}/${TOTAL_STEPS}]${NC} ${BOLD}$*${NC}"; }
info()  { echo -e "${PURPLE}  ├─${NC} $*"; }
ok()    { echo -e "${GREEN}  ✓${NC} $*"; }
warn()  { echo -e "${YELLOW}  !${NC} $*"; }
fail()  { echo -e "${RED}  ✗${NC} $*"; exit 1; }

# Animated spinner for long-running commands
spin() {
  local pid=$1 msg="${2:-Working...}"
  local frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local i=0
  printf "  "
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${PURPLE}%s${NC} %s" "${frames:i%${#frames}:1}" "$msg"
    i=$((i + 1))
    sleep 0.1
  done
  wait "$pid"
  local exit_code=$?
  printf "\r\033[2K"
  return $exit_code
}

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

# ─── Stdin detection (for curl | bash compatibility) ─────────────────
# When piped via curl | bash, stdin is the script itself, not the terminal.
# Reopen stdin from /dev/tty so interactive prompts work.
if [ ! -t 0 ]; then
  exec </dev/tty || {
    # If /dev/tty isn't available (e.g., non-interactive CI), use defaults
    warn "Non-interactive mode detected — using defaults (local mode)"
    NON_INTERACTIVE=true
  }
fi
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"

# ─── OS Detection ─────────────────────────────────────────────────────
detect_os() {
  step "Detecting system"
  case "$(uname -s)" in
    Linux*)  OS="linux" ;;
    Darwin*) OS="macos" ;;
    MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
    *) fail "Unsupported OS: $(uname -s)" ;;
  esac
  ARCH="$(uname -m)"
  ok "$OS ($ARCH)"
}

# ─── Docker Check ─────────────────────────────────────────────────────
check_docker() {
  step "Checking Docker"
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
    if [ "$NON_INTERACTIVE" = "true" ]; then
      info "Installing Docker automatically..."
      curl -fsSL https://get.docker.com | sh
    else
      echo ""
      read -rp "  Install Docker now? [Y/n] " DOCKER_INSTALL
      if [[ "${DOCKER_INSTALL:-Y}" =~ ^[Yy]$ ]]; then
        info "Installing Docker..."
        curl -fsSL https://get.docker.com | sh
      else
        fail "Docker is required. Install it from https://docker.com"
      fi
    fi
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    if command -v systemctl &>/dev/null; then
      sudo systemctl start docker 2>/dev/null || true
      sudo systemctl enable docker 2>/dev/null || true
    fi
    if ! docker info &>/dev/null; then
      warn "Docker installed but may need a re-login for group permissions."
      echo "  Run: newgrp docker && bash <(curl -fsSL https://gratonite.chat/install)"
      exit 0
    fi
    ok "Docker installed"
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
  step "Checking Docker Compose"
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
  step "Setup mode"
  if [ "$NON_INTERACTIVE" = "true" ]; then
    MODE="local"
    ok "Non-interactive — using local mode"
    return
  fi

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
  step "Configuring instance"
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

  # Generate all secrets
  DB_PASSWORD="$(openssl rand -hex 16)"
  JWT_SECRET="$(openssl rand -base64 48)"
  JWT_REFRESH_SECRET="$(openssl rand -base64 48)"
  MFA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  LIVEKIT_API_KEY="gratonite_$(openssl rand -hex 6)"
  LIVEKIT_API_SECRET="$(openssl rand -base64 32)"
  ok "Secrets generated"
}

# ─── Create Files ────────────────────────────────────────────────────
create_files() {
  if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    warn "Existing installation found at $INSTALL_DIR"
    if [ "$NON_INTERACTIVE" = "true" ]; then
      info "Keeping existing config."
      return
    fi
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
#
# To view these credentials again: cat $INSTALL_DIR/.env

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

# Federation — connects your instance to the Gratonite network.
# Messages are end-to-end encrypted; the relay only routes envelopes.
# Set FEDERATION_ENABLED=false to run a fully isolated instance.
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

# Voice/Video (LiveKit) — unique keys generated per install
LIVEKIT_API_KEY=$LIVEKIT_API_KEY
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET
LIVEKIT_URL=ws://livekit:7880
ENVEOF

  chmod 600 .env
  ok "Config files created in $INSTALL_DIR"
}

# ─── Start Services ──────────────────────────────────────────────────
start_services() {
  cd "$INSTALL_DIR"

  step "Pulling Docker images"
  info "This may take a few minutes on first run..."
  $COMPOSE pull 2>&1 | while IFS= read -r line; do
    # Show image name being pulled
    if echo "$line" | grep -qE 'Pulling|Pull complete|Already exists|Downloading|Extracting'; then
      printf "\r\033[2K  ${PURPLE}⠿${NC} %s" "$(echo "$line" | head -c 70)"
    fi
  done
  printf "\r\033[2K"
  ok "Images ready"

  step "Starting services"
  $COMPOSE up -d 2>&1 | while IFS= read -r line; do
    printf "\r\033[2K  ${PURPLE}⠿${NC} %s" "$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g' | head -c 70)"
  done
  printf "\r\033[2K"
  ok "Containers started"

  info "Waiting for health check..."
  local retries=45
  local elapsed=0
  while [ $retries -gt 0 ]; do
    if $COMPOSE exec -T api wget -qO- http://localhost:4000/health 2>/dev/null | grep -q '"status":"ok"'; then
      break
    fi
    retries=$((retries - 1))
    elapsed=$(( (45 - retries) * 2 ))
    printf "\r  ${PURPLE}⠿${NC} Waiting for API to be ready... (%ds)" "$elapsed"
    sleep 2
  done
  printf "\r\033[2K"

  if [ $retries -eq 0 ]; then
    warn "Health check timed out — this is normal on first run."
    info "Migrations may still be running. Check: cd $INSTALL_DIR && $COMPOSE logs -f"
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
  echo "    cat .env                                 # View credentials"
  echo "    $COMPOSE logs -f                         # View logs"
  echo "    $COMPOSE restart                         # Restart"
  echo "    $COMPOSE down                            # Stop"
  echo "    $COMPOSE pull && $COMPOSE up -d          # Update"
  echo ""
  echo -e "  ${BOLD}Disable federation:${NC} Edit .env, set FEDERATION_ENABLED=false"
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
