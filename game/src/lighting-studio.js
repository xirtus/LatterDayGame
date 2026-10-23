import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createWorld} from './world.js';
import {Staging} from './lighting/staging.js';
import {createLightingRuntime} from './lighting/runtime.js';
import presetData from '../content/lighting-presets.json';
import chapterData from '../content/chapters.json';

const PRESETS = presetData.presets;
const PRESET_BY_ID = new Map(PRESETS.map(preset => [preset.id, preset]));
const CHAPTERS = chapterData.chapters;
const CHAPTER_BY_ID = new Map(CHAPTERS.map(chapter => [chapter.id, chapter]));
const STORAGE_KEY = 'zion-lighting-studio-saves-v1';
const clone = value => JSON.parse(JSON.stringify(value));

function merge(base, patch) {
  if (Array.isArray(patch)) return clone(patch);
  if (patch === null || typeof patch !== 'object') return patch;
  const output = Array.isArray(base) ? clone(base) : {...(base || {})};
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) output[key] = merge(output[key], value);
    else output[key] = clone(value);
  }
  return output;
}

function getPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const parts = path.split('.');
  let cursor = object;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!cursor[parts[index]] || typeof cursor[parts[index]] !== 'object') cursor[parts[index]] = {};
    cursor = cursor[parts[index]];
  }
  cursor[parts[parts.length - 1]] = value;
}

function deg(value) { return THREE.MathUtils.degToRad(value); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function pad2(value) { return String(value).padStart(2, '0'); }
function formatTime(hours) {
  const wrapped = ((hours % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.round((wrapped - h) * 60);
  return `${pad2(h === 24 ? 0 : h)}:${pad2(m === 60 ? 0 : m)}`;
}
function formatNumber(value, digits = 0) {
  return Number(value).toFixed(digits).replace(/\.0+$/, '');
}

function sunDirection(azimuth, elevation) {
  const az = deg(azimuth);
  const el = deg(elevation);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

function solarPosition(dateString, hour, latitude, longitude, timezone) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const day = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - start) / 86400000) + 1;
  const ut = hour - timezone;
  const gamma = 2 * Math.PI / 365 * (day - 1 + (ut - 12) / 24);
  const eqtime = 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const tst = (ut * 60 + eqtime + 4 * longitude) % 1440;
  const ha = deg(tst / 4 - 180);
  const lat = deg(latitude);
  const altitude = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha));
  const azimuth = 180 + THREE.MathUtils.radToDeg(Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)));
  return {azimuth: (azimuth + 360) % 360, elevation: THREE.MathUtils.radToDeg(altitude)};
}

function moonPhase(dateString) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const reference = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - reference) / 86400000;
  return ((days % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853;
}

function moonIllumination(phase) { return (1 - Math.cos(2 * Math.PI * phase)) / 2; }

const DEFAULT_STATE = (() => {
  const base = clone(PRESET_BY_ID.get('chapter-30'));
  base.presetId = 'chapter-30';
  base.autoSun = true;
  base.animateTime = false;
  base.timeSpeed = 0.035;
  base.autoOrbit = false;
  base.blocking = false;
  base.showPresetNote = true;
  base.allowIndoorWeather = false;
  base.palette.strength = 0.62;
  base.practical.bounce = 0.28;
  return base;
})();

let state = clone(DEFAULT_STATE);
let activePresetId = 'chapter-30';
let world = null;
let currentChapterId = null;
let generation = 0;
let renderer;
let scene;
let camera;
let controls;
let runtime;
let staging;
let post;
let worldRoofs = [];
let clock;
let elapsed = 0;
let ready = false;
let frameCount = 0;
let lastFpsTime = 0;
let fps = 0;
let cameraApplying = false;
let loadedAt = 0;
const controlBindings = [];
const ui = {};


function initScene() {
  const canvas = document.getElementById('stage');
  renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a1016');
  scene.fog = new THREE.FogExp2('#d5ded5', 0.009);

  camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.03, 2200);
  camera.position.set(10, 7, 16);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 2;
  controls.maxDistance = 110;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.autoRotateSpeed = 0.35;
  controls.addEventListener('start', () => { cameraApplying = false; });
  controls.addEventListener('end', () => { readCameraToState(); });

  runtime = createLightingRuntime({renderer, scene, camera, chapter: CHAPTER_BY_ID.get('30'), reducedFlash: true});
  staging = new Staging(scene);
  post = runtime;

  clock = new THREE.Clock();
  addEventListener('resize', resize);
  resize();
  window.__lightingStudio = {
    getState: () => clone(state),
    getPresets: () => PRESETS,
    applyPreset: id => applyPresetById(id),
    loadChapter,
    scene,
    camera,
    renderer,
    getRuntimeState: () => runtime.getState(),
    setObjective: objective => runtime.setObjective(objective),
  };
}

function resize() {
  const width = innerWidth;
  const height = innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  runtime.resize(width, height);
}

function readCameraToState() {
  if (!ready || cameraApplying) return;
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  state.camera.distance = Math.round(spherical.radius * 10) / 10;
  state.camera.azimuth = Math.round(THREE.MathUtils.radToDeg(spherical.theta) * 10) / 10;
  state.camera.elevation = Math.round((Math.PI / 2 - spherical.phi) * 180 / Math.PI * 10) / 10;
  syncControls();
}

function applyCamera() {
  if (!world) return;
  const target = controls.target;
  const focus = world.focus || new THREE.Vector3();
  target.set(focus.x + (state.camera.targetX || 0), state.camera.targetHeight ?? focus.y, focus.z + (state.camera.targetZ || 0));
  const az = deg(state.camera.azimuth);
  const el = deg(clamp(state.camera.elevation, -20, 85));
  const distance = clamp(state.camera.distance, 2, 110);
  camera.position.set(
    target.x + Math.sin(az) * Math.cos(el) * distance,
    target.y + Math.sin(el) * distance,
    target.z + Math.cos(az) * Math.cos(el) * distance,
  );
  camera.fov = state.camera.fov;
  const roll = deg(state.camera.roll ?? 0);
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  cameraApplying = true;
  controls.update();
  cameraApplying = false;
}

async function loadChapter(id, options = {}) {
  const chapter = CHAPTER_BY_ID.get(id);
  if (!chapter) return;
  const token = ++generation;
  const loading = document.getElementById('loading');
  loading.hidden = false;
  const loadingLabel = document.getElementById('loading-label');
  if (loadingLabel) loadingLabel.textContent = `Loading ${chapter.title}…`;
  await new Promise(resolve => requestAnimationFrame(resolve));
  if (token !== generation) return;
  if (world) {
    world.dispose();
    world = null;
  }
  worldRoofs = [];
  currentChapterId = id;
  world = createWorld({scene, chapter, quality: 'high'});
  if (token !== generation) {
    world.dispose();
    return;
  }
  runtime.attachWorld(world, chapter);
  world.group.traverse(object => {
    if (object.name?.startsWith('cutaway-roof')) worldRoofs.push(object);
  });
  const focus = world.focus?.clone?.() ?? new THREE.Vector3(0, 1.3, 0);
  controls.target.copy(focus);
  controls.target.y = state.camera.targetHeight ?? focus.y;
  controls.minDistance = state.interior ? 1.6 : 3.2;
  controls.maxDistance = state.interior ? 24 : 110;
  camera.far = Math.max(900, world.cameraFar || 700);
  camera.updateProjectionMatrix();
  state.chapterId = id;
  state.place = chapter.place;
  state.dateLabel = chapter.date;
  state.environment = chapter.environment;
  loadedAt = performance.now();
  if (!options.keepCamera) applyCamera();
  applyScene();
  loading.hidden = true;
}

function applyLighting() {
  if (!world) return;
  runtime.applyState(state);
  const hideRoof = state.interior && (state.camera.elevation ?? 0) >= 20;
  worldRoofs.forEach(roof => { roof.visible = !hideRoof; });
}

function applyScene() {
  if (!world) return;
  applyLighting();
  staging.build(state, world);
  runtime.registerStagedPracticals(staging.torchLights);
  controls.autoRotate = Boolean(state.autoOrbit);
  controls.autoRotateSpeed = 0.28;
  updateBadges();
}

function recomputeSun() {
  if (!state.date || !Number.isFinite(state.time) || !Number.isFinite(state.latitude) || !Number.isFinite(state.longitude)) return;
  const position = solarPosition(state.date, state.time, state.latitude, state.longitude, state.timezone);
  state.sun.azimuth = Math.round(position.azimuth * 10) / 10;
  state.sun.elevation = Math.round(position.elevation * 10) / 10;
  state.sky.moonPhase = moonPhase(state.date);
  if (state.sky.moon > 0.02) state.sky.moon = Math.max(state.sky.moon, Math.round(moonIllumination(state.sky.moonPhase) * 1000) / 1000);
}

function updateBadges() {
  const chapter = CHAPTER_BY_ID.get(state.chapterId);
  const preset = PRESET_BY_ID.get(activePresetId) || {label: state.activeLabel, note: state.activeNote, kind: 'saved'};
  const title = state.shortLabel ? `${state.chapterId} · ${state.shortLabel}` : chapter ? `${state.chapterId} · ${chapter.title}` : state.label || 'Staging study';
  ui.sceneTitle.textContent = title;
  ui.sceneSubtitle.textContent = `${state.dateLabel || state.date} · ${state.place || ''}`;
  const badges = [
    formatTime(state.time),
    state.season,
    state.weather,
    `${formatNumber(state.sun.elevation, 0)}° sun`,
  ];
  if (preset?.stylized) badges.push('STYLISED');
  if (state.interior) badges.push('interior');
  ui.sceneBadges.innerHTML = badges.map((badge, index) => `<span class="badge${index === badges.length - 1 && preset?.stylized ? ' danger' : ''}">${badge}</span>`).join('');
  const note = preset?.note || preset?.description || 'A custom staging look.';
  ui.sceneNote.textContent = note;
  ui.sceneNote.hidden = !state.showPresetNote;
  ui.badgeConfidence.textContent = preset?.confidence || (preset?.kind ? preset.kind : 'custom');
  ui.badgeConfidence.className = `confidence ${preset?.stylized ? 'danger' : ''}`;
  ui.statusPreset.textContent = preset ? preset.label : state.activeLabel || 'Custom look';
  ui.statusSun.textContent = `sun ${formatNumber(state.sun.azimuth, 0)}° / ${formatNumber(state.sun.elevation, 0)}°`;
  ui.statusTime.textContent = formatTime(state.time);
  ui.statusMoon.textContent = `moon ${Math.round(moonIllumination(state.sky.moonPhase ?? 0.5) * 100)}%`;
  document.getElementById('chapter-select').value = state.chapterId;
}

function renderPresetLibrary() {
  document.getElementById('preset-count').textContent = PRESETS.length;
  document.querySelectorAll('[data-tab]').forEach(button => {
    const count = button.querySelector('span');
    if (count) count.textContent = PRESETS.filter(preset => preset.kind === button.dataset.tab).length;
  });
  const query = ui.presetSearch.value.trim().toLowerCase();
  const kind = ui.activeTab;
  let list = PRESETS;
  if (kind === 'saved') list = loadSaved();
  else list = PRESETS.filter(preset => preset.kind === kind);
  if (query) {
    list = list.filter(preset => `${preset.label} ${preset.description || ''} ${preset.note || ''} ${(preset.tags || []).join(' ')}`.toLowerCase().includes(query));
  }
  ui.presetList.innerHTML = '';
  if (!list.length) {
    ui.presetList.innerHTML = '<p class="empty">No presets match that search.</p>';
    return;
  }
  for (const preset of list) {
    const button = document.createElement('button');
    button.className = `preset-card${preset.id === activePresetId ? ' active' : ''}${preset.stylized ? ' stylised' : ''}`;
    button.dataset.id = preset.id;
    const swatch = preset.swatch || ['#2b3438', '#c49a52', '#8a9a7a'];
    const subtitle = preset.kind === 'chapter'
      ? `${preset.dateLabel || preset.date} · ${preset.place || ''}`
      : (preset.description || (preset.tags || []).join(' · '));
    button.innerHTML = `
      <span class="preset-swatch" style="background:linear-gradient(135deg,${swatch[0]},${swatch[1]} 52%,${swatch[2]})"></span>
      <span class="preset-copy"><b>${escapeHtml(preset.label)}</b><small>${escapeHtml(subtitle)}</small></span>
      ${preset.stylized ? '<span class="preset-flag">stylised</span>' : ''}
      ${preset.kind === 'chapter' ? `<span class="preset-id">${preset.chapterId}</span>` : ''}
      ${kind === 'saved' ? '<span class="preset-delete" role="button" tabindex="0" title="Delete saved look">×</span>' : ''}
    `;
    button.addEventListener('click', event => {
      if (event.target.closest('.preset-delete')) {
        event.stopPropagation();
        deleteSaved(preset.id);
        return;
      }
      applyPresetById(preset.id);
    });
    ui.presetList.appendChild(button);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
}

async function applyPresetById(id) {
  const preset = PRESET_BY_ID.get(id) || loadSaved().find(item => item.id === id);
  if (!preset) return;
  activePresetId = preset.id;
  state.activeLabel = preset.label;
  state.activeNote = preset.note || preset.description || '';
  if (preset.kind === 'chapter') {
    state = merge(DEFAULT_STATE, preset);
    state.presetId = preset.id;
    state.autoSun = preset.autoSun !== false;
    state.autoOrbit = false;
    if (preset.chapterId !== currentChapterId) await loadChapter(preset.chapterId, {keepCamera: false});
    else state = merge(state, preset);
    applyCamera();
  } else if (preset.kind === 'saved') {
    state = merge(state, preset.state || {});
    state.presetId = preset.id;
    if (state.chapterId && state.chapterId !== currentChapterId) await loadChapter(state.chapterId, {keepCamera: false});
    applyCamera();
  } else {
    state = merge(state, preset.fields || preset);
    state.presetId = preset.id;
    if (preset.kind === 'time') {
      state.time = preset.fields.time;
      state.autoSun = true;
      recomputeSun();
    }
    if (preset.kind === 'camera') applyCamera();
  }
  syncControls();
  applyScene();
  renderPresetLibrary();
  toast(preset.label);
}

function syncControls() {
  for (const binding of controlBindings) {
    const value = getPath(state, binding.path);
    if (binding.type === 'range') {
      binding.input.value = value;
      binding.value.textContent = binding.format ? binding.format(value) : formatNumber(value, binding.digits || 0) + (binding.unit || '');
    } else if (binding.type === 'color') {
      binding.input.value = value;
      binding.value.textContent = String(value).toUpperCase();
    } else if (binding.type === 'checkbox') {
      binding.input.checked = Boolean(value);
    } else if (binding.type === 'select') {
      binding.input.value = value;
    }
  }
  document.getElementById('chapter-select').value = state.chapterId;
  const dateInput = document.getElementById('date-input');
  if (dateInput) dateInput.value = state.date;
  const latInput = document.getElementById('lat-input');
  if (latInput) latInput.value = state.latitude;
  const lonInput = document.getElementById('lon-input');
  if (lonInput) lonInput.value = state.longitude;
  const tzInput = document.getElementById('tz-input');
  if (tzInput) tzInput.value = state.timezone;
  document.getElementById('auto-sun').checked = Boolean(state.autoSun);
  const animateButton = document.getElementById('animate-time');
  if (animateButton) animateButton.textContent = state.animateTime ? '❚❚' : '▶';
  const clockReadout = document.getElementById('clock-readout');
  if (clockReadout) clockReadout.textContent = formatTime(state.time);
  document.getElementById('auto-orbit').checked = Boolean(state.autoOrbit);
  document.getElementById('show-note').checked = Boolean(state.showPresetNote);
  document.getElementById('blocking').checked = Boolean(state.blocking);
  document.getElementById('interior').checked = Boolean(state.interior);
}

function addRange(parent, {label, path, min, max, step, unit = '', digits = 0, format, onInput}) {
  const row = document.createElement('label');
  row.className = 'control-row';
  row.innerHTML = `<span class="control-label">${label}<b></b></span><input type="range" min="${min}" max="${max}" step="${step}">`;
  const input = row.querySelector('input');
  const value = row.querySelector('b');
  parent.appendChild(row);
  const binding = {type: 'range', path, input, value, unit, digits, format};
  controlBindings.push(binding);
  input.addEventListener('input', () => {
    const numeric = Number(input.value);
    setPath(state, path, numeric);
    if (path === 'time') {
      if (state.autoSun) recomputeSun();
      syncControls();
    }
    if (path === 'sun.azimuth' || path === 'sun.elevation') {
      state.autoSun = false;
      document.getElementById('auto-sun').checked = false;
    }
    if (path === 'camera.distance' || path === 'camera.azimuth' || path === 'camera.elevation' || path === 'camera.fov' || path === 'camera.targetHeight' || path === 'camera.targetX' || path === 'camera.targetZ') {
      applyCamera();
    }
    if (path === 'sky.moonPhase') {
      state.sky.moon = Math.round(moonIllumination(numeric) * 1000) / 1000;
    }
    onInput?.(numeric);
    applyScene();
  });
  return binding;
}

function addColor(parent, {label, path}) {
  const row = document.createElement('label');
  row.className = 'control-row color-row';
  row.innerHTML = `<span class="control-label">${label}<b></b></span><input type="color">`;
  const input = row.querySelector('input');
  const value = row.querySelector('b');
  parent.appendChild(row);
  const binding = {type: 'color', path, input, value};
  controlBindings.push(binding);
  input.addEventListener('input', () => {
    setPath(state, path, input.value);
    applyScene();
    syncControls();
  });
  return binding;
}

function addToggle(parent, {label, id, path, onChange}) {
  const row = document.createElement('label');
  row.className = 'control-row toggle-row';
  row.innerHTML = `<span class="control-label">${label}</span><input id="${id}" type="checkbox">`;
  const input = row.querySelector('input');
  parent.appendChild(row);
  const binding = {type: 'checkbox', path, input};
  controlBindings.push(binding);
  input.addEventListener('change', () => {
    setPath(state, path, input.checked);
    onChange?.(input.checked);
    applyScene();
  });
  return binding;
}

function addSection(parent, title, subtitle, open = false) {
  const details = document.createElement('details');
  details.open = open;
  const summary = document.createElement('summary');
  summary.innerHTML = `<span>${title}</span><small>${subtitle}</small>`;
  details.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'control-body';
  details.appendChild(body);
  parent.appendChild(details);
  return body;
}

function buildControls() {
  const root = document.getElementById('controls-body');
  root.innerHTML = '';

  // Scene / place -----------------------------------------------------------
  const sceneBody = addSection(root, 'Place & time', 'load a real chapter, set date and clock', true);
  const chapterRow = document.createElement('label');
  chapterRow.className = 'control-row select-row';
  chapterRow.innerHTML = `<span class="control-label">Chapter</span><select id="chapter-select">${CHAPTERS.map(chapter => `<option value="${chapter.id}">${chapter.id} · ${escapeHtml(chapter.title)}</option>`).join('')}</select>`;
  sceneBody.appendChild(chapterRow);
  chapterRow.querySelector('select').addEventListener('change', event => {
    const chapterPreset = PRESET_BY_ID.get(`chapter-${event.target.value}`);
    if (chapterPreset) applyPresetById(chapterPreset.id);
    else loadChapter(event.target.value);
  });
  const dateRow = document.createElement('label');
  dateRow.className = 'control-row';
  dateRow.innerHTML = '<span class="control-label">Date</span><input id="date-input" type="date">';
  sceneBody.appendChild(dateRow);
  dateRow.querySelector('input').addEventListener('change', event => {
    state.date = event.target.value;
    if (state.autoSun) recomputeSun();
    syncControls();
    applyScene();
  });
  const clockRow = document.createElement('div');
  clockRow.className = 'clock-row';
  clockRow.innerHTML = `<span id="clock-readout">17:00</span><button id="animate-time" class="mini-toggle" title="Play time">▶</button>`;
  sceneBody.appendChild(clockRow);
  clockRow.querySelector('#animate-time').addEventListener('click', () => {
    state.animateTime = !state.animateTime;
    clockRow.querySelector('#animate-time').textContent = state.animateTime ? '❚❚' : '▶';
  });
  addRange(sceneBody, {label: 'Time of day', path: 'time', min: 0, max: 24, step: 0.05, unit: ' h', digits: 2, format: formatTime});
  addRange(sceneBody, {label: 'Time speed', path: 'timeSpeed', min: 0.005, max: 0.3, step: 0.005, unit: ' h/s', digits: 3});
  const geoRow = document.createElement('div');
  geoRow.className = 'geo-row';
  geoRow.innerHTML = '<label>Lat <input id="lat-input" type="number" step="0.001"></label><label>Lon <input id="lon-input" type="number" step="0.001"></label><label>UTC <input id="tz-input" type="number" step="0.5"></label>';
  sceneBody.appendChild(geoRow);
  for (const [id, path] of [['lat-input', 'latitude'], ['lon-input', 'longitude'], ['tz-input', 'timezone']]) {
    geoRow.querySelector(`#${id}`).addEventListener('change', event => {
      setPath(state, path, Number(event.target.value));
      if (state.autoSun) recomputeSun();
      syncControls();
      applyScene();
    });
  }
  addToggle(sceneBody, {label: 'Sun follows date & clock', id: 'auto-sun', path: 'autoSun', onChange: value => { if (value) { recomputeSun(); syncControls(); applyScene(); } }});
  addToggle(sceneBody, {label: 'Interior lighting mode', id: 'interior', path: 'interior', onChange: () => applyScene()});
  addToggle(sceneBody, {label: 'Blocking figures', id: 'blocking', path: 'blocking', onChange: () => applyScene()});
  addToggle(sceneBody, {label: 'Show preset note', id: 'show-note', path: 'showPresetNote', onChange: () => updateBadges()});
  addToggle(sceneBody, {label: 'Auto-orbit camera', id: 'auto-orbit', path: 'autoOrbit'});

  // Sky ---------------------------------------------------------------------
  const skyBody = addSection(root, 'Sky', 'gradient, clouds, haze, stars, moon', true);
  addColor(skyBody, {label: 'Sky zenith', path: 'sky.top'});
  addColor(skyBody, {label: 'Sky horizon', path: 'sky.horizon'});
  addColor(skyBody, {label: 'Cloud tint', path: 'sky.cloudTint'});
  addRange(skyBody, {label: 'Cloud cover', path: 'sky.cloudCover', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(skyBody, {label: 'Haze', path: 'sky.haze', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(skyBody, {label: 'Stars', path: 'sky.stars', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(skyBody, {label: 'Moon light', path: 'sky.moon', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(skyBody, {label: 'Moon phase', path: 'sky.moonPhase', min: 0, max: 1, step: 0.001, digits: 3});

  // Sun / mood --------------------------------------------------------------
  const lightBody = addSection(root, 'Key, fill & rim', 'the three-point rig and practicals', true);
  addColor(lightBody, {label: 'Sun colour', path: 'sun.color'});
  addRange(lightBody, {label: 'Sun intensity', path: 'sun.intensity', min: 0, max: 6, step: 0.01, digits: 2});
  addRange(lightBody, {label: 'Sun azimuth', path: 'sun.azimuth', min: 0, max: 360, step: 1, unit: '°'});
  addRange(lightBody, {label: 'Sun elevation', path: 'sun.elevation', min: -40, max: 90, step: 0.5, unit: '°', digits: 1});
  addRange(lightBody, {label: 'Shadows', path: 'sun.shadows', min: 0, max: 1, step: 0.01, digits: 2});
  addColor(lightBody, {label: 'Ambient sky', path: 'ambient.sky'});
  addColor(lightBody, {label: 'Ambient ground', path: 'ambient.ground'});
  addRange(lightBody, {label: 'Ambient intensity', path: 'ambient.intensity', min: 0, max: 2, step: 0.01, digits: 2});
  addColor(lightBody, {label: 'Fill colour', path: 'fill.color'});
  addRange(lightBody, {label: 'Fill intensity', path: 'fill.intensity', min: 0, max: 2, step: 0.01, digits: 2});
  addRange(lightBody, {label: 'Fill azimuth', path: 'fill.azimuth', min: 0, max: 360, step: 1, unit: '°'});
  addRange(lightBody, {label: 'Fill elevation', path: 'fill.elevation', min: -20, max: 90, step: 1, unit: '°'});
  addColor(lightBody, {label: 'Rim colour', path: 'rim.color'});
  addRange(lightBody, {label: 'Rim intensity', path: 'rim.intensity', min: 0, max: 3, step: 0.01, digits: 2});
  addRange(lightBody, {label: 'Rim azimuth', path: 'rim.azimuth', min: 0, max: 360, step: 1, unit: '°'});
  addRange(lightBody, {label: 'Rim elevation', path: 'rim.elevation', min: -20, max: 90, step: 1, unit: '°'});
  addRange(lightBody, {label: 'Window / lamp', path: 'practical.lamp', min: 0, max: 2, step: 0.01, digits: 2});
  addRange(lightBody, {label: 'Interior bounce', path: 'practical.bounce', min: 0, max: 1.5, step: 0.01, digits: 2});
  addColor(lightBody, {label: 'Lamp colour', path: 'practical.lampColor'});
  addRange(lightBody, {label: 'Torch power', path: 'practical.torch', min: 0, max: 2, step: 0.01, digits: 2});
  addColor(lightBody, {label: 'Torch colour', path: 'practical.torchColor'});

  // Grade -------------------------------------------------------------------
  const gradeBody = addSection(root, 'Colour grade', 'exposure, contrast, tint, vignette, bloom', false);
  addRange(gradeBody, {label: 'Exposure', path: 'grade.exposure', min: 0.4, max: 2, step: 0.01, digits: 2});
  addRange(gradeBody, {label: 'Contrast', path: 'grade.contrast', min: 0.6, max: 1.6, step: 0.01, digits: 2});
  addRange(gradeBody, {label: 'Saturation', path: 'grade.saturation', min: 0, max: 2, step: 0.01, digits: 2});
  addRange(gradeBody, {label: 'Temperature', path: 'grade.temperature', min: -0.3, max: 0.3, step: 0.005, digits: 3});
  addRange(gradeBody, {label: 'Tint', path: 'grade.tint', min: -0.3, max: 0.3, step: 0.005, digits: 3});
  addRange(gradeBody, {label: 'Lift', path: 'grade.lift', min: -0.1, max: 0.2, step: 0.005, digits: 3});
  addRange(gradeBody, {label: 'Gamma', path: 'grade.gamma', min: 0.6, max: 1.5, step: 0.01, digits: 2});
  addRange(gradeBody, {label: 'Gain', path: 'grade.gain', min: 0.6, max: 1.5, step: 0.01, digits: 2});
  addColor(gradeBody, {label: 'Shadow colour', path: 'grade.shadowColor'});
  addRange(gradeBody, {label: 'Shadow tint', path: 'grade.shadowStrength', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(gradeBody, {label: 'Vignette', path: 'grade.vignette', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(gradeBody, {label: 'Grain', path: 'grade.grain', min: 0, max: 0.5, step: 0.005, digits: 3});
  addRange(gradeBody, {label: 'Bloom', path: 'grade.bloom', min: 0, max: 1.2, step: 0.01, digits: 2});
  addRange(gradeBody, {label: 'Bloom threshold', path: 'grade.bloomThreshold', min: 0, max: 1.2, step: 0.01, digits: 2});
  addRange(gradeBody, {label: 'Chromatic', path: 'grade.chromatic', min: 0, max: 0.01, step: 0.0001, digits: 4});
  addRange(gradeBody, {label: 'Letterbox', path: 'grade.letterbox', min: 0, max: 0.2, step: 0.005, digits: 3});

  // Atmosphere --------------------------------------------------------------
  const airBody = addSection(root, 'Weather & air', 'rain, snow, dust, mist, embers, lightning', false);
  addColor(airBody, {label: 'Fog colour', path: 'fog.color'});
  addRange(airBody, {label: 'Fog density', path: 'fog.density', min: 0, max: 0.08, step: 0.0005, digits: 4});
  addRange(airBody, {label: 'Rain', path: 'fx.rain', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(airBody, {label: 'Snow', path: 'fx.snow', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(airBody, {label: 'Dust', path: 'fx.dust', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(airBody, {label: 'Embers', path: 'fx.embers', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(airBody, {label: 'Motes', path: 'fx.motes', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(airBody, {label: 'Mist', path: 'fx.mist', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(airBody, {label: 'Ground fog', path: 'fx.groundFog', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(airBody, {label: 'Wind', path: 'fx.wind', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(airBody, {label: 'Lightning', path: 'fx.lightning', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(airBody, {label: 'God rays', path: 'fx.godRays', min: 0, max: 1, step: 0.01, digits: 2});
  addToggle(airBody, {label: 'Allow weather indoors', id: 'indoor-weather', path: 'allowIndoorWeather'});

  // Palette -----------------------------------------------------------------
  const paletteBody = addSection(root, 'Ground & foliage', 'chapter palette and material tint', false);
  addColor(paletteBody, {label: 'Foliage tint', path: 'palette.foliage'});
  addColor(paletteBody, {label: 'Ground tint', path: 'palette.ground'});
  addColor(paletteBody, {label: 'Accent', path: 'palette.accent'});
  addColor(paletteBody, {label: 'Shadow', path: 'palette.shadow'});
  addRange(paletteBody, {label: 'Material tint', path: 'palette.strength', min: 0, max: 1, step: 0.01, digits: 2});
  addColor(paletteBody, {label: 'Ground wash', path: 'groundWash.color'});
  addRange(paletteBody, {label: 'Ground wash opacity', path: 'groundWash.opacity', min: 0, max: 0.35, step: 0.005, digits: 3});

  // Staging -----------------------------------------------------------------
  const stageBody = addSection(root, 'Crowd & props', 'mob, torches, pitchforks, firearms, blocking', false);
  addToggle(stageBody, {label: 'Mob enabled', id: 'mob-enabled', path: 'mob.enabled'});
  addRange(stageBody, {label: 'Mob count', path: 'mob.count', min: 0, max: 24, step: 1});
  addRange(stageBody, {label: 'Torches (fraction)', path: 'mob.torches', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(stageBody, {label: 'Pitchforks (fraction)', path: 'mob.pitchforks', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(stageBody, {label: 'Firearms (fraction)', path: 'mob.guns', min: 0, max: 1, step: 0.01, digits: 2});
  addRange(stageBody, {label: 'Muzzle flashes', path: 'mob.muzzle', min: 0, max: 1, step: 0.01, digits: 2});
  addToggle(stageBody, {label: 'Silhouette figures', id: 'mob-silhouette', path: 'mob.silhouette'});
  addRange(stageBody, {label: 'Mob distance', path: 'mob.distance', min: 3, max: 24, step: 0.1, digits: 1, unit: ' m'});
  addRange(stageBody, {label: 'Mob spread', path: 'mob.spread', min: 0.2, max: 2, step: 0.01, digits: 2});

  // Camera ------------------------------------------------------------------
  const cameraBody = addSection(root, 'Camera', 'orbit, distance, lens', false);
  addRange(cameraBody, {label: 'Distance', path: 'camera.distance', min: 2, max: 80, step: 0.1, digits: 1, unit: ' m'});
  addRange(cameraBody, {label: 'Azimuth', path: 'camera.azimuth', min: 0, max: 360, step: 1, unit: '°'});
  addRange(cameraBody, {label: 'Elevation', path: 'camera.elevation', min: -10, max: 85, step: 0.5, unit: '°', digits: 1});
  addRange(cameraBody, {label: 'Target height', path: 'camera.targetHeight', min: 0, max: 8, step: 0.05, digits: 2, unit: ' m'});
  addRange(cameraBody, {label: 'Target X offset', path: 'camera.targetX', min: -80, max: 80, step: 0.5, digits: 1, unit: ' m'});
  addRange(cameraBody, {label: 'Target Z offset', path: 'camera.targetZ', min: -80, max: 80, step: 0.5, digits: 1, unit: ' m'});
  addRange(cameraBody, {label: 'Field of view', path: 'camera.fov', min: 20, max: 85, step: 0.5, unit: '°', digits: 1});
  const cameraGrid = document.createElement('div');
  cameraGrid.className = 'camera-grid';
  cameraGrid.innerHTML = ['wide', 'medium', 'close', 'low', 'crane', 'over-shoulder', 'window', 'interior', 'top', 'dutch'].map(key => `<button data-camera="${key}">${key.replace('-', ' ')}</button>`).join('');
  cameraBody.appendChild(cameraGrid);
  cameraGrid.addEventListener('click', event => {
    const key = event.target.closest('button')?.dataset.camera;
    if (key) applyPresetById(`camera-${key}`);
  });
  const resetCamera = document.createElement('button');
  resetCamera.className = 'wide-button';
  resetCamera.textContent = 'Reset camera to chapter preset';
  cameraBody.appendChild(resetCamera);
  resetCamera.addEventListener('click', () => {
    const preset = PRESET_BY_ID.get(`chapter-${state.chapterId}`) || PRESET_BY_ID.get('chapter-30');
    if (preset) {
      state.camera = clone(preset.camera);
      applyCamera();
      syncControls();
      applyScene();
    }
  });
}

function loadSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveLook(name) {
  const saved = loadSaved();
  const id = `saved-${Date.now()}`;
  const preset = {
    id,
    kind: 'saved',
    label: name || `Saved look ${saved.length + 1}`,
    description: `${state.dateLabel || state.date} · ${state.place || ''} · ${formatTime(state.time)}`,
    tags: ['saved', 'custom'],
    swatch: [state.sky.top, state.sky.horizon, state.palette.accent],
    state: clone(state),
  };
  preset.state.presetId = id;
  preset.state.activeLabel = preset.label;
  saved.unshift(preset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, 40)));
  ui.activeTab = 'saved';
  setTab('saved');
  renderPresetLibrary();
  toast(`Saved “${preset.label}”`);
}

function deleteSaved(id) {
  const saved = loadSaved().filter(preset => preset.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  renderPresetLibrary();
  toast('Saved look deleted');
}

function openExport() {
  const dialog = document.getElementById('export-dialog');
  const data = clone(state);
  delete data.sunDirection;
  delete data.moonDirection;
  document.getElementById('export-json').value = JSON.stringify(data, null, 2);
  document.getElementById('export-note').textContent = `${data.chapterId} · ${data.dateLabel || data.date} · ${formatTime(data.time)}. This is a staging look, not an automatic game change.`;
  dialog.showModal();
}

function gameConfig() {
  return {
    schema: 'zion-lighting-look/v1',
    presetId: state.presetId,
    stylized: Boolean(state.stylized),
    note: state.note,
    chapterId: state.chapterId,
    place: state.place,
    date: state.date,
    time: state.time,
    season: state.season,
    weather: state.weather,
    interior: state.interior,
    sky: state.sky,
    sun: state.sun,
    ambient: state.ambient,
    fog: state.fog,
    fill: state.fill,
    rim: state.rim,
    practical: state.practical,
    grade: state.grade,
    fx: state.fx,
    palette: state.palette,
    groundWash: state.groundWash,
    mob: state.mob,
    camera: state.camera,
  };
}

function copyText(text, label = 'Copied') {
  navigator.clipboard.writeText(text).then(() => toast(label), () => toast('Clipboard blocked by the browser'));
}

function toast(message) {
  const element = document.getElementById('toast');
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; }, 2200);
}

function setTab(tab) {
  ui.activeTab = tab;
  document.querySelectorAll('#preset-tabs button').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  renderPresetLibrary();
}

function bindUi() {
  ui.activeTab = 'chapter';
  ui.presetList = document.getElementById('preset-list');
  ui.presetSearch = document.getElementById('preset-search');
  ui.sceneTitle = document.getElementById('scene-title');
  ui.sceneSubtitle = document.getElementById('scene-subtitle');
  ui.sceneBadges = document.getElementById('scene-badges');
  ui.sceneNote = document.getElementById('scene-note');
  ui.badgeConfidence = document.getElementById('badge-confidence');
  ui.statusPreset = document.getElementById('status-preset');
  ui.statusSun = document.getElementById('status-sun');
  ui.statusTime = document.getElementById('status-time');
  ui.statusMoon = document.getElementById('status-moon');

  document.querySelectorAll('#preset-tabs button').forEach(button => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
  });
  ui.presetSearch.addEventListener('input', renderPresetLibrary);
  document.getElementById('btn-reset').addEventListener('click', () => applyPresetById('chapter-30'));
  document.getElementById('btn-save').addEventListener('click', () => {
    const dialog = document.getElementById('save-dialog');
    document.getElementById('save-name').value = PRESET_BY_ID.get(activePresetId)?.label || 'Untitled look';
    dialog.showModal();
  });
  document.getElementById('save-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = document.getElementById('save-name').value.trim();
    document.getElementById('save-dialog').close();
    saveLook(name);
  });
  document.getElementById('btn-export').addEventListener('click', openExport);
  document.getElementById('export-close').addEventListener('click', () => document.getElementById('export-dialog').close());
  document.getElementById('export-copy').addEventListener('click', () => copyText(document.getElementById('export-json').value, 'Look JSON copied'));
  document.getElementById('export-game').addEventListener('click', () => copyText(JSON.stringify(gameConfig(), null, 2), 'Game config copied'));
  document.getElementById('export-download').addEventListener('click', () => {
    const blob = new Blob([document.getElementById('export-json').value], {type: 'application/json'});
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `zion-lighting-${state.chapterId}-${state.date}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  });
  document.getElementById('export-import').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const next = imported.state || imported;
      state = merge(state, next);
      if (state.chapterId && state.chapterId !== currentChapterId) await loadChapter(state.chapterId);
      syncControls();
      applyScene();
      toast('Look imported');
    } catch (error) {
      toast(`Import failed: ${error.message}`);
    }
  });
  document.getElementById('btn-link').addEventListener('click', () => {
    const hash = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    const url = `${location.origin}${location.pathname}#look=${hash}`;
    copyText(url, 'Share link copied');
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close)?.close()));
  document.querySelectorAll('#camera-rail button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('#camera-rail button').forEach(item => item.classList.toggle('active', item === button));
    applyPresetById(`camera-${button.dataset.camera}`);
  }));
  document.getElementById('btn-help').addEventListener('click', () => document.getElementById('help-dialog').showModal());
  document.getElementById('help-close').addEventListener('click', () => document.getElementById('help-dialog').close());
  document.getElementById('btn-library').addEventListener('click', () => document.body.classList.toggle('library-open'));
  document.getElementById('btn-controls').addEventListener('click', () => document.body.classList.toggle('controls-open'));
  document.getElementById('btn-collapse').addEventListener('click', () => document.body.classList.toggle('controls-collapsed'));

  document.getElementById('chapter-select')?.addEventListener('change', event => {
    const preset = PRESET_BY_ID.get(`chapter-${event.target.value}`);
    if (preset) applyPresetById(preset.id);
    else loadChapter(event.target.value);
  });
  addEventListener('keydown', event => {
    if (event.target.matches('input, textarea, select')) return;
    if (event.key.toLowerCase() === 'h') document.body.classList.toggle('hide-ui');
    if (event.key.toLowerCase() === 'r') applyPresetById(`chapter-${state.chapterId}`);
    if (event.key === ' ') { event.preventDefault(); state.animateTime = !state.animateTime; }
  });
}

async function boot() {
  initScene();
  bindUi();
  buildControls();
  const hash = new URLSearchParams(location.hash.replace(/^#/, '')).get('look');
  if (hash) {
    try {
      state = merge(state, JSON.parse(decodeURIComponent(escape(atob(hash)))));
      activePresetId = state.presetId || 'custom';
      if (state.chapterId && state.chapterId !== '30') await loadChapter(state.chapterId, {keepCamera: false});
      else await loadChapter('30', {keepCamera: false});
      syncControls();
      applyCamera();
      applyScene();
    } catch (error) {
      console.warn('Could not restore look', error);
      await applyPresetById('chapter-30');
    }
  } else {
    await applyPresetById('chapter-30');
  }
  syncControls();
  setTab('chapter');
  renderPresetLibrary();
  ready = true;
  document.getElementById('loading').hidden = true;
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;
  frameCount += 1;
  if (elapsed - lastFpsTime > 0.5) {
    fps = Math.round(frameCount / (elapsed - lastFpsTime));
    frameCount = 0;
    lastFpsTime = elapsed;
    const info = renderer.info.render;
    document.getElementById('status-fps').textContent = `${fps} fps`;
  }
  if (state.animateTime) {
    state.time = (state.time + delta * state.timeSpeed) % 24;
    if (state.autoSun) recomputeSun();
    syncControls();
    applyLighting();
  }
  if (!ready || !world) {
    renderer.render(scene, camera);
    return;
  }
  controls.update();
  runtime.update(delta, elapsed);
  staging.update({...state, mob: {...state.mob, muzzle: 0}}, delta, elapsed);
  post.render(delta);
  if (Math.floor(elapsed * 2) !== Math.floor((elapsed - delta) * 2)) updateBadges();
}

boot().catch(error => {
  console.error(error);
  const loading = document.getElementById('loading');
  loading.hidden = false;
  loading.innerHTML = `<div class="load-error"><b>The studio could not open.</b><span>${escapeHtml(error.message)}</span></div>`;
});
