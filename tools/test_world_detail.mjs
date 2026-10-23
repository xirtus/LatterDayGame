import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createWorld} from '../game/src/world.js';

const content = JSON.parse(await readFile(new URL('../game/content/chapters.json', import.meta.url), 'utf8'));
const results = [];
for (const id of ['01', '04', '08', '12', '26', '27', 'N1', 'B1', '30', 'BM03', 'BM21', 'BM24', 'E8']) {
  const chapter = content.chapters.find(item => item.id === id);
  const counts = [];
  for (const quality of ['low', 'high']) {
    const scene = new THREE.Scene();
    const world = createWorld({scene, chapter, quality});
    assert(world.detail.objects > 0, `${id}: authored set dressing`);
    counts.push(world.detail.objects);
    world.group.traverse(object => {
      assert(object.position.toArray().every(Number.isFinite), `${id}: finite positions`);
      if (object.geometry?.attributes.position) assert([...object.geometry.attributes.position.array].every(Number.isFinite), `${id}: finite geometry`);
    });
    for (const anchor of world.activityAnchors) {
      assert.equal(anchor.position.length, 3);
      assert(anchor.position.every(Number.isFinite));
    }
    if (id === '30') {
      assert.equal(world.getGroundHeight(0, 12, 0), 0);
      assert(Math.abs(world.getGroundHeight(1.15, 1.9, 3.35) - 3.35) < .01);
    }
    world.dispose();
    assert.equal(scene.children.length, 0, `${id}: scene cleanup`);
  }
  assert(counts[1] >= counts[0], `${id}: high quality detail budget`);
  results.push({id, lowObjects: counts[0], highObjects: counts[1]});
}
console.log(JSON.stringify({passed: results.length, results}, null, 2));
