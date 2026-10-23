import * as THREE from 'three';

const ADVENTURE_IDS = new Set(['BM05', 'BM07', 'BM15', 'BM16', 'BM17', 'BM18', 'BM19', 'BM24', 'TX01', 'TX02', 'TX03']);

export function buildRecordAdventureWorld(context) {
  const {scene, group, chapter, box, cylinder, sphere, mesh, material, colliders, spawn, focus, bounds, tree, curve, book} = context;
  const recordId = chapter.recordId ?? chapter.id;
  if (!ADVENTURE_IDS.has(recordId)) return null;
  const objectivePoints = {};
  const actorPositions = {};
  const updates = [];
  const changes = [];
  const labels = [];
  const cutaways = [];
  const localPortals = [];
  let activateLocalPortal = null;
  const summary = {kind: 'record-adventure', recordId, navigable: true, adaptation: 'Authored cinematic interpretation; not a surveyed ancient reconstruction.'};
  let completed = -1;
  let currentObjective = 0;
  const floorHeight = () => 0;
  Object.assign(bounds, {minX: -80, maxX: 80, minZ: -80, maxZ: 80});
  spawn.set(0, 0, 18);
  focus.set(0, 2, 0);

  function objectiveLayout(locations) {
    chapter.objectives.forEach((objective, index) => {
      const location = locations[Math.min(index, locations.length - 1)];
      objectivePoints[objective.id] = [...location];
      if (objective.point) objectivePoints[objective.point] = [...location];
    });
    (chapter.actors ?? []).forEach((actor, index) => {
      const target = locations[Math.min(index, locations.length - 1)];
      actorPositions[actor.id] = [target[0] + (index % 2 ? -2.7 : 2.7), target[1], target[2] - 1.5];
    });
  }

  function assembly(name, build) {
    const before = group.children.length;
    build();
    const result = new THREE.Group();
    result.name = name;
    group.children.slice(before).forEach(object => result.add(object));
    group.add(result);
    return result;
  }

  function ground(color = '#819068', size = 360) {
    const surface = mesh(new THREE.PlaneGeometry(size, size), color, 0, -.035, 0);
    surface.rotation.x = -Math.PI / 2;
    surface.castShadow = false;
    return surface;
  }

  function solid(x, y, z, width, height, depth, color) {
    const result = box(x, y, z, width, height, depth, color);
    colliders.push({x, z, width, depth, minY: y - height / 2, maxY: y + height / 2});
    return result;
  }

  function sign(text, x, z, width = 5, color = '#e6d8ae') {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = '#343c37';
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    drawing.strokeStyle = '#bba46c';
    drawing.lineWidth = 6;
    drawing.strokeRect(8, 8, 1008, 144);
    drawing.font = '40px Georgia';
    drawing.textAlign = 'center';
    drawing.textBaseline = 'middle';
    drawing.fillStyle = color;
    drawing.fillText(text, 512, 80, 980);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const surface = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide});
    const plaque = mesh(new THREE.PlaneGeometry(width, width * 160 / 1024), surface, x, 2.4, z);
    plaque.name = `record-sign-${labels.length}`;
    labels.push({texture, surface});
    return plaque;
  }

  function vesselStores(x, z, color = '#9a7950') {
    solid(x, .6, z, 1.8, 1.2, 1.5, color);
    for (const offset of [-.6, .6]) box(x + offset, .62, z + .77, .085, 1.15, .05, '#54493b');
    box(x, 1.23, z, 1.8, .07, .1, '#5d503e');
    cylinder(x + 2, .65, z, .47, .4, 1.3, '#a68a59', 12);
    for (const height of [.2, 1.05]) cylinder(x + 2, height, z, .49, .49, .08, '#514a40', 12);
  }

  function beamBetween(start, end, radius, color) {
    const direction = new THREE.Vector3().fromArray(end).sub(new THREE.Vector3().fromArray(start));
    const midpoint = new THREE.Vector3().fromArray(start).add(new THREE.Vector3().fromArray(end)).multiplyScalar(.5);
    const beam = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 5), color, midpoint.x, midpoint.y, midpoint.z);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return beam;
  }

  function lantern(x, y, z, color = '#ffd796') {
    const light = sphere(x, y, z, .16, color);
    light.material = material(color, {emissive: color, emissiveIntensity: .8});
    cylinder(x, y - .2, z, .25, .25, .08, '#665337');
    const glow = new THREE.PointLight(color, 8, 13, 2);
    glow.position.set(x, y, z);
    group.add(glow);
    return light;
  }

  function bubblePortal(portal, color = '#bbdfdb') {
    localPortals.push(portal);
    const [centerX, , centerZ] = portal.position;
    const ring = mesh(new THREE.TorusGeometry(3.2, .12, 8, 48), material(color, {emissive: color, emissiveIntensity: .35}), centerX, 3.25, centerZ);
    ring.name = `record-local-portal-${portal.id}`;
    const bubble = sphere(centerX, 3.25, centerZ, 3.05, color, 2);
    bubble.name = `record-local-bubble-${portal.id}`;
    bubble.material = material(color, {transparent: true, opacity: .15, depthWrite: false});
    updates.push(elapsed => { ring.rotation.z = Math.sin(elapsed * .25) * .05; });
    sign(portal.label, centerX, centerZ + .5, 5.5);
  }

  function ridge(x, z, width, height, depth, color = '#6f7655') {
    const shape = sphere(x, -height * .52, z, 1, color);
    shape.scale.set(width, height, depth);
    return shape;
  }

  function woodland(amount = 42, radius = 45, color = false) {
    for (let index = 0; index < amount; index += 1) {
      const angle = index * 2.39996;
      const distance = radius + (index % 7) * 3;
      tree(Math.sin(angle) * distance, Math.cos(angle) * distance, .75 + (index % 5) * .18, color);
    }
  }

  function banner(x, z, color = '#877e53', height = 4) {
    cylinder(x, height / 2, z, .045, .065, height, '#5b4b38', 6);
    const cloth = box(x + .65, height - .65, z, 1.3, .9, .04, color, {side: THREE.DoubleSide});
    cloth.name = `record-banner-${x}-${z}`;
    updates.push((elapsed) => { cloth.rotation.y = Math.sin(elapsed * 1.4 + x) * .09; });
  }

  function tent(x, z, color = '#c1aa79', scale = 1) {
    const roof = cylinder(x, 1.65 * scale, z, 0, 1, 2.8 * scale, color, 4);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(4 * scale, 1, 3.4 * scale);
    solid(x, .5 * scale, z, 4.7 * scale, scale, 4 * scale, '#9a845f');
    box(x, 1.25 * scale, z + 2.1 * scale, 1.15 * scale, 2.2 * scale, .08, '#554d3f');
    cylinder(x, 1.5 * scale, z + 2.2 * scale, .045, .06, 3 * scale, '#64523c', 6);
  }

  function house(x, z, width = 7, depth = 6, color = '#c4aa80') {
    solid(x - width / 2, 1.65, z, .45, 3.3, depth, color);
    solid(x + width / 2, 1.65, z, .45, 3.3, depth, color);
    solid(x, 1.65, z - depth / 2, width, 3.3, .45, color);
    for (const side of [-1, 1]) solid(x + side * (width / 4 + .6), 1.65, z + depth / 2, width / 2 - 1.2, 3.3, .45, color);
    box(x, 3.2, z + depth / 2, 2.4, .2, .45, color);
    const roof = box(x, 3.4, z, width + .6, .26, depth + .6, '#7f7454');
    roof.name = `record-house-cutaway-${x}-${z}`;
    box(x, .03, z, width, .07, depth, '#b7a17d');
    box(x - width * .28, .5, z - 1, 1.8, .3, 2.5, '#9c875f');
    cylinder(x + width * .27, .65, z - 1.4, .45, .3, 1.3, '#aa7550', 10);
    cutaways.push({object: roof, x, z, width, depth});
  }

  function sea(storm = false) {
    const ocean = ground(storm ? '#314f63' : '#477a86', 800);
    ocean.position.y = -2.6;
    for (let index = 0; index < 46; index += 1) {
      const side = index % 2 ? -1 : 1;
      const wave = box(side * (14 + index % 9 * 8), -1.7, -150 + index * 6.8, 12 + index % 4 * 4, .24, 1.5, storm ? '#a5c1bd' : '#83b7b6');
      wave.rotation.y = -.17;
      wave.name = `record-wave-${index}`;
      updates.push((elapsed) => {
        wave.position.y = -1.9 + Math.sin(elapsed * .8 + index) * (storm && completed < 2 ? .65 : .14);
        wave.position.z = -150 + ((index * 6.8 + elapsed * (storm && completed < 2 ? 3 : .6)) % 300);
      });
    }
    if (scene) {
      scene.background = new THREE.Color(storm ? '#677d84' : '#b5c9c2');
      scene.fog = new THREE.Fog(storm ? '#677d84' : '#b5c9c2', 110, 320);
    }
  }

  function lighting(skyColor, sunColor, sunIntensity, ambientIntensity) {
    if (scene) {
      scene.background = new THREE.Color(skyColor);
      scene.fog = new THREE.Fog(skyColor, 65, 230);
    }
    group.children.forEach(object => {
      if (object.isDirectionalLight) {
        object.color.set(sunColor);
        object.intensity = sunIntensity;
      }
      if (object.isHemisphereLight) {
        object.color.set(sunColor);
        object.intensity = ambientIntensity;
      }
    });
  }

  if (recordId === 'BM05') {
    summary.setting = 'An authored sea-going wooden ship; bonds are not specified as tied to a mast in the text.';
    sea(true);
    lighting('#677d84', '#c6d9dc', 1.8, 1.7);
    Object.assign(bounds, {minX: -7, maxX: 7, minZ: -18, maxZ: 19});
    spawn.set(0, 0, 16);
    box(0, -.22, 0, 16, .4, 42, '#a18a5b');
    for (let index = 0; index < 35; index += 1) box(0, .001, -20 + index * 1.16, 15.5, .025, .035, '#786240');
    for (const side of [-1, 1]) {
      solid(side * 8, .75, 0, .4, 1.5, 42, '#665039');
      for (let index = 0; index < 9; index += 1) box(side * 7.6, -.95, -18 + index * 4.5, .3, 1.4, .32, '#554534');
    }
    solid(0, .65, -21, 16, 1.3, .4, '#665039');
    solid(0, .65, 21, 16, 1.3, .4, '#665039');
    const bowDeck = new THREE.BufferGeometry();
    bowDeck.setAttribute('position', new THREE.Float32BufferAttribute([-8, -.08, -21, 8, -.08, -21, 0, -.08, -31], 3));
    bowDeck.computeVertexNormals();
    mesh(bowDeck, '#967b50', 0, 0, 0, {side: THREE.DoubleSide});
    for (const side of [-1, 1]) {
      beamBetween([side * 8, .8, -21], [0, 1.9, -31], .22, '#665039');
      beamBetween([side * 8, -1.4, 18], [side * 6.5, -1.9, -23], .35, '#574735');
      beamBetween([side * 6.5, -1.9, -23], [0, -1.2, -31], .35, '#574735');
    }
    beamBetween([0, 1, -24], [0, 3.8, -37], .17, '#6b543a');
    for (const location of [-8, 7]) {
      cylinder(0, 6, location, .17, .28, 12, '#6b543a', 8);
      colliders.push({x: 0, z: location, radius: .32});
      const sail = box(0, 8, location, 12, 4.6, .06, '#d0c3a0');
      sail.name = `storm-sail-${location}`;
      updates.push(elapsed => { sail.rotation.y = Math.sin(elapsed * .7) * (completed < 2 ? .15 : .035); });
      const crossbar = box(0, 10.25, location, 13, .18, .18, '#675039');
      crossbar.rotation.y = .05;
      for (const side of [-1, 1]) {
        beamBetween([0, 11.5, location], [side * 7.5, 1, location - 5], .025, '#776b50');
        beamBetween([0, 11.5, location], [side * 7.5, 1, location + 5], .025, '#776b50');
      }
    }
    vesselStores(5.4, -12);
    vesselStores(5.4, 10);
    box(-5.3, .48, 15, 2.5, .95, 1.3, '#8b7656');
    box(-5.3, 1.1, 15, 2.5, .14, 1.3, '#d2bd87');
    for (const side of [-1, 1]) box(side * 1.4, .12, 13, .16, .25, 4, '#574937');
    for (let index = 0; index < 7; index += 1) box(0, .08, 11.4 + index * .5, 2.8, .12, .1, '#6e5a3c');
    lantern(5.4, 2, 15);
    sign('The crossing · storm, release, prayer', 0, -20.7, 8);
    const rain = assembly('storm-rain-presentation', () => {
      for (let index = 0; index < 55; index += 1) {
        const streak = box(-14 + index % 9 * 3.5, 2 + index % 7 * 1.8, -24 + index % 13 * 4, .02, .8, .02, '#b4cacb', {transparent: true, opacity: .45});
        streak.rotation.z = -.2;
      }
    });
    updates.push(elapsed => {
      rain.visible = completed < 2;
      rain.children.forEach((streak, index) => { streak.position.y = 1 + ((index * 1.7 - elapsed * 7) % 14 + 14) % 14; });
    });
    objectiveLayout([[0, 0, 16], [1, 0, 0], [3, 0, -10], [0, 0, -16]]);
    summary.playerMode = 'constrained-witness';
    summary.restrainPlayer = true;
    summary.supportViewpoint = 'During the support beat, movement represents an adapted household-support viewpoint, not Nephi escaping his bonds.';
    changes.push(index => {
      if (index < 2 || !scene) return;
      scene.background = new THREE.Color('#b6cbc5');
      scene.fog.color.set('#b6cbc5');
      lighting('#b6cbc5', '#f4e9cb', 2.7, 2.2);
    });
  } else if (recordId === 'BM07') {
    summary.setting = 'One of eight enclosed wooden vessels; two lights per vessel, wind-driven, not a powered disc.';
    sea(false);
    Object.assign(bounds, {minX: -7.2, maxX: 7.2, minZ: -19, maxZ: 19});
    spawn.set(0, 0, 16);
    box(0, -.15, 0, 16, .3, 42, '#8c7251');
    for (const side of [-1, 1]) {
      solid(side * 8, 2, 0, .5, 4, 42, '#786044');
      for (let index = 0; index < 14; index += 1) box(side * 7.65, 2.1, -19.5 + index * 3, .28, 4.3, .3, '#513f30');
    }
    for (const end of [-1, 1]) solid(0, 2, end * 21, 16, 4, .5, '#786044');
    const roof = assembly('barge-closed-roof-cutaway', () => {
      box(0, 4.3, 0, 16.4, .45, 42.4, '#69513b');
      for (let index = 0; index < 14; index += 1) box(0, 4.05, -19.5 + index * 3, 15.5, .22, .24, '#4f3e30');
    });
    cutaways.push({object: roof, x: 0, z: 0, width: 16, depth: 42, ceiling: 4.1});
    for (const end of [-1, 1]) {
      const light = lantern(0, 1.4, end * 19, '#d1f6e8');
      light.name = `barge-light-${end}`;
      box(0, .7, end * 19, 1, 1.2, 1, '#69543d');
    }
    for (const location of [-11, -2, 8]) {
      vesselStores(5.2, location);
      box(-5.6, .3, location, 2.6, .45, 4.4, '#baaa7d');
      box(-5.6, .6, location - 1.4, 2.2, .2, .8, '#d5c9a3');
    }
    const vent = cylinder(0, 4.1, 4, .52, .52, .2, '#574432', 14);
    vent.name = 'barge-air-opening';
    sign('Light within the deep · Ether 6', 0, -20.7, 7);
    objectiveLayout([[0, 0, 10], [0, 0, 3], [0, 0, -6], [0, 0, -15]]);
    updates.push(elapsed => { vent.rotation.z = completed >= 0 ? .1 * Math.sin(elapsed * .4) : 0; });
  } else if (recordId === 'BM15') {
    summary.setting = 'Two separate fortified towns: invaders decline Ammonihah and attack Noah, commanded by Lehi.';
    ground('#929367');
    Object.assign(bounds, {minX: -100, maxX: 100, minZ: -65, maxZ: 65});
    spawn.set(-43, 0, 27);
    for (const center of [-43, 43]) {
      for (const side of [-1, 1]) {
        solid(center + side * 22, 1.7, 0, 5, 3.4, 46, '#827653');
        solid(center + side * 14, 1.7, 23, 15, 3.4, 5, '#827653');
      }
      solid(center, 1.7, -23, 49, 3.4, 5, '#827653');
      for (let index = 0; index < 20; index += 1) {
        const position = -21 + index * 2.2;
        cylinder(center + position, 4.15, -23, .12, .2, 3.2, '#65553c', 5);
        for (const side of [-1, 1]) cylinder(center + side * 22, 4.15, position, .12, .2, 3.2, '#65553c', 5);
      }
      for (const side of [-1, 1]) box(center + side * 29, -.005, 0, 5, .05, 57, '#534c3c');
      box(center, -.005, -30, 62, .05, 5, '#534c3c');
      for (const side of [-1, 1]) house(center + side * 12, -10, 7, 7);
      house(center, -17, 8, 5, '#b99d72');
      tent(center - 12, 10, '#c7b990', .9);
      vesselStores(center + 12, 10);
      banner(center - 5, 23, '#6b8370', 6);
      banner(center + 5, 23, '#6b8370', 6);
      curve([[center, 35], [center, 20], [center, 0], [center, -12]], 4);
      sign(center < 0 ? 'Ammonihah · the attack is declined' : 'Noah · Lehi commands the defense', center, 25, 10);
    }
    curve([[-43, 35], [-24, 43], [0, 44], [24, 43], [43, 35]], 4);
    for (let index = 0; index < 14; index += 1) ridge(-90 + index * 14, -60, 18, 11 + index % 3 * 4, 14);
    objectiveLayout([[-43, 0, 15], [-43, 0, 0], [43, 0, 15], [43, 0, 0]]);
  } else if (recordId === 'BM16' || recordId === 'BM17') {
    const firePrison = recordId === 'BM17';
    summary.setting = firePrison ? 'Helaman 5: Nephi and Lehi, sons of Helaman; harmless fire and changed hearts.' : 'Alma 14: Alma and Amulek; deliverance follows persecution and loss.';
    ground(firePrison ? '#777d69' : '#9b8b6a');
    if (firePrison) lighting('#596964', '#c3d7ca', 1.15, 1.6);
    spawn.set(0, 0, 23);
    const stoneColor = firePrison ? '#737f78' : '#9a8564';
    const structure = assembly('record-prison-standing-walls', () => {
      for (const side of [-1, 1]) solid(side * 12, 3, 0, 1, 6, 32, stoneColor);
      solid(0, 3, -16, 25, 6, 1, stoneColor);
      for (const side of [-1, 1]) solid(side * 7.8, 3, 16, 8.4, 6, 1, stoneColor);
      box(0, 5, 16, 7.2, 2, 1, stoneColor);
      for (const side of [-1, 1]) {
        for (let index = 0; index < 5; index += 1) box(side * 11.4, 3.1, -13 + index * 6.5, .4, 6.2, .65, '#5e6558');
      }
      for (let index = 0; index < 5; index += 1) box(0, 6.1, -12 + index * 6, 24, .4, .35, '#5f5846');
    });
    const ceiling = box(0, 6.4, 0, 25, .3, 33, '#625d4d');
    ceiling.name = 'record-prison-ceiling-cutaway';
    cutaways.push({object: ceiling, x: 0, z: 0, width: 25, depth: 33, ceiling: 6});
    box(0, .015, 0, 24, .06, 32, '#9c987f');
    for (const side of [-1, 1]) box(side * 8.5, .4, -9, 4, .75, 7, '#7f745a');
    for (const side of [-1, 1]) lantern(side * 9.6, 3.1, 9, firePrison ? '#cbe9be' : '#edc47f');
    house(-28, 15, 9, 8, '#b4a282');
    house(28, 9, 9, 8, '#b4a282');
    curve([[0, 45], [0, 25], [0, 0], [0, -10]], 5, '#c0af88');
    if (firePrison) {
      const flames = assembly('helaman-harmless-fire', () => {
        for (let index = 0; index < 28; index += 1) {
          const angle = index / 28 * Math.PI * 2;
          const flame = sphere(Math.sin(angle) * 4.5, .8, -5 + Math.cos(angle) * 4.5, .55, '#f7df8e');
          flame.scale.y = 2.3;
          flame.material = material('#f7df8e', {emissive: '#f9cc61', emissiveIntensity: .6, transparent: true, opacity: .75});
        }
      });
      updates.push(elapsed => { flames.children.forEach((flame, index) => { flame.scale.y = 2.1 + Math.sin(elapsed * 2 + index) * .24; }); });
      sign('Nephi and Lehi · sons of Helaman', -8, 16.6, 7);
      summary.nonDamagingFire = true;
      changes.push(index => { if (index >= 2) lighting('#c8d8ca', '#f2e7c4', 2.6, 2.2); });
    } else {
      const debris = assembly('alma-prison-broken-masonry', () => {
        for (let index = 0; index < 24; index += 1) {
          const side = index % 2 ? -1 : 1;
          const rock = box(side * (7 + index % 4), .3, -13 + index * 1.1, .8 + index % 3 * .3, .6, .9, stoneColor);
          rock.rotation.set(index * .17, index * .65, index * .13);
        }
      });
      debris.visible = false;
      changes.push(index => {
        if (index < 2) return;
        structure.visible = false;
        ceiling.visible = false;
        debris.visible = true;
        colliders.splice(0, colliders.length, ...colliders.filter(collider => Math.abs(collider.x) > 20));
      });
      sign('Alma and Amulek · Ammonihah', -8, 16.6, 7);
    }
    objectiveLayout([[0, 0, 9], [0, 0, 0], [0, 0, -8], [0, 0, 25]]);
  } else if (recordId === 'BM18') {
    summary.setting = 'Two separately dated camps: Amalickiah first; Ammoron later, where Teancum dies.';
    ground('#525e51');
    lighting('#303d50', '#b6cce6', .8, 1.1);
    spawn.set(-30, 0, 31);
    for (const center of [-32, 32]) {
      for (const side of [-1, 1]) {
        for (let index = 0; index < 4; index += 1) tent(center + side * 13, -15 + index * 11, index % 2 ? '#897d60' : '#a18f68', .85);
        banner(center + side * 5, -23, center < 0 ? '#866b61' : '#665b77', 5);
      }
      tent(center, -26, center < 0 ? '#baa275' : '#9c8b7e', 1.7);
      vesselStores(center - 13, 25);
      vesselStores(center + 10, 25);
      lantern(center - 6, 1.6, 4, '#f0be75');
      lantern(center + 6, 1.6, -11, '#f0be75');
      sign(center < 0 ? 'First night · Amalickiah' : 'Later night · Ammoron', center, 34, 8);
    }
    curve([[-32, 35], [-5, 43], [20, 40], [32, 28]], 3, '#6c7158');
    woodland(48, 67);
    objectiveLayout([[-32, 0, 23], [-32, 0, 2], [-32, 0, -18], [32, 0, -18]]);
    summary.finalEscape = false;
  } else if (recordId === 'BM19') {
    summary.setting = 'A marching camp and relief station, emphasizing formation, protection and care.';
    ground('#a2a476');
    spawn.set(0, 0, 34);
    for (let index = 0; index < 7; index += 1) {
      for (const side of [-1, 1]) tent(side * (16 + index % 2 * 6), 30 - index * 13, '#b9ae88', .85);
      banner(-5, 28 - index * 12, '#6a8b80', 3.6);
    }
    curve([[0, 47], [0, 25], [-3, 0], [3, -25], [0, -50]], 7, '#b9ae85');
    for (let index = 0; index < 18; index += 1) ridge((index % 2 ? -1 : 1) * (40 + index % 3 * 8), -60 + index * 7, 17, 11, 13);
    vesselStores(12, 31);
    house(14, -40, 12, 10, '#c1b28e');
    sign('Relief station · the wounded are not forgotten', 14, -34, 9);
    objectiveLayout([[0, 0, 26], [0, 0, 6], [0, 0, -17], [0, 0, -35]]);
  } else if (recordId === 'BM24') {
    summary.setting = 'Cumorah, about AD 385: catastrophic loss; protect people and the entrusted record, not a victory arena.';
    ground('#777f67', 700);
    Object.assign(bounds, {minX: -130, maxX: 130, minZ: -130, maxZ: 130});
    spawn.set(0, 0, 30);
    for (let index = 0; index < 14; index += 1) ridge(-120 + index * 18, -85 - index % 3 * 10, 30, 22 + index % 4 * 8, 28, '#596958');
    ridge(-45, -8, 24, 14, 25, '#687357');
    ridge(45, -18, 25, 19, 28, '#687357');
    for (const side of [-1, 1]) {
      for (let index = 0; index < 5; index += 1) tent(side * (18 + index % 2 * 13), 25 - index * 14, '#9d967a', .8);
    }
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 24; column += 1) banner(-125 + column * 11, -105 - row * 9, row % 2 ? '#796050' : '#59695b', 3 + column % 3);
    }
    for (let index = 0; index < 15; index += 1) {
      const smoke = sphere(-100 + index * 14, 8 + index % 4 * 2, -55 - index % 3 * 11, 4, '#89918a');
      smoke.scale.set(1, 2.4, 1);
      smoke.name = `cumorah-distant-haze-${index}`;
      updates.push(elapsed => { smoke.position.x = -100 + index * 14 + Math.sin(elapsed * .08 + index) * 2; });
    }
    curve([[0, 48], [0, 20], [-6, 0], [0, -28], [18, -48]], 4, '#aaa080');
    box(9, .8, 18, 3.2, .25, 2, '#796a4d');
    book(9, 1, 18);
    sign('Cumorah · remember the people', 0, 38, 9);
    objectiveLayout([[0, 0, 20], [0, 0, 0], [0, 0, -22], [18, 0, -48]]);
    summary.victory = false;
  } else if (recordId === 'TX01') {
    summary.setting = 'An explicitly fictional composite temporal headland; not Cretaceous geography at a human date.';
    ground('#889d6b', 600);
    spawn.set(0, 0, 36);
    for (let index = 0; index < 9; index += 1) ridge(-90 + index * 22, -65 + index % 3 * 11, 24, 12 + index % 4 * 6, 28, '#6f8664');
    const seaSurface = mesh(new THREE.PlaneGeometry(500, 220), '#668e93', 0, -.04, -190);
    seaSurface.rotation.x = -Math.PI / 2;
    curve([[0, 50], [0, 25], [-5, 0], [3, -25], [0, -43]], 4, '#c6c09c');
    const colliderStart = colliders.length;
    const garden = assembly('temporal-eden-state', () => { woodland(30, 31, true); });
    const gardenColliders = colliders.slice(colliderStart);
    const desert = assembly('temporal-desert-state', () => {
      box(0, -.015, 0, 125, .025, 125, '#c4aa7e');
      for (let index = 0; index < 24; index += 1) {
        const angle = index * 2.4;
        const distance = 25 + index % 5 * 5;
        const ruin = box(Math.sin(angle) * distance, 1.2 + index % 3, Math.cos(angle) * distance, 2, 2.4 + index % 3 * 2, 2, '#817866');
        ruin.rotation.z = index % 2 ? .2 : -.3;
      }
    });
    const cityColliderStart = colliders.length;
    const city = assembly('temporal-zion-state', () => {
      for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2;
        const distance = 44;
        const centerX = Math.sin(angle) * distance;
        const centerZ = Math.cos(angle) * distance;
        solid(centerX, 5, centerZ, 11, 10, 10, '#e7e6cf');
        box(centerX, 10.3, centerZ, 13, .6, 12, '#c8d4cb');
        for (const side of [-1, 1]) cylinder(centerX + side * 4, 5, centerZ + 5.5, .45, .6, 10, '#f7f2dc', 12);
        const crown = sphere(centerX, 11, centerZ, 2.6, '#d9e9de');
        crown.scale.y = .75;
      }
    });
    const cityColliders = colliders.splice(cityColliderStart);
    desert.visible = false;
    city.visible = false;
    bubblePortal({id: 'eden', label: 'Garden · imagined Eden', position: [-22, 0, -4], state: 0}, '#b9dfb7');
    bubblePortal({id: 'desert', label: 'Desert · possible loss', position: [22, 0, -4], state: 1}, '#e1bf98');
    bubblePortal({id: 'zion', label: 'Zion · a future of care', position: [-17, 0, -34], state: 2}, '#cdece7');
    const spring = cylinder(0, .015, -31, 5, 5, .08, '#8fc4bc', 40);
    spring.name = 'temporal-shared-spring';
    sign('One headland · three imagined futures', 0, 42, 10);
    objectiveLayout([[0, 0, 24], [-14, 0, 0], [14, 0, 0], [0, 0, -23]]);
    function temporalState(state) {
      garden.visible = state === 0;
      for (const collider of gardenColliders) {
        const colliderIndex = colliders.indexOf(collider);
        if (state !== 0 && colliderIndex >= 0) colliders.splice(colliderIndex, 1);
        if (state === 0 && colliderIndex < 0) colliders.push(collider);
      }
      desert.visible = state === 1;
      city.visible = state === 2;
      for (const collider of cityColliders) {
        const colliderIndex = colliders.indexOf(collider);
        if (state !== 2 && colliderIndex >= 0) colliders.splice(colliderIndex, 1);
        if (state === 2 && colliderIndex < 0) colliders.push(collider);
      }
      summary.temporalState = ['garden', 'desert', 'zion'][state];
      summary.temporalStateIndex = state;
    }
    changes.push(index => temporalState(index < 0 ? 0 : index < 1 ? 1 : 2));
    activateLocalPortal = identity => {
      const portal = localPortals.find(item => item.id === identity);
      if (!portal || !Number.isInteger(portal.state)) return false;
      temporalState(portal.state);
      return true;
    };
    summary.temporalState = 'garden';
    summary.temporalStateIndex = 0;
    summary.localTravel = true;
  } else if (recordId === 'TX02') {
    summary.setting = 'Original future rescue craft, not an identification of the Jaredite vessels.';
    ground('#88a28b', 400);
    lighting('#b7cfc9', '#dce8df', 1.8, 1.6);
    spawn.set(0, 0, 31);
    for (const side of [-1, 1]) {
      house(side * 28, -8, 15, 18, '#e1e4d6');
      for (let index = 0; index < 4; index += 1) cylinder(side * 28 - 6 + index * 4, 6, 2, .4, .6, 12, '#eeefdb', 12);
    }
    const discHull = cylinder(0, -.85, -3, 18, 15, 1.4, '#cddbd5', 48);
    discHull.name = 'rescue-disc-hull';
    const luminousRing = mesh(new THREE.TorusGeometry(17.6, .16, 8, 72), material('#d8f5e7', {emissive: '#a8e5d4', emissiveIntensity: .65}), 0, -.12, -3);
    luminousRing.rotation.x = Math.PI / 2;
    cylinder(0, -.12, -3, 14.5, 14.5, .2, '#e6e9da', 48);
    for (let index = 0; index < 18; index += 1) {
      const angle = index / 18 * Math.PI * 2;
      const centerX = Math.sin(angle) * 13.5;
      const centerZ = -3 + Math.cos(angle) * 13.5;
      if (Math.abs(centerX) < 5 && centerZ > 5) continue;
      cylinder(centerX, 1.9, centerZ, .09, .09, 3.8, '#8fb7b0', 8);
      const panel = box(centerX, 2.15, centerZ, 3.8, 3.6, .04, '#cee5df', {transparent: true, opacity: .2, depthWrite: false});
      panel.rotation.y = angle;
    }
    const cabinRoof = cylinder(0, 4.1, -3, 10.5, 14.5, .8, '#d5e1d8', 48);
    cabinRoof.name = 'rescue-disc-cabin-cutaway';
    cutaways.push({object: cabinRoof, x: 0, z: -3, width: 29, depth: 29, ceiling: 3.8});
    for (const side of [-1, 1]) {
      for (const location of [-8, -1, 6]) {
        box(side * 9, .45, location, 2.5, .6, 2.8, '#8ca7a2');
        box(side * 10.1, 1.2, location, .3, 1.4, 2.8, '#b5c9bd');
      }
      lantern(side * 5, 2.1, -12, '#c8f0dd');
    }
    box(0, .75, -12, 5, 1.5, 1, '#b4c8be');
    sign('Rescue and welcome · consent before passage', 0, 23, 11);
    curve([[0, 40], [0, 25], [0, 11]], 7, '#c7d5c7');
    objectiveLayout([[0, 0, 23], [0, 0, 6], [0, 0, -4], [0, 0, -10]]);
    summary.futureFiction = true;
    bubblePortal({id: 'headland', label: 'Return to the temporal headland', position: [0, 0, 42], chapter: 'TX01'}, '#cdece7');
  } else if (recordId === 'TX03') {
    summary.setting = 'An invented voyage atlas: modern regional labels are player navigation aids, not ancient dialogue.';
    ground('#b5b38b', 460);
    spawn.set(0, 0, 31);
    const atlas = box(0, .05, 0, 38, .1, 46, '#537d89');
    atlas.name = 'invented-sea-atlas';
    for (let index = 0; index < 11; index += 1) {
      const longitude = -13 + index % 4 * 8;
      const latitude = -18 + Math.floor(index / 4) * 15;
      const island = cylinder(longitude, .15, latitude, 2 + index % 3, 2.8 + index % 3, .18, '#94a17d', 7);
      island.rotation.y = index * .8;
    }
    curve([[-12, 17], [-5, 10], [-9, 0], [2, -8], [12, -17]], .28, '#e8d49c', .3);
    for (const location of [[-12, 17], [-9, 0], [12, -17]]) {
      cylinder(location[0], .6, location[1], .11, .14, 1.2, '#e9d8a2', 8);
      sphere(location[0], 1.3, location[1], .32, '#f7e5ac');
    }
    sign('Speculative temporal atlas · not a scriptural route', 0, 27, 13);
    sign('Gulf-like islands', -12, 19, 6);
    sign('Southern passage', -9, 2, 6);
    sign('Levant landfall', 12, -15, 6);
    for (const side of [-1, 1]) {
      house(side * 31, -8, 11, 13, '#ddd2ad');
      for (let index = 0; index < 8; index += 1) tree(side * (28 + index % 3 * 9), 40 - index * 13, .8);
    }
    objectiveLayout([[0, 0, 23], [-12, 0, 14], [-9, 0, -3], [12, 0, -20]]);
    summary.futureFiction = true;
    bubblePortal({id: 'headland', label: 'Return to the temporal headland', position: [22, 0, 29], chapter: 'TX01'}, '#cdece7');
  }

  function onComplete(index) {
    completed = Math.max(completed, index);
    changes.forEach(change => change(completed));
  }

  function onObjective(index) {
    currentObjective = index;
    completed = index - 1;
    if (recordId === 'BM05') {
      summary.restrainPlayer = index === 0;
      summary.playerMode = index === 0 ? 'constrained-witness' : index === 1 ? 'adapted-household-support' : 'nephi-released';
    }
    changes.forEach(change => change(completed));
  }

  return {
    objectivePoints,
    actorPositions,
    summary,
    localPortals,
    activatePortal: identity => activateLocalPortal?.(identity) ?? false,
    recommendedCameraFar: 800,
    getGroundHeight: (x, z, height) => floorHeight(x, z, height),
    onComplete,
    onObjectiveComplete: onComplete,
    onObjective,
    update(delta, elapsed, playerPosition, cameraPosition) {
      updates.forEach(update => update(elapsed, delta, currentObjective));
      for (const cutaway of cutaways) {
        const observer = cameraPosition ?? playerPosition;
        if (!observer) continue;
        const above = observer.y > (cutaway.ceiling ?? 3.2);
        const within = Math.abs(observer.x - cutaway.x) < cutaway.width * .65 && Math.abs(observer.z - cutaway.z) < cutaway.depth * .65;
        cutaway.object.visible = !(above && within) && !(recordId === 'BM16' && completed >= 2);
      }
    },
    dispose() {
      labels.forEach(label => { label.texture.dispose(); label.surface.dispose(); });
    },
  };
}
