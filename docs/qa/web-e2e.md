# Web E2E (Web Reliability Suite)

Last updated: 2026-02-22

## Scope

Current Playwright coverage:
- Auth baseline (register/login/session restore)
- Messaging and media reliability (guild/DM send, realtime, attachments, typing, iOS newline send, unread, ordering)
- Messaging and media reliability (guild/DM send, realtime, attachments, typing, iOS newline send, unread, ordering, attachment clear-all)
- Portal gallery accessibility and keyboard flows
- Portal gallery pass-2 interactions (search/sort/favorites persistence)
- Channel lifecycle and onboarding
- Voice control-state harness contracts (camera/screenshare toggle state + pending tile)
- Community shop and profile customization flows
- Visual baselines for home/channel/settings/composer

Spec file:
- `apps/web/tests/e2e/auth.spec.ts`
- `apps/web/tests/e2e/messaging.spec.ts`
- `apps/web/tests/e2e/accessibility.spec.ts`
- `apps/web/tests/e2e/channel-lifecycle.spec.ts`
- `apps/web/tests/e2e/community-shop.spec.ts`
- `apps/web/tests/e2e/visual.spec.ts`

## Commands

1. Reset local test data:
   - `pnpm test:reset`
2. Install Chromium for Playwright (first run only):
   - `pnpm --filter @gratonite/web e2e:install`
3. Run E2E:
   - `pnpm e2e:web`
4. Run targeted reliability suites directly (recommended for local iteration):
   - `cd apps/web && PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" pnpm exec playwright test tests/e2e/messaging.spec.ts --workers=1`
   - `cd apps/web && PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" pnpm exec playwright test tests/e2e/accessibility.spec.ts --workers=1`
   - `cd apps/web && PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" pnpm exec playwright test tests/e2e/visual.spec.ts --workers=1`
5. Refresh visual baselines after intentional UI changes:
   - `cd apps/web && PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots --workers=1`

## Notes

- Playwright config auto-starts API + web dev servers.
- API CORS is set for E2E using `CORS_ORIGIN=http://127.0.0.1:4173`.
- If Docker services are not running, the API server will fail to boot.
- Register helper has bounded 429 retry/backoff built in to reduce false negatives during local burst runs.
- Browser binaries are installed in app-local cache: `apps/web/.cache/ms-playwright`.
- In restricted-network environments, tests can run against locally installed Chrome (`channel: "chrome"`).
- CI uploads `apps/web/playwright-report` and `apps/web/test-results` as artifacts on every run.
- Local verification status (2026-02-22):
  - `pnpm --filter @gratonite/web typecheck` -> PASS
  - `playwright --list` for messaging/a11y/visual -> PASS (23 tests discovered)
  - Targeted runs:
    - `accessibility.spec.ts` -> PASS (3/3)
    - messaging tests:
      - `reorders DM list in realtime...` -> PASS
      - `switches own message avatar between sprite and fallback avatar...` -> PASS
    - `visual.spec.ts --update-snapshots` -> PASS (1/1)
    - `channel-lifecycle.spec.ts -g \"portal gallery search and favorites|voice control harness\"` -> PASS (2/2)
    - `messaging.spec.ts -g \"clears pending attachments\"` -> PASS (1/1)
