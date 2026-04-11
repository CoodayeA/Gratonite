# Gratonite Server

`apps/server` is the Tauri desktop app for running a self-hosted Gratonite instance.

It is a lightweight operator-facing app that helps people start and manage the Docker-based self-host stack without using the terminal directly.

## What It Is For

- local or home-server self-hosting
- guided setup for Docker-based Gratonite hosting
- packaging the self-host experience for macOS, Windows, and Linux

## Tech Stack

- Tauri v2
- React
- TypeScript
- Vite

## Local Development

```bash
cd apps/server
npm install
npm run dev
```

## Build

```bash
cd apps/server
npm run build
```

## Release Flow

- version comes from `apps/server/package.json`
- release tags use the format `server-v*`
- GitHub Actions workflow: `.github/workflows/server-release.yml`
- published artifacts are the Gratonite Server desktop downloads for macOS, Windows, and Linux

## Related Docs

- [`../../README.md`](../../README.md) — repo overview
- [`../../docs/self-hosting.md`](../../docs/self-hosting.md) — self-hosting overview
- [`../../deploy/self-host/README.md`](../../deploy/self-host/README.md) — self-host compose notes
