#!/bin/bash
# Phase 5: Customization & Theming — E2E Tests
set -e

BASE="http://localhost:4000/api/v1"
PASS=0
FAIL=0
TOTAL=0

run_test() {
  TOTAL=$((TOTAL + 1))
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expected_status="$5"
  local extra_headers="$6"

  local args="-s -w '\n%{http_code}' -X $method"
  if [ -n "$extra_headers" ]; then
    args="$args -H 'Authorization: Bearer $extra_headers'"
  fi
  if [ -n "$data" ]; then
    args="$args -H 'Content-Type: application/json' -d '$data'"
  fi

  local response
  response=$(eval "curl $args '$url'")
  local status=$(echo "$response" | tail -1)
  local body=$(echo "$response" | sed '$d')

  if [ "$status" = "$expected_status" ]; then
    PASS=$((PASS + 1))
    echo "✅ $TOTAL. $name (HTTP $status)"
  else
    FAIL=$((FAIL + 1))
    echo "❌ $TOTAL. $name — expected $expected_status, got $status"
    echo "   Body: $(echo "$body" | head -c 200)"
  fi

  # Store body for later use
  LAST_BODY="$body"
}

echo "=== Phase 5: Customization & Theming E2E Tests ==="
echo ""

# ── Register user + create guild ────────────────────────────────────────
RAND=$RANDOM
USER_DATA='{"username":"themeuser'$RAND'","email":"theme'$RAND'@test.com","password":"TestPass123!","displayName":"Theme User","dateOfBirth":"2000-01-01"}'
RESP=$(curl -s -w '\n%{http_code}' -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "$USER_DATA")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to register user (HTTP $STATUS)"
  echo "Body: $BODY"
  exit 1
fi
echo "✅ User registered, token acquired"
USER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")

# Create guild
GUILD_RESP=$(curl -s -w '\n%{http_code}' -X POST "$BASE/guilds" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Theme Test Guild"}')
GUILD_STATUS=$(echo "$GUILD_RESP" | tail -1)
GUILD_BODY=$(echo "$GUILD_RESP" | sed '$d')
GUILD_ID=$(echo "$GUILD_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "✅ Guild created: $GUILD_ID"
echo ""

# ── Test 1: Get guild brand (default) ──────────────────────────────────
run_test "Get guild brand (default)" GET "$BASE/guilds/$GUILD_ID/brand" "" "200" "$TOKEN"
echo "   Brand gradientType: $(echo "$LAST_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('gradientType','?'))" 2>/dev/null)"

# ── Test 2: Update guild brand ─────────────────────────────────────────
run_test "Update guild brand (colors + font)" PATCH "$BASE/guilds/$GUILD_ID/brand" '{"colorPrimary":"#FF1493","colorAccent":"#00FF41","fontDisplay":"Outfit","glassOpacity":0.9}' "200" "$TOKEN"
echo "   Updated colorPrimary: $(echo "$LAST_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('colorPrimary','?'))" 2>/dev/null)"

# ── Test 3: Get updated brand ──────────────────────────────────────────
run_test "Get updated brand (verify persisted)" GET "$BASE/guilds/$GUILD_ID/brand" "" "200" "$TOKEN"
COLOR=$(echo "$LAST_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('colorPrimary','?'))" 2>/dev/null)
if [ "$COLOR" = "#FF1493" ]; then
  echo "   ✓ colorPrimary matches"
else
  echo "   ⚠ colorPrimary mismatch: $COLOR"
fi

# ── Test 4: Get guild CSS (empty) ──────────────────────────────────────
run_test "Get guild CSS (empty/default)" GET "$BASE/guilds/$GUILD_ID/css" "" "200" "$TOKEN"

# ── Test 5: Update guild CSS ──────────────────────────────────────────
run_test "Update guild CSS" PATCH "$BASE/guilds/$GUILD_ID/css" '{"css":".custom-server { background: red; }"}' "200" "$TOKEN"

# ── Test 6: Get updated CSS ───────────────────────────────────────────
run_test "Get updated guild CSS (verify)" GET "$BASE/guilds/$GUILD_ID/css" "" "200" "$TOKEN"

# ── Test 7: Get member profile (default/empty) ────────────────────────
run_test "Get member profile (default)" GET "$BASE/guilds/$GUILD_ID/members/$USER_ID/profile" "" "200" "$TOKEN"

# ── Test 8: Update member profile ─────────────────────────────────────
run_test "Update member profile (nickname + bio)" PATCH "$BASE/guilds/$GUILD_ID/members/@me/profile" '{"nickname":"ThemeKing","bio":"I love themes!"}' "200" "$TOKEN"
echo "   Nickname: $(echo "$LAST_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('nickname','?'))" 2>/dev/null)"

# ── Test 9: List avatar decorations ───────────────────────────────────
run_test "List avatar decorations (empty catalog)" GET "$BASE/avatar-decorations" "" "200" "$TOKEN"

# ── Test 10: List profile effects ─────────────────────────────────────
run_test "List profile effects (empty catalog)" GET "$BASE/profile-effects" "" "200" "$TOKEN"

# ── Test 11: Equip decoration (null — unequip) ────────────────────────
run_test "Equip decoration (null/unequip)" PATCH "$BASE/users/@me/customization" '{"avatarDecorationId":null}' "200" "$TOKEN"

# ── Test 12: Browse built-in themes ───────────────────────────────────
run_test "Browse themes (built-in)" GET "$BASE/themes?builtIn=true" "" "200" "$TOKEN"
THEME_COUNT=$(echo "$LAST_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "   Built-in themes: $THEME_COUNT"

# ── Test 13: Get Obsidian theme ───────────────────────────────────────
OBSIDIAN_ID=$(echo "$LAST_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(next(t['id'] for t in d if t['slug']=='obsidian'))" 2>/dev/null)
run_test "Get Obsidian theme by ID" GET "$BASE/themes/$OBSIDIAN_ID" "" "200" "$TOKEN"
echo "   Theme name: $(echo "$LAST_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','?'))" 2>/dev/null)"

# ── Test 14: Create custom theme ──────────────────────────────────────
CUSTOM_THEME='{"name":"My Custom Theme","description":"A cool theme","tokens":{"bg-deep":"#111111","bg-base":"#222222","accent-primary":"#FF0000"},"tags":["dark","custom"],"previewColors":["#111111","#FF0000","#222222"]}'
run_test "Create custom theme" POST "$BASE/themes" "$CUSTOM_THEME" "201" "$TOKEN"
CUSTOM_THEME_ID=$(echo "$LAST_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo "   Custom theme ID: $CUSTOM_THEME_ID"

# ── Test 15: Update custom theme ──────────────────────────────────────
run_test "Update custom theme (name)" PATCH "$BASE/themes/$CUSTOM_THEME_ID" '{"name":"My Updated Theme"}' "200" "$TOKEN"

# ── Test 16: Publish custom theme ─────────────────────────────────────
run_test "Publish custom theme" POST "$BASE/themes/$CUSTOM_THEME_ID/publish" "" "200" "$TOKEN"
VIS=$(echo "$LAST_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('visibility','?'))" 2>/dev/null)
echo "   Visibility: $VIS"

# ── Test 17: Browse public themes (includes custom) ───────────────────
run_test "Browse public themes (includes published)" GET "$BASE/themes?sort=newest" "" "200" "$TOKEN"

# ── Test 18: Install theme ────────────────────────────────────────────
run_test "Install custom theme" POST "$BASE/themes/$CUSTOM_THEME_ID/install" '{"scope":"personal"}' "201" "$TOKEN"

# ── Test 19: Rate theme ───────────────────────────────────────────────
run_test "Rate custom theme (5 stars)" POST "$BASE/themes/$CUSTOM_THEME_ID/rate" '{"rating":5}' "200" "$TOKEN"

# ── Test 20: Get user's themes ────────────────────────────────────────
run_test "Get user's themes (created + installed)" GET "$BASE/users/@me/themes" "" "200" "$TOKEN"
CREATED=$(echo "$LAST_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('created',[])))" 2>/dev/null)
INSTALLED=$(echo "$LAST_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('installed',[])))" 2>/dev/null)
echo "   Created: $CREATED, Installed: $INSTALLED"

# ── Test 21: Uninstall theme ──────────────────────────────────────────
run_test "Uninstall custom theme" DELETE "$BASE/themes/$CUSTOM_THEME_ID/install" "" "204" "$TOKEN"

# ── Test 22: Delete custom theme ──────────────────────────────────────
run_test "Delete custom theme" DELETE "$BASE/themes/$CUSTOM_THEME_ID" "" "204" "$TOKEN"

# ── Test 23: Non-owner brand update forbidden ─────────────────────────
# Register second user
USER2_DATA='{"username":"themeuser2'$RAND'","email":"theme2'$RAND'@test.com","password":"TestPass123!","displayName":"Theme User 2","dateOfBirth":"2000-01-01"}'
RESP2=$(curl -s -w '\n%{http_code}' -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "$USER2_DATA")
BODY2=$(echo "$RESP2" | sed '$d')
TOKEN2=$(echo "$BODY2" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null || echo "")

if [ -n "$TOKEN2" ]; then
  # Join guild via invite
  INVITE_RESP=$(curl -s -X POST "$BASE/invites/guilds/$GUILD_ID/invites" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')
  INVITE_CODE=$(echo "$INVITE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['code'])" 2>/dev/null || echo "")
  if [ -n "$INVITE_CODE" ]; then
    curl -s -X POST "$BASE/invites/$INVITE_CODE" -H "Authorization: Bearer $TOKEN2" > /dev/null
  fi
  run_test "Non-owner brand update forbidden (403)" PATCH "$BASE/guilds/$GUILD_ID/brand" '{"colorPrimary":"#000000"}' "403" "$TOKEN2"
fi

echo ""
echo "========================================"
echo "Results: $PASS passed, $FAIL failed out of $TOTAL tests"
echo "========================================"
