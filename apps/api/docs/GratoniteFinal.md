# Gratonite — Full Project Reference

## Governance (Canonical)

- Canonical source-of-truth: `/Volumes/Project BUS/GratoniteFinalForm/docs/GratoniteFinal.md`
- Alias wording allowed in docs only: `/Project BUS/GratoniteFinalForm/...`
- Mirror files:
  - `/Volumes/Project BUS/GratoniteFinalForm/apps/web/docs/GratoniteFinal.md`
  - `/Volumes/Project BUS/GratoniteFinalForm/apps/api/docs/GratoniteFinal.md`
- Completion rule: no task is `Done` unless implementation, verification, ledger evidence, mirror sync, and hash parity are complete.

## Execution Ledger

| Task ID | Scope | Status | Owner | Timestamp (UTC) | Evidence | Rollback |
|---|---|---|---|---|---|---|
| CONS-000 | Phase 0 preflight baseline and integrity manifests | Done | Engineering | 2026-03-03T03:11:30Z | `docs/migration/20260302-220738/inventory-*.txt`, `hash-*.sha256`, `precutover-baseline.log`, `path-coupled-references.txt`, `rollback-map.csv` | `rollback-map.csv` contains restore commands |
| CONS-001 | Phase 1 controlled consolidation cutover + symlink compatibility + legacy archive | Done | Engineering | 2026-03-03T03:18:07Z | Active symlink cutover complete, legacy trees moved to `archive/20260302-221807`, parity log at `docs/migration/20260302-220738/cutover-parity.log` | Repoint/remove symlinks and move back from `*.preconsolidation-20260302-221807` and `archive/20260302-221807` |
| CONS-002 | Phase 2 source-of-truth migration + mirrors + hash verification | Done | Engineering | 2026-03-03T03:20:00Z | Canonical doc at `docs/GratoniteFinal.md`, mirrors at `apps/web/docs/GratoniteFinal.md` and `apps/api/docs/GratoniteFinal.md`, hash proof in `docs/migration/20260302-220738/mirror-hashes.log` | Restore from `GratoniteFinal.md.preconsolidation-20260302-221807` if needed |
| CONS-003 | Phase 3 blocker remediation (admin/team + admin/audit + admin bot moderation contracts + message requests + capability endpoint) | Done | Engineering | 2026-03-03T05:18:00Z | New backend route module `apps/api/src/routes/admin.ts`, new schema `apps/api/src/db/schema/admin.ts`, updated `relationships.ts` message-request endpoints, frontend API/client updates and page wiring in `MessageRequests.tsx`, `AdminTeam.tsx`, `AdminAuditLog.tsx`, `AdminBotModeration.tsx`, `BotBuilder.tsx` | Revert modified files and run rollback from VCS snapshot; DB rollback via migration reversal for `0006_tidy_admin_plane.sql` |
| CONS-004 | Verification + compatibility parity after remediation | Done | Engineering | 2026-03-03T05:21:00Z | `docs/migration/20260302-220738/phase3-remediation-verification.log` (canonical + compatibility path builds, lint) | Restore to pre-remediation backup/snapshot and rerun parity checks |
| CONS-005 | Continued production remediation: Discover join contract, Bot Store persistent install/review lifecycle, Marketplace transactional create/purchase, deterministic ID cleanup | Done | Engineering | 2026-03-03T03:52:20Z | Backend `routes/guilds.ts` (`POST /guilds/:guildId/join`), frontend wiring in `lib/api.ts`, `pages/app/Discover.tsx`, full `pages/app/BotStore.tsx` backend-backed rewrite, `pages/app/Marketplace.tsx` transactional modal flows, deterministic-id fixes in `AdminReports.tsx`, `AdminFeedback.tsx`, `GratoniteDashboard.tsx`, `GuildSettingsModal.tsx`, `AdminTeam.tsx`; verification log: `docs/migration/20260302-220738/phase3-continued-remediation-verification.log` | Revert touched files and redeploy previous artifact; API join endpoint can be disabled by route rollback |
| CONS-006 | BotBuilder production hardening (real linked app IDs, no timeout success simulation) + placeholder guard + shop placeholder copy removal | Done | Engineering | 2026-03-03T04:04:26Z | `apps/web/src/pages/app/BotBuilder.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/pages/app/Shop.tsx`, `tools/placeholder-guard.mjs`, `tools/placeholder-guard.allowlist.json`, `apps/web/package.json`, `apps/api/package.json`; verification log: `docs/migration/20260302-220738/phase3-botbuilder-guard-verification.log` | Revert touched files; remove `guard:placeholders`/`verify:prod` scripts if rollback requires previous pipeline |
| CONS-007 | Call reliability + avatar parity stabilization (DM channel ID normalization, route canonicalization, voice channel-type compatibility, actionable call errors, top-left avatar parity) | Done | Engineering | 2026-03-03T04:37:23Z | Web: `DirectMessage.tsx`, `App.tsx`, `lib/routes.ts`, `DMSearchModal.tsx`, `useLiveKit.ts`, `contexts/UserContext.tsx`; API: `routes/voice.ts`; verification log: `docs/migration/20260302-220738/phase4-call-reliability-avatar-parity-verification.log` | Revert touched files to prior snapshot and restore previous route/voice parsing behavior if rollback is required |
| CONS-008 | Runtime alignment + avatar parity hardening (canonical API on :4000, top-left profile avatar unified with shared Avatar behavior, avatar error-state reset on hash changes) | Done | Engineering | 2026-03-03T04:58:02Z | Web: `apps/web/src/App.tsx`, `apps/web/src/components/ui/Avatar.tsx`; runtime alignment verification + gate run in `docs/migration/20260302-220738/phase4-call-and-avatar-runtime-hotfix-verification.log` | Revert touched web files and restart previous backend process binding if rollback requires prior local runtime topology |
| CONS-009 | Security/config hardening closeout + scoped admin governance hardening (`users.isAdmin` compatibility preserved via `admin_user_scopes`) | Done | Engineering | 2026-03-03T13:59:30Z | Scoped auth model: `apps/api/src/lib/admin-scopes.ts`, `apps/api/src/db/schema/admin.ts`, `apps/api/drizzle/0007_tasty_scope_hardening.sql`; route guard upgrades in `admin.ts`, `admin-shop.ts`, `reports.ts`, `feedback.ts`, `bug-reports.ts`, `cosmetics.ts`; evidence logs: `docs/migration/20260302-220738/security-config-hardening-closeout.log`, `docs/migration/20260302-220738/final-release-certification.log` | Roll back migration `0007_tasty_scope_hardening.sql`, restore prior route guards, and restore `.env.example` secret placeholders from VCS backup |
| CONS-010 | User-critical follow-up remediation: guild member profile persistence route completion, canonical voice disconnect path unification, cosmetic frame/nameplate propagation, avatar/banner persistence URL alignment | Blocked (lint gate) | Engineering | 2026-03-03T14:58:30Z | Run artifacts: `docs/migration/20260303-092440/profile-account-persistence.log`, `voice-state-regression.log`, `discover-portals-regression.log`, `guild-settings-regression.log`, `auth-mfa-regression.log`, `admin-scope-assurance.log`, `lint-zero-warnings.log`, `final-certification.log`; code paths: `apps/api/src/routes/guilds.ts`, `apps/web/src/lib/voiceSession.ts`, `apps/web/src/components/ui/VoiceBar.tsx`, `apps/web/src/pages/guilds/VoiceChannel.tsx`, `apps/web/src/pages/guilds/ChannelChat.tsx`, `apps/web/src/pages/app/DirectMessage.tsx`, `apps/web/src/pages/app/Inventory.tsx`, `apps/web/src/contexts/UserContext.tsx`, `apps/web/src/components/ui/Avatar.tsx`, `apps/web/src/App.tsx` | Complete zero-warning lint debt remediation and re-run certification suite; rollback by reverting touched files above |
| CONS-011 | Critical security fixes: SQL injection remediation in auctions search, lint gate verification, file upload validation audit | Done | Engineering | 2026-03-04T01:42:33Z | SQL injection fix in `apps/api/src/routes/auctions.ts` (added proper escaping for search parameter); verification log: `docs/migration/20260304-014233/security-fixes-verification.log`; all quality gates passing (backend lint, frontend lint, builds, placeholder guard) | Revert `apps/api/src/routes/auctions.ts` to commit before SQL injection fix |
| CONS-012 | Threads, pinned messages, and voice presence fixes: thread message routing, real-time pin updates, voice channel participant display | Done | Engineering | 2026-03-04T02:15:00Z | Thread messages fixed in `ForumChannel.tsx`, real-time pin updates in `ChannelChat.tsx`, voice presence display in `GuildOverview.tsx`; socket event listeners added for THREAD_CREATE and CHANNEL_PINS_UPDATE; verification log: `docs/migration/20260304-014233/CONS-012-COMPLETE.md`; all builds passing | Revert touched files: `messages.ts`, `socket.ts`, `api.ts`, `ForumChannel.tsx`, `ChannelChat.tsx`, `GuildOverview.tsx` |

## Quality Gates

| Gate | Status | Evidence |
|---|---|---|
| Frontend build/typecheck | Pass | `docs/migration/20260302-220738/phase3-remediation-verification.log`, `docs/migration/20260302-220738/phase3-continued-remediation-verification.log`, `docs/migration/20260302-220738/phase4-call-reliability-avatar-parity-verification.log`, `docs/migration/20260302-220738/phase4-call-and-avatar-runtime-hotfix-verification.log` |
| Frontend lint | Pass | `docs/migration/20260304-014233/security-fixes-verification.log` (eslint . --max-warnings=0 passes with zero warnings) |
| Backend build | Pass | `docs/migration/20260302-220738/phase3-remediation-verification.log`, `docs/migration/20260302-220738/phase3-continued-remediation-verification.log`, `docs/migration/20260302-220738/phase4-call-reliability-avatar-parity-verification.log`, `docs/migration/20260302-220738/phase4-call-and-avatar-runtime-hotfix-verification.log` |
| Backend lint script | Pass | `docs/migration/20260304-014233/security-fixes-verification.log` (eslint src --max-warnings=0 passes with zero warnings) |
| Placeholder/simulation CI guard | Pass | `docs/migration/20260302-220738/phase3-botbuilder-guard-verification.log` (`placeholder-guard: PASS`) |
| Endpoint matrix verification suite | Pass | `docs/migration/20260302-220738/endpoint-matrix-*-evidence.log` (generated by `tools/endpoint-matrix-evidence.mjs`) |
| Runtime no-placeholder audit | Pass | `docs/migration/20260302-220738/no-placeholder-runtime-audit.log` (generated by `tools/no-placeholder-runtime-audit.mjs`) |
| Security/config hardening closeout | Pass | `docs/migration/20260302-220738/security-config-hardening-closeout.log` (generated by `tools/security-config-hardening-closeout.mjs`) |
| Final release certification gate | Partial fail (lint zero-warning) | `docs/migration/20260303-092440/final-certification.log` |
| Migration integrity (old/new path parity) | Pass | `docs/migration/20260302-220738/cutover-parity.log`, `docs/migration/20260302-220738/phase3-remediation-verification.log` |
| Mirror hash parity | Pass | `docs/migration/20260302-220738/mirror-hashes.log` |

## RB-003 Closure Checklist

- Schema: `docs/migration/20260302-220738/rb-003-closure-checklist.schema.json`
- Artifact: `docs/migration/20260302-220738/rb-003-closure-checklist.json`
- Result: `PASS`

## Endpoint Matrix Evidence Convention

- Filename format: `docs/migration/20260302-220738/endpoint-matrix-<domain>-evidence.log`
- Mandatory fields per file: `timestamp`, `mode`, per-check `PASS|FAIL` rows, `summary`, `result`
- Generator: `tools/endpoint-matrix-evidence.mjs`

## Release Blockers

| ID | Blocker | Status | Notes |
|---|---|---|---|
| RB-001 | Frontend TypeScript build failures | Closed | Canonical + compatibility builds now pass |
| RB-002 | Frontend lint failures in production paths | Closed (warnings remain) | Lint returns success; warnings tracked for cleanup |
| RB-003 | API/frontend contract mismatches (missing route groups, method mismatch) | Closed | All contract domains are now `Implemented + Verified + Test Covered` with per-domain evidence (`endpoint-matrix-*-evidence.log`), canonical backend runtime validated on `:4000`, and route/channel normalization regressions rechecked via `rb-003-closure-checklist.json` + `final-release-certification.log`. |
| RB-004 | Zero-warning lint certification | Closed | Lint gates now passing for both frontend and backend with zero warnings; see `docs/migration/20260304-014233/security-fixes-verification.log`. |

## Endpoint Matrix

| Domain | Implemented | Verified | Test Covered | Notes |
|---|---|---|---|---|
| Core auth/guild/chat/voice routes | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-core-auth-guild-chat-voice-routes-evidence.log` |
| Discover join flow | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-discover-join-flow-evidence.log` |
| Message requests (accept/ignore/report) | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-message-requests-evidence.log` |
| Admin team / admin audit / bot moderation | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-admin-team-audit-bot-moderation-evidence.log` |
| Bot store lifecycle (list/install/review) | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-bot-store-lifecycle-evidence.log` |
| Bot builder publish linkage | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-bot-builder-publish-linkage-evidence.log` |
| Marketplace purchase/create | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-marketplace-purchase-create-evidence.log` |
| DM call/voice entry reliability | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-dm-call-voice-entry-reliability-evidence.log` |
| Route normalization for navigation entry points | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-route-normalization-navigation-entry-points-evidence.log` |
| Voice channel type compatibility | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-voice-channel-type-compatibility-evidence.log` |
| Avatar parity (top-left vs bottom-left) | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-avatar-parity-top-left-vs-bottom-left-evidence.log` |
| Bot lifecycle / marketplace full persistence | Implemented | Verified | Test Covered | Evidence: `endpoint-matrix-bot-lifecycle-marketplace-full-persistence-evidence.log` |

## No Placeholder Audit

| File/Area | Status | Findings |
|---|---|---|
| Frontend runtime pages | Closed | Runtime-path audit passed for Discover join, Message Requests, Bot Store install/review, Marketplace create/purchase, BotBuilder listing submission, and DM call canonicalization. Evidence: `docs/migration/20260302-220738/no-placeholder-runtime-audit.log`. |
| Placeholder/simulation guardrail | Implemented | `tools/placeholder-guard.mjs` enforced by `guard:placeholders` and `verify:prod` scripts in both apps; allowlist tracked in `tools/placeholder-guard.allowlist.json`. |

## Rollback Register

- Primary rollback map: `docs/migration/20260302-220738/rollback-map.csv`
- Pre-cutover backups use suffix: `.preconsolidation-20260302-221807`

## Risk Register

| Risk | Impact | Mitigation | Status |
|---|---|---|---|
| Broken tooling from path migration | High | Compatibility symlinks + parity checks | Mitigated |
| Incomplete frontend blocker remediation | High | Final certification gate (`web build + lint + guard`, endpoint matrix suite, runtime audit) completed with PASS evidence bundle | Mitigated |
| Hidden legacy dependency on archived repos | Medium | Legacy symlink compatibility retained | Mitigated |
| DM call failures from route/user-id mismatch and mixed channel-type parsing | High | Canonical DM channel ID resolution in frontend + legacy route normalization + backend voice type normalization + DM membership validation | Mitigated |
| Local runtime accidentally bound to non-canonical backend on shared port 4000 | High | Canonical API process now re-bound to `:4000`; runtime capability endpoint check added to verification evidence for this batch | Mitigated |
| Admin invite acceptance role model currently tied to `users.isAdmin` for full access | Medium | Scoped admin authorization introduced via `admin_user_scopes`; legacy `isAdmin=true` users backfilled to full scopes; admin routes now scope-gated | Mitigated |
| Discover join route bypasses invite-code flow for public guilds by design | Low | Restricted to `isDiscoverable=true`; private guilds still require invite path | Accepted |
| Zero-warning lint gate across web/api/shared not currently certifiable | Medium | Enforce lint debt burn-down and add API lint script before next final certification run; blocker evidence in `docs/migration/20260303-092440/lint-zero-warnings.log` | Open |


## Key Directories

| Directory | Purpose |
|-----------|---------|
| **Frontend** | `/Volumes/Project BUS/GratoniteFinalForm/apps/web/` |
| **Backend** | `/Volumes/Project BUS/GratoniteFinalForm/apps/api/` |
| **Task file** | `/Users/ferdinand/work/tasks/d42f37a3-2c2a-4f4b-b201-737728ac2950/task.md.resolved` |
| **Dev servers** | Frontend: `localhost:5174` / Backend: `localhost:4000` / LiveKit: `localhost:7880` |

---

## Tech Stack

### Frontend
- **Framework**: React 18.3.1 + TypeScript 5.6.2
- **Build Tool**: Vite 5.4.10
- **Routing**: React Router DOM 7.13.1
- **Real-time**: Socket.io Client 4.8.3
- **Voice/Video**: LiveKit Client 2.17.2
- **Icons**: Lucide React
- **Animation**: Framer Motion
- **Virtualization**: TanStack React Virtual
- **Testing**: Playwright 1.58.2
- **Styling**: Inline CSS with CSS variables only (no Tailwind, no shadcn/ui, no CSS modules, no styled-components)

### Backend
- **Runtime**: Node.js with Express 5.2.1
- **Language**: TypeScript 5.9.3
- **Real-time**: Socket.io 4.8.3
- **Database**: PostgreSQL via Drizzle ORM 0.45.1
- **Auth**: Argon2 (password hashing) + JWT (JSON Web Tokens)
- **Voice**: LiveKit Server SDK 2.15.0
- **Caching**: Redis via ioredis 5.10.0
- **Email**: Nodemailer 8.0.1
- **File Upload**: Multer 2.1.0
- **Validation**: Zod 4.3.6

### Infrastructure (Docker Compose)
- **PostgreSQL**: Port 5433 (avoids conflicts with system Postgres)
- **Redis**: Port 6379
- **LiveKit Server**: Ports 7880 (HTTP/WS), 7881 (RTC/TCP), 7882 (RTC/UDP)
  - Dev credentials: `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret`
  - LiveKit Cloud (production): `wss://<your-livekit-host>`

---

## Frontend Architecture

### Entry Points
| File | Purpose |
|------|---------|
| `src/main.tsx` | React DOM entry point (StrictMode + ThemeProvider) |
| `src/App.tsx` | Main app shell with routing, state management, modal orchestration |
| `src/index.css` | Global CSS variables and base styles |

### Pages (`src/pages/`)

#### Auth Pages (`pages/auth/`)
| File | Route | Purpose |
|------|-------|---------|
| `Login.tsx` | `/login` | User login form |
| `Register.tsx` | `/register` | Account creation form |
| `Verify.tsx` | `/verify` | Email verification |

#### App Pages (`pages/app/`)
| File | Purpose |
|------|---------|
| `Home.tsx` | Dashboard / activity feed |
| `Discover.tsx` | Public guild discovery and browsing |
| `Friends.tsx` | Friend list management (online, all, pending, blocked) |
| `DirectMessage.tsx` | DM channel view with voice/video call support |
| `MessageRequests.tsx` | Pending message requests from non-friends |
| `Shop.tsx` | In-app shop / store for cosmetics and items |
| `Marketplace.tsx` | User-to-user marketplace |
| `Inventory.tsx` | User's owned cosmetics and items |
| `Gacha.tsx` | Gacha / loot box system |
| `FameDashboard.tsx` | Fame and reputation tracking |
| `CreatorDashboard.tsx` | Creator tools and analytics |
| `BotStore.tsx` | Bot discovery and installation |
| `BotBuilder.tsx` | Bot creation and configuration tool |
| `ThemeBuilder.tsx` | Theme customization editor |
| `GratoniteDashboard.tsx` | Admin-like overview dashboard |
| `HelpCenter.tsx` | Help documentation and articles |

#### Guild Pages (`pages/guilds/`)
| File | Purpose |
|------|---------|
| `ChannelChat.tsx` | Text channel messaging view |
| `VoiceChannel.tsx` | Voice channel with audio/video/screen share |
| `ForumChannel.tsx` | Forum-style threaded discussions |
| `WikiChannel.tsx` | Knowledge base / wiki pages |
| `QAChannel.tsx` | Q&A format channel |
| `EventScheduler.tsx` | Guild event creation and management |
| `Leaderboard.tsx` | Guild member rankings |
| `AuditLog.tsx` | Guild-level activity audit log |
| `GuildOverview.tsx` | Guild information and settings |
| `AdminAnalytics.tsx` | Guild analytics dashboard |

#### Admin Pages (`pages/admin/`)
| File | Purpose |
|------|---------|
| `AdminTeam.tsx` | Team / staff management |
| `AdminAuditLog.tsx` | Global activity audit log |
| `AdminBotModeration.tsx` | Bot moderation controls |
| `AdminFeedback.tsx` | User feedback review |
| `AdminReports.tsx` | Content / user report moderation |

#### Other Pages
| File | Purpose |
|------|---------|
| `InviteAccept.tsx` | Accept guild invite links |
| `ErrorStates.tsx` | Error pages (404, etc.) |

### Components (`src/components/`)

#### UI Components (`components/ui/`) — 22 files
| File | Purpose |
|------|---------|
| `Avatar.tsx` | User avatar display with status indicators |
| `VoiceBar.tsx` | Persistent voice channel controls bar |
| `CommandPalette.tsx` | Cmd+K command search and execution |
| `ContextMenu.tsx` | Right-click context menus |
| `Tooltip.tsx` | Hover tooltips |
| `ToastManager.tsx` | Toast notification system |
| `AchievementToast.tsx` | Achievement unlock notifications |
| `ModalWrapper.tsx` | Modal container / backdrop |
| `ThemeProvider.tsx` | Theme context provider (CSS variables) |
| `ConnectionBanner.tsx` | Connection status indicator bar |
| `ErrorBoundary.tsx` | React error catching wrapper |
| `ErrorState.tsx` | Error fallback UI display |
| `EmptyState.tsx` | Empty state placeholder displays |
| `Skeleton.tsx` | Loading skeleton components |
| `SkeletonLoader.tsx` | Skeleton loader variants |
| `BackgroundMedia.tsx` | Background animations / media |
| `Physics.tsx` | Physics-based UI animations |
| `GachaReveal.tsx` | Loot / gacha reveal animation |
| `AmbientPlayer.tsx` | Background ambient music player |
| `UserProfilePopover.tsx` | Hover user profile card |
| `TopBarActions.tsx` | Top navigation bar actions |
| `ActivityCard.tsx` | Activity display card |

#### Chat Components (`components/chat/`) — 5 files
| File | Purpose |
|------|---------|
| `ThreadPanel.tsx` | Message thread side panel |
| `ChatPoll.tsx` | In-chat voting polls |
| `EmojiPicker.tsx` | Emoji selection picker |
| `SoundboardMenu.tsx` | Soundboard quick-play buttons |
| `RichTextRenderer.tsx` | Markdown / rich text rendering |

#### Modal Components (`components/modals/`) — 14 files
| File | Purpose |
|------|---------|
| `SettingsModal.tsx` | User settings (account, appearance, etc.) |
| `UserProfileModal.tsx` | User profile editing |
| `GuildSettingsModal.tsx` | Guild configuration (channels, roles, etc.) |
| `CreateGuildModal.tsx` | New guild creation wizard |
| `InviteModal.tsx` | Invite users to guild dialog |
| `DMSearchModal.tsx` | Search for DM users |
| `GlobalSearchModal.tsx` | Global content search |
| `NotificationModal.tsx` | Notification preferences |
| `KeyboardShortcutsModal.tsx` | Keyboard shortcut reference |
| `BugReportModal.tsx` | Bug report submission form |
| `ScreenShareModal.tsx` | Screen sharing controls |
| `PresenceMenu.tsx` | Status / presence selection menu |
| `OnboardingModal.tsx` | First-time user setup flow |
| `ForwardModal.tsx` | Message forwarding dialog |

#### Guards (`components/guards/`)
| File | Purpose |
|------|---------|
| `RequireAdmin.tsx` | Admin-only route protection wrapper |

### State Management (`src/contexts/`)
| File | Purpose |
|------|---------|
| `UserContext.tsx` | User authentication, profile, and session state |
| `VoiceContext.tsx` | Voice channel connection and participant state |

### Hooks (`src/hooks/`)
| File | Purpose |
|------|---------|
| `useVoiceSounds.ts` | Voice join/leave/mute notification sounds |

### Libraries (`src/lib/`)
| File | Purpose |
|------|---------|
| `api.ts` | REST API client wrapper (all backend endpoints) |
| `socket.ts` | Socket.io connection management and event handling |
| `useLiveKit.ts` | LiveKit WebRTC hook for voice/video calls — room connection, audio/video tracks, participant management, mute/deafen/camera/screen share |

### Utilities (`src/utils/`)
| File | Purpose |
|------|---------|
| `SoundManager.ts` | Audio playback control (notification sounds, etc.) |
| `colors.ts` | Color utilities (gradient generation, role colors) |
| `activity.ts` | Activity tracking helpers |

### Layouts (`src/layouts/`)
| File | Purpose |
|------|---------|
| `AuthLayout.tsx` | Auth page layout wrapper |

### Data (`src/data/`)
| File | Purpose |
|------|---------|
| `helpArticles.ts` | Help center article content |

---

## Backend Architecture

### Entry Point
| File | Purpose |
|------|---------|
| `src/index.ts` | Express server setup, middleware, route mounting, Socket.io init |

### API Routes (`src/routes/`) — 37 Route Modules

#### Authentication & Users
| File | Endpoints | Purpose |
|------|-----------|---------|
| `auth.ts` | `/api/v1/auth/*` | Register, login, email verification, token refresh, logout |
| `users.ts` | `/api/v1/users/*` | User profiles, presence, account updates, avatar uploads |
| `settings.ts` | `/api/v1/users/@me/settings/*` | User preference storage |

#### Guild Management
| File | Endpoints | Purpose |
|------|-----------|---------|
| `guilds.ts` | `/api/v1/guilds/*` | Guild CRUD, member management, discovery |
| `roles.ts` | `/api/v1/guilds/:guildId/roles/*` | Role CRUD, permission assignment |
| `bans.ts` | `/api/v1/guilds/:guildId/bans/*` | User banning |
| `emojis.ts` | `/api/v1/guilds/:guildId/emojis/*` | Custom guild emoji management |
| `scheduled-events.ts` | `/api/v1/guilds/:guildId/scheduled-events/*` | Event scheduling |

#### Channels
| File | Endpoints | Purpose |
|------|-----------|---------|
| `channels.ts` | `/api/v1/guilds/:guildId/channels/*` | Channel CRUD within guilds |
| `channel-operations.ts` | `/api/v1/channels/:channelId/*` | Channel-specific operations |
| `channel-permissions.ts` | `/api/v1/channels/:channelId/permissions/*` | Per-channel permission overrides |

#### Messaging
| File | Endpoints | Purpose |
|------|-----------|---------|
| `messages.ts` | `/api/v1/channels/:channelId/messages/*` | Message CRUD, typing indicators. Dispatches webhook events to bots on every guild message. |
| `threads.ts` | `/api/v1/channels/:channelId/threads/*` | Thread creation and management |
| `reactions.ts` | `/api/v1/channels/:channelId/reactions/*` | Message reactions |
| `pins.ts` | `/api/v1/channels/:channelId/pins/*` | Pinned messages |

#### Voice
| File | Endpoints | Purpose |
|------|-----------|---------|
| `voice.ts` | `/api/v1/voice/*` | LiveKit token generation, join/leave voice channels |
| `voice-states.ts` | `/api/v1/channels/:channelId/voice-states*` | Active voice participant tracking |

#### Social
| File | Endpoints | Purpose |
|------|-----------|---------|
| `relationships.ts` | `/api/v1/relationships/*` | Friends, friend requests, blocks, DM channel creation |

#### Economy & Cosmetics
| File | Endpoints | Purpose |
|------|-----------|---------|
| `economy.ts` | `/api/v1/economy/*` | Wallet balance, transaction ledger, rewards (daily check-in, chat rewards), spending |
| `shop.ts` | `/api/v1/shop/*` | Item catalog, purchases, inventory. Soundboard → `user_soundboard`. Equip/unequip per type. |
| `admin-shop.ts` | `/api/v1/admin/shop/*` | Admin CRUD for shop items. `POST /seed` seeds 20 real launch items (frames, decorations, effects, nameplates, soundboard). Requires `admin.shop.manage` scope (with legacy `isAdmin` compatibility bootstrap). |
| `inventory.ts` | `/api/v1/inventory` | **Unified inventory** — merges `userInventory` (shop), `userSoundboard` (soundboard), and `userCosmetics` (creator) into a single response with `source` discriminator. |
| `cosmetics.ts` | `/api/v1/cosmetics/*` | Creator cosmetics — CRUD, file upload (PNG/GIF/WEBP ≤2MB, audio ≤1MB), submit for review, equip/unequip. Admin sub-routes: list pending, approve, reject. |
| `auctions.ts` | `/api/v1/auctions/*` | Auction house — create, list, get, bid (atomic with escrow + refund), cancel. Seller must own cosmetic. |
| `themes.ts` | `/api/v1/themes/*` | Theme creation, sharing, user theme preferences |

#### Bots
| File | Endpoints | Purpose |
|------|-----------|---------|
| `bot-store.ts` | `/api/v1/bot-store/*` | Public bot discovery, installation, reviews |
| `bot-applications.ts` | `/api/v1/bots/applications/*` | Webhook bot management — register, list, get, update, delete, rotate API token. One-time secret reveal on creation. |

#### Content & Community
| File | Endpoints | Purpose |
|------|-----------|---------|
| `wiki.ts` | `/api/v1/wiki/*` | Wiki page CRUD, revision history |
| `polls.ts` | `/api/v1/channels/:channelId/polls/*`, `/api/v1/polls/*` | Poll creation, voting, results |
| `leaderboard.ts` | `/api/v1/leaderboard/*` | Global and guild-specific rankings |

#### Search & Notifications
| File | Endpoints | Purpose |
|------|-----------|---------|
| `search.ts` | `/api/v1/search/*` | Full-text search across content |
| `notifications.ts` | `/api/v1/notifications/*` | User notification management |

#### Moderation & Admin
| File | Endpoints | Purpose |
|------|-----------|---------|
| `reports.ts` | `/api/v1/reports/*` | Content and user report submission |
| `feedback.ts` | `/api/v1/feedback/*` | User feedback submission |
| `bug-reports.ts` | `/api/v1/bug-reports/*` | Bug report submission |
| `admin.ts` | `/api/v1/admin/*` | Team invites/membership, global admin audit log, bot moderation queue/actions |

#### Files
| File | Endpoints | Purpose |
|------|-----------|---------|
| `files.ts` | `/api/v1/files/*` | File upload (avatars, attachments) and retrieval |
| `invites.ts` | `/api/v1/invites/*` | Invite link generation and acceptance |

### Database Schema (`src/db/schema/`) — 37 Tables (8 migrations prepared/applied)

#### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | User accounts — email, username, display name, avatar, status, presence, `isAdmin` (legacy platform-admin flag) |
| `auth` | Refresh tokens, email verification tokens |
| `guilds` | Servers — name, description, icon, owner, settings |
| `guild_members` | Guild membership — user, guild, joined date, nickname |
| `channels` | Text/voice/forum/wiki/QA channels — name, type, guild, position, topic |
| `dm_channel_members` | DM channel participants |

#### Content Tables
| Table | Purpose |
|-------|---------|
| `messages` | Message storage — `authorId` (nullable for bot messages), content, channel, attachments, edited |
| `threads` | Message threads — parent message, channel, metadata |
| `pins` | Pinned messages per channel |
| `reactions` | Message reactions — emoji, user, message |
| `emojis` | Custom guild emojis — name, image, guild |
| `files` | File metadata — filename, size, mimetype, URL, uploader |

#### Permissions & Moderation
| Table | Purpose |
|-------|---------|
| `roles` | Guild roles — name, color, permissions bitmask, position |
| `channel_overrides` | Per-channel permission overrides for roles/users |
| `bans` | Banned users — user, guild, reason, moderator |
| `audit` | Audit log entries — action, actor, target, details, timestamp |
| `reports` | Content/user reports — type, reporter, target, reason, status |
| `notifications` | User notifications — type, content, read status, link |
| `admin_team_invites` | Pending team invites — email, role, token, status, accepted metadata |
| `admin_audit_log` | Global admin activity trail — actor, action, target, metadata |
| `admin_user_scopes` | Scoped platform admin permissions — explicit per-user scope grants (team/audit/shop/reports/etc.) |

#### Social
| Table | Purpose |
|-------|---------|
| `relationships` | Friends, friend requests, blocks — user pairs, type, status |
| `events` | Scheduled guild events — name, description, time, channel, creator |

#### Economy & Cosmetics
| Table | Purpose |
|-------|---------|
| `user_wallets` | Per-user currency wallet — `balance`, `lifetimeEarned`, `lifetimeSpent` |
| `economy_ledger` | Transaction log — direction (earn/spend), amount, source, contextKey |
| `shop_items` | Official shop catalog — name, price, rarity, `type` (avatar_frame / decoration / profile_effect / nameplate / soundboard), `assetUrl`, `assetConfig` (JSONB), `duration`, `metadata`, `available` |
| `user_inventory` | User-owned shop items (non-soundboard) — userId, itemId, `equipped` (bool) |
| `user_soundboard` | Personal soundboard sounds — userId, itemId. UNIQUE(userId, itemId). |
| `cosmetics` | Creator-made cosmetics — name, type, `assetUrl`, `assetConfig` (JSONB), `status` (draft / pending_review / approved / rejected), `rejectionReason`, `isPublished`, `price` |
| `user_cosmetics` | User ownership of creator cosmetics — userId, cosmeticId, `equipped` |
| `auctions` | Active cosmetic auctions — cosmeticId, sellerId, startingPrice, reservePrice, `currentBid`, `currentBidderId`, `endsAt`, `status` (active/ended/cancelled) |
| `auction_bids` | Bid history per auction — auctionId, bidderId, amount. Indexed (auctionId, amount DESC). |
| `themes` | Theme templates and user-created themes — colors, settings |

#### Bots
| Table | Purpose |
|-------|---------|
| `bot_listings` | Public bot store listings — name, description, categories, installs |
| `bot_reviews` | User reviews on bot listings |
| `bot_installs` | Bot installations per guild — botId, guildId |
| `bot_applications` | Webhook bot registrations — ownerId, name, `webhookUrl`, `webhookSecretKey` (HMAC secret), `apiToken` (long-lived JWT), `listingId` (null until published), `isActive` |

#### Features
| Table | Purpose |
|-------|---------|
| `polls` | Poll questions and response tracking |
| `wiki` | Wiki pages with revision history |
| `settings` | User preference key-value storage |

### Middleware (`src/middleware/`)
| File | Purpose |
|------|---------|
| `auth.ts` | JWT authentication — extracts and verifies Bearer token, attaches `req.userId` |
| `validate.ts` | Zod schema validation for request body/params/query |
| `rateLimit.ts` | API rate limiting (auth-specific stricter limits + global limits) |

### Support Libraries (`src/lib/`)
| File | Purpose |
|------|---------|
| `jwt.ts` | JWT token generation (access + refresh + bot tokens) and verification |
| `socket-io.ts` | Socket.io server instance management |
| `socket/index.ts` | Socket event handling — authentication, room joining, presence tracking, typing |
| `redis.ts` | Redis client — presence caching, voice state, rate limit counters |
| `mailer.ts` | Email sending via Nodemailer (verification emails, notifications) |
| `notifications.ts` | Notification creation and real-time delivery |
| `audit.ts` | Audit log entry creation utilities |
| `webhook-dispatch.ts` | **Outbound webhook dispatcher** — fires on every guild message. Looks up installed bots, signs payload with HMAC-SHA256 (`X-Gratonite-Signature`), POSTs to bot's `webhookUrl` with 3s timeout. Processes `send_message` action responses (inserts message with `authorId: null`). Fire-and-forget, never blocks the request. |
| `auction-cron.ts` | **Auction closure cron** — runs every 60s via `setInterval`. Finds expired active auctions, atomically transfers cosmetic to winner, pays seller, logs ledger entries, sets `status: 'ended'`. |

---

## Feature Implementation Summary

| Feature | Frontend Pages/Components | Backend Routes | DB Tables |
|---------|--------------------------|----------------|-----------|
| **Authentication** | Login, Register, Verify | `auth.ts` | users, auth |
| **User Profiles** | UserProfileModal, UserProfilePopover, Avatar | `users.ts`, `settings.ts` | users, settings |
| **Guilds (Servers)** | CreateGuildModal, GuildSettingsModal, Discover, GuildOverview | `guilds.ts`, `roles.ts` | guilds, guild_members, roles |
| **Channels** | ChannelChat, VoiceChannel, ForumChannel, WikiChannel, QAChannel | `channels.ts`, `channel-operations.ts`, `channel-permissions.ts` | channels, channel_overrides |
| **Text Messaging** | ChannelChat, DirectMessage, RichTextRenderer, ThreadPanel | `messages.ts`, `threads.ts`, `reactions.ts`, `pins.ts` | messages, threads, reactions, pins |
| **Voice/Video** | VoiceChannel, VoiceBar, VoiceContext, useLiveKit | `voice.ts`, `voice-states.ts` | (Redis for voice state) |
| **Screen Sharing** | ScreenShareModal, VoiceChannel | `voice.ts` | — |
| **Friends & Social** | Friends, DirectMessage, MessageRequests | `relationships.ts` | relationships, dm_channel_members |
| **Economy / Wallet** | Shop, Inventory, Marketplace | `economy.ts` | user_wallets, economy_ledger |
| **Official Shop** | Shop.tsx (tabs: Frames, Decorations, Effects, Nameplates, Soundboard) | `shop.ts`, `admin-shop.ts` | shop_items, user_inventory, user_soundboard |
| **Unified Inventory** | Inventory.tsx (All, Frames, Effects, Themes, Canvas, Nameplates, Soundboard tabs) | `inventory.ts` | user_inventory, user_soundboard, user_cosmetics |
| **Creator Cosmetics** | CreatorDashboard.tsx (upload + in-app config editor), Marketplace.tsx | `cosmetics.ts` | cosmetics, user_cosmetics |
| **Cosmetics Admin** | (admin routes in `cosmetics.ts`) | `cosmetics.ts` `/admin/cosmetics/*` | cosmetics |
| **Shop Admin** | (admin routes in `admin-shop.ts`) | `admin-shop.ts` `/admin/shop/*` | shop_items |
| **Auction House** | Marketplace.tsx (auction section, real-time bid modal, countdown) | `auctions.ts`, `auction-cron.ts` (lib) | auctions, auction_bids, user_wallets, economy_ledger |
| **Gacha / Loot** | Gacha, GachaReveal | `economy.ts`, `shop.ts` | shop_items, economy_ledger |
| **Gamification** | Leaderboard, FameDashboard, AchievementToast | `leaderboard.ts`, `economy.ts` | user_wallets |
| **Bot Store (native)** | BotStore.tsx (Custom/Native badge, install, reviews) | `bot-store.ts` | bot_listings, bot_reviews, bot_installs |
| **Webhook Bots** | BotBuilder.tsx (Webhook tab — register, one-time secret reveal) | `bot-applications.ts`, `webhook-dispatch.ts` (lib) | bot_applications, bot_installs |
| **Polls** | ChatPoll | `polls.ts` | polls |
| **Wiki** | WikiChannel | `wiki.ts` | wiki |
| **Events** | EventScheduler | `scheduled-events.ts` | events |
| **Search** | GlobalSearchModal, DMSearchModal, CommandPalette | `search.ts` | — |
| **Notifications** | NotificationModal, ToastManager | `notifications.ts` | notifications |
| **File Uploads** | (attachments in chat, avatar uploads, cosmetic assets) | `files.ts`, `cosmetics.ts` | files |
| **Invites** | InviteModal, InviteAccept | `invites.ts` | — |
| **Custom Emoji** | EmojiPicker | `emojis.ts` | emojis |
| **Moderation** | AdminReports, AdminFeedback, AdminBotModeration | `reports.ts`, `feedback.ts`, `admin.ts` | reports |
| **Audit Logs** | AuditLog, AdminAuditLog | `admin.ts` | audit |
| **Bug Reports** | BugReportModal | `bug-reports.ts` | — |
| **Help / Docs** | HelpCenter.tsx | (static) | helpArticles.ts (15 articles: Shop, Inventory, Cosmetics, Creator, Marketplace, Auctions, Bots) |
| **Onboarding** | OnboardingModal | — | — |
| **Theming** | ThemeProvider, ThemeBuilder, SettingsModal | `themes.ts` | themes |
| **Ambient Audio / Soundboard** | AmbientPlayer, SoundboardMenu | `shop.ts` | user_soundboard |

---

## Real-Time Architecture

### Socket.io Events
The app uses Socket.io for real-time features:
- **Presence**: User online/offline/idle/DND status broadcasts
- **Typing indicators**: `TYPING_START` events in channels
- **Message delivery**: Real-time message, edit, and delete events (`MESSAGE_CREATE`, `MESSAGE_UPDATE`, `MESSAGE_DELETE`)
- **Voice state**: `VOICE_STATE_UPDATE` for join/leave/mute changes
- **Guild updates**: Member join/leave, role changes, channel updates
- **Notifications**: Real-time notification delivery
- **Auction bids**: `auction:bid_update` broadcast to all clients when a bid is placed (updates current bid and time remaining in Marketplace UI)

### LiveKit WebRTC (Voice/Video)
- Backend generates LiveKit access tokens via `livekit-server-sdk`
- Frontend connects via `livekit-client` SDK through `useLiveKit.ts` hook
- Supports: audio, video, screen sharing, per-participant volume, mute/deafen
- Local dev: Docker LiveKit server on `ws://localhost:7880`
- Production: LiveKit Cloud at `wss://<your-livekit-host>`

---

## Environment Variables (Backend `.env`)

```env
# Database
DATABASE_URL=postgresql://gratonite:gratonite@localhost:5433/gratonite

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>

# SMTP (email)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@gratonite.chat

# App URLs
APP_URL=http://localhost:5174
CORS_ORIGIN=http://localhost:5174
PORT=4000

# LiveKit (local dev)
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# LiveKit Cloud (production)
# LIVEKIT_URL=wss://<your-livekit-host>
# LIVEKIT_API_KEY=<your-livekit-api-key>
# LIVEKIT_API_SECRET=<your-livekit-api-secret>
```

---

## Development Commands

```bash
# Start infrastructure (Postgres, Redis, LiveKit)
cd "/Volumes/Project BUS/GratoniteFinalForm/apps/api"
docker compose up -d

# Start backend API
cd "/Volumes/Project BUS/GratoniteFinalForm/apps/api"
npx tsx src/index.ts

# Start frontend dev server
cd "/Volumes/Project BUS/GratoniteFinalForm/apps/web"
npm run dev
```

---

---

## Recently Implemented (March 2026)

### Phase 1 — Schema Migrations (migration files 0004, 0005)
- Extended `shop_items`: added `type`, `assetUrl`, `assetConfig`, `duration`, `metadata`
- Extended `user_inventory`: added `equipped boolean`
- Extended `cosmetics`: added `assetConfig`, `status`, `rejectionReason`
- New tables: `user_soundboard`, `auctions`, `auction_bids`, `bot_applications`

### Phase 2 — Official Shop
- `POST /admin/shop/seed` — idempotent seed with 20 real named items (4 frames, 4 decorations, 3 effects, 4 nameplates, 5 soundboard)
- Purchase flow routes soundboard items to `user_soundboard` with conflict guard (`ALREADY_OWNED`)
- Equip system: unequips all same-type items before equipping new one

### Phase 3 — Unified Inventory
- `GET /inventory` merges all ownership tables; frontend tabs filter by `type`

### Phase 4 — Creator Marketplace
- File upload: PNG/GIF/WEBP ≤2MB for visual types; MP3/OGG/WAV ≤1MB for soundboard
- Admin moderation: pending list, approve, reject with reason
- Submit-for-review gate: requires `assetUrl` OR `assetConfig`, prevents double-submission

### Phase 5 — Auction House
- Atomic bid transactions: deduct bidder → refund previous bidder → update auction → insert bid
- Auction cron closes expired auctions and transfers cosmetic + currency atomically

### Phase 6 — Bot Webhooks
- Webhook bots: HMAC-SHA256 signed payloads, `webhookSecretKey` shown once on creation
- `apiToken` is a long-lived JWT (`type: 'bot'`) bots use to call the Gratonite API
- Bot `send_message` responses insert messages with `authorId: null` (renders as system/bot message)

### Phase 7 — Help Documentation
- 15 help articles added to `helpArticles.ts` covering: Shop, Inventory, all cosmetic types, Creator Dashboard, Cosmetics Editor, Marketplace, Auction House, Bots Overview, Adding a Bot, Building a Webhook Bot, Discord Bot Migration

## Final Release Sign-off

- Signed at (UTC): `2026-03-03T13:59:30Z`
- Blocker table status: `RB-001 Closed`, `RB-002 Closed`, `RB-003 Closed`
- Evidence bundle:
  - `docs/migration/20260302-220738/final-release-certification.log`
  - `docs/migration/20260302-220738/rb-003-closure-checklist.json`
  - `docs/migration/20260302-220738/no-placeholder-runtime-audit.log`
  - `docs/migration/20260302-220738/security-config-hardening-closeout.log`
  - `docs/migration/20260302-220738/endpoint-matrix-*-evidence.log`

*Last updated: March 3, 2026*
