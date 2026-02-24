# Web Accessibility Checklist

Last updated: 2026-02-22  
Owner: Web Team

## Scope

Critical-path web surfaces for beta:
1. Home + server gallery
2. Guild/channel navigation
3. Message list + composer
4. Settings (profiles/appearance/economy)

## Automated checks in place

1. Keyboard/pressed-state smoke:
   - `apps/web/tests/e2e/accessibility.spec.ts`
2. Reduced-motion + contrast smoke:
   - `apps/web/tests/e2e/accessibility.spec.ts`
3. Existing critical-path suites:
   - `apps/web/tests/e2e/auth.spec.ts`
   - `apps/web/tests/e2e/messaging.spec.ts`
   - `apps/web/tests/e2e/channel-lifecycle.spec.ts`

## Evidence (2026-02-22)

1. Command run:
   - `pnpm --filter @gratonite/web e2e -- tests/e2e/accessibility.spec.ts`
   - Result: 2/2 passed
2. Covered assertions:
   - keyboard focus + Enter navigation from server gallery
   - pressed-state controls exposed via `aria-pressed`
   - reduced-motion guardrail reduces transition durations to near-zero
   - baseline text/background contrast check on app shell (WCAG AA threshold >= 4.5:1)
3. Manual check still required before external beta:
   - screen-reader walkthrough on login -> server entry -> message send -> settings save

## Required pre-beta manual checks

1. Full keyboard traversal:
   - no keyboard traps
   - visible focus ring on all actionable controls
2. Reduced motion:
   - animations respect `prefers-reduced-motion`
3. Contrast:
   - verify primary text/action contrast in light and dark previews
4. Screen reader pass (minimum):
   - login, server entry, message send, settings save

## Exit criteria

1. No open P0/P1 accessibility defects on P0/P1 critical-path flows.
2. Keyboard-only user can complete auth -> enter server -> send message -> open settings without mouse.
