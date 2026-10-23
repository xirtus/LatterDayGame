import * as THREE from 'three';
import {shadeColor} from './architecture-kit.js';

export function buildConnectedSettlement(context) {
  const {chapter, group, box, cylinder, sphere, mesh, colliders, bounds, spawn, focus, tree, fence, curve, table, book, bench, temple, quality, kit} = context;
  const environment = chapter.environment;
  const domestic = ['bedroom', 'harmony', 'farm'].includes(environment);
  const urban = ['lowell', 'manhattan'].includes(environment);
  const nauvoo = environment === 'nauvoo';
  const roofs = [];
  const resources = [];
  const buildings = [];
  const extras = [];
  let loft = null;
  Object.assign(bounds, {minX: -108, maxX: 108, minZ: -108, maxZ: 108});

  function solid(x, y, z, width, height, depth, color) {
    const object = box(x, y, z, width, height, depth, color);
    colliders.push({x, z, width, depth, minY: y - height / 2, maxY: y + height / 2});
    return object;
  }

  function sign(text, x, y, z, width = 3) {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 144;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = '#293b3b';
    drawing.fillRect(0, 0, 768, 144);
    drawing.strokeStyle = '#c8ac6c';
    drawing.lineWidth = 5;
    drawing.strokeRect(10, 10, 748, 124);
    drawing.fillStyle = '#f4e5bd';
    drawing.textAlign = 'center';
    drawing.textBaseline = 'middle';
    drawing.font = '38px Georgia';
    drawing.fillText(text, 384, 74, 720);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const surface = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide});
    const object = mesh(new THREE.PlaneGeometry(width, width * 144 / 768), surface, x, y, z);
    resources.push({texture, surface});
    return object;
  }

  function chair(x, z, rotation = 0) {
    const start = group.children.length;
    box(0, .49, 0, .62, .1, .62, '#77583d');
    box(0, .94, -.25, .62, .78, .08, '#806246');
    for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) box(sideX * .24, .25, sideZ * .24, .065, .5, .065, '#5c4634');
    const assembly = new THREE.Group();
    assembly.userData.mergeStatic = true;
    group.children.slice(start).forEach(object => assembly.add(object));
    assembly.position.set(x, 0, z);
    assembly.rotation.y = rotation;
    group.add(assembly);
  }

  function finishFor(color, logs) {
    const tone = new THREE.Color(color);
    const hsl = {};
    tone.getHSL(hsl);
    if (logs) return {wall: kit.surface('logs', shadeColor(color, .1)), kind: 'logs'};
    if (hsl.h < .065 && hsl.s > .28) return {wall: kit.surface('brick', shadeColor(color, .12)), kind: 'brick'};
    return {wall: kit.surface('clapboard', shadeColor(color, .08)), kind: 'clapboard'};
  }

  function bed(x, z, upperY = 0) {
    box(x, upperY + .42, z, 1.55, .42, 2.3, '#74583f');
    box(x, upperY + .68, z, 1.5, .18, 2.2, '#dfd1b2');
    kit.slab(x, upperY + .79, z + .24, 1.56, .07, 1.7, kit.surface('quilt', '#ffffff'));
    box(x, upperY + .62, z + 1.08, 1.56, .3, .05, '#c97b63');
    box(x, upperY + .84, z - .8, 1.1, .19, .4, '#f1e5cb');
    box(x, upperY + .95, z - 1.17, 1.65, 1.1, .1, '#6b4f39');
    box(x, upperY + 1.52, z - 1.17, 1.75, .1, .14, '#5a4130');
    for (const side of [-1, 1]) {
      cylinder(x + side * .78, upperY + .65, z - 1.17, .05, .05, 1.3, '#5a4130', 8);
      cylinder(x + side * .78, upperY + .45, z + 1.12, .05, .05, .9, '#5a4130', 8);
      sphere(x + side * .78, upperY + 1.34, z - 1.17, .07, '#5a4130');
    }
    solid(x, upperY + .5, z, 1.55, 1, 2.3, '#74583f').visible = false;
  }

  function rockingChair(x, z, rotation = 0) {
    const start = group.children.length;
    box(0, .46, 0, .56, .07, .55, '#6c4e36');
    box(0, .95, -.25, .56, .9, .05, '#6c4e36');
    for (let slat = 0; slat < 4; slat++) box(-.18 + slat * .12, .95, -.22, .05, .7, .03, '#7c5c40');
    for (const side of [-1, 1]) {
      box(side * .26, .25, 0, .05, .44, .05, '#5a4130');
      box(side * .27, .7, .02, .06, .05, .5, '#5a4130');
      const rocker = cylinder(side * .26, .04, 0, .03, .03, .95, '#5a4130', 6);
      rocker.rotation.x = Math.PI / 2;
    }
    const assembly = new THREE.Group();
    assembly.userData.mergeStatic = true;
    group.children.slice(start).forEach(object => assembly.add(object));
    assembly.position.set(x, 0, z);
    assembly.rotation.y = rotation;
    group.add(assembly);
  }

  function spinningWheel(x, z, rotation = 0) {
    const start = group.children.length;
    box(0, .42, 0, .22, .1, 1.1, '#7a5a3e');
    for (const end of [-1, 1]) for (const side of [-1, 1]) {
      const leg = cylinder(side * .1, .2, end * .45, .025, .025, .45, '#6a4d35', 6);
      leg.rotation.x = end * .25;
    }
    const wheel = mesh(new THREE.TorusGeometry(.42, .025, 6, 28), '#7a5a3e', 0, .95, .2);
    wheel.rotation.y = Math.PI / 2;
    for (let spoke = 0; spoke < 8; spoke++) {
      const arm = box(0, .95, .2, .02, .84, .02, '#8a6a4d');
      arm.rotation.x = spoke / 8 * Math.PI;
    }
    cylinder(0, .7, .2, .03, .03, .5, '#6a4d35', 6);
    cylinder(0, .82, -.42, .05, .05, .2, '#e8dcc0', 8).rotation.z = Math.PI / 2;
    const assembly = new THREE.Group();
    assembly.userData.mergeStatic = true;
    group.children.slice(start).forEach(object => assembly.add(object));
    assembly.position.set(x, 0, z);
    assembly.rotation.y = rotation;
    group.add(assembly);
  }

  function dresser(x, z, facing = 1) {
    solid(x, .45, z, 1.6, .9, .55, '#6b4f39');
    for (const row of [.25, .6]) for (const side of [-1, 1]) {
      box(x + side * .38, row, z + facing * .28, .66, .28, .03, '#7a5c43');
      box(x + side * .38, row, z + facing * .3, .12, .04, .03, '#c7a463');
    }
    box(x, 1.55, z - facing * .15, 1.6, 1.3, .26, '#6b4f39');
    for (const shelf of [1.2, 1.6, 2]) box(x, shelf, z - facing * .02, 1.5, .04, .24, '#7a5c43');
    for (const shelf of [1.2, 1.6]) for (let plate = 0; plate < 5; plate++) {
      const dish = cylinder(x - .6 + plate * .3, shelf + .17, z - facing * .1, .13, .13, .02, plate % 2 ? '#e7e1d2' : '#9fb3c0', 16);
      dish.rotation.x = Math.PI / 2 - facing * .25;
    }
    for (let jar = 0; jar < 4; jar++) cylinder(x - .55 + jar * .36, 2.12, z - facing * .06, .07, .08, .2, ['#a87b52', '#6f8c85', '#d1c19a', '#8b5e44'][jar], 9);
    box(x, 2.24, z - facing * .12, 1.7, .06, .34, '#5a4130');
  }

  function washstand(x, z) {
    box(x, .4, z, .7, .06, .5, '#7a5c43');
    box(x, .78, z, .7, .05, .5, '#7a5c43');
    for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) box(x + sideX * .3, .4, z + sideZ * .2, .04, .8, .04, '#6a4d35');
    cylinder(x, .86, z, .22, .14, .1, '#ece7da', 16);
    cylinder(x + .18, .97, z - .06, .07, .09, .28, '#ece7da', 12);
    box(x - .37, .62, z, .02, .3, .32, '#efe8d6');
  }

  function pegRail(x, y, z, length, axis = 'x', facing = 1) {
    if (axis === 'x') box(x, y, z, length, .1, .04, '#6b4f39');
    else box(x, y, z, .04, .1, length, '#6b4f39');
    const count = Math.floor(length / .45);
    for (let peg = 0; peg < count; peg++) {
      const offset = -length / 2 + .25 + peg * .45;
      const px = axis === 'x' ? x + offset : x + facing * .06;
      const pz = axis === 'x' ? z + facing * .06 : z + offset;
      if (axis === 'x') box(px, y, pz, .03, .03, .1, '#5a4130');
      else box(px, y, pz, .1, .03, .03, '#5a4130');
      if (peg % 3 === 0) box(px, y - .45, pz + (axis === 'x' ? facing * .05 : 0), axis === 'x' ? .36 : .06, .8, axis === 'x' ? .06 : .36, ['#4a4f48', '#6b5a48', '#3e4a52'][peg % 3]);
      if (peg % 3 === 1) {
        cylinder(px, y + .06, pz + (axis === 'x' ? facing * .12 : 0), .14, .16, .14, '#3d3a33', 12);
        cylinder(px, y - .01, pz + (axis === 'x' ? facing * .12 : 0), .24, .24, .02, '#3d3a33', 14);
      }
    }
  }

  function herbBundle(x, y, z) {
    cylinder(x, y - .12, z, .012, .012, .24, '#8a7a5a', 4);
    for (let sprig = 0; sprig < 5; sprig++) {
      const leaf = cylinder(x + (sprig - 2) * .03, y - .38, z + (sprig % 2) * .03, .05, .015, .32, ['#7c8b56', '#9a9a62', '#8a7a4a'][sprig % 3], 5);
      leaf.rotation.z = (sprig - 2) * .1;
    }
  }

  function lantern(x, y, z, hanging = false) {
    if (hanging) cylinder(x, y + .3, z, .008, .008, .5, '#2f2b27', 4);
    box(x, y + .14, z, .2, .03, .2, '#2f2b27');
    box(x, y - .14, z, .22, .03, .22, '#2f2b27');
    for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) box(x + sideX * .09, y, z + sideZ * .09, .02, .28, .02, '#2f2b27');
    cylinder(x, y - .04, z, .03, .03, .1, '#efe4c8', 8);
    kit.flame(x, y + .05, z, 1.1);
    cylinder(x, y + .2, z, .0, .12, .1, '#2f2b27', 4).rotation.y = Math.PI / 4;
  }

  function woodpile(x, z, length = 3, axis = 'x') {
    for (let row = 0; row < 4; row++) for (let log = 0; log < Math.floor(length / .22) - row; log++) {
      const offset = -length / 2 + .11 + log * .22 + row * .11;
      const piece = cylinder(axis === 'x' ? x + offset : x, .11 + row * .19, axis === 'x' ? z : z + offset, .1, .11, .7, log % 3 ? '#7a5c3e' : '#8f6d4a', 7);
      piece.rotation[axis === 'x' ? 'x' : 'z'] = Math.PI / 2;
    }
    const roofBoard = box(x, 1.05, z, axis === 'x' ? length + .3 : 1.1, .06, axis === 'x' ? 1.1 : length + .3, '#5d4a3a');
    roofBoard.rotation[axis === 'x' ? 'x' : 'z'] = .2;
    for (const end of [-1, 1]) box(axis === 'x' ? x + end * length / 2 : x - .4, .5, axis === 'x' ? z - .4 : z + end * length / 2, .08, 1, .08, '#5d4a3a');
    colliders.push({x, z, width: axis === 'x' ? length : 1, depth: axis === 'x' ? 1 : length});
  }

  function choppingBlock(x, z) {
    cylinder(x, .28, z, .3, .34, .56, '#7a5c3e', 12);
    cylinder(x, .565, z, .28, .28, .01, '#c9ad83', 12);
    const handle = cylinder(x + .1, .78, z, .022, .026, .7, '#a8875d', 6);
    handle.rotation.z = -.5;
    box(x - .02, .58, z, .16, .1, .03, '#5a5d5f');
    for (let chip = 0; chip < 6; chip++) box(x + Math.sin(chip * 2.1) * .6, .01, z + Math.cos(chip * 2.1) * .55, .1, .015, .05, '#c9ad83').rotation.y = chip;
  }

  function rainBarrel(x, z) {
    cylinder(x, .45, z, .34, .3, .9, '#7c5d40', 14);
    for (const y of [.15, .45, .75]) cylinder(x, y, z, .35, .35, .05, '#3f3a35', 14);
    cylinder(x, .905, z, .31, .31, .01, '#4f6f73', 14);
  }

  function house({x = 0, z = 0, width = 13, depth = 13, height = 3.4, color = '#b9a17b', name = '', use = 'home', upper = false, logs = false}) {
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const doorWidth = 1.6;
    const shell = {x, z, width, depth, height, name, use};
    buildings.push(shell);
    const {wall, kind} = finishFor(color, logs);
    const brick = kind === 'brick';
    const inner = kind === 'logs' ? wall : kit.surface('plaster', '#efe5cf');
    const trim = brick ? '#d9cfb8' : kind === 'logs' ? '#5d4734' : '#ece2c8';
    const shutterColor = brick || kind === 'logs' ? null : ['#3f5a4f', '#5a3f33', '#3d4b5a'][buildings.length % 3];
    const masonry = kit.surface('fieldstone', '#c9bca4');
    const shingles = kit.surface('shingles', brick ? '#8a8c8e' : '#a39684');
    const floorFinish = kit.surface('planks', '#b58f63');
    const home = use === 'home';

    // Floor and fieldstone sill.
    kit.slab(x, -.1, z, width + .3, .2, depth + .3, floorFinish);
    for (const side of [-1, 1]) {
      kit.slab(x + side * (halfWidth + .1), .08, z, .5, .36, depth + .7, masonry);
      kit.slab(x, .08, z - side * (halfDepth + .1), width + .7, .36, .5, masonry);
    }

    // Openings: door and windows on each face; tall buildings get an upper row.
    const windowColumns = width >= 10 ? [-width * .3, width * .3] : [];
    const sideColumns = depth >= 14 ? [-depth * .26, depth * .26] : [0];
    const tall = height >= 5;
    const lower = {bottom: 1.05, height: 1.55, width: 1.15};
    const upperRow = {bottom: height - 2.15, height: 1.35, width: 1.05};
    const front = [{center: x, width: doorWidth, bottom: 0, height: 2.45, door: true}, ...windowColumns.map(offset => ({center: x + offset, ...lower}))];
    const back = home ? windowColumns.map(offset => ({center: x + offset * 1.12, ...lower})) : windowColumns.map(offset => ({center: x + offset, ...lower}));
    const sides = sideColumns.map(offset => ({center: z + offset, ...lower}));
    if (tall) {
      front.push(...windowColumns.map(offset => ({center: x + offset, ...upperRow})));
      back.push(...windowColumns.map(offset => ({center: x + offset * (home ? 1.12 : 1), ...upperRow})));
      sides.push(...sideColumns.map(offset => ({center: z + offset, ...upperRow})));
    }
    const runs = [
      {axis: 'x', fixed: z + halfDepth, start: x - halfWidth - .13, end: x + halfWidth + .13, openings: front, outward: 1},
      {axis: 'x', fixed: z - halfDepth, start: x - halfWidth - .13, end: x + halfWidth + .13, openings: back, outward: -1},
      {axis: 'z', fixed: x + halfWidth, start: z - halfDepth, end: z + halfDepth, openings: sides, outward: 1},
      {axis: 'z', fixed: x - halfWidth, start: z - halfDepth, end: z + halfDepth, openings: sides, outward: -1},
    ];
    for (const run of runs) {
      const common = {axis: run.axis, start: run.start, end: run.end, height, openings: run.openings};
      kit.wallRun({...common, fixed: run.fixed + run.outward * .06, finish: wall, thickness: .14, collide: false});
      kit.wallRun({...common, fixed: run.fixed - run.outward * .07, start: run.start + .13, end: run.end - .13, finish: inner, thickness: .12, collide: false});
      kit.wallRun({...common, fixed: run.fixed, finish: null, thickness: .26});
      if (kind !== 'logs') {
        kit.wallRun({...common, fixed: run.fixed - run.outward * .15, start: run.start + .2, end: run.end - .2, height: .95, finish: kit.surface('panel', '#9c7a58'), thickness: .04, collide: false});
        const railFrom = run.start + .2;
        const railTo = run.end - .2;
        const railFixed = run.fixed - run.outward * .18;
        const railPieces = [];
        let cursor = railFrom;
        for (const opening of [...run.openings].filter(item => item.bottom < .96).sort((a, b) => a.center - b.center)) { railPieces.push([cursor, opening.center - opening.width / 2]); cursor = opening.center + opening.width / 2; }
        railPieces.push([cursor, railTo]);
        for (const [from, to] of railPieces) if (to - from > .05) {
          if (run.axis === 'x') box((from + to) / 2, .96, railFixed, to - from, .07, .05, '#7a5c43');
          else box(railFixed, .96, (from + to) / 2, .05, .07, to - from, '#7a5c43');
        }
      }
      for (const opening of run.openings) {
        if (opening.door) continue;
        const y = opening.bottom + opening.height / 2;
        const position = run.axis === 'x' ? {x: opening.center, z: run.fixed} : {x: run.fixed, z: opening.center};
        kit.sashWindow({axis: run.axis, ...position, y, width: opening.width, height: opening.height, outward: run.outward, frame: trim, shutters: shutterColor, curtains: home ? ['#e9dfc7', '#d8c4a0', '#c9d1c4'][buildings.length % 3] : null});
        if (brick) {
          if (run.axis === 'x') kit.slab(opening.center, y + opening.height / 2 + .24, run.fixed + run.outward * .14, opening.width + .4, .2, .08, kit.surface('ashlar', '#ded6c3'));
          else kit.slab(run.fixed + run.outward * .14, y + opening.height / 2 + .24, opening.center, .08, .2, opening.width + .4, kit.surface('ashlar', '#ded6c3'));
        }
      }
    }
    // Corner boards, water table and frieze on framed houses.
    if (kind === 'clapboard') for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) box(x + sideX * (halfWidth + .1), height / 2, z + sideZ * (halfDepth + .1), .2, height, .2, trim);
    if (kind !== 'logs') for (const side of [-1, 1]) {
      box(x + side * (halfWidth + .15), height - .15, z, .05, .3, depth + .3, trim);
      box(x, height - .15, z + side * (halfDepth + .15), width + .3, .3, .05, trim);
    }
    if (kind === 'logs') for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) for (let course = 0; course < height / .28; course++) {
      const notch = cylinder(x + sideX * (halfWidth + .05), .14 + course * .28, z + sideZ * (halfDepth + .05), .13, .13, .36, '#7f6446', 7);
      notch.rotation[course % 2 ? 'x' : 'z'] = Math.PI / 2;
    }

    // Door: surround, transom, open panelled leaf, stone step.
    for (const side of [-1, 1]) box(x + side * (doorWidth / 2 + .08), 1.23, z + halfDepth + .15, .16, 2.5, .1, trim);
    box(x, 2.55, z + halfDepth + .16, doorWidth + .5, .2, .14, trim);
    if (brick || tall) {
      box(x, 2.82, z + halfDepth + .14, doorWidth + .1, .3, .04, '#9fb0ae');
      box(x, 3.05, z + halfDepth + .18, doorWidth + .7, .14, .22, trim);
    }
    const door = kit.panelDoor(x + doorWidth / 2, 1.2, z + halfDepth + doorWidth / 2 + .05, doorWidth - .06, 2.4, brick ? '#3f4b45' : '#6e5137', 'z');
    door.name = 'open-door';
    kit.slab(x, .06, z + halfDepth + .55, doorWidth + .9, .14, .8, kit.surface('ashlar', '#bdb4a2'));
    kit.slab(x, -.01, z + halfDepth + 1.15, doorWidth + .5, .1, .5, kit.surface('ashlar', '#b3aa98'));

    // Roof shell (hidden when the camera is inside so rooms read from above).
    const roof = new THREE.Group();
    roof.name = `cutaway-roof:${name || use}`;
    roof.userData.mergeStatic = true;
    const roofStart = group.children.length;
    const pitch = brick ? .5 : .6;
    const {rise} = kit.gableRoof({x, z, width: width + .26, depth: depth + .26, height, pitch, finish: shingles, trim: brick ? '#5d554e' : '#4b4038', wallFinish: wall, overhang: kind === 'logs' ? .7 : .5});
    kit.slab(x, height - .03, z, width - .2, .06, depth - .2, kit.surface('plaster', '#e6dcc4'));
    for (let joist = -halfWidth + 1; joist < halfWidth - .5; joist += 1.6) box(x + joist, height - .13, z, .12, .16, depth - .3, '#8a6a4c');
    box(x, height - .22, z, .22, .24, depth - .3, '#7a5c43');
    if (home) {
      for (let bundle = 0; bundle < 5; bundle++) herbBundle(x - halfWidth + 1.6 + bundle * .4, height - .26, z + 1.2 + (bundle % 2) * .3);
      lantern(x + .9, height - .85, z + .4, true);
    }
    if (!home) {
      const stackX = x + halfWidth * .45;
      const stackZ = z - halfDepth * .35;
      const stackTop = height + rise * (1 - .45) + 1;
      kit.slab(stackX, height + (stackTop - height) / 2, stackZ, .7, stackTop - height, .7, kit.surface('brick', '#b07a5d'));
      box(stackX, stackTop + .05, stackZ, .85, .1, .85, '#6f675c');
      kit.addSmoke(stackX, stackTop + .2, stackZ, .6);
    }
    group.children.slice(roofStart).forEach(object => roof.add(object));
    group.add(roof);
    roofs.push({roof, shell});

    if (name) sign(name, x, 3.0 + (brick || tall ? .45 : 0), z + halfDepth + .26, Math.min(width - 2, 4.4));

    if (use === 'press') {
      table(x + 2.8, z - 2.2, 2.9, 1.6);
      book(x + 2.8, 1.14, z - 2.2);
      for (const side of [-1, 1]) solid(x - 3 + side * .68, 1.4, z - 2.5, .21, 2.8, .24, '#4d4a3d');
      box(x - 3, 2.7, z - 2.5, 1.8, .28, .42, '#4d4a3d');
      cylinder(x - 3, 1.95, z - 2.5, .1, .1, 1.45, '#595644', 8);
      box(x - 3, 1.26, z - 2.1, 1.65, .16, 1.8, '#7d6549');
      box(x - 3, 1.37, z - 1.9, 1.35, .04, 1.2, '#eee0b9');
      for (let stack = 0; stack < 5; stack++) box(x + 3, .3 + stack * .075, z + 2.5, 1.2, .06, .85, '#ded3b4');
      // Type cases and drying lines of printed sheets.
      for (let rack = 0; rack < 2; rack++) {
        solid(x - halfWidth + .7, .7, z - 1.5 + rack * 2.2, .9, 1.4, 1.8, '#6d533c');
        for (let drawer = 0; drawer < 5; drawer++) box(x - halfWidth + 1.16, .25 + drawer * .26, z - 1.5 + rack * 2.2, .02, .2, 1.6, '#7f6449');
      }
      for (let sheet = 0; sheet < 9; sheet++) box(x - 2 + sheet * .5, height - .7, z + 1.4, .4, .5, .01, '#efe5c8');
      cylinder(x, height - .45, z + 1.4, .006, .006, 5, '#3d3a33', 4).rotation.z = Math.PI / 2;
    } else if (use === 'barber') {
      for (const seatX of [-2.5, 2.5]) {
        chair(x + seatX, z - 1.8, Math.PI);
        box(x + seatX, 1.9, z - halfDepth + .3, 1.5, 2.1, .14, '#715c3f');
        box(x + seatX, 1.9, z - halfDepth + .4, 1.28, 1.87, .04, '#a7b9b2');
      }
      table(x + 3, z + 2, 2, 1);
      cylinder(x + 3, 1.16, z + 2, .18, .23, .16, '#e9dcc0', 16);
      book(x + 2.4, 1.12, z + 2);
      washstand(x - 4.6, z + 1.5);
      pegRail(x, 1.9, z + halfDepth - .3, 5, 'x', -1);
    } else if (use === 'store') {
      for (const side of [-1, 1]) {
        for (const shelfY of [.4, 1.2, 2]) {
          box(x + side * (halfWidth - .65), shelfY, z - 1, .8, .13, depth - 3, '#7c6344');
          for (let item = 0; item < 7; item++) cylinder(x + side * (halfWidth - .65), shelfY + .23, z - halfDepth + 1.4 + item * 1.1, .13, .18, .38, ['#b4a47c', '#7f8e7b', '#a5745a', '#d9cfb3'][item % 4], 8);
        }
      }
      table(x + 2.3, z - 1, 2.6, 1.3);
      book(x + 2.3, 1.14, z - 1);
      // Counter, barrels, sacks and a hanging scale.
      box(x - 1.2, .55, z - 2.6, 4, 1.1, .7, '#6d533c');
      box(x - 1.2, 1.12, z - 2.6, 4.2, .06, .85, '#8a6a4d');
      for (let barrel = 0; barrel < 3; barrel++) {
        cylinder(x - 3.6 + barrel * .8, .45, z + 2.4, .32, .28, .9, '#7c5d40', 12);
        for (const y of [.18, .72]) cylinder(x - 3.6 + barrel * .8, y, z + 2.4, .33, .33, .04, '#3f3a35', 12);
      }
      for (let sack = 0; sack < 4; sack++) mesh(new THREE.IcosahedronGeometry(.3, 1), '#cdbb93', x + 1 + sack * .55, .28, z + 3).scale.set(1, 1.2, .8);
      cylinder(x - 1.2, 1.7, z - 2.6, .005, .005, .9, '#3d3a33', 4);
      cylinder(x - 1.2, 1.25, z - 2.6, .16, .12, .05, '#b08a4a', 12);
    } else {
      const hearthFront = kit.fireplace({x, z: z - halfDepth + .53, ceiling: upper ? 2.75 : height - .02, finish: kit.surface('fieldstone', '#bcae96'), hearthFinish: kit.surface('ashlar', '#a69d8d')});
      kit.stoneChimney({x, z: z - halfDepth - .13, top: height + rise + .9, outward: -1, finish: masonry});
      table(x + 3, z - 1.8, 2.8, 1.3);
      book(x + 3, 1.14, z - 1.8);
      chair(x + 3, z - 3.2);
      chair(x + 3, z - .4, Math.PI);
      cylinder(x + 2.2, 1.17, z - 1.6, .05, .06, .06, '#b08a4a', 8);
      cylinder(x + 2.2, 1.27, z - 1.6, .025, .025, .16, '#f1e7cf', 8);
      kit.flame(x + 2.2, 1.39, z - 1.6, .9);
      rockingChair(x + 1.6, hearthFront.front + 1.2, Math.PI + .5);
      const rug = mesh(new THREE.CylinderGeometry(1, 1, .02, 40), kit.surface('rug', '#ffffff'), x + .4, .012, hearthFront.front + 1.5);
      rug.scale.set(1.25, 1, .85);
      rug.castShadow = false;
      spinningWheel(x - 4.4, z + 3.2, .9);
      dresser(x + 2.6, z - halfDepth + .45, 1);
      pegRail(x - halfWidth + .25, 1.75, z + 2.6, 2.6, 'z', 1);
      washstand(x - halfWidth + .7, z - 1);
      bed(x - 3.7, z - 3.3, upper ? 2.95 : 0);
      box(x + halfWidth - .6, 1.25, z - halfDepth + 1.5, .7, 2.5, 1.8, '#80634b');
      box(x + halfWidth - .26, 1.25, z - halfDepth + 1.5, .04, 2.2, 1.5, '#8f7052');
      if (upper) {
        loft = {x, z, width, depth, y: 2.95};
        const upperStart = group.children.length;
        kit.slab(x + .95, 2.85, z, width - 2.5, .2, depth, floorFinish);
        kit.slab(x - halfWidth + 1.25, 2.85, z - 4.5, 2.5, .2, 4, floorFinish);
        for (let beam = -halfDepth + .6; beam < halfDepth; beam += 1.3) box(x + .95, 2.68, z + beam, width - 2.5, .16, .14, '#6b513b');
        const ceiling = new THREE.Group();
        ceiling.name = 'sleeping-loft-floor';
        ceiling.userData.mergeStatic = true;
        group.children.slice(upperStart).forEach(object => ceiling.add(object));
        group.add(ceiling);
        roofs.push({roof: ceiling, shell, lowerOnly: true});
        for (let step = 0; step < 16; step++) box(x - halfWidth + 1.2, step * 2.95 / 16 + .08, z + 3.8 - step * .42, 1.8, .15, .46, '#9e815a');
        for (let post = 0; post < 5; post++) box(x - halfWidth + 2.15, 2.95 + .45, z - 2.2 + post * .5, .05, .9, .05, '#6b513b');
        box(x - halfWidth + 2.15, 3.9, z - 1.2, .07, .07, 2.4, '#6b513b');
      }
      // Yard life around the homestead.
      woodpile(x + halfWidth + 1.1, z - halfDepth * .35, 3.2, 'z');
      choppingBlock(x + halfWidth + 2.6, z + 1.2);
      rainBarrel(x - halfWidth - .45, z + halfDepth - .45);
      const benchX = x - doorWidth / 2 - 1.6;
      box(benchX, .45, z + halfDepth + .5, 1.6, .08, .4, '#7a5c43');
      for (const side of [-1, 1]) box(benchX + side * .65, .22, z + halfDepth + .5, .08, .44, .34, '#5a4130');
      lantern(x + doorWidth / 2 + .45, 2.05, z + halfDepth + .3);
    }
    return shell;
  }

  function garden(x, z, width = 12) {
    for (let row = 0; row < 5; row++) {
      box(x, .012, z + row * 1.3, width, .035, .6, '#746747');
      for (let plant = 0; plant < 7; plant++) cylinder(x - width / 2 + .8 + plant * width / 7, .23, z + row * 1.3, .13, .2, .4, '#66834b', 6);
    }
    fence(x - width / 2 - 1, z - 1, width + 2);
    fence(x - width / 2 - 1, z - 1, 9, 'z');
    fence(x + width / 2 + 1, z - 1, 9, 'z');
  }

  function backdrop() {
    const ground = mesh(new THREE.PlaneGeometry(650, 650), urban ? '#9c9a83' : '#879d68', 0, -.035, 0);
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;
    const count = quality === 'low' ? 38 : 66;
    for (let index = 0; index < count; index++) {
      const angle = index * 2.39996;
      const distance = 56 + (index % 7) * 8;
      if (urban && index % 3 !== 0) continue;
      tree(Math.cos(angle) * distance, Math.sin(angle) * distance, .8 + (index % 5) * .17);
    }
  }

  backdrop();
  let objectivePoints = null;
  let actorPositions = null;
  if (domestic) {
    const moroniLoft = chapter.id === '04';
    const smithFarm = moroniLoft;
    house({upper: moroniLoft, height: moroniLoft ? 5.8 : 3.4, logs: smithFarm, name: smithFarm ? 'SMITH FAMILY · 1823' : chapter.id === '01' ? 'LEBANON · NEW HAMPSHIRE' : chapter.id === 'E4' ? 'THE FAMILY ARCHIVE' : chapter.id === '11' ? 'WHITMER FAMILY · FAYETTE' : chapter.id === '06' ? 'HALE HOUSEHOLD · HARMONY' : 'HARMONY · PENNSYLVANIA', color: smithFarm ? '#a6885f' : '#c7b28c'});
    house({x: 30, z: -25, width: 9, depth: 8, name: 'NEIGHBORING FARM', color: '#baa47c'});
    garden(-24, -12);
    for (let row = 0; row < 7; row++) box(-25, .015, 9 + row * 2, 25, .04, 1.1, row % 2 ? '#a89e65' : '#8b9057');
    fence(-42, 28, 32);
    fence(9, -28, 31);
    curve([[0, 9], [0, 20], [12, 33], [26, 70], [32, 110]], 2.4);
    curve([[-100, 36], [-30, 34], [12, 33], [100, 40]], 4.5, '#b9aa88');
    for (let index = 0; index < 9; index++) tree(-35 + index * 5, -30, .75);
    for (let index = 0; index < 12; index++) cylinder(10 + index % 4 * .43, .23 + Math.floor(index / 4) * .35, 6, .18, .2, 1.5, '#755d41', 8).rotation.x = Math.PI / 2;
    cylinder(-1, 1.2, -5, .06, .06, .22, '#dfcda0', 10);
    const candle = new THREE.PointLight('#ffe2ad', 1.8, 13, 2);
    candle.position.set(-1, 2.1, -4.8);
    group.add(candle);
    const river = mesh(new THREE.PlaneGeometry(10, 260), '#789fa7', 57, -.005, -15);
    river.rotation.x = -Math.PI / 2;
    const floor = moroniLoft ? 2.95 : 0;
    spawn.set(0, floor, 3);
    focus.set(-2, floor + 1.4, -1);
    objectivePoints = {center: [0, floor, 0], gather: [-2.1, 0, 1.8], study: [2.7, floor, -.2], prayer: [-1.8, floor, -3.5], journey: [0, 0, 12], left: [-3.5, floor, 1.7], right: [3.7, floor, 1.8]};
    actorPositions = {JOSEPH_SR: [-2.5, 0, .2], LUCY: [1.4, 0, 1.6], EMMA: [-2.4, 0, 1], OLIVER: [3, 0, -3.4], MARTIN: [-3, 0, 2], MORONI: [-2.2, floor, -2.3]};
    if (environment === 'harmony' && chapter.id !== 'E4') {
      cylinder(2.4, 1.32, -1.8, .22, .24, .38, '#4a493d', 16);
      cylinder(2.4, 1.14, -1.8, .38, .38, .035, '#4a493d', 16);
      box(3.8, 1.14, -2, .8, .16, .7, '#c2b291');
      box(3.8, 1.24, -2, .89, .05, .78, '#ded1b0');
      cylinder(3.2, 1.23, -1.7, .06, .05, .05, '#7c6d59', 8);
      box(2.9, 1.16, -1.5, .65, .015, .45, '#eee2be');
    }
  } else {
    const streetWidth = urban ? 9 : 7;
    curve([[0, -125], [0, 0], [0, 125]], streetWidth, '#b1a58b');
    for (const crossZ of [-36, 0, 36]) curve([[-125, crossZ], [0, crossZ], [125, crossZ]], streetWidth, '#b9ad91');
    if (urban) {
      for (const side of [-1, 1]) box(side * 5.2, .035, 0, 1.7, .08, 225, '#b9b5a1');
      house({x: -20, z: -11, use: environment === 'lowell' ? 'barber' : 'store', name: environment === 'lowell' ? 'WALKER LEWIS · BARBER' : 'NEW YORK · OCTOBER 1832', color: '#a66e53'});
      objectivePoints = {center: [-20, 0, -11], gather: [-22, 0, -10], study: [-17.4, 0, -10], prayer: [-20, 0, -14.6], journey: [-20, 0, 1], left: [-23.8, 0, -9], right: [-16.2, 0, -9]};
      actorPositions = {WALKER_LEWIS: [-22, 0, -12.2], WHITNEY: [-18, 0, -10.2]};
      for (let row = 0; row < 5; row++) for (const side of [-1, 1]) {
        if (row === 2 && side === -1) continue;
        const x = side * (20 + row % 2 * 2);
        const z = -64 + row * 27;
        house({x, z, width: 12, depth: 16, height: 5.4 + row % 3 * 1.3, color: ['#a06e53', '#a68b6c', '#8f6955'][row % 3], name: ['DRY GOODS', 'PRINTING & BOOKS', 'PROVISIONS', 'ROOMS', 'WORKSHOP'][row], use: row % 2 ? 'store' : 'press'});
      }
      const water = mesh(new THREE.PlaneGeometry(38, 300), '#73939b', 89, -.01, -20);
      water.rotation.x = -Math.PI / 2;
      box(66, .06, -9, 8, .12, 180, '#8b826c');
      for (let dock = 0; dock < 5; dock++) box(81, .1, -65 + dock * 29, 30, .2, 5, '#817057');
    } else {
      for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
        const x = side * 21;
        const z = -48 + row * 37;
        const press = nauvoo && side > 0 && row === 1;
        const store = side < 0 && row === 1;
        house({x, z, width: 14, depth: 14, height: 3.8 + row % 2 * .7, color: nauvoo ? side < 0 ? '#b46e52' : '#c9ac70' : '#c5b692', name: press ? 'NAUVOO EXPOSITOR · 1844' : store ? environment === 'kirtland' ? 'N. K. WHITNEY & CO.' : 'PROVISIONS & PRINT' : 'HOUSEHOLD & GARDEN', use: press ? 'press' : store ? 'store' : 'home'});
        garden(x + side * 16, z - 3, 9);
      }
      if (chapter.id === '26') {
        house({name: 'NAUVOO HOUSEHOLD · 1843', width: 13, depth: 13, color: '#b47659'});
        objectivePoints = {center: [0, 0, 0], gather: [-2.2, 0, 1], study: [3, 0, -.1], prayer: [0, 0, -3.6], journey: [0, 0, 12], left: [-3.5, 0, 1.5], right: [3.5, 0, 1.5]};
        actorPositions = {JANE_MANNING: [-2.5, 0, .1], EMMA: [1.6, 0, 1.5], ELIZA: [3.5, 0, 1.5]};
      } else {
        table(3, -2, 2.8, 1.4);
        book(3, 1.14, -2);
        for (let seat = 0; seat < 4; seat++) bench(-5, 4 + seat * 2.4, Math.PI, 4);
      }
      if (environment === 'kirtland' && Number(chapter.id) >= 20 || nauvoo) temple(-55, -52);
      else {
        sign('KIRTLAND · A PEOPLE GATHERING', -46, 2.2, -40, 7);
        for (const side of [-1, 1]) for (let post = 0; post < 4; post++) solid(-52 + side * 6, 2, -54 + post * 4, .2, 4, .2, '#977954');
      }
      const river = mesh(new THREE.PlaneGeometry(nauvoo ? 25 : 7, 280), nauvoo ? '#78999b' : '#759f9f', 86, -.01, -10);
      river.rotation.x = -Math.PI / 2;
      curve([[8, 38], [40, 44], [73, 45]], 3, '#b9a57f');
      if (nauvoo) sign('RIVER LANDING', 68, 2, 44, 4);
    }
    spawn.set(urban ? -20 : 0, 0, urban ? -.5 : 8);
    const crowdCount = quality === 'low' ? 5 : urban ? 12 : 8;
    for (let index = 0; index < crowdCount; index++) extras.push({id: `CROWD_${index % 3 === 0 ? 'F' : 'M'}_${index}`, position: [(index % 2 ? -1 : 1) * (7 + index % 4 * 2.2), 0, 14 + Math.floor(index / 2) * 5.5], rotation: index * .8, height: 1.65 + index % 3 * .08});
  }

  function getGroundHeight(x, z, currentY = 0) {
    if (!loft) return 0;
    const localX = x - loft.x;
    const localZ = z - loft.z;
    if (Math.abs(localX) > loft.width / 2 || Math.abs(localZ) > loft.depth / 2) return 0;
    if (localX < -loft.width / 2 + 2.2 && localX > -loft.width / 2 + .2 && localZ < 4 && localZ > -3.2) return THREE.MathUtils.clamp((3.8 - localZ) / 6.3, 0, 1) * loft.y;
    return currentY > 2.5 ? loft.y : 0;
  }

  return {
    buildings, extras, objectivePoints, actorPositions,
    summary: {kind: urban ? 'historic-urban-neighborhood' : domestic ? 'inhabited-house-and-landscape' : 'regional-town', buildings: buildings.length, bounded: true, historicalGeometry: 'Source-informed interpretive layouts, not surveyed replicas.'},
    getGroundHeight,
    update(delta, elapsed, position, cameraPosition) {
      if (!position) return;
      for (const item of roofs) {
        const inside = Math.abs(position.x - item.shell.x) < item.shell.width / 2 + .2 && Math.abs(position.z - item.shell.z) < item.shell.depth / 2 + .2;
        item.roof.visible = item.lowerOnly ? !inside || position.y > 2 || cameraPosition?.y < 2.75 : !inside || cameraPosition?.y < item.shell.height - .2;
      }
    },
    dispose() { resources.forEach(({texture, surface}) => {texture.dispose(); surface.dispose();}); },
  };
}
