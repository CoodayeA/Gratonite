# Gratonite product program

Execution-focused tracker for initiatives that span **search, notifications, federation, desktop, operators, and platform**. Priorities and “what shipped” are also summarized in [`ROADMAP.md`](../../ROADMAP.md) at the repo root — **keep both in sync** when status changes.

**Legend:** ✅ shipped on `main` | 🔶 partial / next slice | 📋 not started

**Last reviewed:** 2026-04-04 — reconciled with [`ROADMAP.md`](../../ROADMAP.md) and current tree.

---

## Dependency order (do not skip)

1. **Core reliability** — API health, migrations, delivery, auth.
2. **Search & notifications** — before heavy moderation/discovery at scale.
3. **Federation trust & clarity** — before aggressive discovery growth.
4. **Operator surfaces** — backup, runbook, health UI for self-hosters.
5. **Platform depth** — webhooks, bots, public API docs.

---

## 1. Search & discovery

| Initiative | Status | Where |
|------------|--------|--------|
| Channel message search | ✅ | Channel chat + search APIs |
| Global search (modal + command palette) | ✅ | `GlobalSearchModal`, `CommandPalette`, `TopBarActions` |
| Dedicated search page + filters | ✅ | Guild-scoped search with filters (channel, author, date, `has:*`, mentions-me); saved searches — see *Shipped → Core Platform* in [`ROADMAP.md`](../../ROADMAP.md) |
| Search UX polish | ✅ | Empty/loading states, active-filter chips, `has:` type badges — see *Recently shipped* in [`ROADMAP.md`](../../ROADMAP.md) |

**Next slices:** in-app search syntax help (see ideas backlog #10 in [`ROADMAP.md`](../../ROADMAP.md)).

---

## 2. Notifications

| Initiative | Status | Where |
|------------|--------|--------|
| Per-channel prefs + mute | ✅ | Notification prefs + APIs |
| Per-guild notification master rules | ✅ | Default level for new members — [`ROADMAP.md`](../../ROADMAP.md) *Recently shipped* |
| Email: transactional-by-default + opt-in | ✅ | Migration defaults + settings merge — [`ROADMAP.md`](../../ROADMAP.md) *Email and Notifications* |
| Web push | ✅ | Web push path — [`ROADMAP.md`](../../ROADMAP.md) |
| Notification quiet hours (user-level schedule) | ✅ | `notification_quiet_hours` / migration `0003` — [`ROADMAP.md`](../../ROADMAP.md) |
| Scheduled DND (presence) | ✅ | Settings + `dnd_schedules` + job — [`ROADMAP.md`](../../ROADMAP.md) *Recently shipped* |
| Mobile prefs aligned with web | ✅ | Mobile quiet hours same JSON as web — [`ROADMAP.md`](../../ROADMAP.md) |

**Next slices:** continued parity when new notification channels ship.

---

## 3. Federation & trust

| Initiative | Status | Where |
|------------|--------|--------|
| Federation protocol, admin dashboard, help | ✅ | API routes, `FederationAdmin`, help articles |
| Guild discovery / directory | ✅ | [`ROADMAP.md`](../../ROADMAP.md) *Federation* |
| Discover / remote user entry (e.g. address lookup + DM) | ✅ | `ConnectInstanceWizard` (3-step: domain → `.well-known` preview → handshake), `RemoteBadge` on all user surfaces — see *Recently shipped* in [`ROADMAP.md`](../../ROADMAP.md) |
| Cross-instance moderation escalation | ✅ | `POST /federation/admin/reports/:id/escalate`, escalate button + status badge in `FederationAdmin`, federated member counts — see *Recently shipped* in [`ROADMAP.md`](../../ROADMAP.md) |

**Next slices:** federation transparency / abuse reporting ideas in [`ROADMAP.md`](../../ROADMAP.md) backlog (#25–26).

---

## 4. Voice, video, screen share

| Initiative | Status | Where |
|------------|--------|--------|
| LiveKit voice/video/screen | ✅ | Web + API — [`ROADMAP.md`](../../ROADMAP.md) |
| Call polish / error handling | ✅ | LiveKit error mapping, false-success guard on cancel, throttled join/leave toasts — see *Recently shipped* in [`ROADMAP.md`](../../ROADMAP.md) |
| Noise suppression / music mode | 📋 | Ideas backlog #18 (noise / input controls) in [`ROADMAP.md`](../../ROADMAP.md) |

---

## 5. Desktop (Electron)

| Initiative | Status | Where |
|------------|--------|--------|
| Tray, deep links, hotkeys, mini mode | ✅ | Desktop app — [`ROADMAP.md`](../../ROADMAP.md) |
| Offline / reconnect UX | ✅ | Desktop `second-instance` safety, reconnect toasts + safer main-process handling — see *Recently shipped* in [`ROADMAP.md`](../../ROADMAP.md) |

---

## 6. Self-host & operators

| Initiative | Status | Where |
|------------|--------|--------|
| Docker compose, setup wizard, docs | ✅ | `deploy/`, `docs/self-hosting/` |
| **Support: collect logs** | ✅ | `deploy/self-host/collect-logs.sh`, `deploy/self-host/collect-logs.ps1` |
| Admin API health snapshot | ✅ | `AdminDashboard` + `GET /health` |
| Operator backup entry point | ✅ | Admin → self-host backups + docs — [`ROADMAP.md`](../../ROADMAP.md) *Recently shipped* |
| Web container nginx | ✅ | `deploy/web/nginx.conf` (SPA under `/app/` in the web image; front door often Caddy in `docker-compose.production.yml`) |
| Extended infra metrics (disk, LiveKit, etc.) | ✅ | Memory, CPU load, BullMQ queues, Redis history, LiveKit room count — `apps/api/src/routes/metrics.ts` — see *Recently shipped* in [`ROADMAP.md`](../../ROADMAP.md) |

**CI note:** `.github/workflows/release-gates.yml` runs i18n strict, E2E doc audit, deploy artifact hygiene, API build/lint/guard, **OpenAPI validate**, web lint/guard/**Vite build**, service worker validation, and the landing build. Run root `pnpm verify:release:all` locally for the full release gate (adds API `verify:release` + web smoke when you have DB/env) — see root `package.json` and [`DEVELOPMENT.md`](../../DEVELOPMENT.md).

---

## 7. Safety & privacy

| Initiative | Status | Where |
|------------|--------|--------|
| Reports, audit, moderation tooling | ✅ | Admin surfaces |
| GDPR-compliant deletion and **data export** | ✅ | [`ROADMAP.md`](../../ROADMAP.md) *Moderation* |
| Block / privacy settings | ✅ | Block/unblock API + UI, privacy settings consolidation in SettingsModal — see *Recently shipped* in [`ROADMAP.md`](../../ROADMAP.md) |

---

## 8. Platform (bots, webhooks, API)

| Initiative | Status | Where |
|------------|--------|--------|
| Webhooks + delivery logs | ✅ | API + UI |
| **Public API docs** | ✅ | `docs/api/openapi.yaml`, `docs/api/WEBHOOK-EVENTS.md` — [`ROADMAP.md`](../../ROADMAP.md) *Recently shipped* |
| OpenAPI generation / coverage | ✅ | 33 documented paths, `tools/check-openapi-coverage.mjs` threshold check wired into CI (`release-gates.yml`) — see *Recently shipped* in [`ROADMAP.md`](../../ROADMAP.md) |

---

## 9. Marketing & web shell

| Initiative | Status | Notes |
|------------|--------|--------|
| Landing + SPA | ✅ | Landing (`apps/landing`) + Vite app under `/app/` in production |
| Service worker / precache | ✅ | Precache manifest validated; invalid-URL guard added to `sw.js` registration — see *Recently shipped* in [`ROADMAP.md`](../../ROADMAP.md) |

---

## 10. Encryption (E2E / forward secrecy)

| Initiative | Status | Where |
|------------|--------|--------|
| E2E encryption for DMs (ECDH P-256 + AES-GCM-256) | ✅ | Automatic for all DMs — see *Shipped → Encryption* in [`ROADMAP.md`](../../ROADMAP.md) |
| Forward secrecy — Double Ratchet ADR | ✅ | `docs/adr/0004-double-ratchet-forward-secrecy.md` — X25519 DR + AES-GCM-256, X3DH pre-key bundles, wire format `_e2e: 3` |
| Multi-device key sync ADR | ✅ | `docs/adr/0005-multi-device-key-sync.md` — device registration, key sync envelope, revocation, 6-phase rollout |

**Next slices:** implement Double Ratchet protocol per ADR-0004 (replace ECDH one-shot with ratcheting); implement device registration API per ADR-0005.

---

## 11. Accessibility (WCAG 2.1 AA)

| Initiative | Status | Where |
|------------|--------|--------|
| jsx-a11y lint rules (full recommended) | ✅ | `apps/web/eslint.config.js` — 21 rules; high-volume interaction rules enabled incrementally |
| Icon-only button labels | ✅ | `aria-label="Close"` added to all `<X>` icon buttons; SettingsModal nav `role="button"` — Pass 2 |
| WCAG 2.1 AA audit checklist | 🔶 | `docs/a11y/WCAG-AUDIT-CHECKLIST.md` — Pass 2 done; focus trap + skip link + div-onClick fixes remain |

**Next slices:** focus trap in modals, skip link in main layout, enable `click-events-have-key-events` after div→button conversions.

---

## Working conventions

- One epic per PR when possible; update this file and/or [`ROADMAP.md`](../../ROADMAP.md) when something ships.
- Do not claim ✅ here if [`ROADMAP.md`](../../ROADMAP.md) still lists the same item as only planned — reconcile first.
