# Gratonite — The Ultimate Discord Replacement: Master Architecture Plan

## Context

This project aims to build the most feature-rich, customizable, open-source Discord replacement ever made. Core priorities: group voice/video calls, real-time messaging, per-server theming, a first-class bot/plugin system, and seamless cross-platform sync across Web, Windows, macOS, iOS, and Android. The architecture is designed to be self-hosted first, with a clear migration path to AWS/GCP/Azure as it scales.

**Stack decisions (confirmed by user):**
- TypeScript/JavaScript throughout (React, Node.js)
- WebRTC with self-hosted SFU for voice/video
- Self-hosted infra to start; cloud-managed later
- Full theming: custom CSS per server, emoji packs, channel layout, bot/plugin system

**Design philosophy:** Maximum customizability everywhere — no paywalled features, no artificial limits. If Discord locks it behind Nitro, we make it free. If Discord doesn't offer it, we add it.

**Research sources** (community feedback on Discord pros/cons, incorporated in Section 24):
- taggart-tech.com — Discord alternatives evaluation (functionality, openness, security, safety, decentralization)
- pumble.com — Discord limitations for professional/business use
- soatok.blog — Cryptography expert's analysis of Discord privacy/security failures and alternatives
- eesel.ai — Discord monetization, support, and UX pain points

---

## Repository Structure

**Monorepo: Turborepo + pnpm workspaces**

```
gratonite/
├── apps/
│   ├── web/            # Vite + React (primary web client)
│   ├── desktop/        # Electron (Windows + macOS)
│   ├── mobile/         # Expo + React Native (iOS + Android)
│   └── api/            # Node.js + Express/NestJS backend
├── packages/
│   ├── @gratonite/types    # Shared TypeScript types (Message, User, Guild, Channel…)
│   ├── @gratonite/api-client  # Socket.IO client + REST/tRPC client + hooks
│   ├── @gratonite/ui       # Shared headless components (.web.tsx / .native.tsx splits)
│   ├── @gratonite/hooks    # useChat, useVoiceCall, usePresence, useTheme, usePushNotifications
│   ├── @gratonite/themes   # Token-based theming system (CSS vars + Unistyles)
│   └── @gratonite/business-logic  # Pure TS: permission resolution, mention parsing, encryption
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 1. Backend Architecture

### Service Layout (Modular Monolith → Microservices path)

Start as a **modular monolith** — one Node.js process with independently organized modules. Voice is extracted as a **separate service from day one** due to its unique infra requirements.

```
api/
├── modules/
│   ├── auth/           # JWT, OAuth2, 2FA, sessions
│   ├── users/          # Profiles, presence, friends
│   ├── guilds/         # Servers, roles, permissions
│   ├── channels/       # Channel CRUD, permission overrides
│   ├── messages/       # Send, edit, delete, reactions, search
│   ├── files/          # Upload pipeline → MinIO
│   ├── notifications/  # Web Push (VAPID), FCM, APNs
│   ├── bots/           # OAuth2 apps, slash commands, webhooks
│   └── plugins/        # Client plugin registry
└── voice-service/      # Separate Node.js process (LiveKit)
    ├── rooms/          # Voice channel lifecycle
    ├── signaling/      # WebRTC offer/answer relay
    └── presence/       # Who is in which voice channel (Redis)
```

### API Layer: Hybrid tRPC + REST + WebSocket

| Protocol | Used For |
|---|---|
| **tRPC** | All primary client↔server calls (type-safe, web + desktop) |
| **REST** | OAuth2 bot auth flows, webhooks, public-facing endpoints |
| **Socket.IO** | Real-time events (messages, presence, typing, voice signals) |
| **LiveKit WebRTC** | Voice/video media streams |

### Authentication & User Registration

#### Registration Form Fields

| Field | Required | Rules | Stored In |
|---|---|---|---|
| **Email** | YES | Valid email format, unique, verified via confirmation link | `users.email` |
| **Username** | YES | 2–32 chars, **lowercase only**, alphanumeric + dots + underscores, unique globally, used for login & adding friends (e.g. `john.doe`) | `users.username` |
| **Display Name** | YES | 1–32 chars, any characters including uppercase, non-Latin, emoji. This is what others see in chat, servers, and member lists (e.g. `John 🎮`) | `user_profiles.display_name` |
| **Password** | YES | Min 8 chars, max 128, at least 1 letter + 1 number. Hashed with Argon2id before storage | `users.password_hash` |
| **Date of Birth** | YES | Must be 16+ years old at time of registration. Stored encrypted. **Never displayed publicly** | `users.date_of_birth` (encrypted) |

#### Username vs Display Name (Discord-faithful model)

| Aspect | Username | Display Name |
|---|---|---|
| **Uniqueness** | Globally unique — no two users share a username | Not unique — many users can have the same display name |
| **Format** | Lowercase only, alphanumeric + `.` + `_`, no spaces | Any case, Unicode, emoji, spaces allowed |
| **Purpose** | Login credential, adding friends (`@username`), account identification | How you appear in chat, servers, member lists, DMs |
| **Mutability** | Can be changed (rate-limited: 2 changes per hour) | Can be changed freely at any time |
| **Visibility** | Shown as secondary identifier (small text under display name, or on profile card) | Primary name visible everywhere in the UI |
| **Server override** | Cannot be overridden per-server | Can be overridden per-server via **server nickname** |

#### Display Name Resolution Order

The `@gratonite/profile-resolver` package resolves what name to show, in this priority:
1. **Server nickname** (`member_profiles.nickname`) — set by user or admin for a specific server
2. **Display name** (`user_profiles.display_name`) — user's global display name
3. **Username** (`users.username`) — ultimate fallback (always present)

#### Age Verification

- **Minimum age: 16 years old** — enforced at registration time
- Server-side validation: `today - date_of_birth >= 16 years` (calculated using UTC dates)
- Date of birth is **encrypted at rest** (AES-256-GCM, key from env var) — never exposed via API, never shown to other users
- Date of birth is collected once at registration and **cannot be changed** (contact support for corrections)
- No third-party age verification vendors (privacy-first approach, per research findings)
- Future: COPPA/GDPR compliance hooks — if deployment requires stricter age gates, configurable per-instance

#### Sign-Up Methods

**Method 1 — Email + Password Registration**:
1. User fills out form: Email, Username, Display Name, Password, Date of Birth
2. Client-side validation (instant feedback): email format, username availability check (debounced API call), password strength meter, age ≥ 16
3. Server-side validation (Zod schemas): all fields re-validated, username uniqueness (DB constraint), email uniqueness, age check
4. Password hashed with Argon2id (memory: 64MB, iterations: 3, parallelism: 4)
5. `users` row created with `email_verified = false`
6. `user_profiles` row created with `display_name` and default avatar (color-coded by `user_id % 6`)
7. Email verification link sent (JWT token, 24h expiry, single-use)
8. User redirected to "check your email" screen
9. On email link click → `email_verified = true` → user can now log in

**Method 2 — Google OAuth**:
1. User clicks "Continue with Google" → redirected to Google consent screen
2. On callback: extract email, name from Google profile
3. If email already exists → link Google account, log in
4. If new user → create account with Google email (pre-verified), prompt for Username + Display Name + Date of Birth (still required)
5. Age ≥ 16 still enforced — Google doesn't guarantee age data

#### Login Flow

**Login with Username + Password**:
1. User enters username (or email) + password
2. Server: look up user by username or email → verify password with Argon2id
3. If 2FA enabled → prompt for TOTP code
4. On success → issue access token + refresh token (see token architecture below)
5. Redirect to app home (`app.gratonite.app`)

**Login with Google OAuth**:
1. User clicks "Continue with Google"
2. On callback: match email to existing account → issue tokens
3. If no account exists → redirect to registration flow (pre-fill email)

**Failed login protections**:
- After 5 failed attempts on same email/username → require CAPTCHA (hCaptcha, privacy-respecting)
- After 10 failed attempts → temporary 15-min lockout
- Track in Redis: `failed_login:{identifier}` with TTL

#### Token Architecture

- **Access token**: JWT, 15-minute lifespan, verified without DB hit. Contains: `userId`, `username`, `tier`, `iat`, `exp`
- **Refresh token**: Opaque, stored in Redis, 7-day lifespan, **one-time use with rotation**
- **Storage**: Access token in memory; refresh token in HttpOnly Secure cookie
- **Breach detection**: Token family tracking — if a reused refresh token is detected, the entire family is revoked
- **2FA**: TOTP via `speakeasy`, backup codes hashed with Argon2
- **Bot auth**: Full OAuth2 authorization code flow, scoped bot tokens

### Permissions System (Discord-faithful)

Bitwise permission flags (`BIGINT` in PostgreSQL). Resolution order:
1. `@everyone` role permissions
2. Bitwise OR of all user's assigned roles
3. Channel-level role overrides (allow/deny)
4. Channel-level user overrides (highest priority)

Permissions cached in Redis with 24h TTL; invalidated on role change.

### Real-Time Messaging (Socket.IO + Redis Pub/Sub)

**Three-tier pub/sub topics:**
- `guild:{guildId}:events` — guild-wide events (member join, role change)
- `channel:{channelId}:messages` — per-channel messages, typing
- `user:{userId}:sync` — cross-device read state sync, DM notifications

**Message guarantees:**
- UUIDs as idempotency keys (stored in Redis, 24h TTL) for exactly-once delivery
- Server-assigned monotonic sequence numbers per channel for ordering
- Clients detect gaps and request resync on reconnect

---

## 2. User Profile & Identity System

The identity layer is split: `users` handles auth, `user_profiles` handles everything display/customization.

### Core Profile Data

**`users` table** (auth + identity — kept lean):
- `id` (snowflake bigint PK), `username` (unique, lowercase, 2–32 chars — used for login & adding friends), `email` (unique), `email_verified` (boolean, default false), `password_hash` (argon2id, nullable for OAuth-only users), `date_of_birth` (date, encrypted at rest — never exposed via API), `google_id` (nullable, for OAuth link), `mfa_secret`, `mfa_backup_codes`, `created_at`, `disabled`, `deleted_at`

**`user_profiles` table** (all display/customization):
- `display_name` (1–32 chars, any characters/emoji/Unicode — the primary name visible to others)
- `avatar_hash`, `avatar_animated` (boolean — true for GIF/APNG)
- `banner_hash`, `banner_animated` (boolean)
- `accent_color` (24-bit RGB int — tints profile card, role pills, compact-mode messages)
- `bio` (text, max 190 chars, markdown subset)
- `pronouns` (varchar(40))
- `avatar_decoration_id` (FK — animated ring/frame around avatar)
- `profile_effect_id` (FK — animated background effect on profile card)
- `theme_preference` (enum: `dark`, `light`, `system`, `oled_dark`)

### Per-Server Profiles

Users can override their avatar, banner, nickname, and bio **per server** — no paywall.

**`member_profiles` table** (extends `guild_members`):
- `user_id` + `server_id` (composite PK)
- `nickname`, `avatar_hash`, `avatar_animated`, `banner_hash`, `banner_animated`, `bio`

**Display name resolution order** (shared `@gratonite/profile-resolver` package used by all clients):
1. `member_profiles.nickname` (per-server nickname — set by user or admin)
2. `user_profiles.display_name` (global display name — what the user chose at registration)
3. `users.username` (ultimate fallback — always present, lowercase identifier)

**Other profile field resolution** (avatar, banner, bio):
1. `member_profiles` fields (per-server override)
2. `user_profiles` fields (global profile)

### Custom Status

Stored separately because it changes frequently and is ephemeral.

**`user_custom_status` table**: `user_id` (PK), `text` (128 chars), `emoji_id`/`emoji_name`, `expires_at`
- Cached in Redis with TTL matching `expires_at` (read on every user popover / member list render)

### Activity Status (Rich Presence)

**`user_activity_status`** (transient — primarily in Redis, persisted for history):
- `type`: `playing`, `streaming`, `listening`, `watching`, `competing`, `custom`
- `name` (game/app), `details`, `state`, `url` (stream URL)
- `timestamps_start`/`end`, `assets_large_image`/`text`, `assets_small_image`/`text`
- `party_id`, `party_size_current`/`max`

On desktop (Electron): integrates with local process detection for game activity.
On mobile: integrates with connected account APIs (Spotify, etc.).

### Connected Accounts

**`connected_accounts` table**: `provider` (enum: github, twitter/x, spotify, twitch, youtube, steam, reddit, playstation, xbox, epic_games), `provider_account_id`, `provider_username`, `visibility` (everyone / friends / none), `show_activity`, encrypted `access_token` + `refresh_token` for activity polling.

### Badges & Flair

**`badges` table** (system-defined): `name`, `description`, `icon_hash`, `icon_animated`, `bit_position` (for bitfield on public API), `sort_order`
**`user_badges` table**: `user_id`, `badge_id`, `granted_at`, `metadata` (JSONB)

Examples: Early Supporter, Bug Hunter, Server Booster, Bot Developer, Staff

### Avatar Decorations & Profile Effects

**`avatar_decorations` table**: animated Lottie/APNG ring around avatar (MinIO-stored)
**`profile_effects` table**: animated background on profile card — `type` (static_gradient, animated_particles, animated_gradient), `config` (JSONB — CSS vars, animation params)

### Profile Popover Card

Single API call (or Socket.IO cache hit) returns:
- Profile + member profile (avatar, banner, display name, username, pronouns, bio, accent_color)
- Roles in current server (with colors + icons)
- Custom status + activity status
- Connected accounts (filtered by visibility)
- Badges
- Mutual servers + mutual friends (expensive — pre-computed in Redis, `mutual:{user_a}:{user_b}`, 5-min TTL)
- "Member since" date, "Gratonite member since" date
- Private note (`user_notes` table: `author_id` + `target_id` → `content`, max 256 chars)

### Avatar & Banner Processing Pipeline

Upload flow: `POST /api/v1/users/@me/avatar` (multipart) →
1. Validate: JPEG/PNG/GIF/APNG/WebP, max 10MB, min 128x128 (avatars) / 600x240 (banners)
2. Generate deterministic hash: `sha256(userId + timestamp + random)[:32]`, prefix `a_` if animated
3. Bull queue job (via `sharp`):
   - Strip EXIF metadata (GPS, camera info — privacy)
   - **Avatar sizes**: 16, 32, 64, 128, 256, 512, 1024px (square, center-crop)
   - **Banner sizes**: 480w, 600w, 960w, 1920w (maintain aspect)
   - Animated: static thumbnail (first frame) at each size + animated at 128/256px
   - Convert static → WebP, keep GIF for animated
   - Compute **BlurHash** (20 chars) for placeholder rendering
   - Upload all variants to MinIO: `avatars/{user_id}/{hash}_{size}.webp`
4. Update `user_profiles.avatar_hash`
5. Broadcast profile update via Socket.IO (debounced, max 1/5s)

**CDN URL pattern** (deterministic, client-side): `https://cdn.gratonite.app/avatars/{user_id}/{hash}.webp?size=128`

---

## 3. Social Features

### Relationships (Friends, Blocks)

**`relationships` table**: `user_id`, `target_id`, `type` (friend / blocked / pending_incoming / pending_outgoing), `nickname` (friend-specific), `created_at`

**Friend request flow**: User A sends → creates `(A,B,pending_outgoing)` + `(B,A,pending_incoming)` → B accepts → both become `friend` → B declines → both deleted

**Block behavior**: A blocks B → B cannot DM A, cannot add A as friend, A's messages hidden client-side for B
**Friend limit**: 1000

### Direct Messages

DM channels modeled as channels with `type = DM` or `GROUP_DM`.

**`dm_channels` table**: `owner_id` (group DMs), `icon_hash`, `name`, `last_message_id`
**`dm_recipients` table**: `channel_id` + `user_id`

- 1:1 DMs: exactly 2 recipients, unique per pair
- Group DMs: 2–10 recipients, owner can rename/change icon/add/remove members

**Privacy settings** (on `user_settings`):
- `allow_dms_from`: everyone / friends / server_members / nobody
- `allow_group_dm_invites_from`: everyone / friends / nobody
- `allow_friend_requests_from`: everyone / server_members / nobody

### Friend Activity Feed

Sidebar panel showing what friends are playing/listening/streaming. Data sourced from `user_activity_status` in Redis, filtered to `type = 'friend'` relationships. Updates fan-out via Socket.IO to all online friends on presence change.

---

## 4. Database Layer

### PostgreSQL 16 (Primary + 2 Read Replicas in prod)

**ORM: Drizzle ORM + Drizzle Kit** (SQL migrations you review, supports PostgreSQL-specific features like partitioning/custom types, lower runtime overhead than Prisma). Migrations stored in `packages/db/migrations/`, timestamped SQL files. CI runs `drizzle-kit check`. Production runs migrations in a Kubernetes init container.

**Core tables (expanded):** `users` (username, email, email_verified, password_hash, date_of_birth, google_id, mfa), `user_profiles` (display_name, avatar, banner, bio, pronouns, accent_color, theme_preference), `user_custom_status`, `user_activity_status`, `connected_accounts`, `badges`, `user_badges`, `avatar_decorations`, `profile_effects`, `user_notes`, `user_settings`, `user_keybinds`, `relationships`, `dm_channels`, `dm_recipients`, `guilds`, `guild_members`, `member_profiles`, `guild_roles`, `user_roles`, `channels`, `channel_permissions`, `threads`, `thread_members`, `messages`, `message_attachments`, `message_embeds` (JSONB on messages), `message_reactions`, `message_reaction_users`, `message_edit_history`, `channel_pins`, `channel_read_state`, `polls`, `poll_answers`, `poll_votes`, `scheduled_messages`, `invites`, `bans`, `auto_mod_rules`, `raid_config`, `audit_log_entries`, `reports`, `welcome_screens`, `welcome_screen_channels`, `soundboard_sounds`, `stage_instances`, `server_boosts`, `bots`, `bot_subscriptions`, `oauth2_apps`, `oauth2_codes`, `oauth2_tokens`, `slash_commands`, `notification_subscriptions`, `notification_preferences`, `feature_flags`, `experiments`, `experiment_assignments`, `sessions`

### Messages Table (expanded)

- **Partitioned by `channel_id` hash** (not by date) — queries are overwhelmingly "messages in channel X ordered by time", so all messages for a channel must be co-located. 64–128 hash partitions. Primary index: `(channel_id, id DESC)`.
- `content` (max 4000 chars — no artificial Nitro paywall)
- `type` (integer: default, reply, member_join, boost, pin, thread_starter, application_command, etc.)
- `flags` (bitfield: CROSSPOSTED, SUPPRESS_EMBEDS, EPHEMERAL, HAS_THREAD, IS_VOICE_MESSAGE, SUPPRESS_NOTIFICATIONS)
- `message_reference` (JSONB — for replies/forwards/crossposts: `{message_id, channel_id, guild_id}`)
- `referenced_message` (denormalized snapshot JSONB — the replied-to message, avoids extra query)
- `embeds` (JSONB array, max 10 per message)
- `mentions` (bigint[]), `mention_roles` (bigint[]), `mention_everyone` (boolean)
- `sticker_ids` (bigint[]), `poll_id` (FK), `nonce` (client dedup)
- `pinned`, `tts`, `edited_timestamp`, `deleted_at` (soft delete)
- GIN index on `tsvector` for full-text search

### Message Embeds (rich link previews + bot custom embeds)

Stored as JSONB array on `messages.embeds`. Each embed: `type` (rich/image/video/article/link), `title`, `description` (max 4096), `url`, `color` (24-bit int), `footer`, `image`, `thumbnail`, `video`, `author`, `fields` (max 25).

**Link preview pipeline**: URL detected in message → Bull queue → fetch OpenGraph/Twitter Card metadata (5s timeout, respect robots.txt) → download & re-host images through MinIO (prevents IP leaking) → update `embeds` JSONB → broadcast update via Socket.IO.

### Message Attachments

**`message_attachments` table**: `filename`, `description` (alt text for accessibility, 1024 chars), `content_type`, `size`, `url`, `proxy_url`, `height`/`width`, `duration_secs` (audio/video), `waveform` (base64 audio waveform for voice messages), `flags` (IS_SPOILER, IS_VOICE_MESSAGE)

**Voice messages**: Attachments with IS_VOICE_MESSAGE flag + waveform + duration. Client records via Web Audio API / Expo AV, encodes OGG Opus, uploads as attachment.

### Message Reactions

**`message_reactions` table** (denormalized counts): `message_id`, `emoji_id`/`emoji_name`, `count`, `burst_count` (super reactions)
**`message_reaction_users` table** (who reacted): `message_id`, `emoji`, `user_id`, `burst` (boolean)

Only query `message_reaction_users` when user clicks to see who reacted — avoids loading thousands of rows.

### Polls

**`polls` table**: `question_text`, `allow_multiselect`, `expiry`, `finalized`
**`poll_answers` table**: `text`, `emoji`, `vote_count` (denormalized)
**`poll_votes` table**: `poll_id`, `answer_id`, `user_id`

### Pinned Messages

**`channel_pins` table**: `channel_id`, `message_id`, `pinned_by`, `pinned_at`. Limit: 50 pins/channel.

### Edit History

**`message_edit_history` table**: `message_id`, `content` (previous), `embeds` (previous), `edited_at`
Per-server toggle: `show_edit_history` (boolean, default false). When true, users can click "edited" to see previous versions.

### Scheduled Messages

**`scheduled_messages` table**: `channel_id`, `author_id`, `content`, `embeds`, `attachments`, `scheduled_for`, `status` (pending/sent/failed/cancelled). Bull delayed job checks every 30s for due messages.

### Redis 7 (Pub/Sub + Hot Cache)

| Key Pattern | Contents | TTL |
|---|---|---|
| `user:{id}:devices` | Active devices + status | 30s (heartbeat) |
| `presence:{user_id}` | Hash: status, activity, client info | 30s |
| `guild:{id}:online_users` | Set of online user IDs | 30s |
| `channel:{id}:messages:recent` | Last 50 messages | 1h |
| `guild:{id}:roles` | Role permission bitmasks | 24h |
| `user:{id}:read_state` | Hash: channelId → last read msg | No TTL (persisted on logout) |
| `user:{id}:custom_status` | Custom status text + emoji | TTL = expires_at |
| `mutual:{userA}:{userB}` | Mutual servers + friends | 5min |
| `message:processed:{id}` | Deduplication key | 24h |
| `auth:refresh:{token_hash}` | Refresh token metadata | 7d |
| `slowmode:{channelId}:{userId}` | Last message timestamp | = rate_limit seconds |
| `failed_login:{email}` | Failed attempt count | 15min |
| `raid_monitor:{serverId}` | Sorted set of join timestamps | 10min |

### File Storage: MinIO (S3-compatible)

**Buckets:** `avatars` (10MB, WebP + animated), `banners` (10MB, WebP + animated), `uploads` (25MB/file), `emojis` (256KB, animated WebP), `stickers` (500KB, animated WebP/Lottie), `soundboard` (1MB, OGG), `server-icons`, `role-icons`, `avatar-decorations`, `profile-effects`, `cdn`

**Pipeline:** Upload → validate (magic bytes via `file-type`, not just Content-Type header) → `sharp` for resize/format + EXIF strip + BlurHash compute → MinIO → CDN (Nginx cache proxy). Background `Bull` queue handles thumbnail generation async.

### Search: PostgreSQL FTS → Meilisearch

- **Phase 1**: PostgreSQL `tsvector` with GIN index (zero extra infra)
- **Phase 2** (>1M messages): Meilisearch self-hosted, async-indexed via Bull queue, synced nightly via cron

---

## 5. Server & Guild Customization

### Server Branding Assets

Extend `guilds` table with:
- `icon_hash`, `icon_animated` — server icon (animated GIF free, no paywall)
- `banner_hash`, `banner_animated` — shown at top of channel list sidebar
- `splash_hash` — invite splash background image
- `discovery_splash_hash` — shown in server discovery listing
- `description` (max 1000 chars, for discovery)
- `vanity_url_code` (unique, e.g. `gratonite.app/invite/cool-server`)
- `preferred_locale`, `nsfw_level`

### Server Invite System

**`invites` table**: `code` (10-char alphanumeric or vanity), `server_id`, `channel_id`, `inviter_id`, `max_uses` (nullable = unlimited), `uses`, `max_age_seconds` (nullable = never expires), `temporary` (boolean — kicked if they disconnect without a role), `created_at`, `expires_at`

### Welcome Screen

**`welcome_screens` table**: `server_id` (PK), `description` (140 chars), `enabled`
**`welcome_screen_channels` table**: `channel_id`, `description` (50 chars), `emoji`, `sort_order`

Shown to new members on first join — customizable list of recommended channels with descriptions.

### Server Boost System

**`server_boosts` table**: `server_id`, `user_id`, `started_at`, `expires_at`

Tier thresholds (configurable per deployment — or server owners can unlock all perks for free):
- **Tier 1** (2 boosts): +50 emoji slots, 128kbps audio, server banner
- **Tier 2** (7 boosts): +100 emoji slots, 256kbps audio, server splash, role icons, 50MB upload
- **Tier 3** (14 boosts): +200 emoji slots, 384kbps audio, vanity URL, animated server icon, 100MB upload, custom sticker slots

Since self-hosted/open-source, boost perks are a social incentive mechanism — server admins can unlock everything via config.

### Role Icons

Extend `guild_roles` table: `icon_hash`, `icon_animated`, `unicode_emoji` (alternative to custom icon). Displayed next to username in member list and chat.

### Channel Types (expanded beyond text/voice)

| Type | Enum | Description |
|---|---|---|
| Text | `GUILD_TEXT` | Standard text channel |
| Voice | `GUILD_VOICE` | Voice + optional video |
| Category | `GUILD_CATEGORY` | Collapsible channel folder |
| Announcement | `GUILD_ANNOUNCEMENT` | Crosspostable to following servers |
| Stage | `GUILD_STAGE_VOICE` | Speaker/audience model (talk shows, AMAs) |
| Forum | `GUILD_FORUM` | Thread-only channel with tags and sorting |
| Media | `GUILD_MEDIA` | Gallery-view media channel |
| DM | `DM` | 1:1 direct message |
| Group DM | `GROUP_DM` | 2–10 person group DM |
| Wiki | `GUILD_WIKI` | Persistent knowledge base with editable pages (NEW) |
| Q&A | `GUILD_QA` | Question + answer format with accepted answers and voting (NEW) |

### Forum Channels

Additional columns on `channels` for forum type: `default_auto_archive_duration`, `default_thread_rate_limit_per_user`, `default_sort_order` (latest_activity / creation_date), `default_forum_layout` (list / gallery), `available_tags` (JSONB array of `{id, name, moderated, emoji_id, emoji_name}`), `default_reaction_emoji`

### Threads

**`threads` table**: `id` (snowflake, treated as channel), `parent_id` (FK to parent channel), `owner_id`, `name`, `type` (public/private/announcement), `archived`, `auto_archive_duration`, `locked`, `invitable`, `message_count`, `member_count`, `applied_tags` (for forum threads), `pinned` (forum pin to top)
**`thread_members` table**: `thread_id`, `user_id`, `join_timestamp`

### Stage Channels

**`stage_instances` table**: `server_id`, `channel_id`, `topic` (120 chars), `privacy_level` (public/guild_only), `scheduled_event_id`

Uses LiveKit under the hood. Speakers managed via mute/unmute state. Audience members join muted, "raise hand" to request speaking — moderators approve.

### Soundboard

**`soundboard_sounds` table**: `server_id`, `name` (32 chars), `sound_hash` (MinIO), `volume` (0.0–1.0), `emoji`, `uploader_id`, `available`

Played through LiveKit: client sends Socket.IO event → server fetches sound from MinIO → injects as short audio track into the voice room.

### Server Discovery

Public server directory for discoverability:
- Servers opt-in to discovery with `discoverable` flag
- Categories/tags for filtering (gaming, music, programming, etc.)
- Ranked by member count + activity score
- Discovery splash image + description displayed on listing

---

## 6. Voice & Video

### LiveKit (self-hosted)

LiveKit is chosen over raw mediasoup for dramatically lower engineering overhead at the start while still providing excellent performance (100–150 video consumers/CPU core — sufficient until very large scale). Migration path to mediasoup exists if needed.

**Architecture:**
- **One LiveKit Room per voice channel** (persistent while anyone is connected)
- **Guild-per-voice-server model**: All voice channels within a guild use the same LiveKit instance, simplifying presence tracking
- **Voice presence in Redis**: `voice:channel:{id}` = Set of user IDs; expire with heartbeat
- **Signal relay**: WebSocket signaling via main API relays offer/answer/ICE to LiveKit
- **TURN/STUN**: Coturn self-hosted for NAT traversal

**Core Features:** Noise suppression, echo cancellation, voice activity detection (VAD), screen share, up to 50 participants per channel (SFU is economically viable at this scale; MCU is not), server soundboard integration, per-user volume control, voice isolation (AI background noise removal)

### Screen Share & Streaming

Screen sharing works in **all voice contexts**: server voice channels, 1:1 DM calls, and group DM calls.

**Screen Share Modes:**

| Mode | Use Case | Description |
|---|---|---|
| **Entire Screen** | General sharing | Captures full monitor output. User selects which monitor (multi-monitor support) |
| **Application Window** | Focused sharing | Captures a single application window. Other windows stay private |
| **Browser Tab** | Web content | Chrome/Edge tab sharing with audio (via `getDisplayMedia` `preferCurrentTab` option) |
| **Game Capture** | Game streaming | Optimized path: higher FPS, lower latency, game overlay compatible. Desktop only (Electron) |

**Quality Tiers:**

| Tier | Resolution | FPS | Bitrate | Available To |
|---|---|---|---|---|
| Standard | 720p | 30fps | ~2.5 Mbps | Free users |
| High | 1080p | 60fps | ~6 Mbps | Crystalline |
| Source | Up to 4K | 60fps | ~15 Mbps | Crystalline (screen share only, not webcam) |

Quality auto-adjusts based on network conditions (LiveKit's adaptive bitrate). Users can manually select quality cap.

**Screen Share UX:**

1. **Start sharing**: Click "Share Screen" button in voice controls → OS-native picker (via `getDisplayMedia()` on web, Electron `desktopCapturer` on desktop) → select source → sharing begins
2. **Preview**: Small self-preview thumbnail in corner showing what others see (PiP-style, draggable)
3. **Viewer experience**: Shared screen appears as the primary view in the voice channel. Viewers can:
   - **Pop out** to separate resizable window (Electron: `BrowserWindow`, Web: `window.open`)
   - **Fullscreen** the stream
   - **Picture-in-Picture** (PiP) mode — stream floats over other apps/tabs
   - **Theater mode** — stream fills the message area, chat moves to a side panel
   - **Grid mode** — when multiple streams, tiles them in a grid layout
4. **Audio sharing**: Option to share system audio with screen (Web: `audio: true` in `getDisplayMedia()`, Electron: virtual audio device or loopback capture). Essential for game/video sharing.
5. **Annotations/Drawing** (future stretch goal): Draw on shared screen in real-time for presentations
6. **Pause**: Pause stream without disconnecting (shows last frame, saves bandwidth)

**Go Live (Game Streaming):**

Server voice channels support a "Go Live" feature for game streaming:
- User clicks "Go Live" → selects game window (auto-detected from running processes on desktop)
- Stream appears in voice channel with a special "LIVE" badge
- Other users in the channel see a "Watch Stream" button
- Stream viewer count shown next to the LIVE badge
- Viewers can control their own volume for the stream audio independently of voice chat
- Streamer can see viewer list

**1:1 and Group DM Calls:**

DM calls are lightweight voice/video sessions without a persistent voice channel:
- **Initiate**: Click phone/video icon in DM → ring recipient(s) → they accept/decline
- **Ring UI**: Full-screen incoming call overlay with caller avatar, name, Accept (green) / Decline (red) buttons. Custom ringtone (from sound pack).
- **Mobile**: Uses `react-native-callkeep` for native call UI:
  - iOS: CallKit integration (incoming call appears on lock screen, Siri announces caller)
  - Android: ConnectionService (call appears in notification shade, heads-up notification)
- **Group DM calls**: Up to 10 participants. Same voice/video/screen share features as server voice channels.
- **Call controls**: Mute, deafen, video toggle, screen share, disconnect, speaker selection
- **PiP on mobile**: Video call minimizes to floating PiP window when navigating away
- **Call duration**: Shown in call UI. Logged for personal history (not shared).

**Video Calls:**

| Feature | Details |
|---|---|
| **Camera selection** | Dropdown to pick camera device |
| **Mirror self-view** | Toggle to flip your own preview (not what others see) |
| **Background blur** | AI-powered background blur (TensorFlow.js BodyPix model on web, CoreML on iOS, ML Kit on Android) |
| **Virtual backgrounds** | Upload custom image or select from presets (solid colors, gradients, scenes) |
| **Grid/Speaker view** | Toggle between grid layout (all participants equal) and speaker view (active speaker large, others small) |
| **Spotlight** | Pin a specific user's video as the large view (useful for presentations) |
| **Webcam + screen share** | Share screen AND show webcam simultaneously (webcam appears as small overlay on the stream) |
| **Video off placeholder** | When camera is off, show avatar with accent-colored ring + voice activity indicator |

**Technical Implementation:**
- Web: `navigator.mediaDevices.getDisplayMedia()` for screen capture, `getUserMedia()` for camera/mic
- Electron: `desktopCapturer.getSources()` for window/screen selection (bypasses OS picker, gives custom UI)
- LiveKit handles: encoding, SFU routing, adaptive bitrate, simulcast (multiple quality layers sent simultaneously, viewers receive the layer matching their bandwidth)
- Mobile screen share: iOS ReplayKit broadcast extension, Android MediaProjection API
- Codec: VP9 (preferred for quality/compression) with H.264 fallback (hardware-accelerated on most devices)

---

## 7. Cross-Platform Apps

### Web (`apps/web`) — Vite + React
- Primary client; all features available first here
- CSS custom properties for real-time theme switching (no reload)
- Service Worker for Web Push notifications (VAPID)
- PWA installable as lightweight "app"

### Desktop (`apps/desktop`) — Electron
- Shares all React components from `apps/web` via Electron's Chromium renderer
- **Main process features**: system tray, global push-to-talk keybind (`globalShortcut`), native OS notifications, audio device selection (IPC), auto-updater (`electron-updater`), game overlay (future)
- `contextBridge` + preload script strictly limits renderer→main IPC surface
- Targets Windows (.exe NSIS installer) and macOS (.dmg, notarized)

### Mobile (`apps/mobile`) — Expo + React Native (with dev builds)
- **Expo** with development builds (not bare RN — faster iteration, simpler CI)
- `react-native-webrtc` for voice/video
- `react-native-callkeep` (CallKit on iOS, ConnectionService on Android) for native call UI
- `expo-notifications` + FCM (Android) + APNs (iOS) for background push
- `WatermelonDB` for offline-first local message cache + sync
- Deep linking: `gratonite://invite/{code}`, `gratonite://dm/{userId}` etc.
- Background audio: Foreground Service (Android) + Background Modes (iOS)

### Shared State Management
- **Zustand** — client/UI state (auth, UI preferences, active channel)
- **TanStack Query** — server state (messages, guild data, user lists); real-time updates injected via WebSocket event handlers that call `queryClient.setQueryData`
- **WatermelonDB** — mobile-only offline cache; syncs with server on reconnect

---

## 8. Design Identity & Theming System

### The Problem: Every Chat App Looks the Same

Discord, Slack, Teams, Element, Guilded — they all share the same DNA: flat dark-grey surfaces, generic sans-serif fonts, identical 3-column layouts, no depth, no texture, no personality. Gratonite must **look and feel like nothing else** from the moment someone opens it. The default experience should make people say *"this feels different"* before they customize anything.

### Gratonite's Default Visual Identity — "Crystalline Design Language"

Named after the premium tier, the **Crystalline design language** defines Gratonite's signature look. It's not flat, it's not skeuomorphic — it's **layered, luminous, and alive**.

#### Core Design Principles

1. **Depth Through Layers** — UI panels are translucent glass surfaces stacked at different depths. You can see the server's background gradient softly bleeding through panels. Glassmorphism with purpose, not decoration.

2. **Living Surfaces** — Subtle ambient animations everywhere. Server backgrounds can gently shift gradient colors. Hover states have micro-physics (spring easing, not linear). Typing indicators pulse organically. The UI feels like it's breathing, not static.

3. **Bold Color, Not Grey** — The default palette isn't "dark grey with a purple accent." It's a rich, deep color space: deep indigo backgrounds, warm amber accents, soft violet highlights. Every server can have its own bold color identity — Gratonite encourages vibrancy.

4. **Textural Richness** — Noise grain overlays on surfaces for organic depth. Subtle mesh gradients behind panels. Fine dot-grid patterns as optional textures. The interface has *tactile quality* — it looks like you could touch it.

5. **Generous Typography** — Not cramming 14px everywhere. Display headings use a distinctive display font (e.g., **Outfit**, **Satoshi**, or **Cabinet Grotesk** — something with personality, NOT Inter/Roboto). Body text in a clean variable font. Generous line heights. Text *breathes*.

6. **Signature Transitions** — Every state change is choreographed. Server switching has a smooth crossfade with the new server's color palette washing in. Channels slide, don't snap. Modals scale up from their trigger point, not from center. Messages cascade in with staggered timing, not all at once.

#### Default Color Palette — "Obsidian"

The ship-with-it default theme that defines Gratonite's brand:

| Token | Value | Purpose |
|---|---|---|
| `--bg-deep` | `#0B0E17` | Deepest background (behind everything) |
| `--bg-base` | `#12162B` | Primary surface (message area, main content) |
| `--bg-elevated` | `#1A1F3A` | Elevated surfaces (sidebar, cards, modals) |
| `--bg-overlay` | `rgba(26, 31, 58, 0.85)` | Glassmorphism panels (translucent + backdrop-blur) |
| `--accent-primary` | `#7C6AFF` | Primary accent (buttons, links, active states) — a rich violet |
| `--accent-secondary` | `#FF8B5A` | Secondary accent (notifications, warnings, warmth) — warm amber |
| `--accent-tertiary` | `#5ADBFF` | Tertiary accent (info, badges, cool highlights) — electric cyan |
| `--text-primary` | `#F0EDF6` | Primary text (high contrast on dark) |
| `--text-secondary` | `#9B95B0` | Secondary text (muted, timestamps, labels) |
| `--text-tertiary` | `#5E5878` | Tertiary text (placeholders, disabled) |
| `--border-subtle` | `rgba(124, 106, 255, 0.12)` | Subtle borders (tinted with accent) |
| `--glow-accent` | `rgba(124, 106, 255, 0.25)` | Glow effects (focus rings, active states) |
| `--gradient-surface` | `linear-gradient(135deg, #12162B 0%, #1A1040 100%)` | Surface gradient (not flat!) |
| `--noise-opacity` | `0.03` | Grain texture overlay intensity |

**Key distinction**: Backgrounds are *never* flat solid colors. They're always subtle gradients or mesh gradients, giving depth even without glassmorphism.

#### Built-in Theme Variants (ship with these)

| Theme | Vibe | Key Colors |
|---|---|---|
| **Obsidian** (default) | Deep, layered, luminous | Indigo + violet + amber |
| **Moonstone** | Soft, approachable light mode | Warm off-white + lavender + sage |
| **Ember** | Warm, cozy dark | Charcoal + rust + golden amber |
| **Arctic** | Cool, clean, focused | Navy + ice blue + white |
| **Void** | Ultra-dark OLED-friendly | True black + neon violet + electric cyan |
| **Terracotta** | Earthy, grounded | Warm brown + burnt orange + cream |
| **Sakura** | Delicate, elegant | Soft pink + ivory + gold |
| **Neon** | Cyberpunk energy | Black + hot pink + electric green |

Each theme isn't just "different colors" — they each define different gradient angles, noise intensities, glassmorphism blur levels, shadow depths, and border styles. **Switching themes feels like stepping into a different space.**

### Signature UI Elements (What Makes Gratonite Look Different)

#### Glassmorphism Panel System

All major UI surfaces use **frosted glass layering**:
- `backdrop-filter: blur(16px) saturate(180%)` on sidebars, modals, popovers
- Background colors are semi-transparent (`rgba`) so the server's background gradient/image shows through
- Multiple elevation levels: each higher layer has slightly more opacity and less blur
- Borders use `1px solid rgba(255, 255, 255, 0.08)` — a subtle light edge that catches the eye

**Mobile**: React Native's `BlurView` (expo-blur) for native glassmorphism on iOS; fallback to elevated solid surfaces on Android < 12.

#### Glow & Focus System

Instead of generic blue focus rings:
- Focused elements emit a soft **colored glow** matching the current accent color
- `box-shadow: 0 0 0 2px var(--glow-accent), 0 0 20px var(--glow-accent)`
- Active sidebar items have a glow-pill indicator, not a flat rectangle
- Buttons on hover have a radial glow emanating from cursor position (CSS `radial-gradient` + mouse tracking)

#### Message Presentation

Messages don't just sit in a flat list:
- **Grouped messages** from the same author within 5 minutes merge visually — no repeated avatar, seamless text flow
- **Author names** rendered in the user's accent color (or role color in servers)
- **Reactions** appear as floating glass pills with spring-in animation (Framer Motion `spring` preset)
- **Embeds** (link previews, images) render as glass cards with subtle shadow depth
- **Hover actions** (reply, react, more) slide in from the right with staggered timing, not all at once
- **New message indicator** is a gradient line that pulses once, not a boring static divider

#### Message Layout Options (per-user preference)

| Layout | Description |
|---|---|
| **Cozy** (default) | Avatars visible, generous spacing, grouped messages. The signature Gratonite look |
| **Compact** | Smaller avatars, tighter spacing. Good for information-dense servers |
| **Bubbles** | Messages in rounded glass bubbles (like iMessage/Telegram). Own messages right-aligned with accent color, others left-aligned |
| **Cards** | Each message is a distinct card with subtle elevation. Good for forums/Q&A where each post is standalone |

#### Channel List Design

Instead of a flat text list:
- **Channel color accents** — each channel can have a color dot/bar indicator for visual grouping
- **Category headers** use the server's accent color with a gradient fade
- **Active channel** has a glow-pill highlight, not just a background color change
- **Unread indicators** are accent-colored dots with a subtle pulse animation on first appearance
- **Voice channels** show connected user avatars inline (tiny avatar stack), making them feel alive
- **Channel icons** — custom emoji or icon per channel (not just `#` for text and `🔊` for voice)

#### Server Sidebar

The server icon column is reimagined:
- Server icons sit on a **subtle frosted-glass rail** (not a flat dark strip)
- Active server has a **glowing pill indicator** on the left edge
- Hovering a server briefly flashes the server's accent color as a border glow
- **Server folders** expand as a floating glass popover, not an inline accordion
- The server icon rail can optionally be **hidden entirely** (access servers via quick switcher `Ctrl+K`)

### Micro-Interaction Library (`@gratonite/motion`)

New shared package for choreographed animations across all platforms:

| Interaction | Animation | Implementation |
|---|---|---|
| **Message enter** | Fade up + slight scale (0.97→1.0), staggered 30ms per message | Framer Motion `staggerChildren` |
| **Reaction add** | Spring pop (scale 0→1.2→1.0) + particles burst | Framer Motion `spring` + CSS `@keyframes` |
| **Channel switch** | Crossfade content (150ms) + scroll position restore | React `useTransition` + CSS `opacity` |
| **Server switch** | Background color wash (300ms ease) + sidebar slide | CSS transition on `--bg-*` tokens |
| **Modal open** | Scale from trigger point (0.9→1.0) + backdrop fade | Framer Motion `layoutId` |
| **Modal close** | Scale back to trigger (1.0→0.9) + backdrop fade | Framer Motion `layoutId` |
| **Popover** | Scale from anchor + spring overshoot | Framer Motion `spring` |
| **Toast notification** | Slide in from bottom-right + glass blur in | CSS `transform` + `backdrop-filter` transition |
| **Typing indicator** | Organic wave (3 dots with sine-wave timing, not uniform bounce) | CSS `@keyframes` with offset delays |
| **User join voice** | Avatar pops in with scale + subtle ring pulse | Framer Motion `spring` |
| **Hover glow** | Radial gradient follows cursor position on buttons/cards | JS `mousemove` → CSS `--glow-x`, `--glow-y` |
| **Loading skeleton** | Shimmer with gradient sweep (accent-tinted, not grey) | CSS `@keyframes` gradient animation |
| **Pull to refresh (mobile)** | Crystalline spinner (faceted gem rotation, not generic circle) | Lottie animation |

**Performance guard**: All animations respect `prefers-reduced-motion`. When `reduced_motion = true` in user settings, all transitions become instant crossfades (opacity only, no movement).

**Mobile**: Animations use `react-native-reanimated` worklet-driven transitions (60fps, runs on UI thread, not JS thread).

### Expanded Token System (~120 tokens)

Expanding from ~60 to ~120 tokens for complete design control:

**Color tokens (24)**: `bg-deep`, `bg-base`, `bg-elevated`, `bg-overlay`, `bg-input`, `accent-primary`, `accent-secondary`, `accent-tertiary`, `accent-success`, `accent-warning`, `accent-danger`, `text-primary`, `text-secondary`, `text-tertiary`, `text-link`, `text-on-accent`, `border-subtle`, `border-default`, `border-strong`, `glow-accent`, `glow-success`, `glow-danger`, `gradient-surface`, `gradient-header`

**Spacing tokens (8)**: `space-xs` (4px), `space-sm` (8px), `space-md` (12px), `space-lg` (16px), `space-xl` (24px), `space-2xl` (32px), `space-3xl` (48px), `space-4xl` (64px)

**Radius tokens (6)**: `radius-sm` (4px), `radius-md` (8px), `radius-lg` (12px), `radius-xl` (16px), `radius-2xl` (24px), `radius-full` (9999px — pills)

**Shadow/depth tokens (6)**: `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-glow` (accent-colored glow shadow)

**Typography tokens (16)**: `font-display` (headings), `font-body` (messages/UI), `font-mono` (code), `font-size-xs` through `font-size-3xl` (modular scale 1.2x), `font-weight-normal`, `font-weight-medium`, `font-weight-semibold`, `font-weight-bold`, `line-height-tight`, `line-height-normal`, `line-height-relaxed`, `letter-spacing-tight`, `letter-spacing-normal`

**Animation tokens (12)**: `duration-instant` (0ms), `duration-fast` (100ms), `duration-normal` (200ms), `duration-slow` (350ms), `duration-glacial` (500ms), `easing-default` (cubic-bezier), `easing-spring` (spring physics), `easing-bounce`, `easing-snap`, `stagger-delay` (30ms), `enter-scale` (0.97), `exit-scale` (0.95)

**Effect tokens (12)**: `blur-sm`, `blur-md`, `blur-lg` (backdrop blur levels), `noise-opacity`, `noise-scale`, `glass-opacity`, `glass-border-opacity`, `glow-spread`, `glow-intensity`, `gradient-angle`, `gradient-stops`, `saturation-boost`

**Component tokens (36)**: `sidebar-width`, `sidebar-collapsed-width`, `channel-list-width`, `member-list-width`, `message-avatar-size`, `message-avatar-size-compact`, `message-max-width`, `input-height`, `input-radius`, `button-height`, `button-radius`, `button-padding`, `modal-radius`, `modal-width-sm/md/lg`, `popover-radius`, `card-radius`, `card-padding`, `badge-radius`, `badge-height`, `tooltip-radius`, `avatar-radius` (default `radius-full` for circles, can be overridden to squares/rounded-squares), `scrollbar-width`, `scrollbar-radius`, `scrollbar-thumb-color`, `scrollbar-track-color`, etc.

### Per-Server Customization Features

| Feature | Implementation |
|---|---|
| Custom CSS per server | `<style>` injection on web; token overrides on mobile |
| Custom emoji (unlimited, free) | Uploaded to MinIO `/emojis/{guildId}/`, animated GIF/APNG supported |
| Animated sticker packs | WebP + APNG + Lottie support, stored in MinIO `/stickers/` |
| Channel layout | Drag-and-drop channel ordering (`position` int), widget pinning (JSONB `layout` on channels) |
| Background image/gradient per server | Uploaded image or gradient builder; CSS `background-image` / RN ImageBackground; visible through glass panels |
| Font selection | Google Fonts picker + system font; separate display + body font choices |
| Role icons | Custom images or unicode emoji per role, displayed in member list + chat |
| Server banner | Shown at top of channel sidebar, animated GIF supported |
| Server icon | Animated GIF supported (no boost requirement) |
| Channel color accents | Per-channel color dot/bar for visual grouping |
| Channel custom icons | Custom emoji or image per channel (replace default `#`/`🔊`) |
| Welcome screen | Customizable description + recommended channels for new members |
| Soundboard | Custom sounds playable in voice channels |
| Icon pack selection | Choose from bundled icon sets (outlined, filled, duotone, playful) per server |

### Server Brand Identity Kit

Server owners don't just pick colors — they build a **visual identity**:

**`guild_brand` table** (extends `guilds`):
- `color_primary`, `color_secondary`, `color_accent` (hex)
- `gradient_type` (linear / radial / mesh / none)
- `gradient_config` (JSONB: angle, color stops, mesh points)
- `background_image_hash` (MinIO)
- `background_blur` (0–20, how much the background blurs behind glass panels)
- `font_display` (Google Fonts name, e.g. "Outfit")
- `font_body` (Google Fonts name, e.g. "Inter")
- `icon_pack` (enum: outlined / filled / duotone / playful / custom)
- `noise_opacity` (0.0–0.08)
- `glass_opacity` (0.5–0.95 — how transparent panels are)
- `corner_style` (enum: rounded / sharp / pill — affects all radii)
- `message_layout` (enum: cozy / compact / bubbles / cards — server default, users can override)

When a user enters a server, these brand tokens **override the base theme** while preserving the user's personal preferences (font scale, reduced motion, high contrast). The effect: **every server feels like its own place**.

### Visual Theme Editor (not just a CSS box)

Instead of a raw CSS textarea, Gratonite ships a **visual theme builder**:

1. **Color Palette Panel** — Pick primary/secondary/accent colors with a wheel + harmonies (complementary, triadic, analogous auto-suggested). Live preview updates instantly.

2. **Background Studio** — Upload image, choose from gradient presets, or build a custom gradient with drag handles. Adjust blur level that affects glass panel transparency.

3. **Typography Picker** — Browse Google Fonts with live preview in a mock message list. Set display font + body font + mono font independently.

4. **Component Preview** — See all UI states at once: message list, channel sidebar, modal, popover, buttons (default/hover/active/disabled), input fields, badges, reactions. Changes apply live.

5. **Accessibility Checker** — WCAG AA/AAA contrast checker runs automatically on every color combination. Warnings appear if text-on-background doesn't meet AA (4.5:1 for normal text, 3:1 for large text).

6. **Export/Import** — Export theme as JSON (token values), CSS file, or shareable link. Import from JSON, CSS, Tailwind config, or Figma design tokens.

7. **Preset Gallery** — Start from a built-in theme (Obsidian, Moonstone, Ember, etc.) and customize from there instead of blank canvas.

### Theme Marketplace

Community-shared theme repository — a genuine **design community feature**:

- Users publish themes with a name, description, preview screenshots (auto-generated from mock UI), and tags
- Browse by category: dark, light, colorful, minimal, gaming, professional, seasonal
- One-click install as personal theme or server theme
- Rating system (1–5 stars) + install count
- Theme versioning — authors can push updates, users opt-in to auto-update
- **Featured themes** curated by Gratonite team on `/discover` page
- Revenue sharing (future): popular theme creators can optionally charge, Gratonite takes small cut

### Technical Architecture (unchanged foundation, expanded scope)

**Web:**
- CSS custom properties set on `:root` by `ThemeProvider`
- Per-server theme: inject `<style id="server-theme-{guildId}">` with token overrides into `<head>` on server switch
- Runtime switching: update CSS vars → zero reload required
- `backdrop-filter` for glassmorphism (Chrome, Safari, Firefox all support; fallback: solid elevated surface)
- `@gratonite/motion` hooks: `useSpring`, `useStagger`, `useGlow`, `useParallax`

**Mobile:**
- `react-native-unistyles` — runtime theme switching without rebuild
- Token names mirror web exactly
- `expo-blur` (iOS BlurView, Android fallback) for glass effect
- `react-native-reanimated` for 60fps spring animations
- Per-server themes: token overrides applied via Unistyles context

**Shared packages:**
- `@gratonite/themes` — Token definitions, theme presets, theme validation (Zod schema), contrast checker
- `@gratonite/motion` — Animation presets, spring configs, stagger utilities, reduced-motion guard

---

## 9. Bot & Plugin System

### Server-Side Bot API (Discord-Compatible Model)

1. **App registration**: Developer creates OAuth2 app → gets `client_id` + `client_secret`
2. **Bot authorization**: OAuth2 authorization code flow; server admin selects server + permissions
3. **Gateway connection**: Bot connects to WebSocket gateway with `Authorization: Bot {token}`
4. **Gateway intents**: Bots declare which event categories they subscribe to (reduces bandwidth)
5. **Slash commands**: Registered per-app (global or per-guild); rendered natively in client; interaction payloads sent to bot's webhook URL within 3s deadline
6. **Rate limiting**: Per-bot per-route limits; `Retry-After` header on 429

**Bot event delivery**: Webhook (HTTP POST) or persistent WebSocket gateway — developer's choice.

### Plugin Sandboxing (Server-Side)

Bot/plugin code runs in **Node.js Worker Threads** with a `vm.Script` context exposing only a safe API subset (no file system, no raw network, no DB access). 5-second execution timeout, 128MB memory cap. For higher-security needs: separate Docker container per plugin with `cap_drop`, read-only FS, no external network.

### Client-Side Plugin System (Browser Extension Model)

- Plugins loaded from a registry URL (manifest JSON → JS + CSS bundle)
- Executed inside a sandboxed `<iframe sandbox="allow-scripts">`
- Communicate with host app via restricted `postMessage` API (`PluginAPI`)
- Exposed hooks: `registerCommand`, `registerContextMenuItem`, `onMessageReceive`, `injectStyles`, `storage.getItem/setItem` (1MB quota per plugin)
- Installed per-user, optionally scoped to a specific server

---

## 10. Notifications

**Multi-platform strategy:**
- **Web**: Web Push API with VAPID (`web-push` npm package) — self-hosted, no vendor
- **Android**: Firebase Cloud Messaging (FCM) via `firebase-admin`
- **iOS**: APNs via `apn` npm package + `.p8` key

**Notification preference hierarchy** (channel > server > global):
- Per-server mute with optional expiry
- Per-channel notification level (All / Mentions Only / Nothing)
- DND hours (quiet hours with time range)
- `@everyone` / `@here` respect sender's `MENTION_EVERYONE` permission bit

---

## 11. Moderation Tools

### Ban, Kick, Timeout

**`bans` table**: `server_id`, `user_id`, `moderator_id`, `reason` (512 chars), `delete_message_seconds` (0–604800, how much history to purge), `created_at`

Kick: no persistent record, but logged in audit log. User is removed from `guild_members`.

**Timeout** (temporary mute): `guild_members.communication_disabled_until` (timestamptz). When set, user cannot send messages, react, join voice, or change nickname. Cleared by scheduled job or lazy evaluation.

### Slow Mode

`channels.rate_limit_per_user` (integer, seconds between messages, 0 = off, max 21600). Tracked in Redis: `slowmode:{channelId}:{userId}` with TTL = rate limit. On message send, check if key exists → reject with remaining cooldown.

### Verification Levels

`guilds.verification_level` (enum: none / low / medium / high / very_high):
- `none`: unrestricted
- `low`: verified email on Gratonite account
- `medium`: also registered > 5 minutes
- `high`: also member of server > 10 minutes
- `very_high`: verified phone number

### Auto-Moderation

**`auto_mod_rules` table**: `server_id`, `name`, `creator_id`, `event_type` (message_send / member_update), `trigger_type` (keyword / spam / keyword_preset / mention_spam), `trigger_metadata` (JSONB: keyword_filter, regex_patterns, allow_list, mention_total_limit, presets), `actions` (JSONB array: block_message / send_alert_message / timeout with channel_id, duration, custom_message), `enabled`, `exempt_roles`, `exempt_channels`

### Raid Protection

**`raid_config` table**: `server_id` (PK), `enabled`, `join_threshold`, `join_window_seconds`, `action` (kick / ban / enable_verification / lock_channels / alert_only), `auto_resolve_minutes`

Implementation: Redis sorted set `raid_monitor:{serverId}` with join timestamps. On each join, count in sliding window. If threshold exceeded → trigger action + alert mod log channel.

### Content Filtering

Optional NSFW image classifier: lightweight ONNX model (like NSFW.js) running as a sidecar service. On image upload → classify → if confidence > threshold and channel not marked NSFW → block + notify. Server setting `explicit_content_filter` (disabled / friends_excluded / all_messages).

### Audit Log

**`audit_log_entries` table**: `id` (snowflake), `server_id`, `user_id` (actor), `target_id`, `action_type` (integer, 150+ types: GUILD_UPDATE, CHANNEL_CREATE, MEMBER_BAN_ADD, ROLE_UPDATE, MESSAGE_DELETE, AUTO_MOD_BLOCK, etc.), `changes` (JSONB array of `{key, old_value, new_value}`), `reason`, `options` (JSONB context), `created_at`

Retain 45 days (configurable). Partition by `server_id` hash.

### User Report System

**`reports` table**: `reporter_id`, `reported_user_id`, `server_id`, `message_id`, `reason` (enum: spam / harassment / hate_speech / nsfw / self_harm / other), `description` (1000 chars), `status` (pending / reviewing / resolved / dismissed), `reviewer_id`, `resolution_note`, `created_at`, `resolved_at`

---

## 12. Message Rendering & Formatting

### Markdown Pipeline

Shared `@gratonite/markdown` package with: **Parser** (string → AST), **Renderers** (React component for web/desktop, React Native component for mobile, plain text for notifications), **Sanitizer** (strip disallowed HTML, prevent XSS)

**Supported syntax:**
- Bold `**text**`, Italic `*text*`, Underline `__text__`, Strikethrough `~~text~~`
- Spoiler `||text||`, Inline code `` `code` ``, Code blocks ` ```lang\ncode\n``` ` with syntax highlighting (highlight.js / Shiki, lazy-loaded)
- Block quotes `> text` and `>>> multi-line`
- Headers `# H1` `## H2` `### H3` (only in channel topics / bio, not in chat messages)
- Ordered/unordered lists
- Masked links `[text](url)`
- Timestamps `<t:1234567890:R>` (relative) `<t:1234567890:F>` (full)
- User mentions `<@user_id>`, Role mentions `<@&role_id>`, Channel mentions `<#channel_id>`
- Custom emoji `<:name:id>` / `<a:name:id>` (animated)
- LaTeX `$inline$` and `$$block$$` (KaTeX, lazy-loaded)

---

## 13. Accessibility

Designed in from day one, not bolted on.

### ARIA & Semantic HTML

- `role="listbox"` for message lists, `role="dialog"` for modals, `role="toolbar"` for message actions
- `role="tree"` + `role="treeitem"` for channel list, `role="complementary"` for member sidebar
- `aria-label` on all icon-only buttons (emoji picker, voice connect, etc.)
- `aria-live="polite"` on message list (new messages announced to screen readers)
- `aria-expanded` on collapsible categories and threads
- Focus trapping in modals; focus return on close

**Shared `@gratonite/a11y` package**: `VisuallyHidden`, `FocusTrap`, `useAriaAnnounce()`, `useFocusReturn()`, `useRovingTabIndex()`

### Keyboard Navigation

- `Tab` / `Shift+Tab`: move between major regions (channel list, messages, member list, input)
- Arrow keys: navigate within region (messages, channels)
- `Enter`: activate (send message, open channel, expand category)
- `Escape`: close overlay, deselect
- `Ctrl+K` / `Cmd+K`: quick switcher (search channels, users, servers)
- `Ctrl+Shift+M`: toggle mute, `Ctrl+Shift+D`: toggle deafen
- All shortcuts customizable via `user_keybinds` table: `user_id`, `action`, `keybind`

### Visual Preferences

Extend `user_settings`:
- `reduced_motion` (boolean) — disables all animations, GIFs render as static first frame, typing indicator becomes text-only
- `high_contrast` (boolean) — activates high contrast theme variant
- `font_scale` (float 0.75–1.5) — multiplier on base font size
- `message_display` (cozy / compact)
- `saturation` (float 0.0–1.0) — for color sensitivity

Client respects `prefers-reduced-motion` and `prefers-contrast` CSS media queries as defaults, user can override.

---

## 14. Security Hardening

### Rate Limiting

Multi-tier with Redis sliding window counters:

**Global** (Nginx/LB): 50 req/s per IP, 10,000 req/10min per IP
**Per-route** (Express middleware):
- `POST /messages`: 5/5s per user per channel
- `POST /reactions`: 1/250ms per user
- `PATCH /users/@me`: 2/10s
- `POST /invites`: 5/min per user
- `POST /auth/login`: 5/min per IP (brute force)
- `POST /auth/register`: 3/hr per IP

Return standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (on 429)

### Input Validation & Sanitization

1. **tRPC**: Zod schemas on every procedure — every string has `.max(N)`, every ID is snowflake-regex validated
2. **HTML**: Messages use markdown, never raw HTML. All `<`/`>` escaped before storage. Rendering via markdown→React pipeline, never `dangerouslySetInnerHTML`
3. **SQL**: Guaranteed safe via Drizzle ORM parameterized queries
4. **File uploads**: Validate MIME by magic bytes (`file-type` library), not just Content-Type header

### Security Headers

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline'; img-src 'self' cdn.gratonite.app blob: data:;
  connect-src 'self' wss://gateway.gratonite.app; frame-src 'none'; object-src 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### CORS

`Access-Control-Allow-Origin`: `https://app.gratonite.app` (not `*`). Electron: `gratonite://app` added to allowlist. React Native: authenticate purely via JWT + device fingerprinting (no origin header from native).

### Session Security

**`sessions` table**: `user_id`, `refresh_token_hash`, `ip_address` (inet), `user_agent`, `device_type` (web/desktop/mobile/bot), `approximate_location` (city/country from IP), `created_at`, `last_used_at`, `expires_at`, `revoked`

**Suspicious login detection**: Compare IP geolocation with recent sessions → new country/city triggers email notification. After 5 failed logins, require CAPTCHA. Known-compromised IP ranges require 2FA.

### E2E Encryption for DMs (Phase 2, opt-in)

Opt-in only (conflicts with server-side search, link previews, moderation). Signal Protocol (X3DH key exchange + Double Ratchet). `user_keys` table: `device_id`, `identity_key`, `signed_pre_key`, `one_time_pre_keys`. Server stores only ciphertext.

---

## 15. Performance Optimizations

### Virtual Scrolling

Message list uses `@tanstack/react-virtual` (works in React DOM + React Native). Variable-height messages: estimate based on content length, measure after render, cache in `Map<messageId, measuredHeight>`. Scroll anchor preservation when prepending older messages. Overscan: 10 messages above/below viewport.

### Image Loading

- **BlurHash**: Computed on upload (20 chars), stored on attachment, rendered as placeholder during load. Prevents layout shift.
- **Progressive JPEG/WebP**: Served from MinIO (configured via `sharp`)
- **Responsive `srcset`**: Pre-generated size variants from avatar/banner pipeline
- **Intersection Observer**: Lazy-load images when within 500px of viewport

### Bundle Splitting (Web / Vite)

Route-based code splitting: channels, settings, friends, DMs each a lazy chunk. Heavy deps isolated: `highlight.js`, `KaTeX`, emoji picker loaded on demand. Vendor chunk: react, react-dom, zustand, tanstack-query (stable cache). **Target: initial bundle < 200KB gzipped.**

### Cursor-Based Pagination

All list endpoints use cursor-based pagination (not offset). Parameters: `before`, `after`, `around` (snowflake IDs), `limit` (default 50, max 100). SQL: `WHERE channel_id = $1 AND id < $2 ORDER BY id DESC LIMIT $3` — O(1) via `(channel_id, id DESC)` index.

### Connection Recovery

Socket.IO auto-reconnect with exponential backoff (1s→2s→4s→8s, max 30s). On reconnect: send `RESUME` with last event sequence → server replays missed events from Redis stream. If too many missed (>1000 or >5min) → full state sync. Mobile: `WatermelonDB` offline queue for outgoing messages, synced on reconnect.

---

## 16. Marketing Website (`apps/website`)

A premier, web-3-inspired, visually stunning marketing/landing site. Separate from the app — serves as the public face of Gratonite.

**Tech**: Next.js 14+ (App Router) + Tailwind CSS + Framer Motion for animations. Deployed on its own subdomain: `gratonite.app` (marketing) vs `app.gratonite.app` (the application).

### Pages

**Navigation bar** (persistent on all pages): Logo, Download, Discover, Safety, Support, Blog, Developers — and on the right: **Login** button + **Register** CTA button (accent-colored, prominent)

| Route | Content |
|---|---|
| `/` | Hero section with animated 3D mockups, feature highlights with scroll-triggered animations, social proof, CTA ("Open Gratonite in Your Browser" + "Download" buttons) |
| `/login` | Login page: Username (or email) + Password fields, "Continue with Google" OAuth button, "Forgot password?" link, "Don't have an account? Register" link. Clean, centered card layout with animated background |
| `/register` | Registration page: multi-step or single-page form — Email, Display Name, Username (live availability check), Password (strength meter), Date of Birth (must be 16+). "Continue with Google" button (still requires Username + Display Name + DOB). Terms of Service + Privacy Policy checkbox. Animated background matching login page |
| `/download` | Platform detection auto-selects download. Links for Windows (.exe), macOS (.dmg), Linux (.AppImage), iOS (App Store), Android (Play Store), Web (launch in browser) |
| `/discover` | Public server directory — browse, search, filter by category. Featured/trending servers. Pulls from server discovery API |
| `/safety` | Trust & safety policies, how moderation works, reporting guide, age-gating, privacy commitments, transparency reports |
| `/support` | Help center / knowledge base (FAQ, getting started guides, troubleshooting). Powered by markdown files or headless CMS. Search functionality |
| `/blog` | Engineering blog, product updates, community stories. Headless CMS (Contentlayer or Sanity.io) + MDX |
| `/developers` | Developer portal: bot documentation (auto-generated from tRPC/REST specs), API reference, getting started guide, OAuth2 setup, plugin SDK docs. Built with Starlight or Docusaurus |
| `/developers/applications` | Dashboard for managing OAuth2 apps, bots, slash commands (authenticated, part of the app) |
| `/branding` | Brand assets, logos, usage guidelines |

### Design Direction

- **Dark-first** design, deep gradients, glassmorphism cards
- **3D elements**: WebGL hero with Three.js/React Three Fiber — animated floating UI mockups or abstract geometric scenes
- **Scroll-driven animations**: Framer Motion `useScroll` + `useTransform` for parallax, reveal, and morph effects
- **Micro-interactions**: Button hover states, cursor glow effects, card tilt on hover (CSS `perspective` + `transform`)
- **Grid noise/grain texture** overlays for depth
- **Responsive**: Mobile-first, fluid typography (`clamp()`), container queries
- **Performance**: Lighthouse 95+ target. Static generation (ISR) for marketing pages, dynamic for discover/blog

### Repository Location

```
gratonite/
├── apps/
│   ├── website/         # Next.js marketing site (NEW)
│   │   ├── src/
│   │   │   ├── app/          # App Router pages
│   │   │   ├── components/   # Hero, FeatureSection, DownloadCard, ServerCard
│   │   │   ├── content/      # MDX blog posts, support articles
│   │   │   └── lib/          # CMS client, server discovery API client
│   │   └── public/           # Static assets, brand kit
│   ├── web/             # Vite + React (app client)
│   ├── desktop/
│   ├── mobile/
│   └── api/
```

---

## 17. Developer Experience

### Database Migrations

Drizzle ORM + Drizzle Kit. Migrations in `packages/db/migrations/` (timestamped SQL files). `drizzle-kit check` in CI. Init container runs migrations before app starts in production.

### API Documentation

- **tRPC**: Auto-generate OpenAPI specs via `trpc-openapi` → Swagger UI at `/api/docs`
- **Socket.IO events**: `@gratonite/gateway-types` package exports `ServerToClientEvents` + `ClientToServerEvents` with JSDoc → typedoc generates markdown docs
- **Bot/Developer API**: Hosted docs site at `/developers` built with Starlight/Docusaurus

### CI/CD (GitHub Actions)

**On PR**: `turbo lint` (ESLint) → `turbo typecheck` → `turbo test` (Vitest) → `turbo build` → `drizzle-kit check` → Lighthouse CI → bundle size check vs `main`

**On merge to `main`**: All above + build Docker images (api, gateway, worker, web) → push to GHCR → deploy to staging K8s → E2E tests (Playwright + Detox)

**On tag (release)**: Deploy to production K8s (rolling update) → build Electron installers (Windows NSIS, macOS DMG, Linux AppImage) via electron-builder → Expo EAS builds (iOS IPA, Android AAB) → upload to GitHub Releases

### Linting & Formatting

Root `eslint.config.js` (flat config) + per-package overrides. Prettier (`.prettierrc`). `lint-staged` + `husky` pre-commit hooks. `commitlint` with Conventional Commits: `type(scope): description`.

### Environment Variables

`.env.example` per package (committed, no secrets). Zod schema validation on startup (fail fast if misconfigured). Secrets in CI via `dotenv-vault` or 1Password CLI.

---

## 18. Infrastructure

### Local Development: Docker Compose

Services: `postgres:16-alpine`, `redis:7-alpine`, `minio/minio`, `getmeili/meilisearch`, `livekit/livekit-server`, `coturn/coturn`, Node.js app (with hot reload), Nginx (reverse proxy + MinIO cache), optional: NSFW classifier sidecar

### Production: Kubernetes + Helm

- **App**: `Deployment` with HPA (2–10 replicas, scale on CPU 70% + memory 80%)
- **PostgreSQL**: `StatefulSet` (1 primary + 2 replicas, streaming replication)
- **Redis**: `StatefulSet` (1 primary + 2 replicas)
- **MinIO**: `StatefulSet` with persistent volumes (or migrate to S3/GCS in cloud phase)
- **LiveKit**: `Deployment` (separate namespace), UDP NodePort or LoadBalancer for media
- **Ingress**: nginx-ingress + cert-manager (Let's Encrypt TLS)
- **Secrets**: Kubernetes secrets (migrate to Vault or AWS Secrets Manager in cloud phase)
- **Observability**: OpenTelemetry → Jaeger (traces) + Prometheus/Grafana (metrics)

### Backup Strategy

**PostgreSQL**: `pg_basebackup` daily at 3 AM UTC + WAL archiving to MinIO for PITR. Retain 7 daily, 4 weekly, 12 monthly. Automated monthly restore tests (spin up temp instance, health check, tear down).
**MinIO**: Bucket versioning for critical buckets (avatars, banners). `mc mirror` to secondary instance or S3-compatible backup target.
**Redis**: RDB snapshots every 5 min (if >100 keys changed) + AOF with `everysec` fsync. Ephemeral data (presence, typing) — loss acceptable.

### Logging

Structured JSON logging via [pino](https://getpino.io/) (fastest Node.js logger). Format: `{level, time, service, traceId, userId, method, path, statusCode, latencyMs, error}`. Ship via Fluent Bit to **Loki + Grafana** (self-hosted) or Datadog/Axiom (managed). Trace IDs generated per request, propagated through tRPC context, Bull jobs, Socket.IO events.

### Error Tracking

[Sentry](https://sentry.io/) (or self-hosted [GlitchTip](https://glitchtip.com/)). Integration: `@sentry/node` (backend), `@sentry/react` (web), `@sentry/electron` (desktop), `@sentry/react-native` (mobile). Source maps uploaded at build time. Context: `traceId`, `userId`, `serverId`, `channelId` on every event.

### Monitoring & Alerting

Prometheus client (`prom-client`). Key metrics: `http_request_duration_seconds`, `socket_connections_total`, `messages_sent_total`, `voice_sessions_active`, `queue_depth`, `database_pool_size`. Grafana dashboards for API latency (p50/p95/p99), error rate, DAU, message throughput, voice usage.

Alerts: error rate >5% for 5min, p95 latency >2s for 5min, DB pool exhausted, Redis >80% memory, disk <10%.

### Feature Flags

[Unleash](https://www.getunleash.io/) (open-source, self-hosted) or custom `feature_flags` table: `name`, `enabled`, `rollout_percentage`, `user_overrides` (JSONB), `server_overrides` (JSONB). Client: `useFeatureFlag('polls')` hook, fetched on app load, cached in Zustand, re-fetched every 5min.

### Cloud Migration Path (when scale demands it)

| Self-Hosted | Cloud Equivalent |
|---|---|
| PostgreSQL StatefulSet | AWS RDS / Cloud SQL |
| Redis StatefulSet | AWS ElastiCache / GCP Memorystore |
| MinIO | AWS S3 / GCS |
| Nginx cache | AWS CloudFront / Cloudflare |
| LiveKit self-hosted | LiveKit Cloud (drop-in) |
| Coturn | AWS Global Accelerator |
| Loki + Grafana | Datadog / Axiom |
| GlitchTip | Sentry SaaS |
| Unleash | LaunchDarkly |

---

## 19. Scaling Checkpoints

| Concurrent Users | Actions |
|---|---|
| **< 1,000** | Single Docker Compose node; PostgreSQL FTS; single Redis |
| **1,000–10,000** | K8s + HPA; PostgreSQL streaming replication; add Meilisearch |
| **10,000–100,000** | Split voice service; CDN caching; rate limiting; separate bots service |
| **100,000+** | Migrate to managed cloud DB/cache; shard guilds; consider mediasoup SFU |

---

## 20. Complete Feature List

### User Identity & Customization
- Profile pictures (animated GIF/APNG, free)
- Profile banners (animated, free — no paywall)
- Per-server avatar, banner, nickname, bio overrides
- Custom status with text + emoji + expiry
- Rich Presence / activity status (playing, streaming, listening, watching)
- Connected accounts (GitHub, Twitter/X, Spotify, Twitch, YouTube, Steam, etc.)
- Profile badges & flair system
- Avatar decorations (animated rings/frames)
- Profile effects (animated background on profile card)
- User accent color theming
- Profile popover card with mutual servers/friends, roles, bio, connected accounts
- Private per-user notes
- Custom keybinds

### Communication
- Real-time text messaging (4000 char limit, no paywall)
- 1:1 DMs and group DMs (up to 10 people)
- Voice channels with up to 50 participants
- Video calls with camera, background blur, virtual backgrounds
- Screen share (entire screen, application window, browser tab)
- Game streaming / Go Live (desktop game capture with LIVE badge + viewer count)
- 1:1 and group DM voice/video calls with ringing UI (CallKit/ConnectionService on mobile)
- Stage channels (speaker/audience model)
- Voice messages (audio clips with waveform display)
- Typing indicators, read receipts
- Message replies, quotes, forwarding
- Message reactions (custom emoji, super reactions)
- Polls
- Scheduled messages
- Message edit history (opt-in per server)
- Message pinning (50/channel)
- Spoiler tags, code blocks with syntax highlighting, LaTeX rendering
- Link previews with re-hosted images (privacy)
- File attachments with preview (image lightbox, video player, audio player, PDF preview)
- GIF picker (Tenor integration), sticker picker, emoji picker with skin tones
- Paste-to-upload (clipboard images) + drag-and-drop file upload
- Copy message link, forward messages, mark unread
- In-app message translation (auto-detect language)

### Server & Channel Customization
- Per-server full CSS editor with live preview
- Custom animated server icon and banner (free)
- Custom animated sticker packs (WebP/APNG/Lottie)
- Unlimited custom emoji (no paywall)
- Drag-and-drop channel layout with widget system
- Background images per server
- Font selection per server
- Role icons (custom images or unicode)
- Channel categories (collapsible)
- Forum channels with tags, sorting, gallery view
- Media gallery channels
- Announcement channels with crossposting
- Soundboard (custom sounds in voice channels)
- Server templates (clone channel/role structure)
- Server discovery with search, categories, featured servers
- Vanity invite URLs
- Welcome screen with recommended channels
- Server boost system (social incentives, all perks unlockable for free by admin)

### Social
- Friend system (add, remove, block, pending)
- Friend activity feed (game activity, Spotify, etc.)
- Privacy settings (DM permissions, friend request sources)
- User blocking (comprehensive: messages hidden, DMs blocked, etc.)

### Moderation
- Ban with message purge, kick, timeout (temporary mute)
- Slow mode per channel
- Verification levels (email, age, phone)
- Auto-moderation (keyword filters, regex, spam, mention spam, presets)
- Raid protection (join rate detection, automatic lockdown)
- NSFW content filtering (AI classifier)
- Audit log (150+ action types, 45-day retention)
- User report system with review workflow

### Bot & Plugin Ecosystem
- Discord-compatible bot API (OAuth2, gateway, intents, slash commands, webhooks)
- Client-side plugin system (iframe sandboxed, plugin marketplace)
- Server-side plugin sandboxing (Worker Threads + vm.Script)
- Slash commands with native UI rendering
- Rate limiting per bot

### Theming & Design
- Crystalline design language (glassmorphism, layered depth, bold color, living surfaces)
- 8 built-in themes (Obsidian, Moonstone, Ember, Arctic, Void, Terracotta, Sakura, Neon)
- Per-server CSS editor with live visual theme builder (7 panels)
- ~120 design tokens (colors, spacing, radii, typography, shadows, effects, animations)
- Runtime theme switching (no reload)
- Theme import/export (JSON, CSS, Figma tokens)
- Theme marketplace (community-shared, rated, versioned)
- Server Brand Identity Kit (colors, gradients, fonts, icon packs, glassmorphism tuning)
- 4 message layout options (Cozy, Compact, Bubbles, Cards)
- Micro-interaction library (spring animations, staggered entries, cursor-tracking glow)
- High contrast mode, reduced motion, font scaling, saturation control

### Notifications
- Web Push (VAPID, self-hosted)
- Android (FCM), iOS (APNs)
- Per-server, per-channel notification preferences
- DND scheduling with time ranges
- @everyone/@here with permission enforcement

### Cross-Platform
- Web (Vite + React, PWA)
- Windows + macOS (Electron, auto-updater)
- iOS + Android (Expo + React Native)
- Seamless cross-device sync (read states, presence, messages)
- Offline-first mobile (WatermelonDB)
- Native call UI (CallKit/ConnectionService)
- Deep linking for invites and DMs

### Knowledge & Organization (NEW — from research)
- Knowledge base / wiki channels (persistent, searchable, editable docs within a server)
- Q&A channel type (questions + accepted answers, votable)
- Data export tools (full server/channel/DM export as JSON/CSV/HTML)
- Public-readable channels (view content without joining the server)
- Event scheduling system (calendar, RSVPs, reminders, recurring events)
- Calm mode (user setting: hide typing indicators, reduce notification urgency, softer sounds)

### Developer Platform
- Developer portal with API reference (auto-generated)
- OAuth2 for third-party apps
- Bot SDK documentation
- Plugin SDK documentation
- Webhook system

### Security
- JWT + refresh token rotation with breach detection
- TOTP 2FA + backup codes
- E2E encryption for DMs (opt-in, Phase 2)
- Suspicious login detection
- Rate limiting on all endpoints
- CSP headers, CORS, input sanitization
- Session management with device tracking

### Onboarding & First-Time Experience
- Guided welcome flow (profile setup, theme selection, friend discovery)
- Progressive feature disclosure (contextual tooltips at the right moment)
- Purposeful empty states with illustrations and CTAs on every blank screen
- Server onboarding (rules agreement, role self-selection, welcome screen, welcome DM)
- Onboarding state tracking per user

### UX Polish
- Right-click/long-press context menus on every element (messages, users, channels, servers)
- Image lightbox with zoom, pan, navigation, download
- Inline video player (custom UI, PiP, fullscreen)
- Inline audio player with waveform visualization
- File preview (PDF, code files with syntax highlighting)
- Upload progress bars per file with retry on failure
- Connection status indicator (reconnecting, disconnected, slow connection)
- Failed message send with retry/delete buttons + optimistic updates
- Full search UI with filters (from, in, has, before, after, date range, boolean operators)
- Sound design system with multiple sound packs (Crystalline, Minimal, Retro, Nature)
- Per-event sound toggles + master volume + output device selection
- Streamer mode (auto-detect streaming software, hide personal info, invite links, notifications)
- Developer mode (copy IDs from context menus, debug info)
- Loading states for every async operation (skeleton shimmer, progress bars, spinners)

### Admin & Analytics
- Server admin dashboard (member growth, message volume, active users, retention)
- Channel engagement analytics (ranked by activity, dead channel detection)
- Voice usage metrics (minutes, concurrent users, popular channels)
- Moderation dashboard (report queue, quick actions, resolution workflow)
- Auto-mod activity tracking (triggers, false positive rate)
- Recent mod actions feed (audit log visualization)

### Internationalization
- i18next framework with namespaced translation files
- 7 launch languages (English, Spanish, Portuguese, French, German, Japanese, Korean)
- Community translation program (Crowdin/Weblate)
- RTL layout support (CSS logical properties)
- Locale-aware date/time/number formatting
- In-app message translation (LibreTranslate/DeepL, auto-detect language)

### Privacy & Account Management
- Comprehensive settings page (Account, Privacy, Appearance, Accessibility, Notifications, Voice, Keybinds, Language, Streamer, Advanced)
- Change email/password flows with verification
- Password reset via email with session revocation
- 2FA enable/disable/recovery with backup codes
- Privacy dashboard (visual summary of stored data, consent toggles)
- GDPR data export (full account data as downloadable archive)
- Account deletion with 14-day grace period (anonymize or purge messages)
- Invisible presence mode
- Idle auto-detection (configurable timeout)
- Custom DND schedule (days of week, time range, timezone, exception users)
- Calm mode (hide typing indicators, batch notifications, dot-only badges)

### Platform-Specific
- Mobile: haptic feedback on all interactions (send, long-press, swipe, react)
- Mobile: gesture navigation (swipe to reply, swipe to go back, double-tap to react)
- Mobile: bottom sheet modals (natural thumb reach)
- Mobile: iOS Live Activities, Home Screen widgets, ShareExtension, Spotlight search
- Mobile: Android Material You theming, notification channels, PiP, Bubbles API
- Desktop: minimize to tray, remember window position/size, auto-launch on startup
- Desktop: global shortcuts (push-to-talk, mute, deafen, show/hide window)
- Desktop: game detection for Rich Presence (process scanning, curated game list)
- Desktop: native OS notification grouping with click-to-navigate

### Marketing Website
- Download page (platform auto-detection)
- Server discovery
- Safety/trust center
- Support/help center
- Engineering blog
- Developer documentation portal
- Brand assets page

---

## 21. Monetization — Gratonite Crystalline (One-Time Purchase)

**"Crystalline"** — the premium upgrade, geology-themed to match Gratonite.

### Philosophy

The core product is **100% free forever**. Crystalline is a **one-time purchase** — no subscriptions, no recurring fees. People are sick of subscriptions. You pay once, you own it forever. Every feature that matters for communication is free. Crystalline is about cosmetic extras, higher limits, and supporting the platform.

### Sign-Up (see Section 1 for full registration flow)

- **Google OAuth** (one-click sign in — still requires Username, Display Name, Date of Birth on first use)
- **Email + password** (traditional registration: Email, Username, Display Name, Password, Date of Birth)
- Minimum age: **16 years old** — enforced at registration, date of birth encrypted at rest
- No paywall on sign-up — completely free to create an account and use all core features

### What Crystalline Unlocks (one-time purchase)

| Feature | Free | Crystalline (one-time) |
|---|---|---|
| Animated avatar | Yes | Yes |
| Animated banner | Yes | Yes |
| Profile avatar decorations | Basic set | Full library + exclusive designs |
| Profile effects | None | Animated particle/gradient effects |
| Custom status emoji | Server emoji only | Any emoji from any server |
| Upload limit | 25MB | 100MB |
| Message length | 4000 chars | 8000 chars |
| Video quality | 720p 30fps | 1080p 60fps + 4K screen share |
| Soundboard | Server sounds only | Global soundboard library |
| Sticker slots | Server stickers | Personal sticker collection (use anywhere) |
| HD streaming | Standard | Source quality streaming |
| Profile badge | None | Crystalline badge (animated, permanent) |
| Server boosts included | 0 | 2 boosts (permanent) |
| Cross-server emoji | No | Use any server's emoji anywhere |

### Implementation

**`user_purchases` table**: `user_id`, `product_id` (e.g., `crystalline`), `purchased_at`, `payment_provider` (stripe / paypal), `external_payment_id`, `amount_cents`, `currency`

**Payment integration**: Stripe Checkout (one-time payment) + PayPal. No subscription webhooks needed — just a single payment confirmation webhook. On successful payment, set `user_profiles.tier = 'crystalline'`.

**Feature gating**: Check tier in tRPC middleware. `requireCrystalline()` guard on relevant procedures. Client: `usePurchase()` hook returns current tier, gates UI elements.

---

## 22. Verification & Testing Plan

### Local Smoke Test
1. `docker-compose up -d` → all services healthy
2. Register user (Email + Username + Display Name + Password + DOB) → verify email → login → set avatar + banner → confirm CDN URLs
2b. Register via Google OAuth → confirm Username + Display Name + DOB prompt → verify account creation
3. Create server → customize icon, banner, welcome screen
4. Create text channel → send message → confirm delivery on second browser tab
5. Create voice channel → join from two tabs → confirm audio (LiveKit room)
6. Set per-server avatar + nickname → confirm displayed correctly
7. Add custom emoji → send in message → confirm rendered
8. Apply custom CSS theme → confirm injection
9. Install test bot → authorize → invoke slash command → confirm response
10. Send friend request → accept → send DM → confirm delivery
11. Create forum channel → post thread with tags → confirm sorting
12. Test auto-mod rule → send blocked keyword → confirm blocked + alert

### Integration Tests (Vitest + Supertest)
- Auth flows (register with all 5 fields, age < 16 rejection, duplicate username/email rejection, email verification, Google OAuth with DOB prompt, login by username, login by email, refresh rotation, 2FA, suspicious login, password reset)
- Profile CRUD (avatar upload pipeline, banner, per-server overrides)
- Permission resolution (role hierarchy, channel overrides, timeout)
- Message ordering (sequence numbers, dedup)
- Message features (reactions, pins, polls, embeds, voice messages)
- WebSocket event delivery to multiple connected clients
- Cross-device sync (read state, presence, custom status)
- Bot webhook delivery + slash command interaction flow
- Rate limiting (per-route, per-user)
- Auto-moderation triggers
- Invite system (create, use, expire, limits)

### E2E Tests (Playwright — web; Detox — mobile)
- Full message send/receive flow
- Voice channel join/leave + screen share
- Theme apply + per-server CSS injection
- Profile card rendering (avatar, banner, badges, connected accounts)
- Deep link handling on mobile (invite code)
- Friend system flow (send/accept/block)
- Forum channel (create thread, apply tags, sort)
- Keyboard navigation (tab through regions, quick switcher)
- Reduced motion mode

### Load Testing (k6)
- 1,000 concurrent WebSocket connections
- 10,000 messages/minute throughput
- Voice channel with 25 participants
- Image upload pipeline under concurrent load (100 simultaneous uploads)

---

## 23. Development Phases

### Phase 1: Foundation (Weeks 1–4)
- Monorepo scaffold (Turborepo + pnpm)
- Database schema (Drizzle ORM) + Docker Compose
- Auth module (register, Google OAuth, login, JWT, refresh, 2FA)
- User profiles (avatar, banner, bio, settings)
- Core WebSocket gateway (Socket.IO + Redis pub/sub)
- i18n framework setup (i18next, English strings, locale detection)
- Comprehensive settings architecture (all pages, even if empty initially)

### Phase 2: Core Communication (Weeks 5–10)
- Server/guild CRUD + roles + permissions (bitwise)
- Channel CRUD (text, voice, categories)
- Message system (send, edit, delete, reactions, pins)
- Real-time delivery + cross-device sync
- File upload pipeline (MinIO + sharp) with progress bars + retry
- Friend system + DMs
- Context menus on all elements (messages, users, channels, servers)
- Emoji picker + autocomplete + GIF picker (Tenor) + sticker picker
- Clipboard integration (paste-to-upload, copy message link)
- Search UI with advanced filters (from, in, has, before, after)
- Connection status indicator + failed message retry UX
- Empty states for all screens

### Phase 3: Voice & Video (Weeks 11–14)
- LiveKit integration (voice channels)
- Screen share (entire screen, app window, browser tab)
- Go Live / game streaming with viewer count
- Video calls (camera, background blur, virtual backgrounds, grid/speaker view)
- 1:1 and group DM calls with ring UI
- Voice presence system
- Push-to-talk (desktop)
- Mobile voice (react-native-webrtc + CallKit/ConnectionService)
- PiP, pop-out window, theater mode for streams

### Phase 4: Rich Features (Weeks 15–20)
- Threads + forum channels
- Wiki channels + Q&A channels
- Polls, scheduled messages, voice messages
- Link preview pipeline
- Custom emoji + stickers
- Soundboard
- Auto-moderation + raid protection
- Event scheduling system with calendar + RSVPs
- Data export tools (server/channel/DM export)
- Public-readable channels
- Media viewers (image lightbox, video player, audio player, file preview)
- Sound design system (sound packs, per-event toggles)
- Server admin dashboard + analytics (member growth, message volume, engagement)
- Moderation dashboard (report queue, quick actions, audit log viz)

### Phase 5: Customization & Theming (Weeks 21–24)
- Theming system (@gratonite/themes, ~120 tokens)
- Crystalline design language (glassmorphism, glow system, living surfaces)
- Per-server CSS editor with visual theme builder (7 panels)
- Per-server profiles (avatar, banner, nickname, bio overrides)
- Server Brand Identity Kit (guild_brand table, background studio, font picker)
- Theme marketplace
- Avatar decorations + profile effects
- 4 message layout options (Cozy, Compact, Bubbles, Cards)
- Calm mode + streamer mode
- Customizable UI density for professional vs casual use
- Micro-interaction library (@gratonite/motion)

### Phase 6: Bot & Plugin Platform (Weeks 25–28)
- OAuth2 app registration + bot authorization
- Gateway intents + event delivery (webhook + WebSocket)
- Slash commands infrastructure
- Client-side plugin system (iframe sandbox)
- Developer portal documentation

### Phase 7: Cross-Platform Apps (Weeks 29–34)
- Electron desktop app (Windows + macOS)
  - System tray, minimize to tray, auto-launch, window state persistence
  - Global shortcuts, game detection / Rich Presence
  - Notification grouping + click-to-navigate
- Expo React Native app (iOS + Android)
  - Haptic feedback on all interactions
  - Gesture navigation (swipe to reply, swipe back, double-tap react)
  - Bottom sheet modals
  - iOS: Live Activities, widgets, ShareExtension, Spotlight
  - Android: Material You, notification channels, PiP, Bubbles
- Push notifications (VAPID, FCM, APNs)
- Deep linking
- Offline-first mobile (WatermelonDB)

### Phase 8: Onboarding, Polish & i18n (Weeks 35–38)
- App-level onboarding flow (welcome screen, profile setup, friend discovery)
- Server onboarding (rules agreement, role self-selection, welcome DM)
- Progressive feature disclosure (contextual tooltips)
- Empty state illustrations (themed to current palette)
- Privacy dashboard + GDPR data export + account deletion flow
- Password reset + 2FA recovery flows
- Community translation program launch (6 additional languages)
- In-app message translation (LibreTranslate/DeepL)

### Phase 9: Marketing & Launch (Weeks 39–42)
- Marketing website (Next.js, 3D hero, animations)
- Server discovery page
- Support center + blog
- Crystalline one-time purchase + Stripe integration
- Production Kubernetes deployment
- Load testing + performance optimization
- Public launch

---

## 24. Community Research: Discord Pros/Cons & Competitive Insights

Research compiled from community articles and expert analysis to inform Gratonite's design decisions.

### What Discord Gets RIGHT (preserve these in Gratonite)

| Strength | Details | Gratonite Status |
|---|---|---|
| **Low-friction UX** | "Very, very good" at serving its purpose with minimum friction for users and admins | Core priority — must match or exceed |
| **Moderation tools** | Granular permissions, role-based access, auto-word catching, flexible responses (timeout/kick/ban) | Already planned (Section 11) |
| **Onboarding flow** | Community rule agreement before participation, welcome screens | Already planned (welcome_screens) |
| **Voice chat accessibility** | Primary way people do voice chat with strangers without revealing identity | Already planned (LiveKit, Section 6) |
| **Versatility** | Voice chat, forums, events, support, creative collaboration, education — one platform does it all | Already planned (channel types, stage, forum) |
| **Free access & familiarity** | Free tier is genuinely useful, not crippled | Core philosophy — free forever, Crystalline is cosmetic only |
| **Feature maturity** | Well-considered, helpfully implemented features out of the box | Goal: match feature parity then exceed |
| **Community building** | Effectively brings people together in quasi-public spaces | Server discovery, invites, welcome screens planned |

### What Discord Gets WRONG (Gratonite must solve these)

| Pain Point | Details | Gratonite Solution |
|---|---|---|
| **Vendor lock-in** | No exit strategy; if Discord fails, communities go dark | Self-hostable, open-source, data export tools (NEW) |
| **Data privacy** | Messages unencrypted; data given to law enforcement; used for AI training | E2E encryption (opt-in DMs), no AI training on user data, transparent privacy policy |
| **Search is terrible** | Finding old messages is "a proper disaster" | PostgreSQL FTS → Meilisearch with advanced filters (Section 4) — make this a TOP priority |
| **Ephemeral knowledge** | Messages disappear into scrollback; community history lost | Knowledge base / wiki channels (NEW), pinned message improvements, better search |
| **Thread archival** | Threads archived after 3 days (free) / 3 weeks (boosted); data loss | No thread archival — threads persist forever, no paywall |
| **Text DMs unencrypted** | E2E only for voice/video (added 2024), not text | E2E for DMs planned (Phase 2, opt-in) — consider making default |
| **Age verification risks** | Data breaches from verification systems (70K IDs exposed) | Minimal data collection approach; no third-party age verification vendors |
| **No group moderation** | Admins cannot delete abusive messages from others' devices | Server-side message deletion already planned; client respects server state |
| **Monetization hurts creators** | Nitro/boosts benefit Discord, not community builders | Crystalline is one-time purchase; consider revenue sharing for server owners (FUTURE) |
| **Questions get buried** | New member questions lost in minutes; no issue tracking | Forum channels with tags + sorting solve this; consider Q&A channel type (NEW) |
| **Interface complexity** | Platform feels "busy" with too many features for simple use | Customizable UI density; clean defaults with progressive disclosure |
| **Forces server joins for docs** | "Every time a technologist has to join a Discord server to learn how something works..." | Public-readable channels option (NEW) — view without joining |
| **Real-time anxiety** | "Several people are typing..." triggers urgency | Configurable typing indicators; calm mode setting (NEW) |
| **"Server" naming confusion** | Users don't understand what "server" means | Use "Spaces" as user-facing term (server internally) — already a consideration |
| **Sustainability risk** | Freemium model = policy changes, ad escalation, pricing hikes | Self-hostable + open-source = community always has escape hatch |

### What Competitors Do Better (features to adopt)

| Competitor | Strength | Gratonite Action |
|---|---|---|
| **Slack** | Clean interface, threaded conversations, fantastic search | Prioritize search UX; thread-first forum channels already planned |
| **Element/Matrix** | E2E encryption, decentralization, self-hosting | Self-hostable already planned; federation is a stretch goal (NEW) |
| **Guilded** | Advanced tournament/calendar tools, completely free | Event scheduling system (NEW); tournament brackets (FUTURE) |
| **TeamSpeak** | Crystal-clear, low-latency audio | LiveKit SFU provides this; emphasize audio quality tuning |
| **Rocket.Chat** | Complete data/security/customization control | Self-hosted + open-source already core to our approach |
| **Signal** | Best-in-class privacy, no data under subpoena, usernames | Adopt: username-based identity (already planned), minimize stored metadata |

### Critical Insights for Gratonite's Strategy

1. **"The tool is not the community"** — Platform choice matters mechanistically but human culture drives success. Gratonite must lower barriers, not create them.

2. **Community lifecycle matters** — Real-time chat serves early excitement well, but mature communities need knowledge organization. Gratonite needs wiki/knowledge-base features alongside chat.

3. **Five evaluation criteria** for platforms: Functionality, Openness, Security, Safety, Decentralization. Gratonite scores well on all five by design.

4. **No current alternative fully replaces Discord** while maintaining privacy — this is our opportunity. The market gap is real.

5. **Privacy without compromise** — Users increasingly care about data sovereignty. Being self-hostable and open-source is a genuine competitive advantage, not just ideology.

6. **Professional use cases exist** — Discord's gaming focus alienates business users. Gratonite's customizability (themes, channel types, UI density) can serve both casual and professional.

### NEW Features Identified from Research (to add to plan)

| Feature | Priority | Phase |
|---|---|---|
| **Data export tools** (full server/channel/DM export) | HIGH | Phase 2 |
| **Knowledge base / wiki channels** (persistent, searchable, editable docs within a server) | HIGH | Phase 4 |
| **Q&A channel type** (questions + accepted answers, votable) | MEDIUM | Phase 4 |
| **Public-readable channels** (view without joining server) | MEDIUM | Phase 4 |
| **Calm mode** (hide typing indicators, reduce notification urgency) | LOW | Phase 5 |
| **Event scheduling system** (calendar, RSVPs, reminders) | MEDIUM | Phase 4 |
| **Federation protocol** (servers can optionally federate) | LOW | Future |
| **Revenue sharing for server owners** (optional monetization tools) | LOW | Future |
| **"Spaces" user-facing terminology** (instead of "servers") | HIGH | Phase 1 (naming) |

---

## 25. Critical Files to Create (Phase 1 Scaffold)

```
gratonite/
├── turbo.json
├── pnpm-workspace.yaml
├── .github/
│   └── workflows/
│       ├── ci.yml                          # Lint, typecheck, test, build on PR
│       └── release.yml                     # Build + deploy on tag
├── packages/
│   ├── @gratonite/types/src/index.ts       # All shared TypeScript types
│   ├── @gratonite/themes/src/tokens.ts     # Design token definitions
│   ├── @gratonite/api-client/src/index.ts  # Socket.IO + tRPC client
│   ├── @gratonite/markdown/src/            # Parser, React renderer, RN renderer, sanitizer
│   ├── @gratonite/profile-resolver/src/    # Per-server profile resolution logic
│   ├── @gratonite/a11y/src/                # VisuallyHidden, FocusTrap, hooks
│   ├── @gratonite/ui/src/                  # Shared headless components (.web.tsx / .native.tsx)
│   ├── @gratonite/hooks/src/               # useChat, useVoiceCall, usePresence, useTheme
│   ├── @gratonite/business-logic/src/      # Permissions, mention parsing, encryption
│   └── db/
│       ├── schema/                         # Drizzle ORM schema definitions
│       ├── migrations/                     # Timestamped SQL migration files
│       └── seed/                           # Development seed data
├── apps/
│   ├── api/src/
│   │   ├── index.ts                        # Express + Socket.IO server
│   │   ├── env.ts                          # Zod environment validation
│   │   ├── middleware/
│   │   │   ├── auth.ts                     # JWT verification + Google OAuth
│   │   │   ├── rate-limiter.ts             # Redis sliding window rate limiter
│   │   │   └── security-headers.ts         # CSP, CORS, etc.
│   │   ├── modules/auth/                   # JWT, refresh, 2FA, Google OAuth
│   │   ├── modules/users/                  # Profiles, presence, settings, friends
│   │   ├── modules/guilds/                 # CRUD + permissions + roles
│   │   ├── modules/channels/               # All channel types + threads
│   │   ├── modules/messages/               # CRUD + reactions + pins + polls + embeds
│   │   ├── modules/files/                  # MinIO upload + image processing pipeline
│   │   ├── modules/moderation/             # Bans, kicks, timeouts, automod, reports
│   │   ├── modules/notifications/          # Web Push, FCM, APNs
│   │   ├── modules/bots/                   # OAuth2 apps, slash commands, webhooks
│   │   ├── modules/invites/                # Create, use, expire invites
│   │   └── modules/search/                 # PostgreSQL FTS → Meilisearch
│   ├── voice-service/src/                  # Separate process: LiveKit rooms + signaling
│   ├── web/src/
│   │   ├── App.tsx
│   │   ├── layouts/AppLayout.tsx           # Sidebar + channel list + main content
│   │   └── features/                       # Voice, Chat, Settings, Themes, Profiles, Friends
│   ├── desktop/
│   │   ├── main.ts                         # Electron main process
│   │   └── preload.ts                      # contextBridge IPC surface
│   ├── mobile/
│   │   ├── app.json                        # Expo config + deep link scheme
│   │   └── src/
│   │       ├── navigation/                 # React Navigation setup
│   │       └── features/                   # Chat, Voice, Settings, Profiles
│   └── website/                            # Next.js marketing site
│       ├── src/app/                        # /, /download, /discover, /safety, /support, /blog, /developers
│       ├── src/components/                 # Hero, FeatureSection, DownloadCard, ServerCard
│       └── src/content/                    # MDX blog posts, support articles
├── docker-compose.yml                      # All services for local dev
└── helm/                                   # Kubernetes Helm chart
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
```

---

## 26. Onboarding & First-Time Experience

The first 5 minutes determine whether someone shares Gratonite with friends or uninstalls it. Every empty screen is a missed opportunity.

### App-Level Onboarding (First Launch)

**Step 1 — Welcome Screen** (after registration/login):
- Animated Crystalline-branded welcome with the user's display name: "Welcome to Gratonite, {displayName}"
- Brief tagline: "Your space. Your rules. Your community."
- 3 quick-choice cards: "Create a Space" / "Join a Space" / "Explore Public Spaces"
- Skip button always visible — never trap users in onboarding

**Step 2 — Profile Quick Setup** (optional, skippable):
- Upload avatar (or keep generated default — color-coded by `user_id % 6`)
- Pick accent color (color wheel, 1 tap)
- Choose theme (carousel of 8 built-in themes with live preview behind the modal)
- "You can always change these later in Settings"

**Step 3 — Connect with Friends** (optional, skippable):
- "Know someone on Gratonite?" → search by username
- "Invite friends" → generate personal invite link (tracks who invited whom for future "referral" badges)
- Import contacts (optional, privacy-first — never uploaded to server, matched locally)

**Step 4 — Discover or Create**:
- If "Join a Space" → show curated discovery page (popular, trending, by category)
- If "Create a Space" → guided server creation wizard (name, icon, first channel, invite link)
- If "Explore" → drop into `/discover` with categories

**Completion**: User lands in the app with at least one space or their DM home with a system welcome message from "Gratonite Bot" explaining key shortcuts and features.

### Guided Feature Discovery (Progressive Disclosure)

Instead of a full tutorial, use **contextual tooltips** that appear once, at the right moment:

| Trigger | Tooltip | Shown When |
|---|---|---|
| First time in a text channel | "Type a message below, or drag files to share them" | User views a channel for the first time |
| First time near voice channel | "Click to join voice — your mic will be muted by default" | User hovers a voice channel |
| First message sent | "🎉 First message! Pro tip: Use `Ctrl+K` to quickly jump between channels" | After first message send |
| First reaction received | "Someone reacted! Click the + to add your own reaction" | First reaction on user's message |
| First time in settings | Highlight key sections with subtle pulse animation | User opens settings |
| 5th session | "Did you know? You can customize this Space's look in Server Settings → Appearance" | 5th app open |
| First voice join | "You're in! Click 🎥 for video, 🖥️ for screen share" | After joining voice |

**Implementation**: `user_onboarding_state` table: `user_id`, `tooltips_seen` (JSONB set of tooltip IDs), `onboarding_completed` (boolean), `first_message_at`, `first_voice_at`, `spaces_joined_count`. Client: `useOnboarding()` hook checks state and shows appropriate tooltip.

### Empty States (Every Blank Screen Has Purpose)

| Screen | Empty State |
|---|---|
| **Home (no spaces)** | Illustration of floating crystalline islands + "Create your first Space or explore communities" with two CTA buttons |
| **Channel (no messages)** | "This is the beginning of #{channelName}. Start the conversation!" with suggested icebreaker prompts (customizable by server admin) |
| **Friends list (no friends)** | "It's quiet here... Add friends by username or share your invite link" with copy-link button |
| **DMs (no conversations)** | "No messages yet. Start a conversation with a friend!" with friend search |
| **Search (no results)** | "No results for '{query}'. Try different keywords or check your filters" with filter suggestions |
| **Notifications (none)** | "All caught up! 🎉" with subtle celebration animation (confetti particles, respects reduced motion) |
| **Server member list (new server)** | "Just you for now! Share your invite link to grow your community" with prominent invite button |
| **Forum channel (no threads)** | "No threads yet. Be the first to start a discussion!" with "New Thread" CTA |
| **Pinned messages (none)** | "No pinned messages. Pin important messages by right-clicking → Pin" |

**Design**: Empty states use the server's accent color + a custom illustration set (part of `@gratonite/ui`). Illustrations are vector SVG, themed to match the current color palette dynamically.

### Server Onboarding (Joining a New Space)

When a user joins a server for the first time:

1. **Server Rules Screen** (if configured by admin):
   - `guild_onboarding` table: `server_id`, `enabled`, `rules_channel_id`, `rules_text` (markdown, max 2000 chars), `require_agreement` (boolean)
   - User must scroll through and click "I agree" before accessing channels
   - Agreement recorded: `guild_member_agreements` table: `user_id`, `server_id`, `agreed_at`, `rules_version`

2. **Role Self-Selection** (if configured):
   - `guild_onboarding_prompts` table: `server_id`, `title` ("What brings you here?"), `description`, `type` (single_select / multi_select), `required`
   - `guild_onboarding_options` table: `prompt_id`, `label` ("Gaming", "Art", "Music"), `emoji`, `role_ids` (bigint[] — roles auto-assigned on selection), `channel_ids` (bigint[] — channels revealed)
   - User picks options → roles assigned → relevant channels become visible

3. **Welcome Screen** (existing `welcome_screens` table):
   - Customizable description + recommended channels displayed as cards

4. **Welcome Message** (auto-sent by system):
   - Configurable template: "Welcome {displayName}! Check out #rules and #introductions to get started"
   - `guild_welcome_config` table: `server_id`, `channel_id` (where to post), `message_template`, `enabled`, `dm_welcome_enabled`, `dm_template`

---

## 27. UX Polish & Interaction Details

This section covers every interaction detail that separates a polished app from a prototype.

### Context Menus (Right-Click / Long-Press)

Every interactive element has a contextual action menu. On desktop: right-click. On mobile: long-press with haptic feedback.

**Message Context Menu**:
| Action | Shortcut | Condition |
|---|---|---|
| Reply | R | Always |
| Edit | E | Own messages only |
| Delete | Del | Own messages or MANAGE_MESSAGES permission |
| Pin / Unpin | P | MANAGE_MESSAGES permission |
| Copy Text | Ctrl+C | Always |
| Copy Message Link | — | Always |
| Copy Message ID | — | Developer Mode enabled |
| React | — | Always (opens quick-react bar: 4 recent + emoji picker) |
| Create Thread | — | In supported channels |
| Forward | — | Always (select channel/DM to forward to) |
| Mark Unread | — | Always (resets read state to this message) |
| Speak Message | — | Text-to-speech (uses Web Speech API / native TTS) |
| Report | — | Always (opens report modal) |
| Translate | — | If i18n enabled (auto-detect language, translate inline) |

**User Context Menu** (in member list, message author, DM list):
| Action | Condition |
|---|---|
| View Profile | Always |
| Send Message | Always |
| Add Friend / Remove Friend | Based on relationship state |
| Block / Unblock | Always |
| Mention | In message composer context |
| Change Nickname | In server, with permission |
| Manage Roles | MANAGE_ROLES permission |
| Kick | KICK_MEMBERS permission |
| Ban | BAN_MEMBERS permission |
| Timeout | MODERATE_MEMBERS permission |
| Copy Username | Always |
| Copy User ID | Developer Mode enabled |

**Channel Context Menu**:
| Action | Condition |
|---|---|
| Mark as Read | Always |
| Mute Channel | Always (submenu: 15min, 1hr, 8hr, 24hr, until I turn it off) |
| Edit Channel | MANAGE_CHANNELS permission |
| Notification Settings | Always |
| Copy Channel Link | Always |
| Copy Channel ID | Developer Mode enabled |
| Create Invite | CREATE_INVITE permission |
| Delete Channel | MANAGE_CHANNELS permission (with confirmation modal) |

**Server Context Menu** (on server icon):
| Action | Condition |
|---|---|
| Mark as Read | Always |
| Mute Server | Always |
| Server Settings | MANAGE_GUILD permission |
| Notification Settings | Always |
| Create Invite | Always |
| Create Channel | MANAGE_CHANNELS permission |
| Create Category | MANAGE_CHANNELS permission |
| Leave Server | Always (with confirmation) |
| Copy Server ID | Developer Mode enabled |

### Clipboard & Sharing

**Paste-to-Upload**: Paste image from clipboard directly into message composer → shows preview thumbnail inline with remove button. Supports PNG, JPEG, GIF, WebP. Implementation: `onPaste` event handler → `navigator.clipboard.read()` → create `File` object → trigger upload flow.

**Drag-and-Drop Upload**: Drag files from desktop onto any channel → overlay appears: "Drop to upload to #{channelName}". Multiple files supported. Progress bar per file. Cancel button per upload.

**Upload Progress**: Linear progress bar on each file being uploaded, showing percentage + estimated time remaining. On completion, smooth transition to the rendered attachment in the message.

**Copy Message Link**: Generates permalink: `https://app.gratonite.app/channels/{serverId}/{channelId}/{messageId}`. Clicking the link scrolls to and highlights the message with a brief golden glow animation.

**Share to External**: Mobile: native share sheet (iOS UIActivityViewController / Android Intent.ACTION_SEND). Desktop: "Copy Link" for all sharing.

### Media Viewers

**Image Lightbox**:
- Click any image → full-screen overlay with glassmorphism backdrop
- Zoom: scroll wheel (desktop), pinch (mobile), double-tap to fit/fill
- Pan when zoomed in (click-drag / finger-drag)
- Arrow keys / swipe to navigate between images in the same message or channel
- Download button, Open Original button, Copy Image button
- Image metadata shown: filename, dimensions, size
- Close: Escape key, click backdrop, X button, swipe down (mobile)
- Framer Motion `layoutId` animation from thumbnail to lightbox (seamless morph)

**Video Player** (inline):
- Custom player UI matching Gratonite's design (not native `<video>` controls)
- Play/pause, seek bar, volume, fullscreen, picture-in-picture
- Quality selector (if multiple variants exist)
- Autoplay in viewport (muted), click to unmute
- Mobile: native fullscreen with rotation support

**Audio Player** (inline):
- Waveform visualization (pre-computed on upload, stored as base64)
- Play/pause, seek by clicking waveform, playback speed (0.5x, 1x, 1.5x, 2x)
- Duration display, elapsed time
- For voice messages: waveform + play button, compact inline style

**File Preview** (non-media):
- PDF: inline preview (first page rendered via `pdfjs`)
- Code files (.js, .py, .ts, etc.): syntax-highlighted preview with "Open Raw" button
- Other files: icon + filename + size + download button

### Emoji System

**Emoji Picker** (`@gratonite/emoji-picker`):
- Opened via smiley button in message composer or `:` autocomplete trigger
- **Tabs**: Recently Used, Frequently Used, People, Nature, Food, Activities, Travel, Objects, Symbols, Flags, Custom (server emoji)
- **Search**: Real-time search by name (e.g., type "fire" → 🔥), fuzzy matching
- **Skin tone selector**: Click and hold on supported emoji → 6 skin tone variants, remembered per emoji
- **Custom emoji section**: Server emoji at top, grouped by server (if cross-server emoji via Crystalline)
- **Animated emoji preview**: Hover to preview animation, click to insert
- **Size**: Emoji-only messages (1–3 emoji, no text) render at 3x size ("jumbo emoji")
- **Keyboard navigation**: Arrow keys to browse, Enter to select, Tab to switch categories

**Emoji Autocomplete**:
- Type `:` in message composer → dropdown with matching emoji, updated as you type
- Shows emoji icon + name + server name (for custom emoji)
- Arrow keys to navigate, Tab/Enter to insert, Escape to dismiss
- Also triggered by typing common ASCII emoticons: `:)` → 🙂, `<3` → ❤️

**Sticker Picker**:
- Separate tab in emoji picker or dedicated sticker button
- Browse by pack (server packs + personal collection for Crystalline)
- Preview on hover (animated stickers play)
- Search by name/tag

**GIF Picker**:
- Powered by **Tenor API** (free tier, privacy-respecting — no GIPHY due to Meta ownership)
- Trending GIFs on open, search by keyword
- Preview on hover, click to send
- "Favorites" tab for saved GIFs (stored in `user_favorite_gifs` table)
- Compact grid layout with autoplay previews (respects reduced motion — shows first frame only)

### Search UX

**Search Interface** (opened via `Ctrl+F` or search icon):
- **Search bar** at top of message area with filter chips below
- **Quick filters**: From: {user}, In: {channel}, Has: file/link/image/video/embed/pin, Before: {date}, After: {date}, During: {date range}
- **Autocomplete**: Typing `from:` suggests usernames, typing `in:` suggests channels
- **Boolean operators**: `AND` (default), `OR`, `NOT` / `-` prefix (e.g., `-from:bot`)
- **Exact match**: Wrap in quotes `"exact phrase"`
- **Results view**: Messages shown in context with 1 message before/after, highlighted search terms
- **Jump to message**: Click result → scrolls to message in channel with highlight animation
- **Sort**: By relevance (default) or by date (newest/oldest first)
- **Saved searches**: Pin frequent searches for quick re-use (`user_saved_searches` table)
- **Scope selector**: Current channel / Current server / All servers / DMs

### Error States & Network Resilience

**Connection Status Indicator**:
- Persistent but unobtrusive bar at top of message area
- **Connected**: Hidden (no indicator needed)
- **Reconnecting**: Amber bar: "Reconnecting..." with animated dots + attempt count
- **Disconnected**: Red bar: "Connection lost. Retrying..." with manual "Retry Now" button
- **Slow connection**: Yellow bar: "Connection is slow. Messages may be delayed."

**Failed Message Send**:
- Message appears in composer area with red error indicator
- "Message failed to send" label + "Retry" button + "Delete" button
- Failed messages persist across app restarts (stored in local IndexedDB / WatermelonDB)
- Automatic retry on reconnect (up to 3 attempts, then manual only)

**Failed Upload**:
- Upload progress bar turns red
- "Upload failed" label + "Retry" button + "Cancel" button
- Shows error reason if available ("File too large", "Network error", "Unsupported format")

**Optimistic Updates**:
- Messages appear instantly in the local UI before server confirmation
- If server rejects (rate limit, permissions) → message shows error state
- Reactions, pins, edits all use optimistic updates with rollback on failure

### Sound Design (`@gratonite/sounds`)

**System Sounds** (subtle, tasteful — not annoying):

| Event | Sound | User Control |
|---|---|---|
| Message sent | Soft "whoosh" (50ms) | Toggle on/off |
| Message received (focused channel) | None (visual only) | — |
| Message received (unfocused) | Gentle chime (100ms) | Toggle on/off |
| DM received | Distinct soft ping (150ms) | Toggle on/off |
| Mention received | Slightly more prominent chime | Toggle on/off |
| Voice channel join | Warm "pop" in | Toggle on/off |
| Voice channel leave | Soft "pop" out | Toggle on/off |
| User join (someone else) | Subtle blip | Toggle on/off |
| User leave (someone else) | Subtle blip (lower pitch) | Toggle on/off |
| Call ringing | Loopable ring tone (custom per user) | Volume slider |
| Notification | Default OS notification sound or custom | Selectable from pack |
| Deafen/undeafen | Click on/off | Toggle on/off |
| Mute/unmute | Soft click | Toggle on/off |
| Stream start | Brief escalating tone | Toggle on/off |

**Sound Packs**: Bundled sound theme sets. Default "Crystalline" pack + alternatives: "Minimal" (almost silent), "Retro" (8-bit), "Nature" (organic). Users can mix and match individual sounds. Custom sound upload for Crystalline tier.

**Sound Settings**: Master volume, per-event toggles, output device selection, "Mute all sounds" master toggle. Sounds respect system volume and focus/DND mode.

### Streamer Mode

Activated via toggle in quick settings panel or auto-detected when streaming software (OBS, Streamlabs) is detected (desktop only, via process detection).

**When enabled**:
- All invite links hidden (replaced with "[Invite Link Hidden]")
- Email hidden in settings
- Username obscured in notification popups
- Notification content hidden (shows "New Message" instead of preview)
- Sound effects suppressed (or redirected to non-streamed audio output)
- Personal information in profile card minimized
- DM notifications show "1 new message" without sender/content
- Auto-enabled on stream start, auto-disabled on stream end (configurable)

**`user_settings.streamer_mode`**: `off` / `on` / `auto` (detect streaming software)

### Loading States (Comprehensive)

| Context | Loading State |
|---|---|
| App startup | Crystalline logo animation (faceted gem rotation) → skeleton layout |
| Channel switch | Skeleton messages with accent-tinted shimmer (Section 8) |
| Image loading | BlurHash placeholder → progressive reveal |
| File upload | Per-file progress bar with percentage + speed |
| Pagination (older messages) | Compact spinner at top of message list + "Loading older messages..." |
| Search | "Searching..." with pulsing search icon |
| Profile card | Skeleton card matching final layout (avatar circle, name bars, role pills) |
| Server switch | Background color wash transition (300ms) + skeleton content |
| Emoji picker | Skeleton grid (100ms max, usually instant) |
| Voice connecting | "Connecting to voice..." with animated waveform |
| Bot slash command | "Thinking..." with animated dots (3s timeout → "Taking longer than expected...") |

---

## 28. Server Admin Dashboard & Analytics

Every server owner and admin needs visibility into their community's health.

### Dashboard Overview (`/server/{id}/settings/analytics`)

**Headline Metrics** (cards at top):
- Total Members (with +/- change this week)
- Online Now
- Messages Today (with sparkline trend)
- Active Members This Week (unique users who sent ≥1 message)
- New Members This Week
- Member Retention (% of members from 30 days ago still active)

### Charts & Visualizations

**Member Growth**: Line chart showing total members over time (7d / 30d / 90d / 1y). Overlay: joins (green) vs leaves (red) per day.

**Message Activity**: Bar chart of messages per day. Breakdown by channel (stacked bars). Peak hours heatmap (hour × day-of-week grid).

**Active Members**: Daily/Weekly/Monthly active users (DAU/WAU/MAU). Trend lines + percentage changes.

**Channel Engagement**: Ranked list of channels by message count, unique posters, reaction count. Identifies "dead channels" (0 messages in 30 days) for cleanup.

**Voice Usage**: Minutes in voice per day. Concurrent voice users peak. Most popular voice channels.

**Top Contributors**: Leaderboard of most active members (message count, reaction count, voice minutes). Privacy: opt-out setting for users who don't want to appear.

### Moderation Dashboard (`/server/{id}/settings/moderation`)

**Moderation Queue**:
- List of pending reports sorted by severity + timestamp
- Each report shows: reporter, reported user, message content (if applicable), reason, context (messages around the reported one)
- Quick actions: Dismiss, Warn, Timeout (15min/1hr/1day/1week), Kick, Ban
- Resolution notes field (visible in audit log)

**Auto-Mod Activity**: Chart of auto-mod triggers per day. Breakdown by rule (spam, keyword, mention spam). False positive rate tracking (how many auto-mod blocks were manually overridden).

**Recent Actions**: Audit log feed showing recent mod actions (bans, kicks, timeouts, message deletes) with actor, target, reason, timestamp.

### Implementation

**`server_analytics_daily` table** (materialized, computed nightly by cron job):
- `server_id`, `date`, `total_members`, `new_members`, `left_members`, `messages_sent`, `active_members`, `voice_minutes`, `reactions_added`, `top_channels` (JSONB)

**`server_analytics_hourly` table** (for heatmap, retained 90 days):
- `server_id`, `hour` (timestamptz), `messages`, `active_users`, `voice_users`

**Permissions**: Only users with `VIEW_GUILD_ANALYTICS` permission can access. New permission bit added to the bitwise system.

Real-time metrics (online now, voice now) pulled from Redis. Historical from PostgreSQL materialized views.

---

## 29. Internationalization (i18n) & Localization

Gratonite ships in English first but is architected for multi-language from day one.

### Architecture

**Translation framework**: `i18next` (web + React Native) with the `react-i18next` binding.
- Translation files: `packages/i18n/locales/{lang}/common.json`, `messages.json`, `settings.json`, `onboarding.json`
- Namespaced: avoids loading all strings upfront
- Pluralization rules per locale (handled natively by i18next ICU plugin)
- Date/time formatting: `Intl.DateTimeFormat` (browser-native, locale-aware)
- Number formatting: `Intl.NumberFormat`
- RTL support: CSS logical properties (`margin-inline-start` instead of `margin-left`) + `dir="rtl"` on `<html>`

### Launch Languages (Phase 1)

| Language | Code | Priority |
|---|---|---|
| English (US) | `en-US` | Ship language |
| Spanish | `es` | 2nd largest internet language |
| Portuguese (Brazil) | `pt-BR` | Massive gaming community |
| French | `fr` | Large Discord user base |
| German | `de` | Strong tech community |
| Japanese | `ja` | Gaming + anime communities |
| Korean | `ko` | Gaming communities |

### Community Translation Program (Phase 2)

- **Crowdin** or **Weblate** (open-source) integration for community translations
- Trusted contributors can submit translations via web interface
- Review + approval workflow before translations go live
- Contributor credit (badge: "Translator" with language flag)
- Translation coverage dashboard: percentage complete per language

### User-Facing Settings

- `user_settings.locale` — selected language (default: detect from browser `navigator.language`)
- In-app language picker in Settings → Language
- Timestamps, dates, numbers all respect locale
- Server names, channel names, messages are NOT translated (user-generated content stays as-is)
- System messages (join, leave, pin, etc.) are translated

### Message Translation (In-App)

- "Translate" button in message context menu (Section 27)
- Uses lightweight translation API (LibreTranslate self-hosted for privacy, or DeepL API for quality)
- Translated text appears below original with "Translated from {language}" label
- Translation cached per message to avoid repeated API calls
- Per-user toggle: "Auto-translate messages in languages I don't speak" (detects via `franc` language detection library)

---

## 30. Privacy, Data Controls & Account Management

### Comprehensive Settings Architecture

**Settings Page Hierarchy** (accessible via gear icon or `Ctrl+,`):

```
Settings/
├── My Account
│   ├── Profile (display name, avatar, banner, bio, pronouns, accent color)
│   ├── Account (email, username, password change, 2FA)
│   ├── Connected Accounts (GitHub, Spotify, Twitch, etc.)
│   ├── Sessions (active devices, revoke sessions)
│   └── Account Actions (disable account, delete account)
├── Privacy & Safety
│   ├── Privacy Settings (DM permissions, friend requests, activity visibility)
│   ├── Safety (block list, who can add to group DMs)
│   ├── Data & Privacy Dashboard
│   └── Consent Management
├── Appearance
│   ├── Theme (select from built-in + installed themes)
│   ├── Theme Editor (customize current theme)
│   ├── Message Layout (cozy, compact, bubbles, cards)
│   ├── Font Scale (0.75x – 1.5x slider)
│   ├── Chat Density (spacing adjustment)
│   └── Advanced (developer mode, hardware acceleration)
├── Accessibility
│   ├── Reduced Motion (toggle)
│   ├── High Contrast (toggle)
│   ├── Saturation (0.0–1.0 slider)
│   ├── Screen Reader Optimizations
│   ├── Focus Indicators (style options)
│   └── Sticker/GIF Autoplay (toggle)
├── Notifications
│   ├── Desktop Notifications (enable, sounds, preview)
│   ├── Mobile Push (enable, badge counts)
│   ├── Notification Sounds (per-event toggles, sound pack selection)
│   ├── DND Schedule (quiet hours with time range)
│   └── Per-Server Overrides (list of servers with notification level)
├── Voice & Video
│   ├── Input Device (microphone selection)
│   ├── Output Device (speaker selection)
│   ├── Input Sensitivity (auto or manual threshold)
│   ├── Noise Suppression (toggle + strength)
│   ├── Echo Cancellation (toggle)
│   ├── Push to Talk (keybind configuration)
│   ├── Video Settings (camera selection, mirror self-view)
│   └── Voice Processing (voice isolation toggle)
├── Keybinds
│   ├── Full keybind list (action → shortcut, editable)
│   ├── Reset to defaults button
│   └── Import/export keybinds
├── Language
│   ├── App Language (locale selector)
│   ├── Auto-Translate (toggle + preferred languages)
│   └── Date/Time Format (12h / 24h, date order)
├── Streamer Mode
│   ├── Enable (off / on / auto-detect)
│   ├── Hide invite links (toggle)
│   ├── Hide personal info (toggle)
│   └── Disable notification previews (toggle)
└── Advanced
    ├── Developer Mode (shows IDs in context menus)
    ├── Hardware Acceleration (toggle)
    ├── Experimental Features (feature flag toggles)
    └── Diagnostic Data (crash reports opt-in)
```

### Account Management Flows

**Change Email**:
1. Settings → My Account → Account → Change Email
2. Enter current password for verification
3. Enter new email → verification email sent to NEW address
4. Click verification link → email updated
5. Notification sent to OLD email: "Your email was changed. If this wasn't you, contact support."

**Change Password**:
1. Enter current password
2. Enter new password (strength meter, same rules as registration)
3. On success: all other sessions revoked, user must re-login on other devices
4. Confirmation email sent

**Password Reset** (forgot password):
1. Click "Forgot password?" on login page
2. Enter email address
3. Reset link sent (JWT token, 1h expiry, single-use)
4. Click link → enter new password
5. All sessions revoked on success

**Enable/Disable 2FA**:
1. Enable: Enter password → scan QR code with authenticator app → enter verification code → shown backup codes (must save)
2. Disable: Enter password + TOTP code → 2FA removed

**2FA Recovery** (lost authenticator):
1. Login page → "Lost your 2FA device?" link
2. Enter email + password + one of the backup codes
3. 2FA disabled → user can re-enable with new device
4. If no backup codes: contact support → manual identity verification (48h process)

### Privacy Dashboard (`Settings → Privacy & Safety → Data & Privacy Dashboard`)

**Your Data**:
- Visual summary: "Here's what Gratonite knows about you"
- Categories: Profile Info, Messages, Files Uploaded, Servers, Connections, Activity History
- Each category shows: what's stored, why, how long it's retained

**Data Export** (GDPR Article 20 compliance):
- "Request My Data" button → background job compiles:
  - All messages (JSON, with channel/server context)
  - All uploaded files (original files)
  - Profile data (JSON)
  - Friend list, server memberships
  - Activity log (login history, settings changes)
- Processing time: up to 72 hours for large accounts
- Download link sent via email (expires in 7 days)
- Rate limit: 1 export request per 30 days
- `data_export_requests` table: `user_id`, `status` (pending/processing/ready/expired), `requested_at`, `completed_at`, `download_url`, `expires_at`

**Consent Management**:
- Toggle: "Allow activity status to be visible" (on/off)
- Toggle: "Allow read receipts" (future feature)
- Toggle: "Include me in server analytics" (opt-out of top contributor boards)
- Toggle: "Allow crash report collection" (diagnostic data)
- Toggle: "Allow message translation" (enables sending message content to translation API)
- All consent changes logged with timestamp

### Account Deletion

**Flow**:
1. Settings → My Account → Account Actions → Delete Account
2. Warning screen explaining what will happen:
   - All messages will be anonymized (author set to "Deleted User", content preserved for conversation continuity — or optionally purged)
   - All uploaded files deleted
   - Profile data permanently removed
   - Server ownerships transferred (must transfer before deleting) or servers deleted
   - Cannot be undone after grace period
3. Enter password + 2FA code (if enabled)
4. Choose: "Anonymize my messages" (default) or "Delete all my messages" (slower, affects conversation history)
5. 14-day grace period: account disabled but recoverable (login during this period → cancel deletion)
6. After 14 days: permanent deletion executed by scheduled job
7. Confirmation email sent at each stage

**`account_deletion_requests` table**: `user_id`, `requested_at`, `execute_at` (14 days later), `message_handling` (anonymize/delete), `status` (pending/cancelled/executed), `executed_at`

### Presence & Status Refinements

**Invisible Mode**: `presence_status` enum extended: `online`, `idle`, `dnd`, `invisible`, `offline`
- Invisible: appears offline to everyone, but can still use the app normally, send messages, join voice
- Messages sent while invisible still show the user as the author (but presence dot remains grey)
- Voice channels: cannot join while invisible (would reveal presence) — prompt to switch to online

**Idle Detection**:
- Desktop: detect no mouse/keyboard input for configurable duration (default: 5 minutes) → auto-set to `idle`
- Mobile: app backgrounded → set to `idle` after 1 minute, `offline` after 5 minutes
- Custom idle timeout in settings (1min, 2min, 5min, 10min, 30min, never)
- Return to `online` automatically on activity

**Custom DND Schedule**:
- `user_dnd_schedule` table: `user_id`, `enabled`, `start_time` (HH:MM), `end_time` (HH:MM), `timezone`, `days_of_week` (bitmask: Mon–Sun), `allow_exceptions` (JSONB: user IDs that bypass DND)

---

## 31. Platform-Specific UX Polish

### Mobile-Specific UX (iOS + Android)

**Haptic Feedback** (`@gratonite/haptics` — wraps `expo-haptics`):

| Action | Haptic Type | Platform |
|---|---|---|
| Send message | Light impact | Both |
| Long-press (context menu) | Medium impact | Both |
| Pull-to-refresh release | Light impact | Both |
| Reaction add | Light impact + success notification | Both |
| Swipe action threshold | Selection tick | Both |
| Voice connect | Success notification | Both |
| Error (failed send) | Error notification | Both |
| Scroll to boundary | Light impact | iOS only |

**Gesture Navigation**:
- **Swipe right on message** → Reply (preview appears, release to confirm)
- **Swipe left on message** → Quick actions panel (react, pin, delete)
- **Swipe right from edge** → Back navigation (channel → channel list → server list)
- **Long-press message** → Context menu with haptic feedback
- **Pinch-to-zoom** on images → inline zoom
- **Double-tap message** → Quick react with default emoji (configurable, default: ❤️)
- **Pull down** → Refresh with Crystalline spinner animation

**Bottom Sheet Pattern**:
- All mobile modals use bottom sheets (not centered modals) — natural thumb reach
- Drag handle at top, swipe down to dismiss
- Snap points: peek (25%), half (50%), full (90%)
- Used for: channel info, user profile, settings panels, emoji picker, create/join server

**iOS-Specific**:
- Live Activities for ongoing voice calls (Dynamic Island + Lock Screen)
- Home Screen widgets: unread count, active voice channels, quick compose
- ShareExtension: share content from other apps directly into a Gratonite channel
- Spotlight search integration: search messages/channels from iOS search

**Android-Specific**:
- Material You dynamic color theming (extract accent from wallpaper)
- Notification channels per server (Android O+)
- Picture-in-Picture for video calls
- Home screen widgets: unread count badge, quick access tiles
- Bubbles API for chat heads (floating DM conversations)

### Desktop-Specific UX (Electron)

**Window Management**:
- Remember window position + size on close → restore on next launch
- `electron-store` persists: `windowBounds` (x, y, width, height), `isMaximized`, `isFullscreen`
- Multi-monitor aware: if saved position is off-screen (monitor disconnected), reset to center of primary

**Minimize-to-Tray Behavior**:
- Setting: "Close button behavior" → "Minimize to tray" (default) / "Quit application"
- Tray icon shows unread badge count (red dot + number)
- Tray context menu: Show/Hide Window, Open DMs, Mute All, Quit
- Tray icon tooltip: "{N} unread messages"
- Double-click tray icon → show/hide main window

**Auto-Launch**:
- Setting: "Start Gratonite when you start your computer" (toggle, default: off)
- Setting: "Start minimized" (toggle — launch to tray, don't show window)
- Uses `electron-builder` auto-launch configuration (login items on macOS, registry on Windows)

**Global Shortcuts** (work even when app is not focused):
- Push-to-talk: configurable keybind (default: none, user must set)
- Toggle mute: configurable (e.g., `Ctrl+Shift+M`)
- Toggle deafen: configurable (e.g., `Ctrl+Shift+D`)
- Show/hide window: configurable (e.g., `Ctrl+Shift+G`)
- All registered via Electron's `globalShortcut` API
- Conflict detection: warn if chosen keybind conflicts with OS or other apps

**Rich Presence / Game Detection** (desktop only):
- Scan running processes for known games/apps (curated list + user additions)
- Process name → game name mapping stored in `packages/game-detection/games.json`
- When detected: set activity status to "Playing {gameName}" with elapsed time
- User can disable per-game or entirely in Settings → Activity Status
- Privacy: process scanning is local only — only the game name string is sent to server

**Notification Behavior**:
- Native OS notifications (`Notification` API via Electron)
- Click notification → focus app + navigate to relevant channel/DM
- Notification grouping: multiple messages from same channel → single grouped notification
- Notification sound: uses selected sound pack, respects system volume + DND

### Shared Platform Features

**Developer Mode** (`user_settings.developer_mode`: boolean):
- When enabled: all context menus gain "Copy ID" options (user ID, channel ID, server ID, message ID, role ID)
- Shows message timestamps as full ISO strings on hover
- Adds "Debug" section in settings with connection info, WebSocket state, cache stats
- Helpful for bot developers and power users

**Calm Mode** (`user_settings.calm_mode`: boolean):
- Hides typing indicators entirely
- Reduces notification urgency (batch notifications, delay non-DM by 30s)
- Softer notification sounds (or silent)
- Unread badges show dot only, not count
- Removes "X people are typing..." entirely
- Designed for users who feel overwhelmed by real-time communication anxiety
