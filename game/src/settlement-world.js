import * as THREE from 'three';

export function buildConnectedSettlement(context) {
  const {chapter, group, box, cylinder, mesh, colliders, bounds, spawn, focus, tree, fence, curve, table, book, bench, temple, quality} = context;
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
    group.children.slice(start).forEach(object => assembly.add(object));
    assembly.position.set(x, 0, z);
    assembly.rotation.y = rotation;
    group.add(assembly);
  }

  function hearth(x, z) {
    solid(x, 1.25, z, 2.6, 2.5, .85, '#918474');
    box(x, .65, z + .46, 1.7, 1.28, .08, '#37362e');
    box(x, 1.43, z + .58, 2.8, .17, .3, '#6e5038');
    for (const side of [-1, 1]) cylinder(x + side * .42, .22, z + .58, .07, .07, .65, '#5b4434').rotation.z = Math.PI / 2;
    cylinder(x, .57, z + .63, .23, .2, .32, '#3a3f3b', 10);
  }

  function bed(x, z, upperY = 0) {
    box(x, upperY + .42, z, 1.55, .42, 2.3, '#74583f');
    box(x, upperY + .68, z, 1.5, .18, 2.2, '#dfd1b2');
    box(x, upperY + .79, z + .24, 1.49, .07, 1.65, '#6f8379');
    box(x, upperY + .84, z - .8, 1.1, .19, .4, '#f1e5cb');
    solid(x, upperY + .5, z, 1.55, 1, 2.3, '#74583f').visible = false;
  }

  function house({x = 0, z = 0, width = 13, depth = 13, height = 3.4, color = '#b9a17b', name = '', use = 'home', upper = false, logs = false}) {
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const wall = .26;
    const doorWidth = 2;
    const windowWidth = 1.5;
    const windowBottom = 1.15;
    const windowTop = 2.65;
    const shell = {x, z, width, depth, height, name, use};
    buildings.push(shell);
    box(x, -.1, z, width + .3, .2, depth + .3, '#927551');
    for (let plank = 0; plank < width / .38; plank++) box(x - halfWidth + plank * .38, .005, z, .015, .012, depth, '#766047');
    solid(x, height / 2, z - halfDepth, width, height, wall, color);
    const frontSegment = (width - doorWidth) / 2;
    for (const side of [-1, 1]) solid(x + side * (doorWidth / 2 + frontSegment / 2), height / 2, z + halfDepth, frontSegment, height, wall, color);
    box(x, (height + 2.5) / 2, z + halfDepth, doorWidth, height - 2.5, wall, color);
    for (const side of [-1, 1]) {
      const segmentDepth = (depth - windowWidth) / 2;
      for (const end of [-1, 1]) solid(x + side * halfWidth, height / 2, z + end * (windowWidth / 2 + segmentDepth / 2), wall, height, segmentDepth, color);
      solid(x + side * halfWidth, windowBottom / 2, z, wall, windowBottom, windowWidth, color);
      box(x + side * halfWidth, (height + windowTop) / 2, z, wall, height - windowTop, windowWidth, color);
      for (const edge of [-1, 1]) box(x + side * halfWidth, 1.9, z + edge * .76, .35, 1.7, .07, '#ddd1b2');
      box(x + side * halfWidth, 1.9, z, .1, 1.5, .055, '#d8ceb3');
      box(x + side * halfWidth, 1.9, z, .1, .06, windowWidth, '#d8ceb3');
    }
    for (const side of [-1, 1]) box(x + side * 1.06, 1.42, z + halfDepth + .05, .16, 2.84, .35, '#e1cfac');
    const door = box(x + 1.1, 1.37, z + halfDepth + .92, .12, 2.7, 1.8, '#6e5137');
    door.name = 'open-door';
    box(x, 2.86, z + halfDepth + .07, 2.35, .18, .4, '#e1cfac');
    for (let course = 0; course < height / (logs ? .28 : .45); course++) {
      const lineY = .1 + course * (logs ? .28 : .45);
      box(x, lineY, z - halfDepth - .14, width, logs ? .09 : .025, .05, logs ? '#806444' : '#927959');
      for (const side of [-1, 1]) box(x + side * (halfWidth + .14), lineY, z - depth * .27, .05, logs ? .09 : .025, depth * .42, '#8e7250');
    }
    const roof = new THREE.Group();
    roof.name = `cutaway-roof:${name || use}`;
    const roofStart = group.children.length;
    const roofPitch = .48;
    const roofRise = Math.tan(roofPitch) * halfWidth;
    for (const side of [-1, 1]) {
      const panel = box(x + side * width * .25, height + roofRise / 2, z, halfWidth / Math.cos(roofPitch) + .65, .16, depth + 1, '#5a5c50');
      panel.rotation.z = -side * roofPitch;
      const gable = new THREE.BufferGeometry();
      gable.setAttribute('position', new THREE.Float32BufferAttribute([-halfWidth, 0, 0, halfWidth, 0, 0, 0, roofRise, 0], 3));
      gable.computeVertexNormals();
      mesh(gable, color, x, height, z + side * halfDepth, {side: THREE.DoubleSide});
    }
    box(x, height - .04, z, width, .08, depth, '#b3a080');
    box(x + halfWidth - 1.5, height + 1.15, z - halfDepth + 1.3, .85, 2.2, .85, '#88715b');
    group.children.slice(roofStart).forEach(object => roof.add(object));
    group.add(roof);
    roofs.push({roof, shell});
    for (const beamX of [-halfWidth + .4, halfWidth - .4]) box(x + beamX, height - .13, z, .17, .23, depth, '#68513a');
    if (name) sign(name, x, 2.45, z + halfDepth + .24, Math.min(width - 2, 4.4));
    if (use === 'press') {
      table(x + 2.8, z - 2.2, 2.9, 1.6);
      book(x + 2.8, 1.14, z - 2.2);
      for (const side of [-1, 1]) solid(x - 3 + side * .68, 1.4, z - 2.5, .21, 2.8, .24, '#4d4a3d');
      box(x - 3, 2.7, z - 2.5, 1.8, .28, .42, '#4d4a3d');
      cylinder(x - 3, 1.95, z - 2.5, .1, .1, 1.45, '#595644', 8);
      box(x - 3, 1.26, z - 2.1, 1.65, .16, 1.8, '#7d6549');
      box(x - 3, 1.37, z - 1.9, 1.35, .04, 1.2, '#eee0b9');
      for (let stack = 0; stack < 5; stack++) box(x + 3, .3 + stack * .075, z + 2.5, 1.2, .06, .85, '#ded3b4');
    } else if (use === 'barber') {
      for (const seatX of [-2.5, 2.5]) {
        chair(x + seatX, z - 1.8, Math.PI);
        box(x + seatX, 1.9, z - halfDepth + .23, 1.5, 2.1, .14, '#715c3f');
        box(x + seatX, 1.9, z - halfDepth + .33, 1.28, 1.87, .04, '#a7b9b2');
      }
      table(x + 3, z + 2, 2, 1);
      cylinder(x + 3, 1.16, z + 2, .18, .23, .16, '#e9dcc0', 16);
      book(x + 2.4, 1.12, z + 2);
    } else if (use === 'store') {
      for (const side of [-1, 1]) {
        for (const shelfY of [.4, 1.2, 2]) {
          box(x + side * (halfWidth - .65), shelfY, z - 1, .8, .13, depth - 3, '#7c6344');
          for (let item = 0; item < 7; item++) cylinder(x + side * (halfWidth - .65), shelfY + .23, z - halfDepth + 1.4 + item * 1.1, .13, .18, .38, item % 2 ? '#b4a47c' : '#7f8e7b', 8);
        }
      }
      table(x + 2.3, z - 1, 2.6, 1.3);
      book(x + 2.3, 1.14, z - 1);
    } else {
      hearth(x, z - halfDepth + .6);
      table(x + 3, z - 1.8, 2.8, 1.3);
      book(x + 3, 1.14, z - 1.8);
      chair(x + 3, z - 3.2);
      chair(x + 3, z - .4, Math.PI);
      bed(x - 3.7, z - 3.3, upper ? 2.95 : 0);
      box(x + halfWidth - .6, 1.25, z - halfDepth + 1.5, .7, 2.5, 1.8, '#80634b');
      if (upper) {
        loft = {x, z, width, depth, y: 2.95};
        const upperStart = group.children.length;
        box(x + .95, 2.85, z, width - 2.5, .2, depth, '#8f7351');
        box(x - halfWidth + 1.25, 2.85, z - 4.5, 2.5, .2, 4, '#8f7351');
        const ceiling = new THREE.Group();
        ceiling.name = 'sleeping-loft-floor';
        group.children.slice(upperStart).forEach(object => ceiling.add(object));
        group.add(ceiling);
        roofs.push({roof: ceiling, shell, lowerOnly: true});
        for (let step = 0; step < 16; step++) box(x - halfWidth + 1.2, step * 2.95 / 16 + .08, z + 3.8 - step * .42, 1.8, .15, .46, '#9e815a');
      }
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
        for (let window = 0; window < 3; window++) box(x - 3.5 + window * 3.5, 4.3, z + 8.15, 1.3, 1.6, .08, '#9aada6');
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
