import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildZionWorld, ZION_LAYOUT } from '../game/src/zion-world.js';
import { mkdir } from 'node:fs/promises';

function intersects(collider, position, radius = 0.36) {
  if (collider.radius) return Math.hypot(position[0] - collider.x, position[2] - collider.z) < collider.radius + radius;
  return Math.abs(position[0] - collider.x) < collider.width / 2 + radius && Math.abs(position[2] - collider.z) < collider.depth / 2 + radius;
}

for (const quality of ['high', 'low']) {
  const group = new THREE.Group();
  const colliders = [];
  const points = ['center', 'gather', 'study', 'prayer', 'journey'].map(id => ({ id, label: id, position: new THREE.Vector3() }));
  const materials = new Map();
  const context = {
    group, colliders, points, quality, chapter: { id: 'E8' },
    bounds: {}, spawn: new THREE.Vector3(), focus: new THREE.Vector3(),
    mesh(geometry, color, centerX, centerY, centerZ, options = {}) {
      if (!materials.has(color)) materials.set(color, new THREE.MeshToonMaterial({ color, ...options }));
      const object = new THREE.Mesh(geometry, materials.get(color));
      object.position.set(centerX, centerY, centerZ);
      group.add(object);
      return object;
    },
  };
  const result = buildZionWorld(context);
  assert.equal(result.layout.hallCount, ZION_LAYOUT.templeCount);
  assert.equal(result.layout.halls.length, 24);
  assert.equal(result.layout.materialBatches <= 24, true);
  assert.equal(result.layout.triangleCount < 250000, true);
  assert.equal(context.bounds.maxX, 220);
  assert.equal(points.some(point => point.id === 'creation'), true);
  assert.equal(result.getGroundHeight(0, 0), 0.1);
  for (const hall of result.layout.halls) {
    assert.equal(colliders.some(collider => intersects(collider, hall.doorway)), false, `Hall ${hall.id} entrance must remain open`);
    assert.equal(colliders.some(collider => intersects(collider, [hall.x, 0, hall.z])), false, `Hall ${hall.id} center must remain walkable`);
  }
  for (let avenueZ = 48; avenueZ > -165; avenueZ -= 2) {
    assert.equal(colliders.some(collider => intersects(collider, [0, 0, avenueZ])), false, `Avenue must be clear at ${avenueZ}`);
  }
  group.traverse(object => object.geometry?.dispose());
  materials.forEach(material => material.dispose());
  console.log(`PASS Zion ${quality}: ${result.layout.hallCount} accessible halls, ${result.layout.materialBatches} batches, ${Math.round(result.layout.triangleCount)} triangles, clear avenue.`);
}

if (process.argv.includes('--browser')) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('docs/evidence', { recursive: true });
  try {
    await page.goto('http://127.0.0.1:8923/docs/zion-city-report.html');
    await page.screenshot({ path: 'docs/evidence/zion-report-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: 'docs/evidence/zion-report-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.setContent('<html><head><base href="http://127.0.0.1:8923/"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head><body style="margin:0"></body></html>');
    const stats = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { buildZionWorld } = await import('/game/src/zion-world.js');
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(innerWidth, innerHeight);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      document.body.append(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#c5dbdf');
      scene.fog = new THREE.FogExp2('#d5e1da', 0.0018);
      scene.add(new THREE.HemisphereLight('#fff4df', '#74876d', 2.2));
      const sun = new THREE.DirectionalLight('#fff1d0', 2.6);
      sun.position.set(-80, 130, 90);
      scene.add(sun);
      const group = new THREE.Group();
      scene.add(group);
      const materials = new Map();
      const result = buildZionWorld({
        group, colliders: [], points: [], bounds: {}, spawn: new THREE.Vector3(), focus: new THREE.Vector3(), chapter: { id: 'E8' },
        mesh(geometry, color, centerX, centerY, centerZ, options = {}) {
          if (!materials.has(color)) materials.set(color, new THREE.MeshToonMaterial({ color, ...options }));
          const object = new THREE.Mesh(geometry, materials.get(color));
          object.position.set(centerX, centerY, centerZ);
          group.add(object);
          return object;
        },
      });
      const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 1000);
      camera.position.set(78, 63, 117);
      camera.lookAt(0, 4, -65);
      renderer.render(scene, camera);
      window.zionPreview = { scene, camera, renderer };
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, temples: result.layout.hallCount };
    });
    await page.screenshot({ path: 'docs/evidence/zion-city-aerial.png' });
    await page.evaluate(() => {
      window.zionPreview.camera.position.set(0, 1.8, 48);
      window.zionPreview.camera.lookAt(0, 6, -75);
      window.zionPreview.renderer.render(window.zionPreview.scene, window.zionPreview.camera);
    });
    await page.screenshot({ path: 'docs/evidence/zion-city-arrival.png' });
    await page.evaluate(() => {
      window.zionPreview.camera.position.set(28, 1.8, -14);
      window.zionPreview.camera.lookAt(28, 3.5, -30);
      window.zionPreview.renderer.render(window.zionPreview.scene, window.zionPreview.camera);
    });
    await page.screenshot({ path: 'docs/evidence/zion-hall-interior.png' });
    assert.deepEqual(errors, []);
    assert.equal(stats.calls < 30, true);
    console.log(`PASS Zion browser preview: ${stats.calls} draw calls, ${stats.triangles} triangles, no browser exceptions; report fits 390px.`);
  } finally {
    await browser.close();
  }
}
