# Troubleshooting

Common issues and their fixes when self-hosting Gratonite.

---

## Common Issues

| Problem | Cause | Fix |
|---|---|---|
| Caddy can't get TLS certificate | DNS not pointing to your server, or ports 80/443 blocked by firewall | Verify your A record points to the server IP (`dig +short your-domain.com`). Open ports 80 and 443 inbound. |
| Setup fails on migrations | PostgreSQL container not ready yet | Check logs with `docker compose logs setup`. Wait 10-15 seconds and retry: `docker compose up setup`. |
| API crashes with `JWT_SECRET` error | Older self-host images generated runtime secrets during setup but did not pass them to the API container | Update to the latest images and retry from a clean `docker compose down -v` if this is a fresh install |
| API crashes with `BULLBOARD_ADMIN_TOKEN` error | Older self-host images required a Bull Board token but did not auto-generate one | Update to the latest images and retry from a clean `docker compose down -v` if this is a fresh install |
| API crashes with LiveKit error | LiveKit environment variables partially set | Either remove all `LIVEKIT_*` variables from `.env` (disables voice) or set all three: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. |
| Can't connect to relay | Firewall blocking outbound WSS connections | Allow outbound traffic on port 443. The relay connection is outbound only. |
| Browser shows security warning | Self-signed certificate in local mode | This is normal for local installations. Click **Advanced** then **Proceed to localhost**. |
| Federation not working | Federation disabled or relay unreachable | Check that `FEDERATION_ENABLED=true` in `.env`. Verify outbound port 443 is open. Check relay logs: `docker compose logs relay`. |
| "Federation not initialized" error | Federation database tables missing | Re-run the setup container: `docker compose up setup`. It will apply missing migrations. |
| High memory usage | Default PostgreSQL/Redis memory settings too generous | Tune resource limits in `docker-compose.yml` under the `postgres` and `redis` services. For a 2 GB server, add `shm_size: 128mb` to postgres and `--maxmemory 256mb` to redis command. |
| Cannot log in after install | Admin credentials lost or mistyped | Check `~/gratonite/.env` for `ADMIN_USERNAME` and `ADMIN_PASSWORD`. These are only used on first run to create the account. |
| Emails not sending | SMTP not configured | Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in `.env`. Email features are optional. |

## First Thing to Collect for Support

Generate a support bundle before opening an issue so logs and container state are preserved.

From `~/gratonite` (CLI installs):

```bash
bash ./collect-logs.sh
```

From PowerShell:

```powershell
pwsh ./collect-logs.ps1
```

The bundle includes:

- `docker compose ps -a`
- logs for `setup`, `api`, `web`, `caddy`, `postgres`, `redis`, `livekit`
- Docker and Compose version/info
- `.env` keys with values redacted

## Desktop App: "Setup failed with exit code 1"

If the desktop self-host app shows:

```text
Setup failed with exit code 1
```

the most common causes are:

- PostgreSQL was not ready before the setup container started
- Redis was not ready before the setup container started
- the setup container hit a real migration or configuration error
- an old broken database volume is still mounted from a previous failed attempt

Recent desktop app improvements:

- the app now waits for PostgreSQL and Redis readiness instead of sleeping a fixed 5 seconds
- setup failures now include the `gratonite-setup` container logs directly in the error box
- users can copy those setup logs from the UI and include them in bug reports

### What to tell users to do first

1. Wait for Docker Desktop to finish starting completely.
2. Click `Try Again`.
3. If the error mentions authentication failure or a broken prior database state, stop the Gratonite containers in Docker Desktop and retry.
4. If it still fails, copy the setup logs from the app and send those logs with the report.

### What support should check next

Ask for the setup logs from the app, or have the user run:

```bash
docker logs gratonite-setup --tail 120
```

If they are using the Compose-based self-host path, ask for:

```bash
docker compose -f deploy/self-host/docker-compose.yml logs setup
docker compose -f deploy/self-host/docker-compose.yml ps
```

### Fast diagnosis by log text

| Log text | Likely cause | Next step |
|---|---|---|
| `password authentication failed` | Existing Postgres volume was initialized with a different password | Fresh install: `docker compose -f deploy/self-host/docker-compose.yml down -v` and retry |
| `Connection refused` on port `5432` | PostgreSQL not ready yet | Wait 30-60 seconds and retry |
| `relation ... already exists` | Setup/migrations ran before | Usually harmless; verify whether setup continues |
| `ECONNREFUSED redis` or `redis://...` failure | Redis not ready yet | Retry after Docker fully settles |
| `JWT_SECRET environment variable is not set` | Old setup/runtime secret handoff bug | Update images and retry from a clean `down -v` if the install is supposed to be new |
| `Startup config invalid. BULLBOARD_ADMIN_TOKEN` | Old self-host setup did not generate the Bull Board token | Update images and retry from a clean `down -v` if the install is supposed to be new |
| missing env var / config error | Broken or partial config | Regenerate config or review `.env` values |

## Validated Local Test Flow

This flow was validated on Windows 11 using Docker Desktop, WSL2, and the checked-in `deploy/self-host` compose stack.

1. Ensure Docker Desktop is fully started and unpaused.
2. Create `deploy/self-host/.env` from `deploy/self-host/.env.example`.
3. For local testing, use:

```bash
INSTANCE_DOMAIN=localhost
ADMIN_EMAIL=admin@localhost
ADMIN_USERNAME=admin
ADMIN_PASSWORD=LocalTestPass123!
DB_PASSWORD=local-db-pass-2026
TLS_MODE=internal
HTTP_PORT=8080
HTTPS_PORT=8443
```

4. Start the stack:

```bash
docker compose -f deploy/self-host/docker-compose.yml up -d
```

5. Confirm setup completed:

```bash
docker compose -f deploy/self-host/docker-compose.yml logs setup
```

Expected setup output includes:

- `Generated JWT secrets.`
- `Generated MFA encryption key.`
- `Generated Bull Board admin token.`
- `Instance keypair generated.`
- `Admin account created.`

6. Confirm containers are healthy:

```bash
docker compose -f deploy/self-host/docker-compose.yml ps -a
```

Expected state:

- `setup` exited `0`
- `postgres` healthy
- `redis` healthy
- `api` healthy
- `web` up
- `caddy` up

7. Verify the local endpoints:

```bash
curl -k https://localhost:8443/health
curl -k -I https://localhost:8443/app/login
curl -I http://localhost:8080
```

Expected results:

- `/health` returns JSON with `"status":"ok"`
- `/app/login` returns `HTTP/1.1 200 OK`
- `http://localhost:8080` redirects to HTTPS

## Support Validation Checklist

When reproducing or supporting a self-host issue, use this order:

1. Confirm Docker Desktop is fully started.
2. Confirm containers exist and their state:

```bash
docker ps -a
```

3. Check setup container logs first:

```bash
docker logs gratonite-setup --tail 120
```

4. Check PostgreSQL and Redis logs if setup failed:

```bash
docker logs gratonite-postgres --tail 120
docker logs gratonite-redis --tail 120
```

5. If the install is meant to be a fresh install and auth or migration state looks corrupted, remove the old volumes and retry:

```bash
docker compose -f deploy/self-host/docker-compose.yml down -v
docker compose -f deploy/self-host/docker-compose.yml up -d
```

6. After recovery, verify:

```bash
docker compose -f deploy/self-host/docker-compose.yml ps
curl -k https://localhost:8443/health
```

Expected outcome:

- `setup` exits successfully
- `postgres`, `redis`, `api`, `web`, and `caddy` are up
- local HTTPS comes up on `https://localhost:8443`

## Checking Logs

View logs for all services:

```bash
cd ~/gratonite
docker compose logs -f
```

View logs for a specific service:

```bash
docker compose logs -f api       # API server
docker compose logs -f postgres  # Database
docker compose logs -f caddy     # Reverse proxy / TLS
docker compose logs -f setup     # Migrations and first-run setup
docker compose logs -f redis     # Cache
docker compose logs -f relay     # Federation relay connection
```

Add `--tail 100` to see only the last 100 lines:

```bash
docker compose logs -f --tail 100 api
```

## Viewing Container Status

```bash
cd ~/gratonite
docker compose ps
```

This shows all containers, their status, and exposed ports. Healthy output looks like:

```
NAME                STATUS
gratonite-api       Up 2 hours
gratonite-postgres  Up 2 hours
gratonite-redis     Up 2 hours
gratonite-caddy     Up 2 hours
```

If a container shows `Restarting` or `Exit`, check its logs for the error.

## Resetting Everything

To completely wipe your instance and start fresh (this deletes all data):

```bash
cd ~/gratonite
docker compose down -v
```

The `-v` flag removes all Docker volumes, including the database. After this, re-run the installer or `docker compose up -d` to start fresh.

## Getting Help

If your issue is not listed here, check the [GitHub Discussions](https://github.com/CoodayeA/Gratonite/discussions) or open an issue at [github.com/CoodayeA/Gratonite/issues](https://github.com/CoodayeA/Gratonite/issues).
