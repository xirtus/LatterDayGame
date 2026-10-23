from datetime import datetime, timezone
from pathlib import Path
import json
import re
import struct


ROOT = Path(__file__).resolve().parents[1]
VERIFIED_CHRIST_VARIANTS = {
    "meshy_ai_mormon_figure_1022123720_image-to-3d-texture.glb": "red",
    "meshy_ai_mormon_figure_10k_1022123729_texture.glb": "red",
    "meshy_ai_mormon_rigged_all_animations.glb": "red",
    "meshy_ai_mormon_jesus_figure_1022123707_image-to-3d-texture.glb": "white",
    "meshy_ai_mormon_jesus_optimize_1022123833_texture.glb": "white",
}
CONFIRMED_CAST_FILES = {
    "meshy_ai_james_taylor_3d_1022130218_image-to-3d.glb": "JOHN_TAYLOR",
    "meshy_ai_james_taylor_3d_1022130218_image-to-3d-texture.glb": "JOHN_TAYLOR",
    "meshy_ai_james_taylor_rigged_all_animations.glb": "JOHN_TAYLOR",
    "james_taylor_rigged.glb": "JOHN_TAYLOR",
}
EXTRA_NAMES = {
    "ORSON_YOUNG": "Orson Pratt — early ministry", "ORSON_ELDER": "Orson Pratt — later life",
    "CHRIST_WHITE": "Jesus Christ — white garment", "CHRIST_RED": "Jesus Christ — red garment",
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
    "CHRIST": [r"jesus", r"christ(?!ian)", r"saviou?r"], "MORONI": [r"moroni"],
    "JOHN_BAPTIST": [r"john.*baptist"], "PETER": [r"peter"], "JAMES": [r"james"], "JOHN": [r"john"],
    "MOSES": [r"moses"], "ELIAS": [r"elias"], "ELIJAH": [r"elijah"], "MARTIN": [r"martin.*harris"],
    "ELIJAH_ABLE": [r"elijah.*(?:able|abel|ables)(?![a-z])", r"(?:able|abel).*elijah"],
    "JANE_MANNING": [r"jane.*(?:manning|james)"],
    "WALKER_LEWIS": [r"(?:quack.*)?walker.*lewis", r"lewis.*walker"],
    "WW_PHELPS": [r"(?:william.*w|w.*w).*phelps", r"phelps"],
    "DAVID": [r"david.*whitmer"], "SIDNEY": [r"sidney.*rigdon"],
    "BRIGHAM": [r"brigham.*young", r"brigham"], "ORSON": [r"orson.*pratt"], "PARLEY": [r"parley.*pratt"],
    "ELIZA": [r"eliza(?!beth)"], "LOUISA": [r"louisa"],
    "WILLARD": [r"willard"], "JOHN_TAYLOR": [r"john.*taylor"],
    "CHRISTIAN_WHITMER": [r"christian.*whitmer"],
    "JACOB_WHITMER": [r"jacob.*whitmer"],
    "PETER_WHITMER": [r"peter.*whitmer.*(sr|senior)"],
    "PETER_WHITMER_JR": [r"peter.*whitmer.*(jr|junior)"],
    "JOHN_WHITMER": [r"john.*whitmer"], "HIRAM_PAGE": [r"(hiram|hyrum).*page"],
    "SAMUEL_SMITH": [r"samuel.*smith"], "NEPHI": [r"nephi"],
    "LAMAN": [r"laman"], "LEMUEL": [r"lemuel"],
    "ALMA_YOUNGER": [r"alma.*younger"],
    "ISAAC_HALE": [r"isaac.*hale"], "GRANDIN": [r"(?:egbert|e.*b).*grandin", r"grandin"],
    "NEWEL_KNIGHT": [r"newell?.*knight"], "WHITNEY": [r"newell?.*whitney"],
    "ELIZABETH_WHITNEY": [r"elizabeth.*whitney"], "EDWARD_PARTRIDGE": [r"edward.*partridge"],
    "JOHN_JOHNSON": [r"john.*johnson"], "HEBER": [r"heber.*kimball"],
    "SARAH_CLEVELAND": [r"sarah.*cleveland"], "WILLIAM_CLAYTON": [r"william.*clayton"],
    "JONAS": [r"abraham.*jonas", r"jonas"], "WILFORD": [r"wilford.*woodruff"],
    "THOMAS_BULLOCK": [r"thomas.*bullock"], "DAN_JONES": [r"dan.*jones"],
    "VAN_BUREN": [r"van.*buren"], "FORD": [r"(?:thomas|governor).*ford"],
    "WILLIAM_LAW": [r"william.*law"],
    "FUTURE_GUIDE": [r"(?<![a-z])miriam(?![a-z])", r"future.*guide"],
    "FUTURE_SCIENTIST": [r"elias.*vale", r"future.*scientist"],
    "MISSIONARY_1955": [r"(?<![a-z])ruth(?![a-z])", r"missionary.*1955"],
    "ARCHIVIST_1994": [r"(?<![a-z])daniel(?![a-z])", r"archivist.*1994"],
    "CARETAKER_2026": [r"(?<![a-z])ada(?![a-z])", r"caretaker.*2026"],
    "SURVIVOR": [r"(?<![a-z])mara(?![a-z])", r"survivor"],
    "ARCHIVE_KEEPER": [r"archive.*keeper", r"(?:closed.*archive.*custodian|custodian.*archive)"],
}
COMPOSITE_IDS = {
    "METHODIST", "PRESBYTERIAN", "BAPTIST", "TOWNSPERSON", "REFUGEE",
    "OFFICER", "DEPOSITOR", "CHILD", "MOURNER", "MOB_VOICE",
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
    meshes = data.get("meshes", [])
    skins = data.get("skins", [])
    rigged = any(
        isinstance(node.get("skin"), int) and 0 <= node["skin"] < len(skins)
        and skins[node["skin"]].get("joints")
        and any(
            {"POSITION", "JOINTS_0", "WEIGHTS_0"}.issubset(primitive.get("attributes", {}))
            and accessors[primitive["attributes"]["JOINTS_0"]]["count"] == accessors[primitive["attributes"]["POSITION"]]["count"]
            and accessors[primitive["attributes"]["WEIGHTS_0"]]["count"] == accessors[primitive["attributes"]["POSITION"]]["count"]
            for primitive in meshes[node["mesh"]].get("primitives", [])
        )
        for node in data.get("nodes", []) if "mesh" in node
    )
    return {
        "file": path.name, "url": "../../meshy/" + path.name,
        "bytes": path.stat().st_size, "triangles": triangles,
        "rigged": rigged,
        "animations": [animation.get("name", "Unnamed") for animation in data.get("animations", [])],
    }


def matches(identity, filename):
    raw_text = filename.lower()
    text = re.sub(r"([a-z])([A-Z])", r"\1_\2", filename).lower()
    if raw_text in CONFIRMED_CAST_FILES:
        return identity == CONFIRMED_CAST_FILES[raw_text]
    if identity in {"ORSON_YOUNG", "ORSON_ELDER"}:
        return matches("ORSON", filename) and orson_age(filename) == identity.removeprefix("ORSON_").lower()
    if identity in {"CHRIST_WHITE", "CHRIST_RED"}:
        return matches("CHRIST", filename) and christ_variant(filename) == identity.removeprefix("CHRIST_").lower()
    if identity == "CHRIST" and raw_text in VERIFIED_CHRIST_VARIANTS:
        return True
    if identity in COMPOSITE_IDS:
        return matches_composite(identity, text)
    if identity == "HYRUM" and "page" in text:
        return False
    if identity == "PETER" and "whitmer" in text:
        return False
    if identity == "JOHN" and any(name in text for name in ["whitmer", "taylor", "baptist", "johnson"]):
        return False
    if identity == "JAMES" and "taylor" in text:
        return False
    if identity == "ELIAS" and "vale" in text:
        return False
    if identity == "ELIJAH" and re.search(r"able|abel|ables", text):
        return False
    if identity == "JAMES" and re.search(r"jane|polk", text):
        return False
    if identity == "ELIZA" and "manning" in text:
        return False
    if identity == "WHITNEY" and "elizabeth" in text:
        return False
    if identity == "PETER_WHITMER" and re.search(r"(^|[^a-z])(jr|junior)([^a-z]|$)", text):
        return False
    if identity == "PETER_WHITMER_JR" and re.search(r"(^|[^a-z])(sr|senior)([^a-z]|$)", text):
        return False
    if identity == "JOSEPH_MATURE" and re.search(r"young|teen|child|boy|smith.*sr|smith.*father", text):
        return False
    if identity in {"JOSEPH_YOUTH", "JOSEPH_YOUNG"} and re.search(r"child|little|boy", text):
        return False
    if identity == "JOSEPH_YOUNG" and re.search(r"teen|adolescent|youth", text):
        return False
    return any(re.search(pattern, text) for pattern in PATTERNS.get(identity, []))


def matches_composite(identity, filename):
    text = re.sub(r"[^a-z0-9]+", "_", Path(filename).stem).strip("_")
    text = re.sub(r"^meshy_ai_", "", text)
    role = identity.lower()
    if text.startswith("composite_" + role + "_") or text == "composite_" + role:
        return True
    if text != role and not text.startswith(role + "_"):
        return False
    suffix = text[len(role):].strip("_")
    allowed = {"rigged", "rigg", "rig", "all", "animations", "animation", "model", "character", "remesh", "remeshed", "optimized", "optimize", "texture", "image", "to", "3d", "t", "pose", "tpose", "a", "minister", "voice", "composite"}
    return all(token in allowed or token.isdigit() or re.fullmatch(r"\d+k", token) for token in suffix.split("_") if token)


def christ_variant(filename):
    text = re.sub(r"([a-z])([A-Z])", r"\1_\2", filename).lower()
    for color in ["white", "red"]:
        if re.search(rf"(^|[^a-z]){color}([^a-z]|$)|{color}(robe|coat|cloak|garment)|(robe|coat|cloak|garment){color}", text):
            return color
    if filename.lower() in VERIFIED_CHRIST_VARIANTS:
        return VERIFIED_CHRIST_VARIANTS[filename.lower()]
    if filename.lower().startswith("meshy_ai_mormon_jesus_"):
        return "white"
    return None


def orson_age(filename):
    return "elder" if re.search(r"elderly|older|aged|senior", filename, re.IGNORECASE) else "young"


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
    if identity == "ORSON":
        return (asset["triangles"] > 150000, orson_age(asset["file"]) != "young", *preference(asset))
    if identity == "CHRIST":
        return (asset["triangles"] > 150000, christ_variant(asset["file"]) != "white", *preference(asset))
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
    content_path = ROOT / "game/content/chapters.json"
    if content_path.exists():
        record_cast = json.loads(content_path.read_text()).get("recordCast", [])
        names.update({person["id"]: person["name"] for person in record_cast})
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
        if identity in {"CHRIST_WHITE", "CHRIST_RED"}:
            characters[identity].update({"identity": "CHRIST", "variant": identity.removeprefix("CHRIST_").lower(), "profileType": "wardrobe"})
        elif identity in {"ORSON_YOUNG", "ORSON_ELDER"}:
            characters[identity].update({"identity": "ORSON", "variant": identity.removeprefix("ORSON_").lower(), "profileType": "age"})
        elif identity == "ORSON":
            characters[identity].update({"identity": "ORSON", "defaultVariant": orson_age(selected["file"]) if selected else None})
        elif identity == "CHRIST":
            characters[identity].update({"identity": "CHRIST", "defaultVariant": christ_variant(selected["file"]) if selected else None, "wardrobeProfiles": {"white": "CHRIST_WHITE", "red": "CHRIST_RED"}})
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
