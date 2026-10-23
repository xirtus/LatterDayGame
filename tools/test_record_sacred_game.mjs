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

async function state() {return page.evaluate(() => window.zionGame.getState());}
async function enter(identity) {
  activeChapter = identity;
  await page.evaluate(identity => window.zionGame.enterChapter(identity), identity);
  await page.waitForFunction(identity => window.zionGame?.getState().ready && window.zionGame.getState().chapter === identity, identity, {timeout: 120000});
  await page.locator('#chapter-banner').evaluate(element => {element.hidden = true;});
  await page.keyboard.press('Digit1');
}
async function walkTo(target) {
  activeWaypoint = target;
  for (const axis of [0, 2]) {
    const coordinate = target[axis === 0 ? 0 : 1];
    const before = (await state()).player;
    const difference = coordinate - before[axis];
    if (Math.abs(difference) < .13) continue;
    const sign = Math.sign(difference);
    const code = axis === 0 ? sign > 0 ? 'KeyD' : 'KeyA' : sign > 0 ? 'KeyS' : 'KeyW';
    await page.keyboard.down(code);
    try {
      await page.waitForFunction(({axis, coordinate, sign}) => sign * (window.zionGame.getState().player[axis] - coordinate) >= -.05, {axis, coordinate, sign}, {timeout: 25000, polling: 'raf'});
    } finally {await page.keyboard.up(code);}
  }
  return (await state()).player;
}

try {
  await page.goto('http://127.0.0.1:8923/game/?chapter=BM02&build=record-sacred-walk');
  await page.waitForFunction(() => window.zionGame?.getState().ready, {timeout: 120000});
  const routes = [
    {id: 'BM02', label: 'Walk the dream trail beside the iron rod to the tree', waypoints: [[0, 21], [-2, 13], [-3, 4], [-2, -8], [0, -20], [0, -27]]},
    {id: 'BM25', label: 'Walk Moroni’s forest trail and reach the shared record box', waypoints: [[0, 25], [-3, 19], [-4, 10], [-4, 0], [0, -3], [0, -7]]},
    {id: 'BM20', label: 'Walk through the approach, ascend the wall stair, and return', waypoints: [[0, 20], [-6, 14], [-12, 8], [-12, -7], [-12, 8], [0, 20]]},
  ];
  for (const route of routes) {
    await enter(route.id);
    const positions = [];
    for (const waypoint of route.waypoints) positions.push(await walkTo(waypoint));
    if (route.id === 'BM20') {
      assert(Math.abs(positions[3][1] - 4.2) < .08, 'Samuel reaches the wall platform');
      assert(positions.at(-1)[1] < .01, 'Samuel descends to the city approach');
      await walkTo([-12, 8]);
      await walkTo([-12, -7]);
    }
    await page.keyboard.press('Digit3');
    await page.waitForTimeout(250);
    await page.screenshot({path: `game/evidence/record-${route.id}-walk.png`});
    results.push({chapter: route.id, passed: route.label, positions});
  }
  assert.deepEqual(errors, []);
  await writeFile('game/evidence/record-sacred-navigation.json', JSON.stringify({status: 'passed', movement: 'Actual WASD keyboard input; no player teleportation', results, errors}, null, 2));
  console.log(JSON.stringify({status: 'passed', results, errors}, null, 2));
} catch (error) {
  const current = await state().catch(() => null);
  await page.screenshot({path: 'game/evidence/record-sacred-navigation-failure.png'}).catch(() => {});
  await writeFile('game/evidence/record-sacred-navigation.json', JSON.stringify({status: 'failed', activeChapter, activeWaypoint, current, results, errors, failure: error.message}, null, 2));
  throw error;
} finally {await browser.close();}
