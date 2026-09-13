import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, getCurrentClass } from "../src/domain.mjs";
import { cosmeticChangesFromDraft, wardrobeLook } from "../src/views/sheikah.mjs";

test("the Sheikah workshop maps catalog choices to the 3D preview", () => {
  const pupil = getCurrentClass(createInitialState()).pupils[0];
  const original = wardrobeLook(pupil);
  const preview = wardrobeLook(pupil, {
    skin: "vocab-ranger",
    weapon: "star-shield",
    hairColor: "black-hair"
  });

  assert.notEqual(preview.outfit, original.outfit);
  assert.notEqual(preview.item, original.item);
  assert.notEqual(preview.dye, original.dye);
});

test("the Sheikah workshop converts its draft to domain cosmetic types", () => {
  assert.deepEqual(cosmeticChangesFromDraft({
    skin: "vocab-ranger",
    weapon: "star-shield",
    hairColor: "black-hair"
  }), {
    outfit: "vocab-ranger",
    weapon: "star-shield",
    hairColor: "black-hair"
  });
});
