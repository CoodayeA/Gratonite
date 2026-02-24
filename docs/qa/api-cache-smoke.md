# API Cache Smoke Check

Date: 2026-02-21
Command:

```bash
pnpm check:api-cache-smoke
```

## What it validates

1. Boots local dependencies and starts API on an isolated port.
2. Registers a user, creates a guild, creates a channel.
3. Repeats cache-backed reads (`guilds/@me`, `guild`, `guild members`, `guild channels`, `channel`).
4. Verifies expected Redis cache keys are present.
5. Verifies cache stats logs are emitted.

## Expected result

- Script exits with:

```text
[api-cache:smoke] PASS
```
