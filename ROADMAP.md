# Gratonite Roadmap 🗺️

This document outlines the planned direction for Gratonite. Priorities may shift based on community feedback and contributions.

## Current Status — v1.0.0 (March 2026)

Gratonite v1.0.0 is production-ready with:

- **109** database schemas, **91** API route modules, **51** frontend pages, **77** React components
- Multi-platform: web, mobile (Expo), desktop (Electron)
- End-to-end encryption for DMs and group DMs (ECDH P-256 + AES-GCM-256)
- Instance federation with HTTP signature authentication
- Self-hosting with one-command Docker deployment and automatic HTTPS
- Full moderation suite, economy system, gamification, voice/video, and creative tools

---

## Near-Term — Q2 2026

- **E2E encrypted file attachments** — Encrypt images, videos, and files before upload so the server never sees plaintext media
- **Forward secrecy (Double Ratchet)** — Adopt a Signal-style ratchet so compromising a single key doesn't expose past messages
- **Multi-device key sync** — Securely synchronize encryption keys across browsers and devices
- **Mobile production release** — Publish Gratonite to the App Store and Google Play
- **Email verification** — Require email confirmation on signup to reduce spam accounts
- **Accessibility audit** — WCAG 2.1 AA compliance pass across all frontend surfaces

## Mid-Term — Q3–Q4 2026

- **Voice/video E2E encryption** — Integrate Insertable Streams to E2E encrypt WebRTC media
- **Plugin/extension SDK** — Allow third-party developers to build and distribute plugins
- **Advanced search** — Full-text search with filters (date range, author, channel, has:image)
- **AI-assisted moderation** — Optional ML-based content moderation with configurable sensitivity
- **Custom bot marketplace** — Community-built bots discoverable and installable from within the app
- **Internationalization (i18n)** — Full translation support with community-contributed locale packs

## Long-Term — 2027+

- **Matrix / ActivityPub bridge** — Interop with Matrix rooms and ActivityPub (Mastodon, Misskey) for cross-platform messaging
- **Peer-to-peer fallback** — Allow direct device-to-device messaging when the server is unreachable
- **Decentralized identity (DID)** — Support W3C Decentralized Identifiers for portable, self-sovereign identity
- **Tauri migration** — Replace Electron with Tauri for a smaller, faster desktop app
- **Enterprise SSO** — SAML 2.0 and OpenID Connect for organizations that need centralized authentication
- **Offline mode** — Full offline read/compose with automatic sync when connectivity resumes

---

## Contributing

Have a feature idea? Open an issue on [GitHub](https://github.com/CoodayeA/Gratonite/issues) with the `feature-request` label. Pull requests are welcome — see the repo README for setup instructions.
