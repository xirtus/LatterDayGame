import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {copyFile, mkdir} from 'node:fs/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(root + 'game/dist', {recursive: true});
await build({
  entryPoints: [root + 'game/src/main.js'],
  outfile: root + 'game/dist/game.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  legalComments: 'external',
  logLevel: 'info',
});
await copyFile(root + 'node_modules/three/LICENSE', root + 'game/dist/LICENSE-three.txt');
