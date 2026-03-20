# Federation & Discovery

Federation allows Gratonite instances to communicate with each other. Users on one instance can join guilds hosted on another instance, send messages across instances, and discover communities across the entire network.

---

## How Federation Works

Every Gratonite instance generates an **Ed25519 keypair** on first startup. This keypair is the instance's identity:

- The **public key** is shared with other instances and the relay
- The **private key** signs all outgoing messages, proving they came from your instance
- Other instances verify signatures before accepting any federated message

All inter-instance communication flows through the **relay** at `wss://relay.gratonite.chat`. Instances maintain a persistent outbound WebSocket connection to the relay. The relay routes encrypted envelopes between instances.

```
+──────────────+                              +──────────────+
|              |  ──── outbound WSS ────────> |              |
| Instance A   |                              |    Relay     |
|              |  <──── routed envelope ───── |              |
+──────────────+                              +──────────────+
                                                    ^   |
                                                    |   |
                                     outbound WSS ──+   +── routed envelope
                                                    |   |
                                                    |   v
                                              +──────────────+
                                              |              |
                                              | Instance B   |
                                              |              |
                                              +──────────────+
```

### No Ports to Open

All connections from your instance to the relay are **outbound** on port 443 (standard HTTPS/WSS). You do not need to open any additional inbound ports for federation to work. If your instance can reach the internet, federation works.

## The Relay

The relay is a lightweight message router. Here is what it does and does not do:

| The relay does | The relay does NOT |
|---|---|
| Route encrypted envelopes between instances | Read or decrypt message content |
| Track which instances are online | Store messages long-term |
| Buffer messages for briefly-offline instances | Have access to your users, guilds, or data |
| Enforce abuse policies (spam, illegal content) | Act as a central authority over your instance |

The relay at `wss://relay.gratonite.chat` is operated by the Gratonite project. You can run your own relay and point your instance to it by setting `RELAY_URL` in your `.env` file.

## Discovery

After your instance has been connected to the relay for **48 hours** with zero abuse reports, your public guilds become eligible for discovery.

Public guilds from your instance will then appear on [gratonite.chat/discover](https://gratonite.chat/discover), where users from any instance can find and join them.

### Trust Levels

Instances visible in discovery have one of three trust levels:

| Level | Badge | Meaning |
|---|---|---|
| `auto_discovered` | Gray | Instance has been online 48h+ with no abuse reports |
| `manually_trusted` | Blue | Instance has been reviewed and trusted by the Gratonite team |
| `verified` | Green | Instance identity has been verified (e.g. official organization) |

Trust levels are displayed next to guild names in discovery results so users can make informed decisions about which guilds to join.

## Configuration

Federation is controlled by these environment variables in `~/gratonite/.env`:

| Variable | Default | Effect |
|---|---|---|
| `FEDERATION_ENABLED` | `true` | Master switch for all federation features |
| `FEDERATION_ALLOW_INBOUND` | `true` | Accept messages from other instances |
| `FEDERATION_ALLOW_OUTBOUND` | `true` | Send messages to other instances |
| `FEDERATION_ALLOW_JOINS` | `true` | Allow users from other instances to join your guilds |
| `FEDERATION_HUB_URL` | `https://gratonite.chat` | Discovery hub URL |
| `RELAY_ENABLED` | `true` | Connect to the relay |
| `RELAY_URL` | `wss://relay.gratonite.chat` | Relay WebSocket URL |

### Running a Fully Isolated Instance

To run a completely private instance with no federation:

```bash
FEDERATION_ENABLED=false
RELAY_ENABLED=false
```

Your instance will work normally but will not communicate with any other instance or appear in discovery.

### Running Your Own Relay

The relay is open source. To run your own:

```bash
docker run -d -p 443:443 ghcr.io/coodayea/gratonite-relay:latest
```

Then point your instances to it:

```bash
RELAY_URL=wss://relay.your-domain.com
```
