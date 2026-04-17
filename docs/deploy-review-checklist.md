# Production deploy review checklist

Use before shipping to production (e.g. Hetzner, `rsync` of `deploy/`, `docker-compose.production.yml`, `--force-recreate` for `api` / `web`, migrations in `gratonite-api`).

## Before deploy

1. **Review the change set** — correctness, edge cases, **security** (auth, secrets, user input, SQL), **data** (migrations, backwards compatibility), and UX regressions in touched flows.
2. **Confirm CI** — `.github/workflows/release-gates.yml` (or current team workflow) should be **green** on the commit you are shipping; if not, fix or explicitly justify.
3. **Confirm release hygiene automation** — at minimum:
   - `pnpm verify:deploy:artifacts`
   - landing build
   - web lint + placeholder guard + Vite build
   - service worker precache validation
   - API `verify:release`
   - web smoke
4. **Then** run the deploy pipeline (build → package → upload → restart → migrate → verify).

If deploying without full context, infer changes from `git` / recent files, then review, then deploy.

Do not call deployment **done** until **server** checks (containers, API health, logs) **and** **public** URLs / smoke (landing, app shell, releases page, service worker / manifest) pass — not SSH-only.

## General habits (main and release branches)

- Prefer **small, reviewable** diffs; avoid drive-by refactors mixed with feature work.
- **Auth and data paths**: extra scrutiny; run or point to tests when they exist.
- **New env vars / migrations**: document for operators and call out deploy order.
- **Deploy failures**: capture `docker compose ps`, API/web/Caddy log tails, and the rollback decision in the incident timeline.

Internal ops runbooks may live outside this repository.
