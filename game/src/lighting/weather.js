import * as THREE from 'three';

function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeBeamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const vertical = context.createLinearGradient(0, 0, 0, 256);
  vertical.addColorStop(0, 'rgba(255,255,255,0)');
  vertical.addColorStop(0.16, 'rgba(255,255,255,0.28)');
  vertical.addColorStop(0.62, 'rgba(255,255,255,0.20)');
  vertical.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = vertical;
  context.fillRect(0, 0, 128, 256);
  const horizontal = context.createLinearGradient(0, 0, 128, 0);
  horizontal.addColorStop(0, 'rgba(255,255,255,0)');
  horizontal.addColorStop(0.38, 'rgba(255,255,255,0.8)');
  horizontal.addColorStop(0.62, 'rgba(255,255,255,0.8)');
  horizontal.addColorStop(1, 'rgba(255,255,255,0)');
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = horizontal;
  context.fillRect(0, 0, 128, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMistTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(230,236,228,0.34)');
  gradient.addColorStop(0.45, 'rgba(223,231,224,0.18)');
  gradient.addColorStop(1, 'rgba(220,230,224,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const RAIN_COUNT = 1400;
const SNOW_COUNT = 1500;
const DUST_COUNT = 900;
const EMBER_COUNT = 500;
const MOTE_COUNT = 420;
const MIST_COUNT = 18;

export class WeatherSystem {
  constructor(scene, {quality = 'high', reducedMotion = false, reducedFlash = false} = {}) {
    this.scene = scene;
    this.reducedMotion = reducedMotion;
    this.reducedFlash = reducedFlash;
    const scale = quality === 'low' ? 0.22 : 1;
    this.counts = {
      rain: Math.ceil(RAIN_COUNT * scale), snow: Math.ceil(SNOW_COUNT * scale),
      dust: Math.ceil(DUST_COUNT * scale), embers: Math.ceil(EMBER_COUNT * scale),
      motes: Math.ceil(MOTE_COUNT * scale), mist: Math.ceil(MIST_COUNT * scale),
    };
    this.group = new THREE.Group();
    this.group.name = 'lighting-studio-weather';
    scene.add(this.group);
    this.clock = 0;
    this.flashTimer = 0;
    this.flashValue = 0;
    this.glow = makeGlowTexture();
    this.mistTexture = makeMistTexture();
    this.beamTexture = makeBeamTexture();
    this.buildRain();
    this.buildSnow();
    this.buildDust();
    this.buildEmbers();
    this.buildMotes();
    this.buildMist();
    this.buildRays();
  }

  buildRain() {
    const positions = new Float32Array(this.counts.rain * 6);
    this.rainData = [];
    for (let i = 0; i < this.counts.rain; i += 1) {
      const x = (Math.random() - 0.5) * 90;
      const y = Math.random() * 30;
      const z = (Math.random() - 0.5) * 90;
      const len = 0.35 + Math.random() * 0.7;
      this.rainData.push({x, y, z, len, speed: 18 + Math.random() * 16});
      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x + 0.03;
      positions[i * 6 + 4] = y - len;
      positions[i * 6 + 5] = z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rain = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({color: '#abc7d8', transparent: true, opacity: 0, depthWrite: false, fog: true}),
    );
    this.rain.frustumCulled = false;
    this.group.add(this.rain);
  }

  buildSnow() {
    const positions = new Float32Array(this.counts.snow * 3);
    this.snowData = [];
    for (let i = 0; i < this.counts.snow; i += 1) {
      const x = (Math.random() - 0.5) * 85;
      const y = Math.random() * 26;
      const z = (Math.random() - 0.5) * 85;
      this.snowData.push({x, y, z, speed: 0.7 + Math.random() * 1.5, sway: Math.random() * Math.PI * 2});
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.snow = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({color: '#eef4f8', size: 0.16, map: this.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true}),
    );
    this.snow.frustumCulled = false;
    this.group.add(this.snow);
  }

  buildDust() {
    const positions = new Float32Array(this.counts.dust * 3);
    this.dustData = [];
    for (let i = 0; i < this.counts.dust; i += 1) {
      const x = (Math.random() - 0.5) * 80;
      const y = Math.random() * 12;
      const z = (Math.random() - 0.5) * 80;
      this.dustData.push({x, y, z, speed: 0.15 + Math.random() * 0.35, sway: Math.random() * Math.PI * 2});
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({color: '#d8c39b', size: 0.075, map: this.glow, transparent: true, opacity: 0, depthWrite: false, fog: true}),
    );
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  buildEmbers() {
    const positions = new Float32Array(this.counts.embers * 3);
    this.emberData = [];
    for (let i = 0; i < this.counts.embers; i += 1) {
      const x = (Math.random() - 0.5) * 55;
      const y = Math.random() * 16;
      const z = (Math.random() - 0.5) * 55;
      this.emberData.push({x, y, z, speed: 0.8 + Math.random() * 1.8, sway: Math.random() * Math.PI * 2});
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.embers = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({color: '#ff8a3c', size: 0.12, map: this.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true}),
    );
    this.embers.frustumCulled = false;
    this.group.add(this.embers);
  }

  buildMotes() {
    const positions = new Float32Array(this.counts.motes * 3);
    this.moteData = [];
    for (let i = 0; i < this.counts.motes; i += 1) {
      const x = (Math.random() - 0.5) * 22;
      const y = Math.random() * 8;
      const z = (Math.random() - 0.5) * 22;
      this.moteData.push({x, y, z, speed: 0.08 + Math.random() * 0.18, sway: Math.random() * Math.PI * 2});
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({color: '#e8e2b8', size: 0.09, map: this.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true}),
    );
    this.motes.frustumCulled = false;
    this.group.add(this.motes);
  }

  buildRays() {
    this.rays = [];
    const geometry = new THREE.PlaneGeometry(5.2, 28);
    for (let index = 0; index < 6; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        map: this.beamTexture,
        color: '#fff2c4',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      });
      const ray = new THREE.Mesh(geometry, material);
      ray.position.set((index - 2.5) * 3.2, 8.5, -1 - (index % 2) * 2.2);
      ray.rotation.z = -0.12 + (index % 3) * 0.06;
      ray.renderOrder = 4;
      ray.frustumCulled = false;
      this.group.add(ray);
      this.rays.push(ray);
    }
  }

  buildMist() {
    this.mist = [];
    for (let i = 0; i < this.counts.mist; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.mistTexture,
        color: '#dce5dd',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: true,
      }));
      const angle = (i / this.counts.mist) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 6 + Math.random() * 24;
      sprite.position.set(Math.cos(angle) * radius, 0.15 + Math.random() * 0.9, Math.sin(angle) * radius);
      const scale = 10 + Math.random() * 18;
      sprite.scale.set(scale, scale * 0.38, 1);
      sprite.userData = {baseX: sprite.position.x, baseZ: sprite.position.z, phase: Math.random() * 6.28, radius};
      this.group.add(sprite);
      this.mist.push(sprite);
    }
  }

  setSunDirection(direction) {
    this.sunDirection = direction;
  }

  update(state, delta, elapsed, camera) {
    if (this.reducedMotion) {
      delta = 0;
      elapsed = 0;
    }
    this.clock += delta;
    const fx = state.fx;
    const weatherVisible = !state.interior || state.allowIndoorWeather;
    this.rain.visible = weatherVisible && fx.rain > 0.005;
    this.snow.visible = weatherVisible && fx.snow > 0.005;
    this.dust.visible = fx.dust > 0.005;
    this.embers.visible = fx.embers > 0.005;
    this.motes.visible = fx.motes > 0.005;
    const mistAmount = Math.max(fx.mist, fx.groundFog ?? 0);
    this.mist.forEach(sprite => { sprite.visible = mistAmount > 0.005; });

    this.rain.material.opacity = Math.min(0.55, fx.rain * 0.6);
    this.snow.material.opacity = Math.min(0.9, fx.snow * 0.9);
    this.dust.material.opacity = Math.min(0.38, fx.dust * 0.4);
    this.embers.material.opacity = Math.min(0.9, fx.embers * 0.9);
    this.motes.material.opacity = Math.min(0.75, fx.motes * 0.75);
    this.mist.forEach(sprite => { sprite.material.opacity = Math.min(0.35, mistAmount * 0.36); });

    const wind = fx.wind;
    if (this.rain.visible) {
      const attr = this.rain.geometry.attributes.position;
      for (let i = 0; i < this.counts.rain; i += 1) {
        const drop = this.rainData[i];
        drop.y -= drop.speed * delta * (0.6 + fx.rain * 0.8);
        drop.x += wind * delta * 4.2;
        drop.z += wind * delta * 1.4;
        if (drop.y < -1) {
          drop.y = 24 + Math.random() * 8;
          drop.x = (Math.random() - 0.5) * 90;
          drop.z = (Math.random() - 0.5) * 90;
        }
        attr.array[i * 6] = drop.x;
        attr.array[i * 6 + 1] = drop.y;
        attr.array[i * 6 + 2] = drop.z;
        attr.array[i * 6 + 3] = drop.x + wind * 0.22;
        attr.array[i * 6 + 4] = drop.y - drop.len;
        attr.array[i * 6 + 5] = drop.z + wind * 0.08;
      }
      attr.needsUpdate = true;
    }

    if (this.snow.visible) {
      const attr = this.snow.geometry.attributes.position;
      for (let i = 0; i < this.counts.snow; i += 1) {
        const flake = this.snowData[i];
        flake.y -= flake.speed * delta * (0.5 + fx.snow * 0.5);
        flake.x += Math.sin(elapsed * 0.7 + flake.sway) * delta * 0.7 + wind * delta * 2.8;
        flake.z += Math.cos(elapsed * 0.5 + flake.sway) * delta * 0.4;
        if (flake.y < -0.5) {
          flake.y = 22 + Math.random() * 6;
          flake.x = (Math.random() - 0.5) * 85;
          flake.z = (Math.random() - 0.5) * 85;
        }
        attr.array[i * 3] = flake.x;
        attr.array[i * 3 + 1] = flake.y;
        attr.array[i * 3 + 2] = flake.z;
      }
      attr.needsUpdate = true;
    }

    if (this.dust.visible) {
      const attr = this.dust.geometry.attributes.position;
      for (let i = 0; i < this.counts.dust; i += 1) {
        const mote = this.dustData[i];
        mote.x += Math.sin(elapsed * 0.3 + mote.sway) * delta * 0.25 + wind * delta * 1.4;
        mote.y += Math.sin(elapsed * 0.5 + mote.sway) * delta * 0.12;
        mote.z += Math.cos(elapsed * 0.2 + mote.sway) * delta * 0.2;
        if (mote.x > 45) mote.x = -45;
        if (mote.x < -45) mote.x = 45;
        if (mote.z > 45) mote.z = -45;
        if (mote.z < -45) mote.z = 45;
        if (mote.y > 14) mote.y = 0.2;
        attr.array[i * 3] = mote.x;
        attr.array[i * 3 + 1] = mote.y;
        attr.array[i * 3 + 2] = mote.z;
      }
      attr.needsUpdate = true;
    }

    if (this.embers.visible) {
      const attr = this.embers.geometry.attributes.position;
      for (let i = 0; i < this.counts.embers; i += 1) {
        const ember = this.emberData[i];
        ember.y += ember.speed * delta;
        ember.x += Math.sin(elapsed * 1.2 + ember.sway) * delta * 0.8 + wind * delta * 1.2;
        if (ember.y > 18) {
          ember.y = 0.2;
          ember.x = (Math.random() - 0.5) * 55;
          ember.z = (Math.random() - 0.5) * 55;
        }
        attr.array[i * 3] = ember.x;
        attr.array[i * 3 + 1] = ember.y;
        attr.array[i * 3 + 2] = ember.z;
      }
      attr.needsUpdate = true;
    }

    if (this.motes.visible) {
      const attr = this.motes.geometry.attributes.position;
      for (let i = 0; i < this.counts.motes; i += 1) {
        const mote = this.moteData[i];
        mote.y += mote.speed * delta;
        mote.x += Math.sin(elapsed * 0.4 + mote.sway) * delta * 0.12;
        mote.z += Math.cos(elapsed * 0.35 + mote.sway) * delta * 0.1;
        if (mote.y > 9) mote.y = 0.1;
        attr.array[i * 3] = mote.x;
        attr.array[i * 3 + 1] = mote.y;
        attr.array[i * 3 + 2] = mote.z;
      }
      attr.needsUpdate = true;
    }

    if (mistAmount > 0.005) {
      this.mist.forEach(sprite => {
        const {baseX, baseZ, phase, radius} = sprite.userData;
        sprite.position.x = baseX + Math.sin(elapsed * 0.08 + phase) * radius * 0.08;
        sprite.position.z = baseZ + Math.cos(elapsed * 0.06 + phase) * radius * 0.06;
        sprite.position.y = 0.3 + Math.sin(elapsed * 0.12 + phase) * 0.15;
      });
    }

    this.rays.forEach((ray, index) => {
      const amount = (fx.godRays ?? 0) * (0.6 + 0.4 * Math.sin(elapsed * 0.35 + index * 1.7));
      ray.visible = amount > 0.004;
      ray.material.opacity = amount * 0.22;
      ray.material.color.set(state.sun.color);
      ray.rotation.y = Math.atan2(camera.position.x - ray.position.x, camera.position.z - ray.position.z);
    });

    // Lightning is a short, multi-part flash rather than a strobe.
    if (fx.lightning > 0.005 && !this.reducedFlash && !this.reducedMotion) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.flashTimer = 3.5 + Math.random() * 7;
        this.flashValue = 0.55 + Math.random() * 0.45;
      }
      this.flashValue *= Math.pow(0.02, delta);
      if (this.flashValue < 0.01) this.flashValue = 0;
    } else {
      this.flashValue = 0;
    }
    return this.flashValue;
  }

  dispose() {
    this.scene.remove(this.group);
    const geometries = new Set();
    const materials = new Set();
    this.group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
        else materials.add(object.material);
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.glow.dispose();
    this.mistTexture.dispose();
    this.beamTexture.dispose();
  }
}
