## Summary

<!-- What does this PR do? Keep it brief — 1-3 sentences. -->

## Changes

<!-- List the key changes made. -->

-

## Testing

<!-- How did you verify this works? -->

- [ ] Tested locally
- [ ] `release-gates` CI is green (or N/A with reason)
- [ ] No obvious regressions in touched areas
- [ ] If release/deploy files changed: I ran the relevant existing commands and listed them below

### Commands run

<!-- Paste the exact commands you ran, especially for release/deploy changes. -->

```bash
```

## Screenshots

<!-- If this changes UI, add before/after screenshots. -->

## Production / deploy (if this ships to prod)

- [ ] **Reviewed** the diff for correctness, security, and migrations (if any)
- [ ] I reviewed `docs/deploy-review-checklist.md`
- [ ] If `deploy/api/**`, `deploy/deploy.sh`, or workflow release checks changed: source-of-truth / artifact ownership is still explicit (`pnpm verify:deploy:artifacts`)
- [ ] After deploy: follow **server + public URL** verification (not just SSH health)
- [ ] If deploy fails: capture health/log evidence and use the rollback guidance from `deploy/deploy.sh` / `docs/DEPLOY-TO-OWN-SERVER.md`
