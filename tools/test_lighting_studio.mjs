#!/usr/bin/env node
/**
 * Smoke-test the lighting studio against a running local server.
 *
 *   node tools/test_lighting_studio.mjs
 *   node tools/test_lighting_studio.mjs --base=http://127.0.0.1:8923
 *   node tools/test_lighting_studio.mjs --all
 *
 * The default pass visits every chapter preset once, then every non-chapter
 * look, and writes two evidence screenshots. No game files are touched.
 */
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const args = new Set(process.argv.slice(2));
const base = (process.argv.find(value => value.startsWith('--base=')) || '--base=http://127.0.0.1:8923').split('=')[1];
const all = args.has('--all');
const url = `${base.replace(/\/$/, '')}/game/lighting-studio.html`;
const output = new URL('../game/evidence/', import.meta.url).pathname;
await mkdir(output, {recursive: true});

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, deviceScaleFactor: 1});
const errors = [];
const warnings = [];
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
  if (message.type() === 'warning') warnings.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));

let failed = false;
try {
  await page.goto(url, {waitUntil: 'networkidle', timeout: 120000});
  await page.waitForFunction(() => window.__lightingStudio?.getState && document.querySelector('#loading')?.hidden, null, {timeout: 120000});
  const presets = await page.evaluate(() => window.__lightingStudio.getPresets().map(preset => ({id: preset.id, kind: preset.kind, chapterId: preset.chapterId})));
  const chapters = presets.filter(preset => preset.kind === 'chapter');
  const layers = presets.filter(preset => preset.kind !== 'chapter');
  console.log(`Studio loaded: ${presets.length} presets (${chapters.length} chapter looks, ${layers.length} layers).`);
  if (presets.length < 100) throw new Error('Preset library is unexpectedly small.');

  const ids = all ? chapters.map(preset => preset.id) : ['chapter-30', 'chapter-03', 'chapter-04', 'chapter-20', 'chapter-30-stylized'];
  for (const id of ids) {
    await page.evaluate(async presetId => { await window.__lightingStudio.applyPreset(presetId); }, id);
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden, null, {timeout: 120000});
    await page.waitForTimeout(350);
    const state = await page.evaluate(() => window.__lightingStudio.getState());
    if (!state.chapterId) throw new Error(`No chapter loaded for ${id}`);
    if (id !== 'chapter-30-stylized' && !state.shortLabel) throw new Error(`No scene label for ${id}`);
    console.log(`  chapter ${id} → ${state.chapterId} · ${state.shortLabel || state.label}`);
  }

  if (all) {
    for (const preset of layers) {
      await page.evaluate(async presetId => { await window.__lightingStudio.applyPreset(presetId); }, preset.id);
      await page.waitForTimeout(120);
      const state = await page.evaluate(() => window.__lightingStudio.getState());
      if (!state.chapterId) throw new Error(`Lost chapter while applying ${preset.id}`);
    }
    console.log(`  all ${layers.length} mood/weather/season/time/camera layers applied.`);
  }

  await page.evaluate(async () => { await window.__lightingStudio.applyPreset('chapter-30'); });
  await page.waitForTimeout(900);
  await page.screenshot({path: `${output}/lighting-studio-carthage.png`});
  await page.evaluate(async () => { await window.__lightingStudio.applyPreset('chapter-30-stylized'); });
  await page.waitForTimeout(900);
  await page.screenshot({path: `${output}/lighting-studio-carthage-stylized.png`});

  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(500);
  await page.screenshot({path: `${output}/lighting-studio-mobile.png`});

  if (errors.length) {
    failed = true;
    console.error(`Browser errors (${errors.length}):`);
    for (const error of errors.slice(0, 20)) console.error(`  ${error}`);
  } else {
    console.log('No browser errors.');
  }
  if (warnings.length) console.log(`Warnings: ${warnings.length} (usually WebGL/shader notices)`);
  console.log(`Evidence written to ${output}`);
} catch (error) {
  failed = true;
  console.error('FAILED:', error.message);
  if (errors.length) for (const message of errors.slice(0, 12)) console.error('  browser:', message);
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
