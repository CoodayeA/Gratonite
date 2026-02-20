# Push Notifications + Deep Links (Phase 7)

This document outlines the cross-platform push and deep link strategy for Gratonite.

## Deep Link Scheme

Primary scheme: `gratonite://`

Routes:

- `gratonite://guild/{guildId}`
- `gratonite://guild/{guildId}/channel/{channelId}`
- `gratonite://guild/{guildId}/channel/{channelId}/message/{messageId}`
- `gratonite://dm/{channelId}`
- `gratonite://dm/{channelId}/message/{messageId}`
- `gratonite://invite/{code}`

Web fallback:

- `https://gratonite.chat/app/...` mirrors the same routes.

## Notification Payload

Common payload fields:

```
{
  "type": "message" | "mention" | "invite" | "call",
  "title": "...",
  "body": "...",
  "route": "gratonite://guild/...",
  "guildId": "...",
  "channelId": "...",
  "messageId": "..."
}
```

Desktop and mobile clients should route directly using the `route` field.

## Services

- Web: VAPID (Web Push)
- Android: FCM
- iOS: APNs

Server-side should fan out through a single `pushd` service with provider adapters.

## UX Guidelines

- Group notifications by guild/channel.
- Clicking a notification navigates to exact message.
- Respect “calm mode” (mute typing urgency, reduce badge noise).
