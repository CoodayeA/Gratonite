# Deploy Artifact Hygiene

Gratonite production deploys are built from source apps, not from committed package output.

`deploy/deploy.sh` recreates these generated directories on every run:

- `deploy/api`
- `deploy/web/dist`
- `deploy/landing`

These paths are ignored so local production packaging does not pollute normal development status. The source of truth remains:

- API source and migrations in `apps/api`
- Web source in `apps/web`
- Landing source in `apps/landing`
- Production orchestration files in `deploy/`

## Ownership map

| Deploy path | Owner | Rule |
| --- | --- | --- |
| `deploy/api/drizzle/**` | `apps/api/drizzle/**` | Production migration history is mirrored from the API source tree and may stay tracked until migration ownership moves. |
| `deploy/api/drizzle.config.ts` | `apps/api/drizzle.config.ts` | Must stay byte-for-byte identical to the API source file. |
| `deploy/api/package.json` | `apps/api/package.json` | Tracked mirror only; deploy packaging rewrites from the API source tree on every deploy. |
| `deploy/api/pnpm-lock.yaml` | `apps/api/pnpm-lock.yaml` | Tracked mirror only; must match API ownership exactly. |
| `deploy/web/dist/**` | `apps/web/**` | Never commit generated web output. |
| `deploy/landing/**` | `apps/landing/**` | Never commit generated landing export output. |

## Enforcement

Run this before shipping or after touching deploy packaging:

```bash
pnpm verify:deploy:artifacts
```

The enforcement script fails when:

- deploy staging directories stop being ignored in `.gitignore`
- new tracked artifacts appear under `deploy/web/dist` or `deploy/landing`
- tracked `deploy/api` mirrors drift away from their owning `apps/api` files

Do **not** treat `deploy/api/drizzle/` as disposable generated output unless and until migration ownership is explicitly moved elsewhere. If that directory still contains the canonical production migration history, it must be preserved while any generated package artifacts are cleaned up.
