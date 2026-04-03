# Gratonite Roadmap

Planned direction for Gratonite. Priorities may shift based on community feedback.

## Current Status — v1.0 (March 2026)

Gratonite is production-ready with **140** database schemas, **134** API route modules, **70+** frontend pages, **50+** mobile screens, and **23** background jobs across 5 apps (web, mobile, desktop, API, relay).

### How this roadmap is verified

- **Shipped** items are backed by code in this repository (API routes, web/mobile UI, jobs). They are spot-checked during roadmap reviews; not every bullet has a dedicated automated test.
- **Counts** (schemas, routes, pages) come from repository inventory scripts or manual tallies and may drift slightly between releases — treat as approximate.
- **Near-term / mid-term / long-term** lists are planning intent, not commitments with dates.
- For a finer-grained initiative matrix (search, notifications, federation, operators), see [`docs/roadmap/PRODUCT-PROGRAM.md`](docs/roadmap/PRODUCT-PROGRAM.md).

### Product program — checked off (sync with docs)

Track detailed status in [`docs/roadmap/PRODUCT-PROGRAM.md`](docs/roadmap/PRODUCT-PROGRAM.md) (tables + **Completion log**). Roadmap-level confirmations:

- [x] **Search:** server-wide filters (guild, author, date range, `has:*`, mentions-me) — see *Shipped → Core Platform*
- [x] **Privacy:** GDPR account data export — see *Shipped → Moderation*
- [x] **Email:** transactional-by-default policy + migration defaults — see *Shipped → Email and Notifications*
- [x] **Presence:** scheduled DND window (settings + `dnd_schedules` + job) — covered in product program § Notifications
- [x] **Operator backup entry point:** Admin → Self-host backups → documentation (full one-click / copy UX still 🔶 in product program §6)
- [x] **Notification quiet hours** (user-level: mute alerts + digest email by time window; distinct from DND presence) — see product program § Notifications
- [ ] **Per-guild notification master rules** — 📋 in product program

---

## Shipped

Everything below is live in production.

### Core Platform

- Real-time text chat (channels, DMs, group DMs, threads)
- Voice and video calls (LiveKit)
- Screen sharing and stage channels
- Message editing with full revision history
- Replies, forwarding, pinning, sticky messages
- Emoji reactions, custom emoji, stickers, text reactions
- Typing indicators and read receipts
- Disappearing messages with configurable timers
- Scheduled messages and draft auto-save
- Message bookmarks with folder organization
- Voice messages and inline media player
- Polls, message reminders, clips
- Global search (PostgreSQL full-text) with filters: channel, server (`guildId`), author, date range, `has:file` / `has:image` / `has:embed` / `has:link`, mentions-me

### Guilds and Community

- Guild creation with icons, banners, accent colors
- Role-based permissions with per-channel overrides
- Invite links with expiry and usage limits
- Public server discovery with interest tags and ratings
- 9 channel types (text, voice, forum, announcement, wiki, Q&A, stage, confession, task)
- Server templates, vanity URLs, welcome screens
- Server folders and favorite channels
- Guild timeline, digest, insights, analytics
- Onboarding wizard, photo albums, whiteboards, mood boards
- Guild forms, quests, workflows, confession boards
- Server boosts

### Moderation

- Audit logs, automod, word filters (block/delete/warn)
- User timeouts, temp bans, permanent bans, ban appeals
- Raid protection mode, slow mode
- Member screening and server rules gate
- Starboard, reaction roles, auto-roles
- Ticket system, moderation dashboard
- GDPR-compliant account deletion and data export

### Encryption

- E2E encryption for all DMs and group DMs (ECDH P-256 + AES-GCM-256)
- Automatic — no toggle needed
- Private keys in IndexedDB, never transmitted
- Group key rotation on membership changes
- Identity verification via safety numbers
- Encryption failure warnings (never silently falls back)
- Key versioning for backward-compatible decryption

### Federation

- Federation protocol (HTTP Signatures, Ed25519)
- Instance handshake and discovery (/.well-known/gratonite)
- Inbox handlers: GuildJoinRequest, MessageCreate, GuildLeave, UserProfileSync
- Voice federation: VoiceJoinRequest, VoiceLeave, VoiceStateUpdate
- Shadow users for remote members
- Account portability (export/import between instances)
- Guild discovery directory (federated servers in Discover)
- Instance blocking and trust levels
- Federation admin dashboard

### Relay Network

- Standalone relay server (apps/relay/)
- E2E encrypted envelopes (X25519 ECDH + AES-256-GCM)
- Traffic-padded envelopes (4KB/16KB/64KB buckets)
- Relay mesh with bloom filter routing (max 2-hop)
- Relay reputation scoring and auto-delisting
- Auto-discovery and relay selection by score
- TURN credential proxy for voice NAT traversal
- Prometheus metrics and health endpoint

### Self-Hosting

- One-command Docker deployment with automatic HTTPS
- Setup wizard (web UI for first-time configuration)
- Cloudflare Tunnel support (zero port-forwarding)
- Self-hosting documentation and landing page guides
- Self-hosting CTAs throughout the app (Create Guild, Home, Discover, landing page)

### Economy and Gamification

- Virtual currency with server-specific currencies
- Cosmetics shop (frames, nameplates, effects, decorations)
- User marketplace and auction house
- Collectible cards (gacha) with trading
- XP, leveling, achievements, badges
- FAME system (give/receive, leaderboards)
- Daily challenges, giveaways, seasonal events
- Server boosts, reputation, quizzes, user titles

### Creative and Productivity

- Whiteboards, mood boards, photo albums
- Wiki channels, form builder, task boards (Kanban)
- Calendar, meeting scheduler, todo lists, standup
- Theme builder with custom CSS and theme store
- Music rooms, study rooms, watch parties, collaborative playlists

### Bots and Integrations

- Bot store and bot builder
- Slash commands and message components
- Webhooks with delivery logs
- OAuth2 authorization flow
- Real-money payments (Stripe removed; virtual economy / shop remains)
- Referral system

### Security

- JWT auth with refresh tokens, Argon2id, TOTP 2FA
- HTTP security headers (Helmet.js), CORS, 6 rate limiters
- Zod validation on all endpoints
- File upload validation (MIME + magic bytes)
- Federation HTTP signatures, SSRF protection

### Email and Notifications

- Email verification on signup
- Web push notifications
- Email notification digest (batched)
- Per-channel notification preferences
- Transactional-by-default email policy (marketing-style mail opt-in in settings; migration `0002` for defaults)
- Notification quiet hours (user-level): suppress real-time notification toasts and unread digest email during a schedule; migration `0003` (`notification_quiet_hours` on `user_settings`)

### Internationalization

- i18n framework with locale support (en, es, fr)

### Multi-Platform

- Web (React + Vite)
- Mobile (Expo / React Native, 50+ screens)
- Desktop (Electron)
- Landing site (Next.js)
- Configurable server URL on mobile (connect to any instance)

---

## Near-Term — Q2 2026

- **E2E encrypted file attachments** — Encrypt images, videos, and files before upload so the server never sees plaintext media
- **Forward secrecy (Double Ratchet)** — Signal-style ratchet so compromising a single key doesn't expose past messages
- **Multi-device key sync** — Securely synchronize encryption keys across browsers and devices
- **Mobile app store release** — Publish to App Store and Google Play
- **Accessibility audit** — WCAG 2.1 AA compliance pass across all surfaces
- **Saved searches & search UX polish** — Persisted queries, sidebar entry points, performance on large instances
- **i18n expansion** — Community-contributed locale packs beyond en/es/fr

## Mid-Term — Q3-Q4 2026

- **Voice/video E2E encryption** — Insertable Streams for E2E encrypted WebRTC media
- **Plugin/extension SDK** — Third-party developers can build and distribute plugins
- **Matrix / ActivityPub bridge** — Interop with Matrix rooms and Mastodon/Misskey
- **Tauri migration** — Replace Electron with Tauri for a smaller, faster desktop app
- **Relay operator incentives** — Reputation rewards and visibility for relay operators
- **Federation protocol v2** — Batched activities, partial sync, conflict resolution

## Long-Term — 2027+

- **Peer-to-peer fallback** — Direct device-to-device messaging when the server is unreachable
- **Decentralized identity (DID)** — W3C Decentralized Identifiers for portable, self-sovereign identity
- **Enterprise SSO** — SAML 2.0 and OpenID Connect
- **Offline mode** — Full offline read/compose with automatic sync
- **Federated file storage** — Distributed file hosting across instances
- **WebAssembly encryption** — Move crypto operations to WASM for performance

---

## Contributing

Have a feature idea? Open an issue on [GitHub](https://github.com/CoodayeA/Gratonite/issues) with the `feature-request` label. Pull requests welcome — see the [README](README.md) for setup.