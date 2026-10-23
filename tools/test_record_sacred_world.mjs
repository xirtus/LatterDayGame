import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildRecordSacredWorld, SACRED_RECORD_IDS} from '../game/src/record-sacred-world.js';
import {buildRecordHill, RECORD_HILL_LANDMARKS} from '../game/src/record-hill.js';

for (const identity of SACRED_RECORD_IDS) {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);
  const materials = new Map();
  const geometries = new Set();
  const colliders = [];
  const chapter = {
    id: identity, recordId: identity,
    objectives: ['gather', 'study', 'prayer', 'journey'].map((point, index) => ({id: `${identity}-${index + 1}`, point})),
    actors: [{id: 'NEPHI', position: [0, 0, 0]}],
  };
  const material = (color, options = {}) => {
    const key = `${color}:${JSON.stringify(options)}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshToonMaterial({color, ...options}));
    return materials.get(key);
  };
  const mesh = (geometry, color, x, y, z, options = {}) => {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, typeof color === 'string' ? material(color, options) : color);
    object.position.set(x, y, z);
    group.add(object);
    return object;
  };
  const box = (x, y, z, width, height, depth, color, options) => mesh(new THREE.BoxGeometry(width, height, depth), color, x, y, z, options);
  const cylinder = (x, y, z, top, bottom, height, color, segments = 10) => mesh(new THREE.CylinderGeometry(top, bottom, height, segments), color, x, y, z);
  const sphere = (x, y, z, radius, color, detail = 1) => mesh(new THREE.IcosahedronGeometry(radius, detail), color, x, y, z);
  const context = {
    chapter, group, scene, box, cylinder, sphere, mesh, material, colliders,
    spawn: new THREE.Vector3(), focus: new THREE.Vector3(), bounds: {}, quality: 'low',
    curve() {}, tree(x, z) {sphere(x, 4, z, 2, '#78905e'); colliders.push({x, z, radius: .4});}, book() {},
  };
  const world = buildRecordSacredWorld(context);
  assert.equal(world.summary.recordId, identity);
  assert(world.summary.landmarks.length || identity === 'BM08');
  assert(group.children.length > 20);
  assert(context.bounds.maxX >= 70);
  for (const objective of chapter.objectives) {
    const target = world.objectivePoints[objective.id];
    assert(target.every(Number.isFinite));
    assert.equal(world.getGroundHeight(target[0], target[2], target[1]), target[1], `${identity}: objective floor`);
    const blocked = colliders.filter(collider => {
      if ((collider.minY ?? 0) > target[1] + 1.55 || (collider.maxY ?? 10) < target[1] + .18) return false;
      if (collider.radius) return Math.hypot(target[0] - collider.x, target[2] - collider.z) < collider.radius + .35;
      return Math.abs(target[0] - collider.x) < collider.width / 2 + .35 && Math.abs(target[2] - collider.z) < collider.depth / 2 + .35;
    });
    assert.equal(blocked.length, 0, `${identity}: ${objective.id} blocked by ${JSON.stringify(blocked)}`);
  }
  for (const [objective, stations] of Object.entries(world.activityPoints)) for (const target of stations) {
    const obstructed = colliders.some(collider => {
      if ((collider.minY ?? 0) > target[1] + 1.55 || (collider.maxY ?? 10) < target[1] + .18) return false;
      if (collider.radius) return Math.hypot(target[0] - collider.x, target[2] - collider.z) < collider.radius + .35;
      return Math.abs(target[0] - collider.x) < collider.width / 2 + .35 && Math.abs(target[2] - collider.z) < collider.depth / 2 + .35;
    });
    assert(!obstructed, `${objective}: activity station accessible ${JSON.stringify(target)}`);
  }
  if (identity === 'BM06') {
    assert.equal(group.children.filter(object => object.name.startsWith('jared-light-stone-')).length, 16);
    assert.equal(world.summary.stonesPerVessel, 2);
    assert.equal(world.activityPoints['BM06-2'].length, 16);
    assert.equal(world.activityPoints['BM06-4'].length, 8);
    const lightStone = group.children.find(object => object.name === 'jared-light-stone-1');
    world.update(.016, 1, new THREE.Vector3(0, 0, -17));
    assert.equal(lightStone.material.emissiveIntensity, 0, 'Approach does not trigger light before the prayer');
    world.onObjectiveComplete(2);
    world.update(.016, 1, context.spawn);
    assert(lightStone.material.emissiveIntensity > .5, 'Encounter lights the stones after prayer');
  }
  if (identity === 'BM20') {
    let height = 0;
    for (let step = 0; step <= 145; step += 1) {
      const next = world.getGroundHeight(-12, 7.4 - step * .1, height);
      assert(Math.abs(next - height) < .1, 'Samuel stair continuous ascent');
      height = next;
    }
    assert.equal(height, 4.2);
  }
  if (identity === 'BM25') {
    const historical = buildRecordHill({...context, group: new THREE.Group(), colliders: []});
    assert.deepEqual(historical.summary.sharedLandmarks, world.summary.sharedLandmarks);
    assert.deepEqual(world.summary.sharedLandmarks.recordBox, RECORD_HILL_LANDMARKS.recordBox);
    assert.deepEqual(historical.objectivePoints.center, world.objectivePoints['BM25-3']);
    assert.equal(historical.getGroundHeight(0, -5), 0);
  }
  world.update(.016, 10, context.spawn, new THREE.Vector3(0, 5, 25));
  world.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const surface of materials.values()) surface.dispose();
}
console.log(`PASS ${SACRED_RECORD_IDS.length} distinct sacred record worlds, accessible objectives, Samuel stair, sixteen stones, and cleanup.`);
