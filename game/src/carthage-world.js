import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const CARTHAGE_LAYOUT = Object.freeze({
  width: 8.84,
  depth: 10.67,
  upperFloor: 3.35,
  wallThickness: .7,
  north: '-z',
  historicalStatus: 'Source-informed schematic; not a measured restoration survey.',
  attackLighting: 'Late afternoon, June 27, 1844; not a torchlit night attack.',
  rooms: ['Ground-floor family kitchen and dining room', 'Ground-floor northwest debtor cell', 'Upper north criminal cell', 'Upper southeast jailer bedroom'],
});

export function buildCarthageWorld(context) {
  const {group, box, cylinder, mesh, material, colliders, points, spawn, focus, bounds, tree, fence, curve, book} = context;
  const upperY = CARTHAGE_LAYOUT.upperFloor;
  const halfWidth = CARTHAGE_LAYOUT.width / 2;
  const halfDepth = CARTHAGE_LAYOUT.depth / 2;
  const stone = ['#b29b72', '#c0a77c', '#ad956f', '#c4ad85'];
  const timber = '#5d4939';
  const plaster = '#d4c6a8';
  const windows = [];
  const labels = [];
  const roofObjects = [];

  Object.assign(bounds, {minX: -64, maxX: 64, minZ: -64, maxZ: 64});
  spawn.set(0, 0, 12);
  focus.set(1.75, upperY + 1.2, 2.8);
  const ground = mesh(new THREE.PlaneGeometry(380, 380), '#849663', 0, -.025, 0);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;

  function section(name, build) {
    const previous = group.children.length;
    build();
    const assembly = new THREE.Group();
    assembly.name = name;
    group.children.slice(previous).forEach(object => assembly.add(object));
    group.add(assembly);
    return assembly;
  }

  function solid(x, y, z, width, height, depth, color, minY = y - height / 2, maxY = y + height / 2) {
    const object = box(x, y, z, width, height, depth, color);
    colliders.push({x, z, width, depth, minY, maxY});
    return object;
  }

  function sign(text, x, y, z, width = 2.8, rotation = 0) {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 160;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = '#504536';
    drawing.fillRect(0, 0, 768, 160);
    drawing.strokeStyle = '#b9a577';
    drawing.lineWidth = 7;
    drawing.strokeRect(12, 12, 744, 136);
    drawing.fillStyle = '#f3e9cd';
    drawing.font = 'bold 48px Georgia';
    drawing.textAlign = 'center';
    drawing.textBaseline = 'middle';
    drawing.fillText(text, 384, 82, 710);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const surface = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide});
    const object = mesh(new THREE.PlaneGeometry(width, width * 160 / 768), surface, x, y, z);
    object.rotation.y = rotation;
    object.castShadow = false;
    labels.push({texture, surface});
    return object;
  }

  function wallRun(axis, fixed, start, end, bottom, height, openings = [], color = plaster, thickness = .7) {
    const ordered = [...openings].sort((first, second) => first.center - second.center);
    let cursor = start;
    const piece = (from, to, base, rise) => {
      if (to - from < .015 || rise < .015) return;
      if (axis === 'x') solid((from + to) / 2, base + rise / 2, fixed, to - from, rise, thickness, color);
      else solid(fixed, base + rise / 2, (from + to) / 2, thickness, rise, to - from, color);
    };
    for (const opening of ordered) {
      const left = opening.center - opening.width / 2;
      const right = opening.center + opening.width / 2;
      piece(cursor, left, bottom, height);
      piece(left, right, bottom, opening.sill);
      piece(left, right, bottom + opening.sill + opening.height, height - opening.sill - opening.height);
      cursor = right;
      if (opening.kind === 'window') {
        const y = bottom + opening.sill + opening.height / 2;
        if (axis === 'x') {
          box(opening.center, y, fixed, opening.width, opening.height, .07, '#a6b3ae', {transparent: true, opacity: .18, depthWrite: false});
          for (const side of [-1, 1]) box(opening.center + side * opening.width / 2, y, fixed, .09, opening.height + .18, .8, timber);
          box(opening.center, y - opening.height / 2, fixed, opening.width + .25, .12, .9, timber);
          box(opening.center, y + opening.height / 2, fixed, opening.width + .25, .12, .8, timber);
          box(opening.center, y, fixed, .055, opening.height, .12, '#e1d5ba');
          for (const paneY of [-.25, .25]) box(opening.center, y + paneY * opening.height, fixed, opening.width, .045, .12, '#e1d5ba');
          colliders.push({x: opening.center, z: fixed, width: opening.width, depth: .25, minY: bottom, maxY: bottom + height});
        } else {
          box(fixed, y, opening.center, .07, opening.height, opening.width, '#a6b3ae', {transparent: true, opacity: .18, depthWrite: false});
          for (const side of [-1, 1]) box(fixed, y, opening.center + side * opening.width / 2, .8, opening.height + .18, .09, timber);
          box(fixed, y - opening.height / 2, opening.center, .9, .12, opening.width + .25, timber);
          box(fixed, y + opening.height / 2, opening.center, .8, .12, opening.width + .25, timber);
          box(fixed, y, opening.center, .12, opening.height, .055, '#e1d5ba');
          for (const paneY of [-.25, .25]) box(fixed, y + paneY * opening.height, opening.center, .12, .045, opening.width, '#e1d5ba');
          colliders.push({x: fixed, z: opening.center, width: .25, depth: opening.width, minY: bottom, maxY: bottom + height});
        }
        windows.push({axis, fixed, ...opening, bottom});
      }
    }
    piece(cursor, end, bottom, height);
  }

  function stoneDetail(axis, fixed, from, to, bottom, height, openings) {
    for (let row = 0; row < Math.floor(height / .43); row += 1) {
      const y = bottom + .215 + row * .43;
      for (let column = 0; column < Math.ceil((to - from) / .9); column += 1) {
        const location = from + .45 + column * .9 + (row % 2) * .34;
        if (location + .35 > to) continue;
        if (openings.some(opening => Math.abs(location - opening.center) < opening.width / 2 + .4 && y > bottom + opening.sill - .1 && y < bottom + opening.sill + opening.height + .1)) continue;
        const color = stone[(row * 3 + column) % stone.length];
        if (axis === 'x') box(location, y, fixed, .83, .39, .035, color);
        else box(fixed, y, location, .035, .39, .83, color);
      }
    }
  }

  function outerWalls(bottom, height, upper = false) {
    const frontOpenings = upper ? [{center: .7, width: .93, sill: 1.02, height: 1.36, kind: 'window'}, {center: 2.85, width: .93, sill: 1.02, height: 1.36, kind: 'window'}] : [{center: 0, width: 1.38, sill: 0, height: 2.35, kind: 'door'}, {center: -2.8, width: .9, sill: 1.02, height: 1.24, kind: 'window'}, {center: 2.8, width: .9, sill: 1.02, height: 1.24, kind: 'window'}];
    const eastOpenings = [{center: upper ? 2.8 : 2.5, width: 1.05, sill: 1.0, height: 1.42, kind: 'window'}, {center: -2.7, width: .7, sill: 1.4, height: .8, kind: 'window'}];
    const westOpenings = [{center: -2.8, width: .72, sill: 1.4, height: .85, kind: 'window'}];
    const backOpenings = [{center: 2.3, width: .72, sill: 1.42, height: .8, kind: 'window'}];
    wallRun('x', halfDepth, -halfWidth, halfWidth, bottom, height, frontOpenings, '#b7a17d');
    wallRun('x', -halfDepth, -halfWidth, halfWidth, bottom, height, backOpenings, '#b7a17d');
    wallRun('z', halfWidth, -halfDepth, halfDepth, bottom, height, eastOpenings, '#b7a17d');
    wallRun('z', -halfWidth, -halfDepth, halfDepth, bottom, height, westOpenings, '#b7a17d');
    stoneDetail('x', halfDepth + .37, -halfWidth, halfWidth, bottom, height, frontOpenings);
    stoneDetail('x', -halfDepth - .37, -halfWidth, halfWidth, bottom, height, backOpenings);
    stoneDetail('z', halfWidth + .37, -halfDepth, halfDepth, bottom, height, eastOpenings);
    stoneDetail('z', -halfWidth - .37, -halfDepth, halfDepth, bottom, height, westOpenings);
  }

  function bed(x, y, z, width = 1.5, depth = 2.05) {
    box(x, y + .32, z, width, .18, depth, timber);
    box(x, y + .49, z, width - .08, .2, depth - .1, '#e4d8bb');
    box(x, y + .62, z + .28, width - .07, .11, depth - .7, '#8b8f78');
    box(x, y + .64, z - .75, width - .25, .16, .42, '#efe4c9');
    for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) cylinder(x + sideX * (width / 2 - .08), y + .43, z + sideZ * (depth / 2 - .05), .055, .075, .85, timber, 8);
    colliders.push({x, z, width, depth, minY: y, maxY: y + .9});
  }

  function chair(x, y, z, angle = 0) {
    const assembly = section('carthage-chair', () => {
      box(0, .48, 0, .5, .09, .48, '#847253');
      box(0, .84, -.19, .48, .55, .06, '#847253');
      for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) box(sideX * .19, .24, sideZ * .18, .055, .48, .055, timber);
    });
    assembly.position.set(x, y, z);
    assembly.rotation.y = angle;
  }

  function furnitureTable(x, y, z, width = 1.3, depth = .72) {
    box(x, y + .78, z, width, .12, depth, '#91734e');
    for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) box(x + sideX * (width / 2 - .1), y + .39, z + sideZ * (depth / 2 - .1), .08, .78, .08, timber);
    colliders.push({x, z, width, depth, minY: y, maxY: y + .9});
  }

  section('carthage-ground-floor', () => {
    box(0, -.1, 0, CARTHAGE_LAYOUT.width, .2, CARTHAGE_LAYOUT.depth, '#8a765a');
    for (let index = 0; index < 25; index += 1) box(-4.2 + index * .35, .012, 0, .015, .012, 10.2, '#6a5b45');
    outerWalls(0, 3.2);
    wallRun('x', -.65, -halfWidth + .35, -.55, 0, 3.1, [{center: -1.4, width: 1.1, sill: 0, height: 2.2, kind: 'door'}], plaster, .18);
    wallRun('z', -.55, -halfDepth + .35, -.65, 0, 3.1, [], plaster, .18);
    for (let index = 0; index < 5; index += 1) box(-3.8 + index * .46, .08, -3.1, .42, .1, 2.4, '#b0a078');
    furnitureTable(2.3, 0, 2.8, 1.65, 1.02);
    chair(2.3, 0, 1.9);
    chair(1.2, 0, 2.8, Math.PI / 2);
    box(2.2, .85, 2.85, .55, .025, .4, '#e8d9bc');
    cylinder(2.75, .92, 2.9, .07, .08, .16, '#9b7e56', 10);
    solid(3.1, .65, -3.7, 1.4, 1.3, .9, '#77694f');
    box(2.5, .85, -4.6, 2.5, 1.7, .2, '#a69573');
    box(2.5, 1.7, -4.55, 2.7, .15, .35, timber);
    box(2.5, .55, -4.45, .95, .9, .08, '#3c3b34');
    for (const side of [-1, 1]) cylinder(2.5 + side * .27, .34, -4.15, .08, .08, .55, '#493c31', 7).rotation.z = side * .7;
    const door = box(-.82, 1.15, 4.84, .11, 2.3, 1.3, '#806748');
    door.name = 'carthage-open-front-door';
    sign('CARTHAGE · COUNTY JAIL', 0, 2.75, halfDepth + .39, 2.7);
  });

  const upperStructure = section('carthage-upper-floor-cutaway', () => {
    box(1.36, upperY - .1, 0, 6.12, .2, 10.3, '#8b7555');
    box(-4.0, upperY - .1, 0, .82, .2, 10.3, '#8b7555');
    box(-2.65, upperY - .1, -2.85, 1.9, .2, 5, '#8b7555');
    box(-2.65, upperY - .1, 4.86, 1.9, .2, .93, '#8b7555');
    for (let index = 0; index < 18; index += 1) box(-1.4 + index * .32, upperY + .012, .15, .015, .012, 9.8, '#67583f');
    outerWalls(upperY, 2.8, true);
    wallRun('x', .15, -.65, halfWidth - .35, upperY, 2.75, [], plaster, .18);
    wallRun('z', -.72, .15, halfDepth - .35, upperY, 2.75, [{center: 1.0, width: 1.15, sill: 0, height: 2.2, kind: 'door'}], plaster, .18);
    wallRun('x', -1.55, -halfWidth + .35, halfWidth - .35, upperY, 2.75, [{center: -.3, width: 1.0, sill: 0, height: 2.13, kind: 'door'}], plaster, .18);
    for (let index = 0; index < 16; index += 1) {
      const barX = -3.85 + index * .51;
      if (Math.abs(barX + .3) < .6) continue;
      cylinder(barX, upperY + 1.4, -1.7, .025, .025, 2.6, '#454941', 6);
    }
    for (const barY of [.3, 1.4, 2.5]) {
      box(-2.35, upperY + barY, -1.7, 3, .06, .06, '#454941');
      box(2.05, upperY + barY, -1.7, 3.6, .06, .06, '#454941');
    }
    for (let index = 0; index < 6; index += 1) box(-3.4 + index * .88, upperY + .04, -3.4, .7, .07, 1.6, '#a7976f');
    bed(3.03, upperY, 3.7, 1.47, 2.1);
    furnitureTable(.55, upperY, 3.8, .95, .62);
    book(.55, upperY + .89, 3.8, true);
    cylinder(.78, upperY + 1.05, 3.6, .05, .07, .2, '#b9a06a', 10);
    chair(.6, upperY, 2.9);
    chair(2.8, upperY, 1.4, Math.PI);
    box(2.1, upperY + .74, .52, 1.5, 1.48, .27, '#b9aa8e');
    box(2.1, upperY + 1.51, .52, 1.7, .13, .45, '#877257');
    box(2.1, upperY + .45, .71, .86, .9, .05, '#433f35');
    const insideDoor = box(-.62, upperY + 1.1, .27, .12, 2.2, 1.05, '#8c7250');
    insideDoor.name = 'carthage-bedroom-open-door';
    box(-.54, upperY + 1.65, .28, .015, .06, .065, '#302f28');
    for (const beamX of [-.4, 1.6, 3.7]) box(beamX, upperY + 2.65, 2.7, .13, .16, 4.75, '#827153');
    sign('JAILER’S BEDROOM', -.28, upperY + 2.36, 1.01, 1.35, -Math.PI / 2);
  });

  const stairGroup = section('carthage-fourteen-step-stair', () => {
    for (let step = 0; step < 14; step += 1) {
      const height = upperY * (step + 1) / 14;
      const z = 4.4 - (step + .5) * 4.75 / 14;
      box(-2.65, height - .11, z, 1.9, .22, 4.75 / 14 + .01, '#7d674a');
      box(-2.65, height + .005, z + .12, 1.94, .025, .035, '#a18760');
    }
    for (const side of [-1, 1]) {
      const rail = box(-2.65 + side * .92, upperY / 2 + 1.0, 2.025, .07, .07, Math.hypot(4.75, upperY), timber);
      rail.rotation.x = Math.atan2(upperY, 4.75);
      for (let step = 0; step < 5; step += 1) {
        const amount = step / 4;
        box(-2.65 + side * .92, upperY * amount + .5, 4.4 - amount * 4.75, .055, 1.0, .055, timber);
      }
    }
    colliders.push({x: -3.64, z: 1.8, width: .08, depth: 4.3, minY: 0, maxY: upperY + .85});
    colliders.push({x: -1.66, z: 1.8, width: .08, depth: 4.3, minY: 0, maxY: upperY + .85});
  });

  const lowerCeiling = section('carthage-ground-ceiling-cutaway', () => {
    box(1.36, upperY - .23, 0, 6.12, .08, 10.3, '#b9ab8c');
    box(-4.0, upperY - .23, 0, .82, .08, 10.3, '#b9ab8c');
    box(-2.65, upperY - .23, -2.85, 1.9, .08, 5, '#b9ab8c');
    box(-2.65, upperY - .23, 4.86, 1.9, .08, .93, '#b9ab8c');
  });
  const upperCeiling = section('carthage-bedroom-ceiling-cutaway', () => {
    box(1.6, upperY + 2.77, 2.7, 5.65, .08, 4.85, '#c4b699');
    box(0, upperY + 2.77, -3.3, 8.1, .08, 3.3, '#a89e84');
  });

  const roof = section('carthage-roof-cutaway', () => {
    for (const side of [-1, 1]) {
      const slope = box(side * 2.25, 7.0, 0, 5.23, .17, 11.5, '#5f6256');
      slope.rotation.z = side * -.39;
      for (let course = 0; course < 9; course += 1) {
        const distance = .35 + course * .53;
        const seam = box(side * distance * .92, 7.88 - distance * .38, 0, .035, .035, 11.55, '#485143');
        seam.rotation.z = side * -.39;
      }
    }
    for (const end of [-1, 1]) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([-4.55, 6.15, end * 5.4, 4.55, 6.15, end * 5.4, 0, 7.95, end * 5.4], 3));
      geometry.setIndex(end > 0 ? [0, 2, 1] : [0, 1, 2]);
      geometry.computeVertexNormals();
      mesh(geometry, material('#af9873', {side: THREE.DoubleSide}), 0, 0, 0);
    }
    box(2.1, 7.28, .52, .77, 2.35, .77, '#948368');
    box(2.1, 8.48, .52, .93, .15, .93, '#b39b77');
    box(0, 7.94, 0, .18, .16, 11.6, '#535a4b');
  });
  roofObjects.push(roof);

  section('carthage-yard-and-well', () => {
    curve([[0, 25], [0, 14], [0, 8], [0, 5.3]], 1.6, '#c7b99a');
    curve([[-17, 8], [-9, 9], [0, 9], [10, 9], [19, 8]], 2.3, '#b5a98d');
    for (const side of [-1, 1]) {
      fence(side < 0 ? -12 : 2.8, 8.3, 9.2);
      fence(side * 12, -10, 18, 'z');
    }
    fence(-12, -10, 24);
    const wellX = 8.2;
    const wellZ = 2.8;
    cylinder(wellX, .42, wellZ, .91, 1, .85, '#a49678', 14);
    cylinder(wellX, .86, wellZ, .94, .94, .1, '#d1bea0', 14);
    cylinder(wellX, .92, wellZ, .72, .72, .025, '#464c43', 14);
    for (const side of [-1, 1]) box(wellX + side * .7, 1.35, wellZ, .12, 2.2, .12, '#7a6347');
    box(wellX, 2.4, wellZ, 1.7, .13, .17, '#7a6347');
    box(wellX, 1.68, wellZ, 1.52, .12, .12, '#86734f');
    cylinder(wellX, 1.19, wellZ, .018, .018, .91, '#a18e61', 6);
    cylinder(wellX, .27, wellZ, .08, .07, .13, '#514e40', 10);
    colliders.push({x: wellX, z: wellZ, radius: 1.03});
    box(-8, .25, -7.8, 1.8, .5, .7, '#83704e');
    for (let row = 0; row < 3; row += 1) for (let log = 0; log < 5 - row; log += 1) {
      const timberLog = cylinder(-8.65 + log * .3 + row * .15, .23 + row * .23, -7.8, .12, .12, .8, '#927951', 7);
      timberLog.rotation.x = Math.PI / 2;
    }
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI * 2 / 12;
      const x = Math.sin(angle) * (20 + index % 3 * 4);
      const z = Math.cos(angle) * (23 + index % 4 * 4);
      if (z > 12 && Math.abs(x) < 12) continue;
      tree(x, z, .8 + index % 3 * .13);
    }
  });

  function streetBuilding(x, z, width, depth, height, color, name) {
    const structure = section(`carthage-street-${name}`, () => {
      solid(x, height / 2, z, width, height, depth, color);
      for (const side of [-1, 1]) {
        const roofPanel = box(x + side * width * .25, height + .8, z, width * .58, .16, depth + .6, '#687063');
        roofPanel.rotation.z = side * -.42;
      }
      box(x, 1.12, z + depth / 2 + .035, .95, 2.24, .12, '#69543e');
      for (const side of [-1, 1]) {
        box(x + side * width * .29, 1.65, z + depth / 2 + .04, .93, 1.23, .12, '#e0cfaa');
        box(x + side * width * .29, 1.65, z + depth / 2 + .12, .76, 1.05, .04, '#91a5a2');
        box(x + side * width * .29, 1.65, z + depth / 2 + .15, .035, 1.08, .03, '#ded4ba');
        box(x + side * width * .29, 1.65, z + depth / 2 + .15, .8, .035, .03, '#ded4ba');
      }
      for (let row = 0; row < Math.floor(height / .33); row += 1) box(x, .16 + row * .33, z + depth / 2 + .02, width, .015, .03, '#82785f');
      box(x + width * .23, height + .75, z - depth * .22, .57, 1.5, .57, '#a08c6b');
      if (name === 'inn') sign('INN · BOARDING', x, 2.7, z + depth / 2 + .18, 2.7);
      if (name === 'store') sign('DRY GOODS', x, 2.7, z + depth / 2 + .18, 2.5);
      box(x, .12, z + depth / 2 + 1.0, width + .5, .24, 1.65, '#9b8a69');
    });
    return structure;
  }

  section('carthage-context-streets', () => {
    box(0, .012, 24, 114, .025, 7, '#b6a88b');
    box(25, .014, -5, 6, .026, 106, '#b6a88b');
    for (const side of [-1, 1]) box(0, .08, 24 + side * 4, 114, .12, 1.25, '#bcae8d');
    for (let index = 0; index < 12; index += 1) {
      const x = -50 + index * 9;
      if (Math.abs(x) < 11) continue;
      streetBuilding(x, 35 + index % 2 * 2, 6.2 + index % 3, 6.5, 3.7 + index % 2 * .9, index % 2 ? '#a48e6b' : '#bdad8b', index === 7 ? 'inn' : index === 3 ? 'store' : String(index));
    }
    for (const [x, z] of [[-27, -18], [36, 8], [36, -15], [-40, -14], [-18, 2]]) streetBuilding(x, z, 6.4, 6, 3.5, '#b2a17e', `${x}-${z}`);
    for (let index = 0; index < 6; index += 1) {
      const x = -35 + index * 14;
      cylinder(x, 1.5, 19.7, .055, .07, 3, '#786c50', 7);
      box(x, 3.03, 19.7, .3, .4, .3, '#b6aa83');
      box(x, 3.03, 19.88, .21, .28, .02, '#e4d6aa');
    }
  });

  const objectivePoints = {
    center: [1.15, upperY, 1.9],
    study: [1.0, upperY, 3.05],
    gather: [-.05, upperY, 1.0],
    prayer: [3.05, upperY, 2.25],
    journey: [0, 0, 11],
  };
  const actorPositions = {
    JOHN_TAYLOR: [2.8, upperY, 1.6],
    HYRUM: [1.2, upperY, 1.05],
    WILLARD: [.05, upperY, 1.85],
    DAN_JONES: [-1.15, upperY, -.65],
  };
  for (const point of points) if (objectivePoints[point.id]) point.position.fromArray(objectivePoints[point.id]);
  const explorationPoints = [
    {id: 'carthage-yard', label: 'The jail yard and well', position: new THREE.Vector3(7, 0, 6), kind: 'history'},
    {id: 'carthage-debtor-cell', label: 'Ground floor · debtor cell', position: new THREE.Vector3(-2.4, 0, -2.8), kind: 'history'},
    {id: 'carthage-criminal-cell', label: 'Upper floor · criminal cell', position: new THREE.Vector3(1.6, upperY, -3.25), kind: 'history'},
    {id: 'carthage-street', label: 'Carthage · county-seat streets', position: new THREE.Vector3(15, 0, 24), kind: 'history'},
  ];

  function getGroundHeight(x, z, currentY = 0) {
    if (x > -3.58 && x < -1.72 && z > -.45 && z < 4.6) return Math.max(0, Math.min(upperY, (4.4 - z) / 4.75 * upperY));
    if (currentY > upperY * .5 && Math.abs(x) < halfWidth - .25 && Math.abs(z) < halfDepth - .25) return upperY;
    return 0;
  }

  function setInteriorView(position, cameraPosition) {
    if (!position) return;
    const inside = Math.abs(position.x) < halfWidth + .3 && Math.abs(position.z) < halfDepth + .3;
    roof.visible = !inside;
    upperStructure.visible = !inside || position.y > upperY - .55;
    stairGroup.visible = true;
    lowerCeiling.visible = !inside || position.y < upperY - .55 && (!cameraPosition || cameraPosition.y < upperY - .35);
    upperCeiling.visible = !inside || position.y > upperY - .55 && (!cameraPosition || cameraPosition.y < upperY + 2.6);
  }

  group.updateMatrixWorld(true);
  for (const assembly of [...group.children].filter(object => object.isGroup)) {
    const batches = new Map();
    const inverse = assembly.matrixWorld.clone().invert();
    assembly.traverse(object => {
      if (!object.isMesh || object.isInstancedMesh || object.name || Array.isArray(object.material) || object.material.transparent || object.material.map) return;
      const geometry = object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
      const flattened = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flattened !== geometry) geometry.dispose();
      if (!batches.has(object.material.uuid)) batches.set(object.material.uuid, {material: object.material, geometries: [], objects: []});
      const batch = batches.get(object.material.uuid);
      batch.geometries.push(flattened);
      batch.objects.push(object);
    });
    for (const batch of batches.values()) {
      const geometry = mergeGeometries(batch.geometries);
      batch.geometries.forEach(value => value.dispose());
      if (!geometry) continue;
      const merged = mesh(geometry, batch.material, 0, 0, 0);
      merged.name = `${assembly.name}-static-batch`;
      assembly.add(merged);
      batch.objects.forEach(object => object.removeFromParent());
    }
  }

  group.userData.architecture = {site: 'Carthage Jail', ...CARTHAGE_LAYOUT, roomCount: 4, navigableStories: 2, historicalBasement: false, streetsSchematic: true};
  return {
    getGroundHeight,
    actorPositions,
    objectivePoints,
    explorationPoints,
    setInteriorView,
    roofObjects,
    update(delta, elapsed, playerPosition, cameraPosition) { setInteriorView(playerPosition, cameraPosition); },
    dispose() { for (const {texture, surface} of labels) { texture.dispose(); surface.dispose(); } },
    layout: CARTHAGE_LAYOUT,
  };
}
