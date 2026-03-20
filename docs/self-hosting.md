# Self-Hosting Gratonite

Run your own Gratonite instance. Choose your path:

## Quick Start

```bash
curl -fsSL https://gratonite.chat/install | bash
```

The installer asks one question — **local** or **server** — then handles everything else.

## Choose Your Path

| | Local (your computer) | Server (VPS / homelab) |
|---|---|---|
| **Best for** | Trying it out, personal use, LAN parties | Public instance, communities, production |
| **Domain needed?** | No — runs on localhost | Yes — you need a domain |
| **TLS** | Self-signed (browser warning) | Auto Let's Encrypt |
| **Visible in Discover?** | After 48h via relay | After 48h via relay |
| **Cost** | Free | ~$4-6/mo for a VPS |
| **Requirements** | Docker Desktop | VPS + domain + Docker |

### Guides

- **[Local: CLI Installer](self-hosting/local-cli.md)** — Run on your Mac, Windows, or Linux machine
- **[Server: CLI Installer](self-hosting/vps-cli.md)** — Deploy on a VPS with a domain
- **[Configuration Reference](self-hosting/configuration.md)** — All environment variables
- **[Federation & Discovery](self-hosting/federation.md)** — How instances connect
- **[Updating](self-hosting/updating.md)** — Keep your instance current
- **[Troubleshooting](self-hosting/troubleshooting.md)** — Common issues and fixes

## What You Get

- Full Gratonite with all features: chat, threads, voice/video, reactions, embeds, file uploads
- Automatic federation with other instances via the relay
- Your guilds appear in Discover on gratonite.chat after 48 hours
- NAT traversal — no ports to forward, works behind any firewall
- Automatic HTTPS (server mode) or self-signed cert (local mode)

## Architecture

```
┌─────────────────────────────────────────┐
│                 Caddy                    │
│           (TLS + reverse proxy)          │
│              :80  :443                   │
├─────────────┬───────────────────────────┤
│             │                           │
│   ┌─────────▼─────────┐  ┌────────────┐│
│   │    API Server      │  │  Web (SPA) ││
│   │    (Node.js)       │  │  (Nginx)   ││
│   │     :4000          │  │   :80      ││
│   └─────────┬──────────┘  └────────────┘│
│             │                           │
│   ┌─────────▼─────────┐  ┌────────────┐│
│   │    PostgreSQL      │  │   Redis    ││
│   │     :5432          │  │   :6379    ││
│   └───────────────────┘  └────────────┘│
└─────────────────────────────────────────┘
         │ outbound WSS
         ▼
┌──────────────────────┐
│  relay.gratonite.chat │  ← Federation relay (Gratonite-operated)
└──────────────────────┘
```
