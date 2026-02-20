# Gratonite — Development Progress

> **Last updated:** 2026-02-20
> **Current Phase:** Phase 7A — Web App MVP (Complete)
> **Status:** Functional web client with auth, guilds, channels, real-time messaging

---

## Quick Start for New Sessions

If you're a new AI model continuing this work, here's what you need to know:

1. **Architecture plan** is at `ARCHITECTURE.md` (2,516 lines, 31 sections) — the authoritative reference for all design decisions
2. **Project root** is at `/Users/ferdinand/Projects/untitled folder/`
3. **Stack:** TypeScript monorepo — Turborepo + pnpm workspaces
4. **Backend:** Node.js, Express 5, Socket.IO, Drizzle ORM, PostgreSQL 16, Redis 7, MinIO, LiveKit (voice)
5. **Auth:** JWT (jose, HS256) + Argon2id password hashing + refresh token rotation in Redis
6. **IDs:** Snowflake IDs (Twitter-style 64-bit, epoch Jan 1 2025) — stored as **strings** throughout (see BigInt fix below)
7. **Code style:** `.prettierrc` — semi, single quotes, trailing commas, 100 printWidth
8. **Database:** PostgreSQL on port **5433** (not 5432), Redis on port 6379
9. **Voice:** LiveKit SFU (port 7880) + Coturn TURN/STUN (port 3478). Backend manages state + generates join tokens; clients connect to LiveKit directly

### Critical: BigInt / Snowflake ID Handling

Drizzle ORM 0.45.1's `bigint({ mode: 'string' })` does NOT return strings at runtime — it always returns JavaScript `BigInt` which cannot be JSON-serialized. We use a **custom column type** `bigintString` (defined in `packages/db/src/schema/helpers.ts`) that properly maps PostgreSQL `bigint` ↔ JavaScript `string`. All schema files use `bigintString('column')` instead of `bigint('column', { mode: 'string' })`.

### Running the Server

```bash
# Start Docker services (PostgreSQL + MinIO + LiveKit + Coturn — Redis may need SSH tunnel)
docker-compose up -d

# Install dependencies
pnpm install

# Generate + run migrations (67 tables)
cd packages/db && npx drizzle-kit generate && npx drizzle-kit migrate

# Start API server (port 4000)
cd apps/api && node_modules/.bin/tsx src/index.ts
```

---

## What's Been Built

### Phase 1: Foundation ✅

#### Monorepo Scaffold ✅
- `package.json` — Root monorepo config with turbo scripts
- `pnpm-workspace.yaml` — Workspace definition (`apps/*`, `packages/*`)
- `turbo.json` — Turborepo task config
- `tsconfig.base.json` — Shared TS config (ES2022, strict, bundler moduleResolution)
- `.gitignore`, `.prettierrc`

#### Docker Compose ✅
- `docker-compose.yml` — PostgreSQL 16-alpine (5433), Redis 7-alpine (6379), MinIO (9000/9001), LiveKit (7880), Coturn (3478)
- All services have health checks, persistent volumes, and auto-restart

#### @gratonite/types Package ✅
- `packages/types/` — All shared TypeScript types
- **Files:** `snowflake.ts`, `user.ts`, `permissions.ts`, `guild.ts`, `channel.ts`, `message.ts`, `voice.ts`, `events.ts`, `api.ts`
- **Key types:** User, UserProfile, Guild, Channel (11 types including Wiki/Q&A), Message, VoiceState, ScreenShareSession
- **Permissions:** 42 bitwise flags with `hasPermission()` and `resolvePermissions()` helpers
- **Events:** Full Socket.IO typed events (ServerToClientEvents, ClientToServerEvents)

#### @gratonite/db Package ✅
- `packages/db/` — Drizzle ORM schema + database connection
- **Schema files:** `helpers.ts` (bigintString custom type), `users.ts`, `guilds.ts`, `channels.ts`, `messages.ts`, `voice.ts`
- **Tables (42):** users, userProfiles, userSettings, userCustomStatus, connectedAccounts, relationships, sessions, userNotes, badges, userBadges, accountDeletionRequests, guilds, guildMembers, memberProfiles, guildRoles, userRoles, guildBrand, invites, bans, welcomeScreens, welcomeScreenChannels, auditLogEntries, channels, channelPermissions, threads, threadMembers, dmChannels, dmRecipients, channelReadState, messages, messageAttachments, messageReactions, messageReactionUsers, messageEditHistory, channelPins, polls, pollAnswers, pollVotes, scheduledMessages, voiceStates, stageInstances, soundboardSounds
- **Connection:** `createDb()` factory using postgres.js driver with connection pooling (max 20)

#### API Server Foundation ✅
- `apps/api/` — Express 5 + Socket.IO server

**Libraries (`src/lib/`):**
- `context.ts` — AppContext type: `{ db, redis, io, env, livekit }`
- `logger.ts` — pino structured logger (pretty in dev, JSON in prod)
- `snowflake.ts` — Server-side snowflake ID generator with sequence tracking
- `redis.ts` — Redis client with retry strategy + separate pub/sub subscriber client

**Middleware (`src/middleware/`):**
- `auth.ts` — `requireAuth()` + `optionalAuth()` JWT middleware
- `rate-limiter.ts` — Redis sliding window rate limiter factory + pre-configured limiters (global: 50/s, auth: 5/min, register: 3/hr, messages: 5/5s)
- `security-headers.ts` — CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy

**Auth Module (`src/modules/auth/`):**
- `auth.schemas.ts` — Zod validation schemas (register, login, refresh, username availability)
- `auth.service.ts` — Full auth service (Argon2id, JWT, refresh token rotation, breach detection, failed login tracking)
- `auth.router.ts` — POST register, login, refresh, logout + GET username-available

**Users Module (`src/modules/users/`):**
- `users.router.ts` — GET/PATCH `/@me`, PATCH `/@me/settings`

---

### Phase 2: Core Communication ✅

#### Guilds Module (`src/modules/guilds/`) ✅
- `guilds.schemas.ts` — Zod schemas for create/update guild, create/update role
- `guilds.service.ts` — Full guild service:
  - `createGuild()` — Creates guild + @everyone role (with DEFAULT_PERMISSIONS bitfield) + default brand settings + #general text channel + adds owner as member
  - `getGuild()`, `updateGuild()`, `deleteGuild()`
  - **Members:** `isMember()`, `addMember()`, `removeMember()` (with role cleanup + member count), `getMembers()` (cursor-paginated), `getMember()`, `getUserGuilds()`
  - **Roles:** `createRole()` (auto-positions), `getRoles()`, `updateRole()`, `deleteRole()`, `assignRole()`, `removeRole()`, `getMemberRoles()`
  - **Bans:** `banMember()` (removes member), `unbanMember()`, `isBanned()`, `getBans()`
  - **Audit Log:** `createAuditLogEntry()`
- `guilds.router.ts` — Express routes:
  - `POST /api/v1/guilds` — Create guild
  - `GET /api/v1/guilds/:guildId` — Get guild (member check)
  - `PATCH /api/v1/guilds/:guildId` — Update guild (owner only)
  - `DELETE /api/v1/guilds/:guildId` — Delete guild (owner only)
  - `GET /api/v1/guilds/:guildId/members` — List members (cursor-paginated)
  - `GET /api/v1/guilds/:guildId/members/:userId` — Get member
  - `DELETE /api/v1/guilds/:guildId/members/:userId` — Kick member (owner only)
  - `DELETE /api/v1/guilds/:guildId/members/@me` — Leave guild
  - `GET /api/v1/users/@me/guilds` — Get user's guilds
  - **Roles:** CRUD at `/api/v1/guilds/:guildId/roles`
  - **Role assignment:** PUT/DELETE at `/api/v1/guilds/:guildId/members/:userId/roles/:roleId`
  - **Bans:** GET/PUT/DELETE at `/api/v1/guilds/:guildId/bans`
  - All mutations emit Socket.IO events (GUILD_MEMBER_ADD, GUILD_MEMBER_REMOVE, etc.)

#### Channels Module (`src/modules/channels/`) ✅
- `channels.schemas.ts` — Zod schemas for create/update channel
- `channels.service.ts` — Channel service:
  - `createChannel()`, `getChannel()`, `updateChannel()`, `deleteChannel()`
  - `getGuildChannels()` — ordered by position
- `channels.router.ts` — Express routes:
  - `POST /api/v1/guilds/:guildId/channels` — Create channel (owner only)
  - `GET /api/v1/guilds/:guildId/channels` — List guild channels
  - `GET /api/v1/channels/:channelId` — Get channel (member check)
  - `PATCH /api/v1/channels/:channelId` — Update channel (owner only)
  - `DELETE /api/v1/channels/:channelId` — Delete channel (owner only)
  - Emits CHANNEL_CREATE, CHANNEL_UPDATE, CHANNEL_DELETE events

#### Messages Module (`src/modules/messages/`) ✅
- `messages.schemas.ts` — Zod schemas for create/update/get messages
- `messages.service.ts` — Full message service:
  - `createMessage()` — Parses mentions (@user, @role, @everyone/@here), builds reply references, updates channel's lastMessageId
  - `getMessage()`, `getMessages()` — Cursor-paginated with before/after/around support, soft-delete aware
  - `updateMessage()` — Author-only edit with edit history tracking
  - `deleteMessage()` — Soft delete, author or admin
  - **Reactions:** `addReaction()` (dedup + aggregate count upsert), `removeReaction()` (count decrement + zero cleanup), `getReactions()`
  - **Pins:** `pinMessage()` (50/channel limit), `unpinMessage()`, `getPins()`
- `messages.router.ts` — Express routes:
  - `GET /api/v1/channels/:channelId/messages` — List messages (paginated)
  - `GET /api/v1/channels/:channelId/messages/:messageId` — Get single message
  - `POST /api/v1/channels/:channelId/messages` — Send message (with rate limiter)
  - `PATCH /api/v1/channels/:channelId/messages/:messageId` — Edit message
  - `DELETE /api/v1/channels/:channelId/messages/:messageId` — Delete message (author or admin)
  - **Reactions:** PUT/DELETE at `…/reactions/:emoji/@me`, GET at `…/reactions`
  - **Pins:** GET/PUT/DELETE at `/api/v1/channels/:channelId/pins/:messageId`
  - All mutations emit Socket.IO events (MESSAGE_CREATE, MESSAGE_UPDATE, MESSAGE_DELETE, MESSAGE_REACTION_ADD/REMOVE, CHANNEL_PINS_UPDATE)
  - Redis pub/sub for cross-server fanout on MESSAGE_CREATE

#### Invites Module (`src/modules/invites/`) ✅
- `invites.service.ts` — Invite service:
  - `createInvite()` — Random 10-char alphanumeric code, configurable maxUses/maxAge/temporary
  - `getInvite()` — Checks expiry and max uses
  - `useInvite()` — Atomically increments uses with race-safe `CASE WHEN` SQL
  - `getGuildInvites()`, `deleteInvite()`
- `invites.router.ts` — Express routes:
  - `GET /api/v1/invites/:code` — Public invite info (no auth required) with guild preview
  - `POST /api/v1/invites/:code` — Accept invite (join guild, checks banned/already member)
  - `POST /api/v1/invites/guilds/:guildId/invites` — Create invite (member only)
  - `GET /api/v1/invites/guilds/:guildId/invites` — List guild invites (owner only)
  - `DELETE /api/v1/invites/:code` — Delete invite (creator or owner)
  - Emits GUILD_MEMBER_ADD on invite acceptance

#### Relationships Module (`src/modules/relationships/`) ✅
- `relationships.service.ts` — Friend/block/DM service:
  - `sendFriendRequest()` — Creates bidirectional pending entries, prevents duplicates
  - `acceptFriendRequest()`, `removeFriend()`
  - `blockUser()`, `unblockUser()`
  - `getRelationships()` — All relationships for a user
  - `openDmChannel()` — Gets or creates 1:1 DM channel
  - `getUserDmChannels()` — All DM channels for a user
- `relationships.router.ts` — Express routes:
  - `GET /api/v1/users/@me/relationships` — List all relationships
  - `POST /api/v1/users/@me/relationships` — Send friend request
  - `PUT /api/v1/users/@me/relationships/:userId` — Accept friend request
  - `DELETE /api/v1/users/@me/relationships/:userId` — Remove friend/block
  - `POST /api/v1/users/@me/channels` — Open/get DM channel
  - `GET /api/v1/users/@me/channels` — List DM channels
  - Emits RELATIONSHIP_ADD, RELATIONSHIP_REMOVE events

#### Gateway Module (`src/modules/gateway/`) ✅
- `gateway.ts` — Socket.IO authentication + room management:
  - JWT verification on connection (token from `auth` query param)
  - Auto-joins user to all their guild rooms (`guild:{guildId}`)
  - Auto-joins user to all their DM channel rooms
  - Handles: TYPING_START events (broadcasts to guild/channel)
  - Tracks presence in Redis (`presence:{userId}`)
  - Handles GUILD_SUBSCRIBE (join guild room) for when users join new guilds mid-session
  - Logs connection/disconnect/errors

---

### Phase 3: Voice & Video ✅

#### Infrastructure ✅
- `docker-compose.yml` — Added LiveKit SFU (ports 7880/7881/7882) and Coturn TURN/STUN (ports 3478/5349)
- `apps/api/src/env.ts` — Added `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `LIVEKIT_HTTP_URL`, `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD`
- `apps/api/src/lib/context.ts` — Added `livekit: RoomServiceClient` to AppContext
- `apps/api/package.json` — Added `livekit-server-sdk: ^2.9.0`
- `apps/api/src/index.ts` — Instantiates `RoomServiceClient`, registers voice router

#### Database Schema (3 new tables, 42 total) ✅
- `packages/db/src/schema/voice.ts` — 3 new tables:
  - `voiceStates` — PK: userId (one channel at a time). Columns: channelId, guildId, sessionId, deaf, mute, selfDeaf, selfMute, selfStream, selfVideo, suppress, requestToSpeakTimestamp, joinedAt. Indexes on channelId and guildId.
  - `stageInstances` — Snowflake PK. Columns: guildId, channelId, topic (120 chars), privacyLevel (enum: public/guild_only), scheduledEventId, createdAt
  - `soundboardSounds` — Snowflake PK. Columns: guildId, name (32 chars), soundHash, volume (real 0-1), emojiId, emojiName, uploaderId, available, createdAt
- Migration: `0001_first_spot.sql`

#### Event Types ✅
- `packages/types/src/events.ts` — Added:
  - ServerToClient: `STAGE_INSTANCE_CREATE`, `STAGE_INSTANCE_UPDATE`, `STAGE_INSTANCE_DELETE`, `SOUNDBOARD_PLAY`, `SCREEN_SHARE_START`, `SCREEN_SHARE_STOP`
  - ClientToServer: `SOUNDBOARD_PLAY`

#### Voice Module (`src/modules/voice/`) ✅
- `voice.schemas.ts` — Zod schemas for all voice operations (joinVoice, updateVoiceState, modifyMemberVoiceState, createStageInstance, updateStageInstance, createSoundboardSound, updateSoundboardSound, startScreenShare)
- `voice.service.ts` — Full voice service (`createVoiceService(ctx)` factory):
  - **LiveKit:** `generateJoinToken()` (AccessToken with room grants), `ensureRoomExists()`, `deleteRoomIfEmpty()`
  - **Voice State:** `joinChannel()` (auto-leaves if in different channel, detects stage channels for suppress, upserts DB + Redis, returns LiveKit token), `leaveChannel()` (idempotent, cleans up DB + Redis + room), `updateVoiceState()`, `modifyMemberVoiceState()` (server mute/deaf/disconnect/move), `getVoiceState()`, `getChannelVoiceStates()`, `getGuildVoiceStates()`
  - **Screen Share:** `startScreenShare()`, `stopScreenShare()` (Redis hash tracking)
  - **Stage:** `createStageInstance()`, `getStageInstance()`, `getStageInstanceById()`, `getGuildStageInstances()`, `updateStageInstance()`, `deleteStageInstance()`, `requestToSpeak()`, `approveSpeaker()`, `revokeSpeaker()`
  - **Soundboard:** `createSound()`, `getGuildSounds()`, `getSound()`, `updateSound()`, `deleteSound()`
- `voice.router.ts` — 20 REST endpoints:
  - **Voice:** POST `/voice/join` (get LiveKit token), POST `/voice/leave`, PATCH `/voice/state`, GET `/guilds/:guildId/voice-states`, GET `/channels/:channelId/voice-states`, PATCH `/guilds/:guildId/voice-states/:userId` (mod action)
  - **Screen Share:** POST `/voice/screen-share/start`, POST `/voice/screen-share/stop`
  - **Stage:** POST/GET `/guilds/:guildId/stage-instances`, PATCH/DELETE `/stage-instances/:stageId`, PUT `/stage-instances/:stageId/request-to-speak`, PUT/DELETE `/stage-instances/:stageId/speakers/:userId`
  - **Soundboard:** GET/POST `/guilds/:guildId/soundboard`, PATCH/DELETE `/guilds/:guildId/soundboard/:soundId`, POST `/guilds/:guildId/soundboard/:soundId/play`
  - All mutations broadcast Socket.IO events to guild rooms

#### Gateway Extensions ✅
- `gateway.ts` — Added:
  - `VOICE_STATE_UPDATE` handler — Join/leave voice via Socket.IO. `channelId === null` → leave; `channelId !== null` → verify channel + membership, call `joinChannel()`, broadcast state to guild, send `VOICE_SERVER_UPDATE` (token + endpoint) privately to requesting socket
  - `SOUNDBOARD_PLAY` handler — Verify user in voice channel in guild, broadcast play event
  - Voice cleanup on `disconnect` — Automatically calls `leaveChannel()` and broadcasts disconnected state when socket disconnects

#### Redis Key Design
| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `voice:channel:{channelId}` | SET | None | Users in this voice channel |
| `voice:user:{userId}` | HASH | 3600s | Where this user is (channelId, guildId, sessionId) |
| `voice:guild:{guildId}:channels` | SET | None | Active voice channels in guild |
| `voice:room:{channelId}` | STRING | None | LiveKit room name mapping |
| `voice:screenshare:{channelId}:{userId}` | HASH | 3600s | Active screen share session |

#### Key Design Decisions
- **userId as PK on voice_states:** A user can only be in one voice channel at a time. Joining a new channel upserts the row.
- **Dual storage (DB + Redis):** PostgreSQL is authoritative; Redis provides fast presence lookups. On restart, Redis can be rebuilt from DB.
- **selfDeaf implies selfMute:** Following Discord behavior — deafening automatically mutes.
- **Stage channels:** Audience joins suppressed (suppress=true); speakers need explicit approval from guild owner.
- **Idempotent leaveChannel:** Returns early if user not in any channel — safe to call from both explicit leave and disconnect cleanup.
- **Soundboard uploads deferred:** Accepting soundHash as string. File upload pipeline (MinIO integration) is Phase 4.

---

### Phase 4 Part 1: Threads + Polls + Uploads (IN PROGRESS)
**Status:** Complete and manually verified

#### MinIO + Uploads ✅
- `apps/api/src/lib/minio.ts` — MinIO client + bucket bootstrap
- `apps/api/src/modules/files/` — file upload pipeline (magic bytes validation, sharp resize, Redis pending uploads)
- `apps/api/src/middleware/rate-limiter.ts` — upload rate limiter

#### Emojis + Stickers ✅
- DB tables: `guild_emojis`, `guild_stickers` (migration `0002_faulty_baron_strucker.sql`)
- `apps/api/src/modules/guilds/emojis.schemas.ts` — Zod schemas
- `apps/api/src/modules/guilds/guilds.service.ts` — create/get/update/delete emoji & sticker
- `apps/api/src/modules/guilds/guilds.router.ts` — emoji + sticker routes with MinIO uploads

#### Threads + Forums ✅
- `apps/api/src/modules/threads/` — schemas, service, router
- Thread auto-archive background job wired in `apps/api/src/index.ts`
- Messages can now target threads (channelId = threadId)

#### Polls + Attachments ✅
- `apps/api/src/modules/messages/messages.schemas.ts` — poll input + attachmentIds
- `apps/api/src/modules/messages/messages.service.ts` — poll CRUD, vote flows, message hydration
- `apps/api/src/modules/messages/messages.router.ts` — poll vote/finalize endpoints
- `packages/types/src/message.ts` — message now includes `poll` field
- `packages/types/src/events.ts` — poll event types

#### Testing Status
- `pnpm -C apps/api test` → no test files found (Vitest exit code 1)
- Manual Phase 4 Part 1 E2E run against local Docker services (details below)

#### Manual E2E Results (2026-02-20)
- Services: stopped `switchboard-redis`, recreated local Redis with port 6379 mapping
- Ran: register 2 users → create guild → list channels → upload file → create message with attachment → upload emoji → list emojis → upload sticker → create thread → send message in thread → create forum channel → create forum thread with starter → create poll → vote → finalize
- Result: all requests completed successfully

#### Issues/Notes
- API fails to boot if Redis is not bound to `localhost:6379` (ECONNREFUSED); ensure Redis container exposes port 6379

---

### Phase 4 Part 2: Scheduled Messages + Link Previews + Voice Messages ✅

#### Scheduled Messages ✅
- `POST /channels/:channelId/scheduled-messages` — Create
- `GET /channels/:channelId/scheduled-messages` — List (filtered by author unless admin)
- `DELETE /channels/:channelId/scheduled-messages/:scheduledMessageId` — Cancel
- Background processor: polls every 30s, atomic claim via `status: 'pending' → 'sending'`, broadcasts MESSAGE_CREATE on success

#### Link Preview Pipeline ✅
- `apps/api/src/modules/messages/link-preview.service.ts` — OpenGraph scraper + Redis cache
- URL extraction via regex from message content (max 5 URLs per message)
- Fire-and-forget after message creation: fetches OG metadata, updates message embeds, emits MESSAGE_UPDATE
- Redis caching: 24hr for successful fetches, 5min for errors (negative cache)
- Uses `open-graph-scraper` package with 8s timeout + custom User-Agent

#### Voice Message Support ✅
- Upload via `POST /files/upload` with `isVoiceMessage=true`, `durationSecs`, `waveform` (base64) fields
- `UploadResult` extended with voice fields; stored in Redis pending upload
- Message attachment creation passes through `durationSecs`, `waveform`, and sets `flags` bit 1 (IS_VOICE_MESSAGE)
- Message-level `flags` field set to `1 << 13` (IS_VOICE_MESSAGE) when any attachment is voice
- Empty `content` allowed when attachmentIds, stickerIds, or poll present (validation fix)

#### Implementation Notes
- Scheduled message processor uses polling interval instead of Bull queue (matches current infra)
- Thread auto-archive runs a single SQL update with correlated MAX(created_at) subquery
- Message type int `22` is used for polls (keep in sync with client enums)
- Poll/message/attachment creation runs in a DB transaction; Redis pending upload cleanup is post-commit
- Link preview processing is async: clients receive MESSAGE_CREATE immediately, then MESSAGE_UPDATE with embeds

#### Phase 4 Part 2 E2E Test Results (All Passing)

| Test | Result | Notes |
|---|---|---|
| Send message with URL | ✅ | Embeds populate asynchronously via MESSAGE_UPDATE |
| Get message with link preview | ✅ | OG title, description, image, footer from GitHub |
| Upload voice message file | ✅ | isVoiceMessage=true, durationSecs=5, waveform stored |
| Send voice message | ✅ | Message flags=8192 (IS_VOICE_MESSAGE) |
| Get voice message | ✅ | attachments[0].durationSecs=5, waveform present, flags=2 |
| Create scheduled message | ✅ | status=pending, future scheduledFor |
| List scheduled messages | ✅ | Returns pending messages |
| Cancel scheduled message | ✅ | HTTP 204, message cancelled |

---

## Phase 3 E2E Test Results (All Passing)

| Test | Result | Notes |
|---|---|---|
| Join voice channel | ✅ | Returns LiveKit token + voiceState + endpoint |
| Get guild voice states | ✅ | Lists all connected users |
| Get channel voice states | ✅ | Lists users in specific channel |
| Update own voice state (selfMute) | ✅ | selfMute toggled |
| Leave voice channel | ✅ | 204, voice states cleared |
| Create stage instance | ✅ | Topic + privacy level |
| List stage instances | ✅ | Returns active stages |
| Update stage instance | ✅ | Topic updated |
| Join stage channel (suppressed) | ✅ | suppress: true on join |
| Request to speak | ✅ | requestToSpeakTimestamp set |
| Approve speaker | ✅ | suppress: false |
| Revoke speaker | ✅ | suppress: true |
| Delete stage instance | ✅ | 204 |
| Create soundboard sound | ✅ | With name, hash, volume, emoji |
| List soundboard sounds | ✅ | Filters by available=true |
| Update soundboard sound | ✅ | Name + volume updated |
| Play soundboard sound | ✅ | 204, broadcasts to guild |
| Delete soundboard sound | ✅ | 204 |
| Start screen share | ✅ | Returns session, selfStream=true |
| Stop screen share | ✅ | 204, selfStream=false |
| Server mute (mod action) | ✅ | mute: true in voice state |
| Disconnect user (mod action) | ✅ | channelId: null, voice state removed |

---

## Critical Bug Fixes Applied

### BigInt Serialization Fix (CRITICAL)

**Problem:** Drizzle ORM 0.45.1's `bigint({ mode: 'string' })` for PostgreSQL does NOT return strings at runtime. The `PgBigInt64` class always calls `BigInt(value)` in `mapFromDriverValue()`, regardless of mode. This caused `JSON.stringify` to fail with `"Do not know how to serialize a BigInt"` whenever a user ID was included in a JWT or API response.

**Solution:** Created `bigintString` custom column type using drizzle-orm's `customType()`:
```typescript
// packages/db/src/schema/helpers.ts
export const bigintString = customType<{ data: string; driverData: string }>({
  dataType() { return 'bigint'; },
  fromDriver(value: string): string { return String(value); },
  toDriver(value: string): string { return value; },
});
```

All 4 schema files (`users.ts`, `guilds.ts`, `channels.ts`, `messages.ts`) were updated to use `bigintString('column')` instead of `bigint('column', { mode: 'string' })`.

### Drizzle `sql` Template Array Fix

**Problem:** Drizzle's `sql` template literal doesn't properly parameterize JavaScript arrays for PostgreSQL's `ANY()` operator. Queries like `` sql`${column} = ANY(${arrayValue})` `` pass the array as a single value.

**Solution:** Replaced all `sql` template `ANY()` usage with drizzle-orm's `inArray()` helper in:
- `messages.service.ts` (`getPins`)
- `relationships.service.ts` (`getUserDmChannels`)
- `guilds.service.ts` (`getUserGuilds`, `getMemberRoles`)

---

## E2E Test Results (All Passing)

| Test | Result | Notes |
|---|---|---|
| Register user | ✅ | Returns string ID |
| Login | ✅ | JWT + refresh token working |
| Get current user | ✅ | `/@me` returns full profile |
| Create guild | ✅ | Auto-creates @everyone role + #general + brand |
| Get guild | ✅ | Member access check |
| Get guild channels | ✅ | Lists auto-created #general |
| Send message | ✅ | With mention parsing |
| Edit message | ✅ | Edit history tracked |
| Add reaction | ✅ | Dedup + aggregate count |
| Get reactions | ✅ | Returns reaction list |
| Pin message | ✅ | 50/channel limit enforced |
| Create voice channel | ✅ | GUILD_VOICE type |
| Create invite | ✅ | Random code + expiry |
| Delete message | ✅ | Soft delete |
| Register second user | ✅ | |
| Send friend request | ✅ | Bidirectional pending entries |
| Accept friend request | ✅ | Both become friends |
| Get relationships | ✅ | Lists all relationships |
| Open DM channel | ✅ | Creates/gets 1:1 DM |
| Get invite info (public) | ✅ | No auth required, guild preview |
| Accept invite | ✅ | Joins guild, memberCount incremented |
| Get guild members | ✅ | Returns both members |
| Get user guilds | ✅ | `/@me/guilds` |

---

## Known TODOs in Code

| File | TODO | Priority |
|---|---|---|
| `auth.service.ts` | Encrypt dateOfBirth with AES-256-GCM before storage | HIGH |
| `auth.service.ts` | Implement 2FA verification (TOTP check) | MEDIUM |
| `auth.router.ts` | Add email verification flow (send verification email on register) | HIGH |
| `auth.router.ts` | Add Google OAuth routes | MEDIUM |
| `users.router.ts` | Add avatar/banner upload endpoints | MEDIUM |
| `guilds.router.ts` | Check CREATE_INVITE permission on invite creation | LOW |
| `guilds.router.ts` | Check MANAGE_GUILD permission on invite listing | LOW |
| `messages.router.ts` | Check MANAGE_MESSAGES permission on pin/unpin | LOW |
| `db/schema/messages.ts` | Message table partitioning by channel_id hash | LOW |
| `index.ts` | Add cookie-parser middleware for refresh token cookies | HIGH |
| `messages.service.ts` | ~~Link preview pipeline~~ **DONE** — see `link-preview.service.ts` | ~~MEDIUM~~ |

---

## Phase 4 Part 1: Implementation Plan (IN PROGRESS)

> **Status:** Implementation underway. Steps 1–6 complete, Step 7 pending.
> **Plan file:** `.claude/plans/fluttering-roaming-planet.md` has the full detailed plan.
> **Scope:** Threads + Forums, Polls, File Uploads (MinIO), Emoji/Stickers

### What already exists (DB tables from Phase 1 migration):
- `threads`, `threadMembers` — Thread CRUD + member tracking
- `polls`, `pollAnswers`, `pollVotes` — Poll system
- `scheduledMessages` — Scheduled message system
- `messageAttachments` — File attachment metadata (with waveform, duration for voice)
- `channels` table already has forum columns: `availableTags`, `defaultSortOrder`, `defaultForumLayout`, `defaultAutoArchiveDuration`, `defaultThreadRateLimitPerUser`, `defaultReactionEmoji`
- Channel types already include: `GUILD_FORUM`, `GUILD_WIKI`, `GUILD_QA`, `GUILD_MEDIA`
- Types already exist: `Thread`, `ForumTag`, `ThreadType`, `Poll`, `PollAnswer`, `ScheduledMessage` in `packages/types/`

### What needs to be BUILT (8 steps):

#### Step 1: Dependencies + MinIO Infrastructure ✅
- Add to `apps/api/package.json`: `minio`, `multer`, `sharp`, `file-type`, `@types/multer`
- **New file:** `apps/api/src/lib/minio.ts` — MinIO client + `ensureBuckets()` for: uploads, emojis, stickers, avatars, banners, server-icons
- **Modify:** `apps/api/src/lib/context.ts` — Add `minio: Client` (from minio package) to AppContext
- **Modify:** `apps/api/src/index.ts` — Init MinIO client, call `ensureBuckets()`, add to ctx
- MinIO is already in Docker (port 9000), env vars (`MINIO_*`) already in `env.ts`

#### Step 2: File Upload Module ✅
- **New:** `apps/api/src/modules/files/files.schemas.ts` — Upload validation (purpose enum, contextId, description, spoiler)
- **New:** `apps/api/src/modules/files/files.service.ts` — `uploadFile()` (validate magic bytes via file-type, enforce size limits per purpose, sharp pipeline: strip EXIF → resize → WebP → extract dimensions, upload to MinIO), `getFileUrl()`, `deleteFile()`, `processImage()`
- **New:** `apps/api/src/modules/files/files.router.ts` — `POST /files/upload` (multipart via multer memory storage), returns temp metadata in Redis (`pending_upload:{tempId}`, 15min TTL)
- **Modify:** `apps/api/src/middleware/rate-limiter.ts` — Add `uploadRateLimiter` (10/min/user)
- **Modify:** `apps/api/src/index.ts` — Register files router
- **Design:** Two-step upload — upload first to get temp ID, then reference when creating message

#### Step 3: Emoji + Stickers (DB + Types + Service) ✅
- **Modify:** `packages/db/src/schema/guilds.ts` — Add `guildEmojis` table (id, guildId, name varchar(32), hash varchar(64), animated boolean, creatorId, available boolean, createdAt) and `guildStickers` table (id, guildId, name varchar(30), description varchar(100), hash varchar(64), formatType varchar(10), tags varchar(200), available boolean, creatorId, createdAt)
- Run `npx drizzle-kit generate && npx drizzle-kit migrate`
- **Modify:** `packages/types/src/guild.ts` — Add `GuildEmoji`, `GuildSticker` interfaces
- **Modify:** `packages/types/src/events.ts` — Add `GUILD_EMOJI_CREATE/UPDATE/DELETE`, `GUILD_STICKER_CREATE/UPDATE/DELETE`
- **New:** `apps/api/src/modules/guilds/emojis.schemas.ts` — Zod schemas
- **Modify:** `apps/api/src/modules/guilds/guilds.service.ts` — Add createEmoji, getGuildEmojis, deleteEmoji, createSticker, getGuildStickers, updateSticker, deleteSticker
- **Modify:** `apps/api/src/modules/guilds/guilds.router.ts` — Add 7 emoji/sticker routes with multer
- Emoji: max 256KB, 128x128, stored in MinIO `emojis` bucket
- Sticker: max 500KB, 320x320, stored in MinIO `stickers` bucket

#### Step 4: Threads + Forums ✅
- **New:** `apps/api/src/modules/threads/threads.schemas.ts` — createThread (name, type, autoArchiveDuration, appliedTags, message for forum starter), updateThread, getThreads
- **New:** `apps/api/src/modules/threads/threads.service.ts` — createThread (validates parent channel type, forum tag validation, creates thread + starter message for forum, auto-adds creator), getThread, getActiveThreads, getArchivedThreads, updateThread, deleteThread, joinThread, leaveThread, getThreadMembers, archiveStaleThreads
- **New:** `apps/api/src/modules/threads/threads.router.ts` — 9 endpoints: POST/GET `/channels/:channelId/threads`, GET `.../archived`, GET/PATCH/DELETE `/threads/:threadId`, PUT/DELETE `/threads/:threadId/members/@me`, GET `.../members`
- **Modify:** `packages/types/src/events.ts` — Add `THREAD_MEMBER_ADD`, `THREAD_MEMBER_REMOVE`
- **Modify:** `apps/api/src/modules/messages/messages.router.ts` — Update channel access check to also look up threads (thread.id = channelId for messages)
- **Modify:** `apps/api/src/modules/messages/messages.service.ts` — Increment `threads.messageCount` when message created in thread
- **Modify:** `apps/api/src/index.ts` — Register threads router + start auto-archive setInterval (every 5 min)
- **Key design:** Thread messages use `thread.id` as `channelId` in messages table — existing messages service works for threads with minimal changes

#### Step 5: Polls ✅
- **Modify:** `apps/api/src/modules/messages/messages.schemas.ts` — Add `pollInputSchema` (questionText, answers min 2 max 10, allowMultiselect, expiry), add `poll` + `attachmentIds` to createMessageSchema, make `content` optional (refine: at least one of content/attachments/stickers/poll)
- **Modify:** `apps/api/src/modules/messages/messages.service.ts` — Add createPoll, votePoll (single/multi-select, prevent double-vote), removeVote, getVotes, finalizePoll, hydratePollData (batch-fetch poll+answers for messages). Modify createMessage to handle poll type. Modify getMessages/getMessage to hydrate poll data.
- **Modify:** `packages/types/src/events.ts` — Add `POLL_VOTE_ADD`, `POLL_VOTE_REMOVE`, `POLL_FINALIZE`
- **Modify:** `apps/api/src/modules/messages/messages.router.ts` — Add 4 poll routes: PUT/DELETE `/channels/:channelId/polls/:pollId/votes/:answerId`, GET `.../votes`, POST `.../finalize`
- **Modify:** `apps/api/src/middleware/rate-limiter.ts` — Add `pollVoteRateLimiter` (10/5s/user)

#### Step 6: Integration — Message Attachments ✅
- **Modify:** `apps/api/src/modules/messages/messages.service.ts` — In createMessage, when `attachmentIds` provided: fetch pending uploads from Redis, create `messageAttachments` rows linking to message, clean up Redis temp keys

#### Step 7: Test All Endpoints E2E ✅
Test sequence: upload file → message with attachment → upload emoji → list emojis → upload sticker → create thread in text channel → send messages in thread → create forum channel with tags → create thread with appliedTags → archive/unarchive → join/leave thread → create poll message → vote → finalize → delete resources

#### Step 8: Update PROGRESS.md and commit ✅ (commit pending user request)

### Key Files to Read Before Starting Implementation:
| File | Why |
|------|-----|
| `apps/api/src/modules/messages/messages.service.ts` | Core file to extend with polls + attachments |
| `apps/api/src/modules/messages/messages.router.ts` | Add poll routes + thread channel access check |
| `apps/api/src/modules/messages/messages.schemas.ts` | Extend with poll input |
| `apps/api/src/modules/guilds/guilds.service.ts` | Add emoji/sticker methods |
| `apps/api/src/modules/guilds/guilds.router.ts` | Add emoji/sticker routes |
| `apps/api/src/modules/channels/channels.service.ts` | Understand channel patterns for threads |
| `packages/db/src/schema/guilds.ts` | Add guildEmojis + guildStickers tables |
| `packages/db/src/schema/channels.ts` | Existing threads + threadMembers tables |
| `packages/db/src/schema/messages.ts` | Existing polls + messageAttachments tables |
| `packages/types/src/guild.ts` | Add GuildEmoji/GuildSticker types |
| `packages/types/src/events.ts` | Add all new event types |
| `apps/api/src/env.ts` | MinIO env vars already defined |
| `apps/api/src/index.ts` | Register new routers + MinIO init |
| `apps/api/src/lib/context.ts` | Add minio to AppContext |

### Important Notes for Implementor:
1. **Port 5432 is SSH tunnel** — PostgreSQL is on port **5433** via Docker
2. **Use `docker-compose` (with hyphen)** — not `docker compose`
3. **macOS has no `timeout` command** — use `background process + sleep + kill` pattern
4. **Rate limiter keys use IPv6** — key format is `ratelimit:{prefix}:::1` for localhost
5. **Clear rate limits via Node.js**: `cd apps/api && npx tsx -e "import Redis from 'ioredis'; const r = new Redis('redis://localhost:6379'); r.keys('*ratelimit*').then(keys => { if(keys.length) Promise.all(keys.map(k=>r.del(k))).then(()=>r.disconnect()); else r.disconnect(); })"` — cannot use top-level await (CJS), use `.then()` chains
6. **Redis is via SSH tunnel on 6379** — NOT the Docker Redis container. Docker Redis has no port mapping.
7. **Existing message `type` field** is integer (0=DEFAULT, 19=REPLY). Need to define POLL=22 (or similar).
8. **Forum threads require starter message** — enforced at service layer based on parent channel type.

---

### Phase 4 Part 3A: Search + Wiki + Q&A + Events ✅

#### Full-Text Search ✅
- PostgreSQL `tsvector` column + GIN index on `messages` table
- Trigger auto-populates `search_vector` on INSERT/UPDATE of content
- `apps/api/src/modules/search/` — schemas, service, router
- `GET /search/messages` — query, guildId, channelId, authorId, before/after filters
- Uses `plainto_tsquery`, `ts_rank()` for relevance, `ts_headline()` for highlights
- Rate limited: 10 searches per 10s per user

#### Wiki Channels ✅
- DB tables: `wiki_pages`, `wiki_page_revisions` (migration `0003_silent_strong_guy.sql`)
- `apps/api/src/modules/wiki/` — schemas, service, router
- 7 endpoints: create/list/get/update/delete pages + list revisions + revert
- Hierarchical pages via `parentPageId`, slug auto-generated from title
- Revision history: every edit saves previous state before updating
- Revert: restores old revision content, creates new revision entry

#### Q&A Channels ✅
- DB tables: `qa_questions` (thread metadata), `qa_votes`, `qa_answer_meta`
- `apps/api/src/modules/qa/` — schemas, service, router
- Q&A questions are threads in `GUILD_QA` channels — reuses existing thread + message infrastructure
- 8 endpoints: create/list/get questions, vote question/answer, accept/unaccept answer
- Vote system: +1/-1 per user, upserts on re-vote, atomic count updates
- `qaAnswerMeta` rows created lazily on first vote (no coupling to messages module)

#### Event Scheduling ✅
- DB tables: `guild_scheduled_events`, `guild_scheduled_event_users` + 2 enums
- `apps/api/src/modules/events/` — schemas, service, router
- 8 endpoints: CRUD events + RSVP interested/uninterested + list interested users
- Entity types: `voice`, `stage_instance`, `external` (with location metadata)
- Background job: auto-start events when `scheduledStartTime <= now` (every 60s)
- RSVP: atomic `interestedCount` increment/decrement

#### Phase 4 Part 3A E2E Test Results (All Passing)

| Test | Result | Notes |
|---|---|---|
| Send 3 messages with keywords | ✅ | quantum, JavaScript, weather |
| Search "quantum" | ✅ | 1 result with `<mark>` highlights |
| Search "JavaScript" | ✅ | 1 result |
| Search with guildId filter | ✅ | Results filtered correctly |
| Search nonexistent term | ✅ | 0 results |
| Create GUILD_WIKI channel | ✅ | Channel type accepted |
| Create wiki page | ✅ | Title, slug, content, position |
| List wiki pages | ✅ | Page in list |
| Update wiki page | ✅ | New content, revision created |
| List revisions | ✅ | 1 revision from edit |
| Revert to revision | ✅ | Content restored |
| Delete wiki page | ✅ | 204 |
| Create GUILD_QA channel | ✅ | Channel type accepted |
| Create Q&A question | ✅ | Thread + starter message created |
| List questions | ✅ | Question in list |
| Vote on question (+1) | ✅ | voteCount=1 |
| Send answer in thread | ✅ | Message posted |
| Vote on answer (+1) | ✅ | Answer meta created |
| Accept answer | ✅ | resolved=true |
| Unaccept answer | ✅ | resolved=false |
| Create voice event | ✅ | With channelId |
| Create external event | ✅ | With location metadata |
| List events | ✅ | Both events present |
| RSVP interested | ✅ | 204 |
| Get event (interestedCount) | ✅ | interestedCount=1 |
| List interested users | ✅ | User in list |
| Update event | ✅ | Name changed |
| Delete event | ✅ | 204 |

### Phase 4 Part 3B: Auto-Moderation + Raid Protection + Moderation Dashboard + Analytics ✅

#### Auto-Moderation ✅
- **Tables:** `auto_mod_rules` (12 cols), `auto_mod_action_logs` (9 cols)
- **Enums:** `auto_mod_event_type`, `auto_mod_trigger_type`, `auto_mod_action_type`
- **Files:**
  - `apps/api/src/modules/automod/automod.schemas.ts` — createAutoModRule, updateAutoModRule, getAutoModLogs
  - `apps/api/src/modules/automod/automod.service.ts` — CRUD + `checkMessage()` (inline in request path, Redis-cached rules)
  - `apps/api/src/modules/automod/automod.router.ts` — 6 endpoints for rule management + action logs
- **Trigger types:** keyword (case-insensitive + regex + allowList), keyword_preset (profanity/sexual_content/slurs), mention_spam, spam (duplicate detection via Redis sorted set)
- **Actions:** block_message (403 before persistence), send_alert_message (Socket.IO event), timeout (updates guildMembers.communicationDisabledUntil)
- **Performance:** Rules cached in Redis (`automod_rules:{guildId}`, 60s TTL), cache invalidated on CRUD
- **Endpoints:** POST/GET/GET/:id/PATCH/DELETE `/guilds/:guildId/auto-moderation/rules`, GET `/guilds/:guildId/auto-moderation/logs`
- **Integration:** `checkMessage()` called in messages router BEFORE `createMessage()` — blocked messages never persist

#### Raid Protection ✅
- **Table:** `raid_config` (PK: guildId, FK cascade)
- **Enum:** `raid_action` (kick/ban/enable_verification/lock_channels/alert_only)
- **Redis sliding window:** `raid_monitor:{guildId}` sorted set with join timestamps
  - ZADD on member join → ZREMRANGEBYSCORE to trim → ZCARD to count → trigger if >= threshold
  - Auto-resolve via Redis TTL on `raid_active:{guildId}` key
- **Endpoints:** GET/PATCH `/guilds/:guildId/raid-config`, POST `/guilds/:guildId/raid-resolve`
- **Events:** `RAID_DETECTED`, `RAID_RESOLVED`

#### User Reports ✅
- **Table:** `reports` (12 cols, indexed on guild_id+status)
- **Enums:** `report_reason` (spam/harassment/hate_speech/nsfw/self_harm/other), `report_status` (pending/reviewing/resolved/dismissed)
- **Endpoints:** POST (any member), GET/GET/:id/PATCH (owner only) `/guilds/:guildId/reports`
- **Events:** `REPORT_CREATE`, `REPORT_UPDATE`

#### Moderation Dashboard API ✅
- **Dashboard stats:** pending reports count, active automod rules, recent automod actions, recent bans, raid status
- **Recent mod actions:** merged timeline from audit_log_entries + auto_mod_action_logs, sorted by createdAt desc
- **Endpoints:** GET `/guilds/:guildId/moderation/dashboard`, GET `/guilds/:guildId/moderation/actions`

#### Server Analytics ✅
- **Tables:** `server_analytics_daily` (composite unique: guild_id+date), `server_analytics_hourly` (composite unique: guild_id+hour)
- **Design:** Redis incremental counters + periodic DB flush (NOT real-time aggregation)
  - `trackMessage()` — HINCRBY daily/hourly hashes + PFADD HyperLogLog for unique active users
  - `trackMemberJoin/Leave()`, `trackReaction()` — daily counter increments
  - `flushAnalytics()` — every 5 min: scan Redis keys, upsert to DB via `INSERT ... ON CONFLICT DO UPDATE`
  - `cleanupOldHourlyData()` — daily: delete hourly rows older than 90 days
- **Endpoints:** GET `/guilds/:guildId/analytics` (7d/14d/30d/90d), GET `/guilds/:guildId/analytics/heatmap`
- **Integration:** `analyticsService.trackMessage()` called fire-and-forget after message creation in messages router

#### Migration 0004 ✅
- 6 new tables, 6 new enums
- Unique constraints for analytics composite keys (for ON CONFLICT upserts)
- Indexes on `auto_mod_action_logs(guild_id, created_at)` and `reports(guild_id, status)`
- Total tables: **57**

#### E2E Test Results (29/29 pass) ✅

| Test | Description | Result |
|------|-------------|--------|
| 1a | Create keyword automod rule | ✅ |
| 1b | List automod rules | ✅ |
| 1c | Get single automod rule | ✅ |
| 2a | Block message containing keyword (403) | ✅ |
| 2b | AUTO_MODERATION_BLOCKED response code | ✅ |
| 2c | Allow normal message (201) | ✅ |
| 3a | Automod action logs recorded | ✅ |
| 3b | Log contains matched keyword | ✅ |
| 4a | Disable automod rule | ✅ |
| 4b | Previously blocked word allowed after disable | ✅ |
| 4c | Delete automod rule (204) | ✅ |
| 5a | Default raid config (disabled) | ✅ |
| 5b | Update raid config | ✅ |
| 5c | Resolve raid | ✅ |
| 6a | Create user report (pending) | ✅ |
| 6b | List pending reports | ✅ |
| 6c | Get single report | ✅ |
| 6d | Resolve report with note | ✅ |
| 7a | Dashboard stats | ✅ |
| 7b | Recent mod actions | ✅ |
| 8a | Daily analytics returns array | ✅ |
| 8b | Hourly heatmap returns array | ✅ |
| 8c | Non-owner analytics forbidden (403) | ✅ |
| 9a | Create profanity preset rule | ✅ |
| 9b | Block profanity preset match (403) | ✅ |
| 9c | Allow clean message through preset (201) | ✅ |
| 10a | Create mention spam rule | ✅ |
| 10b | Block 3+ mentions (403) | ✅ |
| 10c | Allow fewer mentions (201) | ✅ |

---

### Phase 5: Customization & Theming ✅

#### Theme Presets & Marketplace ✅
- **Tables:** `theme_presets` (17 cols, JSONB tokens), `theme_installs` (composite PK: userId+themeId)
- **Enum:** `theme_visibility` (private/unlisted/public)
- **Files:**
  - `apps/api/src/modules/themes/themes.schemas.ts` — createTheme, updateTheme, browseThemes, installTheme, rateTheme
  - `apps/api/src/modules/themes/themes.service.ts` — Full theme service with 8 built-in themes seeded on startup
  - `apps/api/src/modules/themes/themes.router.ts` — 10 endpoints
- **Built-in themes:** Obsidian (default), Moonstone, Ember, Arctic, Void, Terracotta, Sakura, Neon — each with ~24 color tokens
- **Marketplace features:** Browse public themes (sort by popular/newest/top_rated), install/uninstall, rate (Redis double-vote prevention)
- **Endpoints:** GET/POST/PATCH/DELETE `/themes`, POST `.../publish`, POST/DELETE `.../install`, POST `.../rate`, GET `/users/@me/themes`

#### Guild Brand + Custom CSS ✅
- **Tables:** `guild_custom_css` (PK: guildId, FK cascade, text CSS + updatedBy)
- **Files:**
  - `apps/api/src/modules/brand/brand.schemas.ts` — updateBrand (all guildBrand fields), updateCss (50KB max)
  - `apps/api/src/modules/brand/brand.service.ts` — CRUD with Redis cache (120s TTL), CSS upsert via Drizzle `onConflictDoUpdate`
  - `apps/api/src/modules/brand/brand.router.ts` — 5 endpoints with background image upload (sharp → 1920x1080 WebP)
- **Endpoints:** GET/PATCH `/guilds/:guildId/brand`, POST `.../brand/background`, GET/PATCH `/guilds/:guildId/css`
- **Real-time:** `GUILD_BRAND_UPDATE`, `GUILD_CSS_UPDATE` events via Socket.IO

#### Member Profiles + Customization ✅
- **Tables:** `avatar_decorations` (catalog), `profile_effects` (catalog) — both with category, sortOrder, animated, available
- **Files:**
  - `apps/api/src/modules/profiles/profiles.schemas.ts` — updateMemberProfile, equipCustomization
  - `apps/api/src/modules/profiles/profiles.service.ts` — Per-server profiles (upsert), avatar/banner upload, decoration/effect equip
  - `apps/api/src/modules/profiles/profiles.router.ts` — 9 endpoints
- **Endpoints:** GET/PATCH member profiles, POST/DELETE avatar/banner uploads, GET `/avatar-decorations`, GET `/profile-effects`, PATCH `/users/@me/customization`
- **Real-time:** `MEMBER_PROFILE_UPDATE`, `USER_PROFILE_UPDATE` events

#### Migration 0005 ✅
- 5 new tables, 1 new enum
- Indexes: `theme_presets(visibility, install_count DESC)`, `theme_presets(author_id)`, `theme_installs(theme_id)`
- Total tables: **62**

#### E2E Test Results (23/23 pass) ✅

| Test | Description | Result |
|------|-------------|--------|
| 1 | Get guild brand (defaults) | ✅ |
| 2 | Update guild brand (colors, gradient, fonts) | ✅ |
| 3 | Get updated brand | ✅ |
| 4 | Get guild CSS (empty) | ✅ |
| 5 | Update guild CSS (upsert) | ✅ |
| 6 | Get updated CSS | ✅ |
| 7 | Get member profile (empty) | ✅ |
| 8 | Update member profile (nickname, bio) | ✅ |
| 9 | List avatar decorations (catalog) | ✅ |
| 10 | List profile effects (catalog) | ✅ |
| 11 | Equip avatar decoration | ✅ |
| 12 | List built-in themes (8) | ✅ |
| 13 | Get single theme (Obsidian, tokens) | ✅ |
| 14 | Create custom theme | ✅ |
| 15 | Update custom theme | ✅ |
| 16 | Publish custom theme | ✅ |
| 17 | Browse public themes | ✅ |
| 18 | Install theme | ✅ |
| 19 | Rate theme | ✅ |
| 20 | Get user themes (installed + created) | ✅ |
| 21 | Uninstall theme | ✅ |
| 22 | Delete custom theme | ✅ |
| 23 | CSS upsert (re-update) | ✅ |

---

### Phase 6: Bot & Plugin Platform ✅

#### OAuth2 Apps + Bots + Slash Commands ✅ (backend scaffolding)
- DB tables + enum: `oauth2_apps`, `oauth2_codes`, `oauth2_tokens`, `bots`, `slash_commands`, `oauth_token_type`
- New schema file: `packages/db/src/schema/bots.ts`
- Migration: `0006_bot_platform.sql` (also adds `users.bot` boolean)
- API module: `apps/api/src/modules/bots/` (schemas, service, router)
- Total tables: **67**
- OAuth app endpoints (REST):
  - `POST /oauth/apps` (create app, returns clientSecret)
  - `GET /oauth/apps` (list owned apps)
  - `GET /oauth/apps/:appId`
  - `PATCH /oauth/apps/:appId`
  - `DELETE /oauth/apps/:appId`
  - `POST /oauth/apps/:appId/reset-secret`
- OAuth code/token endpoints:
  - `POST /oauth/authorize`
  - `POST /oauth/token`
- Bot lifecycle endpoints:
  - `POST /oauth/apps/:appId/bot` (create bot user + token)
  - `POST /oauth/apps/:appId/bot/reset-token`
  - `POST /oauth/apps/:appId/bot/authorize` (add bot to guild)
- Slash command endpoints:
  - `GET /oauth/apps/:appId/commands`
  - `POST /oauth/apps/:appId/commands`
  - `PATCH /oauth/apps/:appId/commands/:commandId`
  - `DELETE /oauth/apps/:appId/commands/:commandId`
- Bot auth middleware stub: `apps/api/src/middleware/bot-auth.ts`

#### Gateway intents ✅
- Socket gateway accepts bot tokens in IDENTIFY; bots join guild rooms and receive events like regular clients
- `intents` bitfield filters TYPING_START, PRESENCE_UPDATE, VOICE_STATE_UPDATE
- Guild/message events now use `emitRoomWithIntent` in routers/services (messages, threads, channels, guilds, invites, voice, automod, moderation, events, wiki, brand, profiles)
- DM events now use DIRECT_MESSAGES intent
- Guild pub/sub events map to intents by event type

#### Plugin Sandbox Spec ✅
- Documented iframe sandbox contract and permission model (`docs/plugin-sandbox.md`)
- Shared intent constants added at `packages/types/src/intents.ts`

#### Developer Docs ✅
- `docs/developer-portal.md`
- `docs/plugin-sandbox.md`
- `docs/bot-platform.md`

---

### Phase 7: Cross-Platform Apps (PLANNING)

#### Planning Focus
- Desktop app UX: navigation, tray behavior, notifications, and window state
- Mobile app UX: gesture-first interactions, bottom sheets, haptics, and quick reply
- Push notification + deep link routing plan
- Offline-first data layer (WatermelonDB) scope and sync boundaries

#### Remaining Phase 7 Build Tasks
- Tunnel/staging config wiring and scripts
- Desktop build pipeline (bundler + artifacts)
- Web app routing/auth/API integration
- Deep link handling end-to-end (desktop + mobile + backend)
- Offline-first implementation (WatermelonDB setup + sync)
- Mobile navigation + functional screens
- Distribution workflow for desktop builds

#### Desktop (Electron) ✅ (scaffold)
- Added cross-platform build targets: macOS, Windows, Linux
- Basic window state persistence + tray flow + hotkey stub
- UX placeholder shell with typography + gradient atmosphere
- Files: `apps/desktop/package.json`, `apps/desktop/src/main.ts`, `apps/desktop/src/preload.ts`, `apps/desktop/renderer/index.html`, `apps/desktop/renderer/styles.css`
- Desktop supports `--force-server <url>` and `GRATONITE_DESKTOP_URL` for staging/tunnel

#### Mobile (Expo) ✅ (scaffold)
- Expo app shell with expressive UI, gradient glows, and gesture-first layout
- Files: `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/App.tsx`, `apps/mobile/tsconfig.json`

#### Web (Vite) ✅ (full auth + messaging MVP)
- Functional web client: register, login, guild list, channel view, real-time messaging
- Full tech stack: React 18 + React Router v6 + Zustand + TanStack Query + Socket.IO client
- Build output: 14KB CSS + 31KB app + 41KB state + 41KB socket + 164KB vendor (gzipped: ~93KB total)
- Brand assets integrated: app icon + mascot in loading screen, home page, auth pages
- See Phase 7A section below for full details

#### Deep Links (web)
- Route parser stub + redirect entrypoint for `/invite`/`/guild`/`/dm`
- Files: `apps/web/src/route.ts`, `apps/web/public/redirect.html`

#### Downloads Hub (web)
- `/app/download` view stub with buttons for desktop builds
- Download URLs now read from `apps/web/.env` (VITE_DOWNLOAD_*)
- Tunnel status banner reads from `VITE_TUNNEL_STATUS`
- Releases JSON feed: `apps/web/public/releases.json`

#### Marketing Site (website) ✅
- Added marketing landing + Discover + Downloads pages
- Discover includes left menu with Servers/Bots/Themes sections
- Files: `apps/website/index.html`, `apps/website/discover.html`, `apps/website/download.html`, `apps/website/styles.css`

#### Push + Deep Links (plan)
- `docs/push-and-deeplinks.md`

#### Offline-First (plan)
- `docs/offline-first.md`

#### Tunnel/Staging (plan)
- `docs/tunnel-setup.md`

#### Phase 7 Summary
- `docs/phase7-summary.md`

#### Repository Split (Org)
- Org: `gratonitechat`
- Backend: `gratonitechat/gratonite`
- Web: `gratonitechat/for-web`
- Desktop: `gratonitechat/for-desktop`
- iOS: `gratonitechat/for-ios`
- Android: `gratonitechat/for-android`
- Marketing: `gratonitechat/gratonite.chat`
- Self-hosted: `gratonitechat/self-hosted`
- Community list: `gratonitechat/rockhard-gratonite`

#### Phase 6 E2E Test Results (Initial)

| Test | Result | Notes |
|---|---|---|
| Create OAuth app | ✅ | Returns clientSecret + app id |
| Create bot | ✅ | Returns bot token |
| Authorize bot to guild | ✅ | Adds bot user to guild |
| Create slash command | ✅ | `ping` command created |
| List slash commands | ✅ | Returns created command |
| OAuth authorize (code) | ✅ | Returns auth code |
| OAuth token exchange | ✅ | Returns access + refresh tokens |

---

### Phase 7A: Web App — Auth + Messaging MVP ✅

#### Overview
Complete functional web client built on the Phase 7 Vite scaffold. Users can register, login, browse guilds, view channels, and send/receive messages in real-time via Socket.IO.

#### Stack
- **React 18** + **React Router v6** (client-side routing)
- **Zustand** (local/real-time state) + **TanStack Query** (server data cache)
- **Socket.IO client** (real-time events)
- **Vite** dev proxy: `/api` → localhost:4000, `/socket.io` → localhost:4000 (ws)
- Dark-first design: Space Grotesk font, glassmorphism auth card, CSS custom properties

#### Architecture Decisions
- **Access token in module closure** (not reactive state) — prevents unnecessary re-renders on token changes
- **Dual store pattern**: TanStack Query for server data (guilds, channels, messages), Zustand for local/real-time state (current selections, typing indicators, UI toggles)
- **Optimistic messages**: nonce-based dedup — client inserts immediately, gateway event replaces optimistic copy
- **Auto-refresh**: Silent `POST /auth/refresh` on app mount using HttpOnly cookie
- **Vite proxy eliminates CORS** — all API calls go to same origin in dev

#### New Files (32 files)

**Core infrastructure:**
- `src/lib/api.ts` — Fetch wrapper with Bearer auth, 401 auto-refresh, 429 rate limit handling
- `src/lib/socket.ts` — Singleton Socket.IO connection, IDENTIFY/READY/HEARTBEAT protocol
- `src/lib/utils.ts` — formatTimestamp, formatTypingText, getInitials, shouldGroupMessages, generateNonce
- `src/lib/queryClient.ts` — TanStack QueryClient (30s stale, 5min GC)
- `src/vite-env.d.ts` — Vite client types + ImportMetaEnv

**State stores (5):**
- `src/stores/auth.store.ts` — user, isAuthenticated, isLoading, login/logout/updateUser
- `src/stores/guilds.store.ts` — Map<guildId, Guild> + guildOrder + currentGuildId
- `src/stores/channels.store.ts` — Map<channelId, Channel> + channelsByGuild + currentChannelId
- `src/stores/messages.store.ts` — messagesByChannel, hasMore, typingByChannel, nonce dedup
- `src/stores/ui.store.ts` — sidebarCollapsed, memberPanelOpen, activeModal

**Providers:**
- `src/providers/SocketProvider.tsx` — Connects on auth, registers all gateway event handlers

**Hooks (3):**
- `src/hooks/useGuilds.ts` — TanStack Query → Zustand sync
- `src/hooks/useGuildChannels.ts` — Per-guild channel fetch
- `src/hooks/useMessages.ts` — useInfiniteQuery with cursor pagination

**UI components (6):**
- `src/components/ui/Button.tsx` — primary/ghost/danger variants, sm/md/lg sizes, loading spinner
- `src/components/ui/Input.tsx` — label, error, hint, password toggle, forwardRef
- `src/components/ui/Avatar.tsx` — Image or initials fallback
- `src/components/ui/GuildIcon.tsx` — Guild icon or initials, rounded square
- `src/components/ui/LoadingSpinner.tsx` — SVG animated spinner
- `src/components/ui/LoadingScreen.tsx` — Full-screen with Gratonite logo + pulse

**Guards (2):**
- `src/components/guards/RequireAuth.tsx` — Redirects to /login if not authenticated
- `src/components/guards/RequireGuest.tsx` — Redirects to / if already authenticated

**Sidebar (2):**
- `src/components/sidebar/GuildRail.tsx` — 72px rail with guild icons, home button, add button, active pill indicator
- `src/components/sidebar/ChannelSidebar.tsx` — 240px panel with guild name, categorized channels

**Messages (4):**
- `src/components/messages/MessageList.tsx` — Scroll-to-bottom, infinite scroll pagination, message grouping
- `src/components/messages/MessageItem.tsx` — Avatar + author + timestamp + content, grouped mode
- `src/components/messages/MessageComposer.tsx` — Auto-growing textarea, Enter to send, throttled typing indicator
- `src/components/messages/TypingIndicator.tsx` — Animated 3-dot bounce, auto-expire stale entries

**Layout (2):**
- `src/components/layout/TopBar.tsx` — Channel name + topic + member panel toggle
- `src/components/ErrorBoundary.tsx` — React error boundary with reload button

**Layouts (2):**
- `src/layouts/AuthLayout.tsx` — Centered glassmorphism card with logo
- `src/layouts/AppLayout.tsx` — 3-column grid: GuildRail | ChannelSidebar | Main

**Pages (6):**
- `src/pages/auth/LoginPage.tsx` — Email/username + password, auto-fetch profile on success
- `src/pages/auth/RegisterPage.tsx` — Email, display name, username (live availability), password, DOB (16+ validation)
- `src/pages/HomePage.tsx` — Welcome screen with mascot
- `src/pages/GuildPage.tsx` — Fetch channels, auto-redirect to first text channel, GUILD_SUBSCRIBE
- `src/pages/ChannelPage.tsx` — TopBar + MessageList + TypingIndicator + MessageComposer
- `src/pages/InvitePage.tsx` — Preview invite, accept, navigate to guild

**App entry:**
- `src/App.tsx` — Silent refresh on mount, React Router routes with guards
- `src/main.tsx` — React.StrictMode + ErrorBoundary + QueryClientProvider + BrowserRouter + SocketProvider

#### Modified Files
- `apps/web/package.json` — Added react-router-dom, zustand, @tanstack/react-query, socket.io-client, @gratonite/types
- `apps/web/vite.config.ts` — Added React plugin, path alias, proxy config, manual chunks
- `apps/web/tsconfig.json` — Added path aliases (@/*), DOM libs
- `apps/web/index.html` — Fixed script src (main.ts → main.tsx)
- `apps/web/src/styles.css` — Complete rewrite: design tokens, all component styles, responsive layout

#### Brand Assets
- `apps/web/public/gratonite-icon.png` — App icon (930KB) — used in auth pages, loading screen, guild rail home
- `apps/web/public/gratonite-mascot.png` — Mascot (1.15MB) — used in home page empty state

#### Build Output
```
dist/assets/main.css        14.28 KB │ gzip:  3.53 KB
dist/assets/main.js         30.99 KB │ gzip: 10.00 KB
dist/assets/state.js        40.84 KB │ gzip: 12.56 KB
dist/assets/socket.js       41.25 KB │ gzip: 12.89 KB
dist/assets/vendor.js      164.14 KB │ gzip: 53.58 KB
```

#### Route Structure
| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/login` | LoginPage | Guest only | Login form |
| `/register` | RegisterPage | Guest only | Registration form |
| `/invite/:code` | InvitePage | Optional | Invite preview + accept |
| `/` | HomePage | Required | Welcome / guild list |
| `/guild/:guildId` | GuildPage | Required | Guild view, auto-redirects to first channel |
| `/guild/:guildId/channel/:channelId` | ChannelPage | Required | Message view + composer |

#### Socket.IO Event Handlers
| Event | Handler |
|-------|---------|
| MESSAGE_CREATE | addMessage (nonce dedup) |
| MESSAGE_UPDATE | updateMessage |
| MESSAGE_DELETE | removeMessage |
| TYPING_START | setTyping |
| CHANNEL_CREATE/UPDATE/DELETE | channels store |
| GUILD_CREATE/UPDATE/DELETE | guilds store |
| GUILD_MEMBER_ADD/REMOVE | logged (member list refresh planned) |

#### Integration Fixes (post-commit)
After live testing against real API, 7 bugs found and fixed:
1. **Messages missing author info** — API returned `authorId` only; added `users + userProfiles` join in `hydrateMessage()` and `hydrateMessages()` with batch author fetch for list endpoint
2. **`editedAt` → `editedTimestamp`** — MessageItem and Composer referenced wrong field name; fixed to match `@gratonite/types` Message type
3. **Channel type enums** — GuildPage and ChannelSidebar compared `type === 0` but API returns `'GUILD_TEXT'` string enum; fixed all channel type constants
4. **Message ordering** — API returns newest-first (DESC), but store expects oldest-first; added `.reverse()` in `useMessages` query
5. **Guild addGuild dedup** — `guilds.has(guild.id)` checked new map (always true after set); fixed to check `state.guilds` (old state)
6. **Optimistic message author** — Composer's optimistic insert lacked `author` object; added from auth store user data
7. **Phase 6 DB migration partial failure** — `bot` column + 5 bot platform tables missing; manually applied via ALTER TABLE + CREATE TABLE

---

## What's NOT Done Yet

### Remaining Work
- **Phase 7B:** Desktop app (Electron) — functional screens, native menus, tray, auto-update
- **Phase 7C:** Mobile app (Expo) — navigation, screens, push notifications, deep links
- **Phase 7D:** Offline-first (WatermelonDB), tunnel/staging config
- **Phase 8:** Performance & Scale — CDN, horizontal scaling, message partitioning
- **Phase 9:** Polish & Launch — error tracking, analytics, marketing site integration

---

## Architecture Decisions (Quick Reference)

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo tool | Turborepo + pnpm | Best DX, fast builds, native workspace support |
| Backend framework | Express 5 | Stable, widely understood, async/await native |
| ORM | Drizzle ORM | SQL-first, low overhead, great TypeScript support |
| DB driver | postgres.js | Fastest Node.js PostgreSQL driver |
| Auth tokens | JWT (jose) + Redis refresh tokens | Stateless access, server-controlled refresh |
| Password hashing | Argon2id | OWASP recommended, memory-hard |
| ID system | Snowflake (64-bit) as strings | Sortable, distributed, contains timestamp |
| Bigint handling | Custom `bigintString` column type | Drizzle's built-in bigint mode:'string' doesn't work at runtime |
| Real-time | Socket.IO + Redis pub/sub | Fallback support, rooms, cross-server fanout |
| Voice/Video SFU | LiveKit | Open-source, WebRTC, self-hosted, excellent SDK |
| NAT traversal | Coturn | TURN/STUN for WebRTC connectivity through NATs |
| File storage | MinIO (S3-compatible) | Self-hosted, same API as AWS S3 |
| Logging | pino | Fastest Node.js structured logger |
| Validation | Zod | Runtime + TypeScript type inference |

---

## File Tree (as of Phase 5)

```
gratonite/
├── ARCHITECTURE.md           # Full architecture plan (2,516 lines)
├── PROGRESS.md               # This file
├── package.json              # Root monorepo config
├── pnpm-workspace.yaml       # Workspace definition
├── turbo.json                # Turborepo task config
├── tsconfig.base.json        # Shared TypeScript config
├── .gitignore, .prettierrc
├── docker-compose.yml        # PostgreSQL + Redis + MinIO + LiveKit + Coturn
│
├── packages/
│   ├── types/                # @gratonite/types
│   │   ├── package.json, tsconfig.json
│   │   └── src/
│   │       ├── index.ts, snowflake.ts, user.ts, permissions.ts
│   │       ├── guild.ts, channel.ts, message.ts, voice.ts
│   │       ├── events.ts, api.ts
│   │       (AvatarDecoration, ProfileEffect, GuildCustomCss, ThemePreset, ThemeInstall types added)
│   │
│   └── db/                   # @gratonite/db
│       ├── package.json, tsconfig.json, drizzle.config.ts
│       └── src/
│           ├── index.ts      # createDb() factory + barrel exports
│           ├── schema/
│           │   ├── index.ts  # Barrel export (includes helpers)
│           │   ├── helpers.ts # bigintString custom column type
│           │   ├── users.ts  # 13 tables + 8 enums (+avatarDecorations, profileEffects)
│           │   ├── guilds.ts # 20 tables + 9 enums (+guildCustomCss, themePresets, themeInstalls, themeVisibilityEnum)
│           │   ├── channels.ts # 12 tables + 4 enums
│           │   ├── messages.ts # 10 tables + 1 enum
│           │   └── voice.ts  # 3 tables + 1 enum (NEW Phase 3)
│           └── migrations/
│               ├── 0000_mean_master_chief.sql  # 39 tables
│               ├── 0001_first_spot.sql         # +3 voice tables
│               ├── 0003_silent_strong_guy.sql  # +7 tables (wiki/QA/events/FTS)
│               ├── 0004_striped_blue_shield.sql # +6 tables (automod/raid/reports/analytics)
│               ├── 0005_opposite_gamora.sql    # +5 tables (themes/brand/decorations)
│               └── meta/
│
└── apps/
    └── api/                  # @gratonite/api
        ├── package.json, tsconfig.json, .env.example
        └── src/
            ├── index.ts      # Express + Socket.IO + LiveKit server
            ├── env.ts        # Zod env validation (incl. LiveKit + TURN vars)
            ├── lib/
            │   ├── context.ts, logger.ts, snowflake.ts, redis.ts, minio.ts
            ├── middleware/
            │   ├── auth.ts, rate-limiter.ts, security-headers.ts
            └── modules/
                ├── auth/
                │   ├── auth.schemas.ts, auth.service.ts, auth.router.ts
                ├── users/
                │   └── users.router.ts
                ├── guilds/
                │   ├── guilds.schemas.ts, emojis.schemas.ts
                │   ├── guilds.service.ts, guilds.router.ts
                ├── channels/
                │   ├── channels.schemas.ts, channels.service.ts, channels.router.ts
                ├── messages/
                │   ├── messages.schemas.ts, messages.service.ts, messages.router.ts
                │   ├── link-preview.service.ts  # NEW (Phase 4 Part 2)
                ├── files/           # NEW (Phase 4 Part 1)
                │   ├── files.schemas.ts, files.service.ts, files.router.ts
                ├── threads/         # NEW (Phase 4 Part 1)
                │   ├── threads.schemas.ts, threads.service.ts, threads.router.ts
                ├── invites/
                │   ├── invites.service.ts, invites.router.ts
                ├── relationships/
                │   ├── relationships.service.ts, relationships.router.ts
                ├── search/          # NEW (Phase 4 Part 3A)
                │   ├── search.schemas.ts, search.service.ts, search.router.ts
                ├── wiki/            # NEW (Phase 4 Part 3A)
                │   ├── wiki.schemas.ts, wiki.service.ts, wiki.router.ts
                ├── qa/              # NEW (Phase 4 Part 3A)
                │   ├── qa.schemas.ts, qa.service.ts, qa.router.ts
                ├── events/          # NEW (Phase 4 Part 3A)
                │   ├── events.schemas.ts, events.service.ts, events.router.ts
                ├── automod/         # NEW (Phase 4 Part 3B)
                │   ├── automod.schemas.ts, automod.service.ts, automod.router.ts
                ├── moderation/      # NEW (Phase 4 Part 3B)
                │   ├── moderation.schemas.ts, moderation.service.ts, moderation.router.ts
                ├── analytics/       # NEW (Phase 4 Part 3B)
                │   ├── analytics.schemas.ts, analytics.service.ts, analytics.router.ts
                ├── themes/          # NEW (Phase 5)
                │   ├── themes.schemas.ts, themes.service.ts, themes.router.ts
                ├── brand/           # NEW (Phase 5)
                │   ├── brand.schemas.ts, brand.service.ts, brand.router.ts
                ├── profiles/        # NEW (Phase 5)
                │   ├── profiles.schemas.ts, profiles.service.ts, profiles.router.ts
                ├── voice/           # NEW (Phase 3)
                │   ├── voice.schemas.ts, voice.service.ts, voice.router.ts
                └── gateway/
                    └── gateway.ts   # Socket.IO auth + rooms + voice events
```

---

## Development Environment

- **Node.js:** v22.22.0
- **pnpm:** v10.30.0
- **OS:** macOS
- **Docker:** Required for PostgreSQL (port 5433), MinIO (9000/9001), LiveKit (7880), Coturn (3478)
- **Redis:** Port 6379 (may need SSH tunnel if Docker Redis conflicts)

### Commands

```bash
# Start infrastructure
docker-compose up -d

# Install dependencies
pnpm install

# Generate DB migrations
cd packages/db && npx drizzle-kit generate

# Run DB migrations
cd packages/db && npx drizzle-kit migrate

# Start API in dev mode (port 4000)
cd apps/api && node_modules/.bin/tsx src/index.ts
```
