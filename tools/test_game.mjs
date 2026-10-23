import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:8923/game/';
const root = new URL('../', import.meta.url);
const content = JSON.parse(await readFile(new URL('game/content/chapters.json', root), 'utf8'));
assert.equal(content.chapters.filter(chapter => /^\d{2}$/.test(chapter.id)).length, content.coreCount);
assert.equal(content.chapters.filter(chapter => chapter.id.startsWith('E')).length, 8);
assert(content.chapters.some(chapter => chapter.id === 'N1'));
assert(content.chapters.some(chapter => chapter.id === 'B1'));
for (const chapter of content.chapters) {
  assert(chapter.objectives.length >= 3, chapter.id);
  for (const objective of chapter.objectives) {
    assert.equal(objective.target.length, 3);
    assert(objective.lines.length, objective.id);
  }
}
await mkdir(new URL('game/evidence/', root), {recursive: true});
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 900}});
if (process.argv.includes('--all')) {
  await context.addInitScript(() => localStorage.setItem('gathering-of-zion:v1:settings', JSON.stringify({quality: 'low', sound: false, reducedMotion: true})));
}
const page = await context.newPage();
const errors = [];
const failures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
const results = [];

async function state() { return page.evaluate(() => window.zionGame.getState()); }
async function ready() { await page.waitForFunction(() => window.zionGame?.getState().ready, null, {timeout: 90000}); }
async function enter(id) {
  await page.evaluate(id => window.zionGame.enterChapter(id), id);
  await ready();
  assert.equal((await state()).chapter, id);
}
async function finishObjective() {
  const before = await state();
  for (let action = 0; action < 25; action++) {
    await page.evaluate(() => { window.zionGame.teleportToObjective(); window.zionGame.interact(); });
    const current = await state();
    if (current.dialogue >= 0 || current.objective !== before.objective) break;
  }
  for (let index = 0; index < 30; index++) {
    const current = await state();
    if (current.objective !== before.objective) break;
    assert(current.dialogue >= 0, `Interaction ${before.objectiveId} did not open dialogue`);
    await page.evaluate(() => window.zionGame.advanceDialogue());
  }
  assert.equal((await state()).objective, before.objective + 1, before.objectiveId);
  await ready();
}

try {
  await page.goto(base);
  await page.waitForFunction(() => window.zionGame, null, {timeout: 90000});
  await page.screenshot({path: new URL('game/evidence/menu.png', root).pathname});
  assert.equal(await page.locator('#menu').isVisible(), true);
  await page.click('#begin');
  await ready();
  assert.equal((await state()).chapter, '01');
  const child = await page.evaluate(() => window.zionGame.getState().actors.actors.find(actor => actor.id === 'JOSEPH_CHILD'));
  assert(child);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyW');
  assert((await state()).player[2] < 7.6, 'WASD movement');
  await page.keyboard.press('Digit1');
  assert.equal((await state()).camera, 'first');
  assert.equal(await page.evaluate(() => window.zionGame.scene.getObjectByName('actor:JOSEPH_CHILD').visible), false);
  await page.keyboard.press('KeyV');
  const fixedPlayer = (await state()).player;
  const freeBefore = await page.evaluate(() => window.zionGame.camera.position.toArray());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  assert.deepEqual((await state()).player, fixedPlayer, 'Free camera must not move Joseph');
  const freeAfter = await page.evaluate(() => window.zionGame.camera.position.toArray());
  assert.notDeepEqual(freeBefore, freeAfter, 'Free camera movement');
  await page.keyboard.press('Digit3');
  await finishObjective();
  assert.equal((await state()).objective, 1);
  results.push('Movement, first/third/free cameras, child model, dialogue');

  await enter('03');
  await finishObjective();
  await page.evaluate(() => window.zionGame.teleportToObjective());
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.zionGame.getState().dialogue >= 0, null, {timeout: 12000});
  await page.keyboard.up('KeyE');
  assert.equal((await state()).objective, 1, 'Prayer opens dialogue before completing');
  await page.keyboard.press('Space');
  while ((await state()).dialogue >= 0) await page.evaluate(() => window.zionGame.advanceDialogue());
  await ready();
  const sacred = await page.evaluate(() => ['FATHER','CHRIST'].map(id => window.zionGame.scene.getObjectByName(`actor:${id}`).visible));
  assert.deepEqual(sacred, [true, true], 'Distinct Father and Son after prayer');
  results.push('Held prayer, revelation timing, distinct Father and Son');

  const chapterIds = process.argv.includes('--all') ? content.chapters.map(chapter => chapter.id) : ['10','09','23','28','30','31','32','E3','E4','E6','E8'];
  for (const id of chapterIds) {
    console.log(`Testing chapter ${id}…`);
    await enter(id);
    const count = (await state()).objectiveCount;
    for (let index = 0; index < count; index++) {
      if (id === '10' && index === 2) {
        const shown = await page.evaluate(() => {
          const names = [];
          window.zionGame.scene.children.filter(object => object.name.startsWith('actor:') && object.visible && !object.userData.player).forEach(object => names.push(object.userData.actorId));
          return names;
        });
        assert.equal(shown.length, 8, 'Exactly Eight Witnesses in separate scene');
        assert(!shown.includes('MORONI') && !shown.includes('MARTIN') && !shown.includes('DAVID') && !shown.includes('OLIVER'));
        await page.screenshot({path: new URL('game/evidence/eight-witnesses.png', root).pathname});
      }
      await finishObjective();
    }
    assert((await state()).completed.includes(id));
    await page.screenshot({path: new URL(`game/evidence/chapter-${id}.png`, root).pathname});
    results.push(`Chapter ${id}: ${count} objectives complete`);
  }
  const beforeReload = await state();
  await page.reload();
  await page.waitForFunction(() => window.zionGame, null, {timeout: 90000});
  await page.click('#resume');
  await ready();
  assert.equal((await state()).chapter, beforeReload.chapter);
  assert.equal((await state()).objective, beforeReload.objective);
  results.push('Save/continue survives reload');
  await page.click('#journal-button');
  assert.equal(await page.locator('.chapter-choice').count(), content.chapters.filter(chapter => !chapter.record).length);
  await page.click('#tab-history');
  assert(await page.locator('.history-copy').textContent());
  await page.click('#tab-cast');
  assert(await page.locator('.cast-card').count() > 0);
  await page.click('[data-close=journal]');
  results.push('Chapter selection, source journal, character status');
  await enter('E8');
  await page.evaluate(() => {
    const player = window.zionGame.scene.children.find(object => object.userData.player);
    player.position.set(-12, 0, 9);
    window.zionGame.interact();
  });
  await ready();
  assert.equal((await state()).chapter, 'E1', 'Era bubble must travel to its matching landscape');
  results.push('Bubble portal crosses eras');
  await page.close();
  const mobileContext = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const mobile = await mobileContext.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base + '?chapter=10');
  await mobile.waitForFunction(() => window.zionGame, null, {timeout: 90000});
  await mobile.waitForTimeout(500);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await mobile.locator('.touch-controls').isVisible(), true);
  await mobile.screenshot({path: new URL('game/evidence/mobile.png', root).pathname});
  await mobile.close();
  await mobileContext.close();
  results.push('390px mobile layout and touch controls');
  assert.deepEqual(errors, [], 'Browser exceptions');
  assert.deepEqual(failures, [], 'HTTP failures');
  await writeFile(new URL('game/evidence/test-results.json', root), JSON.stringify({passed: results, errors, failures, date: new Date().toISOString()}, null, 2));
  console.log(`PASS ${results.length} checks\n` + results.join('\n'));
} finally {
  await browser.close();
}
