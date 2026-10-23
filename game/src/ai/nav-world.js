export const distanceXZ = (first, second) => Math.hypot(first.x - second.x, first.z - second.z);
export const point = value => Array.isArray(value) ? {x: value[0], y: value[1] ?? 0, z: value[2]} : {x: value.x, y: value.y ?? 0, z: value.z};

export function segmentBlocked(start, end, colliders, padding = 0) {
  return colliders.some(collider => {
    if (collider.disabled || collider.open || collider.blocksSight === false && padding === 0) return false;
    const minY = collider.minY ?? -1000;
    const maxY = collider.maxY ?? 1000;
    if (Math.min(start.y, end.y) > maxY || Math.max(start.y, end.y) < minY) return false;
    if (collider.radius != null) {
      const directionX = end.x - start.x;
      const directionZ = end.z - start.z;
      const lengthSquared = directionX * directionX + directionZ * directionZ;
      const fraction = lengthSquared ? Math.max(0, Math.min(1, ((collider.x - start.x) * directionX + (collider.z - start.z) * directionZ) / lengthSquared)) : 0;
      const height = start.y + (end.y - start.y) * fraction;
      return height >= minY && height <= maxY && Math.hypot(start.x + directionX * fraction - collider.x, start.z + directionZ * fraction - collider.z) < collider.radius + padding;
    }
    let near = 0;
    let far = 1;
    for (const [axis, halfSize] of [['x', (collider.width ?? .2) / 2 + padding], ['z', (collider.depth ?? .2) / 2 + padding], ['y', (maxY - minY) / 2]]) {
      const center = axis === 'y' ? (maxY + minY) / 2 : collider[axis];
      const direction = end[axis] - start[axis];
      if (Math.abs(direction) < .000001) {
        if (start[axis] < center - halfSize || start[axis] > center + halfSize) return false;
      } else {
        const first = (center - halfSize - start[axis]) / direction;
        const second = (center + halfSize - start[axis]) / direction;
        near = Math.max(near, Math.min(first, second));
        far = Math.min(far, Math.max(first, second));
        if (near > far) return false;
      }
    }
    return true;
  });
}

export function createNavigation(world, {cellSize = .7, radius = .25, maxNodes = 2800} = {}) {
  const reservations = new Map();
  const doors = new Map();
  let searches = 0;
  let failures = 0;
  const colliders = () => [...(world.colliders ?? []), ...[...doors.values()].filter(door => !door.open)];
  const heightAt = (x, z, previousY) => world.getGroundHeight?.(x, z, previousY) ?? 0;
  const inBounds = position => !world.bounds || position.x > world.bounds.minX + radius && position.x < world.bounds.maxX - radius && position.z > world.bounds.minZ + radius && position.z < world.bounds.maxZ - radius;
  function traversable(start, end) {
    const samples = Math.max(1, Math.ceil(distanceXZ(start, end) / .25));
    let previous = point(start);
    for (let sample = 1; sample <= samples; sample += 1) {
      const fraction = sample / samples;
      const next = {x: start.x + (end.x - start.x) * fraction, z: start.z + (end.z - start.z) * fraction};
      next.y = heightAt(next.x, next.z, previous.y);
      if (!inBounds(next) || Math.abs(next.y - previous.y) > .46 || segmentBlocked({...previous, y: previous.y + .65}, {...next, y: next.y + .65}, colliders(), radius)) return false;
      previous = next;
    }
    return Math.abs(previous.y - end.y) < .55;
  }
  function findPath(origin, destination) {
    searches += 1;
    const start = point(origin);
    const goal = point(destination);
    if (traversable(start, goal)) return [goal];
    const key = position => `${Math.round((position.x - start.x) / cellSize)},${Math.round((position.z - start.z) / cellSize)},${Math.round(position.y / .6)}`;
    const first = {position: start, cost: 0, score: distanceXZ(start, goal), parent: null};
    const open = [first];
    const visited = new Map([[key(start), first]]);
    for (let expanded = 0; open.length && expanded < maxNodes; expanded += 1) {
      let best = 0;
      for (let index = 1; index < open.length; index += 1) if (open[index].score < open[best].score) best = index;
      const current = open.splice(best, 1)[0];
      if (distanceXZ(current.position, goal) < cellSize * 1.6 && traversable(current.position, goal)) {
        const result = [goal];
        for (let step = current; step.parent; step = step.parent) result.unshift(step.position);
        return result;
      }
      for (const [offsetX, offsetZ] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const next = {x: current.position.x + offsetX * cellSize, z: current.position.z + offsetZ * cellSize};
        next.y = heightAt(next.x, next.z, current.position.y);
        const nextKey = key(next);
        const cost = current.cost + distanceXZ(current.position, next);
        if (visited.has(nextKey) && visited.get(nextKey).cost <= cost || !traversable(current.position, next)) continue;
        const node = {position: next, cost, score: cost + distanceXZ(next, goal) + Math.abs(next.y - goal.y), parent: current};
        visited.set(nextKey, node);
        open.push(node);
      }
    }
    failures += 1;
    return [];
  }
  return {
    findPath, traversable, heightAt,
    blocked: (start, end, padding = 0) => segmentBlocked(start, end, colliders(), padding),
    reserve(id, owner) { if (reservations.has(id) && reservations.get(id) !== owner) return false; reservations.set(id, owner); return true; },
    release(owner) { for (const [id, occupant] of reservations) if (occupant === owner) reservations.delete(id); },
    setDoor(id, config) { doors.set(id, {...doors.get(id), ...config, id}); },
    getDoors: () => [...doors.values()].map(door => ({...door})),
    getState: () => ({searches, failures, reservations: Object.fromEntries(reservations), doors: [...doors.values()].map(door => ({...door}))}),
    restore(data = {}) { reservations.clear(); for (const [id, owner] of Object.entries(data.reservations ?? {})) reservations.set(id, owner); doors.clear(); for (const door of data.doors ?? []) doors.set(door.id, {...door}); },
    dispose() { reservations.clear(); doors.clear(); },
  };
}
