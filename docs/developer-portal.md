# Gratonite Developer Portal (Phase 6)

This document defines the current developer-facing surface for bots, OAuth2 apps, and slash commands.

## OAuth2 Apps

Create an OAuth app to obtain a client ID and client secret for authorization code flow and bot management.

Endpoints (auth required unless noted):

- `POST /api/v1/oauth/apps`
- `GET /api/v1/oauth/apps`
- `GET /api/v1/oauth/apps/:appId`
- `PATCH /api/v1/oauth/apps/:appId`
- `DELETE /api/v1/oauth/apps/:appId`
- `POST /api/v1/oauth/apps/:appId/reset-secret`

Authorization code flow:

- `POST /api/v1/oauth/authorize` (auth required)
- `POST /api/v1/oauth/token` (public)

Token response shape:

```
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600,
  "scope": "identify bot",
  "tokenType": "bearer"
}
```

## Bot Lifecycle

- `POST /api/v1/oauth/apps/:appId/bot` creates the bot user and returns a bot token.
- `POST /api/v1/oauth/apps/:appId/bot/reset-token` rotates the bot token.
- `POST /api/v1/oauth/apps/:appId/bot/authorize` adds the bot to a guild.

Bot authentication header:

```
Authorization: Bot <token>
```

## Slash Commands

- `GET /api/v1/oauth/apps/:appId/commands`
- `POST /api/v1/oauth/apps/:appId/commands`
- `PATCH /api/v1/oauth/apps/:appId/commands/:commandId`
- `DELETE /api/v1/oauth/apps/:appId/commands/:commandId`

## Gateway Intents

Bots and clients can send an `intents` bitfield in the `IDENTIFY` event.

Bitfield constants:

- `GUILDS` = 1 << 0
- `GUILD_MEMBERS` = 1 << 1
- `GUILD_MESSAGES` = 1 << 2
- `GUILD_MESSAGE_TYPING` = 1 << 3
- `GUILD_PRESENCES` = 1 << 4
- `GUILD_VOICE_STATES` = 1 << 5
- `DIRECT_MESSAGES` = 1 << 6
- `DIRECT_MESSAGE_TYPING` = 1 << 7

Events are filtered according to these intents.
