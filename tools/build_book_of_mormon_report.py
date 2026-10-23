import csv
import html
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
plan = json.loads((DOCS / "book-of-mormon-expansion.json").read_text())
assets = json.loads((ROOT / "game/content/assets.json").read_text())
runtime = json.loads((ROOT / "game/content/chapters.json").read_text())
active_roles = {identity for chapter in runtime["chapters"] for identity in [chapter["playerId"], *(actor["id"] for actor in chapter["actors"])]}


def escape(value):
    return html.escape(str(value), quote=True)


def links(identities):
    return " · ".join(
        f'<a href="{escape(plan["sources"][identity]["url"])}">{escape(plan["sources"][identity]["title"])}</a>'
        for identity in identities
    )


gallery = "".join(
    f'<figure><a href="../{escape(board["file"])}"><img src="../{escape(board["file"])}" loading="lazy" width="1536" height="1024" alt="{escape(board["title"])}; panels {escape(", ".join(board["panels"]))}"></a>'
    f'<figcaption><strong>{escape(board["title"])}</strong> · {escape(", ".join(board["panels"]))} · Original concept art, not runtime screenshots or final-model proof.</figcaption></figure>'
    for board in plan["boards"]
)
cards = []
identities = set()
for scene in plan["scenes"]:
    assert scene["id"] not in identities
    identities.add(scene["id"])
    assert all(identity in plan["sources"] for identity in scene["sources"])
    panel = scene.get("panel")
    visual = ""
    if panel:
        board = next(board for board in plan["boards"] if panel in board["panels"])
        panel_index = board["panels"].index(panel)
        horizontal = panel_index % 2 * 100
        vertical = panel_index // 2 * 50
        visual = f'<a href="../{escape(board["file"])}" aria-label="Open concept board, panel {escape(panel)}"><div class="panel" role="img" aria-label="Concept {escape(panel)}: {escape(scene["title"])}" style="background-image:url(../{escape(board["file"])});background-position:{horizontal}% {vertical}%"></div></a>'
    layer = "speculative" if scene["id"].startswith("TX") else "record"
    search_text = json.dumps(scene, ensure_ascii=False).lower()
    beats = "".join(f'<li>{escape(beat)}</li>' for beat in scene["beats"])
    cards.append(
        f'<article class="scene" id="{escape(scene["id"])}" data-layer="{layer}" data-search="{escape(search_text)}">{visual}<div class="scene-copy">'
        f'<p class="eyebrow">{escape(scene["id"])} · Priority {escape(scene["priority"])} · {escape(scene["era"])}</p><h3>{escape(scene["title"])}</h3>'
        f'<p><strong>Playable viewpoint:</strong> {escape(scene["player"])}.</p><p>{escape(scene["premise"])}</p>'
        f'<details><summary>Space, play, essential actions and continuity</summary><h4>Environment</h4><p>{escape(scene["space"])}</p>'
        f'<h4>Gameplay family</h4><p>{escape(scene["gameplay"])}</p><ol>{beats}</ol><h4>Source and adaptation boundary</h4><p class="{"spec" if layer == "speculative" else "callout"}">{escape(scene["guardrail"])}</p>'
        f'<h4>Narrative payoff</h4><p>{escape(scene["payoff"])}</p><p class="small">Joseph/era library anchors: {escape(", ".join(scene["anchors"]))}. {"Concept panel " + escape(panel) + "." if panel else "No dedicated concept panel yet; written art direction only."}</p>'
        f'<p class="sources">{links(scene["sources"])}</p></details></div></article>'
    )

cast_rows = []
cast_cells = []
for person in plan["cast"]:
    profile = assets["characters"].get(person.get("assetKey", ""), {})
    asset = profile.get("asset")
    status = "Existing candidate; age, costume and performance review needed" if asset else "Dedicated game-ready export missing; check inventory before commissioning"
    if person["id"] == "MORONI_RECORD_KEEPER":
        status = "Existing angel candidate only; dedicated mortal and aged variants needed"
    scope = "Active prototype identity; selected rig or labeled stand-in" if person["id"] in active_roles else "Planned supporting role, not currently staged"
    cast_rows.append({"id": person["id"], "name": person["name"], "priority": person["priority"], "voice": person["voice"], "model_status": status, "existing_candidate": asset["file"] if asset else "", "scope": scope})
    cast_cells.append(f'<tr><td><strong>{escape(person["name"])}</strong><br><span class="cast-id">{escape(person["id"])}</span><br>Priority {escape(person["priority"])}</td><td>{escape(status)}{("<br><small>" + escape(asset["file"]) + "</small>") if asset else ""}</td><td>{escape(person["voice"])}</td></tr>')
cast_table = '<div class="table-scroll"><table><thead><tr><th>Role</th><th>Model planning status</th><th>Voice direction</th></tr></thead><tbody>' + "".join(cast_cells) + '</tbody></table></div>'
source_list = "".join(f'<li><a href="{escape(source["url"])}">{escape(source["title"])}</a></li>' for source in plan["sources"].values())
template = (DOCS / "book-of-mormon-report-template.html").read_text()
replacements = {"STATUS": escape(plan["status"]), "SCENE_COUNT": str(len(plan["scenes"])), "GALLERY": gallery, "SCENES": "".join(cards), "CAST": cast_table, "SOURCES": source_list}
for key, value in replacements.items():
    template = template.replace("{{" + key + "}}", value)
assert "{{" not in template
(DOCS / "book-of-mormon-scenes-report.html").write_text(template)
with (DOCS / "book-of-mormon-cast-plan.csv").open("w", newline="", encoding="utf-8") as output:
    writer = csv.DictWriter(output, fieldnames=list(cast_rows[0]))
    writer.writeheader()
    writer.writerows(cast_rows)
print(f'Built Book of Mormon report: {len(cards)} prototype scene briefs, {len(cast_rows)} cast/voice families, 18 concept panels; runtime {len(runtime["chapters"])} chapters.')
