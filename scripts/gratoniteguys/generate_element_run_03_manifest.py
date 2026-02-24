#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


RARITY_DIRS = ["common", "uncommon", "rare", "epic", "legendary"]
PNG_PATTERN = re.compile(
    r"^(?P<rarity>[a-z]+)-(?P<num>\d+)-(?P<sym>[A-Za-z0-9]+)-(?P<nickname>.+)-(?P<element>.+)\.png$"
)


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return re.sub(r"-+", "-", value)


def build_manifest(source_root: Path) -> dict:
    rarity_pngs: list[dict] = []
    for rarity in RARITY_DIRS:
        d = source_root / rarity
        for f in sorted(d.glob("*.png")):
            m = PNG_PATTERN.match(f.name)
            if not m:
                rarity_pngs.append(
                    {
                        "type": "creature_png",
                        "rarity": rarity,
                        "filename": f.name,
                        "relativePath": str(f.relative_to(source_root)),
                        "parseError": True,
                    }
                )
                continue
            rarity_pngs.append(
                {
                    "type": "creature_png",
                    "rarity": rarity,
                    "elementNumber": int(m.group("num")),
                    "symbol": m.group("sym"),
                    "nicknameSlug": m.group("nickname"),
                    "elementSlug": m.group("element"),
                    "filename": f.name,
                    "relativePath": str(f.relative_to(source_root)),
                }
            )

    mythic_entries: list[dict] = []
    for i, f in enumerate(sorted((source_root / "Mythics").glob("*")), start=1):
        if not f.is_file() or f.name.startswith("."):
            continue
        ext = f.suffix.lower().lstrip(".")
        if ext not in {"gif", "mp4"}:
            continue
        mythic_entries.append(
            {
                "type": "mythic_animation",
                "format": ext,
                "filename": f.name,
                "relativePath": str(f.relative_to(source_root)),
                "normalizedKey": f"mythic-{i:03d}-{slugify(f.stem)[:80]}",
                "sizeBytes": f.stat().st_size,
            }
        )

    return {
        "sourceRoot": str(source_root),
        "dataset": "element-run-03",
        "summary": {
            "rarityPngCount": len(rarity_pngs),
            "mythicGifCount": sum(1 for e in mythic_entries if e["format"] == "gif"),
            "mythicMp4Count": sum(1 for e in mythic_entries if e["format"] == "mp4"),
        },
        "rarityPngs": rarity_pngs,
        "mythicAnimations": mythic_entries,
    }


def main() -> int:
    if len(sys.argv) < 2:
      print("Usage: generate_element_run_03_manifest.py <source_root> [output_dir]", file=sys.stderr)
      return 2

    source_root = Path(sys.argv[1]).expanduser().resolve()
    output_dir = (
        Path(sys.argv[2]).expanduser().resolve()
        if len(sys.argv) > 2
        else Path.cwd() / "assets" / "gratoniteguys" / "manifest"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = build_manifest(source_root)
    manifest_path = output_dir / "element-run-03-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    aliases = {
        "items": [
            {
                "id": f"gg-mythic-{idx:03d}",
                "label": Path(entry["filename"]).stem,
                "normalizedKey": entry["normalizedKey"],
                "sourceRelativePath": entry["relativePath"],
                "filename": entry["filename"],
            }
            for idx, entry in enumerate(
                [e for e in manifest["mythicAnimations"] if e["format"] == "gif"], start=1
            )
        ]
    }
    aliases_path = output_dir / "mythics-gif-aliases.json"
    aliases_path.write_text(json.dumps(aliases, indent=2))

    print(f"Wrote {manifest_path}")
    print(f"Wrote {aliases_path}")
    print(json.dumps(manifest["summary"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
