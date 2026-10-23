import * as THREE from 'three';
import encounterData from '../../content/encounters.json' with {type: 'json'};
import {createNavigation, distanceXZ, point} from '../ai/nav-world.js';
import {createKnowledge, hearNoise, updatePerception} from '../ai/perception.js';
import {STRIKE, createCombatant, requestAttack, tickCombatant} from '../combat/combatant.js';
import {resolveStrike} from '../combat/hit-resolver.js';

const STEP = encounterData.fixedStep;
const SACRED = /^(CHRIST|FATHER|JEHOVAH|MORONI|JOHN_BAPTIST|PETER|JAMES|JOHN|MOSES|ELIAS|ELIJAH)$/;
const MANAGED = /^(LIFE_|TREASURY_SENTRY_|CAMP_SENTRY_|FIELD_ATTACKER_|MOB_M_)/;
const HOSTILE = /^(TREASURY_SENTRY_|CAMP_SENTRY_|FIELD_ATTACKER_|MOB_M_)/;
const copy = value => JSON.parse(JSON.stringify(value));
const toArray = position => [position.x, position.y, position.z];
const profileFor = chapter => encounterData.profiles[typeof chapter === 'string' ? chapter : chapter?.id];

export function getEncounterActorConfigs(chapter, world) {
  const profile = profileFor(chapter);
  if (profile?.kind === 'carthage') {
    if (world.extras?.some(actor => actor.id.startsWith('MOB_M_'))) return [];
    return Array.from({length: 6}, (_, index) => ({id: `MOB_M_${index}`, position: [index % 2 ? 8 : -8, 0, 10 + Math.floor(index / 2) * 2], height: 1.76, lifeRole: 'fictional mob role'}));
  }
  if (profile?.patrols) return profile.patrols.map((patrol, index) => ({
    id: `${profile.kind === 'treasury' ? 'TREASURY_SENTRY' : profile.kind === 'infiltration' ? 'CAMP_SENTRY' : 'FIELD_ATTACKER'}_${index}`,
    position: patrol[0], rotation: Math.atan2(patrol[1][0] - patrol[0][0], patrol[1][2] - patrol[0][2]), height: 1.76,
    lifeRole: profile.kind === 'treasury' ? 'fictional treasury sentry' : profile.kind === 'infiltration' ? 'fictional camp sentry' : 'fictional field attacker',
  }));
  const peacefulGathering = ['BM21', 'E8'].includes(chapter.id);
  if (!peacefulGathering && (['celestial', 'liberty', 'bedroom', 'grove', 'record-sacred', 'witnesses'].includes(chapter.environment) || /^(BM04|BM14|BM22|BM25|31|32|E)/.test(chapter.id))) return [];
  const navigation = createNavigation(world);
  const spawn = point(world.spawn ?? [0, 0, 8]);
  const candidates = [[-4, -2], [4, -3], [-5, -7], [5, -7], [-3, 3], [3, 3], [-7, -3], [7, -4], [-9, 2], [9, 3]];
  const result = [];
  for (const [offsetX, offsetZ] of candidates) {
    const position = {x: spawn.x + offsetX, y: spawn.y, z: spawn.z + offsetZ};
    position.y = navigation.heightAt(position.x, position.z, spawn.y);
    if (!navigation.traversable(position, position)) continue;
    result.push({id: result.length % 2 ? `LIFE_CROWD_F_${result.length}` : `LIFE_CITIZEN_${result.length}`, position: toArray(position), height: result.length % 2 ? 1.69 : 1.78, lifeRole: peacefulGathering ? 'quiet listener' : ['carry supplies', 'sweep', 'read'][result.length % 3]});
    if (result.length === (peacefulGathering ? 5 : 3)) break;
  }
  navigation.dispose();
  return result;
}

export function createEncounterRuntime({scene, world, chapter, actors = [], player, getActors, getPlayer, onState, onNotice} = {}) {
  const profile = profileFor(chapter);
  const navigation = createNavigation(world);
  const people = new Map();
  const pendingPeople = new Map();
  const effects = new THREE.Group();
  effects.name = 'encounter-effects';
  scene?.add(effects);
  const geometries = new Set();
  const materials = new Set();
  const attachments = new Map();
  const smoke = [];
  const events = [];
  const emitted = new Set();
  let currentActors = actors;
  let currentPlayer = player;
  let accumulator = 0;
  let time = 0;
  let objective = 0;
  let challenge = encounterData.challengeDefault;
  let crouching = false;
  let guarding = false;
  let running = false;
  let disposed = false;
  let dialogueSpeaker = null;
  let stage = profile?.kind === 'carthage' ? 'waiting' : 'routine';
  let stageTime = 0;
  let passage = 0;
  let lastFootstep = 0;
  let lastPlayerPosition = null;
  let playerCombat = null;
  let playerEntry = null;
  let planBudget = 1;
  let checkpoint = null;
  let reducedFlash = false;
  let playerEquipment = null;
  let equippedPlayer = null;
  const socketRotation = new THREE.Quaternion();
  const actorRotation = new THREE.Quaternion();
  const canCombat = () => Boolean(challenge && encounterData.combatChapters.includes(chapter.id) && objective >= (profile?.minimumObjective ?? 0) && !(chapter.id === 'BM18' && objective >= 3));
  const storyQuiet = () => Boolean(dialogueSpeaker || ['pray', 'listen', 'talk'].includes(chapter.objectives?.[objective]?.kind) && !profile);

  function notice(identity, message) {
    if (emitted.has(identity)) return;
    emitted.add(identity);
    events.push({id: identity, time, message});
    if (events.length > 24) events.shift();
    onNotice?.(message);
  }

  function material(color, options = {}) {
    const result = new THREE.MeshToonMaterial({color, ...options});
    materials.add(result);
    return result;
  }

  function propMesh(parent, geometry, surface, position) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(...position);
    parent.add(object);
    return object;
  }

  function removePuff(puff) {
    puff.object.removeFromParent();
    geometries.delete(puff.object.geometry);
    materials.delete(puff.object.material);
    puff.object.geometry.dispose();
    puff.object.material.dispose();
  }

  function disposePlayerEquipment() {
    if (!playerEquipment) return;
    const ownedGeometry = new Set();
    const ownedMaterials = new Set();
    playerEquipment.traverse(object => {
      if (object.geometry) ownedGeometry.add(object.geometry);
      if (object.material) ownedMaterials.add(object.material);
    });
    playerEquipment.removeFromParent();
    for (const geometry of ownedGeometry) { geometries.delete(geometry); geometry.dispose(); }
    for (const surface of ownedMaterials) { materials.delete(surface); surface.dispose(); }
    playerEquipment = null;
    equippedPlayer = null;
  }

  function syncPlayerEquipment() {
    if (equippedPlayer && equippedPlayer !== currentPlayer) disposePlayerEquipment();
    if (!currentPlayer) return;
    if (!playerEquipment && canCombat()) {
      playerEquipment = new THREE.Group();
      playerEquipment.name = `player-equipment:${currentPlayer.id}`;
      playerEquipment.userData.provenance = 'Restrained interpretive ancient blade and timber shield; not a claim of an excavated specimen.';
      equippedPlayer = currentPlayer;
      const blade = new THREE.Group();
      blade.name = 'player-blade';
      blade.position.set(.34, 1.02, .23);
      blade.userData.socket = 'rightHand';
      const metal = material('#a2a39a');
      const darkMetal = material('#51564e');
      const timber = material('#796142');
      const grip = material('#5c4935');
      propMesh(blade, new THREE.BoxGeometry(.048, .68, .021), metal, [0, .43, 0]);
      propMesh(blade, new THREE.ConeGeometry(.034, .15, 4), metal, [0, .845, 0]).scale.z = .4;
      propMesh(blade, new THREE.BoxGeometry(.15, .035, .048), darkMetal, [0, .08, 0]);
      propMesh(blade, new THREE.CylinderGeometry(.025, .027, .16, 8), grip, [0, -.015, 0]);
      propMesh(blade, new THREE.CylinderGeometry(.033, .033, .032, 8), darkMetal, [0, -.11, 0]);
      playerEquipment.add(blade);
      if (['BM15', 'BM19', 'BM24'].includes(chapter.id)) {
        const shield = new THREE.Group();
        shield.name = 'player-shield';
        shield.position.set(-.36, 1.05, .19);
        shield.userData.socket = 'leftHand';
        propMesh(shield, new THREE.CylinderGeometry(.33, .33, .045, 16), timber, [0, .04, 0]).rotation.x = Math.PI / 2;
        propMesh(shield, new THREE.TorusGeometry(.32, .018, 4, 16), darkMetal, [0, .04, .025]);
        propMesh(shield, new THREE.BoxGeometry(.06, .45, .055), grip, [0, .04, -.035]);
        playerEquipment.add(shield);
      }
      currentPlayer.root.add(playerEquipment);
    }
    if (!playerEquipment) return;
    playerEquipment.visible = canCombat();
    if (!playerEquipment.visible) return;
    for (const mount of playerEquipment.children) {
      const socket = currentPlayer.getSocket?.(mount.userData.socket) ?? currentPlayer.sockets?.[mount.userData.socket];
      if (!socket?.isObject3D) continue;
      socket.updateWorldMatrix(true, false);
      currentPlayer.root.worldToLocal(socket.getWorldPosition(mount.position));
      currentPlayer.root.getWorldQuaternion(actorRotation);
      socket.getWorldQuaternion(socketRotation);
      mount.quaternion.copy(actorRotation.invert().multiply(socketRotation));
      mount.scale.setScalar(1);
    }
  }

  function attachEquipment(person) {
    if (!person.hostile || attachments.has(person.id) || !scene) return;
    const equipment = new THREE.Group();
    equipment.name = `equipment:${person.id}`;
    const socket = person.actor.getSocket?.('rightHand') ?? person.actor.sockets?.rightHand;
    const parent = person.actor.root;
    equipment.position.set(.34, 1.02, .23);
    equipment.userData.handSocket = socket?.isObject3D ? socket : null;
    const wood = material('#665038');
    const metal = material('#4d514c');
    if (profile?.kind === 'carthage') {
      propMesh(equipment, new THREE.BoxGeometry(.09, .12, .56), wood, [0, 0, 0]);
      propMesh(equipment, new THREE.CylinderGeometry(.025, .035, .85, 7), metal, [0, .1, .51]).rotation.x = Math.PI / 2;
      propMesh(equipment, new THREE.BoxGeometry(.1, .1, .08), metal, [0, .07, .15]);
      equipment.userData.muzzle = new THREE.Vector3(0, .1, .93);
    } else {
      propMesh(equipment, new THREE.CylinderGeometry(.022, .028, 1.7, 6), wood, [0, .35, 0]);
      propMesh(equipment, new THREE.ConeGeometry(.07, .23, 4), metal, [0, 1.3, 0]);
    }
    parent.add(equipment);
    attachments.set(person.id, equipment);
  }

  function restorePerson(person, data) {
    if (data.position?.length === 3) person.actor.root.position.fromArray(data.position);
    if (Number.isFinite(data.rotation)) person.actor.root.rotation.y = data.rotation;
    person.knowledge = {...createKnowledge(), ...data.knowledge};
    person.combat = {...person.combat, ...data.combat};
    person.routeIndex = data.routeIndex ?? 0;
    person.task = data.task ?? 'approach';
    person.taskTime = data.taskTime ?? 0;
    person.target = data.target ?? null;
    person.path = data.path ?? [];
    person.repathAt = 0;
    person.stuckTime = 0;
    person.lastShot = data.lastShot ?? -1;
    person.lastShout = data.lastShout ?? -100;
  }

  function syncActors(nextActors = getActors?.() ?? currentActors, nextPlayer = getPlayer?.() ?? currentPlayer) {
    currentActors = nextActors ?? [];
    currentPlayer = nextPlayer;
    const live = new Set();
    for (const actor of currentActors) {
      if (!actor?.root) continue;
      live.add(actor.id);
      const existing = people.get(actor.id);
      if (existing) {
        if (existing.actor !== actor) {
          if (existing.managed) {
            actor.root.position.copy(existing.actor.root.position);
            actor.root.rotation.y = existing.actor.root.rotation.y;
          }
          existing.actor = actor;
          const equipment = attachments.get(actor.id);
          if (equipment) {
            actor.root.add(equipment);
            equipment.userData.handSocket = actor.getSocket?.('rightHand') ?? actor.sockets?.rightHand ?? null;
          }
          actor.root.userData.encounterManaged = existing.managed;
          actor.root.userData.encounterRole = existing.role;
        }
        continue;
      }
      const hostile = HOSTILE.test(actor.id);
      const index = Number(actor.id.match(/_(\d+)$/)?.[1] ?? 0);
      const home = point(actor.root.position);
      const anchors = world.activityAnchors?.filter(anchor => !SACRED.test(actor.id) && ['work', 'read', 'sweep', 'carry', 'listen', 'seat'].includes(anchor.kind)) ?? [];
      const activityAnchor = anchors[index % (anchors.length || 1)];
      const route = profile?.patrols?.[index] ?? [toArray(home), activityAnchor?.position ?? [home.x + (index % 2 ? -2 : 2), home.y, home.z + 2], [home.x, home.y, home.z + 3]];
      const person = {id: actor.id, actor, home, hostile, managed: MANAGED.test(actor.id), role: actor.root.userData.lifeRole ?? (hostile ? profile?.kind === 'carthage' ? 'fictional mob role' : 'sentry' : MANAGED.test(actor.id) ? ['BM21', 'E8'].includes(chapter.id) ? 'quiet listener' : ['carry supplies', 'sweep', 'read'][index % 3] : 'story listener'), index,
        knowledge: createKnowledge(), combat: createCombatant(actor.id, {protected: !hostile || profile?.kind === 'carthage' || profile?.kind === 'treasury', enemy: hostile}), route, routeIndex: 0, path: [], target: null, repathAt: 0, nextThink: 0, task: 'approach', taskTime: 0, stuckTime: 0, lastShout: -100};
      actor.root.userData.encounterManaged = person.managed;
      actor.root.userData.encounterRole = person.role;
      if (pendingPeople.has(actor.id)) { restorePerson(person, pendingPeople.get(actor.id)); pendingPeople.delete(actor.id); }
      people.set(actor.id, person);
      attachEquipment(person);
    }
    for (const [id, person] of people) if (!live.has(id)) {
      pendingPeople.set(id, snapshotPerson(person));
      navigation.release(id);
      attachments.get(id)?.removeFromParent();
      attachments.delete(id);
      people.delete(id);
    }
    if (currentPlayer && playerEntry?.actor !== currentPlayer) {
      playerCombat = playerCombat?.id === currentPlayer.id ? playerCombat : createCombatant(currentPlayer.id, {protected: !canCombat()});
      playerEntry = {actor: currentPlayer, combat: playerCombat};
    }
    syncPlayerEquipment();
  }

  function snapshotPerson(person) {
    return {id: person.id, position: person.actor.root.position.toArray(), rotation: person.actor.root.rotation.y, knowledge: copy(person.knowledge), combat: copy(person.combat), routeIndex: person.routeIndex, task: person.task, taskTime: person.taskTime, target: person.target && point(person.target), path: person.path.map(point), lastShot: person.lastShot ?? -1, lastShout: person.lastShout};
  }

  function noise(kind, position, strength) {
    const event = {kind, position: point(position), strength};
    for (const person of people.values()) if (person.hostile && person.actor.root.visible && person.combat.health > 0) hearNoise(person.actor, person.knowledge, event, navigation, time);
  }

  function animateStrike(actor) {
    actor.setMotion('attack', {restart: true, fade: .08});
    const duration = actor.getAnimationDiagnostics?.().duration;
    if (duration > 0) actor.setMotion('attack', {speed: duration / (STRIKE.windup + STRIKE.active + STRIKE.recovery)});
  }

  function face(person, destination, delta) {
    const position = person.actor.root.position;
    const angle = Math.atan2(destination.x - position.x, destination.z - position.z);
    person.actor.root.rotation.y += Math.atan2(Math.sin(angle - person.actor.root.rotation.y), Math.cos(angle - person.actor.root.rotation.y)) * Math.min(1, delta * 6);
  }

  function move(person, destination, delta, speed = 1.1) {
    const position = person.actor.root.position;
    if (distanceXZ(position, destination) < .1 && Math.abs(position.y - destination.y) < .6) { person.actor.setMotion('idle'); return true; }
    const targetChanged = !person.target || distanceXZ(person.target, destination) > 1;
    if ((targetChanged || time > person.repathAt) && planBudget > 0) {
      planBudget -= 1;
      person.path = navigation.findPath(position, destination);
      person.target = point(destination);
      person.repathAt = time + 4 + person.index * .08;
    }
    const waypoint = person.path[0];
    if (!waypoint) { person.actor.setMotion('idle'); return false; }
    if (distanceXZ(position, waypoint) < .08) { person.path.shift(); return false; }
    const amount = Math.min(speed * delta, distanceXZ(position, waypoint));
    let next = {x: position.x + (waypoint.x - position.x) / distanceXZ(position, waypoint) * amount, z: position.z + (waypoint.z - position.z) / distanceXZ(position, waypoint) * amount};
    next.y = navigation.heightAt(next.x, next.z, position.y);
    const occupiedAt = candidate => {
      for (const other of people.values()) {
        if (other === person || !other.actor.root.visible || !other.managed || other.combat.health <= 0) continue;
        if (Math.abs(other.actor.root.position.y - candidate.y) < .7 && distanceXZ(other.actor.root.position, candidate) < .48) return true;
      }
      return currentPlayer && Math.abs(currentPlayer.root.position.y - candidate.y) < .7 && distanceXZ(currentPlayer.root.position, candidate) < .5;
    };
    let occupied = occupiedAt(next);
    if (occupied) {
      const heading = Math.atan2(waypoint.x - position.x, waypoint.z - position.z);
      for (const deflection of [1.05, -1.05, 1.7, -1.7]) {
        const angle = heading + deflection * (person.index % 2 ? -1 : 1);
        const alternative = {x: position.x + Math.sin(angle) * amount, z: position.z + Math.cos(angle) * amount};
        alternative.y = navigation.heightAt(alternative.x, alternative.z, position.y);
        if (occupiedAt(alternative) || !navigation.traversable(position, alternative)) continue;
        next = alternative;
        occupied = false;
        break;
      }
    }
    if (!occupied && navigation.traversable(position, next)) {
      face(person, waypoint, delta);
      position.set(next.x, next.y, next.z);
      person.actor.setMotion(speed > 1.8 ? 'run' : 'walk');
      person.stuckTime = 0;
    } else {
      person.stuckTime += delta;
      person.actor.setMotion('idle');
      if (person.stuckTime > 1.8) {
        person.path = [];
        person.repathAt = 0;
        if (!person.hostile && person.stuckTime > 3) { navigation.release(person.id); person.routeIndex = (person.routeIndex + 1) % person.route.length; person.stuckTime = 0; }
      }
    }
    return false;
  }

  function routine(person, delta) {
    if (!person.managed || storyQuiet()) {
      if (dialogueSpeaker && navigation.blocked({...point(person.actor.root.position), y: person.actor.root.position.y + 1.4}, {...point(currentPlayer.root.position), y: currentPlayer.root.position.y + 1.4})) return;
      if (dialogueSpeaker && person.actor.id !== dialogueSpeaker) person.actor.setMotion('listen');
      return;
    }
    const destination = point(person.route[person.routeIndex % person.route.length]);
    const anchor = `${person.hostile ? 'watch' : 'task'}:${Math.round(destination.x * 2)}:${Math.round(destination.y)}:${Math.round(destination.z * 2)}`;
    if (!navigation.reserve(anchor, person.id)) { person.actor.setMotion('idle'); return; }
    if (move(person, destination, delta, person.hostile ? 1.2 : .9)) {
      person.task = person.hostile ? 'watch' : person.role;
      person.actor.setMotion(person.hostile ? 'idle' : ['read', 'quiet listener'].includes(person.role) ? 'listen' : 'work');
      person.taskTime += delta;
      if (person.taskTime > (person.hostile ? 1.4 : 5 + person.index)) {
        navigation.release(person.id);
        person.routeIndex = (person.routeIndex + 1) % person.route.length;
        person.task = 'approach';
        person.taskTime = 0;
        person.path = [];
      }
    }
  }

  function setStage(next) {
    if (stage === next) return;
    stage = next;
    stageTime = 0;
    for (const person of people.values()) { person.path = []; person.target = null; navigation.release(person.id); }
    const captions = {approach: 'Running footsteps converge on the jail yard. Armed men approach the entrance.', breach: 'The entrance is forced. People crowd the narrow threshold.', stairs: 'Attackers climb the jail stair. The upper-room doorway becomes a bottleneck.', 'upper-room': 'Powder smoke reaches the upper room. The historical account continues in the story scene.', aftermath: 'The assault gives way to shock, grief and care. The historical outcome is unchanged.'};
    if (captions[next]) notice(`carthage:${next}`, captions[next]);
  }

  function gunReport(person) {
    const equipment = attachments.get(person.id);
    if (!equipment) return;
    equipment.updateWorldMatrix(true, false);
    const origin = equipment.localToWorld(equipment.userData.muzzle.clone());
    const puff = propMesh(effects, new THREE.IcosahedronGeometry(.15, 0), material('#a3a49b', {transparent: true, opacity: .4, depthWrite: false}), origin.toArray());
    smoke.push({object: puff, age: 0, duration: 2.5});
    if (!reducedFlash) {
      const flash = propMesh(effects, new THREE.IcosahedronGeometry(.09, 0), material('#f6db9f', {transparent: true, opacity: .85}), origin.toArray());
      smoke.push({object: flash, age: 0, duration: .075});
    }
    person.actor.setMotion('attack');
  }

  function carthage(delta) {
    const mob = [...people.values()].filter(person => person.id.startsWith('MOB_M_')).sort((first, second) => first.index - second.index);
    if (stage === 'waiting' && objective >= 2) setStage('approach');
    if (stage === 'waiting' || stage === 'aftermath') { for (const person of mob) person.actor.setMotion('idle'); return; }
    const lead = mob[0];
    if (stage === 'approach' && lead && distanceXZ(lead.actor.root.position, {x: 0, z: 6.3}) < 1 && stageTime > 3) setStage('breach');
    if (stage === 'breach' && stageTime > 2.5) setStage('stairs');
    if (stage === 'stairs' && mob.some(person => person.actor.root.position.y > 3.1 && person.actor.root.position.x > -.4)) setStage('upper-room');
    for (const person of mob) {
      if (storyQuiet()) { person.actor.setMotion('idle'); continue; }
      if (stage === 'approach' || stage === 'breach' || person.index >= 3) {
        const destination = person.index === 0 ? {x: 0, y: 0, z: 6.3} : {x: (person.index % 2 ? -1 : 1) * (1.2 + person.index % 3 * .85), y: 0, z: 7.2 + Math.floor(person.index / 2) * 1.15};
        move(person, destination, delta, stage === 'approach' ? 2.4 : 1.1);
      } else if (stage === 'stairs' || stage === 'upper-room') {
        if (!navigation.reserve('carthage-stair', person.id)) { person.actor.setMotion('idle'); continue; }
        const route = [[0, 0, 4.45], [-2.65, 0, 4.45], [-2.65, 3.35, -.95], [-1.2, 3.35, -.95], [-1.2, 3.35, 1], [.6 + person.index * .75, 3.35, 1.9 + person.index * .15]];
        const routeIndex = Math.min(person.routeIndex, route.length - 1);
        if (move(person, point(route[routeIndex]), delta, 1.45)) {
          person.routeIndex = Math.min(routeIndex + 1, route.length - 1);
          person.path = [];
          if (routeIndex === route.length - 1) navigation.release(person.id);
        }
      }
      if (stage === 'upper-room' && person.index < 2 && Math.floor(stageTime / 4) > (person.lastShot ?? -1)) {
        person.lastShot = Math.floor(stageTime / 4);
        if (smoke.length < 10) gunReport(person);
        notice(`carthage:report:${person.lastShot}`, 'A brief gun report; powder smoke drifts from a period firearm.');
      }
    }
  }

  function think(person, delta) {
    const distance = distanceXZ(person.actor.root.position, currentPlayer.root.position);
    if (time < person.nextThink) return;
    const period = distance < 25 ? .1 : distance < 65 ? .33 : 1;
    person.nextThink = time + period;
    if (!person.hostile || profile?.kind === 'carthage' || !person.actor.root.visible) return;
    const previousPhase = person.knowledge.phase;
    const illumination = chapter.id === 'BM18' ? .45 : chapter.id === 'BM03' ? .65 : 1;
    updatePerception(person.actor, currentPlayer, person.knowledge, navigation, period, time, {crouching, running, illumination});
    if (previousPhase !== person.knowledge.phase && ['suspicious', 'investigate', 'alert', 'search', 'cooldown'].includes(person.knowledge.phase)) {
      notice(`${person.id}:${person.knowledge.phase}:${Math.floor(time / 18)}`, person.knowledge.phase === 'alert' ? 'A sentry has confirmed your position. Withdraw, guard, or use story assist.' : `Sentry: ${person.knowledge.phase === 'investigate' ? 'investigating a sound or movement' : person.knowledge.phase}.`);
    }
    if (person.knowledge.phase === 'alert' && time - person.lastShout > 5) {
      person.lastShout = time;
      for (const ally of people.values()) {
        if (ally === person || !ally.hostile || distanceXZ(ally.actor.root.position, person.actor.root.position) > 9 || navigation.blocked({...point(person.actor.root.position), y: person.actor.root.position.y + 1.5}, {...point(ally.actor.root.position), y: ally.actor.root.position.y + 1.5})) continue;
        hearNoise(ally.actor, ally.knowledge, {kind: 'nearby warning', position: person.knowledge.lastKnown, strength: 14}, navigation, time);
      }
    }
  }

  function step(delta) {
    time += delta;
    stageTime += delta;
    planBudget = Math.floor(time / STEP) % 6 === 0 ? 1 : 0;
    if (!currentPlayer?.root) return;
    playerCombat.protected = !canCombat();
    playerCombat.guarding = guarding && canCombat();
    tickCombatant(playerCombat, delta);
    if (lastPlayerPosition && time - lastFootstep > (running ? .32 : .65) && distanceXZ(currentPlayer.root.position, lastPlayerPosition) > .15) {
      noise('footsteps', currentPlayer.root.position, running ? 12 : crouching ? 2 : 5);
      lastFootstep = time;
      lastPlayerPosition = point(currentPlayer.root.position);
    }
    lastPlayerPosition ??= point(currentPlayer.root.position);
    const activePeople = [...people.values()].filter(person => person.actor.root.visible);
    const nearbyAttackers = activePeople.filter(person => person.hostile && person.combat.health > 0 && distanceXZ(person.actor.root.position, currentPlayer.root.position) < 9 && person.knowledge.phase === 'alert').sort((first, second) => distanceXZ(first.actor.root.position, currentPlayer.root.position) - distanceXZ(second.actor.root.position, currentPlayer.root.position)).slice(0, encounterData.maximumAttackers);
    if (profile?.kind === 'carthage') carthage(delta);
    for (const person of activePeople) {
      tickCombatant(person.combat, delta);
      if (person.combat.health <= 0) { person.actor.setMotion('fear'); navigation.release(person.id); continue; }
      think(person, delta);
      if (profile?.kind === 'carthage' || dialogueSpeaker || SACRED.test(person.id)) continue;
      if (person.hostile && ['windup', 'active', 'recovery', 'stagger'].includes(person.combat.phase)) {
        person.actor.setMotion(person.combat.phase === 'stagger' ? 'fear' : 'attack');
        continue;
      }
      const knowledge = person.knowledge;
      if (person.hostile && ['investigate', 'alert', 'search'].includes(knowledge.phase) && knowledge.lastKnown) {
        navigation.release(person.id);
        let destination = knowledge.lastKnown;
        if (knowledge.phase === 'alert' && canCombat() && nearbyAttackers.includes(person)) {
          destination = point(currentPlayer.root.position);
          const distance = distanceXZ(person.actor.root.position, destination);
          face(person, destination, delta);
          if (distance < 1.9 && person.combat.cooldown <= 0 && !navigation.blocked({...point(person.actor.root.position), y: person.actor.root.position.y + 1}, {...destination, y: destination.y + 1})) {
            requestAttack(person.combat);
            person.combat.cooldown = 1.8 + person.index * .18;
            animateStrike(person.actor);
          } else if (distance >= 1.6) move(person, destination, delta, 1.85);
        } else {
          if (knowledge.phase === 'search') destination = {x: destination.x + Math.sin(knowledge.phaseTime * .65 + person.index) * 2.3, y: destination.y, z: destination.z + Math.cos(knowledge.phaseTime * .65 + person.index) * 2.3};
          if (distanceXZ(person.actor.root.position, destination) > 1) move(person, destination, delta, 1.2);
          else { person.actor.setMotion('idle'); face(person, currentPlayer.root.position, delta); }
        }
      } else routine(person, delta);
    }
    if (canCombat() && !dialogueSpeaker) {
      const enemies = activePeople.filter(person => person.hostile).map(person => ({actor: person.actor, combat: person.combat}));
      const impact = event => {
        events.push({id: `${event.attacker}:${event.swing}:${event.target}`, time, ...event});
        if (events.length > 24) events.shift();
        noise('weapon impact', currentPlayer.root.position, 16);
        if (event.target === playerCombat.id) notice(`impact:${Math.floor(time / 6)}`, event.result === 'blocked' ? 'Guard holds. Stamina absorbs the impact.' : 'You are hurt. Withdraw or use story assist to recover.');
      };
      resolveStrike(playerEntry, enemies, navigation, impact);
      for (const person of nearbyAttackers) resolveStrike({actor: person.actor, combat: person.combat}, [playerEntry], navigation, impact, .5);
      if (playerCombat.health <= 0) {
        challenge = false;
        notice(`recovery:${Math.floor(time)}`, 'You withdraw from the optional challenge. The account continues; story assist restores your strength.');
        playerCombat.health = 100;
        playerCombat.stamina = 100;
        playerCombat.phase = 'idle';
        playerCombat.protected = true;
      }
    }
    if (profile?.kind === 'passage' && objective >= 1 && objective < 3 && !dialogueSpeaker) {
      const clear = !activePeople.some(person => person.hostile && person.combat.health > 0 && Math.abs(person.actor.root.position.x) < 3.2 && person.actor.root.position.z > -32 && person.actor.root.position.z < 12);
      if (clear || !challenge) passage = Math.min(1, passage + delta / 20);
      if (passage >= 1) notice('passage:clear', 'People have withdrawn through the passage. Continue the entrusted record; the loss at Cumorah remains.');
    }
  }

  function serialize() {
    return {version: 1, chapter: chapter.id, time, objective, challenge, stage, stageTime, passage, crouching, guarding, player: playerCombat && copy(playerCombat), people: [...pendingPeople.values(), ...[...people.values()].map(snapshotPerson)], navigation: navigation.getState(), emitted: [...emitted], events: copy(events)};
  }

  function restore(data) {
    if (!data || data.chapter !== chapter.id) return false;
    time = Math.max(0, data.time ?? 0);
    objective = Math.max(0, data.objective ?? 0);
    challenge = Boolean(data.challenge);
    stage = data.stage ?? stage;
    stageTime = data.stageTime ?? 0;
    passage = data.passage ?? 0;
    crouching = Boolean(data.crouching);
    guarding = Boolean(data.guarding);
    accumulator = 0;
    pendingPeople.clear();
    navigation.restore(data.navigation);
    emitted.clear();
    for (const id of data.emitted ?? []) emitted.add(id);
    events.splice(0, events.length, ...(data.events ?? []).slice(-24));
    for (const saved of data.people ?? []) {
      const person = people.get(saved.id);
      if (person) restorePerson(person, saved);
      else pendingPeople.set(saved.id, copy(saved));
    }
    if (data.player && playerCombat) Object.assign(playerCombat, copy(data.player), {id: currentPlayer.id});
    lastPlayerPosition = currentPlayer ? point(currentPlayer.root.position) : null;
    for (const puff of smoke) removePuff(puff);
    smoke.length = 0;
    syncPlayerEquipment();
    return true;
  }

  function getState() {
    const guards = [...people.values()].filter(person => person.hostile);
    const highest = guards.reduce((current, person) => Math.max(current, person.knowledge.suspicion), 0);
    return {
      kind: profile?.kind ?? 'living-world', label: profile?.label ?? 'Everyday life', stage, stageTime, time,
      challenge, combatEnabled: canCombat(), crouching, guarding, suspicion: highest,
      alertCount: guards.filter(person => person.knowledge.phase === 'alert').length,
      passage, sourceOutcomeLocked: true, player: playerCombat && copy(playerCombat),
      playerEquipment: {visible: Boolean(playerEquipment?.visible), blade: Boolean(playerEquipment?.getObjectByName('player-blade')), shield: Boolean(playerEquipment?.getObjectByName('player-shield'))},
      managedActorIds: [...people.values()].filter(person => person.managed).map(person => person.id),
      actors: [...people.values()].map(person => ({id: person.id, role: person.role, managed: person.managed, position: person.actor.root.position.toArray(), task: person.task, knowledge: copy(person.knowledge), combat: copy(person.combat)})),
      navigation: navigation.getState(), events: copy(events), effects: smoke.length,
    };
  }

  syncActors();
  checkpoint = serialize();
  return {
    syncActors,
    getState,
    serialize,
    restore,
    setObjective(index) {
      objective = Math.max(0, index);
      if (playerCombat) playerCombat.protected = !canCombat();
      syncPlayerEquipment();
      if (profile && objective >= (profile.minimumObjective ?? 0)) notice(`profile:${chapter.id}`, profile.notice);
      if (profile?.kind === 'carthage' && objective >= (chapter.objectives?.length ?? 3)) setStage('aftermath');
      if (chapter.id === 'BM18' && objective >= 3) notice('teancum:later', 'Later mission · Ammoron. Teancum’s death remains in the account; there is no alternate escape ending.');
      checkpoint = serialize();
    },
    onObjectiveComplete(index) {
      if (chapter.id === '30' && index >= 2) setStage('aftermath');
      if (chapter.id === 'BM24' && index >= 2) notice('cumorah:record', 'The record is entrusted. Continue with Moroni; the battle is not turned into a victory.');
    },
    handleAction(action, payload = {}) {
      if (disposed || !currentPlayer) return false;
      if (action === 'challenge' || action === 'toggleChallenge') {
        challenge = typeof payload.enabled === 'boolean' ? payload.enabled : typeof payload === 'boolean' ? payload : !challenge;
        if (playerCombat) playerCombat.protected = !canCombat();
        syncPlayerEquipment();
        notice(`challenge:${challenge}:${Math.floor(time)}`, challenge ? 'Optional challenge enabled. The story objectives and source outcomes remain available.' : 'Story assist enabled. Observe and continue the account at your own pace.');
        return true;
      }
      if (action === 'crouch') { crouching = typeof payload.enabled === 'boolean' ? payload.enabled : !crouching; return true; }
      if (action === 'guard') { guarding = typeof payload.enabled === 'boolean' ? payload.enabled : !guarding; return canCombat(); }
      if (action === 'attack') {
        if (!canCombat() || dialogueSpeaker) return false;
        playerCombat.protected = false;
        const accepted = requestAttack(playerCombat);
        if (accepted) { animateStrike(currentPlayer); noise('weapon movement', currentPlayer.root.position, 10); }
        return accepted;
      }
      if (action === 'evade') {
        if (!canCombat() || playerCombat.stamina < 18 || !['idle', 'guard'].includes(playerCombat.phase)) return false;
        const position = currentPlayer.root.position;
        const destination = {x: position.x - Math.sin(currentPlayer.root.rotation.y) * 1.1, y: position.y, z: position.z - Math.cos(currentPlayer.root.rotation.y) * 1.1};
        destination.y = navigation.heightAt(destination.x, destination.z, position.y);
        if (!navigation.traversable(position, destination)) return false;
        playerCombat.stamina -= 18;
        position.set(destination.x, destination.y, destination.z);
        return true;
      }
      if (action === 'noise' || action === 'distract') {
        const position = payload.position ? point(payload.position) : point(currentPlayer.root.position);
        if (distanceXZ(position, currentPlayer.root.position) > 8 || navigation.blocked({...point(currentPlayer.root.position), y: currentPlayer.root.position.y + 1}, {...position, y: position.y + 1})) return false;
        noise(payload.kind ?? 'dropped pebble', position, Math.min(18, payload.strength ?? 12));
        return true;
      }
      if (action === 'door') { navigation.setDoor(payload.id, payload); noise('door', {x: payload.x, y: payload.minY ?? 0, z: payload.z}, 9); return true; }
      if (action === 'checkpoint') { checkpoint = serialize(); return true; }
      if (action === 'recover') { if (checkpoint) restore(checkpoint); challenge = false; syncPlayerEquipment(); return true; }
      if (action === 'skip') { challenge = false; guarding = false; syncPlayerEquipment(); if (profile?.kind === 'carthage') setStage('aftermath'); for (const person of people.values()) { person.knowledge = createKnowledge(); if (person.managed) person.actor.setMotion('idle'); navigation.release(person.id); } return true; }
      return false;
    },
    update(delta, elapsed, options = {}) {
      if (disposed) return;
      syncActors();
      dialogueSpeaker = options.dialogueSpeaker ?? null;
      reducedFlash = Boolean(options.reducedFlash ?? options.reducedMotion);
      if (typeof options.crouching === 'boolean') crouching = options.crouching;
      if (typeof options.guarding === 'boolean') guarding = options.guarding;
      running = Boolean(options.running);
      if (Number.isInteger(options.objective) && options.objective !== objective) this.setObjective(options.objective);
      if (options.paused || !currentPlayer) return;
      if (dialogueSpeaker) {
        for (const person of people.values()) if (person.actor.id !== dialogueSpeaker && !SACRED.test(person.id)) person.actor.setMotion('listen');
        return;
      }
      accumulator += Math.min(.25, Math.max(0, delta));
      while (accumulator + .000000001 >= STEP) { step(STEP); accumulator -= STEP; }
      syncPlayerEquipment();
      for (const [id, equipment] of attachments) {
        const socket = equipment.userData.handSocket;
        const actor = people.get(id)?.actor;
        if (socket && actor) {
          socket.updateWorldMatrix(true, false);
          actor.root.worldToLocal(socket.getWorldPosition(equipment.position));
        }
      }
      for (let index = smoke.length - 1; index >= 0; index -= 1) {
        const puff = smoke[index];
        puff.age += delta;
        puff.object.position.x += delta * .2;
        puff.object.position.y += delta * .3;
        puff.object.scale.setScalar(1 + puff.age * 3);
        puff.object.material.opacity = Math.max(0, .4 * (1 - puff.age / puff.duration));
        if (puff.age >= puff.duration) {
          removePuff(puff);
          smoke.splice(index, 1);
        }
      }
      if (onState && Math.floor(time * 5) !== Math.floor((time - delta) * 5)) onState(getState());
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposePlayerEquipment();
      navigation.dispose();
      for (const equipment of attachments.values()) equipment.removeFromParent();
      effects.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
      people.clear();
      pendingPeople.clear();
      attachments.clear();
      smoke.length = 0;
    },
  };
}
