# Gratonite API — Database Schema Reference

This document describes every table in the Gratonite Postgres database, their
purpose, key columns, and the relationships between them.

---

## Table of Contents

1. [Table Summary](#table-summary)
2. [ER Diagram](#er-diagram)
3. [Table Definitions](#table-definitions)
   - [users](#users)
   - [refresh_tokens](#refresh_tokens)
   - [email_verification_tokens](#email_verification_tokens)
   - [guilds](#guilds)
   - [guild_members](#guild_members)
   - [channels](#channels)
   - [dm_channel_members](#dm_channel_members)
   - [messages](#messages)
   - [relationships](#relationships)
   - [files](#files)
4. [Design Decisions](#design-decisions)

---

## Table Summary

| Table                      | Purpose                                                                  | Key Columns                                     |
|----------------------------|--------------------------------------------------------------------------|-------------------------------------------------|
| `users`                    | Every Gratonite user account                                             | `id`, `username`, `email`, `password_hash`      |
| `refresh_tokens`           | Long-lived JWT refresh token hashes (one per active session)             | `user_id`, `token_hash`, `expires_at`           |
| `email_verification_tokens`| Short-lived one-time tokens for email address verification               | `user_id`, `token` (hash), `email`, `expires_at`|
| `guilds`                   | Community servers; top-level namespace for channels and members          | `id`, `name`, `owner_id`, `is_discoverable`     |
| `guild_members`            | Many-to-many join: which users belong to which guilds                    | `guild_id`, `user_id`, `nickname`, `joined_at`  |
| `channels`                 | All channels: guild text/voice/category, DMs, and group DMs              | `id`, `guild_id`, `type`, `parent_id`           |
| `dm_channel_members`       | Users participating in DM or GROUP_DM channels                          | `channel_id`, `user_id`                         |
| `messages`                 | Every message sent in any channel                                        | `id`, `channel_id`, `author_id`, `content`      |
| `relationships`            | Social graph: friendships, pending friend requests, and blocks           | `requester_id`, `addressee_id`, `type`          |
| `files`                    | Uploaded file registry (avatars, banners, attachments)                   | `id`, `storage_key`, `url`, `uploader_id`       |

---

## ER Diagram

```
users
 ├─< refresh_tokens          (one user → many active sessions)
 ├─< email_verification_tokens (one user → many pending verifications)
 ├─< guilds [owner_id]        (one user → many owned guilds)
 ├─< guild_members [user_id]  (one user → many guild memberships)
 ├─< dm_channel_members [user_id] (one user → many DM participations)
 ├─< messages [author_id]     (one user → many messages; SET NULL on delete)
 ├─< relationships [requester_id] (one user → many relationship edges as requester)
 ├─< relationships [addressee_id] (one user → many relationship edges as addressee)
 └─< files [uploader_id]      (one user → many uploaded files; SET NULL on delete)

guilds
 ├─ owner_id ──> users.id     (RESTRICT: guild must be transferred before owner deletion)
 ├─< guild_members [guild_id] (one guild → many members)
 └─< channels [guild_id]      (one guild → many channels)

channels
 ├─ guild_id ──> guilds.id    (nullable: DM channels have no guild)
 ├─ parent_id ──> channels.id (self-ref: channels nested under a GUILD_CATEGORY)
 ├─< dm_channel_members [channel_id] (one DM channel → many participants)
 └─< messages [channel_id]   (one channel → many messages)

messages
 ├─ channel_id ──> channels.id  (CASCADE: deleting a channel removes all its messages)
 └─ author_id  ──> users.id     (SET NULL: messages survive user deletion)

relationships
 ├─ requester_id ──> users.id   (CASCADE)
 └─ addressee_id ──> users.id   (CASCADE)

files
 └─ uploader_id ──> users.id    (SET NULL: files survive user deletion)

guild_members
 ├─ guild_id ──> guilds.id      (CASCADE)
 └─ user_id  ──> users.id       (CASCADE)

dm_channel_members
 ├─ channel_id ──> channels.id  (CASCADE)
 └─ user_id   ──> users.id      (CASCADE)
```

### Full ASCII ER diagram

```
+------------------+          +---------------------+
|      users       |          |   refresh_tokens    |
|------------------|          |---------------------|
| id (PK)          |<---------| user_id (FK)        |
| username         |          | token_hash (unique) |
| email            |          | expires_at          |
| password_hash    |          +---------------------+
| display_name     |
| avatar_hash      |          +-----------------------------+
| banner_hash      |          | email_verification_tokens   |
| bio              |<---------| user_id (FK)                |
| pronouns         |          | token (hash, unique)        |
| custom_status    |          | email                       |
| status           |          | expires_at                  |
| is_admin         |          +-----------------------------+
| email_verified   |
| created_at       |          +--------------------+
| updated_at       |<---------| files              |
+------------------+          |--------------------|
        |                     | id (PK)            |
        |  owns               | uploader_id (FK)   |
        |                     | filename           |
        v                     | mime_type          |
+------------------+          | size               |
|     guilds       |          | storage_key (uniq) |
|------------------|          | url                |
| id (PK)          |          | created_at         |
| name             |          +--------------------+
| description      |
| icon_hash        |     +------------------+
| banner_hash      |<----| guild_members    |
| owner_id (FK)    |     |------------------|
| is_discoverable  |     | id (PK)          |
| member_count     |     | guild_id (FK)    |
| created_at       |     | user_id (FK)     |
| updated_at       |     | nickname         |
+------------------+     | joined_at        |
        |                +------------------+
        | has
        |
        v
+----------------------+       +--------------------+
|      channels        |       |  dm_channel_members|
|----------------------|       |--------------------|
| id (PK)              |<------| channel_id (FK)    |
| guild_id (FK,null)   |       | user_id (FK)       |
| name                 |       +--------------------+
| type                 |
| topic                |       +--------------------+
| position             |       |     messages       |
| parent_id (FK,null)  |       |--------------------|
| is_nsfw              |<------| channel_id (FK)    |
| rate_limit_per_user  |       | author_id (FK,null)|
| created_at           |       | content            |
| updated_at           |       | attachments (jsonb)|
+----------------------+       | edited             |
                               | edited_at          |
                               | created_at         |
                               +--------------------+

+--------------------------------+
|         relationships          |
|--------------------------------|
| id (PK)                        |
| requester_id (FK → users)      |
| addressee_id (FK → users)      |
| type (FRIEND | PENDING_* | BLOCKED) |
| created_at                     |
| UNIQUE (requester_id, addressee_id) |
+--------------------------------+
```

---

## Table Definitions

### `users`

Central user account table. Every other resource in the system (guilds,
messages, files, etc.) ultimately points back to a row here.

| Column          | Type              | Notes                                          |
|-----------------|-------------------|------------------------------------------------|
| `id`            | uuid PK           | `gen_random_uuid()`                            |
| `username`      | varchar(32) uniq  | Login handle; globally unique, case-insensitive in app logic |
| `email`         | varchar(255) uniq | Stored lowercased; used for login + verification |
| `password_hash` | varchar(255)      | Argon2id encoded string (never plain text)     |
| `display_name`  | varchar(64)       | Shown in UI; changeable freely                 |
| `avatar_hash`   | varchar(255)      | File ID in `files` table; null = no avatar     |
| `banner_hash`   | varchar(255)      | File ID in `files` table; null = no banner     |
| `bio`           | text              | Freeform profile description                   |
| `pronouns`      | varchar(50)       | e.g. "she/her"                                 |
| `custom_status` | varchar(128)      | User-set status message                        |
| `status`        | varchar(20)       | Presence: online/idle/dnd/invisible            |
| `is_admin`      | boolean           | Platform-level admin (not guild admin)         |
| `email_verified`| boolean           | Must be true to log in                         |
| `created_at`    | timestamptz       |                                                |
| `updated_at`    | timestamptz       |                                                |

---

### `refresh_tokens`

Hashes of issued JWT refresh tokens. One row per active login session. See
`src/db/schema/auth.ts` for the full token flow.

| Column       | Type          | Notes                                                |
|--------------|---------------|------------------------------------------------------|
| `id`         | uuid PK       |                                                      |
| `user_id`    | uuid FK       | → `users.id` CASCADE                                 |
| `token_hash` | varchar(255)  | SHA-256(rawJwt), hex-encoded; unique                 |
| `expires_at` | timestamptz   | 30 days from issuance                                |
| `created_at` | timestamptz   |                                                      |

---

### `email_verification_tokens`

Short-lived tokens for verifying a new user's email address (or a changed
email in a future flow). Deleted after successful verification.

| Column      | Type          | Notes                                                 |
|-------------|---------------|-------------------------------------------------------|
| `id`        | uuid PK       |                                                       |
| `user_id`   | uuid FK       | → `users.id` CASCADE                                  |
| `token`     | varchar(255)  | SHA-256(rawToken), hex-encoded; unique                |
| `email`     | varchar(255)  | The address being verified                            |
| `expires_at`| timestamptz   | 24 hours from creation                                |
| `created_at`| timestamptz   |                                                       |

---

### `guilds`

A guild (community server). The root container for channels and members.

| Column            | Type          | Notes                                          |
|-------------------|---------------|------------------------------------------------|
| `id`              | uuid PK       |                                                |
| `name`            | varchar(100)  | Display name                                   |
| `description`     | text          | Nullable; shown in discovery listing           |
| `icon_hash`       | varchar(255)  | Nullable; file ID in `files`                   |
| `banner_hash`     | varchar(255)  | Nullable; file ID in `files`                   |
| `owner_id`        | uuid FK       | → `users.id` RESTRICT (cannot delete owner while they own guilds) |
| `is_discoverable` | boolean       | Default false; opt-in public listing           |
| `member_count`    | integer       | Denormalized; updated by app on join/leave     |
| `created_at`      | timestamptz   |                                                |
| `updated_at`      | timestamptz   |                                                |

---

### `guild_members`

Many-to-many join table for users in guilds.

| Column      | Type          | Notes                                                   |
|-------------|---------------|---------------------------------------------------------|
| `id`        | uuid PK       |                                                         |
| `guild_id`  | uuid FK       | → `guilds.id` CASCADE                                   |
| `user_id`   | uuid FK       | → `users.id` CASCADE                                    |
| `nickname`  | varchar(64)   | Nullable; per-guild display name override               |
| `joined_at` | timestamptz   |                                                         |
| —           | unique        | `(guild_id, user_id)`                                   |

---

### `channels`

Unified table for all channel types: guild text, voice, category, DM, group DM.

| Column               | Type         | Notes                                                   |
|----------------------|--------------|---------------------------------------------------------|
| `id`                 | uuid PK      |                                                         |
| `guild_id`           | uuid FK      | Nullable → `guilds.id` CASCADE; null for DM channels    |
| `name`               | varchar(100) |                                                         |
| `type`               | varchar(30)  | GUILD_TEXT / GUILD_VOICE / GUILD_CATEGORY / DM / GROUP_DM |
| `topic`              | text         | Nullable channel description / topic                    |
| `position`           | integer      | Sort order within guild/category; default 0             |
| `parent_id`          | uuid FK      | Nullable self-ref → `channels.id` SET NULL; category nesting |
| `is_nsfw`            | boolean      | Default false                                           |
| `rate_limit_per_user`| integer      | Slowmode in seconds; 0 = disabled                       |
| `created_at`         | timestamptz  |                                                         |
| `updated_at`         | timestamptz  |                                                         |

---

### `dm_channel_members`

Participants in DM and GROUP_DM channels. Not used for guild channels.

| Column       | Type     | Notes                                                    |
|--------------|----------|----------------------------------------------------------|
| `id`         | uuid PK  |                                                          |
| `channel_id` | uuid FK  | → `channels.id` CASCADE                                  |
| `user_id`    | uuid FK  | → `users.id` CASCADE                                     |
| —            | unique   | `(channel_id, user_id)`                                  |

---

### `messages`

Every message sent in any channel. Shared by guild channels and DMs.

| Column        | Type          | Notes                                                     |
|---------------|---------------|-----------------------------------------------------------|
| `id`          | uuid PK       |                                                           |
| `channel_id`  | uuid FK       | → `channels.id` CASCADE                                   |
| `author_id`   | uuid FK       | Nullable → `users.id` SET NULL (null = Deleted User)      |
| `content`     | text          | Nullable (attachment-only messages have no text)          |
| `attachments` | jsonb         | Default `[]`; array of `{id, url, filename, size, mimeType}` |
| `edited`      | boolean       | Default false; true once any edit has been made           |
| `edited_at`   | timestamptz   | Nullable; timestamp of most recent edit                   |
| `created_at`  | timestamptz   | Used as cursor for pagination                             |
| —             | index         | `(channel_id, created_at)` for per-channel cursor queries |

---

### `relationships`

Directed social graph edges covering friends, pending requests, and blocks.

| Column         | Type         | Notes                                                 |
|----------------|--------------|-------------------------------------------------------|
| `id`           | uuid PK      |                                                       |
| `requester_id` | uuid FK      | → `users.id` CASCADE                                  |
| `addressee_id` | uuid FK      | → `users.id` CASCADE                                  |
| `type`         | varchar(20)  | FRIEND / PENDING_OUTGOING / PENDING_INCOMING / BLOCKED |
| `created_at`   | timestamptz  |                                                       |
| —              | unique       | `(requester_id, addressee_id)`                        |

---

### `files`

Registry of every file uploaded to the platform.

| Column        | Type          | Notes                                                  |
|---------------|---------------|--------------------------------------------------------|
| `id`          | uuid PK       | Used as the "hash" in users.avatar_hash, guilds.icon_hash, etc. |
| `uploader_id` | uuid FK       | Nullable → `users.id` SET NULL                         |
| `filename`    | varchar(255)  | Original client-provided filename                      |
| `mime_type`   | varchar(100)  | Server-determined via magic bytes                      |
| `size`        | integer       | File size in bytes                                     |
| `storage_key` | varchar(500)  | Unique disk/S3 path; used to serve or delete the file  |
| `url`         | varchar(500)  | Public CDN/static URL returned to clients              |
| `created_at`  | timestamptz   |                                                        |

---

## Design Decisions

### Why `author_id` on `messages` uses SET NULL instead of CASCADE

When a user deletes their account, we want to preserve the messages they sent
so that conversations remain intact for everyone else who participated. If we
used CASCADE, deleting a user would silently wipe out potentially years of
shared chat history for other users — an unacceptable loss of data.

Instead, `author_id` is set to null on user deletion. The API detects
`author_id = null` and renders those messages as coming from "Deleted User". The
content, timestamps, and conversation flow are all preserved.

The same logic applies to `files.uploader_id` (SET NULL): guild icons and
message attachments uploaded by a now-deleted user must remain accessible.

### Why the `relationships` table covers friends, pending requests, AND blocks

These three concepts share the same fundamental data shape: a directed edge
between two users with a label. Keeping them in one table provides several
advantages:

1. **Single "does a relationship exist?" query.** Authorization middleware can
   check with a single `SELECT` whether user A is blocked by user B, is friends
   with B, or has a pending request — no need to query three tables and combine
   results.

2. **Simple state transitions.** Accepting a friend request is an `UPDATE type
   = 'FRIEND'` on two rows rather than a DELETE + INSERT across tables.

3. **Enforced exclusivity.** The unique constraint on `(requester_id,
   addressee_id)` ensures you cannot simultaneously be in two relationship
   states with the same person from the same perspective — e.g. you cannot be
   both FRIEND and BLOCKED toward someone at the same time. This constraint
   would be harder to enforce across separate tables.

**How pending requests work with two rows:**
When A sends a friend request to B, two rows are created atomically:
- `(requester=A, addressee=B, type=PENDING_OUTGOING)` — A sees this in their
  "sent requests" list.
- `(requester=B, addressee=A, type=PENDING_INCOMING)` — B sees this in their
  "received requests" list.

Both users query only rows where they are the `requester`, which lets each user
filter their own social graph perspective with a simple `WHERE requester_id =
$userId`. When B accepts, both rows are updated to `FRIEND`. When B declines,
both rows are deleted.

### Why `guilds.member_count` is denormalized

A live `COUNT(*) FROM guild_members WHERE guild_id = $id` on every guild card
render would be expensive at scale (guild list pages show many cards at once).
Storing a denormalized counter that the application updates on join/leave keeps
guild-list queries fast with no extra JOIN.

The trade-off is that the counter can drift if application code crashes between
the member row insert/delete and the counter update. A periodic reconciliation
job (or a Postgres trigger) can correct drift if it becomes a problem.

### Why channel types live in a single `channels` table

All channel types (guild text, voice, category, DM, group DM) share the same
core shape and are referenced by `messages.channel_id` regardless of type.
Using one table keeps the message foreign key simple and avoids polymorphic
join complexity. Columns that don't apply to a given type (e.g. `topic` on a
voice channel, `guild_id` on a DM) are simply null.

### Why `channels.parent_id` uses SET NULL instead of CASCADE

Deleting a GUILD_CATEGORY channel should not delete all the text and voice
channels nested inside it — it should only un-nest them (set their `parent_id`
to null, making them top-level channels). If we used CASCADE, a misclick on a
category delete would destroy potentially dozens of channels and all their
messages.

### Why tokens are stored as hashes (SHA-256), not raw values

Storing raw refresh tokens or verification tokens in the database means that
anyone who reads the database (e.g. via a SQL injection vulnerability or a
leaked backup) can immediately replay those tokens to impersonate users. By
storing only the SHA-256 hash, a database compromise yields only hashes — which
cannot be reversed to the original token without breaking SHA-256. The raw
token is transmitted to the client exactly once and never persisted server-side.
