import assert from 'node:assert/strict';
import {readFile, access, mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const root = new URL('../', import.meta.url);
const reportURL = new URL('docs/polish-overhaul-report.html', root);
const report = await readFile(reportURL, 'utf8');
assert(!/<!--(?:VOICE|SCENE|BACKLOG|FIRST|RIG|PROFILE|SPEAKER|LINE|CHAPTER|PRESET)_/.test(report), 'All report placeholders filled');
for (const match of report.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const value = match[1];
  if (value.startsWith('#') || /^https?:/.test(value)) continue;
  await access(new URL(value.split('#')[0], reportURL));
}
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir(new URL('docs/evidence/', root), {recursive: true});
try {
  await page.goto('http://127.0.0.1:8923/docs/polish-overhaul-report.html');
  assert.equal(await page.locator('#voice-table tbody tr').count(), 96);
  assert.equal(await page.locator('#scene-table tbody tr').count(), 70);
  await page.screenshot({path: new URL('docs/evidence/polish-report-desktop.png', root).pathname});
  await page.locator('#voices h2').scrollIntoViewIfNeeded();
  await page.screenshot({path: new URL('docs/evidence/polish-report-voices.png', root).pathname});
  await page.fill('#voice-filter', 'moroni');
  assert.equal(await page.locator('#voice-table tbody tr:visible').count(), 3);
  await page.fill('#voice-filter', 'walker');
  assert.equal(await page.locator('#voice-table tbody tr:visible').count(), 1);
  await page.locator('#voice-table details summary').filter({visible: true}).first().click();
  assert(await page.locator('#voice-table details[open] code').filter({visible: true}).textContent());
  await page.fill('#scene-filter', 'BM24');
  assert.equal(await page.locator('#scene-table tbody tr:visible').count(), 1);
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('#audit').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path: new URL('docs/evidence/polish-report-mobile.png', root).pathname});
  await page.locator('#voices h2').scrollIntoViewIfNeeded();
  await page.screenshot({path: new URL('docs/evidence/polish-report-voices-mobile.png', root).pathname});
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const brokenImages = await page.locator('img').evaluateAll(images => images.filter(image => image.complete && !image.naturalWidth).map(image => image.src));
  assert.deepEqual(brokenImages, []);
  assert.deepEqual(errors, []);
  await writeFile(new URL('docs/evidence/polish-report-tests.json', root), JSON.stringify({status: 'passed', checks: ['96 speaking IDs', '70 chapter assignments', 'local links', 'voice/scene search', 'audition expansion', 'desktop/mobile screenshots', 'no horizontal page overflow', 'no broken images or browser exceptions'], date: new Date().toISOString()}, null, 2));
  console.log('PASS polish report: full voice/chapter coverage, local links, filters, auditions, desktop/mobile and browser errors.');
} finally { await browser.close(); }
