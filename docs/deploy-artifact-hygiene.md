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

Some legacy generated files may still be tracked under `deploy/api`. Remove those in one intentional cleanup commit after confirming no release process still depends on them being present before `deploy/deploy.sh` runs. Do not mix that cleanup with feature work or emergency fixes.
