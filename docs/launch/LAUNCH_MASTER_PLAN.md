# Launch Master Plan

This is the source of truth for the launch wave that includes:
- Guild reliability P0 completion.
- Discord-parity feature expansion.
- Full release hardening and Go/No-Go controls.

## Mandatory Gates
1. `npm run verify:launch:super-gate`
2. Zero open Sev-1 / Sev-2 issues in `BUG_BURNDOWN.md`
3. Go/No-Go sign-off in `GO_NO_GO_CHECKLIST.md`

## Current Launch Blockers (as of 2026-03-03)
- `BR-004` must be retested to closure:
  - Symptom: `Maximum update depth exceeded` in app shell and route URL/view mismatch.
  - Fix applied in code:
    - `apps/web/src/App.tsx` (`useGuildSession` network-error callback memoized)
    - `apps/web/src/hooks/useGuildSession.ts` (idempotent empty-channel resets)
  - Exit criteria: no max-depth warnings during navigation smoke and route content matches URL.

## Canonical Documents
- `FEATURE_MATRIX_25.md`
- `GUILD_RELIABILITY_P0.md`
- `API_CHANGELOG.md`
- `ROLLBACK_RUNBOOK.md`
- `BUG_BURNDOWN.md`
- `GO_NO_GO_CHECKLIST.md`

## Deployment Sequence
1. API deploy first.
2. Run API post-deploy checks.
3. Web deploy second.
4. Start 120-minute active monitoring window.
5. Use kill switches first for mitigation, artifact rollback second.

## Additive-Only Contract Rule
- No intentional breaking API changes in this wave.
- Existing contracts remain valid while new endpoints are additive.

## No Mock / No Hardcoded Runtime Data Rule
- Production runtime paths must not rely on mock datasets or local-only synthetic content.
- Guarded by `tools/placeholder-guard.mjs` and release verification scripts.
