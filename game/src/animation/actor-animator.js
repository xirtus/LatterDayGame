import * as THREE from 'three';
import {aimSegment, boneName, createRigProfile} from './rig-profile.js';

let libraryPromise;
const clipCache = new Map();
const maximumIdleProfiles = 12;
const maximumIdleBytes = 8 * 1024 * 1024;
let cacheHits = 0;
let cacheMisses = 0;
export const MOTION_STATES = Object.freeze(['idle', 'walk', 'run', 'talk', 'listen', 'sit', 'stand', 'pray', 'work', 'fear', 'attack', 'guard', 'crouch', 'walk_crouch']);

function trimClipCache() {
  const unused = [...clipCache].filter(([, entry]) => entry.references === 0);
  let bytes = unused.reduce((total, [, entry]) => total + entry.bytes, 0);
  let count = unused.length;
  for (const [key, entry] of unused) {
    if (count <= maximumIdleProfiles && bytes <= maximumIdleBytes) break;
    clipCache.delete(key);
    bytes -= entry.bytes;
    count--;
  }
}

export function getMotionCacheStatus() {
  const entries = [...clipCache.values()];
  return {
    profiles: entries.length, activeProfiles: entries.filter(entry => entry.references > 0).length,
    retainedBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    unusedBytes: entries.filter(entry => entry.references === 0).reduce((total, entry) => total + entry.bytes, 0),
    hits: cacheHits, misses: cacheMisses, maximumIdleProfiles, maximumIdleBytes,
  };
}

export function loadMotionLibrary() {
  libraryPromise ??= fetch(new URL('./animations/manifest.json', document.baseURI)).then(response => {
    if (!response.ok) throw new Error(`Motion library: HTTP ${response.status}`);
    return response.json();
  }).catch(error => { libraryPromise = null; throw error; });
  return libraryPromise;
}

function sampleDirection(library, name, segment, time) {
  const clip = library.clips[name];
  const phase = THREE.MathUtils.clamp(time / clip.duration, 0, 1) * (clip.frames - 1);
  const lower = Math.floor(phase), upper = Math.min(clip.frames - 1, lower + 1);
  const stride = library.segments.length * 3, offset = library.segments.indexOf(segment) * 3;
  return new THREE.Vector3().fromArray(clip.data, lower * stride + offset).lerp(new THREE.Vector3().fromArray(clip.data, upper * stride + offset), phase - lower).normalize();
}

function bakeClips(profile, library, root) {
  const rootInverse = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const orientation = rootInverse.clone().invert();
  const reference = Object.fromEntries(library.segments.map(segment => [segment, sampleDirection(library, 'idle', segment, 0)]));
  const semantic = {idle: 'idle', walk: 'walk', run: 'run', talk: 'talk', listen: 'listen', sit: 'sit', stand: 'sit', work: 'work', fear: 'fear', attack: 'attack', guard: 'guard', crouch: 'crouch', walk_crouch: 'walk_crouch', seatedTalk: 'talk', seatedListen: 'listen', seatedWork: 'work'};
  const result = {};
  for (const [name, sourceName] of Object.entries(semantic)) {
    const source = library.clips[sourceName];
    const duration = source.duration;
    const frames = Math.ceil(duration * 12) + 1;
    const tracks = new Map(profile.segments.map(segment => [segment.name, []]));
    const times = [];
    for (let frame = 0; frame < frames; frame++) {
      const time = frame * duration / (frames - 1);
      profile.restore();
      times.push(time);
      for (const segment of profile.segments) {
        const lowerBody = /UpLeg|Leg$|Foot$/.test(segment.name);
        let clipName = sourceName;
        let clipTime = name === 'stand' ? duration - time : time;
        if (['talk', 'listen', 'work'].includes(name) && lowerBody) { clipName = 'idle'; clipTime = time % library.clips.idle.duration; }
        if (['crouch', 'walk_crouch'].includes(name) && /Arm/.test(segment.name)) { clipName = name === 'crouch' ? 'idle' : 'walk'; clipTime = time % library.clips[clipName].duration; }
        if (name.startsWith('seated') && lowerBody) { clipName = 'sit'; clipTime = library.clips.sit.duration; }
        let direction = sampleDirection(library, clipName, segment.name, clipTime);
        if (/Spine|Neck/.test(segment.name)) {
          const neutral = segment.direction.clone().applyQuaternion(rootInverse);
          const sourceNeutral = ['talk', 'listen', 'sit'].includes(clipName) ? new THREE.Vector3(0, 1, 0) : reference[segment.name];
          direction = neutral.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(sourceNeutral, direction));
          if (name === 'listen') direction.lerp(segment.direction.clone().applyQuaternion(rootInverse), .7).normalize();
        }
        if (/Foot$/.test(segment.name)) {
          direction = segment.direction.clone().applyQuaternion(rootInverse).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(reference[segment.name], direction));
        }
        if (name === 'listen' && /Arm/.test(segment.name)) direction.lerp(sampleDirection(library, 'idle', segment.name, time % library.clips.idle.duration), .8).normalize();
        aimSegment(segment, direction.applyQuaternion(orientation));
        if (source.loop && time > duration - .3 && !(name.startsWith('seated') && lowerBody)) {
          segment.bone.quaternion.slerp(new THREE.Quaternion().fromArray(tracks.get(segment.name), 0), (time - duration + .3) / .3);
          segment.bone.updateWorldMatrix(false, true);
        }
        tracks.get(segment.name).push(...segment.bone.quaternion.toArray());
      }
    }
    const clip = new THREE.AnimationClip(name, duration, profile.segments.map(segment => new THREE.QuaternionKeyframeTrack(`${segment.bone.name}.quaternion`, times, tracks.get(segment.name))));
    clip.userData = {source: source.source, loop: !['sit', 'stand', 'attack'].includes(name)};
    result[name] = clip;
  }
  profile.restore();
  return result;
}

export async function createActorAnimator({figure, holder, root, height}) {
  const library = await loadMotionLibrary();
  const profile = createRigProfile(figure);
  if (!profile.supported) { profile.restore(); return null; }
  const restHolder = holder.position.clone();
  root.updateWorldMatrix(true, true);
  const feet = ['LeftFoot', 'RightFoot'].map(name => profile.bones[name]).filter(Boolean);
  const ground = Math.min(...feet.map(bone => root.worldToLocal(bone.getWorldPosition(new THREE.Vector3())).y));
  const key = profile.signature;
  let cached = clipCache.get(key);
  if (!cached) {
    const clips = bakeClips(profile, library, root);
    const bytes = Object.values(clips).reduce((total, clip) => total + clip.tracks.reduce((size, track) => size + track.times.byteLength + track.values.byteLength, 0), key.length * 2);
    cached = {clips, references: 0, bytes};
    cacheMisses++;
  } else {
    clipCache.delete(key);
    cacheHits++;
  }
  clipCache.set(key, cached);
  cached.references++;
  const mixer = new THREE.AnimationMixer(figure);
  let action, motion, seated = false, elapsed = 0, transition = 0, disposed = false;
  const retiring = new Map();
  const animator = {
    profile,
    setMotion(requested, options = {}) {
      const aliases = {speaking: 'talk', listening: 'listen', sitting: 'sit', working: 'work', prayer: 'pray', cower: 'fear', stagger: 'fear', idleAlert: 'guard'};
      requested = aliases[requested] ?? requested;
      if (requested === 'pray') { animator.stop(); motion = 'pray'; seated = false; return; }
      if (requested === 'sit') seated = true;
      else if (['stand', 'walk', 'run', 'idle', 'fear', 'attack', 'guard', 'crouch', 'walk_crouch'].includes(requested)) seated = false;
      const seatedMotion = {talk: 'seatedTalk', listen: 'seatedListen', work: 'seatedWork'};
      const resolved = seated && seatedMotion[requested] ? seatedMotion[requested] : requested;
      const clip = cached.clips[resolved] ?? cached.clips.idle;
      if (motion === resolved && !options.restart) {
        if (Number.isFinite(options.speed)) action?.setEffectiveTimeScale(THREE.MathUtils.clamp(options.speed, .25, 2));
        return;
      }
      if (motion === 'pray') profile.restore();
      const previous = action;
      action = mixer.clipAction(clip);
      retiring.delete(action);
      action.reset().setEffectiveTimeScale(options.speed ?? 1).setEffectiveWeight(1);
      action.setLoop(clip.userData.loop ? THREE.LoopRepeat : THREE.LoopOnce, clip.userData.loop ? Infinity : 1);
      action.clampWhenFinished = !clip.userData.loop;
      action.play();
      transition = Math.max(0, options.fade ?? .24);
      if (previous && previous !== action) {
        action.crossFadeFrom(previous, transition, false);
        retiring.set(previous, transition);
      }
      motion = resolved;
      elapsed = 0;
      mixer.update(0);
    },
    update(delta) {
      if (disposed || motion === 'pray') return;
      const step = THREE.MathUtils.clamp(Number.isFinite(delta) ? delta : 0, 0, .1);
      elapsed += step;
      mixer.update(step);
      for (const [oldAction, remaining] of retiring) {
        if (remaining <= step) { oldAction.stop(); retiring.delete(oldAction); }
        else retiring.set(oldAction, remaining - step);
      }
      holder.position.copy(restHolder);
      root.updateWorldMatrix(true, true);
      const lowest = Math.min(...feet.map(bone => root.worldToLocal(bone.getWorldPosition(new THREE.Vector3())).y));
      holder.position.y += THREE.MathUtils.clamp(ground - lowest, -height * .55, height * .15);
      root.updateWorldMatrix(true, true);
    },
    stop() {
      mixer.stopAllAction();
      retiring.clear();
      action = null;
      profile.restore();
      holder.position.copy(restHolder);
    },
    getBoneSocket(name, target = new THREE.Vector3()) {
      root.updateWorldMatrix(true, true);
      return profile.bones[boneName(name)]?.getWorldPosition(target) ?? null;
    },
    diagnostics() {
      return {rig: profile.family, fingerprint: profile.fingerprint, virtualEndpoints: profile.virtualEndpoints, motion, source: action?.getClip().userData.source ?? 'fitted prayer IK', duration: action?.getClip().duration ?? null, elapsed, transition, rootMotionOwner: 'motor', clipCount: Object.keys(cached.clips).length, activeActions: action ? 1 + retiring.size : 0, seated};
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction();
      mixer.uncacheRoot(figure);
      cached.references--;
      trimClipCache();
    },
  };
  return animator;
}
