import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 960}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('gathering-of-zion:v1:settings', JSON.stringify({quality: 'low', sound: false, reducedMotion: true})));
await mkdir('game/evidence', {recursive: true});
try {
  await page.goto('http://127.0.0.1:8923/game/?chapter=30&build=carthage-architecture');
  await page.waitForFunction(() => window.zionGame?.getState().ready && window.zionGame.getState().chapter === '30', null, {timeout: 120000});
  await page.waitForTimeout(5000);
  await page.screenshot({path: 'game/evidence/carthage-overhaul-exterior.png'});
  await page.keyboard.press('Digit1');
  const route = [[0, 4.6], [-2.65, 4.6], [-2.65, -.85], [-1.25, -.85], [-1.25, 1], [1.15, 1], [1.15, 1.9]];
  async function walkTo(target) {
    for (const axis of [0, 2]) {
      const coordinate = axis === 0 ? target[0] : target[1];
      const before = await page.evaluate(() => window.zionGame.getState().player);
      const difference = coordinate - before[axis];
      if (Math.abs(difference) < .13) continue;
      const sign = Math.sign(difference);
      const code = axis === 0 ? sign > 0 ? 'KeyD' : 'KeyA' : sign > 0 ? 'KeyS' : 'KeyW';
      await page.keyboard.down(code);
      try {
        await page.waitForFunction(({axis, coordinate, sign}) => {
          const current = window.zionGame.getState().player;
          return sign * (current[axis] - coordinate) >= -.045;
        }, {axis, coordinate, sign}, {timeout: 18000, polling: 'raf'});
      } finally { await page.keyboard.up(code); }
    }
    return page.evaluate(() => window.zionGame.getState().player);
  }
  const ascent = [];
  for (const waypoint of route) ascent.push(await walkTo(waypoint));
  assert(Math.abs(ascent.at(-1)[1] - 3.35) < .01, 'Walking upstairs reaches upper floor');
  const room = await page.evaluate(() => ({player: window.zionGame.getState().player, summary: window.zionGame.getWorld().summary, roofVisible: window.zionGame.scene.getObjectByName('carthage-roof-cutaway').visible}));
  assert.equal(room.roofVisible, false);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(500);
  await page.screenshot({path: 'game/evidence/carthage-overhaul-bedroom.png'});
  await page.keyboard.press('Digit1');
  const descent = [];
  for (const waypoint of [...route].reverse().slice(1).concat([[0, 12]])) descent.push(await walkTo(waypoint));
  assert(descent.at(-1)[1] < .01, 'Walking downstairs returns to yard');
  await page.keyboard.press('KeyV');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyR');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyR');
  await page.screenshot({path: 'game/evidence/carthage-overhaul-wide.png'});
  const rendering = await page.evaluate(() => ({calls: window.zionGame.renderer.info.render.calls, triangles: window.zionGame.renderer.info.render.triangles, scope: 'Final compositor pass only, not total world render cost or a device performance benchmark'}));
  const result = {status: 'passed', movement: 'Actual WASD from courtyard to bedroom and back; no player teleportation', ascent, descent, room, rendering, errors};
  assert.deepEqual(errors, []);
  await writeFile('game/evidence/overhaul-navigation.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
