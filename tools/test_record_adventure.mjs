import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildRecordAdventureWorld} from '../game/src/record-adventure-world.js';

const identities = ['BM05', 'BM07', 'BM15', 'BM16', 'BM17', 'BM18', 'BM19', 'BM24', 'TX01', 'TX02', 'TX03'];
let checks = 0;
for (const recordId of identities) {
  const group = new THREE.Group();
  const scene = new THREE.Scene();
  const colliders = [];
  const spawn = new THREE.Vector3();
  const bounds = {};
  const material = (color, options = {}) => new THREE.MeshToonMaterial({color, ...options});
  const mesh = (geometry, color, x, y, z, options = {}) => {
    const object = new THREE.Mesh(geometry, typeof color === 'string' ? material(color, options) : color);
    object.position.set(x, y, z);
    group.add(object);
    return object;
  };
  const box = (x, y, z, width, height, depth, color, options) => mesh(new THREE.BoxGeometry(width, height, depth), color, x, y, z, options);
  const cylinder = (x, y, z, top, bottom, height, color, segments = 10) => mesh(new THREE.CylinderGeometry(top, bottom, height, segments), color, x, y, z);
  const sphere = (x, y, z, radius, color, detail = 1) => mesh(new THREE.IcosahedronGeometry(radius, detail), color, x, y, z);
  const chapter = {id: recordId, recordId, objectives: ['gather', 'study', 'prayer', 'journey'].map((point, index) => ({id: `${recordId}-${index + 1}`, point})), actors: [{id: 'COMPANION'}]};
  const context = {scene, group, chapter, box, cylinder, sphere, mesh, material, colliders, spawn, focus: new THREE.Vector3(), bounds, points: [], tree(x, z) {colliders.push({x, z, radius: .4});}, curve() {}, book() {}};
  const world = buildRecordAdventureWorld(context);
  assert.equal(world.summary.recordId, recordId);
  assert.equal(world.summary.navigable, true);
  function blocked(x, z) {
    return colliders.some(collider => {
      if (collider.minY > 1.55 || collider.maxY < .18) return false;
      return collider.radius != null ? Math.hypot(x - collider.x, z - collider.z) < collider.radius + .3 : Math.abs(x - collider.x) < collider.width / 2 + .3 && Math.abs(z - collider.z) < collider.depth / 2 + .3;
    });
  }
  assert(!blocked(spawn.x, spawn.z), `${recordId} blocked spawn`);
  for (const objective of chapter.objectives) {
    const target = world.objectivePoints[objective.id];
    assert.equal(target.length, 3);
    assert(!blocked(target[0], target[2]), `${recordId} target ${objective.id} is blocked`);
    assert(target[0] > bounds.minX && target[0] < bounds.maxX && target[2] > bounds.minZ && target[2] < bounds.maxZ);
  }
  const start = [Math.round(spawn.x), Math.round(spawn.z)];
  const queue = [start];
  const visited = new Set([start.join(',')]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const position = queue[cursor];
    for (const direction of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [position[0] + direction[0], position[1] + direction[1]];
      const key = next.join(',');
      if (visited.has(key) || next[0] <= bounds.minX || next[0] >= bounds.maxX || next[1] <= bounds.minZ || next[1] >= bounds.maxZ || blocked(next[0], next[1])) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  for (const objective of chapter.objectives) {
    const target = world.objectivePoints[objective.id];
    assert(visited.has(`${Math.round(target[0])},${Math.round(target[2])}`), `${recordId} objective ${objective.id} is unreachable from spawn`);
  }
  for (const portal of world.localPortals ?? []) {
    assert(!blocked(portal.position[0], portal.position[2]), `${recordId} portal ${portal.id} is blocked`);
    assert(visited.has(`${Math.round(portal.position[0])},${Math.round(portal.position[2])}`), `${recordId} portal ${portal.id} is unreachable`);
  }
  for (let index = 0; index < 4; index += 1) {
    world.onObjective(index);
    world.update(.016, index, spawn, new THREE.Vector3(0, 10, 0));
    world.onComplete(index);
  }
  if (recordId === 'BM16') assert.equal(group.getObjectByName('record-prison-standing-walls').visible, false);
  if (recordId === 'BM17') assert.equal(world.summary.nonDamagingFire, true);
  if (recordId === 'BM18') assert.equal(world.summary.finalEscape, false);
  if (recordId === 'BM24') assert.equal(world.summary.victory, false);
  if (recordId === 'TX01') {
    assert.equal(world.summary.temporalState, 'zion');
    assert.equal(world.localPortals.length, 3);
    for (const [identity, state] of [['eden', 'garden'], ['desert', 'desert'], ['zion', 'zion']]) {
      assert(world.activatePortal(identity));
      assert.equal(world.summary.temporalState, state);
      world.update(.016, 8, spawn, new THREE.Vector3(0, 10, 0));
      assert.equal(world.summary.temporalState, state, 'Manual local travel persists between frames');
    }
    assert.equal(world.activatePortal('missing'), false);
  }
  world.dispose();
  group.traverse(object => {
    object.geometry?.dispose();
    if (object.material && !Array.isArray(object.material)) object.material.dispose();
  });
  checks += 1;
}
console.log(`PASS ${checks} adventure worlds: objective clearance, walk-grid reachability, lifecycle and distinct historical guardrails.`);
