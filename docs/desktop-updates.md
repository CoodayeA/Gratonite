# Desktop Updates & Deep Links

## Update feed

Set `GRATONITE_UPDATE_URL` in the desktop environment to enable auto-update checks.

Example:

```
GRATONITE_UPDATE_URL=https://updates.gratonite.app/desktop
```

When unset, update checks are disabled and no UI prompts are shown.

## Deep links

The desktop app registers the `gratonite://` protocol.

Supported routes:

- `gratonite://invite/{code}`
- `gratonite://dm/{channelId}`
- `gratonite://guild/{guildId}/channel/{channelId}`

Links are routed to the web client via IPC and handled by the router.
