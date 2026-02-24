# Project Board (Single Source of Truth)

Last updated: 2026-02-22
Priority: Web -> Desktop -> Mobile
Execution plan (current): `docs/plans/2026-02-22-spec-aligned-sprint-plan.md`

## Completed

1. WEB-001 Root command reliability (web-first)
2. WEB-002 PR CI gates
3. WEB-003 Critical path test matrix
4. WEB-005 Release gates + severity policy
5. WEB-004 Deterministic seed/reset command (`pnpm test:reset`)
6. WEB-010 CI artifacts for failing browser test runs
7. WEB-011 initial pass: route-level code splitting to reduce web entry bundle
8. WEB-006 Web E2E auth flow (passing)
9. WEB-007 Web E2E messaging core (passing)
10. WEB-012 pass 1: API hotspot DB indexes (messages/search/guild-members)
11. WEB-012 pass 2: API hotspot tuning (EXPLAIN + cache + smoke + CI)
12. WEB-013 Voice/browser reliability hardening (engineering pass + automated checks)
13. WEB-014 Web E2E runtime stability hardening (Playwright isolated servers + CORS allowlist)
14. WEB-018 Interaction primitives polish pack (buttons/inputs/modals/context-menu consistency)
15. WEB-045 Server creation template flow (starter channels + invite handoff)
16. WEB-047 Channel lifecycle UX (pass 2: private permission editor + visibility enforcement + delete fallback tests)
17. WEB-031 Guild card media controls (fit mode + animated banner toggle + fallback policy + e2e)
18. WEB-040 2D Avatar Studio foundations (deterministic sprite model/renderer + profile integration toggle + fallback preserved)
19. WEB-028 Accessibility conformance pass (keyboard smoke + reduced-motion/contrast e2e + checklist evidence)
20. WEB-029 Performance guardrails (budget doc + runtime paint telemetry markers + command evidence)
21. WEB-049 Repo split execution (waves 1-5 merged across split repos with passing CI)

## In Progress

1. WEB-011 Optimize render hotspots (follow-up passes)
2. WEB-016 Design tokens v2 foundation (scaffold implemented; visual QA in progress)
3. WEB-017 UI shell modernization pass (v2 flag-on first visual pass started)
4. WEB-030 Server gallery navigation surface (v2 flag-on foundation implemented)
5. WEB-032 Server emoji management UX (settings emoji tab + studio flow)
6. WEB-034 Display Name Styles UX (profiles + accessibility + styled rendering)
7. WEB-035 Profile enhancements MVP (server tag + status + widgets)
8. WEB-037 Profile cosmetics shop UX (avatar decorations + profile effects + nameplates, API-backed)
9. WEB-038 Cosmetics delivery reliability (hash asset resolver + seeded catalogs/assets)
10. WEB-048 Silent voice room entry UX (pass 1: silent-entry cues + call-state cleanup + e2e coverage)
11. WEB-019 Theme customization + sharing v1 (appearance Theme Studio scaffold + import/export persistence)
12. WEB-022 Motion and micro-interaction system (foundation wired to theme motion + reduced-motion guardrails)
13. WEB-017 UI shell modernization pass (core surfaces updated to motion/tokenized v2 transitions)
14. WEB-036 Community shop items pipeline (moderation guardrails + schema/service tests + creator draft UX; endpoint e2e needs migration parity)
15. WEB-041 Starter wearables catalog + equip UX (pass 2: wardrobe card previews + hover interactions + persisted equips)
16. WEB-042 Soft currency rewards and spend ledger (hardening pass: daily caps + spend endpoint + auditor ledger route + tests)
17. WEB-027 Visual regression suite (baseline snapshots + visual e2e command)

## Next Up

1. Manual screen-reader walkthrough evidence for WEB-028
2. Expose user-facing motion toggle controls in Appearance (WEB-022 follow-up)
3. Manual Safari/Zen voice validation when desktop/mobile validation cycle starts
4. Run post-merge smoke in each split repo (`for-web`, `self-hosted`, `for-desktop`, `for-ios`, `for-android`, `gratonite.chat`)

## Blocked

1. Web lint gate (eslint config/tooling not yet implemented)
2. Full monorepo typecheck (currently blocked by existing API strict TS errors outside web-first scope)

## Deferred (By Priority Decision)

1. Desktop packaging/signing hardening
2. Mobile functional navigation and push implementation
3. Manual Safari/Zen voice validation (deferred to final beta cycle)

## Rules

1. Move cards only after command/test evidence exists.
2. Do not promote to release candidate with open P0/P1 web issues.
3. Keep this board aligned with `docs/plans/2026-02-21-web-recovery-plan.md`.
4. UI/UX work must follow `docs/plans/2026-02-21-ui-ux-modernization-blueprint.md`.
5. Active sprint execution and scope freeze must follow `docs/plans/2026-02-22-spec-aligned-sprint-plan.md`.
