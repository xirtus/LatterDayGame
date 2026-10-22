import {build} from '../../Celandia/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const dependencies = fileURLToPath(new URL('../../Celandia/node_modules/', import.meta.url));
await build({entryPoints:[project + 'character-study/study.js'], bundle:true, format:'esm', target:'es2022', outfile:project + 'character-study/study.bundle.js', nodePaths:[dependencies], legalComments:'external', logLevel:'warning'});
