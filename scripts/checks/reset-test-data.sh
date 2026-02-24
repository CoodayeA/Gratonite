#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--yes" ]]; then
  echo "This will reset local test data in Docker PostgreSQL (database: gratonite)."
  echo "Re-run with: ./scripts/checks/reset-test-data.sh --yes"
  exit 1
fi

echo "[reset:test-data] Starting local services"
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "[reset:test-data] Neither 'docker compose' nor 'docker-compose' is available"
  exit 1
fi

"${COMPOSE_CMD[@]}" up -d postgres redis minio livekit coturn

echo "[reset:test-data] Waiting for PostgreSQL"
for i in {1..30}; do
  if "${COMPOSE_CMD[@]}" exec -T postgres pg_isready -U gratonite >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! "${COMPOSE_CMD[@]}" exec -T postgres pg_isready -U gratonite >/dev/null 2>&1; then
  echo "[reset:test-data] PostgreSQL did not become ready in time"
  exit 1
fi

echo "[reset:test-data] Resetting schema"
"${COMPOSE_CMD[@]}" exec -T postgres psql -U gratonite -d gratonite -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;"

echo "[reset:test-data] Running migrations"
pnpm --filter @gratonite/db migrate

echo "[reset:test-data] Done"
