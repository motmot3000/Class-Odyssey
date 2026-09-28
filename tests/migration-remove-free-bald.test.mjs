import test from "node:test";
import assert from "node:assert/strict";
import { migratePupil, migrateState } from "../server/migrations/2026-09-remove-free-bald.mjs";

const pupil = (extra = {}) => ({ id: "p", name: "Ana", gender: "girl", xp: 340, level: 3, money: 42, hp: 4, maxHp: 5, hair: "long", ownedItems: ["starter", "bald", "wizard-hat"], ...extra });

test("bald leaves the inventory and nothing else moves", () => {
  const { pupil: next, changed } = migratePupil(pupil());
  assert.equal(changed, true);
  assert.deepEqual(next.ownedItems, ["starter", "wizard-hat"]);
  assert.deepEqual({ ...next, ownedItems: null }, { ...pupil(), ownedItems: null });
});

test("a pupil wearing bald returns to the default cut", () => {
  assert.equal(migratePupil(pupil({ hair: "bald" })).pupil.hair, "long");
  assert.equal(migratePupil(pupil({ gender: "boy", hair: "bald" })).pupil.hair, "short");
});

test("untouched states keep their revision; changed states move one revision up", () => {
  const clean = { revision: 7, classes: [{ id: "c", name: "C", pupils: [pupil({ ownedItems: ["starter"] })] }] };
  assert.equal(migrateState(clean).state, clean);
  const dirty = { revision: 7, classes: [{ id: "c", name: "C", pupils: [pupil()] }] };
  const result = migrateState(dirty);
  assert.equal(result.state.revision, 8);
  assert.equal(result.pupils, 1);
});
