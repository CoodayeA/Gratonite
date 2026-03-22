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
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

STEP=0
TOTAL_STEPS=7

step()  { STEP=$((STEP + 1)); echo ""; echo -e "${PURPLE}  ┌─────────────────────────────────────────────${NC}"; echo -e "${PURPLE}  │ ${BOLD}[${STEP}/${TOTAL_STEPS}] $*${NC}"; echo -e "${PURPLE}  └─────────────────────────────────────────────${NC}"; }
info()  { echo -e "${CYAN}    ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}    ✓${NC}  $*"; }
warn()  { echo -e "${YELLOW}    ⚠${NC}  $*"; }
fail()  { echo -e "${RED}    ✗${NC}  $*"; exit 1; }

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
echo -e "  ${BOLD}Self-Host Installer${NC}  ${DIM}— Your chat, your rules${NC}"
echo ""
echo -e "  ${DIM}╭──────────────────────────────────────────────╮${NC}"
echo -e "  ${DIM}│${NC}  ${BOLD}What is self-hosting?${NC}                        ${DIM}│${NC}"
echo -e "  ${DIM}│${NC}                                               ${DIM}│${NC}"
echo -e "  ${DIM}│${NC}  It means running Gratonite on your own        ${DIM}│${NC}"
echo -e "  ${DIM}│${NC}  computer instead of someone else's server.    ${DIM}│${NC}"
echo -e "  ${DIM}│${NC}  Your messages, files, and data stay entirely  ${DIM}│${NC}"
echo -e "  ${DIM}│${NC}  under your control.                           ${DIM}│${NC}"
echo -e "  ${DIM}│${NC}                                               ${DIM}│${NC}"
echo -e "  ${DIM}│${NC}  This installer sets everything up for you.    ${DIM}│${NC}"
echo -e "  ${DIM}│${NC}  It usually takes about ${BOLD}3-5 minutes${NC}.          ${DIM}│${NC}"
echo -e "  ${DIM}╰──────────────────────────────────────────────╯${NC}"
echo ""

# ─── Stdin detection (for curl | bash compatibility) ─────────────────
# When piped via curl | bash, stdin IS the script — we must NOT replace it
# with exec </dev/tty or bash loses the rest of the script.
# Instead, open /dev/tty on fd 3 for interactive prompts.
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"
if [ ! -t 0 ]; then
  if exec 3</dev/tty 2>/dev/null; then
    HAS_TTY=true
  else
    warn "Non-interactive mode detected — using defaults (local mode)"
    info "Want more options? Run: bash <(curl -fsSL https://gratonite.chat/install)"
    NON_INTERACTIVE=true
    HAS_TTY=false
  fi
else
  exec 3<&0  # stdin is already a terminal, dup it to fd 3
  HAS_TTY=true
fi

# Helper: read from terminal (fd 3) instead of stdin
prompt() { read "$@" <&3; }

# ─── OS Detection ─────────────────────────────────────────────────────
detect_os() {
  step "Checking your computer"
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
  step "Looking for Docker"
  if command -v docker &>/dev/null && docker info &>/dev/null; then
    ok "Docker is running"
    return 0
  fi

  if command -v docker &>/dev/null; then
    warn "Docker is installed but not running."
    if [ "$OS" = "macos" ]; then
      echo ""
      echo "    Please start Docker Desktop and re-run this script."
      echo "    Download: https://docker.com/products/docker-desktop"
      echo ""
      echo "    Once Docker is running, just run this again:"
      echo "      curl -fsSL https://gratonite.chat/install | bash"
    elif [ "$OS" = "linux" ]; then
      echo ""
      echo "    Try: sudo systemctl start docker"
      echo ""
      echo "    Then re-run:"
      echo "      curl -fsSL https://gratonite.chat/install | bash"
    fi
    exit 1
  fi

  echo ""
  echo -e "  ${DIM}╭──────────────────────────────────────────────╮${NC}"
  echo -e "  ${DIM}│${NC}  ${BOLD}What is Docker?${NC}                              ${DIM}│${NC}"
  echo -e "  ${DIM}│${NC}                                               ${DIM}│${NC}"
  echo -e "  ${DIM}│${NC}  Docker is a free tool that packages software  ${DIM}│${NC}"
  echo -e "  ${DIM}│${NC}  into neat containers — like a lunchbox that   ${DIM}│${NC}"
  echo -e "  ${DIM}│${NC}  holds everything Gratonite needs (database,   ${DIM}│${NC}"
  echo -e "  ${DIM}│${NC}  web server, etc.) so it runs the same way     ${DIM}│${NC}"
  echo -e "  ${DIM}│${NC}  on any computer.                              ${DIM}│${NC}"
  echo -e "  ${DIM}│${NC}                                               ${DIM}│${NC}"
  echo -e "  ${DIM}│${NC}  It's safe and used by millions of developers. ${DIM}│${NC}"
  echo -e "  ${DIM}╰──────────────────────────────────────────────╯${NC}"
  echo ""

  if [ "$OS" = "linux" ]; then
    if [ "$NON_INTERACTIVE" = "true" ]; then
      info "Installing Docker automatically..."
      curl -fsSL https://get.docker.com | sh
    else
      prompt -rp "    Install Docker now? [Y/n] " DOCKER_INSTALL
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
      echo "    Run: newgrp docker && bash <(curl -fsSL https://gratonite.chat/install)"
      exit 0
    fi
    ok "Docker installed"
  elif [ "$OS" = "macos" ]; then
    echo ""
    echo "    Install Docker Desktop: https://docker.com/products/docker-desktop"
    echo "    Or with Homebrew:       brew install --cask docker"
    echo "    Or use Colima:          brew install colima docker docker-compose && colima start"
    echo ""
    echo "    Once installed, run this again:"
    echo "      curl -fsSL https://gratonite.chat/install | bash"
    fail "Docker is required."
  else
    echo ""
    echo "    Once installed, run this again:"
    echo "      curl -fsSL https://gratonite.chat/install | bash"
    fail "Install Docker Desktop for Windows: https://docker.com/products/docker-desktop"
  fi
}

# ─── Docker Compose Check ────────────────────────────────────────────
check_compose() {
  step "Checking Docker tools"
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
  step "Choosing setup mode"
  if [ "$NON_INTERACTIVE" = "true" ]; then
    MODE="local"
    ok "Non-interactive — using local mode"
    return
  fi

  echo ""
  echo -e "    ${BOLD}Where will Gratonite live?${NC}"
  echo ""
  echo -e "      ${BOLD}1)${NC} ${GREEN}Right here on this computer${NC}"
  echo -e "         Best for trying it out — no extra setup needed"
  echo ""
  echo -e "      ${BOLD}2)${NC} ${CYAN}On a server with a domain name${NC}"
  echo -e "         Best for sharing with friends or a community"
  echo ""
  prompt -rp "    Pick one [1/2]: " MODE_CHOICE
  echo ""

  case "${MODE_CHOICE:-1}" in
    1) MODE="local" ;;
    2) MODE="server" ;;
    *) fail "Invalid choice. Run the script again." ;;
  esac
}

# ─── Collect Config ──────────────────────────────────────────────────
collect_config() {
  step "Setting up your instance"
  if [ "$MODE" = "server" ]; then
    prompt -rp "    Domain name (e.g. chat.example.com): " DOMAIN
    [ -z "${DOMAIN:-}" ] && fail "Domain is required for server mode."

    prompt -rp "    Admin email: " ADMIN_EMAIL
    [ -z "${ADMIN_EMAIL:-}" ] && fail "Admin email is required."

    prompt -rsp "    Admin password: " ADMIN_PASSWORD; echo
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
  ok "Secure secrets generated"
}

# ─── Create Files ────────────────────────────────────────────────────
create_files() {
  if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    warn "Existing installation found at $INSTALL_DIR"
    if [ "$NON_INTERACTIVE" = "true" ]; then
      info "Keeping existing config."
      return
    fi
    prompt -rp "    Overwrite config? Your data (DB, uploads) will be kept. [y/N] " OVERWRITE
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

  step "Downloading Gratonite"
  info "Pulling Docker images — this may take a few minutes on first run..."
  $COMPOSE pull 2>&1 | while IFS= read -r line; do
    # Show image name being pulled
    if echo "$line" | grep -qE 'Pulling|Pull complete|Already exists|Downloading|Extracting'; then
      printf "\r\033[2K  ${PURPLE}    ⠿${NC} %s" "$(echo "$line" | head -c 70)"
    fi
  done
  printf "\r\033[2K"
  ok "All images downloaded"

  step "Starting your server"
  echo ""
  echo -e "  ${DIM}    ╭─────────────────────────────────────────╮${NC}"
  echo -e "  ${DIM}    │${NC}  ${BOLD}Starting 5 services:${NC}                    ${DIM}│${NC}"
  echo -e "  ${DIM}    │${NC}                                         ${DIM}│${NC}"
  echo -e "  ${DIM}    │${NC}  ${GREEN}◉${NC} PostgreSQL  — stores your data        ${DIM}│${NC}"
  echo -e "  ${DIM}    │${NC}  ${GREEN}◉${NC} Redis       — keeps things fast       ${DIM}│${NC}"
  echo -e "  ${DIM}    │${NC}  ${GREEN}◉${NC} API server  — handles the logic       ${DIM}│${NC}"
  echo -e "  ${DIM}    │${NC}  ${GREEN}◉${NC} Web server  — serves the interface    ${DIM}│${NC}"
  echo -e "  ${DIM}    │${NC}  ${GREEN}◉${NC} Caddy       — handles HTTPS security  ${DIM}│${NC}"
  echo -e "  ${DIM}    ╰─────────────────────────────────────────╯${NC}"
  echo ""

  $COMPOSE up -d 2>&1 | while IFS= read -r line; do
    printf "\r\033[2K  ${PURPLE}    ⠿${NC} %s" "$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g' | head -c 70)"
  done
  printf "\r\033[2K"
  ok "Containers started"

  info "Waiting for everything to be ready..."
  local retries=45
  local elapsed=0
  while [ $retries -gt 0 ]; do
    if $COMPOSE exec -T api wget -qO- http://localhost:4000/health 2>/dev/null | grep -q '"status":"ok"'; then
      break
    fi

    # Check if setup container failed before continuing to wait
    local setup_state
    setup_state=$($COMPOSE ps setup --format '{{.State}}' 2>/dev/null || echo "")
    if echo "$setup_state" | grep -qi "exited"; then
      local setup_exit
      setup_exit=$($COMPOSE ps setup --format '{{.ExitCode}}' 2>/dev/null || echo "0")
      if [ "$setup_exit" != "0" ]; then
        echo ""
        echo -e "  ${RED}${BOLD}    ✗ Setup failed!${NC}"
        echo ""
        echo "      Something went wrong during database setup."
        echo ""
        echo "      To see what happened:"
        echo "        cd $INSTALL_DIR && $COMPOSE logs setup"
        echo ""
        echo "      Need help? Open an issue and we'll sort it out:"
        echo "        https://github.com/CoodayeA/Gratonite/issues"
        echo ""
        exit 1
      fi
    fi

    retries=$((retries - 1))
    elapsed=$(( (45 - retries) * 2 ))
    printf "\r      ${PURPLE}⠿${NC} Waiting for API to be ready... (%ds)" "$elapsed"
    sleep 2
  done
  printf "\r\033[2K"

  if [ $retries -eq 0 ]; then
    # Final check if setup failed
    local setup_state2
    setup_state2=$($COMPOSE ps setup --format '{{.State}}' 2>/dev/null || echo "")
    if echo "$setup_state2" | grep -qi "exited"; then
      local setup_exit2
      setup_exit2=$($COMPOSE ps setup --format '{{.ExitCode}}' 2>/dev/null || echo "0")
      if [ "$setup_exit2" != "0" ]; then
        echo ""
        echo -e "  ${RED}${BOLD}    ✗ Setup failed!${NC}"
        echo ""
        echo "      Something went wrong during database setup."
        echo "      To see the error: cd $INSTALL_DIR && $COMPOSE logs setup"
        echo "      Report this bug:  https://github.com/CoodayeA/Gratonite/issues"
        echo ""
        exit 1
      fi
    fi
    warn "Health check timed out after 90 seconds."
    info "Services may still be starting. Check: cd $INSTALL_DIR && $COMPOSE logs -f"
    return
  fi

  ok "All services healthy!"
}

# ─── Success Message ─────────────────────────────────────────────────
print_success() {
  echo ""
  echo -e "${GREEN}${BOLD}"
  echo "  ╔══════════════════════════════════════════════════╗"
  echo "  ║                                                  ║"
  echo "  ║    🎉  Your Gratonite instance is running!  🎉   ║"
  echo "  ║                                                  ║"
  echo "  ╚══════════════════════════════════════════════════╝"
  echo -e "${NC}"

  if [ "$MODE" = "local" ]; then
    echo -e "    ${BOLD}URL:${NC}       https://localhost:$HTTPS_PORT"
    echo -e "    ${BOLD}Email:${NC}     $ADMIN_EMAIL"
    echo -e "    ${BOLD}Password:${NC}  $ADMIN_PASSWORD"
    echo ""
    echo -e "    ${YELLOW}Note:${NC} Your browser will show a security warning"
    echo "    because the TLS certificate is self-signed."
    echo "    Click ${BOLD}'Advanced'${NC} then ${BOLD}'Proceed'${NC} — this is safe for localhost."
  else
    echo -e "    ${BOLD}URL:${NC}       https://$DOMAIN"
    echo -e "    ${BOLD}Email:${NC}     $ADMIN_EMAIL"
    echo ""
    echo "    TLS certificate was automatically obtained from Let's Encrypt."
  fi

  echo ""
  echo -e "  ${DIM}  ──────────────────────────────────────────────${NC}"
  echo ""
  echo -e "    ${BOLD}What just happened?${NC}"
  echo "    We set up 5 services on your computer, all running"
  echo "    inside Docker containers — isolated from your system,"
  echo "    easy to stop, and easy to update:"
  echo ""
  echo -e "      ${GREEN}◉${NC} ${BOLD}PostgreSQL${NC}  — stores your messages and accounts"
  echo -e "      ${GREEN}◉${NC} ${BOLD}Redis${NC}       — keeps things fast with caching"
  echo -e "      ${GREEN}◉${NC} ${BOLD}API server${NC}  — handles all the app logic"
  echo -e "      ${GREEN}◉${NC} ${BOLD}Web server${NC}  — serves the chat interface"
  echo -e "      ${GREEN}◉${NC} ${BOLD}Caddy${NC}       — handles HTTPS security"

  echo ""
  echo -e "  ${DIM}  ──────────────────────────────────────────────${NC}"
  echo ""
  echo -e "    ${BOLD}Federation:${NC} Enabled — connecting to the Gratonite network"
  echo "    Other Gratonite instances can discover and chat with yours."
  echo "    Your guilds will appear in Discover after 48h."
  echo ""
  echo -e "    ${BOLD}Voice/Video:${NC} Enable with:"
  echo "      cd $INSTALL_DIR && $COMPOSE --profile voice up -d"

  echo ""
  echo -e "  ${DIM}  ──────────────────────────────────────────────${NC}"
  echo ""
  echo -e "    ${BOLD}Handy commands:${NC}"
  echo ""
  echo "      cd $INSTALL_DIR"
  echo "      cat .env                                  # See your login details"
  echo "      $COMPOSE logs -f                          # Watch the logs (Ctrl+C to stop)"
  echo "      $COMPOSE restart                          # Restart everything"
  echo "      $COMPOSE down                             # Shut it down"
  echo "      $COMPOSE pull && $COMPOSE up -d           # Update to latest version"
  echo ""
  echo -e "    ${BOLD}Disable federation:${NC} Edit .env, set FEDERATION_ENABLED=false"
  echo ""
  echo -e "${GREEN}${BOLD}  ═══════════════════════════════════════════════════${NC}"
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
