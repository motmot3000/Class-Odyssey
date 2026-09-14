import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, getCurrentClass } from "../src/domain.mjs";
import { cosmeticChangesFromDraft, gameLook, shopPreviewLook } from "../src/views/sheikah.mjs";

const pupil = () => getCurrentClass(createInitialState()).pupils[0];

test("the Sheikah preview maps catalog choices to the items-3d look", () => {
  const value = pupil();
  const original = gameLook(value);
  const preview = gameLook(value, {
    skin: "vocab-ranger",
    hat: "wizard-hat",
    weapon: "star-shield",
    hair: "curly",
    hairColor: "black-hair"
  });

  assert.equal(original.persona, "male");
  assert.equal(preview.persona, "male");
  assert.equal(preview.skin, "vocab-ranger");
  assert.equal(preview.hat, "wizard-hat");
  assert.equal(preview.weapon, "star-shield");
  assert.equal(preview.hair, "curly");
  assert.equal(preview.hairColor, "black-hair");
  assert.notEqual(preview.skin, original.skin);
  assert.notEqual(preview.weapon, original.weapon);
  assert.notEqual(preview.hairColor, original.hairColor);
});

test("girls use the female persona and keep their own cosmetics", () => {
  const look = gameLook({ gender: "girl", skin: "starter", hat: "no-hat", weapon: "no-weapon", hair: "long", hairColor: "brown-hair" });
  assert.equal(look.persona, "female");
  assert.equal(look.hair, "long");
});

test("the shop preview applies only items that have a 3D model", () => {
  const value = pupil();
  const original = gameLook(value);
  const hat = shopPreviewLook(value, { shopPreview: "wizard-hat" });
  assert.equal(hat.hat, "wizard-hat");
  const title = shopPreviewLook(value, { shopPreview: "class-legend" });
  assert.deepEqual(title, original);
});

test("the Sheikah workshop converts its draft to domain cosmetic types", () => {
  assert.deepEqual(cosmeticChangesFromDraft({
    skin: "vocab-ranger",
    hat: "wizard-hat",
    weapon: "star-shield",
    hair: "curly",
    hairColor: "black-hair"
  }), {
    outfit: "vocab-ranger",
    hat: "wizard-hat",
    weapon: "star-shield",
    hair: "curly",
    hairColor: "black-hair"
  });
});
