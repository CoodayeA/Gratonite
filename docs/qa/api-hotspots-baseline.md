# API Hotspot Baseline (Web Priority)

Date: 2026-02-21
Command:

```bash
./scripts/checks/api-hotspots-explain.sh
```

Optional scale knobs:

```bash
BENCH_USER_COUNT=10000 BENCH_CHANNEL_COUNT=100 BENCH_MESSAGE_COUNT=200000 pnpm check:api-hotspots
```

## Scope

Captured `EXPLAIN (ANALYZE, BUFFERS)` baselines for web-critical API query shapes:

1. Message history (`GET /channels/:channelId/messages`)
2. Search (`GET /search/messages`)
3. Guild members (`GET /guilds/:guildId/members`)

The script seeds synthetic benchmark data in a transaction and rolls back, so local DB state is unchanged.

## Latest local results (2026-02-21)

1. Message history
- Plan: `Index Scan Backward using messages_pkey`
- Execution: `~0.085 ms`
- Notes: Fast, but planner prefers PK backward scan over `idx_messages_channel_id` for this synthetic distribution.

2. Search
- Plan: `Bitmap Heap Scan on messages` + `Bitmap Index Scan on idx_messages_channel_id`
- Execution: `~1.27 ms`
- Notes: Channel filter index is used first; full-text ranking/sort dominates the remainder.

3. Guild members
- Plan: `Index Scan using idx_guild_members_user_guild` in joined plan
- Execution: `~0.119 ms`
- Notes: Membership lookup path is index-backed and low latency for this benchmark shape.

## Staged-scale simulation (2026-02-21)

Command:

```bash
BENCH_USER_COUNT=10000 BENCH_CHANNEL_COUNT=100 BENCH_MESSAGE_COUNT=200000 pnpm check:api-hotspots
```

Results:

1. Message history
- Plan: `Index Scan Backward using idx_messages_channel_id`
- Execution: `~0.077 ms`
- Notes: Planner uses the intended channel index at larger scale.

2. Search
- Plan: `BitmapAnd` of `idx_messages_channel_id` and `idx_messages_search_vector`
- Execution: `~5.348 ms`
- Notes: Query uses both channel and GIN indexes as expected; no seq scan regression.
  - On smaller synthetic datasets, planner may still choose a seq scan for this query shape; use staged-scale run for tuning decisions.

3. Guild members
- Plan: `Index Scan using idx_guild_members_user_guild` in joined plan
- Execution: `~0.171 ms`
- Notes: Membership list remains index-backed and stable at higher synthetic volume.

## Follow-up actions

1. Capture the same explain baselines against staging-like data volume/distribution.
2. Add runtime cache hit/miss observability for guild/channel/member caches in API logs/metrics.
3. Test a partial/composite search strategy only if real-world search plans regress from current indexed plans.
