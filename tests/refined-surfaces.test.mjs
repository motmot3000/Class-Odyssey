import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';

const base=new URL('../assets/characters-base/',import.meta.url);
const root=new URL('../assets/characters-refined/',import.meta.url);

test('surface revision preserves the validated equipment anchor contract',async()=>{
  const original=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
  const revised=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  const geometry=JSON.parse(await readFile(new URL('geometry-check.json',root),'utf8'));
  assert.deepEqual(revised.pose,original.pose);
  assert.equal(revised.geometryRevision,original.revision);
  for(const gender of ['boy','girl']){
    assert.deepEqual(revised.characters[gender].anchors,original.characters[gender].anchors);
    assert.equal(geometry[gender].geometryUnchanged,true);
    for(const part of ['skin','eyes','clothes','hair'])assert.ok(geometry[gender].parts[part].vertices>0);
  }
});

test('refined models contain portable normal/roughness materials and a single active scene',async()=>{
  for(const gender of ['boy','girl'])for(const tone of ['light','medium','tan','brown','dark']){
    const bytes=await readFile(new URL(`${gender}-${tone}.glb`,root));
    assert.equal(bytes.readUInt32LE(0),0x46546c67);
    const document=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
    assert.equal(document.scenes.length,1);
    assert.ok(document.scenes[0].nodes.length>0);
    assert.ok(document.materials.filter(material=>material.normalTexture).length>=3);
    assert.ok(document.materials.some(material=>material.pbrMetallicRoughness?.metallicRoughnessTexture));
    assert.ok((await stat(new URL(`${gender}-${tone}.webp`,root))).size>1000);
  }
});
