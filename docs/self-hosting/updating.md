# Updating Your Instance

Updates are published as new Docker images. Updating takes less than a minute with no data loss.

---

## Update Process

```bash
cd ~/gratonite
docker compose pull
docker compose up -d
```

That's it. Docker pulls the latest images and restarts the containers. The **setup** container automatically runs any pending database migrations on startup, so your schema is always up to date.

## Verify the Update

After updating, check that the API is healthy:

```bash
docker compose exec api wget -qO- http://localhost:4000/health
```

A healthy response looks like:

```json
{"status":"ok"}
```

You can also check that all containers are running:

```bash
docker compose ps
```

All services should show `Up` status.

## Rollback

If an update causes issues, you can roll back to a specific version by pulling a pinned image tag:

```bash
cd ~/gratonite
docker compose down
docker compose pull ghcr.io/coodayea/gratonite-api:sha-<commit>
docker compose up -d
```

Replace `sha-<commit>` with the Git commit SHA of the version you want to roll back to.

## Staying Informed

Check [github.com/CoodayeA/Gratonite/releases](https://github.com/CoodayeA/Gratonite/releases) for release notes before updating. Breaking changes, if any, are called out at the top of the release notes with migration instructions.
