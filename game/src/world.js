import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildConnectedSettlement} from './settlement-world.js';
import {buildCarthageWorld} from './carthage-world.js';
import {buildZionWorld} from './zion-world.js';
import {buildRecordSacredWorld} from './record-sacred-world.js';
import {buildRecordAdventureWorld} from './record-adventure-world.js';
import {buildRecordHill} from './record-hill.js';
import {buildWorldDetail} from './world-detail.js';

const PALETTE = {
  grass: '#829b65', darkGrass: '#50684b', leaf: '#677c4a', lightLeaf: '#b3bc79',
  bark: '#69513c', wood: '#9d7850', darkWood: '#514236', cream: '#e5d3ad',
  stone: '#bcb6a3', path: '#bfb49c', gold: '#d4aa53', water: '#719eab', ink: '#363e35',
};

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createWorld({ scene, chapter, quality = 'high' }) {
  const environment = chapter.environment || 'farm';
  const random = seededRandom(Number.parseInt(chapter.id, 10) * 919 + 851 || 851);
  const group = new THREE.Group();
  group.name = `world-${environment}`;
  scene.add(group);
  const previous = { background: scene.background, fog: scene.fog };
  const colliders = [];
  const animated = [];
  const materials = new Map();
  const geometries = new Set();
  const interior = ['bedroom', 'harmony', 'liberty', 'carthage'].includes(environment);
  const night = environment === 'liberty' || environment === 'bedroom' && chapter.id === '04';
  const celestial = environment === 'celestial';
  const desert = chapter.id === 'E6';
  const connected = ['bedroom', 'harmony', 'farm', 'town', 'kirtland', 'nauvoo', 'lowell', 'manhattan'].includes(environment);
  let architecture = null;
  const extras = [];
  const bounds = interior ? { minX: -8, maxX: 8, minZ: -8, maxZ: 10 } : celestial ? { minX: -21, maxX: 21, minZ: -21, maxZ: 21 } : { minX: -31, maxX: 31, minZ: -31, maxZ: 31 };
  const spawn = new THREE.Vector3(0, 0, 8);
  const focus = new THREE.Vector3(0, 1.3, 0);
  const points = [
    { id: 'center', label: 'Gather here', position: new THREE.Vector3(0, 0, 0), kind: 'gather' },
    { id: 'gather', label: 'Offer a helping hand', position: new THREE.Vector3(-4, 0, 1), kind: 'person' },
    { id: 'study', label: 'Read and reflect', position: new THREE.Vector3(3, 0, -2), kind: 'study' },
    { id: 'prayer', label: 'A quiet place to pray', position: new THREE.Vector3(0, 0, -5), kind: 'prayer' },
    { id: 'journey', label: 'Continue the journey', position: new THREE.Vector3(0, 0, interior ? 9 : 13), kind: 'travel' },
  ];

  function material(color, options = {}) {
    const key = `${color}:${JSON.stringify(options)}`;
    if (!materials.has(key)) {
      const surface = new THREE.MeshToonMaterial({ color, ...options });
      if ([PALETTE.grass, PALETTE.darkGrass].includes(color)) surface.userData.lightingRole = 'ground';
      if ([PALETTE.leaf, PALETTE.lightLeaf, '#829357', '#687c50'].includes(color)) surface.userData.lightingRole = 'foliage';
      if (color === PALETTE.gold) surface.userData.lightingRole = 'accent';
      materials.set(key, surface);
    }
    return materials.get(key);
  }

  function mesh(geometry, color, x, y, z, options = {}) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, typeof color === 'string' ? material(color, options) : color);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    group.add(object);
    return object;
  }

  function box(x, y, z, width, height, depth, color, options) {
    return mesh(new THREE.BoxGeometry(width, height, depth), color, x, y, z, options);
  }

  function cylinder(x, y, z, top, bottom, height, color, segments = 10) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), color, x, y, z);
  }

  function sphere(x, y, z, radius, color, detail = 1) {
    return mesh(new THREE.IcosahedronGeometry(radius, detail), color, x, y, z);
  }

  function curve(pointsOnGround, width, color = PALETTE.path, height = 0.022) {
    const path = new THREE.CatmullRomCurve3(pointsOnGround.map(([x, z]) => new THREE.Vector3(x, height, z)));
    const samples = path.getPoints(100);
    const positions = [];
    const indices = [];
    samples.forEach((position, index) => {
      const tangent = path.getTangent(index / 100);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
      positions.push(position.x + normal.x, height, position.z + normal.z, position.x - normal.x, height, position.z - normal.z);
      if (index < 100) {
        const offset = index * 2;
        indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry, color, 0, 0, 0, { side: THREE.DoubleSide });
  }

  function tree(x, z, scale = 1, blossom = false) {
    const height = 5.6 * scale;
    cylinder(x, height / 2, z, 0.19 * scale, 0.31 * scale, height, PALETTE.bark, 7);
    const foliage = blossom ? ['#d1b2aa', '#eed6c3', '#cfba9d'] : [PALETTE.leaf, '#829357', PALETTE.lightLeaf];
    const canopy = sphere(x, height + 0.3 * scale, z, 2.45 * scale, foliage[0]);
    canopy.scale.set(1, 0.83, 1);
    sphere(x - 1.35 * scale, height - 0.15 * scale, z + 0.32 * scale, 1.72 * scale, foliage[1]);
    sphere(x + 1.3 * scale, height + 0.4 * scale, z - 0.3 * scale, 1.8 * scale, foliage[2]);
    colliders.push({ x, z, radius: 0.38 * scale });
  }

  function forest(amount = 52, orchard = false) {
    for (let index = 0; index < amount; index += 1) {
      const angle = random() * Math.PI * 2;
      const distance = 13 + random() * 24;
      const x = Math.sin(angle) * distance;
      const z = Math.cos(angle) * distance;
      if (Math.abs(x) < 4 && z > 8) continue;
      tree(x, z, orchard ? 0.55 + random() * 0.3 : 0.8 + random() * 0.8, orchard && index % 4 === 0);
    }
  }

  function flowerField(amount = 190) {
    const stemGeometry = new THREE.CylinderGeometry(0.015, 0.022, 0.28, 3);
    const petalGeometry = new THREE.IcosahedronGeometry(0.07, 0);
    geometries.add(stemGeometry);
    geometries.add(petalGeometry);
    const flowers = new THREE.InstancedMesh(petalGeometry, material(celestial ? '#fff5c3' : '#e9dcc2'), amount);
    const stems = new THREE.InstancedMesh(stemGeometry, material('#4f7249'), amount);
    const transform = new THREE.Object3D();
    for (let index = 0; index < amount; index += 1) {
      const x = (random() - 0.5) * 65;
      const z = (random() - 0.5) * 65;
      const hidden = Math.abs(x) < 2.3 || Math.hypot(x, z) < 8;
      transform.position.set(x, hidden ? -1 : 0.15, z);
      transform.scale.setScalar(0.7 + random() * 0.8);
      transform.updateMatrix();
      stems.setMatrixAt(index, transform.matrix);
      transform.position.y += 0.15;
      transform.updateMatrix();
      flowers.setMatrixAt(index, transform.matrix);
    }
    group.add(flowers, stems);
  }

  function bench(x, z, rotation = 0, width = 2.5) {
    const assembly = new THREE.Group();
    const previousChildren = group.children.length;
    box(0, 0.52, 0, width, 0.16, 0.45, PALETTE.wood);
    box(0, 0.93, -0.18, width, 0.5, 0.11, PALETTE.wood);
    for (const side of [-1, 1]) box(side * width * 0.36, 0.25, 0, 0.13, 0.5, 0.36, PALETTE.darkWood);
    group.children.slice(previousChildren).forEach(object => assembly.add(object));
    assembly.position.set(x, 0, z);
    assembly.rotation.y = rotation;
    group.add(assembly);
  }

  function table(x, z, width = 2.8, depth = 1.45, height = 1) {
    box(x, height, z, width, 0.15, depth, PALETTE.wood);
    for (const sideX of [-1, 1]) {
      for (const sideZ of [-1, 1]) box(x + sideX * (width / 2 - 0.15), height / 2, z + sideZ * (depth / 2 - 0.15), 0.12, height, 0.12, PALETTE.darkWood);
    }
    colliders.push({ x, z, width, depth });
  }

  function book(x, y, z, open = true) {
    box(x, y, z, 0.75, 0.08, 0.53, '#555d52');
    const pages = box(x, y + 0.05, z, open ? 1.04 : 0.68, 0.07, 0.47, '#f6e8c7');
    if (open) box(x, y + 0.094, z, 0.025, 0.012, 0.46, '#c0a176');
    return pages;
  }

  function plates(x = 3, y = 1.14, z = -2) {
    for (let index = 0; index < 7; index += 1) box(x, y + index * 0.022, z, 0.53, 0.017, 0.7, index % 2 ? '#cba64e' : '#edce75');
    for (let index = 0; index < 3; index += 1) {
      const ring = mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 12), '#c7a04a', x - 0.26, y + 0.08, z - 0.24 + index * 0.24);
      ring.rotation.y = Math.PI / 2;
    }
    for (let line = 0; line < 8; line += 1) {
      for (let column = 0; column < 4; column += 1) box(x - 0.12 + column * 0.08, y + 0.146, z - 0.25 + line * 0.065, 0.032, 0.004, 0.012, '#8f743e');
    }
  }

  function fence(x, z, length, axis = 'x') {
    const count = Math.ceil(length / 2.7);
    for (let index = 0; index <= count; index += 1) {
      const distance = index / count * length;
      box(x + (axis === 'x' ? distance : 0), 0.65, z + (axis === 'z' ? distance : 0), 0.16, 1.3, 0.16, '#9c8862');
    }
    for (const height of [0.5, 0.95]) box(x + (axis === 'x' ? length / 2 : 0), height, z + (axis === 'z' ? length / 2 : 0), axis === 'x' ? length : 0.1, 0.11, axis === 'z' ? length : 0.1, '#9c8862');
  }

  function cottage(x, z, width = 7, depth = 5, color = '#b99d77', height = 3.4) {
    box(x, height / 2, z, width, height, depth, color);
    const roof = cylinder(x, height + 0.9, z, 0, 1, 2, PALETTE.darkWood, 4);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(width * 0.79, 1, depth * 0.79);
    box(x + width * 0.28, height + 1.2, z + 0.4, 0.8, 2.2, 0.85, '#927966');
    box(x, 1.15, z + depth / 2 + 0.035, 1.12, 2.3, 0.12, '#5d5646');
    for (const side of [-1, 1]) {
      box(x + side * width * 0.3, 1.75, z + depth / 2 + 0.08, 1.1, 1.3, 0.12, '#decbaa');
      box(x + side * width * 0.3, 1.75, z + depth / 2 + 0.15, 0.9, 1.12, 0.06, '#90a4a0');
      box(x + side * width * 0.3, 1.75, z + depth / 2 + 0.19, 0.05, 1.12, 0.035, '#efe4ca');
      box(x + side * width * 0.3, 1.75, z + depth / 2 + 0.19, 0.9, 0.05, 0.035, '#efe4ca');
    }
    for (let level = 0; level < height / 0.24; level += 1) box(x, level * 0.24 + 0.1, z + depth / 2 + 0.015, width, 0.028, 0.03, '#a38e6b');
    colliders.push({ x, z, width: width + 0.2, depth: depth + 0.2 });
  }

  function room(prison = false) {
    box(0, -0.14, 1, 18, 0.28, 22, prison ? '#9b978c' : '#947651');
    for (let index = 0; index < 26; index += 1) box(-8.7 + index * 0.7, 0.013, 1, 0.023, 0.015, 21.8, prison ? '#8f8b80' : '#745b43');
    const wall = prison ? '#b9b3a3' : '#b9a380';
    box(0, 2.2, -10, 18.4, 4.4, 0.4, wall);
    box(-9, 2.2, 1, 0.4, 4.4, 22, wall);
    box(9, 2.2, 1, 0.4, 4.4, 22, wall);
    for (const side of [-1, 1]) box(side * 6.1, 2.2, 12, 5.8, 4.4, 0.4, wall);
    for (const x of [-8.7, -4.4, 0, 4.4, 8.7]) box(x, 4.2, 1, 0.16, 0.22, 22, PALETTE.darkWood);
    for (const z of [-9.8, 0, 11.7]) box(0, 4.25, z, 18, 0.23, 0.23, PALETTE.darkWood);
    for (const side of [-1, 1]) {
      box(side * 8.76, 2.4, -2, 0.1, 1.8, 2.8, '#aab5af');
      for (let pane = 0; pane < (prison ? 5 : 3); pane += 1) box(side * 8.65, 2.4, -3.1 + pane * (prison ? 0.55 : 1.1), 0.13, 1.95, 0.06, prison ? '#5c625b' : '#ecdfbe');
      box(side * 8.6, 1.45, -2, 0.5, 0.14, 3, PALETTE.darkWood);
    }
    if (prison) {
      for (let row = 0; row < 9; row += 1) {
        for (let column = 0; column < 12; column += 1) box(-8.2 + column * 1.5 + (row % 2) * 0.65, row * 0.47 + 0.2, -9.77, 1.41, 0.018, 0.02, '#a29b8b');
      }
      bench(-5.5, -6.5, 0, 4);
      bench(5.5, -6.5, 0, 4);
      box(-6.5, 0.4, 3, 2.2, 0.6, 4.1, '#7b705d');
      box(-6.5, 0.78, 3, 2.3, 0.18, 4.1, '#c4b89b');
      table(3, -2, 2.5, 1.4);
      book(3, 1.14, -2);
    } else {
      box(-6.1, 0.4, -4.5, 3, 0.65, 4.5, '#6d543f');
      box(-6.1, 0.81, -4.5, 3, 0.2, 4.5, '#e9dfc3');
      box(-6.1, 0.97, -4, 3, 0.17, 3.5, '#8e9c89');
      box(-6.1, 1.05, -6, 2.2, 0.25, 0.8, '#f0e5ce');
      table(3, -2);
      book(3, 1.14, -2);
      box(6.7, 1.1, -8.5, 2.7, 2.2, 1, '#765e43');
      for (const height of [0.45, 1.05, 1.65]) box(6.7, height, -7.95, 2.3, 0.08, 0.05, '#b19a73');
      const rug = box(0, 0.035, 2, 6, 0.025, 8, '#a68b6c');
      rug.castShadow = false;
    }
  }

  function temple(x, z) {
    const width = 11;
    const depth = 17;
    box(x, 0.35, z, 13.5, 0.7, 19, '#c9c6b1');
    box(x, 4.2, z, width, 8.2, depth, '#eee3c6');
    box(x, 8.5, z, width + 0.8, 0.5, depth + 0.7, '#d2c7aa');
    box(x, 9.1, z, 9.5, 0.8, depth - 0.5, '#c1b49a');
    for (let index = 0; index < 5; index += 1) {
      for (const side of [-1, 1]) {
        const windowZ = z - 6.3 + index * 3.1;
        box(x + side * 5.54, 3.3, windowZ, 0.1, 2.7, 1.1, '#8a9b94');
        box(x + side * 5.68, 5.9, windowZ, 0.35, 0.35, 1.35, '#d5be83');
      }
    }
    for (const side of [-1, 1]) {
      box(x + side * 3.8, 4, z + 8.55, 0.65, 7.7, 0.6, '#f4eace');
      box(x + side * 2.1, 3.2, z + 8.55, 0.85, 3.1, 0.1, '#8a9b94');
    }
    box(x, 2, z + 8.62, 1.6, 3.8, 0.13, '#756957');
    box(x, 10.5, z + 5.6, 3.3, 3.6, 3.3, '#eadfc2');
    cylinder(x, 13.2, z + 5.6, 1.55, 1.75, 2, '#d0ba87', 8);
    cylinder(x, 15.5, z + 5.6, 0, 1.5, 2.8, '#a79c7d', 8);
    sphere(x, 17.1, z + 5.6, 0.25, PALETTE.gold, 1);
    colliders.push({ x, z, width: 14, depth: 19 });
  }

  function memorialConference() {
    box(0, -0.14, -2.8, 7, 0.28, 8.2, '#ad9164');
    for (let index = 0; index < 13; index += 1) box(0, 0.006, -6.6 + index * 0.63, 6.96, 0.012, 0.018, '#7f6b4e');
    for (const side of [-1, 1]) {
      for (const z of [-6.8, -3.6]) box(side * 3.35, 0.38, z, 0.14, 0.76, 0.14, '#927652');
      box(side * 3.35, 0.7, -5.2, 0.11, 0.12, 3.3, '#a98b5b');
    }
    box(-2.2, 0.55, -5.8, 0.9, 1.1, 0.65, '#8e6d46');
    box(-2.2, 1.18, -5.8, 1.28, 0.13, 0.88, '#b49666').rotation.x = -0.12;
    book(-2.2, 1.28, -5.8);
    bench(2, -5.8, Math.PI, 1.5);

    const batches = new Map();
    const shapes = {
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.IcosahedronGeometry(1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
      skirt: new THREE.CylinderGeometry(0.65, 1, 1, 9),
      bonnet: new THREE.TorusGeometry(1, 0.28, 5, 12),
    };
    Object.values(shapes).forEach(geometry => geometries.add(geometry));
    const transform = new THREE.Object3D();
    function part(shape, color, x, y, z, width, height, depth, rotation = 0) {
      const key = `${shape}:${color}`;
      if (!batches.has(key)) batches.set(key, { geometry: shapes[shape], color, matrices: [] });
      transform.position.set(x, y, z);
      transform.rotation.set(0, 0, rotation);
      transform.scale.set(width, height, depth);
      transform.updateMatrix();
      batches.get(key).matrices.push(transform.matrix.clone());
    }
    const coats = ['#434b47', '#62665b', '#716454', '#5f6b69', '#77715c'];
    const dresses = ['#65746b', '#777a73', '#998e7c', '#61717c', '#8b7b70'];
    const skins = ['#c7a27a', '#d3b28e', '#b99470', '#dfc19a'];
    const hairColors = ['#61533f', '#7c6b51', '#aaa18c', '#534c40'];
    for (let row = 0; row < 5; row += 1) {
      for (const side of [-1, 1]) {
        const z = 6.8 + row * 3.35;
        bench(side * 5.4, z, Math.PI, 4.8);
        for (let seat = 0; seat < 3; seat += 1) {
          const x = side * 5.4 + (seat - 1) * 1.3;
          const woman = (row + seat + (side > 0 ? 1 : 0)) % 2 === 0;
          const age = (row + seat) % 4;
          const clothing = woman ? dresses[(row + seat) % dresses.length] : coats[(row + seat) % coats.length];
          const skin = skins[(row + seat) % skins.length];
          const hair = hairColors[age];
          const headY = 1.4 + ((row + seat) % 3) * 0.035;
          part('box', clothing, x, 0.94, z - 0.04, 0.43, 0.58, 0.29);
          part('sphere', skin, x, headY, z - 0.06, 0.155, 0.19, 0.155);
          part('sphere', hair, x, headY + 0.115, z - 0.025, 0.163, 0.092, 0.155);
          part('sphere', skin, x, headY - 0.015, z - 0.212, 0.035, 0.05, 0.025);
          for (const arm of [-1, 1]) {
            part('box', clothing, x + arm * 0.27, 0.89, z - 0.09, 0.12, 0.39, 0.16, arm * 0.13);
            part('sphere', skin, x + arm * 0.22, 0.69, z - 0.21, 0.07, 0.075, 0.065);
            part('box', '#41433b', x + arm * 0.14, 0.09, z - 0.46, 0.15, 0.16, 0.3);
            part('box', '#493e30', x + arm * 0.06, headY + 0.01, z - 0.211, 0.018, 0.023, 0.014);
          }
          if (woman) {
            part('skirt', clothing, x, 0.43, z - 0.16, 0.36, 0.62, 0.41);
            part('bonnet', '#b6aa8d', x, headY + 0.02, z - 0.025, 0.19, 0.21, 0.17);
            part('box', '#d3c7a9', x, 1.1, z - 0.2, 0.3, 0.17, 0.03);
          } else {
            for (const leg of [-1, 1]) {
              part('box', '#68634f', x + leg * 0.14, 0.58, z - 0.19, 0.17, 0.2, 0.48);
              part('box', '#68634f', x + leg * 0.14, 0.32, z - 0.38, 0.16, 0.45, 0.16);
            }
            part('box', '#cabc9c', x, 1.1, z - 0.201, 0.16, 0.28, 0.035);
            if (age === 2) part('sphere', hair, x, headY - 0.1, z - 0.15, 0.12, 0.1, 0.045);
          }
        }
      }
    }
    for (const [key, batch] of batches) {
      const figures = new THREE.InstancedMesh(batch.geometry, material(batch.color), batch.matrices.length);
      batch.matrices.forEach((matrix, index) => figures.setMatrixAt(index, matrix));
      figures.instanceMatrix.needsUpdate = true;
      figures.castShadow = true;
      figures.receiveShadow = false;
      figures.name = `memorial-congregation-${key}`;
      figures.userData.backgroundCongregation = true;
      figures.visible = false;
      group.add(figures);
    }
    points.push({ id: 'memorial-stand', label: 'An address of consolation', position: new THREE.Vector3(0, 0, -3), kind: 'speak' });
  }

  function town() {
    curve([[0, 40], [0, 15], [-1, 0], [0, -40]], 5.5, PALETTE.path, chapter.id === '28' ? -0.005 : 0.022);
    for (let index = 0; index < 4; index += 1) {
      cottage(-13 - (index % 2) * 1.8, 14 - index * 11, 7 + random() * 2, 6, ['#c6b89a', '#b3a082', '#c2b3a1', '#ae9a7c'][index], 3.6 + (index % 2) * 2.7);
      if (!(environment === 'nauvoo' && index >= 2)) cottage(14, 16 - index * 13, 7.5, 6, index % 2 ? '#b4a486' : '#cebd9d', 4.2);
    }
    fence(-20, 26, 14);
    for (let index = 0; index < 7; index += 1) tree((index % 2 ? -1 : 1) * (21 + random() * 7), 29 - index * 9, 0.8);
    if (environment === 'nauvoo' || environment === 'kirtland') temple(18, -20);
    table(3, -2);
    book(3, 1.14, -2);
    if (environment === 'nauvoo') {
      if (chapter.id === '28') memorialConference();
      else {
        for (let index = 0; index < 4; index += 1) bench(-6, 5 - index * 2.2, 0, 5);
        box(0, 0.18, -6, 5, 0.35, 3, '#8f7c59');
        box(0, 0.95, -6.3, 1.25, 1.25, 0.6, '#8d6845');
      }
    }
    if (environment === 'town') {
      box(-4.8, 1.3, -4.5, 1.1, 1.8, 0.75, '#535b50');
      box(-4.8, 2.4, -4.5, 1.4, 0.15, 1, '#8a7454');
      cylinder(-4.8, 2.1, -4.5, 0.1, 0.1, 1.25, '#4c5044', 8);
      box(-4.8, 1.3, -3.75, 1.3, 0.15, 0.8, '#a78c60');
      for (let index = 0; index < 3; index += 1) box(-5.2 + index * 0.4, 1.41, -3.65, 0.34, 0.08, 0.44, '#ebddbd');
    }
  }

  function river() {
    curve([[19, 55], [13, 26], [18, 0], [15, -24], [23, -55]], 10, PALETTE.water, -0.015);
    for (let index = 0; index < 35; index += 1) {
      const z = (random() - 0.5) * 80;
      const x = 14 + Math.sin(z * 0.06) * 2 + random() * 5;
      const ripple = box(x, 0.012, z, 0.5 + random() * 2, 0.007, 0.045, '#a9c5c6');
      ripple.castShadow = false;
      animated.push({ object: ripple, kind: 'ripple', phase: random() * 8, baseX: x });
    }
    curve([[0, 35], [-3, 15], [1, -3], [9, -10]], 2.4);
    for (let index = 0; index < 17; index += 1) {
      const side = index % 2 ? -1 : 1;
      tree(side < 0 ? -13 - random() * 15 : 28 + random() * 10, (random() - 0.5) * 70, 0.85 + random() * 0.55);
    }
    points.push({ id: 'water', label: 'The riverbank', position: new THREE.Vector3(11, 0, -3), kind: 'water' });
    for (let index = 0; index < 9; index += 1) sphere(10.5 + random() * 2.5, 0.1, -9 + index * 2.1, 0.3 + random() * 0.2, '#a5a497', 0);
  }

  function stars() {
    const positions = [];
    for (let index = 0; index < 1200; index += 1) {
      const angle = random() * Math.PI * 2;
      const inclination = Math.acos(random() * 1.65 - 0.65);
      const radius = 100 + random() * 80;
      positions.push(Math.sin(inclination) * Math.cos(angle) * radius, Math.cos(inclination) * radius + 10, Math.sin(inclination) * Math.sin(angle) * radius);
    }
    const geometry = new THREE.BufferGeometry();
    geometries.add(geometry);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const pointMaterial = new THREE.PointsMaterial({ color: '#fff4d5', size: 0.28, sizeAttenuation: true });
    materials.set('stars', pointMaterial);
    const starField = new THREE.Points(geometry, pointMaterial);
    group.add(starField);
    animated.push({ object: starField, kind: 'stars' });
  }

  function automobile(x, z) {
    box(x, 0.71, z, 2.1, 0.6, 4.7, '#749a9b');
    box(x, 1.24, z - 0.4, 1.95, 0.75, 2.4, '#b9cbc3');
    box(x, 1.3, z + 0.84, 1.7, 0.48, 0.06, '#658384');
    box(x, 1.3, z - 1.64, 1.7, 0.48, 0.06, '#658384');
    box(x, 0.44, z + 2.39, 2.15, 0.15, 0.15, '#c6c6b6');
    box(x, 0.6, z + 2.37, 1.1, 0.25, 0.12, '#666e68');
    for (const side of [-1, 1]) {
      box(x + side * 0.78, 0.8, z + 2.38, 0.28, 0.25, 0.1, '#f3e0a2');
      for (const wheelZ of [-1.3, 1.3]) {
        const wheel = cylinder(x + side * 1.06, 0.4, z + wheelZ, 0.41, 0.41, 0.2, '#434b46', 12);
        wheel.rotation.z = Math.PI / 2;
        const hub = cylinder(x + side * 1.18, 0.4, z + wheelZ, 0.22, 0.22, 0.02, '#b6b5a6', 10);
        hub.rotation.z = Math.PI / 2;
      }
    }
    colliders.push({ x, z, width: 2.4, depth: 5 });
  }

  function archiveComputer(x = 3, z = -2) {
    box(x, 1.28, z, 1.05, 0.28, 0.82, '#c5c1a9');
    box(x, 1.76, z - 0.12, 1.02, 0.76, 0.76, '#c8c3ab');
    box(x, 1.76, z + 0.28, 0.78, 0.55, 0.035, '#426d65');
    for (let index = 0; index < 4; index += 1) box(x - 0.21 + index * 0.1, 1.84, z + 0.306, 0.055, 0.015, 0.005, '#b5c7a0');
    box(x, 1.17, z + 0.69, 1.05, 0.08, 0.37, '#c2bea7');
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 10; column += 1) box(x - 0.42 + column * 0.092, 1.223, z + 0.57 + row * 0.1, 0.065, 0.025, 0.06, '#d8d3bb');
    }
    box(x + 0.8, 1.18, z + 0.6, 0.18, 0.11, 0.26, '#c9c4ad');
    for (let index = 0; index < 4; index += 1) box(x - 0.9, 1.17 + index * 0.04, z, 0.36, 0.04, 0.4, index % 2 ? '#5b6f69' : '#c5b197');
  }

  function waterStation(x, z) {
    cylinder(x, 1.4, z, 0.95, 0.95, 2.6, '#9ab5ad', 16);
    cylinder(x, 2.76, z, 1.02, 1.02, 0.16, '#d7ddc8', 16);
    box(x, 0.62, z + 1.01, 0.15, 0.1, 0.3, '#667c71');
    box(x + 0.8, 3.45, z, 2.4, 0.12, 1.8, '#526e7a').rotation.z = -0.3;
    cylinder(x + 0.8, 1.65, z, 0.055, 0.055, 3.3, '#707b69', 6);
    for (let index = 0; index < 4; index += 1) box(x + 0.05 + index * 0.4, 3.49 - index * 0.12, z, 0.015, 0.025, 1.7, '#9cb1af');
    colliders.push({ x, z, radius: 1.1 });
  }

  scene.background = new THREE.Color(celestial ? '#26334e' : desert ? '#a98f77' : night ? '#333d4c' : '#cadad6');
  scene.fog = new THREE.FogExp2(celestial ? '#435a73' : desert ? '#bba184' : night ? '#596575' : '#d2dfd3', celestial ? 0.005 : 0.011);
  const hemisphere = new THREE.HemisphereLight(celestial ? '#d8eaff' : '#fff2da', night ? '#626479' : '#6e7654', night ? 2.2 : 2.3);
  group.add(hemisphere);
  const sun = new THREE.DirectionalLight(celestial ? '#ffe9b3' : night ? '#dce9ff' : '#ffe8ba', celestial ? 3.5 : night ? 1.7 : 3);
  sun.position.set(-16, 25, 14);
  sun.castShadow = quality !== 'low';
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 100 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.06;
  group.add(sun, sun.target);

  if (!interior && !celestial && !connected && !chapter.record) {
    const ground = mesh(new THREE.PlaneGeometry(400, 400), desert ? '#b39c7f' : PALETTE.grass, 0, -0.02, 0);
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;
    for (let index = 0; index < 14; index += 1) {
      const angle = index / 14 * Math.PI * 2;
      const mound = sphere(Math.sin(angle) * 72, -8, Math.cos(angle) * 72, 20 + random() * 14, desert ? '#9d876e' : '#8da17e', 1);
      mound.scale.set(1.6, 0.6, 1);
      mound.castShadow = false;
    }
    if (!desert) flowerField(quality === 'low' ? 80 : 260);
  }

  const architectureContext = {THREE, scene, chapter, quality, group, box, cylinder, sphere, mesh, material, colliders, points, spawn, focus, bounds, tree, fence, curve, bench, table, book, temple, animated};
  if (chapter.record) {
    const adventure = ['BM05', 'BM07', 'BM15', 'BM16', 'BM17', 'BM18', 'BM19', 'BM24', 'TX01', 'TX02', 'TX03'].includes(chapter.recordId);
    architecture = adventure ? buildRecordAdventureWorld(architectureContext) : buildRecordSacredWorld(architectureContext);
    extras.push(...(architecture.extras ?? []));
  } else if (environment === 'carthage') {
    architecture = buildCarthageWorld(architectureContext);
    scene.background = new THREE.Color('#cbd8d3');
    scene.fog = new THREE.FogExp2('#d2d9cc', .004);
    extras.push(...Array.from({length: quality === 'low' ? 6 : 12}, (_, index) => ({id: `MOB_M_${index}`, position: [index % 2 ? 7 + index % 4 : -7 - index % 4, 0, 9 + Math.floor(index / 2) * 2], rotation: Math.PI, height: 1.7 + index % 3 * .06})));
  } else if (celestial) {
    architecture = buildZionWorld(architectureContext);
    scene.fog = new THREE.FogExp2('#ccdbd4', architecture.recommendedFogDensity ?? .0018);
    scene.background = new THREE.Color('#cbdedc');
  } else if (connected) {
    architecture = buildConnectedSettlement(architectureContext);
    scene.fog = new THREE.FogExp2(night ? '#596575' : '#d2dfd3', night ? .007 : .0035);
    extras.push(...architecture.extras);
    if (chapter.id === '28') memorialConference();
    if (chapter.id === 'E4') archiveComputer();
  } else if (environment === 'grove') {
    forest(quality === 'low' ? 30 : 58);
    curve([[0, 40], [1.5, 20], [-1, 9], [0, -4]], 1.65, '#b3a986');
    const clearing = cylinder(0, -0.015, -3, 5.2, 5.2, 0.025, '#9ca778', 40);
    clearing.castShadow = false;
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      sphere(Math.cos(angle) * 8.5, 0.2, Math.sin(angle) * 8.5 - 2, 0.4, '#a4aa94', 0);
    }
    const raysMaterial = new THREE.MeshBasicMaterial({ color: '#fff3c2', transparent: true, opacity: 0.04, depthWrite: false, side: THREE.DoubleSide });
    materials.set('rays', raysMaterial);
    for (let index = 0; index < 6; index += 1) {
      const ray = mesh(new THREE.CylinderGeometry(0.12, 0.8, 18, 12, 1, true), raysMaterial, -4 + index * 1.5, 9, -5 - (index % 2) * 1.3);
      ray.rotation.z = -0.2;
      ray.castShadow = false;
    }
  } else if (environment === 'witnesses') {
    forest(quality === 'low' ? 22 : 36, true);
    cottage(-15, -10, 8, 6, '#bfa984');
    fence(-26, -1, 16);
    fence(12, -8, 14);
    curve([[0, 40], [0, 13], [1, 5], [3, -2], [-12, -6]], 2.5);
    table(3, -2, 3.8, 1.9);
    box(3, 1.1, -2, 3.4, 0.025, 1.65, '#e6ddbf');
    plates(3, 1.13, -2);
    bench(-5.8, -3, Math.PI / 2, 3.5);
    points.find(point => point.id === 'study').label = 'Examine the plates';
    points.push({ id: 'plates', label: 'The entrusted record', position: new THREE.Vector3(3, 0, -0.4), kind: 'plates' });
  } else if (environment === 'bedroom' || environment === 'harmony') {
    room();
    if (environment === 'harmony') {
      if (chapter.id === 'E4') {
        archiveComputer();
        box(-6.1, 1.5, -9.68, 2.6, 1.6, 0.13, '#756950');
        box(-6.1, 1.5, -9.58, 2.3, 1.3, 0.08, '#b9c7b6');
        for (let index = 0; index < 5; index += 1) {
          sphere(-6.85 + index * 0.37, 1.61, -9.5, 0.13, '#d6bf9b', 1);
          box(-6.85 + index * 0.37, 1.27, -9.5, 0.26, 0.4, 0.12, index % 2 ? '#6f8176' : '#9c846e');
        }
      } else {
        box(3.6, 1.21, -2.15, 0.3, 0.16, 0.3, '#595950');
        const hat = cylinder(2.4, 1.24, -2, 0.35, 0.25, 0.22, '#766a50', 14);
        cylinder(2.4, 1.14, -2, 0.44, 0.44, 0.025, '#766a50', 14);
        hat.rotation.z = 0.1;
        book(3.3, 1.23, -1.75);
      }
    } else {
      const light = new THREE.PointLight('#ffe3ad', 4, 12, 2);
      light.position.set(-4, 2.7, -4);
      group.add(light);
      stars();
    }
  } else if (environment === 'hill') {
    architecture = buildRecordHill(architectureContext);
  } else if (environment === 'river') {
    river();
  } else if (['town', 'nauvoo', 'kirtland'].includes(environment)) {
    town();
    if (chapter.id === 'E3') {
      automobile(7, 6);
      box(-12, 0.025, 8, 8, 0.04, 10, '#a6a797');
      for (const side of [-1, 1]) {
        cylinder(side * 7.5, 2.45, -9, 0.065, 0.085, 4.9, '#6e776b', 8);
        sphere(side * 7.5, 5.05, -9, 0.35, '#ece6c8', 1);
      }
      box(-9, 1.6, 10, 1.2, 0.44, 0.48, '#83979a');
      cylinder(-9, 0.7, 10, 0.055, 0.055, 1.4, '#766e57', 6);
    }
    if (chapter.id === 'E5') {
      waterStation(-6, -3);
      waterStation(7, -6);
      for (let index = 0; index < 3; index += 1) {
        box(14 + index * 2.5, 5.15, 16, 2.1, 0.1, 3.7, '#526e7a').rotation.x = -0.22;
        box(-6, 0.33, 8 + index * 2.1, 3.2, 0.6, 1.2, '#a09477');
        for (let plant = 0; plant < 5; plant += 1) sphere(-7.2 + plant * 0.6, 0.8, 8 + index * 2.1, 0.28, '#719261', 0);
      }
    }
  } else if (['carthage', 'liberty'].includes(environment)) {
    room(true);
    if (environment === 'liberty') {
      scene.fog = new THREE.FogExp2('#4c555d', 0.025);
      box(-3, 0.04, -3, 3.2, 0.05, 2.3, '#8e835f');
    }
    if (chapter.id === 'E7') {
      for (const side of [-1, 1]) {
        for (let shelf = 0; shelf < 3; shelf += 1) {
          const x = side * 6.6;
          const z = -6.8 + shelf * 3.8;
          box(x, 1.7, z, 1.9, 3.4, 1.4, '#586d6b');
          for (let row = 0; row < 5; row += 1) {
            box(x, 0.45 + row * 0.56, z + 0.73, 1.65, 0.08, 0.04, '#8a9d91');
            for (let file = 0; file < 5; file += 1) box(x - 0.65 + file * 0.32, 0.63 + row * 0.56, z + 0.75, 0.25, 0.25, 0.03, file % 2 ? '#9db3a6' : '#c0b590');
          }
        }
      }
      box(0, 2.3, -9.65, 3.6, 1.8, 0.08, '#3a5e62');
      for (let index = 0; index < 7; index += 1) box(-1.4 + index * 0.45, 2.3, -9.59, 0.14, 0.7 + (index % 3) * 0.2, 0.025, '#a4c3b6');
    }
  } else if (celestial) {
    cylinder(0, -0.5, 0, 31, 28, 1, '#e0ded1', 96);
    cylinder(0, -3, 0, 28, 12, 5, '#7f98a3', 48);
    const garden = cylinder(0, 0.015, -1, 23, 23, 0.035, '#a2bca0', 72);
    garden.castShadow = false;
    curve([[0, 30], [0, 15], [-1, 3], [0, -20]], 4, '#eee7cb');
    curve([[-24, -5], [-12, -1], [0, 0], [14, -2], [25, -4]], 2.5, '#dddcbf');
    for (const side of [-1, 1]) {
      for (let index = 0; index < 6; index += 1) {
        const x = side * (10 + (index % 2) * 2);
        const z = 14 - index * 6;
        cylinder(x, 0.18, z, 0.95, 0.95, 0.35, '#e6dcbb', 12);
        cylinder(x, 2.8, z, 0.38, 0.45, 5.4, '#f3eed8', 12);
        cylinder(x, 5.6, z, 0.7, 0.52, 0.3, '#e3c875', 12);
      }
      tree(side * 18, -10, 1.2, true);
      tree(side * 19, 12, 0.85, true);
    }
    for (let index = 0; index < 5; index += 1) cylinder(0, 0.1 + index * 0.16, -16, 5.2 - index * 0.45, 5.2 - index * 0.45, 0.2, '#eee7cf', 36);
    const planetMaterial = material('#85b7b2', { emissive: '#426d77', emissiveIntensity: 0.6 });
    const planet = sphere(0, 9, -24, 4.2, planetMaterial, 3);
    const ring = mesh(new THREE.TorusGeometry(6.2, 0.04, 8, 100), '#e8d38d', 0, 9, -24);
    ring.rotation.x = Math.PI / 2.8;
    ring.rotation.z = 0.3;
    animated.push({ object: planet, kind: 'planet' });
    for (let index = 0; index < 3; index += 1) {
      const portalMaterial = new THREE.MeshBasicMaterial({ color: ['#d6c68e', '#c4e0dd', '#d2c4e5'][index], transparent: true, opacity: 0.2 + index * 0.1 });
      materials.set(`orbit-${index}`, portalMaterial);
      const orbit = mesh(new THREE.TorusGeometry(40 + index * 13, 0.08, 6, 128), portalMaterial, 0, 18, 0);
      orbit.rotation.set(0.45 + index * 0.6, index * 0.7, index * 0.5);
    }
    stars();
    flowerField(180);
    points.find(point => point.id === 'prayer').label = 'A vision of Zion';
    points.push({ id: 'creation', label: 'A world entrusted to your care', position: new THREE.Vector3(0, 0, -14), kind: 'creation' });
  } else if (desert) {
    curve([[0, 40], [1, 16], [0, 2], [-6, -12]], 3.1, '#9c927c');
    for (let index = 0; index < 24; index += 1) {
      const x = (index % 2 ? -1 : 1) * (12 + random() * 23);
      const z = (random() - 0.5) * 65;
      const trunk = cylinder(x, 1.5, z, 0.12, 0.3, 3, '#625d50', 6);
      trunk.rotation.z = (random() - 0.5) * 0.6;
      const branch = cylinder(x + 0.5, 2.6, z, 0.055, 0.13, 1.6, '#625d50', 5);
      branch.rotation.z = -0.8;
      colliders.push({ x, z, radius: 0.35 });
    }
    for (let index = 0; index < 12; index += 1) {
      const x = (index % 2 ? -1 : 1) * (12 + random() * 12);
      const z = -14 - random() * 17;
      const ruin = box(x, 1.2, z, 3 + random() * 3, 2.4 + random() * 4, 1, '#8d8678');
      ruin.rotation.z = (random() - 0.5) * 0.9;
      box(x, 3.4, z + 0.1, 0.08, 3, 0.08, '#686c5d').rotation.z = 0.4;
    }
    waterStation(4.8, -3.5);
    table(3, -2);
    for (let index = 0; index < 4; index += 1) {
      cylinder(2.3 + index * 0.46, 1.35, -2, 0.13, 0.13, 0.45, '#b2bcaa', 10);
      cylinder(2.3 + index * 0.46, 1.59, -2, 0.08, 0.08, 0.05, '#6d8178', 8);
    }
    box(-8, 0.2, 3, 5.4, 0.4, 2.3, '#96917f');
    for (const side of [-1, 1]) {
      const canvas = box(-8 + side * 1.5, 1.6, 3, 0.08, 3.1, 3, '#bcaa82');
      canvas.rotation.z = side * 0.62;
    }
    sphere(-5, 0.07, 4.5, 0.12, '#73a66c', 1);
    points.find(point => point.id === 'prayer').label = 'A seed of hope';
  } else {
    forest(environment === 'missouri' ? 26 : 38);
    cottage(-14, -9, 8, 6, environment === 'missouri' ? '#a99272' : '#bfa984');
    curve([[0, 40], [0, 13], [1, 2], [-10, -4]], 2.7);
    fence(-27, 4, 18);
    fence(8, -13, 20);
    table(3, -2);
    book(3, 1.14, -2);
    for (let index = 0; index < 5; index += 1) {
      const bundle = cylinder(9 + index * 1.6, 0.45, 2, 0.4, 0.58, 0.9, '#baaa70', 7);
      bundle.rotation.z = 0.07;
    }
    if (environment === 'missouri') {
      box(-5.4, 0.7, -4.7, 2.2, 0.3, 1.2, '#8a7251');
      for (const side of [-1, 1]) {
        const wheel = cylinder(-5.4 + side * 1.1, 0.52, -4.7, 0.55, 0.55, 0.13, '#625740', 12);
        wheel.rotation.z = Math.PI / 2;
      }
      const canvas = mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.3, 16, 1, true, 0, Math.PI), '#ded1ae', -5.4, 1, -4.7, { side: THREE.DoubleSide });
      canvas.rotation.z = Math.PI / 2;
      canvas.rotation.x = Math.PI / 2;
    }
  }

  if (!interior && !celestial) {
    const dustGeometry = new THREE.BufferGeometry();
    geometries.add(dustGeometry);
    const dustPositions = [];
    for (let index = 0; index < 65; index += 1) dustPositions.push((random() - 0.5) * 42, 0.5 + random() * 5, (random() - 0.5) * 42);
    dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({ color: '#fff0b0', size: 0.065, transparent: true, opacity: 0.55 });
    materials.set('dust', dustMaterial);
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    group.add(dust);
    animated.push({ object: dust, kind: 'dust' });
  }

  const detail = buildWorldDetail({chapter, quality, box, cylinder, sphere, book}, architecture);
  const movingObjects = new Set(animated.map(item => item.object));
  const batches = new Map();
  for (const object of [...group.children]) {
    if (!object.isMesh || object.isInstancedMesh || Array.isArray(object.material) || object.material.transparent || object.material.map || object.material.vertexColors || movingObjects.has(object) || object.name || !object.visible) continue;
    object.updateMatrix();
    const geometry = object.geometry.clone().applyMatrix4(object.matrix);
    geometries.add(geometry);
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    if (!batches.has(key)) batches.set(key, {geometries: [], material: object.material, castShadow: object.castShadow, receiveShadow: object.receiveShadow});
    batches.get(key).geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
    object.removeFromParent();
  }
  for (const batch of batches.values()) {
    batch.geometries.forEach(geometry => {
      geometries.add(geometry);
      for (const attribute of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute);
      if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    });
    const geometry = mergeGeometries(batch.geometries);
    if (!geometry) continue;
    geometries.add(geometry);
    const merged = new THREE.Mesh(geometry, batch.material);
    merged.castShadow = batch.castShadow;
    merged.receiveShadow = batch.receiveShadow;
    group.add(merged);
  }

  return {
    group, spawn, focus, bounds, colliders, points, extras,
    objectivePoints: architecture?.objectivePoints, actorPositions: architecture?.actorPositions,
    activityPoints: architecture?.activityPoints,
    activityAnchors: detail.activityAnchors,
    detail,
    localPortals: architecture?.localPortals ?? [],
    activatePortal: identity => architecture?.activatePortal?.(identity),
    onObjective: index => architecture?.onObjective?.(index),
    onObjectiveComplete: index => architecture?.onObjectiveComplete?.(index),
    onActivity: (identity, count, total) => architecture?.onActivity?.(identity, count, total),
    getGroundHeight: architecture?.getGroundHeight ?? (() => 0),
    summary: architecture?.summary ?? architecture?.layout ?? {kind: environment},
    cameraFar: architecture?.recommendedCameraFar ?? 700,
    update(delta, elapsed, playerPosition, cameraPosition) {
      architecture?.update?.(delta, elapsed, playerPosition, cameraPosition);
      for (const item of animated) {
        if (item.kind === 'ripple') item.object.position.x = item.baseX + Math.sin(elapsed * 0.6 + item.phase) * 0.35;
        if (item.kind === 'planet') item.object.rotation.y += delta * 0.045;
        if (item.kind === 'stars') item.object.rotation.y += delta * 0.001;
        if (item.kind === 'dust') { item.object.position.y = Math.sin(elapsed * 0.17) * 0.35; item.object.rotation.y = Math.sin(elapsed * 0.03) * 0.06; }
      }
    },
    dispose() {
      architecture?.dispose?.();
      scene.remove(group);
      for (const geometry of geometries) geometry.dispose();
      for (const value of materials.values()) value.dispose();
      sun.shadow.map?.dispose();
      scene.background = previous.background;
      scene.fog = previous.fog;
    },
  };
}
