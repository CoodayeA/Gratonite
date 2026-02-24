#!/usr/bin/env bash
set -euo pipefail

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "[api-hotspots:explain] Neither 'docker compose' nor 'docker-compose' is available"
  exit 1
fi

BENCH_USER_COUNT="${BENCH_USER_COUNT:-2500}"
BENCH_CHANNEL_COUNT="${BENCH_CHANNEL_COUNT:-10}"
BENCH_MESSAGE_COUNT="${BENCH_MESSAGE_COUNT:-20000}"

for value in "$BENCH_USER_COUNT" "$BENCH_CHANNEL_COUNT" "$BENCH_MESSAGE_COUNT"; do
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "[api-hotspots:explain] Benchmark counts must be integers"
    exit 1
  fi
done

if [[ "$BENCH_CHANNEL_COUNT" -lt 1 ]]; then
  echo "[api-hotspots:explain] BENCH_CHANNEL_COUNT must be >= 1"
  exit 1
fi

"${COMPOSE_CMD[@]}" up -d postgres >/dev/null

for i in {1..30}; do
  if "${COMPOSE_CMD[@]}" exec -T postgres pg_isready -U gratonite >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! "${COMPOSE_CMD[@]}" exec -T postgres pg_isready -U gratonite >/dev/null 2>&1; then
  echo "[api-hotspots:explain] PostgreSQL did not become ready in time"
  exit 1
fi

"${COMPOSE_CMD[@]}" exec -T postgres psql -U gratonite -d gratonite -v ON_ERROR_STOP=1 <<SQL
\pset pager off
\timing on

BEGIN;

-- Synthetic but deterministic benchmark dataset.
-- All rows are rolled back after plans are captured.
INSERT INTO users (id, username, email, password_hash)
SELECT
  (1000000000000000000 + gs)::bigint,
  'bench_user_' || gs,
  'bench_user_' || gs || '@example.com',
  'x'
FROM generate_series(1, ${BENCH_USER_COUNT}) AS gs;

INSERT INTO user_profiles (user_id, display_name)
SELECT
  (1000000000000000000 + gs)::bigint,
  'Bench User ' || gs
FROM generate_series(1, ${BENCH_USER_COUNT}) AS gs;

INSERT INTO guilds (id, name, owner_id, member_count)
VALUES (2000000000000000001, 'Benchmark Guild', 1000000000000000001, ${BENCH_USER_COUNT});

INSERT INTO channels (id, guild_id, type, name, position)
SELECT
  (3000000000000000000 + gs)::bigint,
  2000000000000000001,
  'GUILD_TEXT',
  'bench-channel-' || gs,
  gs - 1
FROM generate_series(1, ${BENCH_CHANNEL_COUNT}) AS gs;

INSERT INTO guild_members (user_id, guild_id)
SELECT
  (1000000000000000000 + gs)::bigint,
  2000000000000000001
FROM generate_series(1, ${BENCH_USER_COUNT}) AS gs;

INSERT INTO messages (id, channel_id, guild_id, author_id, content, type, flags)
SELECT
  (4000000000000000000 + gs)::bigint,
  (3000000000000000000 + ((gs % ${BENCH_CHANNEL_COUNT}) + 1))::bigint,
  2000000000000000001,
  (1000000000000000000 + ((gs % ${BENCH_USER_COUNT}) + 1))::bigint,
  CASE
    WHEN gs % 5 = 0 THEN 'alpha searchable benchmark message ' || gs
    ELSE 'general benchmark message ' || gs
  END,
  0,
  0
FROM generate_series(1, ${BENCH_MESSAGE_COUNT}) AS gs;

ANALYZE users;
ANALYZE user_profiles;
ANALYZE guild_members;
ANALYZE messages;

\echo ''
\echo '=== Query 1: Message history (GET /channels/:channelId/messages) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, channel_id, guild_id, author_id, content
FROM messages
WHERE channel_id = 3000000000000000001
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 50;

\echo ''
\echo '=== Query 2: Search (GET /search/messages) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, channel_id, guild_id, author_id, content
FROM messages m
WHERE m.search_vector @@ plainto_tsquery('english', 'alpha')
  AND m.deleted_at IS NULL
  AND m.guild_id = 2000000000000000001
  AND m.channel_id = 3000000000000000001
ORDER BY ts_rank(m.search_vector, plainto_tsquery('english', 'alpha')) DESC, m.id DESC
LIMIT 25 OFFSET 0;

\echo ''
\echo '=== Query 3: Guild members (GET /guilds/:guildId/members) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  gm.user_id,
  gm.guild_id,
  COALESCE(mp.nickname, gm.nickname) AS nickname,
  gm.joined_at,
  u.username,
  up.display_name,
  up.avatar_hash,
  mp.bio
FROM guild_members gm
INNER JOIN users u ON u.id = gm.user_id
INNER JOIN user_profiles up ON up.user_id = gm.user_id
LEFT JOIN member_profiles mp ON mp.user_id = gm.user_id AND mp.guild_id = gm.guild_id
WHERE gm.guild_id = 2000000000000000001
LIMIT 100;

ROLLBACK;
SQL
