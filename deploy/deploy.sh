#!/bin/bash
set -euo pipefail

echo "🚀 Gratonite Deployment Script"
echo "================================"

# Configuration (override: SERVER, USER, SSH_KEY)
SERVER="${SERVER:-178.156.253.237}"
USER="${USER:-ferdinand}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hetzner_key_new}"
REMOTE_DIR="${REMOTE_DIR:-/home/$USER/gratonite-app}"
API_HEALTH_URL="${API_HEALTH_URL:-https://api.gratonite.chat/health}"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "❌ SSH key not found: $SSH_KEY"
  exit 1
fi

echo ""
echo "📦 Step 1: Building application locally..."
cd "$(dirname "$0")/.."

# Install from repo root with filters to avoid EPERM on the Electron binary in
# apps/desktop when running pnpm install inside a workspace subdirectory.
pnpm install --filter gratonite-api... --filter gratonite-web...

# Build backend
echo "  Building backend..."
cd apps/api
pnpm run build
cd ../..

# Build frontend
echo "  Building frontend..."
cd apps/web
pnpm run build:vite
cd ../..

echo "✅ Build complete!"

echo ""
echo "📤 Step 2: Creating deployment package..."
rm -rf deploy/api deploy/web/dist
mkdir -p deploy/api deploy/web/dist

# Copy backend files
cp -r apps/api/dist deploy/api/
cp -r apps/api/drizzle deploy/api/
cp apps/api/package.json deploy/api/
cp apps/api/pnpm-lock.yaml deploy/api/
cp apps/api/drizzle.config.ts deploy/api/

# Copy frontend build
cp -r apps/web/dist/* deploy/web/dist/

echo "✅ Package created!"

echo ""
echo "📡 Step 3: Uploading to server..."
ssh -i "$SSH_KEY" "$USER@$SERVER" "mkdir -p '$REMOTE_DIR'"

# Protect server-only env files from deletion/overwrite.
rsync -avz --progress --delete \
  --filter='P .env' \
  --filter='P .env.*' \
  -e "ssh -i $SSH_KEY" \
  deploy/ "$USER@$SERVER:$REMOTE_DIR/"

echo "✅ Upload complete!"

echo ""
echo "🛡️  Step 4: Remote preflight checks..."
ssh -i "$SSH_KEY" "$USER@$SERVER" "REMOTE_DIR='$REMOTE_DIR' bash -s" << 'ENDSSH'
set -euo pipefail
cd "$REMOTE_DIR"

set_env() {
  key="$1"
  value="$2"
  tmp_file="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { done = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      done = 1
      next
    }
    { print }
    END {
      if (!done) {
        print key "=" value
      }
    }
  ' .env > "$tmp_file"
  mv "$tmp_file" .env
}

if [[ ! -f .env ]]; then
  echo "❌ Missing $REMOTE_DIR/.env. Aborting deploy before container restart."
  exit 1
fi

missing=""
for k in DB_PASSWORD JWT_SECRET JWT_REFRESH_SECRET BULLBOARD_ADMIN_TOKEN MFA_ENCRYPTION_KEY APP_URL CORS_ORIGIN; do
  v="$(grep -E "^${k}=" .env | head -n1 | cut -d= -f2- || true)"
  if [[ -z "$v" ]]; then
    missing="$missing $k"
  fi
done

if [[ -n "$missing" ]]; then
  echo "❌ Missing required .env values:$missing"
  exit 1
fi

jwt="$(grep -E '^JWT_SECRET=' .env | head -n1 | cut -d= -f2-)"
jwt_refresh="$(grep -E '^JWT_REFRESH_SECRET=' .env | head -n1 | cut -d= -f2-)"
if [[ "${#jwt}" -lt 32 || "${#jwt_refresh}" -lt 32 ]]; then
  echo "❌ JWT secrets must be at least 32 chars."
  exit 1
fi
if [[ "$jwt" == "$jwt_refresh" ]]; then
  echo "❌ JWT_SECRET and JWT_REFRESH_SECRET must be different."
  exit 1
fi

if ! grep -q 'BULLBOARD_ADMIN_TOKEN:' docker-compose.production.yml; then
  echo "❌ docker-compose.production.yml missing BULLBOARD_ADMIN_TOKEN env passthrough."
  exit 1
fi

if docker ps --format '{{.Names}} {{.Ports}}' | grep -q '^gratonite-caddy-1 .*0.0.0.0:80->'; then
  echo "❌ Legacy public proxy gratonite-caddy-1 is still running on 80/443."
  echo "   Clean up the old public Caddy before using the canonical compose-managed proxy."
  exit 1
fi

livekit_url="$(grep -E '^LIVEKIT_URL=' .env | head -n1 | cut -d= -f2- || true)"
livekit_key="$(grep -E '^LIVEKIT_API_KEY=' .env | head -n1 | cut -d= -f2- || true)"
livekit_secret="$(grep -E '^LIVEKIT_API_SECRET=' .env | head -n1 | cut -d= -f2- || true)"
app_url="$(grep -E '^APP_URL=' .env | head -n1 | cut -d= -f2- || true)"

if [[ -z "$livekit_key" ]]; then
  livekit_key="gratonite_$(openssl rand -hex 6)"
  set_env LIVEKIT_API_KEY "$livekit_key"
  echo "ℹ️  Generated LIVEKIT_API_KEY in server .env"
fi

if [[ -z "$livekit_secret" ]]; then
  livekit_secret="$(openssl rand -base64 32 | tr -d '\n')"
  set_env LIVEKIT_API_SECRET "$livekit_secret"
  echo "ℹ️  Generated LIVEKIT_API_SECRET in server .env"
fi

if [[ -z "$livekit_url" ]]; then
  app_host="${app_url#*://}"
  app_host="${app_host%%/*}"
  base_host="$app_host"
  if [[ "$base_host" == app.* ]]; then
    base_host="${base_host#app.}"
  fi
  livekit_url="wss://api.${base_host}"
  set_env LIVEKIT_URL "$livekit_url"
  echo "ℹ️  Set LIVEKIT_URL=$livekit_url in server .env"
fi

echo "✅ Preflight checks passed."
ENDSSH

echo ""
echo "🐳 Step 5: Restarting containers on server..."
ssh -i "$SSH_KEY" "$USER@$SERVER" "REMOTE_DIR='$REMOTE_DIR' bash -s" << 'ENDSSH'
set -euo pipefail
cd "$REMOTE_DIR"

# Recreate app services, including the canonical public proxy and LiveKit.
docker compose -f docker-compose.production.yml up -d --force-recreate api web caddy livekit

# API entrypoint runs pnpm install --prod before node; wait so migrate does not race.
echo "Waiting for API dependencies inside container..."
for _ in $(seq 1 90); do
  if docker exec gratonite-api test -f /app/node_modules/dotenv/package.json 2>/dev/null; then
    break
  fi
  sleep 2
done
if ! docker exec gratonite-api test -f /app/node_modules/dotenv/package.json 2>/dev/null; then
  echo "Timed out waiting for pnpm install in gratonite-api."
  exit 1
fi

# Run any new database migrations
echo "Running database migrations..."
docker exec gratonite-api sh -c "cd /app && node dist/db/migrate.js"

# Check container status
docker compose -f docker-compose.production.yml ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Live at:"
echo "   - https://gratonite.chat"
echo "   - https://app.gratonite.chat"
echo "   - https://api.gratonite.chat"
echo ""
echo "📊 To view logs:"
echo "   docker logs -f gratonite-api"
echo "   docker logs -f gratonite-web"
echo ""
ENDSSH

echo ""
echo "🔍 Step 6: Health check..."
for i in {1..20}; do
  code="$(curl -sS -m 10 -o /dev/null -w "%{http_code}" "$API_HEALTH_URL" || true)"
  if [[ "$code" == "200" ]]; then
    echo "✅ API health check passed: $API_HEALTH_URL"
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    exit 0
  fi
  echo "  Waiting for API health... (attempt $i/20, status=${code:-n/a})"
  sleep 3
done

echo "❌ API health check failed after deploy: $API_HEALTH_URL"
exit 1
