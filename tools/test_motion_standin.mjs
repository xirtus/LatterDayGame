import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createActorAnimator} from '../game/src/animation/actor-animator.js';

const library = JSON.parse(await readFile(new URL('../game/animations/manifest.json', import.meta.url), 'utf8'));
globalThis.document = {baseURI: 'http://motion-bench.invalid/game/'};
globalThis.fetch = async () => ({ok: true, json: async () => library});
const broken = await readFile(new URL('../meshy/peter_whitmer_jr_rigged.glb', import.meta.url));
const brokenDocument = JSON.parse(broken.toString('utf8', 20, 20 + broken.readUInt32LE(12)));
assert.ok(brokenDocument.skins.length > 0);
assert.ok(brokenDocument.nodes.filter(node => node.mesh !== undefined).every(node => node.skin === undefined));
assert.ok(brokenDocument.meshes.every(mesh => mesh.primitives.every(primitive => primitive.attributes.JOINTS_0 === undefined && primitive.attributes.WEIGHTS_0 === undefined)));
const bytes = await readFile(new URL('../meshy/Meshy_AI_peter_whitmer_jr_reri_All_Animations.glb', import.meta.url));
const oldLength = bytes.readUInt32LE(12), document = JSON.parse(bytes.toString('utf8', 20, 20 + oldLength));
document.images = [];document.textures = [];document.materials = [];
for (const mesh of document.meshes) for (const primitive of mesh.primitives) delete primitive.material;
const json = Buffer.from(JSON.stringify(document));
const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);json.copy(padded);
const binary = bytes.subarray(20 + oldLength);
const header = Buffer.alloc(20);header.writeUInt32LE(0x46546c67, 0);header.writeUInt32LE(2, 4);header.writeUInt32LE(20 + padded.length + binary.length, 8);header.writeUInt32LE(padded.length, 12);header.writeUInt32LE(0x4e4f534a, 16);
const input = Buffer.concat([header, padded, binary]);
const gltf = await new GLTFLoader().parseAsync(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '');
const root = new THREE.Group(), holder = new THREE.Group(), figure = gltf.scene;
figure.updateMatrixWorld(true);
const initialBounds = new THREE.Box3().setFromObject(figure);
const scale = 1.8 / initialBounds.getSize(new THREE.Vector3()).y;
holder.scale.setScalar(scale);holder.position.y = -initialBounds.min.y * scale;holder.add(figure);root.add(holder);
const animator = await createActorAnimator({figure, holder, root, height: 1.8});
function measure(label) {
  root.updateWorldMatrix(true, true);
  const bones = animator.profile.bones;
  const angle = side => {
    const vector = bones[side + 'ForeArm'].getWorldPosition(new THREE.Vector3()).sub(bones[side + 'Arm'].getWorldPosition(new THREE.Vector3())).normalize();
    return Math.atan2(Math.abs(vector.x), -vector.y) * 180 / Math.PI;
  };
  const bounds = new THREE.Box3();
  figure.traverse(object => {
    if (!object.isSkinnedMesh) return;
    object.computeBoundingBox();bounds.union(object.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return {label, left: angle('Left'), right: angle('Right'), skinnedWidth: bounds.getSize(new THREE.Vector3()).x, diagnostics: animator.diagnostics()};
}
const results = [measure('bind')];
animator.setMotion('idle');animator.update(0);results.push(measure('idle-immediate'));
for (let frame = 0; frame < 120; frame++) animator.update(1 / 60);
results.push(measure('idle-two-seconds'));
animator.setMotion('walk');animator.update(0);results.push(measure('walk-transition-zero'));
for (let frame = 0; frame < 60; frame++) animator.update(1 / 60);
results.push(measure('walk-one-second'));
console.log(JSON.stringify({bones: Object.keys(animator.profile.bones), results}, null, 2));
assert.ok(results.slice(1).every(result => result.left < 40 && result.right < 40), 'Peter stand-in retained T-pose arms');
assert.ok(results.slice(1).every(result => result.skinnedWidth > .25 && result.skinnedWidth < 1.1), 'Animated skin stayed in a T-pose or collapsed');
animator.dispose();
console.log('PASS Peter Whitmer Jr stand-in: immediate and persistent idle/walk skinning.');
