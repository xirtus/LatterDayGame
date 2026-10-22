# 3D Character Library

A reusable library of **Latter-day Saint / Restoration characters**, split out of the *Joseph Smith and the gathering of Zion* preproduction report.

**19 characters · 57 GLB files · 1.53 GB.** Every character includes a rigged, animated model, plus the unrigged source and remesh stages in the same folder.

> These are AI-generated preproduction assets, not documentary likenesses. The sacred figures are reverent artistic interpretations. This project is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints.

## Gallery

<table>
<tr>
<td align="center" width="25%"><a href="joseph-smith-sr"><img src="joseph-smith-sr/preview.png" width="170" alt="Joseph Smith Sr."><br><sub><b>Joseph Smith Sr.</b></sub></a></td>
<td align="center" width="25%"><a href="joseph-smith"><img src="joseph-smith/preview.png" width="170" alt="Joseph Smith"><br><sub><b>Joseph Smith</b></sub></a></td>
<td align="center" width="25%"><a href="emma-smith"><img src="emma-smith/preview.png" width="170" alt="Emma Hale Smith"><br><sub><b>Emma Hale Smith</b></sub></a></td>
<td align="center" width="25%"><a href="hyrum-smith"><img src="hyrum-smith/preview.png" width="170" alt="Hyrum Smith"><br><sub><b>Hyrum Smith</b></sub></a></td>
</tr>
<tr>
<td align="center" width="25%"><a href="lucy-mack-smith"><img src="lucy-mack-smith/preview.png" width="170" alt="Lucy Mack Smith"><br><sub><b>Lucy Mack Smith</b></sub></a></td>
<td align="center" width="25%"><a href="brigham-young"><img src="brigham-young/preview.png" width="170" alt="Brigham Young"><br><sub><b>Brigham Young</b></sub></a></td>
<td align="center" width="25%"><a href="oliver-cowdery"><img src="oliver-cowdery/preview.png" width="170" alt="Oliver Cowdery"><br><sub><b>Oliver Cowdery</b></sub></a></td>
<td align="center" width="25%"><a href="martin-harris"><img src="martin-harris/preview.png" width="170" alt="Martin Harris"><br><sub><b>Martin Harris</b></sub></a></td>
</tr>
<tr>
<td align="center" width="25%"><a href="david-whitmer"><img src="david-whitmer/preview.png" width="170" alt="David Whitmer"><br><sub><b>David Whitmer</b></sub></a></td>
<td align="center" width="25%"><a href="jacob-whitmer"><img src="jacob-whitmer/preview.png" width="170" alt="Jacob Whitmer"><br><sub><b>Jacob Whitmer</b></sub></a></td>
<td align="center" width="25%"><a href="john-whitmer"><img src="john-whitmer/preview.png" width="170" alt="John Whitmer"><br><sub><b>John Whitmer</b></sub></a></td>
<td align="center" width="25%"><a href="sidney-rigdon"><img src="sidney-rigdon/preview.png" width="170" alt="Sidney Rigdon"><br><sub><b>Sidney Rigdon</b></sub></a></td>
</tr>
<tr>
<td align="center" width="25%"><a href="moroni"><img src="moroni/preview.png" width="170" alt="Moroni"><br><sub><b>Moroni</b></sub></a></td>
<td align="center" width="25%"><a href="nephi"><img src="nephi/preview.png" width="170" alt="Nephi"><br><sub><b>Nephi</b></sub></a></td>
<td align="center" width="25%"><a href="laman"><img src="laman/preview.png" width="170" alt="Laman"><br><sub><b>Laman</b></sub></a></td>
<td align="center" width="25%"><a href="lemuel"><img src="lemuel/preview.png" width="170" alt="Lemuel"><br><sub><b>Lemuel</b></sub></a></td>
</tr>
<tr>
<td align="center" width="25%"><a href="alma-the-younger"><img src="alma-the-younger/preview.png" width="170" alt="Alma the Younger"><br><sub><b>Alma the Younger</b></sub></a></td>
<td align="center" width="25%"><a href="heavenly-father"><img src="heavenly-father/preview.png" width="170" alt="Heavenly Father"><br><sub><b>Heavenly Father</b></sub></a></td>
<td align="center" width="25%"><a href="john-the-baptist"><img src="john-the-baptist/preview.png" width="170" alt="John the Baptist"><br><sub><b>John the Baptist</b></sub></a></td>
</tr>
</table>

### Joseph through the ages

<table>
<tr>
<td align="center" width="33%"><img src="joseph-smith/joseph-smith-child-rigged.png" width="190" alt="Joseph Smith, Child"><br><sub><b>Child</b></sub></td>
<td align="center" width="33%"><img src="joseph-smith/joseph-smith-teen-rigged.png" width="190" alt="Joseph Smith, Teenage"><br><sub><b>Teenage</b></sub></td>
<td align="center" width="33%"><img src="joseph-smith/joseph-smith-rigged.png" width="190" alt="Joseph Smith, Adult"><br><sub><b>Adult</b></sub></td>
</tr>
</table>

## Quick start

1. Browse a character folder below, or open [`manifest.json`](manifest.json) for hashes, triangle counts and rig data.
2. Download the `*-rigged.glb` file for a game-ready model with a skeleton and animation clips.
3. Drop the GLB into Blender, Unity, Godot, Unreal, three.js, or any glTF 2.0 viewer.
4. If you only want one character, use GitHub's **Download** button on that file, or a sparse checkout (see below).

```bash
# Clone only the model library, without the report history
git clone --depth 1 --filter=blob:none --sparse https://github.com/xirtus/LatterDayGame.git
cd LatterDayGame
git sparse-checkout set models
```

## Rigged models

The `*-rigged.glb` files use a humanoid Mixamo-style skeleton (22–24 body joints) and normally ship with **Running** and **Walking** clips. They have head and shoulder joints but **no finger joints or facial blendshapes**. All textures are embedded in the GLB.

| | |
|---|---|
| Format | Binary glTF 2.0 (`.glb`) |
| Up axis | Y |
| Units | Meters (characters are roughly 1.7–1.9 m tall) |
| Textures | Embedded 2K/4K atlas |
| Animation | 2 clips on most rigs (`Running`, `Walking`); exact clips are in `manifest.json` |

Meshy rigged exports can contain the same texture as both base color and emissive. If a model looks washed out, disconnect or blacken the emissive input and keep the base-color texture.

## Catalog

| Character | Group | Rigged model(s) | Best model |
| --- | --- | --- | --- |
| **Joseph Smith Sr.**<br>Joseph's father: a hard-working New England farmer and patriarch of the Smith family. | Family | [`joseph-smith-sr-rigged.glb`](joseph-smith-sr/joseph-smith-sr-rigged.glb) | [`joseph-smith-sr-rigged.glb`](joseph-smith-sr/joseph-smith-sr-rigged.glb)<br>10,380 tris · 20.5 MB |
| **Joseph Smith**<br>The central figure of the Restoration, modeled at child, teenage, and adult ages. | Joseph Smith | [`joseph-smith-rigged.glb`](joseph-smith/joseph-smith-rigged.glb)<br>[`joseph-smith-child-rigged.glb`](joseph-smith/joseph-smith-child-rigged.glb)<br>[`joseph-smith-teen-rigged.glb`](joseph-smith/joseph-smith-teen-rigged.glb)<br>[`joseph-smith-teen-rigged-alt.glb`](joseph-smith/joseph-smith-teen-rigged-alt.glb) | [`joseph-smith-rigged.glb`](joseph-smith/joseph-smith-rigged.glb)<br>10,242 tris · 6.7 MB |
| **Emma Hale Smith**<br>Joseph's wife, principal scribe during the translation, and a leader in the early Relief Society. | Family | [`emma-smith-rigged.glb`](emma-smith/emma-smith-rigged.glb) | [`emma-smith-rigged.glb`](emma-smith/emma-smith-rigged.glb)<br>10,231 tris · 18.1 MB |
| **Hyrum Smith**<br>Joseph's older brother, Patriarch to the Church, and his companion at Carthage. | Family | [`hyrum-smith-rigged.glb`](hyrum-smith/hyrum-smith-rigged.glb) | [`hyrum-smith-rigged.glb`](hyrum-smith/hyrum-smith-rigged.glb)<br>30,728 tris · 23.1 MB |
| **Lucy Mack Smith**<br>Joseph's mother, family matriarch, and author of a foundational family memoir. | Family | [`lucy-mack-smith-rigged.glb`](lucy-mack-smith/lucy-mack-smith-rigged.glb) | [`lucy-mack-smith-rigged.glb`](lucy-mack-smith/lucy-mack-smith-rigged.glb)<br>18,549 tris · 13.0 MB |
| **Brigham Young**<br>Apostle and later second President of the Church, who led the westward migration. | Church leadership | [`brigham-young-rigged.glb`](brigham-young/brigham-young-rigged.glb) | [`brigham-young-rigged.glb`](brigham-young/brigham-young-rigged.glb)<br>10,257 tris · 17.4 MB |
| **Oliver Cowdery**<br>Principal scribe during the Book of Mormon translation and one of the Three Witnesses. | Witnesses | [`oliver-cowdery-rigged.glb`](oliver-cowdery/oliver-cowdery-rigged.glb) | [`oliver-cowdery-rigged.glb`](oliver-cowdery/oliver-cowdery-rigged.glb)<br>10,274 tris · 19.9 MB |
| **Martin Harris**<br>Farmer, financier of the first printing, and one of the Three Witnesses. | Witnesses | [`martin-harris-rigged.glb`](martin-harris/martin-harris-rigged.glb) | [`martin-harris-rigged.glb`](martin-harris/martin-harris-rigged.glb)<br>10,378 tris · 21.0 MB |
| **David Whitmer**<br>One of the Three Witnesses and a member of the Fayette, New York household. | Witnesses | [`david-whitmer-rigged.glb`](david-whitmer/david-whitmer-rigged.glb) | [`david-whitmer-rigged.glb`](david-whitmer/david-whitmer-rigged.glb)<br>10,259 tris · 19.4 MB |
| **Jacob Whitmer**<br>One of the Eight Witnesses who examined the plates in Fayette. | Witnesses | [`jacob-whitmer-rigged.glb`](jacob-whitmer/jacob-whitmer-rigged.glb) | [`jacob-whitmer-rigged.glb`](jacob-whitmer/jacob-whitmer-rigged.glb)<br>10,192 tris · 21.9 MB |
| **John Whitmer**<br>One of the Eight Witnesses and the first official Church historian. | Witnesses | [`john-whitmer-rigged.glb`](john-whitmer/john-whitmer-rigged.glb) | [`john-whitmer-rigged.glb`](john-whitmer/john-whitmer-rigged.glb)<br>30,894 tris · 22.6 MB |
| **Sidney Rigdon**<br>Campbellite preacher, First Presidency counselor, and a powerful early orator. | Church leadership | [`sidney-rigdon-rigged.glb`](sidney-rigdon/sidney-rigdon-rigged.glb)<br>[`sidney-rigdon-young-rigged.glb`](sidney-rigdon/sidney-rigdon-young-rigged.glb) | [`sidney-rigdon-rigged.glb`](sidney-rigdon/sidney-rigdon-rigged.glb)<br>10,348 tris · 22.2 MB |
| **Moroni**<br>The angelic messenger who directed Joseph to the plates; a reverent, older robed interpretation. | Sacred visitors | [`moroni-rigged.glb`](moroni/moroni-rigged.glb) | [`moroni-rigged.glb`](moroni/moroni-rigged.glb)<br>30,760 tris · 22.5 MB |
| **Nephi**<br>Book of Mormon prophet and first narrator, useful for scripture tableaux. | Book of Mormon | [`nephi-rigged.glb`](nephi/nephi-rigged.glb) | [`nephi-rigged.glb`](nephi/nephi-rigged.glb)<br>10,358 tris · 22.7 MB |
| **Laman**<br>Eldest son of Lehi in the Book of Mormon narrative. | Book of Mormon | [`laman-rigged.glb`](laman/laman-rigged.glb) | [`laman-rigged.glb`](laman/laman-rigged.glb)<br>10,079 tris · 15.9 MB |
| **Lemuel**<br>Son of Lehi and brother of Nephi in the Book of Mormon narrative. | Book of Mormon | [`lemuel-rigged.glb`](lemuel/lemuel-rigged.glb) | [`lemuel-rigged.glb`](lemuel/lemuel-rigged.glb)<br>9,905 tris · 17.2 MB |
| **Alma the Younger**<br>Book of Mormon prophet and missionary, modeled for scripture tableaux. | Book of Mormon | [`alma-the-younger-rigged.glb`](alma-the-younger/alma-the-younger-rigged.glb) | [`alma-the-younger-rigged.glb`](alma-the-younger/alma-the-younger-rigged.glb)<br>10,387 tris · 24.7 MB |
| **Heavenly Father**<br>A reverent artistic interpretation of the Father in the First Vision narrative. | Sacred visitors | [`heavenly-father-rigged.glb`](heavenly-father/heavenly-father-rigged.glb) | [`heavenly-father-rigged.glb`](heavenly-father/heavenly-father-rigged.glb)<br>15,054 tris · 17.5 MB |
| **John the Baptist**<br>The New Testament forerunner who restored the Aaronic Priesthood in the Restoration narrative. | Sacred visitors | [`john-the-baptist-rigged.glb`](john-the-baptist/john-the-baptist-rigged.glb) | [`john-the-baptist-rigged.glb`](john-the-baptist/john-the-baptist-rigged.glb)<br>10,328 tris · 21.9 MB |

## Naming convention

```
models/<character>/<character>[-<age>]-<role>.glb
```

| Role | Meaning |
| --- | --- |
| `rigged` | Skinned, animated game-ready mesh |
| `tpose` | Explicit T-pose export, no rig |
| `source` | Original high-poly image-to-3D scan |
| `remeshed` / `remeshed-10k` | Decimated mesh, no rig |
| `optimized` | Optimized mesh, no rig |
| `10k` | 10k-triangle remesh, no rig |
| `-alt` | Older export of the same stage, kept for comparison |

## Attribution

Character models generated with [Meshy](https://www.meshy.ai/) for the *Latter Day Game* project. Concept art and report by Andreas Xirtus. If you use these models, credit **Latter Day Game / xirtus** and keep this file with the assets.

The repository is released under the MIT license (see the root [`LICENSE`](../LICENSE)).

---

*Generated by `tools/organize_models.py` on 2026-10-22T12:17:07+00:00. Source exports are preserved under their original names in the manifest's `source_file` field.*
