# Security audit policy

This document describes how dependency and configuration reviews fit into Gratonite releases.

## Dependency and supply chain

- **Workspace:** From the repository root, run `pnpm install` and `pnpm audit` (or `pnpm audit --fix` when safe). The root [`package.json`](../package.json) may define `pnpm.overrides` to align transitive packages with patched versions.
- **Apps using npm directly:** `apps/api` may still be installed with `npm install`; run `npm audit` there before shipping API changes.
- **Lockfiles:** Commit lockfiles (`pnpm-lock.yaml`, `package-lock.json`) and avoid ad-hoc `latest` ranges for production-critical dependencies.
- **Windows:** If `pnpm install` fails with `EPERM` while renaming `electron`, close Electron/IDE processes that lock `node_modules` and retry. If the desktop app folder stays locked, install the rest of the workspace with:
  `pnpm install --filter "!gratonite-desktop"`
- **API dev tooling:** `gratonite-api` pins `picomatch@4.0.4` as a devDependency so `nodemon → chokidar → anymatch` resolves to a patched picomatch under pnpm audits.

## Runtime configuration (API)

Production startup validates JWT length, `APP_URL` / `CORS_ORIGIN`, and critical secrets — see [`apps/api/src/index.ts`](../apps/api/src/index.ts).

- **Socket.io:** Payload size is capped via `maxHttpBufferSize` on the Socket.IO server.
- **Voice:** LiveKit JWT lifetime is controlled by `LIVEKIT_ACCESS_TOKEN_TTL` (default `1h`) — see [`apps/api/src/lib/livekit-tokens.ts`](../apps/api/src/lib/livekit-tokens.ts).
- **Federation outbound fetches** should only target known instance URLs (e.g. registered `federatedInstances`).

## Desktop (Electron)

- Preload exposes a minimal `contextBridge` API; validate `gratonite://` deep links in [`apps/desktop/main.js`](../apps/desktop/main.js) before forwarding to the renderer.
- Review new `ipcMain` handlers for path traversal, shell execution, or arbitrary file access.

## Cadence

Run an audit before each production promotion; record any accepted residual risk (e.g. dev-only `esbuild` advisories behind `npm audit fix --force`).

## Reviewed (2026-04)

- **Bull Board admin exposure:** Token auth verified using `crypto.timingSafeEqual()`. Token required in production. Caddyfile does not route `/admin/jobs` externally (defense-in-depth).
- **Public file serving:** Rate limit (600 req/min) and path traversal defense (`path.resolve()` check) both active.
- **Rate limiting coverage:** Auth (30/min), public files (600/min), usernames (10/min), email verify (5/hour), MFA (10/hour), search (20/min), invites (30/min), bots (30/min) — all covered. Global API limit (200/min per user) enforced.
- **No gaps found.**
