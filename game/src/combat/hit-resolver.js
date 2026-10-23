import {STRIKE, applyImpact} from './combatant.js';

export function resolveStrike(attacker, targets, navigation, onImpact = () => {}, damageScale = 1) {
  const state = attacker.combat;
  if (state.phase !== 'active') return;
  const position = attacker.actor.root.position;
  const facing = attacker.actor.root.rotation.y;
  const fraction = Math.min(1, state.clock / STRIKE.active);
  const angle = facing - .95 + fraction * 1.9;
  const tip = {x: position.x + Math.sin(angle) * STRIKE.range, y: position.y + 1.05, z: position.z + Math.cos(angle) * STRIKE.range};
  const previous = state.previousTip ?? {x: position.x + Math.sin(facing - .95) * STRIKE.range, y: tip.y, z: position.z + Math.cos(facing - .95) * STRIKE.range};
  const origin = {x: position.x, y: position.y + 1.05, z: position.z};
  for (const target of targets) {
    if (target.combat.protected || target.combat.health <= 0 || state.hitIds.includes(target.combat.id) || !target.actor.root.visible && target.combat.enemy) continue;
    const body = target.actor.root.position;
    if (Math.abs(body.y - position.y) > 1.1 || Math.hypot(body.x - position.x, body.z - position.z) > STRIKE.range + .35) continue;
    let contact = false;
    for (let sample = 0; sample <= 5; sample += 1) {
      const amount = sample / 5;
      const end = {x: previous.x + (tip.x - previous.x) * amount, y: tip.y, z: previous.z + (tip.z - previous.z) * amount};
      const directionX = end.x - origin.x;
      const directionZ = end.z - origin.z;
      const lengthSquared = directionX * directionX + directionZ * directionZ;
      const projected = Math.max(0, Math.min(1, ((body.x - origin.x) * directionX + (body.z - origin.z) * directionZ) / lengthSquared));
      const nearest = {x: origin.x + directionX * projected, y: origin.y, z: origin.z + directionZ * projected};
      if (Math.hypot(nearest.x - body.x, nearest.z - body.z) < .48 && !navigation.blocked(origin, nearest, .08)) { contact = true; break; }
    }
    if (!contact) continue;
    state.hitIds.push(target.combat.id);
    const result = applyImpact(target.combat, position, body, target.actor.root.rotation.y, STRIKE.damage * damageScale);
    onImpact({attacker: state.id, target: target.combat.id, swing: state.swing, result});
  }
  state.previousTip = tip;
}
