import { build } from 'esbuild';

await build({
  entryPoints: ['src/items-3d.mjs'],
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  outdir: 'assets/items-3d/web',
  entryNames: 'items',
  chunkNames: '[name]-[hash]',
  metafile: false
});
console.log('Atelier 3D compilé : /items-3d.html');
