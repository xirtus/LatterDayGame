import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ZION_LAYOUT = Object.freeze({
  templeCount: 24,
  sacredBlocks: 2,
  templesPerBlock: 12,
  rowsPerBlock: 3,
  columnsPerBlock: 4,
  bounds: 220,
  interpretation: 'An imaginative future district inspired by the revised August 1833 plat; distances and architecture adapted for play.',
});

const COLORS = {
  ivory: '#c5cfc6', marble: '#e0e4dc', shade: '#a9b8b1', stone: '#b8c5be',
  gold: '#b5934c', paleGold: '#d7c28d', roof: '#718c91', glass: '#6d9ba7',
  water: '#4d929e', grass: '#93aa7b', foliage: '#51795e', lightLeaf: '#9bb786',
  blossom: '#e0c5c0', wood: '#6b6555', paving: '#c4c7b7', soil: '#8a886b',
};

export function buildZionWorld(context) {
  const { group, mesh, colliders, points, spawn, focus, bounds, chapter, quality = 'high', animated = [] } = context;
  const batches = new Map();
  const transform = new THREE.Object3D();
  const halls = [];
  const low = quality === 'low';
  const celestial = chapter?.id === '32';

  function addGeometry(geometry, color, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    transform.position.set(...position);
    transform.scale.set(...scale);
    transform.rotation.set(...rotation);
    transform.updateMatrix();
    const normalized = geometry.index ? geometry.toNonIndexed() : geometry;
    if (normalized !== geometry) geometry.dispose();
    normalized.applyMatrix4(transform.matrix);
    normalized.deleteAttribute('uv');
    if (!batches.has(color)) batches.set(color, []);
    batches.get(color).push(normalized);
  }

  function block(position, size, color = COLORS.ivory, rotation) {
    addGeometry(new THREE.BoxGeometry(...size), color, position, [1, 1, 1], rotation);
  }

  function round(position, radiusTop, radiusBottom, height, color = COLORS.marble, segments = 12) {
    addGeometry(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), color, position);
  }

  function ornament(position, radius, color = COLORS.gold, scale = [1, 1, 1]) {
    addGeometry(new THREE.IcosahedronGeometry(radius, 1), color, position, scale);
  }

  function wall(position, size, color = COLORS.ivory) {
    block(position, size, color);
    colliders.push({ x: position[0], z: position[2], width: size[0], depth: size[2] });
  }

  function column(position, height, radius = 0.4) {
    const [centerX, baseY, centerZ] = position;
    block([centerX, baseY + 0.12, centerZ], [radius * 2.9, 0.24, radius * 2.9], COLORS.shade);
    round([centerX, baseY + height / 2, centerZ], radius * 0.82, radius, height - 0.3);
    round([centerX, baseY + height - 0.28, centerZ], radius * 1.35, radius * 0.85, 0.3, COLORS.paleGold);
    block([centerX, baseY + height - 0.04, centerZ], [radius * 2.8, 0.2, radius * 2.8], COLORS.marble);
    colliders.push({ x: centerX, z: centerZ, radius: radius + 0.08 });
  }

  function gable(centerX, baseY, centerZ, width, depth, rise) {
    const triangle = new THREE.Shape();
    triangle.moveTo(-width / 2, 0);
    triangle.lineTo(width / 2, 0);
    triangle.lineTo(0, rise);
    triangle.closePath();
    const front = new THREE.ExtrudeGeometry(triangle, { depth: 0.28, bevelEnabled: false });
    const rear = front.clone();
    addGeometry(front, COLORS.marble, [centerX, baseY, centerZ + depth / 2]);
    addGeometry(rear, COLORS.shade, [centerX, baseY, centerZ - depth / 2 - 0.28]);
    const slope = Math.atan2(rise, width / 2);
    const panelWidth = Math.hypot(width / 2, rise);
    for (const side of [-1, 1]) {
      block([centerX + side * width / 4, baseY + rise / 2, centerZ], [panelWidth + 0.45, 0.26, depth + 0.9], COLORS.roof, [0, 0, -side * slope]);
      block([centerX + side * width / 4, baseY + rise / 2 + 0.17, centerZ + depth / 2 + 0.32], [panelWidth + 0.5, 0.2, 0.28], COLORS.paleGold, [0, 0, -side * slope]);
    }
    block([centerX, baseY + rise + 0.13, centerZ], [0.3, 0.3, depth + 1.1], COLORS.gold);
    ornament([centerX, baseY + rise + 0.8, centerZ + depth / 2 + 0.25], 0.48, COLORS.paleGold, [0.7, 1.5, 0.7]);
  }

  function temple(centerX, centerZ, index) {
    const width = index % 6 === 0 ? 29 : 25;
    const depth = index % 4 === 0 ? 34 : 30;
    const height = index % 6 === 0 ? 16.8 : 11.2 + (index % 3) * 1.25;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const frontZ = centerZ + halfDepth - 5;
    const rearZ = centerZ - halfDepth + 2;
    const innerHalf = halfWidth - 3.2;
    const doorway = 4.8;
    const lintel = 5.4;
    const wallColor = index % 4 === 0 ? COLORS.marble : COLORS.ivory;
    block([centerX, -0.1, centerZ], [width + 2.2, 0.2, depth + 2.6], COLORS.shade);
    block([centerX, 0.018, centerZ], [width + 1.4, 0.036, depth + 1.8], COLORS.marble);
    wall([centerX - innerHalf, height / 2, (frontZ + rearZ) / 2], [0.6, height, frontZ - rearZ], wallColor);
    wall([centerX + innerHalf, height / 2, (frontZ + rearZ) / 2], [0.6, height, frontZ - rearZ], wallColor);
    wall([centerX, height / 2, rearZ], [innerHalf * 2, height, 0.6], wallColor);
    const frontWidth = innerHalf - doorway / 2;
    for (const side of [-1, 1]) {
      wall([centerX + side * (doorway / 2 + frontWidth / 2), height / 2, frontZ], [frontWidth, height, 0.6], wallColor);
      block([centerX + side * (doorway / 2 + 0.16), lintel / 2, frontZ + 0.36], [0.25, lintel, 0.25], COLORS.paleGold);
    }
    block([centerX, lintel + (height - lintel) / 2, frontZ], [doorway, height - lintel, 0.6], wallColor);
    block([centerX, lintel + 0.08, frontZ + 0.37], [doorway + 0.6, 0.24, 0.28], COLORS.gold);
    const columnCount = low ? 4 : 6;
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const localX = -halfWidth + 1.35 + columnIndex / (columnCount - 1) * (width - 2.7);
      column([centerX + localX, 0.04, centerZ + halfDepth - 1.2], height, 0.48);
    }
    for (const side of [-1, 1]) {
      for (let sideIndex = 0; sideIndex < 5; sideIndex += 1) {
        column([centerX + side * (halfWidth - 1.3), 0.04, centerZ + halfDepth - 5.5 - sideIndex * (depth - 8) / 4], height, 0.42);
      }
    }
    block([centerX, height + 0.25, centerZ], [width + 0.4, 0.5, depth + 0.35], COLORS.marble);
    block([centerX, height + 0.82, centerZ], [width + 0.25, 0.65, depth + 0.25], wallColor);
    block([centerX, height + 1.22, centerZ], [width + 1, 0.22, depth + 0.85], COLORS.paleGold);
    const dentilCount = low ? 8 : 14;
    for (let dentilIndex = 0; dentilIndex < dentilCount; dentilIndex += 1) {
      block([centerX - halfWidth + 0.8 + dentilIndex / (dentilCount - 1) * (width - 1.6), height + 1.05, centerZ + halfDepth + 0.47], [0.45, 0.35, 0.26], COLORS.shade);
    }
    gable(centerX, height + 1.35, centerZ, width + 0.7, depth + 0.7, width * 0.19);
    if (index % 6 === 0) {
      const towerY = height + width * 0.19 + 1.3;
      block([centerX, towerY + 2.5, centerZ - 4], [4.4, 5, 4.4], COLORS.ivory);
      block([centerX, towerY + 5.1, centerZ - 4], [5.2, 0.35, 5.2], COLORS.marble);
      for (const side of [-1, 1]) {
        block([centerX + side * 2.23, towerY + 2.5, centerZ - 4], [0.03, 3.2, 1.4], COLORS.glass);
        block([centerX, towerY + 2.5, centerZ - 4 + side * 2.23], [1.4, 3.2, 0.03], COLORS.glass);
      }
      round([centerX, towerY + 7.2, centerZ - 4], 0.08, 3.1, 4, COLORS.paleGold, 8);
      ornament([centerX, towerY + 9.5, centerZ - 4], 0.32, COLORS.gold);
    } else if (index % 4 === 2) {
      const domeY = height + 4.7;
      round([centerX, domeY, centerZ - 5], 4, 4, 2.5, COLORS.marble, 20);
      addGeometry(new THREE.SphereGeometry(4.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), COLORS.roof, [centerX, domeY + 1.3, centerZ - 5]);
      ornament([centerX, domeY + 6, centerZ - 5], 0.34, COLORS.paleGold);
    }
    for (const side of [-1, 1]) {
      block([centerX + side * (halfWidth - 4), height * 0.68, centerZ + halfDepth - 0.58], [1.3, 3.8, 0.035], '#40586b');
      block([centerX + side * (halfWidth - 4), height * 0.68 - 1.85, centerZ + halfDepth - 0.55], [1.3, 0.12, 0.04], COLORS.gold);
      ornament([centerX + side * (halfWidth - 4), height * 0.68, centerZ + halfDepth - 0.52], 0.28, COLORS.paleGold, [1, 1.4, 0.08]);
    }
    for (const side of [-1, 1]) {
      for (let windowIndex = 0; windowIndex < 3; windowIndex += 1) {
        const windowZ = rearZ + 4 + windowIndex * 5.2;
        block([centerX + side * (innerHalf + 0.32), height * 0.56, windowZ], [0.025, 3.8, 1.9], COLORS.glass);
        block([centerX + side * (innerHalf + 0.35), height * 0.56, windowZ], [0.05, 3.8, 0.1], COLORS.gold);
        block([centerX + side * (innerHalf - 0.32), height * 0.56, windowZ], [0.025, 3.8, 1.9], COLORS.glass);
        block([centerX + side * (innerHalf - 0.35), height * 0.56, windowZ], [0.05, 3.8, 0.1], COLORS.gold);
      }
      block([centerX + side * (innerHalf - 0.36), 1.15, (frontZ + rearZ) / 2], [0.13, 0.12, frontZ - rearZ], COLORS.paleGold);
      block([centerX + side * (innerHalf - 0.36), height - 1, (frontZ + rearZ) / 2], [0.13, 0.2, frontZ - rearZ], COLORS.shade);
      for (let seatIndex = 0; seatIndex < 3; seatIndex += 1) {
        block([centerX + side * innerHalf * 0.52, 0.47, centerZ - 1 - seatIndex * 3.3], [innerHalf * 0.68, 0.18, 0.8], COLORS.wood);
        block([centerX + side * innerHalf * 0.52, 0.22, centerZ - 1 - seatIndex * 3.3], [innerHalf * 0.55, 0.44, 0.12], COLORS.wood);
      }
    }
    round([centerX, 0.7, rearZ + 3.1], 0.85, 1.1, 1.4, COLORS.shade);
    ornament([centerX, 1.6, rearZ + 3.1], 0.32, COLORS.paleGold);
    block([centerX, 4.6, rearZ + 0.32], [5.5, 5.3, 0.035], '#40586b');
    addGeometry(new THREE.TorusGeometry(1.65, 0.045, 6, 48), COLORS.paleGold, [centerX, 4.8, rearZ + 0.36]);
    for (let inlayIndex = 0; inlayIndex < 6; inlayIndex += 1) {
      block([centerX, 0.047, rearZ + 2 + inlayIndex * (frontZ - rearZ - 3) / 5], [innerHalf * 1.8, 0.01, 0.035], COLORS.shade);
    }
    for (const side of [-1, 1]) block([centerX + side * 1.3, 0.049, (frontZ + rearZ) / 2], [0.045, 0.01, frontZ - rearZ], COLORS.gold);
    halls.push({ id: `zion-hall-${index + 1}`, x: centerX, z: centerZ, width, depth, doorway: [centerX, 0, frontZ], height });
  }

  function gardenTree(centerX, centerZ, scale = 1, blossom = false) {
    round([centerX, 2.3 * scale, centerZ], 0.15 * scale, 0.3 * scale, 4.6 * scale, COLORS.wood, 7);
    ornament([centerX, 5.2 * scale, centerZ], 2.2 * scale, blossom ? COLORS.blossom : COLORS.foliage, [1, 1.2, 1]);
    if (!low) {
      ornament([centerX - 1.3 * scale, 4.9 * scale, centerZ], 1.6 * scale, blossom ? COLORS.blossom : COLORS.lightLeaf);
      ornament([centerX + 1.2 * scale, 5.5 * scale, centerZ - 0.3 * scale], 1.5 * scale, COLORS.lightLeaf);
    }
    colliders.push({ x: centerX, z: centerZ, radius: 0.32 * scale });
  }

  function pool(centerX, centerZ, width, depth) {
    block([centerX, 0.025, centerZ], [width, 0.05, depth], COLORS.water);
    for (const side of [-1, 1]) {
      wall([centerX + side * (width / 2 + 0.24), 0.25, centerZ], [0.48, 0.5, depth + 0.96], COLORS.marble);
      wall([centerX, 0.25, centerZ + side * (depth / 2 + 0.24)], [width, 0.5, 0.48], COLORS.marble);
    }
    for (let rippleIndex = 0; rippleIndex < (low ? 3 : 7); rippleIndex += 1) {
      block([centerX + (rippleIndex % 3 - 1) * width * 0.23, 0.059, centerZ - depth * 0.35 + rippleIndex * depth * 0.11], [width * 0.14, 0.008, 0.05], '#b8dad1');
    }
  }

  function gardenBench(centerX, centerZ) {
    block([centerX, 0.58, centerZ], [3.7, 0.22, 0.8], COLORS.marble);
    for (const side of [-1, 1]) block([centerX + side * 1.3, 0.27, centerZ], [0.35, 0.54, 0.65], COLORS.shade);
    colliders.push({ x: centerX, z: centerZ, width: 3.7, depth: 0.8 });
  }

  function residence(centerX, centerZ, variation = 0) {
    const width = 10 + variation % 3;
    const depth = 12;
    const height = 5.3 + variation % 2;
    block([centerX, -0.02, centerZ], [width + 2, 0.08, depth + 2], COLORS.paving);
    block([centerX, height / 2, centerZ], [width, height, depth], variation % 2 ? '#d8cfb6' : '#e3d9bd');
    colliders.push({ x: centerX, z: centerZ, width, depth });
    gable(centerX, height, centerZ, width + 0.5, depth + 0.7, 2.7);
    block([centerX, 1.4, centerZ + depth / 2 + 0.02], [1.6, 2.8, 0.08], COLORS.wood);
    for (const side of [-1, 1]) block([centerX + side * 3.3, 2.8, centerZ + depth / 2 + 0.04], [1.4, 1.8, 0.08], COLORS.glass);
    for (let bedIndex = 0; bedIndex < 3; bedIndex += 1) {
      block([centerX + 9.5, 0.14, centerZ - 3 + bedIndex * 3.2], [4, 0.28, 1.5], COLORS.soil);
      for (let plantIndex = 0; plantIndex < 4; plantIndex += 1) ornament([centerX + 8.2 + plantIndex * 0.9, 0.4, centerZ - 3 + bedIndex * 3.2], 0.3, COLORS.foliage);
    }
  }

  block([0, -0.1, -50], [2000, 0.16, 2000], COLORS.grass);
  block([0, -0.008, -55], [35, 0.03, 430], COLORS.paving);
  for (const roadZ of [9, -53, -110, -167]) block([0, 0.01, roadZ], [420, 0.04, 13], COLORS.paving);
  for (const roadX of [-178, -157, -116, -75, -34, 34, 75, 116, 157, 178]) {
    block([roadX, 0.005, -80], [4.2, 0.035, 220], COLORS.paving);
  }
  for (const side of [-1, 1]) {
    block([side * 74, -0.01, -81], [134, 0.04, 170], '#b8c3a2');
    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
        const index = (side === -1 ? 0 : 12) + rowIndex * 4 + columnIndex;
        temple(side * (28 + columnIndex * 41), -25 - rowIndex * 57, index);
      }
    }
    for (const [treeIndex, treeZ] of [48, 10, -53, -110, -167, -196, 78, 106].entries()) {
      gardenTree(side * 20, treeZ, 0.83 + treeIndex % 3 * 0.1, treeIndex % 4 === 0);
    }
    for (let homeIndex = 0; homeIndex < 7; homeIndex += 1) {
      residence(side * 195, 39 - homeIndex * 33, homeIndex + (side === -1 ? 0 : 1));
      gardenTree(side * 180, 41 - homeIndex * 33, 0.8, true);
    }
    for (let orchardIndex = 0; orchardIndex < 8; orchardIndex += 1) {
      gardenTree(side * (45 + orchardIndex % 4 * 18), 65 + Math.floor(orchardIndex / 4) * 20, 0.75, orchardIndex % 2 === 0);
    }
    pool(side * 12.3, 29, 8, 18);
    gardenBench(side * 29, 32);
    gardenBench(side * 29, 18);
    for (let lampIndex = 0; lampIndex < 7; lampIndex += 1) {
      const lampZ = 46 - lampIndex * 34;
      round([side * 16, 2.6, lampZ], 0.09, 0.15, 5.2, COLORS.gold, 8);
      ornament([side * 16, 5.4, lampZ], 0.38, COLORS.paleGold);
      round([side * 16, 5.13, lampZ], 0.55, 0.32, 0.18, COLORS.marble, 12);
    }
  }
  for (let insetIndex = 0; insetIndex < 22; insetIndex += 1) {
    block([0, 0.028, 48 - insetIndex * 10], [0.11, 0.008, 5], COLORS.gold);
  }
  round([0, 0.035, 0], 7.5, 7.5, 0.06, COLORS.marble, 64);
  round([0, 0.074, 0], 6.4, 6.4, 0.015, COLORS.paleGold, 64);
  round([0, 0.084, 0], 6.1, 6.1, 0.015, COLORS.marble, 64);
  for (let rayIndex = 0; rayIndex < 12; rayIndex += 1) {
    const angle = rayIndex / 12 * Math.PI * 2;
    block([Math.sin(angle) * 5, 0.095, Math.cos(angle) * 5], [0.11, 0.008, 1.5], COLORS.gold, [0, angle, 0]);
  }
  for (const side of [-1, 1]) {
    for (let arcadeIndex = 0; arcadeIndex < 9; arcadeIndex += 1) column([side * (37 + arcadeIndex * 15), 0.04, 99], 7.2, 0.38);
    block([side * 97, 7.6, 99], [132, 0.6, 3.6], COLORS.marble);
    block([side * 97, 8.02, 99], [133, 0.22, 4], COLORS.paleGold);
  }
  round([0, 0.02, -192], 18, 18, 0.04, COLORS.marble, 64);
  for (let columnIndex = 0; columnIndex < 20; columnIndex += 1) {
    const angle = columnIndex / 20 * Math.PI * 2;
    column([Math.sin(angle) * 13.2, 0.04, -192 + Math.cos(angle) * 13.2], 15.4, 0.62);
  }
  round([0, 15.9, -192], 14.5, 14.5, 1, COLORS.marble, 64);
  round([0, 16.5, -192], 14.8, 14.8, 0.25, COLORS.paleGold, 64);
  round([0, 19.4, -192], 11.2, 11.2, 5.5, COLORS.ivory, 40);
  addGeometry(new THREE.SphereGeometry(13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), COLORS.roof, [0, 22.1, -192]);
  for (let ribIndex = 0; ribIndex < 6; ribIndex += 1) {
    addGeometry(new THREE.TorusGeometry(13.06, 0.065, 6, 48, Math.PI), COLORS.paleGold, [0, 22.1, -192], [1, 1, 1], [0, ribIndex / 6 * Math.PI, 0]);
  }
  ornament([0, 35.6, -192], 0.75, COLORS.paleGold);
  for (let skylineIndex = 0; skylineIndex < 18; skylineIndex += 1) {
    const skylineX = -330 + skylineIndex * 39;
    const skylineZ = -320 - skylineIndex % 3 * 30;
    const skylineHeight = 8 + skylineIndex % 5 * 4;
    block([skylineX, skylineHeight / 2, skylineZ], [18, skylineHeight, 24], COLORS.shade);
    block([skylineX, skylineHeight + 0.6, skylineZ], [20, 1.2, 26], COLORS.marble);
    if (skylineIndex % 3 === 0) round([skylineX, skylineHeight + 3.4, skylineZ], 0.05, 8.5, 5.5, COLORS.roof, 6);
  }

  let partCount = 0;
  let triangleCount = 0;
  for (const [color, geometries] of batches) {
    partCount += geometries.length;
    const merged = mergeGeometries(geometries, false);
    const object = mesh(merged, color, 0, 0, 0);
    object.name = `zion-city:${color}`;
    object.userData.zionArchitecture = true;
    triangleCount += (merged.index?.count ?? merged.attributes.position.count) / 3;
    geometries.forEach(geometry => geometry.dispose());
  }
  batches.clear();
  if (celestial) {
    const globe = mesh(new THREE.IcosahedronGeometry(9, 3), '#8fbbb6', 0, 35, -181, { emissive: '#42666f', emissiveIntensity: 0.4 });
    globe.name = 'zion-entrusted-world';
    animated.push({ object: globe, kind: 'planet' });
    const ring = mesh(new THREE.TorusGeometry(13, 0.06, 8, 128), COLORS.paleGold, 0, 35, -181);
    ring.rotation.set(Math.PI / 2.8, 0, 0.3);
  }
  Object.assign(bounds, { minX: -220, maxX: 220, minZ: -220, maxZ: 120 });
  spawn.set(0, 0, 48);
  focus.set(0, 6, -30);
  const labels = {
    center: 'The gathering court', gather: 'Build a city of belonging',
    study: 'The pattern of a city', prayer: 'A vision made livable', journey: 'Carry light into the world',
  };
  for (const point of points) if (labels[point.id]) point.label = labels[point.id];
  if (!points.some(point => point.id === 'creation')) points.push({ id: 'creation', label: 'A world entrusted to care', position: new THREE.Vector3(0, 0, -14), kind: 'creation' });
  points.push(
    { id: 'zion-temples', label: 'Twenty-four halls · the sacred districts', position: new THREE.Vector3(28, 0, -9), kind: 'study' },
    { id: 'zion-garden', label: 'A garden for every household', position: new THREE.Vector3(184, 0, 39), kind: 'study' },
    { id: 'zion-water', label: 'Living water and common ground', position: new THREE.Vector3(5.3, 0, 29), kind: 'study' },
  );
  group.userData.zionLayout = { ...ZION_LAYOUT, hallCount: halls.length, partCount, triangleCount, materialBatches: partCount ? group.children.filter(child => child.userData.zionArchitecture).length : 0, halls };
  return {
    getGroundHeight() { return 0.1; },
    layout: group.userData.zionLayout,
    recommendedFogDensity: 0.0018,
    recommendedCameraFar: 1000,
  };
}
