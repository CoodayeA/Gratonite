# WCAG 2.1 AA audit checklist (Gratonite web)

Use this for a **structured** accessibility pass. Target is **WCAG 2.1 Level AA**. Record pass/fail and notes per page or feature.

## Perimeter

- **In scope:** `apps/web` — primary user flows.
- **Out of scope (initial pass):** Admin-only tools, rare legacy modals — schedule a second pass.

## Principles (quick map)


| Principle          | Examples                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| **Perceivable**    | Text alternatives, adaptable layout, distinguishable content (contrast). |
| **Operable**       | Keyboard access, enough time, seizures (avoid flashing), navigable.      |
| **Understandable** | Readable, predictable, input assistance.                                 |
| **Robust**         | Valid name/role/value, compatible with AT.                               |


## Global (all surfaces)

- **Focus visible** — Focus ring or equivalent on interactive elements (2.4.7 Focus Visible).
- **Skip link** — Skip to main content where layout has repeated nav (2.4.1 Bypass Blocks).
- **Page title** — Document title reflects current view (2.4.2).
- **Landmarks** — `main`, `nav`, complementary regions where appropriate (1.3.1).
- **Heading hierarchy** — Logical order in modals and settings (1.3.1).
- **Color contrast** — Normal text ≥ 4.5:1, large text ≥ 3:1 (1.4.3).
- **Resize** — Usable at 200% zoom (1.4.4).
- **Motion** — Respect `prefers-reduced-motion` where animations are decorative (2.3.3).

## Modals and dialogs

- **Focus trap** — Tab stays inside modal until dismissed (2.1.2).
- **Escape** — Closes modal; documented in `WhatsNewModal` and others.
- **aria-modal** / **role="dialog"** — Correct labelling (4.1.2).
- **Initial focus** — Moves to dialog or primary action predictably.

## Forms and composer

- **Labels** — Inputs have associated labels (visible or `aria-label`) (3.3.2).
- **Errors** — Error identification + suggestion where applicable (3.3.1, 3.3.3).
- **Required fields** — Indicated in text or `aria-required` (3.3.2).

## Chat and messages

- **Live regions** — New messages: avoid overwhelming screen readers (optional `aria-live` strategy).
- **Message actions** — Icon-only buttons have accessible names (4.1.2).

## Voice / LiveKit

- **Toolbar** — `role="toolbar"` + `aria-label` (see `VoiceBar`).
- **Mute / deafen / disconnect** — Each control has name and state (4.1.2).
- **Keyboard** — Shortcuts documented; no sole pointer-only paths for critical actions (2.1.1).

## Auth

- **Errors** — Clear, associated with fields.
- **Captcha** — If added, accessible alternative.

## Definition of done (audit)

- All **P0** items (keyboard blockers, missing names, contrast failures on primary buttons) fixed.
- **P1** tracked with issue IDs.
- Retest after fixes with keyboard + one screen reader (NVDA or VoiceOver).

## Status

**Pass 1 started: 2026-07-15**

### Completed in this pass

- ✅ **eslint-plugin-jsx-a11y** expanded to full recommended rule set (`eslint.config.js`)
  — 4 rules → 21 rules (all at `warn` level to allow incremental fixing)
- ✅ **Lint budget lowered**: `--max-warnings=250` → `--max-warnings=100` (`apps/web/package.json`)
- ✅ **`alt` text audit**: all `<img>` elements in `apps/web/src` reviewed;
  decorative images use `alt=""`, content images have descriptive alt text.
- ✅ **New modals created with correct ARIA**: `ConnectInstanceWizard` has
  `role="dialog"`, `aria-modal="true"`, `aria-label`, and `autoFocus` on primary input.
- 🔶 **Icon-only buttons** (message actions, toolbar): many buttons contain only Lucide icons
  with no `aria-label`. P0 item — tracked for Pass 2.
- 🔶 **`click-events-have-key-events`**: `onClick` on non-interactive elements
  (many `<div onClick>` patterns in ChannelChat, MessageItem). P1 — tracked for Pass 2.
- 🔶 **Focus trap** in modals: Tab focus not trapped in most modals.
  P0 — will use `@radix-ui/react-focus-scope` or `focus-trap-react`. Tracked for Pass 2.
- 🔶 **Skip link**: no skip-to-content link in the main layout. P1 — tracked for Pass 2.

### Next pass targets (Pass 2)

1. Add `aria-label` to all icon-only `<button>` elements (ChannelChat, MessageItem, VoiceBar)
2. Add focus trap to all modal dialogs (SettingsModal, UserProfileModal, GuildSettingsModal)
3. Add skip link to main layout (`App.tsx`)
4. Replace `<div onClick>` patterns with `<button>` where semantically correct
5. Lower lint budget: 100 → 50