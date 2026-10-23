import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 960}});
const errors = [];
const results = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('gathering-of-zion:v1:settings', JSON.stringify({quality: 'low', sound: false, reducedMotion: true})));
await mkdir('game/evidence', {recursive: true});

async function ready(identity) {
  await page.waitForFunction(identity => window.zionGame?.getState().ready && window.zionGame.getState().chapter === identity, identity, {timeout: 120000});
  await page.locator('#chapter-banner').evaluate(element => { element.hidden = true; });
}

async function walkTo(target) {
  for (const axis of [0, 2]) {
    const coordinate = axis === 0 ? target[0] : target[1];
    const before = await page.evaluate(() => window.zionGame.getState().player);
    const difference = coordinate - before[axis];
    if (Math.abs(difference) < .15) continue;
    const direction = Math.sign(difference);
    const key = axis === 0 ? direction > 0 ? 'KeyD' : 'KeyA' : direction > 0 ? 'KeyS' : 'KeyW';
    await page.keyboard.down('Shift');
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(({axis, coordinate, direction}) => direction * (window.zionGame.getState().player[axis] - coordinate) >= -.08, {axis, coordinate, direction}, {timeout: 18000, polling: 'raf'});
    } finally {
      await page.keyboard.up(key);
      await page.keyboard.up('Shift');
    }
  }
  return page.evaluate(() => window.zionGame.getState().player);
}

async function photograph(identity, position, target) {
  const capture = await page.evaluate(({position, target}) => {
    const game = window.zionGame;
    const camera = game.camera.clone();
    camera.position.fromArray(position);
    camera.lookAt(...target);
    game.getWorld().update(0, 0, camera.position, camera.position);
    game.renderer.render(game.scene, camera);
    return game.renderer.domElement.toDataURL('image/png').split(',')[1];
  }, {position, target});
  await writeFile(`game/evidence/record-${identity}-architecture.png`, Buffer.from(capture, 'base64'));
}

try {
  await page.goto('http://127.0.0.1:8923/game/?chapter=BM05&build=adventure-qa');
  await ready('BM05');
  const identities = ['BM05', 'BM07', 'BM15', 'BM16', 'BM17', 'BM18', 'BM19', 'BM24', 'TX01', 'TX02', 'TX03'];
  for (const identity of identities) {
    if (identity !== 'BM05') {
      await page.evaluate(identity => window.zionGame.enterChapter(identity), identity);
      await ready(identity);
    }
    await page.waitForTimeout(250);
    const status = await page.evaluate(() => {
      const game = window.zionGame;
      const world = game.getWorld();
      return {chapter: game.getState().chapter, summary: world.summary, targets: game.getChapter().objectives.map(objective => ({id: objective.id, target: objective.target})), drawCalls: game.renderer.info.render.calls};
    });
    assert.equal(status.chapter, identity);
    assert.equal(status.summary.kind, 'record-adventure');
    if (['BM05', 'BM07', 'BM16', 'BM17', 'TX02'].includes(identity)) {
      const position = identity === 'BM07' ? [0, 3.2, 15] : identity === 'TX02' ? [0, 10, 28] : [0, 8, 27];
      await photograph(identity, position, [0, 1.5, -3]);
    }
    if (identity === 'BM07') {
      await page.keyboard.press('Digit1');
      status.walk = [await walkTo([0, 0]), await walkTo([0, -15]), await walkTo([0, 16])];
      assert(Math.abs(status.walk.at(-1)[2] - 16) < .25);
    }
    if (identity === 'BM16') {
      await page.keyboard.press('Digit1');
      status.walk = [await walkTo([0, 9]), await walkTo([0, -8]), await walkTo([0, 25])];
      assert(Math.abs(status.walk.at(-1)[2] - 25) < .25);
    }
    if (identity === 'TX02') {
      await page.keyboard.press('Digit1');
      status.walk = [await walkTo([0, 6]), await walkTo([0, -10]), await walkTo([0, 31])];
      assert(Math.abs(status.walk.at(-1)[2] - 31) < .25);
    }
    if (identity === 'TX01') {
      const objectiveBefore = await page.evaluate(() => window.zionGame.getState().objectiveId);
      status.portalTravel = [];
      for (const [portalId, expectedState] of [['desert', 'desert'], ['zion', 'zion'], ['eden', 'garden']]) {
        const portal = await page.evaluate(portalId => window.zionGame.getWorld().localPortals.find(portal => portal.id === portalId), portalId);
        assert(portal, `${portalId} must be forwarded to the game world`);
        await page.evaluate(position => {
          const game = window.zionGame;
          const player = game.scene.children.find(object => object.userData.player);
          player.position.fromArray(position);
        }, portal.position);
        await page.waitForTimeout(100);
        await page.keyboard.press('KeyE');
        await page.waitForFunction(expectedState => window.zionGame.getWorld().summary.temporalState === expectedState, expectedState);
        const travel = await page.evaluate(() => ({state: window.zionGame.getWorld().summary.temporalState, colliders: window.zionGame.getWorld().colliders.length, objective: window.zionGame.getState().objectiveId}));
        assert.equal(travel.objective, objectiveBefore, 'Local E portal travel must not complete or skip objectives');
        status.portalTravel.push(travel);
      }
      assert(status.portalTravel[2].colliders > status.portalTravel[0].colliders, 'Garden tree colliders return when the garden becomes visible');
      assert(status.portalTravel[1].colliders > status.portalTravel[0].colliders, 'Zion building colliders are active only in the city state');
    }
    results.push(status);
  }
  assert.deepEqual(errors, []);
  await writeFile('game/evidence/record-adventure-results.json', JSON.stringify({passed: true, movement: 'Actual WASD on the barge, prison and future disc; no teleportation used for those routes.', results, errors}, null, 2));
  console.log(JSON.stringify({passed: true, chapters: results.length, walking: ['BM07', 'BM16', 'TX02'], errors}));
} catch (error) {
  await page.screenshot({path: 'game/evidence/record-adventure-failure.png'}).catch(() => {});
  await writeFile('game/evidence/record-adventure-results.json', JSON.stringify({passed: false, results, errors, failure: error.message}, null, 2));
  throw error;
} finally {
  await browser.close();
}
