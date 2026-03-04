# Guilds and Channels API

## Guilds

Base path: `/api/v1/guilds`

All endpoints require authentication.

---

### GET /@me

List all guilds the current user is a member of.

**Auth:** Required

**Response 200**

```json
[
  {
    "id": "uuid",
    "name": "My Server",
    "iconHash": "uuid-or-null",
    "memberCount": 42
  }
]
```

**Example**

```bash
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/v1/guilds/@me
```

---

### POST /

Create a new guild. The creator becomes the owner and first member. Two default
channels are created: `#general` (GUILD_TEXT) and `Voice` (GUILD_VOICE).

**Auth:** Required

**Request Body**

```json
{
  "name": "My Server",
  "description": "Optional description"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | Yes | 2–100 chars |
| description | string | No | max 500 chars |

**Response 201**

```json
{
  "guild": { "id": "uuid", "name": "My Server", ... },
  "channels": [
    { "id": "uuid", "name": "general", "type": "GUILD_TEXT", ... },
    { "id": "uuid", "name": "Voice", "type": "GUILD_VOICE", ... }
  ]
}
```

**Errors**

| Code | Description |
|------|-------------|
| 400 | Validation failure |
| 401 | Not authenticated |

**Example**

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Server","description":"A cool place"}' \
  http://localhost:4000/api/v1/guilds
```

---

### GET /discover

Return publicly discoverable guilds ordered by member count descending.
Optionally filter by name.

**Auth:** Required

**Query Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | No | Filter by guild name (ILIKE) |

**Response 200**

```json
[
  {
    "id": "uuid",
    "name": "Popular Server",
    "description": "...",
    "iconHash": null,
    "bannerHash": null,
    "memberCount": 1500
  }
]
```

Maximum 20 results.

**Example**

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/guilds/discover?q=gaming"
```

---

### GET /:guildId

Return guild info. User must be a member.

**Auth:** Required + member

**Response 200** — Full guild row

**Errors**

| Code | Description |
|------|-------------|
| 403 | Not a member |
| 404 | Guild not found |

---

### PATCH /:guildId

Update guild settings. Only the guild owner may call this.

**Auth:** Required + owner

**Request Body** (all optional)

```json
{
  "name": "New Name",
  "description": "Updated description",
  "isDiscoverable": true
}
```

**Response 200** — Updated guild row

**Errors**

| Code | Description |
|------|-------------|
| 400 | Validation failure |
| 403 | Not the owner |
| 404 | Guild not found |

---

### DELETE /:guildId

Permanently delete the guild. Only the owner may do this. Cascade deletes all
channels, messages, and member records.

**Auth:** Required + owner

**Response 200**

```json
{ "message": "Guild deleted" }
```

---

### GET /:guildId/members

List guild members. User must be a member.

**Auth:** Required + member

**Query Parameters**

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `limit` | 50 | 100 | Number of members to return |

**Response 200**

```json
[
  {
    "id": "membership-uuid",
    "userId": "user-uuid",
    "username": "alice_99",
    "displayName": "Alice",
    "avatarHash": null,
    "nickname": null,
    "joinedAt": "2024-01-01T00:00:00Z"
  }
]
```

---

### DELETE /:guildId/members/:userId

Kick a member from the guild. Only the owner may kick. Cannot kick yourself.

**Auth:** Required + owner

**Response 200**

```json
{ "message": "Member removed" }
```

**Errors**

| Code | Description |
|------|-------------|
| 400 | Cannot kick yourself |
| 403 | Not the owner |
| 404 | Guild not found or user not a member |

---

## Channels

Base paths:
- `/api/v1/guilds/:guildId/channels` — list and create
- `/api/v1/channels/:channelId` — get, update, delete

---

### GET /guilds/:guildId/channels

Return all channels in a guild ordered by position ascending.

**Auth:** Required + member

**Response 200** — Array of channel rows

**Example**

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/guilds/<guildId>/channels
```

---

### POST /guilds/:guildId/channels

Create a new channel in a guild. Only the owner may create channels.

**Auth:** Required + owner

**Request Body**

```json
{
  "name": "announcements",
  "type": "GUILD_TEXT",
  "parentId": "optional-category-uuid"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | Yes | Lowercase, hyphens, digits; max 100 chars |
| type | string | Yes | `GUILD_TEXT` \| `GUILD_VOICE` \| `GUILD_CATEGORY` |
| parentId | uuid | No | Must be a GUILD_CATEGORY channel |

**Response 201** — Created channel row

---

### GET /channels/:channelId

Get channel details. User must be a guild member or DM participant.

**Auth:** Required + access

**Response 200** — Channel row

**Errors**

| Code | Description |
|------|-------------|
| 403 | No access |
| 404 | Channel not found |

---

### PATCH /channels/:channelId

Update channel settings. Only the guild owner may update guild channels.

**Auth:** Required + guild owner

**Request Body** (all optional)

```json
{
  "name": "new-name",
  "topic": "Channel topic",
  "isNsfw": false,
  "rateLimitPerUser": 5,
  "position": 2
}
```

**Response 200** — Updated channel row

---

### DELETE /channels/:channelId

Delete a channel. Cannot delete the last text channel in a guild.

**Auth:** Required + guild owner

**Response 200**

```json
{ "message": "Channel deleted" }
```

**Errors**

| Code | Description |
|------|-------------|
| 400 | Last text channel or DM channel |
| 403 | Not the guild owner |
| 404 | Channel not found |
