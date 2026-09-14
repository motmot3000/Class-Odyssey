import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const outputDirectory = 'assets/items-3d/web';
const result = await build({
  entryPoints: ['src/items-3d.mjs'],
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  outdir: outputDirectory,
  entryNames: 'items',
  chunkNames: '[name]-[hash]',
  metafile: true
});

// Prune only known esbuild chunk names, and only after a successful build.
// Unrelated hand-authored files are never removed by this build step.
const outputs = new Set(Object.keys(result.metafile.outputs).map(filename => path.resolve(filename)));
for (const filename of fs.readdirSync(outputDirectory)) {
  if (!/^(chunk|items-3d-viewer|GLTFExporter)-[A-Z0-9]+\.js$/.test(filename)) continue;
  const absolute = path.resolve(outputDirectory, filename);
  if (!outputs.has(absolute)) fs.unlinkSync(absolute);
}
console.log('Equipment workshop built: /items-3d.html');
