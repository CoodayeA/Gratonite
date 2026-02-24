# Live Beta Monitoring Checklist (2026-02-23)

Use this during the first `24-48h` of the controlled beta.

## Cadence

1. At cohort start
2. After every production bugfix deploy
3. At least twice daily during active testing windows

## 1. Health + Smoke

1. Run:
   - `./scripts/checks/beta-ops-snapshot.sh`
2. Confirm:
   - web routes return `200`
   - API health `status: ok`
   - API prod smoke passes
   - API contract smoke passes

## 2. Error/Log Review (Hetzner API)

1. Review recent API logs for:
   - auth/email verification failures
   - MFA/login failures
   - attachment/file `NOT_FOUND`/storage errors
   - websocket/realtime exceptions
   - voice/video signaling errors
2. If repeated errors are present:
   - capture exact error text
   - map to bug inbox issue or create one

## 3. Bug Inbox Review

1. Open `https://gratonite.chat/ops/bugs`
2. Count `open` and `triaged`
3. Classify new issues using:
   - `docs/ops/bug-inbox-severity-rubric.md`
4. Prioritize `P0/P1` only for immediate patch windows

## 4. User Support Signals

1. Check for repeated reports of:
   - login/verify email issues
   - DM/channel realtime delays
   - image/video upload/render failures
   - voice/camera/screenshare failures
2. Merge duplicates and link to one triaged item

## 5. Deploy Safety Rules (While Beta Is Active)

1. Bugfix-only deploys
2. Run post-deploy smoke every time
3. If smoke fails:
   - stop rollout
   - fix or roll back

## 6. End-of-Day Checkpoint

1. Bug counts by status (`open`, `triaged`, `resolved`)
2. Any `P0/P1` still open
3. Decision:
   - continue current cohort
   - pause invites
   - widen cohort
