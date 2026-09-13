import assert from "node:assert/strict";
import test from "node:test";
import { HAIRS, HAIR_COLORS, SHOP_ITEMS, createInitialState, getCurrentClass, getShopItem } from "../src/domain.mjs";
import { renderHero, renderItemArt } from "../src/avatar.mjs";

function samplePupil(overrides = {}) {
  return { ...getCurrentClass(createInitialState()).pupils[0], ...overrides };
}

test("renderHero produces unique valid SVG ids for the same pupil", () => {
  const pupil = samplePupil({ id: "7p-1", name: "Alex <hero>" });
  const first = renderHero(pupil);
  const second = renderHero(pupil);
  const ids = [...first.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length > 0);
  for (const id of ids) {
    assert.match(id, /^[A-Za-z][A-Za-z0-9_-]*$/);
  }
  assert.equal(new Set(ids).size, ids.length);
  assert.notEqual(first, second);
  assert.match(first, /aria-label="Alex &lt;hero&gt; the hero"/);
});

test("numeric pupil ids still produce valid SVG ids", () => {
  const svg = renderHero(samplePupil({ id: "123" }));
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.every((id) => /^[A-Za-z]/.test(id)));
});

test("shop item previews render without throwing", () => {
  assert.ok(SHOP_ITEMS.length > 0);
  for (const item of SHOP_ITEMS) {
    const svg = renderItemArt(item);
    assert.match(svg, /^<svg /);
    assert.doesNotMatch(svg, /undefined/);
  }
});

test("hair colors recolor every haircut without changing its geometry or leaking between heroes", () => {
  const geometry = (svg) => [...svg.matchAll(/\b(?:d|cx|cy|rx|ry|r|points)="[^"]*"/g)].map(([attribute]) => attribute);
  for (const gender of ["boy", "girl"]) {
    for (const hair of HAIRS) {
      for (const hat of ["no-hat", "wizard-hat"]) {
        const pupil = samplePupil({ gender, hair: hair.id, hat });
        const original = renderHero(pupil);
        for (const color of HAIR_COLORS.filter((item) => item.price > 0)) {
          const svg = renderHero({ ...pupil, hairColor: color.id });
          assert.deepEqual(geometry(svg), geometry(original));
          assert.doesNotMatch(svg, /#402D1D|#291C11|#5F4530|#1B1209/);
          assert.match(svg, /#F0C9A4/);
        }
        assert.match(renderHero(pupil), /#291C11/);
      }
    }
  }
});

test("haircut previews use the equipped color and color previews use their own color", () => {
  const pupil = samplePupil({ hairColor: "blue-hair" });
  assert.match(renderItemArt(getShopItem("curly"), pupil), /#487FB8/);
  const blond = renderItemArt(getShopItem("blond-hair"), pupil);
  assert.match(blond, /#D2AF5E/);
  assert.doesNotMatch(blond, /#487FB8/);
});
