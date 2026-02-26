# Gratonite Mobile App — UI/UX Handoff Document

> Comprehensive audit of the Gratonite web app for mobile redesign.
> Generated from full source code analysis — February 2026.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Navigation Architecture](#2-navigation-architecture)
3. [Screen Inventory](#3-screen-inventory)
4. [Feature Matrix](#4-feature-matrix)
5. [Screen Details](#5-screen-details)
6. [Backend-Ready Features (No Web UI Yet)](#6-backend-ready-features-no-web-ui-yet)
7. [Economy & Gamification System](#7-economy--gamification-system)
8. [Design Tokens & Theming](#8-design-tokens--theming)
9. [Mobile-Specific Considerations](#9-mobile-specific-considerations)

---

## 1. Platform Overview

**Gratonite** is a community platform (similar to Discord) with:
- **Portals** (servers/guilds) with text, voice, announcement, forum, and wiki channels
- **Direct Messages** (1:1 and group DMs) with voice/video calling
- **Friends system** with requests, blocking
- **Discovery** for browsing public portals, bots, and themes
- **Economy** — "Gratonites" virtual currency earned through activity, spent in a cosmetics shop
- **Rich profiles** — banners, avatars, decorations, effects, nameplates, bio, widgets, custom colors
- **Voice/Video** — LiveKit-based WebRTC for guild voice channels and DM calls
- **Theming** — 8 built-in themes + user-created themes with full token customization

### Tech Stack (Mobile)
- React Native + Expo SDK 54
- expo-image for optimized image loading
- Zustand for state management
- TanStack Query for data fetching
- FlashList for performant lists
- Socket.IO for real-time events
- LiveKit for voice/video

### File/Image URLs
- All user content (avatars, banners, icons, emoji, attachments) served via: `GET /api/v1/files/{hash}`
- No auth required to fetch files
- Hash format: `{sha256hex}.{ext}` (e.g., `abc123def.webp`, `abc123def.gif`)

---

## 2. Navigation Architecture

### Web App Current Navigation

**Desktop layout (3 columns):**
1. **Guild Rail** (leftmost) — Home icon, user avatar, discover, shop, create portal, guild list, notifications, settings
2. **Channel Sidebar** — Guild header dropdown, channel list (text + voice by category), or DM list
3. **Main Content** — Messages, voice view, or page content
4. Optional **Right Panel** — Member list, DM profile, pinned messages, search, threads

**Web Mobile Bottom Nav (5 tabs):**
| Tab | Routes |
|-----|--------|
| Home | `/` (Friends), `/dm/*`, `/friends` |
| Portals | Opens guild rail drawer |
| Discover | `/discover` |
| Inbox | `/notifications` (with unread badge) |
| You | `/settings`, `/shop`, `/leaderboard`, `/gratonite` |

### Proposed Mobile Screens (based on web features)

The mobile app needs to support all the same features but with touch-first navigation. Key navigation entry points:

**Primary tabs** should provide access to:
- Home / Friends / DMs
- Portals (guild list + channels)
- Discovery
- Notifications / Activity
- Profile / Settings / Shop

---

## 3. Screen Inventory

### Auth Screens (Pre-login)
| Screen | Description |
|--------|-------------|
| **Login** | Email/username + password. MFA flow (authenticator code or backup code) |
| **Register** | Email, display name, username (live availability check), password, date of birth (16+ required) |
| **Verify Email Pending** | "Check your email" + resend button |
| **Verify Email Confirm** | Token-based verification landing (success/error states) |
| **Complete Account Setup** | Post-OAuth: set display name + username |

### Main App Screens
| Screen | Description |
|--------|-------------|
| **Friends** | Filter tabs: All / Online / Pending / Blocked. Friend rows with presence, message button, accept/decline for pending |
| **DM List** | Sorted by recent message. Each row: avatar, name, last message preview (40 char), relative time, unread badge, close button |
| **DM Chat** | TopBar (avatar + name + call buttons + info toggle), message list, typing indicator, composer |
| **Group DM Chat** | Same as DM but with group name, member count |
| **Portal List** | All joined portals with icons, names, unread badges, voice activity badges |
| **Portal View** | Channel list organized by category (text + voice sections, collapsible). Guild header with name + dropdown menu |
| **Channel Chat** | TopBar (# + name + topic + action buttons), message list, typing indicator, composer |
| **Voice Channel** | Voice participant view with mute/deafen/disconnect controls, screen share, video tiles |
| **DM Call** | Voice/video call overlay with accept/decline for incoming, controls for active call |
| **Discover** | 3 tabs: Portals (search + sort + tag filter + gallery), Bots (placeholder), Themes (placeholder) |
| **Shop** | 6 tabs: Avatar Decorations, Profile Effects, Nameplates, Soundboard, Gratonites Shop, Creator |
| **Gratonite Dashboard** | Balance card, earning milestones, transaction history, ways to earn |
| **Leaderboard** | Period filter (Week/Month/All Time), ranked table with avatar, messages, earnings |
| **Notifications** | Filter tabs: All / Unread / Mentions / Friend Requests. Collapsible sections for each type |
| **Search** | Search messages within channel (DM) or across portal (guild). Results with author, channel, timestamp, content highlight |
| **User Profile (View)** | Banner, avatar + decoration + presence dot, display name, username, pronouns, bio, member since, mutual servers, mutual friends |
| **Settings (User)** | Full settings hub (see details below) |
| **Portal Settings** | Full server settings hub (see details below) |
| **Invite Page** | Guild preview (icon, name, description, member count), accept button or login prompt |
| **Create Portal** | Template picker (8 templates), name + description, OR Discord import flow |
| **Create Channel** | Name, type (text/voice/category), category parent, topic, private toggle |

---

## 4. Feature Matrix

### What's Live on Web vs. What Backend Supports

| Feature | Web UI | Backend | Mobile Priority |
|---------|--------|---------|-----------------|
| Text messaging | Full | Full | P0 - Must have |
| Message editing/deleting | Full | Full | P0 |
| File attachments (images, video, files) | Full | Full | P0 |
| @mentions (users + roles) | Full | Full | P0 |
| Custom emoji (inline + reactions) | Full | Full | P0 |
| Message reactions | Full | Full | P0 |
| Reply to messages | Full | Full | P0 |
| Typing indicators | Full | Full | P0 |
| Pinned messages | Full | Full | P1 |
| Threads | Full | Full | P1 |
| Message search | Full (PostgreSQL FTS) | Full | P1 |
| DM voice/video calls | Full | Full (LiveKit) | P1 |
| Guild voice channels | Full | Full (LiveKit) | P1 |
| Screen sharing | Full | Full | P2 |
| Friends system | Full | Full | P0 |
| Presence (online/away/DND/invisible) | Full | Full | P0 |
| Custom status message | Full | Full | P1 |
| User profiles (banner, avatar, bio, etc.) | Full | Full | P0 |
| Portal creation (+ Discord import) | Full | Full | P1 |
| Portal settings (icon, banner, members, roles, channels, emoji, invites) | Full | Full | P1 |
| Channel creation/deletion | Full | Full | P1 |
| Role management | Partial (no color, no perms editor) | Full | P2 |
| Invite system | Full | Full | P0 |
| Discovery (portals) | Full | Full | P1 |
| Discovery (bots) | Placeholder | Partial | P3 |
| Discovery (themes) | Placeholder | Full | P2 |
| Shop (cosmetics) | Full | Full | P2 |
| Gratonite economy | Full | Full | P2 |
| Leaderboard | Full | Full | P2 |
| Notifications page | Full | Full | P1 |
| Appearance settings | Full | Full | P2 |
| Theme Studio | Full | Full | P3 |
| Notification sound settings | Full | Full | P2 |
| MFA (2FA) setup | Full | Full | P1 |
| Keyboard shortcuts | Partial | N/A | N/A (not applicable to mobile) |
| Polls | None | Full | P2 |
| Scheduled messages | None | Full | P3 |
| Voice messages | None | Full | P2 |
| Wiki (per-guild) | None | Full | P2 |
| Scheduled events | None | Full | P2 |
| Q&A channels | None | Full | P3 |
| Analytics dashboard | None | Full | P3 |
| AutoMod rules management | Placeholder | Full | P2 |
| Stage channels | None | Full | P3 |
| Soundboard (guild) | None | Full | P3 |
| Link previews / embeds | Partial | Full (OG scraper) | P1 |
| Bot developer portal | None | Full (OAuth2) | P3 |

---

## 5. Screen Details

### 5A. Friends Screen

**Layout:** Header with "Friends" title + "Add Friend" button

**Filter tabs:** All | Online (with count) | Pending | Blocked

**All/Online rows:**
- Avatar (40px) with presence dot overlay (green/yellow/red/gray)
- Display name
- @username
- "Message" button (opens DM)
- More options button

**Pending rows:**
- Avatar + display name + @username
- "Incoming" or "Outgoing" badge
- Incoming: Accept + Decline buttons
- Outgoing: Cancel button

**Blocked rows:**
- Avatar + display name + @username
- Unblock button

**Empty states:** "No friends yet", "No friends online", "No pending requests", "No blocked users"

---

### 5B. DM List

**Header:** "Direct Messages" + settings icon + search bar + "Add Friend" button

**Search bar:** "Find or Start a Conversation" — debounced 300ms, searches users, results show avatar + name + @username, clicking opens DM

**DM list items:**
- Avatar (32px)
- Recipient name
- Last message preview (truncated 40 chars)
- Relative timestamp (now / Xm / Xh / Yesterday / Xd)
- Unread count badge (capped at 99+)
- Close/dismiss button

---

### 5C. Channel Chat (Text Channels + DMs)

**TopBar (guild channels):**
- `#` icon + channel name
- Channel topic (if set)
- Actions: Invite link, Search, Members toggle, Pinned messages toggle

**TopBar (DMs):**
- Avatar + recipient name + "Direct message" label
- Actions: Voice call, Video call, User info toggle

**Message List (virtualized/infinite scroll):**

Each message (ungrouped):
- Avatar (40px) — tap opens profile
- Display name (with server nickname support) + server tag badge
- Timestamp + "(edited)" label if edited
- Message content (markdown rendered: bold, italic, code, mentions, custom emoji)
- Attachments: images (tap to lightbox), video (inline player), files (icon + name + size + download)
- Reply reference (if replying): arrow icon + author name + content snippet (60 chars)
- Reaction bar: emoji pills with count, active state if user reacted, + button for new reaction

Grouped messages (same author, close in time): no avatar/header, just content

**Message actions (long-press context menu):**
- Reply
- Add Reaction (opens emoji picker)
- Edit (own messages only)
- Pin / Unpin
- Create Thread (guild channels only)
- Delete (own messages only, danger)

**Edit mode:** Inline textarea replaces content, Enter to save, Cancel button

**Composer:**
- Auto-growing textarea (max 4000 chars)
- Send button (or Enter to send)
- Attachment button (paperclip) — file picker, shows thumbnails for images
- Emoji picker button (smiley face)
- @mention autocomplete: triggered by `@`, dropdown with up to 8 candidates (guild members + roles)
- :emoji: autocomplete: triggered by `:`, dropdown with custom guild emoji
- Typing indicator: sends TYPING_START event, throttled to every 5 seconds

**Typing indicator display:** Shows below composer when others are typing

---

### 5D. Pinned Messages Panel

- List of pinned messages with avatar (24px), author name, timestamp, content snippet
- "Unpin" button per message
- Empty state: "No pinned messages in this channel."

---

### 5E. Thread Panel

**Thread list view:**
- "Threads" heading
- List of threads: thread name (tap to open), "N messages - N members" meta
- Empty state: "No active threads yet."

**Thread chat view:**
- Thread name heading + member count
- Back button to thread list
- Full message list + composer (same as channel chat)

---

### 5F. Search Panel

- Search input: "Search messages..." (debounced 300ms)
- Scope: within channel (DM) or across entire portal (guild)
- Results: avatar + author name + #channel name + timestamp + highlighted content
- "Load more" button for pagination
- Tap result to navigate to that message

---

### 5G. Voice Channel View

**Controls:**
- Mute/Unmute toggle
- Deafen/Undeafen toggle
- Video on/off toggle
- Screen share toggle (quality options: 720p/1080p, audio on/off)
- Disconnect button

**Participant tiles:**
- Avatar or video feed
- Display name
- Mute/deafen indicators
- Speaking indicator (green border)

**Admin actions (guild owner):**
- Move to another voice channel
- Server mute
- Server deafen
- Disconnect user

---

### 5H. DM Calls

**Outgoing call:**
- Ringing state with recipient avatar + name
- Cancel button

**Incoming call:**
- Caller avatar + name
- Accept (audio) / Accept (video) / Decline buttons
- DND users don't receive call notifications

**Active call:**
- Audio/Video toggle
- Screen share toggle
- Mute/Deafen
- End call
- Elapsed time display

---

### 5I. Portal List (Guild List)

- Header: "Your Portals"
- Each portal: icon (or letter fallback) + name
- Unread badge (sum of all channel unreads)
- Voice badge (microphone icon if voice channels active — tap shows active channels + user counts)
- "+" button to create/join portal

---

### 5J. Portal View (Inside a Portal)

**Guild header:** Portal name (tappable for dropdown menu)

**Dropdown menu:**
- Invite People
- Portal Settings
- Portal Profile
- Leave Portal
- Delete Portal (owner only)

**Channel list (by category):**
- Category headers (collapsible) with "+" button to add channel
- Text channels: `#` icon + name + unread badge
- Private channels: lock icon
- Voice channels: speaker icon + name + connected users list (up to 6 names + "+N more")

**Channel actions (long-press):**
- Create Text/Voice Channel
- Delete Channel (owner only)

---

### 5K. User Profile View

**Full profile overlay:**
- Banner image (or fallback color)
- Avatar (with decoration ring overlay) + presence status dot
- Display name + username + pronouns
- Bio text
- Stats: Member Since / Mutual Friends / Mutual Servers
- Actions for other users: Message, Add Friend / Remove Friend
- More menu: Block / Copy User ID

**Mini profile popover (from tapping avatar in messages):**
- Same info as above but more compact
- Banner + avatar + name + username + server tag + status text + profile widgets + bio
- Block/Unblock button

---

### 5L. User Settings

**Navigation sections:**

| Section | Key Features |
|---------|-------------|
| **My Account** | Profile card (avatar, banner, display name, username, email), copy user ID |
| **Profile** | Avatar upload/remove, banner upload/crop/remove, decoration picker, effect picker, display name, pronouns, bio (max 190 chars), portal tag (server select), status message (with expiry: 1h/4h/Today/Never), profile widgets (up to 8, comma-separated), theme colors (primary + accent, hex color pickers) |
| **Earn Gratonites** | Balance overview, daily login rewards (streak bonuses at 3/7/30 days), message milestones (100/500/1000 messages) |
| **Appearance** | Color mode (Light/Dark/System), visual presets (Balanced/Immersive/Performance), message density (Cozy/Compact), font scale (0.80x-1.40x), glass mode (Off/Subtle/Full), surface background, content scrim, background styles per context (portal/channel/DM), low power mode, reduced effects, Theme Studio v1 (4 presets + 5 token color inputs + export/import) |
| **Notifications** | Per-event sound toggles (channel messages, DMs, mentions, incoming call, outgoing call, call connect, call end), volume slider, soundboard settings (hear clips, volume, entrance sounds), DND schedule (start/end time, timezone, day-of-week bitmask) |
| **Security** | MFA setup (QR code + manual key + 6-digit verify), MFA disable, backup code regeneration, email verification status |
| **Accessibility** | Display name styles toggle (suppress custom fonts/effects/colors from other users) |
| **Log Out** | Confirmation + log out button |

**Banner crop modal:** Preview image, "Skip Crop" or "Crop & Upload" (center-fits to 680x240, exports as WebP)

**Decoration picker:** Grid of owned avatar decorations, "None" option, empty state with "Visit Shop" link

**Effect picker:** Grid of owned profile effects, "None" option

---

### 5M. Portal Settings (Server Settings)

**Navigation sections:**

| Section | Key Features |
|---------|-------------|
| **Overview** | Portal icon upload/remove, portal banner upload/remove (previewed as background-image) |
| **Members** | Member list with search + sort (Name/Joined Date), each member: avatar + display name + @username + join date + role badges. Actions: Kick (confirm dialog), Ban (with reason input, max 200 chars), Copy ID. Ban list tab with search + sort + Unban. Owner and self are protected. |
| **Roles** | Create role (name only), role list with mentionable toggle, member count badge. Assign roles to members (member select + role select). View member's current roles + remove. *Note: No color picker, no permissions editor, no ordering UI yet* |
| **Channels** | Channel list grouped by type. Per-channel: name display, visibility toggle (public/private via permission overrides for @everyone). *Note: No rename, no topic edit, no reorder UI yet* |
| **Emoji** | "Upload Emoji" button (opens Emoji Studio), slot counts (static: N/50, animated: N/50), emoji grid (image + `:name:` + GIF badge + Remove button) |
| **Invites** | Channel select (text channels only) + "Generate Invite" button, result: monospace invite URL + Copy button |
| **Moderation** | *Coming Soon placeholder* — will have audit log + AutoMod rules |
| **Delete Portal** | Owner-only. Warning text, confirmation (must type portal name exactly), danger button |

**Emoji Studio modal:**
- Two-column layout: preview (with zoom 0.5-2x + rotate -180 to +180, disabled for GIFs) and form (name max 32 chars, portal select, file picker: PNG/GIF/WEBP/JPEG)
- Processes static images to 128x128 PNG via canvas

---

### 5N. Discover Screen

**3 tabs:** Portals | Bots | Themes

**Portals tab:**
- Search input
- Sort: Trending / Newest / Name
- Tag filter pills: "all" + dynamic tags (up to 8, sorted by frequency; fallback: gaming, productivity, creative, study, social)
- Portal gallery grid/cards
- "Clear filters" button

**Bots tab:** 3 placeholder cards (Portal Guard, Pulse, Patchnote) with "Install (Soon)" disabled button

**Themes tab:** 3 placeholder cards (Ice Glass, Ember, Soul Aurora) with "Preview (Soon)" disabled button

---

### 5O. Shop Screen

**Balance banner:** Gratonites symbol + current balance

**6 tabs:**

| Tab | Content |
|-----|---------|
| **Avatar Decorations** | Grid: avatar preview with ring, name, description, Equip/Remove button |
| **Profile Effects** | Grid: effect preview card, name, description, Equip/Remove button |
| **Nameplates** | Grid: name with nameplate applied, name, description, Equip/Remove button |
| **Soundboard** | Grid: play button, name, featured badge, description, price, Purchase/Owned button |
| **Gratonites Shop** | Featured items + sub-sections by type, each: type badge, preview, name, price, Purchase/Too Expensive/Owned button |
| **Creator** | Type select (6 types), name input, "Create Draft" button, existing drafts grid with submit/review/published status |

---

### 5P. Gratonite Dashboard

- **Balance card:** large balance number, lifetime earned, lifetime spent
- **Earning milestones:** progress bars for 100/500/1K/5K/10K messages with checkmarks for completed
- **Transaction history:** date + description + amount (color-coded earn/spend). Source labels: Chat Reward, Server Activity, Daily Login, Shop Purchase, Creator Item
- **Ways to earn (4 cards):** Send Messages (1G per 5), Daily Login (10G), Invite Friends (50G), Complete Profile (25G)

---

### 5Q. Leaderboard

- **Period filter:** This Week | This Month | All Time
- **Table:** Rank (medal emoji for top 3), User (avatar + name, highlighted if self), Messages, Gratonites Earned, Member Since

---

### 5R. Notifications Screen

**Filter tabs:** All | Unread (badge) | Mentions (badge) | Friend Requests (badge)

**Action buttons:** Clear visible, Expand/Collapse all, Reset view

**3 collapsible sections:**
1. **Incoming Friend Requests:** display name + @username + Accept/Ignore buttons
2. **Mentions:** channel title link, portal + channel info, mention count badge, dismiss button
3. **Unread Conversations:** channel title link, meta info, "Mark read" button, unread count badge

---

### 5S. Create Portal

**Normal flow:**
1. Template picker grid (8 options): Gaming, Study Group, Art Studio, Music Hub, Content Creator, Friend Group, Dev Team, Blank — each with emoji icon + title + description
2. Portal Name (max 100 chars, required)
3. Description (max 1000 chars, optional)
4. Submit creates portal + default channels from template + initial invite

**Discord import flow:**
1. "Import from Discord" link
2. File picker (JSON)
3. Preview: categories, channels, roles with colors
4. Portal Name (pre-filled from import)
5. "Create Portal" submit

---

### 5T. Invite Page (Deep Link Landing)

**Valid invite (authenticated):**
- "X invited you to join" text
- Guild icon (80px) + name + description + member count
- "Accept Invite" button

**Valid invite (not authenticated):**
- Same guild info
- "You need to log in" text
- Login / Register buttons with redirect

**Invalid/expired:** Error message + "Go Home" link

---

### 5U. DM Profile Panel (Right-side info)

For 1:1 DMs:
- Banner image
- Avatar (80px) with presence dot
- Display name + @username + pronouns
- Status: colored dot + label
- About Me (bio)
- Member Since
- Mutual Servers (collapsible, shows server name + nickname)
- Mutual Friends (collapsible, shows avatar + name + @username)
- "View Full Profile" button

For Group DMs:
- "Members - N" heading
- Member rows: avatar + name + presence dot
- Tap member opens full profile

---

## 6. Backend-Ready Features (No Web UI Yet)

These features have complete backend implementations and are ready for mobile UI:

### 6A. Wiki (Per-Guild Knowledge Base)
- Channel type: `GUILD_WIKI`
- Hierarchical pages (parent/child)
- Full CRUD with revision history
- Pin and archive pages
- Revert to any revision
- Real-time updates via WebSocket

### 6B. Scheduled Events
- Create events with name, description, start/end time
- Entity types: stage, voice, external (with location)
- Status flow: scheduled -> active -> completed/cancelled
- RSVP ("interested") tracking with count
- Auto-start when scheduled time arrives
- Real-time event lifecycle notifications

### 6C. Q&A Channels
- Channel type: `GUILD_QA`
- Questions are threads with voting (+1/-1)
- Answers are messages within thread, also with voting
- Accepted answer marking (question author or guild owner)
- Resolved/unresolved status
- Sort by votes, newest, or activity

### 6D. Polls
- Attached to messages
- Multi-select option
- Finalize/close poll
- Vote counting

### 6E. Scheduled Messages
- Schedule messages for future delivery
- Background processor handles sending

### 6F. Voice Messages
- Flag + duration + waveform data
- Needs waveform renderer UI

### 6G. Analytics Dashboard (Per-Guild)
- Daily: messages sent, active members (HyperLogLog), top channels, new/left members, reactions
- Hourly heatmap
- 90-day retention for hourly data

### 6H. AutoMod Rules Management
- Rule types: keyword, spam detection, keyword preset (profanity/sexual/slurs), mention spam
- Actions: block message, send alert, timeout user
- Exempt roles and channels
- Max 6 rules per trigger type per guild
- Action logging

### 6I. Stage Channels
- Request to speak / invite to speak
- Speaker management (add/remove)
- Stage instance lifecycle (topic, privacy, etc.)

### 6J. Soundboard (Guild)
- Per-guild sound CRUD (name, emoji, volume)
- Play broadcast to voice channel participants
- 50 sounds per guild limit

### 6K. Bot/App Developer Portal
- OAuth2 authorization code flow
- Bot account creation
- Slash command CRUD (global or per-guild)
- Bot WebSocket authentication

### 6L. Theme Marketplace
- 8 built-in themes (Obsidian, Moonstone, Ember, Arctic, Void, Terracotta, Sakura, Neon)
- User-created themes with full CSS token system
- Browse/install/uninstall/rate themes
- Scoped installation (per-guild or per-user)

---

## 7. Economy & Gamification System

### Currency: Gratonites (symbol: G)

**Earning methods:**
| Method | Reward |
|--------|--------|
| Send messages | 1G per 5 messages |
| Daily login | 10G per day |
| Login streak bonuses | +5G (3-day), +15G (7-day), +50G (30-day) |
| Invite friends | 50G per accepted invite |
| Complete profile | 25G one-time |
| Message milestones | +20G (100 msgs), +100G (500), +250G (1000) |

**Spending:**
- Avatar decorations
- Profile effects
- Nameplates
- Soundboard clips
- Featured/creator items

**Creator system:**
- Users can create draft items (6 types: display name style pack, profile widget pack, portal tag badge, avatar decoration, profile effect, nameplate)
- Submit for review -> In Review -> Published

---

## 8. Design Tokens & Theming

### CSS Token System (per theme)

```
Background:     bg-deep, bg-base, bg-elevated, bg-overlay, bg-input
Accent:         accent-primary, accent-secondary, accent-tertiary
Semantic:       accent-success, accent-warning, accent-danger
Text:           text-primary, text-secondary, text-tertiary, text-link, text-on-accent
Borders:        border-subtle, border-default, border-strong
Effects:        glow-accent, gradient-surface, gradient-header
Material:       noise-opacity, glass-opacity
```

### Appearance Controls Users Can Set
- Color mode: Light / Dark / System
- Message density: Cozy / Compact
- Font scale: 0.80x to 1.40x
- Glass mode: Off / Subtle / Full
- Surface background: Contained / Full Surface
- Content scrim: Soft / Balanced / Strong
- Background style per context (portal/channel/DM): Auto / Aurora / Mesh / Minimal
- Low power mode (reduces animations)
- Reduced effects (reduces visual effects)

### Presence Colors
| Status | Color | Label |
|--------|-------|-------|
| Online | Green | "Online" |
| Away/Idle | Yellow/Amber | "Away" |
| Do Not Disturb | Red | "Do Not Disturb" |
| Invisible | Gray | "Invisible" (appears offline to others) |
| Offline | Gray | "Offline" |

---

## 9. Mobile-Specific Considerations

### Gestures & Interactions
- **Long-press** for message context menus (reply, react, edit, pin, thread, delete)
- **Swipe** for navigation between guild rail / channel sidebar / main content
- **Pull-to-refresh** for message lists, DM list, notifications
- **Tap avatar** to open profile popover/overlay
- **Double-tap message** could trigger quick reaction

### Key Differences from Web
- No keyboard shortcuts (touch-only)
- No drag-and-drop channel reordering (use edit mode instead)
- No right-click context menus (use long-press)
- No hover states (use press states)
- No multi-column layout (sequential navigation instead)
- Voice/video overlay should be persistent/minimizable (PiP)
- Push notifications replace the in-app notification page for real-time alerts
- Camera access for video calls + avatar/banner upload

### Critical Real-time Features
- WebSocket connection must persist across screen transitions
- Typing indicators, presence updates, new messages must render instantly
- Voice/video connections must survive navigation (floating call UI)
- Unread counts must update in real-time on tab badges / portal list

### Image Handling
- All images via `expo-image` with `cachePolicy="memory-disk"`
- Animated GIFs supported for avatars and banners
- Banner crop to 680x240 (WebP at 0.9 quality)
- Avatar decorations rendered as overlay rings
- Profile effects rendered as overlay animations

### Platform Limits
- Message max: 4000 characters
- Bio max: 190 characters
- Channel name max: 100 characters
- Guild name max: 100 characters
- Guild description max: 1000 characters
- Emoji per guild: 50 static + 50 animated
- Emoji name max: 32 characters
- Role name max: created at form level
- Soundboard per guild: 50 sounds
- AutoMod rules: 6 per trigger type per guild
- Ban reason max: 200 characters
- Status message max: 100 characters
- Profile widgets: max 8

---

## Appendix: Feature Gaps in Current Web UI

These features exist in the codebase but are incomplete on web (good opportunities for mobile to match or exceed):

| Feature | Current State |
|---------|--------------|
| Role color picker | Not present — roles have no color editing |
| Role permissions editor | Not present — no bitmask UI |
| Role ordering | Not present — no drag-to-reorder |
| Guild name editing (post-creation) | Not in settings |
| Guild description editing (post-creation) | Not in settings |
| Channel rename (post-creation) | Not present |
| Channel topic editing (post-creation) | Not present |
| Member nickname (per-server) | Data model supports it, no UI to set |
| Transfer guild ownership | Referenced in leave modal copy, no UI |
| Sticker management | No feature exists |
| Link preview/embed rendering | Backend scrapes OG tags, web rendering partial |
| Quick Switcher (Cmd+K) | Stub/TODO |
| File search (Cmd+F) | Stub/TODO |
