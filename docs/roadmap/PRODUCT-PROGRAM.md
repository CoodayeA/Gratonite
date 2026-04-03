# Gratonite product program

Execution-focused tracker for initiatives that span **search, notifications, federation, desktop, operators, and platform**. Priorities and “what shipped” are also summarized in [`ROADMAP.md`](../../ROADMAP.md) at the repo root — **keep both in sync** when status changes.

**Legend:** ✅ shipped on `main` | 🔶 partial / next slice | 📋 not started

**Last reviewed:** 2026-04-03 — reconciled with [`ROADMAP.md`](../../ROADMAP.md) and current tree.

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
| Search UX polish | 🔶 | More empty/loading states, very-large-guild performance — see *Maintenance* in [`ROADMAP.md`](../../ROADMAP.md) |

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
| Discover / remote user entry (e.g. address lookup + DM) | 🔶 | Core flows exist; **richer** “connect instance” wizard, `.well-known` preview, and ubiquitous remote badges remain |
| Cross-instance moderation escalation | 🔶 | Reports exist; transparency/escalation UX and docs still improving |

**Next slices:** federation transparency / abuse reporting ideas in [`ROADMAP.md`](../../ROADMAP.md) backlog (#25–26).

---

## 4. Voice, video, screen share

| Initiative | Status | Where |
|------------|--------|--------|
| LiveKit voice/video/screen | ✅ | Web + API — [`ROADMAP.md`](../../ROADMAP.md) |
| Call polish / error handling | 🔶 | Ongoing — *Maintenance* in [`ROADMAP.md`](../../ROADMAP.md) |
| Noise suppression / music mode | 📋 | Ideas backlog #18 (noise / input controls) in [`ROADMAP.md`](../../ROADMAP.md) |

---

## 5. Desktop (Electron)

| Initiative | Status | Where |
|------------|--------|--------|
| Tray, deep links, hotkeys, mini mode | ✅ | Desktop app — [`ROADMAP.md`](../../ROADMAP.md) |
| Offline / reconnect UX | 🔶 | [`ROADMAP.md`](../../ROADMAP.md) *Maintenance*; ideas #28 |

---

## 6. Self-host & operators

| Initiative | Status | Where |
|------------|--------|--------|
| Docker compose, setup wizard, docs | ✅ | `deploy/`, `docs/self-hosting/` |
| **Support: collect logs** | ✅ | `deploy/self-host/collect-logs.sh`, `deploy/self-host/collect-logs.ps1` |
| Admin API health snapshot | ✅ | `AdminDashboard` + `GET /health` |
| Operator backup entry point | ✅ | Admin → self-host backups + docs — [`ROADMAP.md`](../../ROADMAP.md) *Recently shipped* |
| Web container nginx | ✅ | `deploy/web/nginx.conf` (SPA under `/app/` in the web image; front door often Caddy in `docker-compose.production.yml`) |
| Extended infra metrics (disk, LiveKit, etc.) | 🔶 | Partial — deeper signals still optional |

**CI note:** `.github/workflows/release-gates.yml` runs i18n strict, E2E doc audit, API build/lint/guard, **OpenAPI validate**, web lint/guard/**Vite build**. Run root `pnpm verify:release:all` locally for the full release gate (includes API `verify:release` + web smoke) when you have DB/env — see root `package.json` and [`DEVELOPMENT.md`](../../DEVELOPMENT.md).

---

## 7. Safety & privacy

| Initiative | Status | Where |
|------------|--------|--------|
| Reports, audit, moderation tooling | ✅ | Admin surfaces |
| GDPR-compliant deletion and **data export** | ✅ | [`ROADMAP.md`](../../ROADMAP.md) *Moderation* |
| Block / privacy settings | 🔶 | Consolidation possible across surfaces |

---

## 8. Platform (bots, webhooks, API)

| Initiative | Status | Where |
|------------|--------|--------|
| Webhooks + delivery logs | ✅ | API + UI |
| **Public API docs** | ✅ | `docs/api/openapi.yaml`, `docs/api/WEBHOOK-EVENTS.md` — [`ROADMAP.md`](../../ROADMAP.md) *Recently shipped* |
| OpenAPI generation / coverage | 🔶 | Validate in CI; expand generated coverage over time |

---

## 9. Marketing & web shell

| Initiative | Status | Notes |
|------------|--------|--------|
| Landing + SPA | ✅ | Landing (`apps/landing`) + Vite app under `/app/` in production |
| Service worker / precache | 🔶 | After `sw.js` or precache list changes, run a full web build and smoke-test install; avoid precaching invalid URLs |

---

## Working conventions

- One epic per PR when possible; update this file and/or [`ROADMAP.md`](../../ROADMAP.md) when something ships.
- Do not claim ✅ here if [`ROADMAP.md`](../../ROADMAP.md) still lists the same item as only planned — reconcile first.
