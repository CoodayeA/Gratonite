# WCAG 2.1 AA audit checklist (Gratonite web)

Use this for a **structured** accessibility pass. Target is **WCAG 2.1 Level AA**. Record pass/fail and notes per page or feature.

## Perimeter

- **In scope:** `apps/web` — primary user flows.
- **Out of scope (initial pass):** Admin-only tools, rare legacy modals — schedule a second pass.

## Principles (quick map)

| Principle | Examples |
|-----------|----------|
| **Perceivable** | Text alternatives, adaptable layout, distinguishable content (contrast). |
| **Operable** | Keyboard access, enough time, seizures (avoid flashing), navigable. |
| **Understandable** | Readable, predictable, input assistance. |
| **Robust** | Valid name/role/value, compatible with AT. |

## Global (all surfaces)

- [ ] **Focus visible** — Focus ring or equivalent on interactive elements (2.4.7 Focus Visible).
- [ ] **Skip link** — Skip to main content where layout has repeated nav (2.4.1 Bypass Blocks).
- [ ] **Page title** — Document title reflects current view (2.4.2).
- [ ] **Landmarks** — `main`, `nav`, complementary regions where appropriate (1.3.1).
- [ ] **Heading hierarchy** — Logical order in modals and settings (1.3.1).
- [ ] **Color contrast** — Normal text ≥ 4.5:1, large text ≥ 3:1 (1.4.3).
- [ ] **Resize** — Usable at 200% zoom (1.4.4).
- [ ] **Motion** — Respect `prefers-reduced-motion` where animations are decorative (2.3.3).

## Modals and dialogs

- [ ] **Focus trap** — Tab stays inside modal until dismissed (2.1.2).
- [ ] **Escape** — Closes modal; documented in `WhatsNewModal` and others.
- [ ] **aria-modal** / **role="dialog"** — Correct labelling (4.1.2).
- [ ] **Initial focus** — Moves to dialog or primary action predictably.

## Forms and composer

- [ ] **Labels** — Inputs have associated labels (visible or `aria-label`) (3.3.2).
- [ ] **Errors** — Error identification + suggestion where applicable (3.3.1, 3.3.3).
- [ ] **Required fields** — Indicated in text or `aria-required` (3.3.2).

## Chat and messages

- [ ] **Live regions** — New messages: avoid overwhelming screen readers (optional `aria-live` strategy).
- [ ] **Message actions** — Icon-only buttons have accessible names (4.1.2).

## Voice / LiveKit

- [ ] **Toolbar** — `role="toolbar"` + `aria-label` (see `VoiceBar`).
- [ ] **Mute / deafen / disconnect** — Each control has name and state (4.1.2).
- [ ] **Keyboard** — Shortcuts documented; no sole pointer-only paths for critical actions (2.1.1).

## Auth

- [ ] **Errors** — Clear, associated with fields.
- [ ] **Captcha** — If added, accessible alternative.

## Definition of done (audit)

- All **P0** items (keyboard blockers, missing names, contrast failures on primary buttons) fixed.
- **P1** tracked with issue IDs.
- Retest after fixes with keyboard + one screen reader (NVDA or VoiceOver).

## Status

**Template** — Fill in dates and owners when the formal audit starts.
