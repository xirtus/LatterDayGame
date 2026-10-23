import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 960}});
const errors = [];
const results = [];
let activeChapter;
let activeWaypoint;
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('gathering-of-zion:v1:settings', JSON.stringify({quality: 'low', sound: false, reducedMotion: true})));
await mkdir('game/evidence', {recursive: true});

async function state() { return page.evaluate(() => window.zionGame.getState()); }
async function ready(id) {
  await page.waitForFunction(id => window.zionGame?.getState().ready && window.zionGame.getState().chapter === id, id, {timeout: 120000});
  await page.locator('#chapter-banner').evaluate(element => { element.hidden = true; });
}
async function walkTo(target) {
  activeWaypoint = target;
  for (const axis of [0, 2]) {
    const coordinate = axis === 0 ? target[0] : target[1];
    const before = (await state()).player;
    const difference = coordinate - before[axis];
    if (Math.abs(difference) < .12) continue;
    const sign = Math.sign(difference);
    const code = axis === 0 ? sign > 0 ? 'KeyD' : 'KeyA' : sign > 0 ? 'KeyS' : 'KeyW';
    await page.keyboard.down(code);
    try {
      await page.waitForFunction(({axis, coordinate, sign}) => sign * (window.zionGame.getState().player[axis] - coordinate) >= -.045, {axis, coordinate, sign}, {timeout: 30000, polling: 'raf'});
    } finally { await page.keyboard.up(code); }
  }
  return (await state()).player;
}

try {
  await page.goto('http://127.0.0.1:8923/game/?chapter=01&build=connected-settlement');
  await ready('01');
  for (const id of ['01', '08']) {
    activeChapter = id;
    if (id !== '01') { await page.evaluate(id => window.zionGame.enterChapter(id), id); await ready(id); }
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(500);
    await page.screenshot({path: `game/evidence/settlement-${id}-interior.png`});
    const positions = [];
    for (const waypoint of [[0, 12], [12, 12]]) positions.push(await walkTo(waypoint));
    await page.keyboard.press('Digit3');
    await page.waitForTimeout(350);
    await page.screenshot({path: `game/evidence/settlement-${id}-exterior.png`});
    await page.keyboard.press('Digit1');
    for (const waypoint of [[0, 12], [0, 3]]) positions.push(await walkTo(waypoint));
    assert(positions.every(position => Math.abs(position[1]) < .01), `Chapter ${id} should remain on ground floor`);
    assert(Math.abs(positions.at(-1)[0]) < .2 && Math.abs(positions.at(-1)[2] - 3) < .2);
    results.push({chapter: id, passed: 'Actual WASD through house door, around yard, and back inside', positions});
  }
  activeChapter = '04';
  await page.evaluate(() => window.zionGame.enterChapter('04'));
  await ready('04');
  await page.keyboard.press('Digit1');
  const upperStart = (await state()).player;
  assert(Math.abs(upperStart[1] - 2.95) < .01);
  await page.screenshot({path: 'game/evidence/settlement-04-loft.png'});
  const outwardRoute = [[0, -4.9], [-5.3, -4.9], [-5.3, 4.2], [0, 4.2], [0, 12]];
  const outward = [];
  for (const waypoint of outwardRoute) outward.push(await walkTo(waypoint));
  assert(outward.at(-1)[1] < .01, 'Loft stairs descend to ground-floor doorway and yard');
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(350);
  await page.screenshot({path: 'game/evidence/settlement-04-exterior.png'});
  await page.keyboard.press('Digit1');
  const inward = [];
  for (const waypoint of [...outwardRoute].reverse().slice(1).concat([[0, 3]])) inward.push(await walkTo(waypoint));
  assert(Math.abs(inward.at(-1)[1] - 2.95) < .01, 'Returning through door and stair reaches sleeping loft');
  results.push({chapter: '04', passed: 'Actual WASD from loft down stairs and outside, then back upstairs', upperStart, outward, inward});
  assert.deepEqual(errors, []);
  await writeFile('game/evidence/settlement-navigation.json', JSON.stringify({status: 'passed', movement: 'Keyboard input only; no player teleportation', results, errors}, null, 2));
  console.log(JSON.stringify({status: 'passed', results, errors}, null, 2));
} catch (error) {
  const current = await state().catch(() => null);
  await page.screenshot({path: 'game/evidence/settlement-navigation-failure.png'}).catch(() => {});
  await writeFile('game/evidence/settlement-navigation.json', JSON.stringify({status: 'failed', activeChapter, activeWaypoint, current, results, errors, failure: error.message}, null, 2));
  throw error;
} finally { await browser.close(); }
