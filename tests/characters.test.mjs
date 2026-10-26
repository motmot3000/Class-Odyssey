import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, getCurrentClass, SHOP_ITEMS } from "../src/domain.mjs";
import { BASE_CHARACTER_TONES, characterAppearance, characterAssets, renderBaseCharacter } from "../src/characters.mjs";
import { renderConsole } from "../src/views/console.mjs";
import { renderItemDialog } from "../src/views/modals.mjs";

const ui = { query:"", density:"grid", scope:"selection", shopCategory:"outfit", xpAmount:100, coinAmount:20, openPanels:new Set(["hero"]) };
function pupil(overrides = {}) { return { ...getCurrentClass(createInitialState()).pupils[0], ...overrides }; }

test("base characters support both stored genders and every base skin tone", () => {
  for (const gender of ["boy", "girl"]) for (const tone of BASE_CHARACTER_TONES) {
    const assets = characterAssets({ gender, skinTone:tone });
    assert.equal(assets.gender, gender);
    assert.equal(assets.tone, tone);
    assert.ok(new URL(assets.model).pathname.endsWith(`/characters-base/${gender}-${tone}.glb`));
    assert.ok(new URL(assets.thumbnail).pathname.endsWith(`/${gender}-${tone}-small.webp`));
  }
  assert.deepEqual(characterAppearance({gender:"../../secret",skinTone:"../../secret"}), {gender:"boy",tone:"light"});
  assert.deepEqual(characterAppearance({gender:"girl",skinTone:"golden-skin"}), {gender:"girl",tone:"light"});
});

test("base rendering escapes names and never changes inventory or equipped cosmetics", () => {
  const value=pupil({name:'Alex "<script>',skin:"grammar-mage",hat:"shadow-hood",weapon:"lore-lantern"});
  const before=structuredClone(value);
  const html=renderBaseCharacter(value);
  assert.match(html,/Alex &quot;&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>|grammar-mage|shadow-hood|lore-lantern/);
  assert.deepEqual(value,before);
});

test("the active teacher console uses the current equipped character portrait", () => {
  const value = pupil({ gender: 'girl', hair: 'long', hat: 'wizard-hat' });
  const classroom = { ...getCurrentClass(createInitialState()), pupils: [value] };
  const html = renderConsole({classroom,ui,targets:[],focused:value,canUndo:false,events:[],armedReset:false});
  assert.match(html, /data-hero-portrait/);
  assert.match(html, /items-3d\/previews\/portraits\/female\.webp/);
  assert.doesNotMatch(html, /assets\/wardrobe\//);
});

test("item dialogs show the 3D product thumbnail without an old avatar", () => {
  const item=SHOP_ITEMS.find(item=>item.type==="hat" && item.id!=="no-hat");
  const html=renderItemDialog(item,pupil());
  assert.match(html,/data-item-thumbnail="feather-beret"/);
  assert.doesNotMatch(html,/<svg class="avatar|is-hero-preview/);
  assert.doesNotMatch(html,/data-base-character-viewer/);
});
