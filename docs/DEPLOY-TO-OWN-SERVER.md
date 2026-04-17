# Gratonite Production Deployment with Docker Compose

This document describes the current Gratonite project production deployment pattern.

It is **not** the recommended end-user self-hosting path. If you want to run your own Gratonite instance, start with [`docs/self-hosting.md`](self-hosting.md) or `deploy/self-host/` instead.

## Current Production Shape

- server: `ferdinand@178.156.253.237`
- remote app dir: `/home/ferdinand/gratonite-app`
- relay dir: `/home/ferdinand/gratonite-relay` (managed separately)
- canonical app URL: `https://gratonite.chat/app/`
- API health URL: `https://api.gratonite.chat/health`

The public stack is driven by:

- `deploy/deploy.sh`
- `deploy/docker-compose.production.yml`
- `deploy/Caddyfile`

## Required Local Prerequisites

- `pnpm`
- `rsync`
- SSH access to the production server
- a server-side `.env` already present in `/home/ferdinand/gratonite-app`

## Canonical Deploy Command

```bash
SERVER=178.156.253.237 USER=ferdinand SSH_KEY=~/.ssh/hetzner_key_new bash deploy/deploy.sh
```

`deploy/deploy.sh` is the source of truth for deploy behavior.

## What `deploy/deploy.sh` Does

1. Installs workspace dependencies needed for API and web builds.
2. Builds the API with `pnpm`.
3. Builds the web app with the production Vite build.
4. Stages `deploy/api` and `deploy/web/dist`.
5. Rsyncs `deploy/` to the remote server while protecting server `.env` files.
6. Runs remote preflight checks for required secrets and legacy-proxy conflicts.
7. Recreates `api`, `web`, `caddy`, and `livekit`.
8. Runs database migrations.
9. Polls the API health endpoint.
10. Verifies landing, app shell, releases, service worker, and manifest URLs.
11. Prints remote container diagnostics plus rollback guidance automatically if verification fails.

## Production Routing Reality

- `https://gratonite.chat/` serves the landing/root surface.
- `https://gratonite.chat/app/` is the canonical web app entry.
- `https://api.gratonite.chat/health` is the health check endpoint.
- `app.gratonite.chat` may still appear in config, but unresolved DNS there is known noise and not the canonical entry.

## Verification After Deploy

```bash
ssh -i ~/.ssh/hetzner_key_new ferdinand@178.156.253.237
cd ~/gratonite-app
docker compose -f docker-compose.production.yml ps
curl -I https://api.gratonite.chat/health
curl -I https://gratonite.chat/
curl -I https://gratonite.chat/app/
curl -I https://gratonite.chat/releases
curl -I https://gratonite.chat/app/sw.js
```

## Rollback Reality

There are no versioned release slots in the current production setup.

Real rollback means:

1. check out a known-good commit
2. rebuild
3. redeploy

For schema problems, prefer app rollback plus a forward-fix migration rather than destructive down-migrations.

See [`docs/launch/ROLLBACK_RUNBOOK.md`](launch/ROLLBACK_RUNBOOK.md).

## Notes

- The relay is not part of the main production compose stack.
- Server `.env` values are authoritative and should never be overwritten during deploy.
- If you are documenting production behavior elsewhere, keep it aligned with `deploy/deploy.sh` rather than older ad hoc workflows.
