# Download Page Redesign Implementation Plan

> **Implementation:** Track progress with the checkbox (`- [ ]`) steps below.

**Goal:** Redesign gratonite.chat/download into a three-section page (Desktop, Mobile, Server) with auto-detect OS hero, educational Docker explainer, and "portal" terminology for communities.

**Architecture:** Next.js static export page with Client Components for OS detection. Seven new components in `apps/landing/src/components/download/` sharing an inline SVG icon module. The page composes these components with the existing ScrollReveal, Card, Badge, and Button primitives. The existing neo-brutalist design system (neo-border, neo-shadow, neo-sticker) is used throughout.

**Tech Stack:** Next.js 16 (static export), React 19, Tailwind CSS 4, TypeScript 5. No new dependencies. All icons are inline SVGs (Simple Icons for brands, custom SVG paths for generic icons since Lucide is not in the landing site).

**Spec:** `docs/superpowers/specs/2026-03-21-download-page-redesign.md`

**Design note:** The brainstorming mockups used a dark minimal style. The landing site uses a neo-brutalist design system with thick borders, offset shadows, and sticker labels that works in both light and dark mode. The implementation adapts the mockup's information architecture and copy to the existing design language.

---

## File Map

### New Files (apps/landing/src/components/download/)

| File | Responsibility |
|------|---------------|
| `icons.tsx` | Inline SVG components: Apple, Windows, Tux, Android, Docker, plus generic icons (Globe, Monitor, Smartphone, Server, Terminal, MessageSquare, Check, Clock, Users, Copy, ExternalLink). All accept `className` and `size` props. |
| `constants.ts` | Shared VERSION, BASE_URL, detectOS() function, and platform config. Single source of truth for download URLs and OS detection logic. |
| `PlatformHero.tsx` | Client Component. Uses detectOS from constants. Renders hero with auto-detected platform download button. SSR fallback: generic heading. |
| `DesktopSection.tsx` | Four platform cards (macOS, Windows, Linux x64, Linux ARM64) with brand icons and download links. SmartScreen notice on Windows card. |
| `MobileSection.tsx` | iOS beta card + Android coming-soon card. |
| `DockerExplainer.tsx` | Shared educational Docker section with three paragraphs and visual diagram. |
| `ServerSection.tsx` | "Use Gratonite" default card, bridging text, divider, and two self-hosting cards (Your Computer + Always-On). Composes DockerExplainer. |
| `CopyButton.tsx` | Client Component. Small button that copies text to clipboard and shows "Copied!" feedback with aria-live. |

### Modified Files

| File | Changes |
|------|---------|
| `apps/landing/src/app/download/page.tsx` | Complete rewrite. Composes the new components, updates metadata. |
| `apps/landing/src/app/deploy/page.tsx` | Terminology update: "server" to "portal" for community references. Add link back to /download for Server App. |

**Note:** `apps/web/src/pages/Download.tsx` was reviewed and requires no changes. It already uses Lucide icons (not emoji), has no "server" terminology referring to communities, and is a simple download list for in-app users.

---

## Chunk 1: Foundation (Icons + CopyButton + DockerExplainer)

### Task 1: Create icon components

**Files:**
- Create: `apps/landing/src/components/download/icons.tsx`

- [ ] **Step 1: Create the icons file with all SVG components**

```typescript
// apps/landing/src/components/download/icons.tsx

interface IconProps {
  size?: number;
  className?: string;
}

// --- Brand Icons (Simple Icons, filled) ---

export function AppleIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export function WindowsIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

export function TuxIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.504 0c-.155 0-.311.01-.465.03-3.83.531-3.47 4.103-3.47 4.103s-2.72-.306-3.89 1.93c-.34.65-.56 1.42-.56 2.25 0 .28.02.55.07.82.51 2.87 3.28 3.65 3.28 3.65s-.42 1.06-.42 2.12c0 1.62 1.05 2.56 2.36 3.37.59.37 1.21.68 1.73.95.21.11.41.21.59.31.39.2.66.41.82.6.16.2.2.34.2.46 0 .1-.05.23-.19.39-.14.15-.38.32-.72.47-.68.3-1.67.48-2.76.48-3.69 0-5.16-2.39-5.16-2.39S.53 21.91 3.71 24c.81.53 2.07.84 3.48.84 1.86 0 3.46-.58 4.47-1.39.51-.4.87-.86 1.07-1.32.2-.46.24-.92.11-1.37-.13-.44-.44-.84-.89-1.17-.45-.33-.99-.57-1.48-.78-.49-.21-.94-.39-1.27-.56-.33-.18-.53-.33-.61-.44-.08-.12-.05-.14.06-.31.11-.17.32-.39.62-.62.6-.47 1.47-.93 2.08-1.57.61-.65 1.03-1.47 1.03-2.53 0-.44-.1-.88-.29-1.31-.19-.44-.47-.85-.82-1.24.6-.42 1.34-1.13 1.72-2.27.19-.56.27-1.2.17-1.88-.1-.68-.37-1.4-.83-2.08-.93-1.36-2.54-2.46-4.97-2.46z" />
    </svg>
  );
}

export function AndroidIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.523 15.341a.858.858 0 0 0 .858-.858v-5.166a.858.858 0 0 0-1.716 0v5.166a.858.858 0 0 0 .858.858zm-11.046 0a.858.858 0 0 0 .858-.858v-5.166a.858.858 0 0 0-1.716 0v5.166a.858.858 0 0 0 .858.858zM4.782 7.044h14.437a3.553 3.553 0 0 0-3.074-2.891l.86-1.57a.286.286 0 0 0-.502-.275l-.887 1.618A6.08 6.08 0 0 0 12 3.198a6.08 6.08 0 0 0-3.616.728L7.497 2.308a.286.286 0 0 0-.502.275l.86 1.57a3.553 3.553 0 0 0-3.074 2.891zM9.5 5.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm5 0a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm-10.29 2.6A1.29 1.29 0 0 0 2.92 9.39v4.468a1.29 1.29 0 1 0 2.58 0V9.39a1.29 1.29 0 0 0-1.29-1.29zm15.58 0a1.29 1.29 0 0 0-1.29 1.29v4.468a1.29 1.29 0 1 0 2.58 0V9.39a1.29 1.29 0 0 0-1.29-1.29zM4.782 14.2v2.578A1.722 1.722 0 0 0 6.504 18.5h.934v2.642a1.29 1.29 0 1 0 2.58 0V18.5h2.964v2.642a1.29 1.29 0 1 0 2.58 0V18.5h.934a1.722 1.722 0 0 0 1.722-1.722V14.2z" />
    </svg>
  );
}

export function DockerIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.186.186 0 0 0-.185.186v1.887c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.186.186 0 0 0-.185.185v1.888c0 .102.082.185.185.186m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.186.186 0 0 0-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.186.186 0 0 0-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.186.186 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.186.186 0 0 0-.185.186v1.887c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.186v1.887c0 .102.083.185.185.185m-2.964 0h2.119a.186.186 0 0 0 .185-.185V9.006a.186.186 0 0 0-.185-.186H5.136a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.185.186v1.887c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />
    </svg>
  );
}

// --- Generic Icons (stroke-based, like Lucide) ---

export function GlobeIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function MonitorIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export function SmartphoneIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

export function ServerIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

export function TerminalIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

export function MessageSquareIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function CheckIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ClockIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function UsersIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

export function CopyIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function CloudIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "/Volumes/project bus/GratoniteFinalForm/apps/landing" && npx tsc --noEmit 2>&1 | head -5`
Expected: No errors related to icons.tsx

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/components/download/icons.tsx
git commit -m "feat(landing): add download page icon components (Simple Icons + generic SVGs)"
```

### Task 1b: Create shared constants module

**Files:**
- Create: `apps/landing/src/components/download/constants.ts`

- [ ] **Step 1: Create the constants file**

```typescript
// apps/landing/src/components/download/constants.ts

export const VERSION = "1.0.4";
export const BASE_URL = "https://gratonite.chat/downloads";

export type Platform = "macos" | "windows" | "linux";

export function detectOS(): Platform | null {
  if (typeof navigator === "undefined") return null;

  // Prefer User-Agent Client Hints API (modern browsers)
  const uaPlatform = (navigator as any).userAgentData?.platform?.toLowerCase();
  if (uaPlatform) {
    if (uaPlatform.includes("mac")) return "macos";
    if (uaPlatform.includes("win")) return "windows";
    return "linux";
  }

  // Fallback to userAgent string
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("macintosh") || ua.includes("mac os")) return "macos";
  if (ua.includes("windows")) return "windows";

  // Last resort: navigator.platform (deprecated but still works)
  const platform = navigator.platform?.toLowerCase() || "";
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";

  return "linux";
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/components/download/constants.ts
git commit -m "feat(landing): add shared download constants (VERSION, BASE_URL, detectOS)"
```

### Task 2: Create CopyButton component

**Files:**
- Create: `apps/landing/src/components/download/CopyButton.tsx`

- [ ] **Step 1: Create the CopyButton client component**

```typescript
// apps/landing/src/components/download/CopyButton.tsx
"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "./icons";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied (non-HTTPS or permissions)
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy command"
      className={`p-1.5 rounded-md hover:bg-foreground/10 transition-colors ${className}`}
    >
      {copied ? (
        <CheckIcon size={14} className="text-green-500" />
      ) : (
        <CopyIcon size={14} className="text-foreground/40" />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied!" : ""}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/components/download/CopyButton.tsx
git commit -m "feat(landing): add CopyButton component with clipboard + aria-live"
```

### Task 3: Create DockerExplainer component

**Files:**
- Create: `apps/landing/src/components/download/DockerExplainer.tsx`

- [ ] **Step 1: Create the DockerExplainer component**

This is a server component (no client-side state needed). Uses the existing Card component and neo-brutalist styling. The visual diagram uses the icons from icons.tsx.

```typescript
// apps/landing/src/components/download/DockerExplainer.tsx
import { DockerIcon, MonitorIcon, MessageSquareIcon } from "./icons";

export function DockerExplainer() {
  return (
    <div className="neo-border-2 rounded-xl p-5 bg-surface/50 mt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-blue-light/20 flex items-center justify-center">
          <DockerIcon size={20} className="text-blue-light" />
        </div>
        <div>
          <h4 className="font-display font-bold text-foreground text-sm">
            What is Docker?
          </h4>
          <p className="text-foreground/50 text-xs">
            A quick intro, no experience needed
          </p>
        </div>
      </div>

      {/* Educational paragraphs */}
      <div className="space-y-3 text-foreground/70 text-sm leading-relaxed">
        <p>
          Gratonite needs a few things to run: a database to store messages, a
          web server to handle connections, and more. Instead of installing each
          of these separately, Docker bundles them all together into a single
          package called a{" "}
          <span className="font-semibold text-blue-light">container</span>.
        </p>
        <p>
          A container is like a mini computer inside your computer. It has
          everything Gratonite needs, neatly organized and isolated from the
          rest of your system. Nothing leaks out, nothing conflicts with your
          other apps.
        </p>
        <p>
          Docker is a free app that makes containers work. Millions of
          developers use it every day. To host Gratonite, you just need to
          install Docker once and the Gratonite Server App takes care of the
          rest.
        </p>
      </div>

      {/* Visual diagram */}
      <div
        className="mt-5 rounded-lg bg-charcoal/5 dark:bg-charcoal/30 p-4"
        aria-hidden="true"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-3 text-center">
          How it works
        </p>
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl neo-border-2 bg-surface flex items-center justify-center mx-auto mb-1.5">
              <MonitorIcon size={22} className="text-foreground/60" />
            </div>
            <span className="text-[10px] sm:text-xs text-foreground/50">
              Your Computer
            </span>
          </div>
          <span className="text-foreground/30 text-xs">runs</span>
          <div className="text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl neo-border-2 bg-blue-light/10 border-blue-light/30 flex items-center justify-center mx-auto mb-1.5">
              <DockerIcon size={22} className="text-blue-light" />
            </div>
            <span className="text-[10px] sm:text-xs text-blue-light">
              Docker
            </span>
          </div>
          <span className="text-foreground/30 text-xs">runs</span>
          <div className="text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl neo-border-2 bg-purple/10 border-purple/30 flex items-center justify-center mx-auto mb-1.5">
              <MessageSquareIcon size={22} className="text-purple" />
            </div>
            <span className="text-[10px] sm:text-xs text-purple">
              Gratonite
            </span>
          </div>
        </div>
        <p className="text-center text-foreground/40 text-xs mt-3">
          Everything stays clean and organized.
        </p>
      </div>

      {/* CTA */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href="https://docker.com/products/docker-desktop"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue-light text-white px-4 py-2 rounded-lg text-xs font-bold neo-shadow-sm hover:translate-y-[-1px] transition-transform"
        >
          Download Docker Desktop
        </a>
        <span className="text-foreground/40 text-xs">
          Free for personal use. Available on macOS, Windows, and Linux.
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "/Volumes/project bus/GratoniteFinalForm/apps/landing" && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/components/download/DockerExplainer.tsx
git commit -m "feat(landing): add DockerExplainer educational component"
```

---

## Chunk 2: Hero + Desktop Section

### Task 4: Create PlatformHero component

**Files:**
- Create: `apps/landing/src/components/download/PlatformHero.tsx`

- [ ] **Step 1: Create the PlatformHero client component**

This component detects the user's OS and renders a hero section with the appropriate download button. Before hydration, it shows a generic fallback.

```typescript
// apps/landing/src/components/download/PlatformHero.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppleIcon, WindowsIcon, TuxIcon } from "./icons";
import { VERSION, BASE_URL, detectOS, type Platform } from "./constants";

const platformConfig: Record<Platform, {
  name: string;
  detail: string;
  file: string;
  format: string;
  Icon: typeof AppleIcon;
  accent: string;
}> = {
  macos: {
    name: "Mac",
    detail: `v${VERSION} · macOS 12+ · Apple Silicon`,
    file: `${BASE_URL}/Gratonite-${VERSION}-arm64.dmg`,
    format: ".dmg",
    Icon: AppleIcon,
    accent: "purple",
  },
  windows: {
    name: "Windows",
    detail: `v${VERSION} · Windows 10+ · 64-bit`,
    file: `${BASE_URL}/Gratonite%20Setup%20${VERSION}.exe`,
    format: ".exe",
    Icon: WindowsIcon,
    accent: "blue",
  },
  linux: {
    name: "Linux",
    detail: `v${VERSION} · x64 · AppImage`,
    file: `${BASE_URL}/Gratonite-${VERSION}.AppImage`,
    format: ".AppImage",
    Icon: TuxIcon,
    accent: "green",
  },
};

const otherPlatforms: Record<Platform, Platform[]> = {
  macos: ["windows", "linux"],
  windows: ["macos", "linux"],
  linux: ["macos", "windows"],
};

export function PlatformHero() {
  const [os, setOs] = useState<Platform | null>(null);

  useEffect(() => {
    setOs(detectOS());
  }, []);

  // SSR / pre-hydration fallback
  if (!os) {
    return (
      <div className="text-center mb-12">
        <Badge color="purple" className="mb-4">Download Gratonite</Badge>
        <h1 className="text-4xl sm:text-5xl font-display font-black text-foreground mb-4">
          Download Gratonite
        </h1>
        <p className="text-foreground/60 text-lg mb-6">
          Available on macOS, Windows, and Linux.
        </p>
        <a href="#desktop" className="text-purple font-bold hover:underline">
          Choose your platform below
        </a>
      </div>
    );
  }

  const config = platformConfig[os];
  const others = otherPlatforms[os];

  return (
    <div className="text-center mb-12">
      <Badge color="purple" className="mb-4">Download Gratonite</Badge>
      <h1 className="text-4xl sm:text-5xl font-display font-black text-foreground mb-2">
        Gratonite for {config.name}
      </h1>
      <p className="text-foreground/50 mb-6">{config.detail}</p>

      <Button href={config.file} size="lg" variant="primary" className="inline-flex items-center gap-3">
        <config.Icon size={20} className="text-white" />
        Download {config.format}
      </Button>

      <p className="mt-4 text-foreground/40 text-sm">
        Not on {config.name}? Download for{" "}
        {others.map((p, i) => (
          <span key={p}>
            <a href="#desktop" className="text-purple font-semibold hover:underline">
              {platformConfig[p].name}
            </a>
            {i < others.length - 1 ? " or " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "/Volumes/project bus/GratoniteFinalForm/apps/landing" && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/components/download/PlatformHero.tsx
git commit -m "feat(landing): add PlatformHero with OS auto-detection and SSR fallback"
```

### Task 5: Create DesktopSection component

**Files:**
- Create: `apps/landing/src/components/download/DesktopSection.tsx`

- [ ] **Step 1: Create the DesktopSection component**

Uses the existing Card component. Highlights the detected platform card (passed as prop). Includes SmartScreen notice on Windows.

```typescript
// apps/landing/src/components/download/DesktopSection.tsx
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { Button } from "@/components/ui/Button";
import { AppleIcon, WindowsIcon, TuxIcon } from "./icons";
import { VERSION, BASE_URL, detectOS } from "./constants";

const platforms = [
  {
    id: "macos",
    Icon: AppleIcon,
    name: "macOS",
    detail: "Apple Silicon (M1+)",
    format: ".dmg",
    href: `${BASE_URL}/Gratonite-${VERSION}-arm64.dmg`,
    accent: "purple" as const,
  },
  {
    id: "windows",
    Icon: WindowsIcon,
    name: "Windows",
    detail: "64-bit",
    format: ".exe",
    href: `${BASE_URL}/Gratonite%20Setup%20${VERSION}.exe`,
    accent: "blue" as const,
    notice: "Windows may show a SmartScreen warning because we are a new app. Click \"More info\" then \"Run anyway\" to continue.",
  },
  {
    id: "linux-x64",
    Icon: TuxIcon,
    name: "Linux x64",
    detail: ".AppImage / .deb",
    format: ".AppImage",
    href: `${BASE_URL}/Gratonite-${VERSION}.AppImage`,
    debHref: `${BASE_URL}/gratonite-desktop_${VERSION}_amd64.deb`,
    accent: "gold" as const,
  },
  {
    id: "linux-arm64",
    Icon: TuxIcon,
    name: "Linux ARM64",
    detail: ".AppImage / .deb",
    format: ".AppImage",
    href: `${BASE_URL}/Gratonite-${VERSION}-arm64.AppImage`,
    debHref: `${BASE_URL}/gratonite-desktop_${VERSION}_arm64.deb`,
    accent: "gold" as const,
  },
];

export function DesktopSection() {
  const [detectedOS, setDetectedOS] = useState<string | null>(null);
  // detectOS() returns "macos" | "windows" | "linux" — we match "linux" to both linux cards

  useEffect(() => {
    setDetectedOS(detectOS());
  }, []);

  return (
    <section id="desktop" className="mb-16">
      <ScrollReveal>
        <p className="neo-sticker neo-sticker-purple inline-block mb-4">
          Gratonite Desktop
        </p>
      </ScrollReveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {platforms.map((p, i) => (
          <ScrollReveal key={p.id} delay={i * 0.06}>
            <Card
              accent={(detectedOS === p.id || (detectedOS === "linux" && p.id.startsWith("linux"))) ? p.accent : "none"}
              className="h-full flex flex-col items-center text-center p-5"
            >
              <div className="w-12 h-12 rounded-xl bg-surface neo-border-2 flex items-center justify-center mb-3">
                <p.Icon size={24} className={
                  p.accent === "purple" ? "text-purple" :
                  p.accent === "blue" ? "text-blue-light" :
                  "text-gold"
                } />
              </div>
              <h3 className="font-display font-bold text-foreground">{p.name}</h3>
              <p className="text-foreground/50 text-sm mb-3">{p.detail}</p>
              <Button href={p.href} size="sm" variant={(detectedOS === p.id || (detectedOS === "linux" && p.id.startsWith("linux"))) ? "primary" : "outline"} className="w-full mt-auto">
                Download {p.format}
              </Button>
              {"debHref" in p && p.debHref && (
                <a href={p.debHref} className="text-xs text-purple hover:underline mt-2">
                  or download .deb
                </a>
              )}
              {p.notice && (
                <p className="text-[11px] text-foreground/40 mt-2 leading-snug">
                  {p.notice}
                </p>
              )}
            </Card>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/components/download/DesktopSection.tsx
git commit -m "feat(landing): add DesktopSection with platform cards and SmartScreen notice"
```

---

## Chunk 3: Mobile + Server Sections

### Task 6: Create MobileSection component

**Files:**
- Create: `apps/landing/src/components/download/MobileSection.tsx`

- [ ] **Step 1: Create the MobileSection component**

```typescript
// apps/landing/src/components/download/MobileSection.tsx
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { AppleIcon, AndroidIcon } from "./icons";

export function MobileSection() {
  return (
    <section id="mobile" className="mb-16">
      <ScrollReveal>
        <p className="neo-sticker inline-block mb-4 border-pink-400 text-pink-500 bg-pink-50 dark:bg-pink-500/10">
          Gratonite Mobile
        </p>
      </ScrollReveal>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* iOS */}
        <ScrollReveal delay={0.06}>
          <Card accent="purple" className="h-full flex flex-col p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                <AppleIcon size={22} className="text-pink-500" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">iOS</h3>
                <Badge color="purple" className="text-[10px] px-2 py-0">
                  BETA
                </Badge>
              </div>
            </div>
            <p className="text-foreground/60 text-sm leading-relaxed mb-4 flex-1">
              Get early access to Gratonite on iPhone and iPad. Requires iOS
              16+.
            </p>
            <Button href="#" variant="primary" className="w-full">
              Join TestFlight Beta
            </Button>
          </Card>
        </ScrollReveal>

        {/* Android */}
        <ScrollReveal delay={0.12}>
          <Card className="h-full flex flex-col p-6 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center">
                <AndroidIcon size={22} className="text-foreground/30" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground/50">
                  Android
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 bg-foreground/5 px-2 py-0.5 rounded">
                  Coming Soon
                </span>
              </div>
            </div>
            <p className="text-foreground/40 text-sm leading-relaxed mb-4 flex-1">
              Android support is in development. Use the web app at
              gratonite.chat/app in the meantime.
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled
              aria-disabled="true"
            >
              Notify Me
            </Button>
            <p className="text-[11px] text-foreground/30 text-center mt-2">
              Android support is in development. We will announce it on our
              socials.
            </p>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/landing/src/components/download/MobileSection.tsx
git commit -m "feat(landing): add MobileSection with iOS beta and Android coming soon"
```

### Task 7: Create ServerSection component

**Files:**
- Create: `apps/landing/src/components/download/ServerSection.tsx`

This is the largest component. It contains the "Use Gratonite" card, bridging text, divider, and two self-hosting cards. It composes DockerExplainer and CopyButton.

- [ ] **Step 1: Create the ServerSection component**

```typescript
// apps/landing/src/components/download/ServerSection.tsx
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import {
  MessageSquareIcon,
  GlobeIcon,
  MonitorIcon,
  SmartphoneIcon,
  CheckIcon,
  ServerIcon,
  ClockIcon,
  UsersIcon,
} from "./icons";
import { DockerExplainer } from "./DockerExplainer";
import { CopyButton } from "./CopyButton";

const SERVER_APP_URL =
  "https://github.com/CoodayeA/Gratonite/releases/tag/server-v0.1.0";

function TrustItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-foreground/50 text-xs">
      <CheckIcon size={12} className="text-green-500 flex-shrink-0" />
      {text}
    </div>
  );
}

function KeepInMindItem({
  icon: Icon,
  text,
}: {
  icon: typeof ClockIcon;
  text: string;
}) {
  return (
    <div className="flex gap-2 items-start text-foreground/60 text-sm leading-snug">
      <Icon size={14} className="text-gold flex-shrink-0 mt-0.5" />
      {text}
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <div className="flex gap-2 items-start text-foreground/60 text-sm leading-snug">
      <CheckIcon size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
      {text}
    </div>
  );
}

export function ServerSection() {
  return (
    <section id="server">
      {/* Section header */}
      <ScrollReveal>
        <div className="text-center mb-8">
          <p className="neo-sticker neo-sticker-gold inline-block mb-4">
            Gratonite Server
          </p>
          <h2 className="text-3xl sm:text-4xl font-display font-black text-foreground mb-2">
            Create your portal
          </h2>
          <p className="text-foreground/60 max-w-lg mx-auto">
            A portal is your community space on Gratonite. Create one for your
            friends, team, or group. Pick what works for you.
          </p>
        </div>
      </ScrollReveal>

      {/* "Use Gratonite" card */}
      <ScrollReveal>
        <Card accent="purple" className="relative overflow-hidden p-6 sm:p-8 mb-6">
          <div className="absolute top-0 right-0 bg-purple text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wide">
            Most Popular
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple/10 flex items-center justify-center">
              <MessageSquareIcon size={22} className="text-purple" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                Use Gratonite
              </h3>
              <p className="text-purple text-sm font-medium">
                No setup needed. Just sign up and go.
              </p>
            </div>
          </div>

          <p className="text-foreground/60 leading-relaxed mb-4 max-w-2xl">
            Create a portal, invite your friends, and start chatting. We handle
            all the technical stuff so you don't have to. Available on the web,
            as a desktop app, and on mobile.
          </p>

          {/* Platform pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { Icon: GlobeIcon, label: "Web App" },
              { Icon: MonitorIcon, label: "Desktop App" },
              { Icon: SmartphoneIcon, label: "Mobile App" },
            ].map(({ Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 bg-charcoal/5 dark:bg-charcoal/30 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground/70 neo-border-2"
              >
                <Icon size={14} className="text-purple" />
                {label}
              </span>
            ))}
          </div>

          {/* Trust row */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-4 border-t border-foreground/5">
            <TrustItem text="100% open source" />
            <TrustItem text="No ads, no data selling" />
            <TrustItem text="Free forever" />
            <TrustItem text="Export your data anytime" />
          </div>

          <div className="mt-5">
            <Button href="https://gratonite.chat/app" variant="primary">
              Get Started
            </Button>
          </div>
        </Card>
      </ScrollReveal>

      {/* Bridging text */}
      <ScrollReveal>
        <p className="text-center text-foreground/40 text-sm max-w-lg mx-auto mb-2">
          When you use Gratonite above, your portals live on our servers. Below,
          you can run your own copy of Gratonite so your portals live on
          hardware you control.
        </p>
      </ScrollReveal>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-foreground/10" />
        <span className="text-foreground/30 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
          Want to host Gratonite yourself?
        </span>
        <div className="flex-1 h-px bg-foreground/10" />
      </div>

      {/* Self-hosting options */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Run on Your Computer */}
        <ScrollReveal delay={0.06}>
          <Card className="h-full flex flex-col p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                <MonitorIcon size={22} className="text-gold" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">
                  Run on Your Computer
                </h3>
                <p className="text-gold text-sm font-medium">
                  Your portals live on your machine
                </p>
              </div>
            </div>

            <p className="text-foreground/60 text-sm leading-relaxed mb-4">
              Download an app that turns your computer into a Gratonite server.
              Perfect for trying and learning about self-hosting, great for a
              small group of friends.
            </p>

            {/* Keep in mind */}
            <div className="bg-charcoal/5 dark:bg-charcoal/30 rounded-lg p-4 mb-4">
              <p className="text-gold text-[10px] font-bold uppercase tracking-wider mb-2">
                Keep in mind
              </p>
              <div className="space-y-2">
                <KeepInMindItem
                  icon={ClockIcon}
                  text="Your portals go offline when your computer sleeps or shuts down"
                />
                <KeepInMindItem
                  icon={GlobeIcon}
                  text="Friends connect through your home internet"
                />
                <KeepInMindItem
                  icon={UsersIcon}
                  text="Best for small groups, under 20 people"
                />
              </div>
            </div>

            <DockerExplainer />

            <div className="mt-auto pt-4">
              <Button
                href={SERVER_APP_URL}
                variant="secondary"
                className="w-full"
              >
                Download Server App
              </Button>
              <p className="text-[11px] text-foreground/40 text-center mt-2">
                macOS, Windows, Linux. Requires Docker (free).
              </p>
            </div>
          </Card>
        </ScrollReveal>

        {/* Always-On Server */}
        <ScrollReveal delay={0.12}>
          <Card accent="gold" className="h-full flex flex-col p-6 relative">
            <div className="absolute top-3 right-3">
              <Badge color="purple" className="text-[10px]">
                Best for Communities
              </Badge>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ServerIcon size={22} className="text-green-500" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">
                  Always-On Server
                </h3>
                <p className="text-green-500 text-sm font-medium">
                  Your portals are online 24/7
                </p>
              </div>
            </div>

            <p className="text-foreground/60 text-sm leading-relaxed mb-4">
              Deploy to a cloud server that is always online. Your portals are
              available around the clock, even when your computer is off. One
              command sets up everything automatically.
            </p>

            {/* Benefits */}
            <div className="bg-charcoal/5 dark:bg-charcoal/30 rounded-lg p-4 mb-4">
              <div className="space-y-2">
                <BenefitItem text="Always online, never goes down when you close your laptop" />
                <BenefitItem text="Fast for everyone, not limited by your home internet" />
                <BenefitItem text="Handles any community size, from 5 to 5,000 members" />
              </div>
            </div>

            <DockerExplainer />

            {/* CLI command */}
            <div className="mt-4 flex items-center gap-2 bg-charcoal/10 dark:bg-charcoal/40 neo-border-2 rounded-lg px-4 py-2.5">
              <code className="text-purple text-xs font-mono flex-1 select-all">
                curl -fsSL https://gratonite.chat/install | bash
              </code>
              <CopyButton text="curl -fsSL https://gratonite.chat/install | bash" />
            </div>

            <div className="mt-auto pt-4 text-center">
              <a
                href="/deploy/"
                className="text-purple text-sm font-bold hover:underline"
              >
                Setup guide and hosting providers
              </a>
              <p className="text-[11px] text-foreground/40 mt-1">
                Starts at around $5/month
              </p>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "/Volumes/project bus/GratoniteFinalForm/apps/landing" && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/components/download/MobileSection.tsx apps/landing/src/components/download/ServerSection.tsx
git commit -m "feat(landing): add MobileSection and ServerSection components"
```

---

## Chunk 4: Page Assembly + Deploy + Web App Updates

### Task 8: Rewrite the download page

**Files:**
- Modify: `apps/landing/src/app/download/page.tsx`

- [ ] **Step 1: Rewrite download/page.tsx**

Replace the entire file. This composes all the new components.

```typescript
// apps/landing/src/app/download/page.tsx
import { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { PlatformHero } from "@/components/download/PlatformHero";
import { DesktopSection } from "@/components/download/DesktopSection";
import { MobileSection } from "@/components/download/MobileSection";
import { ServerSection } from "@/components/download/ServerSection";

export const metadata: Metadata = createPageMetadata({
  title: "Download Gratonite | Desktop, Mobile, and Server",
  description:
    "Download Gratonite for macOS, Windows, Linux, iOS, or Android. Or host your own instance with one click. Free, open source, no ads.",
  path: "/download/",
  keywords: [
    "Gratonite download",
    "chat app download",
    "Discord alternative download",
    "self-host chat",
    "open source chat app",
    "macOS chat app",
    "Windows chat app",
    "Linux chat app",
    "iOS chat app",
  ],
});

export default function DownloadPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      {/* Decorative bursts */}
      <div className="neo-burst neo-burst-gold top-10 right-[-90px]" />
      <div className="neo-burst neo-burst-purple bottom-4 left-[-100px]" />

      <div className="max-w-7xl mx-auto relative z-10">
        <PlatformHero />
        <DesktopSection />
        <MobileSection />
        <ServerSection />

        {/* Release notes link */}
        <ScrollReveal>
          <div className="text-center mt-12 pt-8 border-t border-foreground/10">
            <p className="text-foreground/40 text-sm">
              See what is new in each version on the{" "}
              <a
                href="/releases/"
                className="text-purple font-semibold hover:underline"
              >
                release notes
              </a>{" "}
              page.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page builds**

Run: `cd "/Volumes/project bus/GratoniteFinalForm/apps/landing" && npx next build 2>&1 | tail -20`
Expected: Build succeeds, `/download` page generated.

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/app/download/page.tsx
git commit -m "feat(landing): rewrite download page with Desktop/Mobile/Server sections"
```

### Task 9: Update deploy page terminology

**Files:**
- Modify: `apps/landing/src/app/deploy/page.tsx`

- [ ] **Step 1: Update deploy page**

Read the file at `apps/landing/src/app/deploy/page.tsx`. Make these specific changes:

1. Line 89: Change `"Your users can join servers on gratonite.chat"` to `"Your users can join portals on gratonite.chat"`
2. Line 16 (SEO keywords): Change `"Gratonite server"` to `"Gratonite server"` (keep as-is, this is infrastructure context)
3. Line 74: Keep as-is (`"live on your server"` is infrastructure context)
4. Verify the existing link at line 132 (`href="/download#server"`) still works with the new page (it does, the anchor id is `#server`)

No structural changes. The deploy page correctly uses "server" in the infrastructure sense throughout, except line 89 which refers to community spaces.

- [ ] **Step 2: Verify build**

Run: `cd "/Volumes/project bus/GratoniteFinalForm/apps/landing" && npx next build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/app/deploy/page.tsx
git commit -m "fix(landing): update deploy page terminology (portal) and link to Server App"
```

### Task 10: Final verification and push

- [ ] **Step 1: Run full build for both apps**

```bash
cd "/Volumes/project bus/GratoniteFinalForm/apps/landing" && npx next build 2>&1 | tail -5
cd "/Volumes/project bus/GratoniteFinalForm/apps/web" && npx tsc --noEmit 2>&1 | head -5
```

- [ ] **Step 2: Visual check**

Start the landing site dev server and verify:
- Hero auto-detects OS and shows correct download button
- Desktop section shows 4 platform cards with brand icons
- Mobile section shows iOS beta + Android coming soon
- Server section shows "Use Gratonite" card + divider + two self-hosting cards
- Docker explainer appears in both self-hosting cards with visual diagram
- Copy button works on CLI command
- Responsive layout works at mobile/tablet/desktop widths
- Light and dark mode both look correct

```bash
cd "/Volumes/project bus/GratoniteFinalForm/apps/landing" && npx next dev
# Open http://localhost:3000/download/ in browser
```

- [ ] **Step 3: Push**

Follow the project's git workflow: code review, then push to main.
