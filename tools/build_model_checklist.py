import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    manifest = json.loads((ROOT / "game/content/assets.json").read_text())
    campaign = json.loads((ROOT / "game/content/chapters.json").read_text())
    plan = json.loads((ROOT / "game/content/record-cast-plan.json").read_text())
    planned = {role["id"]: role for group in plan["groups"] for role in group["roles"]}
    for identity, role in planned.items():
        if identity in campaign["names"] and campaign["names"][identity] != role["name"]:
            raise SystemExit(f"record-cast-plan.json id {identity} is already used for {campaign['names'][identity]!r}")
    appearances = {}
    for chapter in campaign["chapters"]:
        for identity in {chapter["playerId"], *(actor["id"] for actor in chapter["actors"])}:
            appearances.setdefault(identity, []).append(chapter["id"])
    witnesses = {"CHRISTIAN_WHITMER", "JACOB_WHITMER", "PETER_WHITMER_JR", "JOHN_WHITMER", "HIRAM_PAGE", "JOSEPH_SR", "HYRUM", "SAMUEL_SMITH"}
    leads = {"CHRIST", "ALVIN", "PETER", "JAMES", "JOHN", "MOSES", "ELIAS", "ELIJAH", "JOHN_TAYLOR", "WILLARD", "LOUISA", "ELIZA", "ORSON", "WHITNEY"}
    composites = {"METHODIST", "PRESBYTERIAN", "BAPTIST", "REFUGEE", "OFFICER", "DEPOSITOR", "CHILD", "MOURNER"}
    rows = []
    for identity, chapters in appearances.items():
        profile = manifest["characters"].get(identity, {})
        asset = profile.get("asset")
        candidate = asset or next(iter(profile.get("variants", [])), None)
        source_only = bool(candidate and not asset)
        priority = "1 - Eight Witnesses" if identity in witnesses else "2 - Main historical cast" if identity in leads else "4 - Speculative expansion" if all(chapter.startswith("E") for chapter in chapters) else "3 - Supporting cast"
        rows.append({
            "priority": priority,
            "character_id": identity,
            "name": campaign["names"].get(identity, identity),
            "status": "Ready: model and rig" if asset and asset["rigged"] else "Model found: rig needed" if asset else "Source found: optimized rigged export needed" if source_only else "Stand-in: dedicated game export missing",
            "current_file": candidate["file"] if candidate else "",
            "chapter_ids": "; ".join(chapters),
            "triangles": candidate["triangles"] if candidate else "",
            "look": planned.get(identity, {}).get("look", ""),
            "props": planned.get(identity, {}).get("props", ""),
            "notes": "Remesh and rig the existing source; a dense original is not selected for gameplay" if source_only else "Generic modular civilian rig may be reused with distinct clothing/face" if identity in composites else "A missing export may already exist in Meshy; export before remaking" if not asset else profile.get("warning", ""),
        })
    for identity, role in planned.items():
        if identity in appearances:
            continue
        rows.append({
            "priority": f"5 - Planned record cast ({role['priority']})",
            "character_id": identity,
            "name": role["name"],
            "status": "Planned: not yet in a chapter",
            "current_file": "",
            "chapter_ids": role["missions"],
            "triangles": "",
            "look": role["look"],
            "props": role["props"],
            "notes": "From game/content/record-cast-plan.json; R1-R8 are proposed missions",
        })
    rows.sort(key=lambda row: (row["status"].startswith("Ready"), row["priority"], row["name"]))
    destination = ROOT / "game/content/model-checklist.csv"
    with destination.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    pending_rows = [row for row in rows if not row["status"].startswith("Ready")]
    with (ROOT / "game/content/missing-models.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(pending_rows)
    missing = sum(row["status"].startswith("Stand-in") for row in rows)
    pending = len(pending_rows)
    planned_only = sum(row["status"].startswith("Planned") for row in rows)
    print(f"Model checklist: {len(rows) - planned_only} active cast identities and {planned_only} planned record roles; {pending} roles need a game-ready rig, including {missing} without a local source.")


if __name__ == "__main__":
    main()
