# Web Performance Budgets

Last updated: 2026-02-22  
Owner: Web Team

## Beta budgets (initial)

1. Initial route JS bundle (`/`):
   - target <= 500KB uncompressed main chunk
2. First meaningful shell render:
   - target <= 2.5s on standard dev baseline
3. Channel switch interaction:
   - target <= 200ms median for visible transition on baseline load
4. Message send UI response:
   - target <= 150ms optimistic local echo

## Current command evidence

1. Build + size output:
   - `pnpm check:web` (includes `vite build` output)
2. API latency visibility:
   - slow request logs >=200ms in `apps/api/src/index.ts`
3. Existing instrumentation:
   - `docs/phase-9-performance.md`
4. Runtime interaction paint telemetry:
   - `apps/web/src/lib/perf.ts`
   - `apps/web/src/components/sidebar/ChannelSidebar.tsx`
   - `apps/web/src/components/messages/MessageList.tsx`
   - `apps/web/src/components/messages/MessageComposer.tsx`

## Latest evidence (2026-02-22)

1. `pnpm check:web` -> PASS
2. `pnpm --filter @gratonite/web e2e -- tests/e2e/accessibility.spec.ts tests/e2e/channel-lifecycle.spec.ts tests/e2e/community-shop.spec.ts tests/e2e/visual.spec.ts` -> PASS (8/8)

## Guardrail policy

1. Any budget breach blocks RC promotion until:
   - regression cause identified
   - mitigation merged
   - follow-up budget rerun recorded
