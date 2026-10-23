import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../game/src/world.js';
import {readFile} from 'node:fs/promises';

const content = JSON.parse(await readFile(new URL('../game/content/chapters.json', import.meta.url), 'utf8'));
for (const identity of ['01', '04', '08', '12', '26', '27', 'N1', 'B1']) {
  const chapter = content.chapters.find(entry => entry.id === identity);
  assert(chapter, identity);
  const scene = new THREE.Scene();
  const world = createWorld({scene, chapter, quality: 'low'});
  assert(world.bounds.maxX >= 100, `${identity}: surrounding landscape`);
  assert(world.summary.buildings >= 2, `${identity}: connected buildings`);
  assert(world.colliders.length > 20, `${identity}: actual architectural walls`);
  assert(world.group.children.some(object => object.name.startsWith('cutaway-roof:')), `${identity}: roof shells`);
  if (['01', '04', '08', '26', 'N1', 'B1'].includes(identity)) {
    const doorway = ['N1', 'B1'].includes(identity) ? {x: -20, z: -4.5} : {x: 0, z: 6.5};
    assert(!world.colliders.some(collider => collider.width && Math.abs(doorway.x - collider.x) < collider.width / 2 + .3 && Math.abs(doorway.z - collider.z) < collider.depth / 2 + .3 && (collider.minY ?? 0) < 1.55 && (collider.maxY ?? 4) > .18), `${identity}: doorway remains open`);
  }
  if (identity === '04') {
    let height = 0;
    for (let step = 0; step <= 140; step++) {
      const next = world.getGroundHeight(-5.3, 3.8 - step * .05, height);
      assert(Math.abs(next - height) < .1, 'Loft stair continuous ascent');
      height = next;
    }
    assert(Math.abs(height - 2.95) < .01, 'Loft height');
    assert.equal(world.getGroundHeight(0, 0, 2.95), 2.95);
    assert.equal(world.getGroundHeight(0, 0, 0), 0, 'Household room below loft');
  }
  world.dispose();
  assert.equal(scene.children.length, 0, 'World releases its scene group');
}
globalThis.document = {baseURI: 'http://127.0.0.1:8923/game/'};
const {chooseStandIn} = await import('../game/src/actors.js');
const manifest = JSON.parse(await readFile(new URL('../game/content/assets.json', import.meta.url), 'utf8'));
assert.equal(chooseStandIn('MOURNER', manifest), 'LOUISA');
assert.equal(chooseStandIn('CROWD_F_0', manifest), 'LOUISA');
assert.equal(chooseStandIn('LIFE_CROWD_F_1', manifest), 'LOUISA');
for (const identity of ['THOMAS_BULLOCK', 'MOB_M_1', 'OFFICER']) assert(/WHITMER|DAVID/.test(chooseStandIn(identity, manifest)));
for (const identity of ['ELIJAH_ABLE', 'WALKER_LEWIS', 'JANE_MANNING']) assert.equal(chooseStandIn(identity, manifest), null);
console.log('PASS 8 regional worlds, connected doorways, loft navigation, cleanup and requested stand-in policy.');
