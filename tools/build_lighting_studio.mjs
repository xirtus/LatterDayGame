#!/usr/bin/env node
/**
 * Build the standalone lighting studio bundle.
 *
 * Regenerate the shared authored presets and cues, then bundle the same world
 * and lighting service used by gameplay. Missing world modules fail the build.
 */
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync('python3', [root + 'tools/build_lighting_data.py'], {cwd: root, stdio: 'inherit'});

await build({
  entryPoints: [root + 'game/src/lighting-studio.js'],
  outfile: root + 'game/dist/lighting-studio.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  legalComments: 'external',
  logLevel: 'info',
});
