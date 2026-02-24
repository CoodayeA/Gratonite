# CORS Configuration (Web/API)

Date: 2026-02-22  
Owner: Engineering

## Goal

Keep browser clients functional across local/LAN/prod while preventing permissive wildcard behavior in deployed environments.

## Environment Variable

`CORS_ORIGIN` is a comma-separated list of allowed origins.

Examples:

- local only:
  - `CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173`
- local + trusted LAN testers:
  - `CORS_ORIGIN=http://localhost:5173,http://192.168.42.78:5173`
- production:
  - `CORS_ORIGIN=https://app.gratonite.chat,https://gratonite.chat`

## Runtime Behavior

1. No `Origin` header is allowed (non-browser clients, server-to-server).
2. Explicit configured origins are allowed in all environments.
3. In development, localhost/private-LAN origins are additionally allowed for fast testing.
4. In production, unknown origins are rejected.
5. Wildcard `*` is allowed only if explicitly set in `CORS_ORIGIN` (not recommended for production).

## Verification

Run API tests:

```bash
pnpm --filter @gratonite/api test -- src/lib/cors-origins.test.ts
```

Expected:

- configured origins allowed
- unknown production origins rejected
- localhost/LAN origins accepted in development
- wildcard behavior requires explicit `*`

