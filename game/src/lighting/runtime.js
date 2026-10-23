import * as THREE from 'three';
import {SkyDome} from './sky.js';
import {WeatherSystem} from './weather.js';
import {createComposer} from './grade.js';
import presetData from '../../content/lighting-presets.json';
import cueData from '../../content/scene-cues.json';

const presets = new Map(presetData.presets.map(preset => [preset.id, preset]));
const owners = new WeakMap();
const clone = value => JSON.parse(JSON.stringify(value));

function merge(base, patch) {
  const result = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(result[key] || {}, value) : value;
  }
  return result;
}

function direction(azimuth, elevation) {
  const azimuthRadians = THREE.MathUtils.degToRad(azimuth);
  const elevationRadians = THREE.MathUtils.degToRad(elevation);
  return new THREE.Vector3(Math.sin(azimuthRadians) * Math.cos(elevationRadians), Math.sin(elevationRadians), Math.cos(azimuthRadians) * Math.cos(elevationRadians));
}

function blend(current, target, amount) {
  for (const [key, value] of Object.entries(target)) {
    if (typeof value === 'number') current[key] = Number.isFinite(current[key]) ? current[key] + (value - current[key]) * amount : value;
    else if (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) {
      current[key] = `#${new THREE.Color(current[key]).lerp(new THREE.Color(value), amount).getHexString()}`;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) blend(current[key], value, amount);
    else current[key] = value;
  }
}

export function resolveLightingState(chapterId, objective = null, event = null) {
  const entry = cueData.chapters[String(chapterId)];
  if (!entry) throw new Error(`No authored lighting cues for chapter ${chapterId}`);
  const base = presets.get(entry.presetId);
  if (!base) throw new Error(`Missing lighting preset ${entry.presetId}`);
  let state = clone(base);
  const objectiveId = typeof objective === 'number' ? entry.objectives[objective]?.objectiveId : objective;
  const cue = entry.objectives.find(item => item.objectiveId === objectiveId);
  if (cue) state = merge(state, cue.fields);
  const eventCue = entry.events?.[event];
  if (eventCue) state = merge(state, eventCue.fields);
  state.presetId = base.id;
  state.objectiveId = cue?.objectiveId ?? null;
  state.eventId = eventCue ? event : null;
  state.cueLabel = eventCue?.label || cue?.label || base.shortLabel;
  return state;
}

export function createLightingRuntime({renderer, scene, camera, world = null, chapter, quality = 'high', reducedMotion = false, reducedFlash = true, outline = null}) {
  if (owners.has(scene)) throw new Error('This scene already has a lighting runtime owner');
  let disposed = false;
  let activeWorld = null;
  let activeChapter = chapter;
  let state = resolveLightingState(chapter.id);
  let target = clone(state);
  let savedScene = {background: scene.background, fog: scene.fog};
  let disabledLights = [];
  let practicalLights = [];
  let stagedPracticalLights = [];
  let materialColors = [];
  let elapsedTime = 0;
  let frameDelta = 0;
  const focus = new THREE.Vector3();
  const lightGroup = new THREE.Group();
  lightGroup.name = 'shared-lighting-runtime';
  lightGroup.userData.lightingOwner = true;
  const hemisphere = new THREE.HemisphereLight('#c0d2d0', '#6b6a4b', 0.6);
  const sun = new THREE.DirectionalLight('#ffe0a8', 2.6);
  const fill = new THREE.DirectionalLight('#a7c2d2', 0.25);
  const rim = new THREE.DirectionalLight('#ffe9bd', 0.5);
  const lamp = new THREE.PointLight('#ffd08a', 0, 12, 2);
  const torchLights = Array.from({length: quality === 'low' ? 2 : 4}, () => new THREE.PointLight('#ff8a3c', 0, 14, 2));
  hemisphere.name = 'shared-hemisphere';
  sun.name = 'shared-sun';
  fill.name = 'shared-fill';
  rim.name = 'shared-rim';
  lamp.name = 'shared-lamp';
  sun.shadow.mapSize.set(quality === 'low' ? 512 : 2048, quality === 'low' ? 512 : 2048);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.06;
  Object.assign(sun.shadow.camera, {left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 190});
  lightGroup.add(hemisphere, sun, sun.target, fill, fill.target, rim, rim.target, lamp, ...torchLights);
  scene.add(lightGroup);
  const sky = new SkyDome(scene, {quality});
  const weather = new WeatherSystem(scene, {quality, reducedMotion, reducedFlash});
  const post = createComposer(renderer, scene, camera, {outline, quality, reducedMotion});
  const fog = new THREE.FogExp2(state.fog.color, state.fog.density);
  const washMaterial = new THREE.MeshBasicMaterial({color: state.groundWash.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide});
  const groundWash = new THREE.Mesh(new THREE.CircleGeometry(130, quality === 'low' ? 24 : 64), washMaterial);
  groundWash.rotation.x = -Math.PI / 2;
  groundWash.position.y = 0.025;
  groundWash.name = 'shared-ground-wash';
  groundWash.renderOrder = 2;
  lightGroup.add(groundWash);

  function restoreWorld() {
    disabledLights.forEach(({light, visible}) => { light.visible = visible; });
    practicalLights.forEach(({light, intensity, visible, color}) => {
      light.intensity = intensity;
      light.visible = visible;
      light.color.copy(color);
    });
    materialColors.forEach(({material, color}) => { material.color.copy(color); });
    disabledLights = [];
    practicalLights = [];
    materialColors = [];
  }

  function attachWorld(nextWorld, nextChapter = activeChapter) {
    restoreWorld();
    activeWorld = nextWorld;
    activeChapter = nextChapter;
    savedScene = {background: scene.background, fog: scene.fog};
    state = resolveLightingState(activeChapter.id);
    target = clone(state);
    const seenLights = new Set();
    const seenMaterials = new Set();
    activeWorld?.group?.traverse(object => {
      if (object.isLight && !seenLights.has(object)) {
        seenLights.add(object);
        if (object.isPointLight || object.isSpotLight) {
          practicalLights.push({light: object, intensity: object.intensity, visible: object.visible, color: object.color.clone(), role: object.userData.lightingRole || 'lamp'});
        } else {
          disabledLights.push({light: object, visible: object.visible});
          object.visible = false;
        }
      }
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        const role = material?.userData.lightingRole || object.userData.lightingRole;
        if (material?.color && !seenMaterials.has(material) && ['foliage', 'ground', 'accent'].includes(role)) {
          seenMaterials.add(material);
          materialColors.push({material, color: material.color.clone(), role});
        }
      }
    });
    applyLighting();
    return api;
  }

  function applyLighting() {
    focus.copy(activeWorld?.focus || new THREE.Vector3());
    const sunDirection = direction(state.sun.azimuth, state.sun.elevation);
    const moonDirection = direction((state.sun.azimuth + 180) % 360, state.sun.elevation < -2 ? 34 : -24);
    for (const [light, settings, distance] of [[sun, state.sun, 58], [fill, state.fill, 38], [rim, state.rim, 32]]) {
      const lightDirection = light === sun && state.sun.elevation < -2 ? moonDirection : direction(settings.azimuth, settings.elevation);
      light.position.copy(focus).addScaledVector(lightDirection, distance);
      light.target.position.copy(focus);
      light.target.updateMatrixWorld();
      light.color.set(settings.color);
      light.intensity = settings.intensity;
    }
    sun.castShadow = quality !== 'low' && state.sun.shadows > 0.05;
    hemisphere.color.set(state.ambient.sky);
    hemisphere.groundColor.set(state.ambient.ground);
    hemisphere.intensity = state.ambient.intensity + (state.interior ? state.practical.bounce ?? 0.28 : 0);
    const registeredLamps = practicalLights.filter(item => item.role !== 'torch');
    const registeredTorches = practicalLights.filter(item => item.role === 'torch');
    lamp.intensity = registeredLamps.length ? 0 : state.practical.lamp * 6.2;
    lamp.color.set(state.practical.lampColor);
    lamp.position.copy(focus).add(new THREE.Vector3(0, state.interior ? 0.9 : 2.4, 0));
    lamp.distance = state.interior ? 10 : 16;
    practicalLights.forEach(({light, intensity, visible, role}) => {
      const power = role === 'torch' ? state.practical.torch : state.practical.lamp;
      light.visible = visible && power > 0.01;
      light.intensity = intensity * power * 0.55;
      light.color.set(role === 'torch' ? state.practical.torchColor : state.practical.lampColor);
    });
    torchLights.forEach((light, index) => {
      light.intensity = registeredTorches.length || stagedPracticalLights.length || index >= state.practical.torchCount ? 0 : state.practical.torch * 10;
      light.color.set(state.practical.torchColor);
      const angle = index / torchLights.length * Math.PI * 2;
      light.position.set(focus.x + Math.cos(angle) * 6, focus.y + 1, focus.z + Math.sin(angle) * 6);
    });
    materialColors.forEach(({material, color, role}) => {
      material.color.copy(color).lerp(new THREE.Color(state.palette[role]), state.palette.strength ?? (role === 'foliage' ? 0.62 : 0.28));
    });
    groundWash.visible = Boolean(activeWorld) && !state.interior && state.groundWash.opacity > 0.004;
    washMaterial.color.set(state.groundWash.color);
    washMaterial.opacity = state.groundWash.opacity;
    fog.color.set(state.fog.color);
    fog.density = state.fog.density;
    scene.fog = fog;
    scene.background = null;
    sky.setDirections(sunDirection, moonDirection);
    sky.update(state, camera, reducedMotion ? 0 : elapsedTime);
    weather.setSunDirection(sunDirection);
    post.update(state, elapsedTime);
  }

  const api = {
    attachWorld,
    registerStagedPracticals(lights = []) {
      stagedPracticalLights = [...new Set(lights)];
      applyLighting();
    },
    setObjective(objective) {
      const next = resolveLightingState(activeChapter.id, objective);
      if (next.objectiveId === target.objectiveId && target.eventId === null) return;
      target = next;
      if (reducedMotion) state = clone(target);
    },
    setEvent(event) {
      target = resolveLightingState(activeChapter.id, target.objectiveId, event);
      if (reducedMotion) state = clone(target);
    },
    applyState(nextState) {
      state = clone(nextState);
      target = clone(state);
      applyLighting();
    },
    update(delta = 0, elapsed = 0, playerOrCamera) {
      if (disposed) return;
      frameDelta = Math.min(Math.max(delta, 0), 0.1);
      elapsedTime = elapsed;
      blend(state, target, reducedMotion ? 1 : 1 - Math.exp(-frameDelta * 1.8));
      const position = playerOrCamera?.position || playerOrCamera?.root?.position || playerOrCamera?.group?.position || playerOrCamera;
      if (position?.isVector3) weather.group.position.set(position.x, 0, position.z);
      const flash = weather.update(state, reducedMotion ? 0 : frameDelta, reducedMotion ? 0 : elapsed, camera);
      sky.setFlash(reducedFlash || reducedMotion ? 0 : flash);
      applyLighting();
    },
    render() {
      if (!disposed) post.render(frameDelta);
    },
    resize(width, height) {
      const size = renderer.getSize(new THREE.Vector2());
      post.setSize(width || size.x, height || size.y, Math.min(renderer.getPixelRatio(), quality === 'low' ? 1 : 1.5));
    },
    getState() {
      return {...clone(state), schema: 'zion-lighting-runtime/v1', presetSchema: presetData.schema, cueSchema: cueData.schema, quality, reducedMotion, reducedFlash, transitionTarget: target.objectiveId, registeredPracticalLights: practicalLights.length, disabledDefaultLights: disabledLights.length};
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restoreWorld();
      sky.dispose();
      weather.dispose();
      post.dispose();
      groundWash.geometry.dispose();
      washMaterial.dispose();
      sun.shadow.map?.dispose();
      sun.shadow.mapPass?.dispose();
      scene.remove(lightGroup);
      if (scene.fog === fog) {
        scene.fog = savedScene.fog;
        scene.background = savedScene.background;
      }
      owners.delete(scene);
    },
  };
  owners.set(scene, api);
  attachWorld(world, chapter);
  api.resize();
  return api;
}
