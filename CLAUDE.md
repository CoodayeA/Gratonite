# Gratonite Project

## Design System & Mockups

- **Design file**: `/Users/ferdinand/Desktop/gratonite.pen` contains ALL mockup screens for the entire app
- The .pen file has **8 top-level frames**: Auth Flow + Nav Hubs, Chat Ecosystem, Discovery + Economy, Activity + Creation, Backend Features, Events Creation, UI Menus, UX Polish
- **IMPORTANT**: Every screen has BOTH a **Desktop** and **Mobile** mockup variant
  - The **web app** (`apps/web`) must follow the **Desktop** mockups
  - The **mobile app** (`apps/mobile`, Expo/React Native) must follow the **Mobile** mockups
  - Never mix desktop mockups into mobile or vice versa

## Design Tokens (from .pen file)

- `$bg-charcoal` — Main background color
- `$bg-purple-velvet` / `$bg-purple-dark` — Gradient backgrounds (primarily mobile)
- `$bg-surface` — Surface/sidebar background
- `$accent-gold` — Primary accent color (gold/yellow)
- `$text-on-gold` — Text color on gold backgrounds
- `$border-subtle` — Subtle border color
- `$radius-md` — Medium border radius

## Architecture

- **Monorepo**: Turborepo + pnpm workspaces
- **apps/web**: Vite + React (SPA, desktop layout)
- **apps/mobile**: Expo + React Native (iOS/Android)
- **apps/api**: Node.js + Express + Drizzle ORM
- **apps/desktop**: Electron wrapper
- **packages/db**: Drizzle schema + migrations (PostgreSQL)
- **packages/types**: Shared TypeScript types

## Infrastructure

- PostgreSQL 16 on port 5433 (Docker via Colima)
- Redis 7 on port 6379 (Docker via Colima)
- MinIO on ports 9000/9001 (S3-compatible storage)
- LiveKit on port 7880 (WebRTC)
- API server on port 4000
- Web dev server on port 5174

## Key Patterns

- Auth: JWT-based with MFA support, Zod schema validation
- `me.profile` can be null — always use optional chaining (`me.profile?.displayName ?? me.username`)
- Registration only requires: email, username, password (no first/last name, no DOB)
- displayName defaults to username on the backend when not provided
- React StrictMode in dev causes double-invocation of effects — handle gracefully in performance utils
- Branch: `ralph/massive-ui-ux-upgrade`

## Web App Layout (Desktop Mockup)

The desktop mockup uses a 3-column layout:
1. **Icon Rail** (72px) — Vertical strip with Home, guild icons, Add, Discover, Settings
2. **Sidebar** (280px) — Context-dependent: Friends list, Channel list, Shop categories, etc.
3. **Main Content** — Page content area

Plus a **top bar** (36px) showing "GRATONITE" branding and controls.

The current web app has this structure via `AppLayout.tsx` with `GuildRail` + `ChannelSidebar` + `app-main`. There's also a `DmTabBar` that shows horizontal tabs (Friends, Shop, Gratonite, Leaderboard) when not in guild context.
