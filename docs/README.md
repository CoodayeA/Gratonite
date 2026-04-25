# Documentation index

Start here for the practical docs behind Gratonite — product overview, self-hosting, federation, operations, and local development.

| Document | Purpose |
|----------|---------|
| [`../README.md`](../README.md) | Product overview, install/download links, privacy/federation framing, and repo map |
| [`../ROADMAP.md`](../ROADMAP.md) | High-level direction, shipped features, Q2+ planning, ideas backlog |
| [`roadmap/PRODUCT-PROGRAM.md`](roadmap/PRODUCT-PROGRAM.md) | Initiative tracker (✅/🔶/📋) aligned with the roadmap — **update both** when status changes |
| [`self-hosting.md`](self-hosting.md) | Self-host overview |
| [`self-hosting/README.md`](self-hosting/README.md) | Quick start and configuration |
| [`self-hosting/troubleshooting.md`](self-hosting/troubleshooting.md) | Common issues |
| [`federation/self-hosting-guide.md`](federation/self-hosting-guide.md) | Operator-facing federation and self-host guidance |
| [`api/`](api/) | OpenAPI spec and webhook event reference (when present) |
| [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) | Security review cadence (when present) |
| [`QUALITY-CHECKLIST.md`](QUALITY-CHECKLIST.md) | Quality bar (when present) |
| [`../DEVELOPMENT.md`](../DEVELOPMENT.md) | CI, deploy, engineering conventions |
| [`deploy-review-checklist.md`](deploy-review-checklist.md) | Checklist before production deploy |

## New Gratonite UI rollout

The Premium Gamer OS UI is controlled by the frontend UI experience preference:

- `classic`: current/default UI
- `premium-gamer-os`: opt-in redesigned UI

Users can switch in Settings -> Appearance. Operators can roll back the New UI by instructing users to switch back to classic or by clearing `localStorage["gratonite:ui-experience"]`.

The first rollout keeps the classic UI as default until the New UI passes route, chat, settings, attachment, and accessibility smoke checks.
