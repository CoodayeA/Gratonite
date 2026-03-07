# Gratonite

Gratonite is a multi-platform community chat app built as a privacy-first, open-source alternative to Discord. The project includes web, mobile, desktop, landing, and API apps in a single repository, with real-time messaging, guilds, DMs, threads, voice, moderation tooling, and community-facing features like discovery and events.

## What Gratonite includes

- Real-time text chat for guild channels, DMs, and threads
- Voice and video powered by LiveKit
- Guild management, roles, invites, moderation, audit logs, and word filters
- Public community discovery and scheduled events
- Web client, mobile client, desktop wrapper, marketing site, and backend API

## Repository layout

- `apps/api`: Express + TypeScript API, Socket.IO, Drizzle, PostgreSQL, Redis, LiveKit integration
- `apps/web`: React + Vite web client
- `apps/mobile`: Expo / React Native mobile app
- `apps/desktop`: Electron desktop wrapper
- `apps/landing`: Next.js marketing site and content
- `docs`: deployment notes, release gates, migration records, and operational references
- `tools`: release verification and guard scripts

## Tech stack

- Frontend: React, TypeScript, Vite
- Mobile: Expo, React Native
- Desktop: Electron
- Backend: Node.js, Express, TypeScript
- Data: PostgreSQL, Drizzle ORM, Redis
- Realtime: Socket.IO, LiveKit
- Deployment: Docker Compose and GitHub Actions

## Getting started

Gratonite is currently organized as app-level projects rather than a single workspace install, so setup is done per app.

### API

```bash
cd apps/api
pnpm install
pnpm run db:migrate
pnpm run dev
```

### Web

```bash
cd apps/web
npm install
npm run dev
```

### Landing site

```bash
cd apps/landing
npm install
npm run dev
```

### Mobile

```bash
cd apps/mobile
npm install
npm run start
```

### Desktop

```bash
cd apps/desktop
npm install
npm run dev
```

## Local services

The project expects supporting services for full development and release verification:

- PostgreSQL
- Redis
- LiveKit

Deployment and environment notes live in [`docs/DEPLOY-TO-OWN-SERVER.md`](/Volumes/Project%20BUS/GratoniteFinalForm/docs/DEPLOY-TO-OWN-SERVER.md), [`docs/DEPLOY-TO-HETZNER.md`](/Volumes/Project%20BUS/GratoniteFinalForm/docs/DEPLOY-TO-HETZNER.md), and [`docs/release-runbook.md`](/Volumes/Project%20BUS/GratoniteFinalForm/docs/release-runbook.md).

## Verification

Top-level release verification is available from the repository root:

```bash
npm run verify:release:all
```

There is also a stronger launch gate:

```bash
npm run verify:launch:super-gate
```

## Why this project exists

Gratonite is being built around a simple product thesis:

- no phone-number gate just to join communities
- no ad-driven engagement loop
- no premium paywall around basic social features
- a better default for friends, groups, guilds, and online communities

## Links

- Product site: [gratonite.chat](https://gratonite.chat)
- GitHub profile: [CoodayeA](https://github.com/CoodayeA)

