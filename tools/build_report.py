from pathlib import Path
import csv
import html
import json
import re


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
campaign = json.loads((DOCS / "campaign.json").read_text())
cast = json.loads((DOCS / "cast.json").read_text())
dialogue = json.loads((DOCS / "dialogue.json").read_text())
sermon_passages = json.loads((DOCS / "sermon-passages.json").read_text())
sources = json.loads((DOCS / "sources.json").read_text())
cast_by_id = {person["id"]: person for person in cast}
modeling_plan = json.loads((DOCS / "modeling-plan.json").read_text())
meshy_audit = json.loads((DOCS / "meshy-audit.json").read_text())


def escaped(value):
    return html.escape(str(value), quote=True)


def source_links(source_ids):
    return " · ".join(
        f'<a href="{escaped(sources[source_id]["url"])}">{escaped(sources[source_id]["title"])}</a>'
        for source_id in source_ids
    )


boards = [
    ("chapters-01-08.png", "Origins and the sacred record", "Chapters 01 to 08"),
    ("chapters-09-16.png", "Authority gathering and revelation", "Chapters 09 to 16"),
    ("chapters-17-24.png", "Trials temple and a new home", "Chapters 17 to 24"),
    ("chapters-25-32.png", "Nauvoo consolation and celestial hope", "Chapters 25 to 32"),
    ("eras-and-portals.png", "The seven-era mission and its final threshold", "Expansion panels E1 to E8"),
]
gallery = '<div class="gallery">' + "".join(
    f'<figure><a href="art/{filename}"><img src="art/{filename}" loading="lazy" alt="{escaped(title)}; {escaped(label)}"></a>'
    f'<figcaption><strong>{escaped(title)}</strong><br>{escaped(label)} · Initial concept illustration</figcaption></figure>'
    for filename, title, label in boards
) + "</div>"

scene_cards = []
panel_ranges = [
    [(0, 318), (352, 697), (734, 1080), (1114, 1490)],
    [(0, 325), (358, 702), (735, 1081), (1115, 1454)],
    [(0, 348), (382, 729), (765, 1111), (1148, 1495)],
    [(0, 315), (356, 698), (740, 1081), (1122, 1491)],
]
for scene_index, scene in enumerate(campaign["scenes"]):
    board_index = scene_index // 8
    panel_index = scene_index % 8
    panel_x = (panel_index % 2) * 100
    panel_top, panel_bottom = panel_ranges[board_index][panel_index // 2]
    panel_height = panel_bottom - panel_top
    panel_y = panel_top * 100 / (1536 - panel_height)
    panel_scale = 1536 * 100 / panel_height
    speakers = ", ".join(cast_by_id[speaker]["name"] for speaker in scene["cast"])
    scene_cards.append(
        f'<article class="scene" id="scene-{scene["id"]}" data-search="{escaped((scene["title"] + " " + scene["place"] + " " + scene["history"]).lower())}">'
        f'<div class="scene-visual" role="img" aria-label="Concept for {escaped(scene["title"])}" '
        f'style="background-image:url(art/{boards[board_index][0]});background-position:{panel_x}% {panel_y:.4f}%;background-size:200% {panel_scale:.4f}%;aspect-ratio:512/{panel_height}"></div>'
        f'<div class="scene-copy"><p class="eyebrow">Chapter {scene["id"]} · {escaped(scene["date"])}</p>'
        f'<h3>{escaped(scene["title"])}</h3><p class="place">{escaped(scene["place"])}</p>'
        f'<p class="status">{escaped(scene["status"])}</p><p>{escaped(scene["history"])}</p>'
        f'<details class="scene-detail"><summary>Experience art and narrative purpose</summary>'
        f'<h4>What the player does</h4><p>{escaped(scene["experience"])}</p>'
        f'<h4>Concept and staging</h4><p>{escaped(scene["art"])}</p>'
        f'<h4>What carries forward</h4><p>{escaped(scene["payoff"])}</p>'
        f'<p><strong>Speaking roles:</strong> {escaped(speakers)}.</p>'
        f'<p class="small">Planning allowance: {scene["minutes"]} minutes. Concept board {board_index + 1}, panel {panel_index + 1}.</p>'
        f'<p class="sources">{source_links(scene["sources"])}</p></details></div></article>'
    )
scene_section = (
    '<section id="campaign"><p class="eyebrow">The core campaign</p><h2>Thirty-two chapters of a connected life</h2>'
    '<p>Chapters 01 through 30 concern Joseph’s earthly life and reported revelations. Chapters 31 and 32 are the explicitly imaginative continuation. '
    'Each chapter has a concept panel, a source-linked historical premise, player actions, staging, cast, and a narrative payoff. Dates within a long chapter receive separate transitions.</p>'
    '<div class="tools"><label>Find a chapter <input id="chapter-search" type="search" placeholder="Try Emma, Missouri, translation…"></label>'
    '<button id="expand-scenes" type="button" aria-pressed="false">Expand all chapter treatments</button><span id="chapter-count" aria-live="polite">32 chapters</span></div>'
    + "".join(scene_cards) + '</section>'
)

cast_cards = []
for person in cast:
    cast_cards.append(
        f'<article class="voice-card" id="voice-{person["id"]}"><p class="eyebrow">{escaped(person["scope"])} · Priority {person["priority"]}</p>'
        f'<h3>{escaped(person["name"])}</h3><p>{escaped(person["voice"])}</p>'
        f'<p><strong>Performance range:</strong> {escaped(person["states"])}.</p>'
        f'<blockquote>{escaped(person["audition"])}</blockquote>'
        f'<p class="small"><code>{person["id"]}</code> · Full-production allowance: approximately {person["estimate"]} lines.</p></article>'
    )
cast_section = (
    f'<section id="cast"><p class="eyebrow">Casting and voice description plan</p><h2>{len(cast)} role and voice-family specifications</h2>'
    '<p>These are interpretive casting briefs and starter audition scripts. Priority A means cast early, B means supporting identity, and C means a reusable extra family. '
    'Multiple people within an extra family require distinct preset suffixes; the family label is not permission to make every person sound identical. '
    'All audition lines are original dramatic writing except the explicitly identified short scriptural line for the Father. Divine-role samples are adaptation drafts, not newly claimed scripture.</p>'
    '<p><a class="download" href="docs/voice-cast.csv">Download the full casting and audition CSV</a></p>'
    '<div class="cast-grid">' + "".join(cast_cards) + '</div></section>'
)

script_parts = []
recording_rows = []
for scene_script in dialogue:
    scene_id = scene_script["scene"]
    if scene_id.startswith("E"):
        title = f'Expansion beat {scene_id}'
    else:
        title = next(scene["title"] for scene in campaign["scenes"] if scene["id"] == scene_id)
    lines = []
    scene_lines = scene_script["lines"]
    if scene_id == "28":
        scene_lines = scene_lines[:7] + sermon_passages + scene_lines[7:]
    for line_index, (speaker, spoken_text, direction) in enumerate(scene_lines, start=1):
        line_id = f'JS_{scene_id}_{speaker}_{line_index:03d}'
        lines.append(
            f'<div class="script-line"><p class="small"><code>{line_id}</code></p><p><strong>{escaped(cast_by_id[speaker]["name"])}</strong> '
            f'{escaped(spoken_text)}</p><p class="direction">{escaped(direction)}</p></div>'
        )
        provenance = "Original dramatic adaptation"
        if scene_id == "03" and speaker == "FATHER":
            provenance = "Scriptural quotation: Joseph Smith History 1:17"
        if scene_id == "23" and line_index == 1:
            provenance = "Scriptural quotation: Doctrine and Covenants 121:1"
        recording_rows.append({
            "line_id": line_id, "scene": scene_id, "speaker_id": speaker,
            "speaker_name": cast_by_id[speaker]["name"], "spoken_text": spoken_text,
            "direction": direction, "provenance": provenance,
            "reference_filename": "", "model_id": "", "take": "", "sample_rate": "",
            "duration_seconds": "", "approved_audio": "", "caption": spoken_text,
            "review_status": "Draft treatment line; not recording locked",
        })
    script_parts.append(f'<details class="script-scene" id="script-{scene_id}"><summary>{scene_id} · {escaped(title)}</summary>{"".join(lines)}</details>')
script_section = (
    '<section id="script"><p class="eyebrow">Working scene script</p><h2>Dialogue beats for every chapter and the expansion</h2>'
    '<p>This first-pass script establishes tone, speaker needs and performance direction across all chapters. It is a treatment and audition packet, '
    'not a complete production-length screenplay. Historical conversations are dramatized; future scenes are fictional. '
    'The King Follett passage is an adapted thematic outline, with its public address distinguished from before/after conversations. '
    'Final historical sermon excerpts, ordinance wording, song text, and complete interaction branches require source and recording lock before voice production.</p>'
    f'<p><a class="download" href="docs/recording-manifest.csv">Download {len(recording_rows)} scene lines and the recording manifest</a></p>'
    + "".join(script_parts) + '</section>'
)

source_items = "".join(
    f'<li id="source-{source_id}"><a href="{escaped(source["url"])}">{escaped(source["title"])}</a>'
    f'<p>{escaped(source["use"])}</p></li>' for source_id, source in sources.items()
)
source_section = (
    '<section id="sources"><p class="eyebrow">Research and local evidence</p><h2>Sources and the limits of reconstruction</h2>'
    '<p>Research date: October 22, 2026. Church publications establish the devotional frame; the Joseph Smith Papers provide documentary detail and the limits of specific accounts. '
    'Design proposals, dialogue, timings, engineering budgets, future history, and celestial scenery are creative decisions. '
    'The xChurch homepage was read directly after the search/open service could not retrieve it. Its claims are treated as speculative theology, not technical evidence.</p>'
    f'<ol class="source-list">{source_items}</ol>'
    '<h3>Local sources inspected</h3><ul>'
    '<li>Celandia current README, <code>docs/CELANDIA_ELSEWHERE_TIDE.html</code>, and <code>docs/elsewhere-tide/content/direction-contract.html</code>.</li>'
    '<li>Celandia <code>docs/STYLE_BIBLE.md</code>, <code>docs/CELANDIA_MASTER_PLAN.md</code>, original style reference grid, and current package manifest.</li>'
    '<li>Celandia renderer, palette, procedural rig, collision source, capture harness, and image-metric conversion implementation.</li>'
    '<li>MOSSlanding README, older handoff notes, and current macOS <code>mac/backend/server.py</code> request schema and synthesis/voice endpoints.</li>'
    '</ul><p>Concept art was generated with the built-in ImageGen tool and revised using Celandia’s existing reference sheet as style input. '
    'The complete prompts and selected local outputs are in <a href="docs/art-prompts.json">the art manifest</a>. '
    'The selected illustrations are preproduction proposals; the actual game has not been implemented or performance-tested in this task.</p></section>'
)

design = (DOCS / "design.html").read_text().replace("{{ART_GALLERY}}", gallery)
character_design = (DOCS / "character-design.html").read_text()
character_boards = [
    ("characters-joseph-ages.png", "Joseph across five age and costume states"),
    ("characters-family-witnesses.png", "Family and witnesses"),
    ("characters-community.png", "Church community and the Follett encounter"),
    ("characters-sacred-visitors.png", "Distinct sacred visitors"),
]
character_gallery = '<div class="gallery">' + "".join(
    f'<figure><a href="art/{filename}"><img loading="lazy" src="art/{filename}" alt="{escaped(title)}"></a><figcaption>{escaped(title)} · Proposed cel-shaded 3D designs</figcaption></figure>'
    for filename, title in character_boards
) + '</div>'
asset_patterns = {
    "JOSEPH_MATURE": ["josephsmith", "joseph_smith_full", "joseph_smith_remesh"],
    "JOSEPH_YOUTH": ["young_joseph"], "EMMA": ["emma_smith"], "OLIVER": ["oliver_cowdery"],
    "HYRUM": ["hyrum_smith"], "MORONI": ["moroni"], "BRIGHAM": ["brigham_young"],
    "LUCY": ["lucy_mack", "lucy_smith"], "JOSEPH_SR": ["joseph_smith_sr", "joseph_smith_senior"],
    "ALVIN": ["alvin_smith"], "MARTIN": ["martin_harris"], "DAVID": ["david_whitmer"],
    "SIDNEY": ["sidney_rigdon"], "LOUISA": ["louisa"], "JOHN_TAYLOR": ["john_taylor"],
    "WILLARD": ["willard_richards"], "ORSON": ["orson_pratt"], "ELIZA": ["eliza_r_snow", "eliza_snow"],
    "CHRIST": ["jesus", "christ_"], "FATHER": ["heavenly_father", "god_the_father"], "JOHN_BAPTIST": ["john_the_baptist", "john_baptist"],
}


def candidates_for(person_id):
    return [asset for asset in meshy_audit["assets"] if any(pattern in asset["file"].lower() for pattern in asset_patterns.get(person_id, []))]


def model_status(person_id):
    candidates = candidates_for(person_id)
    if not candidates:
        if person_id == "JOSEPH_YOUNG":
            return "Adapt the locked Joseph identity into an 1829 age/costume variant"
        if person_id in {"TOWNSPERSON", "REFUGEE", "OFFICER", "MOB_VOICE", "MOURNER", "DEPOSITOR", "METHODIST", "PRESBYTERIAN", "BAPTIST"}:
            return "Build from shared crowd body and wardrobe families with distinct heads"
        return "No matching local Meshy export in this snapshot"
    rigged_count = sum(bool(asset["skeletons"]) for asset in candidates)
    return f'{len(candidates)} candidate export(s); {rigged_count} rigged; review still required'


next_rows = "".join(
    f'<tr><td>{item["rank"]}. {escaped(cast_by_id[item["id"]]["name"])}</td><td>{escaped(item["reason"])}<br><small>{escaped(model_status(item["id"]))}</small></td><td>{escaped(item["brief"])}</td></tr>'
    for item in modeling_plan["next_models"]
)
next_models = '<div class="table-scroll"><table><thead><tr><th>Priority</th><th>Why this unlocks useful scenes</th><th>Modeling brief</th></tr></thead><tbody>' + next_rows + '</tbody></table></div>'
audit_rows = "".join(
    f'<tr><td><code>{escaped(Path(asset["file"]).name)}</code></td><td>{asset["triangles"]:,}</td><td>{len(asset["skeletons"]) and "/".join(str(len(skeleton)) for skeleton in asset["skeletons"]) or "None"}</td><td>{escaped(", ".join(animation["name"] for animation in asset["animations"]) or "None")}</td><td>{asset["bytes"] / 1e6:.1f} MB</td></tr>'
    for asset in meshy_audit["assets"]
)
meshy_status = (
    f'<p>Read-only metadata snapshot: <strong>{meshy_audit["asset_count"]} GLBs, {meshy_audit["total_bytes"] / 1e6:.1f} MB total</strong>. '
    'These are source-file sizes, not runtime memory measurements. Multiple files represent stages of one character. '
    '<a href="docs/meshy-audit.json">Full audit with textures, joints and materials</a>.</p>'
    '<div class="table-scroll"><table><thead><tr><th>Local export</th><th>Triangles</th><th>Body joints</th><th>Animation clips</th><th>File size</th></tr></thead><tbody>'
    + audit_rows + '</tbody></table></div>'
)
roster_rows = []
roster_exports = []
seen_roles = []
for group_name, person_ids in modeling_plan["groups"].items():
    group_members = []
    for person_id in person_ids:
        seen_roles.append(person_id)
        person = cast_by_id[person_id]
        group_members.append(f'<p><strong>{escaped(person["name"])}</strong><br><small>{escaped(model_status(person_id))}</small></p>')
        roster_exports.append({"role_id": person_id, "name": person["name"], "group": group_name, "story_scope": person["scope"], "model_status": model_status(person_id), "local_candidates": " | ".join(asset["file"] for asset in candidates_for(person_id))})
    roster_rows.append(f'<tr><td>{escaped(group_name)}</td><td>{"".join(group_members)}</td></tr>')
assert sorted(seen_roles) == sorted(cast_by_id), "Modeling roster must account for every voice profile exactly once"
model_roster = '<div class="table-scroll"><table><thead><tr><th>Cast group</th><th>Every planned speaking role and current asset status</th></tr></thead><tbody>' + "".join(roster_rows) + '</tbody></table></div>'
visual_roles = '<ul>' + "".join(f'<li><strong>{escaped(person["name"])}</strong> — {escaped(person["status"])}.</li>' for person in modeling_plan["additional_visual_roles"]) + '</ul>'
for visual_index, person in enumerate(modeling_plan["additional_visual_roles"], start=1):
    names = [person["name"]]
    if person["name"].startswith("Joseph Smith III Julia"):
        names = ["Joseph Smith III", "Julia Murdock Smith", "Frederick G. W. Smith", "Alexander H. Smith"]
    for name_index, name in enumerate(names, start=1):
        existing = []
        if name == "Nephi":
            existing = [asset for asset in meshy_audit["assets"] if "nephi" in asset["file"].lower()]
        roster_exports.append({"role_id": f"VISUAL_{visual_index:02d}_{name_index}", "name": name, "group": "Additional visible or optional role", "story_scope": person["status"], "model_status": f"{len(existing)} candidate export(s); review required" if existing else "Use an individual head on a suitable shared rig; scope as specified", "local_candidates": " | ".join(asset["file"] for asset in existing)})
for token, replacement in {"CHARACTER_GALLERY": character_gallery, "NEXT_MODELS": next_models, "MESHY_STATUS": meshy_status, "MODEL_ROSTER": model_roster, "VISUAL_ROLES": visual_roles, "MODELING_PROMPT": escaped(modeling_plan["modeling_prompt"])}.items():
    character_design = character_design.replace('{{' + token + '}}', replacement)
design += character_design
design = design.replace("{{HOURS}}", f'{sum(scene["minutes"] for scene in campaign["scenes"]) / 60:.1f}')
sections = {match.group(1): match.group(0) for match in re.finditer(r'<section id="([^"]+)">.*?</section>', design, re.S)}
sections.update(campaign=scene_section, cast=cast_section, script=script_section, sources=source_section)
order = ["vision", "history-policy", "art-direction", "character-design", "campaign", "gameplay", "reuse", "cast", "voice-production", "script", "expansion", "engineering", "agents", "roadmap", "sources"]
navigation = [
    ("vision", "Vision"), ("campaign", "Chapters"), ("art-direction", "Art"), ("character-design", "Models"), ("gameplay", "Gameplay"),
    ("cast", "Cast"), ("voice-production", "Voices"), ("script", "Script"), ("expansion", "Time and Zion"),
    ("engineering", "Engineering"), ("agents", "Agents"), ("sources", "Sources"),
]
nav_html = "".join(f'<a href="#{section_id}">{label}</a>' for section_id, label in navigation)
template = (DOCS / "template.html").read_text()
output = template.replace("{{NAV}}", nav_html).replace("{{CONTENT}}", "\n".join(sections[section_id] for section_id in order))
(ROOT / "index.html").write_text(output)

with (DOCS / "voice-cast.csv").open("w", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(cast[0]))
    writer.writeheader()
    writer.writerows(cast)
with (DOCS / "recording-manifest.csv").open("w", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(recording_rows[0]))
    writer.writeheader()
    writer.writerows(recording_rows)
with (DOCS / "modeling-roster.csv").open("w", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(roster_exports[0]))
    writer.writeheader()
    writer.writerows(roster_exports)

print(json.dumps({"chapters": len(campaign["scenes"]), "role_specs": len(cast), "script_lines": len(recording_rows), "sources": len(sources), "html_bytes": len(output.encode()), "output": str(ROOT / "index.html")}, indent=2))
