# Gratonite — Development Progress

> **Last updated:** 2026-02-19
> **Current Phase:** Phase 3 — Voice & Video (Complete)
> **Status:** All Phase 3 modules built, tested end-to-end, and working

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

# Generate + run migrations (42 tables)
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

---

## Phase 4 Part 1: Implementation Plan (IN PROGRESS)

> **Status:** Plan approved, implementation NOT started yet. Pick up from Step 1.
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

#### Step 1: Dependencies + MinIO Infrastructure
- Add to `apps/api/package.json`: `minio`, `multer`, `sharp`, `file-type`, `@types/multer`
- **New file:** `apps/api/src/lib/minio.ts` — MinIO client + `ensureBuckets()` for: uploads, emojis, stickers, avatars, banners, server-icons
- **Modify:** `apps/api/src/lib/context.ts` — Add `minio: Client` (from minio package) to AppContext
- **Modify:** `apps/api/src/index.ts` — Init MinIO client, call `ensureBuckets()`, add to ctx
- MinIO is already in Docker (port 9000), env vars (`MINIO_*`) already in `env.ts`

#### Step 2: File Upload Module
- **New:** `apps/api/src/modules/files/files.schemas.ts` — Upload validation (purpose enum, contextId, description, spoiler)
- **New:** `apps/api/src/modules/files/files.service.ts` — `uploadFile()` (validate magic bytes via file-type, enforce size limits per purpose, sharp pipeline: strip EXIF → resize → WebP → extract dimensions, upload to MinIO), `getFileUrl()`, `deleteFile()`, `processImage()`
- **New:** `apps/api/src/modules/files/files.router.ts` — `POST /files/upload` (multipart via multer memory storage), returns temp metadata in Redis (`pending_upload:{tempId}`, 15min TTL)
- **Modify:** `apps/api/src/middleware/rate-limiter.ts` — Add `uploadRateLimiter` (10/min/user)
- **Modify:** `apps/api/src/index.ts` — Register files router
- **Design:** Two-step upload — upload first to get temp ID, then reference when creating message

#### Step 3: Emoji + Stickers (DB + Types + Service)
- **Modify:** `packages/db/src/schema/guilds.ts` — Add `guildEmojis` table (id, guildId, name varchar(32), hash varchar(64), animated boolean, creatorId, available boolean, createdAt) and `guildStickers` table (id, guildId, name varchar(30), description varchar(100), hash varchar(64), formatType varchar(10), tags varchar(200), available boolean, creatorId, createdAt)
- Run `npx drizzle-kit generate && npx drizzle-kit migrate`
- **Modify:** `packages/types/src/guild.ts` — Add `GuildEmoji`, `GuildSticker` interfaces
- **Modify:** `packages/types/src/events.ts` — Add `GUILD_EMOJI_CREATE/UPDATE/DELETE`, `GUILD_STICKER_CREATE/UPDATE/DELETE`
- **New:** `apps/api/src/modules/guilds/emojis.schemas.ts` — Zod schemas
- **Modify:** `apps/api/src/modules/guilds/guilds.service.ts` — Add createEmoji, getGuildEmojis, deleteEmoji, createSticker, getGuildStickers, updateSticker, deleteSticker
- **Modify:** `apps/api/src/modules/guilds/guilds.router.ts` — Add 7 emoji/sticker routes with multer
- Emoji: max 256KB, 128x128, stored in MinIO `emojis` bucket
- Sticker: max 500KB, 320x320, stored in MinIO `stickers` bucket

#### Step 4: Threads + Forums
- **New:** `apps/api/src/modules/threads/threads.schemas.ts` — createThread (name, type, autoArchiveDuration, appliedTags, message for forum starter), updateThread, getThreads
- **New:** `apps/api/src/modules/threads/threads.service.ts` — createThread (validates parent channel type, forum tag validation, creates thread + starter message for forum, auto-adds creator), getThread, getActiveThreads, getArchivedThreads, updateThread, deleteThread, joinThread, leaveThread, getThreadMembers, archiveStaleThreads
- **New:** `apps/api/src/modules/threads/threads.router.ts` — 9 endpoints: POST/GET `/channels/:channelId/threads`, GET `.../archived`, GET/PATCH/DELETE `/threads/:threadId`, PUT/DELETE `/threads/:threadId/members/@me`, GET `.../members`
- **Modify:** `packages/types/src/events.ts` — Add `THREAD_MEMBER_ADD`, `THREAD_MEMBER_REMOVE`
- **Modify:** `apps/api/src/modules/messages/messages.router.ts` — Update channel access check to also look up threads (thread.id = channelId for messages)
- **Modify:** `apps/api/src/modules/messages/messages.service.ts` — Increment `threads.messageCount` when message created in thread
- **Modify:** `apps/api/src/index.ts` — Register threads router + start auto-archive setInterval (every 5 min)
- **Key design:** Thread messages use `thread.id` as `channelId` in messages table — existing messages service works for threads with minimal changes

#### Step 5: Polls
- **Modify:** `apps/api/src/modules/messages/messages.schemas.ts` — Add `pollInputSchema` (questionText, answers min 2 max 10, allowMultiselect, expiry), add `poll` + `attachmentIds` to createMessageSchema, make `content` optional (refine: at least one of content/attachments/stickers/poll)
- **Modify:** `apps/api/src/modules/messages/messages.service.ts` — Add createPoll, votePoll (single/multi-select, prevent double-vote), removeVote, getVotes, finalizePoll, hydratePollData (batch-fetch poll+answers for messages). Modify createMessage to handle poll type. Modify getMessages/getMessage to hydrate poll data.
- **Modify:** `packages/types/src/events.ts` — Add `POLL_VOTE_ADD`, `POLL_VOTE_REMOVE`, `POLL_FINALIZE`
- **Modify:** `apps/api/src/modules/messages/messages.router.ts` — Add 4 poll routes: PUT/DELETE `/channels/:channelId/polls/:pollId/votes/:answerId`, GET `.../votes`, POST `.../finalize`
- **Modify:** `apps/api/src/middleware/rate-limiter.ts` — Add `pollVoteRateLimiter` (10/5s/user)

#### Step 6: Integration — Message Attachments
- **Modify:** `apps/api/src/modules/messages/messages.service.ts` — In createMessage, when `attachmentIds` provided: fetch pending uploads from Redis, create `messageAttachments` rows linking to message, clean up Redis temp keys

#### Step 7: Test All Endpoints E2E
Test sequence: upload file → message with attachment → upload emoji → list emojis → upload sticker → create thread in text channel → send messages in thread → create forum channel with tags → create thread with appliedTags → archive/unarchive → join/leave thread → create poll message → vote → finalize → delete resources

#### Step 8: Update PROGRESS.md and commit

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

## What's NOT Done Yet (Beyond Phase 4 Part 1)

### Phase 4 Part 2: Rich Features (Remaining)
- Wiki channels + Q&A channels (types exist, need service/router)
- Scheduled messages (table exists, need Bull queue or setInterval)
- Voice messages (attachment flags exist, need recording endpoint)
- Link preview pipeline (embed extraction + image proxy)
- Auto-moderation + raid protection (need new tables)
- Full-text search (need GIN index on messages)
- Event scheduling system (need new tables)
- Server admin dashboard + analytics
- Moderation dashboard

### Phases 5–9
See `ARCHITECTURE.md` Section 23 for full phase breakdown.

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

## File Tree (as of Phase 3)

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
│   │
│   └── db/                   # @gratonite/db
│       ├── package.json, tsconfig.json, drizzle.config.ts
│       └── src/
│           ├── index.ts      # createDb() factory + barrel exports
│           ├── schema/
│           │   ├── index.ts  # Barrel export (includes helpers)
│           │   ├── helpers.ts # bigintString custom column type
│           │   ├── users.ts  # 11 tables + 8 enums
│           │   ├── guilds.ts # 11 tables + 2 enums
│           │   ├── channels.ts # 7 tables + 4 enums
│           │   ├── messages.ts # 10 tables + 1 enum
│           │   └── voice.ts  # 3 tables + 1 enum (NEW Phase 3)
│           └── migrations/
│               ├── 0000_mean_master_chief.sql  # 39 tables
│               ├── 0001_first_spot.sql         # +3 voice tables
│               └── meta/
│
└── apps/
    └── api/                  # @gratonite/api
        ├── package.json, tsconfig.json, .env.example
        └── src/
            ├── index.ts      # Express + Socket.IO + LiveKit server
            ├── env.ts        # Zod env validation (incl. LiveKit + TURN vars)
            ├── lib/
            │   ├── context.ts, logger.ts, snowflake.ts, redis.ts
            ├── middleware/
            │   ├── auth.ts, rate-limiter.ts, security-headers.ts
            └── modules/
                ├── auth/
                │   ├── auth.schemas.ts, auth.service.ts, auth.router.ts
                ├── users/
                │   └── users.router.ts
                ├── guilds/
                │   ├── guilds.schemas.ts, guilds.service.ts, guilds.router.ts
                ├── channels/
                │   ├── channels.schemas.ts, channels.service.ts, channels.router.ts
                ├── messages/
                │   ├── messages.schemas.ts, messages.service.ts, messages.router.ts
                ├── invites/
                │   ├── invites.service.ts, invites.router.ts
                ├── relationships/
                │   ├── relationships.service.ts, relationships.router.ts
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
