import * as THREE from 'three';

export const RECORD_HILL_LANDMARKS = Object.freeze({
  recordBox: Object.freeze([0, 0, -5]),
  forkedTree: Object.freeze([8, 0, -11]),
  westernBoulder: Object.freeze([-11, 0, -9]),
  easternBoulder: Object.freeze([8, 0, 1]),
  writingRefuge: Object.freeze([-13, 0, 13]),
  trailBend: Object.freeze([-4, 0, 5]),
});

export function buildRecordHill(context, {snow = false} = {}) {
  const {box, sphere, cylinder, mesh, tree, curve, colliders, spawn, focus, bounds} = context;
  Object.assign(bounds, {minX: -75, maxX: 75, minZ: -80, maxZ: 75});
  spawn.set(0, 0, 30);
  focus.set(0, 1.3, -5);
  curve([[0, 40], [-3, 15], [-4, 5], [0, -5]], 2.3, snow ? '#aaa18c' : '#b8ae87');
  for (let index = 0; index < 36; index += 1) {
    const angle = index * 2.399963;
    const distance = 23 + index % 7 * 4.2;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance - 7;
    if (Math.abs(x + 2) < 5 && z > 0) continue;
    tree(x, z, .85 + index % 5 * .16);
  }
  tree(8, -11, 1.9);
  tree(-7, -7, 1.5);
  for (const [x, z, scale] of [[-11, -9, 2.8], [8, 1, 2.2]]) {
    const stone = sphere(x, scale * .3, z, scale, snow ? '#8f9a91' : '#929788', 0);
    stone.scale.set(1.2, .65, 1);
    colliders.push({x, z, radius: scale * .85});
  }
  box(0, -.015, -5, 1.2, .03, 1.6, '#59604f');
  for (const side of [-1, 1]) box(side * .7, .12, -5, .2, .27, 1.8, '#9a9e8d');
  for (const end of [-1, 1]) box(0, .12, -5 + end * .9, 1.6, .27, .2, '#9a9e8d');
  const lid = box(1.4, .22, -5.2, 1.6, .28, 2, '#a0a393');
  lid.rotation.z = -.2;
  for (let plate = 0; plate < 9; plate += 1) box(0, .05 + plate * .02, -5, .6, .015, .78, plate % 2 ? '#d4ac55' : '#e7c871');
  for (let ring = 0; ring < 3; ring += 1) {
    const object = mesh(new THREE.TorusGeometry(.08, .016, 5, 10), '#d7b361', -.3, .13, -5.25 + ring * .25);
    object.rotation.y = Math.PI / 2;
  }
  if (snow) {
    for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) cylinder(-13 + sideX * 2.2, 1.4, 13 + sideZ * 1.7, .07, .09, 2.8, '#74634c', 5);
    box(-13, 2.8, 13, 5, .1, 4, '#8f8469').rotation.z = .03;
    box(-13, .65, 13, 2.4, .15, 1.4, '#837252');
    for (let patch = 0; patch < 36; patch += 1) {
      const angle = patch * 2.399;
      const distance = 9 + patch % 7 * 4;
      const snowPatch = mesh(new THREE.CircleGeometry(1.4 + patch % 3, 7), '#e6e9dc', Math.cos(angle) * distance, .016, Math.sin(angle) * distance - 3);
      snowPatch.rotation.x = -Math.PI / 2;
      snowPatch.castShadow = false;
    }
  }
  return {
    objectivePoints: {center: [0, 0, -3], prayer: [0, 0, -7], study: [-9, 0, 11], gather: [-4, 0, 5]},
    getGroundHeight: () => 0,
    summary: {
      kind: 'shared-record-discovery-hill', sharedHillSeed: 'record-discovery-hill-v1',
      sharedLandmarks: RECORD_HILL_LANDMARKS,
      season: snow ? 'Artistically chosen final winter' : 'Joseph’s discovery season',
      adaptation: 'Shared authored terrain connects the devotional narrative. Moroni’s route, final season and precise burial date are not supplied by scripture.',
    },
  };
}
