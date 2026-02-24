# Session and Cookie Security Checklist

Date: 2026-02-22

## Current Reality

Web auth currently uses access token client storage. This checklist defines required controls for production hardening and any cookie/session adoption.

## Required Controls

1. HTTPS-only on all public app/api domains.
2. If cookies are used:
   - `Secure`
   - `HttpOnly`
   - `SameSite=Lax` or `SameSite=Strict` as flow allows
3. Session/token TTL reviewed for beta risk posture.
4. Refresh/logout behavior tested across tabs/devices.
5. CORS and credential settings aligned to approved origins only.

## Verification

1. Browser devtools confirms secure attributes for auth cookies (if present).
2. No auth tokens leaked in URL query params.
3. Logout invalidates active session path as expected.
4. Cross-origin requests without allowlisted origin are rejected.

