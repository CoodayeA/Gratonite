# Stoat Chat Research Notes (stoatchat)

Source: https://github.com/stoatchat and https://github.com/stoatchat/for-desktop (public org + repo pages).

## What Stoat is doing well

- **Multi-client strategy**: Separate repos for web, desktop, Android, iOS (plus legacy web), which keeps platform-specific concerns isolated.
- **Clear distribution paths**: Website + dedicated downloads link for clients (central entry point).
- **Self-hosting focus**: Dedicated `self-hosted` repo with Docker Compose config.
- **Developer documentation**: Dedicated developer docs site and separate wiki repo.
- **Assets as submodule**: Shared assets repo is pulled into desktop builds via git submodules.

## Desktop repo takeaways (for-desktop)

- Electron desktop wrapper with **Linux packaging** support.
- Uses **Electron Forge** with Vite configs for main/preload/renderer (vite.main/preload/renderer config files).
- Supports **Flatpak and Nix workflows** for Linux distribution.
- Provides a **force-server flag** to point the desktop app at a dev server.
- Maintains a **release process** (release-please, changelog, releases).

## Ideas to apply to Gratonite

1. **Desktop: add a force-server flag** to point the app at a staging/tunnel URL for testing.
2. **Dedicated assets pipeline** for desktop/mobile (even if not a submodule) to keep branding consistent.
3. **Distribution hub** (website/downloads) even for early testing to reduce friction for testers.
4. **Linux packaging plan** (AppImage + deb/rpm) plus future Flatpak path.
5. **Developer docs split**: one high-level portal and a deeper wiki/knowledge base.

## Additional repo notes (requested)

### stoatchat/self-hosted
- Dedicated **self-hosting repo** with Docker Compose, Caddyfile, and a config generator script.
- Extensive **operational guidance**: firewall setup, TLS, reverse proxy notes, upgrade notices, and migration scripts.
- Explicit **push notification daemon** requirements for iOS/Android.
- Clear **host sizing guidance** (vCPU/memory) and port usage.

Takeaway for Gratonite:
- Create a separate `self-hosted` repo with `compose.yml`, `Caddyfile`, and a config generator.
- Maintain a living **upgrade notices** section and migration scripts directory.

### stoatchat/stoatchat (backend)
- **Multi-service backend** split into crates (API, gateway/events, files, proxy, push daemon).
- A **reference config file** checked into repo and overrides file for local dev.
- Documented **service port map** and dev startup scripts.
- Release automation with **release-please** and changelog.

Takeaway for Gratonite:
- Keep a single canonical config + overrides pattern and document port map.
- Maintain a `scripts/start.sh` for local multi-service boot.

### stoatchat/for-web
- Separate **web client repo** with dedicated docs, CI, and docker build.
- Clear **routing inventory** and dev workflow using a task runner.
- Asset submodule pattern for branding.

Takeaway for Gratonite:
- Define a routing map in our web repo and adopt a clear dev task runner script.
- Consider a shared assets package or submodule for UI consistency.

### stoatchat/stoat.chat (marketing site)
- Dedicated marketing site repo (Astro) with lightweight build and deploy path.
- Serves as a **download hub**.

Takeaway for Gratonite:
- Split marketing site into a standalone repo and centralize downloads there.

### stoatchat/awesome-stoat
- Community “awesome list” of **libraries, bots, clients**, plus contribution guide.

Takeaway for Gratonite:
- Create an `awesome-gratonite` list to encourage ecosystem growth.

### stoatchat/for-ios
- **Native iOS app** repo with Xcode project, extensions (broadcast, notification service), and TestFlight info.

Takeaway for Gratonite:
- Keep native iOS capabilities isolated (extensions, widgets, notifications).

## Structure guidance

You asked to mirror Stoat’s GitHub structure with our naming. Recommended mapping:

- `gratonite` (org)
  - `gratonite/self-hosted`
  - `gratonite/gratonite` (backend)
  - `gratonite/for-web`
  - `gratonite/for-desktop`
  - `gratonite/for-ios`
  - `gratonite/for-android`
  - `gratonite/gratonite.chat` (marketing/downloads)
  - `gratonite/awesome-gratonite`

## Gaps to watch (risk)

- App release flow needs consistent signing and versioning across all platforms.
- Multiple client repos can fragment UX unless a shared design system is enforced.

## Suggested next steps for Gratonite

- Add a `--force-server` parameter to desktop build scripts.
- Define a basic distribution page (even static) with desktop builds and APK.
- Maintain a single source of truth for UX tokens (shared theme/tokens package).
