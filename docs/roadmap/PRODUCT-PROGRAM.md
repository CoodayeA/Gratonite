# Gratonite product program

This file tracks the **full** initiative set we committed to (federation UX, search, notifications, desktop, operators, platform). It is a **program** document: work proceeds in parallel where possible, but **dependencies** (below) still apply.

**Legend:** ✅ shipped in tree | 🔶 partial / iterate | 📋 planned next slice

---

## Dependency order (do not skip)

1. **Core reliability** — API health, migrations, message delivery, auth. Everything assumes this.
2. **Search & notifications** — before heavy moderation/discovery at scale.
3. **Federation trust & clarity** — before aggressive discovery growth.
4. **Operator surfaces** — backup/runbook/health UI for self-hosters.
5. **Platform depth** — outbound webhooks, richer bots, public API docs.

---

## Email volume & transactional policy (SMTP quota)

**Goal:** On small SMTP plans, only **transactional** mail should send by default. Everything else is **opt-in** in **Settings → Notifications → Email**.


| Email type                                | Default                                          | Notes                                                                    |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Sign-up / email verification              | Always sent                                      | Required for account proof                                               |
| Password reset                            | Always sent                                      | Account recovery                                                         |
| Unread / digest / mention & DM emails     | **Off** (`frequency: never`, mentions/dms false) | `user_settings.email_notifications`, job in `jobs/emailNotifications.ts` |
| New sign-in / “new device” security alert | **Off** (`securityAlerts: false`)                | `auth.service.ts` + opt-in toggle in Settings                            |


**Implementation:** Defaults live in `apps/api/src/lib/emailNotificationPrefs.ts`. API **GET/PATCH** `/users/@me/settings` merges partial JSON so missing keys resolve to opt-out. **Web UI** (`SettingsModal`) defaults match the server (no more `mentions: true` / `daily` on first paint). Migration `drizzle/0002_email_notification_defaults.sql` backfills `securityAlerts` on existing rows.

**Operator note:** If an old database still has many users with aggressive email prefs from earlier UI defaults, run a **one-off SQL** in maintenance window only after review, e.g. set `frequency` to `never` for users who never opted in — not applied automatically in migrations.

---

## 1. Search & discovery


| Initiative                                                 | Status | Where                                                      |
| ---------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| Channel message search                                     | ✅      | `ChannelChat.tsx` + `api.search.messages`                  |
| Global search (modal + filters)                            | ✅      | `GlobalSearchModal.tsx`, `CommandPalette`, `TopBarActions` |
| Dedicated search page                                      | ✅      | `pages/guilds/GlobalSearch.tsx`                            |
| Server-wide search filters (guild, author, date, has:file) | 🔶     | Extend `GET /search/messages` + modal filters as needed    |


**Next slices:** saved searches; expose Global Search route in sidebar if not linked; optional full-text tuning (DB indexes) for large instances.

---

## 2. Notifications


| Initiative                            | Status | Where                                                                    |
| ------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Per-channel notification prefs + mute | ✅      | `NotificationPrefsModal.tsx`, `channel-notification-prefs` API           |
| Web push + email prefs                | ✅      | `SettingsModal` — email defaults opt-out; verification/reset always      |
| Quiet hours / per-guild master rules  | 📋     | Settings + API fields                                                    |
| Mobile granular prefs                 | 🔶     | Local-only until server fields exist (`SettingsNotificationsScreen.tsx`) |


**Next slices:** persist quiet hours server-side; align mobile with web prefs.

---

## 3. Federation & trust


| Initiative                           | Status | Where                                                         |
| ------------------------------------ | ------ | ------------------------------------------------------------- |
| Federation HTTP API & trust scoring  | ✅      | `apps/api/src/routes/federation.ts`, `federation/`            |
| Admin federation dashboard           | ✅      | `pages/admin/FederationAdmin.tsx`                             |
| User-facing help article             | ✅      | `helpArticles.ts` → `federation`                              |
| Guided “connect instance” wizard     | 🔶     | `Discover.tsx` — federation address lookup + DM; expand to instance URL preview |
| Cross-instance badges in UI          | 🔶     | Surface `federationAddress` / remote flags in message headers |
| Cross-instance moderation escalation | 🔶     | Reports queue exists in admin; extend policies                |


**Next slices:** instance URL well-known preview; badges on messages/DMs; operator escalation docs in admin.

---

## 4. Voice, video, screen share


| Initiative                          | Status | Where                                                              |
| ----------------------------------- | ------ | ------------------------------------------------------------------ |
| LiveKit integration                 | ✅      | Web + API token routes                                             |
| Electron screen capture             | ✅      | `useLiveKit.ts`, `electronScreenCapture.ts`, `main.js` permissions |
| Noise suppression / music mode      | 📋     | LiveKit track processors when prioritized                          |
| Call quality diagnostics (optional) | 📋     | Dev/advanced panel                                                 |


---

## 5. Desktop (Electron)


| Initiative                        | Status | Where                                                    |
| --------------------------------- | ------ | -------------------------------------------------------- |
| Tray + unread tooltip             | ✅      | `main.js` (`Tray`, `update-tray-badge` IPC)              |
| Minimize to tray / start on login | ✅      | `tray-settings.json`, IPC                                |
| Deep links `gratonite://`         | ✅      | `handleDeepLink`, `open-url`                             |
| Global hotkeys                    | ✅      | `hotkeys.json`, `registerHotkeys`                        |
| Mini mode                         | ✅      | `MiniMode.tsx`                                           |
| Offline / reconnect UX copy       | 🔶     | Improve failed-load page + web `socket` reconnect toasts |


**Next slices:** macOS/Linux parity testing; richer offline queue messaging in web layer.

---

## 6. Self-host & operators


| Initiative                           | Status | Where                                                  |
| ------------------------------------ | ------ | ------------------------------------------------------ |
| Docker production compose            | ✅      | `deploy/docker-compose.production.yml`                 |
| Windows deploy wrapper (off-repo)    | ✅      | `Gratonite-deploy.ps1` (user Documents)                |
| Admin **instance health** snapshot   | ✅      | `AdminDashboard.tsx` → fetches `GET /health`           |
| In-product backup reminders          | 📋     | Link to `docs/self-hosting` + one-click copy commands  |
| Health dashboard (disk, LiveKit, DB) | 📋     | Extend `/health` or `/admin/system` with gated metrics |


**Next slices:** expand health JSON for admins only; surface disk/LiveKit ping where safe.

---

## 7. Safety & privacy


| Initiative               | Status | Where                                     |
| ------------------------ | ------ | ----------------------------------------- |
| User reports (admin)     | ✅      | `AdminReports`, federation reports tab    |
| Audit log                | ✅      | `AuditLog`, `AdminAuditLog`               |
| Account data export      | 📋     | GDPR export job + download link           |
| Block / privacy settings | 🔶     | Varies by surface — consolidate checklist |


---

## 8. Platform (bots, webhooks, API)


| Initiative                            | Status | Where                                            |
| ------------------------------------- | ------ | ------------------------------------------------ |
| Channel webhooks (create/list/delete) | ✅      | `routes/webhooks.ts`                             |
| Webhook bots & Bot Builder docs       | ✅      | `helpArticles` → `building-webhook-bot`          |
| Public OpenAPI / generated docs       | 📋     | Generate from routes or hand-maintain `docs/api` |


**Next slices:** OpenAPI export; more outbound event types for webhooks.

---

## How AI-assisted development should run

- Pick **one epic** per PR when possible; link PR title to a row here.
- **Do not** land unrelated refactors with feature work.
- After each merge, update this file’s **Status** column when an initiative moves ✅.

Last reviewed: program charter + admin health panel (`docs/roadmap/PRODUCT-PROGRAM.md`).