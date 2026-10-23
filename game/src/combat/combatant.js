export const STRIKE = Object.freeze({windup: .28, active: .18, recovery: .4, range: 2.05, damage: 22, stamina: 24, guardCost: 19});

export function createCombatant(id, {protected: protectedActor = false, enemy = false} = {}) {
  return {id, health: 100, stamina: 100, phase: 'idle', clock: 0, guarding: false, protected: protectedActor, enemy, swing: 0, hitIds: [], previousTip: null, cooldown: 0, morale: 1};
}

export function requestAttack(state) {
  if (state.protected || state.health <= 0 || !['idle', 'guard'].includes(state.phase) || state.stamina < STRIKE.stamina) return false;
  state.stamina -= STRIKE.stamina;
  state.phase = 'windup';
  state.clock = 0;
  state.guarding = false;
  state.swing += 1;
  state.hitIds = [];
  state.previousTip = null;
  return true;
}

export function tickCombatant(state, delta) {
  state.clock += delta;
  state.cooldown = Math.max(0, state.cooldown - delta);
  if (state.health <= 0) { state.phase = 'incapacitated'; return; }
  if (['idle', 'guard'].includes(state.phase)) {
    state.stamina = Math.min(100, state.stamina + delta * (state.guarding ? 7 : 19));
    state.phase = state.guarding && state.stamina > 0 ? 'guard' : 'idle';
  }
  if (state.phase === 'windup' && state.clock >= STRIKE.windup) { state.phase = 'active'; state.clock -= STRIKE.windup; }
  if (state.phase === 'active' && state.clock >= STRIKE.active) { state.phase = 'recovery'; state.clock -= STRIKE.active; state.previousTip = null; }
  if (state.phase === 'recovery' && state.clock >= STRIKE.recovery || state.phase === 'stagger' && state.clock >= .38) { state.phase = 'idle'; state.clock = 0; }
}

export function applyImpact(target, attackerPosition, targetPosition, facing, damage = STRIKE.damage) {
  if (target.protected || target.health <= 0) return 'protected';
  const angle = Math.atan2(attackerPosition.x - targetPosition.x, attackerPosition.z - targetPosition.z);
  const blocked = target.guarding && ['idle', 'guard'].includes(target.phase) && Math.cos(angle - facing) >= Math.cos(Math.PI * .38) && target.stamina >= STRIKE.guardCost;
  if (blocked) { target.stamina -= STRIKE.guardCost; return 'blocked'; }
  target.health = Math.max(0, target.health - damage);
  target.morale = Math.max(0, target.morale - damage / 125);
  target.phase = target.health ? 'stagger' : 'incapacitated';
  target.clock = 0;
  target.guarding = false;
  return target.health ? 'hit' : 'incapacitated';
}
