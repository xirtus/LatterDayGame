import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vWorldPosition;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 cloudColor;
  uniform vec3 sunColor;
  uniform vec3 moonColor;
  uniform vec3 sunDirection;
  uniform vec3 moonDirection;
  uniform float cloudCover;
  uniform float haze;
  uniform float stars;
  uniform float moonStrength;
  uniform float moonPhase;
  uniform float sunStrength;
  uniform float flash;
  uniform float time;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(13.7, 9.1);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vWorldPosition - cameraPosition);
    float h = clamp(dir.y, -0.15, 1.0);
    vec3 sky = mix(horizonColor, topColor, pow(max(h, 0.0), 0.62));
    sky = mix(sky, horizonColor, exp(-abs(h) * 7.0) * haze * 0.55);

    float sunDot = max(dot(dir, normalize(sunDirection)), 0.0);
    float disk = smoothstep(0.99935, 0.99988, sunDot);
    float glow = pow(sunDot, 90.0) * 0.55 + pow(sunDot, 8.0) * 0.12;
    sky += sunColor * (disk * 1.7 + glow) * sunStrength;

    float moonDot = max(dot(dir, normalize(moonDirection)), 0.0);
    float moonDisk = smoothstep(0.99955, 0.99993, moonDot);
    // A simple phase term: darken one limb of the disc.
    vec3 moonSide = normalize(cross(moonDirection, vec3(0.0, 1.0, 0.0)) + 0.0001);
    float phaseMask = smoothstep(-0.35, 0.65, dot(dir - moonDirection * moonDot, moonSide) * 2.2 + (moonPhase - 0.5) * 1.6);
    sky += moonColor * moonDisk * moonStrength * (0.75 + 0.35 * phaseMask);

    if (h > 0.0 && stars > 0.001) {
      vec2 starUv = dir.xz / max(dir.y, 0.045) * 46.0;
      vec2 cell = floor(starUv);
      float sparkle = step(0.9965, hash21(cell));
      float twinkle = 0.65 + 0.35 * sin(time * 0.8 + hash21(cell + 7.0) * 20.0);
      sky += vec3(0.85, 0.9, 1.0) * sparkle * stars * twinkle * smoothstep(0.0, 0.2, dir.y);
    }

    if (h > 0.0) {
      vec2 cloudUv = dir.xz / (dir.y + 0.22) * 1.15;
      float n = fbm(cloudUv * 1.35 + vec2(time * 0.0025, 0.0));
      float cover = smoothstep(1.0 - cloudCover, 1.0 - cloudCover + 0.18, n);
      float lit = 0.32 + 0.68 * max(sunDot, 0.15);
      vec3 cloud = cloudColor * lit;
      sky = mix(sky, cloud, cover * 0.92);
    }

    sky += vec3(flash) * (0.25 + 0.75 * max(h, 0.0));
    gl_FragColor = vec4(max(sky, 0.0), 1.0);
  }
`;

export class SkyDome {
  constructor(scene, {quality = 'high'} = {}) {
    this.scene = scene;
    this.uniforms = {
      topColor: {value: new THREE.Color('#6f9bb5')},
      horizonColor: {value: new THREE.Color('#e4dcc4')},
      cloudColor: {value: new THREE.Color('#d8d4c8')},
      sunColor: {value: new THREE.Color('#ffe0a8')},
      moonColor: {value: new THREE.Color('#bcd4ff')},
      sunDirection: {value: new THREE.Vector3(0, 1, 0)},
      moonDirection: {value: new THREE.Vector3(0, 1, 0)},
      cloudCover: {value: 0.3},
      haze: {value: 0.2},
      stars: {value: 0},
      moonStrength: {value: 0},
      moonPhase: {value: 0.5},
      sunStrength: {value: 1},
      flash: {value: 0},
      time: {value: 0},
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(620, quality === 'low' ? 20 : 40, quality === 'low' ? 12 : 24), material);
    this.mesh.name = 'lighting-studio-sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);
  }

  update(state, camera, elapsed) {
    const sky = state.sky;
    this.uniforms.topColor.value.set(sky.top);
    this.uniforms.horizonColor.value.set(sky.horizon);
    this.uniforms.cloudColor.value.set(sky.cloudTint);
    this.uniforms.sunColor.value.set(state.sun.color);
    this.uniforms.moonColor.value.set('#bcd4ff');
    this.uniforms.cloudCover.value = sky.cloudCover;
    this.uniforms.haze.value = sky.haze;
    this.uniforms.stars.value = sky.stars;
    this.uniforms.moonStrength.value = sky.moon;
    this.uniforms.moonPhase.value = sky.moonPhase ?? 0.5;
    this.uniforms.time.value = elapsed;
    this.uniforms.sunDirection.value.copy(this.sunDirection || new THREE.Vector3(0, 1, 0));
    this.uniforms.moonDirection.value.copy(this.moonDirection || new THREE.Vector3(0, 1, 0));
    this.uniforms.sunStrength.value = state.sun.elevation > -3 ? 1 : 0;
    this.mesh.position.copy(camera.position);
    this.mesh.scale.setScalar(Math.min(620, camera.far * 0.8) / 620);
  }

  setDirections(sunDirection, moonDirection) {
    this.sunDirection = sunDirection;
    this.moonDirection = moonDirection;
  }

  setFlash(value) {
    this.uniforms.flash.value = value;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
