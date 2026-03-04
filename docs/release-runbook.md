# Production Release Runbook

Canonical launch source of truth: `docs/launch/LAUNCH_MASTER_PLAN.md`.

## Preflight
- Confirm migrations are generated and committed.
- Confirm environment secrets are non-placeholder and production-safe.
- Run:
  - `npm run verify:launch:super-gate`
  - `npm --prefix apps/web run verify:prod`
  - `pnpm --dir apps/api run verify:release`
  - `npm --prefix apps/web run smoke:e2e`
  - `npm run verify:release:all`

## Staging
- Apply DB migrations.
- Run:
  - `pnpm --dir apps/api run db:doctor`
  - `pnpm --dir apps/api run seed:catalog`
  - `pnpm --dir apps/api run seed:discover-starter`
  - `pnpm --dir apps/api run gate:data`
- Run smoke matrix:
  - Auth login/refresh
  - Discover list and filters
  - Member list (custom groups + online/offline + search)
  - Purchase and inventory refresh/equip

## Production Deploy
1. Deploy API.
2. Run production data checks:
   - `db:doctor`
   - `seed:catalog`
   - `seed:discover-starter`
   - `gate:data`
3. Deploy web.
4. Run post-deploy smoke checks.
5. Monitor core endpoints and guild open funnel for 120 minutes.
6. Use per-feature kill switches before full artifact rollback.

## Rollback
- Roll back API and web artifacts to previous known-good release.
- For database:
  - Use migrate-down only for non-destructive migrations.
  - For destructive risk, perform app rollback first and run forward fix migration.

## Post-Deploy Smoke Checklist
- Guild create -> appears in rail without refresh.
- Purchase -> inventory updates immediately and persists after reload.
- Cosmetics (frame/nameplate/effect) visible across app surfaces.
- Route navigation consistency:
  - URL and rendered view stay in sync for Home/Friends/Discover/Guild.
  - No `Maximum update depth exceeded` warnings in browser console.
- People panel:
  - Custom groups shown
  - Online/offline split correct
  - Search/filter functional
- Discover:
  - No hardcoded fallback behavior
  - Curation ordering deterministic
