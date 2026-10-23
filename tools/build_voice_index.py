from pathlib import Path
import csv
import json


ROOT = Path(__file__).resolve().parents[1]
FORMATS = {".wav": 0, ".mp3": 1, ".ogg": 2}
EDITABLE_FIELDS = ("recording_status", "take", "consent_reference", "notes")
FIELDS = (
    "line_id", "chapter_id", "chapter_title", "objective_id", "objective_label",
    "line_index", "speaker_id", "speaker_name", "spoken_text", "direction",
    "voice_brief", "relative_filename", "recording_status", "take",
    "consent_reference", "notes",
)


def build_voice_index(root=ROOT):
    content = json.loads((root / "game/content/chapters.json").read_text())
    cast = {person["id"]: person for person in json.loads((root / "docs/cast.json").read_text())}
    for person in content.get("recordCast", []):
        cast.setdefault(person["id"], person)
    audio = root / "game/audio"
    audio.mkdir(parents=True, exist_ok=True)
    takes = audio / "takes"
    takes.mkdir(exist_ok=True)
    plan_path = audio / "recording-plan.csv"
    previous = {}
    if plan_path.exists():
        with plan_path.open(newline="", encoding="utf-8-sig") as stream:
            previous = {row["line_id"]: row for row in csv.DictReader(stream)}
    rows = []
    for chapter in content["chapters"]:
        for objective in chapter["objectives"]:
            for index, line in enumerate(objective["lines"]):
                identity = line["speaker"]
                line_id = line["lineId"]
                row = {
                    "line_id": line_id,
                    "chapter_id": chapter["id"],
                    "chapter_title": chapter["title"],
                    "objective_id": objective["id"],
                    "objective_label": objective["label"],
                    "line_index": index,
                    "speaker_id": identity,
                    "speaker_name": content["names"].get(identity, identity),
                    "spoken_text": line["text"],
                    "direction": line.get("direction", ""),
                    "voice_brief": cast.get(identity, {}).get("voice", "A new role needs an approved voice brief before recording."),
                    "relative_filename": f"takes/{line_id}.wav",
                    "recording_status": "Draft script — review before recording",
                    "take": "",
                    "consent_reference": "",
                    "notes": "",
                }
                for field in EDITABLE_FIELDS:
                    if previous.get(line_id, {}).get(field):
                        row[field] = previous[line_id][field]
                rows.append(row)
    line_ids = {row["line_id"] for row in rows}
    assert len(line_ids) == len(rows), "Each runtime line must have a unique recording ID."
    with plan_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    manifest_path = audio / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    explicit = manifest.get("lines", {})
    if not isinstance(explicit, dict):
        raise ValueError("game/audio/manifest.json must contain a lines object.")
    found = {}
    candidates = sorted(
        (path for path in takes.rglob("*") if path.is_file() and path.suffix.lower() in FORMATS),
        key=lambda path: (FORMATS[path.suffix.lower()], str(path)),
    )
    for path in candidates:
        if path.stem in line_ids and path.stat().st_size > 0:
            found.setdefault(path.stem, path.relative_to(audio).as_posix())
    manifest.update({
        "description": "Local MOSSlanding recordings. Keys may be lineId, chapter:objective:zero-based-line, or SPEAKER_ID|exact line text. Paths are relative to game/audio/. Explicit entries are preserved by the indexer.",
        "lines": {**found, **explicit},
        "planned_line_count": len(rows),
        "discovered_take_count": len(found),
    })
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"Voice plan: {len(rows)} lines across {len({row['speaker_id'] for row in rows})} roles; {len(found)} local takes discovered; {len(explicit)} existing manifest entries preserved.")
    return {"planned": len(rows), "discovered": len(found), "preserved": len(explicit)}


if __name__ == "__main__":
    build_voice_index()
