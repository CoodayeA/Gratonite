# Messages API

Base path: `/api/v1/channels/:channelId/messages`

All endpoints require authentication. Access is gated by guild membership (guild
channels) or DM participation (DM channels).

---

## GET /

Fetch messages in a channel with cursor-based pagination. Returns newest first.

**Auth:** Required + channel access

**Query Parameters**

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `before` | uuid | — | — | Fetch messages older than this message ID |
| `limit` | number | 50 | 100 | Number of messages to return |

**Response 200**

```json
[
  {
    "id": "uuid",
    "channelId": "uuid",
    "content": "Hello world",
    "attachments": [],
    "edited": false,
    "editedAt": null,
    "createdAt": "2024-01-01T00:00:00Z",
    "author": {
      "id": "uuid",
      "username": "alice_99",
      "displayName": "Alice",
      "avatarHash": null
    }
  }
]
```

`author` is `null` if the original author's account has been deleted.

**Example**

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/channels/<channelId>/messages?limit=50"

# With cursor:
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/channels/<channelId>/messages?before=<messageId>&limit=50"
```

---

## POST /

Send a new message. At least one of `content` or `attachmentIds` must be present.

**Auth:** Required + channel access

**Request Body**

```json
{
  "content": "Hello world",
  "attachmentIds": ["file-uuid-1", "file-uuid-2"]
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| content | string | Conditional | 1–2000 chars. Required if no attachmentIds |
| attachmentIds | uuid[] | Conditional | File IDs uploaded by the current user |

**Response 201** — Created message with embedded author info (same shape as GET /)

**Errors**

| Code | Description |
|------|-------------|
| 400 | Validation failure, invalid attachment IDs, or attachments belong to another user |
| 403 | No channel access |
| 404 | Channel not found |

**Side Effects**

Emits `message:new` Socket.io event to the `channel:<channelId>` room.

**Example**

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello everyone!"}' \
  http://localhost:4000/api/v1/channels/<channelId>/messages
```

---

## PATCH /:messageId

Edit a message. Only the original author may edit their messages.

**Auth:** Required + message author

**Request Body**

```json
{ "content": "Updated message content" }
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| content | string | Yes | 1–2000 chars |

**Response 200** — Updated message with embedded author info

**Errors**

| Code | Description |
|------|-------------|
| 400 | Validation failure |
| 403 | Not the message author or no channel access |
| 404 | Channel or message not found |

**Side Effects**

Sets `edited = true` and `editedAt = now()`. Emits `message:update` Socket.io
event to the `channel:<channelId>` room.

**Example**

```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Edited message"}' \
  http://localhost:4000/api/v1/channels/<channelId>/messages/<messageId>
```

---

## DELETE /:messageId

Delete a message. The caller must be the message's author or the guild owner.

**Auth:** Required + (author or guild owner)

**Response 200**

```json
{ "message": "Message deleted" }
```

**Errors**

| Code | Description |
|------|-------------|
| 403 | Not the author or guild owner |
| 404 | Channel or message not found |

**Side Effects**

Emits `message:delete` Socket.io event to the `channel:<channelId>` room with
payload `{ id: messageId, channelId }`.

**Example**

```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/channels/<channelId>/messages/<messageId>
```

---

## POST /typing

Broadcast a typing indicator to the channel. No data is persisted. Clients
should call this endpoint periodically (e.g. every 5 seconds) while the user
is composing a message.

**Auth:** Required + channel access

**Request Body** — Empty body or `{}`

**Response 200**

```json
{ "ok": true }
```

**Side Effects**

Emits `typing:start` Socket.io event to the `channel:<channelId>` room with
payload `{ userId, channelId }`.

**Example**

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/channels/<channelId>/messages/typing
```
