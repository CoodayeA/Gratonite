# Production smoke setup

Use the `production-smoke` workflow as a post-deploy alarm for the live Gratonite app.

## What the workflow checks

1. Public API health
2. Public app shell
3. Releases page
4. Authenticated chat send
5. Authenticated forum image post
6. Authenticated forum image reply
7. Search
8. Notification inbox
9. Server settings load

## Required GitHub config

### Repository secrets

```bash
gh secret set SMOKE_EMAIL -R CoodayeA/Gratonite
gh secret set SMOKE_PASSWORD -R CoodayeA/Gratonite
```

### Repository variables

```bash
gh variable set SMOKE_BASE_URL -R CoodayeA/Gratonite --body "https://gratonite.chat"
gh variable set SMOKE_API_HEALTH_URL -R CoodayeA/Gratonite --body "https://api.gratonite.chat/health"
gh variable set SMOKE_GUILD_ID -R CoodayeA/Gratonite --body "<guild-id>"
gh variable set SMOKE_CHAT_CHANNEL_ID -R CoodayeA/Gratonite --body "<chat-channel-id>"
gh variable set SMOKE_FORUM_CHANNEL_ID -R CoodayeA/Gratonite --body "<forum-channel-id>"
```

## Smoke account and space

Use one dedicated smoke account and one dedicated smoke guild.

Recommended shape:

- account: non-admin user with stable credentials
- guild: private smoke-only guild
- chat channel: normal text channel for send/search coverage
- forum channel: normal non-encrypted forum channel for upload coverage

Do not reuse a personal account or a production community space for smoke.

## Manual runs

You can dispatch the workflow in two modes:

1. **Authenticated mode** (default): requires all secrets/variables above.
2. **Public-only mode**: set `public_only=true` when dispatching the workflow. This skips authenticated checks and only verifies public health/app surfaces.

## Expected behavior

- **Scheduled runs** should be authenticated.
- **Manual runs** can be authenticated or public-only.
- If authenticated config is missing, the workflow should fail immediately with a clear missing-config error instead of silently skipping the important checks.
