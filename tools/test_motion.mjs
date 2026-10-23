import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {readFile, mkdtemp, mkdir, rm, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = JSON.parse(await readFile(path.join(root, 'game/animations/manifest.json'), 'utf8'));
for (const name of ['idle', 'walk', 'run', 'talk', 'listen', 'sit', 'prayer', 'work', 'fear', 'attack', 'guard']) {
  const clip = library.clips[name];
  assert.ok(clip && clip.duration > 0 && clip.source);
  assert.equal(clip.data.length, library.segments.length * 3 * clip.frames);
  assert.ok(clip.data.every(Number.isFinite));
}
assert.equal(Object.keys(library.sources).length, 8);
assert.equal(library.targetAudit.length, 4);
assert.ok(library.targetAudit.every(profile => profile.maximumBindPositionResidual < .0001));
const directory = await mkdtemp(path.join(tmpdir(), 'joseph-motion-'));
const bundle = path.join(directory, 'test.js');
const evidence = path.join(root, 'game/animations/evidence');
await mkdir(evidence, {recursive: true});
await build({stdin: {contents: `
  import * as THREE from 'three';
  import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
  import {createActor,getAssetStatus,loadAssetManifest} from ${JSON.stringify(path.join(root, 'game/src/actors.js'))};
  const renderer = new THREE.WebGLRenderer({antialias:true});renderer.setSize(1440,720);renderer.outputColorSpace=THREE.SRGBColorSpace;
  document.body.append(renderer.domElement);
  const scene = new THREE.Scene();scene.background = new THREE.Color('#cdd9d7');
  scene.add(new THREE.HemisphereLight('#fff4de','#657566',2));
  const light = new THREE.DirectionalLight('#fff6e8',2.3);light.position.set(-3,5,4);scene.add(light);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:'#a6b2a1'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;scene.add(floor);
  const camera = new THREE.PerspectiveCamera(34,2,.05,100);camera.position.set(0,1.8,6.5);camera.lookAt(0,.9,0);camera.updateMatrixWorld(true);
  window.motionTest={THREE,GLTFLoader,renderer,scene,camera,createActor,getAssetStatus,loadAssetManifest,actors:[]};
`, resolveDir: root, loader: 'js'}, bundle: true, format: 'esm', outfile: bundle});
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/game/') { response.writeHead(200, {'Content-Type': 'text/html'}); response.end('<!doctype html><base href="/game/"><body style="margin:0"><script type="module" src="motion-test.js"></script>'); return; }
    const filename = pathname === '/game/motion-test.js' ? bundle : path.resolve(root, '.' + pathname);
    assert.ok(filename === bundle || filename.startsWith(root + path.sep));
    const info = await stat(filename);
    response.writeHead(200, {'Content-Length': info.size, 'Content-Type': filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.json') ? 'application/json' : 'application/octet-stream'});
    createReadStream(filename).pipe(response);
  } catch (error) { response.writeHead(404); response.end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: 1440, height: 720}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/game/`);
  await page.waitForFunction(() => window.motionTest);
  const measurements = await page.evaluate(async () => {
    const test = window.motionTest;
    const {THREE,createActor,loadAssetManifest,GLTFLoader} = test;
    const manifest = await loadAssetManifest();
    const result = [];
    const armAngle = (arm, forearm) => {
      const vector = forearm.getWorldPosition(new THREE.Vector3()).sub(arm.getWorldPosition(new THREE.Vector3())).normalize();
      return Math.atan2(Math.abs(vector.x), -vector.y) * 180 / Math.PI;
    };
    for (const [index,id] of ['JOSEPH_MATURE','EMMA','CHRIST','LOUISA'].entries()) {
      const actor = await createActor({id, scene: test.scene, position: [index * 1.8 - 2.7,0,0]});test.actors.push(actor);
      const projected=actor.root.position.clone().setY(1).project(test.camera);
      const label = document.createElement('div');label.style='position:absolute;top:40px;left:'+((projected.x*.5+.5)*100)+'%;transform:translateX(-50%);font:600 18px sans-serif;color:#243c37';label.textContent=id;document.body.append(label);
      const original = await new GLTFLoader().loadAsync(new URL(manifest.characters[id].asset.url, new URL('./content/assets.json',document.baseURI)).href);
      const bones = {};original.scene.traverse(object => {if(object.isBone) bones[object.name.replace(/^mixamorig[:|]?/i,'')]=object;});
      const nativeMixer = new THREE.AnimationMixer(original.scene);nativeMixer.clipAction(original.animations.find(clip=>/walk/i.test(clip.name))).play();
      const nativeAngles = [], revisedAngles = [], ankleHeights = [];
      actor.setMotion('walk');
      for(let frame=0;frame<180;frame++) {
        nativeMixer.update(1/60);original.scene.updateMatrixWorld(true);actor.update(1/60);
        if(frame<20) continue;
        for(const side of ['Left','Right']) {
          nativeAngles.push(armAngle(bones[side+'Arm'],bones[side+'ForeArm']));
          revisedAngles.push(armAngle(actor.getSocket(side+'Arm'),actor.getSocket(side+'ForeArm')));
        }
        ankleHeights.push(Math.min(actor.getBoneSocket('LeftFoot').y,actor.getBoneSocket('RightFoot').y));
      }
      const origin=actor.root.position.clone();
      actor.setMotion('idle');for(let frame=0;frame<30;frame++)actor.update(1/60);
      const idleBefore=actor.getSocket('Spine').quaternion.clone();for(let frame=0;frame<120;frame++)actor.update(1/60);
      const idleChange=idleBefore.angleTo(actor.getSocket('Spine').quaternion);
      actor.setMotion('speak');actor.update(1/60);
      const transition=actor.getAnimationDiagnostics();
      for(let frame=0;frame<40;frame++)actor.update(1/60);
      const retired=actor.getAnimationDiagnostics();
      actor.setMotion('sit');for(let frame=0;frame<180;frame++)actor.update(1/60);
      const sitHip=actor.getBoneSocket('Hips').y;
      const legs=['LeftUpLeg','LeftLeg','RightUpLeg','RightLeg'].map(name=>actor.getSocket(name).quaternion.clone());
      actor.setMotion('talk');for(let frame=0;frame<60;frame++)actor.update(1/60);
      const seatedLegDelta=Math.max(...legs.map((quaternion,index)=>quaternion.angleTo(actor.getSocket(['LeftUpLeg','LeftLeg','RightUpLeg','RightLeg'][index]).quaternion)));
      actor.setMotion('work');for(let frame=0;frame<60;frame++)actor.update(1/60);
      const seatedWorkLegDelta=Math.max(...legs.map((quaternion,index)=>quaternion.angleTo(actor.getSocket(['LeftUpLeg','LeftLeg','RightUpLeg','RightLeg'][index]).quaternion)));
      result.push({id,nativeMeanAbduction:nativeAngles.reduce((sum,value)=>sum+value,0)/nativeAngles.length,revisedMeanAbduction:revisedAngles.reduce((sum,value)=>sum+value,0)/revisedAngles.length,revisedMaximumAbduction:Math.max(...revisedAngles),supportRange:Math.max(...ankleHeights)-Math.min(...ankleHeights),idleChange,transition,retired,sitHip,seatedLegDelta,seatedWorkLegDelta,rootDrift:origin.distanceTo(actor.root.position),diagnostics:actor.getAnimationDiagnostics()});
      nativeMixer.stopAllAction();nativeMixer.uncacheRoot(original.scene);
      original.scene.traverse(object=>{object.geometry?.dispose();for(const material of [].concat(object.material??[])){material.map?.dispose();material.dispose();}});
    }
    return result;
  });
  await writeFile(path.join(evidence,'measurements.json'),JSON.stringify({libraryVersion:library.version,actors:measurements,errors},null,2)+'\n');
  for (const row of measurements) {
    assert.ok(row.revisedMeanAbduction < row.nativeMeanAbduction * .8, `${row.id}: arms did not improve`);
    assert.ok(row.revisedMaximumAbduction < 38, `${row.id}: locomotion arms remain wide`);
    assert.ok(row.supportRange < .002, `${row.id}: ankle support drift`);
    assert.ok(row.idleChange > .0001, `${row.id}: frozen idle`);
    assert.equal(row.transition.activeActions, 2);
    assert.equal(row.retired.activeActions, 1);
    assert.ok(row.sitHip > .35 && row.sitHip < .85, `${row.id}: seated hip lost target units`);
    assert.ok(row.seatedLegDelta < .001, `${row.id}: talking unseats actor`);
    assert.ok(row.seatedWorkLegDelta < .001, `${row.id}: work unseats actor`);
    assert.equal(row.rootDrift, 0);
    assert.equal(row.diagnostics.rootMotionOwner, 'motor');
    assert.ok(!row.diagnostics.fallback);
  }
  for (const motion of ['idle','walk','talk','sit','pray','work','guard','attack','crouch']) {
    await page.evaluate(state => {
      const {actors,renderer,scene,camera}=window.motionTest;
      for(const actor of actors){actor.setMotion('idle');actor.setMotion(state);for(let frame=0;frame<(state==='sit'?180:75);frame++)actor.update(1/60);}
      renderer.render(scene,camera);
    }, motion);
    await page.screenshot({path:path.join(evidence,`${motion}.png`)});
  }
  assert.deepEqual(errors, []);
  const frameInvariant = await page.evaluate(async () => {
    const {THREE,createActor,actors}=window.motionTest;
    const reference=actors[0],rotated=await createActor({id:'JOSEPH_MATURE',position:[8,.5,3],rotation:1.2,height:1.6});
    for(const actor of [reference,rotated]){actor.setMotion('walk',{restart:true});for(let frame=0;frame<90;frame++)actor.update(1/60);}
    const localArm=actor=>actor.getBoneSocket('LeftForeArm').sub(actor.getBoneSocket('LeftArm')).normalize().applyQuaternion(actor.root.getWorldQuaternion(new THREE.Quaternion()).invert());
    const result={directionError:localArm(reference).distanceTo(localArm(rotated)),sameFingerprint:reference.getAnimationDiagnostics().fingerprint===rotated.getAnimationDiagnostics().fingerprint,height:rotated.getBoneSocket('Head').y-rotated.root.position.y};
    rotated.dispose();return result;
  });
  assert.ok(frameInvariant.directionError < .0001, 'Cached retarget changed with actor facing');
  assert.equal(frameInvariant.sameFingerprint, true, 'Identical rig could not reuse calibration');
  assert.ok(frameInvariant.height > 1 && frameInvariant.height < 1.8, 'Actor scaling lost in reused retarget');
  await page.evaluate(()=>window.motionTest.actors.forEach(actor=>actor.dispose()));
  assert.equal(await page.evaluate(()=>window.motionTest.getAssetStatus().loadedModels),0);
  const standinRegression = await page.evaluate(async () => {
    const {THREE,createActor,loadAssetManifest,scene,camera,renderer}=window.motionTest;
    const manifest=await loadAssetManifest(),profile=manifest.characters.PETER_WHITMER_JR,selected=profile.asset;
    profile.asset=profile.variants.find(asset=>asset.file==='peter_whitmer_jr_rigged.glb');
    const actors=[],result=[];
    document.querySelectorAll('div').forEach(element=>element.remove());
    for(const[index,id]of ['PETER_WHITMER_JR','MORMON'].entries()) {
      const actor=await createActor({id,scene,position:[index*1.8-.9,0,0]});actors.push(actor);
      const poses=[];
      for(const state of ['idle','walk']) {
        actor.setMotion(state);for(let frame=0;frame<60;frame++)actor.update(1/60);
        const direction=actor.getBoneSocket('LeftForeArm').sub(actor.getBoneSocket('LeftArm')).normalize();
        let skinnedMeshes=0;actor.root.traverse(object=>{if(object.isSkinnedMesh)skinnedMeshes++;});
        poses.push({state,angle:Math.atan2(Math.abs(direction.x),-direction.y)*180/Math.PI,skinnedMeshes});
      }
      result.push({id,source:actor.source,kind:actor.kind,standInId:actor.standInId,expected:selected.file,poses});
      const label=document.createElement('div');label.style='position:absolute;top:40px;left:'+(index?65:35)+'%;transform:translateX(-50%);font:600 18px sans-serif;color:#243c37';label.textContent=id;document.body.append(label);
    }
    profile.asset=selected;camera.position.set(0,1.6,4.8);camera.lookAt(0,.9,0);renderer.render(scene,camera);
    window.motionTest.standinActors=actors;return result;
  });
  for(const actor of standinRegression) {
    assert.equal(actor.source,actor.expected,'Stale manifest did not recover to a skinned same-identity variant');
    assert.ok(actor.poses.every(pose=>pose.skinnedMeshes>0&&pose.angle<40),'Peter/Mormon mesh remained T-posed');
  }
  assert.equal(standinRegression[0].kind,'model');
  assert.equal(standinRegression[1].standInId,'PETER_WHITMER_JR');
  await page.screenshot({path:path.join(evidence,'peter-mormon-regression.png')});
  await page.evaluate(()=>window.motionTest.standinActors.forEach(actor=>actor.dispose()));
  assert.equal(await page.evaluate(()=>window.motionTest.getAssetStatus().loadedModels),0);
  await writeFile(path.join(evidence,'peter-mormon-regression.json'),JSON.stringify(standinRegression,null,2)+'\n');
  await writeFile(path.join(evidence,'measurements.json'),JSON.stringify({libraryVersion:library.version,actors:measurements,frameInvariant,errors},null,2)+'\n');
  console.log(JSON.stringify(measurements.map(({id,nativeMeanAbduction,revisedMeanAbduction,idleChange,sitHip})=>({id,nativeMeanAbduction,revisedMeanAbduction,idleChange,sitHip})),null,2));
  console.log('PASS motion bench: four rig profiles, grounded walk, live idle, blended talk, seated legs, root ownership and released resources.');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
  await rm(directory,{recursive:true,force:true});
}
