import { build } from 'esbuild';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'assets/wardrobe');
const result=await build({absWorkingDir:root,entryPoints:['src/wardrobe.mjs'],bundle:true,format:'esm',splitting:true,minify:true,outdir:'assets/wardrobe',entryNames:'wardrobe',chunkNames:'part-[hash]',metafile:true,logLevel:'info'});
const outputs=new Set(Object.keys(result.metafile.outputs).map(name=>path.resolve(root,name)));
for(const name of await readdir(out)){
  const filename=path.join(out,name);
  if(/^part-[A-Z0-9]+\.js$/.test(name)&&!outputs.has(filename))await unlink(filename);
}
