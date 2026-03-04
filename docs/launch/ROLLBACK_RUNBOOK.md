# Rollback Runbook

## Priority Order
1. Disable affected feature kill switch.
2. Validate recovery in telemetry/errors.
3. If unresolved, roll back service artifact.
4. Use DB forward-fix migration for schema issues.

## Kill Switch Matrix
- `guild_fetch_v2`
- `threads_v1`
- `bookmarks_v1`
- `search_v2`
- `automod_v2`
- `onboarding_v1`
- `voice_stage_v2`
- `presence_v2`
- `unread_sync_v2`
- `reports_v2`

## Rollback Commands
- Web rollback: deployment platform previous-release rollback command.
- API rollback: deployment platform previous-release rollback command.
- Verification after rollback:
  - `npm --prefix apps/web run smoke:e2e`
  - `pnpm --dir apps/api run test:guild-get-contract`

## Incident Guardrails
- Any Sev-1 paging condition -> immediate rollback decision call.
- Kill switch toggles must be documented in incident timeline.

## Symptom-Specific Playbook: Max Update Depth / Route Freeze
If users report URL changes without view updates and console shows `Maximum update depth exceeded`:
1. Toggle `guild_fetch_v2` OFF to halt guild session v2 path.
2. Verify navigation recovers on Home/Friends/Discover/Guild routes.
3. If not recovered in 10 minutes, perform web artifact rollback.
4. Keep API live unless API monitors also breach thresholds.
