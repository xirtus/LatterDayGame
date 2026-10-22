import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const models = {
  joseph: 'josephsmith_rigged.glb',
  youth: 'Meshy_AI_young_joseph_smith_ri_All_Animations.glb',
  emma: 'Meshy_AI_Emma_Smith_Rigged_All_Animations.glb',
  oliver: 'Meshy_AI_Rigged_Oliver_Cowdery_All_Animations.glb',
  hyrum: 'Meshy_AI_Hyrum_Smith_Rigged_All_Animations.glb',
  moroni: 'Meshy_AI_Moroni_Rigged_All_Animations.glb',
  nephi: 'Meshy_AI_Nephi_Rigged_All_Animations.glb',
  brigham: 'Brigham_Young_Rigged.glb',
};
const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8e4da');
const camera = new THREE.PerspectiveCamera(36, 1, .05, 100);
camera.position.set(0, 1.25, 7.3);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, .95, 0);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 24;
scene.add(new THREE.HemisphereLight('#fff4e2', '#aeb49d', 1.3));
const sun = new THREE.DirectionalLight('#fff4e2', 2.0);
sun.position.set(-3, 5, 4);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({color: '#d6d2c4'}));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.008;
scene.add(ground);
const outline = new OutlineEffect(renderer, {defaultThickness: .0025, defaultColor: [.165, .102, .078]});
const ramp = new THREE.DataTexture(new Uint8Array([65, 135, 205, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;
const loader = new GLTFLoader();
let wrappers = [];
let mixers = [];
let currentAsset = null;
let requestVersion = 0;
const materialPairs = [];

function updateToonMaterial() {
  const clay = document.querySelector('#clay').checked;
  for (const pair of materialPairs) {
    pair.toon.map = clay ? null : pair.source.map;
    pair.toon.color.set(clay ? '#c9b697' : '#ffffff');
    pair.toon.needsUpdate = true;
  }
}

function setMotion(name) {
  for (const mixer of mixers) mixer.stopAllAction();
  for (const wrapper of wrappers) {
    for (const rest of wrapper.userData.restTransforms) {
      rest.object.position.copy(rest.position);
      rest.object.quaternion.copy(rest.quaternion);
      rest.object.scale.copy(rest.scale);
      rest.object.updateMatrix();
    }
    wrapper.updateMatrixWorld(true);
  }
  if (!name || !currentAsset) return;
  const clip = currentAsset.animations.find(animation => animation.name === name);
  if (clip) mixers.forEach(mixer => mixer.clipAction(clip).reset().play());
}

function disposeCurrent() {
  const geometries = new Set();
  const textures = new Set();
  const materials = new Set();
  for (const wrapper of wrappers) {
    scene.remove(wrapper);
    wrapper.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture && value !== ramp) textures.add(value);
        }
      }
    });
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const mixer of mixers) {
    mixer.stopAllAction();
    mixer.uncacheRoot(mixer.getRoot());
  }
  wrappers = [];
  mixers = [];
  materialPairs.length = 0;
}

async function loadCharacter(name) {
  const version = ++requestVersion;
  status.textContent = 'Loading selected local GLB…';
  document.querySelector('#character').disabled = true;
  try {
    const asset = await loader.loadAsync('../meshy/' + encodeURIComponent(models[name]));
    if (version !== requestVersion) return;
    disposeCurrent();
    currentAsset = asset;
    let triangles = 0;
    asset.scene.traverse(object => {
      if (object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    });
    for (const [index, offset] of [-1.15, 1.15].entries()) {
      const figure = clone(asset.scene);
      figure.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(figure);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 1.85 / Math.max(size.y, .01);
      const wrapper = new THREE.Group();
      figure.scale.multiplyScalar(scale);
      figure.position.add(new THREE.Vector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale));
      wrapper.position.x = offset;
      wrapper.add(figure);
      wrapper.userData.figure = figure;
      wrapper.userData.restTransforms = [];
      figure.traverse(object => {
        wrapper.userData.restTransforms.push({object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone()});
      });
      figure.traverse(object => {
        if (!object.isMesh) return;
        const convert = source => {
          if (index === 0) {
            const original = source.clone();
            original.userData.outlineParameters = {visible: false};
            return original;
          }
          const toon = new THREE.MeshToonMaterial({map: source.map, gradientMap: ramp, color: '#ffffff', side: source.side});
          toon.userData.outlineParameters = {visible: true};
          materialPairs.push({source, toon});
          return toon;
        };
        object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
      });
      wrappers.push(wrapper);
      mixers.push(new THREE.AnimationMixer(figure));
      scene.add(wrapper);
    }
    const motion = document.querySelector('#motion');
    motion.replaceChildren(new Option('Bind pose', ''), ...asset.animations.map(animation => new Option(animation.duration <= .05 ? 'Static source pose' : animation.name, animation.name)));
    updateToonMaterial();
    const movingClips = asset.animations.filter(animation => animation.duration > .05).length;
    status.textContent = `${models[name]} · ${Math.round(triangles).toLocaleString()} triangles per model · ${movingClips} motion clips · Textured toon retains the original atlas; clay reveals geometry`;
    document.body.dataset.ready = 'true';
    window.characterStudy = {scene, camera, renderer, setMotion, models};
  } catch (error) {
    status.textContent = 'Could not load this model: ' + error.message;
    document.body.dataset.ready = 'error';
  } finally {
    document.querySelector('#character').disabled = false;
  }
}

document.querySelector('#character').add(new Option('Brigham', 'brigham'));
document.querySelector('#character').addEventListener('change', event => loadCharacter(event.target.value));
document.querySelector('#motion').addEventListener('change', event => setMotion(event.target.value));
document.querySelector('#clay').addEventListener('change', updateToonMaterial);
const resize = () => {
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
  const distance = Math.max(4.8, 2.55 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  camera.position.copy(controls.target).add(new THREE.Vector3(0, .25, distance));
};
new ResizeObserver(resize).observe(stage);
resize();
let previousTime = performance.now();
renderer.setAnimationLoop(time => {
  const delta = Math.min((time - previousTime) / 1000, .05);
  previousTime = time;
  for (const mixer of mixers) mixer.update(delta);
  if (document.querySelector('#rotate').checked) wrappers.forEach(wrapper => { wrapper.rotation.y += delta * .25; });
  controls.update();
  outline.render(scene, camera);
});
await loadCharacter('joseph');
