# Self-Hosting Gratonite

Run your own Gratonite instance in 5 minutes. No programming required.

## Prerequisites

- A server (any Linux machine, VPS, or even a home PC)
- Docker and Docker Compose installed
- A domain name (or use Cloudflare Tunnel for zero-config)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/CoodayeA/Gratonite.git
cd Gratonite/deploy/self-host

# 2. Copy and edit the environment file
cp .env.example .env
nano .env  # Set your domain, passwords, and secrets

# 3. Start everything
docker compose up -d

# 4. Open your browser
# Visit https://your-domain.com/setup to complete the wizard
```

That's it. The setup wizard walks you through creating an admin account and configuring federation.

## Configuration Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `INSTANCE_DOMAIN` | Yes | Your server's domain (e.g., `chat.example.com`) |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `JWT_SECRET` | Yes | Random string, 32+ characters |
| `JWT_REFRESH_SECRET` | Yes | Different random string, 32+ characters |
| `MFA_ENCRYPTION_KEY` | Yes | Random string for MFA encryption |
| `FEDERATION_ENABLED` | No | Set to `true` to enable federation |
| `RELAY_ENABLED` | No | Set to `true` to connect via relay network |
| `RELAY_DOMAIN` | No | Custom relay URL (default: official relay) |
| `LIVEKIT_URL` | No | LiveKit server URL for voice/video |
| `LIVEKIT_API_KEY` | No | LiveKit API key |
| `LIVEKIT_API_SECRET` | No | LiveKit API secret |
| `CLOUDFLARE_TUNNEL_TOKEN` | No | For zero-port-forwarding hosting |

## Enabling Federation

Federation lets users from other Gratonite servers join your communities and vice versa.

```bash
# In your .env file:
FEDERATION_ENABLED=true
INSTANCE_DOMAIN=chat.example.com

# Restart
docker compose restart api
```

Once enabled, your instance will:
- Generate Ed25519 signing keys automatically
- Accept federation handshakes from other instances
- Allow remote users to join your guilds (configurable)
- Appear in the Gratonite Discover directory (opt-in)

## Enabling Relay

The relay network allows instances behind NAT (home servers) to communicate without port forwarding.

```bash
# In your .env file:
RELAY_ENABLED=true

# Restart
docker compose restart api
```

Your instance will automatically connect to the best available relay.

## Enabling Voice/Video

Voice requires a LiveKit server. You can run one alongside Gratonite:

```bash
# Start with voice profile
docker compose --profile voice up -d

# Or use an external LiveKit server:
LIVEKIT_URL=wss://livekit.example.com
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
```

## Hosting from Home (No Port Forwarding)

### Option 1: Cloudflare Tunnel (Recommended)

1. Create a free Cloudflare account
2. Set up a tunnel at https://dash.cloudflare.com → Zero Trust → Tunnels
3. Add the tunnel token to your `.env`:

```bash
CLOUDFLARE_TUNNEL_TOKEN=your-token-here
```

4. Start with tunnel profile:

```bash
docker compose --profile tunnel up -d
```

### Option 2: ngrok

```bash
ngrok http 443
# Use the generated URL as your INSTANCE_DOMAIN
```

## Updating

```bash
docker compose pull
docker compose up -d
```

Migrations run automatically on startup.

## Troubleshooting

**Can't reach the server?**
- Check that your domain's DNS points to your server's IP
- Verify ports 80 and 443 are open (or use Cloudflare Tunnel)
- Check `docker compose logs caddy` for TLS errors

**Federation not working?**
- Ensure `FEDERATION_ENABLED=true` and `INSTANCE_DOMAIN` is set
- Check `docker compose logs api | grep federation`
- Verify your /.well-known/gratonite endpoint is accessible

**Voice not connecting?**
- Ensure LiveKit is running: `docker compose --profile voice ps`
- Check that LIVEKIT_URL, API_KEY, and API_SECRET are all set
- WebRTC requires UDP ports — use TURN relay if behind strict NAT

**Database issues?**
- Run migrations: `docker compose exec api node dist/db/migrate.js`
- Check DB health: `docker compose exec postgres pg_isready`
