#!/usr/bin/env python3
"""Point the playable game's asset manifest at the organized models/ library.

The game was built while the source exports lived in a local meshy/ folder. In this
public repository the same files are renamed under models/, so rewrite every asset
URL by matching the original filename recorded in models/manifest.json.

Run after replacing or regenerating game/content/assets.json:
    python3 tools/rewrite_game_assets.py
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "models" / "manifest.json"
ASSETS = ROOT / "game" / "content" / "assets.json"


def main():
    manifest = json.loads(MANIFEST.read_text())
    by_source = {}
    for character in manifest["characters"]:
        for model in character["files"]:
            by_source[Path(model["source_file"]).name] = model["file"]
    for excluded in manifest.get("excluded", []):
        duplicate = Path(excluded.get("duplicate_of", "")).name
        if duplicate in by_source:
            by_source[Path(excluded["source_file"]).name] = by_source[duplicate]

    game = json.loads(ASSETS.read_text())
    rewritten = 0
    missing = []
    for character in game.get("characters", {}).values():
        entries = []
        if character.get("asset"):
            entries.append(character["asset"])
        entries.extend(character.get("variants", []))
        for entry in entries:
            name = Path(entry.get("file", "")).name
            if name in by_source:
                entry["url"] = "../../" + by_source[name]
                rewritten += 1
            elif name:
                missing.append(name)
    game["source"] = "Organized models/ library; originals are preserved under their old names in models/manifest.json"
    game["regenerate"] = "python3 tools/build_game_assets.py (with a local meshy/ source), then python3 tools/rewrite_game_assets.py"
    ASSETS.write_text(json.dumps(game, indent=2) + "\n")
    print(f"rewrote {rewritten} asset URLs; {len(set(missing))} unmatched")
    for name in sorted(set(missing))[:20]:
        print("  unmatched:", name)


if __name__ == "__main__":
    main()
