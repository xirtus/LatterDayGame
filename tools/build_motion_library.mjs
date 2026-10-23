import * as THREE from 'three';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siblings = path.dirname(root);
const sources = {};
async function readSource(relative) {
  const bytes = await readFile(path.join(siblings, relative));
  sources[relative] = {sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length};
  return bytes;
}
const rigPath = 'planecrash/src/physics/retarget/anima44-rig.json';
const rig = JSON.parse(await readSource(rigPath));
const passengerPath = 'planecrash/public/assets/animations/passenger-clips.json';
const passenger = JSON.parse(await readSource(passengerPath));
const socialPath = 'planecrash3/src/npc-motion-data.json';
const social = JSON.parse(await readSource(socialPath));
await readSource('planecrash3/src/seated-social-pose.js');
await readSource('planecrash3/src/seated-social-idle.js');
const segments = {
  Spine: ['spine_01.x', 'spine_02.x'], Spine1: ['spine_02.x', 'spine_03.x'], Spine2: ['spine_03.x', 'neck.x'], Neck: ['neck.x', 'head.x'],
  LeftArm: ['arm_stretch.l', 'forearm_stretch.l'], LeftForeArm: ['forearm_stretch.l', 'hand.l'],
  RightArm: ['arm_stretch.r', 'forearm_stretch.r'], RightForeArm: ['forearm_stretch.r', 'hand.r'],
  LeftUpLeg: ['thigh_stretch.l', 'leg_stretch.l'], LeftLeg: ['leg_stretch.l', 'foot.l'], LeftFoot: ['foot.l', 'toes_01.l'],
  RightUpLeg: ['thigh_stretch.r', 'leg_stretch.r'], RightLeg: ['leg_stretch.r', 'foot.r'], RightFoot: ['foot.r', 'toes_01.r'],
};
const clean = name => name.replace(/[^a-z0-9]/gi, '').toLowerCase();
const rounded = value => Math.round(value * 100000) / 100000;
function graph(nodes) {
  const group = new THREE.Group();
  const bones = new Map();
  for (const node of nodes) {
    const bone = new THREE.Object3D();
    bone.name = clean(node.name);
    bone.position.fromArray(node.t ?? node.translation ?? [0, 0, 0]);
    bone.quaternion.fromArray(node.r ?? node.rotation ?? [0, 0, 0, 1]).normalize();
    bone.scale.fromArray(node.scale ?? [1, 1, 1]);
    bones.set(bone.name, bone);
  }
  for (const node of nodes) {
    const bone = bones.get(clean(node.name));
    if (node.parent) bones.get(clean(node.parent)).add(bone);
    else group.add(bone);
  }
  return {group, bones};
}
function direction(bones, start, end) {
  const first = bones.get(clean(start));
  const last = bones.get(clean(end));
  if (!first || !last) return new THREE.Vector3(0, -1, 0);
  return last.getWorldPosition(new THREE.Vector3()).sub(first.getWorldPosition(new THREE.Vector3())).normalize();
}
function extract(driver, apply, duration, source, loop = true) {
  const frames = Math.ceil(duration * 12) + 1;
  apply(0);
  driver.group.updateMatrixWorld(true);
  const across = direction(driver.bones, 'thigh_stretch.r', 'thigh_stretch.l');
  const yaw = Math.atan2(across.z, across.x);
  const basis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const data = [];
  for (let frame = 0; frame < frames; frame++) {
    apply(frame * duration / (frames - 1));
    driver.group.updateMatrixWorld(true);
    for (const [start, end] of Object.values(segments)) data.push(...direction(driver.bones, start, end).applyQuaternion(basis).toArray().map(rounded));
  }
  return {duration, frames, loop, source, sourceYaw: rounded(yaw), rootMotion: 'discarded; motor owns planar translation; target ankles supply vertical support', data};
}
function compact(name) {
  const record = passenger.clips.find(clip => clip.name === name);
  if (!record) throw new Error(`Missing allowlisted motion ${name}`);
  const driver = graph(rig.bones);
  const tracks = Object.entries(record.q).map(([name, packed]) => {
    const values = Array.isArray(packed) ? packed : [];
    if (!Array.isArray(packed)) {
      const bytes = Buffer.from(packed, 'base64');
      values.length = 0;
      for (let offset = 0; offset < bytes.length; offset += 2) values.push(bytes.readInt16LE(offset) / 32767);
    }
    return {bone: driver.bones.get(clean(name)), values};
  });
  return extract(driver, time => {
    const index = Math.min(record.n - 1, time * record.fps);
    const lower = Math.floor(index), upper = Math.min(record.n - 1, lower + 1);
    for (const track of tracks) {
      if (!track.bone) continue;
      const first = track.values.length === 4 ? 0 : lower * 4;
      const last = track.values.length === 4 ? 0 : upper * 4;
      track.bone.quaternion.fromArray(track.values, first).normalize().slerp(new THREE.Quaternion().fromArray(track.values, last).normalize(), index - lower);
    }
  }, record.duration, `${passengerPath}#${name} (${record.source})`);
}
async function glbClips(relative, selections) {
  const bytes = await readSource(relative);
  const length = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.toString('utf8', 20, 20 + length));
  const binary = bytes.subarray(28 + length);
  const nodes = document.nodes.map((node, index) => ({...node, name: node.name ?? `node${index}`}));
  nodes.forEach(node => node.children?.forEach(index => { nodes[index].parent = node.name; }));
  const driver = graph(nodes);
  const accessor = index => {
    const entry = document.accessors[index], view = document.bufferViews[entry.bufferView];
    if (entry.componentType !== 5126) throw new Error('Motion accessor must contain floats');
    const width = {SCALAR: 1, VEC3: 3, VEC4: 4}[entry.type];
    return Array.from({length: entry.count * width}, (_, value) => binary.readFloatLE((view.byteOffset ?? 0) + (entry.byteOffset ?? 0) + Math.floor(value / width) * (view.byteStride ?? width * 4) + value % width * 4));
  };
  const result = {};
  for (const [semantic, name] of Object.entries(selections)) {
    const animation = document.animations.find(clip => clip.name === name);
    if (!animation) throw new Error(`Missing ${relative}#${name}`);
    const channels = animation.channels.filter(channel => channel.target.path === 'rotation').map(channel => {
      const sampler = animation.samplers[channel.sampler];
      if (sampler.interpolation && sampler.interpolation !== 'LINEAR') throw new Error('Unsupported source interpolation');
      return {bone: driver.bones.get(clean(nodes[channel.target.node].name)), times: accessor(sampler.input), values: accessor(sampler.output)};
    });
    const duration = Math.max(...channels.map(channel => channel.times.at(-1)));
    result[semantic] = extract(driver, time => {
      for (const channel of channels) {
        let upper = channel.times.findIndex(value => value >= time);
        if (upper < 0) upper = channel.times.length - 1;
        const lower = Math.max(0, upper - 1);
        const blend = (time - channel.times[lower]) / (channel.times[upper] - channel.times[lower] || 1);
        channel.bone.quaternion.fromArray(channel.values, lower * 4).normalize().slerp(new THREE.Quaternion().fromArray(channel.values, upper * 4).normalize(), blend);
      }
    }, duration, `${relative}#${name}`, semantic !== 'attack');
  }
  return result;
}
const clips = {
  idle: compact('aaStandIdleAlert'), walkNormal: compact('aaWalkNormal'), walkSlow: compact('aaWalkSlow'),
  prayer: compact('rpgPray1'), fear: compact('rpgCowerIdle'), work: compact('aaSitReadingBook'),
  ...await glbClips('reincarnation/public/sibling/pigaloo/public/assets/animations/locomotion-library.glb', {walk: 'Walk', run: 'Jog'}),
  ...await glbClips('reincarnation/public/sibling/pigaloo/public/assets/archipelago/sword-actions.glb', {attack: 'Sword_Cut_A', guard: 'Sword_Guard'}),
  ...await glbClips('reincarnation/public/sibling/pigaloo/public/assets/archipelago/player-actions.glb', {crouch: 'Crouch_Idle', walk_crouch: 'Crouch_Walk'}),
};
const socialMap = {Spine: 'spine', Spine1: 'spine', Spine2: 'spine', Neck: 'spine', LeftArm: 'upperL', LeftForeArm: 'foreL', RightArm: 'upperR', RightForeArm: 'foreR', LeftUpLeg: 'thighL', LeftLeg: 'shinL', LeftFoot: 'footL', RightUpLeg: 'thighR', RightLeg: 'shinR', RightFoot: 'footR'};
for (const [semantic, name] of Object.entries({talk: 'talk', listen: 'rest', sit: 'sit'})) {
  const source = social.clips[name];
  const data = [];
  for (let frame = 0; frame < source.frames; frame++) for (const target of Object.keys(segments)) {
    const offset = (frame * social.segments.length + social.segments.indexOf(socialMap[target])) * 3;
    data.push(...source.data.slice(offset, offset + 3));
  }
  clips[semantic] = {duration: source.duration, frames: source.frames, loop: source.loop, source: `${socialPath}#${name} (${source.source})`, rootMotion: 'discarded; legs fitted to target proportions', data};
}
const assets = JSON.parse(await readFile(path.join(root, 'game/content/assets.json'), 'utf8'));
const targetAudit = [];
for (const id of ['JOSEPH_MATURE', 'EMMA', 'CHRIST', 'LOUISA']) {
  const file = assets.characters[id].asset.file;
  const bytes = await readFile(path.join(root, 'meshy', file));
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.toString('utf8', 20, 20 + length)), binary = bytes.subarray(28 + length);
  const nodes = document.nodes.map((node, index) => ({...node, name: node.name ?? `node${index}`}));
  nodes.forEach(node => node.children?.forEach(index => { nodes[index].parent = node.name; }));
  const driver = graph(nodes);
  driver.group.updateMatrixWorld(true);
  const skin = document.skins[0], accessor = document.accessors[skin.inverseBindMatrices], view = document.bufferViews[accessor.bufferView];
  let maximumBindPositionResidual = 0;
  const matrices = skin.joints.map((joint, index) => {
    const values = Array.from({length: 16}, (_, entry) => binary.readFloatLE((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + (index * 16 + entry) * 4));
    const bind = new THREE.Matrix4().fromArray(values).invert();
    maximumBindPositionResidual = Math.max(maximumBindPositionResidual, new THREE.Vector3().setFromMatrixPosition(bind).distanceTo(driver.bones.get(clean(nodes[joint].name)).getWorldPosition(new THREE.Vector3())));
    return values;
  });
  if (maximumBindPositionResidual > .0001) throw new Error(`${id}: exported reference pose differs from inverse bind; calibration required`);
  targetAudit.push({id, file, joints: skin.joints.length, sha256: createHash('sha256').update(bytes).digest('hex'), bindFingerprint: createHash('sha256').update(JSON.stringify({nodes, matrices})).digest('hex'), maximumBindPositionResidual, reference: 'Exported local transforms verified against inverse bind; centimetre armature parent retained'});
}
const manifest = {
  version: 1, coordinateSystem: 'metres, Y up, +Z forward, anatomical left +X', sampleRate: 12,
  method: 'Source world segment directions; per-target hierarchy and inverse-bind fingerprint; shortest-arc swing from target bind direction preserves target axial basis. No copied Anima arm offsets.',
  provenance: 'Allowlisted motion channels only. No sibling geometry, textures, characters, weapons, spells or audio copied. Original source assets remain untouched. Source hashes record provenance, not a new license grant.',
  sources, targetAudit, segments: Object.keys(segments), clips,
};
const output = path.join(root, 'game/animations');
await mkdir(output, {recursive: true});
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest));
console.log(`Built ${Object.keys(clips).length} allowlisted motion records; ${Object.keys(sources).length} source hashes.`);
