# Release quality checklist (web + desktop)

Use before promoting a build to production. Adjust per release scope.

## Voice / video / screen share

- [ ] Join voice in a guild channel (web): connect, mute, deafen, disconnect.
- [ ] DM call: connect and leave; error toasts are readable (no duplicate spam on reconnect).
- [ ] Screen share: start and stop; on **Electron**, confirm desktop capture path (not empty picker).
- [ ] Sentry (production): voice/screen failures tagged (`voice_connect_failure`, `screen_share_error`) contain no secrets.
- [ ] LiveKit: `LIVEKIT_ACCESS_TOKEN_TTL` and server image tag documented; client [`livekit-client`](../../apps/web/package.json) major compatible with server.

## Security (smoke)

- [ ] `pnpm audit` / `npm audit` (api) — no unreviewed **high** in runtime paths.
- [ ] API `/health` OK behind proxy; Bull Board not public without auth token.

## Desktop

- [ ] `gratonite://` links: only expected hosts (`guild`, `dm`, `invite`, `settings`).
- [ ] Global shortcuts still register after hotkey config change.

## Accessibility (incremental)

- [ ] Voice bar: toolbar role and control labels (mute, deafen, disconnect).
- [ ] Screen share modal: dialog has title id; Escape closes.

## UI polish

- [ ] Voice bar visible when connected; navigating to text channel keeps VoiceContext handlers.
- [ ] Channel chat composer and uploads work on a smoke guild.
