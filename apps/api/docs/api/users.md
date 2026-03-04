# Users API

Base path: `/api/v1/users`

All endpoints require authentication (`Authorization: Bearer <token>`).

---

## GET /@me

Return the authenticated user's full profile (no password_hash).

**Auth:** Required

**Response 200**

```json
{
  "id": "uuid",
  "username": "alice_99",
  "email": "alice@example.com",
  "displayName": "Alice",
  "avatarHash": "uuid-or-null",
  "bannerHash": "uuid-or-null",
  "bio": "Hello world",
  "pronouns": "she/her",
  "customStatus": "Coding something cool",
  "status": "online",
  "isAdmin": false,
  "emailVerified": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Errors**

| Code | Description |
|------|-------------|
| 401 | Missing or invalid token |
| 404 | User not found |

**Example**

```bash
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/v1/users/@me
```

---

## PATCH /@me

Update profile fields. All body fields are optional.

**Auth:** Required

**Request Body**

```json
{
  "displayName": "Alice (optional)",
  "bio": "Updated bio (optional, nullable)",
  "pronouns": "they/them (optional, nullable)",
  "customStatus": "Sleeping (optional, nullable)"
}
```

**Response 200** — Updated user profile (same shape as GET /@me)

**Errors**

| Code | Description |
|------|-------------|
| 400 | Validation failure |
| 401 | Not authenticated |
| 404 | User not found |

**Example**

```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Alice Smith","bio":"New bio"}' \
  http://localhost:4000/api/v1/users/@me
```

---

## PATCH /@me/account

Update account fields (username and/or displayName). Username changes are
checked for availability case-insensitively.

**Auth:** Required

**Request Body**

```json
{
  "username": "new_handle (optional, 3-32 chars, letters/digits/underscores)",
  "displayName": "New Name (optional, 1-64 chars)"
}
```

**Response 200** — Updated user profile

**Errors**

| Code | Description |
|------|-------------|
| 400 | Validation failure |
| 401 | Not authenticated |
| 409 | Username already taken |

**Example**

```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice_new"}' \
  http://localhost:4000/api/v1/users/@me/account
```

---

## PATCH /@me/presence

Update online presence status.

**Auth:** Required

**Request Body**

```json
{ "status": "online" }
```

Valid values: `online` | `idle` | `dnd` | `invisible`

**Response 200**

```json
{ "status": "idle" }
```

**Errors**

| Code | Description |
|------|-------------|
| 400 | Invalid status value |
| 401 | Not authenticated |

**Example**

```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"dnd"}' \
  http://localhost:4000/api/v1/users/@me/presence
```

---

## GET /search

Search users by username or displayName.

**Auth:** Required

**Query Parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Search query (min 2 chars) |

**Response 200**

```json
[
  {
    "id": "uuid",
    "username": "alice_99",
    "displayName": "Alice",
    "avatarHash": "uuid-or-null"
  }
]
```

Maximum 20 results.

**Errors**

| Code | Description |
|------|-------------|
| 400 | Query too short (< 2 chars) |
| 401 | Not authenticated |

**Example**

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/users/search?q=alice"
```

---

## GET /:userId/profile

Fetch the public profile of another user.

**Auth:** Required

**Path Parameters**

| Param | Description |
|-------|-------------|
| `userId` | UUID of the user |

**Response 200**

```json
{
  "id": "uuid",
  "username": "alice_99",
  "displayName": "Alice",
  "avatarHash": "uuid-or-null",
  "bannerHash": "uuid-or-null",
  "bio": "Hello",
  "pronouns": "she/her",
  "status": "online",
  "customStatus": "Coding",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Errors**

| Code | Description |
|------|-------------|
| 401 | Not authenticated |
| 404 | User not found |

**Example**

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/users/550e8400-e29b-41d4-a716-446655440000/profile
```
