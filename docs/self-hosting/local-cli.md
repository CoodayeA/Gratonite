# Self-Hosting Locally

Run your own Gratonite instance on your Mac, Windows, or Linux machine in under five minutes.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Docker Desktop (Mac/Windows) or Docker Engine (Linux) | v24+ |
| RAM | 2 GB available |
| Disk | 5 GB free |

## 1. Install Docker

If you already have Docker installed, skip to step 2.

- **Mac** — [Download Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- **Windows** — [Download Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) (WSL 2 backend recommended)
- **Linux** — [Install Docker Engine](https://docs.docker.com/engine/install/) for your distro (Ubuntu, Debian, Fedora, etc.)

After installing, verify Docker is running:

```bash
docker --version
docker compose version
```

## 2. Run the Installer

```bash
curl -fsSL https://gratonite.chat/install | bash
```

When prompted, choose **option 1 (local)**.

The installer will:

- Pull the latest Gratonite images
- Generate a `.env` file with random secrets (JWT keys, database password, MFA encryption key)
- Create an admin account with auto-generated credentials
- Start all services via Docker Compose

The entire process takes 1-3 minutes depending on your internet speed.

## 3. Open Gratonite

Once the installer finishes, open your browser and navigate to:

```
https://localhost:8443
```

Your browser will show a TLS security warning because the local instance uses a self-signed certificate. This is expected and safe for local use:

1. Click **Advanced** (or "Show Details" on Safari)
2. Click **Proceed to localhost (unsafe)** (or "visit this website")

You are now connected to your own Gratonite instance over an encrypted connection.

## 4. Log In

Log in with the admin credentials displayed in your terminal after the installer completed. They look like this:

```
Admin username: admin
Admin password: <randomly-generated>
```

If you missed them, retrieve them from your `.env` file:

```bash
cd ~/gratonite
grep ADMIN_ .env
```

## 5. Federation

Federation connects your instance to the wider Gratonite network automatically via the relay at `wss://relay.gratonite.chat`. No configuration needed.

After your instance has been connected to the relay for **48 hours** with no abuse reports, your public guilds will appear on [gratonite.chat/discover](https://gratonite.chat/discover) for anyone to find.

## 6. Managing Your Instance

All management commands are run from the Gratonite directory:

```bash
cd ~/gratonite
```

| Task | Command |
|---|---|
| View logs | `docker compose logs -f` |
| View API logs only | `docker compose logs -f api` |
| Restart all services | `docker compose restart` |
| Stop everything | `docker compose down` |
| Start after stopping | `docker compose up -d` |
| Update to latest version | `docker compose pull && docker compose up -d` |

## 7. Voice and Video

Voice and video chat requires a LiveKit media server. To enable it:

```bash
docker compose --profile voice up -d
```

This starts a LiveKit container alongside the other services. The API auto-detects it and enables voice/video in all channels.

To stop voice services while keeping everything else running:

```bash
docker compose --profile voice down
```
