# The Gathering of Zion — playable first build

A cel-shaded, walkable journey through the life of Joseph Smith: **40 chapters** (32 core chapters plus the eight-era Zion expansion), the historical cast, the plates and witnesses, chapter select, and a continuous world that moves from New York to Ohio, Missouri, Nauvoo, and beyond.

[`index.html`](index.html) is the entry point. The build is plain HTML/CSS/JavaScript with Three.js bundled in `dist/game.js`; there is no framework and no server runtime.

<p align="center"><img src="evidence/menu.png" alt="The Gathering of Zion menu" width="100%"></p>

## Run it

The game loads chapter data and character GLBs with `fetch`, so it must be served over HTTP. From the repository root:

```bash
python3 -m http.server 8000
# open http://localhost:8000/game/
```

Opening the file directly (`file://`) will not work.

### Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrow keys | Walk |
| Drag | Look |
| `E` | Interact / advance |
| `J` | Journey / chapter view |
| `V` | Toggle free camera |
| `Esc` | Pause or back |

## What is in this folder

```text
game/
├── index.html              # page shell and UI
├── style.css               # menu, HUD, captions
├── content/
│   ├── chapters.json       # 40 chapters: text, objectives, cast, sources
│   └── assets.json         # character manifest and model URLs
├── src/
│   ├── main.js             # boot, menu, chapter flow, UI
│   ├── world.js            # terrain, buildings, props, lighting
│   ├── actors.js           # GLB loading, toon materials, movement
│   ├── story.js            # chapter state and objectives
│   ├── portals.js          # era transitions
│   └── audio.js            # procedural ambience and caption timing
├── audio/                  # recording plan and optional local takes
├── dist/game.js            # built bundle (Three.js included)
└── evidence/               # menu and world captures
```

## Models

Characters come from the repository's [`models/`](../models/) library. `content/assets.json` stores each character's selected model and its alternatives. The public build's URLs point at `../../models/<character>/<file>.glb`.

The original development pipeline expected the raw exports in a local `meshy/` folder. If you regenerate `assets.json` with `tools/build_game_assets.py`, run the rewriter afterward to point it back at the organized library:

```bash
python3 tools/rewrite_game_assets.py
```

The rewriter matches the original filenames recorded in [`models/manifest.json`](../models/manifest.json), so renaming or replacing a model does not break the game as long as the manifest is current.

### Runtime model handling

- Materials are converted to a four-band toon shader; base-color textures are downsampled to 1024 px.
- Emissive and metallic-roughness maps are not used.
- Assets are loaded per chapter, reference-counted, and released with their actors.
- Animation coverage follows the clips that actually exist in each GLB. Most rigs have `Running` and `Walking`; where no idle/prayer clip exists, the actor holds a paused frame instead of pretending a bespoke performance exists.
- Facial and finger animation are not rigged yet.

## Chapters and cast

`content/chapters.json` contains 40 chapters: 32 core chapters plus eight expansion eras (E1–E8). Each chapter lists its date, place, historical summary, playable objectives, cast, and source links. `content/assets.json` maps the 79 cast roles to models; roles without a dedicated model use explicitly provisional figures rather than another named person's likeness.

The eight witnesses are Christian Whitmer, Jacob Whitmer, Peter Whitmer Jr., John Whitmer, Hiram Page, Joseph Smith Sr., Hyrum Smith, and Samuel H. Smith. They are distinct from the Three Witnesses: Oliver Cowdery, David Whitmer, and Martin Harris.

## Audio and voices

There are **no generated or recorded character voices** in this build. The game uses original procedural ambience and visible dialogue captions. [`audio/recording-plan.csv`](audio/recording-plan.csv) lists every runtime line with a stable ID, speaker, performance direction, and expected filename. [`audio/README.txt`](audio/README.txt) documents the consent, rights, and review gates for producing local takes. An empty manifest is intentional.

## Development

The checked-in `dist/game.js` is the build used by the page. The source is in `src/`; `package.json` at the repository root contains the dev scripts.

```bash
npm install
npm run build     # rebuild story data, asset manifest, voice index, and dist/game.js
npm run dev       # build and serve on http://127.0.0.1:8923
npm test          # game smoke test
```

`npm run build` expects a local `meshy/` source folder and will regenerate `content/assets.json` against it. In this public repository, run `python3 tools/rewrite_game_assets.py` afterward to restore the organized `models/` paths.

## Known limits

- Early build: animation, crowd coverage, collision, and scene polish are still in progress.
- The divine figures and celestial chapters are reverent artistic interpretations, not doctrine.
- Historical scenes are dramatizations; see the report and `docs/sources.json` for sources and qualifications.
- No voices, facial performance, or final audio mix are included.

## Credits

Design, code, world, and art direction by Andreas Xirtus. Character models generated with [Meshy](https://www.meshy.ai/) and organized in [`models/`](../models/). Three.js is MIT-licensed; its notice is in `dist/game.js.LEGAL.txt`.

The repository is MIT-licensed. This project is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints.
