# GratoniteGuys Implementation Status and Plan (2026-02-23)

## Purpose
This document captures the current GratoniteGuys implementation work, what is already completed, what is partially implemented locally, what is still pending, and the planned next steps.

This is the source of truth for resuming GratoniteGuys development without losing context.

## Terminology (Locked)
- `Gravatars` = existing avatar/profile image + avatar studio system (already in product)
- `GratoniteGuys` = separate collectible identity system (pack opening, collection, dust/economy, equipable identity layer)

## Source Assets / Prototypes
- Standalone prototype project:
  - `/Users/ferdinand/newproject/gratonitegame`
- Latest pack-opening prototype used for extraction:
  - `/Users/ferdinand/newproject/gratonitegame/pack-opening-v9_2.html`
- Creature/rarity asset set:
  - `/Users/ferdinand/newproject/gratonitegame/element-run-03`

## Completed Work

### 1) Mythic MP4 -> GIF conversion (complete)
- All Mythic MP4s were converted to GIFs.
- Verified state in:
  - `/Users/ferdinand/newproject/gratonitegame/element-run-03/Mythics`
- Current counts:
  - `26` `.mp4`
  - `26` `.gif`

### 2) Asset inventory and normalization (complete)
Generated normalized manifests for `element-run-03`:
- `/Users/ferdinand/Projects/untitled folder/assets/gratoniteguys/manifest/element-run-03-manifest.json`
- `/Users/ferdinand/Projects/untitled folder/assets/gratoniteguys/manifest/mythics-gif-aliases.json`

Summary from manifest:
- `640` rarity PNGs (`common`, `uncommon`, `rare`, `epic`, `legendary` x `128`)
- `26` Mythic GIFs
- `26` Mythic MP4s

Added a repeatable manifest generator:
- `/Users/ferdinand/Projects/untitled folder/scripts/gratoniteguys/generate_element_run_03_manifest.py`

Copied app-consumable manifest files into web app source:
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/assets/gratoniteguys/element-run-03-manifest.json`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/assets/gratoniteguys/mythics-gif-aliases.json`

### 3) Prototype extraction (React wrapper, complete MVP)
Added a React wrapper component that embeds the standalone `pack-opening-v9_2.html` prototype in an iframe:
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/components/gratoniteguys/GratoniteGuysPackOpeningLab.tsx`

Prototype file is served from app `public/` (runtime loaded, not bundled raw JS):
- `/Users/ferdinand/Projects/untitled folder/apps/web/public/gratoniteguys/prototypes/pack-opening-v9_2.html`

Important behavior:
- Prototype localStorage keys are namespaced in the wrapper to avoid collisions:
  - `gratonite_collection` -> `gratonite_guys_collection`
  - `gratonite_dust` -> `gratonite_guys_dust`

### 4) Shop integration (admin/dev gated, complete MVP)
Added GratoniteGuys lab route and admin entry:
- `/shop/gratonite-guys-lab`

Files:
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/pages/GratoniteGuysLabPage.tsx`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/pages/ShopPage.tsx`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/App.tsx`

Access behavior:
- Admin card shown for `ferdinand` / `coodaye`
- Dev bypass route supported: `/shop/gratonite-guys-lab?dev=1`

### 5) Native React extraction foundation (started and locally working)
Implemented a native GratoniteGuys MVP panel (not backend-backed yet):

Core config/roll/catalog helpers:
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/lib/gratoniteguys.ts`

Native local state hook (collection, dust, coins, roll history, localStorage):
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/hooks/useGratoniteGuysLab.ts`

Native UI panel (capsule control + reveal card + recent results):
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/components/gratoniteguys/GratoniteGuysNativeLab.tsx`

Lab page wiring:
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/pages/GratoniteGuysLabPage.tsx`

Styling:
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/styles.css`

### 6) Validation (local)
Validated locally:
- `python3 -m py_compile /Users/ferdinand/Projects/untitled folder/scripts/gratoniteguys/generate_element_run_03_manifest.py` -> PASS
- `pnpm --filter @gratonite/web typecheck` -> PASS
- `pnpm --filter @gratonite/web build` -> PASS

## Current Local Changes (Not Yet Deployed)
These files have local changes/new files related to GratoniteGuys and need deployment:

Modified:
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/App.tsx`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/pages/ShopPage.tsx`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/styles.css`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/vite-env.d.ts`

New:
- `/Users/ferdinand/Projects/untitled folder/apps/web/public/gratoniteguys/prototypes/pack-opening-v9_2.html`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/assets/gratoniteguys/element-run-03-manifest.json`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/assets/gratoniteguys/mythics-gif-aliases.json`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/components/gratoniteguys/GratoniteGuysPackOpeningLab.tsx`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/components/gratoniteguys/GratoniteGuysNativeLab.tsx`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/hooks/useGratoniteGuysLab.ts`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/lib/gratoniteguys.ts`
- `/Users/ferdinand/Projects/untitled folder/apps/web/src/pages/GratoniteGuysLabPage.tsx`
- `/Users/ferdinand/Projects/untitled folder/assets/gratoniteguys/manifest/element-run-03-manifest.json`
- `/Users/ferdinand/Projects/untitled folder/assets/gratoniteguys/manifest/mythics-gif-aliases.json`
- `/Users/ferdinand/Projects/untitled folder/scripts/gratoniteguys/generate_element_run_03_manifest.py`

## Planned Next Steps (Execution Plan)

### Phase 1: Native GratoniteGuys MVP (replace iframe functionality progressively)
1. Native capsule flow UI
- Replace iframe “Open” control flow with native React capsule controls
- Keep iframe prototype available as side-by-side reference until parity is acceptable

2. Native reveal card + progression polish
- Expand native reveal UX (animation states, result strip, duplicate handling cues)
- Use rarity styling + haptics/audio hooks later

3. Mythic GIF integration
- Use `mythics-gif-aliases.json` to surface Mythic GIF previews in the native reveal flow
- Map mythic animation selection rules (random/element-linked/fallback)

4. Local progression model finalization (temporary)
- Keep localStorage persistence for rapid iteration while backend is being added
- Document local keys and migration plan to server persistence

### Phase 2: Backend persistence (real product foundation)
1. DB schema (new GratoniteGuys tables)
- Catalog table (or catalog seed strategy)
- Inventory / ownership table
- User state table (dust, coins if GratoniteGuys-specific, active equipped guy, cooldown timestamps)
- Equip cooldown tracking

2. API module
- `GET /api/v1/gratonite-guys/state`
- `POST /api/v1/gratonite-guys/open` (server-authoritative roll)
- `POST /api/v1/gratonite-guys/equip`
- `GET /api/v1/gratonite-guys/catalog` (or static manifest-backed response for MVP)

3. Migrate native lab from localStorage to API
- Keep a dev fallback mode if API is unavailable
- Add optimistic UI only where safe

### Phase 3: Identity integration (active GratoniteGuy in product UI)
1. Profile surfaces
- Show active GratoniteGuy chip in profile popover/profile panel
- Minimal metadata first (name, rarity, symbol)

2. Chat surfaces
- Show active GratoniteGuy identity chip on message rows or message hover/profile surfaces
- Cache user active guy state to avoid excessive requests

3. Settings/Profile controls
- Equip/unequip controls surfaced outside lab route once backend persistence is live

### Phase 4: Production-grade pack opening + economy (later)
1. Replace iframe prototype entirely with native React implementation
2. Add capsule tiers / guaranteed pack logic
3. Add dust economy sinks and conversions
4. Add reveal media + animation/video/gif polish
5. Add backend auditability and anti-abuse protections

## Deferred / Explicitly Not Done Yet
- Full backend persistence for GratoniteGuys (not implemented yet)
- Server-authoritative pack rolling and economy
- Equip cooldown enforcement
- Active GratoniteGuy profile/chat integration
- Native crystal/capsule animation layer (canvas/WebGL)
- Marketplace/UGC/creator uploads
- Full hatch/opening video pipeline integration

## Deploy Notes (when ready)
This work is currently local. To publish:
1. Run web typecheck/build
2. Deploy web container to Hetzner
3. Verify:
   - `/shop`
   - `/shop/gratonite-guys-lab`
   - iframe prototype loads from `/gratoniteguys/prototypes/pack-opening-v9_2.html`

## Resume Command (manifest regeneration)
When `element-run-03` assets change:

```bash
python3 "/Users/ferdinand/Projects/untitled folder/scripts/gratoniteguys/generate_element_run_03_manifest.py" \
  "/Users/ferdinand/newproject/gratonitegame/element-run-03" \
  "/Users/ferdinand/Projects/untitled folder/assets/gratoniteguys/manifest"
```

Then copy refreshed manifests into web source:

```bash
cp "/Users/ferdinand/Projects/untitled folder/assets/gratoniteguys/manifest/element-run-03-manifest.json" \
   "/Users/ferdinand/Projects/untitled folder/apps/web/src/assets/gratoniteguys/element-run-03-manifest.json"
cp "/Users/ferdinand/Projects/untitled folder/assets/gratoniteguys/manifest/mythics-gif-aliases.json" \
   "/Users/ferdinand/Projects/untitled folder/apps/web/src/assets/gratoniteguys/mythics-gif-aliases.json"
```

