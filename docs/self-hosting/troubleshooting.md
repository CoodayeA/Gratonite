# Troubleshooting

Common issues and their fixes when self-hosting Gratonite.

---

## Common Issues

| Problem | Cause | Fix |
|---|---|---|
| Caddy can't get TLS certificate | DNS not pointing to your server, or ports 80/443 blocked by firewall | Verify your A record points to the server IP (`dig +short your-domain.com`). Open ports 80 and 443 inbound. |
| Setup fails on migrations | PostgreSQL container not ready yet | Check logs with `docker compose logs setup`. Wait 10-15 seconds and retry: `docker compose up setup`. |
| API crashes with JWT_SECRET error | Secret values not generated or missing from `.env` | Re-run the installer, or manually add a random 64-character hex string as `JWT_SECRET` and `JWT_REFRESH_SECRET` in `.env`. |
| API crashes with LiveKit error | LiveKit environment variables partially set | Either remove all `LIVEKIT_*` variables from `.env` (disables voice) or set all three: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. |
| Can't connect to relay | Firewall blocking outbound WSS connections | Allow outbound traffic on port 443. The relay connection is outbound only. |
| Browser shows security warning | Self-signed certificate in local mode | This is normal for local installations. Click **Advanced** then **Proceed to localhost**. |
| Federation not working | Federation disabled or relay unreachable | Check that `FEDERATION_ENABLED=true` in `.env`. Verify outbound port 443 is open. Check relay logs: `docker compose logs relay`. |
| "Federation not initialized" error | Federation database tables missing | Re-run the setup container: `docker compose up setup`. It will apply missing migrations. |
| High memory usage | Default PostgreSQL/Redis memory settings too generous | Tune resource limits in `docker-compose.yml` under the `postgres` and `redis` services. For a 2 GB server, add `shm_size: 128mb` to postgres and `--maxmemory 256mb` to redis command. |
| Cannot log in after install | Admin credentials lost or mistyped | Check `~/gratonite/.env` for `ADMIN_USERNAME` and `ADMIN_PASSWORD`. These are only used on first run to create the account. |
| Emails not sending | SMTP not configured | Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in `.env`. Email features are optional. |

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
