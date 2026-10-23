// Captures fixed free-camera views of chapter worlds for visual review.
// Usage: node tools/capture_world_views.mjs [outDir] [chapter...]   (server on :8923)
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const VIEWS = {
  '01': [
    {name: 'exterior', player: [0, 0, 22], from: [15, 6.5, 21], to: [0, 2.2, 0]},
    {name: 'interior', player: [0, 0, 3], from: [2.5, 1.7, 4.8], to: [-1, 1.2, -6]},
    {name: 'yard', player: [0, 0, 22], from: [-6, 2.2, 16], to: [-24, 1, -6]},
  ],
  '04': [{name: 'loft', player: [0, 2.95, 3], from: [3, 4.6, 5], to: [-2, 3.4, -5]}],
  '12': [
    {name: 'street', player: [0, 0, 8], from: [4, 3.2, 26], to: [-8, 2, -20]},
    {name: 'interior', player: [21, 0, -11], from: [23, 1.7, -7], to: [19, 1.1, -18]},
  ],
  '24': [
    {name: 'street', player: [0, 0, 8], from: [-5, 4, 20], to: [15, 2, -30]},
    {name: 'temple', player: [0, 0, 8], from: [-38, 7, -24], to: [-55, 8, -52]},
  ],
  '20': [{name: 'temple', player: [0, 0, 8], from: [-38, 7, -24], to: [-55, 8, -52]}],
  '10': [{name: 'farm', player: [0, 0, 8], from: [-4, 4, 4], to: [-15, 2, -10]}],
  '30': [{name: 'exterior', player: [0, 0, 18], from: [12, 6, 26], to: [0, 3, 0]}],
  'BM13': [{name: 'household', player: [0, 0, 24], from: [9, 5, 9], to: [0, 2, -10]}],
  'N1': [{name: 'street', player: [-20, 0, -.5], from: [3, 4, 10], to: [-20, 4, -40]}],
};

const out = process.argv[2] ?? 'game/evidence/visual-overhaul';
// Set CHROMIUM_PATH to use a local Chromium and PORT to target another server.
const chapters = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(VIEWS);
await mkdir(out, {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport: {width: 1280, height: 760}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('gathering-of-zion:v1:settings', JSON.stringify({quality: 'high', sound: false, reducedMotion: true})));
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 8923}/game/?chapter=${chapters[0]}`);
for (const id of chapters) {
  await page.waitForFunction(() => window.zionGame?.getState, null, {timeout: 120000});
  await page.evaluate(id => window.zionGame.getState().chapter === id || window.zionGame.enterChapter(id), id);
  await page.waitForFunction(id => window.zionGame.getState().ready && window.zionGame.getState().chapter === id, id, {timeout: 180000});
  await page.evaluate(() => { for (const id of ['chapter-banner', 'hud', 'toast']) { const element = document.getElementById(id); if (element) element.style.visibility = 'hidden'; } });
  for (const view of VIEWS[id] ?? []) {
    await page.evaluate(({player, from, to}) => {
      const [dx, dy, dz] = to.map((value, axis) => value - from[axis]);
      const length = Math.hypot(dx, dy, dz);
      window.zionGame.placePlayer(player);
      window.zionGame.setFreeView(from, Math.atan2(-dx, -dz), Math.asin(-dy / length));
    }, view);
    await page.waitForTimeout(1200);
    await page.screenshot({path: `${out}/${id}-${view.name}.png`});
    console.log(`${id}-${view.name}`);
  }
}
console.log(JSON.stringify({errors}));
await browser.close();
