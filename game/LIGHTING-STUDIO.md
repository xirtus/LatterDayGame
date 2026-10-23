# Light & Colour Staging Studio

A standalone staging page for the visual direction of *The Gathering of Zion*. It loads the game's real chapter geometry and layers a fully adjustable lighting, sky, weather, colour-grade and crowd rig on top. It does not modify the game or write back to it.

## Open

Serve the project root (the existing dev server is expected):

```bash
npm run dev
# or: python3 -m http.server 8923 --bind 127.0.0.1
```

Open <http://127.0.0.1:8923/game/lighting-studio.html>.

The research report is at <http://127.0.0.1:8923/docs/weather-lighting-report.html>.

## What it contains

- **43 chapter/event looks** — all 42 campaign chapters plus a clearly labelled stylised Carthage nightmare (the historical preset is late afternoon, hot, hazy and green-grey; the stylisation is a separate torchlit image).
- **44 mood presets** — cheerful, joyful, hopeful, sacred, reverent, tender, triumphant, nostalgic, dreamy, peaceful, solemn, mournful, tragic, tense, ominous, scary, horror, gloomy, bleak, oppressive, claustrophobic, supernatural, ethereal, celestial, apocalyptic, eerie, uncanny, industrial, noir, pastoral, stormy, feverish, frozen, golden, blue-hour, candlelit, torchlit, moonlit, bloodlight, sickly, verdant, autumnal, wintry and vernal.
- **20 weather states** — clear through blizzard, dust, ashfall, embers, wind, humid haze, plague haze, industrial smog and sea fog.
- **7 seasons** — spring, summer, autumn, winter, the 1816 “Year Without a Summer,” drought and monsoon.
- **12 times of day** — pre-dawn through midnight and moonrise.
- **10 camera setups** — wide, medium, close, low, crane, over-shoulder, window, interior, top-down and Dutch tilt.

## Controls

- **Place & time** — chapter selector, date, 24-hour clock, latitude/longitude/UTC offset, sun-follows-clock toggle, time playback, interior lighting mode, blocking figures.
- **Sky** — zenith, horizon, cloud tint, cloud cover, haze, stars, moon light, moon phase.
- **Key, fill & rim** — sun colour/intensity/azimuth/elevation/shadows, ambient sky/ground/intensity, fill and rim rigs, window/lamp, interior bounce, torch power and colour.
- **Colour grade** — exposure, contrast, saturation, temperature, tint, lift, gamma, gain, shadow colour and shadow tint, vignette, grain, bloom, bloom threshold, chromatic aberration, letterbox.
- **Weather & air** — fog colour/density, rain, snow, dust, embers, motes, mist, ground fog, wind, lightning, god rays, indoor-weather override.
- **Ground & foliage** — foliage/ground/accent/shadow colours, material tint strength, ground wash colour and opacity.
- **Crowd & props** — mob on/off, count, torch/pitchfork/firearm fractions, muzzle flashes, silhouette toggle, distance and spread.
- **Camera** — distance, azimuth, elevation, target height, target X/Z offset, FOV, quick camera buttons, auto-orbit.

Sun position and moon phase are computed from the date, local time and coordinates. Manual sun controls are also available; changing the clock recomputes the sun when “Sun follows date & clock” is on.

## Save, export and share

- **Save look** stores a named variant in `localStorage` (browser only), visible under the Saved tab.
- **Export** shows the full JSON, with copy, download, import, and **Copy game config** (the subset a later in-game lighting implementation can consume).
- **Share** copies a URL with the complete look encoded in the hash.
- **Reset** returns to the historical Carthage preset.

## Rebuild

```bash
node tools/build_lighting_studio.mjs
```

Regenerate the preset dataset and the research report from the same source:

```bash
python3 tools/build_lighting_data.py
```

Source files:

- `game/src/lighting-studio.js` — page controller, UI and state.
- `game/src/lighting/sky.js` — procedural sky dome.
- `game/src/lighting/weather.js` — precipitation, dust, embers, mist, god rays, lightning.
- `game/src/lighting/staging.js` — mob/blocking figures, torches, pitchforks, firearms, muzzle flashes.
- `game/src/lighting/grade.js` — post-processing/colour grade.
- `game/content/lighting-presets.json` — 136 generated presets.
- `docs/weather-lighting-report.html` — the research report.
- `docs/weather-lighting-report.template.html` — report source.
- `tools/build_lighting_data.py` — chapter research data, preset generation and report build.

## Test

With the server running:

```bash
node tools/test_lighting_studio.mjs          # key chapters + layers + screenshots
node tools/test_lighting_studio.mjs --all    # every chapter and every layer
```

Evidence screenshots are written to `game/evidence/`.

## Historical guardrail

Chapter presets are staging hypotheses informed by period accounts and modern climate normals, not daily weather records. The report labels each chapter as reported, climate, astronomical or staged. The Carthage torchlit preset is explicitly non-historical; the documented attack was in the late afternoon and the sources describe heat, painted faces and firearms, not a torchlit night assault.
