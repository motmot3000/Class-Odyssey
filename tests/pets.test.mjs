import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createInitialState, getPupilById, getShopItem, normalizeState, purchaseItem, updateCosmetics } from '../src/domain.mjs';
import { DEFAULT_LOOK, PETS_REVISION, lookFromParams, visiblePart } from '../src/items-3d-model.mjs';
import { cosmeticChangesFromDraft, gameLook, renderOdysseyPersonalize, renderOdysseyShop, shopPreviewLook } from '../src/views/odyssey.mjs';
import { renderHeroPortrait } from '../src/equipment-previews.mjs';

const PET_IDS = ['fripouille', 'ranger-dog', 'starry-dragon', 'meadow-rabbit', 'scarlet-parrot'];

test('the scarlet parrot unlocks at level 7 for 50 coins and rides on the shoulder', () => {
  let state = createInitialState();
  const id = state.classes[0].pupils[0].id;
  const current = () => getPupilById(state, id);
  assert.equal(getShopItem('scarlet-parrot').type, 'pet');
  assert.equal(getShopItem('scarlet-parrot').minLevel, 7);
  assert.equal(getShopItem('scarlet-parrot').price, 50);
  current().level = 6;
  current().money = 50;
  assert.equal(purchaseItem(state, id, 'scarlet-parrot'), state);
  current().level = 7;
  current().money = 49;
  assert.equal(purchaseItem(state, id, 'scarlet-parrot'), state);
  current().money = 50;
  state = purchaseItem(state, id, 'scarlet-parrot');
  assert.equal(current().pet, 'scarlet-parrot');
  assert.equal(current().money, 0);
  const report = JSON.parse(readFileSync(new URL('../assets/pets/manifest.json', import.meta.url)));
  assert.equal(report.items['scarlet-parrot'].mount, 'shoulder');
  // Both feet grip the real shoulder surface (claws 0–4 mm into it), none in the air.
  const gaps = report.items['scarlet-parrot'].footGaps;
  assert.equal(gaps.length, 2);
  for (const gap of gaps) assert.ok(gap <= .001 && gap > -.004, `foot gap ${gap}`);
  // Whole soles on the cloth: no sole point more than 5 mm above the shoulder.
  assert.ok(report.items['scarlet-parrot'].footWorstGap < .005);
});

test('dragon costs 90 coins from level 9; a still rabbit is affordable from level 1', () => {
  let state = createInitialState();
  const id = state.classes[0].pupils[0].id;
  const current = () => getPupilById(state, id);
  assert.equal(getShopItem('meadow-rabbit').minLevel, 1);
  assert.equal(getShopItem('meadow-rabbit').price, 10);
  current().money = 10;
  state = purchaseItem(state, id, 'meadow-rabbit');
  assert.equal(current().pet, 'meadow-rabbit');
  assert.equal(current().money, 0);
  current().level = 8;
  current().money = 90;
  assert.equal(getShopItem('starry-dragon').minLevel, 9);
  assert.equal(getShopItem('starry-dragon').price, 90);
  assert.equal(purchaseItem(state, id, 'starry-dragon'), state);
  current().level = 9;
  current().money = 89;
  assert.equal(purchaseItem(state, id, 'starry-dragon'), state);
  current().money = 90;
  state = purchaseItem(state, id, 'starry-dragon');
  assert.equal(current().pet, 'starry-dragon');
  assert.equal(current().money, 0);
  assert.ok(current().ownedItems.includes('meadow-rabbit'));
  state = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(current().pet, 'starry-dragon');
  state = updateCosmetics(state, id, { pet: 'meadow-rabbit' });
  assert.equal(current().pet, 'meadow-rabbit');
});

test('pets respect level, balance, ownership and a single equip slot across saves', () => {
  let state = createInitialState();
  const id = state.classes[0].pupils[0].id;
  const current = () => getPupilById(state, id);
  assert.equal(current().pet, 'no-pet');
  assert.ok(current().ownedItems.includes('no-pet'));
  assert.equal(updateCosmetics(state, id, { pet: 'fripouille' }), state);
  current().money = 200;
  assert.equal(purchaseItem(state, id, 'fripouille'), state);
  current().level = 4;
  current().money = 0;
  assert.equal(purchaseItem(state, id, 'fripouille'), state);
  current().money = 200;
  const original = structuredClone(state);
  state = purchaseItem(state, id, 'fripouille');
  assert.equal(current().pet, 'fripouille');
  assert.equal(current().money, 160);
  assert.equal(original.classes[0].pupils[0].pet, 'no-pet');
  assert.equal(purchaseItem(state, id, 'fripouille'), state);
  state = purchaseItem(state, id, 'ranger-dog');
  assert.equal(current().pet, 'ranger-dog');
  assert.equal(current().money, 110);
  assert.ok(current().ownedItems.includes('fripouille'));
  state = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(current().pet, 'ranger-dog');
  state = updateCosmetics(state, id, { pet: 'no-pet' });
  assert.equal(current().pet, 'no-pet');
  state = updateCosmetics(state, id, { pet: 'fripouille' });
  assert.equal(current().pet, 'fripouille');
  assert.equal(current().money, 110);
  current().pet = 'invalid';
  state = normalizeState(state);
  assert.equal(current().pet, 'no-pet');
  delete current().pet;
  state = normalizeState(state);
  assert.equal(current().pet, 'no-pet');
});

test('pet previews are isolated, do not equip, and owned companions join the dressing and portraits', () => {
  const pupil = createInitialState().classes[0].pupils[0];
  const before = structuredClone(pupil);
  for (const pet of PET_IDS) {
    const look = shopPreviewLook(pupil, { shopCategory: 'pet', shopPreview: pet });
    assert.equal(look.pet, pet);
    assert.deepEqual(look.preview, { slot: 'pet', id: pet });
    assert.equal(lookFromParams(new URLSearchParams({ pet })).pet, pet);
    assert.equal(gameLook(pupil, { pet }).pet, pet);
    assert.deepEqual(cosmeticChangesFromDraft({ pet }), { pet });
    assert.match(renderOdysseyShop(pupil, { shopCategory: 'pet', shopPreview: pet }), new RegExp(`items/${pet}\\.webp`));
    assert.doesNotMatch(renderOdysseyPersonalize(pupil, {}), new RegExp(`data-value="${pet}"`));
    const owned = { ...pupil, pet, ownedItems: [...pupil.ownedItems, pet] };
    assert.match(renderOdysseyPersonalize(owned, {}), new RegExp(`data-field="pet" data-value="${pet}"`));
    assert.match(renderHeroPortrait(owned), new RegExp(`&quot;pet&quot;:&quot;${pet}&quot;`));
  }
  assert.equal(shopPreviewLook(pupil, { shopCategory: 'pet' }).pet, 'meadow-rabbit');
  assert.equal(shopPreviewLook(pupil, { shopCategory: 'pet', shopPreview: 'no-pet' }), null);
  assert.deepEqual(pupil, before);
});

test('shipped pets are textured, bounded, lightweight and shared by both heroes', () => {
  const bytes = readFileSync(new URL('../assets/pets/catalogue.glb', import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const report = JSON.parse(readFileSync(new URL('../assets/pets/manifest.json', import.meta.url)));
  assert.equal(report.revision, PETS_REVISION);
  assert.equal(report.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.ok(bytes.length < 3 * 1024 * 1024, 'Keep the four-companion catalogue affordable on classroom Wi-Fi');
  assert.equal(gltf.skins?.length || 0, 0);
  assert.equal(gltf.animations?.length || 0, 0);
  assert.ok(gltf.images.length >= 3);
  const parts = gltf.nodes.filter(node => node.mesh !== undefined);
  assert.ok(parts.every(node => node.extras.shop_slot === 'pet' && !node.extras.fit_persona));
  for (const pet of PET_IDS) {
    assert.equal(getShopItem(pet).type, 'pet');
    assert.ok(report.items[pet].triangles < 22000);
    for (const persona of ['male', 'female']) {
      const equipped = { ...DEFAULT_LOOK, persona, pet };
      const visible = parts.filter(node => visiblePart(node.extras, equipped));
      assert.equal(visible.length, report.items[pet].meshes);
      assert.ok(visible.every(node => node.extras.shop_id === pet));
      assert.ok(visible.every(node => visiblePart(node.extras, equipped, true)));
      assert.equal(parts.filter(node => visiblePart(node.extras, { ...equipped, pet: 'no-pet' })).length, 0);
    }
  }
  // The GLB stores +Y up: paws near 0 and a small companion beside the hero.
  for (const node of parts) for (const primitive of gltf.meshes[node.mesh].primitives) {
    const { min, max } = gltf.accessors[primitive.attributes.POSITION];
    if (node.extras.mount === 'shoulder') {
      // The parrot perches on the left shoulder (1.41 m on both bases), its
      // tail down the back (+glTF Z is forward, so the tail is at -Z).
      assert.ok(min[0] > .07 && max[0] < .27, 'Parrot stays over the shoulder, clear of the ear');
      assert.ok(min[1] > 1.1 && max[1] < 1.7, 'Parrot is on the shoulder, not on the floor');
      assert.ok(min[2] > -.35 && max[2] < .16);
      continue;
    }
    const dragon = node.extras.shop_id === 'starry-dragon';
    assert.ok(dragon ? min[0] >= .23 && max[0] < 1.3 : min[0] > .24 && max[0] < .55, 'Companions stay close; the dragon tail stays clear of the hero’s boots');
    assert.ok(min[1] > -.001 && max[1] < .71);
    assert.ok(min[2] > -.7 && max[2] < .7);
  }
  assert.equal(report.items['starry-dragon'].headRevision, 'friendly-epic-v2');
  for (const part of ['bright gold iris', 'rounded vertical pupils', 'eye catchlights', 'gold head crest']) {
    assert.ok(gltf.materials.some(m => m.name.includes(part)), `Dragon face needs ${part}`);
  }
  // The rabbit is a small, bare companion: no scarf geometry.
  const rabbit = parts.filter(node => node.extras.shop_id === 'meadow-rabbit');
  assert.equal(rabbit.length, 1);
  assert.ok(!gltf.materials.some(m => m.name.includes('rabbit / woven scarf')));
  assert.ok(report.items['meadow-rabbit'].heightMeters <= .3);
  assert.ok(gltf.materials.some(m => m.name.includes('original turquoise coral gold')));
});
