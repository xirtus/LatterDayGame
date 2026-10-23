import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const chapters = JSON.parse(await readFile('game/content/chapters.json', 'utf8')).chapters;
const records = chapters.filter(chapter => chapter.record);
assert.equal(records.length, 28);
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 960}});
await context.addInitScript(() => localStorage.setItem('gathering-of-zion:v1:settings', JSON.stringify({quality: 'low', sound: false, reducedMotion: true})));
const page = await context.newPage();
const errors = [];
const failures = [];
const results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
const state = () => page.evaluate(() => window.zionGame.getState());
const ready = () => page.waitForFunction(() => window.zionGame?.getState().ready, null, {timeout: 120000});
const enter = async id => { await page.evaluate(id => window.zionGame.enterChapter(id), id); await ready(); };
await mkdir('game/evidence', {recursive: true});
try {
  await page.goto('http://127.0.0.1:8923/game/');
  await ready();
  await page.waitForFunction(() => window.zionGame);
  await enter('08');
  await page.keyboard.press('Digit1');
  const origin = await state();
  await page.click('#record-button');
  assert.equal(await page.locator('[data-record]').count(), 28);
  await page.fill('#record-search', 'sixteen');
  assert.equal(await page.locator('.record-card:visible').count(), 1);
  await page.click('[data-record=BM06]');
  await ready();
  assert.equal((await state()).recordBookmark.chapter, '08');
  assert.equal(await page.locator('#record-return').isVisible(), true);
  await page.click('#record-return');
  await ready();
  const returned = await state();
  assert.equal(returned.chapter, '08');
  assert.equal(returned.objectiveId, origin.objectiveId);
  assert.deepEqual(returned.player, origin.player);
  assert.equal(returned.camera, 'first');
  results.push('Library search, 28 entries, anchored entry, exact objective/position/camera return');
  await enter('BM06');
  await page.evaluate(() => { window.zionGame.teleportToObjective(); window.zionGame.interact(); });
  while ((await state()).dialogue >= 0) await page.evaluate(() => window.zionGame.advanceDialogue());
  await ready();
  for (let count = 0; count < 5; count++) await page.evaluate(() => { window.zionGame.teleportToObjective(); window.zionGame.interact(); });
  assert.equal((await state()).recordProgress['BM06-2'], 5);
  await page.reload();
  await page.waitForFunction(() => window.zionGame);
  await page.click('#resume');
  await ready();
  assert.equal((await state()).chapter, 'BM06');
  assert.equal((await state()).recordProgress['BM06-2'], 5);
  assert.equal((await state()).recordBookmark.chapter, '08');
  results.push('Partial sixteen-stone progress and origin bookmark survive reload');
  for (const record of records) {
    console.log(`Record ${record.id}…`);
    await enter(record.id);
    const summary = await page.evaluate(() => window.zionGame.getWorld().summary);
    assert(summary.recordId === record.id, `Distinct world for ${record.id}`);
    for (let objective = 0; objective < record.objectives.length; objective++) {
      let current = await state();
      if (record.playerStages) assert.equal(current.playerId, record.playerStages[objective], `${record.id}: staged viewpoint ${objective}`);
      if (record.id === 'BM05' && objective === 0) {
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(200);
        await page.keyboard.up('KeyW');
        assert.deepEqual((await state()).player, current.player, 'Bound Nephi cannot walk before the adapted support viewpoint');
      }
      if (record.id === 'BM06' && objective === 2) assert.equal(await page.evaluate(() => window.zionGame.scene.children.find(actor => actor.userData.actorId === 'CHRIST').visible), false, 'The premortal encounter waits for prayer');
      if (current.objective > objective) continue;
      for (let action = 0; action < 25 && current.objective === objective; action++) {
        await page.evaluate(() => { window.zionGame.teleportToObjective(); window.zionGame.interact(); });
        current = await state();
        while (current.dialogue >= 0) {
          await page.evaluate(() => window.zionGame.advanceDialogue());
          current = await state();
        }
        await ready();
      }
      assert.equal((await state()).objective, objective + 1, record.id + ' objective ' + objective);
    }
    assert((await state()).completed.includes(record.id));
    results.push(`${record.id}: four objectives, activities, completion, source world`);
  }
  await enter('E8');
  await page.evaluate(() => {
    const chapter = window.zionGame.getChapter();
    const save = JSON.parse(localStorage.getItem('gathering-of-zion:v1'));
    save.objective = chapter.objectives.length;
    save.objectiveId = null;
    localStorage.setItem('gathering-of-zion:v1', JSON.stringify(save));
  });
  await page.reload();
  await page.waitForFunction(() => window.zionGame);
  await page.click('#resume');
  await ready();
  await page.click('#next-chapter');
  await ready();
  assert.equal((await state()).chapter, '03', 'Optional records do not hijack the campaign ending');
  results.push('Campaign ending remains separate from optional records');
  await page.click('#journal-button');
  await page.click('#tab-records');
  await page.screenshot({path: 'game/evidence/record-library-desktop.png'});
  await page.setViewportSize({width: 390, height: 844});
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, {timeout: 10000});
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path: 'game/evidence/record-library-mobile.png'});
  await page.click('[data-close=journal]');
  await enter('BM21');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  results.push('Record library and record HUD fit 390px');
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  await writeFile('game/evidence/record-game-tests.json', JSON.stringify({passed: results, errors, failures, method: 'Objective flow is teleport-assisted; dedicated world navigation tests cover walking separately.', date: new Date().toISOString()}, null, 2));
  console.log(`PASS ${results.length} record integration checks`);
} finally { await browser.close(); }
