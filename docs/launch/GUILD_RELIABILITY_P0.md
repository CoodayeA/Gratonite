# Guild Reliability P0

## Goal
Eliminate repeated "Failed to load guild data" loops and make guild access failures deterministic and user-correct.

## Current Implementation Baseline
- Single source guild session hook: `apps/web/src/hooks/useGuildSession.ts`
- Shared usage path in app shell: `apps/web/src/App.tsx`
- Deterministic 403/404 UX in guild overview: `apps/web/src/pages/guilds/GuildOverview.tsx`
- Backend structured guild_get events: `apps/api/src/routes/guilds.ts`

## 2026-03-03 Stability Hotfix
- Incident symptom:
  - Repeated `Maximum update depth exceeded` warnings.
  - URL changed on navigation, but rendered app content stayed stale.
- Root cause:
  - Unstable `onNetworkError` callback identity passed to `useGuildSession` recreated request logic each render.
  - Null-guild branch repeatedly called `setChannels([])` with a fresh array reference.
- Fix:
  - Memoized network error callback in `AppLayout` (`App.tsx`).
  - Changed channel reset operations to idempotent form:
    - `setChannels((prev) => (prev.length === 0 ? prev : []))`.

## Required State Contract
`useGuildSession(guildId)` exposes:
- `guildInfo`
- `channels`
- `loading`
- `errorCode`
- `lastFailureAt`

## Status-Aware Rules
- `401` -> auth flow, no toast spam.
- `403` -> forbidden UX.
- `404` -> not-found UX.
- `network/5xx` -> one toast per guild / 30s cooldown.

## Request Control Rules
- One in-flight request per guild ID.
- Retry only network/5xx with exp backoff + jitter.
- No retry for `401/403/404`.
- Abort stale requests on route change.

## Stable Error Codes
- `UNAUTHORIZED` -> HTTP 401
- `FORBIDDEN` -> HTTP 403
- `NOT_FOUND` -> HTTP 404

## Telemetry Correlation
- Frontend:
  - `guild_open_attempt`
  - `guild_open_result` (status class, latency, requestId)
  - `guild_toast_suppressed`
- Backend:
  - `guild_get.success`
  - `guild_get.forbidden`
  - `guild_get.not_found`

## Acceptance Tests
1. Guild open succeeds for member across 20 repeated opens.
2. Non-member returns deterministic forbidden UI.
3. Unknown guild returns deterministic not-found UI.
4. Expired token follows auth flow.
5. Route switch aborts stale request cleanly.
6. Network flap triggers max one toast per guild in cooldown window.
7. Route URL and rendered content remain in sync for Home/Friends/Discover/Guild routes.
8. No `Maximum update depth exceeded` warnings during route-transition smoke.
