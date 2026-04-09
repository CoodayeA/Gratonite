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

# ─── Sharing Guide (no domain) ────────────────────────────────────────
show_sharing_guide() {
  echo ""
  echo -e "    ${BOLD}No worries! Let's get you set up.${NC}"
  echo ""
  echo "    Quick background: when you visit a website like google.com,"
  echo "    your browser uses that name (called a \"domain\") to find the"
  echo "    right computer on the internet. Your Gratonite server needs"
  echo "    a name like that too, so other people can find it."
  echo ""
  echo -e "    ${BOLD}Why does this matter?${NC}"
  echo "    A domain name is what connects your server to the Gratonite"
  echo "    network. Without one, your server works — but it's invisible."
  echo "    With one, your guilds can appear in Discover, people can"
  echo "    find and join your community, and gratonite.chat users can"
  echo "    log in with their existing account."
  echo ""
  echo -e "    ${GREEN}${BOLD}The good news: you can get one for free in 2 minutes.${NC}"
  echo ""
  echo -e "  ${DIM}  ─────────────────────────────────────────────────────${NC}"
  echo ""
  echo -e "    ${GREEN}${BOLD}DuckDNS — free domain, no catch${NC}"
  echo ""
  echo "    DuckDNS is a free service that gives you a name like"
  echo -e "    ${CYAN}${BOLD}mychat.duckdns.org${NC}. Think of it as a free address"
  echo "    for your server. It's been around since 2013, trusted"
  echo "    by millions, and doesn't cost a penny."
  echo ""
  echo "    Here's how it works:"
  echo "    • You pick a name — this becomes your community's address"
  echo "    • DuckDNS points that name at your computer"
  echo "    • Anyone who types that name into their browser"
  echo "      goes straight to your Gratonite server"
  echo ""
  echo -e "    ${BOLD}Picking a good name:${NC}"
  echo "    This name becomes your community's identity on the"
  echo "    Gratonite network — it shows up in Discover and in"
  echo "    people's server lists. Think of it like naming a"
  echo "    Discord server, except it's also the web address."
  echo ""
  echo "    Other federated platforms work the same way —"
  echo "    Mastodon uses domains (@user@mastodon.social),"
  echo "    Matrix uses them (user:matrix.org), and Bluesky"
  echo "    even lets you use your domain as your username."
  echo ""
  echo "    Some ideas:"
  echo -e "    ${CYAN}pixelart${NC}.duckdns.org    — for an art community"
  echo -e "    ${CYAN}cozychat${NC}.duckdns.org    — for a chill hangout"
  echo -e "    ${CYAN}devlounge${NC}.duckdns.org   — for a coding group"
  echo -e "    ${CYAN}squad42${NC}.duckdns.org     — for your friend group"
  echo -e "    ${CYAN}bookclub${NC}.duckdns.org    — for a shared interest"
  echo ""
  echo "    Tips: keep it short, memorable, and something that"
  echo "    represents your community. Avoid numbers and hyphens."
  echo ""
  echo -e "  ${DIM}  ─────────────────────────────────────────────────────${NC}"
  echo ""
  echo -e "    ${BOLD}What you get with a domain:${NC}"
  echo -e "    ${GREEN}✓${NC} Your guilds appear in Gratonite Discover"
  echo -e "    ${GREEN}✓${NC} Anyone can find and join your community"
  echo -e "    ${GREEN}✓${NC} \"Login with Gratonite\" — one-click sign in"
  echo -e "    ${GREEN}✓${NC} Automatic HTTPS (secure connection)"
  echo -e "    ${GREEN}✓${NC} Part of the federated Gratonite network"
  echo ""
  echo -e "  ${DIM}  ─────────────────────────────────────────────────────${NC}"
  echo ""
  echo "    Setting it up takes about 2 minutes:"
  echo -e "    1. Open ${BOLD}duckdns.org${NC} in your browser"
  echo "    2. Click a sign-in button (GitHub, Google, Reddit, etc.)"
  echo "    3. Type the name you want in the box"
  echo "    4. Click \"add domain\" — it auto-detects your IP"
  echo "    5. Come back here and type your new name in"
  echo ""
  echo -e "  ${DIM}  ─────────────────────────────────────────────────────${NC}"
  echo ""
  echo -e "    ${DIM}Want to buy a custom domain instead? (optional)${NC}"
  echo -e "    ${DIM}• Porkbun — what Gratonite.chat uses (\$9/yr)${NC}"
  echo -e "    ${DIM}• Namecheap — .xyz from \$1/yr${NC}"
  echo -e "    ${DIM}• Cloudflare Registrar — at cost, no markup${NC}"
  echo ""
  echo -e "  ${DIM}  ─────────────────────────────────────────────────────${NC}"
  echo ""
  echo -e "    ${DIM}Don't want to be in Discover? Just want a private server"
  echo -e "    for friends? Pick option 1 (local mode) instead — you can"
  echo -e "    always add a domain later to join the network.${NC}"
  echo ""
  echo -e "  ${DIM}  ─────────────────────────────────────────────────────${NC}"
  echo ""
  echo -e "    ${BOLD}Ready to set up DuckDNS?${NC}"
  echo ""
  echo -e "      ${BOLD}y)${NC} Yes — I'll go grab my free DuckDNS name now"
  echo -e "      ${BOLD}n)${NC} No — just install locally, I'll add a domain later"
  echo ""
  prompt -rp "    [y/n]: " DUCKDNS_CHOICE

  case "${DUCKDNS_CHOICE:-y}" in
    y|Y|yes|Yes)
      echo ""
      echo -e "    ${GREEN}${BOLD}Let's do it!${NC}"
      echo ""
      echo "    Go set up your DuckDNS name now — here are the steps:"
      echo ""
      echo -e "      1. Open ${BOLD}https://duckdns.org${NC} in your browser"
      echo "      2. Sign in with GitHub, Google, or another account"
      echo "      3. In the box at the top, type a name you like"
      echo "         (this becomes your-name.duckdns.org)"
      echo "      4. Click \"add domain\""
      echo "      5. You'll see your IP address filled in automatically"
      echo "      6. Come back to this terminal and type your name below"
      echo ""
      echo -e "    ${DIM}(This window will wait for you — take your time!)${NC}"
      echo ""
      MODE="server"
      ;;
    *)
      echo ""
      info "Installing in local mode. You can add a domain anytime to join the network."
      echo ""
      echo "    When you're ready, just re-run the installer:"
      echo -e "      ${BOLD}curl -fsSL https://gratonite.chat/install | bash${NC}"
      echo "    Pick option 2 and enter your domain. Your data will be kept."
      echo ""
      MODE="local"
      ;;
  esac
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
  echo -e "    ${BOLD}How will people find your server?${NC}"
  echo ""
  echo -e "      ${BOLD}1)${NC} ${GREEN}Just me for now${NC}  — try it out on this computer"
  echo -e "         ${DIM}Quick start, but your server won't be in Discover${NC}"
  echo ""
  echo -e "      ${BOLD}2)${NC} ${CYAN}I have a domain${NC}  — e.g. chat.example.com"
  echo -e "         ${DIM}Full setup: Discover, HTTPS, Login with Gratonite${NC}"
  echo ""
  echo -e "      ${BOLD}3)${NC} ${PURPLE}I need a domain${NC}  — help me get one (free, 2 min)"
  echo -e "         ${DIM}We'll walk you through it step by step${NC}"
  echo ""
  prompt -rp "    Pick one [1/2/3]: " MODE_CHOICE
  echo ""

  case "${MODE_CHOICE:-1}" in
    1) MODE="local" ;;
    2) MODE="server" ;;
    3) show_sharing_guide ;;
    *) fail "Invalid choice. Run the script again." ;;
  esac
}

# ─── Collect Config ──────────────────────────────────────────────────
collect_config() {
  step "Setting up your instance"
  if [ "$MODE" = "server" ]; then

    # Brief domain reminder for users who already have one
    echo ""
    echo -e "    ${DIM}Don't have a domain yet? Here are some options:${NC}"
    echo -e "    ${DIM}• Free: ${BOLD}duckdns.org${NC}${DIM} — pick a name like mychat.duckdns.org${NC}"
    echo -e "    ${DIM}• Paid: ${BOLD}porkbun.com${NC}${DIM} — what Gratonite.chat uses (\$9/yr)${NC}"
    echo -e "    ${DIM}• Paid: ${BOLD}namecheap.com${NC}${DIM} — .xyz domains from \$1/yr${NC}"
    echo -e "    ${DIM}• Paid: ${BOLD}cloudflare.com/products/registrar${NC}${DIM} — at cost, no markup${NC}"
    echo -e "    ${DIM}Point your domain to this server's IP with a DNS A record.${NC}"
    echo ""

    prompt -rp "    Domain name (e.g. mychat.duckdns.org): " DOMAIN
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
  REDIS_PASSWORD="$(openssl rand -hex 16)"
  JWT_SECRET="$(openssl rand -base64 48)"
  JWT_REFRESH_SECRET="$(openssl rand -base64 48)"
  MFA_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  BULLBOARD_ADMIN_TOKEN="$(openssl rand -hex 32)"
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
  if curl -fsSL "$GITHUB_RAW/deploy/self-host/collect-logs.sh" -o collect-logs.sh; then
    chmod +x collect-logs.sh || true
  else
    warn "Could not download collect-logs.sh (optional)."
  fi
  if ! curl -fsSL "$GITHUB_RAW/deploy/self-host/collect-logs.ps1" -o collect-logs.ps1; then
    warn "Could not download collect-logs.ps1 (optional)."
  fi

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
REDIS_PASSWORD=$REDIS_PASSWORD
DB_NAME=gratonite

JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
MFA_ENCRYPTION_KEY=$MFA_ENCRYPTION_KEY
BULLBOARD_ADMIN_TOKEN=$BULLBOARD_ADMIN_TOKEN

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
        echo "      To generate a full support bundle:"
        echo "        cd $INSTALL_DIR && bash ./collect-logs.sh"
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
        echo "      To generate a full support bundle: cd $INSTALL_DIR && bash ./collect-logs.sh"
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

  if [ "$MODE" = "server" ]; then
    echo ""
    echo -e "    ${BOLD}Login with Gratonite:${NC} ${GREEN}Active${NC}"
    echo "    Users with gratonite.chat accounts can log into your"
    echo "    instance with one click — no separate registration needed."
  else
    echo ""
    echo -e "    ${BOLD}Login with Gratonite:${NC} ${YELLOW}Requires a domain${NC}"
    echo "    To let gratonite.chat users log into your instance,"
    echo "    reinstall with a domain (option 2) so the login"
    echo "    callback can reach your server."
  fi

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
  echo "      bash ./collect-logs.sh                    # Collect support bundle"
  echo "      pwsh ./collect-logs.ps1                   # Support bundle on PowerShell"
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
