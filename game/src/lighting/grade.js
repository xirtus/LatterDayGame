import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: {value: null},
    contrast: {value: 1.03},
    saturation: {value: 1.0},
    temperature: {value: 0.02},
    tint: {value: 0.0},
    lift: {value: 0.0},
    gamma: {value: 1.0},
    gain: {value: 1.0},
    shadowColor: {value: new THREE.Color('#39434a')},
    shadowStrength: {value: 0.15},
    vignette: {value: 0.3},
    grain: {value: 0.06},
    chromatic: {value: 0.0},
    letterbox: {value: 0.0},
    time: {value: 0},
    resolution: {value: new THREE.Vector2(1, 1)},
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    uniform float temperature;
    uniform float tint;
    uniform float lift;
    uniform float gamma;
    uniform float gain;
    uniform vec3 shadowColor;
    uniform float shadowStrength;
    uniform float vignette;
    uniform float grain;
    uniform float chromatic;
    uniform float letterbox;
    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float radius = dot(centered, centered);
      float aberration = chromatic * radius;
      vec3 color;
      color.r = texture2D(tDiffuse, uv + centered * aberration).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - centered * aberration).b;

      color = pow(max(color, 0.0), vec3(1.0 / max(gamma, 0.01)));
      color = color * gain + lift;
      color = (color - 0.5) * contrast + 0.5;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);
      color.r += temperature * 0.12;
      color.b -= temperature * 0.12;
      color.g += tint * 0.12;

      float shadow = 1.0 - smoothstep(0.0, 0.62, luma);
      color = mix(color, color * shadowColor * 1.55, shadow * shadowStrength * 0.7);

      float vig = smoothstep(0.95, 0.22, length(centered) * 1.6);
      color *= mix(1.0, vig, vignette);

      if (grain > 0.0) {
        float n = hash(uv * resolution + vec2(time * 57.0, time * 31.0)) - 0.5;
        color += n * grain * 0.14;
      }

      if (letterbox > 0.0) {
        float bar = letterbox * 0.5;
        if (uv.y < bar || uv.y > 1.0 - bar) color = vec3(0.0);
      }

      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

export function createComposer(renderer, scene, camera, {outline, quality = 'high', reducedMotion = false} = {}) {
  const originalToneMapping = renderer.toneMapping;
  const originalExposure = renderer.toneMappingExposure;
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  if (outline && quality !== 'low') {
    renderPass.render = function(activeRenderer, writeBuffer, readBuffer) {
      const autoClear = activeRenderer.autoClear;
      const outlineAutoClear = outline.autoClear;
      activeRenderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
      activeRenderer.clear();
      outline.autoClear = false;
      try {
        outline.render(scene, camera);
      } finally {
        outline.autoClear = outlineAutoClear;
        activeRenderer.autoClear = autoClear;
      }
    };
  }
  composer.addPass(renderPass);

  const bloom = quality === 'low' ? null : new UnrealBloomPass(new THREE.Vector2(1, 1), 0.0, 0.65, 0.85);
  if (bloom) composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  const output = new OutputPass();
  composer.addPass(output);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  return {
    composer,
    renderPass,
    bloom,
    grade,
    output,
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      grade.uniforms.resolution.value.set(width, height);
    },
    render(delta) {
      composer.render(delta);
    },
    update(state, time) {
      renderer.toneMappingExposure = state.grade.exposure;
      if (bloom) {
        bloom.strength = state.grade.bloom;
        bloom.threshold = state.grade.bloomThreshold;
      }
      grade.uniforms.contrast.value = state.grade.contrast;
      grade.uniforms.saturation.value = state.grade.saturation;
      grade.uniforms.temperature.value = state.grade.temperature;
      grade.uniforms.tint.value = state.grade.tint;
      grade.uniforms.lift.value = state.grade.lift;
      grade.uniforms.gamma.value = state.grade.gamma;
      grade.uniforms.gain.value = state.grade.gain;
      grade.uniforms.shadowColor.value.set(state.grade.shadowColor);
      grade.uniforms.shadowStrength.value = state.grade.shadowStrength;
      grade.uniforms.vignette.value = state.grade.vignette;
      grade.uniforms.grain.value = reducedMotion || quality === 'low' ? 0 : state.grade.grain;
      grade.uniforms.chromatic.value = state.grade.chromatic;
      grade.uniforms.letterbox.value = state.grade.letterbox;
      grade.uniforms.time.value = reducedMotion ? 0 : time;
    },
    dispose() {
      renderPass.dispose?.();
      bloom?.dispose();
      grade.dispose();
      output.dispose();
      composer.dispose?.();
      renderer.toneMapping = originalToneMapping;
      renderer.toneMappingExposure = originalExposure;
    },
  };
}
