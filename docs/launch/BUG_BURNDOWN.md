# Bug Burndown

## Severity Definitions
- Sev-1: outage/data-loss/security-critical.
- Sev-2: major broken core workflow.
- Sev-3: degraded/non-blocking.

## Open Defects
| ID | Severity | Area | Status | Owner | Notes |
|---|---|---|---|---|---|
| BR-001 | Sev-2 | Poll creation/voting | fixed | Web | Removed local-only poll fallback and enforced API persistence |
| BR-002 | Sev-2 | FAME dashboard runtime data | fixed | Web | Removed fallback dataset markers and hardcoded rank placeholders |
| BR-003 | Sev-3 | `next/navigation` import error from external run env | needs-repro | Web | Not reproducible in current repo snapshot; likely stale file/path mismatch |
| BR-004 | Sev-2 | Guild navigation/render loop | fixed-pending-retest | Web | Root cause: unstable `useGuildSession` callback + repeated `setChannels([])` resets; fix applied 2026-03-03 in `App.tsx` and `useGuildSession.ts` |

## Retest Evidence
- Run `npm --prefix apps/web run verify:prod`
- Run `pnpm --dir apps/api run verify:release`
- Run `npm --prefix apps/web run smoke:e2e`
- Run `npm run verify:launch:super-gate`
