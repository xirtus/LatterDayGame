import * as THREE from 'three';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {createWorld} from './world.js';
import {createActor, loadAssetManifest, getAssetStatus} from './actors.js';
import {loadChapters, speakerName} from './story.js';
import {Soundscape} from './audio.js';
import {createPortals} from './portals.js';

const select = selector => document.querySelector(selector);
const canvas = select('#world');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .08, 230);
const sound = new Soundscape();
const storageKey = 'gathering-of-zion:v1';
let renderer;
let outline;
let chapters = [];
let world;
let player;
let actors = [];
let chapter;
let objectiveIndex = 0;
let dialogueLines = [];
let dialogueIndex = -1;
let loading = true;
let inMenu = true;
let chapterFinished = false;
let generation = 0;
let elapsed = 0;
let bannerTimer;
let toastTimer;
let holdTime = 0;
let holdActive = false;
let cameraMode = 'third';
let yaw = 0;
let pitch = .16;
let cameraDistance = 5.4;
let pointer = null;
let currentMotion = 'idle';
let marker;
let heavenly;
let portals;
let lightStrength = 0;
const keys = new Set();
const freePosition = new THREE.Vector3();
const nextPosition = new THREE.Vector3();
const direction = new THREE.Vector3();
const target = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const clock = new THREE.Clock();
let save;
let preferences;
try { save = JSON.parse(localStorage.getItem(storageKey) ?? 'null'); } catch { save = null; }
try { preferences = JSON.parse(localStorage.getItem(storageKey + ':settings') ?? '{}'); } catch { preferences = {}; }
const completed = new Set(Array.isArray(save?.completed) ? save.completed : []);
const visited = new Set(Array.isArray(save?.visited) ? save.visited : []);
let journalTab = 'chapters';

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
}

function persist() {
  if (!chapter || inMenu || loading) return;
  save = {version: 1, chapter: chapter.id, objective: objectiveIndex, completed: [...completed], visited: [...visited], updated: new Date().toISOString()};
  try { localStorage.setItem(storageKey, JSON.stringify(save)); } catch { toast('Browser storage is unavailable; this journey will not be saved.'); }
  select('#resume').hidden = false;
}

function toast(message, duration = 4500) {
  clearTimeout(toastTimer);
  select('#toast').textContent = message;
  select('#toast').hidden = false;
  toastTimer = setTimeout(() => { select('#toast').hidden = true; }, duration);
}

function isPaused() {
  return inMenu || loading || select('#journal').open || select('#settings').open;
}

function currentObjective() { return chapter?.objectives[objectiveIndex]; }

function distanceToObjective() {
  const objective = currentObjective();
  if (!objective || !player) return Infinity;
  return Math.hypot(player.root.position.x - objective.target[0], player.root.position.z - objective.target[2]);
}

function setCamera(mode) {
  if (!['first', 'third', 'free'].includes(mode)) return;
  if (mode === 'free' && cameraMode !== 'free') freePosition.copy(camera.position);
  cameraMode = mode;
  select('#crosshair').hidden = mode !== 'first';
  document.querySelectorAll('[data-camera]').forEach(button => button.classList.toggle('active', button.dataset.camera === mode));
  if (player) player.root.visible = mode !== 'first';
  if (!inMenu) toast(mode === 'free' ? 'Free camera · WASD to fly, Q down, R up. Joseph stays in place.' : mode === 'first' ? 'First person · walk in Joseph’s footsteps.' : 'Third person · drag to look around Joseph.', 2800);
}

function releaseKeys() {
  keys.clear();
  holdActive = false;
  holdTime = 0;
  pointer = null;
}

function makeMarker() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({color: '#f7d488', transparent: true, opacity: .65, depthWrite: false, side: THREE.DoubleSide});
  const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .67, 48), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .04;
  group.add(ring);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.09), new THREE.MeshBasicMaterial({color: '#ffe3a5', transparent: true, opacity: .85}));
  diamond.position.y = 1.75;
  group.add(diamond);
  group.userData.diamond = diamond;
  scene.add(group);
  return group;
}

function makeHeavenlyLight() {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.7, 24, 48, 1, true), new THREE.MeshBasicMaterial({color: '#fff5c9', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending}));
  beam.position.set(0, 11, -3);
  group.add(beam);
  const light = new THREE.PointLight('#fff4ce', 0, 22, 1);
  light.position.set(0, 4, -3);
  group.add(light);
  const count = 170;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    positions[index * 3] = Math.sin(index * 72.1) * 5;
    positions[index * 3 + 1] = (index * .137) % 9;
    positions[index * 3 + 2] = Math.cos(index * 12.8) * 5 - 3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(geometry, new THREE.PointsMaterial({color: '#fff2ae', size: .045, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending}));
  group.add(motes);
  group.userData = {beam, light, motes};
  scene.add(group);
  return group;
}

function applyActorVisibility() {
  actors.forEach(actor => {
    const config = actor.config;
    const started = config.showFrom ?? 0;
    const ended = config.hideAfter ?? Infinity;
    actor.root.visible = objectiveIndex >= started && objectiveIndex <= ended;
  });
  if (player) player.root.visible = cameraMode !== 'first';
}

function updateObjectiveUI() {
  const objective = currentObjective();
  select('#chapter-location').textContent = `${chapter.date} · ${chapter.place}`;
  select('#chapter-title').textContent = chapter.title;
  if (objective) {
    select('#objective-title').textContent = objective.label;
    select('#objective-hint').textContent = objective.prompt ?? 'Follow the light and press E to take part.';
    select('#objective-count').textContent = `${objectiveIndex + 1} / ${chapter.objectives.length}`;
    select('#objective-progress').style.width = `${objectiveIndex / chapter.objectives.length * 100}%`;
    marker.position.fromArray(objective.target);
    marker.visible = true;
  } else {
    select('#objective-title').textContent = 'A moment remembered';
    select('#objective-hint').textContent = 'You may keep exploring, or continue the journey.';
    select('#objective-count').textContent = 'Complete';
    select('#objective-progress').style.width = '100%';
    marker.visible = false;
  }
  applyActorVisibility();
}

async function enterChapter(id, options = {}) {
  const selected = chapters.find(item => item.id === id);
  if (!selected) throw new Error(`Chapter ${id} is unavailable.`);
  const version = ++generation;
  loading = true;
  select('#loading').hidden = false;
  select('#load-label').textContent = `Opening ${selected.title}…`;
  releaseKeys();
  closeDialogue();
  clearTimeout(bannerTimer);
  select('#chapter-banner').hidden = true;
  select('#chapter-complete').hidden = true;
  select('#interaction').hidden = true;
  actors.forEach(actor => actor.dispose());
  player?.dispose();
  actors = [];
  player = null;
  world?.dispose();
  portals?.dispose();
  portals = null;
  chapter = selected;
  objectiveIndex = Math.max(0, Math.min(options.objective ?? 0, chapter.objectives.length));
  chapterFinished = objectiveIndex >= chapter.objectives.length;
  lightStrength = chapter.environment === 'celestial' ? 1 : 0;
  world = createWorld({scene, chapter, quality: preferences.quality ?? 'high'});
  if (chapter.id.startsWith('E') && !['E4', 'E7'].includes(chapter.id)) portals = createPortals(scene, chapter.id);
  const onStatus = message => { if (generation === version) select('#load-label').textContent = message; };
  const actor = await createActor({id: chapter.playerId ?? 'JOSEPH_YOUNG', position: world.spawn, scene, player: true, onStatus});
  if (version !== generation) { actor.dispose(); return; }
  player = actor;
  for (const config of chapter.actors ?? []) {
    const companion = await createActor({...config, scene, onStatus});
    if (version !== generation) { companion.dispose(); return; }
    companion.config = config;
    actors.push(companion);
  }
  loading = false;
  currentMotion = 'idle';
  yaw = 0;
  pitch = .12;
  player.root.rotation.y = Math.PI;
  camera.position.copy(player.root.position).add(new THREE.Vector3(0, 2.5, 6));
  freePosition.copy(camera.position);
  heavenly.visible = true;
  updateObjectiveUI();
  select('#loading').hidden = true;
  if (!options.preview) {
    inMenu = false;
    select('#menu').hidden = true;
    select('#hud').hidden = false;
    visited.add(chapter.id);
    persist();
    showBanner();
    sound.start();
    sound.chime('step');
    if (chapterFinished) finishChapter();
    if (chapter.id === '31' || chapter.id === '32' || chapter.id.startsWith('E')) toast('Imaginative devotional continuation · not a documented historical event.', 7000);
    if (portals) toast('The seven eras · luminous bubbles along the western path lead across the years.', 7000);
  }
  document.body.dataset.ready = 'true';
  document.body.dataset.chapter = chapter.id;
  canvas.focus({preventScroll: true});
}

function showBanner() {
  const banner = select('#chapter-banner');
  select('#banner-date').textContent = `Chapter ${chapter.id} · ${chapter.date}`;
  select('#banner-title').textContent = chapter.title;
  select('#banner-place').textContent = chapter.place;
  banner.hidden = true;
  void banner.offsetWidth;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { banner.hidden = true; }, preferences.reducedMotion ? 2200 : 4500);
}

function showMenu() {
  inMenu = true;
  releaseKeys();
  sound.stopVoice();
  select('#menu').hidden = false;
  select('#hud').hidden = true;
  select('#resume').hidden = !save;
  select('#resume').textContent = save ? `Continue · ${chapters.find(item => item.id === save.chapter)?.title ?? 'your journey'}` : 'Continue your journey';
}

function resume() {
  sound.start();
  if (save) enterChapter(save.chapter, {objective: save.objective}).catch(fatal);
}

function closeDialogue() {
  select('#dialogue').hidden = true;
  dialogueLines = [];
  dialogueIndex = -1;
  sound.stopVoice();
}

function displayLine() {
  const line = dialogueLines[dialogueIndex];
  if (!line) { closeDialogue(); completeObjective(); return; }
  select('#speaker').textContent = speakerName(line.speaker);
  select('#dialogue-text').textContent = line.text;
  const playing = sound.speak(line, chapter.id, currentObjective().id, dialogueIndex);
  select('#voice-note').textContent = playing ? 'Local recorded performance' : 'Dramatized dialogue · recording pending';
  select('#next-line').innerHTML = dialogueIndex === dialogueLines.length - 1 ? 'Remember this moment <kbd>Space</kbd> →' : 'Continue <kbd>Space</kbd> →';
  actors.forEach(actor => actor.setMotion(actor.id === line.speaker ? 'speak' : 'idle'));
  if (line.speaker === player.id || line.speaker.startsWith('JOSEPH_')) player.setMotion('speak');
}

function advanceDialogue() {
  if (dialogueIndex < 0 || isPaused()) return;
  dialogueIndex += 1;
  displayLine();
}

function beginInteraction() {
  const portal = !isPaused() && dialogueIndex < 0 && player && portals?.nearest(player.root.position);
  if (portal) { sound.chime('revelation'); enterChapter(portal.id).catch(fatal); return; }
  const objective = currentObjective();
  if (!objective || isPaused() || dialogueIndex >= 0 || distanceToObjective() > 3) return;
  holdActive = false;
  holdTime = 0;
  select('#interaction').hidden = true;
  select('#chapter-banner').hidden = true;
  const effect = objective.effect;
  if (effect === 'revelation' || effect === 'stars' || effect === 'light' || objective.kind === 'pray') {
    lightStrength = Math.min(1, lightStrength + .65);
    sound.chime('revelation');
  } else sound.chime('step');
  if (objective.kind === 'pray') player.setMotion('pray');
  if (objective.lines?.length) {
    dialogueLines = objective.lines;
    dialogueIndex = 0;
    select('#dialogue').hidden = false;
    displayLine();
  } else completeObjective();
}

function completeObjective() {
  if (!currentObjective()) return;
  objectiveIndex += 1;
  holdActive = false;
  holdTime = 0;
  player?.setMotion('idle');
  currentMotion = 'idle';
  updateObjectiveUI();
  persist();
  sound.chime('step');
  if (objectiveIndex >= chapter.objectives.length) finishChapter();
  else toast('Moment remembered · the path continues.', 2300);
}

function finishChapter() {
  chapterFinished = true;
  completed.add(chapter.id);
  persist();
  sound.chime('complete');
  select('#complete-title').textContent = chapter.title;
  select('#complete-copy').textContent = chapter.epilogue ?? 'Carry this moment into the gathering ahead.';
  select('#next-chapter').firstChild.textContent = chapter.id === chapters.at(-1).id ? 'Return to the grove ' : 'Continue the story ';
  select('#chapter-complete').hidden = false;
  select('#interaction').hidden = true;
  select('#waypoint').hidden = true;
}

function nextChapter() {
  const index = chapters.indexOf(chapter);
  const next = chapters[index + 1] ?? chapters.find(item => item.id === '03');
  enterChapter(next.id).catch(fatal);
}

function openJournal(tab = 'chapters') {
  releaseKeys();
  journalTab = tab;
  renderJournal();
  if (!select('#journal').open) select('#journal').showModal();
}

function renderJournal() {
  const container = select('#journal-content');
  document.querySelectorAll('.journal-tabs button').forEach(button => button.classList.toggle('active', button.id === `tab-${journalTab}`));
  if (journalTab === 'history') {
    container.innerHTML = `<p class="eyebrow">${escapeHTML(chapter.date)} · ${escapeHTML(chapter.place)}</p><h3 class="history-title">${escapeHTML(chapter.title)}</h3><p class="history-status">${escapeHTML(chapter.status)}</p><p class="history-copy">${escapeHTML(chapter.history)}</p><ul class="source-links">${(chapter.sourceUrls ?? []).map(source => `<li><a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.title)} ↗</a></li>`).join('')}</ul><p class="history-status">Conversations are original dramatizations unless identified as scripture. Scene design is an artistic reconstruction, not a documentary camera record.</p>`;
  } else if (journalTab === 'cast') {
    const status = getAssetStatus();
    container.innerHTML = `<p class="history-status">${status.glbCount} local model exports indexed. Characters load only for the current chapter. Missing identities use provisional figures, never another named person's model.</p><div class="cast-grid">${[player, ...actors].filter(Boolean).map(actor => `<article class="cast-card"><h3>${escapeHTML(speakerName(actor.id))}</h3><p>${escapeHTML(actor.source ?? 'Purpose-built procedural stand-in')}</p><small>${actor.kind === 'model' ? 'LOCAL MESHy MODEL · TOON MATERIAL' : 'PROVISIONAL MODEL · REPLACEMENT PENDING'}</small></article>`).join('')}</div><p class="history-copy"><a href="../index.html#cast" style="color:var(--gold)" target="_blank">Full casting &amp; voice direction ↗</a></p>`;
  } else {
    container.innerHTML = `<div class="chapter-list">${chapters.map(item => `${item.id === 'E1' ? '<h3 class="journal-section-heading">The seven-era mission · speculative expansion</h3>' : ''}<button class="chapter-choice ${chapter?.id === item.id ? 'current' : ''}" data-chapter="${item.id}"><span>${item.id}</span><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.date)} · ${escapeHTML(item.place)}${item.id === '31' || item.id === '32' || item.id.startsWith('E') ? ' · IMAGINATIVE' : ''}</small></div>${completed.has(item.id) ? '<span class="tick" aria-label="Completed">✓</span>' : ''}</button>`).join('')}</div>`;
    container.querySelectorAll('[data-chapter]').forEach(button => button.addEventListener('click', () => {
      select('#journal').close();
      sound.start();
      enterChapter(button.dataset.chapter).catch(fatal);
    }));
  }
}

function savePreferences() {
  preferences = {
    sound: select('#sound').checked,
    voices: select('#voices').checked,
    reducedMotion: select('#reduced-motion').checked,
    quality: select('#quality').value,
    sensitivity: Number(select('#sensitivity').value),
  };
  sound.setEnabled(preferences.sound);
  sound.voices = preferences.voices;
  if (!sound.voices) sound.stopVoice();
  renderer?.setPixelRatio(Math.min(devicePixelRatio, preferences.quality === 'low' ? 1 : 1.5));
  try { localStorage.setItem(storageKey + ':settings', JSON.stringify(preferences)); } catch {}
}

function applyPreferences() {
  select('#sound').checked = preferences.sound !== false;
  select('#voices').checked = preferences.voices !== false;
  select('#reduced-motion').checked = preferences.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  select('#quality').value = preferences.quality ?? 'high';
  select('#sensitivity').value = preferences.sensitivity ?? 3;
  savePreferences();
}

function collides(position) {
  const radius = .3;
  for (const collider of world.colliders ?? []) {
    if (collider.radius != null) {
      if (Math.hypot(position.x - collider.x, position.z - collider.z) < collider.radius + radius) return true;
    } else if (Math.abs(position.x - collider.x) < collider.width / 2 + radius && Math.abs(position.z - collider.z) < collider.depth / 2 + radius) return true;
  }
  return false;
}

function updatePlayer(delta) {
  if (!player || isPaused()) return;
  const moveX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const moveZ = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = running ? 5 : 2.6;
  const moving = (moveX !== 0 || moveZ !== 0) && dialogueIndex < 0 && !holdActive;
  direction.set(moveX * Math.cos(yaw) - moveZ * Math.sin(yaw), 0, -moveX * Math.sin(yaw) - moveZ * Math.cos(yaw));
  if (cameraMode === 'free') {
    if (direction.lengthSq()) freePosition.addScaledVector(direction.normalize(), delta * (running ? 15 : 7));
    freePosition.y += (Number(keys.has('KeyR')) - Number(keys.has('KeyQ'))) * delta * 5;
    freePosition.y = Math.max(.3, Math.min(55, freePosition.y));
    freePosition.x = THREE.MathUtils.clamp(freePosition.x, -70, 70);
    freePosition.z = THREE.MathUtils.clamp(freePosition.z, -70, 70);
  } else if (moving) {
    direction.normalize();
    nextPosition.copy(player.root.position).addScaledVector(direction, speed * delta);
    nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, world.bounds.minX + .5, world.bounds.maxX - .5);
    nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, world.bounds.minZ + .5, world.bounds.maxZ - .5);
    const previousZ = nextPosition.z;
    nextPosition.z = player.root.position.z;
    if (!collides(nextPosition)) player.root.position.x = nextPosition.x;
    nextPosition.x = player.root.position.x;
    nextPosition.z = previousZ;
    if (!collides(nextPosition)) player.root.position.z = nextPosition.z;
    const angle = Math.atan2(direction.x, direction.z);
    player.root.rotation.y += Math.atan2(Math.sin(angle - player.root.rotation.y), Math.cos(angle - player.root.rotation.y)) * Math.min(1, delta * 12);
  }
  const motion = holdActive ? 'pray' : moving && cameraMode !== 'free' ? running ? 'run' : 'walk' : 'idle';
  if (dialogueIndex < 0 && motion !== currentMotion) { player.setMotion(motion); currentMotion = motion; }
}

function updateCamera(delta) {
  if (!player) return;
  if (inMenu) {
    const angle = preferences.reducedMotion ? .52 : .52 + Math.sin(elapsed * .025) * .07;
    camera.position.set(Math.sin(angle) * 13, 4.2, Math.cos(angle) * 13);
    camera.lookAt(0, 1.8, -2);
    return;
  }
  const eyeHeight = chapter.playerId === 'JOSEPH_CHILD' ? 1.05 : chapter.playerId === 'JOSEPH_YOUTH' ? 1.45 : 1.65;
  target.copy(player.root.position).add(new THREE.Vector3(0, eyeHeight, 0));
  if (cameraMode === 'free') {
    camera.position.copy(freePosition);
    direction.set(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(target.copy(freePosition).add(direction));
  } else if (cameraMode === 'first') {
    camera.position.copy(target);
    direction.set(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(target.add(direction));
  } else {
    desiredCamera.set(Math.sin(yaw) * cameraDistance * Math.cos(pitch), Math.sin(pitch) * cameraDistance + .8, Math.cos(yaw) * cameraDistance * Math.cos(pitch)).add(target);
    camera.position.lerp(desiredCamera, preferences.reducedMotion ? 1 : 1 - Math.exp(-delta * 11));
    camera.lookAt(target);
  }
}

function updateInteraction(delta) {
  const portal = !isPaused() && dialogueIndex < 0 && player && portals?.nearest(player.root.position);
  if (portal) {
    select('#interaction').hidden = false;
    select('#interaction-label').textContent = `Enter ${portal.label}`;
    select('#waypoint').hidden = true;
    holdTime = 0;
    return;
  }
  const objective = currentObjective();
  const active = objective && !isPaused() && dialogueIndex < 0;
  if (!active) { select('#interaction').hidden = true; select('#waypoint').hidden = true; holdTime = 0; return; }
  const distance = distanceToObjective();
  const near = distance < 3;
  select('#interaction').hidden = !near;
  select('#interaction-label').textContent = objective.kind === 'pray' ? 'Hold to pray' : objective.kind === 'talk' ? 'Speak & listen' : objective.kind === 'inspect' ? 'Examine closely' : objective.kind === 'serve' ? 'Offer a helping hand' : objective.kind === 'speak' ? 'Stand & speak' : objective.kind === 'travel' ? 'Continue the journey' : 'Take part';
  if (!near) { holdTime = 0; holdActive = false; }
  if (near && holdActive && objective.kind === 'pray') {
    holdTime += delta;
    select('#hold-progress').style.width = `${Math.min(1, holdTime / 2.6) * 100}%`;
    if (holdTime >= 2.6) beginInteraction();
  } else select('#hold-progress').style.width = '0%';
  target.fromArray(objective.target);
  target.y = 2.15;
  const forward = camera.getWorldDirection(new THREE.Vector3());
  const toPoint = target.clone().sub(camera.position);
  const projected = target.clone().project(camera);
  const visible = forward.dot(toPoint) > 0 && Math.abs(projected.x) < .94 && Math.abs(projected.y) < .84;
  select('#waypoint').hidden = !visible || distance < 2;
  if (visible) {
    select('#waypoint').style.left = `${(projected.x * .5 + .5) * innerWidth}px`;
    select('#waypoint').style.top = `${(-projected.y * .5 + .5) * innerHeight}px`;
    select('#waypoint-distance').textContent = `${Math.round(distance)} m`;
  }
  if (!visible && !near) select('#objective-hint').textContent = `${objective.prompt} · ${Math.round(distance)} m away. Turn to find the golden marker.`;
  else select('#objective-hint').textContent = objective.prompt ?? 'Follow the light and press E.';
}

function updateLight(delta) {
  if (!heavenly) return;
  const objects = heavenly.userData;
  const intensity = objects.light.intensity + (lightStrength * 8 - objects.light.intensity) * Math.min(1, delta * 1.5);
  objects.light.intensity = intensity;
  objects.beam.material.opacity = intensity * .011;
  objects.motes.material.opacity = intensity * .07;
  if (!preferences.reducedMotion) {
    objects.motes.rotation.y = elapsed * .025;
    objects.motes.position.y = Math.sin(elapsed * .3) * .18;
  }
}

function render() {
  requestAnimationFrame(render);
  const delta = Math.min(clock.getDelta(), .05);
  elapsed += delta;
  if (!world) return;
  world.update(delta, elapsed);
  portals?.update(elapsed, preferences.reducedMotion);
  updatePlayer(delta);
  if (!isPaused()) { player?.update(delta); actors.forEach(actor => actor.update(delta)); }
  updateCamera(delta);
  updateInteraction(delta);
  updateLight(delta);
  if (marker) {
    marker.visible = Boolean(currentObjective()) && !inMenu && !loading;
    marker.userData.diamond.rotation.y = elapsed * .7;
    marker.userData.diamond.position.y = 1.75 + (preferences.reducedMotion ? 0 : Math.sin(elapsed * 2) * .1);
  }
  if (preferences.quality === 'low') renderer.render(scene, camera);
  else outline.render(scene, camera);
}

function fatal(error) {
  console.error(error);
  select('#fatal-detail').textContent = `${error.message} Run “npm run build” in the project folder and serve the project over HTTP (not file://).`;
  select('#fatal').hidden = false;
  select('#loading').hidden = true;
  document.body.dataset.ready = 'error';
}

function bindInputs() {
  document.addEventListener('keydown', event => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Escape') {
      if (select('#journal').open || select('#settings').open) return;
      event.preventDefault();
      if (inMenu && save) resume(); else showMenu();
      return;
    }
    if (event.code === 'KeyJ' && !loading) { event.preventDefault(); if (select('#journal').open) select('#journal').close(); else openJournal(); return; }
    if (isPaused()) return;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Digit1') setCamera('first');
    if (event.code === 'Digit3') setCamera('third');
    if (event.code === 'KeyV') setCamera(cameraMode === 'free' ? 'third' : 'free');
    if (event.code === 'Space' && dialogueIndex >= 0) advanceDialogue();
    if (event.code === 'KeyE') {
      if (dialogueIndex >= 0) advanceDialogue();
      else if (currentObjective()?.kind === 'pray' && distanceToObjective() < 3) holdActive = true;
      else beginInteraction();
    }
  });
  document.addEventListener('keyup', event => { keys.delete(event.code); if (event.code === 'KeyE') { holdActive = false; holdTime = 0; } });
  window.addEventListener('blur', releaseKeys);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseKeys(); });
  canvas.addEventListener('pointerdown', event => {
    if (isPaused()) return;
    pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({preventScroll: true});
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId || isPaused()) return;
    const sensitivity = (preferences.sensitivity ?? 3) * .0013;
    yaw -= (event.clientX - pointer.x) * sensitivity;
    pitch = THREE.MathUtils.clamp(pitch + (event.clientY - pointer.y) * sensitivity, -.7, 1.1);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  const pointerEnd = event => { if (pointer?.id === event.pointerId) pointer = null; };
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('wheel', event => { if (!isPaused() && cameraMode === 'third') { event.preventDefault(); cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * .007, 2, 11); } }, {passive: false});
  select('#begin').addEventListener('click', () => { sound.start(); enterChapter('01').catch(fatal); });
  select('#resume').addEventListener('click', resume);
  select('#choose-chapter').addEventListener('click', () => openJournal());
  select('#witnesses').addEventListener('click', () => { sound.start(); enterChapter('10').catch(fatal); });
  select('#menu-button').addEventListener('click', showMenu);
  select('#journal-button').addEventListener('click', () => openJournal());
  select('#settings-button').addEventListener('click', () => { releaseKeys(); select('#settings').showModal(); });
  select('#next-line').addEventListener('click', advanceDialogue);
  select('#next-chapter').addEventListener('click', nextChapter);
  select('#complete-journal').addEventListener('click', () => openJournal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => select(`#${button.dataset.close}`).close()));
  document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => setCamera(button.dataset.camera)));
  for (const tab of ['chapters', 'history', 'cast']) select(`#tab-${tab}`).addEventListener('click', () => { journalTab = tab; renderJournal(); });
  ['sound', 'voices', 'reduced-motion', 'quality', 'sensitivity'].forEach(id => select(`#${id}`).addEventListener('change', savePreferences));
  select('#reset-save').addEventListener('click', () => {
    if (!confirm('Reset all saved chapter progress? Your models and recordings will not be changed.')) return;
    completed.clear(); visited.clear(); save = null;
    try { localStorage.removeItem(storageKey); } catch {}
    select('#settings').close();
    showMenu();
  });
  const startAction = event => {
    event.preventDefault();
    sound.start();
    if (dialogueIndex >= 0) advanceDialogue();
    else if (currentObjective()?.kind === 'pray' && distanceToObjective() < 3 && !isPaused()) holdActive = true;
    else beginInteraction();
  };
  for (const id of ['interact-button', 'touch-act']) {
    select(`#${id}`).addEventListener('pointerdown', startAction);
    select(`#${id}`).addEventListener('pointerup', () => { holdActive = false; holdTime = 0; });
    select(`#${id}`).addEventListener('pointercancel', () => { holdActive = false; holdTime = 0; });
  }
  document.querySelectorAll('[data-move]').forEach(button => {
    button.addEventListener('pointerdown', event => { event.preventDefault(); keys.add(button.dataset.move); button.setPointerCapture(event.pointerId); });
    const end = () => keys.delete(button.dataset.move);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
  });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
}

async function init() {
  renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  outline = new OutlineEffect(renderer, {defaultThickness: .0018, defaultColor: [.13, .1, .07]});
  applyPreferences();
  bindInputs();
  marker = makeMarker();
  heavenly = makeHeavenlyLight();
  [chapters] = await Promise.all([loadChapters(), loadAssetManifest()]);
  requestAnimationFrame(render);
  await enterChapter('03', {preview: true});
  showMenu();
  if (new URLSearchParams(location.search).get('chapter')) await enterChapter(new URLSearchParams(location.search).get('chapter'));
  window.zionGame = {
    scene, camera, renderer,
    getState: () => ({ready: !loading, chapter: chapter?.id, objective: objectiveIndex, objectiveId: currentObjective()?.id, objectiveCount: chapter?.objectives.length, camera: cameraMode, player: player?.root.position.toArray(), dialogue: dialogueIndex, paused: isPaused(), completed: [...completed], actors: getAssetStatus(), chapters: chapters.length}),
    enterChapter: id => enterChapter(id),
    setCamera,
    teleportToObjective: () => { if (!player || !currentObjective()) return; player.root.position.fromArray(currentObjective().target).add(new THREE.Vector3(0, 0, 1.1)); },
    interact: beginInteraction,
    advanceDialogue,
    getChapter: () => chapter,
  };
}

init().catch(fatal);
