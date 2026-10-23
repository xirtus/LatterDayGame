import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createNavigation, segmentBlocked} from '../game/src/ai/nav-world.js';
import {createKnowledge, hearNoise, updatePerception, visibility} from '../game/src/ai/perception.js';
import {applyImpact, createCombatant, requestAttack, tickCombatant} from '../game/src/combat/combatant.js';
import {resolveStrike} from '../game/src/combat/hit-resolver.js';
import {createEncounterRuntime, getEncounterActorConfigs} from '../game/src/encounters/encounter-runtime.js';
import {createWorld} from '../game/src/world.js';

const actor = (id, position = [0, 0, 0], rotation = 0) => {
  const root = new THREE.Group();
  root.position.fromArray(position);
  root.rotation.y = rotation;
  return {id, root, setMotion(motion) { this.motion = motion; }};
};
const world = (colliders = []) => ({colliders, bounds: {minX: -100, maxX: 100, minZ: -100, maxZ: 100}, spawn: new THREE.Vector3(0, 0, 8), getGroundHeight: () => 0});
const chapter = id => ({id, environment: 'town', objectives: [{kind: 'inspect'}, {kind: 'travel'}, {kind: 'serve'}, {kind: 'pray'}]});
const results = [];
function check(name, run) { run(); results.push(name); }

check('navigation routes around a solid wall and respects actor clearance', () => {
  const nav = createNavigation(world([{x: 0, z: 0, width: 1, depth: 5, minY: 0, maxY: 3}]));
  const start = {x: -3, y: 0, z: 0};
  const goal = {x: 3, y: 0, z: 0};
  assert.equal(nav.traversable(start, goal), false);
  const path = nav.findPath(start, goal);
  assert(path.length > 2);
  let previous = start;
  for (const step of path) { assert(nav.traversable(previous, step)); previous = step; }
  assert(path.some(step => Math.abs(step.z) > 2.7));
  assert(nav.reserve('chair', 'one'));
  assert.equal(nav.reserve('chair', 'two'), false);
  nav.release('one');
  assert(nav.reserve('chair', 'two'));
});

check('closed doors obstruct sight and walking; open doors and persistence restore both', () => {
  const nav = createNavigation(world());
  const start = {x: 0, y: 0, z: 2};
  const goal = {x: 0, y: 0, z: -2};
  nav.setDoor('treasury', {x: 0, z: 0, width: 2, depth: .2, minY: 0, maxY: 2.5, open: false});
  assert.equal(nav.traversable(start, goal), false);
  assert(nav.blocked({...start, y: 1.5}, {...goal, y: 1.5}));
  const save = nav.getState();
  nav.setDoor('treasury', {open: true});
  assert(nav.traversable(start, goal));
  nav.restore(save);
  assert.equal(nav.traversable(start, goal), false);
  assert.equal(nav.blocked({...start, y: 4}, {...goal, y: 4}), false);
});

check('sloped stairs connect levels while sheer floor changes are rejected', () => {
  const stairs = world();
  stairs.getGroundHeight = (x, z, height = 0) => x > -1 && x < 1 && z > 0 && z < 5 ? (5 - z) * .67 : z <= 0 && height > 2.5 ? 3.35 : 0;
  const nav = createNavigation(stairs);
  assert(nav.traversable({x: 0, y: 0, z: 5}, {x: 0, y: 3.35, z: -.2}));
  const cliff = world();
  cliff.getGroundHeight = (x, z) => z < 0 ? 3.35 : 0;
  assert.equal(createNavigation(cliff).traversable({x: 0, y: 0, z: 1}, {x: 0, y: 3.35, z: -1}), false);
});

check('vision uses body, cone, posture and real door occlusion', () => {
  const observer = actor('watch', [0, 0, 0]);
  const target = actor('player', [0, 0, 7]);
  const nav = createNavigation(world());
  const standing = visibility(observer, target, nav);
  assert(standing > 0);
  assert(visibility(observer, target, nav, {crouching: true}) < standing);
  observer.root.rotation.y = Math.PI;
  assert.equal(visibility(observer, target, nav), 0);
  observer.root.rotation.y = 0;
  nav.setDoor('door', {x: 0, z: 3, width: 3, depth: .2, minY: 0, maxY: 3});
  assert.equal(visibility(observer, target, nav), 0);
  nav.setDoor('door', {open: true});
  assert(visibility(observer, target, nav) > 0);
});

check('knowledge progresses through alert, last-known search, cooldown and recovery', () => {
  const observer = actor('watch');
  const target = actor('player', [0, 0, 3]);
  const nav = createNavigation(world());
  const knowledge = createKnowledge();
  const phases = new Set();
  for (let tick = 0; tick < 60; tick += 1) { updatePerception(observer, target, knowledge, nav, .1, tick / 10); phases.add(knowledge.phase); }
  assert(phases.has('suspicious') && phases.has('investigate') && phases.has('alert'));
  const lastKnown = {...knowledge.lastKnown};
  target.root.position.set(50, 0, 50);
  for (let tick = 60; tick < 400; tick += 1) { updatePerception(observer, target, knowledge, nav, .1, tick / 10); phases.add(knowledge.phase); }
  assert(phases.has('search') && phases.has('cooldown'));
  assert.equal(knowledge.phase, 'routine');
  assert.deepEqual(knowledge.lastKnown, lastKnown);
});

check('noise is attenuated by walls and never supplies all-map knowledge', () => {
  const observer = actor('watch');
  const nav = createNavigation(world([{x: 0, z: 2, width: 6, depth: .2, minY: 0, maxY: 3}]));
  const knowledge = createKnowledge();
  assert.equal(hearNoise(observer, knowledge, {kind: 'running', position: {x: 0, y: 0, z: 5}, strength: 10}, nav, 1), false);
  assert.equal(knowledge.lastKnown, null);
  assert(hearNoise(observer, knowledge, {kind: 'door', position: {x: 1, y: 0, z: 1}, strength: 8}, nav, 2));
  assert.equal(knowledge.phase, 'investigate');
  assert.equal(knowledge.source, 'door');
});

function replay(rate, {guard = false, wall = false} = {}) {
  const attacker = {actor: actor('attack'), combat: createCombatant('attack')};
  const target = {actor: actor('target', [0, 0, 1.4], Math.PI), combat: createCombatant('target')};
  target.combat.guarding = guard;
  const nav = createNavigation(world(wall ? [{x: 0, z: .7, width: 4, depth: .15, minY: 0, maxY: 3}] : []));
  assert(requestAttack(attacker.combat));
  const impacts = [];
  let accumulator = 0;
  for (let frame = 0; frame < rate; frame += 1) {
    accumulator += 1 / rate;
    while (accumulator + 1e-9 >= 1 / 60) {
      tickCombatant(attacker.combat, 1 / 60);
      tickCombatant(target.combat, 1 / 60);
      resolveStrike(attacker, [target], nav, event => impacts.push(event));
      accumulator -= 1 / 60;
    }
  }
  return {health: target.combat.health, stamina: target.combat.stamina, impacts};
}

check('swept strikes deduplicate damage and render rate does not change outcomes', () => {
  const slow = replay(30);
  assert.equal(slow.health, 78);
  assert.equal(slow.impacts.length, 1);
  assert.deepEqual(replay(60), slow);
  assert.deepEqual(replay(120), slow);
});

check('guard arc and stamina block pressure; walls and protected actors block damage', () => {
  assert.equal(replay(60, {guard: true}).health, 100);
  assert.equal(replay(60, {guard: true}).impacts[0].result, 'blocked');
  assert.equal(replay(60, {wall: true}).health, 100);
  const protectedActor = createCombatant('Christ', {protected: true});
  assert.equal(applyImpact(protectedActor, {x: 0, z: 0}, {x: 0, z: 1}, 0), 'protected');
  assert.equal(protectedActor.health, 100);
  const guard = createCombatant('guard');
  guard.guarding = true;
  assert.equal(applyImpact(guard, {x: 0, z: -1}, {x: 0, z: 0}, 0), 'hit');
  const exhausted = createCombatant('tired');
  exhausted.stamina = 10;
  assert.equal(requestAttack(exhausted), false);
});

check('runtime enforces whitelist and objective gates while allowing optional challenge', () => {
  for (const id of ['01', '30', 'BM03', 'BM14', 'BM21', 'BM22', 'BM25']) {
    const runtime = createEncounterRuntime({chapter: chapter(id), world: world(), actors: [], player: actor('JOSEPH_MATURE')});
    runtime.handleAction('challenge', {enabled: true});
    assert.equal(runtime.handleAction('attack'), false, id);
    runtime.dispose();
  }
  const runtime = createEncounterRuntime({chapter: chapter('BM15'), world: world(), actors: [], player: actor('LEHI_COMMANDER')});
  runtime.handleAction('challenge', {enabled: true});
  assert.equal(runtime.handleAction('attack'), false);
  runtime.setObjective(2);
  assert(runtime.handleAction('attack'));
  assert(runtime.getState().combatEnabled);
  runtime.dispose();
});

check('actors retain stable knowledge through stage replacement and mid-action save restore', () => {
  const sentry = actor('CAMP_SENTRY_0', [0, 0, 0]);
  const protagonist = actor('TEANCUM', [0, 0, 3]);
  let cast = [sentry];
  const runtime = createEncounterRuntime({chapter: chapter('BM18'), world: world(), getActors: () => cast, getPlayer: () => protagonist});
  runtime.handleAction('challenge', {enabled: true});
  runtime.handleAction('noise', {kind: 'running', strength: 14});
  for (let frame = 0; frame < 180; frame += 1) runtime.update(1 / 60);
  const saved = runtime.serialize();
  assert(saved.people[0].knowledge.suspicion > .1);
  cast = [];
  runtime.update(1 / 60);
  cast = [actor('CAMP_SENTRY_0', [80, 0, 80])];
  runtime.syncActors();
  assert.deepEqual(runtime.getState().actors[0].knowledge, saved.people[0].knowledge);
  assert(runtime.restore(saved));
  assert.equal(runtime.getState().time, saved.time);
  assert.deepEqual(runtime.serialize().people[0].combat, saved.people[0].combat);
  const before = runtime.serialize();
  runtime.update(3, 0, {dialogueSpeaker: 'TEANCUM'});
  assert.equal(runtime.getState().time, before.time);
  runtime.handleAction('skip');
  assert.equal(runtime.getState().challenge, false);
  assert.equal(runtime.getState().actors[0].knowledge.phase, 'routine');
  runtime.dispose();
});

check('living workers move, reserve task anchors, and story actors keep authored positions', () => {
  const level = world();
  const configs = getEncounterActorConfigs(chapter('09'), level);
  assert.equal(configs.length, 3);
  const workers = configs.map(config => actor(config.id, config.position));
  const historical = actor('EMMA', [4, 0, 4]);
  const original = historical.root.position.toArray();
  const runtime = createEncounterRuntime({chapter: chapter('09'), world: level, actors: [...workers, historical], player: actor('JOSEPH_YOUNG')});
  for (let frame = 0; frame < 900; frame += 1) runtime.update(1 / 60);
  assert(workers.some((worker, index) => worker.root.position.distanceTo(new THREE.Vector3().fromArray(configs[index].position)) > .5));
  assert.deepEqual(historical.root.position.toArray(), original);
  assert(Object.keys(runtime.getState().navigation.reservations).length > 0);
  runtime.dispose();
});

check('the witness scenes retain exactly their source-authored witness cast', () => {
  assert.deepEqual(getEncounterActorConfigs({...chapter('10'), environment: 'witnesses'}, world()), []);
});

check('player blades and shields follow normalized hand sockets and clean up across assist and rig swaps', () => {
  const protagonist = actor('MORMON');
  const boneParent = new THREE.Group();
  boneParent.scale.setScalar(.01);
  const hand = new THREE.Bone();
  hand.position.set(35, 100, 20);
  boneParent.add(hand);
  protagonist.root.add(boneParent);
  protagonist.getSocket = () => hand;
  let current = protagonist;
  const runtime = createEncounterRuntime({chapter: chapter('BM24'), world: world(), getPlayer: () => current});
  assert.equal(protagonist.root.getObjectByName('player-blade'), undefined);
  runtime.handleAction('challenge', {enabled: true});
  const blade = protagonist.root.getObjectByName('player-blade');
  const equipment = blade.parent;
  assert(runtime.getState().playerEquipment.visible);
  assert(protagonist.root.getObjectByName('player-shield'));
  assert(blade.position.distanceTo(new THREE.Vector3(.35, 1, .2)) < .0001);
  assert(blade.getWorldScale(new THREE.Vector3()).distanceTo(new THREE.Vector3(1, 1, 1)) < .0001);
  assert(new THREE.Box3().setFromObject(blade).getSize(new THREE.Vector3()).y < 1.1);
  hand.position.x += 10;
  runtime.update(1 / 60);
  assert(Math.abs(blade.position.x - .45) < .0001);
  let disposed = false;
  blade.children[0].geometry.addEventListener('dispose', () => { disposed = true; });
  current = actor('MORONI');
  runtime.syncActors();
  assert.equal(equipment.parent, null);
  assert(disposed);
  assert(current.root.getObjectByName('player-blade'));
  runtime.handleAction('skip');
  assert.equal(runtime.getState().playerEquipment.visible, false);
  runtime.handleAction('challenge', {enabled: true});
  assert(runtime.getState().playerEquipment.visible);
  runtime.dispose();
  assert.equal(current.root.getObjectByName('player-blade'), undefined);
  for (const id of ['30', 'BM03', 'BM21']) {
    const sourcePlayer = actor('JOSEPH_MATURE');
    const protectedRuntime = createEncounterRuntime({chapter: chapter(id), world: world(), player: sourcePlayer});
    protectedRuntime.handleAction('challenge', {enabled: true});
    assert.equal(sourcePlayer.root.getObjectByName('player-blade'), undefined);
    protectedRuntime.dispose();
  }
  const teancum = actor('TEANCUM');
  const stealthRuntime = createEncounterRuntime({chapter: chapter('BM18'), world: world(), player: teancum});
  stealthRuntime.handleAction('challenge', {enabled: true});
  assert(teancum.root.getObjectByName('player-blade'));
  assert.equal(teancum.root.getObjectByName('player-shield'), undefined);
  stealthRuntime.setObjective(3);
  assert.equal(stealthRuntime.getState().playerEquipment.visible, false);
  stealthRuntime.dispose();
});

check('Carthage stages require arrival and skip/save never replay source events', () => {
  const config = chapter('30');
  config.objectives = config.objectives.slice(0, 3);
  const mob = actor('MOB_M_0', [0, 0, 8]);
  const notices = [];
  const runtime = createEncounterRuntime({chapter: config, world: world(), actors: [mob], player: actor('JOSEPH_MATURE', [1, 3.35, 1]), onNotice: notice => notices.push(notice)});
  runtime.setObjective(2);
  for (let frame = 0; frame < 180; frame += 1) runtime.update(1 / 60);
  assert(['approach', 'breach'].includes(runtime.getState().stage));
  assert(mob.root.position.z < 8);
  runtime.handleAction('skip');
  assert.equal(runtime.getState().stage, 'aftermath');
  const saved = runtime.serialize();
  const count = notices.length;
  runtime.restore(saved);
  runtime.onObjectiveComplete(2);
  runtime.update(1);
  assert.equal(notices.length, count);
  assert.equal(runtime.getState().sourceOutcomeLocked, true);
  runtime.dispose();
});

check('the actual Carthage colliders allow a reserved foreground group up the actual stair', () => {
  const scene = new THREE.Scene();
  const config = {...chapter('30'), environment: 'carthage'};
  const level = createWorld({scene, chapter: config, quality: 'low'});
  const mob = level.extras.filter(config => config.id.startsWith('MOB_M_')).map(config => actor(config.id, config.position));
  const runtime = createEncounterRuntime({scene, chapter: config, world: level, actors: mob, player: actor('JOSEPH_MATURE', [1, 3.35, 1])});
  runtime.setObjective(2);
  for (let tick = 0; tick < 5400; tick += 1) runtime.update(1 / 60);
  const state = runtime.getState();
  assert.equal(state.stage, 'upper-room');
  assert(state.actors.filter(person => person.position[1] > 3.1).length >= 2);
  assert(state.effects <= 10);
  assert(state.navigation.failures < 12);
  const saved = runtime.serialize();
  const shot = saved.people.find(person => person.lastShot >= 0);
  assert(shot);
  runtime.restore(saved);
  assert.equal(runtime.serialize().people.find(person => person.id === shot.id).lastShot, shot.lastShot);
  runtime.dispose();
  level.dispose();
});

assert.equal(segmentBlocked({x: -1, y: 4, z: 0}, {x: 1, y: 4, z: 0}, [{x: 0, z: 0, width: 1, depth: 1, minY: 0, maxY: 2}]), false);
console.log(JSON.stringify({passed: results.length, tests: results}, null, 2));
