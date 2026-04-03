# Gratonite multi-year execution plan

This document turns the [ROADMAP.md](../ROADMAP.md) into **ordered workstreams** with realistic sequencing. It does **not** promise calendar dates; it defines **dependencies** and **definition of done** per initiative.

**Reality check:** “Execute everything” in the roadmap is **years** of engineering (crypto, bridges, desktop runtime change, federation v2). Delivery happens in **phases** with parallel tracks where staffing allows.

---

## How to use this doc

| Artifact | Purpose |
|----------|---------|
| [docs/crypto/FORWARD-PLAN.md](./crypto/FORWARD-PLAN.md) | Double Ratchet + multi-device: phases and risks |
| [docs/a11y/WCAG-AUDIT-CHECKLIST.md](./a11y/WCAG-AUDIT-CHECKLIST.md) | WCAG 2.1 AA audit checklist by surface |
| [docs/i18n-CONTRIBUTING.md](./i18n-CONTRIBUTING.md) | Locale parity and contributor workflow |
| [docs/mobile/E2E-ATTACHMENTS-GAP.md](./mobile/E2E-ATTACHMENTS-GAP.md) | Known gap: mobile vs web encrypted attachments |
| `pnpm i18n:check` (repo root) | Compare locale keys to `en` (see root `package.json`) |

---

## Current product reality (encryption)

- **Web:** DMs and **encrypted channels** can encrypt **message text** (ECDH + AES-GCM) and **attachments** via `encryptFile` / `decryptFile` in [`apps/web/src/lib/e2e.ts`](../apps/web/src/lib/e2e.ts) before upload; metadata is carried on the message payload where implemented.
- **Roadmap item “E2E encrypted file attachments”** is therefore **not greenfield**: remaining work is **parity** (mobile, all flows, large files, UX when decryption fails) and **hardening** (audits, abuse limits), not “invent encrypt-on-client.”
- **Double Ratchet** and **multi-device key sync** are **not** implemented; they are separate large programs (see forward crypto plan).

---

## Phase A — Near-term (roadmap “Q2 2026” themes)

Run **in parallel** after kickoff where possible.

### A1 — Accessibility (WCAG 2.1 AA)

- **DoD:** Checklist in `docs/a11y/WCAG-AUDIT-CHECKLIST.md` completed for web primary flows (auth, guild list, channel chat, DMs, settings, voice bar), with issues tracked and P0/P1 fixed.
- **Tooling:** Optional: add `eslint-plugin-jsx-a11y` behind a non-blocking script or fix incrementally; main `lint` stays strict.
- **Not in scope for A1:** Perfect score on every admin page day one — iterate.

### A2 — i18n expansion

- **DoD:** Documented contributor path; `pnpm i18n:check` clean for **target** locales you commit to, or explicit allowlist of known drift.
- **Work:** Bring `es`/`fr` (and others) to **key parity** with `en`, then community PRs for quality improvements; add new locale packs via same process.

### A3 — E2E attachments (completion, not invention)

- **Web:** Audit all attachment paths (paste, drag-drop, retry, forward) for encrypted channels; document gaps.
- **Mobile:** Close the gap described in `docs/mobile/E2E-ATTACHMENTS-GAP.md` (align with web message API + encryption).
- **API:** Ensure attachment metadata and size limits remain consistent with encrypted blobs.

### A4 — Forward secrecy + multi-device (crypto program)

- **DoD:** See `docs/crypto/FORWARD-PLAN.md` — **design + phased implementation**; not a single PR.

---

## Phase B — Mid-term (roadmap “Q3–Q4 2026”)

Pick **one primary bet** per half unless you expand the team.

| Initiative | Notes |
|------------|--------|
| **Plugin / extension SDK** | Sandboxing, permission model, distribution story — spec first. |
| **Matrix / ActivityPub bridge** | Protocol mapping, identity mapping, moderation — spike then vertical slice. |
| **Tauri desktop** | Migration from Electron: IPC parity, auto-update, release channels. |
| **Relay operator incentives** | Economics + abuse resistance — product + backend. |
| **Federation protocol v2** | Batching, sync, conflict rules — versioned protocol doc + server rollout. |

---

## Phase C — Long-term (2027+)

Offline, P2P fallback, DID, federated file storage, WASM crypto — **each** requires architecture review and likely depend on **A4** (key material and sync story).

---

## Maintenance (continuous)

Security cadence, dependency audits, RTC edge cases, bug triage — see [ROADMAP.md — Maintenance](../ROADMAP.md#maintenance--quality--stability-ongoing).

---

## Suggested default sequencing (single team)

1. **A1 + A2** (visible user impact, lower risk than crypto rewrites).
2. **A3** (close mobile attachment story + web parity).
3. **A4** (long-running; start spec + spike while A1–A3 continue).
4. **One** Phase B bet when A1–A3 are in acceptable shape.

---

## Review

Revisit this file when a **phase** completes or when roadmap priorities change.
