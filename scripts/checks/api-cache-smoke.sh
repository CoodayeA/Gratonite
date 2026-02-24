#!/usr/bin/env bash
set -euo pipefail

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "[api-cache:smoke] Neither 'docker compose' nor 'docker-compose' is available"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_LOG="/tmp/gratonite-api-smoke.log"
REG_JSON="/tmp/gratonite-register.json"
GUILD_JSON="/tmp/gratonite-guild.json"
CHANNEL_JSON="/tmp/gratonite-channel.json"
API_PID=""
API_PORT="${API_PORT:-4010}"

cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR"

echo "[api-cache:smoke] Ensuring Docker services are up"
"${COMPOSE_CMD[@]}" up -d postgres redis minio livekit coturn >/dev/null

echo "[api-cache:smoke] Resetting DB schema"
pnpm test:reset >/dev/null

echo "[api-cache:smoke] Flushing Redis"
"${COMPOSE_CMD[@]}" exec -T redis redis-cli FLUSHALL >/dev/null

echo "[api-cache:smoke] Starting API"
: > "$API_LOG"
PORT="$API_PORT" pnpm --filter @gratonite/api exec node --import tsx src/index.ts > "$API_LOG" 2>&1 &
API_PID=$!

for i in {1..60}; do
  if ! kill -0 "$API_PID" >/dev/null 2>&1; then
    break
  fi
  if curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! kill -0 "$API_PID" >/dev/null 2>&1; then
  echo "[api-cache:smoke] Spawned API process exited unexpectedly"
  tail -n 120 "$API_LOG" || true
  exit 1
fi

if ! curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
  echo "[api-cache:smoke] API failed to start"
  tail -n 120 "$API_LOG" || true
  exit 1
fi

SUFFIX="$(date +%s)$RANDOM"
EMAIL="cache_smoke_${SUFFIX}@example.com"
USERNAME="cachesmoke${SUFFIX}"
DISPLAY="Cache Smoke ${SUFFIX}"
PASSWORD="Passw0rd123"

cat > /tmp/gratonite-register-payload.json <<JSON
{
  "email": "${EMAIL}",
  "username": "${USERNAME}",
  "displayName": "${DISPLAY}",
  "password": "${PASSWORD}",
  "dateOfBirth": "1990-01-01"
}
JSON

echo "[api-cache:smoke] Registering user"
curl -fsS -X POST "http://127.0.0.1:${API_PORT}/api/v1/auth/register" \
  -H 'content-type: application/json' \
  --data-binary @/tmp/gratonite-register-payload.json > "$REG_JSON"

ACCESS_TOKEN="$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(j.accessToken||'')" "$REG_JSON")"
USER_ID="$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(j.user?.id||'')" "$REG_JSON")"

if [[ -z "$ACCESS_TOKEN" || -z "$USER_ID" ]]; then
  echo "[api-cache:smoke] Failed to get access token/user id"
  cat "$REG_JSON"
  exit 1
fi

echo "[api-cache:smoke] Creating guild + channel"
curl -fsS -X POST "http://127.0.0.1:${API_PORT}/api/v1/guilds" \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  --data-binary '{"name":"Cache Smoke Guild"}' > "$GUILD_JSON"

GUILD_ID="$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(j.id||'')" "$GUILD_JSON")"

curl -fsS -X POST "http://127.0.0.1:${API_PORT}/api/v1/guilds/${GUILD_ID}/channels" \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  --data-binary '{"type":"GUILD_TEXT","name":"cache-channel"}' > "$CHANNEL_JSON"

CHANNEL_ID="$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(j.id||'')" "$CHANNEL_JSON")"

if [[ -z "$GUILD_ID" || -z "$CHANNEL_ID" ]]; then
  echo "[api-cache:smoke] Failed to create guild/channel"
  cat "$GUILD_JSON" || true
  cat "$CHANNEL_JSON" || true
  exit 1
fi

echo "[api-cache:smoke] Priming cache via repeated reads"
api_get() {
  local url="$1"
  local retries=0
  while true; do
    local status
    status="$(curl -sS -o /tmp/gratonite-api-smoke-response.json -w '%{http_code}' \
      "$url" -H "authorization: Bearer $ACCESS_TOKEN")"
    if [[ "$status" == "200" ]]; then
      return 0
    fi
    if [[ "$status" == "429" && "$retries" -lt 5 ]]; then
      retries=$((retries + 1))
      sleep 0.2
      continue
    fi
    echo "[api-cache:smoke] GET $url failed with status $status"
    cat /tmp/gratonite-api-smoke-response.json || true
    return 1
  done
}

for i in {1..120}; do
  api_get "http://127.0.0.1:${API_PORT}/api/v1/guilds/@me"
  sleep 0.03
  api_get "http://127.0.0.1:${API_PORT}/api/v1/guilds/${GUILD_ID}"
  sleep 0.03
  api_get "http://127.0.0.1:${API_PORT}/api/v1/guilds/${GUILD_ID}/members"
  sleep 0.03
  api_get "http://127.0.0.1:${API_PORT}/api/v1/guilds/${GUILD_ID}/channels"
  sleep 0.03
  api_get "http://127.0.0.1:${API_PORT}/api/v1/channels/${CHANNEL_ID}"
  sleep 0.03
done

exists_key() {
  local key="$1"
  local exists
  exists="$("${COMPOSE_CMD[@]}" exec -T redis redis-cli EXISTS "$key" | tr -d '\r')"
  if [[ "$exists" != "1" ]]; then
    echo "[api-cache:smoke] Missing expected cache key: $key"
    return 1
  fi
}

exists_pattern() {
  local pattern="$1"
  local keys
  keys="$("${COMPOSE_CMD[@]}" exec -T redis redis-cli KEYS "$pattern" | tr -d '\r')"
  if [[ -z "$keys" ]]; then
    echo "[api-cache:smoke] Missing expected cache key pattern: $pattern"
    return 1
  fi
}

echo "[api-cache:smoke] Verifying Redis keys"
exists_pattern "user:*:guilds"
exists_key "guild:${GUILD_ID}:meta"
exists_key "guild:${GUILD_ID}:channels"
exists_key "guild:${GUILD_ID}:members:100:start"
exists_key "channel:${CHANNEL_ID}:meta"

echo "[api-cache:smoke] Verifying cache stats logs"
if ! grep -n "Cache stats" "$API_LOG" >/dev/null 2>&1; then
  echo "[api-cache:smoke] Expected 'Cache stats' logs were not found"
  tail -n 120 "$API_LOG" || true
  exit 1
fi

echo "[api-cache:smoke] PASS"
