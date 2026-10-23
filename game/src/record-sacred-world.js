import * as THREE from 'three';
import {buildRecordHill} from './record-hill.js';

export const SACRED_RECORD_IDS = Object.freeze(['BM01', 'BM02', 'BM03', 'BM04', 'BM06', 'BM08', 'BM09', 'BM10', 'BM11', 'BM12', 'BM13', 'BM14', 'BM20', 'BM21', 'BM22', 'BM23', 'BM25']);

const COLORS = Object.freeze({sand: '#c9b58c', limestone: '#d9c9a4', shade: '#a28c67', dark: '#5b5045', cedar: '#72573d', grass: '#8b9f6c', water: '#4e939c', gold: '#e1b85f', white: '#fff1ce'});

export function buildRecordSacredWorld(context) {
  const {chapter, group, scene, box, cylinder, sphere, mesh, material, colliders, spawn, focus, bounds, curve, tree, book, quality} = context;
  const recordId = chapter.recordId || chapter.id;
  if (!SACRED_RECORD_IDS.includes(recordId)) throw new Error(`No sacred record environment for ${recordId}`);
  const resources = [];
  const roofs = [];
  const animated = [];
  const landmarks = [];
  const activityPoints = {};
  const vesselLights = [];
  let stonesLit = false;
  let positions = [[0, 0, 12], [-9, 0, -2], [0, 0, -16], [11, 0, -25]];
  let groundColor = COLORS.grass;
  let skyColor = '#c6d5d4';
  let kind = 'ancient-community';
  let groundHeight = () => 0;
  let sharedHill = null;
  Object.assign(bounds, {minX: -78, maxX: 78, minZ: -85, maxZ: 70});
  spawn.set(0, 0, 24);
  focus.set(0, 1.5, -12);

  function solid(x, y, z, width, height, depth, color) {
    const object = box(x, y, z, width, height, depth, color);
    colliders.push({x, z, width, depth, minY: y - height / 2, maxY: y + height / 2});
    return object;
  }

  function land(name, x, y, z) {
    landmarks.push({name, position: [x, y, z]});
  }

  function sign(text, x, y, z, width = 4, rotation = 0) {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 192;
    const drawing = canvas.getContext('2d');
    if (!drawing) return;
    drawing.fillStyle = '#544b3b';
    drawing.fillRect(0, 0, 1024, 192);
    drawing.strokeStyle = '#d9bb7c';
    drawing.lineWidth = 6;
    drawing.strokeRect(12, 12, 1000, 168);
    drawing.fillStyle = '#fff1d0';
    drawing.font = '42px Georgia';
    drawing.textAlign = 'center';
    drawing.textBaseline = 'middle';
    drawing.fillText(text, 512, 96, 960);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const surface = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide});
    const object = mesh(new THREE.PlaneGeometry(width, width * 192 / 1024), surface, x, y, z);
    object.rotation.y = rotation;
    object.castShadow = false;
    resources.push(texture, surface);
  }

  function palm(x, z, scale = 1) {
    cylinder(x, 3 * scale, z, .18 * scale, .3 * scale, 6 * scale, '#8e7751', 7);
    for (let leaf = 0; leaf < 7; leaf += 1) {
      const angle = leaf * Math.PI * 2 / 7;
      const frond = mesh(new THREE.ConeGeometry(.5 * scale, 4 * scale, 4), '#647c55', x + Math.sin(angle) * 1.3 * scale, 6.1 * scale, z + Math.cos(angle) * 1.3 * scale);
      frond.rotation.set(Math.cos(angle) * 1.35, 0, -Math.sin(angle) * 1.35);
    }
    colliders.push({x, z, radius: .4 * scale});
  }

  function rock(x, z, size = 2, color = '#958e79') {
    const object = sphere(x, size * .35, z, size, color, 0);
    object.scale.set(1.3, .7, 1);
    colliders.push({x, z, radius: size * .85});
    return object;
  }

  function bowl(x, z, radius = .6, color = '#b67650') {
    cylinder(x, .35, z, radius, radius * .55, .7, color, 10);
    cylinder(x, .71, z, radius * .85, radius * .85, .015, '#504c3c', 10);
  }

  function jar(x, z, color = '#c18e60') {
    sphere(x, .65, z, .55, color, 1).scale.set(.8, 1.2, .8);
    cylinder(x, 1.25, z, .2, .26, .35, color);
  }

  function canopy(x, z, width = 6, depth = 5, color = '#c8a16b') {
    for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) cylinder(x + sideX * (width / 2 - .2), 1.5, z + sideZ * (depth / 2 - .2), .07, .09, 3, COLORS.cedar, 5);
    const cloth = box(x, 3, z, width, .07, depth, color);
    cloth.rotation.z = .04;
    return cloth;
  }

  function house(x, z, width = 10, depth = 10, color = COLORS.limestone, label = '') {
    const height = 3.6;
    const sideWidth = (width - 2.4) / 2;
    solid(x - width / 2, height / 2, z, .45, height, depth, color);
    solid(x + width / 2, height / 2, z, .45, height, depth, color);
    solid(x, height / 2, z - depth / 2, width, height, .45, color);
    for (const side of [-1, 1]) solid(x + side * (1.2 + sideWidth / 2), height / 2, z + depth / 2, sideWidth, height, .45, color);
    box(x, 3.25, z + depth / 2, 2.4, .7, .45, color);
    box(x, -.035, z, width, .06, depth, '#d5bd91');
    const roof = box(x, 3.75, z, width + .5, .25, depth + .5, '#b29a72');
    roof.name = `record-cutaway-roof:${x}:${z}`;
    roofs.push({object: roof, x, z, width, depth});
    box(x - width * .3, .3, z - depth * .28, 2.5, .5, 1.3, '#886e4f');
    box(x - width * .3, .6, z - depth * .28, 2.5, .12, 1.3, '#d1b681');
    bowl(x + width * .25, z - depth * .3);
    jar(x + width * .25, z - depth * .1);
    if (label) sign(label, x, 2.85, z + depth / 2 + .3, Math.min(width - 1, 5));
  }

  function tents(rows = 3) {
    const colors = ['#b58a5c', '#d1bb8c', '#9d7660', '#a8aa83'];
    for (let row = 0; row < rows; row += 1) for (const side of [-1, 1]) {
      const x = side * (17 + row % 2 * 5);
      const z = 15 - row * 12;
      const tent = mesh(new THREE.ConeGeometry(4.5, 4, 4), colors[row % colors.length], x, 1.8, z);
      tent.rotation.y = Math.PI / 4;
      tent.scale.z = 1.45;
      colliders.push({x, z, width: 5.8, depth: 7});
      jar(x + side * 4, z + 2);
    }
  }

  function outskirts(style = 'forest') {
    const count = quality === 'low' ? 24 : 46;
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963;
      const distance = 40 + index % 6 * 5;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance - 4;
      if (recordId === 'BM06' && z > 25) continue;
      if (style === 'palm') palm(x, z, .75 + index % 4 * .15);
      else if (style === 'rock') rock(x, z, 3 + index % 4, index % 2 ? '#9c8d76' : '#b0a080');
      else tree(x, z, .8 + index % 5 * .15);
    }
  }

  function stepsTemple(x = 0, z = -38, scale = 1) {
    for (let tier = 0; tier < 5; tier += 1) {
      const width = (29 - tier * 3.8) * scale;
      const depth = (24 - tier * 3) * scale;
      solid(x, (tier * 1.5 + .75) * scale, z, width, 1.5 * scale, depth, tier % 2 ? '#d5c6a7' : '#e5d7b7');
    }
    for (let step = 0; step < 25; step += 1) box(x, (.15 + step * .3) * scale, z + (17 - step * .52) * scale, 5 * scale, .3 * scale, .7 * scale, '#dac7a0');
    box(x, 9 * scale, z, 10 * scale, 3 * scale, 7 * scale, '#e7d9bb');
    box(x, 10.8 * scale, z, 12 * scale, .6 * scale, 8 * scale, '#c5aa7b');
    for (const side of [-1, 1]) cylinder(x + side * 3 * scale, 9 * scale, z + 3.55 * scale, .5 * scale, .55 * scale, 3 * scale, '#b19b77', 8);
    box(x, 8.7 * scale, z + 3.6 * scale, 2.5 * scale, 2.4 * scale, .1, '#655f50');
    land('Temple silhouette — illustrative architecture', x, 0, z);
  }

  function recordBundle(x, y, z) {
    for (let plate = 0; plate < 9; plate += 1) box(x, y + plate * .025, z, .6, .018, .78, plate % 2 ? '#d7af55' : '#edcf7a');
    for (let ring = 0; ring < 3; ring += 1) {
      const object = mesh(new THREE.TorusGeometry(.085, .018, 5, 12), COLORS.gold, x - .3, y + .1, z - .25 + ring * .25);
      object.rotation.y = Math.PI / 2;
    }
  }

  function city() {
    groundColor = COLORS.sand;
    kind = 'jerusalem-streets';
    positions = [[0, 0, 16], [-18, 0, -1], [1, 0, -19], [0, 0, 46]];
    curve([[0, 64], [0, 30], [0, 0], [0, -52]], 7, '#c5ac84');
    curve([[-55, -3], [-22, -3], [0, -3], [45, -3]], 5, '#c5ac84');
    for (const side of [-1, 1]) for (let block = 0; block < 3; block += 1) house(side * (15 + block % 2 * 4), 22 - block * 21, 11, 12, block % 2 ? '#c6b38e' : '#ddc8a0', block === 1 && side < 0 ? 'A household in Jerusalem' : '');
    for (const side of [-1, 1]) solid(side * 26, 4, 37, 44, 8, 1.3, '#ae9975');
    for (const side of [-1, 1]) solid(side * 4.8, 4, 37, 2.6, 8, 2.6, '#bcaa85');
    box(0, 7.2, 37, 7, 1.6, 1.6, '#c3ad83');
    sign('Jerusalem • departure toward the wilderness', 0, 6.1, 38, 6);
    canopy(10, 5, 5, 4);
    canopy(-10, 9, 5, 4, '#a67b5c');
    for (let item = 0; item < 8; item += 1) jar(8 + item % 3, 4 + Math.floor(item / 3));
    for (let index = 0; index < 6; index += 1) palm(-35 + index * 13, -55, .9);
    land('City gate', 0, 0, 37);
    land('Family home', -15, 0, 22);
    if (recordId === 'BM03') {
      positions = [[0, 0, 18], [26, 0, -5], [26, 0, -18], [0, 0, 46]];
      house(26, -20, 14, 16, '#c1ac85', 'The treasury • 1 Nephi 3–4');
      box(26, .9, -22, 3, .12, 1.8, COLORS.cedar);
      recordBundle(26, 1.02, -22);
      for (const side of [-1, 1]) for (let shelf = 0; shelf < 3; shelf += 1) {
        box(26 + side * 5.5, .5 + shelf * .8, -23, 1.1, .1, 7, COLORS.cedar);
        for (let jarIndex = 0; jarIndex < 3; jarIndex += 1) cylinder(26 + side * 5.5, .8 + shelf * .8, -25 + jarIndex * 2, .25, .3, .5, '#ac8457');
      }
      curve([[0, 0], [11, -4], [26, -5], [26, -11]], 3, '#b9a077');
      land('Treasury entrance', 26, 0, -12);
      skyColor = '#667789';
    }
    outskirts('rock');
  }

  function dream() {
    kind = 'lehi-dream';
    groundColor = '#475953';
    skyColor = '#4b666c';
    positions = [[0, 0, 25], [-3, 0, 8], [0, 0, -20], [0, 0, -28]];
    activityPoints[`${recordId}-2`] = [[0, 0, 21], [-2, 0, 13], [-3, 0, 4], [-2, 0, -8]];
    spawn.set(0, 0, 34);
    curve([[0, 40], [0, 23], [-3, 7], [-2, -8], [0, -25]], 4, '#c8bd97');
    for (let index = 0; index < 33; index += 1) {
      const z = 31 - index * 1.8;
      const x = z > 10 ? -2.5 : z > -10 ? -5 : -3.5;
      cylinder(x, .65, z, .055, .055, 1.3, '#b5bcb1', 6);
      box(x, 1.17, z, .1, .12, 1.9, '#d7dccc');
    }
    const river = box(20, -.05, 0, 16, .1, 110, '#3f727e');
    river.castShadow = false;
    colliders.push({x: 20, z: 0, width: 16, depth: 110});
    cylinder(0, 2.4, -29, .23, .38, 4.8, '#8f8465', 9);
    for (let branch = 0; branch < 9; branch += 1) {
      const angle = branch * 2.399;
      const x = Math.cos(angle) * 2.9;
      const z = -29 + Math.sin(angle) * 2.7;
      const leafHeight = 4.8 + branch % 3 * .45;
      const start = new THREE.Vector3(0, 2.5 + branch % 2 * .4, -29);
      const end = new THREE.Vector3(x, leafHeight - .7, z);
      const direction = end.clone().sub(start);
      const middle = start.clone().add(end).multiplyScalar(.5);
      const bough = cylinder(middle.x, middle.y, middle.z, .08, .16, direction.length(), '#a39770', 7);
      bough.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      const canopy = sphere(x, leafHeight, z, 2.1, ['#e2e6bc', '#d0dbaa', '#edf0c8'][branch % 3], 1);
      canopy.scale.set(1.2, .65, 1);
      const fruit = sphere(x * 1.06, 2.7 + branch % 3 * .25, -29 + (z + 29) * 1.12, .18, COLORS.white, 1);
      fruit.material = material(COLORS.white, {emissive: '#fff3c7', emissiveIntensity: .35});
    }
    for (let flower = 0; flower < 100; flower += 1) {
      const angle = flower * 2.39996;
      const distance = 4 + flower % 13 * .75;
      const x = Math.cos(angle) * distance;
      const z = -29 + Math.sin(angle) * distance;
      if (Math.abs(x) < 2 && z > -30) continue;
      const leaf = sphere(x, .12, z, .16 + flower % 3 * .035, flower % 3 ? '#9da777' : '#dce2b0', 0);
      leaf.scale.set(1.3, .65, 1);
      if (flower % 3 === 0) sphere(x, .28, z, .08, '#f7e9b5', 0);
    }
    for (let patch = 0; patch < 15; patch += 1) {
      const angle = patch * 2.39996;
      const distance = 5 + patch % 5 * 1.8;
      const garden = mesh(new THREE.CircleGeometry(1.5 + patch % 3, 8), patch % 2 ? '#66765a' : '#738267', Math.cos(angle) * distance, .004, -29 + Math.sin(angle) * distance);
      garden.rotation.x = -Math.PI / 2;
      garden.castShadow = false;
    }
    const light = new THREE.PointLight('#fff3bf', 8, 25, 1.5);
    light.position.set(0, 5, -27);
    group.add(light);
    for (let tower = 0; tower < 4; tower += 1) box(38 + tower * 3, 8 + tower, -23, 4, 16 + tower * 2, 8, '#9da199');
    box(42, 16.5, -23, 18, 1, 10, '#bac0b4');
    for (let veil = 0; veil < 7; veil += 1) {
      const fog = box(-17 + veil % 2 * 34, 1 + veil % 3 * .6, 23 - veil * 8, 14, 2, 10, '#b3c8bc', {transparent: true, opacity: .13, depthWrite: false});
      fog.name = `dream-mist-${veil}`;
      animated.push({object: fog, baseX: fog.position.x, phase: veil});
    }
    land('Iron rod', -4, 0, 0);
    land('Tree of life', 0, 0, -29);
    land('Distant great and spacious building', 42, 0, -23);
  }

  function shipyard() {
    kind = 'arabian-bountiful-shipyard';
    groundColor = '#c8bd8a';
    positions = [[-8, 0, 17], [-15, 0, 0], [12, 0, -6], [0, 0, -22]];
    skyColor = '#c3ddd9';
    const water = box(0, -.16, -62, 210, .15, 62, '#519ca7');
    water.castShadow = false;
    colliders.push({x: 0, z: -62, width: 210, depth: 62});
    curve([[-5, 40], [-8, 13], [0, 0], [0, -27]], 5, '#d8c89d');
    tents(2);
    canopy(-18, 0, 10, 7, '#c4b080');
    for (let log = 0; log < 7; log += 1) {
      const timber = cylinder(-15 + log * .6, .45, 1, .22, .27, 6, COLORS.cedar, 7);
      timber.rotation.x = Math.PI / 2;
    }
    cylinder(13, .35, -7, 1.1, 1.4, .7, '#6f6556', 8);
    const furnace = cylinder(13, .7, -7, .8, 1, .2, '#df9b50', 8);
    furnace.material = material('#da9443', {emissive: '#d77c33', emissiveIntensity: .4});
    for (let rib = 0; rib < 10; rib += 1) {
      const z = -23 + rib * .9;
      const width = 1.1 + Math.sin(rib / 9 * Math.PI) * 2.4;
      for (const side of [-1, 1]) {
        const plank = box(side * width, 1.5, z, .16, 3, .2, '#98794e');
        plank.rotation.z = -side * .3;
      }
      box(0, .2, z, width * 2, .2, .22, '#77613e');
    }
    box(0, .2, -19, .3, .4, 12, '#735635');
    land('Open ship frame — illustrative construction', 0, 0, -19);
    land('Tool shelter', -18, 0, 0);
    land('Coastal forge', 13, 0, -7);
    outskirts('palm');
  }

  function stones() {
    kind = 'brother-jared-summit';
    groundColor = '#92968a';
    skyColor = '#819eab';
    positions = [[0, 0, 17], [-9, 0, -2], [0, 0, -17], [0, 0, 40]];
    activityPoints[`${recordId}-2`] = [];
    activityPoints[`${recordId}-4`] = [];
    curve([[0, 34], [-7, 14], [-10, -1], [0, -17]], 4, '#b6b7a5');
    for (let index = 0; index < 16; index += 1) {
      const x = -3 + index % 8 * .85;
      const z = -9 - Math.floor(index / 8) * 1.3;
      const stone = sphere(x, .27, z, .23, '#dbe6da', 1);
      stone.name = `jared-light-stone-${index + 1}`;
      stone.material = material('#e7f3dc', {emissive: '#cce9cf', emissiveIntensity: 0}).clone();
      resources.push(stone.material);
      activityPoints[`${recordId}-2`].push([-6 + index % 8 * 1.7, 0, 4 - Math.floor(index / 8) * 4]);
      animated.push({object: stone, stone: true, phase: index});
    }
    for (let mountain = 0; mountain < 18; mountain += 1) {
      const angle = mountain * Math.PI * 2 / 18;
      const mountainObject = mesh(new THREE.ConeGeometry(13 + mountain % 4 * 3, 20 + mountain % 5 * 5, 5), mountain % 2 ? '#71828a' : '#8c9898', Math.cos(angle) * 75, -5, Math.sin(angle) * 75);
      mountainObject.rotation.y = mountain;
    }
    cylinder(-10, .35, -2, .8, 1.3, .7, '#5d615b', 8);
    const light = new THREE.PointLight('#eef7cf', 18, 28, 1.5);
    light.position.set(0, 3, -18);
    group.add(light);
    land('Sixteen clear stones', 0, 0, -10);
    land('Prayer clearing', 0, 0, -17);
    land('Mountain overlook — artistic geography', 8, 0, -20);
    sign('Ether 3 • sixteen stones, two for each vessel', -9, 1.6, 6, 5);
    outskirts('rock');
    const sea = box(0, -.1, 75, 150, .1, 30, '#5d8c98');
    sea.castShadow = false;
    colliders.push({x: 0, z: 75, width: 150, depth: 30});
    for (let vessel = 0; vessel < 8; vessel += 1) {
      const x = -28 + vessel * 8;
      const hull = mesh(new THREE.SphereGeometry(1, 10, 6), vessel % 2 ? '#806447' : '#927451', x, 1.5, 52);
      hull.scale.set(2.4, 1.5, 5.4);
      colliders.push({x, z: 52, width: 4.8, depth: 10.8});
      for (let band = 0; band < 6; band += 1) {
        const binding = mesh(new THREE.TorusGeometry(1, .035, 4, 10), '#64503b', x, 1.5, 48 + band * 1.5);
        binding.scale.set(2.3, 1.45, 1);
      }
      cylinder(x, 3.02, 52, .4, .4, .1, '#544b3c', 8);
      const lights = [];
      for (const end of [-1, 1]) {
        const stone = sphere(x + end * .6, 1.25, 46.3, .17, '#d5dfce', 1);
        stone.material = material('#e6edcf', {emissive: '#d7e8ae', emissiveIntensity: 0}).clone();
        resources.push(stone.material);
        lights.push(stone);
      }
      vesselLights.push(lights);
      activityPoints[`${recordId}-4`].push([x, 0, 43.7]);
    }
    curve([[8, -20], [16, 0], [8, 24], [0, 36], [0, 43]], 4, '#b7b49b');
    land('Eight vessels — compressed mountain-to-shore staging', 0, 0, 52);
    sign('Shore staging • two lights for each of eight vessels', 0, 2, 38, 7);
  }

  function waters() {
    kind = 'waters-of-mormon';
    groundColor = '#8a9a69';
    positions = [[0, 0, 17], [-10, 0, 0], [5, 0, -14], [0, 0, -27]];
    const water = mesh(new THREE.CircleGeometry(18, 48), '#55949b', 24, -.04, -8);
    water.rotation.x = -Math.PI / 2;
    water.castShadow = false;
    colliders.push({x: 24, z: -8, radius: 17});
    for (let reed = 0; reed < 34; reed += 1) {
      const angle = reed * .18 + 1.8;
      const x = 24 + Math.cos(angle) * 18;
      const z = -8 + Math.sin(angle) * 18;
      for (let stem = 0; stem < 3; stem += 1) cylinder(x + stem * .12, .8, z, .025, .035, 1.6, '#827c4c', 4);
    }
    curve([[0, 35], [-3, 15], [-8, 0], [4, -14], [0, -28]], 3.5, '#bbaf83');
    canopy(-15, -4, 8, 6, '#bba87b');
    for (let bench = 0; bench < 4; bench += 1) box(-11 + bench * 3, .28, -23, 2.4, .5, .7, '#7d7356');
    for (let index = 0; index < 7; index += 1) jar(-16 + index % 3, -5 + Math.floor(index / 3));
    land('Shore gathering', 5, 0, -14);
    land('Shared provisions shelter', -15, 0, -4);
    outskirts();
  }

  function court(peace = false) {
    kind = peace ? 'fourth-nephi-community' : recordId === 'BM22' ? 'christ-healing-court' : 'christ-bountiful-court';
    groundColor = '#a7b18a';
    positions = [[0, 0, 23], [-10, 0, 5], [0, 0, -11], [12, 0, 6]];
    spawn.set(0, 0, 32);
    const paving = box(0, -.025, -2, 42, .05, 55, '#e3d5b6');
    paving.castShadow = false;
    for (let row = 0; row < 18; row += 1) box(0, .008, 25 - row * 3, 42, .009, .026, '#c7bfa7');
    for (let col = 0; col < 14; col += 1) box(-19.5 + col * 3, .009, -2, .026, .009, 55, '#c7bfa7');
    stepsTemple();
    for (const side of [-1, 1]) {
      for (let column = 0; column < 6; column += 1) {
        cylinder(side * 23, 2.3, 21 - column * 9, .55, .7, 4.6, '#d1bf9c', 8);
        box(side * 23, 4.8, 21 - column * 9, 1.8, .4, 1.8, '#e1d2b1');
      }
      box(side * 23, 5.2, -1.5, 2, .5, 49, '#c4ab80');
      for (let home = 0; home < 3; home += 1) house(side * 37, 18 - home * 18, 10, 11, '#d1bd94');
      canopy(side * 17, 13, 5, 6, side < 0 ? '#b5b189' : '#c9aa7f');
      jar(side * 18, 15);
      palm(side * 29, 28, 1.1);
    }
    curve([[0, 65], [0, 40], [0, 24]], 8, '#c8b992');
    if (recordId === 'BM22') {
      for (let seat = 0; seat < 8; seat += 1) {
        const angle = seat * Math.PI * 2 / 8;
        box(Math.cos(angle) * 8, .13, Math.sin(angle) * 8 - 9, 2, .25, 1, '#b0a582');
      }
      land('Children’s gathered circle', 0, 0, -9);
    }
    if (peace) {
      positions = [[0, 0, 21], [-30, 0, 18], [30, 0, -1], [0, 0, -10]];
      canopy(-30, 23, 8, 5, '#c3a575');
      for (let goods = 0; goods < 10; goods += 1) bowl(-33 + goods % 5 * 1.2, 22 + Math.floor(goods / 5) * 1.1, .4);
      box(30, .6, 1, 5, 1.2, 2, '#a99675');
      sign('A shared workshop • 4 Nephi', 30, 2.2, 2.1, 5);
    }
    land('American Bountiful temple court', 0, 0, -8);
    land('Households beyond the colonnade', -37, 0, 18);
    outskirts('palm');
  }

  function gathering() {
    kind = 'king-benjamin-tent-gathering';
    positions = [[0, 0, 23], [-12, 0, 5], [0, 0, -11], [13, 0, 9]];
    tents(4);
    stepsTemple(0, -47, .85);
    for (const side of [-1, 1]) for (const front of [-1, 1]) cylinder(side * 2.8, 3.5, -19 + front * 2, .16, .2, 7, COLORS.cedar, 7);
    box(0, 5.8, -19, 6.3, .2, 5, '#a88c5c');
    for (let ladder = 0; ladder < 14; ladder += 1) box(3.3, .4 + ladder * .4, -19, 1.2, .09, .2, COLORS.cedar);
    canopy(-12, 1, 7, 6, '#b4b38b');
    for (let jarIndex = 0; jarIndex < 5; jarIndex += 1) jar(-14 + jarIndex, 1);
    curve([[0, 43], [0, 18], [0, -13]], 5, '#c3b58a');
    land('Speaking tower', 0, 0, -19);
    land('Tents facing the gathering', -17, 0, 15);
    outskirts('palm');
  }

  function testimony() {
    kind = 'abinadi-court-and-refuge';
    groundColor = COLORS.sand;
    positions = [[0, 0, 17], [0, 0, -2], [-17, 0, -15], [-23, 0, -37]];
    house(0, -9, 22, 25, '#d9c5a0', 'A court and a costly testimony');
    for (const side of [-1, 1]) for (let pillar = 0; pillar < 3; pillar += 1) cylinder(side * 7, 1.8, -15 + pillar * 7, .5, .6, 3.6, '#bda37a', 8);
    box(0, .35, -17, 4, .7, 2, '#b6a17a');
    house(-27, -28, 11, 12, '#cbb48c', 'A place to write and remember');
    book(-29, .8, -30);
    curve([[0, 35], [0, 10], [-17, 0], [-23, -15], [-23, -38]], 4, '#c4af86');
    for (let index = 0; index < 5; index += 1) house(27, 20 - index * 14, 9, 10, '#c2af86');
    land('Court entrance', 0, 0, 3.5);
    land('Alma’s refuge', -27, 0, -28);
    outskirts('palm');
  }

  function conversion() {
    kind = 'alma-conversion-memory';
    skyColor = '#82829a';
    groundColor = '#777b70';
    positions = [[0, 0, 21], [0, 0, 5], [-9, 0, -10], [0, 0, -26]];
    curve([[0, 38], [0, 12], [-3, 0], [0, -31]], 5, '#b6af95');
    for (let index = 0; index < 12; index += 1) {
      const side = index % 2 ? -1 : 1;
      rock(side * (14 + index % 3 * 4), 25 - index * 5, 2.6, '#6c7775');
    }
    house(-24, -19, 13, 12, '#d9cbb1', 'A household waits and prays');
    const light = new THREE.PointLight('#fff0bc', 24, 35, 1.4);
    light.position.set(0, 5, -24);
    group.add(light);
    for (let ray = 0; ray < 8; ray += 1) {
      const beam = box(-4 + ray * 1.2, 12, -28, .25, 24, .2, '#f5ecc3', {transparent: true, opacity: .2, depthWrite: false});
      beam.rotation.z = .08 * (ray - 3);
      beam.name = `conversion-memory-light-${ray}`;
    }
    land('Road of confrontation', 0, 0, 5);
    land('Symbolic remembered light', 0, 0, -26);
    outskirts();
  }

  function abish() {
    kind = 'abish-household-streets';
    positions = [[0, 0, 23], [-21, 0, 5], [0, 0, -9], [17, 0, 1]];
    groundColor = '#b7ad83';
    house(0, -13, 23, 22, '#d7bd91', 'Lamoni’s household • Alma 19');
    box(-6, .1, -16, 4, .15, 3, '#a78365');
    box(6, .1, -16, 4, .15, 3, '#9c8e62');
    for (const side of [-1, 1]) for (let home = 0; home < 3; home += 1) house(side * 27, 16 - home * 19, 10, 11, '#c9b58b');
    curve([[0, 40], [0, 19], [0, 0], [0, -6]], 5, '#d1bd90');
    curve([[-44, 5], [0, 5], [44, 5]], 4, '#d1bd90');
    canopy(16, 9, 7, 6, '#b1a77a');
    land('Abish’s route between households', -21, 0, 5);
    land('Open household entrance', 0, 0, -2);
    outskirts('palm');
  }

  function peace() {
    kind = 'weapons-burial-covenant';
    positions = [[0, 0, 21], [-12, 0, 4], [0, 0, -13], [11, 0, -23]];
    tents(2);
    curve([[0, 38], [0, 18], [0, -12], [11, -25]], 4, '#bdad80');
    box(0, -.02, -17, 7, .03, 4, '#665849');
    for (let weapon = 0; weapon < 9; weapon += 1) {
      const x = -2.7 + weapon % 5 * 1.3;
      const z = -16 + Math.floor(weapon / 5) * 1.5;
      const shaft = box(x, .05, z, .08, .08, 2.4, '#8e6c44');
      shaft.rotation.y = weapon * .25;
      box(x, .1, z - 1, .4, .05, .6, '#a9a18a').rotation.y = weapon * .25;
    }
    for (let mound = 0; mound < 9; mound += 1) sphere(-3 + mound * .8, -.25, -19.5, .7, '#8b785c', 0).scale.set(1.3, .6, 1);
    canopy(-16, 3, 7, 6, '#b2aa7a');
    land('Weapons relinquished', 0, 0, -17);
    land('Care and remembrance shelter', -16, 0, 3);
    outskirts();
  }

  function samuel() {
    kind = 'samuel-city-wall';
    groundColor = COLORS.sand;
    positions = [[0, 0, 25], [-12, 0, 8], [-12, 4.2, -7], [12, 0, 29]];
    activityPoints[`${recordId}-2`] = [[0, 0, 20], [-6, 0, 14], [-12, 0, 8]];
    for (const side of [-1, 1]) solid(side * 25, 2.5, -9, 43, 5, 1.8, '#b5a17d');
    box(0, 4.4, -9, 7, 1.2, 2, '#c7b18a');
    for (const side of [-1, 1]) solid(side * 5, 3.2, -9, 3, 6.4, 4, '#c2ae87');
    for (let crest = 0; crest < 20; crest += 1) box(-45 + crest * 4.8, 5.35, -9, 1.5, .7, 2.1, '#bba784');
    box(-12, 4.1, -7, 6, .2, 3, '#bda77f');
    const steps = 28;
    for (let step = 0; step < steps; step += 1) box(-12, step * .15 + .075, 7 - step * .5, 2.8, .15, .55, '#bdab86');
    groundHeight = (x, z) => {
      if (Math.abs(x + 12) < 1.6 && z <= 7.3 && z >= -6.8) return Math.max(0, Math.min(4.2, (7.3 - z) * .3));
      if (Math.abs(x + 12) < 3 && z < -6.8 && z > -8.5) return 4.2;
      return 0;
    };
    curve([[0, 45], [0, 19], [0, -8], [0, -47]], 7, '#cdb58c');
    for (const side of [-1, 1]) for (let home = 0; home < 3; home += 1) house(side * 17, -23 - home * 16, 10, 11, '#c3ad83');
    land('Accessible wall stair', -12, 0, 7);
    land('Speaking place above the city', -12, 4.2, -7);
    outskirts('palm');
  }

  function burial() {
    kind = 'moroni-final-record-hill';
    groundColor = '#c5cebd';
    skyColor = '#b7cbcf';
    positions = [[0, 0, 26], [-9, 0, 11], [0, 0, -3], [0, 0, -7]];
    activityPoints[`${recordId}-1`] = [[0, 0, 25], [-3, 0, 19], [-4, 0, 10]];
    sharedHill = buildRecordHill(context, {snow: true});
    recordBundle(-13, .75, 13);
    land('Eastern forest writing refuge', -13, 0, 13);
    land('Forked witness tree', 8, 0, -11);
    land('Stone-lined record box — adapted burial staging', 0, 0, -5);
  }

  if (['BM01', 'BM03'].includes(recordId)) city();
  else if (recordId === 'BM02') dream();
  else if (recordId === 'BM04') shipyard();
  else if (recordId === 'BM06') stones();
  else if (recordId === 'BM08') {
    kind = 'enos-widening-prayer';
    positions = [[0, 0, 21], [-9, 0, 3], [0, 0, -12], [11, 0, -26]];
    curve([[0, 38], [0, 17], [-9, 3], [0, -13], [11, -28]], 2.2, '#b2aa81');
    rock(-11, -12, 2.3);
    for (let place = 0; place < 3; place += 1) cylinder(12, .18, -26 + place, .22, .28, .35, '#a3a080', 6);
    land('Prayer clearing', 0, 0, -12);
    outskirts();
  } else if (recordId === 'BM09') gathering();
  else if (recordId === 'BM10') testimony();
  else if (recordId === 'BM11') waters();
  else if (recordId === 'BM12') conversion();
  else if (recordId === 'BM13') abish();
  else if (recordId === 'BM14') peace();
  else if (recordId === 'BM20') samuel();
  else if (['BM21', 'BM22', 'BM23'].includes(recordId)) court(recordId === 'BM23');
  else if (recordId === 'BM25') burial();

  const ground = mesh(new THREE.PlaneGeometry(600, 600), groundColor, 0, -.06, 0);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, 62, 200);
  const objectivePoints = {};
  for (const [index, objective] of (chapter.objectives || []).entries()) {
    const position = positions[Math.min(index, positions.length - 1)];
    objectivePoints[objective.id] = [...position];
    if (objective.point && !objectivePoints[objective.point]) objectivePoints[objective.point] = [...position];
  }
  const actorPositions = {};
  for (const [index, actor] of (chapter.actors || []).entries()) {
    const position = positions[Math.min(actor.showFrom || index % positions.length, positions.length - 1)];
    actorPositions[actor.id] = [position[0] + (index % 2 ? 2 : -2), position[1], position[2] - 1.7];
  }
  if (chapter.actors?.some(actor => actor.id === 'CHRIST')) actorPositions.CHRIST = recordId === 'BM06' ? [0, 0, -21] : [0, 0, -14];

  return {
    objectivePoints,
    activityPoints,
    actorPositions,
    getGroundHeight: groundHeight,
    recommendedCameraFar: 650,
    summary: {
      kind, recordId, landmarks, traversable: true, connectedInteriors: roofs.length,
      adaptation: 'Source-informed devotional adaptation; architecture and exact blocking are illustrative, not an archaeological reconstruction.',
      ...(recordId === 'BM25' ? {sharedHillSeed: sharedHill.summary.sharedHillSeed, sharedLandmarks: sharedHill.summary.sharedLandmarks, burialSeason: 'Snow is an artistic choice, not a scriptural date.'} : {}),
      ...(recordId === 'BM06' ? {stoneCount: 16, stonesPerVessel: 2, vesselCount: 8, shoreStaging: 'The mountain-to-shore journey is spatially compressed for play.'} : {}),
    },
    onObjective(index) {
      if (recordId === 'BM06') stonesLit = index >= 3;
    },
    onObjectiveComplete(index) {
      if (recordId === 'BM06' && index === 2) stonesLit = true;
    },
    onActivity(objectiveId, completed) {
      if (recordId === 'BM06' && objectiveId === 'BM06-4') vesselLights.forEach((lights, index) => lights.forEach(stone => {stone.material.emissiveIntensity = index < completed ? .9 : 0;}));
    },
    update(delta, elapsed, playerPosition, cameraPosition) {
      if (!playerPosition) return;
      for (const roof of roofs) {
        const inside = Math.abs(playerPosition.x - roof.x) < roof.width / 2 + .5 && Math.abs(playerPosition.z - roof.z) < roof.depth / 2 + .5;
        const cameraInside = cameraPosition && Math.abs(cameraPosition.x - roof.x) < roof.width / 2 && Math.abs(cameraPosition.z - roof.z) < roof.depth / 2;
        roof.object.visible = !inside && !cameraInside;
      }
      for (const entry of animated) {
        if (entry.stone) {
          entry.object.material.emissiveIntensity = stonesLit ? .8 + Math.sin(elapsed * .8 + entry.phase) * .1 : 0;
        } else entry.object.position.x = entry.baseX + Math.sin(elapsed * .13 + entry.phase) * 2;
      }
    },
    dispose() {
      for (const resource of resources) resource.dispose();
    },
  };
}
