from datetime import datetime, timezone
from pathlib import Path
import json
import re
import struct


ROOT = Path(__file__).resolve().parents[1]
EXTRA_NAMES = {
    "CHRISTIAN_WHITMER": "Christian Whitmer", "JACOB_WHITMER": "Jacob Whitmer",
    "PETER_WHITMER_JR": "Peter Whitmer Jr.", "JOHN_WHITMER": "John Whitmer",
    "HIRAM_PAGE": "Hiram Page", "SAMUEL_SMITH": "Samuel H. Smith",
    "NEPHI": "Nephi", "LAMAN": "Laman", "LEMUEL": "Lemuel",
    "ALMA_YOUNGER": "Alma the Younger",
}
PATTERNS = {
    "JOSEPH_CHILD": [r"(child|boy|little).*joseph", r"joseph.*(child|boy|little)"],
    "JOSEPH_YOUTH": [r"(teen|adolescent|youth|young).*joseph", r"joseph.*(teen|adolescent|youth)"],
    "JOSEPH_YOUNG": [r"young.*joseph", r"joseph.*young.*adult"],
    "JOSEPH_MATURE": [r"joseph.*smith"],
    "EMMA": [r"emma"], "OLIVER": [r"oliver"], "HYRUM": [r"hyrum"],
    "LUCY": [r"lucy.*mack", r"lucky.*mack"],
    "JOSEPH_SR": [r"joseph.*smith.*sr", r"joseph.*smith.*father"],
    "ALVIN": [r"alvin"], "FATHER": [r"heavenly.*father", r"god.*father"],
    "CHRIST": [r"jesus", r"christ(?!ian)"], "MORONI": [r"moroni"],
    "JOHN_BAPTIST": [r"john.*baptist"], "MARTIN": [r"martin.*harris"],
    "DAVID": [r"david.*whitmer"], "SIDNEY": [r"sidney.*rigdon"],
    "BRIGHAM": [r"brigham"], "ORSON": [r"orson"], "PARLEY": [r"parley"],
    "ELIZA": [r"eliza(?!beth)"], "LOUISA": [r"louisa"],
    "WILLARD": [r"willard"], "JOHN_TAYLOR": [r"john.*taylor"],
    "CHRISTIAN_WHITMER": [r"christian.*whitmer"],
    "JACOB_WHITMER": [r"jacob.*whitmer"],
    "PETER_WHITMER_JR": [r"peter.*whitmer.*(jr|junior)", r"peter.*whitmer(?!.*sr)"],
    "JOHN_WHITMER": [r"john.*whitmer"], "HIRAM_PAGE": [r"hiram.*page"],
    "SAMUEL_SMITH": [r"samuel.*smith"], "NEPHI": [r"nephi"],
    "LAMAN": [r"laman"], "LEMUEL": [r"lemuel"],
    "ALMA_YOUNGER": [r"alma.*younger"],
}
ALIASES = {
    "JOSEPH_ADULT": "JOSEPH_MATURE", "JOSEPH_CELESTIAL": "JOSEPH_MATURE",
    "JEHOVAH": "CHRIST", "HEAVENLY_FATHER": "FATHER",
}


def inspect(path):
    with path.open("rb") as handle:
        magic, version, length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2 or path.stat().st_size < length:
            raise ValueError("Incomplete or unsupported GLB")
        count, kind = struct.unpack("<II", handle.read(8))
        if kind != 0x4E4F534A:
            raise ValueError("Missing GLB metadata")
        data = json.loads(handle.read(count))
    accessors = data.get("accessors", [])
    triangles = sum(
        accessors[primitive.get("indices", primitive["attributes"]["POSITION"])]["count"] // 3
        for mesh in data.get("meshes", []) for primitive in mesh["primitives"]
        if primitive.get("mode", 4) == 4
    )
    return {
        "file": path.name, "url": "../../meshy/" + path.name,
        "bytes": path.stat().st_size, "triangles": triangles,
        "rigged": bool(data.get("skins")),
        "animations": [animation.get("name", "Unnamed") for animation in data.get("animations", [])],
    }


def matches(identity, filename):
    text = filename.lower()
    if identity == "JOSEPH_MATURE" and re.search(r"young|teen|child|boy|smith.*sr|smith.*father", text):
        return False
    if identity in {"JOSEPH_YOUTH", "JOSEPH_YOUNG"} and re.search(r"child|little|boy", text):
        return False
    if identity == "JOSEPH_YOUNG" and re.search(r"teen|adolescent|youth", text):
        return False
    return any(re.search(pattern, text) for pattern in PATTERNS.get(identity, []))


def preference(asset):
    name = asset["file"].lower()
    return (
        asset["triangles"] > 150000,
        not asset["rigged"],
        not bool(re.search(r"remesh|10k|optimized|rigged", name)),
        asset["bytes"],
    )


def age_preference(identity, asset):
    name = asset["file"].lower()
    if identity == "JOSEPH_YOUTH":
        explicit = bool(re.search(r"teen|adolescent|youth", name))
        verified_farm_youth = name == "meshy_ai_young_joseph_smith_ri_all_animations.glb"
        return (not explicit, not verified_farm_youth, *preference(asset))
    if identity == "JOSEPH_YOUNG":
        explicit = "adult" in name
        verified_formal_young_adult = name == "meshy_ai_young_joseph_smith_ri_all_animations (1).glb"
        return (not explicit, not verified_formal_young_adult, *preference(asset))
    return preference(asset)


def main():
    assets = []
    skipped = []
    for path in sorted((ROOT / "meshy").rglob("*")):
        if not path.is_file() or path.suffix.lower() != ".glb":
            continue
        try:
            asset = inspect(path)
            asset["url"] = "../../" + str(path.relative_to(ROOT))
            assets.append(asset)
        except (ValueError, OSError, struct.error, json.JSONDecodeError) as error:
            skipped.append({"file": path.name, "reason": str(error)})
    names = {entry["id"]: entry["name"] for entry in json.loads((ROOT / "docs/cast.json").read_text())}
    names.update(EXTRA_NAMES)
    characters = {}
    for identity, label in names.items():
        source_identity = ALIASES.get(identity, identity)
        candidates = sorted([asset for asset in assets if matches(source_identity, asset["file"])], key=lambda asset: age_preference(source_identity, asset))
        selected = candidates[0] if candidates else None
        if selected and selected["triangles"] > 150000 and identity != "JOSEPH_CHILD":
            selected = None
        warning = "High-poly provisional source; replace with an optimized rigged export" if selected and selected["triangles"] > 150000 else ""
        characters[identity] = {
            "id": identity, "label": label, "status": "model" if selected else "placeholder",
            "asset": selected, "variants": candidates,
            "note": "Dedicated child model required; never substitutes an adult likeness" if identity == "JOSEPH_CHILD" and not selected else "",
            "warning": warning,
        }
    for alias, identity in ALIASES.items():
        if alias not in characters:
            characters[alias] = {**characters[identity], "id": alias}
    manifest = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "source": "Local meshy directory; originals are never modified or copied",
        "regenerate": "python3 tools/build_game_assets.py",
        "glbCount": len(assets), "characters": characters, "skipped": skipped,
    }
    destination = ROOT / "game/content/assets.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(manifest, indent=2) + "\n")
    ready = [identity for identity, entry in characters.items() if entry["asset"]]
    print(f"Inspected {len(assets)} GLBs; {len(ready)} character/age IDs have optimized models.")
    for identity in ["JOSEPH_CHILD", "JOSEPH_YOUTH", "JOSEPH_YOUNG", "CHRIST", "FATHER", "JOHN_BAPTIST", *EXTRA_NAMES]:
        entry = characters[identity]
        print(f"{identity}: {entry['asset']['file'] if entry['asset'] else 'provisional stand-in; optimized model not found'}")


if __name__ == "__main__":
    main()
