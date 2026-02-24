# Bug Inbox Severity Rubric (Beta)

Use with `https://gratonite.chat/ops/bugs`.

## Priority Levels

### P0 (Immediate stop / hotfix)

Criteria:
1. Core app unavailable (`5xx`, login impossible, app won't load)
2. Data loss or message loss
3. Security/privacy issue (wrong user sees data, permission leak)
4. Messaging/media/voice broken for most users

Action:
1. Stop non-bugfix work
2. Reproduce and patch immediately
3. Deploy hotfix
4. Rerun smoke

### P1 (Same-day fix)

Criteria:
1. Core flow broken for a meaningful subset of users
2. Realtime broken/intermittent in DM or channel
3. Upload renders fail or attachments inaccessible
4. Voice/video controls unusable on a supported browser/device
5. Moderation/admin workflow broken for owners/admins

Action:
1. Triage same day
2. Patch in next bugfix deploy window
3. Verify and resolve after deploy

### P2 (High-priority polish / next batch)

Criteria:
1. Feature works but UX is confusing/rough
2. Non-blocking layout issues
3. Intermittent cosmetic/persistence issues
4. Non-critical customization bugs

Action:
1. Mark `triaged`
2. Batch into planned bug burn-down

### P3 (Backlog / defer)

Criteria:
1. Minor cosmetic issues
2. Nice-to-have UX improvements
3. Edge-case feature gaps not affecting core beta goals

Action:
1. Triage and defer
2. Track for future sprint

## Severity Tie-Breakers

Escalate one level if:
1. Affects mobile users only but blocks a core action (send/upload/join)
2. Impacts onboarding (register/verify/login/MFA)
3. Produces repeated support load or duplicate bug reports
4. Reproducible on latest build after hard refresh

## Required Triage Notes

1. Severity (`P0-P3`)
2. Repro status (`reproduced` / `not reproduced`)
3. Affected route/flow
4. Device/browser scope
5. Planned action (`hotfix`, `next batch`, `defer`)
