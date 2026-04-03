# Outbound webhook events (bot applications)

Installed **bot applications** with a configured `webhookUrl` receive **HTTP POST** payloads when guild events occur. Payloads are JSON with a top-level `type` and `guildId`. The raw body is signed with HMAC-SHA256; the hex digest is sent in the `**X-Gratonite-Signature`** header (see `apps/api/src/lib/webhook-signing.ts`). The bot id is sent as `**X-Gratonite-Bot-Id**`.

Bots may optionally restrict which events they receive via `subscribedEvents` on the bot application (`null` / empty means all events). Dispatch is implemented in `apps/api/src/lib/webhook-dispatch.ts`.

## Event types emitted today

The following `type` values are passed to `dispatchEvent()` or `dispatchInteraction()` in the API:

### `message_create`

Fired when a new guild-channel message is created (`dispatchMessageCreate`).

JSON body shape (after `JSON.stringify` of `{ type, guildId, ...eventPayload }`):


| Field       | Type                                   |
| ----------- | -------------------------------------- |
| `type`      | `"message_create"`                     |
| `guildId`   | string                                 |
| `channelId` | string                                 |
| `messageId` | string                                 |
| `content`   | string                                 |
| `author`    | `{ id, username, displayName | null }` |
| `timestamp` | ISO string                             |


### `message_update`

From `message.service` on edit.


| Field       | Type               |
| ----------- | ------------------ |
| `type`      | `"message_update"` |
| `guildId`   | string             |
| `channelId` | string             |
| `messageId` | string             |
| `content`   | string             |
| `authorId`  | string             |


### `message_delete`


| Field       | Type               |
| ----------- | ------------------ |
| `type`      | `"message_delete"` |
| `guildId`   | string             |
| `channelId` | string             |
| `messageId` | string             |


### `member_join`


| Field     | Type                                                               |
| --------- | ------------------------------------------------------------------ |
| `type`    | `"member_join"`                                                    |
| `guildId` | string                                                             |
| `userId`  | string                                                             |
| `user`    | `{ id, username, displayName }` when profile loaded, else `{ id }` |


### `member_leave`


| Field     | Type             |
| --------- | ---------------- |
| `type`    | `"member_leave"` |
| `guildId` | string           |
| `userId`  | string           |


### `reaction_add` / `reaction_remove`


| Field       | Type                                    |
| ----------- | --------------------------------------- |
| `type`      | `"reaction_add"` or `"reaction_remove"` |
| `guildId`   | string                                  |
| `channelId` | string                                  |
| `messageId` | string                                  |
| `userId`    | string                                  |
| `emoji`     | string                                  |


### `interaction` (slash commands)

`dispatchInteraction` sends `{ type: "interaction", ... }` to a **single** bot. Slash-command payload fields include:

- `commandId`, `commandName`, `channelId`, `guildId`, `userId`, `options`

(Component interactions add `customId`, `messageId`, `values`, and `interactionType: "component"`.)

The bot may respond with JSON `{ "actions": [ ... ] }` to trigger `send_message`, `add_role`, `remove_role`, or `kick_member` (see `processActions` in `webhook-dispatch.ts`).

---

## Inbound channel webhooks (different feature)

**Channel webhooks** (`POST /api/v1/channels/:channelId/webhooks`) are for posting messages into a channel via `POST /api/v1/webhooks/:webhookId/:token`. They do **not** use the outbound event types above; they are authenticated by id + token and rate-limited per webhook.