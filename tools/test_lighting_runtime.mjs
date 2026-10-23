import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const root = new URL('../', import.meta.url);
const chapterData = JSON.parse(await readFile(new URL('game/content/chapters.json', root), 'utf8'));
const presetData = JSON.parse(await readFile(new URL('game/content/lighting-presets.json', root), 'utf8'));
const cueData = JSON.parse(await readFile(new URL('game/content/scene-cues.json', root), 'utf8'));
const presetById = new Map(presetData.presets.map(preset => [preset.id, preset]));
assert.equal(chapterData.chapters.length, 70);
assert.equal(Object.keys(cueData.chapters).length, 70);
assert.equal(presetData.counts.total, 164);
assert.equal(presetData.presets.filter(preset => preset.authored).length, 28);
for (const chapter of chapterData.chapters) {
  const preset = presetById.get(`chapter-${chapter.id}`);
  const cue = cueData.chapters[chapter.id];
  assert(preset && cue, chapter.id);
  assert.deepEqual(cue.objectives.map(item => item.objectiveId), chapter.objectives.map(item => item.id));
  assert.equal(cue.presetId, preset.id);
  if (/^(BM|TX)/.test(chapter.id)) {
    assert.equal(preset.authored, true);
    assert.equal(preset.date, '');
    assert.equal(preset.latitude, null);
    assert.equal(preset.longitude, null);
    assert.equal(preset.autoSun, false);
  }
}
assert(presetById.get('chapter-30').sun.elevation > 0);
assert.equal(presetById.get('chapter-30').practical.torch, 0);
assert.equal(presetById.get('chapter-30-stylized').stylized, true);
assert.match(presetById.get('chapter-30-stylized').dateLabel, /imagined/);
assert(presetById.get('chapter-BM24').grade.saturation < 0.5);

const source = `
import * as THREE from 'three';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {createLightingRuntime, resolveLightingState} from './game/src/lighting/runtime.js';
import chapters from './game/content/chapters.json';
window.runLightingChecks = () => {
  const check = (value, label) => { if (!value) throw new Error(label); };
  const renderer = new THREE.WebGLRenderer({antialias: false});
  renderer.setSize(320, 240);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 0.9;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const background = new THREE.Color('#586b72');
  const fog = new THREE.Fog('#798887', 20, 80);
  scene.background = background;
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(45, 320 / 240, 0.1, 150);
  camera.position.set(4, 4, 6);
  camera.lookAt(0, 0.5, 0);
  const group = new THREE.Group();
  const sun = new THREE.DirectionalLight('#fff4d1', 3);
  const hemisphere = new THREE.HemisphereLight('#abcdef', '#454545', 2);
  const practical = new THREE.PointLight('#ffcc88', 8, 10);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 5), new THREE.MeshToonMaterial({color: '#829b65'}));
  ground.material.userData.lightingRole = 'foliage';
  const skin = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({color: '#a08060'}));
  skin.position.y = 0.6;
  group.add(sun, hemisphere, practical, ground, skin);
  scene.add(group);
  const world = {group, focus: new THREE.Vector3(0, 1, 0)};
  const originalGround = ground.material.color.clone();
  const originalSkin = skin.material.color.clone();
  const originalPractical = practical.color.clone();
  const chapter = chapters.chapters.find(item => item.id === '08');
  const outline = new OutlineEffect(renderer);
  let outlineCalls = 0;
  const originalRender = outline.render.bind(outline);
  outline.render = (...args) => { outlineCalls++; originalRender(...args); };
  const memories = [];
  let highParticles;
  let lowParticles;
  for (let cycle = 0; cycle < 4; cycle++) {
    const low = cycle === 3;
    const runtime = createLightingRuntime({renderer, scene, camera, world, chapter, outline, quality: low ? 'low' : 'high', reducedMotion: low, reducedFlash: true});
    check(!sun.visible && !hemisphere.visible, 'Default world lights must be disabled');
    check(runtime.getState().registeredPracticalLights === 1, 'Practical light must be registered once');
    check(scene.getObjectByName('shared-lamp').intensity === 0, 'Registered lamps must suppress fallback lamp');
    check(skin.material.color.equals(originalSkin), 'Skin material must not be palette recolored');
    check(!ground.material.color.equals(originalGround), 'Tagged foliage must receive the authored palette');
    let duplicateRejected = false;
    try { createLightingRuntime({renderer, scene, camera, world, chapter}); } catch { duplicateRejected = true; }
    check(duplicateRejected, 'A scene must have one lighting owner');
    runtime.setObjective('08-2');
    runtime.update(0.016, 12, new THREE.Vector3(2, 0, 3));
    check(runtime.getState().objectiveId === '08-2', 'Stable objective cue must resolve');
    const weather = scene.getObjectByName('lighting-studio-weather');
    check(weather.position.x === 2 && weather.position.z === 3, 'Weather must follow the gameplay position');
    const count = weather.children[0].geometry.attributes.position.count;
    if (low) lowParticles = count; else highParticles = count;
    const positions = weather.children[2].geometry.attributes.position.array.slice();
    const sky = scene.getObjectByName('lighting-studio-sky');
    check(sky.scale.x * 620 < camera.far, 'Sky must remain inside gameplay camera far clip');
    runtime.setEvent(null);
    runtime.render();
    runtime.resize(400, 240);
    runtime.update(0.016, 13);
    if (low) {
      check(weather.children[2].geometry.attributes.position.array.every((value, index) => value === positions[index]), 'Reduced motion must freeze weather');
      check(sky.material.uniforms.time.value === 0 && sky.material.uniforms.flash.value === 0, 'Reduced motion/flash must freeze sky and suppress flashes');
    }
    runtime.dispose();
    runtime.dispose();
    check(sun.visible && hemisphere.visible, 'Original world light visibility must restore');
    check(practical.intensity === 8 && practical.color.equals(originalPractical), 'Practical light intensity and color must restore losslessly');
    check(ground.material.color.equals(originalGround) && skin.material.color.equals(originalSkin), 'Original material colors must restore losslessly');
    check(scene.children.length === 1, 'Lighting scene objects must be removed');
    check(scene.fog === fog && scene.background === background, 'Original fog/background references must restore');
    check(renderer.toneMapping === THREE.NoToneMapping && renderer.toneMappingExposure === 0.9, 'Renderer tone mapping must restore');
    renderer.render(scene, camera);
    memories.push({...renderer.info.memory});
  }
  check(lowParticles < highParticles * 0.3, 'Low quality must reduce actual allocated particles');
  check(memories.every(memory => memory.geometries === memories[0].geometries && memory.textures === memories[0].textures), 'Repeated runtime transitions must not grow GPU memory');
  check(outlineCalls === 3, 'High-quality outlines must render inside the shared composer; low quality must omit the extra draw');
  let objectives = 0;
  for (const chapter of chapters.chapters) {
    for (const [index, objective] of chapter.objectives.entries()) {
      const byIndex = resolveLightingState(chapter.id, index);
      const byId = resolveLightingState(chapter.id, objective.id);
      check(JSON.stringify(byIndex) === JSON.stringify(byId), objective.id + ' cue mismatch');
      check(Number.isFinite(byId.sun.elevation) && Number.isFinite(byId.grade.exposure), objective.id + ' invalid lighting');
      objectives++;
    }
  }
  const assault = resolveLightingState('30', '30-3', 'carthage-assault');
  check(assault.sun.elevation > 0 && assault.practical.torch === 0 && assault.fx.dust > 0.6, 'Historical Carthage event must preserve daylight and smoke');
  return {chapters: chapters.chapters.length, objectives, outlineCalls, highParticles, lowParticles, memories};
};
`;
const bundle = await build({stdin: {contents: source, resolveDir: root.pathname, loader: 'js'}, bundle: true, format: 'esm', write: false, logLevel: 'silent'});
const browser = await chromium.launch({headless: true});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.route('**/lighting-runtime-test.html', route => route.fulfill({contentType: 'text/html', body: '<script type="module" src="/lighting-runtime-test.js"></script>'}));
  await page.route('**/lighting-runtime-test.js', route => route.fulfill({contentType: 'text/javascript', body: bundle.outputFiles[0].text}));
  await page.goto('http://127.0.0.1:8923/lighting-runtime-test.html');
  await page.waitForFunction(() => window.runLightingChecks);
  const result = await page.evaluate(() => window.runLightingChecks());
  assert.deepEqual(errors, []);
  await mkdir(new URL('game/evidence/', root), {recursive: true});
  await writeFile(new URL('game/evidence/lighting-runtime-tests.json', root), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
