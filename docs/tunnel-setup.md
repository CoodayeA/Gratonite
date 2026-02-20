# Tunnel Setup (Phase 7)

This document explains how to expose your local Gratonite instance for external testers.

## Recommended: Cloudflare Tunnel

Install `cloudflared` and run:

```
cloudflared tunnel --url http://localhost:4000
cloudflared tunnel --url http://localhost:5173
```

This returns a public HTTPS URL. Use that URL for API + CORS config.

## Alternative: ngrok

Install ngrok and run:

```
ngrok http 4000
```

## Environment Updates

Set these values in `apps/api/.env`:

```
CORS_ORIGIN=https://your-tunnel-url
CDN_BASE_URL=https://your-tunnel-url
```

Set this value in `apps/web/.env`:

```
VITE_API_URL=https://your-tunnel-url/api/v1
```

Run desktop against the tunnel:

```
pnpm --filter @gratonite/desktop dev -- --force-server https://your-tunnel-url
```
Set this value in `apps/desktop/.env` (optional):

```
GRATONITE_DESKTOP_URL=https://your-tunnel-web-url
```
