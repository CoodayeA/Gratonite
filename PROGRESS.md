# Gratonite — Development Progress

> **Last updated:** 2026-02-19
> **Current Phase:** Phase 2 — Core Communication (Complete)
> **Status:** All Phase 2 modules built, tested end-to-end, and working

---

## Quick Start for New Sessions

If you're a new AI model continuing this work, here's what you need to know:

1. **Architecture plan** is at `ARCHITECTURE.md` (2,516 lines, 31 sections) — the authoritative reference for all design decisions
2. **Project root** is at `/Users/ferdinand/Projects/untitled folder/`
3. **Stack:** TypeScript monorepo — Turborepo + pnpm workspaces
4. **Backend:** Node.js, Express 5, Socket.IO, Drizzle ORM, PostgreSQL 16, Redis 7, MinIO
5. **Auth:** JWT (jose, HS256) + Argon2id password hashing + refresh token rotation in Redis
6. **IDs:** Snowflake IDs (Twitter-style 64-bit, epoch Jan 1 2025) — stored as **strings** throughout (see BigInt fix below)
7. **Code style:** `.prettierrc` — semi, single quotes, trailing commas, 100 printWidth
8. **Database:** PostgreSQL on port **5433** (not 5432), Redis on port 6379

### Critical: BigInt / Snowflake ID Handling

Drizzle ORM 0.45.1's `bigint({ mode: 'string' })` does NOT return strings at runtime — it always returns JavaScript `BigInt` which cannot be JSON-serialized. We use a **custom column type** `bigintString` (defined in `packages/db/src/schema/helpers.ts`) that properly maps PostgreSQL `bigint` ↔ JavaScript `string`. All schema files use `bigintString('column')` instead of `bigint('column', { mode: 'string' })`.

### Running the Server

```bash
# Start Docker services (PostgreSQL + MinIO — Redis may need SSH tunnel)
docker-compose up -d

# Install dependencies
pnpm install

# Generate + run migrations (39 tables)
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
- `docker-compose.yml` — PostgreSQL 16-alpine (5433), Redis 7-alpine (6379), MinIO (9000/9001)
- All services have health checks, persistent volumes, and auto-restart

#### @gratonite/types Package ✅
- `packages/types/` — All shared TypeScript types
- **Files:** `snowflake.ts`, `user.ts`, `permissions.ts`, `guild.ts`, `channel.ts`, `message.ts`, `voice.ts`, `events.ts`, `api.ts`
- **Key types:** User, UserProfile, Guild, Channel (11 types including Wiki/Q&A), Message, VoiceState, ScreenShareSession
- **Permissions:** 42 bitwise flags with `hasPermission()` and `resolvePermissions()` helpers
- **Events:** Full Socket.IO typed events (ServerToClientEvents, ClientToServerEvents)

#### @gratonite/db Package ✅
- `packages/db/` — Drizzle ORM schema + database connection
- **Schema files:** `helpers.ts` (bigintString custom type), `users.ts`, `guilds.ts`, `channels.ts`, `messages.ts`
- **Tables (39):** users, userProfiles, userSettings, userCustomStatus, connectedAccounts, relationships, sessions, userNotes, badges, userBadges, accountDeletionRequests, guilds, guildMembers, memberProfiles, guildRoles, userRoles, guildBrand, invites, bans, welcomeScreens, welcomeScreenChannels, auditLogEntries, channels, channelPermissions, threads, threadMembers, dmChannels, dmRecipients, channelReadState, messages, messageAttachments, messageReactions, messageReactionUsers, messageEditHistory, channelPins, polls, pollAnswers, pollVotes, scheduledMessages
- **Connection:** `createDb()` factory using postgres.js driver with connection pooling (max 20)

#### API Server Foundation ✅
- `apps/api/` — Express 5 + Socket.IO server

**Libraries (`src/lib/`):**
- `context.ts` — AppContext type: `{ db, redis, io, env }`
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

## What's NOT Done Yet

### Phase 3: Voice & Video (Next)
- LiveKit integration (voice channels)
- Screen share (entire screen, app window, browser tab)
- Go Live / game streaming with viewer count
- Video calls (camera, background blur, virtual backgrounds)
- 1:1 and group DM calls with ring UI
- Voice presence system
- Push-to-talk (desktop)

### Phase 4: Rich Features
- Threads + forum channels
- Wiki channels + Q&A channels
- Polls, scheduled messages, voice messages
- Link preview pipeline
- Custom emoji + stickers
- Soundboard
- Auto-moderation + raid protection
- File upload pipeline (MinIO + sharp)
- Full-text search

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
| File storage | MinIO (S3-compatible) | Self-hosted, same API as AWS S3 |
| Logging | pino | Fastest Node.js structured logger |
| Validation | Zod | Runtime + TypeScript type inference |

---

## File Tree (as of Phase 2)

```
gratonite/
├── ARCHITECTURE.md           # Full architecture plan (2,516 lines)
├── PROGRESS.md               # This file
├── package.json              # Root monorepo config
├── pnpm-workspace.yaml       # Workspace definition
├── turbo.json                # Turborepo task config
├── tsconfig.base.json        # Shared TypeScript config
├── .gitignore, .prettierrc
├── docker-compose.yml        # PostgreSQL + Redis + MinIO
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
│           │   └── messages.ts # 10 tables + 1 enum
│           └── migrations/
│               ├── 0000_mean_master_chief.sql  # 39 tables
│               └── meta/
│
└── apps/
    └── api/                  # @gratonite/api
        ├── package.json, tsconfig.json, .env.example
        └── src/
            ├── index.ts      # Express + Socket.IO server
            ├── env.ts        # Zod env validation
            ├── lib/
            │   ├── context.ts, logger.ts, snowflake.ts, redis.ts
            ├── middleware/
            │   ├── auth.ts, rate-limiter.ts, security-headers.ts
            └── modules/
                ├── auth/
                │   ├── auth.schemas.ts, auth.service.ts, auth.router.ts
                ├── users/
                │   └── users.router.ts
                ├── guilds/          # NEW (Phase 2)
                │   ├── guilds.schemas.ts, guilds.service.ts, guilds.router.ts
                ├── channels/        # NEW (Phase 2)
                │   ├── channels.schemas.ts, channels.service.ts, channels.router.ts
                ├── messages/        # NEW (Phase 2)
                │   ├── messages.schemas.ts, messages.service.ts, messages.router.ts
                ├── invites/         # NEW (Phase 2)
                │   ├── invites.service.ts, invites.router.ts
                ├── relationships/   # NEW (Phase 2)
                │   ├── relationships.service.ts, relationships.router.ts
                └── gateway/         # NEW (Phase 2)
                    └── gateway.ts   # Socket.IO auth + rooms + events
```

---

## Development Environment

- **Node.js:** v22.22.0
- **pnpm:** v10.30.0
- **OS:** macOS
- **Docker:** Required for PostgreSQL (port 5433) and MinIO (9000/9001)
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
