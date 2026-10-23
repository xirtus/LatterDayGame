import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createActorAnimator, getMotionCacheStatus} from '../game/src/animation/actor-animator.js';

const library = JSON.parse(await readFile(new URL('../game/animations/manifest.json', import.meta.url), 'utf8'));
const assets = JSON.parse(await readFile(new URL('../game/content/assets.json', import.meta.url), 'utf8'));
globalThis.document = {baseURI: 'http://motion-bench.invalid/game/'};
globalThis.fetch = async () => ({ok: true, json: async () => library});

const bytes = await readFile(new URL('../meshy/' + assets.characters.JOSEPH_MATURE.asset.file, import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
const binary = bytes.subarray(28 + jsonLength);
function joseph(rotation = 0, scale = 1) {
  const joints = new Set(gltf.skins.flatMap(skin => skin.joints));
  const nodes = gltf.nodes.map((node, index) => {
    const object = joints.has(index) ? new THREE.Bone() : new THREE.Group();
    object.name = THREE.PropertyBinding.sanitizeNodeName(node.name ?? `node${index}`);
    object.position.fromArray(node.translation ?? [0, 0, 0]);
    object.quaternion.fromArray(node.rotation ?? [0, 0, 0, 1]);
    object.scale.fromArray(node.scale ?? [1, 1, 1]);
    return object;
  });
  gltf.nodes.forEach((node, index) => node.children?.forEach(child => nodes[index].add(nodes[child])));
  const figure = new THREE.Group(), holder = new THREE.Group(), root = new THREE.Group();
  for (const index of gltf.scenes[gltf.scene ?? 0].nodes) figure.add(nodes[index]);
  for (const skin of gltf.skins) {
    const accessor = gltf.accessors[skin.inverseBindMatrices], view = gltf.bufferViews[accessor.bufferView];
    const inverses = skin.joints.map((_, index) => new THREE.Matrix4().fromArray(Array.from({length: 16}, (_, component) => binary.readFloatLE((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + (index * 16 + component) * 4))));
    figure.skeleton = new THREE.Skeleton(skin.joints.map(index => nodes[index]), inverses);
  }
  holder.scale.setScalar(scale);holder.add(figure);root.add(holder);root.rotation.y = rotation;
  return {figure, holder, root, height: 1.8 * scale};
}

function minimalRig(variant) {
  const root = new THREE.Group(), holder = new THREE.Group(), figure = new THREE.Group();
  root.add(holder);holder.add(figure);
  function bone(name, parent, position) {
    const object = new THREE.Bone();object.name = name;object.position.fromArray(position);parent.add(object);return object;
  }
  const hips = bone('Hips', figure, [0, 1 + variant * .001, 0]);
  for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
    const upper = bone(side + 'Arm', hips, [.2 * sign, .5, 0]);
    const lower = bone(side + 'ForeArm', upper, [.2 * sign, -.1, 0]);
    bone(side + 'Hand', lower, [.2 * sign, -.1, 0]);
    const thigh = bone(side + 'UpLeg', hips, [.1 * sign, -.1, 0]);
    const shin = bone(side + 'Leg', thigh, [0, -.4, 0]);
    bone(side + 'Foot', shin, [0, -.4, 0]);
  }
  return {figure, holder, root, height: 1.8};
}

const firstStart = performance.now();
const first = await createActorAnimator(joseph());
const firstMs = performance.now() - firstStart;
first.setMotion('walk');first.update(.1);
const firstPose = first.profile.bones.LeftArm.quaternion.clone();
const sharedStart = performance.now();
const shared = await createActorAnimator(joseph(1.2, .9));
const sharedMs = performance.now() - sharedStart;
shared.setMotion('walk');shared.update(.1);
assert.ok(firstPose.angleTo(shared.profile.bones.LeftArm.quaternion) < .001, 'Cache reuse changed pose');
assert.equal(getMotionCacheStatus().misses, 1);
assert.equal(getMotionCacheStatus().hits, 1);
first.dispose();shared.dispose();
assert.equal(getMotionCacheStatus().activeProfiles, 0);
assert.equal(getMotionCacheStatus().profiles, 1);
const revisitStart = performance.now();
const revisit = await createActorAnimator(joseph());
const revisitMs = performance.now() - revisitStart;
assert.equal(getMotionCacheStatus().misses, 1, 'Chapter revisit rebaked an unchanged rig');
assert.equal(getMotionCacheStatus().hits, 2);
const retainedJosephBytes = getMotionCacheStatus().retainedBytes;
for (let variant = 0; variant < 14; variant++) {
  const actor = await createActorAnimator(minimalRig(variant));
  actor.dispose();
}
const beforeRelease = getMotionCacheStatus();
assert.equal(beforeRelease.activeProfiles, 1, 'Unused cache eviction affected an active actor');
assert.ok(beforeRelease.profiles <= beforeRelease.maximumIdleProfiles + beforeRelease.activeProfiles);
assert.ok(beforeRelease.unusedBytes <= beforeRelease.maximumIdleBytes);
const stillShared = await createActorAnimator(joseph());
assert.equal(getMotionCacheStatus().misses, 15, 'Active rig was evicted');
stillShared.dispose();revisit.dispose();
const final = getMotionCacheStatus();
assert.equal(final.activeProfiles, 0);
assert.ok(final.profiles <= final.maximumIdleProfiles);
assert.ok(final.unusedBytes <= final.maximumIdleBytes);
console.log(JSON.stringify({firstMs, sharedMs, revisitMs, retainedJosephBytes, cache: final}, null, 2));
console.log('PASS CPU motion cache: shared rigs, chapter revisits, rotated/scaled pose equivalence, active-entry protection and bounded retention.');
