# Web Security Checklist (Beta)

Date: 2026-02-22

## Auth and Session

1. JWT secret rotated from defaults and stored in secret manager.
2. Encryption key rotated from defaults and stored in secret manager.
3. Token expiry values reviewed for beta risk profile.
4. Logout clears local auth state and invalidates refresh path where applicable.

## CORS and Origin Controls

1. `CORS_ORIGIN` explicitly set to production domains only.
2. No accidental wildcard `*` in production.
3. Websocket CORS behavior matches HTTP CORS behavior.

## Upload and File Delivery

1. MIME validation enforced from file content detection, not filename only.
2. Unsafe SVG blocked by upload policy.
3. File size caps enforced per upload purpose.
4. Public file delivery endpoint remains stable: `/api/v1/files/:hash`.

## Realtime and Abuse Controls

1. Rate limiter enabled for auth, API, and upload paths.
2. Typing/message spam behavior observed under load.
3. Socket disconnect reasons monitored and alertable.

## Infrastructure and Ops

1. TLS enforced on all public origins.
2. SSH inbound restricted to trusted admin IPs.
3. Database and object storage backups verified.
4. Rollback procedure tested at least once before wider beta cohort.

