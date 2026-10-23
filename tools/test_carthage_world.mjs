import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCarthageWorld, CARTHAGE_LAYOUT} from '../game/src/carthage-world.js';

const group = new THREE.Group();
const colliders = [];
const points = ['center', 'gather', 'study', 'prayer', 'journey'].map(id => ({id, position: new THREE.Vector3()}));
const materials = new Map();
const material = (color, options = {}) => {
  const key = color + JSON.stringify(options);
  if (!materials.has(key)) materials.set(key, new THREE.MeshToonMaterial({color, ...options}));
  return materials.get(key);
};
const mesh = (geometry, color, x, y, z, options = {}) => {
  const object = new THREE.Mesh(geometry, typeof color === 'string' ? material(color, options) : color);
  object.position.set(x, y, z);
  group.add(object);
  return object;
};
const box = (x, y, z, width, height, depth, color, options) => mesh(new THREE.BoxGeometry(width, height, depth), color, x, y, z, options);
const cylinder = (x, y, z, top, bottom, height, color, segments = 10) => mesh(new THREE.CylinderGeometry(top, bottom, height, segments), color, x, y, z);
const world = buildCarthageWorld({group, box, cylinder, mesh, material, colliders, points, spawn: new THREE.Vector3(), focus: new THREE.Vector3(), bounds: {}, tree() {}, fence() {}, curve() {}, book() {}});

function collides(position) {
  for (const collider of colliders) {
    if (collider.minY != null && position.y + 1.5 < collider.minY) continue;
    if (collider.maxY != null && position.y + .2 > collider.maxY) continue;
    if (collider.radius != null) {
      if (Math.hypot(position.x - collider.x, position.z - collider.z) < collider.radius + .3) return collider;
    } else if (Math.abs(position.x - collider.x) < collider.width / 2 + .3 && Math.abs(position.z - collider.z) < collider.depth / 2 + .3) return collider;
  }
  return false;
}

function walkRoute(route, initialY) {
  let height = initialY;
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1];
    const end = route[index];
    const samples = Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / .035);
    for (let sample = 0; sample <= samples; sample += 1) {
      const x = THREE.MathUtils.lerp(start[0], end[0], sample / samples);
      const z = THREE.MathUtils.lerp(start[1], end[1], sample / samples);
      height = world.getGroundHeight(x, z, height);
      const position = new THREE.Vector3(x, height, z);
      assert.equal(Boolean(collides(position)), false, `Route blocked at ${position.toArray()} by ${JSON.stringify(collides(position))}`);
    }
  }
  return height;
}

const route = [[0, 12], [0, 4.6], [-2.65, 4.6], [-2.65, -.85], [-1.2, -.85], [-1.2, 1], [1.15, 1], [1.15, 1.9]];
assert.equal(walkRoute(route, 0), CARTHAGE_LAYOUT.upperFloor);
assert.equal(walkRoute([...route].reverse(), CARTHAGE_LAYOUT.upperFloor), 0);
assert.equal(walkRoute([[-2.65, -.85], [-.3, -.85], [-.3, -3.25], [1.6, -3.25]], CARTHAGE_LAYOUT.upperFloor), CARTHAGE_LAYOUT.upperFloor);
assert.equal(world.objectivePoints.center[1], CARTHAGE_LAYOUT.upperFloor);
assert.equal(world.actorPositions.HYRUM[1], CARTHAGE_LAYOUT.upperFloor);
for (const [id, position] of Object.entries(world.objectivePoints)) assert.equal(Boolean(collides(new THREE.Vector3().fromArray(position))), false, `${id} target inside collider`);
assert.equal(world.getGroundHeight(1, 2, 0), 0);
assert.equal(world.getGroundHeight(1, 2, 3.35), 3.35);
assert.equal(group.userData.architecture.historicalBasement, false);
world.setInteriorView(new THREE.Vector3(0, 0, 2));
assert.equal(group.getObjectByName('carthage-roof-cutaway').visible, false);
assert.equal(group.getObjectByName('carthage-upper-floor-cutaway').visible, false);
world.setInteriorView(new THREE.Vector3(0, 3.35, 2));
assert.equal(group.getObjectByName('carthage-upper-floor-cutaway').visible, true);
world.setInteriorView(new THREE.Vector3(0, 3.35, 2), new THREE.Vector3(0, 5, 2));
assert.equal(group.getObjectByName('carthage-bedroom-ceiling-cutaway').visible, true);
world.setInteriorView(new THREE.Vector3(0, 3.35, 2), new THREE.Vector3(0, 7, 2));
assert.equal(group.getObjectByName('carthage-bedroom-ceiling-cutaway').visible, false);
world.setInteriorView(new THREE.Vector3(0, 0, 12));
assert.equal(group.getObjectByName('carthage-roof-cutaway').visible, true);
let meshCount = 0;
group.traverse(object => { if (object.isMesh) meshCount += 1; });
assert(meshCount < 2100, `Carthage geometry budget ${meshCount}`);
world.dispose();
console.log(`PASS Carthage stair ascent/descent, vertical collision, objective heights, cutaway, no basement; ${meshCount} meshes.`);
