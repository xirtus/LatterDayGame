import * as THREE from 'three';

function seeded(index, salt = 0) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function makeFlameTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 36, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,247,205,1)');
  gradient.addColorStop(0.28, 'rgba(255,190,86,0.95)');
  gradient.addColorStop(0.62, 'rgba(255,104,34,0.55)');
  gradient.addColorStop(1, 'rgba(255,80,20,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMuzzleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,238,1)');
  gradient.addColorStop(0.28, 'rgba(255,226,150,0.95)');
  gradient.addColorStop(0.6, 'rgba(255,145,54,0.5)');
  gradient.addColorStop(1, 'rgba(255,90,20,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Staging {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'lighting-studio-staging';
    scene.add(this.group);
    this.flameTexture = makeFlameTexture();
    this.muzzleTexture = makeMuzzleTexture();
    this.torchLights = [];
    this.flames = [];
    this.muzzles = [];
    this.figures = [];
    this.signature = '';
    this.muzzleTimer = 0;
  }

  clear() {
    this.group.traverse(object => {
      object.geometry?.dispose?.();
      if (object.material && object.material !== this.flameMaterial && object.material !== this.muzzleMaterial) {
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material.dispose();
      }
    });
    this.group.clear();
    this.torchLights = [];
    this.flames = [];
    this.muzzles = [];
    this.figures = [];
    this.signature = '';
  }

  build(state, world) {
    const mob = state.mob;
    const signature = JSON.stringify([mob.enabled, mob.count, mob.torches, mob.pitchforks, mob.guns, mob.muzzle, mob.silhouette, mob.distance, mob.spread, state.blocking, state.chapterId]);
    if (signature === this.signature) return;
    this.clear();
    this.signature = signature;
    if (!mob.enabled || mob.count < 1) {
      if (state.blocking) this.buildBlocking(state, world);
      return;
    }
    const focus = world?.focus ?? new THREE.Vector3();
    // The mob is staged on the ground outside the building, not on the
    // chapter's focus floor (which may be an upper room).
    const groundY = 0;
    const bodyMaterial = new THREE.MeshToonMaterial({color: mob.silhouette ? '#171715' : '#594a3e'});
    const coatMaterial = new THREE.MeshToonMaterial({color: mob.silhouette ? '#0d0d0c' : '#3c3a35'});
    const skinMaterial = new THREE.MeshToonMaterial({color: mob.silhouette ? '#11100f' : '#9a7a61'});
    const metalMaterial = new THREE.MeshToonMaterial({color: mob.silhouette ? '#202020' : '#777b78'});
    const woodMaterial = new THREE.MeshToonMaterial({color: mob.silhouette ? '#1b1510' : '#6c4d32'});
    const torchLimit = Math.min(8, Math.ceil(mob.count * mob.torches));

    for (let index = 0; index < mob.count; index += 1) {
      const angle = (index / mob.count) * Math.PI * 2 + seeded(index, 3) * 0.28;
      const radius = mob.distance + (seeded(index, 4) - 0.5) * 3.2 * mob.spread;
      const x = focus.x + Math.cos(angle) * radius;
      const z = focus.z + Math.sin(angle) * radius;
      const figure = new THREE.Group();
      figure.position.set(x, groundY, z);
      figure.rotation.y = -angle + Math.PI / 2 + (seeded(index, 5) - 0.5) * 0.5;
      const height = 1.62 + seeded(index, 6) * 0.22;

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, height * 0.56, 6), coatMaterial);
      body.position.y = height * 0.44;
      body.castShadow = true;
      figure.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), skinMaterial);
      head.position.y = height * 0.82;
      head.castShadow = true;
      figure.add(head);
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.22, 7), bodyMaterial);
      hat.position.y = height * 0.95;
      figure.add(hat);
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, height * 0.34, 5), bodyMaterial);
        arm.position.set(side * 0.25, height * 0.55, 0.02);
        arm.rotation.z = side * 0.28;
        figure.add(arm);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, height * 0.4, 5), bodyMaterial);
        leg.position.set(side * 0.11, height * 0.18, 0);
        figure.add(leg);
      }

      if (seeded(index, 7) < mob.guns) {
        const gun = new THREE.Group();
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.72), woodMaterial);
        stock.position.set(0.27, height * 0.58, 0.22);
        gun.add(stock);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.024, 0.78, 6), metalMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.27, height * 0.6, 0.62);
        gun.add(barrel);
        const muzzle = new THREE.Sprite(new THREE.SpriteMaterial({map: this.muzzleTexture, color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending}));
        muzzle.position.set(0.27, height * 0.6, 1.02);
        muzzle.scale.setScalar(0.55);
        gun.add(muzzle);
        this.muzzles.push({sprite: muzzle, phase: seeded(index, 8) * 6.28});
        figure.add(gun);
      }

      if (seeded(index, 9) < mob.pitchforks) {
        const pitchfork = new THREE.Group();
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.55, 5), woodMaterial);
        handle.position.set(-0.3, height * 0.64, 0.18);
        handle.rotation.z = -0.14;
        pitchfork.add(handle);
        for (let prong = -1; prong <= 1; prong += 1) {
          const tooth = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.38, 4), metalMaterial);
          tooth.position.set(-0.3 + prong * 0.05, height * 1.38, 0.18);
          pitchfork.add(tooth);
        }
        figure.add(pitchfork);
      }

      if (index < torchLimit) {
        const torch = new THREE.Group();
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.9, 5), woodMaterial);
        stick.position.set(0.34, height * 0.78, 0.05);
        stick.rotation.z = -0.12;
        torch.add(stick);
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({map: this.flameTexture, color: '#ffb05c', transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: true}));
        flame.position.set(0.4, height * 1.18, 0.05);
        flame.scale.setScalar(0.48);
        torch.add(flame);
        this.flames.push({sprite: flame, phase: seeded(index, 10) * 6.28, baseScale: 0.42 + seeded(index, 11) * 0.14});
        const light = new THREE.PointLight(state.practical.torchColor, 0, 14, 2);
        light.position.set(0.4, height * 1.18, 0.05);
        torch.add(light);
        light.userData.base = 16 + seeded(index, 12) * 12;
        light.userData.phase = seeded(index, 13) * 6.28;
        this.torchLights.push(light);
        figure.add(torch);
      }

      figure.userData.baseX = x;
      figure.userData.baseZ = z;
      figure.userData.phase = seeded(index, 14) * 6.28;
      this.figures.push(figure);
      this.group.add(figure);
    }

    if (state.blocking) this.buildBlocking(state, world);
  }

  buildBlocking(state, world) {
    const focus = world?.focus ?? new THREE.Vector3();
    const groundY = world?.getGroundHeight?.(focus.x, focus.z) ?? 0;
    const colors = ['#d9c7a4', '#9da99a', '#b28f71'];
    for (let index = 0; index < 3; index += 1) {
      const group = new THREE.Group();
      const angle = -0.8 + index * 0.8;
      group.position.set(focus.x + Math.cos(angle) * 1.6, groundY, focus.z + Math.sin(angle) * 1.6);
      group.rotation.y = -angle;
      const material = new THREE.MeshToonMaterial({color: colors[index]});
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.72, 4, 8), material);
      body.position.y = 0.9;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshToonMaterial({color: '#b08a6d'}));
      head.position.y = 1.52;
      head.castShadow = true;
      group.add(head);
      this.figures.push(group);
      this.group.add(group);
    }
  }

  update(state, delta, elapsed) {
    const torchPower = state.practical.torch;
    this.torchLights.forEach((light, index) => {
      const flicker = 0.78 + Math.sin(elapsed * 9.5 + light.userData.phase) * 0.12 + Math.sin(elapsed * 23.7 + index) * 0.06;
      light.intensity = light.userData.base * torchPower * flicker;
    });
    this.flames.forEach((flame, index) => {
      const flicker = 0.85 + Math.sin(elapsed * 11 + flame.phase) * 0.12 + Math.sin(elapsed * 27 + index) * 0.05;
      flame.sprite.scale.setScalar(flame.baseScale * flicker);
      flame.sprite.material.opacity = 0.6 + 0.35 * flicker;
    });
    this.muzzleTimer -= delta;
    if (state.mob.muzzle > 0.01 && this.muzzleTimer <= 0) {
      this.muzzleTimer = 0.18 + Math.random() * 1.6;
      const candidates = this.muzzles.filter(item => item.sprite.material.opacity < 0.2);
      if (candidates.length) {
        const item = candidates[Math.floor(Math.random() * candidates.length)];
        item.sprite.material.opacity = 0.7 + Math.random() * 0.3;
        item.sprite.scale.setScalar(0.5 + Math.random() * 0.4);
        item.life = 0.06 + Math.random() * 0.05;
      }
    }
    this.muzzles.forEach(item => {
      if (item.life > 0) {
        item.life -= delta;
        item.sprite.material.opacity *= Math.pow(0.002, delta);
        if (item.life <= 0) item.sprite.material.opacity = 0;
      }
    });
    this.figures.forEach((figure, index) => {
      if (!figure.userData.baseX) return;
      const sway = state.fx.wind * 0.08;
      figure.position.x = figure.userData.baseX + Math.sin(elapsed * 0.4 + figure.userData.phase) * sway;
      figure.position.z = figure.userData.baseZ + Math.cos(elapsed * 0.3 + figure.userData.phase) * sway * 0.6;
    });
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    this.flameTexture.dispose();
    this.muzzleTexture.dispose();
  }
}
