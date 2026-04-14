# Gratonite — development and operations

## Layers that protect production quality

1. **CI (GitHub Actions)** — `.github/workflows/release-gates.yml` runs on every PR and push to `main`: API `build` + `lint` + placeholder guard; web `lint` + guard + **`build:vite`** (same as production; skips the broken `tsc` path in `npm run build`). Fix red CI before merging risky work.
2. **Production deploy review** — Before shipping to production, follow [`docs/deploy-review-checklist.md`](docs/deploy-review-checklist.md): treat green CI as a prerequisite, review the change set, then verify on server and public URLs.
3. **Human process** — PR template checklist; optional branch protection requiring passing checks on `main`.

**Full release gate** (stricter, run locally or in release automation): root `package.json` → `verify:release:all` (includes API `verify:release` with `gate:data`, web `verify:prod`, e2e smoke). That needs a real DB and env for `gate:data` — not the same as lightweight CI.

**Documentation map** — [`docs/README.md`](docs/README.md) (index); [`docs/roadmap/PRODUCT-PROGRAM.md`](docs/roadmap/PRODUCT-PROGRAM.md) (initiatives); [`ROADMAP.md`](ROADMAP.md) (roadmap); this file (`DEVELOPMENT.md`) for CI, deploy, and conventions.

## Production deployment

Repo-local source of truth, in order:

1. `deploy/deploy.sh`
2. `deploy/docker-compose.production.yml`
3. `deploy/Caddyfile`
4. `docs/deploy-review-checklist.md`
5. `docs/launch/ROLLBACK_RUNBOOK.md`

- **Server**: `ferdinand@178.156.253.237` — remote dir `/home/ferdinand/gratonite-app`
- **Compose**: `deploy/docker-compose.production.yml` — live services: `gratonite-api`, `gratonite-web`, `gratonite-caddy`, `gratonite-livekit`, `gratonite-postgres`, `gratonite-redis`. The relay (`gratonite-relay`) is a **separately managed** process under `/home/ferdinand/gratonite-relay` — not in the main compose file.
- **Deploy**: `deploy/deploy.sh` (build → stage `deploy/api` + `deploy/web/dist` → rsync → migrate → health check). It requires explicit env vars:

```bash
SERVER=178.156.253.237 USER=ferdinand SSH_KEY=~/.ssh/hetzner_key_new bash deploy/deploy.sh
```

Local wrappers may exist on individual machines, but they are convenience scripts, not the canonical deploy flow.
- **Public paths**: `https://gratonite.chat/app/` (canonical user entry); `https://api.gratonite.chat/health` (health check); `https://releases.gratonite.chat` (desktop artifacts from `/home/ferdinand/gratonite-releases`). The web SPA is intentionally rooted under `/app/` via nginx — Caddy routes `/api/*` and `/socket.io/*` to the API and everything else to the web container. `app.gratonite.chat` is present in Caddyfile but DNS does not resolve — expected noise.
- **Rollback**: no versioned release slots. Realistic path = check out a previous known-good commit, rebuild, and redeploy. For schema issues prefer app rollback + forward-fix migration over destructive down-migrations.
- **Known log noise**: Caddy ACME errors for `app.gratonite.chat` (DNS unresolved); relay logs showing repeated localhost connect/disconnect and missed pongs; `POST /sentry-tunnel` returning 503 when `WEB_SENTRY_DSN` is not configured.
- **Uploads recovery**: `GET /api/v1/files/:id` returning `404` with `File not found on disk` means the file metadata exists but the uploads volume contents are missing. Restore the API uploads volume (mounted at `/app/uploads`) from backup, or have users re-upload the missing assets if no backup exists, then verify a few previously failing file URLs.
- **Self-host API startup**: the API container starts via `/app/start.sh`, which loads `/app/keys/runtime.env` before `node dist/index.js`. The setup container writes `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MFA_ENCRYPTION_KEY`, and `BULLBOARD_ADMIN_TOKEN` into that file and fixes ownership for the API user. Changes to self-host secret handling must respect this flow.

## Monorepo layout

pnpm workspaces root. **API uses `pnpm`; web/mobile/desktop use `npm`.**

```
apps/api/       Express 5 + TypeScript backend — port 4000
apps/web/       React 18 + Vite SPA — port 5173
apps/mobile/    Expo / React Native
apps/desktop/   Electron chat client
apps/server/    Tauri v2 self-hosting desktop app (manages Docker containers)
apps/landing/   Next.js marketing site
apps/relay/     Standalone federation relay server (256 MB / 1 vCPU)
deploy/         Docker Compose, Caddyfile, one-click installer
packages/types/ Shared TypeScript types (@gratonite/types)
tools/          placeholder-guard.mjs, verify-launch-super-gate.mjs, etc.
```

## Local development

```bash
# API (requires PostgreSQL + Redis — see apps/api/.env.example)
cd apps/api && cp .env.example .env
pnpm install && pnpm run db:migrate && pnpm run dev    # nodemon, port 4000

# Web (see apps/web/.env.example — set VITE_API_URL=http://localhost:4000)
cd apps/web && cp .env.example .env
npm install && npm run dev                             # Vite HMR, port 5173

# Mobile / Desktop
cd apps/mobile && npm install && npm run start
cd apps/desktop && npm install && npm run dev
```

Pre-push verification (no live DB needed for `api verify:prod`):
```bash
cd apps/api && pnpm run verify:prod    # tsc build + lint + placeholder guard
cd apps/web  && npm run verify:prod    # vite build + lint + placeholder guard
```

DB schema workflow:
```bash
cd apps/api
pnpm run db:generate   # drizzle-kit → new migration in drizzle/
pnpm run db:migrate    # apply migrations
pnpm run db:studio     # Drizzle Studio UI (optional)
```

## API coding conventions

**Routes** — one file per domain in `src/routes/`, all mounted under `/api/v1/` via `src/routes/index.ts`. Register new routers there.

**Auth** — `requireAuth` middleware (`src/middleware/auth.ts`) attaches `req.userId: string`.

**Validation** — Zod middleware from `src/middleware/validate.ts`:
```typescript
import { validate, validateParams, validateQuery } from '../middleware/validate';
router.post('/foo', requireAuth, validate(z.object({ name: z.string() })), handler);
```

**Errors** — use `AppError(statusCode, message, code)` or `sendError(res, status, code, message)` from `src/lib/errors.ts`. PostgreSQL errors normalize automatically (23505→409, 42P01→503, etc.). Global handler calls `handleAppError`.

**Database** — Drizzle ORM; import `db` from `src/db/index.ts`. Schemas in `src/db/schema/` (~140 files, one per domain); barrel at `src/db/schema/index.ts`.

**Real-time** — call `getIO()` from `src/lib/socket-io.ts` to emit Socket.IO events. Socket rooms: `user:<userId>`, `guild:<guildId>`, `channel:<channelId>`.

**Background jobs** — add file to `src/jobs/`, register in `src/jobs/worker.ts` (BullMQ primary), and add a `setInterval` fallback in the `catch` block in `src/index.ts`.

**Placeholder guard** — `tools/placeholder-guard.mjs` blocks `coming soon`, `simulated`, `mock`, `fake data`, etc. in `apps/api/src` and `apps/web/src`. Add exceptions to `tools/placeholder-guard.allowlist.json`.

## Web client conventions

**Routing** — React Router v7 (`createBrowserRouter`). All routes declared in `src/App.tsx`. Wrap new heavy pages in `lazy(() => import(...))`.

**Data fetching** — TanStack React Query. Query hooks live in `src/hooks/queries/`; HTTP client modules in `src/lib/api/` (one file per domain); query client at `src/lib/queryClient.ts`.

**Auth state** — `useUser()` from `src/contexts/UserContext.tsx`. Route guards: `RequireAuth` and `RequireAdmin` in `src/components/guards/`.

**Socket** — singleton client in `src/lib/socket.ts`. Server→client events: `MESSAGE_CREATE`, `MESSAGE_UPDATE`, `MESSAGE_DELETE`, `TYPING_START`, `PRESENCE_UPDATE`, `NOTIFICATION_CREATE`, `READY`. Client→server: `IDENTIFY`, `HEARTBEAT`, `CHANNEL_JOIN`, `CHANNEL_LEAVE`, `PRESENCE_UPDATE`.

**Shared types** — import from `@gratonite/types` (workspace `packages/types/`).

## Critical environment variables

API (`apps/api/.env`):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | ≥32 chars; **different** from `JWT_REFRESH_SECRET` |
| `JWT_REFRESH_SECRET` | ≥32 chars |
| `APP_URL` / `CORS_ORIGIN` | Required in production; or set `INSTANCE_DOMAIN` to auto-derive both |
| `MFA_ENCRYPTION_KEY` | Required in production for TOTP MFA |
| `BULLBOARD_ADMIN_TOKEN` | Gates `/admin/jobs` Bull Board dashboard |
| `FEDERATION_ENABLED=true` | Enable federation for bespoke installs; the checked-in self-host preset turns this on by default |
| `DB_PASSWORD` | Checked by deploy preflight (postgres service password, separate from `DATABASE_URL`) |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Required for voice/video channels |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email delivery |

Web (`apps/web/.env`): `VITE_API_URL=http://localhost:4000`
