import * as THREE from 'three';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {createWorld} from './world.js';
import {createActor, loadAssetManifest, getAssetStatus} from './actors.js';
import {loadChapters, speakerName} from './story.js';
import {Soundscape} from './audio.js';
import {createPortals} from './portals.js';
import {createRecordPlay} from './record-play.js';
import {createLightingRuntime} from './lighting/runtime.js';
import {createEncounterRuntime, getEncounterActorConfigs} from './encounters/encounter-runtime.js';
import {createEncounterSFX} from './encounters/sfx.js';

const select = selector => document.querySelector(selector);
const canvas = select('#world');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .08, 230);
const sound = new Soundscape();
const storageKey = 'gathering-of-zion:v1';
let renderer;
let outline;
let chapters = [];
let assetManifest;
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
let recordPlay;
let lighting;
let encounters;
let encounterSFX;
let encounterState;
let lastEncounterSave = 0;
let lastEncounterHUD = -1;
let lightStrength = 0;
const keys = new Set();
const freePosition = new THREE.Vector3();
const nextPosition = new THREE.Vector3();
const direction = new THREE.Vector3();
const target = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const clock = new THREE.Clock();
const cameraRay = new THREE.Raycaster();
let save;
let preferences;
try { save = JSON.parse(localStorage.getItem(storageKey) ?? 'null'); } catch { save = null; }
try { preferences = JSON.parse(localStorage.getItem(storageKey + ':settings') ?? '{}'); } catch { preferences = {}; }
const completed = new Set(Array.isArray(save?.completed) ? save.completed : []);
const visited = new Set(Array.isArray(save?.visited) ? save.visited : []);
const recordProgress = save?.recordProgress && typeof save.recordProgress === 'object' ? save.recordProgress : {};
const encounterProgress = save?.encounterProgress && typeof save.encounterProgress === 'object' ? save.encounterProgress : {};
let recordBookmark = save?.recordBookmark ?? null;
let journalTab = 'chapters';

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
}

function persist() {
  if (!chapter || inMenu || loading) return;
  if (encounters) encounterProgress[chapter.id] = encounters.serialize();
  save = {version: 4, chapter: chapter.id, objective: objectiveIndex, objectiveId: currentObjective()?.id ?? null, position: player?.root.position.toArray(), facing: player?.root.rotation.y, camera: cameraMode, yaw, pitch, completed: [...completed], visited: [...visited], recordBookmark, recordProgress, encounterProgress, updated: new Date().toISOString()};
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
function objectiveTarget() { return recordPlay?.target(currentObjective()) ?? currentObjective()?.target; }
function protagonistId() { return chapter?.playerStages?.[Math.min(objectiveIndex, chapter.objectives.length - 1)] ?? chapter?.playerId ?? 'JOSEPH_YOUNG'; }

function distanceToObjective() {
  const objective = currentObjective();
  if (!objective || !player) return Infinity;
  return player.root.position.distanceTo(new THREE.Vector3().fromArray(objectiveTarget()));
}

function nearbyPortal() {
  if (isPaused() || dialogueIndex >= 0 || !player) return null;
  const local = (world.localPortals ?? []).map(portal => ({...portal, position: new THREE.Vector3().fromArray(portal.position), local: true})).filter(portal => player.root.position.distanceTo(portal.position) < 3).sort((first, second) => player.root.position.distanceTo(first.position) - player.root.position.distanceTo(second.position))[0];
  const portal = local ?? portals?.nearest(player.root.position);
  if (!portal) return null;
  const distance = Math.hypot(player.root.position.x - portal.position.x, player.root.position.z - portal.position.z);
  return distance < distanceToObjective() - .25 ? portal : null;
}

function setCamera(mode) {
  if (!['first', 'third', 'free'].includes(mode)) return;
  if (mode === 'free' && cameraMode !== 'free') freePosition.copy(camera.position);
  cameraMode = mode;
  select('#crosshair').hidden = mode !== 'first';
  document.querySelectorAll('[data-camera]').forEach(button => button.classList.toggle('active', button.dataset.camera === mode));
  if (player) player.root.visible = mode !== 'first';
  const protagonist = speakerName(protagonistId());
  if (!inMenu) toast(mode === 'free' ? `Free camera · WASD to fly, Q down, R up. ${protagonist} stays in place.` : mode === 'first' ? `First person · walk in ${protagonist}’s footsteps.` : `Third person · drag to look around ${protagonist}.`, 2800);
}

function releaseKeys() {
  keys.clear();
  encounters?.handleAction('guard', {enabled: false});
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
    actor.root.visible = actor.id !== protagonistId() && objectiveIndex >= started && objectiveIndex <= ended;
    if (chapter.id === 'BM06' && actor.id === 'CHRIST') actor.root.visible = actor.root.visible && (objectiveIndex > 2 || objectiveIndex === 2 && dialogueIndex >= 0);
  });
  if (player) player.root.visible = cameraMode !== 'first';
}

function characterVariant(id, explicit) {
  if (explicit) return explicit;
  if (id === 'CHRIST') return chapter.id === '31' || chapter.id.startsWith('E') ? 'red' : 'white';
  if (id === 'ORSON') return chapter.id.startsWith('E') ? 'elder' : 'young';
  return undefined;
}

async function loadStageActors(version = generation) {
  const configs = [...(chapter.actors ?? []), ...(world.extras ?? [])].filter(config => objectiveIndex >= (config.showFrom ?? 0) && objectiveIndex <= (config.hideAfter ?? Infinity));
  const needed = configs.filter(config => !actors.some(actor => actor.config === config));
  if (!needed.length && player?.id === protagonistId()) return;
  loading = true;
  select('#loading').hidden = false;
  const onStatus = message => { if (generation === version) select('#load-label').textContent = message; };
  if (player && player.id !== protagonistId()) {
    const previous = player;
    const replacement = await createActor({id: protagonistId(), position: previous.root.position.clone(), scene, player: true, onStatus});
    if (version !== generation) { replacement.dispose(); return; }
    replacement.root.rotation.copy(previous.root.rotation);
    previous.dispose();
    player = replacement;
    currentMotion = 'idle';
    toast(chapter.id === 'BM05' && objectiveIndex === 1 ? 'Adapted household-support viewpoint · play as Sariah while Nephi remains bound.' : `Now following ${speakerName(protagonistId())}.`, 6000);
  }
  for (const config of needed) {
    const variant = characterVariant(config.id, config.variant);
    const companion = await createActor({...config, position: world.actorPositions?.[config.id] ?? config.position, variant, scene, onStatus});
    if (version !== generation) { companion.dispose(); return; }
    companion.config = config;
    companion.root.userData.lifeRole = config.lifeRole;
    actors.push(companion);
  }
  if (version !== generation) return;
  loading = false;
  select('#loading').hidden = true;
  applyActorVisibility();
  applyStoryBlocking();
  encounters?.syncActors(actors, player);
}

function applyStoryBlocking() {
  for (const actor of actors) {
    const scribe = chapter.id === '08' && actor.id === 'OLIVER' && objectiveIndex >= 1 && objectiveIndex < 6;
    const hymn = chapter.id === '30' && actor.id === 'JOHN_TAYLOR' && objectiveIndex < 2;
    const seated = scribe || hymn;
    if (seated === Boolean(actor.root.userData.storySeat)) continue;
    actor.root.userData.storySeat = seated;
    if (seated) {
      actor.root.position.fromArray(scribe ? [3, 0, -3.2] : [2.8, 3.35, 1.4]);
      actor.root.rotation.y = scribe ? 0 : Math.PI;
      actor.setMotion('sit');
      actor.setMotion(scribe ? 'work' : 'listen');
    } else {
      const position = world.actorPositions?.[actor.id] ?? actor.config.position;
      if (position) actor.root.position.fromArray(position);
      actor.setMotion('stand');
    }
  }
}

function updateObjectiveUI() {
  const objective = currentObjective();
  lighting?.setObjective(objectiveIndex);
  encounters?.setObjective(objectiveIndex);
  if (chapter.id === '10' && objectiveIndex >= 2) lightStrength = 0;
  select('#chapter-location').textContent = `${chapter.date} · ${chapter.place}`;
  select('#chapter-title').textContent = chapter.title;
  if (objective) {
    select('#objective-title').textContent = objective.label;
    select('#objective-hint').textContent = objective.prompt ?? 'Follow the light and press E to take part.';
    select('#objective-count').textContent = `${objectiveIndex + 1} of ${chapter.objectives.length}`;
    select('#objective-progress').style.width = `${objectiveIndex / chapter.objectives.length * 100}%`;
    marker.position.fromArray(objectiveTarget());
    marker.visible = true;
  } else {
    select('#objective-title').textContent = 'A moment remembered';
    select('#objective-hint').textContent = 'You may keep exploring, or continue the journey.';
    select('#objective-count').textContent = 'Complete';
    select('#objective-progress').style.width = '100%';
    marker.visible = false;
  }
  applyActorVisibility();
  applyStoryBlocking();
  if (recordPlay && currentObjective()) recordPlay.update(objectiveIndex, elapsed, preferences.reducedMotion);
  select('#record-return').hidden = !chapter.record;
  select('#record-button').hidden = !chapter.record && !chapters.some(item => item.record && item.anchors?.includes(chapter.id));
}

async function enterChapter(id, options = {}) {
  const selected = chapters.find(item => item.id === id);
  if (!selected) throw new Error(`Chapter ${id} is unavailable.`);
  if (selected.record && chapter && !chapter.record && !options.preview && !options.preserveBookmark) {
    const savedOrigin = inMenu && save?.chapter !== chapter.id ? chapters.find(item => item.id === save?.chapter) : null;
    if (savedOrigin?.record) recordBookmark ??= {chapter: savedOrigin.returnAtAnchor ?? '08', objective: 0};
    else if (savedOrigin) recordBookmark = {chapter: savedOrigin.id, objective: savedObjective(savedOrigin), objectiveId: save.objectiveId, camera: cameraMode};
    else recordBookmark = {chapter: chapter.id, objective: objectiveIndex, objectiveId: currentObjective()?.id ?? null, position: player?.root.position.toArray(), facing: player?.root.rotation.y, camera: cameraMode, yaw, pitch};
  }
  if (chapter && encounters && !inMenu) encounterProgress[chapter.id] = encounters.serialize();
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
  encounterSFX?.dispose();
  encounterSFX = null;
  encounters?.dispose();
  encounters = null;
  encounterState = null;
  lighting?.dispose();
  lighting = null;
  actors.forEach(actor => actor.dispose());
  player?.dispose();
  actors = [];
  player = null;
  recordPlay?.dispose();
  recordPlay = null;
  world?.dispose();
  portals?.dispose();
  portals = null;
  chapter = selected;
  objectiveIndex = Math.max(0, Math.min(options.objective ?? 0, chapter.objectives.length));
  chapterFinished = objectiveIndex >= chapter.objectives.length;
  lightStrength = chapter.environment === 'celestial' ? 1 : 0;
  world = createWorld({scene, chapter, quality: preferences.quality ?? 'high'});
  world.extras.push(...getEncounterActorConfigs(chapter, world));
  lighting = createLightingRuntime({renderer, scene, camera, world, chapter, outline, quality: preferences.quality, reducedMotion: preferences.reducedMotion, reducedFlash: preferences.reducedFlash});
  camera.far = world.cameraFar;
  camera.updateProjectionMatrix();
  for (const objective of chapter.objectives) {
    objective.stageTarget ??= [...objective.target];
    const point = objective.point ?? Object.entries({center: [0, 0, 0], gather: [-4, 0, 1], study: [3, 0, -2], prayer: [0, 0, -5], journey: [0, 0, 13], left: [-7, 0, -3], right: [7, 0, -3]}).find(([, position]) => position.every((value, index) => value === objective.stageTarget[index]))?.[0];
    objective.target = [...(world.objectivePoints?.[objective.id] ?? world.objectivePoints?.[point] ?? objective.stageTarget)];
  }
  if (chapter.record) recordPlay = createRecordPlay({chapter, world, progress: recordProgress, changed: () => { persist(); sound.chime('step'); updateObjectiveUI(); }});
  if (chapter.id.startsWith('E')) portals = createPortals(scene, chapter.id, ['E4', 'E7'].includes(chapter.id));
  const onStatus = message => { if (generation === version) select('#load-label').textContent = message; };
  const actor = await createActor({id: protagonistId(), position: world.spawn, scene, player: true, onStatus});
  if (version !== generation) { actor.dispose(); return; }
  player = actor;
  if (options.position?.length === 3 && options.position.every(Number.isFinite)) player.root.position.fromArray(options.position);
  await loadStageActors(version);
  if (version !== generation) return;
  loading = false;
  currentMotion = 'idle';
  yaw = options.yaw ?? 0;
  pitch = options.pitch ?? .12;
  if (options.camera) setCamera(options.camera);
  player.root.rotation.y = Number.isFinite(options.facing) ? options.facing : Math.PI;
  camera.position.copy(player.root.position).add(new THREE.Vector3(0, 2.5, 6));
  freePosition.copy(camera.position);
  heavenly.visible = false;
  encounters = createEncounterRuntime({scene, world, chapter, actors, player, getActors: () => actors, getPlayer: () => player, onNotice: message => { if (!inMenu && !loading) toast(message, 6000); }, onState: receiveEncounterState});
  if (encounterProgress[chapter.id]?.objective === objectiveIndex) encounters.restore(encounterProgress[chapter.id]);
  encounterState = encounters.getState();
  encounterSFX = createEncounterSFX(sound, encounterState);
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
    if (chapter.record) toast(chapter.id.startsWith('TX') ? 'Imaginative time mission · speculative fiction, not scripture or official doctrine.' : 'The record within the record · a playable scriptural adaptation. Return to Joseph at any time.', 7000);
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
  persist();
  inMenu = true;
  releaseKeys();
  sound.stopVoice();
  select('#menu').hidden = false;
  select('#hud').hidden = true;
  select('#resume').hidden = !save;
  select('#resume').textContent = save ? `Continue · ${chapters.find(item => item.id === save.chapter)?.title ?? 'your journey'}` : 'Continue your journey';
}

function savedObjective(savedChapter) {
  let objective = save.objective;
  if ((save.version ?? 1) < 2 && savedChapter?.objectiveMigrationV1) objective = savedChapter.objectiveMigrationV1[objective] ?? savedChapter.objectives.length;
  else if (save.objectiveId && savedChapter) {
    const matchingIndex = savedChapter.objectives.findIndex(item => item.id === save.objectiveId);
    if (matchingIndex >= 0) objective = matchingIndex;
  }
  return objective;
}

function resume() {
  sound.start();
  if (save) enterChapter(save.chapter, {objective: savedObjective(chapters.find(item => item.id === save.chapter)), position: save.position, facing: save.facing, camera: save.camera, yaw: save.yaw, pitch: save.pitch, preserveBookmark: true}).catch(fatal);
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
  applyActorVisibility();
  const playing = sound.speak(line, chapter.id, currentObjective().id, dialogueIndex);
  select('#voice-note').textContent = playing ? 'Local recorded performance' : 'Dramatized dialogue · recording pending';
  select('#next-line').innerHTML = dialogueIndex === dialogueLines.length - 1 ? 'Remember this moment <kbd>Space</kbd> →' : 'Continue <kbd>Space</kbd> →';
  actors.forEach(actor => actor.setMotion(actor.id === line.speaker ? 'speak' : 'listen'));
  if (line.speaker === player.id || line.speaker.startsWith('JOSEPH_')) player.setMotion(currentObjective()?.kind === 'pray' ? 'pray' : 'speak');
}

function advanceDialogue() {
  if (dialogueIndex < 0 || isPaused()) return;
  dialogueIndex += 1;
  displayLine();
}

function beginInteraction() {
  const portal = nearbyPortal();
  if (portal) {
    sound.chime('revelation');
    if (portal.local && !portal.chapter) { world.activatePortal(portal.id); toast(`${portal.label} · a speculative possible world, not documented history.`); }
    else enterChapter(portal.chapter ?? portal.id).catch(fatal);
    return;
  }
  const objective = currentObjective();
  if (!objective || isPaused() || dialogueIndex >= 0 || distanceToObjective() > 3 || Math.abs(player.root.position.y - objectiveTarget()[1]) > 1.1) return;
  if (recordPlay?.act(objective, player.root.position)) return;
  holdActive = false;
  holdTime = 0;
  select('#interaction').hidden = true;
  select('#chapter-banner').hidden = true;
  const effect = objective.effect;
  if (effect === 'revelation' || effect === 'stars' || effect === 'light' || objective.kind === 'pray') {
    lighting?.setEvent(objective.kind === 'pray' ? 'prayer' : 'revelation');
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
  world.onObjectiveComplete?.(objectiveIndex);
  encounters?.onObjectiveComplete(objectiveIndex);
  objectiveIndex += 1;
  holdActive = false;
  holdTime = 0;
  player?.setMotion('idle');
  currentMotion = 'idle';
  updateObjectiveUI();
  persist();
  sound.chime('step');
  if (objectiveIndex >= chapter.objectives.length) finishChapter();
  else {
    toast('Moment remembered · the path continues.', 2300);
    loadStageActors().catch(fatal);
  }
}

function finishChapter() {
  chapterFinished = true;
  completed.add(chapter.id);
  persist();
  sound.chime('complete');
  select('#complete-title').textContent = chapter.title;
  select('#complete-copy').textContent = chapter.id === '30' ? 'On June 27, 1844, Joseph and Hyrum were killed at Carthage. Their mortal lives ended, but this story does not close with their deaths. Continue beyond the veil into an imaginative chapter of reunion and hope.' : chapter.epilogue ?? 'Carry this moment into the gathering ahead.';
  const campaign = chapters.filter(item => !item.record);
  const finalCampaignChapter = campaign.indexOf(chapter) === campaign.length - 1;
  select('#next-chapter').firstChild.textContent = chapter.record ? 'Return to Joseph’s story ' : finalCampaignChapter ? 'Return to the grove ' : 'Continue the story ';
  select('#chapter-complete').hidden = false;
  select('#interaction').hidden = true;
  select('#waypoint').hidden = true;
}

function nextChapter() {
  if (chapter.record) { returnToStory(); return; }
  const campaign = chapters.filter(item => !item.record);
  const index = campaign.indexOf(chapter);
  const next = campaign[index + 1] ?? chapters.find(item => item.id === '03');
  enterChapter(next.id).catch(fatal);
}

function returnToStory() {
  const bookmark = recordBookmark ?? {chapter: '08', objective: 0};
  const origin = chapters.find(item => item.id === bookmark.chapter && !item.record) ?? chapters.find(item => item.id === '08');
  const matched = origin.objectives.findIndex(item => item.id === bookmark.objectiveId);
  enterChapter(origin.id, {...bookmark, objective: matched >= 0 ? matched : bookmark.objective}).catch(fatal);
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
    const stagedIds = new Set([chapter.playerId, ...(chapter.playerStages ?? []), ...(chapter.actors ?? []).map(config => config.id)]);
    const profiles = [...stagedIds].map(id => {
      const config = chapter.actors?.find(actor => actor.id === id);
      const variant = characterVariant(id, config?.variant);
      const variantProfile = variant ? assetManifest.characters[`${id}_${variant.toUpperCase()}`] : null;
      return {...(variantProfile?.asset ? variantProfile : assetManifest.characters[id] ?? {label: speakerName(id)}), id};
    });
    container.innerHTML = `<p class="history-status">${status.glbCount} local exports indexed. Missing male visuals borrow Whitmer-family rigs; female visuals borrow Louisa Follett. These are temporary visuals, not historical identities. Elijah Able, Walker Lewis and Jane Manning retain provisional figures until their dedicated rigs arrive.</p><div class="cast-grid">${profiles.map(profile => { const active = status.actors.find(actor => actor.id === profile.id); return `<article class="cast-card"><h3>${escapeHTML(speakerName(profile.id))}</h3><p>${escapeHTML(profile.asset?.file ?? active?.source ?? 'Dedicated export pending')}</p><small>${profile.asset ? profile.asset.rigged ? 'MODEL & RIG READY' : 'MODEL FOUND · RIG NEEDED' : active?.standInId ? `BORROWED VISUAL · ${escapeHTML(speakerName(active.standInId))}` : 'PROVISIONAL FIGURE · RIG PENDING'}</small></article>`; }).join('')}</div><p class="history-copy"><a href="content/model-checklist.csv" download>Complete model &amp; rig checklist ↧</a></p><p class="history-status">Crowd and mob stand-ins never identify the source-model person as an attendee or attacker. Refresh the build after adding optimized rigs.</p><p class="history-copy"><a href="../docs/world-overhaul-report.html" target="_blank">Architecture and scene reports ↗</a></p>`;
  } else if (journalTab === 'records') {
    const origin = chapter.record ? recordBookmark?.chapter : chapter.id;
    const records = chapters.filter(item => item.record);
    container.innerHTML = `<section class="record-introduction"><p class="eyebrow">The record within the record</p><h3>Ancient promises. A living gathering.</h3><p>Enter a scriptural adaptation, or explore the separately marked imagined time mission. Joseph’s place in the story is bookmarked when you enter. These chapters do not claim the witnesses saw every ancient event.</p>${chapter.record ? '<button id="library-return" class="primary">Return to Joseph’s story →</button>' : ''}<label class="record-search">Find a record <input id="record-search" type="search" placeholder="Dream, Jared, Christ, Moroni…"></label><p class="small-note">${records.length} playable adaptations · blueprints, routes and exact ancient architecture are artistic reconstructions. <a href="../docs/book-of-mormon-scenes-report.html" target="_blank" rel="noopener">Research &amp; concept art ↗</a></p></section><div class="record-grid">${records.map(item => {
      const linked = item.anchors?.includes(origin);
      return `<article class="record-card" data-record-title="${escapeHTML(`${item.title} ${item.id} ${item.mechanic ?? ''}`.toLowerCase())}"><p class="eyebrow">${escapeHTML(item.id)} · ${item.id.startsWith('TX') ? 'SPECULATIVE TIME FICTION' : 'SCRIPTURAL ADAPTATION'}${linked ? ' · LINKED TO THIS CHAPTER' : ''}</p><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.intro ?? item.history?.slice(0, 180) ?? '')}</p><small>${escapeHTML(item.playerId ? speakerName(item.playerId) : '')} · ${escapeHTML(item.date)}</small><button data-record="${item.id}">${completed.has(item.id) ? 'Revisit' : 'Open the record'} →</button></article>`;
    }).join('')}</div><p id="record-no-results" hidden>No matching records. Try a name or scene.</p>`;
    container.querySelectorAll('[data-record]').forEach(button => button.addEventListener('click', () => { select('#journal').close(); sound.start(); enterChapter(button.dataset.record).catch(fatal); }));
    select('#library-return')?.addEventListener('click', () => { select('#journal').close(); returnToStory(); });
    select('#record-search').addEventListener('input', event => {
      const query = event.target.value.trim().toLowerCase();
      let visible = 0;
      container.querySelectorAll('[data-record-title]').forEach(card => { card.hidden = !card.dataset.recordTitle.includes(query); if (!card.hidden) visible++; });
      select('#record-no-results').hidden = visible > 0;
    });
  } else {
    container.innerHTML = `<div class="chapter-list">${chapters.filter(item => !item.record).map(item => `${item.id === 'E1' ? '<h3 class="journal-section-heading">The seven-era mission · speculative expansion</h3>' : ''}<button class="chapter-choice ${chapter?.id === item.id ? 'current' : ''}" data-chapter="${item.id}"><span>${item.id}</span><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.date)} · ${escapeHTML(item.place)}${item.id === '31' || item.id === '32' || item.id.startsWith('E') ? ' · IMAGINATIVE' : ''}</small></div>${completed.has(item.id) ? '<span class="tick" aria-label="Completed">✓</span>' : ''}</button>`).join('')}</div>`;
    container.querySelectorAll('[data-chapter]').forEach(button => button.addEventListener('click', () => {
      select('#journal').close();
      sound.start();
      enterChapter(button.dataset.chapter).catch(fatal);
    }));
  }
}

function savePreferences() {
  const previous = preferences;
  preferences = {
    sound: select('#sound').checked,
    voices: select('#voices').checked,
    reducedMotion: select('#reduced-motion').checked,
    reducedFlash: select('#reduced-flash').checked,
    quality: select('#quality').value,
    sensitivity: Number(select('#sensitivity').value),
  };
  sound.setEnabled(preferences.sound);
  sound.voices = preferences.voices;
  if (!sound.voices) sound.stopVoice();
  renderer?.setPixelRatio(Math.min(devicePixelRatio, preferences.quality === 'low' ? 1 : 1.5));
  if (lighting && (previous.quality !== preferences.quality || previous.reducedMotion !== preferences.reducedMotion || previous.reducedFlash !== preferences.reducedFlash)) {
    lighting.dispose();
    lighting = createLightingRuntime({renderer, scene, camera, world, chapter, outline, quality: preferences.quality, reducedMotion: preferences.reducedMotion, reducedFlash: preferences.reducedFlash});
    lighting.setObjective(objectiveIndex);
  }
  try { localStorage.setItem(storageKey + ':settings', JSON.stringify(preferences)); } catch {}
}

function applyPreferences() {
  select('#sound').checked = preferences.sound !== false;
  select('#voices').checked = preferences.voices !== false;
  select('#reduced-motion').checked = preferences.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  select('#reduced-flash').checked = preferences.reducedFlash !== false;
  select('#quality').value = preferences.quality ?? 'high';
  select('#sensitivity').value = preferences.sensitivity ?? 3;
  savePreferences();
}

function collides(position) {
  const radius = .3;
  for (const collider of world.colliders ?? []) {
    if (collider.minY != null && position.y + 1.55 <= collider.minY + .04) continue;
    if (collider.maxY != null && position.y + .18 >= collider.maxY) continue;
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
  const phase = encounterState?.player?.phase;
  const attacking = ['windup', 'active', 'recovery', 'stagger'].includes(phase);
  const speed = encounterState?.guarding ? 1.3 : encounterState?.crouching ? 1.35 : running ? 5 : 2.6;
  const moving = (moveX !== 0 || moveZ !== 0) && dialogueIndex < 0 && !holdActive && !world.summary.restrainPlayer && !attacking;
  direction.set(moveX * Math.cos(yaw) - moveZ * Math.sin(yaw), 0, -moveX * Math.sin(yaw) - moveZ * Math.cos(yaw));
  if (cameraMode === 'free') {
    if (direction.lengthSq()) freePosition.addScaledVector(direction.normalize(), delta * (running ? 15 : 7));
    freePosition.y += (Number(keys.has('KeyR')) - Number(keys.has('KeyQ'))) * delta * 5;
    freePosition.y = Math.max(.3, Math.min(160, freePosition.y));
    freePosition.x = THREE.MathUtils.clamp(freePosition.x, world.bounds.minX - 30, world.bounds.maxX + 30);
    freePosition.z = THREE.MathUtils.clamp(freePosition.z, world.bounds.minZ - 30, world.bounds.maxZ + 30);
  } else if (moving) {
    direction.normalize();
    nextPosition.copy(player.root.position).addScaledVector(direction, speed * delta);
    nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, world.bounds.minX + .5, world.bounds.maxX - .5);
    nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, world.bounds.minZ + .5, world.bounds.maxZ - .5);
    const previousZ = nextPosition.z;
    nextPosition.z = player.root.position.z;
    nextPosition.y = world.getGroundHeight(nextPosition.x, nextPosition.z, player.root.position.y);
    if (Math.abs(nextPosition.y - player.root.position.y) < .5 && !collides(nextPosition)) { player.root.position.x = nextPosition.x; player.root.position.y = nextPosition.y; }
    nextPosition.x = player.root.position.x;
    nextPosition.z = previousZ;
    nextPosition.y = world.getGroundHeight(nextPosition.x, nextPosition.z, player.root.position.y);
    if (Math.abs(nextPosition.y - player.root.position.y) < .5 && !collides(nextPosition)) { player.root.position.z = nextPosition.z; player.root.position.y = nextPosition.y; }
    const angle = Math.atan2(direction.x, direction.z);
    player.root.rotation.y += Math.atan2(Math.sin(angle - player.root.rotation.y), Math.cos(angle - player.root.rotation.y)) * Math.min(1, delta * 12);
  }
  const motion = holdActive ? 'pray' : attacking ? phase === 'stagger' ? 'fear' : 'attack' : encounterState?.guarding && encounterState.combatEnabled ? 'guard' : moving && cameraMode !== 'free' ? encounterState?.crouching ? 'walk_crouch' : running ? 'run' : 'walk' : encounterState?.crouching ? 'crouch' : 'idle';
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
  const standingEyeHeight = chapter.playerId === 'JOSEPH_CHILD' ? 1.05 : chapter.playerId === 'JOSEPH_YOUTH' ? 1.45 : 1.65;
  const eyeHeight = currentMotion === 'pray' || encounterState?.crouching || currentObjective()?.kind === 'pray' && dialogueIndex >= 0 ? standingEyeHeight * .64 : standingEyeHeight;
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
    const cameraDirection = desiredCamera.clone().sub(target);
    const requestedDistance = cameraDirection.length();
    cameraRay.set(target, cameraDirection.normalize());
    cameraRay.far = requestedDistance;
    const obstruction = cameraRay.intersectObject(world.group, true).find(hit => {
      let ancestor = hit.object;
      while (ancestor && ancestor !== world.group) { if (!ancestor.visible) return false; ancestor = ancestor.parent; }
      return hit.distance > .25 && !hit.object.material?.transparent && !hit.object.material?.isSpriteMaterial;
    });
    if (obstruction) desiredCamera.copy(target).addScaledVector(cameraDirection, Math.max(.28, obstruction.distance - .2));
    camera.position.lerp(desiredCamera, preferences.reducedMotion ? 1 : 1 - Math.exp(-delta * 11));
    camera.lookAt(target);
  }
}

function updateInteraction(delta) {
  const portal = nearbyPortal();
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
  const near = distance < (recordPlay?.hint(objective) ? 1.8 : 3) && Math.abs(player.root.position.y - objectiveTarget()[1]) <= 1.1;
  select('#interaction').hidden = !near;
  select('#interaction-label').textContent = objective.kind === 'pray' ? 'Hold to pray' : objective.kind === 'talk' ? 'Speak & listen' : objective.kind === 'inspect' ? 'Examine closely' : objective.kind === 'serve' ? 'Offer a helping hand' : objective.kind === 'speak' ? 'Stand & speak' : objective.kind === 'travel' ? 'Continue the journey' : 'Take part';
  if (!near) { holdTime = 0; holdActive = false; }
  if (near && holdActive && objective.kind === 'pray') {
    holdTime += delta;
    select('#hold-progress').style.width = `${Math.min(1, holdTime / 2.6) * 100}%`;
    if (holdTime >= 2.6) beginInteraction();
  } else select('#hold-progress').style.width = '0%';
  target.fromArray(objectiveTarget());
  target.y += 2.15;
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
  if (recordPlay?.hint(objective)) select('#objective-hint').textContent = recordPlay.hint(objective);
  else if (!visible && !near) select('#objective-hint').textContent = `${objective.prompt} · ${Math.round(distance)} m away. Turn to find the golden marker.`;
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
  if (player) world.update(delta, elapsed, player.root.position, camera.position);
  recordPlay?.update(objectiveIndex, elapsed, preferences.reducedMotion);
  portals?.update(elapsed, preferences.reducedMotion);
  updatePlayer(delta);
  encounters?.update(delta, elapsed, {paused: isPaused() || cameraMode === 'free', dialogueSpeaker: dialogueIndex >= 0 ? dialogueLines[dialogueIndex]?.speaker : null, running: keys.has('ShiftLeft') || keys.has('ShiftRight'), guarding: keys.has('KeyG') && cameraMode !== 'free' && dialogueIndex < 0, objective: objectiveIndex, reducedMotion: preferences.reducedMotion, reducedFlash: preferences.reducedFlash});
  if (!isPaused()) {
    player?.update(delta);
    actors.forEach(actor => {
      actor.update(delta);
      if (dialogueIndex >= 0 && actor.root.visible && !actor.root.userData.encounterManaged && !actor.root.userData.storySeat) {
        const speaker = dialogueLines[dialogueIndex]?.speaker;
        if (actor.id === speaker) {
          const angle = Math.atan2(player.root.position.x - actor.root.position.x, player.root.position.z - actor.root.position.z);
          actor.root.rotation.y += Math.atan2(Math.sin(angle - actor.root.rotation.y), Math.cos(angle - actor.root.rotation.y)) * Math.min(1, delta * 2);
        }
      }
    });
  }
  updateCamera(delta);
  updateInteraction(delta);
  if (!lighting) updateLight(delta);
  lighting?.update(delta, elapsed, player?.root.position);
  updateEncounterUI();
  if (!isPaused() && elapsed - lastEncounterSave > 12) { lastEncounterSave = elapsed; persist(); }
  if (marker) {
    marker.visible = Boolean(currentObjective()) && !inMenu && !loading;
    if (currentObjective()) marker.position.fromArray(objectiveTarget());
    marker.userData.diamond.rotation.y = elapsed * .7;
    marker.userData.diamond.position.y = 1.75 + (preferences.reducedMotion ? 0 : Math.sin(elapsed * 2) * .1);
  }
  if (lighting) lighting.render();
  else if (preferences.quality === 'low') renderer.render(scene, camera);
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
    sound.start();
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Digit1') setCamera('first');
    if (event.code === 'Digit3') setCamera('third');
    if (event.code === 'KeyV') setCamera(cameraMode === 'free' ? 'third' : 'free');
    if (cameraMode !== 'free' && dialogueIndex < 0 && !holdActive) {
      if (event.code === 'KeyF') encounterAction('attack');
      if (event.code === 'KeyC') encounterAction('crouch');
      if (event.code === 'KeyQ') encounterAction('evade');
      if (event.code === 'KeyH') encounterAction('toggleChallenge');
      if (event.code === 'KeyX') encounterAction('distract');
    }
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
  select('#choose-record').addEventListener('click', () => openJournal('records'));
  select('#record-button').addEventListener('click', () => openJournal('records'));
  select('#record-return').addEventListener('click', returnToStory);
  select('#witnesses').addEventListener('click', () => { sound.start(); enterChapter('10').catch(fatal); });
  select('#menu-button').addEventListener('click', showMenu);
  select('#journal-button').addEventListener('click', () => openJournal());
  select('#settings-button').addEventListener('click', () => { releaseKeys(); select('#settings').showModal(); });
  select('#next-line').addEventListener('click', advanceDialogue);
  select('#next-chapter').addEventListener('click', nextChapter);
  select('#complete-journal').addEventListener('click', () => openJournal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => select(`#${button.dataset.close}`).close()));
  document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => setCamera(button.dataset.camera)));
  for (const tab of ['chapters', 'records', 'history', 'cast']) select(`#tab-${tab}`).addEventListener('click', () => { journalTab = tab; renderJournal(); });
  ['sound', 'voices', 'reduced-motion', 'reduced-flash', 'quality', 'sensitivity'].forEach(id => select(`#${id}`).addEventListener('change', savePreferences));
  document.querySelectorAll('[data-encounter-action]').forEach(button => button.addEventListener('click', () => encounterAction(button.dataset.encounterAction)));
  select('#guard-action').addEventListener('pointerdown', event => { event.preventDefault(); keys.add('KeyG'); event.currentTarget.setPointerCapture(event.pointerId); });
  for (const type of ['pointerup', 'pointercancel']) select('#guard-action').addEventListener(type, () => keys.delete('KeyG'));
  select('#reset-save').addEventListener('click', () => {
    if (!confirm('Reset all saved chapter progress? Your models and recordings will not be changed.')) return;
    completed.clear(); visited.clear(); save = null; recordBookmark = null;
    for (const key of Object.keys(recordProgress)) delete recordProgress[key];
    for (const key of Object.keys(encounterProgress)) delete encounterProgress[key];
    try { localStorage.removeItem(storageKey); } catch {}
    select('#settings').close();
    inMenu = true;
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
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); lighting?.resize(innerWidth, innerHeight); });
  addEventListener('pagehide', persist);
}

async function init() {
  select('#settings .control-list').before(select('#polish-settings').content.cloneNode(true));
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
  [chapters, assetManifest] = await Promise.all([loadChapters(), loadAssetManifest()]);
  requestAnimationFrame(render);
  await enterChapter('03', {preview: true});
  showMenu();
  const requestedChapter = new URLSearchParams(location.search).get('chapter');
  if (requestedChapter) {
    const savedEntry = save?.chapter === requestedChapter;
    await enterChapter(requestedChapter, savedEntry ? {objective: savedObjective(chapters.find(item => item.id === requestedChapter)), position: save.position, facing: save.facing, camera: save.camera, yaw: save.yaw, pitch: save.pitch, preserveBookmark: true} : {});
  }
  window.zionGame = {
    scene, camera, renderer,
    getState: () => ({ready: !loading, chapter: chapter?.id, objective: objectiveIndex, objectiveId: currentObjective()?.id, objectiveCount: chapter?.objectives.length, camera: cameraMode, player: player?.root.position.toArray(), playerId: player?.id, dialogue: dialogueIndex, paused: isPaused(), completed: [...completed], actors: getAssetStatus(), chapters: chapters.length, record: Boolean(chapter?.record), recordBookmark, recordProgress, activityTarget: objectiveTarget()}),
    enterChapter: id => enterChapter(id),
    setCamera,
    setFreeView: (position, nextYaw = yaw, nextPitch = pitch) => { setCamera('free'); freePosition.fromArray(position); yaw = nextYaw; pitch = nextPitch; },
    placePlayer: position => player?.root.position.fromArray(position),
    teleportToObjective: () => { if (!player || !currentObjective()) return; player.root.position.fromArray(objectiveTarget()).add(new THREE.Vector3(0, 0, 1.1)); },
    interact: beginInteraction,
    advanceDialogue,
    getChapter: () => chapter,
    getWorld: () => world,
    getLighting: () => lighting?.getState(),
    getEncounters: () => encounters?.getState(),
    encounterAction,
    getMotionDiagnostics: () => [player, ...actors].filter(Boolean).map(actor => ({id: actor.id, ...actor.getAnimationDiagnostics?.()})),
  };
}

function encounterAction(action) {
  if (isPaused() || dialogueIndex >= 0 || cameraMode === 'free') return false;
  const accepted = encounters?.handleAction(action);
  encounterState = encounters?.getState();
  if (action === 'attack' && accepted) currentMotion = 'attack';
  if (!accepted && action === 'attack') toast('Combat is available only in designated ancient challenges. Press H to enable the optional challenge there.');
  persist();
  return Boolean(accepted);
}

function receiveEncounterState(state) {
  encounterSFX?.update(state);
  if (chapter.id === '30' && state.stage !== encounterState?.stage) {
    if (['approach', 'breach', 'stairs', 'upper-room'].includes(state.stage)) lighting?.setEvent('carthage-assault');
    else if (state.stage === 'aftermath') lighting?.setEvent('carthage-stillness');
  }
  if (chapter.id === 'BM24' && state.passage >= 1 && (encounterState?.passage ?? 0) < 1) lighting?.setEvent('cumorah-withdrawal');
  encounterState = state;
}

function updateEncounterUI() {
  if (Math.floor(elapsed * 5) === lastEncounterHUD) return;
  lastEncounterHUD = Math.floor(elapsed * 5);
  const panel = select('#encounter-panel');
  const state = encounterState;
  const featured = state && state.kind !== 'living-world';
  panel.hidden = !featured || inMenu || loading || dialogueIndex >= 0;
  if (!featured) return;
  select('#encounter-label').textContent = state.label;
  const status = state.kind === 'carthage' ? `Historical account · ${state.stage.replaceAll('-', ' ')}` : `${state.challenge ? 'Challenge' : 'Story assist'} · ${state.alertCount ? 'Seen — withdraw or guard' : state.suspicion > .15 ? 'Sentries investigating' : state.crouching ? 'Moving quietly' : 'Undetected'}`;
  if (select('#encounter-status').textContent !== status) select('#encounter-status').textContent = status;
  select('#health-meter').value = state.player?.health ?? 100;
  select('#stamina-meter').value = state.player?.stamina ?? 100;
  select('#suspicion-meter').value = state.suspicion ?? 0;
  select('#challenge-action').textContent = state.challenge ? 'Story assist [H]' : 'Enable challenge [H]';
  select('#challenge-action').hidden = state.kind === 'carthage';
  select('#combat-actions').hidden = !state.combatEnabled;
}

init().catch(fatal);
