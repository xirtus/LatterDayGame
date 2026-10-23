import * as THREE from 'three';

export const SEGMENT_CHILDREN = Object.freeze({
  Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head',
  LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand',
  LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase',
  RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase',
});

export function boneName(name) {
  return name.replace(/^.*[:|]/, '').replace(/^mixamorig/i, '');
}

export function createRigProfile(figure) {
  const bones = {};
  const skeletons = new Set();
  figure.traverse(object => {
    if (object.isBone) bones[boneName(object.name)] = object;
    if (object.skeleton) skeletons.add(object.skeleton);
  });
  const boneCount = Object.keys(bones).length;
  const virtualEndpoints = [];
  for (const [side, other] of [['Left', 'Right'], ['Right', 'Left']]) {
    if (!bones[side + 'Foot'] && bones[side + 'Leg'] && bones[other + 'Foot']) {
      const endpoint = new THREE.Object3D();
      endpoint.name = `motion${side}FootSupport`;
      endpoint.position.copy(bones[other + 'Foot'].position);
      bones[side + 'Leg'].add(endpoint);
      bones[side + 'Foot'] = endpoint;
      virtualEndpoints.push(side + 'Foot');
    }
  }
  figure.updateWorldMatrix(true, true);
  const transforms = [];
  figure.traverse(object => transforms.push({object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone()}));
  const restWorld = Object.fromEntries(Object.entries(bones).map(([name, bone]) => [name, bone.getWorldQuaternion(new THREE.Quaternion())]));
  const segments = Object.entries(SEGMENT_CHILDREN).filter(([name, child]) => bones[name] && bones[child]).map(([name, child]) => ({
    name, bone: bones[name], child: bones[child],
    direction: bones[child].getWorldPosition(new THREE.Vector3()).sub(bones[name].getWorldPosition(new THREE.Vector3())).normalize(),
  }));
  const signature = JSON.stringify({
    hierarchy: Object.entries(bones).map(([name, bone]) => [name, bone.parent?.name, bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()]),
    inverseBind: [...skeletons].map(skeleton => skeleton.boneInverses.map(matrix => matrix.elements)),
  });
  let fingerprint = 2166136261;
  for (const character of signature) fingerprint = Math.imul(fingerprint ^ character.charCodeAt(0), 16777619);
  return {
    bones, segments, transforms, restWorld, signature, fingerprint: (fingerprint >>> 0).toString(16),
    family: `meshy-${boneCount}`, virtualEndpoints, supported: ['Hips', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg'].every(name => bones[name]),
    restore() {
      for (const transform of transforms) {
        transform.object.position.copy(transform.position);
        transform.object.quaternion.copy(transform.quaternion);
        transform.object.scale.copy(transform.scale);
      }
      figure.updateWorldMatrix(true, true);
    },
  };
}

export function aimSegment(segment, desired) {
  const origin = segment.bone.getWorldPosition(new THREE.Vector3());
  const current = segment.child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(current, desired);
  const world = segment.bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta);
  const parent = segment.bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  segment.bone.quaternion.copy(parent.multiply(world));
  segment.bone.updateWorldMatrix(false, true);
}
