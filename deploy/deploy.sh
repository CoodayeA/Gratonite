#!/bin/bash
set -euo pipefail

echo "🚀 Gratonite Deployment Script"
echo "================================"

# Configuration — set these env vars before running:
#   SERVER=<host> USER=<ssh-user> SSH_KEY=<path> ./deploy/deploy.sh
if [[ -z "${SERVER:-}" ]]; then
  echo "❌ SERVER env var is required (for example: SERVER=203.0.113.10)"
  exit 1
fi

if [[ -z "${USER:-}" ]]; then
  echo "❌ USER env var is required (for example: USER=deploy)"
  exit 1
fi

if [[ -z "${SSH_KEY:-}" ]]; then
  echo "❌ SSH_KEY env var is required (path to SSH private key)"
  exit 1
fi

SSH_KEY="${SSH_KEY}"
REMOTE_DIR="${REMOTE_DIR:-/home/$USER/gratonite-app}"
API_HEALTH_URL="${API_HEALTH_URL:-https://api.gratonite.chat/health}"
LANDING_BASE_URL="${LANDING_BASE_URL:-https://gratonite.chat/}"
APP_BASE_URL="${APP_BASE_URL:-https://gratonite.chat/app/}"
RELEASES_URL="${RELEASES_URL:-https://gratonite.chat/releases}"
SERVICE_WORKER_URL="${SERVICE_WORKER_URL:-https://gratonite.chat/app/sw.js}"
WEB_MANIFEST_URL="${WEB_MANIFEST_URL:-https://gratonite.chat/app/manifest.json}"
CURRENT_STEP="initial checks"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "❌ SSH key not found: $SSH_KEY"
  exit 1
fi

print_remote_diagnostics() {
  echo ""
  echo "📋 Remote diagnostics (best effort)"
  ssh -i "$SSH_KEY" "$USER@$SERVER" "REMOTE_DIR='$REMOTE_DIR' bash -s" << 'ENDSSH' || true
set -euo pipefail
cd "$REMOTE_DIR"
echo "--- docker compose ps ---"
docker compose -f docker-compose.production.yml ps || true
echo ""
echo "--- gratonite-api (tail 80) ---"
docker logs --tail 80 gratonite-api || true
echo ""
echo "--- gratonite-web (tail 80) ---"
docker logs --tail 80 gratonite-web || true
echo ""
echo "--- gratonite-caddy (tail 80) ---"
docker logs --tail 80 gratonite-caddy || true
ENDSSH
}

print_rollback_guidance() {
  cat <<EOF

↩️  Rollback guidance
1. Check the failing service in the diagnostics above (`docker compose ps`, API/web/Caddy logs).
2. If user-facing surfaces are still broken, redeploy a known-good commit:
   git checkout <known-good-commit>
   SERVER=$SERVER USER=$USER SSH_KEY=$SSH_KEY bash deploy/deploy.sh
3. Re-verify:
   - $API_HEALTH_URL
   - $LANDING_BASE_URL
   - $APP_BASE_URL
   - $RELEASES_URL
4. Follow docs/launch/ROLLBACK_RUNBOOK.md and docs/DEPLOY-TO-OWN-SERVER.md for the full playbook.
EOF
}

on_error() {
  local exit_code=$?
  echo ""
  echo "❌ Deployment failed during: $CURRENT_STEP"
  if [[ "$CURRENT_STEP" == remote* || "$CURRENT_STEP" == public* || "$CURRENT_STEP" == health* ]]; then
    print_remote_diagnostics
  fi
  print_rollback_guidance
  exit "$exit_code"
}

trap on_error ERR

echo ""
echo "🧪 Step 1: Verifying release prerequisites..."
CURRENT_STEP="local release verification"
cd "$(dirname "$0")/.."

pnpm verify:deploy:artifacts
pnpm --filter gratonite-api run guard:placeholders
pnpm --filter gratonite-web run guard:placeholders

echo "✅ Release prerequisites passed!"

echo ""
echo "📦 Step 2: Building application locally..."
CURRENT_STEP="local build"

# Install from repo root with filters to avoid EPERM on the Electron binary in
# apps/desktop when running pnpm install inside a workspace subdirectory.
pnpm install --filter gratonite-api... --filter gratonite-web... --filter @gratonite/landing...

# Build backend
echo "  Building backend..."
cd apps/api
pnpm run build
cd ../..

# Build frontend
echo "  Building frontend..."
cd apps/web
pnpm run build:vite
pnpm run validate:sw-precache
cd ../..

# Build landing page
echo "  Building landing page..."
cd apps/landing
pnpm run build
cd ../..

echo "✅ Build complete!"

echo ""
echo "📤 Step 3: Creating deployment package..."
CURRENT_STEP="local packaging"
rm -rf deploy/api deploy/web/dist deploy/landing
mkdir -p deploy/api deploy/web/dist deploy/landing

# Copy backend files
cp -r apps/api/dist deploy/api/
cp -r apps/api/drizzle deploy/api/
cp apps/api/package.json deploy/api/
cp apps/api/pnpm-lock.yaml deploy/api/
cp apps/api/drizzle.config.ts deploy/api/

# Copy frontend build
cp -r apps/web/dist/* deploy/web/dist/

# Copy landing page build
cp -r apps/landing/out/* deploy/landing/

echo "✅ Package created!"

echo ""
echo "📡 Step 4: Uploading to server..."
CURRENT_STEP="remote upload"
ssh -i "$SSH_KEY" "$USER@$SERVER" "mkdir -p '$REMOTE_DIR'"

# Protect server-only env files from deletion/overwrite.
rsync -avz --progress --delete \
  --filter='P .env' \
  --filter='P .env.*' \
  --filter='P api/.pnpm-store' \
  --filter='P api/node_modules' \
  -e "ssh -i $SSH_KEY" \
  deploy/ "$USER@$SERVER:$REMOTE_DIR/"

echo "✅ Upload complete!"

echo ""
echo "🛡️  Step 5: Remote preflight checks..."
CURRENT_STEP="remote preflight"
ssh -i "$SSH_KEY" "$USER@$SERVER" "REMOTE_DIR='$REMOTE_DIR' bash -s" << 'ENDSSH'
set -euo pipefail
cd "$REMOTE_DIR"

set_env() {
  key="$1"
  value="$2"
  tmp_file=".env.update.$$"
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

redis_password="$(grep -E '^REDIS_PASSWORD=' .env | head -n1 | cut -d= -f2- || true)"
if [[ -z "$redis_password" ]]; then
  redis_password="$(openssl rand -hex 32)"
  set_env REDIS_PASSWORD "$redis_password"
  echo "ℹ️  Generated REDIS_PASSWORD in server .env"
fi

missing=""
for k in DB_PASSWORD REDIS_PASSWORD JWT_SECRET JWT_REFRESH_SECRET BULLBOARD_ADMIN_TOKEN MFA_ENCRYPTION_KEY APP_URL CORS_ORIGIN; do
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
echo "🐳 Step 6: Restarting containers on server..."
CURRENT_STEP="remote restart"
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
echo "🔍 Step 7: Release verification..."
CURRENT_STEP="health checks"
for i in {1..20}; do
  code="$(curl -sS -m 10 -o /dev/null -w "%{http_code}" "$API_HEALTH_URL" || true)"
  if [[ "$code" == "200" ]]; then
    echo "✅ API health check passed: $API_HEALTH_URL"
    break
  fi
  if [[ "$i" == "20" ]]; then
    echo "❌ API health check failed after deploy: $API_HEALTH_URL"
    exit 1
  fi
  echo "  Waiting for API health... (attempt $i/20, status=${code:-n/a})"
  sleep 3
done

CURRENT_STEP="public release verification"
API_HEALTH_URL="$API_HEALTH_URL" \
LANDING_BASE_URL="$LANDING_BASE_URL" \
APP_BASE_URL="$APP_BASE_URL" \
RELEASES_URL="$RELEASES_URL" \
SERVICE_WORKER_URL="$SERVICE_WORKER_URL" \
WEB_MANIFEST_URL="$WEB_MANIFEST_URL" \
node tools/verify-release-surfaces.mjs

trap - ERR

echo ""
echo "🎉 Deployment successful!"
echo ""
