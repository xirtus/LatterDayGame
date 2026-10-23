import * as THREE from 'three';

export function createRecordPlay({chapter, world, progress = {}, changed = () => {}}) {
  const group = new THREE.Group();
  group.name = 'record-participation';
  world.group.add(group);
  const geometry = new THREE.IcosahedronGeometry(.18, 1);
  const standGeometry = new THREE.CylinderGeometry(.28, .34, .12, 8);
  const pendingMaterial = new THREE.MeshToonMaterial({color: '#b7cfdb', emissive: '#263e4a'});
  const doneMaterial = new THREE.MeshToonMaterial({color: '#fff0bb', emissive: '#876730'});
  const standMaterial = new THREE.MeshToonMaterial({color: '#796b53'});
  const stations = new Map();
  let activeIndex = -1;

  function blocked(position) {
    return (world.colliders ?? []).some(collider => {
      if (collider.minY != null && position[1] + 1.5 <= collider.minY) return false;
      if (collider.maxY != null && position[1] + .15 >= collider.maxY) return false;
      return collider.radius != null ? Math.hypot(position[0] - collider.x, position[2] - collider.z) < collider.radius + .65 : Math.abs(position[0] - collider.x) < collider.width / 2 + .65 && Math.abs(position[2] - collider.z) < collider.depth / 2 + .65;
    });
  }

  function positionsFor(objective) {
    const authored = world.activityPoints?.[objective.id];
    if (authored?.length >= objective.activity.count) return authored.slice(0, objective.activity.count);
    const result = [];
    for (let index = 0; index < objective.activity.count; index++) {
      let candidate;
      for (let attempt = 0; attempt < 40; attempt++) {
        const angle = (index / objective.activity.count + attempt * .137) * Math.PI * 2;
        const radius = 1.5 + index % 3 * .65 + Math.floor(attempt / 12) * .35;
        const horizontal = [objective.target[0] + Math.cos(angle) * radius, objective.target[2] + Math.sin(angle) * radius];
        const height = world.getGroundHeight(horizontal[0], horizontal[1], objective.target[1]);
        candidate = [horizontal[0], height, horizontal[1]];
        if (Math.abs(height - objective.target[1]) < .4 && !blocked(candidate) && result.every(position => Math.hypot(position[0] - candidate[0], position[2] - candidate[2]) > .55)) break;
      }
      if (blocked(candidate) || Math.abs(candidate[1] - objective.target[1]) >= .4) candidate = [...objective.target];
      result.push(candidate);
    }
    return result;
  }

  chapter.objectives.forEach(objective => {
    if (!objective.activity || objective.activity.count < 1) return;
    const entries = positionsFor(objective).map((position, index) => {
      const node = new THREE.Group();
      node.position.fromArray(position);
      const stand = new THREE.Mesh(standGeometry, standMaterial);
      stand.position.y = .06;
      const token = new THREE.Mesh(geometry, pendingMaterial);
      token.position.y = .45;
      if (objective.activity.type === 'repair') token.scale.set(1.6, .45, .6);
      if (objective.activity.type === 'serve') token.scale.set(.8, 1.4, .8);
      node.add(stand, token);
      node.name = `${objective.id}-task-${index + 1}`;
      group.add(node);
      return {node, token, position, index};
    });
    stations.set(objective.id, entries);
    const value = Number(progress[objective.id]);
    progress[objective.id] = Number.isFinite(value) ? Math.max(0, Math.min(entries.length, Math.floor(value))) : 0;
  });

  function remaining(objective) {
    const entries = stations.get(objective?.id);
    return entries && progress[objective.id] < entries.length ? entries[progress[objective.id]] : null;
  }

  return {
    progress,
    target(objective) { return remaining(objective)?.position ?? objective?.target; },
    hint(objective) {
      return remaining(objective) ? `${objective.activity.label} · ${progress[objective.id]} / ${objective.activity.count} · walk to each small illuminated station and press E.` : null;
    },
    act(objective, position) {
      const station = remaining(objective);
      if (!station) return false;
      if (position.distanceTo(new THREE.Vector3().fromArray(station.position)) > 1.8) return true;
      progress[objective.id]++;
      world.onActivity?.(objective.id, progress[objective.id], objective.activity.count);
      station.token.material = doneMaterial;
      station.token.scale.setScalar(.65);
      changed();
      return true;
    },
    update(index, elapsed, reducedMotion) {
      if (index !== activeIndex) {
        activeIndex = index;
        world.onObjective?.(index);
        for (const objective of chapter.objectives) if (objective.activity) world.onActivity?.(objective.id, progress[objective.id] ?? 0, objective.activity.count);
      }
      for (const [identity, entries] of stations) entries.forEach(entry => {
        entry.node.visible = chapter.objectives[index]?.id === identity;
        entry.token.material = entry.index < progress[identity] ? doneMaterial : pendingMaterial;
        if (!reducedMotion) entry.token.rotation.y = elapsed * .4;
      });
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose(); standGeometry.dispose();
      pendingMaterial.dispose(); doneMaterial.dispose(); standMaterial.dispose();
    },
  };
}
