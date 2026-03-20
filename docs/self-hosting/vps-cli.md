# Self-Hosting on a VPS

Deploy your own Gratonite instance on a cloud server with automatic TLS and federation.

---

## 1. Get a VPS

Any VPS provider works. Budget-friendly options:

| Provider | Starting Price | Link |
|---|---|---|
| Hetzner | €3.79/mo | [hetzner.com/cloud](https://www.hetzner.com/cloud) |
| DigitalOcean | $6/mo | [digitalocean.com](https://www.digitalocean.com/) |
| Vultr | $6/mo | [vultr.com](https://www.vultr.com/) |

**Recommended specs:** 1 vCPU, 2 GB RAM, 20 GB disk, Ubuntu 22.04 or newer.

## 2. Point Your Domain

Add an **A record** in your DNS provider pointing to your server's IP address:

```
Type: A
Name: @ (or your subdomain, e.g. chat)
Value: <your-server-ip>
```

Wait for DNS propagation. You can verify with:

```bash
dig +short your-domain.com
```

It should return your server's IP address. Propagation usually takes a few minutes but can take up to 24 hours.

## 3. SSH Into Your Server

```bash
ssh root@your-domain.com
```

## 4. Run the Installer

```bash
curl -fsSL https://gratonite.chat/install | bash
```

When prompted, choose **option 2 (server)**.

The installer will ask for three things:

| Prompt | Example |
|---|---|
| Domain | `chat.example.com` |
| Admin email | `you@example.com` |
| Admin password | (you choose) |

Everything else — database credentials, JWT secrets, MFA keys — is auto-generated and written to `~/gratonite/.env`.

## 5. Automatic TLS

Caddy obtains a free TLS certificate from Let's Encrypt automatically using the email address you provided. No manual certificate management required.

Your instance will be live at:

```
https://your-domain.com
```

The entire process takes 2-3 minutes from running the installer to a working instance.

## 6. Federation

Federation is enabled by default. Your instance connects to the relay at `wss://relay.gratonite.chat` and can communicate with all other Gratonite instances immediately.

After **48 hours** connected to the relay with no abuse reports, your public guilds appear on [gratonite.chat/discover](https://gratonite.chat/discover).

## 7. Voice and Video

To enable voice and video chat:

```bash
cd ~/gratonite
docker compose --profile voice up -d
```

This starts a LiveKit media server alongside the other services. Voice and video channels will work immediately.

## 8. Firewall

Only two inbound ports are required:

| Port | Protocol | Purpose |
|---|---|---|
| 80 | TCP | HTTP (redirects to HTTPS, used for ACME challenges) |
| 443 | TCP | HTTPS (all application traffic) |

If your VPS provider has a firewall (Hetzner Cloud Firewall, DigitalOcean Firewall, etc.), make sure these ports are open.

On Ubuntu with `ufw`:

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp   # keep SSH access
ufw enable
```

All federation traffic flows over outbound WSS on port 443, so no additional inbound ports are needed.

## 9. Managing Your Instance

```bash
cd ~/gratonite
```

| Task | Command |
|---|---|
| View logs | `docker compose logs -f` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` |
| Start | `docker compose up -d` |
| Update | `docker compose pull && docker compose up -d` |
