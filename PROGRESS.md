# Gratonite — Development Progress

> **Last updated:** 2026-02-19
> **Current Phase:** Phase 1 — Foundation
> **Status:** Core scaffold created, dependencies not yet installed

---

## Quick Start for New Sessions

If you're a new AI model continuing this work, here's what you need to know:

1. **Architecture plan** is at `ARCHITECTURE.md` (2,516 lines, 31 sections) — the authoritative reference for all design decisions
2. **Project root** is at `/Users/ferdinand/Projects/untitled folder/`
3. **Stack:** TypeScript monorepo — Turborepo + pnpm workspaces
4. **Backend:** Node.js, Express 5, Socket.IO, Drizzle ORM, PostgreSQL 16, Redis 7, MinIO
5. **Auth:** JWT (jose, HS256) + Argon2id password hashing + refresh token rotation in Redis
6. **IDs:** Snowflake IDs (Twitter-style 64-bit, epoch Jan 1 2025)
7. **Code style:** `.prettierrc` — semi, single quotes, trailing commas, 100 printWidth

---

## What's Been Built (Phase 1)

### Monorepo Scaffold ✅
- `package.json` — Root monorepo config with turbo scripts
- `pnpm-workspace.yaml` — Workspace definition (`apps/*`, `packages/*`)
- `turbo.json` — Turborepo task config
- `tsconfig.base.json` — Shared TS config (ES2022, strict, bundler moduleResolution)
- `.gitignore`, `.prettierrc`

### Docker Compose ✅
- `docker-compose.yml` — PostgreSQL 16-alpine (5432), Redis 7-alpine (6379), MinIO (9000/9001)
- All services have health checks, persistent volumes, and auto-restart

### @gratonite/types Package ✅
- `packages/types/` — All shared TypeScript types
- **Files:** `snowflake.ts`, `user.ts`, `permissions.ts`, `guild.ts`, `channel.ts`, `message.ts`, `voice.ts`, `events.ts`, `api.ts`
- **Key types:** User, UserProfile, Guild, Channel (11 types including Wiki/Q&A), Message, VoiceState, ScreenShareSession
- **Permissions:** 42 bitwise flags with `hasPermission()` and `resolvePermissions()` helpers
- **Events:** Full Socket.IO typed events (ServerToClientEvents, ClientToServerEvents)

### @gratonite/db Package ✅
- `packages/db/` — Drizzle ORM schema + database connection
- **Schema files:** `users.ts`, `guilds.ts`, `channels.ts`, `messages.ts`
- **Tables (50+):** users, userProfiles, userSettings, userCustomStatus, connectedAccounts, relationships, sessions, userNotes, badges, userBadges, accountDeletionRequests, guilds, guildMembers, memberProfiles, guildRoles, userRoles, guildBrand, invites, bans, welcomeScreens, welcomeScreenChannels, auditLogEntries, channels, channelPermissions, threads, threadMembers, dmChannels, dmRecipients, channelReadState, messages, messageAttachments, messageReactions, messageReactionUsers, messageEditHistory, channelPins, polls, pollAnswers, pollVotes, scheduledMessages
- **Enums:** themePreference, presenceStatus, userTier, messageLayout, streamerMode, privacyLevel, visibility, connectedAccountProvider, relationshipType, verificationLevel, nsfwLevel, channelType, threadType, forumSortOrder, forumLayout, scheduledMessageStatus
- **Connection:** `createDb()` factory using postgres.js driver with connection pooling (max 20)

### API Server ✅
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
  - Register: email, username (2-32 lowercase alphanumeric + `.` + `_`), displayName (1-32), password (8-128, requires letter+number), dateOfBirth (16+ age check)
- `auth.service.ts` — Full auth service:
  - Argon2id hashing (64MB memory, 3 iterations, 4 parallelism)
  - JWT via jose (HS256, configurable expiry)
  - Refresh token rotation: 48 random bytes, SHA-256 hashed, stored in Redis with 7d TTL
  - Token family tracking for breach detection
  - Failed login tracking in Redis (15-min TTL)
  - `register()`, `login()`, `refresh()`, `checkUsernameAvailability()`
- `auth.router.ts` — Express routes:
  - `POST /api/v1/auth/register` — with rate limiter, Zod validation, username conflict detection, sets HttpOnly cookie
  - `POST /api/v1/auth/login` — with rate limiter, error status mapping (401/403/410/400)
  - `POST /api/v1/auth/refresh` — cookie or body token, rotation
  - `GET /api/v1/auth/username-available` — query param check
  - `POST /api/v1/auth/logout` — clears cookie

**Users Module (`src/modules/users/`):**
- `users.router.ts` — Express routes:
  - `GET /api/v1/users/@me` — Returns user + profile + settings
  - `PATCH /api/v1/users/@me` — Update displayName, bio, pronouns, accentColor
  - `PATCH /api/v1/users/@me/settings` — Update locale, theme, messageDisplay, etc. (13 allowed fields)

**Server Entry (`src/index.ts`):**
- Express + Socket.IO bootstrap with graceful shutdown
- Middleware chain: JSON parser, CORS, security headers, global rate limiter
- Health check at `/health`
- 404 handler, error handler
- Socket.IO connection logging

**Environment (`src/env.ts`):**
- Zod validation for all env vars with sensible development defaults
- Fails fast if misconfigured

---

## What's NOT Done Yet

### Immediate Next Steps (to complete Phase 1)
1. ⬜ Run `pnpm install` to install all dependencies
2. ⬜ Copy `.env.example` to `.env` in `apps/api/`
3. ⬜ Start Docker services (`docker compose up -d`)
4. ⬜ Generate database migrations (`pnpm db:generate`)
5. ⬜ Run database migrations (`pnpm db:migrate`)
6. ⬜ Test server startup (`pnpm --filter @gratonite/api dev`)
7. ⬜ Fix any TypeScript/import issues
8. ⬜ Git init + initial commit
9. ⬜ Create remaining shared packages:
   - `@gratonite/themes` — Design token definitions
   - `@gratonite/business-logic` — Permission resolution, mention parsing, encryption

### Phase 2: Core Communication (Next)
- Server/guild CRUD + roles + permissions (bitwise)
- Channel CRUD (text, voice, categories)
- Message system (send, edit, delete, reactions, pins)
- Real-time delivery via Socket.IO + Redis pub/sub
- File upload pipeline (MinIO + sharp)
- Friend system + DMs
- Full-text search

### Phase 3: Voice & Video
- LiveKit integration
- Screen share (4 modes), Go Live, DM calls, video calls

### Phases 4–9
See `ARCHITECTURE.md` Section 23 for full phase breakdown.

---

## Known TODOs in Code

| File | TODO | Priority |
|---|---|---|
| `auth.service.ts` | Encrypt dateOfBirth with AES-256-GCM before storage | HIGH |
| `auth.service.ts` | Implement 2FA verification (TOTP check) | MEDIUM |
| `auth.router.ts` | Add email verification flow (send verification email on register) | HIGH |
| `auth.router.ts` | Add Google OAuth routes | MEDIUM |
| `users.router.ts` | Add avatar/banner upload endpoints | MEDIUM |
| `db/schema/messages.ts` | Message table partitioning by channel_id hash | LOW (perf optimization) |
| `index.ts` | Add Socket.IO authentication (verify JWT on connection) | HIGH |
| `index.ts` | Add cookie-parser middleware for refresh token cookies | HIGH |

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
| ID system | Snowflake (64-bit) | Sortable, distributed, contains timestamp |
| Real-time | Socket.IO | Fallback support, rooms, namespaces |
| File storage | MinIO (S3-compatible) | Self-hosted, same API as AWS S3 |
| Logging | pino | Fastest Node.js structured logger |
| Validation | Zod | Runtime + TypeScript type inference |

---

## File Tree (as of Phase 1)

```
gratonite/
├── ARCHITECTURE.md           # Full architecture plan (2,516 lines)
├── PROGRESS.md               # This file
├── package.json              # Root monorepo config
├── pnpm-workspace.yaml       # Workspace definition
├── turbo.json                # Turborepo task config
├── tsconfig.base.json        # Shared TypeScript config
├── .gitignore
├── .prettierrc
├── docker-compose.yml        # PostgreSQL + Redis + MinIO
│
├── packages/
│   ├── types/                # @gratonite/types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts      # Barrel export
│   │       ├── snowflake.ts  # Snowflake ID system
│   │       ├── user.ts       # User, Profile, Settings types
│   │       ├── permissions.ts # 42 bitwise permission flags
│   │       ├── guild.ts      # Guild, Role, Brand types
│   │       ├── channel.ts    # Channel (11 types), Thread types
│   │       ├── message.ts    # Message, Embed, Attachment types
│   │       ├── voice.ts      # VoiceState, ScreenShare types
│   │       ├── events.ts     # Socket.IO typed events
│   │       └── api.ts        # API request/response types
│   │
│   └── db/                   # @gratonite/db
│       ├── package.json
│       ├── tsconfig.json
│       ├── drizzle.config.ts
│       └── src/
│           ├── index.ts      # createDb() factory
│           └── schema/
│               ├── index.ts  # Barrel export
│               ├── users.ts  # 11 tables + 8 enums
│               ├── guilds.ts # 11 tables + 2 enums
│               ├── channels.ts # 7 tables + 4 enums
│               └── messages.ts # 10 tables + 1 enum
│
└── apps/
    └── api/                  # @gratonite/api
        ├── package.json
        ├── tsconfig.json
        ├── .env.example
        └── src/
            ├── index.ts      # Express + Socket.IO server
            ├── env.ts        # Zod env validation
            ├── lib/
            │   ├── context.ts    # AppContext type
            │   ├── logger.ts     # pino logger
            │   ├── snowflake.ts  # ID generator
            │   └── redis.ts      # Redis clients
            ├── middleware/
            │   ├── auth.ts              # JWT auth
            │   ├── rate-limiter.ts      # Redis rate limiter
            │   └── security-headers.ts  # Security headers
            └── modules/
                ├── auth/
                │   ├── auth.schemas.ts  # Zod validation
                │   ├── auth.service.ts  # Auth business logic
                │   └── auth.router.ts   # Auth HTTP endpoints
                └── users/
                    └── users.router.ts  # User HTTP endpoints
```

---

## Development Environment

- **Node.js:** v22.22.0
- **pnpm:** v10.30.0
- **OS:** macOS
- **Docker:** Required for PostgreSQL, Redis, MinIO

### Commands

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Generate DB migrations
pnpm db:generate

# Run DB migrations
pnpm db:migrate

# Start API in dev mode
pnpm --filter @gratonite/api dev

# Run all in dev mode
pnpm dev
```
