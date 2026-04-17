<div align="center">

# Gratonite

**Open-source community software for people who want their online space to feel like their own.**

Chat, voice, video, self-hosting, end-to-end encrypted DMs, and federation — no ads, no phone-number gate, no paywalled basics.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/CoodayeA/Gratonite?style=social)](https://github.com/CoodayeA/Gratonite)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fgratonite.chat&label=gratonite.chat)](https://gratonite.chat)

**[Try It](https://gratonite.chat/app)** · **[Self-Host](https://gratonite.chat/deploy)** · **[Download](https://gratonite.chat/download)** · **[Docs](docs/README.md)** · **[Federation](https://gratonite.chat/federation)**

</div>

---

> Your server, your rules. No ads, no tracking, no phone number required.

## What is Gratonite?

Gratonite is a community platform for people who want chat to feel like hanging out again, not managing another work app. You can use [gratonite.chat](https://gratonite.chat), or run your own instance in one command. Either way, your community stays yours.

## Why people switch to Gratonite

- **It feels owned, not rented.** Self-host in minutes or use the hosted app without handing your community culture over to a platform.
- **DMs are end-to-end encrypted by default.** Private conversations stay private without toggles, setup, or silent fallback.
- **Federation keeps you connected.** Independent instances can still message, host communities, and join voice together.
- **Core features are included.** Chat, voice, video, moderation, threads, and community tools are not locked behind a subscription.
- **No phone-number gate.** People can join with a username and password.
- **Built for people, not engagement loops.** No ad feed, no dark patterns, no notification casino.

## Get started

### Try it now

- Open the web app: [gratonite.chat/app](https://gratonite.chat/app)
- Download desktop or mobile builds: [gratonite.chat/download](https://gratonite.chat/download)

### Self-host it

```bash
curl -fsSL https://gratonite.chat/install | bash
```

Prefer a GUI? Download **[Gratonite Server](https://gratonite.chat/download)** for macOS, Windows, or Linux and launch your stack without living in a terminal.

Need the full operator docs? Start here:

- [Self-hosting overview](docs/self-hosting.md)
- [Compose quick start](docs/self-hosting/README.md)
- [Relay operator guide](docs/relay/README.md)

### Build locally

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full setup. The main app surfaces live in:

- `apps/api` — Express + TypeScript backend
- `apps/web` — React + Vite web client
- `apps/mobile` — Expo / React Native client
- `apps/desktop` — Electron chat client
- `apps/server` — Tauri self-hosting app
- `apps/landing` — Next.js marketing site

## What Gratonite includes

### Community chat that feels alive

Real-time text channels, DMs, group DMs, threads, voice, video, screen sharing, disappearing messages, reactions, polls, reminders, and search.

### Communities with personality

Guilds, roles, moderation, discovery, templates, whiteboards, task boards, forms, creator-made cosmetics, collectibles, and a built-in marketplace.

### Ownership, privacy, and portability

End-to-end encrypted DMs, federation addresses, relay-backed connectivity for hard-to-reach hosts, account portability, GDPR-aware deletion/export, and self-hosting that does not cut you off from the wider network.

## Privacy and federation

**DMs and group DMs are end-to-end encrypted by default.** Keys are generated on the client, stored locally, and never silently downgraded to plaintext.

**Guild channels are not end-to-end encrypted.** That trade-off is intentional so search, moderation, discovery, and server-side community tooling can work.

**Federation is built in.** Gratonite instances can discover each other, exchange signed activities, route through the relay network when needed, and let people join communities across servers.

Read more:

- [Federation docs](docs/federation/README.md)
- [Relay operator guide](docs/relay/README.md)

## How the repo is organized

```text
apps/
  api/       Express + TypeScript backend
  web/       React + Vite web client
  mobile/    Expo / React Native app
  desktop/   Electron chat client
  server/    Tauri self-hosting app
  landing/   Next.js marketing site
  relay/     Federation relay server
deploy/      Docker Compose, Caddy, installer, self-host configs
docs/        Product, self-hosting, relay, and federation guides
packages/    Shared TypeScript types
tools/       Release verification scripts
```

Gratonite is a full-stack TypeScript monorepo with React clients, a Node/Express backend, PostgreSQL + Redis, LiveKit for voice/video, and a federation layer built around signed activities and encrypted relay transport.

## Contributing

If you want to build with us, start with [CONTRIBUTING.md](CONTRIBUTING.md), then use [DEVELOPMENT.md](DEVELOPMENT.md) and [`docs/README.md`](docs/README.md) to get your bearings.

## Security

Found a vulnerability? Email **security@gratonite.chat**. Please do not open a public issue.

---

## Links

- Website: [gratonite.chat](https://gratonite.chat)
- App: [gratonite.chat/app](https://gratonite.chat/app)
- Download: [gratonite.chat/download](https://gratonite.chat/download)
- Self-host: [gratonite.chat/deploy](https://gratonite.chat/deploy)
- Docs index: [docs/README.md](docs/README.md)
- Repository: [CoodayeA/Gratonite](https://github.com/CoodayeA/Gratonite)
- Organization: [Gratonite-Labs](https://github.com/Gratonite-Labs)

## License

[AGPL-3.0](LICENSE) — free to use, modify, and self-host. Network use counts as distribution.
