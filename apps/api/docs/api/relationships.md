# Relationships API

Base path: `/api/v1/relationships`

Covers friend requests, friend management, blocks, and DM channels.

All endpoints require authentication.

---

## Relationship Types

| Type | Description |
|------|-------------|
| `FRIEND` | Mutual friendship — both users have accepted |
| `PENDING_OUTGOING` | Current user sent a request to the other user |
| `PENDING_INCOMING` | The other user sent a request to the current user |
| `BLOCKED` | Current user has blocked the other user |

---

## GET /

Return all relationships for the current user (both sent and received).

**Auth:** Required

**Response 200**

```json
[
  {
    "id": "uuid",
    "type": "FRIEND",
    "createdAt": "2024-01-01T00:00:00Z",
    "user": {
      "id": "uuid",
      "username": "bob_42",
      "displayName": "Bob",
      "avatarHash": null,
      "status": "online"
    }
  }
]
```

**Example**

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/relationships
```

---

## GET /channels

Return all DM channels the current user participates in, ordered by most recent
message first. Includes other participant info and a last message preview.

**Auth:** Required

**Response 200**

```json
[
  {
    "id": "channel-uuid",
    "name": "dm-...",
    "type": "DM",
    "createdAt": "2024-01-01T00:00:00Z",
    "otherUser": {
      "id": "uuid",
      "username": "bob_42",
      "displayName": "Bob",
      "avatarHash": null,
      "status": "idle"
    },
    "lastMessage": {
      "content": "Hey!",
      "createdAt": "2024-01-02T10:00:00Z"
    }
  }
]
```

`lastMessage` is `null` if no messages have been sent yet.

---

## POST /channels

Open a DM channel with a friend. If a DM channel already exists between the
two users, the existing channel is returned (200) instead of creating a new one.

**Auth:** Required

**Request Body**

```json
{ "userId": "friend-user-uuid" }
```

**Response 201** — Newly created DM channel
**Response 200** — Existing DM channel (returned when already exists)

**Errors**

| Code | Description |
|------|-------------|
| 400 | Not friends with this user |
| 404 | Target user not found |

**Example**

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<friend-uuid>"}' \
  http://localhost:4000/api/v1/relationships/channels
```

---

## POST /friends

Send a friend request to another user.

**Auth:** Required

**Request Body**

```json
{ "userId": "target-user-uuid" }
```

**Response 201**

```json
{ "message": "Friend request sent" }
```

**Errors**

| Code | Description |
|------|-------------|
| 400 | Cannot add yourself / already friends / request already exists / user is blocked |
| 404 | Target user not found |

**Side Effects**

Creates two `relationships` rows atomically:
- `(requester=you, addressee=target, type=PENDING_OUTGOING)`
- `(requester=target, addressee=you, type=PENDING_INCOMING)`

**Example**

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<user-uuid>"}' \
  http://localhost:4000/api/v1/relationships/friends
```

---

## PUT /friends/:userId

Accept a pending incoming friend request from the specified user.

**Auth:** Required

**Response 200**

```json
{ "message": "Friend request accepted" }
```

**Errors**

| Code | Description |
|------|-------------|
| 404 | No pending request from this user |

**Side Effects**

Updates both `PENDING_OUTGOING` and `PENDING_INCOMING` rows to `FRIEND`.

**Example**

```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/relationships/friends/<userId>
```

---

## DELETE /friends/:userId

Remove a friend or cancel an outgoing friend request. Deletes all relationship
rows between the two users in either direction.

**Auth:** Required

**Response 200**

```json
{ "message": "Relationship removed" }
```

**Example**

```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/relationships/friends/<userId>
```

---

## PUT /blocks/:userId

Block a user. Removes any existing friend/pending relationship rows and inserts
a `BLOCKED` row from the current user toward the target.

**Auth:** Required

**Response 200**

```json
{ "message": "User blocked" }
```

**Errors**

| Code | Description |
|------|-------------|
| 400 | Cannot block yourself |
| 404 | Target user not found |

**Side Effects**

Deletes any existing relationship rows between the two users, then inserts a
`BLOCKED` row.

**Example**

```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/relationships/blocks/<userId>
```

---

## DELETE /blocks/:userId

Unblock a user. Removes the `BLOCKED` row from the current user toward the
target. Does nothing if the block doesn't exist.

**Auth:** Required

**Response 200**

```json
{ "message": "User unblocked" }
```

**Example**

```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/relationships/blocks/<userId>
```
