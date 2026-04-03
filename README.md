<div align="center">

# Gratonite

**A privacy-first, open-source alternative to Discord.**

Real-time chat, voice, video, federation, and 140+ features — fully self-hostable.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/CoodayeA/Gratonite?style=social)](https://github.com/CoodayeA/Gratonite)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fgratonite.chat&label=gratonite.chat)](https://gratonite.chat)

**[Try It](https://gratonite.chat/app)** · **[Self-Host](https://gratonite.chat/deploy)** · **[Download](https://gratonite.chat/download)** · **[Federation Docs](https://gratonite.chat/federation)**

</div>

---

## Contributing

**Documentation index:** [`docs/README.md`](docs/README.md). **CI, deployment, and engineering conventions:** [`DEVELOPMENT.md`](DEVELOPMENT.md).

---

> Your server, your rules. No ads, no tracking, no phone number required.

## What is Gratonite?

Gratonite is a community platform for people who want control over their online spaces. Text, voice, video, threads, bots, moderation — plus federation so independent instances can communicate, a relay network for NAT traversal, and end-to-end encryption for DMs.

### Self-Host in One Command

```bash
curl -fsSL https://gratonite.chat/install | bash
```

Or download the [Gratonite Server](https://github.com/CoodayeA/Gratonite/releases/tag/server-v0.1.2) desktop app — one click, no terminal needed. Available for macOS, Windows, and Linux.

## At a Glance

| | |
|---|---|
| **140** database schemas | **134** API route modules |
| **70+** frontend pages | **50+** mobile screens |
| **23** background jobs | **5 apps** in one monorepo |

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
- Message reminders
- Polls with multiple choice and expiry
- Global search (PostgreSQL full-text)

### Voice and Video
- LiveKit-powered voice and video channels
- Screen sharing
- Stage channels for presentations
- Voice effects and soundboard
- Music rooms and study rooms (co-working)
- Watch parties (synchronized video)
- Collaborative playlists
- Call history
- Clips (short recordings)

### Guilds and Community
- Guild creation with custom icons, banners, accent colors
- Role-based permissions with per-channel overrides
- Invite links with expiry and usage limits
- Public server discovery with interest tags and ratings
- 9 channel types: text, voice, forum, announcement, wiki, Q&A, stage, confession, task (Kanban)
- Server templates, vanity URLs, welcome screens
- Server folders and favorite channels
- Guild timeline, digest, insights, and analytics
- Onboarding wizard for new members
- Photo albums, mood boards, whiteboards
- Guild forms, quests, workflows
- Server boosts
- Confession boards

### Moderation and Safety
- Audit logs for all administrative actions
- AutoMod with keyword filtering and configurable actions (block/delete/warn)
- User timeouts, temp bans, permanent bans
- Ban appeals system
- Raid protection mode
- Slow mode per channel
- Member screening and server rules gate
- Starboard for community highlights
- Reaction roles and auto-roles
- Ticket system for support
- Moderation dashboard
- GDPR-compliant account deletion and data export

### Encryption and Privacy
- End-to-end encryption for all DMs and group DMs (AES-GCM-256 via ECDH P-256)
- One-click enable per conversation — no setup or key management
- Private keys stored in IndexedDB, never transmitted
- Group key rotation on membership changes
- Identity verification via safety numbers
- Encryption failure warnings when enabled

### Federation
- **Federation addresses**: Every user gets `@username@domain` — your portable identity across the network
- **Login with Gratonite**: Users from gratonite.chat can log into any self-hosted instance with one click (OAuth2 SSO)
- **Trust & Safety tiers**: New → Trusted (72h + 10 members) → Verified (manual review). Guilds only appear in Discover after verification
- **Discover badges**: Official (hub guilds), Verified (green checkmark), Community (approved external)
- **Abuse reporting**: Users report instances, 3+ reports auto-suspends pending review
- **Protocol**: HTTP Signatures with Ed25519 keys
- **Inbox handlers**: GuildJoinRequest, MessageCreate, GuildLeave, UserProfileSync, VoiceJoinRequest
- **Shadow users**: Remote members represented locally with deterministic usernames
- **Account portability**: Export/import profiles, settings, relationships between instances
- **Guild discovery**: Federated servers appear in the Discover directory after trust review
- **Relay network**: E2E encrypted envelope routing for instances behind NAT
  - Traffic-padded envelopes (4KB/16KB/64KB buckets) prevent content-size analysis
  - Relay mesh with bloom filter routing (max 2-hop chain)
  - Relay reputation scoring (uptime, delivery rate, latency, age, reports)
  - Auto-discovery and relay selection by score
- **Voice federation**: Relay-mediated LiveKit token exchange with TURN proxy fallback
- **Zero breaking changes**: All federation features are opt-in

### User Features
- Profiles with display names, bios, banners, custom nameplate styles
- Custom status with emoji, rich presence, status presets
- Friend system with requests, blocking, and suggestions
- Friendship streaks
- User notes (private, per-user)
- XP and leveling system with per-server leaderboards
- Achievements and badge collection
- FAME system (give/receive fame, leaderboards, daily limits)
- Notification preferences per channel
- Web push notifications and email digest
- Session management (view/revoke)
- Connected accounts
- Activity feed
- Profile showcase and vanity profiles
- Greeting cards
- Interest tags

### Economy and Gamification
- Virtual currency with server-specific currencies
- Cosmetics shop (avatar frames, nameplates, effects, decorations)
- User marketplace and auction house
- Inventory system
- Collectible cards (gacha) with trading
- Daily challenges with rewards
- Giveaways with automatic winner selection
- Guild quests
- Seasonal events
- Server boosts with perks
- Reputation system
- Quizzes
- User titles

### Creative and Productivity
- Whiteboards for collaborative drawing
- Mood boards
- Photo albums
- Wiki channels for persistent documentation
- Form builder for applications and surveys
- Task boards (Kanban per channel)
- Calendar and meeting scheduler
- Todo lists
- Standup (team check-ins)
- Message reminders
- Theme builder with visual customization
- Theme store for community themes

### Bots and Integrations
- Bot store with discoverable bots
- Bot builder for custom bots
- Slash commands (Discord-compatible)
- Message components (buttons, select menus)
- Webhooks with delivery logs and auditing
- OAuth2 authorization flow
- Referral system

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
| Real-money payments | Not enabled (in-game currency only) |
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
The installer handles everything: Docker setup, secret generation, TLS certificates, federation. Works on Mac, Linux, Windows (WSL).

**Option B: Desktop app** — [Download Gratonite Server](https://github.com/CoodayeA/Gratonite/releases/tag/server-v0.1.2)
Double-click to run. No terminal needed. Available for macOS (.dmg), Windows (.exe/.msi), and Linux (.deb/.rpm/.AppImage).

**Option C: Manual setup**
```bash
cd deploy/self-host
cp .env.example .env    # edit domain, password, etc.
docker compose up -d
```

**Federation is on by default** — your instance connects to the relay network automatically. No ports to open, works behind NAT. Your guilds appear in Discover after 48 hours.

**Enable voice/video** with LiveKit:
```bash
docker compose --profile voice up -d
```

**Manage and edit your self-hosted instance**:
```bash
cd ~/gratonite
nano .env
docker compose restart
```

**Collect a support bundle if setup or startup fails**:
```bash
cd ~/gratonite
bash ./collect-logs.sh
```

PowerShell:
```powershell
Set-Location "$HOME\gratonite"
pwsh ./collect-logs.ps1
```

Full guide: [docs/self-hosting.md](docs/self-hosting.md) | Deploy page: [gratonite.chat/deploy](https://gratonite.chat/deploy)

### Running a Relay Node

Help the federation network by running a relay (256MB RAM, 1 vCPU):

```bash
cd apps/relay
cp .env.example .env    # set RELAY_DOMAIN, REDIS_URL
docker compose up -d
```

Full guide: [docs/relay/README.md](docs/relay/README.md)

---

## Federation

Gratonite instances can federate — users on one instance can join guilds on another, send messages, and even join voice channels across instances.

### How It Works

1. **Discovery**: Instances expose `/.well-known/gratonite` with their public key and endpoints
2. **Authentication**: All instance-to-instance requests use Ed25519 HTTP Signatures
3. **Delivery**: Activities are sent directly via HTTP POST, or through the relay network if the target is behind NAT
4. **Encryption**: Relay traffic is E2E encrypted (X25519 ECDH + AES-256-GCM) with traffic-padded envelopes
5. **Voice**: Federated voice uses relay-mediated LiveKit token exchange

### Relay Network

The relay network connects instances that can't reach each other directly:
- Relays forward encrypted envelopes — they never see message content
- Fixed-size envelope padding prevents traffic analysis
- Relay mesh with bloom filter routing enables cross-relay delivery
- Reputation scoring keeps bad relays out of the directory
- Optional TURN proxy for federated voice NAT traversal

Protocol reference: [docs/federation/README.md](docs/federation/README.md)

---

## End-to-End Encryption

All DMs and group DMs are end-to-end encrypted by default.

- **Key agreement**: ECDH on P-256 (NIST curve)
- **Symmetric encryption**: AES-GCM with 256-bit keys, unique 12-byte IV per message
- **Key storage**: Browser IndexedDB (private keys never leave your device)
- **Group DMs**: Symmetric group key, wrapped per-member via ephemeral ECDH
- **Key rotation**: Automatic on membership change; key versioning for backward compatibility
- **Identity verification**: Safety numbers (SHA-256 hash of combined public keys, displayed as 60-digit grid)

| Content | Encrypted? |
|---|---|
| DM text messages | Yes (AES-GCM-256) |
| Group DM text messages | Yes (AES-GCM-256) |
| Edited messages | Yes (re-encrypted) |
| Guild channel messages | No |
| Federated relay traffic | Yes (X25519 + AES-256-GCM) |
| Voice/video | Encrypted by LiveKit (DTLS-SRTP) |
| Notification previews | Shows "Encrypted message" |

---

## Background Jobs

23 BullMQ queues handle automated tasks:

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

## Why Gratonite?

- No phone number required to join
- No ad-driven engagement loops
- No premium paywall on basic features
- Privacy-first with automatic E2E encryption
- Fully open source and self-hostable
- Federation connects independent instances into one network
- Relay network works behind NAT — no port forwarding needed

---

## Contributing

Contributions are welcome! Please open an issue to discuss your idea before submitting a pull request. See the [development setup](#development) above to get started locally.

## Security

If you discover a security vulnerability, please report it responsibly. Email **security@gratonite.chat** with details — do not open a public issue. We aim to acknowledge reports within 48 hours.

---

## Links

- Website: [gratonite.chat](https://gratonite.chat)
- Self-Host: [gratonite.chat/deploy](https://gratonite.chat/deploy) | [Installer](https://gratonite.chat/install) | [Desktop App](https://github.com/CoodayeA/Gratonite/releases/tag/server-v0.1.2)
- Federation: [gratonite.chat/federation](https://gratonite.chat/federation)
- Self-Hosting Docs: [docs/self-hosting.md](docs/self-hosting.md)
- Relay Operator Guide: [docs/relay](docs/relay/README.md)
- Repository: [CoodayeA/Gratonite](https://github.com/CoodayeA/Gratonite)
- Organization: [Gratonite-Labs](https://github.com/Gratonite-Labs)

## License

[AGPL-3.0](LICENSE) — free to use, modify, and self-host. Network use counts as distribution.
