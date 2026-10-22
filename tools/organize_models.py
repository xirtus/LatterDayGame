#!/usr/bin/env python3
"""Organize Meshy GLB exports into a clear, reusable character model library.

The script is read-only with respect to the source folder. It copies each GLB into
models/<character>/ with a descriptive name, computes geometry/rig metadata, writes
manifest.json + catalog.csv, and can render consistent preview images with Blender.

Usage:
    python3 tools/organize_models.py
    python3 tools/organize_models.py --render
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "meshy"
OUTPUT = ROOT / "models"

# Ordered: the first matching rule wins.
CHARACTERS = [
    {
        "id": "joseph-smith-sr", "name": "Joseph Smith Sr.", "group": "Family",
        "patterns": [r"josephsmithsr", r"joseph[ _-]?smith[ _-]?sr", r"joseph[ _-]?smith[ _-]?father"],
        "blurb": "Joseph's father: a hard-working New England farmer and patriarch of the Smith family.",
    },
    {
        "id": "joseph-smith", "name": "Joseph Smith", "group": "Joseph Smith",
        "patterns": [r"young[ _-]?joseph", r"joseph[ _-]?smith[ _-]?(young|teen)", r"teen[ _-]?joseph", r"josephsmith", r"joseph[ _-]?smith"],
        "blurb": "The central figure of the Restoration, modeled at child, teenage, and adult ages.",
    },
    {
        "id": "emma-smith", "name": "Emma Hale Smith", "group": "Family",
        "patterns": [r"emma[ _-]?smith", r"(?<![a-z])emma(?![a-z])"],
        "blurb": "Joseph's wife, principal scribe during the translation, and a leader in the early Relief Society.",
    },
    {
        "id": "hyrum-smith", "name": "Hyrum Smith", "group": "Family",
        "patterns": [r"hyrum"],
        "blurb": "Joseph's older brother, Patriarch to the Church, and his companion at Carthage.",
    },
    {
        "id": "lucy-mack-smith", "name": "Lucy Mack Smith", "group": "Family",
        "patterns": [r"lucy[ _-]?mack", r"lucymack", r"luckymack", r"(?<![a-z])lucy(?![a-z])"],
        "blurb": "Joseph's mother, family matriarch, and author of a foundational family memoir.",
    },
    {
        "id": "brigham-young", "name": "Brigham Young", "group": "Church leadership",
        "patterns": [r"brigham"],
        "blurb": "Apostle and later second President of the Church, who led the westward migration.",
    },
    {
        "id": "oliver-cowdery", "name": "Oliver Cowdery", "group": "Witnesses",
        "patterns": [r"oliver"],
        "blurb": "Principal scribe during the Book of Mormon translation and one of the Three Witnesses.",
    },
    {
        "id": "martin-harris", "name": "Martin Harris", "group": "Witnesses",
        "patterns": [r"martin[ _-]?harris", r"(?<![a-z])martin(?![a-z])"],
        "blurb": "Farmer, financier of the first printing, and one of the Three Witnesses.",
    },
    {
        "id": "david-whitmer", "name": "David Whitmer", "group": "Witnesses",
        "patterns": [r"david[ _-]?whitmer"],
        "blurb": "One of the Three Witnesses and a member of the Fayette, New York household.",
    },
    {
        "id": "jacob-whitmer", "name": "Jacob Whitmer", "group": "Witnesses",
        "patterns": [r"jacob[ _-]?whitmer"],
        "blurb": "One of the Eight Witnesses who examined the plates in Fayette.",
    },
    {
        "id": "john-whitmer", "name": "John Whitmer", "group": "Witnesses",
        "patterns": [r"john[ _-]?whitmer"],
        "blurb": "One of the Eight Witnesses and the first official Church historian.",
    },
    {
        "id": "sidney-rigdon", "name": "Sidney Rigdon", "group": "Church leadership",
        "patterns": [r"sidney[ _-]?rigdon", r"sidneyrigdon", r"(?<![a-z])sidney(?![a-z])"],
        "blurb": "Campbellite preacher, First Presidency counselor, and a powerful early orator.",
    },
    {
        "id": "moroni", "name": "Moroni", "group": "Sacred visitors",
        "patterns": [r"moroni"],
        "blurb": "The angelic messenger who directed Joseph to the plates; a reverent, older robed interpretation.",
    },
    {
        "id": "nephi", "name": "Nephi", "group": "Book of Mormon",
        "patterns": [r"nephi"],
        "blurb": "Book of Mormon prophet and first narrator, useful for scripture tableaux.",
    },
    {
        "id": "laman", "name": "Laman", "group": "Book of Mormon",
        "patterns": [r"laman"],
        "blurb": "Eldest son of Lehi in the Book of Mormon narrative.",
    },
    {
        "id": "lemuel", "name": "Lemuel", "group": "Book of Mormon",
        "patterns": [r"lemuel"],
        "blurb": "Son of Lehi and brother of Nephi in the Book of Mormon narrative.",
    },
    {
        "id": "alma-the-younger", "name": "Alma the Younger", "group": "Book of Mormon",
        "patterns": [r"alma"],
        "blurb": "Book of Mormon prophet and missionary, modeled for scripture tableaux.",
    },
    {
        "id": "heavenly-father", "name": "Heavenly Father", "group": "Sacred visitors",
        "patterns": [r"heavenly[ _-]?father", r"god[ _-]?the[ _-]?father"],
        "blurb": "A reverent artistic interpretation of the Father in the First Vision narrative.",
    },
    {
        "id": "john-the-baptist", "name": "John the Baptist", "group": "Sacred visitors",
        "patterns": [r"john[ _-]?the[ _-]?baptist", r"john[ _-]?baptist"],
        "blurb": "The New Testament forerunner who restored the Aaronic Priesthood in the Restoration narrative.",
    },
]

GROUP_ORDER = ["Joseph Smith", "Family", "Witnesses", "Church leadership", "Sacred visitors", "Book of Mormon"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def jpeg_size(data: bytes):
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0xD9):
            i += 2
            continue
        length = struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in range(0xC0, 0xC4):
            height, width = struct.unpack(">HH", data[i + 5:i + 9])
            return width, height
        i += 2 + length
    return None


def image_size(data: bytes):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return struct.unpack(">II", data[16:24])
    if data.startswith(b"\xff\xd8"):
        return jpeg_size(data)
    return None


def read_glb(path: Path):
    raw = path.read_bytes()
    magic, version, total = struct.unpack("<4sII", raw[:12])
    if magic != b"glTF" or version != 2:
        raise ValueError(f"Not a GLB2 file: {path}")
    jlen, jkind = struct.unpack("<II", raw[12:20])
    doc = json.loads(raw[20:20 + jlen])
    bin_start = 20 + jlen
    blen, bkind = struct.unpack("<II", raw[bin_start:bin_start + 8])
    binary = raw[bin_start + 8:bin_start + 8 + blen]

    accessors = doc.get("accessors", [])
    triangles = 0
    vertices = 0
    morphs = 0
    bbox_min = [float("inf")] * 3
    bbox_max = [float("-inf")] * 3
    for mesh in doc.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if prim.get("mode", 4) == 4:
                idx = prim.get("indices")
                if idx is not None:
                    triangles += accessors[idx].get("count", 0) // 3
                pos = prim.get("attributes", {}).get("POSITION")
                if pos is not None:
                    acc = accessors[pos]
                    vertices += acc.get("count", 0)
                    if acc.get("min") and acc.get("max"):
                        bbox_min = [min(a, b) for a, b in zip(bbox_min, acc["min"])]
                        bbox_max = [max(a, b) for a, b in zip(bbox_max, acc["max"])]
            morphs += len(prim.get("targets", []))

    textures = []
    for image in doc.get("images", []):
        view_id = image.get("bufferView")
        if view_id is None:
            textures.append({"embedded": False, "uri": image.get("uri")})
            continue
        view = doc["bufferViews"][view_id]
        off = view.get("byteOffset", 0)
        payload = binary[off:off + view["byteLength"]]
        size = image_size(payload)
        textures.append({"embedded": True, "mime": image.get("mimeType"),
                         **({"width": size[0], "height": size[1]} if size else {})})

    animations = []
    for anim in doc.get("animations", []):
        durations = [accessors[s["input"]].get("max", [0])[0] for s in anim.get("samplers", [])]
        animations.append({"name": anim.get("name", "Unnamed"),
                           "channels": len(anim.get("channels", [])),
                           "duration_seconds": round(max(durations, default=0), 3)})

    skins = doc.get("skins", [])
    joints = [doc["nodes"][j].get("name", str(j)) for s in skins for j in s.get("joints", [])]
    materials = doc.get("materials", [])
    emissive = any(float(m.get("emissiveFactor", [0])[0]) > 0 for m in materials)

    height = bbox_max[1] - bbox_min[1] if bbox_min[0] != float("inf") else None
    return {
        "triangles": triangles,
        "vertices": vertices,
        "mesh_count": len(doc.get("meshes", [])),
        "material_count": len(materials),
        "image_count": len(doc.get("images", [])),
        "textures": textures,
        "skins": len(skins),
        "joint_count": len(joints),
        "joint_names": joints,
        "has_finger_joints": any("finger" in j.lower() or "thumb" in j.lower() for j in joints),
        "animations": animations,
        "morph_target_count": morphs,
        "bbox_min": [round(v, 4) for v in bbox_min] if bbox_min[0] != float("inf") else None,
        "bbox_max": [round(v, 4) for v in bbox_max] if bbox_max[0] != float("inf") else None,
        "height_m": round(height, 3) if height else None,
        "emissive_material": emissive,
        "glb_declared_bytes": total,
    }


def classify(filename: str):
    stem = filename.lower()
    stem = stem.replace("meshy_ai_", "").replace("meshy_", "")
    char = None
    for candidate in CHARACTERS:
        if any(re.search(p, stem) for p in candidate["patterns"]):
            char = candidate
            break
    if char is None:
        return None
    age = None
    if char["id"] == "joseph-smith":
        if re.search(r"child", stem):
            age = "child"
        elif re.search(r"young|teen|youth", stem):
            age = "teen"
    if char["id"] == "sidney-rigdon" and re.search(r"young", stem):
        age = "young"
    if re.search(r"rigg|animations", stem):
        role = "rigged"
    elif "remesh" in stem and "10k" in stem:
        role = "remeshed-10k"
    elif "remesh" in stem:
        role = "remeshed"
    elif "optimized" in stem:
        role = "optimized"
    elif re.search(r"(^|[_\-])10k?([_\-]|$)", stem):
        role = "10k"
    elif re.search(r"t_?pose|full_bod", stem):
        role = "tpose"
    elif "image-to-3d" in stem or "character" in stem or "model" in stem:
        role = "source"
    else:
        role = "source"
    return char, age, role


def source_label(source: Path, path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return f"{source.name}/{path.name}"


def source_timestamp(name: str, path: Path):
    match = re.search(r"(\d{10})", name)
    if match:
        value = match.group(1)
        try:
            return datetime(2026, int(value[0:2]), int(value[2:4]),
                            int(value[4:6]), int(value[6:8]), int(value[8:10])).timestamp()
        except ValueError:
            pass
    return path.stat().st_mtime


def file_title(char, age, role):
    label = char["name"]
    if age:
        label += {"child": " (child)", "teen": " (teenage)", "young": " (young)"}.get(age, f" ({age})")
    role_label = {
        "rigged": "rigged & animated",
        "tpose": "T-pose",
        "remeshed": "remeshed",
        "remeshed-10k": "remeshed 10k",
        "optimized": "optimized mesh",
        "10k": "10k mesh",
        "source": "source scan",
    }[role]
    return f"{label} — {role_label}"


def render_preview(glb: Path, png: Path):
    blender = "/Applications/Blender.app/Contents/MacOS/Blender"
    script = ROOT / "tools" / "render_model_preview.py"
    if not Path(blender).exists():
        print(f"  ! Blender not found, skipping {png.name}")
        return False
    png.parent.mkdir(parents=True, exist_ok=True)
    cmd = [blender, "--background", "--factory-startup", "--python", str(script), "--", str(glb), str(png)]
    result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode != 0 or not png.exists():
        print(f"  ! preview failed: {glb.name}")
        return False
    print(f"  preview: {png.relative_to(ROOT)}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=SOURCE)
    ap.add_argument("--render", action="store_true", help="render preview PNGs with Blender")
    ap.add_argument("--no-copy", action="store_true", help="only regenerate metadata/README")
    args = ap.parse_args()

    if not args.source.exists():
        sys.exit(f"source folder not found: {args.source}")
    if not args.no_copy:
        if OUTPUT.exists():
            shutil.rmtree(OUTPUT)
        OUTPUT.mkdir(parents=True)

    entries = []
    excluded = []
    seen_hashes = {}
    for path in sorted(args.source.glob("*.glb")):
        name = path.name
        cls = classify(name)
        if cls is None:
            excluded.append({"source_file": source_label(args.source, path), "reason": "unrecognized character"})
            continue
        char, age, role = cls
        digest = sha256(path)
        if digest in seen_hashes:
            excluded.append({"source_file": source_label(args.source, path), "reason": "exact duplicate",
                             "duplicate_of": seen_hashes[digest]})
            continue
        seen_hashes[digest] = source_label(args.source, path)
        entries.append({"path": path, "char": char, "age": age, "role": role,
                        "digest": digest, "ts": source_timestamp(name, path)})

    # Group by character/age/role; newest export keeps the clean name, older ones get -alt.
    groups = {}
    for e in entries:
        groups.setdefault((e["char"]["id"], e["age"], e["role"]), []).append(e)
    for key, items in groups.items():
        items.sort(key=lambda e: (-e["ts"], e["path"].name))
        for i, e in enumerate(items):
            if i == 0:
                suffix = ""
            elif i == 1:
                suffix = "-alt"
            else:
                suffix = f"-alt{i}"
            stem = e["char"]["id"]
            if e["age"]:
                stem += f"-{e['age']}"
            e["canonical"] = f"{stem}-{e['role']}{suffix}.glb"

    # Primary model per character/age: rigged if present, else the newest usable mesh.
    primary = {}
    for e in entries:
        key = (e["char"]["id"], e["age"])
        current = primary.get(key)
        if current is None:
            primary[key] = e
            continue
        rank = {"rigged": 5, "remeshed-10k": 4, "remeshed": 3, "optimized": 3,
                "10k": 2, "tpose": 1, "source": 0}
        if rank[e["role"]] > rank[current["role"]] or (
                rank[e["role"]] == rank[current["role"]] and e["ts"] > current["ts"]):
            primary[key] = e

    # Build output records and copy files.
    records = []
    for e in entries:
        char = e["char"]
        folder = OUTPUT / char["id"]
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / e["canonical"]
        if not args.no_copy:
            shutil.copyfile(e["path"], dest)
        meta = read_glb(e["path"])
        is_primary = primary[(char["id"], e["age"])] is e
        rec = {
            "character_id": char["id"],
            "character": char["name"],
            "group": char["group"],
            "age": e["age"],
            "role": e["role"],
            "title": file_title(char, e["age"], e["role"]),
            "file": str(dest.relative_to(ROOT)),
            "source_file": source_label(args.source, e["path"]),
            "sha256": e["digest"],
            "bytes": e["path"].stat().st_size,
            "primary": is_primary,
            **meta,
        }
        rec["preview"] = str((folder / (e["canonical"][:-4] + ".png")).relative_to(ROOT)) if is_primary else None
        records.append(rec)

    if not args.no_copy:
        for char in CHARACTERS:
            folder = OUTPUT / char["id"]
            if not folder.exists():
                continue
            previews = [r for r in records if r["character_id"] == char["id"] and r["preview"]]
            if previews:
                src = ROOT / previews[0]["preview"]
                if src.exists():
                    shutil.copyfile(src, folder / "preview.png")

    # Manifest
    characters = []
    for char in CHARACTERS:
        files = [r for r in records if r["character_id"] == char["id"]]
        if not files:
            continue
        files.sort(key=lambda r: (r["age"] or "", {"rigged": 0, "remeshed-10k": 1, "remeshed": 2,
                                                     "optimized": 2, "10k": 3, "tpose": 4, "source": 5}[r["role"]]))
        primaries = [r for r in files if r["primary"]]
        characters.append({
            "id": char["id"],
            "name": char["name"],
            "group": char["group"],
            "blurb": char["blurb"],
            "folder": f"models/{char['id']}",
            "preview": f"models/{char['id']}/preview.png" if primaries else None,
            "primary_model": primaries[0]["file"] if len(primaries) == 1 else None,
            "files": files,
        })

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_folder": args.source.name,
        "conventions": {
            "format": "binary glTF 2.0 (.glb)",
            "up_axis": "Y",
            "units": "meters",
            "naming": "<character>[-<age>]-<role>.glb",
            "roles": ["rigged", "tpose", "source", "remeshed", "remeshed-10k", "optimized", "10k"],
        },
        "totals": {
            "characters": len(characters),
            "models": len(records),
            "bytes": sum(r["bytes"] for r in records),
            "rigged_models": sum(1 for r in records if r["skins"]),
        },
        "characters": characters,
        "excluded": excluded,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    # CSV
    with (OUTPUT / "catalog.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["character_id", "character", "group", "age", "role", "primary",
                         "file", "source_file", "size_mb", "triangles", "joints", "animations", "sha256"])
        for r in records:
            writer.writerow([r["character_id"], r["character"], r["group"], r["age"] or "",
                             r["role"], "yes" if r["primary"] else "no", r["file"], r["source_file"],
                             f"{r['bytes']/1048576:.2f}", r["triangles"], r["joint_count"],
                             "; ".join(a["name"] for a in r["animations"]), r["sha256"]])

    # README
    build_readme(manifest)

    if args.render:
        for char in manifest["characters"]:
            for r in char["files"]:
                if not r["primary"]:
                    continue
                glb = ROOT / r["file"]
                png = ROOT / (r["file"][:-4] + ".png")
                render_preview(glb, png)
        # Keep one folder-level preview for the README hero/table.
        for char in manifest["characters"]:
            for r in char["files"]:
                if r["primary"]:
                    png = ROOT / (r["file"][:-4] + ".png")
                    if png.exists():
                        shutil.copyfile(png, ROOT / char["folder"] / "preview.png")
                        break
        # Refresh manifest preview paths if rendering was deferred.
        (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"organized {len(records)} models for {len(characters)} characters")
    print(f"total {manifest['totals']['bytes']/1048576:.1f} MB")
    if excluded:
        print("excluded:")
        for item in excluded:
            print(" -", item["source_file"], "—", item["reason"])


def build_readme(manifest):
    chars = manifest["characters"]
    lines = []
    lines.append("# 3D Character Library")
    lines.append("")
    lines.append("A reusable library of **Latter-day Saint / Restoration characters**, split out of the *Joseph Smith and the gathering of Zion* preproduction report.")
    lines.append("")
    lines.append(f"**{manifest['totals']['characters']} characters · {manifest['totals']['models']} GLB files · {manifest['totals']['bytes']/1073741824:.2f} GB.** "
                 "Every character includes a rigged, animated model, plus the unrigged source and remesh stages in the same folder.")
    lines.append("")
    lines.append("> These are AI-generated preproduction assets, not documentary likenesses. The sacred figures are reverent artistic interpretations. "
                 "This project is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints.")
    lines.append("")
    lines.append("## Gallery")
    lines.append("")
    lines.append("<table>")
    for i, c in enumerate(chars):
        if i % 4 == 0:
            lines.append("<tr>")
        lines.append(f'<td align="center" width="25%"><a href="{c["id"]}"><img src="{c["id"]}/preview.png" width="170" alt="{c["name"]}"><br><sub><b>{c["name"]}</b></sub></a></td>')
        if i % 4 == 3 or i == len(chars) - 1:
            lines.append("</tr>")
    lines.append("</table>")
    lines.append("")
    lines.append("### Joseph through the ages")
    lines.append("")
    lines.append('<table>')
    lines.append('<tr>')
    for label, img in (("Child", "joseph-smith/joseph-smith-child-rigged.png"),
                       ("Teenage", "joseph-smith/joseph-smith-teen-rigged.png"),
                       ("Adult", "joseph-smith/joseph-smith-rigged.png")):
        lines.append(f'<td align="center" width="33%"><img src="{img}" width="190" alt="Joseph Smith, {label}"><br><sub><b>{label}</b></sub></td>')
    lines.append('</tr>')
    lines.append('</table>')
    lines.append("")
    lines.append("## Quick start")
    lines.append("")
    lines.append("1. Browse a character folder below, or open [`manifest.json`](manifest.json) for hashes, triangle counts and rig data.")
    lines.append("2. Download the `*-rigged.glb` file for a game-ready model with a skeleton and animation clips.")
    lines.append("3. Drop the GLB into Blender, Unity, Godot, Unreal, three.js, or any glTF 2.0 viewer.")
    lines.append("4. If you only want one character, use GitHub's **Download** button on that file, or a sparse checkout (see below).")
    lines.append("")
    lines.append("```bash")
    lines.append("# Clone only the model library, without the report history")
    lines.append("git clone --depth 1 --filter=blob:none --sparse https://github.com/xirtus/LatterDayGame.git")
    lines.append("cd LatterDayGame")
    lines.append("git sparse-checkout set models")
    lines.append("```")
    lines.append("")
    lines.append("## Rigged models")
    lines.append("")
    lines.append("The `*-rigged.glb` files use a humanoid Mixamo-style skeleton (22–24 body joints) and normally ship with **Running** and **Walking** clips. "
                 "They have head and shoulder joints but **no finger joints or facial blendshapes**. All textures are embedded in the GLB.")
    lines.append("")
    lines.append("| | |")
    lines.append("|---|---|")
    lines.append("| Format | Binary glTF 2.0 (`.glb`) |")
    lines.append("| Up axis | Y |")
    lines.append("| Units | Meters (characters are roughly 1.7–1.9 m tall) |")
    lines.append("| Textures | Embedded 2K/4K atlas |")
    lines.append("| Animation | 2 clips on most rigs (`Running`, `Walking`); exact clips are in `manifest.json` |")
    lines.append("")
    lines.append("Meshy rigged exports can contain the same texture as both base color and emissive. If a model looks washed out, disconnect or blacken the emissive input and keep the base-color texture.")
    lines.append("")
    lines.append("## Catalog")
    lines.append("")
    lines.append("| Character | Group | Rigged model(s) | Best model |")
    lines.append("| --- | --- | --- | --- |")
    for c in chars:
        rigged = [f for f in c["files"] if f["role"] == "rigged"]
        rigged_links = "<br>".join(f"[`{Path(f['file']).name}`]({c['id']}/{Path(f['file']).name})" for f in rigged) or "—"
        best = rigged[0] if rigged else c["files"][0]
        best_link = f"[`{Path(best['file']).name}`]({c['id']}/{Path(best['file']).name})<br>{best['triangles']:,} tris · {best['bytes']/1048576:.1f} MB"
        lines.append(f"| **{c['name']}**<br>{c['blurb']} | {c['group']} | {rigged_links} | {best_link} |")
    lines.append("")
    lines.append("## Naming convention")
    lines.append("")
    lines.append("```")
    lines.append("models/<character>/<character>[-<age>]-<role>.glb")
    lines.append("```")
    lines.append("")
    lines.append("| Role | Meaning |")
    lines.append("| --- | --- |")
    lines.append("| `rigged` | Skinned, animated game-ready mesh |")
    lines.append("| `tpose` | Explicit T-pose export, no rig |")
    lines.append("| `source` | Original high-poly image-to-3D scan |")
    lines.append("| `remeshed` / `remeshed-10k` | Decimated mesh, no rig |")
    lines.append("| `optimized` | Optimized mesh, no rig |")
    lines.append("| `10k` | 10k-triangle remesh, no rig |")
    lines.append("| `-alt` | Older export of the same stage, kept for comparison |")
    lines.append("")
    lines.append("## Attribution")
    lines.append("")
    lines.append("Character models generated with [Meshy](https://www.meshy.ai/) for the *Latter Day Game* project. "
                 "Concept art and report by Andreas Xirtus. If you use these models, credit **Latter Day Game / xirtus** and keep this file with the assets.")
    lines.append("")
    lines.append("The repository is released under the MIT license (see the root [`LICENSE`](../LICENSE)).")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"*Generated by `tools/organize_models.py` on {manifest['generated_at']}. Source exports are preserved under their original names in the manifest's `source_file` field.*")
    lines.append("")
    (OUTPUT / "README.md").write_text("\n".join(lines))


if __name__ == "__main__":
    main()
