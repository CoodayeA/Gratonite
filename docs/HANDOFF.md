# Gratonite — continuity for any agent or contributor

Use this file when you open the repo in a **new session**. Chat history does not transfer between tools (Cursor, GitHub Copilot, Claude Code, Codex, etc.) — **this document plus `AGENTS.md` are the handoff.**

## Read order (~5–10 minutes)

| Order | File | Why |
|-------|------|-----|
| 1 | **`docs/HANDOFF.md`** (this file) | Editable “where we left off,” verification norms |
| 2 | **`AGENTS.md`** | CI, deploy, Windows/rsync workarounds, monorepo conventions |
| 3 | **`ROADMAP.md`** | Shipped vs planned, ideas backlog |
| 4 | **`docs/roadmap/PRODUCT-PROGRAM.md`** | Initiative status (✅ / 🔶 / 📋) — update when you ship |
| 5 | **`docs/README.md`** | Index of self-hosting, API docs, security, quality |

Optional: **`.cursor/rules/*.mdc`** — Cursor-only; other agents should still follow the same *spirit* (verify before claiming done; do not dump homework on the user when you can run commands).

---

## Repository

| | |
|---|---|
| **Upstream** | `https://github.com/CoodayeA/Gratonite` |
| **Default branch** | `main` |
| **Install** | Root is **pnpm** workspaces; API uses `pnpm`, several apps use `npm` — see `AGENTS.md` |

---

## Verification (run it yourself)

Before saying a change is “done” or “working”:

1. **Read root `package.json` → `scripts`.** Names differ by branch (e.g. `verify:release:all`, `verify:prod`, OpenAPI validate in CI).
2. **Match CI:** `.github/workflows/release-gates.yml` is the baseline gate on PRs (`main`).
3. **Full local gate** when you have DB + env: `pnpm verify:release:all` (or as documented in `package.json`) — often includes API `verify:release` with `gate:data`, web `verify:prod`, e2e smoke.
4. **Nginx / marketing vs `/app/` SPA / service worker:** If you touch `deploy/web/nginx.conf`, `apps/web/public/sw.js`, or landing routes to the app — run any **static-contract / nginx smoke** scripts listed in `package.json` **if present**, plus a production-like web build. Regressions here break `/app/login` and SW install.
5. **Production deploy:** Follow `AGENTS.md`; do not claim production verified without HTTP checks when the environment can reach the host.

---

## Product guardrails

- **Federation** should stay **understandable** for end users — prefer guided copy and clear defaults over raw protocol detail.
- **Email / SMTP:** Transactional mail (signup, verification, password reset) vs opt-in marketing-style mail — respect server defaults and user settings (see `ROADMAP.md` / API settings).
- **Self-host:** Document operational paths in `docs/self-hosting/` when you change install or compose behavior.

---

## Current focus (**edit when you start / end a session**)

| Field | Fill in |
|-------|---------|
| **Branch** | e.g. `main` or `feature/…` |
| **Goal (one sentence)** | |
| **Last known `git` tip** | Run `git log -1 --oneline` after pull |
| **Open PR / issue** | Link if any |
| **Blockers** | None / … |

### Next tasks (ordered)

1. …
2. …
3. …

### Notes for the next agent

*(Optional: what worked, what failed, env quirks, “do not revert X”.)*

---

## Optional: GitHub issue mirror

For cross-machine tracking, open **one** issue titled e.g. `Handoff: <topic>` and paste the same “Goal / Next tasks / Blockers” — link it in the table above.
