#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_BASE_URL="${API_BASE_URL:-https://api.gratonite.chat}"
APP_BASE_URL="${APP_BASE_URL:-https://gratonite.chat}"

echo "== Web Routes =="
for path in /app /notifications /settings /discover; do
  printf '%s%s -> ' "$APP_BASE_URL" "$path"
  curl -sk -o /dev/null -w "%{http_code}\n" "${APP_BASE_URL}${path}"
done

echo
echo "== API Health =="
curl -sk "${API_BASE_URL}/health"
echo

echo
echo "== API Prod Smoke =="
API_BASE_URL="$API_BASE_URL" "$ROOT_DIR/scripts/checks/api-prod-smoke.sh"

echo
echo "== API Contract Smoke =="
API_BASE_URL="$API_BASE_URL" "$ROOT_DIR/scripts/checks/api-contract-smoke.sh"

echo
echo "== Complete =="
