from pathlib import Path
import io
import json
import struct
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def inspect_glb(path):
    with path.open("rb") as handle:
        magic, version, total_length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2:
            raise ValueError(f"Unsupported GLB: {path.name}")
        json_length, json_kind = struct.unpack("<II", handle.read(8))
        if json_kind != 0x4E4F534A:
            raise ValueError(f"Missing GLB JSON: {path.name}")
        document = json.loads(handle.read(json_length))
        binary_header = handle.read(8)
        binary_payload = handle.read() if binary_header else b""
    accessors = document.get("accessors", [])
    triangle_count = 0
    morph_count = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh["primitives"]:
            if primitive.get("mode", 4) == 4:
                accessor_id = primitive.get("indices", primitive["attributes"]["POSITION"])
                triangle_count += accessors[accessor_id]["count"] // 3
            morph_count += len(primitive.get("targets", []))
    texture_sizes = []
    for image in document.get("images", []):
        view_id = image.get("bufferView")
        if view_id is None:
            texture_sizes.append({"uri": image.get("uri"), "embedded": False})
            continue
        view = document["bufferViews"][view_id]
        offset = view.get("byteOffset", 0)
        payload = binary_payload[offset:offset + view["byteLength"]]
        try:
            with Image.open(io.BytesIO(payload)) as embedded_image:
                texture_sizes.append({"width": embedded_image.width, "height": embedded_image.height, "embedded": True})
        except Exception:
            texture_sizes.append({"mime_type": image.get("mimeType"), "embedded": True})
    skeletons = [
        [document["nodes"][joint_id].get("name", str(joint_id)) for joint_id in skin["joints"]]
        for skin in document.get("skins", [])
    ]
    animations = []
    for animation in document.get("animations", []):
        durations = [accessors[sampler["input"]].get("max", [0])[0] for sampler in animation.get("samplers", [])]
        animations.append({"name": animation.get("name", "Unnamed"), "channels": len(animation.get("channels", [])), "duration_seconds": max(durations, default=0)})
    return {
        "file": str(path.relative_to(ROOT)), "bytes": path.stat().st_size,
        "triangles": triangle_count, "mesh_count": len(document.get("meshes", [])),
        "primitive_count": sum(len(mesh["primitives"]) for mesh in document.get("meshes", [])),
        "material_count": len(document.get("materials", [])), "image_count": len(document.get("images", [])),
        "texture_sizes": texture_sizes, "skeletons": skeletons, "animations": animations,
        "morph_target_count": morph_count,
        "has_finger_joints": any("finger" in joint.lower() or "thumb" in joint.lower() for skeleton in skeletons for joint in skeleton),
        "materials": document.get("materials", []), "glb_declared_bytes": total_length,
    }


assets = [inspect_glb(path) for path in sorted((ROOT / "meshy").glob("*.glb"))]
report = {"date": "2026-10-22", "method": "Read-only GLB metadata and embedded image header inspection; no source models changed", "asset_count": len(assets), "total_bytes": sum(asset["bytes"] for asset in assets), "assets": assets}
(ROOT / "docs" / "meshy-audit.json").write_text(json.dumps(report, indent=2))
print(json.dumps({"assets": len(assets), "megabytes": round(report["total_bytes"] / 1e6, 1), "rigged": sum(bool(asset["skeletons"]) for asset in assets), "morph_targets": sum(asset["morph_target_count"] for asset in assets)}, indent=2))
