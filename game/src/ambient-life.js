import * as THREE from 'three';
import {createPointField} from './architecture-kit.js';

// Living layers laid over a built world: ground cover, birds, poultry, butterflies,
// fireflies and laundry. Everything is instanced or pooled so the cost stays flat.

const PASTORAL = ['bedroom', 'harmony', 'farm', 'witnesses', 'missouri', 'river', 'grove', 'hill'];
const SETTLED = ['town', 'kirtland', 'nauvoo', 'carthage'];

export function buildAmbientLife(context) {
  const {group, mesh, material, quality, chapter, environment, night, interior, celestial, desert, colliders, random} = context;
  const low = quality === 'low';
  const owned = [];
  const updaters = [];
  const record = Boolean(chapter.record);
  const outdoors = !interior && environment !== 'liberty';
  const pastoral = PASTORAL.includes(environment);
  const settled = SETTLED.includes(environment) || ['lowell', 'manhattan'].includes(environment);
  const transform = new THREE.Object3D();

  function own(item) { owned.push(item); return item; }

  const footprints = (context.architecture?.buildings ?? []).map(building => ({x: building.x, z: building.z, width: building.width + 3, depth: building.depth + 3}));
  if (environment === 'carthage') footprints.push({x: 0, z: 0, width: 13, depth: 15});
  function indoors(x, z) { return footprints.some(item => Math.abs(x - item.x) < item.width / 2 && Math.abs(z - item.z) < item.depth / 2); }

  function blocked(x, z, margin = .6) {
    if (indoors(x, z)) return true;
    return colliders.some(collider => collider.radius
      ? Math.hypot(x - collider.x, z - collider.z) < collider.radius + margin
      : Math.abs(x - collider.x) < collider.width / 2 + margin && Math.abs(z - collider.z) < collider.depth / 2 + margin);
  }

  function scatter(count, minRadius, maxRadius, avoidPath = true) {
    const spots = [];
    let guard = 0;
    while (spots.length < count && guard++ < count * 8) {
      const angle = random() * Math.PI * 2;
      const distance = minRadius + Math.sqrt(random()) * (maxRadius - minRadius);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      if (avoidPath && Math.abs(x) < 3.2) continue;
      if (blocked(x, z)) continue;
      spots.push([x, z]);
    }
    return spots;
  }

  function instanced(geometry, color, spots, place, options = {}) {
    if (!spots.length) return null;
    own(geometry);
    const surface = typeof color === 'string' ? material(color, {...options, ...(geometry.userData.doubleSided ? {side: THREE.DoubleSide} : {})}) : color;
    const batch = new THREE.InstancedMesh(geometry, surface, spots.length);
    spots.forEach((spot, index) => {
      place(spot, index);
      transform.updateMatrix();
      batch.setMatrixAt(index, transform.matrix);
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.castShadow = false;
    batch.receiveShadow = true;
    batch.name = 'ambient-ground-cover';
    group.add(batch);
    return batch;
  }

  // Ground cover: grass clumps, field stones, and wildflowers in three tints.
  if (outdoors && !celestial && !record && (pastoral || settled) && !desert) {
    const grass = grassClump(random);
    for (const [tint, share] of [['#6f8a4f', .45], ['#879c5c', .35], ['#a3a466', .2]]) {
      const spots = scatter(Math.round((low ? 260 : 900) * share), 4, 78);
      const clump = grass.clone();
      clump.userData.doubleSided = true;
      instanced(clump, tint, spots, ([x, z]) => {
        transform.position.set(x, -.02, z);
        transform.rotation.set((random() - .5) * .3, random() * Math.PI, (random() - .5) * .3);
        const size = .8 + random() * 1.1;
        transform.scale.set(size, size * (.7 + random() * .6), size);
      });
    }
    grass.dispose();
    const stone = new THREE.IcosahedronGeometry(.5, 1);
    instanced(stone, '#8a877f', scatter(low ? 20 : 60, 6, 80), ([x, z]) => {
      transform.position.set(x, -.08, z);
      transform.rotation.set(random() * 3, random() * 3, random() * 3);
      const size = .25 + random() * .7;
      transform.scale.set(size * (1 + random()), size * .45, size);
    });
    const petal = new THREE.IcosahedronGeometry(.07, 0);
    for (const tint of ['#f0e2b6', '#c9a3c4', '#e3c35a']) {
      instanced(petal.clone(), tint, scatter(low ? 40 : 140, 5, 60), ([x, z]) => {
        transform.position.set(x, .32 + random() * .2, z);
        transform.rotation.set(0, 0, 0);
        transform.scale.setScalar(.8 + random() * .8);
      });
    }
    petal.dispose();
  }

  // A flock circling high above, banking slowly.
  if (outdoors && !(night && !celestial)) {
    const count = low ? 6 : 13;
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .18, -.55, .25, -.05, 0, 0, -.12, 0, 0, .18, 0, 0, -.12, .55, .25, -.05], 3));
    wing.computeVertexNormals();
    own(wing);
    const surface = own(new THREE.MeshBasicMaterial({color: celestial ? '#f6f1e2' : '#3c3d3a', side: THREE.DoubleSide, fog: true}));
    const flock = new THREE.InstancedMesh(wing, surface, count);
    flock.frustumCulled = false;
    flock.name = 'ambient-birds';
    group.add(flock);
    const birds = Array.from({length: count}, (_, index) => ({radius: 16 + random() * 22, height: 17 + random() * 12, speed: .12 + random() * .08, phase: random() * Math.PI * 2, flap: 6 + random() * 4, offset: index}));
    updaters.push(elapsed => {
      birds.forEach((bird, index) => {
        const angle = bird.phase + elapsed * bird.speed;
        const glide = Math.sin(elapsed * .4 + bird.offset) > .3;
        transform.position.set(Math.cos(angle) * bird.radius + Math.sin(elapsed * .05) * 12, bird.height + Math.sin(elapsed * .7 + bird.offset) * 1.2, Math.sin(angle) * bird.radius - 10);
        transform.rotation.set(0, -angle, .35);
        const beat = glide ? .25 : Math.sin(elapsed * bird.flap + bird.offset);
        transform.scale.set(1.4, 1.4 * beat, 1.4);
        transform.updateMatrix();
        flock.setMatrixAt(index, transform.matrix);
      });
      flock.instanceMatrix.needsUpdate = true;
    });
  }

  // Hens that wander, pause and peck in the dooryard.
  if (outdoors && pastoral && !night) {
    const yard = new THREE.Vector2(-8.5, 11);
    const hens = [];
    for (let index = 0; index < (low ? 3 : 6); index++) {
      const hen = new THREE.Group();
      hen.name = 'ambient-hen';
      hen.userData.mergeStatic = true;
      const plumage = ['#e9e1cf', '#9a5f3a', '#c9a06a', '#3f3a35'][index % 4];
      const part = (geometry, color, x, y, z, sx = 1, sy = 1, sz = 1) => {
        const piece = new THREE.Mesh(own(geometry), material(color));
        piece.position.set(x, y, z);
        piece.scale.set(sx, sy, sz);
        piece.castShadow = true;
        hen.add(piece);
        return piece;
      };
      part(new THREE.IcosahedronGeometry(.16, 1), plumage, 0, .24, 0, 1, .9, 1.35);
      part(new THREE.ConeGeometry(.09, .2, 5), plumage, 0, .33, -.2, 1, 1, .6).rotation.x = -.9;
      const head = new THREE.Group();
      head.position.set(0, .38, .17);
      hen.add(head);
      const headPart = (geometry, color, x, y, z) => {
        const piece = new THREE.Mesh(own(geometry), material(color));
        piece.position.set(x, y, z);
        head.add(piece);
        return piece;
      };
      headPart(new THREE.IcosahedronGeometry(.075, 1), plumage, 0, 0, 0);
      headPart(new THREE.BoxGeometry(.025, .06, .08), '#b8322a', 0, .07, 0);
      headPart(new THREE.ConeGeometry(.022, .07, 4), '#d9a441', 0, -.01, .09).rotation.x = Math.PI / 2;
      for (const side of [-1, 1]) part(new THREE.CylinderGeometry(.012, .012, .16, 4), '#d9a441', side * .05, .08, 0);
      hen.position.set(yard.x + (random() - .5) * 5, 0, yard.y + (random() - .5) * 4);
      group.add(hen);
      hens.push({hen, head, target: hen.position.clone(), wait: random() * 3, peck: 0});
    }
    updaters.push((elapsed, delta) => {
      for (const item of hens) {
        const {hen, head, target} = item;
        const toTarget = target.clone().sub(hen.position);
        toTarget.y = 0;
        if (item.wait > 0) {
          item.wait -= delta;
          item.peck = Math.max(0, Math.sin(elapsed * 9 + hen.position.x * 3));
          head.position.y = .38 - item.peck * .2;
          head.rotation.x = item.peck * 1.1;
          if (item.wait <= 0) target.set(yard.x + (Math.random() - .5) * 7, 0, yard.y + (Math.random() - .5) * 5);
        } else if (toTarget.length() < .1) {
          item.wait = 1 + Math.random() * 3.5;
        } else {
          const heading = Math.atan2(toTarget.x, toTarget.z);
          hen.rotation.y += Math.atan2(Math.sin(heading - hen.rotation.y), Math.cos(heading - hen.rotation.y)) * Math.min(1, delta * 6);
          hen.position.addScaledVector(toTarget.normalize(), delta * .55);
          hen.position.y = Math.abs(Math.sin(elapsed * 14)) * .03;
          head.position.y = .38;
          head.rotation.x = 0;
          head.position.z = .17 + Math.sin(elapsed * 14) * .03;
        }
      }
    });
  }

  // Daytime butterflies over gardens; summer fireflies after dark.
  if (outdoors && !record && !desert) {
    if (!night) {
      const count = low ? 5 : 12;
      const wings = own(new THREE.PlaneGeometry(.16, .11));
      const surface = own(new THREE.MeshBasicMaterial({color: celestial ? '#fff3c8' : '#f2d27a', side: THREE.DoubleSide}));
      const flutter = new THREE.InstancedMesh(wings, surface, count);
      flutter.frustumCulled = false;
      flutter.name = 'ambient-butterflies';
      group.add(flutter);
      const homes = Array.from({length: count}, () => [(random() - .5) * 40, (random() - .5) * 36 + 4, random() * 6]);
      updaters.push(elapsed => {
        homes.forEach(([x, z, phase], index) => {
          transform.position.set(x + Math.sin(elapsed * .5 + phase) * 2.5, .7 + Math.abs(Math.sin(elapsed * 1.3 + phase)) * .8, z + Math.sin(elapsed * .37 + phase * 2) * 2.2);
          transform.rotation.set(-Math.PI / 2, 0, elapsed * .5 + phase);
          transform.scale.set(Math.abs(Math.cos(elapsed * 14 + phase)) + .1, 1, 1);
          transform.updateMatrix();
          flutter.setMatrixAt(index, transform.matrix);
        });
        flutter.instanceMatrix.needsUpdate = true;
      });
    } else {
      const count = low ? 30 : 90;
      const field = createPointField(count, '#e9ff9a', {additive: true, scale: 60});
      own(field.geometry);
      own(field.material);
      group.add(field.points);
      const homes = [];
      while (homes.length < count) {
        const spot = [(random() - .5) * 60, .4 + random() * 2.2, (random() - .5) * 60, random() * 20];
        if (!indoors(spot[0], spot[2])) homes.push(spot);
      }
      const position = field.geometry.attributes.position;
      const size = field.geometry.attributes.aSize;
      const alpha = field.geometry.attributes.aAlpha;
      updaters.push(elapsed => {
        homes.forEach(([x, y, z, phase], index) => {
          position.setXYZ(index, x + Math.sin(elapsed * .3 + phase) * 1.5, y + Math.sin(elapsed * .8 + phase) * .3, z + Math.cos(elapsed * .25 + phase) * 1.5);
          size.setX(index, 1);
          alpha.setX(index, Math.max(0, Math.sin(elapsed * 1.6 + phase * 3)) ** 3);
        });
        position.needsUpdate = size.needsUpdate = alpha.needsUpdate = true;
      });
    }
  }

  // A wash line behind the farmhouse, its linens lifting in the breeze.
  if (outdoors && ['bedroom', 'harmony', 'farm'].includes(environment) && !night) {
    const [x0, z0, length] = [10, -12, 7];
    for (const end of [0, 1]) {
      const post = new THREE.Mesh(own(new THREE.CylinderGeometry(.06, .07, 2.3, 6)), material('#6b513b'));
      post.position.set(x0 + end * length, 1.15, z0);
      post.castShadow = true;
      group.add(post);
    }
    const line = new THREE.Mesh(own(new THREE.CylinderGeometry(.008, .008, length, 4)), material('#d8d0bc'));
    line.position.set(x0 + length / 2, 2.15, z0);
    line.rotation.z = Math.PI / 2;
    group.add(line);
    const linens = [];
    ['#f1ebdd', '#c9d1c4', '#e8dcc0', '#b9c6cc', '#efe6d0'].forEach((tint, index) => {
      const cloth = new THREE.Mesh(own(new THREE.PlaneGeometry(.9, .75 + (index % 2) * .35, 4, 4)), material(tint, {side: THREE.DoubleSide}));
      cloth.geometry.translate(0, -(.75 + (index % 2) * .35) / 2, 0);
      cloth.position.set(x0 + .8 + index * 1.35, 2.14, z0);
      cloth.castShadow = true;
      cloth.name = 'ambient-laundry';
      group.add(cloth);
      linens.push(cloth);
    });
    updaters.push(elapsed => linens.forEach((cloth, index) => { cloth.rotation.x = .18 + Math.sin(elapsed * 1.7 + index) * .14 + Math.sin(elapsed * 3.1 + index * 2) * .05; }));
  }

  return {
    update(delta, elapsed) { for (const step of updaters) step(elapsed, Math.min(delta, .1)); },
    dispose() { owned.forEach(item => item.dispose()); },
  };
}

// Seven tapered blades leaning outward; normals point up so clumps shade like the turf.
function grassClump(random) {
  const positions = [];
  for (let blade = 0; blade < 7; blade++) {
    const angle = blade / 7 * Math.PI * 2 + random() * .6;
    const height = .28 + random() * .32;
    const lean = .06 + random() * .14;
    const base = [Math.cos(angle) * .05, 0, Math.sin(angle) * .05];
    const side = [Math.cos(angle + Math.PI / 2) * .035, 0, Math.sin(angle + Math.PI / 2) * .035];
    positions.push(base[0] - side[0], 0, base[2] - side[2], base[0] + side[0], 0, base[2] + side[2], base[0] + Math.cos(angle) * lean, height, base[2] + Math.sin(angle) * lean);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({length: positions.length / 3}, () => [0, 1, 0]).flat(), 3));
  geometry.userData.doubleSided = true;
  return geometry;
}
