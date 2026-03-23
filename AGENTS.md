# Gratonite — agent and automation notes

## Layers that protect production quality

1. **CI (GitHub Actions)** — `.github/workflows/release-gates.yml` runs on every PR and push to `main`: API `build` + `lint` + placeholder guard; web `lint` + guard + **`build:vite`** (same as production; skips the broken `tsc` path in `npm run build`). Fix red CI before merging risky work.
2. **Agent rule** — `.cursor/rules/production-deploy-review.mdc` — review/double-check before production deploy; treat green CI as a prerequisite for shipping; full verification after deploy.
3. **Human process** — PR template checklist; optional branch protection requiring passing checks on `main`.

**Full release gate** (stricter, run locally or in release automation): root `package.json` → `verify:release:all` (includes API `verify:release` with `gate:data`, web `verify:prod`, e2e smoke). That needs a real DB and env for `gate:data` — not the same as lightweight CI.

## Production deployment

Detailed runbook: Claude project memory `reference_deployment.md` (Hetzner, rsync, compose, Step 7–8 verification).
