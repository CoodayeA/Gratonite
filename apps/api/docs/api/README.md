# Gratonite API — v1 Documentation Index

Base URL: `/api/v1`

All authenticated endpoints require a `Bearer <accessToken>` header.
Access tokens are obtained via `POST /api/v1/auth/login` and refreshed via
`POST /api/v1/auth/refresh`.

---

## Domains

| Domain | File | Description |
|--------|------|-------------|
| Auth | (see source) | Register, login, refresh, logout, email verification |
| Users | [users.md](./users.md) | Profile, presence, search |
| Guilds + Channels | [guilds.md](./guilds.md) | Guild CRUD, channels, members |
| Messages | [messages.md](./messages.md) | Message history, editing, typing |
| Relationships | [relationships.md](./relationships.md) | Friends, DMs, blocks |
| Files | [files.md](./files.md) | Upload and serve files |

---

## Common Response Shapes

### Error

```json
{ "error": "Human-readable error message" }
```

### Validation Error (400)

```json
{
  "error": "Validation failed",
  "details": [ { "code": "...", "message": "...", "path": ["field"] } ]
}
```

---

## Socket.io Events

Connect with a JWT in either the `Authorization: Bearer <token>` handshake header
or the Socket.IO auth payload (`auth: { token: "<token>" }`). Query-string token
authentication is not supported.

| Event | Direction | Payload |
|-------|-----------|---------|
| `message:new` | Server → Client | Full message object with author info |
| `message:update` | Server → Client | Updated message object |
| `message:delete` | Server → Client | `{ id, channelId }` |
| `typing:start` | Server → Client | `{ userId, channelId }` |
| `presence:update` | Server → Client | `{ userId, status }` |
