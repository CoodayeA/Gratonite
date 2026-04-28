# A11y Pass 4 — Label Association Plan

**Goal:** Resolve all 191 `jsx-a11y/label-has-associated-control` warnings in `apps/web` and tighten the lint ceiling toward `--max-warnings=0`.

**Branch:** `feat/a11y-pass-4-label-association` (created off `main` / `temp-main`).

**Status (audit baseline, captured this session):**

- Total warnings: **191** across **52 files**
- Lint config: `eslint . --max-warnings=250` — currently passing with 192 total warnings (191 of this rule + 1 other)
- Tests: 17/17 passing on `apps/web`
- All other lint rules clean (0 errors)

---

## Why this is per-site work, not a bulk codemod

Each warning falls into one of three patterns and each demands a different fix:

| Pattern | Example | Correct fix |
|---|---|---|
| **A. Sibling label + single control** | `<label>Channel</label><select>…</select>` in same `<div>` | Add `htmlFor` + `id` (use `useId()` for component reuse) **or** wrap the control inside the label |
| **B. Label as group heading** | `<label>Events to Log</label><div role="group">…checkboxes…</div>` | Convert to `<fieldset>` + `<legend>`, or change to a non-`<label>` element with `aria-labelledby` on the group |
| **C. Label with non-control content** | `<label>` containing only text + an icon (used as section header) | Replace with `<div>` / `<h4>` styled the same way |

Mechanical bulk replacement risks: layout regressions (label has `block`, `flex`, etc. classes), misuse of `<fieldset>` reset styling, breaking click-to-focus behavior on existing nested labels.

---

## Execution batches (52 files, 191 warnings)

Each batch is a single PR-sized chunk. Run `npm --prefix apps/web run lint` after each file; run `npm --prefix apps/web run test` after each batch.

### Batch 1 — High-density modals (43 warnings, 4 files)

Highest payoff per file. Likely contains many group-heading labels.

- [ ] `src/components/modals/GuildSettingsModal.tsx` (27)
- [ ] `src/components/modals/SettingsModal.tsx` (8)
- [ ] `src/components/modals/MemberOptionsModal.tsx` (8)

### Batch 2 — Builder pages (27 warnings, 4 files)

- [ ] `src/pages/app/BotBuilder.tsx` (11)
- [ ] `src/pages/guilds/GuildWorkflows.tsx` (8)
- [ ] `src/pages/app/Marketplace.tsx` (7)
- [ ] `src/components/modals/ChannelSettingsModal.tsx` (7)

### Batch 3 — Setup, scheduling, chat (26 warnings, 5 files)

- [ ] `src/pages/Setup.tsx` (6)
- [ ] `src/pages/guilds/EventScheduler.tsx` (5)
- [ ] `src/pages/guilds/ChannelChat.tsx` (5)
- [ ] `src/components/modals/settings/SettingsAccountTab.tsx` (5)
- [ ] `src/components/modals/OnboardingModal.tsx` (5)

### Batch 4 — Composer + theme + reactions (20 warnings, 5 files)

- [ ] `src/components/chat/MessageInput.tsx` (5)
- [ ] `src/pages/app/CreatorDashboard.tsx` (4)
- [ ] `src/components/modals/ThemeEditorModal.tsx` (4)
- [ ] `src/components/guild/ReactionRoleBuilder.tsx` (4)
- [ ] `src/components/guild/ProfileThemeEditor.tsx` (4)

### Batch 5 — Configs + currency + reports (22 warnings, 7 files)

- [ ] `src/components/guild/DigestConfig.tsx` (4)
- [ ] `src/pages/app/ThemeBuilder.tsx` (3)
- [ ] `src/components/UserProfileV2.tsx` (3)
- [ ] `src/components/modals/guild-settings/CurrencyPanel.tsx` (3)
- [ ] `src/components/modals/FederatedReportModal.tsx` (3)
- [ ] `src/components/modals/CreateGuildModal.tsx` (3)
- [ ] `src/components/guild/StarboardConfig.tsx` (3)
- [ ] `src/components/guild/NoCodeBotBuilder.tsx` (3)

### Batch 6 — Pages + small modals (24 warnings, 12 files)

- [ ] `src/pages/guilds/QAChannel.tsx` (2)
- [ ] `src/pages/auth/ResetPassword.tsx` (2)
- [ ] `src/pages/app/Trading.tsx` (2)
- [ ] `src/pages/app/DirectMessage.tsx` (2)
- [ ] `src/pages/admin/AdminTeam.tsx` (2)
- [ ] `src/components/voice/StudyRoom.tsx` (2)
- [ ] `src/components/modals/UserProfileModal.tsx` (2)
- [ ] `src/components/modals/settings/SettingsFeedbackTab.tsx` (2)
- [ ] `src/components/modals/NotificationPrefsModal.tsx` (2)
- [ ] `src/components/modals/guild-settings/GuildInvitesPanel.tsx` (2)
- [ ] `src/components/modals/guild-settings/GuildDiscoveryTagsPanel.tsx` (2)
- [ ] `src/components/guild/WorkflowBuilder.tsx` (2)

### Batch 7 — Long tail (29 warnings, 15 files)

- [ ] `src/components/guild/TimezoneDisplay.tsx` (2)
- [ ] `src/components/guild/AutoRoleConfig.tsx` (2)
- [ ] `src/components/guild/ActivityLogConfig.tsx` (2)
- [ ] `src/App.tsx` (2)
- [ ] `src/pages/InviteAccept.tsx` (1)
- [ ] `src/pages/guilds/Leaderboard.tsx` (1)
- [ ] `src/pages/guilds/FormBuilder.tsx` (1)
- [ ] `src/components/modals/settings/SettingsPrivacyTab.tsx` (1)
- [ ] `src/components/modals/InviteModal.tsx` (1)
- [ ] `src/components/modals/GiftModal.tsx` (1)
- [ ] `src/components/modals/ConnectInstanceWizard.tsx` (1)
- [ ] `src/components/guild/WelcomeScreenBuilder.tsx` (1)
- [ ] `src/components/guild/TicketPanel.tsx` (1)
- [ ] `src/components/guild/SeasonalDecorations.tsx` (1)
- [ ] `src/components/cards/TradeModal.tsx` (1)

---

## Fix conventions

**Pattern A (sibling label → single control):**

```tsx
// before
<div>
  <label className="...">Channel</label>
  <select value={…} onChange={…}>…</select>
</div>

// after
const channelSelectId = useId();
…
<div>
  <label htmlFor={channelSelectId} className="...">Channel</label>
  <select id={channelSelectId} value={…} onChange={…}>…</select>
</div>
```

**Pattern B (label as group heading):**

```tsx
// before
<div>
  <label className="...">Events to Log</label>
  <div className="grid grid-cols-2">…checkboxes…</div>
</div>

// after
<fieldset className="border-0 p-0 m-0">
  <legend className="…same classes as old label…">Events to Log</legend>
  <div className="grid grid-cols-2">…checkboxes…</div>
</fieldset>
```

`<fieldset>` resets need explicit `border-0 p-0 m-0` (or move classes to legend) to keep visual parity.

**Pattern C (label as section header / standalone text):**

Replace `<label>` with `<div>` or appropriate heading element. Do not contort the JSX to satisfy the rule when the element is wrong semantically.

---

## Acceptance criteria per batch

1. `npm --prefix apps/web run lint` warning count drops by the batch's expected total
2. `npm --prefix apps/web run test` still 17/17 passing (or new passing tests added if behavior changes)
3. No visual regressions in batched files (manual spot check via `pnpm --dir apps/web dev`)
4. Commit per batch: `fix(a11y): associate labels with controls in <area> (batch N/7)`

## Final acceptance

- Total `label-has-associated-control` warnings: **0**
- Lint ceiling lowered: change `apps/web/package.json` `lint` script to `--max-warnings=50` (or lower) to lock in the gain
- Update `docs/a11y/WCAG-AUDIT-CHECKLIST.md` to reflect Pass 4 completion
- Update `ROADMAP.md` "Recently shipped" with Pass 4 entry
- Add release note entry in `apps/web/docs/release-notes` (or wherever recent notes live — see v1.1.0 notes for format)

---

## Effort estimate

- Batch 1: ~60 min (GuildSettingsModal alone is dense)
- Batches 2–4: ~40 min each
- Batches 5–7: ~30 min each (smaller files, repetitive)
- **Total: ~4–5 hours** focused work, splittable across 3–4 sessions

## Risks

- `<fieldset>` default styles can break Tailwind layouts — apply `border-0 p-0 m-0` consistently
- Components rendering many list items with shared labels may need `useId()` + index suffix
- A few labels may already be inside complex composite controls (e.g., custom `<Select>` wrappers) where the rule cannot be satisfied without restructuring the control itself — flag these for a follow-up
