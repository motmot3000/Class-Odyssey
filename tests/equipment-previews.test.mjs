import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createInitialState, getCurrentClass, SHOP_ITEMS } from '../src/domain.mjs';
import { CATALOGUE_REVISION, BASE_CATALOGUE_REVISION, BASE_CATALOGUE_URL, PORTRAIT_REVISION, modeledItemIds, visiblePart, DEFAULT_LOOK, resolveAssetBase } from '../src/items-3d-model.mjs';
import { renderItemThumbnail, renderHeroPortrait } from '../src/equipment-previews.mjs';
import { renderSheikahStudent, renderSheikahShop } from '../src/views/sheikah.mjs';

const root = new URL('../assets/items-3d/', import.meta.url);
function catalogue() {
  const data=readFileSync(new URL('catalogue.glb',root));
  return JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
}

test('the live base characters are the delivered stylized catalogue', () => {
  assert.equal(BASE_CATALOGUE_REVISION, 'stylized-v4');
  assert.match(BASE_CATALOGUE_URL, /assets\/character-stylized\/catalogue\.glb\?v=stylized-v4$/);
  assert.notEqual(BASE_CATALOGUE_URL, CATALOGUE_REVISION);
  const data = readFileSync(new URL('../assets/character-stylized/catalogue.glb', import.meta.url));
  assert.equal(data.toString('ascii', 0, 4), 'glTF');
  const manifest = JSON.parse(readFileSync(new URL('../assets/character-stylized/manifest.json', import.meta.url)));
  assert.equal(manifest.appearanceRevision, BASE_CATALOGUE_REVISION);
  assert.ok(manifest.parts['persona:male'] > 0 && manifest.parts['persona:female'] > 0);
  assert.ok(manifest.parts['outfit:story-keeper'] > 0);
  assert.ok(manifest.parts['hair:short'] > 0 && manifest.parts['hair:long'] > 0 && manifest.parts['hair:curly'] > 0);
  assert.equal(manifest.parts['outfit:grand-archmage'] || 0, 0);
  assert.equal(manifest.parts['weapon:lore-lantern'] || 0, 0);
});

test('browser catalogues stay inside the deployed page sub-path', () => {
  assert.equal(resolveAssetBase('https://classodyssey.com/').href, 'https://classodyssey.com/assets/');
  assert.equal(resolveAssetBase('https://www.thomaswunsche.com/classodyssey/').href, 'https://www.thomaswunsche.com/classodyssey/assets/');
  assert.equal(resolveAssetBase('https://www.thomaswunsche.com/classodyssey/items-3d.html').href, 'https://www.thomaswunsche.com/classodyssey/assets/');
});

test('baked fallback portraits match the live base so the old base never flashes', () => {
  assert.equal(PORTRAIT_REVISION, `${BASE_CATALOGUE_REVISION}-front-hd`);
  const report = JSON.parse(readFileSync(new URL('previews/manifest.json', root)));
  assert.equal(report.portraitRevision, PORTRAIT_REVISION);
  for (const persona of ['male', 'female']) {
    assert.match(report.portraits[persona].renderer, /stylized-v4/);
    const file = readFileSync(new URL(`previews/${report.portraits[persona].file}`, root));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF');
  }
});

test('every modeled item has a real item-only WebP rendered from this catalogue', () => {
  const report = JSON.parse(readFileSync(new URL('previews/manifest.json',root)));
  assert.equal(report.revision, CATALOGUE_REVISION);
  assert.equal(report.catalogueSha256, createHash('sha256').update(readFileSync(new URL('catalogue.glb',root))).digest('hex'));
  assert.deepEqual(Object.keys(report.items).sort(), modeledItemIds().sort());
  for (const id of modeledItemIds()) {
    const entry=report.items[id];
    assert.equal(entry.containsBody,false);
    assert.ok(entry.meshCount > 0);
    const data=readFileSync(new URL(`previews/${entry.file}`,root));
    assert.equal(data.toString('ascii',0,4),'RIFF');
    assert.equal(data.toString('ascii',8,12),'WEBP');
    assert.ok(data.length > 1000 && data.length < 150000, id);
    const html=renderItemThumbnail(SHOP_ITEMS.find(item=>item.id===id));
    assert.match(html,/data-item-thumbnail=/);
    assert.doesNotMatch(html,/avatar|portrait|<svg/);
  }
});

test('isolated previews hide the real body and every other slot for both personas', () => {
  const parts=catalogue().nodes.filter(node=>node.mesh !== undefined).map(node=>node.extras);
  for (const item of SHOP_ITEMS.filter(item=>modeledItemIds().includes(item.id))) for (const persona of ['male','female']) {
    const look={...DEFAULT_LOOK,persona,hat:'steel-helm',preview:{slot:item.type,id:item.id}};
    const visible=parts.filter(data=>visiblePart(data,look));
    assert.ok(visible.length, item.id);
    assert.ok(visible.every(data=>data.shop_slot === item.type && data.shop_id === item.id && data.fit_persona === persona));
    if(item.type==='hair') assert.ok(visible.every(data=>data.hat_fit==='open'));
  }
});

test('picker, fallback portraits and shop markup use current assets and preserve pupil data', () => {
  const classroom=getCurrentClass(createInitialState());
  const pupil={...classroom.pupils[0],name:'Alex <script>',hat:'wizard-hat',hairColor:'blue-hair'};
  const before=structuredClone(pupil);
  const picker=renderSheikahStudent({classroom:{...classroom,pupils:[pupil]},ui:{query:''},pupil:null});
  assert.match(picker,/data-hero-portrait/);
  assert.match(picker,/items-3d\/previews\/portraits\/male\.webp/);
  assert.doesNotMatch(picker,/assets\/wardrobe\/|<script>/);
  assert.match(renderHeroPortrait(pupil),/wizard-hat/);
  const shop=renderSheikahShop(pupil,{shopCategory:'hat',shopPreview:'wizard-hat',angle:'quarter'});
  assert.match(shop,/&quot;preview&quot;:\{&quot;slot&quot;:&quot;hat&quot;/);
  assert.match(shop,/items\/wizard-hat\.webp/);
  assert.doesNotMatch(shop,/data-hero-portrait|assets\/wardrobe\/|<svg class="avatar/);
  assert.deepEqual(pupil,before);
});

test('refined catalogue exports PBR fibre and facial maps', () => {
  const gltf=catalogue();
  const materials=gltf.materials;
  assert.ok(materials.some(mat=>mat.extras?.base_skin_map === 'skin' && mat.normalTexture && mat.pbrMetallicRoughness.metallicRoughnessTexture));
  assert.ok(materials.some(mat=>mat.extras?.base_skin_map === 'head' && mat.normalTexture));
});
