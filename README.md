# Gratonite

A privacy-first, open-source alternative to Discord. Real-time chat, voice, video, federation, and 140+ features across web, mobile, and desktop — all self-hostable in 5 minutes.

> Your server, your rules. No ads, no tracking, no phone number required.

## What is Gratonite?

Gratonite is a community platform built for people who want control over their online spaces. It's everything you'd expect from a modern chat app — text, voice, video, threads, bots, moderation — plus federation so independent instances can talk to each other, a relay network for NAT traversal, and end-to-end encryption for DMs.

**[Try it](https://gratonite.chat/app)** | **[Self-Host](https://gratonite.chat/docs/self-hosting)** | **[Download](https://gratonite.chat/download)**

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
- Automatic — no toggle needed
- Private keys stored in IndexedDB, never transmitted
- Group key rotation on membership changes
- Identity verification via safety numbers
- Encryption failure warnings (never silently falls back to plaintext)
- Key versioning for backward-compatible decryption

### Federation
- **Protocol**: HTTP Signatures with Ed25519 keys
- **Inbox handlers**: GuildJoinRequest, MessageCreate, GuildLeave, UserProfileSync, VoiceJoinRequest
- **Shadow users**: Remote members represented locally with deterministic usernames
- **Account portability**: Export/import profiles, settings, relationships between instances
- **Guild discovery**: Federated servers appear in the Discover directory
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
- Theme builder with custom CSS
- Theme store for community themes

### Bots and Integrations
- Bot store with discoverable bots
- Bot builder for custom bots
- Slash commands (Discord-compatible)
- Message components (buttons, select menus)
- Webhooks with delivery logs and auditing
- OAuth2 authorization flow
- Stripe payment integration
- Referral system

### Security
- JWT authentication with refresh tokens
- Argon2id password hashing
- TOTP-based two-factor authentication
- HTTP security headers (Helmet.js: HSTS, CSP, X-Frame-Options)
- 6 configurable rate limiters (auth, API, global, etc.)
- Zod request validation on all endpoints
- File upload validation (MIME type + magic bytes)
- CORS configuration
- Federation HTTP signatures (Ed25519)
- SSRF protection on federation handshake

---

## Repository Layout

```
apps/
  api/       Express + TypeScript backend (PostgreSQL, Redis, Socket.IO, LiveKit)
  web/       React + Vite web client
  mobile/    Expo / React Native (iOS + Android)
  desktop/   Electron wrapper
  landing/   Next.js marketing site
  relay/     Standalone federation relay server
deploy/      Docker Compose, Caddyfile, self-host configs
docs/        Self-hosting, relay operator, and federation protocol guides
packages/    Shared TypeScript types
tools/       Release verification scripts
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Framer Motion |
| Mobile | Expo, React Native |
| Desktop | Electron |
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
| Payments | Stripe |
| Metrics | Prometheus |
| Email | Nodemailer |
| Landing | Next.js |
| Deploy | Docker Compose, Caddy, GitHub Actions |

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

### Self-Hosting (5 Minutes)

```bash
git clone https://github.com/CoodayeA/Gratonite.git
cd Gratonite/deploy/self-host
cp .env.example .env
nano .env               # set INSTANCE_DOMAIN, DB_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d
```

Open `https://your-domain.com` and log in. That's it.

**Behind NAT / no port forwarding?** Use Cloudflare Tunnel:
```bash
# Add to .env:
CLOUDFLARE_TUNNEL_TOKEN=your-token
# Start with tunnel profile:
docker compose --profile tunnel up -d
```

**Enable federation** to connect with other instances:
```bash
# Add to .env:
FEDERATION_ENABLED=true
RELAY_ENABLED=true      # for relay network (NAT traversal)
# Restart:
docker compose restart api
```

**Enable voice/video** with LiveKit:
```bash
docker compose --profile voice up -d
```

Full guide: [docs/self-hosting/README.md](docs/self-hosting/README.md)

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

## Why Gratonite

- No phone number required to join
- No ad-driven engagement loops
- No premium paywall on basic features
- Privacy-first with automatic E2E encryption
- Fully open source and self-hostable
- Federation connects independent instances into one network
- Relay network works behind NAT — no port forwarding needed

## Links

- Website: [gratonite.chat](https://gratonite.chat)
- Self-Hosting Guide: [docs/self-hosting](docs/self-hosting/README.md)
- Relay Operator Guide: [docs/relay](docs/relay/README.md)
- Federation Protocol: [docs/federation](docs/federation/README.md)
- Repository: [CoodayeA/Gratonite](https://github.com/CoodayeA/Gratonite)
- Organization: [Gratonite-Labs](https://github.com/Gratonite-Labs)

## License

Open source. See [LICENSE](LICENSE) for details.
