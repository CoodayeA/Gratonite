# Release Telemetry and Alert Thresholds

This document defines the minimum production monitoring posture required for the single large release.
Canonical launch docs: `docs/launch/LAUNCH_MASTER_PLAN.md`.

## Structured Events

The API emits structured JSON events for:

- `purchase.success`
- `purchase.failed`
- `equip.success`
- `equip.failed`
- `discover.query`
- `member_group.created`
- `member_group.updated`
- `member_group.deleted`
- `member_group.member_added`
- `member_group.member_removed`
- `guild_get.success`
- `guild_get.forbidden`
- `guild_get.not_found`
- `guild_open_attempt` (client-ingested)
- `guild_open_result` (client-ingested)
- `guild_toast_suppressed` (client-ingested)

All events include `event`, `timestamp`, and route/domain identifiers.

## Required Error-Rate Monitors

Create one monitor per endpoint family:

- `/api/v1/shop/purchase`
- `/api/v1/guilds/discover`
- `/api/v1/guilds/:id/members*`
- auth refresh flow (`/api/v1/auth/refresh`)

## Guild Open Funnel Query

Use `guild_open_attempt` and `guild_open_result` events to track open conversion.

Minimum dashboard panels:

- attempt volume per minute
- result breakdown (`success`, `forbidden`, `not_found`, `network`, `unauthorized`)
- guild-open latency `p50` / `p95`
- suppressed-toast volume (`guild_toast_suppressed`)

Correlate with backend `guild_get.*` events by `guildId` + `requestId` where present.

Add a client-churn sanity panel:

- `guild_open_attempt` minus `guild_open_result` over 5 minutes
- `guild_open_attempt` to route-transition count ratio

Purpose: detect client-side render loops that spam attempts without completing view updates.

## Alert Thresholds

Use rolling 5-minute windows with a minimum volume guard of 50 requests.

- `warning`: error rate >= 2%
- `critical`: error rate >= 5%
- `page`: error rate >= 10% for 10 minutes
- `guild forbidden/not_found spike warning`: either class >= 3x 60-minute baseline for 10 minutes
- `guild network spike critical`: `network` result class >= 8% for 10 minutes
- `guild open churn warning`: (`guild_open_attempt` / `guild_open_result`) >= 1.5 for 10 minutes with attempt volume >= 100

## Release Window Policy

For the 120-minute post-deploy watch window:

- Trigger rollback assessment if any `critical` monitor fires.
- Trigger immediate rollback if any `page` condition is sustained for 10 minutes.
- Prefer feature kill switch mitigation before artifact rollback where safe.
