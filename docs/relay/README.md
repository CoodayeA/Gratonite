# Running a Gratonite Relay

Relays route encrypted messages between Gratonite instances. They're lightweight, easy to run, and help the network grow.

## What is a Relay?

A relay is a WebSocket server that forwards encrypted envelopes between instances. It **cannot read message content** — it only sees sender, recipient, and encrypted data.

Relays help instances behind NAT (home servers, corporate networks) communicate without port forwarding.

## Quick Start

```bash
cd apps/relay

# 1. Copy environment
cp .env.example .env
nano .env  # Set RELAY_DOMAIN and REDIS_URL

# 2. Start
docker compose up -d
```

Your relay is now running on port 4100 (WebSocket) and 4101 (health/metrics).

## Hardware Requirements

Relays are lightweight:

| Scale | CPU | RAM | Bandwidth |
|-------|-----|-----|-----------|
| Small (< 50 instances) | 1 vCPU | 256 MB | 10 Mbps |
| Medium (50-500) | 2 vCPU | 512 MB | 50 Mbps |
| Large (500+) | 4 vCPU | 1 GB | 100 Mbps |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RELAY_DOMAIN` | Required | Your relay's domain |
| `RELAY_PORT` | 4100 | WebSocket port |
| `RELAY_HEALTH_PORT` | 4101 | Health/metrics port |
| `REDIS_URL` | redis://localhost:6379 | Redis connection |
| `RELAY_RATE_LIMIT` | 100 | Max envelopes/sec/instance |
| `TURN_SERVER` | — | TURN server for voice relay |
| `TURN_SECRET` | — | TURN shared secret |

## Monitoring

### Health Check

```bash
curl https://your-relay.example.com/health
```

Returns:
```json
{
  "status": "ok",
  "relay": "your-relay.example.com",
  "connectionsTotal": 42,
  "envelopesForwarded": 15230,
  "uptimeSeconds": 86400,
  "meshPeers": 3
}
```

### Prometheus Metrics

```bash
curl https://your-relay.example.com/metrics
```

Available metrics:
- `relay_connections_total` — Current connected instances
- `relay_envelopes_forwarded_total` — Total envelopes routed
- `relay_envelopes_dropped_total` — Dropped (rate limited, undeliverable)
- `relay_mesh_peers` — Connected mesh relay peers
- `relay_uptime_seconds` — Uptime
- `relay_memory_mb` — Memory usage

### Relay Identity

```bash
curl https://your-relay.example.com/.well-known/gratonite-relay
```

## Reputation System

Every relay has a reputation score (0-100) visible in the relay directory.

**Scoring factors:**
- **Uptime (30%)** — Health check success rate
- **Delivery rate (30%)** — Successfully forwarded envelopes
- **Latency (20%)** — Lower p99 latency = higher score
- **Age (10%)** — Older relays are more trusted
- **Community reports (10%)** — Reports decrease score

**New relays start at 50** (neutral). Build trust by maintaining good uptime and delivery rates.

**Below 20 → auto-delisted** from the directory. Fix issues and the score will recover.

## Mesh Configuration

Relays automatically discover and connect to each other via the directory. The mesh enables cross-relay delivery:

```
Instance A → Relay 1 → Relay 2 → Instance B
```

Max 2-hop chain prevents amplification attacks.

Mesh connections use the same Ed25519 authentication as instance connections. Bloom filter routing tables are exchanged every 60 seconds.

## TURN Proxy for Voice

Relays can optionally provide TURN credentials for voice federation:

```bash
TURN_SERVER=your-turn-server.example.com
TURN_SECRET=your-coturn-shared-secret
```

This helps federated voice calls work behind strict NAT. TURN credentials are ephemeral (1-hour TTL).

## Running on a Home Machine

Use `docker-compose.local.yml` which includes options for:

- **Cloudflare Tunnel** — Zero port forwarding, free TLS
- **DuckDNS** — Free dynamic DNS subdomain

```bash
# With Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=your-token docker compose -f docker-compose.local.yml --profile cloudflare up -d

# With DuckDNS
DUCKDNS_SUBDOMAIN=myrelay DUCKDNS_TOKEN=your-token docker compose -f docker-compose.local.yml --profile duckdns up -d
```

## Security

- All instance connections are authenticated with Ed25519 signatures
- The relay **never** decrypts message content (E2E encrypted with AES-256-GCM)
- Traffic padding prevents content-size analysis (all envelopes are fixed-size)
- Rate limiting prevents flooding (configurable per instance)
- Mesh chains are limited to 2 hops to prevent amplification
