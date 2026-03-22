# Download Page Redesign

## Overview

Redesign the gratonite.chat/download page to clearly present three product categories (Desktop, Mobile, Server) and help users understand their options without technical jargon. Also update the /deploy page to link from the Server section.

## Terminology

- **Portal** = a community space on Gratonite (replaces "server" in the community sense)
- **Server** = infrastructure only (the actual machine running Gratonite)
- No emdashes anywhere in copy
- No unexplained technical terms (no "VPS", no "container" without explanation)
- "Free forever" is intentional product positioning, confirmed by the founder

## Page Structure

### 1. Hero Section (Auto-Detect OS)

All components using OS detection must be Client Components (`"use client"` directive) since the landing site uses `output: "export"` (static HTML). Before hydration, the hero shows a generic fallback: "Download Gratonite" heading with a "Choose your platform" link to the Desktop section. After hydration, it updates to show the detected OS.

- Detect user's OS (see OS Detection Logic below)
- Display: "Download Gratonite" label, "Gratonite for [Mac/Windows/Linux]" heading
- Show version, OS requirements, architecture
- Large purple gradient download button with platform brand icon (Simple Icons SVG)
- Below button: "Not on [detected OS]? Download for [other platforms]" links that scroll to `#desktop` section

Section anchor IDs: `#desktop`, `#mobile`, `#server`

### 2. Gratonite Desktop

- Section label: "GRATONITE DESKTOP" (purple, uppercase, letter-spaced)
- Anchor: `id="desktop"`
- Four platform cards in a row:
  - **macOS** (Apple Silicon) — .dmg download, Apple logo (Simple Icons, purple)
  - **Windows** (64-bit) — .exe download, Windows logo (Simple Icons, blue). Include SmartScreen notice below the button: "Windows may show a SmartScreen warning because we're a new app. Click 'More info' then 'Run anyway' to continue."
  - **Linux x64** — .AppImage/.deb download, Tux logo (Simple Icons, green)
  - **Linux ARM64** — .AppImage/.deb download, Tux logo (Simple Icons, green)
- Detected platform card has highlighted border (accent color)
- Download URLs point to gratonite.chat/downloads/ CDN (not GitHub releases directly)

### 3. Gratonite Mobile

- Section label: "GRATONITE MOBILE" (pink, uppercase, letter-spaced)
- Anchor: `id="mobile"`
- Two cards side by side:
  - **iOS** — Apple logo (Simple Icons, pink), "BETA" badge, description mentioning iPhone and iPad, "Join TestFlight Beta" button, requires iOS 16+
  - **Android** — Android logo (Simple Icons, grey), "COMING SOON" badge, description suggesting web app at gratonite.chat/app in the meantime, "Notify Me" button: `disabled` with `aria-disabled="true"`, shows tooltip on hover: "Android support is in development. We'll announce it on our socials." Full card at reduced opacity (0.6).

### 4. Gratonite Server

- Anchor: `id="server"`

#### 4a. Section Header
- Label: "GRATONITE SERVER" (amber, uppercase)
- Heading: "Create your portal"
- Subtext: "A portal is your community space on Gratonite. Create one for your friends, team, or group. Pick what works for you."

#### 4b. "Use Gratonite" Card (Default Path)
- Highlighted card with gradient background, "MOST POPULAR" corner badge
- Icon: chat bubble (Lucide `MessageSquare`)
- Heading: "Use Gratonite"
- Subtitle: "No setup needed. Just sign up and go."
- Description: "Create a portal, invite your friends, and start chatting. We handle all the technical stuff so you don't have to. Available on the web, as a desktop app, and on mobile."
- Three pills: Web App (Lucide `Globe`), Desktop App (Lucide `Monitor`), Mobile App (Lucide `Smartphone`)
- Trust row (below divider): "100% open source", "No ads, no data selling", "Free forever", "Export your data anytime" (each with green checkmark, Lucide `Check`)
- "Get Started" button linking to gratonite.chat/app

#### 4c. Bridging Text
- Small centered text: "When you use Gratonite above, your portals live on our servers. Below, you can run your own copy of Gratonite so your portals live on hardware you control."

#### 4d. Divider
- Horizontal line with centered text: "Want to host Gratonite yourself?"

#### 4e. Self-Hosting Options (Two Cards Side by Side)

**"Run on Your Computer" card:**
- Icon: monitor (Lucide `Monitor`, amber)
- Heading: "Run on Your Computer"
- Subtitle: "Your portals live on your machine"
- Description: "Download an app that turns your computer into a Gratonite server. Perfect for trying and learning about self-hosting, great for a small group of friends."
- "Keep in mind" box (amber):
  - Your portals go offline when your computer sleeps or shuts down
  - Friends connect through your home internet
  - Best for small groups, under 20 people
- Docker explainer (see section 4f)
- "Download Server App" button (amber), linking to `https://github.com/CoodayeA/Gratonite/releases/tag/server-v0.1.0`
- Footer: "macOS, Windows, Linux. Requires Docker (free)."

**"Always-On Server" card:**
- "BEST FOR COMMUNITIES" badge (green)
- Icon: server rack (Lucide `Server`, green)
- Heading: "Always-On Server"
- Subtitle: "Your portals are online 24/7"
- Description: "Deploy to a cloud server that's always online. Your portals are available around the clock, even when your computer is off. One command sets up everything automatically."
- Benefits box (green checkmarks):
  - Always online, never goes down when you close your laptop
  - Fast for everyone, not limited by your home internet
  - Handles any community size, from 5 to 5,000 members
- Docker explainer (see section 4f)
- CLI command box: `curl -fsSL gratonite.chat/install | bash` with copy button (`aria-label="Copy command"`, announce "Copied!" to screen readers via `aria-live="polite"`)
- "Setup guide and hosting providers" link to /deploy
- Footer: "Starts at around $5/month"

#### 4f. Docker Explainer (Shared Component)

Appears in both self-hosting cards. Educational, not dismissive.

- Docker logo (Simple Icons, blue) + "What is Docker?" heading + "A quick intro, no experience needed" subtitle
- Three paragraphs:
  1. "Gratonite needs a few things to run: a database to store messages, a web server to handle connections, and more. Instead of installing each of these separately, Docker bundles them all together into a single package called a container."
  2. "A container is like a mini computer inside your computer. It has everything Gratonite needs, neatly organized and isolated from the rest of your system. Nothing leaks out, nothing conflicts with your other apps."
  3. "Docker is a free app that makes containers work. Millions of developers use it every day. To host Gratonite, you just need to install Docker once and the Gratonite Server App takes care of the rest."
- Visual diagram: [Your Computer] runs > [Docker] runs > [Gratonite], with "Everything stays clean and organized" caption. Diagram uses `aria-hidden="true"` since the text above already explains the concept.
- "Download Docker Desktop" button (blue) linking to docker.com/products/docker-desktop
- Note: "Free for personal use. Available on macOS, Windows, and Linux."

## Icons

**Hybrid approach:**
- Simple Icons (simpleicons.org, MIT license) for brand logos: Apple, Windows, Linux (Tux), Android, Docker
- Lucide (already bundled in landing site) for generic concepts: Monitor, Smartphone, Server, Globe, Terminal, MessageSquare, Download, Check, Clock, Users, Eye, AlertTriangle, Copy, ExternalLink

All icons are inline SVGs, no external dependencies. Simple Icons are filled mono-color tinted to match the section palette. Lucide icons are outlined (stroke). All interactive icons have appropriate `aria-label` attributes.

## Color Palette (Per Section)

- **Desktop**: Purple (#a78bfa primary, macOS highlighted; #60a5fa Windows; #34d399 Linux)
- **Mobile**: Pink (#f472b6 iOS; #666 Android greyed)
- **Server**: Amber (#f59e0b "Your Computer"); Green (#34d399 "Always-On"); Purple (#a78bfa "Use Gratonite")
- **Docker**: Blue (#60a5fa)
- **Trust/checkmarks**: Green (#34d399)
- Section labels and badges also use non-color text differentiation ("EASIEST", "BETA", "COMING SOON", "BEST FOR COMMUNITIES") for color-blind accessibility.

## Files to Create/Modify

### Landing Site (apps/landing/)
1. **`src/app/download/page.tsx`** — Complete rewrite of the download page. Update SEO metadata: title to "Download Gratonite | Desktop, Mobile, and Server", description updated to cover all three categories.
2. **`src/components/download/PlatformHero.tsx`** — Client Component (`"use client"`). Auto-detect OS hero section with SSR fallback.
3. **`src/components/download/DesktopSection.tsx`** — Desktop platform cards with SmartScreen notice on Windows card.
4. **`src/components/download/MobileSection.tsx`** — iOS beta + Android coming soon.
5. **`src/components/download/ServerSection.tsx`** — Full server section (Use Gratonite, bridging text, divider, self-hosting options).
6. **`src/components/download/DockerExplainer.tsx`** — Shared Docker education component with visual diagram.
7. **`src/components/download/icons.tsx`** — Simple Icons SVG components (Apple, Windows, Tux, Android, Docker).

### Deploy Page (apps/landing/)
8. **`src/app/deploy/page.tsx`** — Update to reference "portals" instead of "servers" for communities, ensure CLI installer is front and center, link back to /download for Server App.

### Web App (apps/web/)
9. **`src/pages/Download.tsx`** — Terminology update only: replace emoji icons with Lucide icons, update copy to use "portal" where it referred to community "servers". No structural changes (the web app download page is a simple download list for users already in the app, not a marketing page).

## OS Detection Logic

```typescript
'use client';

function detectOS(): 'macos' | 'windows' | 'linux' | null {
  if (typeof navigator === 'undefined') return null; // SSR fallback

  // Prefer User-Agent Client Hints API (modern browsers)
  const uaPlatform = (navigator as any).userAgentData?.platform?.toLowerCase();
  if (uaPlatform) {
    if (uaPlatform.includes('mac')) return 'macos';
    if (uaPlatform.includes('win')) return 'windows';
    return 'linux';
  }

  // Fallback to userAgent string
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'macos';
  if (ua.includes('windows')) return 'windows';

  // Last resort: navigator.platform (deprecated but still works in some browsers)
  const platform = navigator.platform?.toLowerCase() || '';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('win')) return 'windows';

  return 'linux';
}
```

Returns `null` during SSR/static render, triggering the generic fallback hero.

## Download URLs

Version constant: `const VERSION = '1.0.4';`

All downloads point to the CDN at `https://gratonite.chat/downloads/`:
- macOS: `Gratonite-${VERSION}-arm64.dmg`
- Windows: `Gratonite%20Setup%20${VERSION}.exe` (filename has spaces, URL-encoded)
- Linux x64 AppImage: `Gratonite-${VERSION}.AppImage`
- Linux x64 deb: `gratonite-desktop_${VERSION}_amd64.deb`
- Linux ARM64 AppImage: `Gratonite-${VERSION}-arm64.AppImage`
- Linux ARM64 deb: `gratonite-desktop_${VERSION}_arm64.deb`
- Server App: `https://github.com/CoodayeA/Gratonite/releases/tag/server-v0.1.0` (links to release page, user picks their platform)

## Responsive Behavior

- Hero: single column on mobile, full width button
- Desktop cards: 4 columns on desktop, 2x2 grid on tablet, single column stack on mobile
- Mobile cards: 2 columns on desktop/tablet, single column on mobile
- Server section: "Use Gratonite" card full width, self-hosting cards 2 columns on desktop, stacked on mobile
- Docker explainer diagram: horizontal on desktop, vertical stack on mobile

## Out of Scope

- Renaming "server" to "portal" across the entire Gratonite web app UI (separate task, larger refactor)
- Implementing the "Notify Me" email collection backend for Android
- TestFlight integration (just links to existing TestFlight URL)
- Changes to the /deploy page VPS provider cards or cloud-init scripts
- GitHub releases automation
- Automated version bumping (VERSION constant is updated manually per release)
