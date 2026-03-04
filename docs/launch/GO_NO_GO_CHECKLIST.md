# Go / No-Go Checklist

## Mandatory
- [ ] `npm run verify:launch:super-gate` passed.
- [ ] No open Sev-1 / Sev-2 defects in `BUG_BURNDOWN.md`.
- [ ] Migrations validated in staging clone.
- [ ] Kill switches present and tested.
- [ ] API-first then Web deploy order confirmed.
- [ ] 120-minute launch watch staffing confirmed.

## Reliability-Specific
- [ ] Guild 401/403/404 behavior deterministic.
- [ ] Guild network toast cooldown validated.
- [ ] Frontend/backend guild telemetry correlation validated.
- [ ] No `Maximum update depth exceeded` warnings in launch smoke.
- [ ] Route transitions update both URL and rendered content (Home/Friends/Discover/Guild).

## Sign-Off
- Engineering Lead: __________________
- QA Lead: __________________
- SRE/On-Call: __________________
- Product: __________________
- Decision: `GO` / `NO-GO`
