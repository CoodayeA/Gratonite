# Gratonite ✨

Gratonite is a multi-platform community chat app built as a privacy-first, open-source alternative to Discord. It includes web, mobile, desktop, and API apps in a single monorepo, with real-time messaging, voice/video, guilds, DMs, threads, moderation, and community features.

> Privacy-first, open source, and built for communities that want more control. 💬

## Features 🚀

### Messaging & Communication 💬
- Real-time text chat in guild channels, DMs, group DMs, and threads
- Voice and video calls powered by LiveKit
- Message editing with full edit history
- Replies, forwarding, and message pinning
- Emoji reactions, custom emoji, and sticker support
- Typing indicators and read receipts
- Disappearing messages with configurable timers
- Scheduled messages and draft auto-save
- Message bookmarks and global search

### Guilds & Community 🌐
- Guild (server) creation with custom icons and banners
- Role-based permissions with per-channel overrides
- Invite links with expiry and usage limits
- Public server discovery with tags
- Scheduled events
- Server templates and vanity URLs
- Forum and announcement channel types
- Server folders and favorites
- Server boost system

### Moderation & Safety 🛡️
- Audit logs for all administrative actions
- Automod with keyword-based filtering
- Word filters with block/delete/warn actions
- User timeouts and temp bans
- Ban appeals system
- Raid protection mode
- Slow mode per channel
- Member screening and server rules gate

### Privacy & Encryption 🔒
- End-to-end encryption for all DMs and group DMs — enabled automatically
- Private keys never leave your device
- Encrypted message editing
- Key rotation on group membership changes
- Identity verification via safety numbers
- Encryption failure warnings (never silently falls back to plaintext)
- See the [End-to-End Encryption](#end-to-end-encryption-) section below for full details

### User Features 👤
- User profiles with display names, bios, banners, and custom nameplate styles
- Status, custom status with emoji, and rich presence
- Friend system with friend requests and blocking
- User notes (private, per-user)
- XP and leveling system
- Achievements and badges
- Notification preferences per channel
- Web push notifications
- Session management (view/revoke active sessions)
- GDPR data export

### Platform & Integrations 🔌
- OAuth2 authorization flow for third-party apps
- Webhooks with delivery logs
- Bot application framework with a bot store
- Slash commands
- Stripe payment integration
- Referral system

## Scale 📊

- **76** database schemas
- **65** API route modules
- **47** frontend pages
- **53** React components

## Repository Layout 🗂️

```
apps/
  api/       Express + TypeScript API, Socket.IO, Drizzle ORM, PostgreSQL, Redis, LiveKit
  web/       React + Vite web client
  mobile/    Expo / React Native mobile app
  desktop/   Electron desktop wrapper
  landing/   Next.js marketing site
deploy/      Docker Compose, Caddyfile, deploy script
docs/        Deployment and configuration guides
tools/       Release verification scripts
```

## Tech Stack 🧱

| Layer      | Technology                            |
|------------|---------------------------------------|
| Frontend   | React, TypeScript, Vite               |
| Mobile     | Expo, React Native                    |
| Desktop    | Electron                              |
| Backend    | Node.js, Express, TypeScript          |
| Database   | PostgreSQL, Drizzle ORM               |
| Cache      | Redis                                 |
| Realtime   | Socket.IO                             |
| Voice      | LiveKit                               |
| Deployment | Docker Compose, Caddy, GitHub Actions |

## Getting Started 🛠️

### API

```bash
cd apps/api
cp .env.example .env    # edit with your DB/Redis/SMTP credentials
pnpm install
pnpm run db:migrate
pnpm run dev
```

### Web

```bash
cd apps/web
cp .env.example .env    # set VITE_API_URL
npm install
npm run dev
```

### Mobile

```bash
cd apps/mobile
npm install
npm run start
```

### Desktop

```bash
cd apps/desktop
npm install
npm run dev
```

## Self-Hosting 🏠

Run your own Gratonite instance. You'll need a Linux server, Docker, and a domain name. No coding required — everything runs in Docker containers.

### What You Need Before Starting

1. **A Linux server** — A VPS from any provider (Hetzner, DigitalOcean, Linode, etc.) with at least 1 GB RAM. Ubuntu 22.04 or Debian 12 recommended.
2. **A domain name** — Buy one from any registrar (Namecheap, Cloudflare, etc.). You'll point it at your server's IP address.
3. **SSH access** — You need to be able to log into your server via terminal/command line.

> **Don't have a server yet?** Sign up for a VPS provider, create the cheapest Linux server they offer (1 GB RAM is enough), and note the IP address they give you. Then buy a domain and create an **A record** pointing your domain to that IP address. Wait 5-10 minutes for DNS to propagate.

### Step 1: Install Docker on Your Server

SSH into your server and run:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

**Log out and log back in** (this is required for the group change to take effect), then verify:

```bash
docker --version          # Should show Docker Engine 24+
docker compose version    # Should show Docker Compose v2.x
```

### Step 2: Open Firewall Ports

Your server needs ports 80 (HTTP) and 443 (HTTPS) open for web traffic:

```bash
# On Ubuntu/Debian:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Step 3: Clone and Configure

```bash
git clone https://github.com/CoodayeA/Gratonite.git
cd Gratonite
cp deploy/self-host/.env.example deploy/self-host/.env
```

Now open the config file in a text editor:

```bash
nano deploy/self-host/.env
```

You only need to change **4 lines**. Find and replace these values:

```bash
# Change "chat.example.com" to YOUR domain (no https://, no trailing slash)
INSTANCE_DOMAIN=your-domain.com

# Change to YOUR email and pick a strong password
ADMIN_EMAIL=you@gmail.com
ADMIN_PASSWORD=MyStr0ngP@ssword!

# Generate a random database password (run: openssl rand -base64 24)
DB_PASSWORD=paste-your-random-password-here
```

**To generate a random DB password**, run this in a separate terminal:
```bash
openssl rand -base64 24
```
Copy the output and paste it as your `DB_PASSWORD`.

Save the file (`Ctrl+O`, then `Enter`, then `Ctrl+X` in nano).

> **That's all you need to set.** JWT secrets, HTTPS certificates, and everything else is handled automatically.

### Step 4: Launch

```bash
docker compose -f deploy/self-host/docker-compose.yml up -d
```

This pulls the Docker images and starts all services. It takes 1-2 minutes on first run.

### Step 5: Verify Everything Started

Check that the setup container completed successfully:

```bash
docker compose -f deploy/self-host/docker-compose.yml logs setup
```

You should see output ending with:
```
=== Gratonite Instance Setup ===
Running database migrations... done.
Generated JWT secrets.
Generating Ed25519 instance keypair... done.
Creating admin account... done.
=== Setup complete! ===
```

Check all containers are running:
```bash
docker compose -f deploy/self-host/docker-compose.yml ps
```

All services should show `Up` or `running`.

### Step 6: Log In

Open **https://your-domain.com** in your browser. Log in with the email and password you set in Step 3.

**First things to do:**
- Create your first server (called a "guild") by clicking the **+** button in the sidebar
- Invite friends by right-clicking your server and creating an invite link
- Explore **Settings > Admin** for instance-wide settings

### Updating to New Versions

```bash
cd Gratonite
git pull
docker compose -f deploy/self-host/docker-compose.yml pull
docker compose -f deploy/self-host/docker-compose.yml up -d
```

Database migrations run automatically on every update. Your data is preserved.

### Backups

```bash
# Database backup (do this regularly!)
docker compose -f deploy/self-host/docker-compose.yml exec postgres \
  pg_dump -U gratonite gratonite | gzip > backup-$(date +%Y%m%d).sql.gz

# File uploads backup
docker compose -f deploy/self-host/docker-compose.yml cp api:/app/uploads ./uploads-backup
```

### Federation: List Your Server on Gratonite Discover (Optional)

Federation lets your instance connect with other Gratonite instances. Your public servers can appear on the [Discover](https://gratonite.chat/app/discover) directory so anyone can find them.

**Step 1:** Open your `.env` file and add these two lines:

```bash
nano deploy/self-host/.env
```

Find the federation section and uncomment/set:
```bash
FEDERATION_ENABLED=true
FEDERATION_DISCOVER_REGISTRATION=true
```

**Step 2:** Restart the API to apply changes:

```bash
docker compose -f deploy/self-host/docker-compose.yml restart api
```

**Step 3:** Create a server and make it discoverable. Log into your instance, create a server (guild), then go to **Server Settings > Overview** and enable the **"Listed in Server Discovery"** toggle.

**Step 4:** Verify federation is working:

```bash
curl https://your-domain.com/.well-known/gratonite
```

You should see a JSON response with your instance's public key and endpoints. If you see this, federation is active.

**Step 5:** Wait up to 30 minutes. Your discoverable servers will automatically sync to gratonite.chat and appear in the "Self-Hosted Servers" section of the Discover page.

### Troubleshooting

| Problem | How to fix |
|---------|-----------|
| **Can't access my instance** | Check DNS: `dig your-domain.com +short` should return your server's IP. Check ports 80/443 are open. Check containers are running with `docker compose ps`. |
| **Setup container failed** | Run `docker compose -f deploy/self-host/docker-compose.yml logs setup` and check the error. Most common: wrong DB_PASSWORD. |
| **HTTPS certificate error** | Caddy gets certificates automatically, but your domain must resolve to your server's public IP first. Check `docker compose logs caddy`. |
| **Federation not working** | Make sure `FEDERATION_ENABLED=true` is set, and you restarted the API. Verify with `curl https://your-domain.com/.well-known/gratonite`. |

### Full Documentation

- **[Self-Hosting Guide](docs/federation/self-hosting-guide.md)** — Complete reference with all configuration options, architecture details, advanced troubleshooting
- **[Federation Guide](docs/federation/federation-guide.md)** — Connecting to other instances
- **[Protocol Spec](docs/federation/protocol-spec.md)** — Federation protocol technical reference

## End-to-End Encryption 🔐

Gratonite uses **end-to-end encryption (E2E)** for all direct messages and group DMs. Messages are encrypted on your device before being sent and can only be decrypted by the intended recipients. The server never has access to plaintext message content.

### How It Works

#### Direct Messages (1-on-1)

1. **Key generation** — When you first open a DM, your browser generates an **ECDH P-256 key pair** (a public key and a private key). The private key is stored in your browser's **IndexedDB** and never leaves your device.
2. **Key exchange** — Your public key is uploaded to the server. When you message someone, both sides fetch the other's public key.
3. **Shared secret derivation** — Using **ECDH (Elliptic-Curve Diffie-Hellman)**, your browser derives a shared secret from your private key and the recipient's public key. Both sides independently compute the same shared secret without it ever being transmitted.
4. **Message encryption** — Each message is encrypted using **AES-GCM with a 256-bit key** derived from the shared secret. A unique 12-byte IV (initialization vector) is generated per message to ensure no two ciphertexts are alike.
5. **Transmission** — The encrypted ciphertext (Base64-encoded) is sent to the server. The server stores only the ciphertext — it cannot read the message.
6. **Decryption** — The recipient's browser derives the same shared secret and decrypts the ciphertext locally.

#### Group DMs

1. **Group key generation** — The group creator generates a random **AES-GCM 256-bit symmetric key** for the group.
2. **Key wrapping** — The group key is encrypted (wrapped) individually for each member using per-member **ephemeral ECDH key pairs**. Each member receives a copy of the group key encrypted with their public key.
3. **Key storage** — Wrapped keys are stored on the server. Each member can only unwrap the copy encrypted for them.
4. **Encryption/decryption** — All group messages are encrypted and decrypted using the shared group key with AES-GCM-256.

#### Key Rotation

- **Group DMs**: When a member is added or removed from a group DM, the group owner automatically generates a new group key and distributes it to all current members. This ensures that removed members cannot decrypt future messages and new members cannot decrypt past messages.
- **Key versioning**: Each encrypted message is tagged with the key version it was encrypted with, so messages encrypted with older keys can still be decrypted if the key history is available.
- **Public key rotation**: If a user rotates their ECDH key pair, all DM partners are notified via a real-time `USER_KEY_CHANGED` event so they can re-derive the shared secret.

#### Identity Verification (Safety Numbers)

Gratonite supports **safety numbers** for verifying the identity of your DM partner:

1. Both users' public keys are deterministically ordered and concatenated.
2. A **SHA-256 hash** is computed over the combined keys.
3. The hash is formatted as a **60-digit number** displayed in a grid.
4. Users can compare this number out-of-band (in person, over a phone call, etc.) to verify that no man-in-the-middle attack has occurred.

If a partner's key changes, a warning banner is displayed in the conversation.

### What Users See

| Indicator | Meaning |
|-----------|---------|
| Lock icon in DM header | E2E encryption is active for this conversation |
| "Messages are not encrypted" warning | Key exchange failed — messages are sent in plaintext |
| "Partner's encryption key has changed" banner | The other user has rotated their key — tap to re-verify |
| Safety number grid (in DM settings) | Use to verify your partner's identity |

### What Is Encrypted

| Content | Encrypted? |
|---------|------------|
| DM text messages | Yes (AES-GCM-256) |
| Group DM text messages | Yes (AES-GCM-256) |
| Edited messages | Yes (re-encrypted before sending) |
| Guild (server) channel messages | No |
| File attachments | Not yet (planned) |
| Voice/video calls | Encrypted by LiveKit (DTLS-SRTP), not by Gratonite E2E |
| Message metadata (timestamps, sender, channel) | No (server needs this for delivery) |
| Notification previews | Shows "Encrypted message" instead of content |

### Technical Details

- **Key agreement**: ECDH on the P-256 curve (NIST)
- **Symmetric encryption**: AES-GCM with 256-bit keys
- **IV**: 12 bytes, randomly generated per message
- **Key storage**: Browser IndexedDB (private keys never transmitted)
- **Key exchange transport**: Authenticated API calls with Bearer tokens
- **Real-time events**: Socket.IO events for key rotation (`GROUP_KEY_ROTATION_NEEDED`) and key changes (`USER_KEY_CHANGED`)
- **Ciphertext format**: Base64-encoded `iv:ciphertext`

### Limitations

- **No forward secrecy**: The same shared secret is used for all messages in a conversation until a key is rotated. Compromise of a private key exposes all past and future messages encrypted with that key.
- **Trust on first use (TOFU)**: The server distributes public keys. A compromised server could substitute keys. Use safety numbers to verify.
- **Device-bound keys**: Private keys are stored in IndexedDB. Clearing browser data or switching browsers requires generating a new key pair. Messages encrypted with the old key cannot be decrypted.
- **No multi-device sync**: Each browser/device has its own key pair. E2E encryption is active on whichever device you are currently using.

## Why Gratonite 💜

- No phone-number gate to join communities
- No ad-driven engagement loop
- No premium paywall on basic social features
- Privacy-first with optional E2E encryption
- Fully open source and self-hostable

## Links 🔗

- Website: [gratonite.chat](https://gratonite.chat)
- Main repo: [CoodayeA/Gratonite](https://github.com/CoodayeA/Gratonite)
- Organization: [Gratonite-Labs](https://github.com/Gratonite-Labs)
