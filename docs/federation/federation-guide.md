# Gratonite Federation Guide

Federation allows independent Gratonite instances to communicate with each other. Users on one instance can discover and join servers on another instance, and public servers can be listed on the [Gratonite Discover](https://gratonite.chat/app/discover) directory.

Self-host templates enable federation by default. You can still run a standalone instance by disabling federation in `.env`.

---

## Federation Status

1. Open your `.env` file:
   ```bash
   nano deploy/self-host/.env
   ```

2. Confirm (or set) the federation flag:
   ```bash
   FEDERATION_ENABLED=true
   ```

3. Restart the API if you changed `.env`:
   ```bash
   docker compose -f deploy/self-host/docker-compose.yml restart api
   ```

4. Verify federation is active:
   ```bash
   curl https://your-domain.com/.well-known/gratonite
   ```
   You should see a JSON response with your instance's public key and federation endpoints.

---

## Connecting to Another Instance

When federation is enabled, instances connect automatically via a **handshake** process:

1. Your instance discovers another instance's identity by fetching its `/.well-known/gratonite` endpoint
2. Your instance sends a signed handshake request
3. The remote instance verifies your signature and stores your public key
4. Both instances can now exchange federation activities (messages, guild joins, etc.)

This happens automatically — you don't need to manually connect to other instances. When a user on your instance tries to join a server on another instance, the handshake is triggered automatically.

### Manually Adding a Trusted Instance

If you want to pre-trust a specific instance, go to the admin dashboard: **Settings > Admin > Federation > Instances** and add the instance URL.

---

## Listing Servers on Gratonite Discover

To make your public servers appear on the [Discover directory](https://gratonite.chat/app/discover):

1. Enable federation (see above). Discovery eligibility is automatic after trust checks.

2. In your Gratonite instance, go to a server you want to list publicly.

3. Open **Server Settings > Overview** and enable **"Listed in Server Discovery"**.

4. Eligible servers automatically sync and appear in the **"Self-Hosted Servers"** section of Discover.

### Verifying Your Servers Are Listed

After enabling, allow time for trust checks (typically ~48h with no abuse reports), then visit [gratonite.chat/app/discover](https://gratonite.chat/app/discover) and look for the "Self-Hosted Servers" section.

If your servers don't appear:
- Check federation is enabled: `curl https://your-domain.com/.well-known/gratonite`
- Check the API logs for federation errors: `docker compose -f deploy/self-host/docker-compose.yml logs api --tail 30`
- Make sure your servers are marked as discoverable in Server Settings

---

## Federation Controls

These flags give you fine-grained control over what federation features are active:

| Variable | Default | Description |
|----------|---------|-------------|
| `FEDERATION_ENABLED` | `true` (self-host template) | Master switch for federation |
| `FEDERATION_ALLOW_INBOUND` | `true` | Accept requests from other instances |
| `FEDERATION_ALLOW_OUTBOUND` | `true` | Send requests to other instances |
| `FEDERATION_ALLOW_JOINS` | `true` | Allow users from other instances to join your servers |
| `FEDERATION_HUB_URL` | `https://gratonite.chat` | Hub URL for Discover registration (only change for private networks) |

**Example: Outbound only** — Your users can join servers on other instances, but nobody from other instances can join yours:
```bash
FEDERATION_ENABLED=true
FEDERATION_ALLOW_INBOUND=false
FEDERATION_ALLOW_OUTBOUND=true
FEDERATION_ALLOW_JOINS=false
```

---

## Managing Instances

### Blocking an Instance

If you need to block a specific instance from communicating with yours, go to the admin dashboard: **Settings > Admin > Federation > Instances** and change its status to "blocked", or block it by domain.

You can also use the API:
```bash
POST /api/v1/federation/admin/blocks
{"domain": "spam-instance.com", "reason": "Spam content"}
```

### Trust Levels

| Level | Meaning |
|-------|---------|
| **verified** | Listed on Gratonite Discover and verified by the directory |
| **manually_trusted** | You explicitly trust this instance via the admin panel |
| **auto_discovered** | Connected via automatic handshake |

### Instance Statuses

| Status | Meaning |
|--------|---------|
| **active** | Normal operation |
| **suspended** | Temporarily paused (e.g., too many failed heartbeats) |
| **blocked** | All communication refused |

---

## Security

- **Ed25519 HTTP Signatures** — All instance-to-instance requests are cryptographically signed. No instance can impersonate another.
- **Content sanitization** — Messages from remote instances have HTML stripped, URLs validated (HTTPS only), and size limits enforced (4000 chars max).
- **Rate limiting** — 100 requests per minute per remote instance.
- **Auto-suspension** — Instances that fail 10 consecutive heartbeats are automatically suspended.
- **Domain blocking** — You can block specific domains via the admin panel.
- **Operator-controlled** — Self-host templates default to federation on, and you can disable it any time with `FEDERATION_ENABLED=false`.

---

## Account Portability

Users can export their account from one Gratonite instance and import it on another:

1. **Export:** Go to **Settings > Account > Export Data** — downloads a ZIP with your profile, settings, friend list, and server memberships.
2. **Import:** On the new instance, go to **Settings > Account > Import** and upload the ZIP.
3. Server memberships are automatically re-established (the new instance sends join requests to the servers you were in).

The export is cryptographically signed by the source instance so the destination can verify its authenticity.

---

## Technical Reference

For the full protocol specification (HTTP Signatures, activity types, WebSocket namespace, content safety pipeline), see the [Protocol Spec](protocol-spec.md).
