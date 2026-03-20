# Gratonite Server — Desktop App Design

## Problem
Self-hosting requires a terminal and Docker knowledge. We want anyone to run their own Gratonite instance by downloading an app and double-clicking it.

## Solution
A Tauri v2 desktop app called "Gratonite Server" that manages Docker containers via the Docker API. System tray icon shows status. Web UI for setup and monitoring.

## User Flow

### First Launch
1. App opens → checks for Docker
2. Docker missing → shows install guide with direct link (Docker Desktop for Mac/Win, or instructions for Linux)
3. Docker present → shows "Setting up your Gratonite instance..."
4. Pulls images from GHCR (~500MB, progress bar)
5. Generates all config (secrets, keypair, admin credentials)
6. Starts containers
7. Shows "Ready!" screen with:
   - URL: `https://localhost:8443`
   - Admin email + password
   - "Open Gratonite" button
8. Minimizes to system tray

### Subsequent Launches
1. App starts → checks Docker → starts containers if stopped
2. Goes straight to system tray (no window)
3. Tray tooltip: "Gratonite Server — Running"

### System Tray Menu
```
🟢 Gratonite Server — Running
─────────────────────────────
Open Gratonite          (opens browser)
─────────────────────────────
Start
Stop
Restart
─────────────────────────────
Check for Updates
View Logs
─────────────────────────────
Settings
About
Quit
```

## Architecture

```
Tauri App (~15MB)
├── Rust Backend
│   ├── docker.rs         — Docker API via bollard crate
│   ├── config.rs         — Config generation + storage
│   ├── health.rs         — Container health monitoring
│   ├── tray.rs           — System tray management
│   └── updater.rs        — Auto-update via Tauri updater
│
├── Frontend (web)
│   ├── Setup.tsx         — First-launch setup wizard
│   ├── Status.tsx        — Running status dashboard
│   ├── Logs.tsx          — Live container logs
│   └── Settings.tsx      — Configuration editor
│
└── Assets
    ├── icons/            — App + tray icons (all sizes)
    └── docker-compose.yml — Embedded compose template
```

### Docker Management (Rust)
Uses `bollard` crate to talk to Docker Engine API directly:
- Create network, volumes
- Pull images with progress streaming
- Create and start containers (equivalent to docker-compose up)
- Health check polling
- Stop/remove containers on quit
- Stream logs

No dependency on `docker-compose` CLI — everything through the Docker API. This is more reliable and gives us progress callbacks.

### Config Storage
```
~/.gratonite-server/
├── .env                  — Instance config (secrets, domain)
├── Caddyfile             — Reverse proxy config
├── docker-compose.yml    — Compose file (for manual management)
└── data/                 — Symlink or reference to Docker volumes
```

### Auto-Update
Tauri's built-in updater checks GitHub Releases for new versions. Update flow:
1. Tray shows "Update available"
2. User clicks → downloads + installs in background
3. Restart to apply

Docker images update separately:
1. "Check for Updates" also pulls latest GHCR images
2. Recreates containers with new images
3. Data persists (volumes untouched)

## Platform Builds

### macOS
- `.dmg` with drag-to-Applications installer
- Universal binary (arm64 + x86_64)
- Signed + notarized with Apple Developer cert
- Requires: Docker Desktop or Colima

### Windows
- `.exe` NSIS installer (standard Windows installer UX)
- `.msi` for enterprise/MDM deployment
- x86_64
- Requires: Docker Desktop with WSL2

### Linux
- `.AppImage` — universal, no install needed, works everywhere
- `.deb` — Debian, Ubuntu, Pop!_OS, Mint
- `.rpm` — Fedora, RHEL, CentOS, openSUSE
- **Flatpak** — Flathub distribution, sandboxed
  - `com.gratonite.Server` app ID
  - Flatpak can talk to host Docker via `--filesystem` permission or D-Bus
- x86_64 + arm64
- Requires: Docker Engine (`curl -fsSL https://get.docker.com | sh`)

### GitHub Actions Build Matrix
```yaml
strategy:
  matrix:
    include:
      - os: macos-latest
        targets: aarch64-apple-darwin,x86_64-apple-darwin
      - os: ubuntu-latest
        targets: x86_64-unknown-linux-gnu
      - os: ubuntu-latest
        targets: aarch64-unknown-linux-gnu
      - os: windows-latest
        targets: x86_64-pc-windows-msvc
```

Artifacts uploaded to GitHub Releases. Flatpak built separately and submitted to Flathub.

## What the App Does NOT Do
- Does not embed a database or Node.js runtime
- Does not replace Docker — it orchestrates Docker containers
- Does not serve as a chat client — it manages the server, user opens browser for chat
- Does not handle DNS or TLS for public hosting — that's the CLI installer's job

## File Structure
```
apps/server/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── docker.rs
│   │   ├── config.rs
│   │   ├── health.rs
│   │   ├── tray.rs
│   │   └── commands.rs    — Tauri IPC commands
│   ├── icons/
│   └── resources/
│       ├── docker-compose.yml
│       └── Caddyfile
├── src/                    — Frontend (React + Vite)
│   ├── App.tsx
│   ├── pages/
│   │   ├── Setup.tsx
│   │   ├── Status.tsx
│   │   ├── Logs.tsx
│   │   └── Settings.tsx
│   ├── components/
│   └── lib/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── flatpak/
    ├── com.gratonite.Server.yml    — Flatpak manifest
    └── com.gratonite.Server.desktop
```

## Success Criteria
- macOS: Download .dmg → drag to Applications → double-click → Gratonite running in < 3 min
- Windows: Download .exe → install → launch → Gratonite running in < 3 min
- Linux: `flatpak install flathub com.gratonite.Server` → launch → running in < 3 min
- System tray shows live status
- Auto-updates for both the app and Docker images
- Zero terminal interaction required
