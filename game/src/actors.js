import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {createActorAnimator, getMotionCacheStatus} from './animation/actor-animator.js';

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
    animationCache: getMotionCacheStatus(),
    actors: [...activeActors].map(actor => ({id: actor.id, variant: actor.variant, kind: actor.kind, label: actor.label, standInId: actor.standInId, source: actor.source, error: actor.error ?? null, warning: actor.warning ?? null, animation: actor.getAnimationDiagnostics()})),
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
      let hasBones = false;
      let hasDeformingMesh = false;
      gltf.scene.traverse(object => {
        hasBones ||= Boolean(object.isBone);
        if (object.isSkinnedMesh && object.geometry.attributes.skinIndex?.count === object.geometry.attributes.position?.count && object.geometry.attributes.skinWeight?.count === object.geometry.attributes.position?.count) hasDeformingMesh = true;
      });
      if ((asset.rigged || hasBones) && !hasDeformingMesh) {
        disposeResources(gltf.scene);
        throw new Error('Skeleton has no mesh with joint indices and skin weights');
      }
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

export function chooseStandIn(id, manifest) {
  if (['ELIJAH_ABLE', 'WALKER_LEWIS', 'JANE_MANNING'].includes(id)) return null;
  const female = /EMMA|LUCY|ELIZA|LOUISA|SARAH|SARIAH|ABISH|QUEEN|RUTH|JANE|MOURNER|REFUGEE|FUTURE_GUIDE|SURVIVOR|CARETAKER|CROWD_F/.test(id);
  const candidates = female ? ['LOUISA_FOLLETT', 'LOUISA'] : ['CHRISTIAN_WHITMER', 'JACOB_WHITMER', 'PETER_WHITMER_JR', 'JOHN_WHITMER', 'DAVID'];
  const available = candidates.filter(identity => manifest.characters[identity]?.asset);
  const seed = [...id].reduce((value, character) => value + character.charCodeAt(0), 0);
  return available.length ? available[seed % available.length] : null;
}

function provisionalFigure(id, variant) {
  const group = new THREE.Group();
  const seed = [...id].reduce((value, character) => value + character.charCodeAt(0), 0);
  const sacred = ['CHRIST', 'FATHER', 'JOHN_BAPTIST', 'PETER', 'JAMES', 'JOHN', 'MOSES', 'ELIAS', 'ELIJAH', 'MORONI'].includes(id);
  const female = /EMMA|LUCY|ELIZA|LOUISA|SARAH|SARIAH|ABISH|QUEEN|RUTH|JANE|MOURNER|REFUGEE|FUTURE_GUIDE|SURVIVOR|CARETAKER|CROWD_F/.test(id);
  const skin = namedMaterial(['ELIJAH_ABLE', 'WALKER_LEWIS', 'JANE_MANNING'].includes(id) ? '#865a40' : ['#ddac86', '#ba8565', '#efc8a0', '#a97657'][seed % 4]);
  const cloth = namedMaterial(id === 'CHRIST' && variant === 'red' ? '#984b41' : sacred ? '#f5ecd7' : ['#344750', '#4a4338', '#5c5b46', '#4b3540', '#364e47'][seed % 5]);
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

function rotateBoneInWorld(bone, rotation) {
  const parentRotation = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const worldRotation = bone.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentRotation.invert().multiply(rotation.clone().multiply(worldRotation)));
  bone.updateWorldMatrix(true, true);
}

function aimBone(bone, child, target) {
  const start = bone.getWorldPosition(new THREE.Vector3());
  const current = child.getWorldPosition(new THREE.Vector3()).sub(start).normalize();
  const desired = target.clone().sub(start).normalize();
  rotateBoneInWorld(bone, new THREE.Quaternion().setFromUnitVectors(current, desired));
}

function relaxUnanimatedArms(figure, root, height) {
  const bones = {};
  figure.traverse(object => { if (object.isBone) bones[object.name.replace(/^.*[:|]/, '').replace(/^mixamorig/i, '')] = object; });
  root.updateMatrixWorld(true);
  const orientation = root.getWorldQuaternion(new THREE.Quaternion());
  const down = new THREE.Vector3(0, -1, 0).applyQuaternion(orientation);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(orientation);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation);
  for (const [index, side] of ['Left', 'Right'].entries()) {
    const arm = bones[side + 'Arm'];
    const elbow = bones[side + 'ForeArm'];
    const hand = bones[side + 'Hand'];
    if (!arm || !elbow || !hand) continue;
    const shoulder = arm.getWorldPosition(new THREE.Vector3());
    const outward = index === 0 ? 1 : -1;
    aimBone(arm, elbow, shoulder.clone().addScaledVector(down, height * .2).addScaledVector(right, outward * height * .07));
    aimBone(elbow, hand, shoulder.clone().addScaledVector(down, height * .43).addScaledVector(forward, height * .025).addScaledVector(right, outward * height * .08));
  }
}

function solveLimb(upper, lower, tip, target, bendDirection) {
  const start = upper.getWorldPosition(new THREE.Vector3());
  const middle = lower.getWorldPosition(new THREE.Vector3());
  const end = tip.getWorldPosition(new THREE.Vector3());
  const upperLength = start.distanceTo(middle);
  const lowerLength = middle.distanceTo(end);
  if (upperLength < .005 || lowerLength < .005) return;
  const direction = target.clone().sub(start);
  const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(upperLength - lowerLength) + .001, upperLength + lowerLength - .001);
  direction.normalize();
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const across = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const bend = bendDirection.clone().addScaledVector(direction, -bendDirection.dot(direction));
  if (bend.lengthSq() < .0001) bend.set(1, 0, 0).addScaledVector(direction, -direction.x);
  bend.normalize();
  const knee = start.clone().addScaledVector(direction, along).addScaledVector(bend, across);
  aimBone(upper, lower, knee);
  aimBone(lower, tip, target);
}

function posePrayer(figure, holder, root, height) {
  const bones = {};
  figure.traverse(object => {
    if (!object.isBone) return;
    const name = object.name.replace(/[^a-z]/gi, '').toLowerCase();
    for (const key of ['Hips', 'Spine', 'Spine2', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot']) {
      if (name.endsWith(key.toLowerCase())) bones[key] = object;
    }
  });
  root.updateMatrixWorld(true);
  const rotation = root.getWorldQuaternion(new THREE.Quaternion());
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
  const completeLegs = ['Left', 'Right'].every(side => bones[side + 'UpLeg'] && bones[side + 'Leg'] && bones[side + 'Foot']);
  if (completeLegs) {
    const ankles = ['Left', 'Right'].map(side => bones[side + 'Foot'].getWorldPosition(new THREE.Vector3()));
    const ground = Math.min(...ankles.map(position => position.y));
    holder.position.y -= height * .23;
    root.updateMatrixWorld(true);
    for (const [index, side] of ['Left', 'Right'].entries()) {
      const target = ankles[index].addScaledVector(forward, -height * .17);
      target.y = ground + height * .015;
      solveLimb(bones[side + 'UpLeg'], bones[side + 'Leg'], bones[side + 'Foot'], target, forward);
    }
  }
  if (bones.Spine) rotateBoneInWorld(bones.Spine, new THREE.Quaternion().setFromAxisAngle(right, .08));
  if (bones.Head) rotateBoneInWorld(bones.Head, new THREE.Quaternion().setFromAxisAngle(right, .24));
  root.updateMatrixWorld(true);
  const chest = (bones.Spine2 ?? bones.Spine)?.getWorldPosition(new THREE.Vector3());
  if (chest) {
    chest.addScaledVector(forward, height * .14).addScaledVector(up, height * .025);
    for (const [index, side] of ['Left', 'Right'].entries()) {
      if (!bones[side + 'Arm'] || !bones[side + 'ForeArm'] || !bones[side + 'Hand']) continue;
      const sign = index === 0 ? -1 : 1;
      const target = chest.clone().addScaledVector(right, sign * height * .018);
      const bend = right.clone().multiplyScalar(sign * .5).addScaledVector(up, -1).normalize();
      solveLimb(bones[side + 'Arm'], bones[side + 'ForeArm'], bones[side + 'Hand'], target, bend);
    }
  }
  root.updateMatrixWorld(true);
  return completeLegs ? 'kneeling' : bones.Head || chest ? 'bowed' : null;
}

export async function createActor({id, variant, position = [0, 0, 0], rotation = 0, height, scene, player = false, onStatus} = {}) {
  if (!id) throw new Error('createActor requires a cast ID');
  const wardrobeID = /^CHRIST_(WHITE|RED)$/.exec(id);
  if (wardrobeID) { id = 'CHRIST'; variant ??= wardrobeID[1].toLowerCase(); }
  if (id === 'JEHOVAH') id = 'CHRIST';
  const ageID = /^ORSON_(YOUNG|ELDER)$/.exec(id);
  if (ageID) { id = 'ORSON'; variant ??= ageID[1].toLowerCase(); }
  const permittedVariants = id === 'CHRIST' ? ['white', 'red'] : id === 'ORSON' ? ['young', 'elder'] : [];
  const requestedVariant = permittedVariants.includes(variant) ? variant : null;
  const manifest = await loadAssetManifest();
  const variantProfile = requestedVariant ? manifest.characters[`${id}_${requestedVariant.toUpperCase()}`] : null;
  const profile = variantProfile?.asset ? variantProfile : manifest.characters[id];
  const label = manifest.characters[id]?.label ?? profile?.label ?? defaultLabel(id);
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
  let standInId = !profile?.asset ? chooseStandIn(id, manifest) : null;
  let selectedAsset = profile?.asset ?? manifest.characters[standInId]?.asset;
  if (selectedAsset) {
    const assetProfile = profile?.asset ? profile : manifest.characters[standInId];
    const candidates = [selectedAsset, ...(assetProfile?.variants ?? []).filter(asset => asset.rigged && asset.url !== selectedAsset.url)];
    for (const candidate of candidates) {
      try {
        onStatus?.(`Loading ${label}…`);
        resource = acquireAsset(candidate);
        const source = await resource.promise;
        figure = cloneSkeleton(source.scene);
        animations = source.animations;
        selectedAsset = candidate;
        kind = standInId ? 'stand-in' : 'model';
        errorMessage = null;
        break;
      } catch (error) {
        errorMessage = error.message;
        if (resource) releaseAsset(resource);
        resource = null;
        console.warn(`Character export rejected for ${label} (${candidate.file}):`, error.message);
      }
    }
    if (!figure) {
      standInId = null;
      selectedAsset = null;
    }
  }
  if (!figure) figure = provisionalFigure(id, requestedVariant);
  const resolvedVariant = kind === 'model' ? profile?.variant ?? profile?.defaultVariant ?? null : requestedVariant;
  root.userData.variant = resolvedVariant;
  figure.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(figure);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, .01);
  const figureHolder = new THREE.Group();
  figureHolder.scale.setScalar(scale);
  figureHolder.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  const holderRestPosition = figureHolder.position.clone();
  figureHolder.add(figure);
  root.add(figureHolder);
  root.userData.kind = kind;
  root.userData.label = label;
  let animator;
  let animationError;
  if (kind !== 'placeholder') {
    try { animator = await createActorAnimator({figure, holder: figureHolder, root, height: targetHeight}); }
    catch (error) { animationError = error.message; console.warn(`Motion library unavailable for ${label}:`, error.message); }
  }
  const rest = [];
  figure.traverse(object => {
    rest.push({object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone()});
  });
  if (!animator && animations.length) mixer = new THREE.AnimationMixer(figure);
  let currentMotion;
  let elapsed = 0;
  let disposed = false;
  const walkClip = animations.find(clip => clip.duration > .05 && /walk/i.test(clip.name));
  const runClip = animations.find(clip => clip.duration > .05 && /run/i.test(clip.name));
  const idleClip = animations.find(clip => clip.duration > .05 && /idle|stand|breath/i.test(clip.name));
  const prayClip = animations.find(clip => clip.duration > .05 && /pray|kneel/i.test(clip.name));
  const actor = {
    root, id, variant: resolvedVariant, requestedVariant, kind, label, standInId, error: errorMessage, warning: standInId ? `Temporary visual borrowed from ${manifest.characters[standInId]?.label ?? standInId}; not the identity of this story role.` : profile?.warning ?? null, source: selectedAsset?.file ?? null,
    setMotion(motion, options = {}) {
      motion = ({speak: 'talk', speaking: 'talk', listening: 'listen', sitting: 'sit', prayer: 'pray'})[motion] ?? motion;
      if (motion === currentMotion && !options.restart && options.speed === undefined || disposed) return;
      currentMotion = motion;
      if (animator) {
        root.userData.prayerPose = null;
        animator.setMotion(motion, options);
        if (motion === 'pray') root.userData.prayerPose = posePrayer(figure, figureHolder, root, targetHeight);
        animator.update(0);
        return;
      }
      mixer?.stopAllAction();
      figureHolder.position.copy(holderRestPosition);
      root.userData.prayerPose = null;
      for (const transform of rest) {
        transform.object.position.copy(transform.position);
        transform.object.quaternion.copy(transform.quaternion);
        transform.object.scale.copy(transform.scale);
      }
      const clip = motion === 'run' ? runClip ?? walkClip : motion === 'walk' ? walkClip ?? runClip : motion === 'pray' ? prayClip : idleClip;
      if (clip && mixer) mixer.clipAction(clip).reset().play();
      else if (walkClip && mixer) {
        const action = mixer.clipAction(walkClip).reset().play();
        action.time = Math.min(.12, walkClip.duration * .08);
        mixer.update(0);
        action.paused = true;
      }
      if (!clip && !walkClip && kind !== 'placeholder') relaxUnanimatedArms(figure, root, targetHeight);
      if (motion === 'pray' && !prayClip && kind !== 'placeholder') root.userData.prayerPose = posePrayer(figure, figureHolder, root, targetHeight);
      figure.updateMatrixWorld(true);
    },
    setAction(action, options = {}) { actor.setMotion(action, options); },
    getAnimationDiagnostics() { return animator?.diagnostics() ?? {motion: currentMotion, rig: kind, fallback: true, error: animationError ?? null, rootMotionOwner: 'motor'}; },
    getBoneSocket(name, target) { return animator?.getBoneSocket(name, target) ?? null; },
    getSocket(name) {
      const canonical = ({rightHand: 'RightHand', leftHand: 'LeftHand', head: 'Head', hips: 'Hips'})[name] ?? name;
      return animator?.profile.bones[canonical] ?? null;
    },
    update(delta) {
      if (disposed) return;
      elapsed += delta;
      animator?.update(delta);
      if (currentMotion !== 'pray' || prayClip) mixer?.update(delta);
      if (kind === 'placeholder') {
        const parts = figure.userData.parts;
        const moving = currentMotion === 'walk' || currentMotion === 'run';
        const stride = moving ? Math.sin(elapsed * (currentMotion === 'run' ? 12 : 7)) * .5 : 0;
        parts.arms.forEach((arm, index) => {
          arm.rotation.x = currentMotion === 'pray' ? -1.05 : stride * (index === 0 ? 1 : -1);
          arm.rotation.z = currentMotion === 'pray' ? (index === 0 ? .4 : -.4) : 0;
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
      animator?.dispose();
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
  onStatus?.(`${label} · ${kind === 'model' ? 'local Meshy model' : kind === 'stand-in' ? 'temporary borrowed Meshy visual' : 'provisional character model'}`);
  return actor;
}
