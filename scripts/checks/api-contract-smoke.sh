#!/usr/bin/env bash
set -euo pipefail

# API contract smoke checks for beta blockers (DM + attachment contracts).
# Usage:
#   API_BASE_URL="http://127.0.0.1:4000" ./scripts/checks/api-contract-smoke.sh

API_BASE_URL="${API_BASE_URL:-}"
if [[ -z "$API_BASE_URL" ]]; then
  echo "[api-contract-smoke] API_BASE_URL is required, e.g. http://127.0.0.1:4000" >&2
  exit 1
fi

API_BASE_URL="${API_BASE_URL%/}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

json_field() {
  local file="$1"
  local expr="$2"
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const v=${expr};if(v===undefined||v===null){process.exit(2)}process.stdout.write(String(v));" "$file"
}

call_json() {
  local method="$1"
  local url="$2"
  local out="$3"
  local auth="${4:-}"
  local body="${5:-}"

  local -a args=( -sS -o "$out" -w "%{http_code}" -X "$method" "$url" )
  if [[ -n "$auth" ]]; then
    args+=( -H "authorization: Bearer $auth" )
  fi

  if [[ -n "$body" ]]; then
    args+=( -H 'content-type: application/json' --data "$body" )
  fi

  curl "${args[@]}"
}

echo "[api-contract-smoke] health"
curl -fsS "$API_BASE_URL/health" >/dev/null

USER_A="contracta$(date +%s)"
USER_B="contractb$(date +%s)"
PASS='TestPass123!'

REG_A_JSON="$TMP_DIR/reg_a.json"
REG_A_STATUS=$(call_json POST "$API_BASE_URL/api/v1/auth/register" "$REG_A_JSON" "" "{\"email\":\"$USER_A@example.test\",\"username\":\"$USER_A\",\"displayName\":\"$USER_A\",\"password\":\"$PASS\",\"dateOfBirth\":\"2000-01-01\"}")
if [[ "$REG_A_STATUS" != "200" && "$REG_A_STATUS" != "201" ]]; then
  echo "[api-contract-smoke] register A failed: $REG_A_STATUS" >&2
  cat "$REG_A_JSON" >&2 || true
  exit 1
fi
TOKEN_A="$(json_field "$REG_A_JSON" 'd.accessToken')"
USER_A_ID="$(json_field "$REG_A_JSON" 'd.user.id')"

REG_B_JSON="$TMP_DIR/reg_b.json"
REG_B_STATUS=$(call_json POST "$API_BASE_URL/api/v1/auth/register" "$REG_B_JSON" "" "{\"email\":\"$USER_B@example.test\",\"username\":\"$USER_B\",\"displayName\":\"$USER_B\",\"password\":\"$PASS\",\"dateOfBirth\":\"2000-01-01\"}")
if [[ "$REG_B_STATUS" != "200" && "$REG_B_STATUS" != "201" ]]; then
  echo "[api-contract-smoke] register B failed: $REG_B_STATUS" >&2
  cat "$REG_B_JSON" >&2 || true
  exit 1
fi
TOKEN_B="$(json_field "$REG_B_JSON" 'd.accessToken')"
USER_B_ID="$(json_field "$REG_B_JSON" 'd.user.id')"

echo "[api-contract-smoke] open DM"
DM_JSON="$TMP_DIR/dm.json"
DM_STATUS=$(call_json POST "$API_BASE_URL/api/v1/relationships/channels" "$DM_JSON" "$TOKEN_A" "{\"userId\":\"$USER_B_ID\"}")
if [[ "$DM_STATUS" != "200" && "$DM_STATUS" != "201" ]]; then
  echo "[api-contract-smoke] open DM failed: $DM_STATUS" >&2
  cat "$DM_JSON" >&2 || true
  exit 1
fi
DM_ID="$(json_field "$DM_JSON" 'd.id')"

MESSAGE_TEXT="contract-message-$(date +%s)"
NONCE_TEXT="nonce-$(date +%s)-$RANDOM"

echo "[api-contract-smoke] send DM message"
SEND_JSON="$TMP_DIR/send.json"
SEND_STATUS=$(call_json POST "$API_BASE_URL/api/v1/channels/$DM_ID/messages" "$SEND_JSON" "$TOKEN_A" "{\"content\":\"$MESSAGE_TEXT\",\"nonce\":\"$NONCE_TEXT\"}")
if [[ "$SEND_STATUS" != "200" && "$SEND_STATUS" != "201" ]]; then
  echo "[api-contract-smoke] send DM message failed: $SEND_STATUS" >&2
  cat "$SEND_JSON" >&2 || true
  exit 1
fi

LIST_JSON="$TMP_DIR/list.json"
LIST_STATUS=$(call_json GET "$API_BASE_URL/api/v1/channels/$DM_ID/messages?limit=25" "$LIST_JSON" "$TOKEN_B")
if [[ "$LIST_STATUS" != "200" ]]; then
  echo "[api-contract-smoke] list DM messages failed: $LIST_STATUS" >&2
  cat "$LIST_JSON" >&2 || true
  exit 1
fi
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!Array.isArray(d)||!d.some(m=>m.content===process.argv[2])){console.error('message content not found');process.exit(1)}" "$LIST_JSON" "$MESSAGE_TEXT"

ATTACH_FILE="$TMP_DIR/attachment.txt"
printf 'contract attachment payload\n' > "$ATTACH_FILE"

echo "[api-contract-smoke] upload attachment"
UPLOAD_JSON="$TMP_DIR/upload.json"
UPLOAD_STATUS=$(curl -sS -o "$UPLOAD_JSON" -w "%{http_code}" \
  -H "authorization: Bearer $TOKEN_A" \
  -F "file=@$ATTACH_FILE;type=text/plain" \
  -F "purpose=upload" \
  "$API_BASE_URL/api/v1/files/upload")
if [[ "$UPLOAD_STATUS" != "200" && "$UPLOAD_STATUS" != "201" ]]; then
  echo "[api-contract-smoke] upload failed: $UPLOAD_STATUS" >&2
  cat "$UPLOAD_JSON" >&2 || true
  exit 1
fi
UPLOAD_ID="$(json_field "$UPLOAD_JSON" 'd.id')"
UPLOAD_URL="$(json_field "$UPLOAD_JSON" 'd.url')"
FILE_HASH="${UPLOAD_URL##*/}"

ATTACH_TEXT="contract-attachment-message-$(date +%s)"
ATTACH_NONCE="nonce-attach-$(date +%s)-$RANDOM"

echo "[api-contract-smoke] send attachment-linked DM message"
SEND_ATTACH_JSON="$TMP_DIR/send_attach.json"
SEND_ATTACH_STATUS=$(call_json POST "$API_BASE_URL/api/v1/channels/$DM_ID/messages" "$SEND_ATTACH_JSON" "$TOKEN_A" "{\"content\":\"$ATTACH_TEXT\",\"nonce\":\"$ATTACH_NONCE\",\"attachmentIds\":[\"$UPLOAD_ID\"]}")
if [[ "$SEND_ATTACH_STATUS" != "200" && "$SEND_ATTACH_STATUS" != "201" ]]; then
  echo "[api-contract-smoke] send attachment message failed: $SEND_ATTACH_STATUS" >&2
  cat "$SEND_ATTACH_JSON" >&2 || true
  exit 1
fi

LIST_ATTACH_JSON="$TMP_DIR/list_attach.json"
LIST_ATTACH_STATUS=$(call_json GET "$API_BASE_URL/api/v1/channels/$DM_ID/messages?limit=25" "$LIST_ATTACH_JSON" "$TOKEN_B")
if [[ "$LIST_ATTACH_STATUS" != "200" ]]; then
  echo "[api-contract-smoke] list attachment messages failed: $LIST_ATTACH_STATUS" >&2
  cat "$LIST_ATTACH_JSON" >&2 || true
  exit 1
fi
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const ok=Array.isArray(d)&&d.some(m=>m.content===process.argv[2]&&Array.isArray(m.attachments)&&m.attachments.some(a=>a.id===process.argv[3]));if(!ok){console.error('attachment contract failed');process.exit(1)}" "$LIST_ATTACH_JSON" "$ATTACH_TEXT" "$UPLOAD_ID"

echo "[api-contract-smoke] verify hash-file retrieval"
FILE_STATUS=$(curl -sS -o "$TMP_DIR/file.bin" -w "%{http_code}" "$API_BASE_URL/api/v1/files/$FILE_HASH")
if [[ "$FILE_STATUS" != "200" ]]; then
  echo "[api-contract-smoke] hash retrieval failed: $FILE_STATUS" >&2
  exit 1
fi

echo "[api-contract-smoke] OK"
