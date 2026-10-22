import * as THREE from 'three';

const ERAS = [
  ['E1', 'Eden', '#bbe6a6'],
  ['E2', 'The 1800s', '#e5ba7e'],
  ['E3', '1955', '#98d7d2'],
  ['E4', '1994', '#b8b3e8'],
  ['E5', 'Our own time', '#acd4f2'],
  ['E6', 'After the fire', '#ec9d6d'],
  ['E8', 'Zion', '#fff0b2'],
];

export function createPortals(scene, chapterId) {
  const group = new THREE.Group();
  group.name = 'era-portals';
  scene.add(group);
  const portals = [];
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  for (const [index, [id, label, color]] of ERAS.entries()) {
    if (id === chapterId) continue;
    const position = new THREE.Vector3(-12, 0, 9 - index * 3.8);
    const geometry = new THREE.SphereGeometry(.95, 32, 20);
    geometries.add(geometry);
    const material = new THREE.MeshPhysicalMaterial({color, transparent: true, opacity: .24, roughness: .15, metalness: .3, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false});
    material.userData.outlineParameters = {visible: false};
    materials.add(material);
    const bubble = new THREE.Mesh(geometry, material);
    bubble.position.copy(position).add(new THREE.Vector3(0, 1.2, 0));
    group.add(bubble);
    const rimGeometry = new THREE.TorusGeometry(.98, .025, 7, 64);
    geometries.add(rimGeometry);
    const rimMaterial = new THREE.MeshBasicMaterial({color, transparent: true, opacity: .8});
    materials.add(rimMaterial);
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.position.copy(bubble.position);
    rim.rotation.y = Math.PI / 2;
    group.add(rim);
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 96;
    const context = labelCanvas.getContext('2d');
    context.fillStyle = '#fff1cb';
    context.textAlign = 'center';
    context.font = '34px Georgia';
    context.fillText(label, 256, 51);
    context.font = '16px Arial';
    context.fillStyle = color;
    context.fillText('CROSS THE YEARS', 256, 81);
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const labelMaterial = new THREE.SpriteMaterial({map: texture, depthTest: false, transparent: true});
    materials.add(labelMaterial);
    const sprite = new THREE.Sprite(labelMaterial);
    sprite.position.copy(position).add(new THREE.Vector3(0, 2.8, 0));
    sprite.scale.set(3.3, .62, 1);
    group.add(sprite);
    portals.push({id, label, position, bubble, rim});
  }
  return {
    nearest(position) {
      return portals.find(portal => Math.hypot(position.x - portal.position.x, position.z - portal.position.z) < 2.4);
    },
    update(elapsed, reducedMotion) {
      if (reducedMotion) return;
      portals.forEach((portal, index) => {
        portal.bubble.position.y = 1.2 + Math.sin(elapsed * .7 + index) * .12;
        portal.rim.rotation.z = Math.sin(elapsed * .2 + index) * .15;
      });
    },
    dispose() {
      group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
    },
  };
}
