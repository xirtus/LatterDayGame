import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {access, readFile, mkdtemp, rm, stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'game/content/assets.json'), 'utf8'));
const witnessPatterns = {
  CHRISTIAN_WHITMER: /christian.*whitmer/i, JACOB_WHITMER: /jacob.*whitmer/i,
  PETER_WHITMER_JR: /peter.*whitmer/i, JOHN_WHITMER: /john.*whitmer/i,
  HIRAM_PAGE: /(hiram|hyrum).*page/i, JOSEPH_SR: /joseph.*smith.*(sr|father)/i,
  HYRUM: /hyrum/i, SAMUEL_SMITH: /samuel.*smith/i,
};
const selectedWitnesses = new Set();
for (const [identity, entry] of Object.entries(manifest.characters)) {
  assert.equal(entry.id, identity, `Manifest identity mismatch: ${identity}`);
  assert.ok(['model', 'placeholder'].includes(entry.status));
  if (!entry.asset) {
    assert.equal(entry.status, 'placeholder');
    continue;
  }
  assert.equal(entry.status, 'model');
  const filename = path.resolve(root, 'game/content', entry.asset.url);
  assert.ok(filename.startsWith(path.join(root, 'meshy') + path.sep), `Asset escaped local model directory: ${identity}`);
  await access(filename);
  assert.ok(entry.asset.triangles <= 150000 || identity === 'JOSEPH_CHILD' && entry.warning, `Unoptimized model selected without an explicit warning for ${identity}`);
  if (witnessPatterns[identity]) {
    assert.match(entry.asset.file, witnessPatterns[identity], `Wrong Eight Witness identity: ${identity}`);
    assert.ok(!selectedWitnesses.has(entry.asset.file), 'Eight Witness identities must not share a likeness');
    selectedWitnesses.add(entry.asset.file);
  }
}
assert.deepEqual(Object.keys(witnessPatterns).length, 8);
assert.ok(manifest.characters.JOSEPH_MATURE.asset, 'Joseph must have a playable model');
if (manifest.characters.JOSEPH_CHILD.asset) {
  assert.match(manifest.characters.JOSEPH_CHILD.asset.file, /child|boy|little/i, 'Dedicated child model required');
  assert.notEqual(manifest.characters.JOSEPH_CHILD.asset.file, manifest.characters.JOSEPH_YOUTH.asset?.file);
}
assert.ok(manifest.characters.EMMA.asset, 'Emma must have her own model');
assert.ok(manifest.characters.FATHER.asset, 'Father model expected from the local inventory');
assert.ok(manifest.characters.JOHN_BAPTIST.asset, 'John the Baptist model expected from local inventory');
for (const variant of ['white', 'red']) {
  const profile = manifest.characters[`CHRIST_${variant.toUpperCase()}`];
  assert.equal(profile.identity, 'CHRIST');
  assert.equal(profile.profileType, 'wardrobe');
  assert.equal(profile.variant, variant);
}
if (manifest.characters.CHRIST_WHITE.asset) assert.equal(manifest.characters.CHRIST.asset.file, manifest.characters.CHRIST_WHITE.asset.file, 'Default Christ must prefer the optimized white garment');
if (manifest.characters.ORSON_YOUNG.asset) assert.equal(manifest.characters.ORSON.asset.file, manifest.characters.ORSON_YOUNG.asset.file, 'Default Orson must prefer the early-ministry model');
assert.ok(!manifest.characters.JAMES.asset || !/taylor/i.test(manifest.characters.JAMES.asset.file), 'James Taylor must not represent James the Apostle');
console.log(`PASS manifest: ${manifest.glbCount} GLBs, ${Object.keys(manifest.characters).length} cast IDs; Eight Witness identity separation verified.`);

const youthCapture = process.argv.find(argument => argument.startsWith('--capture-youth='))?.split('=').slice(1).join('=');
const prayerCapture = process.argv.find(argument => argument.startsWith('--capture-prayer='))?.split('=').slice(1).join('=');
if (!process.argv.includes('--browser') && !youthCapture && !prayerCapture) process.exit(0);
const {build} = await import('esbuild');
const {chromium} = await import('playwright');
const directory = await mkdtemp(path.join(tmpdir(), 'joseph-actors-'));
const bundle = path.join(directory, 'test.bundle.js');
const html = '<!doctype html><html><head><base href="/game/"></head><body style="margin:0"><script type="module" src="test.bundle.js"></script></body></html>';
await build({
  stdin: {
    contents: `
      import * as THREE from 'three';
      import {createActor,getAssetStatus,loadAssetManifest} from ${JSON.stringify(path.join(root, 'game/src/actors.js'))};
      const renderer=new THREE.WebGLRenderer({antialias:true});
      renderer.setSize(960,640);renderer.outputColorSpace=THREE.SRGBColorSpace;
      document.body.append(renderer.domElement);
      const scene=new THREE.Scene();scene.background=new THREE.Color('#d8e1cd');
      scene.add(new THREE.HemisphereLight('#fff4de','#617159',2));
      const sun=new THREE.DirectionalLight('#fff5e3',2);sun.position.set(-2,4,5);scene.add(sun);
      const camera=new THREE.PerspectiveCamera(40,1.5,.05,100);camera.position.set(0,1.3,4.3);camera.lookAt(0,.9,0);
      window.actorTest={scene,camera,renderer,createActor,getAssetStatus,loadAssetManifest,THREE};
    `,
    resolveDir: root, loader: 'js',
  },
  bundle: true, format: 'esm', outfile: bundle,
  nodePaths: [path.join(root, 'node_modules')],
});
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/game/' || pathname === '/game/index.html') {
      response.writeHead(200, {'Content-Type': 'text/html'});response.end(html);return;
    }
    let filename;
    if (pathname === '/game/test.bundle.js') filename = bundle;
    else filename = path.resolve(root, '.' + pathname);
    assert.ok(filename === bundle || filename.startsWith(root + path.sep));
    const info = await stat(filename);
    response.writeHead(200, {'Content-Length': info.size, 'Content-Type': filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.json') ? 'application/json' : 'model/gltf-binary'});
    createReadStream(filename).pipe(response);
  } catch (error) { response.writeHead(404);response.end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
let browser;
try {
  browser = await chromium.launch({headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: 960, height: 640}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/game/`);
  await page.waitForFunction(() => window.actorTest);
  if (youthCapture) {
    const filenames = await page.evaluate(async () => {
      const {scene, camera, renderer, createActor, loadAssetManifest} = window.actorTest;
      const manifest = await loadAssetManifest();
      const variants = manifest.characters.JOSEPH_YOUTH.variants.filter(asset => asset.rigged);
      const selected = variants.slice(0, 2);
      const actors = [];
      for (const [index, asset] of selected.entries()) {
        const id = `YOUTH_PROBE_${index}`;
        manifest.characters[id] = {label: asset.file, asset};
        const actor = await createActor({id, scene, position: [index * 1.5 - .75, 0, 0]});
        actor.setMotion('idle');actor.update(.016);actors.push(actor);
        const label = document.createElement('div');
        label.style = `position:absolute;left:${index * 50 + 3}%;top:20px;width:44%;font:15px sans-serif;overflow-wrap:anywhere;color:#1d302c`;
        label.textContent = asset.file;document.body.append(label);
      }
      camera.position.set(0, 1.15, 5.1);camera.lookAt(0, 1, 0);renderer.render(scene, camera);
      window.actorTest.probeActors = actors;
      return selected.map(asset => asset.file);
    });
    await page.screenshot({path: youthCapture});
    console.log(`Youth comparison: ${youthCapture}`, filenames);
    await page.evaluate(() => window.actorTest.probeActors.forEach(actor => actor.dispose()));
  }
  if (prayerCapture) {
    const poses = await page.evaluate(async () => {
      const {scene, camera, renderer, createActor} = window.actorTest;
      const actors = [];
      for (const [index, id] of ['JOSEPH_MATURE', 'JOSEPH_CHILD'].entries()) {
        const actor = await createActor({id, scene, position: [index * 1.5 - .75, 0, 0]});
        actor.setMotion('pray');actor.update(.016);actors.push(actor);
      }
      camera.position.set(.8, 1.2, 4.1);camera.lookAt(0, .7, 0);renderer.render(scene, camera);
      window.actorTest.probeActors = actors;
      return actors.map(actor => ({id: actor.id, pose: actor.root.userData.prayerPose}));
    });
    await page.screenshot({path: prayerCapture});
    console.log(`Prayer comparison: ${prayerCapture}`, poses);
    assert.ok(poses.every(entry => entry.pose === 'kneeling'), 'Joseph prayer fallback did not resolve leg chains');
    await page.evaluate(() => window.actorTest.probeActors.forEach(actor => actor.dispose()));
  }
  for (const id of ['JOSEPH_MATURE', 'JOSEPH_CHILD', 'JOSEPH_YOUTH', 'JOSEPH_YOUNG', 'EMMA', 'CHRISTIAN_WHITMER', 'JACOB_WHITMER', 'JOHN_WHITMER', 'HIRAM_PAGE', 'PETER_WHITMER_JR', 'SAMUEL_SMITH', 'FATHER', 'JOHN_BAPTIST', 'CHRIST', 'ALVIN', 'WILLARD', 'GRANDIN', 'WHITNEY', 'EDWARD_PARTRIDGE', 'ELIZA', 'ORSON', 'JOHN_TAYLOR', 'LOUISA']) {
    const result = await page.evaluate(async identity => {
      const {THREE, scene, camera, renderer, createActor, getAssetStatus} = window.actorTest;
      const actor = await createActor({id: identity, scene, position: [0, 0, 0]});
      const bounds = [];
      for (const motion of ['idle', 'walk', 'run', 'pray', 'idle']) {
        actor.setMotion(motion);
        for (let frame = 0; frame < 45; frame++) actor.update(1 / 60);
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(actor.root);
        const size = box.getSize(new THREE.Vector3());
        bounds.push({motion, height: size.y, bottom: box.min.y, top: box.max.y, pose: actor.root.userData.prayerPose});
        renderer.render(scene, camera);
      }
      const kind = actor.kind;
      actor.dispose();
      renderer.render(scene, camera);
      return {identity, kind, bounds, remaining: getAssetStatus().actors.length};
    }, id);
    for (const bounds of result.bounds) {
      assert.ok(bounds.height > .7 && bounds.height < 2.8, `${id} ${bounds.motion} collapsed or exploded: ${bounds.height}`);
      assert.ok(bounds.bottom > -.8 && bounds.bottom < .8, `${id} ${bounds.motion} left ground: ${bounds.bottom}`);
    }
    assert.ok(Math.abs(result.bounds[0].height - result.bounds.at(-1).height) < .0001, `${id} did not restore its original standing height after prayer`);
    assert.ok(Math.abs(result.bounds[0].bottom - result.bounds.at(-1).bottom) < .0001, `${id} did not restore its original ground position after prayer`);
    const prayer = result.bounds.find(bounds => bounds.motion === 'pray');
    if (prayer.pose === 'kneeling') assert.ok(prayer.top < result.bounds[0].top * .93, `${id} did not remain visibly kneeling during the held prayer`);
    assert.equal(result.remaining, 0, `Actor leak after ${id}`);
    console.log(`PASS browser: ${id} (${result.kind}), idle/walk/run/pray/idle remain correctly scaled.`);
  }
  assert.deepEqual(errors, [], `Browser errors: ${errors.join(', ')}`);
  for (const variant of ['white', 'red']) {
    const result = await page.evaluate(async requested => {
      const {createActor, loadAssetManifest, getAssetStatus} = window.actorTest;
      const manifest = await loadAssetManifest();
      const wardrobe = manifest.characters[`CHRIST_${requested.toUpperCase()}`];
      const expected = wardrobe?.asset ?? manifest.characters.CHRIST.asset;
      const actor = await createActor({id: 'CHRIST', variant: requested});
      const result = {id: actor.id, source: actor.source, expected: expected?.file ?? null, requested: actor.requestedVariant, active: getAssetStatus().actors.map(entry => entry.id)};
      actor.dispose();
      return result;
    }, variant);
    assert.equal(result.id, 'CHRIST', 'Garment must not change the character identity');
    assert.equal(result.source, result.expected, `Incorrect ${variant} garment fallback`);
    assert.equal(result.requested, variant);
    assert.deepEqual(result.active, ['CHRIST']);
    console.log(`PASS browser: Christ ${variant} garment resolves while preserving one CHRIST identity.`);
  }
  for (const variant of ['young', 'elder']) {
    const result = await page.evaluate(async requested => {
      const {createActor, loadAssetManifest} = window.actorTest;
      const manifest = await loadAssetManifest();
      const expected = manifest.characters[`ORSON_${requested.toUpperCase()}`]?.asset ?? manifest.characters.ORSON.asset;
      const actor = await createActor({id: 'ORSON', variant: requested});
      const result = {id: actor.id, source: actor.source, variant: actor.variant, expected: expected?.file ?? null};
      actor.dispose();
      return result;
    }, variant);
    assert.equal(result.id, 'ORSON');
    assert.equal(result.source, result.expected);
    if (result.source) assert.equal(result.variant, variant);
    console.log(`PASS browser: Orson ${variant} age resolves while preserving one ORSON identity.`);
  }
  const cache = await page.evaluate(() => window.actorTest.getAssetStatus().loadedModels);
  assert.equal(cache, 0, 'Model cache retained released actors');
  console.log('PASS browser: all actor resources released; no page errors.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(directory, {recursive: true, force: true});
}
