# Plugin Sandbox (Phase 6)

This document defines the client-side plugin sandbox contract. The initial implementation is expected to be an iframe sandbox hosted by the web client.

## Security Model

- Plugins run inside an iframe with a restrictive sandbox attribute.
- Communication occurs through `postMessage` with a strict allowlist of origins.
- Plugins are granted permissions explicitly by the user per guild.

## Recommended iframe settings

- `sandbox="allow-scripts allow-forms"`
- No `allow-same-origin` unless strictly required.
- `referrerpolicy="no-referrer"`

## Message Protocol

All messages should include:

```
{
  "type": "PLUGIN_INIT" | "PLUGIN_EVENT" | "PLUGIN_CALL" | "PLUGIN_RESPONSE" | "PLUGIN_ERROR",
  "requestId": "uuid",
  "payload": {}
}
```

## Minimal Events

- `PLUGIN_INIT`: host -> plugin (context: userId, guildId, channelId, locale)
- `PLUGIN_EVENT`: host -> plugin (gateway events filtered by permissions)
- `PLUGIN_CALL`: plugin -> host (request privileged actions)
- `PLUGIN_RESPONSE`: host -> plugin (response to call)
- `PLUGIN_ERROR`: host -> plugin (errors)

## Permissions

Suggested permission list (per plugin + guild):

- `read_messages`
- `send_messages`
- `manage_channel`
- `manage_roles`
- `read_members`
- `manage_webhooks`

Permissions should be stored server-side and enforced by the host.
