# API Changelog (Launch Wave)

## Compatibility Policy
- Additive-only changes for this release wave.
- Existing endpoint behavior preserved.

## Existing Stable Endpoints (critical)
- `GET /api/v1/guilds/:guildId` (stable guild contract)
- `POST /api/v1/telemetry/client-events` (client telemetry ingest)

## Implemented Reliability-Relevant Contracts
- Guild fetch status codes use stable codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`.
- Guild fetch structured logs emitted for success/forbidden/not_found.
- 2026-03-03 client reliability hotfix (no breaking API changes):
  - Stabilized guild-session callback lifecycle in web app shell.
  - Removed repeated empty-array state resets in guild-session idle branch.
  - Expected impact: no recursive render loops; reduced duplicate guild-open telemetry emissions from client retries caused by render churn.

## Planned Additive Endpoints (Parity Backlog)
- Threads:
  - `POST /channels/:channelId/threads`
  - `GET /channels/:channelId/threads`
  - `POST /threads/:threadId/messages`
- Search v2:
  - `GET /search/messages?...`
- Read state:
  - `POST /users/@me/read-state`
  - `GET /users/@me/read-state?guildId=...`
- AutoMod:
  - `POST /guilds/:guildId/automod/rules`
  - `PATCH /guilds/:guildId/automod/rules/:ruleId`
  - `POST /guilds/:guildId/raid-mode`
- Onboarding:
  - `GET /guilds/:guildId/onboarding`
  - `PATCH /guilds/:guildId/onboarding`
  - `POST /guilds/:guildId/onboarding/complete`
- Stage controls:
  - `PUT /channels/:channelId/voice/request-speak`
  - `PUT /channels/:channelId/voice/speakers/:userId`
  - `DELETE /channels/:channelId/voice/speakers/:userId`
- Reports v2:
  - `POST /reports`
  - `GET /admin/reports`
  - `PATCH /admin/reports/:id`
- Notifications:
  - `PATCH /users/@me/notification-preferences`
