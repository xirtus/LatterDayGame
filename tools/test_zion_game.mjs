import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => localStorage.setItem('gathering-of-zion:v1:settings', JSON.stringify({ quality: 'low', sound: false, voices: false, reducedMotion: true })));
const page = await context.newPage();
const errors = [];
const failures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
const results = [];
await mkdir('game/evidence', { recursive: true });

async function ready(chapterId) {
  await page.waitForFunction(chapterId => window.zionGame?.getState().ready && window.zionGame.getState().chapter === chapterId, chapterId, { timeout: 180000 });
}

async function frameSample() {
  return page.evaluate(() => new Promise(resolve => {
    const intervals = [];
    const started = performance.now();
    let previous = started;
    function sample(now) {
      intervals.push(now - previous);
      previous = now;
      if (now - started < 2200) { requestAnimationFrame(sample); return; }
      const sorted = intervals.slice(1).sort((first, second) => first - second);
      resolve({
        observedRafPerSecond: Number((intervals.length / ((now - started) / 1000)).toFixed(1)),
        medianRafMs: Number(sorted[Math.floor(sorted.length / 2)].toFixed(1)),
        lastRenderPass: { ...window.zionGame.renderer.info.render },
        geometries: window.zionGame.renderer.info.memory.geometries,
        textures: window.zionGame.renderer.info.memory.textures,
      });
    }
    requestAnimationFrame(sample);
  }));
}

try {
  await page.goto('http://127.0.0.1:8923/game/?chapter=E8&build=zion-overhaul-qa');
  await ready('E8');
  for (const chapterId of ['E8', '32']) {
    if (chapterId !== 'E8') {
      await page.evaluate(chapterId => window.zionGame.enterChapter(chapterId), chapterId);
      await ready(chapterId);
    }
    const summary = await page.evaluate(() => ({ layout: window.zionGame.getWorld().summary, far: window.zionGame.camera.far, bounds: window.zionGame.getWorld().bounds, state: window.zionGame.getState() }));
    assert.equal(summary.layout.hallCount, 24);
    assert.equal(summary.far >= 1000, true);
    assert.equal(summary.bounds.maxX >= 220, true);
    const before = summary.state.player;
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1000);
    await page.keyboard.up('KeyW');
    const after = await page.evaluate(() => window.zionGame.getState().player);
    assert.equal(after[2] < before[2] - 0.1, true, `${chapterId} arrival movement must be possible`);
    const cameras = {};
    for (const mode of ['third', 'first', 'free']) {
      await page.evaluate(mode => window.zionGame.setCamera(mode), mode);
      cameras[mode] = await frameSample();
      await page.screenshot({ path: `game/evidence/zion-${chapterId}-${mode}.png` });
    }
    const objectiveBefore = await page.evaluate(() => window.zionGame.getState().objective);
    await page.evaluate(() => { window.zionGame.setCamera('third'); window.zionGame.teleportToObjective(); window.zionGame.interact(); });
    for (let lineIndex = 0; lineIndex < 30; lineIndex += 1) {
      const state = await page.evaluate(() => window.zionGame.getState());
      if (state.objective > objectiveBefore) break;
      assert.equal(state.dialogue >= 0, true, `${chapterId} objective should open dialogue`);
      await page.evaluate(() => window.zionGame.advanceDialogue());
    }
    assert.equal((await page.evaluate(() => window.zionGame.getState())).objective, objectiveBefore + 1);
    results.push({ chapterId, hallCount: summary.layout.hallCount, far: summary.far, cameras, movement: { before, after }, objectiveProgressed: true });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  const report = {
    date: new Date().toISOString(),
    environment: 'Headless Playwright Chromium, performance quality, 1440x1000. RAF timing is not a target-hardware FPS certification. renderer.info describes the last render pass, not necessarily the sum of outline/shadow passes.',
    results, errors, failures,
  };
  await writeFile('game/evidence/zion-integrated-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
