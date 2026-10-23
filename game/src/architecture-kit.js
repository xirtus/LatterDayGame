import * as THREE from 'three';

// Shared building language for every world: painted surface textures sized in metres,
// openings cut into walls, shingled roofs, stone chimneys with smoke, and working hearths.
// Textures are drawn once per page on canvas; in Node (tests) surfaces fall back to flat colour.

const TEXTURES = new Map();
const UP = new THREE.Vector3(0, 1, 0);
const canDraw = typeof document !== 'undefined' && typeof document.createElement === 'function';

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shade(drawing, value, alpha = 1) {
  const level = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
  drawing.fillStyle = `rgba(${level},${level},${level},${alpha})`;
}

function speckle(drawing, size, random, amount, spread = .12) {
  for (let index = 0; index < amount; index++) {
    shade(drawing, .5 + (random() - .5) * 2 * spread, .08 + random() * .1);
    const radius = .5 + random() * 2.2;
    drawing.fillRect(random() * size, random() * size, radius, radius);
  }
}

function grain(drawing, x, y, width, height, random, vertical = false, lines = 6) {
  drawing.save();
  drawing.beginPath();
  drawing.rect(x, y, width, height);
  drawing.clip();
  for (let line = 0; line < lines; line++) {
    shade(drawing, .55 + random() * .2, .12 + random() * .1);
    drawing.lineWidth = .6 + random() * 1.1;
    drawing.beginPath();
    const offset = (vertical ? x + random() * width : y + random() * height);
    const wobble = 1 + random() * 3;
    for (let step = 0; step <= 16; step++) {
      const along = (vertical ? y + step / 16 * height : x + step / 16 * width);
      const across = offset + Math.sin(step * .7 + line) * wobble;
      if (vertical) step ? drawing.lineTo(across, along) : drawing.moveTo(across, along);
      else step ? drawing.lineTo(along, across) : drawing.moveTo(along, across);
    }
    drawing.stroke();
  }
  drawing.restore();
}

// Each painter draws a tileable greyscale-to-warm pattern; the material colour tints it.
const PAINTERS = {
  clapboard: {tile: [2, 2], draw(drawing, size, random) {
    const boards = 9;
    const step = size / boards;
    for (let board = 0; board < boards; board++) {
      const y = board * step;
      const gradient = drawing.createLinearGradient(0, y, 0, y + step);
      const base = .86 + random() * .08;
      gradient.addColorStop(0, `rgb(${base * 205 | 0},${base * 205 | 0},${base * 205 | 0})`);
      gradient.addColorStop(.82, `rgb(${base * 250 | 0},${base * 250 | 0},${base * 250 | 0})`);
      gradient.addColorStop(1, `rgb(${base * 160 | 0},${base * 160 | 0},${base * 160 | 0})`);
      drawing.fillStyle = gradient;
      drawing.fillRect(0, y, size, step);
      grain(drawing, 0, y, size, step, random, false, 3);
      shade(drawing, .38, .55);
      drawing.fillRect(0, y + step - 2.5, size, 2.5);
      const joint = random() * size;
      shade(drawing, .5, .45);
      drawing.fillRect(joint, y, 2, step);
    }
  }},
  logs: {tile: [2.4, 1.12], draw(drawing, size, random) {
    const logs = 4;
    const step = size / logs;
    shade(drawing, .82);
    drawing.fillRect(0, 0, size, size);
    for (let log = 0; log < logs; log++) {
      const y = log * step;
      const gradient = drawing.createLinearGradient(0, y + step * .1, 0, y + step * .9);
      gradient.addColorStop(0, '#6f6f6f');
      gradient.addColorStop(.35, '#e8e8e8');
      gradient.addColorStop(.7, '#bdbdbd');
      gradient.addColorStop(1, '#4a4a4a');
      drawing.fillStyle = gradient;
      drawing.beginPath();
      drawing.roundRect(-4, y + step * .09, size + 8, step * .82, step * .4);
      drawing.fill();
      grain(drawing, 0, y + step * .12, size, step * .76, random, false, 7);
      for (let knot = 0; knot < 2; knot++) {
        shade(drawing, .35, .45);
        drawing.beginPath();
        drawing.ellipse(random() * size, y + step * (.35 + random() * .3), 3 + random() * 4, 2 + random() * 2, 0, 0, Math.PI * 2);
        drawing.fill();
      }
    }
  }},
  brick: {tile: [1.2, 1.2], draw(drawing, size, random) {
    shade(drawing, .78);
    drawing.fillRect(0, 0, size, size);
    const rows = 16;
    const columns = 6;
    const height = size / rows;
    const width = size / columns;
    for (let row = 0; row < rows; row++) {
      for (let column = -1; column < columns + 1; column++) {
        const x = column * width + (row % 2) * width / 2;
        const tone = .62 + random() * .3;
        shade(drawing, tone);
        drawing.fillRect(x + 1.5, row * height + 1.5, width - 3, height - 3);
        shade(drawing, tone + .12, .35);
        drawing.fillRect(x + 1.5, row * height + 1.5, width - 3, 1.5);
        shade(drawing, tone - .2, .4);
        drawing.fillRect(x + 1.5, row * height + height - 3, width - 3, 1.5);
      }
    }
    speckle(drawing, size, random, 900, .25);
  }},
  fieldstone: {tile: [1.5, 1.5], draw(drawing, size, random) {
    shade(drawing, .72);
    drawing.fillRect(0, 0, size, size);
    speckle(drawing, size, random, 600, .2);
    const rows = 7;
    const rowHeight = size / rows;
    for (let row = 0; row < rows; row++) {
      let x = -random() * 30;
      while (x < size + 20) {
        const width = rowHeight * (.9 + random() * 1.3);
        const height = rowHeight * (.72 + random() * .22);
        const cx = x + width / 2;
        const cy = row * rowHeight + rowHeight / 2 + (random() - .5) * rowHeight * .14;
        const tone = .62 + random() * .26;
        for (const wrap of [0, -size, size]) {
          const gradient = drawing.createRadialGradient(cx + wrap - width * .15, cy - height * .2, 2, cx + wrap, cy, width * .6);
          gradient.addColorStop(0, `rgb(${Math.min(1, tone + .1) * 255 | 0},${Math.min(1, tone + .09) * 255 | 0},${Math.min(1, tone + .08) * 255 | 0})`);
          gradient.addColorStop(1, `rgb(${(tone - .1) * 255 | 0},${(tone - .11) * 255 | 0},${(tone - .12) * 255 | 0})`);
          drawing.fillStyle = gradient;
          drawing.beginPath();
          drawing.ellipse(cx + wrap, cy, width / 2 - 2, height / 2 - 1.5, (random() - .5) * .25, 0, Math.PI * 2);
          drawing.fill();
        }
        x += width + 2 + random() * 3;
      }
    }
  }},
  ashlar: {tile: [2.4, 2.4], draw(drawing, size, random) {
    shade(drawing, .7);
    drawing.fillRect(0, 0, size, size);
    const courses = 6;
    const height = size / courses;
    for (let course = 0; course < courses; course++) {
      let x = course % 2 ? -height * .8 : 0;
      while (x < size) {
        const width = height * (1.4 + random() * 1.4);
        const tone = .74 + random() * .18;
        const right = Math.min(x + width, size + height * 3);
        shade(drawing, tone);
        drawing.fillRect(x + 1.5, course * height + 1.5, right - x - 3, height - 3);
        shade(drawing, tone + .1, .5);
        drawing.fillRect(x + 1.5, course * height + 1.5, right - x - 3, 2);
        shade(drawing, tone - .22, .5);
        drawing.fillRect(x + 1.5, course * height + height - 3.5, right - x - 3, 2);
        x = right;
      }
    }
    speckle(drawing, size, random, 1400, .18);
  }},
  shingles: {tile: [1.4, 1.4], draw(drawing, size, random) {
    shade(drawing, .3);
    drawing.fillRect(0, 0, size, size);
    const rows = 7;
    const height = size / rows;
    for (let row = 0; row < rows; row++) {
      let x = row % 2 ? -height * .45 : 0;
      while (x < size) {
        const width = height * (.55 + random() * .65);
        const tone = .62 + random() * .3;
        const gradient = drawing.createLinearGradient(0, row * height, 0, row * height + height);
        gradient.addColorStop(0, `rgb(${tone * 150 | 0},${tone * 150 | 0},${tone * 150 | 0})`);
        gradient.addColorStop(.88, `rgb(${tone * 245 | 0},${tone * 245 | 0},${tone * 245 | 0})`);
        gradient.addColorStop(1, `rgb(${tone * 120 | 0},${tone * 120 | 0},${tone * 120 | 0})`);
        drawing.fillStyle = gradient;
        drawing.fillRect(x + 1.2, row * height, width - 2.4, height - 1);
        grain(drawing, x + 1.2, row * height, width - 2.4, height - 1, random, true, 2);
        x += width;
      }
    }
  }},
  planks: {tile: [2, 2], draw(drawing, size, random) {
    const boards = 10;
    const width = size / boards;
    for (let board = 0; board < boards; board++) {
      const x = board * width;
      let y = -random() * size;
      while (y < size) {
        const length = size * (.7 + random() * .9);
        const tone = .82 + random() * .12;
        shade(drawing, tone);
        drawing.fillRect(x, y, width, length);
        grain(drawing, x, y, width, length, random, true, 4);
        shade(drawing, .3, .7);
        drawing.fillRect(x, y, width, 1.6);
        for (const nail of [.25, .75]) {
          shade(drawing, .25, .6);
          drawing.fillRect(x + width * nail - 1, y + 5, 2, 2);
        }
        y += length;
      }
      shade(drawing, .28, .8);
      drawing.fillRect(x, 0, 2, size);
    }
  }},
  plaster: {tile: [3, 3], draw(drawing, size, random) {
    shade(drawing, .92);
    drawing.fillRect(0, 0, size, size);
    for (let blot = 0; blot < 90; blot++) {
      const radius = 10 + random() * 50;
      const x = random() * size;
      const y = random() * size;
      const gradient = drawing.createRadialGradient(x, y, 0, x, y, radius);
      const tone = random() > .5 ? 255 : 170;
      gradient.addColorStop(0, `rgba(${tone},${tone},${tone - 10},.12)`);
      gradient.addColorStop(1, `rgba(${tone},${tone},${tone},0)`);
      drawing.fillStyle = gradient;
      drawing.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    speckle(drawing, size, random, 500, .1);
  }},
  panel: {tile: [1.2, .9], draw(drawing, size, random) {
    shade(drawing, .82);
    drawing.fillRect(0, 0, size, size);
    grain(drawing, 0, 0, size, size, random, true, 10);
    const inset = size * .14;
    shade(drawing, .58, .75);
    drawing.fillRect(inset, inset, size - inset * 2, 3);
    drawing.fillRect(inset, inset, 3, size - inset * 2);
    shade(drawing, 1, .55);
    drawing.fillRect(inset, size - inset, size - inset * 2, 3);
    drawing.fillRect(size - inset, inset, 3, size - inset * 2);
  }},
  quilt: {tile: [1.5, 1.5], draw(drawing, size) {
    const cells = 6;
    const step = size / cells;
    const colors = ['#c97b63', '#e9dcc0', '#6f8c91', '#e2c58a', '#86704f', '#f2ead6'];
    for (let row = 0; row < cells; row++) for (let column = 0; column < cells; column++) {
      drawing.fillStyle = colors[(row * 2 + column * 3 + (row * column) % 3) % colors.length];
      drawing.fillRect(column * step, row * step, step, step);
      drawing.strokeStyle = 'rgba(70,50,40,.35)';
      drawing.setLineDash([3, 3]);
      drawing.strokeRect(column * step + 3, row * step + 3, step - 6, step - 6);
    }
  }},
  rug: {tile: [2.4, 1.7], draw(drawing, size) {
    const colors = ['#8f5a46', '#c9b48b', '#5f6f6a', '#b98a5b', '#7a4d40', '#d8c8a0'];
    const center = size / 2;
    drawing.fillStyle = '#6f5a44';
    drawing.fillRect(0, 0, size, size);
    for (let ring = 14; ring > 0; ring--) {
      drawing.fillStyle = colors[ring % colors.length];
      drawing.beginPath();
      drawing.ellipse(center, center, ring / 14 * center * .98, ring / 14 * center * .96, 0, 0, Math.PI * 2);
      drawing.fill();
      drawing.strokeStyle = 'rgba(40,30,25,.25)';
      drawing.lineWidth = 2;
      drawing.stroke();
    }
  }},
};

function texture(kind) {
  if (!canDraw || !PAINTERS[kind]) return null;
  if (TEXTURES.has(kind)) return TEXTURES.get(kind);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const drawing = canvas.getContext('2d');
  if (!drawing) return null;
  PAINTERS[kind].draw(drawing, size, seeded(kind.length * 7919 + kind.charCodeAt(0) * 31));
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  TEXTURES.set(kind, map);
  return map;
}

// BoxGeometry face order: +x, -x, +y, -y, +z, -z, four vertices each.
function metricBox(width, height, depth, tile, swap = false) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uv = geometry.attributes.uv;
  const spans = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
  for (let face = 0; face < 6; face++) {
    const [u, v] = spans[face];
    for (let corner = 0; corner < 4; corner++) {
      const index = face * 4 + corner;
      const a = uv.getX(index) * u / tile[0];
      const b = uv.getY(index) * v / tile[1];
      uv.setXY(index, swap ? b : a, swap ? a : b);
    }
  }
  return geometry;
}

export function createArchitectureKit(context) {
  const {group, mesh, box, cylinder, sphere, colliders, quality = 'high'} = context;
  const low = quality === 'low';
  const surfaces = new Map();
  const owned = [];
  const fires = [];
  const smokeSources = [];
  const sparkSources = [];
  const candles = [];
  let smoke = null;
  let sparks = null;

  function surface(kind, color = '#ffffff', options = {}) {
    const key = `${kind}:${color}:${JSON.stringify(options)}`;
    if (!surfaces.has(key)) {
      const map = texture(kind);
      const made = new THREE.MeshToonMaterial({color, map, ...options});
      made.userData.mergeable = true;
      made.userData.tile = PAINTERS[kind]?.tile ?? [1, 1];
      made.userData.surface = kind;
      surfaces.set(key, made);
      owned.push(made);
    }
    return surfaces.get(key);
  }

  function slab(x, y, z, width, height, depth, finish, swap = false) {
    if (typeof finish === 'string') return box(x, y, z, width, height, depth, finish);
    const object = mesh(metricBox(width, height, depth, finish.userData.tile ?? [1, 1], swap), finish, x, y, z);
    return object;
  }

  function solidSlab(x, y, z, width, height, depth, finish) {
    const object = slab(x, y, z, width, height, depth, finish);
    colliders.push({x, z, width, depth, minY: y - height / 2, maxY: y + height / 2});
    return object;
  }

  // Lays a wall along x (fixed z) or z (fixed x) and cuts rectangular openings.
  function wallRun({axis, fixed, start, end, bottom = 0, height, openings = [], finish, thickness = .26, collide = true}) {
    const ordered = [...openings].sort((first, second) => first.center - second.center);
    let cursor = start;
    const make = collide ? solidSlab : slab;
    const piece = (from, to, base, rise, solid = true) => {
      if (to - from < .015 || rise < .015) return;
      if (!finish) {
        if (solid) colliders.push(axis === 'x' ? {x: (from + to) / 2, z: fixed, width: to - from, depth: thickness, minY: base, maxY: base + rise} : {x: fixed, z: (from + to) / 2, width: thickness, depth: to - from, minY: base, maxY: base + rise});
        return;
      }
      const builder = solid ? make : slab;
      if (axis === 'x') builder((from + to) / 2, base + rise / 2, fixed, to - from, rise, thickness, finish);
      else builder(fixed, base + rise / 2, (from + to) / 2, thickness, rise, to - from, finish);
    };
    // Openings sharing a column (a window above a door or window) are cut from one bay.
    const columns = [];
    for (const opening of ordered) {
      if (opening.bottom >= height) continue;
      const column = columns.find(item => Math.abs(item.center - opening.center) < .01);
      if (column) { column.items.push(opening); column.width = Math.max(column.width, opening.width); } else columns.push({center: opening.center, width: opening.width, items: [opening]});
    }
    for (const column of columns) {
      const left = column.center - column.width / 2;
      const right = column.center + column.width / 2;
      piece(cursor, left, bottom, height);
      let floor = 0;
      column.items.sort((first, second) => first.bottom - second.bottom).forEach((opening, index) => {
        piece(left, right, bottom + floor, opening.bottom - floor, index === 0);
        floor = Math.min(height, opening.bottom + opening.height);
      });
      piece(left, right, bottom + floor, height - floor, false);
      cursor = right;
    }
    piece(cursor, end, bottom, height);
  }

  function gable(x, y, z, halfWidth, rise, finish, faceSign = 1, inset = 0) {
    const tile = finish.userData?.tile ?? [1, 1];
    const geometry = new THREE.BufferGeometry();
    const positions = [-halfWidth, 0, 0, halfWidth, 0, 0, 0, rise, 0];
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(faceSign > 0 ? positions : [halfWidth, 0, 0, -halfWidth, 0, 0, 0, rise, 0], 3));
    const uvs = [];
    for (let index = 0; index < 9; index += 3) uvs.push((geometry.attributes.position.array[index] + halfWidth) / tile[0], geometry.attributes.position.array[index + 1] / tile[1]);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return mesh(geometry, finish, x, y, z + inset);
  }

  // A six-over-six sash window with frame, sill, glass, optional shutters and curtains.
  function sashWindow({axis, x, y, z, width = 1.1, height = 1.5, outward = 1, frame = '#e7dcc0', shutters = null, curtains = '#e9dfc7', glow = true}) {
    const along = (offset, up, out, w, h, d, color) => axis === 'x'
      ? box(x + offset, y + up, z + out * outward, w, h, d, color)
      : box(x + out * outward, y + up, z + offset, d, h, w, color);
    const glass = glassMaterial(glow);
    const pane = axis === 'x'
      ? mesh(new THREE.BoxGeometry(width, height, .03), glass, x, y, z)
      : mesh(new THREE.BoxGeometry(.03, height, width), glass, x, y, z);
    pane.castShadow = false;
    for (const side of [-1, 1]) along(side * (width / 2 + .05), 0, .13, .1, height + .2, .08, frame);
    along(0, height / 2 + .06, .13, width + .3, .12, .08, frame);
    along(0, height / 2 + .16, .16, width + .45, .1, .16, frame);
    along(0, -height / 2 - .05, .16, width + .35, .08, .3, frame);
    along(0, -height / 2 - .05, -.16, width + .2, .06, .22, frame);
    along(0, 0, .02, width, .05, .05, frame);
    for (const column of [-1, 1]) along(column * width / 6, 0, .02, .035, height, .045, frame);
    for (const row of [-1, 1]) along(0, row * height / 4, .02, width, .03, .045, frame);
    if (shutters) for (const side of [-1, 1]) {
      along(side * (width * .78 + .1), 0, .2, width * .5, height + .1, .05, shutters);
      for (let slat = 0; slat < 7; slat++) along(side * (width * .78 + .1), -height / 2 + .15 + slat * (height - .3) / 6, .23, width * .44, .025, .03, shadeColor(shutters, -.08));
    }
    if (curtains) for (const side of [-1, 1]) along(side * (width / 2 - .1), .05, -.2, .26, height + .1, .05, curtains);
    return pane;
  }

  const glassMaterials = {};
  function glassMaterial(glow) {
    const key = glow ? 'glow' : 'plain';
    if (!glassMaterials[key]) {
      glassMaterials[key] = new THREE.MeshToonMaterial({color: glow ? '#8fa6a8' : '#9fb1b2', emissive: glow ? '#4a3416' : '#000000', emissiveIntensity: glow ? .55 : 0, transparent: true, opacity: .62, depthWrite: false});
      glassMaterials[key].userData.mergeable = true;
      owned.push(glassMaterials[key]);
    }
    return glassMaterials[key];
  }

  function panelDoor(x, y, z, width, height, color, axis = 'x', open = 0) {
    const assembly = new THREE.Group();
    assembly.userData.mergeStatic = true;
    const start = group.children.length;
    box(0, 0, 0, width, height, .08, color);
    for (const row of [-.27, .2]) for (const column of [-1, 1]) {
      box(column * width * .22, row * height, .05, width * .34, height * (row < 0 ? .36 : .4), .025, shadeColor(color, -.12));
      box(column * width * .22, row * height, .065, width * .26, height * (row < 0 ? .3 : .34), .02, shadeColor(color, .06));
    }
    box(width * .38, -.05, .09, .05, .05, .08, '#3a3530');
    for (const hinge of [-.35, .35]) box(-width / 2 + .1, hinge * height, .05, .18, .05, .02, '#2d2a27');
    group.children.slice(start).forEach(object => assembly.add(object));
    assembly.position.set(x, y, z);
    assembly.rotation.y = (axis === 'x' ? 0 : Math.PI / 2) + open;
    group.add(assembly);
    return assembly;
  }

  // A gable roof whose ridge runs along z. Returns the objects so callers can group them.
  // rotate: true turns the finished roof a quarter turn so the ridge runs along x instead.
  function gableRoof({x, z, width, depth, height, pitch = .55, finish, trim = '#4b4038', overhang = .55, gableOverhang = .4, wallFinish, thickness = .2, ridge = true, rotate = false}) {
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const rise = Math.tan(pitch) * (halfWidth + overhang);
    const slope = (halfWidth + overhang) / Math.cos(pitch);
    const start = group.children.length;
    for (const side of [-1, 1]) {
      const panel = slab(x + side * (halfWidth + overhang) / 2, height + rise / 2 - Math.tan(pitch) * overhang + thickness * .5, z, slope + .08, thickness, depth + gableOverhang * 2, finish);
      panel.rotation.z = -side * pitch;
      const fascia = box(x + side * (halfWidth + overhang - .04), height - Math.tan(pitch) * overhang + .02, z, .07, .26, depth + gableOverhang * 2 + .04, trim);
      fascia.rotation.z = -side * pitch;
      for (const end of [-1, 1]) {
        const barge = box(x + side * (halfWidth + overhang) / 2, height + rise / 2 - Math.tan(pitch) * overhang + .06, z + end * (halfDepth + gableOverhang), slope + .12, .3, .07, trim);
        barge.rotation.z = -side * pitch;
      }
      // Eave soffit and a gutter line give the edge its weight.
      box(x + side * (halfWidth + overhang / 2), height - Math.tan(pitch) * overhang - .02, z, overhang, .05, depth + gableOverhang * 2, trim);
    }
    if (ridge) {
      const cap = box(x, height + rise - Math.tan(pitch) * overhang + thickness * .78, z, .3, .3, depth + gableOverhang * 2 + .1, shadeColor(trim, -.05));
      cap.rotation.z = Math.PI / 4;
    }
    if (wallFinish) for (const end of [-1, 1]) {
      gable(x, height, z + end * halfDepth, halfWidth, Math.tan(pitch) * halfWidth, wallFinish, end, end * .002);
      gable(x, height, z + end * (halfDepth - .14), halfWidth - .05, Math.tan(pitch) * halfWidth - .05, wallFinish, -end);
    }
    const objects = group.children.slice(start);
    if (rotate) for (const object of objects) {
      const dx = object.position.x - x;
      const dz = object.position.z - z;
      object.position.x = x + dz;
      object.position.z = z - dx;
      object.rotateOnWorldAxis(UP, Math.PI / 2);
    }
    return {objects, rise: Math.tan(pitch) * halfWidth};
  }

  // Exterior gable-end chimney of laid stone with weathered shoulders and a corbelled cap.
  function stoneChimney({x, z, top, outward = -1, finish, base = 2.3, stack = 1.25, axis = 'z'}) {
    const depth = .95;
    const shoulder = top * .45;
    const place = (offset, y, width, height, deep) => axis === 'z'
      ? solidSlab(x, y, z + outward * offset, width, height, deep, finish)
      : solidSlab(x + outward * offset, y, z, deep, height, width, finish);
    place(depth / 2, shoulder / 2, base, shoulder, depth);
    if (axis === 'z') slab(x, shoulder + .3, z + outward * depth * .45, (base + stack) / 2, .7, depth * .9, finish);
    else slab(x + outward * depth * .45, shoulder + .3, z, depth * .9, .7, (base + stack) / 2, finish);
    place(depth * .45, shoulder + (top - shoulder) / 2 + .3, stack, top - shoulder, depth * .78);
    const capY = top + .35;
    if (axis === 'z') {
      box(x, capY, z + outward * depth * .45, stack + .22, .14, depth * .78 + .22, '#6f675c');
      box(x, capY + .14, z + outward * depth * .45, stack + .08, .12, depth * .78 + .08, '#7b7366');
    } else {
      box(x + outward * depth * .45, capY, z, depth * .78 + .22, .14, stack + .22, '#6f675c');
      box(x + outward * depth * .45, capY + .14, z, depth * .78 + .08, .12, stack + .08, '#7b7366');
    }
    const flue = axis === 'z' ? [x, capY + .3, z + outward * depth * .45] : [x + outward * depth * .45, capY + .3, z];
    cylinder(flue[0], flue[1], flue[2], .17, .2, .34, '#8c5b44', 10);
    smokeSources.push({position: new THREE.Vector3(flue[0], flue[1] + .2, flue[2]), rate: 1});
    return flue;
  }

  // A working fireplace set into a wall facing +z (or rotated by facing).
  function fireplace({x, z, floor = 0, ceiling = 3.3, finish, hearthFinish, facing = 1, mantel = '#5e4532', lit = true, crane = true}) {
    const width = 2.7;
    const depth = .8;
    const opening = 1.36;
    const openingHeight = 1.18;
    const jamb = (width - opening) / 2;
    const front = z + facing * depth / 2;
    // The breast is built as a back block, two jambs and an upper mass so the firebox is a real recess.
    const recess = .5;
    const backDepth = depth - recess;
    slab(x, floor + ceiling / 2, z - facing * (depth / 2 - backDepth / 2), width, ceiling, backDepth, finish);
    for (const side of [-1, 1]) slab(x + side * (opening / 2 + jamb / 2), floor + openingHeight / 2, front - facing * recess / 2, jamb, openingHeight, recess, finish);
    slab(x, floor + openingHeight + (ceiling - openingHeight) / 2, front - facing * recess / 2, width, ceiling - openingHeight, recess, finish);
    colliders.push({x, z, width, depth: depth + .2, minY: floor, maxY: floor + ceiling});
    box(x, floor + openingHeight / 2, front - facing * (recess - .03), opening, openingHeight, .04, '#1b1715');
    box(x, floor + openingHeight - .04, front - facing * recess / 2, opening, .06, recess, '#211c19');
    for (const side of [-1, 1]) {
      const cheek = box(x + side * (opening / 2 - .06), floor + openingHeight / 2, front - facing * recess / 2, .1, openingHeight, recess - .04, '#3b3430');
      cheek.rotation.y = side * facing * .25;
    }
    slab(x, floor + openingHeight + .14, front + facing * .05, opening + .5, .3, .14, hearthFinish ?? finish);
    box(x, floor + openingHeight + .14, front + facing * .13, .34, .3, .04, '#9b9082');
    // Mantel shelf on corbels.
    box(x, floor + openingHeight + .48, front + facing * .14, width + .25, .12, .36, mantel);
    for (const side of [-1, 1]) box(x + side * (width / 2 - .12), floor + openingHeight + .32, front + facing * .1, .14, .22, .2, mantel);
    // Hearthstone apron.
    slab(x, floor + .05, front + facing * .55, width + .6, .1, 1.1, hearthFinish ?? finish);
    // Mantel garnish: candlesticks, a shelf clock, and a crock.
    const shelfY = floor + openingHeight + .54;
    const shelfZ = front + facing * .14;
    for (const side of [-1, 1]) {
      cylinder(x + side * .95, shelfY + .02, shelfZ, .07, .08, .03, '#b08a4a', 10);
      cylinder(x + side * .95, shelfY + .12, shelfZ, .025, .03, .18, '#b08a4a', 8);
      cylinder(x + side * .95, shelfY + .29, shelfZ, .022, .022, .16, '#f1e7cf', 8);
      candles.push(flame(x + side * .95, shelfY + .41, shelfZ, .5));
    }
    box(x, shelfY + .22, shelfZ, .34, .44, .18, '#5a3e2b');
    const dial = cylinder(x, shelfY + .3, shelfZ + facing * .092, .11, .11, .02, '#efe6cf', 18);
    dial.rotation.x = Math.PI / 2;
    box(x, shelfY + .46, shelfZ, .4, .06, .2, '#4a3324');
    cylinder(x + .45, shelfY + .14, shelfZ, .09, .11, .28, '#8a6a4d', 10);
    cylinder(x - .45, shelfY + .1, shelfZ, .1, .07, .2, '#6f8180', 10);
    // Firedogs, logs, and a crane with its kettle.
    for (const side of [-1, 1]) {
      box(x + side * .38, floor + .12, front - facing * .25, .06, .2, .5, '#262321');
      box(x + side * .38, floor + .28, front - facing * .02, .06, .14, .06, '#262321');
    }
    const logs = [];
    for (let log = 0; log < 3; log++) {
      const wood = cylinder(x - .05 + (log - 1) * .08, floor + .2 + (log === 1 ? .12 : 0), front - facing * (.22 + log * .05), .07, .085, .95, '#4f3a2a', 7);
      wood.rotation.z = Math.PI / 2 + (log - 1) * .12;
      wood.rotation.y = (log - 1) * .18;
      logs.push(wood);
    }
    box(x, floor + .02, front - facing * .25, opening - .2, .04, recess - .1, '#3e2b20');
    if (crane) {
      cylinder(x - opening / 2 + .1, floor + .78, front - facing * .2, .02, .02, .9, '#1f1d1b', 6);
      box(x - opening / 2 + .4, floor + 1.06, front - facing * .2, .62, .035, .035, '#1f1d1b');
      cylinder(x - .2, floor + .86, front - facing * .2, .006, .006, .4, '#1f1d1b', 4);
      cylinder(x - .2, floor + .58, front - facing * .2, .17, .14, .2, '#232221', 12);
      cylinder(x - .2, floor + .7, front - facing * .2, .12, .16, .04, '#232221', 12);
    }
    // Tools leaning beside the hearth.
    const poker = cylinder(x + width / 2 + .18, floor + .45, front + facing * .1, .012, .012, .9, '#232221', 5);
    poker.rotation.z = -.12;
    const broom = cylinder(x - width / 2 - .2, floor + .62, front + facing * .1, .018, .018, 1.25, '#8a6a46', 6);
    broom.rotation.z = .1;
    cylinder(x - width / 2 - .25, floor + .14, front + facing * .1, .07, .13, .3, '#c7a764', 8);
    for (let stick = 0; stick < 5; stick++) {
      const kindling = cylinder(x + width / 2 + .45, floor + .1 + (stick % 2) * .09, front + facing * (.35 + stick * .08), .03, .035, .55, '#6e5034', 5);
      kindling.rotation.x = Math.PI / 2;
    }
    if (lit) {
      fires.push(fire(x, floor + .2, front - facing * .22, 1));
      sparkSources.push({position: new THREE.Vector3(x, floor + .45, front - facing * .2), spread: .35});
    }
    return {front, shelfY};
  }

  const flameMaterials = {};
  function flameMaterial(color, opacity) {
    const key = `${color}:${opacity}`;
    if (!flameMaterials[key]) {
      flameMaterials[key] = new THREE.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false});
      owned.push(flameMaterials[key]);
    }
    return flameMaterials[key];
  }

  function flame(x, y, z, scale = 1) {
    const geometry = new THREE.ConeGeometry(.028 * scale, .1 * scale, 8);
    const tongue = mesh(geometry, flameMaterial('#ffcf7a', .95), x, y, z);
    tongue.castShadow = false;
    tongue.receiveShadow = false;
    tongue.name = 'candle-flame';
    return {object: tongue, phase: x * 3.1 + z * 1.7};
  }

  function fire(x, y, z, scale = 1) {
    const lightBudget = low ? 1 : 3;
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.name = 'hearth-fire';
    const tongues = [];
    const tints = [['#ff7a1c', .7], ['#ffb03b', .75], ['#ffe08a', .85]];
    for (let index = 0; index < (low ? 4 : 7); index++) {
      const [color, opacity] = tints[index % 3];
      const height = (.42 - (index % 3) * .09) * scale;
      const tongue = new THREE.Mesh(new THREE.ConeGeometry((.15 - (index % 3) * .035) * scale, height, 7, 1, true), flameMaterial(color, opacity));
      tongue.geometry.translate(0, height / 2, 0);
      tongue.position.set(((index * .37) % .6 - .3) * scale, 0, ((index * .23) % .16 - .08) * scale);
      tongue.userData.phase = index * 1.7;
      tongue.userData.base = 1;
      holder.add(tongue);
      tongues.push(tongue);
    }
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * scale, .7 * scale), flameMaterial('#ff9b45', .28));
    glow.position.set(0, .25 * scale, -.2);
    holder.add(glow);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(.75 * scale, .05, .32 * scale), new THREE.MeshBasicMaterial({color: '#ff5a1a'}));
    owned.push(coals.material);
    coals.position.y = -.12;
    holder.add(coals);
    let light = null;
    if (fires.filter(item => item.light).length < lightBudget) {
      light = new THREE.PointLight('#ff9a4a', 5.5, 9, 2);
      light.position.set(0, .55, .6);
      light.userData.lightingRole = 'hearth';
      holder.add(light);
    }
    group.add(holder);
    return {holder, tongues, light, glow, base: null, last: null};
  }

  function particleField(count, color, additive, sizeScale) {
    const field = createPointField(count, color, {additive, scale: sizeScale});
    owned.push(field.material);
    group.add(field.points);
    return {...field, count, seed: Float32Array.from({length: count}, (_, index) => (index * 0.618034) % 1)};
  }

  function campfire(x, y, z, scale = .5) {
    fires.push(fire(x, y, z, scale));
    sparkSources.push({position: new THREE.Vector3(x, y + .3, z), spread: .25 * scale / .5});
  }

  function addSmoke(x, y, z, rate = 1) {
    smokeSources.push({position: new THREE.Vector3(x, y, z), rate});
  }

  function finalizeParticles() {
    if (smokeSources.length && !smoke) smoke = particleField(smokeSources.length * (low ? 10 : 22), '#ddd8cf', false, 900);
    if (sparkSources.length && !sparks) sparks = particleField(sparkSources.length * (low ? 6 : 14), '#ffb050', true, 22);
  }

  function updateParticles(field, sources, elapsed, step) {
    if (!field) return;
    const position = field.geometry.attributes.position;
    const size = field.geometry.attributes.aSize;
    const alpha = field.geometry.attributes.aAlpha;
    const perSource = field.count / sources.length;
    for (let index = 0; index < field.count; index++) {
      const source = sources[Math.floor(index / perSource)];
      step(index, source, (elapsed * (field === smoke ? .11 : .9) + field.seed[index]) % 1, position, size, alpha);
    }
    position.needsUpdate = size.needsUpdate = alpha.needsUpdate = true;
  }

  function update(delta, elapsed) {
    for (const item of fires) {
      // Respect whatever intensity the lighting runtime assigned, then flicker around it.
      const flicker = .82 + Math.sin(elapsed * 11.3) * .06 + Math.sin(elapsed * 17.9 + 1.3) * .05 + Math.sin(elapsed * 5.1) * .07;
      if (item.light) {
        if (item.base === null || Math.abs(item.light.intensity - item.last) > 1e-4) item.base = item.light.intensity;
        item.light.intensity = item.base * flicker;
        item.last = item.light.intensity;
      }
      for (const tongue of item.tongues) {
        const phase = tongue.userData.phase;
        tongue.scale.set(1 + Math.sin(elapsed * 9 + phase) * .1, .75 + Math.abs(Math.sin(elapsed * 7.3 + phase)) * .55, 1);
        tongue.rotation.z = Math.sin(elapsed * 4.1 + phase) * .12;
      }
      item.glow.material.opacity = .22 + flicker * .08;
    }
    for (const candle of candles) {
      candle.object.scale.set(1, .85 + Math.abs(Math.sin(elapsed * 8.7 + candle.phase)) * .35, 1);
      candle.object.rotation.z = Math.sin(elapsed * 3 + candle.phase) * .08;
    }
    updateParticles(smoke, smokeSources, elapsed, (index, source, age, position, size, alpha) => {
      const drift = age * age;
      position.setXYZ(index, source.position.x + drift * 2.6 + Math.sin(age * 6 + index) * .18 * age, source.position.y + age * 4.2, source.position.z + drift * 1.1 + Math.cos(age * 5 + index) * .15 * age);
      size.setX(index, (.5 + age * 2.4) * source.rate);
      alpha.setX(index, Math.sin(Math.min(1, age * 1.2) * Math.PI) * .32);
    });
    updateParticles(sparks, sparkSources, elapsed, (index, source, age, position, size, alpha) => {
      const angle = index * 2.4;
      position.setXYZ(index, source.position.x + Math.sin(angle) * source.spread * (.3 + age * .5), source.position.y + age * 1.15, source.position.z + Math.cos(angle) * .12);
      size.setX(index, 1.1 - age * .6);
      alpha.setX(index, (1 - age) * (index % 3 ? .8 : .45));
    });
  }

  function dispose() {
    owned.forEach(item => item.dispose());
    for (const field of [smoke, sparks]) field?.geometry.dispose();
    for (const item of fires) item.holder.traverse(object => object.geometry?.dispose());
  }

  return {surface, addSmoke, campfire, slab, solidSlab, wallRun, gable, gableRoof, sashWindow, panelDoor, stoneChimney, fireplace, flame, finalizeParticles, update, dispose, metricBox, sphere};
}

// Points with per-point size and alpha (fog-aware); used for smoke, sparks and fireflies.
export function createPointField(count, color, {additive = false, scale = 300} = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {uColor: {value: new THREE.Color(color)}, uScale: {value: scale}}]),
    vertexShader: `attribute float aSize; attribute float aAlpha; varying float vAlpha; uniform float uScale;
      #include <fog_pars_vertex>
      void main() { vAlpha = aAlpha; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(.1, -mvPosition.z); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uColor; varying float vAlpha;
      #include <fog_pars_fragment>
      void main() { vec2 p = gl_PointCoord - .5; float d = length(p); if (d > .5) discard; gl_FragColor = vec4(uColor, vAlpha * smoothstep(.5, .0, d));
      #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'particles';
  return {points, geometry, material};
}

export function shadeColor(color, amount) {
  const value = new THREE.Color(color);
  const hsl = {};
  value.getHSL(hsl);
  value.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return `#${value.getHexString()}`;
}
