import csv
import hashlib
import html
import json
import struct
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DATA = json.loads((ROOT / "game/content/chapters.json").read_text())
LIGHTING = json.loads((ROOT / "game/content/lighting-presets.json").read_text())
ASSETS = json.loads((ROOT / "game/content/assets.json").read_text())
CAST = {person["id"]: person for person in json.loads((DOCS / "cast.json").read_text())}
CAST.update({person["id"]: person for person in DATA.get("recordCast", [])})
with (ROOT / "game/audio/recording-plan.csv").open(newline="", encoding="utf-8") as stream:
    LINES = list(csv.DictReader(stream))
ALIASES = {"JOSEPH_YOUNG": "JOSEPH_ADULT", "JOSEPH_MATURE": "JOSEPH_ADULT", "MORONI_RECORD_KEEPER": "MORONI"}
FIRST = {"JOSEPH_CHILD", "JOSEPH_YOUTH", "JOSEPH_ADULT", "EMMA", "OLIVER", "HYRUM", "LUCY", "JOSEPH_SR", "FATHER", "CHRIST", "MORONI", "NEPHI", "SARIAH", "LEHI_PATRIARCH", "BROTHER_JARED", "ALMA_YOUNGER", "ALMA_ELDER", "MORMON", "ELIJAH_ABLE", "WALKER_LEWIS", "JANE_MANNING", "LOUISA", "ORSON"}
POOLS = {"TOWNSPERSON", "OFFICER", "REFUGEE", "CHILD", "MOURNER", "BOM_HOUSEHOLDS", "BOM_CIVIC_AND_MILITARY"}
PROFILE_NAMES = {"JOSEPH_ADULT": "Joseph Smith — adult", "MORONI": "Moroni — mortal and later angel"}
EDITABLE = ("setup_status", "reference_filename", "consent_reference", "notes")

RECORD_LOOKS = {
    "BM01": ("Jerusalem departure", "warm domestic safety → dry exposed road", "household, stores, roof terrace, inhabited street", "prepare water; pack; lead household", "none", "none"),
    "BM02": ("Dream valley", "uncertain blue-grey mist → welcoming ivory fruit", "continuous rail, branch silhouettes, river bank, near/far paths", "guide; follow rail; call family; receive fruit", "none", "sensory navigation; never a faith score"),
    "BM03": ("Jerusalem treasury", "cold moonlit lanes; restrained warm doorway spill", "treasury vault, courtyard doors, patrol cover, escape gate", "patrol; watch; listen; carry record; accompany Zoram", "scripted non-graphic Laban account only", "full observation, patrol, suspicion and escape"),
    "BM04": ("Arabian Bountiful", "salt-haze dawn → workday amber", "cove, camp kitchen, forge, timber and completed vessel", "saw; carry; lash; forge; share water", "none", "none"),
    "BM05": ("Ocean storm", "green-black storm → quiet silver horizon", "hold, deck, rigging, spray shelter, secured cargo", "bound witness; Sariah support; brace; reassure; release", "none", "none; crisis routes and passenger care"),
    "BM06": ("Jaredite summit and shore", "cold worklight → intimate touched-stone radiance", "eight wooden vessels, sixteen stones, ascent, kneeling clearing", "prepare stones; carry; kneel; place paired lights", "none", "none"),
    "BM07": ("Enclosed Jaredite vessel", "two warm stone lights; storm sound beyond dark timber", "airtight-looking ribs, provision racks, animals, controlled hatch", "brace; secure cargo; comfort; attend hatch; landfall", "none", "none; enclosed-vessel survival"),
    "BM08": ("Enos forest", "long contemplative shade → gentle dawn", "deep woodland, clear paths, prayer refuge, writing surface", "walk slowly; remember; kneel; write", "none", "none"),
    "BM09": ("Benjamin gathering", "generous morning; distant tents readable without glare", "accessible tent lanes, teaching stand, water stations", "listen; carry words; pass water; make room", "none", "none"),
    "BM10": ("Abinadi court and refuge", "hard institutional shafts → small protected writing light", "court, custody route, refuge with exterior access", "testify; object; listen; withdraw; write", "no player punishment/torture mechanics", "withdrawal and record preservation"),
    "BM11": ("Waters of Mormon", "leaf-filtered green; readable shallow blue water", "spring, bank approaches, reeds, teaching clearing, food shelter", "support companion; listen; covenant staging; share work", "none", "none"),
    "BM12": ("Alma conversion", "fractured dark memory → warm familial relief", "road, lived-in home, explicitly symbolic inner space", "warn; fall; remember; reach; reunite; make restitution", "none", "none"),
    "BM13": ("Abish household", "courtyard noon; kindness visible in shaded thresholds", "connected household rooms and inhabited neighboring lanes", "invite; question; listen; de-escalate; help queen rise", "none", "social navigation, not coercive persuasion"),
    "BM14": ("Covenant of peace", "soft earth colours → sober grief, never victory red", "weapon burial place, homes, refuge and memorial field", "lay weapons down; protect space; comfort; mourn", "no player attacks; nonviolent witness", "care and evacuation only"),
    "BM15": ("Ammonihah and Noah", "hard earthwork daylight → smoky defensive urgency → care", "two separate sites, ditch crossings, gate, relief shelter", "dig; carry; signal; hold formation; tend wounded", "defensive melee/ranged and command at Noah", "scouting and guarded approaches"),
    "BM16": ("Alma and Amulek prison", "oppressive low light → dusty rupture → sober open air", "connected town, court, cell, controlled collapsed exit", "remain; pray; brace; support companion; emerge", "no guard-crushing reward", "escape navigation after scripted rupture"),
    "BM17": ("Sons of Helaman prison", "darkness and voices → harmless fire → communal light", "distinct cell/crowd layout, sightlines, exit into town", "listen; guide; repent; stand together; depart", "none; fire cannot be weaponized", "sound-led wayfinding"),
    "BM18": ("Teancum's two nights", "restrained blue night; local campfire pools", "two dated camps, actual entrances, sentries, stores, tents", "observe; crouch; conceal; strike in scripted beat; withdraw", "bounded story encounters; later death retained", "full patrol/suspicion/infiltration; distinct later coda"),
    "BM19": ("Helaman march", "dusty morning → strained evening → protective hearth", "marching corridor, formation points, camp, medical shelter", "march; signal; cover companions; carry wounded", "formation support and limited field combat", "scouting; no disposable youth units"),
    "BM20": ("Samuel on the wall", "exposed pale wall against a broad atmospheric sky", "walkable stairs, wall top, inhabited town, departure route", "climb; turn; speak; listeners react; retreat", "no retaliatory player attack", "warning/escape rather than assassination"),
    "BM21": ("Risen Christ at Bountiful", "expectant silence → warm human-scale holy light", "American temple court, entries, steps, shade, crowd sightlines", "look up; turn; approach one by one; listen", "none; encounter lock", "none"),
    "BM22": ("Healing and children", "tender low contrast; faces and small hands retain detail", "same coherent court, family groups, resting space, approaches", "escort; kneel; reach; embrace; give people space", "none; encounter lock", "none"),
    "BM23": ("Fourth Nephi society", "balanced civic daylight → gradual division, not instant evil filter", "workshops, gardens, shared tables, water and gathering space", "work; share; teach; disagree; withdraw; reflect", "none in peace chapter", "civic observation"),
    "BM24": ("Cumorah", "ashen daylight, broken banners, smoke depth, grief", "battle approaches, contested passage, relief points, record refuge", "fight to protect passage; rally; carry wounded; entrust record", "full bounded battle; rescue and survival, not victory", "flanking, withdrawal and record escape"),
    "BM25": ("Moroni and shared hill", "cold chosen winter → small warm record light → silence", "same Joseph hill landmarks, writing refuge, stone box", "travel tired; write; carry plates; kneel; bury; pray", "no compulsory combat in final prayer", "optional distant pursuit; quiet approach"),
    "TX01": ("Temporal headland", "Eden abundance / bleached nuclear desert / luminous civic Zion", "same topography and landmarks; spatially coherent bubbles", "guide travelers; gather; repair; choose portal", "off by default; rescue mission", "optional invented custodial patrols, labeled fiction"),
    "TX02": ("Future rescue workshop", "workshop practicals → clear celestial docking light", "functional craft cabin, dock, gardens, passenger route", "repair; brief; board; sit; reassure; fly a bounded route", "rescue-first; no imported fantasy spells", "optional rescue approach only"),
    "TX03": ("Invented temporal sea route", "readable atlas → Gulf-like passage → imagined Levant landfall", "atlas plus later playable coast segments, clearly fictional", "plan; navigate; land; assist travelers", "off by default", "optional fictional encounters; not scriptural geography"),
}

OVERRIDES = {
    "03": ("Sacred Grove", "uncertainty → clear pillar → intimate reassurance", "no attacks; sacred encounter", "none", "hero"),
    "04": ("Smith home at night", "candle-dark family home → restrained angelic radiance", "none", "none", "hero"),
    "08": ("Translation household", "workday window light → lamplight concentration", "none", "none", "hero"),
    "15": ("Hiram household and aftermath", "night threat, restrained violence → painful morning care", "scripted assault; no revenge arena", "escape/care routes", "hero"),
    "20": ("Kirtland fellowship and temple", "grounded fellowship → distinct solemn manifestations", "none", "none", "hero"),
    "22": ("Missouri crisis", "exposed country, dust, smoke, fear and displacement", "protection/escape; episode-specific rules", "evacuation and search", "hero"),
    "26": ("Nauvoo households and fellowship", "civic workday → personal warmth and belonging", "none", "none", "hero"),
    "27": ("1844 campaign", "busy civic daylight, ink and paper, serious argument", "none", "none", "hero"),
    "28": ("King Follett and election aftermath", "gathered spring light; grief → consolation → public resolve", "none", "none", "hero"),
    "29": ("Nauvoo crisis and road to Carthage", "tightening civic space; disturbed crowds and uncertain horizon", "historically bounded crowd threat", "safe routes and protection", "hero"),
    "30": ("Carthage Jail", "hot bleached afternoon → alarm, powder smoke and grief", "bounded historical defense; canonical outcome, not survival arena", "none; constrained siege/witness", "hero"),
    "N1": ("Manhattan 1832", "dense metropolitan street light and towering civic scale", "none", "none", "hero"),
    "B1": ("Walker Lewis's Lowell", "attentive workshop light, active city outside", "none", "none", "hero"),
    "E8": ("Future Zion", "white civic architecture, living gardens, warm human detail", "none", "none", "hero"),
}

CAMPAIGN_KITS = {
    "01": "Vermont/New Hampshire family home: hearth, beds, work corner, yard and road",
    "02": "Palmyra streets, gathering places, shop thresholds and contrasting worship interiors",
    "03": "Manchester woodland: working-farm approach, deep tree layers, private clearing",
    "04": "Smith log home: sleeping loft/bedroom, stair/ladder access, hearth and sleeping household",
    "05": "Shared discovery hill: fixed tree, boulders, path fork and stone-box landmarks",
    "06": "Hale household/courtship and a separately staged return to the discovery hill",
    "07": "Harmony household: writing/work space, covered record storage, family care and exterior",
    "08": "Harmony translation room and household; distinct later Fayette transition",
    "09": "Susquehanna bank: approaches, shallows, dry changing/rest space and woodland",
    "10": "Separate Three/Eight Witness settings; handled record, family farm and printing premises",
    "11": "Fayette/early congregation: family house, gathering space, roads and baptism approaches",
    "12": "Kirtland arrival: Whitney shop, household support, settlement roads and shelter",
    "13": "Missouri Zion planning: surveyed-looking interpretive plat, shared stores and homes",
    "14": "John Johnson home/study: ordinary domestic room before a distinct vision treatment",
    "15": "Hiram household: coherent bedroom, entry/yard, nighttime threat and morning care",
    "16": "Kirtland learning/work: study room, common stores, workyard and inhabited streets",
    "17": "Kirtland correspondence room and distinct Missouri displacement/care tableau",
    "18": "Zion's Camp: road, wagon camp, water stops, hardship and non-triumphal return",
    "19": "Kirtland missionary preparation: school, packing/work benches and departure road",
    "20": "Kirtland temple and fellowship: carpentry/work context, real hall and sacred transitions",
    "21": "Kirtland loss: financial counter, depositor conversation, private and community care",
    "22": "Far West/Missouri: town edge, defensive approaches, wagons, shelter and surrender route",
    "23": "Liberty Jail: accurate separate confinement levels, winter exterior and letter writing",
    "24": "Early Nauvoo: river landing, work crews, drainage/construction, homes and developing grid",
    "25": "Nauvoo Lodge: period civic/lodge interiors and exterior streets; respectful ritual boundaries",
    "26": "Nauvoo fellowship: Relief Society gathering and separately dated household hospitality",
    "27": "Nauvoo campaign: printer, desk, civic meeting, street distribution and policy conversations",
    "28": "King Follett memorial: stand, scribes, shaded congregation, Louisa/family and later civic scenes",
    "29": "Nauvoo crisis: council, situated Expositor premises, crowded streets and road to Carthage",
    "30": "Carthage town, jail courtyard, inhabited lower floor, cells, stairs and upper bedroom",
    "31": "Imaginative beyond-the-veil reunion: quiet personal arrival before cosmic scale",
    "32": "Imaginative stewardship world: hands-on care, gardens and wider creation vistas",
    "N1": "Manhattan 1832: dense period streets, shops, gathering and lodging; no modern skyline",
    "B1": "Lowell: Walker Lewis's barber/work room opening to an active New England street",
    "E1": "Mythic garden: shared landscape anchors, spring, family/guide paths and threshold",
    "E2": "Nineteenth-century temporal mission: distinct Ohio/Utah archive staging by date",
    "E3": "1955 neighborhood: doorsteps, period transport, household rooms and missionary route",
    "E4": "1994 family archive: paper, early computer, storage shelves and lived-in family exterior",
    "E5": "Present-day shared water: garden infrastructure, repair route and welcoming neighborhood",
    "E6": "Post-fire speculative desert: failed infrastructure, relief shelter, seed and survivor route",
    "E7": "Closed speculative archive: intake, guarded records, service passages and shared-reading exit",
    "E8": "Future Zion: temple/civic halls, arcades, gardens, workshops, homes, water and portals",
}

BACKLOG = [
    ("P1", "MOB_LEAD", "Mob leader — fictional composite", "Menacing command and crowd calls; historically situated, never a modern ethnic caricature.", "New rioting choreography; no locked lines yet"),
    ("P1", "MOB_GUNMAN_A", "Mob gunman A", "Adult male, breath and urgent reload/attack calls; recorded separately from weapon effects.", "New combat barks; not assigned to a Whitmer"),
    ("P1", "MOB_GUNMAN_B", "Mob gunman B", "A contrasting age/timbre and cadence; no copied Joseph/Whitmer identity.", "New combat barks"),
    ("P1", "MOB_TORCH_A", "Night-assault/imagined torch carrier", "Rough exertion, alarm and crowd response; only in a source-appropriate or labeled imagined scene.", "New nighttime/stylized barks"),
    ("P1", "CIVILIAN_WOMAN_A", "Civilian woman A", "Adult conversational, practical work, concern and relief.", "Split mixed household/townspeople pool before final recording"),
    ("P1", "CIVILIAN_WOMAN_B", "Civilian woman B", "Older distinct warmth, reserved public conversation.", "Split mixed pool"),
    ("P1", "CIVILIAN_MAN_A", "Civilian man A", "Young adult, grounded work and street conversation.", "Split mixed pool"),
    ("P1", "CIVILIAN_MAN_B", "Civilian man B", "Older adult, measured civic presence.", "Split mixed pool"),
    ("P1", "CIVILIAN_CHILD_A", "Civilian child voice", "Authorized child performance or consenting adult portrayal; no casual reuse of children's samples.", "Split household/child pool by named scene"),
    ("P2", "GUARD_ANCIENT_A", "Ancient guard A", "Alert observation, suspicion, challenge, search and alarm.", "New stealth bark states; adapted dialogue"),
    ("P2", "GUARD_ANCIENT_B", "Ancient guard B", "Distinct restrained authority, questioning and de-escalation.", "New stealth bark states"),
    ("P2", "NEPHITE_DEFENDER_A", "Nephite defender A", "Formation signals, exertion, warnings, care and retreat.", "New battle bark states"),
    ("P2", "LAMANITE_SOLDIER_A", "Lamanite soldier A", "Fully human military urgency; no monster/ethnic shorthand.", "New battle bark states"),
    ("P2", "MEDIC_CARER_A", "Battlefield carer", "Clear supportive directions, grief and relief.", "New rescue scenes"),
    ("P2", "LEMUEL", "Lemuel", "Distinct from Laman; disagreement, fear, hesitation and reconciliation.", "Visible rig/staging exists; no current spoken line"),
    ("P2", "SAM", "Sam", "Steady family warmth, thoughtful conviction.", "No current spoken line"),
    ("P2", "LABAN", "Laban", "Human institutional authority, not an ethnic caricature.", "Only if expanded speaking script is approved"),
    ("P2", "LAMONI", "Lamoni", "Dignified political presence with vulnerability.", "No current spoken line"),
    ("P2", "CHRISTIAN_WHITMER", "Christian Whitmer", "Distinct adult voice; approved testimony text and context first.", "Optional individual Eight Witness testimony"),
    ("P2", "JACOB_WHITMER", "Jacob Whitmer", "Distinct adult voice; not the visual borrowed for a mob role.", "Optional individual Eight Witness testimony"),
    ("P2", "PETER_WHITMER_JR", "Peter Whitmer Jr.", "Young adult; distinct from Peter Sr. and apostle Peter.", "Optional individual Eight Witness testimony"),
    ("P2", "JOHN_WHITMER", "John Whitmer", "Distinct from apostle John, John Taylor and John the Baptist.", "Optional individual Eight Witness testimony"),
    ("P2", "HIRAM_PAGE", "Hiram Page", "Distinct from Hyrum Smith; restrained testimony.", "Optional individual Eight Witness testimony"),
    ("P2", "SAMUEL_SMITH", "Samuel H. Smith", "Young adult family voice, distinct from Samuel the Lamanite.", "Optional individual Eight Witness testimony"),
    ("P3", "POLK", "James K. Polk", "Political confidence; do not invent direct meetings with Joseph.", "Only if a sourced campaign/archive speaking scene is approved"),
    ("P3", "LINCOLN", "Abraham Lincoln", "Reflective public/private registers; fictional influence dialogue must be labeled interpretation.", "Only if a sourced or openly interpretive later scene is approved"),
]


def escaped(value):
    return html.escape(str(value), quote=True)


def write_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def voice_rows():
    prior_path = DOCS / "voice-preparation.csv"
    prior = {}
    if prior_path.exists():
        with prior_path.open(newline="", encoding="utf-8") as stream:
            prior = {row["speaker_id"]: row for row in csv.DictReader(stream)}
    by_speaker = defaultdict(list)
    for line in LINES:
        by_speaker[line["speaker_id"]].append(line)
    rows = []
    for identity, lines in by_speaker.items():
        profile = ALIASES.get(identity, identity)
        person = CAST.get(identity, {})
        voice = person.get("voice", lines[0].get("voice_brief", "Voice brief review needed"))
        sharing = "One adult Joseph identity; public, intimate, exhausted and later-maturity performance references. Child/youth profiles remain distinct."
        if profile == "MORONI":
            sharing = "Same person as mortal record keeper and angel; separate age/energy references. Never merge Captain Moroni."
        elif profile != "JOSEPH_ADULT":
            sharing = "Pool: split into named line-level performers before final recording." if identity in POOLS else "Dedicated character identity; a borrowed visual does not authorize sharing its voice."
        row = {
            "priority": "P0" if profile in FIRST else "P1",
            "speaker_id": identity, "speaker_name": lines[0]["speaker_name"], "base_voice_id": profile,
            "current_line_count": len(lines), "chapters": " ".join(dict.fromkeys(line["chapter_id"] for line in lines)),
            "voice_description": voice, "performance_states": person.get("states", "neutral; tenderness; public projection; urgency; fatigue as appropriate"),
            "audition_text": person.get("audition", lines[0]["spoken_text"]), "sharing_rule": sharing,
            "suggested_reference_file": f"JSV_{profile}_neutral_v1.wav",
            "setup_status": "Not audited in MOSSlanding; prepare/approve reference identity",
            "reference_filename": "", "consent_reference": "", "notes": "",
        }
        for key in EDITABLE:
            if prior.get(identity, {}).get(key):
                row[key] = prior[identity][key]
        rows.append(row)
    return sorted(rows, key=lambda row: (row["priority"], row["base_voice_id"], row["speaker_id"]))


def scene_rows():
    presets = {preset["chapterId"]: preset for preset in LIGHTING["presets"] if preset["kind"] == "chapter" and not preset.get("stylized")}
    rows = []
    for chapter in DATA["chapters"]:
        identity = chapter["id"]
        preset = presets.get(identity)
        if identity in RECORD_LOOKS:
            kit, arc, detail, behavior, combat, stealth = RECORD_LOOKS[identity]
            priority = "hero" if identity in {"BM02", "BM03", "BM06", "BM21", "BM24", "BM25", "TX01"} else "rollout"
        else:
            kit, arc, combat, stealth, priority = OVERRIDES.get(identity, (chapter["environment"], "; ".join(preset.get("tags", [])[:4]) if preset else "author a scene-specific emotional progression", "none unless explicitly source-locked", "none unless authored", "rollout"))
            kit = CAMPAIGN_KITS.get(identity, kit)
            detail = chapter.get("locationDescription", chapter.get("place", ""))
            behavior = "; ".join(objective["label"] for objective in chapter["objectives"])
        rows.append({
            "chapter_id": identity, "title": chapter["title"], "lane": "speculative" if identity.startswith(("E", "TX")) or identity in {"31", "32"} else "ancient" if chapter.get("record") else "historical",
            "priority": priority, "architecture_kit": kit, "emotional_light_arc": arc,
            "existing_preset_id": preset["id"] if preset else "MISSING",
            "proposed_preset_id": preset["id"] if preset else f"chapter-{identity}",
            "lighting_status": "Studio exists; not yet consumed by gameplay" if preset else "New authored ancient/speculative preset required; do not accept generic date/location fallback",
            "environment_detail": detail, "npc_life": behavior, "combat_policy": combat, "stealth_policy": stealth,
            "acceptance": "Matched studio/game shot; real traversal; stage-aware NPC behavior; first/third/free camera; accessibility and frame-budget evidence",
        })
    return rows


def rig_audit():
    rows = []
    for identity in ["JOSEPH_CHILD", "JOSEPH_YOUTH", "JOSEPH_YOUNG", "JOSEPH_MATURE", "EMMA", "CHRIST"]:
        asset = ASSETS["characters"][identity]["asset"]
        if not asset:
            continue
        path = ROOT / "meshy" / asset["file"]
        with path.open("rb") as stream:
            stream.seek(12)
            length, kind = struct.unpack("<II", stream.read(8))
            if kind != 0x4E4F534A:
                raise ValueError(path)
            document = json.loads(stream.read(length))
        names = sorted({document["nodes"][joint].get("name", "") for skin in document.get("skins", []) for joint in skin["joints"]})
        rows.append({"identity": identity, "file": str(path.relative_to(ROOT)), "bones": len(names), "clips": [clip.get("name", "") for clip in document.get("animations", [])], "rig_fingerprint": hashlib.sha256(json.dumps(names).encode()).hexdigest()[:16], "fingerprint_note": "Name-list audit only; actual retarget cache must also hash hierarchy and bind matrices."})
    return rows


def build():
    voices = voice_rows()
    scenes = scene_rows()
    rigs = rig_audit()
    profiles = defaultdict(list)
    for row in voices:
        profiles[row["base_voice_id"]].append(row)
    identity_rows = [{"priority": members[0]["priority"], "base_voice_id": profile, "name": PROFILE_NAMES.get(profile, members[0]["speaker_name"]), "speaker_ids": " ".join(row["speaker_id"] for row in members), "current_lines": sum(row["current_line_count"] for row in members), "reference_file": members[0]["suggested_reference_file"], "pool_requires_splitting": any(row["speaker_id"] in POOLS for row in members)} for profile, members in profiles.items()]
    backlog = [dict(zip(("priority", "voice_id", "name", "voice_description", "reason"), row)) for row in BACKLOG]
    missing = [row["chapter_id"] for row in scenes if row["existing_preset_id"] == "MISSING"]
    audit = {
        "date": "2026-10-22", "status": "Audited production plan, not implementation approval or a claim that the proposed systems exist",
        "chapter_count": len(scenes), "objective_count": sum(len(chapter["objectives"]) for chapter in DATA["chapters"]),
        "lighting": {"preset_count": len(LIGHTING["presets"]), "kinds": dict(Counter(preset["kind"] for preset in LIGHTING["presets"])), "missing_chapters": missing, "gameplay_integration": False, "build_integrated": False},
        "voice": {"runtime_lines": len(LINES), "speaker_ids": len(voices), "base_profile_groups_before_pool_splitting": len(profiles), "first_priority_groups": sum(row["priority"] == "P0" for row in identity_rows), "game_discovered_takes": json.loads((ROOT / "game/audio/manifest.json").read_text()).get("discovered_take_count", 0), "moss_library_readiness": "Not audited; no voice creation, upload, synthesis or training performed"},
        "rigs": rigs, "scene_plan": scenes, "voice_backlog": backlog,
        "benchmarks": ["08", "30", "BM03", "BM21", "BM24", "E8"],
        "proposed_modules": ["game/src/lighting/runtime.js", "game/content/scene-cues.json", "game/src/animation/rig-profile.js", "game/src/animation/actor-animator.js", "game/content/animation-manifest.json", "game/src/ai/nav-world.js", "game/src/ai/npc-brain.js", "game/src/ai/perception.js", "game/src/encounters/director.js", "game/src/combat/combatant.js", "game/src/combat/hit-resolver.js", "game/content/encounters.json"],
    }
    write_csv(DOCS / "voice-preparation.csv", voices)
    write_csv(DOCS / "voice-identities.csv", identity_rows)
    write_csv(DOCS / "voice-next-roles.csv", backlog)
    write_csv(DOCS / "scene-polish-matrix.csv", scenes)
    (DOCS / "polish-overhaul-plan.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n")
    template = (DOCS / "polish-overhaul-report.template.html").read_text()
    voice_html = "".join(f'<tr data-voice="{escaped((row["speaker_name"] + " " + row["speaker_id"] + " " + row["base_voice_id"]).lower())}"><td>{escaped(row["priority"])}</td><td><strong>{escaped(row["speaker_name"])}</strong><br><code>{escaped(row["speaker_id"])}</code></td><td>{row["current_line_count"]}<br><small>{escaped(row["chapters"])}</small></td><td><code>{escaped(row["base_voice_id"])}</code><br>{escaped(row["sharing_rule"])}</td><td>{escaped(row["voice_description"])}<details><summary>Audition and reference</summary><p>{escaped(row["audition_text"])}</p><code>{escaped(row["suggested_reference_file"])}</code></details></td></tr>' for row in voices)
    scene_html = "".join(f'<tr data-scene="{escaped((row["chapter_id"] + " " + row["title"] + " " + row["architecture_kit"]).lower())}"><td><strong>{escaped(row["chapter_id"])}</strong><br>{escaped(row["lane"])}</td><td>{escaped(row["title"])}<br><small>{escaped(row["architecture_kit"])}</small></td><td>{escaped(row["emotional_light_arc"])}<br><code>{escaped(row["proposed_preset_id"])}</code><br><small>{escaped(row["lighting_status"])}</small></td><td>{escaped(row["npc_life"])}</td><td>{escaped(row["combat_policy"])}<br><small>Stealth: {escaped(row["stealth_policy"])}</small></td></tr>' for row in scenes)
    backlog_html = "".join(f'<tr><td>{escaped(row["priority"])}</td><td><strong>{escaped(row["name"])}</strong><br><code>{escaped(row["voice_id"])}</code></td><td>{escaped(row["voice_description"])}</td><td>{escaped(row["reason"])}</td></tr>' for row in backlog)
    first_html = "".join(f'<li><strong>{escaped(row["name"])}</strong> <code>{escaped(row["base_voice_id"])}</code></li>' for row in identity_rows if row["priority"] == "P0")
    rig_html = "".join(f'<tr><td>{escaped(row["identity"])}</td><td>{row["bones"]}</td><td>{escaped(", ".join(row["clips"]))}</td><td><code>{escaped(row["file"])}</code></td></tr>' for row in rigs)
    replacements = {"VOICE_ROWS": voice_html, "SCENE_ROWS": scene_html, "BACKLOG_ROWS": backlog_html, "FIRST_VOICES": first_html, "RIG_ROWS": rig_html, "PROFILE_COUNT": str(len(profiles)), "SPEAKER_COUNT": str(len(voices)), "LINE_COUNT": str(len(LINES)), "CHAPTER_COUNT": str(len(scenes)), "PRESET_COUNT": str(len(LIGHTING["presets"])), "FIRST_COUNT": str(audit["voice"]["first_priority_groups"])}
    for key, value in replacements.items():
        template = template.replace(f"<!--{key}-->", value)
    (DOCS / "polish-overhaul-report.html").write_text(template)
    print(f'Built overhaul plan: {len(scenes)} chapters, {len(missing)} missing lighting looks, {len(voices)} speaking IDs, {len(profiles)} base-profile groups, {len(LINES)} lines; no runtime files changed.')


if __name__ == "__main__":
    build()
