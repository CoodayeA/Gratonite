#!/usr/bin/env bash
set -euo pipefail

# Production-oriented API smoke checks.
# Usage:
#   API_BASE_URL="https://api.example.com" ./scripts/checks/api-prod-smoke.sh

API_BASE_URL="${API_BASE_URL:-}"
if [[ -z "$API_BASE_URL" ]]; then
  echo "[api-prod-smoke] API_BASE_URL is required, e.g. https://api.example.com" >&2
  exit 1
fi

API_BASE_URL="${API_BASE_URL%/}"
HEALTH_URL="$API_BASE_URL/health"
REGISTER_URL="$API_BASE_URL/api/v1/auth/register"

TMP_EMAIL="smoke.$(date +%s)@example.test"
TMP_USER="smoke$(date +%s)"
TMP_PASS="TestPass123!"

echo "[api-prod-smoke] checking health: $HEALTH_URL"
curl -fsS "$HEALTH_URL" >/dev/null

echo "[api-prod-smoke] checking registration path: $REGISTER_URL"
STATUS=$(curl -sS -o /tmp/gratonite_api_smoke_register.json -w "%{http_code}" \
  -H 'content-type: application/json' \
  -X POST "$REGISTER_URL" \
  --data "{\"email\":\"$TMP_EMAIL\",\"username\":\"$TMP_USER\",\"displayName\":\"Smoke User\",\"password\":\"$TMP_PASS\",\"dateOfBirth\":\"2000-01-01\"}")

if [[ "$STATUS" != "200" && "$STATUS" != "201" && "$STATUS" != "409" ]]; then
  echo "[api-prod-smoke] registration failed with status=$STATUS" >&2
  cat /tmp/gratonite_api_smoke_register.json >&2 || true
  exit 1
fi

echo "[api-prod-smoke] OK"
