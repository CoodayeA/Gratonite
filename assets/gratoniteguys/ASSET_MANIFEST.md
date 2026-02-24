# GratoniteGuys Asset Manifest

Use this file to track raw and optimized assets for the GratoniteGuys system.

## Naming Convention
- Characters: `<elementId>_<elementSlug>_<rarity>.<ext>`
- Capsules: `capsule_<state>_<rarity?>.<ext>`
- Reveal video: `reveal_<phase|full>_<rarity|generic>.<ext>`
- UI assets: `ui_<surface>_<variant>.<ext>`

Examples:
- `008_oxygen_epic.webp`
- `capsule_idle_generic.webm`
- `reveal_full_legendary.mp4`

## Directory Rules
- `source/` = raw exports (high-res, editable, non-optimized)
- Other folders = production candidates (optimized, app-ready)
- Keep raw and optimized variants as separate files (do not overwrite source)

## Asset Entries

| File | Type | Element | Rarity | Dimensions | Format | Alpha | Loop | Source | Status | Notes |
|---|---|---:|---|---|---|---|---|---|---|---|
| assets/gratoniteguys/characters/... | character | 8 | epic | 1024x1024 | webp | yes | n/a | Blender export | draft | |

## Types
- `character`
- `capsule`
- `reveal-video`
- `reveal-still`
- `ui`
- `audio`

## Status Values
- `draft`
- `approved`
- `optimized`
- `final`

## Export Notes (Recommended)
- Prefer `webp`/`png` for stills depending on alpha/transparency needs.
- Prefer `webm` (with alpha if needed) or `mp4` for reveal videos depending browser support and use-case.
- Keep one consistent frame rate for reveal clips (recommend `30fps` or `60fps`).
- Record whether each clip is intended for full-screen playback or embedded UI playback.
