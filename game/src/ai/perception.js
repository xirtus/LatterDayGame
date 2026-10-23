import {distanceXZ, point} from './nav-world.js';

export function createKnowledge() {
  return {phase: 'routine', suspicion: 0, confidence: 0, lastKnown: null, phaseTime: 0, lastSeen: -100, lastHeard: -100, source: null};
}

export function visibility(observer, target, navigation, {crouching = false, running = false, illumination = 1} = {}) {
  const origin = observer.root?.position ?? observer.position;
  const body = target.root?.position ?? target.position;
  const distance = distanceXZ(origin, body);
  const range = (observer.visionRange ?? 16) * (.65 + .35 * illumination) * (crouching ? .78 : 1);
  if (distance > range || Math.abs(origin.y - body.y) > 5) return 0;
  const facing = observer.root?.rotation.y ?? observer.rotation ?? 0;
  const angle = Math.atan2(body.x - origin.x, body.z - origin.z);
  if (Math.cos(angle - facing) < Math.cos((observer.fieldOfView ?? 105) * Math.PI / 360) && distance > 1.4) return 0;
  let clear = 0;
  for (const height of crouching ? [.45, .9] : [.7, 1.55]) {
    if (!navigation.blocked({...origin, x: origin.x, y: origin.y + 1.55, z: origin.z}, {x: body.x, y: body.y + height, z: body.z})) clear += 1;
  }
  return clear / 2 * (1 - distance / (range * 1.3)) * (crouching ? .55 : 1) * (running ? 1.4 : 1) * Math.max(.25, illumination);
}

export function updatePerception(observer, target, knowledge, navigation, delta, time, options = {}) {
  const seen = visibility(observer, target, navigation, options);
  knowledge.phaseTime += delta;
  if (seen > 0) {
    knowledge.suspicion = Math.min(1, knowledge.suspicion + seen * delta * .9);
    knowledge.confidence = Math.min(1, knowledge.confidence + seen * delta);
    knowledge.lastKnown = point(target.root?.position ?? target.position);
    knowledge.lastSeen = time;
    knowledge.source = 'sight';
  } else {
    knowledge.suspicion = Math.max(0, knowledge.suspicion - delta * (knowledge.phase === 'alert' ? .025 : .1));
    knowledge.confidence = Math.max(0, knowledge.confidence - delta * .055);
  }
  let phase = knowledge.phase;
  if (knowledge.suspicion >= .95 && seen > 0) phase = 'alert';
  else if (phase === 'alert' && time - knowledge.lastSeen > 3) phase = 'search';
  else if (phase === 'search' && knowledge.phaseTime > 9) phase = 'cooldown';
  else if (phase === 'cooldown' && knowledge.phaseTime > 6 && knowledge.suspicion < .25) phase = 'routine';
  else if (phase === 'routine' && knowledge.suspicion >= .15) phase = 'suspicious';
  else if (phase === 'suspicious' && knowledge.suspicion >= .4) phase = 'investigate';
  else if (phase === 'investigate' && time - Math.max(knowledge.lastSeen, knowledge.lastHeard) > 4) phase = 'search';
  else if (phase === 'suspicious' && knowledge.suspicion === 0) phase = 'routine';
  if (phase !== knowledge.phase) { knowledge.phase = phase; knowledge.phaseTime = 0; }
  return seen;
}

export function hearNoise(observer, knowledge, noise, navigation, time) {
  const origin = observer.root?.position ?? observer.position;
  const distance = distanceXZ(origin, noise.position);
  const blocked = navigation.blocked({x: origin.x, y: origin.y + 1.3, z: origin.z}, {...noise.position, y: noise.position.y + 1});
  const range = noise.strength * (blocked ? .3 : 1);
  if (distance > range) return false;
  const confidence = Math.max(.12, (1 - distance / range) * .75);
  if (time - knowledge.lastSeen < 1 && knowledge.confidence > confidence) return false;
  knowledge.lastKnown = point(noise.position);
  knowledge.lastHeard = time;
  knowledge.source = noise.kind;
  knowledge.confidence = Math.max(knowledge.confidence, confidence);
  knowledge.suspicion = Math.min(.85, knowledge.suspicion + confidence * .5);
  if (knowledge.phase === 'routine' || knowledge.phase === 'cooldown') { knowledge.phase = 'investigate'; knowledge.phaseTime = 0; }
  return true;
}
