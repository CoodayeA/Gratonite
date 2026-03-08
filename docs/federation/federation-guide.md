# Gratonite Federation Guide

Federation allows Gratonite instances to communicate with each other. Users on one instance can join guilds on another, send messages across instances, and discover new communities.

## Enabling Federation

1. Set `FEDERATION_ENABLED=true` in your `.env` file
2. Restart the API: `docker compose restart api`

Federation is disabled by default. Your instance works standalone until you enable it.

## Connecting to Another Instance

### Automatic (via Handshake)
```bash
# From your instance's admin panel, enter the remote instance URL
# Or use the API directly:
curl -X POST https://your-instance.com/api/v1/federation/handshake \
  -H "Content-Type: application/json" \
  -d '{"instanceUrl":"https://remote-instance.com","publicKeyPem":"..."}'
```

### Manual Trust
In the admin dashboard, go to **Federation > Instances** and add a new instance with "manually_trusted" trust level.

## Federation Controls

| Flag | Default | Description |
|------|---------|-------------|
| `FEDERATION_ENABLED` | `false` | Master switch |
| `FEDERATION_ALLOW_INBOUND` | `true` | Accept requests from other instances |
| `FEDERATION_ALLOW_OUTBOUND` | `true` | Send requests to other instances |
| `FEDERATION_ALLOW_JOINS` | `true` | Allow remote users to join local guilds |
| `FEDERATION_ALLOW_REPLICATION` | `false` | Enable guild replication |
| `FEDERATION_DISCOVER_REGISTRATION` | `false` | Register with Gratonite Discover |

## Finding Federated Servers

Instances registered with Gratonite Discover appear in the server browser. You can also connect to any instance directly if you know its URL.

## Managing Instances

### Block an Instance
```bash
POST /api/v1/federation/admin/blocks
{"domain": "spam-instance.com", "reason": "Spam"}
```

### Trust Levels
- **verified**: Listed on Gratonite Discover, verified by the directory
- **manually_trusted**: Admin explicitly trusts this instance
- **auto_discovered**: Connected via handshake, not yet manually verified

### Instance Statuses
- **active**: Normal operation
- **suspended**: Temporarily paused (e.g., too many failed heartbeats)
- **blocked**: All communication refused

## Security

- All federation traffic is authenticated via Ed25519 HTTP Signatures
- Each instance has a unique cryptographic identity
- Content from remote instances is sanitized (HTML stripped, URLs validated)
- Rate limiting: 100 req/min per remote instance
- Instances that fail 10 consecutive heartbeats are auto-suspended
