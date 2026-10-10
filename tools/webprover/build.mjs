import {build} from 'esbuild';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const result = await build({entryPoints: [fileURLToPath(new URL('src/prover.js', import.meta.url))], bundle: true, format: 'iife', platform: 'browser', minify: true, write: false, target: ['chrome100'], legalComments: 'inline'});
const bundle = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const output = new URL('../../mobile/assets/prover/', import.meta.url);
await mkdir(output, {recursive:true});
// Only public proving artifacts may leave the WebView. The bundle itself is fully inline.
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; connect-src https://snark-artifacts.pse.dev; worker-src blob:; child-src blob:"><title>INCOGNITO local prover</title></head><body><script>${bundle}</script></body></html>`;
await writeFile(new URL('prover.html', output), html);
console.log('Built inline prover.html (no identity or proof data).');
