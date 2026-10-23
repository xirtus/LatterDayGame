import assert from 'node:assert/strict';
import {access, readFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = new URL('../', import.meta.url);
const plan = JSON.parse(await readFile(new URL('docs/book-of-mormon-expansion.json', root), 'utf8'));
assert.equal(plan.scenes.length, 28);
assert.equal(plan.scenes.filter(scene => scene.id.startsWith('BM')).length, 25);
assert.equal(plan.scenes.filter(scene => scene.id.startsWith('TX')).length, 3);
assert.equal(new Set(plan.scenes.map(scene => scene.id)).size, 28);
assert.equal(new Set(plan.cast.map(person => person.id)).size, plan.cast.length);
assert.equal(plan.boards.flatMap(board => board.panels).length, 18);
for (const board of plan.boards) await access(new URL(board.file, root));
for (const scene of plan.scenes) {
  assert(scene.beats.length >= 4);
  assert(scene.guardrail && scene.payoff && scene.space && scene.gameplay);
  assert(scene.sources.every(identity => plan.sources[identity]));
  if (scene.panel) assert(plan.boards.some(board => board.panels.includes(scene.panel)));
}
assert(plan.scenes.find(scene => scene.id === 'BM17').guardrail.includes('Not Nephi and Lehi from 1 Nephi'));
assert(plan.scenes.find(scene => scene.id === 'BM18').guardrail.includes('both missions'));
assert(plan.scenes.find(scene => scene.id === 'BM24').guardrail.includes('cannot become a Nephite victory'));
assert(plan.scenes.find(scene => scene.id === 'BM25').guardrail.includes('continuous 36-year itinerary'));

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
const errors = [];
const failures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && response.url().startsWith('http://127.0.0.1:8923/')) failures.push(response.url()); });
await mkdir(new URL('docs/evidence/', root), {recursive: true});
try {
  await page.goto('http://127.0.0.1:8923/docs/book-of-mormon-scenes-report.html');
  assert.equal(await page.locator('.scene').count(), 28);
  for (const href of await page.locator('a[href]').evaluateAll(anchors => anchors.map(anchor => anchor.getAttribute('href')))) {
    if (href.startsWith('#')) assert(await page.locator(href).count(), href);
    else if (!/^[a-z]+:/i.test(href)) await access(new URL(href, new URL('docs/book-of-mormon-scenes-report.html', root)));
  }
  for (const image of await page.locator('img').all()) { await image.scrollIntoViewIfNeeded(); await image.evaluate(element => element.decode()); }
  await page.locator('h1').scrollIntoViewIfNeeded();
  await page.screenshot({path: fileURLToPath(new URL('docs/evidence/book-of-mormon-report-desktop.png', root))});
  await page.locator('#scene-search').fill('Moroni');
  const filtered = await page.locator('.scene:not([hidden])').count();
  assert(filtered > 2 && filtered < 28);
  await page.locator('#scene-search').fill('');
  await page.locator('#layer-filter').selectOption('speculative');
  assert.equal(await page.locator('.scene:not([hidden])').count(), 3);
  await page.locator('#layer-filter').selectOption('all');
  await page.locator('#expand-scenes').click();
  assert.equal(await page.locator('.scene details[open]').count(), 28);
  await page.locator('#expand-scenes').click();
  assert.equal(await page.locator('.scene details[open]').count(), 0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: 1000});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
  }
  await page.locator('h1').scrollIntoViewIfNeeded();
  await page.screenshot({path: fileURLToPath(new URL('docs/evidence/book-of-mormon-report-mobile.png', root))});
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log('PASS 28 planned scenes, 18 saved concept panels, local links/images, scene search, layer filter, expand/collapse and desktop/mobile rendering.');
} finally { await browser.close(); }
