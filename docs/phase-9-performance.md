# Phase 9 — Performance & Scale

## Current instrumentation

### Web
- App boot timing logged via `apps/web/src/lib/perf.ts` (app_start → app_ready)
- React Profiler logs for:
  - `MessageList`
  - `ChannelSidebar`
  - `MemberList`

### API
- Slow request logging (>=200ms) in `apps/api/src/index.ts`

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
   - Ensure composite index on `(channel_id, id DESC)`
2. **Search** (`/search/messages`)
   - Confirm GIN index on `tsvector` and filter by guild/channel
3. **Guild members** (`/guilds/:guildId/members`)
   - Add index on `(guild_id, user_id)`

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
