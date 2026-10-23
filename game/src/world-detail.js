export function buildWorldDetail(context, architecture) {
  const {chapter, quality, box, cylinder, sphere, book} = context;
  const anchors = [];
  let objects = 0;
  const timber = '#72543e';
  const linen = '#dac9a5';
  const clay = '#a97854';
  function block(...args) { objects += 1; return box(...args); }
  function round(...args) { objects += 1; return cylinder(...args); }
  function vessel(x, y, z, scale = 1) {
    round(x, y + .19 * scale, z, .16 * scale, .21 * scale, .38 * scale, clay, 9);
    round(x, y + .4 * scale, z, .105 * scale, .11 * scale, .07 * scale, '#634d3e', 9);
  }
  function basket(x, y, z, scale = 1) {
    round(x, y + .18 * scale, z, .29 * scale, .22 * scale, .36 * scale, '#b99662', 10);
    for (let ring = 0; ring < 3; ring++) round(x, y + (.06 + ring * .12) * scale, z, (.24 + ring * .02) * scale, (.24 + ring * .02) * scale, .025 * scale, '#715538', 10);
  }
  function writing(x, y, z) {
    block(x, y, z, .6, .012, .43, '#eadbb9');
    for (let line = 0; line < 5; line++) block(x - .04, y + .009, z - .14 + line * .065, .39 - line % 2 * .07, .005, .009, '#706452');
    round(x + .44, y + .07, z - .1, .055, .065, .14, '#343f3d', 8);
    const quill = round(x + .44, y + .24, z - .1, .009, .014, .32, '#e6d9b8', 5);
    quill.rotation.z = -.28;
  }
  function household(building) {
    const {x, z, width, depth, use} = building;
    if (use === 'home') {
      writing(x + 3, 1.16, z - 1.8);
      block(x + 3, .07, z - 1.8, 3.6, .025, 4.5, '#877160');
      vessel(x + 3.5, 1.16, z - 1.7, .65);
      basket(x - width / 2 + 1, .12, z - depth / 2 + 1.1);
      for (let log = 0; log < 4; log++) {
        const firewood = round(x + 1.75 + log * .15, .09 + (log % 2) * .1, z - depth / 2 + 1.25, .07, .09, .65, timber, 6);
        firewood.rotation.x = Math.PI / 2;
      }
    } else if (use === 'press') {
      writing(x + 2.8, .95, z - 2.2);
      for (let stack = 0; stack < 3; stack++) block(x + 2.3 + stack * .5, .98 + stack * .02, z + 2.5, .44, .08, .58, linen);
    } else {
      basket(x - width / 2 + 1, .12, z - depth / 2 + 1);
      vessel(x + width / 2 - 1, .12, z - depth / 2 + 1);
    }
    for (let side = -1; side <= 1; side += 2) {
      const outsideX = x + side * (width / 2 + 1.5);
      block(outsideX, .22, z - depth / 2 + 1.8, .9, .38, 2.1, timber);
      for (let plant = 0; plant < 4; plant++) {
        objects += 1;
        sphere(outsideX, .54, z - depth / 2 + 1.1 + plant * .43, .25, '#687c50');
      }
    }
    anchors.push({id: `work:${anchors.length}`, kind: 'work', position: [x + width / 2 + 3, 0, z + 1], rotation: -Math.PI / 2});
  }
  const domestic = ['bedroom', 'harmony', 'farm', 'town', 'nauvoo', 'kirtland', 'lowell', 'manhattan'].includes(chapter.environment);
  if (domestic && architecture?.buildings) {
    for (const building of architecture.buildings.slice(0, quality === 'low' ? 4 : 10)) household(building);
  }
  if (chapter.id === '30') {
    writing(2.25, .82, 2.8);
    vessel(2.65, .82, 2.65, .7);
    block(2.25, .09, 2.8, 2.5, .025, 2.7, '#8e7a63');
    for (let row = 0; row < (quality === 'low' ? 8 : 18); row++) {
      block(-5.2, .018, 9 + row * 1.2, 1.2, .025, .45, row % 2 ? '#a6a28f' : '#b9ad91');
      block(5.2, .018, 9 + row * 1.2, 1.2, .025, .45, '#b9ad91');
    }
    basket(6.8, 0, -3);
    block(6.8, .08, -4, 1.9, .13, 1.2, '#93836b');
  }
  if (chapter.id === 'BM03') {
    for (let row = 0; row < 3; row++) {
      vessel(21.2 + row * .8, .12, -24, 1.3);
      basket(30.4, .12, -24 + row * .9, 1.2);
      block(25.5 + row * .65, .95, -22, .46, .035, .6, '#bfa35c');
    }
    block(26, .07, -22, 5.6, .025, 3.8, '#88765c');
    for (const side of [-1, 1]) {
      vessel(side * 8.5, .1, 18, 1.4);
      basket(side * 9, .1, 16);
    }
  }
  if (['BM21', 'BM22'].includes(chapter.id)) {
    for (const side of [-1, 1]) {
      for (let index = 0; index < (quality === 'low' ? 3 : 7); index++) {
        block(side * 20.2, .055, 20 - index * 6, .45, .025, 3, '#bfa76b');
        vessel(side * 19, .15, 20 - index * 6, 1.1);
      }
      block(side * 15.5, .1, 19, 2.8, .035, 2, '#b3a180');
      basket(side * 17.5, .13, 20, 1.2);
      anchors.push({id: `court-care:${side}`, kind: 'listen', position: [side * 15.5, 0, 21], rotation: Math.PI});
    }
  }
  if (chapter.id === 'BM24') {
    for (const side of [-1, 1]) {
      for (let index = 0; index < 4; index++) {
        const pole = round(side * (10 + index * 3), .62, 18 + index * 4, .035, .045, 1.7, timber, 6);
        pole.rotation.z = side * .5;
        block(side * (10 + index * 3) - .25, 1.12, 18 + index * 4, .65, .4, .04, '#7a675c');
        block(side * (9 + index * 3), .15, 19 + index * 4, .7, .24, .45, linen);
      }
    }
  }
  if (chapter.environment === 'celestial') {
    for (const side of [-1, 1]) {
      for (let index = 0; index < (quality === 'low' ? 5 : 12); index++) {
        const z = 36 - index * 15;
        round(side * 19, .3, z, .65, .8, .6, '#e8ddbb', 12);
        round(side * 19, 2.1, z, .06, .1, 3.1, '#b9aa76', 8);
        objects += 1;
        sphere(side * 19, 3.7, z, .26, '#f5e9bf');
        block(side * 25, .06, z, 2, .035, 2, '#c2ad73');
      }
      block(side * 25, .93, 38, 3, .14, 1.4, '#dfd7bd');
      for (const offset of [-1, 1]) block(side * 25 + offset, .48, 38, .16, .9, .9, '#d6c8a5');
      book(side * 25, 1.03, 38);
      vessel(side * 25 + 1, 1.03, 38, .9);
      anchors.push({id: `zion-work:${side}`, kind: 'read', position: [side * 25, .1, 39.5], rotation: Math.PI});
    }
  }
  return {objects, activityAnchors: anchors, source: 'Authored environmental set dressing; not a surveyed reconstruction'};
}
