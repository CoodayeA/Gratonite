# Gratonite Roadmap

Planned direction for Gratonite. Priorities may shift based on community feedback.

## Current Status — v1.0.x (April 2026)

Gratonite has a live production deployment and self-hosting stack with **140** database schemas, **134** API route modules, **70+** frontend pages, **50+** mobile screens, and **23** background jobs across 7 app surfaces (web, mobile, desktop, API, server, landing, relay).

### How this roadmap is verified

- **Shipped** items are backed by code in this repository (API routes, web/mobile UI, jobs). They are spot-checked during roadmap reviews; not every bullet has a dedicated automated test.
- **Counts** (schemas, routes, pages) come from repository inventory scripts or manual tallies and may drift slightly between releases — treat as approximate.
- **Near-term / mid-term / long-term** lists are planning intent, not commitments with dates.
- Finer-grained initiative tracking (search, notifications, federation, operators) and **execution status** (✅ / 🔶 / 📋) live in **[`docs/roadmap/PRODUCT-PROGRAM.md`](docs/roadmap/PRODUCT-PROGRAM.md)**. When something moves from planned to shipped, update **both** this file and that program doc so they stay aligned.

### Recently shipped (high level)

- **Search:** server-wide filters (guild, author, date range, `has:`*, mentions-me) — see *Shipped → Core Platform*
- **Privacy:** GDPR account data export — see *Shipped → Moderation*
- **Email:** transactional-by-default policy + migration defaults — see *Shipped → Email and Notifications*
- **Presence:** scheduled DND window (settings + `dnd_schedules` + job)
- **Operator backup entry point:** Admin → Self-host backups → documentation + copy helpers
- **Notification quiet hours** (user-level: mute alerts + digest email by time window; distinct from DND presence)
- **Per-guild notification master rules** — default level for new members
- **Saved searches + search page entry** — persisted named queries on `GlobalSearch`; sidebar opens `/guild/:guildId/search`
- **Mobile quiet hours** — same JSON as web in notification settings
- **Public API docs** — `docs/api/openapi.yaml` + `docs/api/WEBHOOK-EVENTS.md`
- **Product identity and messaging cleanup** — landing pages, in-app help, release notes, and self-host guides now introduce Gratonite as community software with consistent guild/channel/forum/wiki terminology
- **Mobile parity audit (core member flows)** — mobile now sends chat/DM media on the canonical attachment contract, global search matches the canonical search response with quick `has:` / mentions filters, and the notification inbox shows guild trust context with accurate channel naming on open
- **Quality & stability (April 2026)** — Call and screen-share error mapping, LiveKit + native fallback behavior (no false success on cancel), throttled voice join/leave toasts, guild overview loading skeleton and global search “before you search” empty state, API/socket/federation hardening (payload limits, LiveKit token TTL helper, hostname checks), desktop main-process test coverage and safer `second-instance` handling; `docs/SECURITY-AUDIT.md`, `docs/QUALITY-CHECKLIST.md`, What’s New `2026-04-03d`
- **Search UX polish** — empty/loading states, active-filter chips, `has:` type badges in `GlobalSearch`
- **Service worker / precache** — invalid-URL guard in `sw.js` registration, precache manifest validated
- **OpenAPI coverage** — 33 documented paths in `docs/api/openapi.yaml`; `tools/check-openapi-coverage.mjs` threshold check wired into `release-gates.yml` CI
- **Block / privacy consolidation** — block/unblock API surface + privacy settings unified in `SettingsModal`
- **Extended infra metrics** — memory, CPU load, BullMQ queue depth, Redis history, LiveKit room count in operator dashboard
- **Federation: ConnectInstanceWizard** — 3-step guided modal (domain entry → `.well-known` preview → handshake) in `FederationAdmin` discover tab
- **Federation: RemoteBadge** — remote-instance indicator on all user surfaces (chat, profile, member list, DMs)
- **Federation: cross-instance moderation escalation** — `POST /federation/admin/reports/:id/escalate`, escalate button + status badge, federated member counts
- **Encryption ADRs** — `docs/adr/0004-double-ratchet-forward-secrecy.md` (X25519 DR + AES-GCM-256) and `docs/adr/0005-multi-device-key-sync.md`
- **Accessibility Pass 1** — `eslint-plugin-jsx-a11y` expanded to 21 rules; icon-only buttons labelled; `SettingsModal` nav promoted to `role=button`; WCAG 2.1 AA checklist started

---

## Shipped

Everything below is implemented in this repository and reflected in the live product or self-host stack, while launch hardening and operator sign-off continue in the dedicated launch docs.

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
- Global search (PostgreSQL full-text) with filters: channel, server (`guildId`), author, date range, `has:file` / `has:image` / `has:embed` / `has:link`, mentions-me; **saved searches** on the dedicated search page (local persistence)

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
- Bring-your-own tunnel or reverse-proxy hosting in front of the self-host stack
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
- Documented review cadence and dependency policy — see `docs/SECURITY-AUDIT.md` (includes admin/file-serving and rate-limit verification)

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

## Maintenance — quality & stability (ongoing)

The **April 2026** wave above shipped the first full pass (calls, screen share, key UI states, security documentation, desktop test harness). What remains is **continuous**: new regressions, browser/OS edge cases, dependency advisories, and small UX wins—without a fixed “done” date.

| Area | Still in play |
|------|----------------|
| **Security** | Re-run audits before releases; respond to new CVEs; review new routes and admin surfaces as they ship |
| **UI/UX** | More empty/loading/error coverage on secondary views; scroll and list performance on very large guilds |
| **Calls / RTC** | New client versions, OS permission changes, TURN edge cases; noise/input surfacing (see ideas backlog #18) |
| **Bugs** | Triage reports across web, desktop, mobile as filed |
| **Testing** | Expand automated coverage where ROI is high (E2E still listed under Near-Term priorities indirectly via a11y and product QA) |

A formal **WCAG 2.1 AA pass** and **broader i18n** are tracked under **Near-Term**, not this maintenance bucket.

---

## Near-Term — Q2 2026

Planning intent for the next engineering cycles. Cryptography work is a **multi-month** track; items here are direction, not a promise of simultaneous delivery.

- **E2E encrypted file attachments** — Implemented for web and mobile (DMs + encrypted guild channels): wire format and primitives are documented in [`docs/crypto/e2e-primitives.md`](docs/crypto/e2e-primitives.md); mobile notes in [`docs/mobile/E2E-ATTACHMENTS.md`](docs/mobile/E2E-ATTACHMENTS.md).
- **Forward secrecy (Double Ratchet)** — *Not started.*
- **Multi-device key sync** — *Not started.* Pairs with Double Ratchet program when scheduled.
- **Accessibility audit** — Checklist: [`docs/a11y/WCAG-AUDIT-CHECKLIST.md`](docs/a11y/WCAG-AUDIT-CHECKLIST.md); formal pass tracked as near-term engineering work.
- **i18n expansion** — Nine locales exist in web; run `pnpm i18n:check` from repo root. Contributor workflow: [`docs/i18n-CONTRIBUTING.md`](docs/i18n-CONTRIBUTING.md).

## Mid-Term — Q3-Q4 2026

These are **large bets**; prefer **one primary initiative per half** unless capacity expands.

- **Plugin/extension SDK** — Third-party developers can build and distribute plugins
- **ActivityPub bridge** — Interop with federated social platforms (Mastodon, Misskey)
- **Tauri migration** — Replace Electron with Tauri for a smaller, faster desktop app
- **Relay operator incentives** — Reputation rewards and visibility for relay operators
- **Federation protocol v2** — Batched activities, partial sync, conflict resolution

## Long-Term — 2027+

- **Peer-to-peer fallback** — Direct device-to-device messaging when the server is unreachable
- **Decentralized identity (DID)** — W3C Decentralized Identifiers for portable, self-sovereign identity
- **Offline mode** — Full offline read/compose with automatic sync
- **Federated file storage** — Distributed file hosting across instances
- **WebAssembly encryption** — Move crypto operations to WASM for performance

---

## Ideas backlog — possible enhancements

Uncommitted ideas that could make Gratonite stronger over time. Not prioritized; some may overlap shipped work or later roadmap items.

1. **Richer desktop notifications** — Grouping, inline actions (mute server, mark read), and clearer attribution on Windows/macOS/Linux.
2. **Inline message translation** — Optional, per-user or per-channel; provider pluggable and privacy-conscious for self-hosters.
3. **Keyboard shortcut editor** — User-remappable shortcuts for navigation, composer, and voice push-to-talk.
4. **Density and layout presets** — Beyond compact mode: list vs cozy vs spacious; optional sidebar width memory per guild.
5. **Channel follow without full membership** — For public guilds: follow announcements or a single channel with a lighter subscription model.
6. **Cross-post / mirror posts** — Opt-in broadcast from one channel to another (with mod controls and deduplication).
7. **Scheduled voice events + ICS** — Calendar invites, reminders, and “event channel” templates for community calls.
8. **Consent-based voice recording** — Server-governed, auditable recording for stages or moderation (legal/compliance hooks).
9. **Guild-scoped backup and restore** — Export/import a single guild for migration between instances or cold storage.
10. **In-app search syntax help** — Discoverable `has:`, `from:`, date, and mention operators with examples from the current guild.
11. **Per-channel link unfurl controls** — Toggle previews by channel or domain blocklist to reduce spam and surprises.
12. **Dev community link previews** — Optional GitHub/GitLab/issue and PR cards with instance-controlled allowlists.
13. **Granular bot OAuth scopes** — Narrow permissions per guild (e.g. read messages vs send vs manage roles) with clearer install UX.
14. **Webhook hardening UX** — Documented signing, idempotency keys, and delivery replay expectations in the developer panel.
15. **User-created sticker packs** — Curated pack sharing within a guild or the marketplace, with moderation queues.
16. **Soundboard in voice** — Permissioned short clips for stages and community events (rate-limited, auditable).
17. **Per-channel default voice mode** — Voice-activation vs push-to-talk defaults set by moderators for noisy or quiet rooms.
18. **Noise and input controls surfacing** — Expose clearer mic processing options where the client stack allows (aligns with call polish).
19. **Low-bandwidth mode** — Reduce autoplay, image quality, and realtime fan-out for poor networks (esp. mobile).
20. **Private moderator notes** — Per-user notes visible only to mods and admins, tied to audit expectations.
21. **Read-only compliance archives** — Legal hold style: immutable channel views for designated roles.
22. **Channel and thread export** — Export to Markdown, HTML, or PDF for documentation and off-platform backups.
23. **Collaborative notes or docs attached to channels** — Lightweight wiki-adjacent doc with presence (distinct from full wiki channels).
24. **Public server discovery filters** — Language, region, moderation stance, or “verified” tags at the directory level.
25. **Federation transparency panel** — For users: which remote instances appear in this guild, blocked instances, and trust hints.
26. **Instance abuse reporting** — Clear path to report spam or CSAM to instance operators with evidence attachments.
27. **Self-hosted auth plugins** — LDAP or OIDC hooks for **self-hosted** deployments (distinct from a hosted “enterprise SSO” product).
28. **Better offline behavior on desktop** — Graceful degradation when the network drops during voice or compose (pairs with long-term offline mode).

---

## Contributing

Have a feature idea? Open an issue on [GitHub](https://github.com/CoodayeA/Gratonite/issues) with the `feature-request` label. Pull requests welcome — see the [README](README.md) for setup.
