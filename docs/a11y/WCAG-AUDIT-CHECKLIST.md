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

**Pass 1 completed: 2026-04-03**
**Pass 2 started: 2026-04-04**
**Pass 4 completed: 2026-04-27** — all 191 `label-has-associated-control` warnings eliminated; lint ceiling lowered 250 → 5

### Completed in Pass 1

- ✅ **eslint-plugin-jsx-a11y** expanded (4 → 21 rules, all at `warn`; high-volume interaction rules deferred to Pass 2)
- ✅ **Lint budget**: kept at `--max-warnings=250` pending Pass 2 fixes
- ✅ **`alt` text audit**: all `<img>` in `apps/web/src` reviewed; decorative `alt=""`, content images descriptive
- ✅ **New modals**: `ConnectInstanceWizard` created with `role="dialog"`, `aria-modal`, `aria-label`, `autoFocus`

### Completed in Pass 2

- ✅ **Icon-only `<X>` buttons** — bulk-labelled `aria-label="Close"` across 8 files (Marketplace, Gacha, BotBuilder, PluginStoreModal, WhatsNewModal, SharedMediaGallery, ProfileShowcaseEditor, SettingsModal, App.tsx)
- ✅ **SettingsModal sidebar nav** — all 19 `<div className="sidebar-nav-item" onClick>` items updated to `role="button" tabIndex={0}` for keyboard access
- ✅ **Register.tsx terms/privacy** — `<span onClick>` → `<button type="button">` (native keyboard + AT support)
- ✅ **High-volume interaction rules** (`click-events-have-key-events`, `interactive-supports-focus`, `mouse-events-have-key-events`) — kept `'off'` until remaining `div onClick` patterns are converted

### Next pass targets (Pass 3)

1. Enable `click-events-have-key-events` + `interactive-supports-focus` and fix remaining `div onClick` patterns (ChannelChat, MessageItem, etc.)
2. Add focus trap to all modal dialogs (use `@radix-ui/react-focus-scope` or `focus-trap-react`)
3. Add skip link to main layout (`App.tsx`)
4. Lower lint budget: 250 → 100

### Completed in Pass 4 (label association)

- ✅ **52 files, 191 warnings → 0** for `jsx-a11y/label-has-associated-control` (7 batches)
- ✅ Three patterns applied per-site:
  - **Pattern A** (`htmlFor` + `id` via `useId()`): the majority — single label/control pairs
  - **Pattern B** (`<fieldset>` + `<legend>` with `border-0 p-0 m-0` reset): checkbox/radio groups
  - **Pattern C** (`<label>` → `<div>` / `<span>`): section headers carrying icons but no control
- ✅ Tests still 17/17 green
- ✅ Lint ceiling lowered: `--max-warnings=250` → `--max-warnings=5` (1 unrelated `img-redundant-alt` remains)
- ✅ Plan: `docs/a11y/PASS-4-LABEL-ASSOCIATION-PLAN.md`

### Next pass targets (Pass 5)

1. Resolve final `img-redundant-alt` in `RichTextRenderer.tsx:526`; lower ceiling to `0`
2. Add `lint:a11y:strict` to `pre-commit` / CI required check
3. Audit remaining `aria-label` text for i18n coverage (the new `useId`-driven labels are visible text already, but the `aria-label` fallbacks added in Setup.tsx and SettingsPrivacyTab.tsx should be wired through `t()`)