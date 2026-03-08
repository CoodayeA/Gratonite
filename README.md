# Gratonite ✨

Gratonite is a multi-platform community chat app built as a privacy-first, open-source alternative to Discord. It includes web, mobile, desktop, and API apps in a single monorepo, with real-time messaging, voice/video, guilds, DMs, threads, moderation, and community features.

> Privacy-first, open source, and built for communities that want more control. 💬

## Features 🚀

### Messaging & Communication 💬
- Real-time text chat in guild channels, DMs, group DMs, and threads
- Voice and video calls powered by LiveKit
- Message editing with full edit history
- Replies, forwarding, and message pinning
- Emoji reactions, custom emoji, and sticker support
- Typing indicators and read receipts
- Disappearing messages with configurable timers
- Scheduled messages and draft auto-save
- Message bookmarks and global search

### Guilds & Community 🌐
- Guild (server) creation with custom icons and banners
- Role-based permissions with per-channel overrides
- Invite links with expiry and usage limits
- Public server discovery with tags
- Scheduled events
- Server templates and vanity URLs
- Forum and announcement channel types
- Server folders and favorites
- Server boost system

### Moderation & Safety 🛡️
- Audit logs for all administrative actions
- Automod with keyword-based filtering
- Word filters with block/delete/warn actions
- User timeouts and temp bans
- Ban appeals system
- Raid protection mode
- Slow mode per channel
- Member screening and server rules gate

### Privacy & Encryption 🔒
- Optional end-to-end encryption for DMs using **ECDH (P-256) key exchange** and **AES-GCM-256** encryption
- Users generate an ECDH keypair client-side; the private key stays in the browser (IndexedDB) and never leaves the device
- Shared secrets are derived on-device from your private key and the recipient's public key
- Group DMs use a shared group key wrapped per-member via ephemeral ECDH
- **Limitations:** No forward secrecy (no per-message key rotation). No key rotation mechanism. Server sees all metadata (who, when, channel). Attachments, voice, and guild channel messages are not encrypted.

### User Features 👤
- User profiles with display names, bios, banners, and custom nameplate styles
- Status, custom status with emoji, and rich presence
- Friend system with friend requests and blocking
- User notes (private, per-user)
- XP and leveling system
- Achievements and badges
- Notification preferences per channel
- Web push notifications
- Session management (view/revoke active sessions)
- GDPR data export

### Platform & Integrations 🔌
- OAuth2 authorization flow for third-party apps
- Webhooks with delivery logs
- Bot application framework with a bot store
- Slash commands
- Stripe payment integration
- Referral system

## Scale 📊

- **76** database schemas
- **65** API route modules
- **47** frontend pages
- **53** React components

## Repository Layout 🗂️

```
apps/
  api/       Express + TypeScript API, Socket.IO, Drizzle ORM, PostgreSQL, Redis, LiveKit
  web/       React + Vite web client
  mobile/    Expo / React Native mobile app
  desktop/   Electron desktop wrapper
  landing/   Next.js marketing site
deploy/      Docker Compose, Caddyfile, deploy script
docs/        Deployment and configuration guides
tools/       Release verification scripts
```

## Tech Stack 🧱

| Layer      | Technology                            |
|------------|---------------------------------------|
| Frontend   | React, TypeScript, Vite               |
| Mobile     | Expo, React Native                    |
| Desktop    | Electron                              |
| Backend    | Node.js, Express, TypeScript          |
| Database   | PostgreSQL, Drizzle ORM               |
| Cache      | Redis                                 |
| Realtime   | Socket.IO                             |
| Voice      | LiveKit                               |
| Deployment | Docker Compose, Caddy, GitHub Actions |

## Getting Started 🛠️

### API

```bash
cd apps/api
cp .env.example .env    # edit with your DB/Redis/SMTP credentials
pnpm install
pnpm run db:migrate
pnpm run dev
```

### Web

```bash
cd apps/web
cp .env.example .env    # set VITE_API_URL
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

## Self-Hosting 🏠

Gratonite can be self-hosted using Docker Compose. See the [Self-Hosting Guide](docs/DEPLOY-TO-OWN-SERVER.md) for full instructions.

Quick version:

```bash
git clone https://github.com/CoodayeA/Gratonite.git
cd Gratonite
cp deploy/.env.example .env   # edit with your config
# build apps/api and apps/web, then:
cd deploy && docker compose -f docker-compose.production.yml up -d
```

More deployment docs:
- [Self-Hosting Guide](docs/DEPLOY-TO-OWN-SERVER.md)
- [VPS Deployment](docs/DEPLOY-TO-HETZNER.md)
- [Quick Deploy Reference](docs/QUICK-DEPLOY-GUIDE.md)
- [DNS Configuration](docs/DNS-CONFIGURATION.md)
- [SMTP Configuration](docs/SMTP-CONFIGURATION.md)

## Why Gratonite 💜

- No phone-number gate to join communities
- No ad-driven engagement loop
- No premium paywall on basic social features
- Privacy-first with optional E2E encryption
- Fully open source and self-hostable

## Links 🔗

- Website: [gratonite.chat](https://gratonite.chat)
- Main repo: [CoodayeA/Gratonite](https://github.com/CoodayeA/Gratonite)
- Organization: [Gratonite-Labs](https://github.com/Gratonite-Labs)
