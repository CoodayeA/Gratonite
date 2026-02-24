# Phase 9 — Performance & Scale

## Current instrumentation

### Web
- App boot timing logged via `apps/web/src/lib/perf.ts` (app_start → app_ready)
- React Profiler logs for:
  - `MessageList`
  - `ChannelSidebar`
  - `MemberList`
- Interaction paint telemetry markers:
  - `channel_switch` (sidebar click → post-paint message list ready)
  - `message_send_local_echo` (send action → optimistic message paint)

### API
- Slow request logging (>=200ms) in `apps/api/src/index.ts`
- Repeatable query-plan benchmark: `pnpm check:api-hotspots`
- Latest baseline report: `docs/qa/api-hotspots-baseline.md`
- Runtime cache smoke check: `pnpm check:api-cache-smoke`
- Runtime cache smoke check doc: `docs/qa/api-cache-smoke.md`

## Status (2026-02-21)

- MessageList virtualization added for large channels
- React Profiler logs wired for MessageList/ChannelSidebar/MemberList
- API slow request logging enabled
- Route-level code-splitting added in web app (`React.lazy` + `Suspense`) to reduce initial main bundle size
- API index pass 1 completed:
  - `idx_messages_channel_id` already present for message history reads
  - `idx_messages_search_vector` (GIN) already present for full-text search
  - Added `idx_messages_guild_channel_id` for guild/channel-filtered search reads
  - Added `idx_guild_members_guild_user` and `idx_guild_members_user_guild` for member list + membership lookups
- API hotspot pass 2 started:
- API hotspot pass 2 completed:
  - Added repeatable local `EXPLAIN (ANALYZE, BUFFERS)` benchmark script and baseline report
  - Added staged-scale benchmark validation
  - Added short-TTL Redis caching + invalidation for guild member list reads
  - Added short-TTL Redis caching + invalidation for guild/channel metadata reads
  - Added lightweight cache hit/miss observability logs for new API caches
  - Slow-request logs now include request-scoped `cacheSummary` (hits/misses by cache)
  - Added API tests for cache hit/miss and invalidation paths (guild/channel services)
  - Added API cache runtime smoke script and CI coverage
- Voice/browser reliability hardening:
  - Added media fallback/retry helper used by call join paths
  - Updated voice preflight to require microphone readiness (camera optional)
  - Improved media error messaging for permission/device failures
- Web runtime marker expansion (2026-02-22):
  - Added start/end interaction marker helpers in `apps/web/src/lib/perf.ts`
  - Wired channel-switch markers in `apps/web/src/components/sidebar/ChannelSidebar.tsx`
  - Wired channel-ready completion markers in `apps/web/src/components/messages/MessageList.tsx`
  - Wired local-echo message send markers in `apps/web/src/components/messages/MessageComposer.tsx`

## Open issues / blockers

- Manual Safari + Zen cross-browser validation is deferred to final beta cycle
- Manual cross-browser validation checklist: `docs/qa/voice-browser-checklist.md`

## Hotspot suspects (preliminary)

### Web
1. **MessageList rendering**
   - Mitigation: virtualization (now using `@tanstack/react-virtual`)
2. **Member list + profile resolution**
   - Mitigation: memoize expensive profile resolution, reduce popover re-renders
3. **Channel sidebar**
   - Mitigation: memoize channel grouping and unread dots

### API
1. **Message history fetch** (`GET /channels/:channelId/messages`)
   - Status: covered by existing `idx_messages_channel_id (channel_id, id)`
2. **Search** (`/search/messages`)
   - Status: GIN confirmed; added guild/channel filter index (`idx_messages_guild_channel_id`)
3. **Guild members** (`/guilds/:guildId/members`)
   - Status: added `idx_guild_members_guild_user` (+ reverse lookup index `idx_guild_members_user_guild`)

## Scale plan

1. **CDN + media**
   - CDN for avatars, banners, attachments (MinIO origin)
   - HTTP cache headers for immutable assets

2. **Horizontal scaling**
   - Socket.IO sticky sessions or Redis adapter
   - Stateless API instances with Redis for shared state

3. **Message partitioning**
   - Hash partition by channel_id (already planned in DB schema)
   - Partition count target: 64–128 based on throughput

4. **Caching layer**
   - Redis cache for guilds/channels/members
   - Invalidate on writes via gateway events
