<div align="center">

# Gratonite

**Your community platform. You own it.**

Real-time chat, voice, video, E2E encryption, and federation — fully self-hostable, forever free, no phone number required.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/CoodayeA/Gratonite?style=social)](https://github.com/CoodayeA/Gratonite)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fgratonite.chat&label=gratonite.chat)](https://gratonite.chat)

**[Try It](https://gratonite.chat/app)** · **[Self-Host](https://gratonite.chat/deploy)** · **[Download](https://gratonite.chat/download)** · **[Federation Docs](https://gratonite.chat/federation)**

</div>

---

> Your server, your rules. No ads, no tracking, no phone number required.

## What is Gratonite?

Gratonite is a community platform built for people who don't want some corporation owning their conversations. Text, voice, video, threads, bots, moderation, economy, games — and end-to-end encryption that just works, automatically. Run it yourself in one command, or use [gratonite.chat](https://gratonite.chat). Either way, your data stays yours.

### Self-Host in One Command

```bash
curl -fsSL https://gratonite.chat/install | bash
```

Or download the [Gratonite Server](https://gratonite.chat/download) desktop app — one click, no terminal needed. Available for macOS, Windows, and Linux.

## At a Glance

| | |
|---|---|
| **140** database schemas | **134** API route modules |
| **70+** frontend pages | **50+** mobile screens |
| **23** background jobs | **7 app surfaces** in one monorepo |

---

## Why Gratonite?

- **It's yours.** Self-host in minutes. Your data lives on your hardware.
- **Automatic E2E encryption.** Every DM is encrypted before it leaves your device — no toggle, no setup, no opt-in.
- **Federation.** Independent instances connect into a network. Your community isn't locked behind one server.
- **No paywalled basics.** Voice, video, threads, moderation — all free, all open source.
- **No phone number.** Sign up with just a username and password.
- **No engagement loops.** No algorithmic feed, no notification spam, no dark patterns.

---

## Features

### Messaging
- Real-time text in guild channels, DMs, group DMs, and threads
- Message editing with full revision history
- Replies, forwarding, pinning, sticky messages
- Emoji reactions, custom emoji, stickers, text reactions
- Typing indicators and read receipts
- Disappearing messages with configurable timers
- Scheduled messages and draft auto-save
- Message bookmarks with folder organization
- Voice messages and inline media player
- Polls, message reminders, clips
- Global search (PostgreSQL full-text) with filters, active-filter chips, and `has:` type badges

### Voice and Video
- LiveKit-powered voice and video channels
- Screen sharing and stage channels
- Music rooms, study rooms (co-working), watch parties
- Collaborative playlists and call history

### Guilds and Community
- Guild creation with custom icons, banners, accent colors
- Role-based permissions with per-channel overrides
- Invite links with expiry and usage limits
- Public server discovery with interest tags and ratings
- 9 channel types: text, voice, forum, announcement, wiki, Q&A, stage, confession, task (Kanban)
- Server templates, vanity URLs, welcome screens
- Guild timeline, digest, insights, and analytics
- Onboarding wizard, photo albums, mood boards, whiteboards, guild forms, quests, workflows
- Server boosts

### Moderation and Safety
- Audit logs, AutoMod with keyword filtering, configurable actions (block/delete/warn)
- User timeouts, temp bans, permanent bans, ban appeals
- Raid protection, slow mode, member screening, server rules gate
- Starboard, reaction roles, auto-roles, ticket system
- Moderation dashboard with cross-instance escalation for federated reports
- GDPR-compliant account deletion and data export

### Encryption and Privacy
- **All DMs and group DMs are end-to-end encrypted by default** — no toggle, no setup
- Keys generated in your browser, stored in IndexedDB, never transmitted to the server
- Group key rotation on membership changes
- Identity verification via safety numbers
- E2E encrypted file attachments
- Encryption failure warnings (never silently falls back to plaintext)

### Federation
- **Federation addresses**: Every user gets `@username@domain` — a portable identity across the network
- **Login with Gratonite**: SSO from gratonite.chat into any self-hosted instance
- **Trust & Safety tiers**: New → Trusted (72h + 10 members) → Verified (manual review)
- **Discover badges**: Official, Verified, Community
- **Cross-instance moderation**: Escalate reports to remote instance admins directly from the mod queue
- **RemoteBadge**: Remote-instance indicators on chat, profiles, member lists, and DMs — always know who's from where
- **ConnectInstanceWizard**: 3-step guided flow to federate with a new instance (domain entry → `.well-known` preview → confirm)
- **Protocol**: HTTP Signatures with Ed25519 keys
- **Inbox handlers**: GuildJoinRequest, MessageCreate, GuildLeave, UserProfileSync, VoiceJoinRequest
- **Shadow users**: Remote members represented locally with deterministic usernames
- **Account portability**: Export/import profiles, settings, and relationships between instances
- **Relay network**: E2E encrypted envelope routing for instances behind NAT
  - Traffic-padded envelopes (4KB/16KB/64KB buckets) prevent content-size analysis
  - Relay mesh with bloom filter routing (max 2-hop)
  - Relay reputation scoring and auto-discovery
- **Voice federation**: Relay-mediated LiveKit token exchange with TURN proxy fallback

### User Features
- Profiles with display names, bios, banners, custom nameplate styles
- Custom status with emoji and rich presence
- Friend system with requests, blocking, suggestions, and friendship streaks
- XP, leveling, achievements, badge collection, FAME system
- Notification preferences per channel, web push, and email digest
- Session management, connected accounts, activity feed

### Economy and Gamification
- Virtual currency with server-specific currencies
- Cosmetics shop (avatar frames, nameplates, effects, decorations)
- User marketplace, auction house, inventory
- Collectible cards (gacha) with trading
- Daily challenges, giveaways, seasonal events, guild quests, quizzes, user titles

### Creative and Productivity
- Whiteboards, mood boards, photo albums
- Wiki channels, form builder, task boards (Kanban)
- Calendar, meeting scheduler, todo lists, standup
- Theme builder and theme store

### Bots and Integrations
- Bot store and bot builder
- Slash commands and message components
- Webhooks with delivery logs and auditing
- OAuth2 authorization flow

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Framer Motion |
| Mobile | Expo, React Native |
| Desktop (Chat) | Electron |
| Desktop (Server) | Tauri v2, Rust, bollard (Docker API) |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL, Drizzle ORM (140 tables) |
| Cache | Redis (IoRedis) |
| Real-time | Socket.IO |
| Voice/Video | LiveKit |
| Jobs | BullMQ (23 queues) |
| Auth | JWT, Argon2id, TOTP MFA |
| Encryption | AES-GCM-256, ECDH P-256, Ed25519, X25519 |
| Federation | HTTP Signatures, E2E relay envelopes |
| Search | PostgreSQL full-text |
| Metrics | Prometheus |
| Email | Nodemailer |
| Landing | Next.js |
| Deploy | Docker Compose, Caddy, GitHub Actions |

---

## Repository Layout

```
apps/
  api/       Express + TypeScript backend (PostgreSQL, Redis, Socket.IO, LiveKit)
  web/       React + Vite web client
  mobile/    Expo / React Native (iOS + Android)
  desktop/   Electron chat client
  server/    Tauri self-hosting app (Gratonite Server — manages Docker containers)
  landing/   Next.js marketing site
  relay/     Standalone federation relay server
deploy/      Docker Compose, Caddyfile, installer script, self-host configs
docs/        Self-hosting, relay operator, and federation protocol guides
packages/    Shared TypeScript types
tools/       Release verification scripts
```

---

## Getting Started

### Development

```bash
# API
cd apps/api
cp .env.example .env    # set DB, Redis, SMTP credentials
pnpm install
pnpm run db:migrate
pnpm run dev

# Web
cd apps/web
cp .env.example .env    # set VITE_API_URL
npm install
npm run dev

# Mobile
cd apps/mobile
npm install
npm run start

# Desktop
cd apps/desktop
npm install
npm run dev
```

### Self-Hosting

**Option A: One-click installer** (recommended)
```bash
curl -fsSL https://gratonite.chat/install | bash
```
Handles everything: Docker, secrets, TLS, federation. Works on Mac, Linux, and Windows (WSL).

**Option B: Desktop app** — [Download Gratonite Server](https://gratonite.chat/download)
Double-click to run. No terminal needed. macOS (.dmg), Windows (.exe/.msi), Linux (.deb/.rpm/.AppImage).

**Option C: Manual setup**
```bash
cd deploy/self-host
cp .env.example .env    # edit domain, password, etc.
docker compose up -d
```

**Federation is on by default** — your instance joins the relay network automatically. No port forwarding needed. Guilds appear in Discover after 48 hours.

**Enable voice/video** with LiveKit:
```bash
docker compose --profile voice up -d
```

**Collect a support bundle** if setup fails:
```bash
cd ~/gratonite && bash ./collect-logs.sh
```

Full guide: [docs/self-hosting.md](docs/self-hosting.md) | [gratonite.chat/deploy](https://gratonite.chat/deploy)

### Running a Relay Node

Help the federation network — a relay needs just 256MB RAM and 1 vCPU:

```bash
cd apps/relay
cp .env.example .env    # set RELAY_DOMAIN, REDIS_URL
docker compose up -d
```

Full guide: [docs/relay/README.md](docs/relay/README.md)

---

## Federation

Gratonite instances federate — users on one instance can join guilds on another, send messages, and join voice channels across instances.

### How It Works

1. **Discovery**: Instances expose `/.well-known/gratonite` with their public key and endpoints
2. **Authentication**: All instance-to-instance requests use Ed25519 HTTP Signatures
3. **Delivery**: Activities go directly via HTTP POST, or through the relay network if the target is behind NAT
4. **Encryption**: Relay traffic is E2E encrypted (X25519 ECDH + AES-256-GCM) with traffic-padded envelopes
5. **Voice**: Federated voice uses relay-mediated LiveKit token exchange

Protocol reference: [docs/federation/README.md](docs/federation/README.md)

---

## End-to-End Encryption

All DMs and group DMs are end-to-end encrypted automatically.

- **Key agreement**: ECDH on P-256 (NIST curve)
- **Symmetric encryption**: AES-GCM with 256-bit keys, unique 12-byte IV per message
- **Key storage**: Browser IndexedDB — private keys never leave your device
- **Group DMs**: Symmetric group key, wrapped per-member via ephemeral ECDH
- **Key rotation**: Automatic on membership change; key versioning for backward compatibility
- **Identity verification**: Safety numbers (SHA-256 hash of combined public keys, 60-digit grid)

| Content | Encrypted? |
|---|---|
| DM text messages | ✅ AES-GCM-256 (automatic) |
| Group DM text messages | ✅ AES-GCM-256 (automatic) |
| DM file attachments | ✅ AES-GCM-256 |
| Edited messages | ✅ Re-encrypted on edit |
| Guild channel messages | ❌ Server-side only |
| Federated relay traffic | ✅ X25519 + AES-256-GCM |
| Voice/video | ✅ LiveKit DTLS-SRTP |
| Notification previews | Shows "Encrypted message" |

---

## Background Jobs

23 BullMQ queues keep everything running:

| Job | Interval | Purpose |
|---|---|---|
| Scheduled messages | 30s | Send messages at scheduled times |
| Federation delivery | 10s | Deliver outbound federation activities |
| Federation heartbeat | 5min | Ping connected instances |
| Federation discover sync | 30min | Register with Discover directory |
| Federation cleanup | 24h | Purge old delivered/dead activities |
| Relay directory sync | 30min | Sync relay directory |
| Relay health check | 60s | Check relay availability |
| Relay reputation calc | 5min | Recalculate relay scores |
| Replica sync | 30s | Sync guild replicas |
| Message expiry | 60s | Delete expired disappearing messages |
| Message reminders | 30s | Fire message reminders |
| Giveaways | 30s | Check giveaway deadlines |
| Auto-roles | 5min | Assign roles to new members |
| Auto-archive channels | 1h | Archive inactive channels |
| AFK mover | 30s | Move idle voice users |
| Expire statuses | 5min | Clear expired custom statuses |
| Unban expired | 60s | Lift expired temp bans |
| Email notifications | 15min | Batch email digests |
| Account deletion | 24h | Process deletion requests |
| Friendship streaks | 24h | Update streaks |
| Guild digest | 1h | Generate weekly digests |
| Auctions | 60s | Process auction bids/endings |
| Update check | 6h | Check for new versions |

---

## Updating

```bash
cd Gratonite
git pull
docker compose -f deploy/self-host/docker-compose.yml pull
docker compose -f deploy/self-host/docker-compose.yml up -d
```

Migrations run automatically. Data is preserved.

## Backups

```bash
# Database
docker compose -f deploy/self-host/docker-compose.yml exec postgres \
  pg_dump -U gratonite gratonite | gzip > backup-$(date +%Y%m%d).sql.gz

# Uploads
docker compose -f deploy/self-host/docker-compose.yml cp api:/app/uploads ./uploads-backup
```

---

## Contributing

Contributions are welcome! Open an issue to discuss your idea before submitting a pull request. See [DEVELOPMENT.md](DEVELOPMENT.md) and the [development setup](#development) above to get started locally.

**Documentation index:** [`docs/README.md`](docs/README.md)

## Security

Found a vulnerability? Email **security@gratonite.chat** — do not open a public issue. We aim to acknowledge reports within 48 hours.

---

## Links

- Website: [gratonite.chat](https://gratonite.chat)
- Self-Host: [gratonite.chat/deploy](https://gratonite.chat/deploy) | [Installer](https://gratonite.chat/install) | [Desktop App](https://gratonite.chat/download)
- Federation: [gratonite.chat/federation](https://gratonite.chat/federation)
- Self-Hosting Docs: [docs/self-hosting.md](docs/self-hosting.md)
- Relay Operator Guide: [docs/relay](docs/relay/README.md)
- Repository: [CoodayeA/Gratonite](https://github.com/CoodayeA/Gratonite)
- Organization: [Gratonite-Labs](https://github.com/Gratonite-Labs)

## License

[AGPL-3.0](LICENSE) — free to use, modify, and self-host. Network use counts as distribution.
