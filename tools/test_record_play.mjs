import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createRecordPlay} from '../game/src/record-play.js';
import {createWorld} from '../game/src/world.js';

function mockWorld() {
  return {
    group: new THREE.Group(), colliders: [],
    getGroundHeight: () => 0,
    activityPoints: {
      'STONES-2': Array.from({length: 16}, (_, index) => [Math.cos(index / 16 * Math.PI * 2) * 8, 0, Math.sin(index / 16 * Math.PI * 2) * 8]),
    },
  };
}

const chapter = {objectives: [
  {id: 'STONES-2', target: [0, 0, 0], activity: {type: 'collect', count: 16, label: 'Prepare a clear stone'}},
  {id: 'PRAYER-1', target: [0, 0, -4], kind: 'pray'},
  {id: 'REPAIR-1', target: [14, 0, 0], activity: {type: 'repair', count: 3, label: 'Secure the vessel'}},
]};
const objective = chapter.objectives[0];
const world = mockWorld();
const persisted = [];
const activityEvents = [];
const objectiveEvents = [];
world.onActivity = (...values) => activityEvents.push(values);
world.onObjective = index => objectiveEvents.push(index);
const controller = createRecordPlay({chapter, world, changed: () => persisted.push({...controller.progress})});
const participation = world.group.getObjectByName('record-participation');
assert.equal(participation.children.length, 19, 'Sixteen separate stones and three repair stations');
assert.equal(controller.progress[objective.id], 0);
assert.match(controller.hint(objective), /0 \/ 16/);
assert.deepEqual(controller.target(objective), world.activityPoints[objective.id][0]);
controller.update(0, 2, false);
assert.deepEqual(objectiveEvents, [0]);
assert.equal(participation.children.filter(node => node.visible).length, 16);
controller.update(0, 3, false);
assert.deepEqual(objectiveEvents, [0], 'Repeated animation updates do not repeat objective entry');
activityEvents.length = 0;

const first = new THREE.Vector3().fromArray(controller.target(objective));
assert.equal(controller.act(objective, first.clone().add(new THREE.Vector3(0, 0, 2))), true, 'A pending task consumes the action before dialogue');
assert.equal(controller.progress[objective.id], 0, 'A distant interaction cannot collect a stone');
assert.equal(controller.act(objective, first.clone().add(new THREE.Vector3(0, 2, 0))), true);
assert.equal(controller.progress[objective.id], 0, 'Vertical separation also prevents collecting');
assert.equal(persisted.length, 0, 'Distant attempts do not persist false progress');
const visitedTargets = new Set();
for (let index = 0; index < 16; index++) {
  const target = controller.target(objective);
  visitedTargets.add(target.join(','));
  assert.equal(controller.act(objective, new THREE.Vector3().fromArray(target)), true);
  assert.equal(controller.progress[objective.id], index + 1);
  assert.equal(persisted.at(-1)[objective.id], index + 1, 'Each successful station persists independently');
  assert.deepEqual(activityEvents.at(-1), [objective.id, index + 1, 16]);
}
assert.equal(visitedTargets.size, 16, 'Collection advances through sixteen unique positions');
assert.equal(persisted.length, 16);
assert.equal(controller.hint(objective), null);
assert.deepEqual(controller.target(objective), objective.target, 'After collection the narrative encounter remains at its authored location');
assert.equal(controller.act(objective, new THREE.Vector3()), false, 'Completed activity no longer consumes the narrative interaction');
assert.equal(controller.act(chapter.objectives[1], new THREE.Vector3()), false, 'Prayer is never a collectible task');

controller.update(1, 4, true);
assert.equal(participation.children.filter(node => node.visible).length, 0);
const rotation = participation.children[0].children[1].rotation.y;
controller.update(2, 8, true);
assert.equal(participation.children.filter(node => node.visible).length, 3);
assert.equal(participation.children[0].children[1].rotation.y, rotation, 'Reduced motion stops station animation');
assert.deepEqual(objectiveEvents, [0, 1, 2]);
const geometries = new Set();
const materials = new Set();
participation.traverse(node => {
  if (node.geometry) geometries.add(node.geometry);
  if (node.material) materials.add(node.material);
});
let disposedGeometries = 0;
let disposedMaterials = 0;
geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposedGeometries++));
materials.forEach(material => material.addEventListener('dispose', () => disposedMaterials++));
controller.dispose();
assert.equal(world.group.children.length, 0);
assert.equal(disposedGeometries, 2);
assert.equal(disposedMaterials, 3);
console.log('PASS record activity: sixteen distinct stones, proximity, target advance, persistence, visibility, callbacks, reduced motion and cleanup.');

for (const [saved, expected] of [[6.9, 6], [-2, 0], [100, 16], [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0], ['broken', 0]]) {
  const restoredWorld = mockWorld();
  const restored = createRecordPlay({chapter, world: restoredWorld, progress: {[objective.id]: saved}});
  assert.equal(restored.progress[objective.id], expected);
  assert.deepEqual(restored.target(objective), expected < 16 ? restoredWorld.activityPoints[objective.id][expected] : objective.target);
  restored.update(0, 0, true);
  const nodes = restoredWorld.group.getObjectByName('record-participation').children.slice(0, 16);
  assert.equal(nodes.filter(node => node.children[1].material.color.getHexString() === 'fff0bb').length, expected);
  restored.dispose();
}
console.log('PASS record save recovery: partial progress restored, fractional values floored, invalid/negative/oversized values safely clamped.');

function intersectsBody(collider, position, radius = .36) {
  if (collider.minY != null && position[1] + 1.55 <= collider.minY) return false;
  if (collider.maxY != null && position[1] + .18 >= collider.maxY) return false;
  return collider.radius != null
    ? Math.hypot(position[0] - collider.x, position[2] - collider.z) < collider.radius + radius
    : Math.abs(position[0] - collider.x) < collider.width / 2 + radius && Math.abs(position[2] - collider.z) < collider.depth / 2 + radius;
}

const content = JSON.parse(await readFile(new URL('../game/content/chapters.json', import.meta.url), 'utf8'));
const failures = [];
let taskCount = 0;
let activityCount = 0;
const recordChapters = content.chapters.filter(entry => entry.record);
assert.equal(recordChapters.length, 28);
for (const source of recordChapters) {
  const recordChapter = structuredClone(source);
  const scene = new THREE.Scene();
  const recordWorld = createWorld({scene, chapter: recordChapter, quality: 'low'});
  for (const item of recordChapter.objectives) item.target = [...(recordWorld.objectivePoints?.[item.id] ?? recordWorld.objectivePoints?.[item.point] ?? item.target)];
  const recordPlay = createRecordPlay({chapter: recordChapter, world: recordWorld});
  recordChapter.objectives.forEach((item, objectiveIndex) => {
    recordPlay.update(objectiveIndex, 0, true);
    if (item.activity) {
      activityCount++;
      const targets = new Set();
      for (let index = 0; index < item.activity.count; index++) {
        const target = [...recordPlay.target(item)];
        targets.add(target.join(','));
        taskCount++;
        if (recordWorld.colliders.some(collider => intersectsBody(collider, target))) failures.push(`${item.id} task ${index + 1}: blocked body at ${target.map(value => value.toFixed(2)).join(',')}`);
        const floor = recordWorld.getGroundHeight(target[0], target[2], target[1]);
        if (Math.abs(floor - target[1]) >= .4) failures.push(`${item.id} task ${index + 1}: target height ${target[1]} differs from floor ${floor}`);
        if (target[0] < recordWorld.bounds.minX || target[0] > recordWorld.bounds.maxX || target[2] < recordWorld.bounds.minZ || target[2] > recordWorld.bounds.maxZ) failures.push(`${item.id} task ${index + 1}: outside movement bounds`);
        recordPlay.act(item, new THREE.Vector3().fromArray(target));
      }
      assert.equal(recordPlay.progress[item.id], item.activity.count);
      assert.equal(targets.size, item.activity.count, `${item.id}: each task has a distinct spatial station`);
    }
    recordWorld.onObjectiveComplete?.(objectiveIndex);
  });
  recordPlay.dispose();
  recordWorld.dispose();
  assert.equal(scene.children.length, 0);
}
assert.deepEqual(failures, [], `Generated station surface validation failed:\n${failures.join('\n')}`);
console.log(`PASS ${recordChapters.length} real record worlds: ${taskCount} generated stations across ${activityCount} activities have unblocked bodies, matching ground heights and valid bounds. This is station-surface validation, not proof of a complete walkable route.`);
