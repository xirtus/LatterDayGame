# Reviewed motion library

Regenerate with `node tools/build_motion_library.mjs`; validate with `node tools/test_motion.mjs`, `node tools/test_motion_cache.mjs` and `node tools/test_actors.mjs --browser`.

The manifest contains 15 allowlisted motion records and SHA-256 provenance for eight sibling source files. Only motion channels are extracted. No sibling character, weapon, fantasy environment, texture or audio is imported. Original GLBs and source records are unchanged. Source hashes establish provenance, not additional redistribution rights.

## Retarget contract

Source skeletons are evaluated in their own recorded local basis, then converted to world segment directions. Source facing is measured from the first-frame anatomical thigh axis, removing the Anima compact export's different heading without copying its arm-offset fixes. The four target exported poses are checked against their inverse bind matrices, with positional residuals below 0.000001 metres. Their centimetre armature parents are retained. Calling `Skeleton.pose()` on these scaled non-bone parents would shrink bone positions and is intentionally avoided.

Each target hierarchy, local reference transform and inverse bind matrix participates in the runtime cache key. Shortest-arc segment aiming preserves that target's axial basis; torso and foot reference directions are calibrated independently. This is a directional retarget, not a full finger or twist-bone transfer. Christ's 20-joint export lacks the left foot joint: a mirrored, non-skinned support endpoint is explicit in diagnostics.

Live actors sharing a rig share its derived clips regardless of placement, facing or uniform height. After the last actor is disposed, the cache retains only derived keyframe arrays and the signature, bounded to 12 unused profiles and 8 MiB of array/signature storage. Least recently acquired unused entries are evicted; active actors are protected. No model, texture, skeleton or actor reference is retained by this cache. `getAssetStatus().animationCache` reports reuse, misses, retained storage and active profiles. The CPU-only cache test checks chapter revisits, facing/height equivalence and eviction without starting a browser.

The motor owns planar translation and yaw. Recorded source root translation is discarded. A bounded holder correction maintains the lowest ankle's original support height; it does not move the actor root. This is ground support, not terrain-aware foot IK. Scene interaction anchors still own chair/desk placement. `sit` holds its endpoint, `stand` reverses the recorded transition, and seated talk/listen retain the same leg pose. Prayer preserves the existing fitted kneeling/bowing solver; the prayer reference remains available for auditing. Social gestures retain the recorded Planecrash 3 arm directions and do not schedule independent conversations.

`setMotion(name, {fade, speed, restart})` blends states over 0.24 seconds by default. `setAction` is an alias. Supported states include idle, walk, run, talk (`speak` alias), listen, sit, stand, pray, work, fear, attack, guard, crouch and walk_crouch. `getSocket('rightHand')` returns the bone object; metre-sized attached props must compensate its inherited centimetre scale. `getBoneSocket('RightHand')` returns a world position. Diagnostics report selected source, duration, rig fingerprint, inferred endpoints and root ownership.

## Regression evidence

`evidence/measurements.json` and the adjacent rendered PNGs are produced by the real WebGL actor bench. Across three seconds of walking, mean lateral upper-arm spread changes as follows:

| Actor | Original | Retargeted |
| --- | ---: | ---: |
| Joseph | 23.71° | 15.25° |
| Emma | 29.45° | 15.25° |
| Christ | 23.42° | 15.25° |
| Louisa | 26.25° | 15.25° |

The bench also checks changing idle poses, target-unit seated hip heights, seated dialogue leg retention, retiring crossfade actions, no motor-root drift, supported ankles and released resources. The existing actor suite covers the age/wardrobe variants, prayer restoration and remaining cast. Garment intersections in extreme combat poses still depend on the original Meshy skin weights; these tests do not claim cloth simulation or production-quality hand/prop contacts.

`peter_whitmer_jr_rigged.glb` contains a 24-joint skeleton but no mesh skin binding or joint/weight vertex attributes. Its visible T-pose is permanent even when its unattached bones animate. Asset discovery now classifies that export as unrigged and selects the existing, correctly skinned `Meshy_AI_peter_whitmer_jr_reri_All_Animations.glb` of the same person. The actor loader also rejects skeleton-only exports and tries another rigged variant of the same identity when an older manifest selects the broken export. The original files are untouched. `test_motion_standin.mjs` verifies actual GLTFLoader skin deformation; `test_motion.mjs` forces the stale-manifest case for both Peter and the borrowed Mormon visual and saves `evidence/peter-mormon-regression.png` plus measurements.
