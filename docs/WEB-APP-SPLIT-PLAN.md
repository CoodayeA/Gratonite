# `apps/web/src/App.tsx` Incremental Split Plan

This plan keeps behavior stable while reducing merge-conflict risk and improving ownership boundaries.

## Goals

- Preserve existing routes and URLs.
- Keep each PR small and reversible.
- Move to feature-owned route modules instead of a single giant router file.

## Proposed Target Structure

```text
apps/web/src/
  app/
    router/
      index.tsx
      publicRoutes.tsx
      appRoutes.tsx
      adminRoutes.tsx
      guildRoutes.tsx
    layout/
      AppLayout.tsx
      AuthLayout.tsx
    pages/
      wrappers.tsx
```

## Phase 1: Route Decomposition (No Behavior Changes)

1. Extract lazy imports into grouped files:
   - `router/publicRoutes.tsx`
   - `router/appRoutes.tsx`
   - `router/adminRoutes.tsx`
   - `router/guildRoutes.tsx`
2. Keep the same route elements and wrappers (`RequireAuth`, `RequireAdmin`, `ErrorBoundary`, `Suspense`).
3. Build final router in `router/index.tsx`.

**Done when:** `App.tsx` no longer defines the full route tree inline.

## Phase 2: Layout Isolation

1. Move `AppLayout` and `AuthLayout` into `app/layout/`.
2. Keep props/context identical to avoid downstream churn.
3. Leave modal/state wiring unchanged in this phase.

**Done when:** Layout components are imported from dedicated files.

## Phase 3: Modal and Overlay Boundaries

1. Extract global modal orchestration into `app/layout/AppOverlays.tsx`.
2. Keep existing lazy-loaded modals; only move orchestration code.
3. Add a thin interface for overlay open/close actions.

**Done when:** `AppLayout` focuses on shell; overlays are separate.

## Phase 4: Feature Ownership Cleanup

1. Move route-specific wrapper components near their feature folders.
2. Remove dead route aliases after confirming no inbound usage.
3. Add lightweight route smoke coverage for:
   - auth routes
   - guild channel route
   - admin route guard

## Verification Per Phase

- `pnpm --filter gratonite-web run lint`
- `pnpm --filter gratonite-web run build:vite`
- Manual smoke:
  - login/register/reset
  - open guild channel and DM
  - open admin route as admin/non-admin

## Rollback Strategy

Each phase should be one PR. If regressions appear, revert only that phase PR and keep prior phases intact.
