import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base = (process.env.GAME_URL || 'http://127.0.0.1:8923/game/').replace(/\/?$/, '/');
const evidence = new URL('../game/evidence/lighting-benchmarks/', import.meta.url);
await mkdir(evidence, {recursive: true});
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1280, height: 800}});
await context.addInitScript(() => localStorage.setItem('gathering-of-zion:v1:settings', JSON.stringify({quality: 'low', sound: false, reducedMotion: true, reducedFlash: true})));
const game = await context.newPage();
const studio = await context.newPage();
const errors = [];
for (const page of [game, studio]) page.on('pageerror', error => errors.push(error.message));
const results = [];
const fields = ['sky', 'sun', 'ambient', 'fog', 'fill', 'rim', 'practical', 'grade', 'fx', 'palette', 'groundWash'];
function normalize(value) {
  const copy = structuredClone(value);
  copy.practical.bounce ??= 0.28;
  copy.palette.strength ??= 0.62;
  return Object.fromEntries(fields.map(field => [field, copy[field]]));
}
try {
  await game.goto(base);
  await game.waitForFunction(() => window.zionGame);
  await game.locator('#begin').click();
  await game.waitForFunction(() => window.zionGame.getState().ready);
  await studio.goto(base + 'lighting-studio.html');
  await studio.waitForFunction(() => window.__lightingStudio && document.querySelector('#loading').hidden);
  for (const chapterId of ['08', '30', 'BM03', 'BM21', 'BM24', 'E8']) {
    await game.evaluate(id => window.zionGame.enterChapter(id), chapterId);
    await game.waitForFunction(() => window.zionGame.getState().ready);
    await studio.evaluate(id => window.__lightingStudio.applyPreset('chapter-' + id), chapterId);
    await studio.waitForFunction(() => document.querySelector('#loading').hidden);
    const gameplay = await game.evaluate(() => window.zionGame.getLighting());
    const authored = await studio.evaluate(() => window.__lightingStudio.getRuntimeState());
    assert.equal(gameplay.chapterId, chapterId);
    assert.equal(authored.chapterId, chapterId);
    assert.deepEqual(normalize(gameplay), normalize(authored), chapterId + ' shared runtime/studio entry look');
    assert(gameplay.disabledDefaultLights >= 2, chapterId + ' disables old sun/hemisphere');
    assert.equal(gameplay.reducedMotion, true);
    assert.equal(gameplay.reducedFlash, true);
    await game.screenshot({path: new URL(chapterId + '-gameplay.png', evidence).pathname});
    await studio.screenshot({path: new URL(chapterId + '-studio.png', evidence).pathname});
    results.push({chapterId, presetId: gameplay.presetId, objectiveId: gameplay.objectiveId, sharedEntryLookEqual: true, gameplayQuality: gameplay.quality, registeredPracticalLights: gameplay.registeredPracticalLights, disabledDefaultLights: gameplay.disabledDefaultLights});
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('parity.json', evidence), JSON.stringify({note: 'Shared authored entry-state parity; screenshots show each application\'s own camera and cast, not pixel-matched shots or a device FPS benchmark.', results}, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
