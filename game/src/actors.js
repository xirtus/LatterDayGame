import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

const manifestURL = new URL('./content/assets.json', document.baseURI);
const loader = new GLTFLoader();
const cache = new Map();
const activeActors = new Set();
let manifestPromise;
let manifestValue;
const ramp = new THREE.DataTexture(new Uint8Array([70, 135, 204, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;

export function loadAssetManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(manifestURL).then(response => {
      if (!response.ok) throw new Error(`Asset manifest: HTTP ${response.status}`);
      return response.json();
    }).then(value => { manifestValue = value; return value; }).catch(error => {
      console.warn('Character manifest unavailable; using provisional figures.', error);
      manifestValue = {characters: {}, glbCount: 0};
      return manifestValue;
    });
  }
  return manifestPromise;
}

export function getAssetStatus() {
  return {
    manifestReady: Boolean(manifestValue), glbCount: manifestValue?.glbCount ?? 0,
    loadedModels: cache.size,
    actors: [...activeActors].map(actor => ({id: actor.id, kind: actor.kind, label: actor.label, error: actor.error ?? null, warning: actor.warning ?? null})),
  };
}

function downsampleTexture(source, maximum = 2048) {
  if (!source?.image) return null;
  const original = source.image;
  const width = original.width ?? original.videoWidth;
  const height = original.height ?? original.videoHeight;
  if (!width || !height) return source.clone();
  const ratio = Math.min(1, maximum / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext('2d');
  context.drawImage(original, 0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = source.flipY;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.offset.copy(source.offset);
  texture.repeat.copy(source.repeat);
  texture.rotation = source.rotation;
  texture.center.copy(source.center);
  texture.anisotropy = 2;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function disposeResources(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.material ? [].concat(object.material) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && value !== ramp) textures.add(value);
    }
    object.skeleton?.dispose();
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}

function acquireAsset(asset) {
  const url = new URL(asset.url, manifestURL).href;
  let entry = cache.get(url);
  if (!entry) {
    entry = {references: 0, value: null, url};
    entry.promise = loader.loadAsync(url).then(gltf => {
      const textureMap = new Map();
      const sourceMaterials = new Set();
      const sourceTextures = new Set();
      gltf.scene.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const convert = source => {
          sourceMaterials.add(source);
          for (const value of Object.values(source)) if (value?.isTexture) sourceTextures.add(value);
          if (source.map && !textureMap.has(source.map)) textureMap.set(source.map, downsampleTexture(source.map));
          const material = new THREE.MeshToonMaterial({
            color: source.color?.clone() ?? new THREE.Color('#ffffff'),
            map: textureMap.get(source.map) ?? null, gradientMap: ramp,
            side: source.side, transparent: source.transparent, opacity: source.opacity,
            alphaTest: source.alphaTest ?? 0,
          });
          material.userData.outlineParameters = {thickness: .002, color: [.12, .09, .07], visible: true};
          return material;
        };
        object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
      });
      sourceMaterials.forEach(material => material.dispose());
      sourceTextures.forEach(texture => {
        texture.dispose();
        if (typeof texture.image?.close === 'function') texture.image.close();
      });
      entry.value = {scene: gltf.scene, animations: gltf.animations};
      return entry.value;
    }).catch(error => {
      if (cache.get(url) === entry) cache.delete(url);
      throw error;
    });
    cache.set(url, entry);
  }
  entry.references += 1;
  return entry;
}

function releaseAsset(entry) {
  entry.references -= 1;
  if (entry.references > 0) return;
  if (cache.get(entry.url) === entry) cache.delete(entry.url);
  if (entry.value) disposeResources(entry.value.scene);
}

function namedMaterial(color) {
  const material = new THREE.MeshToonMaterial({color, gradientMap: ramp});
  material.userData.outlineParameters = {thickness: .003, color: [.15, .1, .07], visible: true};
  return material;
}

function provisionalFigure(id) {
  const group = new THREE.Group();
  const seed = [...id].reduce((value, character) => value + character.charCodeAt(0), 0);
  const sacred = ['CHRIST', 'FATHER', 'JOHN_BAPTIST', 'PETER', 'JAMES', 'JOHN', 'MOSES', 'ELIAS', 'ELIJAH', 'MORONI'].includes(id);
  const female = /EMMA|LUCY|ELIZA|LOUISA|SARAH|RUTH|MOURNER|REFUGEE|FUTURE_GUIDE|SURVIVOR|CARETAKER/.test(id);
  const skin = namedMaterial(['#ddac86', '#ba8565', '#efc8a0', '#a97657'][seed % 4]);
  const cloth = namedMaterial(sacred ? '#f5ecd7' : ['#344750', '#4a4338', '#5c5b46', '#4b3540', '#364e47'][seed % 5]);
  const linen = namedMaterial('#e6d7bb');
  const hair = namedMaterial(sacred ? '#79634b' : ['#4b3529', '#846344', '#33302d', '#b8aaa0'][seed % 4]);
  const boots = namedMaterial('#292a27');
  const eye = namedMaterial('#242a2b');
  function part(geometry, material, x, y, z, parent = group) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const torso = part(new THREE.CylinderGeometry(.22, .19, .52, 8), cloth, 0, 1.15, 0);
  const head = part(new THREE.SphereGeometry(.15, 12, 10), skin, 0, 1.64, 0);
  head.scale.set(.9, 1.16, .94);
  part(new THREE.SphereGeometry(.153, 12, 8, 0, Math.PI * 2, 0, 1.65), hair, 0, 1.705, -.006);
  part(new THREE.BoxGeometry(.033, .018, .01), eye, -.052, 1.665, .133);
  part(new THREE.BoxGeometry(.033, .018, .01), eye, .052, 1.665, .133);
  part(new THREE.ConeGeometry(.025, .065, 4), skin, 0, 1.62, .148).rotation.x = Math.PI / 2;
  if (sacred || female) {
    part(new THREE.CylinderGeometry(.19, .32, .86, 10), cloth, 0, .68, -.01);
    if (sacred) part(new THREE.BoxGeometry(.11, .68, .025), linen, .09, 1.12, .2).rotation.z = -.3;
  } else {
    part(new THREE.BoxGeometry(.11, .35, .025), linen, 0, 1.25, .203);
    part(new THREE.BoxGeometry(.13, .5, .03), cloth, -.08, 1.2, .23).rotation.z = -.18;
    part(new THREE.BoxGeometry(.13, .5, .03), cloth, .08, 1.2, .23).rotation.z = .18;
    part(new THREE.BoxGeometry(.4, .36, .25), cloth, 0, .85, -.025);
  }
  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * .23, 1.35, 0);
    group.add(arm);
    part(new THREE.CylinderGeometry(.075, .055, .44, 7), cloth, side * .03, -.21, 0, arm);
    part(new THREE.SphereGeometry(.064, 8, 6), skin, side * .04, -.465, .02, arm);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * .1, .81, 0);
    group.add(leg);
    part(new THREE.CylinderGeometry(.085, .062, .64, 7), cloth, 0, -.32, 0, leg);
    part(new THREE.BoxGeometry(.13, .105, .24), boots, 0, -.71, .04, leg);
    legs.push(leg);
  }
  group.userData.parts = {arms, legs, torso, head};
  return group;
}

function defaultLabel(id) {
  return id.toLowerCase().split('_').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

export async function createActor({id, position = [0, 0, 0], rotation = 0, height, scene, player = false, onStatus} = {}) {
  if (!id) throw new Error('createActor requires a cast ID');
  const manifest = await loadAssetManifest();
  const profile = manifest.characters[id];
  const label = profile?.label ?? defaultLabel(id);
  const root = new THREE.Group();
  root.name = `actor:${id}`;
  root.userData.actorId = id;
  root.userData.player = player;
  if (position?.isVector3) root.position.copy(position);
  else root.position.fromArray(position);
  root.rotation.y = rotation;
  const targetHeight = height ?? (id === 'JOSEPH_CHILD' ? 1.2 : id === 'JOSEPH_YOUTH' ? 1.58 : 1.8);
  let resource;
  let figure;
  let mixer;
  let animations = [];
  let kind = 'placeholder';
  let errorMessage;
  if (profile?.asset) {
    try {
      onStatus?.(`Loading ${label}…`);
      resource = acquireAsset(profile.asset);
      const source = await resource.promise;
      figure = cloneSkeleton(source.scene);
      animations = source.animations;
      kind = 'model';
    } catch (error) {
      errorMessage = error.message;
      if (resource) releaseAsset(resource);
      resource = null;
      console.warn(`Using a provisional figure for ${label}:`, error.message);
    }
  }
  if (!figure) figure = provisionalFigure(id);
  figure.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(figure);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, .01);
  const figureHolder = new THREE.Group();
  figureHolder.scale.setScalar(scale);
  figureHolder.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  figureHolder.add(figure);
  root.add(figureHolder);
  root.userData.kind = kind;
  root.userData.label = label;
  const rest = [];
  figure.traverse(object => {
    rest.push({object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone()});
  });
  if (animations.length) mixer = new THREE.AnimationMixer(figure);
  let currentMotion;
  let elapsed = 0;
  let disposed = false;
  const walkClip = animations.find(clip => clip.duration > .05 && /walk/i.test(clip.name));
  const runClip = animations.find(clip => clip.duration > .05 && /run/i.test(clip.name));
  const idleClip = animations.find(clip => clip.duration > .05 && /idle|stand|breath/i.test(clip.name));
  const prayClip = animations.find(clip => clip.duration > .05 && /pray|kneel/i.test(clip.name));
  const actor = {
    root, id, kind, label, error: errorMessage, warning: profile?.warning ?? null, source: profile?.asset?.file ?? null,
    setMotion(motion) {
      if (motion === currentMotion || disposed) return;
      currentMotion = motion;
      mixer?.stopAllAction();
      for (const transform of rest) {
        transform.object.position.copy(transform.position);
        transform.object.quaternion.copy(transform.quaternion);
        transform.object.scale.copy(transform.scale);
      }
      if (!mixer) return;
      const clip = motion === 'run' ? runClip ?? walkClip : motion === 'walk' ? walkClip ?? runClip : motion === 'pray' ? prayClip ?? idleClip : idleClip;
      if (clip) mixer.clipAction(clip).reset().play();
      else if (walkClip) {
        const action = mixer.clipAction(walkClip).reset().play();
        action.time = Math.min(.12, walkClip.duration * .08);
        mixer.update(0);
        action.paused = true;
      }
      figure.updateMatrixWorld(true);
    },
    update(delta) {
      if (disposed) return;
      elapsed += delta;
      mixer?.update(delta);
      if (kind === 'placeholder') {
        const parts = figure.userData.parts;
        const moving = currentMotion === 'walk' || currentMotion === 'run';
        const stride = moving ? Math.sin(elapsed * (currentMotion === 'run' ? 12 : 7)) * .5 : 0;
        parts.arms.forEach((arm, index) => {
          arm.rotation.x = currentMotion === 'pray' ? -1.05 : stride * (index === 0 ? 1 : -1);
          arm.rotation.z = currentMotion === 'pray' ? (index === 0 ? -.4 : .4) : 0;
        });
        parts.legs.forEach((leg, index) => { leg.rotation.x = stride * (index === 0 ? -1 : 1); });
        parts.head.rotation.x = currentMotion === 'pray' ? .18 : 0;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      mixer?.stopAllAction();
      mixer?.uncacheRoot(figure);
      if (resource) {
        figure.traverse(object => object.skeleton?.dispose());
        releaseAsset(resource);
      } else disposeResources(figure);
      activeActors.delete(actor);
    },
  };
  activeActors.add(actor);
  actor.setMotion('idle');
  scene?.add(root);
  onStatus?.(`${label} · ${kind === 'model' ? 'local Meshy model' : 'provisional character model'}`);
  return actor;
}
