# Gratonite Roadmap

Planned direction for Gratonite. Priorities may shift based on community feedback.

## Current Status — v1.0 (March 2026)

Gratonite is production-ready with **140** database schemas, **134** API route modules, **70+** frontend pages, **50+** mobile screens, and **23** background jobs across 5 apps (web, mobile, desktop, API, relay).

---

## Shipped

Everything below is live in production.

### Core Platform
- [x] Real-time text chat (channels, DMs, group DMs, threads)
- [x] Voice and video calls (LiveKit)
- [x] Screen sharing and stage channels
- [x] Message editing with full revision history
- [x] Replies, forwarding, pinning, sticky messages
- [x] Emoji reactions, custom emoji, stickers, text reactions
- [x] Typing indicators and read receipts
- [x] Disappearing messages with configurable timers
- [x] Scheduled messages and draft auto-save
- [x] Message bookmarks with folder organization
- [x] Voice messages and inline media player
- [x] Polls, message reminders, clips
- [x] Global search (PostgreSQL full-text)

### Guilds and Community
- [x] Guild creation with icons, banners, accent colors
- [x] Role-based permissions with per-channel overrides
- [x] Invite links with expiry and usage limits
- [x] Public server discovery with interest tags and ratings
- [x] 9 channel types (text, voice, forum, announcement, wiki, Q&A, stage, confession, task)
- [x] Server templates, vanity URLs, welcome screens
- [x] Server folders and favorite channels
- [x] Guild timeline, digest, insights, analytics
- [x] Onboarding wizard, photo albums, whiteboards, mood boards
- [x] Guild forms, quests, workflows, confession boards
- [x] Server boosts

### Moderation
- [x] Audit logs, automod, word filters (block/delete/warn)
- [x] User timeouts, temp bans, permanent bans, ban appeals
- [x] Raid protection mode, slow mode
- [x] Member screening and server rules gate
- [x] Starboard, reaction roles, auto-roles
- [x] Ticket system, moderation dashboard
- [x] GDPR-compliant account deletion and data export

### Encryption
- [x] E2E encryption for all DMs and group DMs (ECDH P-256 + AES-GCM-256)
- [x] Automatic — no toggle needed
- [x] Private keys in IndexedDB, never transmitted
- [x] Group key rotation on membership changes
- [x] Identity verification via safety numbers
- [x] Encryption failure warnings (never silently falls back)
- [x] Key versioning for backward-compatible decryption

### Federation
- [x] Federation protocol (HTTP Signatures, Ed25519)
- [x] Instance handshake and discovery (/.well-known/gratonite)
- [x] Inbox handlers: GuildJoinRequest, MessageCreate, GuildLeave, UserProfileSync
- [x] Voice federation: VoiceJoinRequest, VoiceLeave, VoiceStateUpdate
- [x] Shadow users for remote members
- [x] Account portability (export/import between instances)
- [x] Guild discovery directory (federated servers in Discover)
- [x] Instance blocking and trust levels
- [x] Federation admin dashboard

### Relay Network
- [x] Standalone relay server (apps/relay/)
- [x] E2E encrypted envelopes (X25519 ECDH + AES-256-GCM)
- [x] Traffic-padded envelopes (4KB/16KB/64KB buckets)
- [x] Relay mesh with bloom filter routing (max 2-hop)
- [x] Relay reputation scoring and auto-delisting
- [x] Auto-discovery and relay selection by score
- [x] TURN credential proxy for voice NAT traversal
- [x] Prometheus metrics and health endpoint

### Self-Hosting
- [x] One-command Docker deployment with automatic HTTPS
- [x] Setup wizard (web UI for first-time configuration)
- [x] Cloudflare Tunnel support (zero port-forwarding)
- [x] Self-hosting documentation and landing page guides
- [x] Self-hosting CTAs throughout the app (Create Guild, Home, Discover, landing page)

### Economy and Gamification
- [x] Virtual currency with server-specific currencies
- [x] Cosmetics shop (frames, nameplates, effects, decorations)
- [x] User marketplace and auction house
- [x] Collectible cards (gacha) with trading
- [x] XP, leveling, achievements, badges
- [x] FAME system (give/receive, leaderboards)
- [x] Daily challenges, giveaways, seasonal events
- [x] Server boosts, reputation, quizzes, user titles

### Creative and Productivity
- [x] Whiteboards, mood boards, photo albums
- [x] Wiki channels, form builder, task boards (Kanban)
- [x] Calendar, meeting scheduler, todo lists, standup
- [x] Theme builder with custom CSS and theme store
- [x] Music rooms, study rooms, watch parties, collaborative playlists

### Bots and Integrations
- [x] Bot store and bot builder
- [x] Slash commands and message components
- [x] Webhooks with delivery logs
- [x] OAuth2 authorization flow
- [x] Stripe payment integration
- [x] Referral system

### Security
- [x] JWT auth with refresh tokens, Argon2id, TOTP 2FA
- [x] HTTP security headers (Helmet.js), CORS, 6 rate limiters
- [x] Zod validation on all endpoints
- [x] File upload validation (MIME + magic bytes)
- [x] Federation HTTP signatures, SSRF protection

### Email and Notifications
- [x] Email verification on signup
- [x] Web push notifications
- [x] Email notification digest (batched)
- [x] Per-channel notification preferences

### Internationalization
- [x] i18n framework with locale support (en, es, fr)

### Multi-Platform
- [x] Web (React + Vite)
- [x] Mobile (Expo / React Native, 50+ screens)
- [x] Desktop (Electron)
- [x] Landing site (Next.js)
- [x] Configurable server URL on mobile (connect to any instance)

---

## Near-Term — Q2 2026

- [ ] **E2E encrypted file attachments** — Encrypt images, videos, and files before upload so the server never sees plaintext media
- [ ] **Forward secrecy (Double Ratchet)** — Signal-style ratchet so compromising a single key doesn't expose past messages
- [ ] **Multi-device key sync** — Securely synchronize encryption keys across browsers and devices
- [ ] **Mobile app store release** — Publish to App Store and Google Play
- [ ] **Accessibility audit** — WCAG 2.1 AA compliance pass across all surfaces
- [ ] **Advanced search filters** — Date range, author, channel, has:image, has:file, has:link
- [ ] **i18n expansion** — Community-contributed locale packs beyond en/es/fr

## Mid-Term — Q3-Q4 2026

- [ ] **Voice/video E2E encryption** — Insertable Streams for E2E encrypted WebRTC media
- [ ] **Plugin/extension SDK** — Third-party developers can build and distribute plugins
- [ ] **Matrix / ActivityPub bridge** — Interop with Matrix rooms and Mastodon/Misskey
- [ ] **Tauri migration** — Replace Electron with Tauri for a smaller, faster desktop app
- [ ] **Relay operator incentives** — Reputation rewards and visibility for relay operators
- [ ] **Federation protocol v2** — Batched activities, partial sync, conflict resolution

## Long-Term — 2027+

- [ ] **Peer-to-peer fallback** — Direct device-to-device messaging when the server is unreachable
- [ ] **Decentralized identity (DID)** — W3C Decentralized Identifiers for portable, self-sovereign identity
- [ ] **Enterprise SSO** — SAML 2.0 and OpenID Connect
- [ ] **Offline mode** — Full offline read/compose with automatic sync
- [ ] **Federated file storage** — Distributed file hosting across instances
- [ ] **WebAssembly encryption** — Move crypto operations to WASM for performance

---

## Contributing

Have a feature idea? Open an issue on [GitHub](https://github.com/CoodayeA/Gratonite/issues) with the `feature-request` label. Pull requests welcome — see the [README](README.md) for setup.
