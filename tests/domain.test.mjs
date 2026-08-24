import assert from "node:assert/strict";
import test from "node:test";
import {
  addPupil,
  awardMoney,
  awardXp,
  canBuyItem,
  changeHp,
  changeHpMany,
  clearSelection,
  createInitialState,
  getCurrentClass,
  getNextReward,
  getPupilById,
  getRewardsForLevel,
  getShopItem,
  getShopItems,
  getUnlockedSkins,
  importState,
  isEliminated,
  isItemOwned,
  normalizeState,
  purchaseItem,
  renamePupil,
  restoreHpAll,
  selectAllInClass,
  setSelectMode,
  toggleSelection,
  updateCosmetics,
  xpNeededForLevel
} from "../src/domain.mjs";

test("creates the two documented classes", () => {
  const state = createInitialState();
  assert.deepEqual(state.classes.map((classroom) => classroom.name), ["7P", "8P"]);
});

test("adds a pupil with level 1 and 5 HP", () => {
  const state = addPupil(createInitialState(), "7p", { name: " Zoé " });
  const pupil = getCurrentClass(state).pupils.at(-1);
  assert.equal(pupil.name, "Zoé");
  assert.equal(pupil.level, 1);
  assert.equal(pupil.hp, 5);
});

test("a girl defaults to long hair and keeps her skin tone", () => {
  const state = addPupil(createInitialState(), "7p", { name: "Zoé", gender: "girl", skinTone: "brown" });
  const pupil = getCurrentClass(state).pupils.at(-1);
  assert.equal(pupil.gender, "girl");
  assert.equal(pupil.skinTone, "brown");
  assert.equal(pupil.hair, "long");
  assert.equal(pupil.face, "smile");
});

test("faces and hairstyles are shop items", () => {
  assert.equal(getShopItem("grin")?.type, "face");
  assert.equal(getShopItem("spiky")?.type, "hair");
  assert.equal(getShopItem("sunglasses")?.type, "hat");
  assert.equal(getShopItem("evil")?.type, "face");
  assert.equal(getShopItem("story-keeper")?.name, "Warrior");
  assert.equal(getShopItem("scholar-virtuoso")?.name, "Star");
});

test("shop item names use simple English for 7P and 8P pupils", () => {
  const names = {
    "pencil-sword": "Sword",
    "word-wand": "Wand",
    "swords-and-shield": "Swords & Shield",
    "star-shield": "Shield",
    "lore-lantern": "Lantern",
    "spell-grimoire": "Magic Book",
    "dual-daggers": "Daggers",
    "gold-crown": "King's Crown",
    "explorer-cap": "Goggles",
    "wizard-hat": "Wizard Hat",
    "steel-helm": "Helmet",
    "classy-hat": "Classy Hat",
    short: "Short Hair",
    long: "Long Hair",
    bald: "Bald",
    "buzz-cut": "Buzz Cut",
    curly: "Afro",
    "monk-cut": "Monk Cut",
    "royal-hair": "Royal Hair",
    braided: "Braids",
    cool: "Cool",
    "star-eyes": "Star Eyes",
    transcendent: "God Face",
    "golden-skin": "Golden Skin",
    "custom-bespoke": "Custom Item"
  };

  for (const [id, name] of Object.entries(names)) {
    assert.equal(getShopItem(id)?.name, name);
  }

  for (const removedId of [
    "shadow-hood", "winged-circlet", "star-cowl",
    "astral-scepter", "wisdom-relic", "ponytail", "flowing", "celestial-hair"
  ]) {
    assert.equal(getShopItem(removedId), null);
  }
});

test("XP progression levels up and restores HP", () => {
  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = changeHp(state, pupilId, -3);
  state = awardXp(state, [pupilId], xpNeededForLevel(1), "test");
  const pupil = getPupilById(state, pupilId);
  assert.equal(pupil.level, 2);
  assert.equal(pupil.hp, 5);
  assert.equal(pupil.xp, 0);
});

test("HP cannot go below zero and zero means eliminated", () => {
  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = changeHp(state, pupilId, -99);
  const pupil = getPupilById(state, pupilId);
  assert.equal(pupil.hp, 0);
  assert.equal(isEliminated(pupil), true);
});

test("locked skins cannot be selected before their level", () => {
  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = updateCosmetics(state, pupilId, { outfit: "grammar-mage" });
  assert.equal(getPupilById(state, pupilId).skin, "starter");
  assert.equal(getUnlockedSkins(1).some((skin) => skin.id === "grammar-mage"), false);
});

test("renames a pupil and ignores empty names", () => {
  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = renamePupil(state, pupilId, "  Zoé  ");
  assert.equal(getPupilById(state, pupilId).name, "Zoé");
  state = renamePupil(state, pupilId, "   ");
  assert.equal(getPupilById(state, pupilId).name, "Zoé");
});

test("restores full HP to the whole class", () => {
  let state = createInitialState();
  const classroom = getCurrentClass(state);
  const pupilId = classroom.pupils[0].id;
  state = changeHp(state, pupilId, -99);
  assert.equal(isEliminated(getPupilById(state, pupilId)), true);
  state = restoreHpAll(state, classroom.id);
  assert.equal(getPupilById(state, pupilId).hp, 5);
  assert.equal(getPupilById(state, pupilId).hp, getPupilById(state, pupilId).maxHp);
});

test("imports valid JSON state and rejects invalid input", () => {
  const state = createInitialState();
  const imported = importState(JSON.stringify(state));
  assert.deepEqual(imported.classes.map((classroom) => classroom.name), ["7P", "8P"]);

  assert.throws(() => importState("{not json"), /JSON/);
  assert.throws(() => importState("{}"), /backup/i);
});

test("later levels unlock the top outfit", () => {
  const state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  const leveled = awardXp(state, [pupilId], xpNeededForLevel(1) + xpNeededForLevel(2) + xpNeededForLevel(3) + xpNeededForLevel(4), "grind");
  const pupil = getPupilById(leveled, pupilId);
  assert.ok(pupil.level >= 5);
  assert.ok(getUnlockedSkins(pupil.level).some((skin) => skin.id === "story-keeper"));
});

test("money buys an eligible shop item and equip it", () => {
  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = awardXp(state, [pupilId], xpNeededForLevel(1), "level up");
  state = awardMoney(state, [pupilId], 20, "reward");
  const pupil = getPupilById(state, pupilId);
  const item = getShopItem("explorer-cap");
  assert.equal(canBuyItem(pupil, item), true);
  state = purchaseItem(state, pupilId, item.id);
  const upgraded = getPupilById(state, pupilId);
  assert.equal(upgraded.money, 5);
  assert.equal(upgraded.hat, "explorer-cap");
  assert.equal(isItemOwned(upgraded, "explorer-cap"), true);
});

test("rewards for a level list unlocks and always mention HP restored above level 1", () => {
  assert.deepEqual(getRewardsForLevel(1).includes("HP restored"), false);
  const level2Rewards = getRewardsForLevel(2);
  assert.ok(level2Rewards.includes("HP restored"));
  assert.ok(level2Rewards.includes("Ranger"));
  assert.ok(level2Rewards.includes("Pupil title"));
});

test("next reward finds the closest upcoming unlock and stops at the top", () => {
  const next = getNextReward(1);
  assert.equal(next.level, 2);
  assert.equal(getNextReward(10), null);
  const nextAt5 = getNextReward(5);
  assert.equal(nextAt5.level, 6);
});

test("shop covers all categories with regular level unlocks up to level 10", () => {
  const categories = ["outfit", "hat", "weapon", "face", "hair", "title", "tone"];
  for (const cat of categories) {
    const items = getShopItems(cat);
    assert.ok(items.length > 0);
    assert.ok(items.some((item) => item.minLevel >= 6));
  }
});

test("items and titles follow their intended progression", () => {
  assert.deepEqual(
    getShopItems("weapon").map((item) => item.id),
    ["no-weapon", "star-shield", "lore-lantern", "spell-grimoire", "dual-daggers", "pencil-sword", "word-wand", "swords-and-shield"]
  );
  assert.deepEqual(
    getShopItems("title").map((item) => item.name),
    ["Rookie", "Pupil", "Explorer", "Star", "Champion", "Leader", "King", "Master", "Legend"]
  );
});

test("fantasy skins can be bought and equipped", () => {
  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = awardXp(state, [pupilId], xpNeededForLevel(1) + xpNeededForLevel(2), "level up");
  state = awardMoney(state, [pupilId], 30, "reward");
  state = purchaseItem(state, pupilId, "blue-skin");
  const pupil = getPupilById(state, pupilId);
  assert.equal(pupil.skinTone, "blue-skin");
  assert.equal(isItemOwned(pupil, "blue-skin"), true);
});

test("bespoke item costs 100 money and requires level 10", () => {
  const item = getShopItem("custom-bespoke");
  assert.ok(item);
  assert.equal(item.minLevel, 10);
  assert.equal(item.price, 100);
  assert.equal(item.type, "bespoke");

  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = awardMoney(state, [pupilId], 200, "treasure");

  // At level 1, cannot buy
  let pupil = getPupilById(state, pupilId);
  assert.equal(canBuyItem(pupil, item), false);
  let nextState = purchaseItem(state, pupilId, "custom-bespoke", "Épée du Tonnerre");
  assert.equal(nextState, state);

  // Level up to 10
  for (let i = 1; i < 10; i++) {
    state = awardXp(state, [pupilId], xpNeededForLevel(i), "levelup");
  }
  pupil = getPupilById(state, pupilId);
  assert.equal(pupil.level, 10);
  assert.equal(canBuyItem(pupil, item), true);

  // Purchase bespoke item
  nextState = purchaseItem(state, pupilId, "custom-bespoke", "Épée du Tonnerre");
  const updated = getPupilById(nextState, pupilId);
  assert.equal(updated.money, 100);
  assert.equal(isItemOwned(updated, "custom-bespoke"), true);
  assert.equal(updated.customOrders.length, 1);
  assert.equal(updated.customOrders[0].note, "Épée du Tonnerre");
  assert.equal(updated.customOrders[0].cost, 100);
  assert.ok(nextState.events.some((e) => e.type === "bespoke_order"));

  nextState = purchaseItem(nextState, pupilId, "custom-bespoke", "Cape des Étoiles");
  assert.equal(getPupilById(nextState, pupilId).money, 0);
  assert.equal(getPupilById(nextState, pupilId).customOrders.length, 2);
});

test("toggling selection adds and removes a pupil from the bulk selection", () => {
  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = toggleSelection(state, pupilId);
  assert.deepEqual(state.selectedPupilIds, [pupilId]);
  state = toggleSelection(state, pupilId);
  assert.deepEqual(state.selectedPupilIds, []);
});

test("select mode clears the single selection, and turning it off clears the bulk selection", () => {
  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = { ...state, selectedPupilId: pupilId };
  state = setSelectMode(state, true);
  assert.equal(state.selectMode, true);
  assert.equal(state.selectedPupilId, null);

  state = toggleSelection(state, pupilId);
  state = setSelectMode(state, false);
  assert.deepEqual(state.selectedPupilIds, []);
});

test("select all targets only the active class, and clear selection empties it", () => {
  let state = createInitialState();
  state = selectAllInClass(state, "7p");
  const cpIds = getCurrentClass(state).pupils.map((pupil) => pupil.id);
  assert.deepEqual([...state.selectedPupilIds].sort(), [...cpIds].sort());

  state = clearSelection(state);
  assert.deepEqual(state.selectedPupilIds, []);
});

test("bulk HP change applies to every selected pupil and clamps at the bounds", () => {
  let state = createInitialState();
  const pupils = getCurrentClass(state).pupils;
  const ids = [pupils[0].id, pupils[1].id];
  state = changeHpMany(state, ids, -99);
  assert.equal(getPupilById(state, ids[0]).hp, 0);
  assert.equal(getPupilById(state, ids[1]).hp, 0);
  assert.equal(isEliminated(getPupilById(state, ids[0])), true);

  state = changeHpMany(state, ids, 2);
  assert.equal(getPupilById(state, ids[0]).hp, 2);
  assert.equal(getPupilById(state, ids[1]).hp, 2);
});

test("normalizeState drops selection ids that no longer exist", () => {
  const state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  const raw = { ...state, selectMode: true, selectedPupilIds: [pupilId, "ghost-id"] };
  const normalized = normalizeState(raw);
  assert.deepEqual(normalized.selectedPupilIds, [pupilId]);
});

test("normalizeState sanitizes imported activity amounts", () => {
  const state = createInitialState();
  const normalized = normalizeState({
    ...state,
    events: [{
      id: "unsafe",
      at: new Date().toISOString(),
      type: "money",
      pupilIds: [],
      amount: "<img src=x onerror=alert(1)>",
      reason: "Imported"
    }]
  });
  assert.equal(normalized.events[0].amount, 0);
  assert.equal(normalized.events[0].reason, "Imported");
});

test("normalizeState migrates legacy CP/VIP classes to 7P/8P", () => {
  const state = createInitialState();
  const legacy = {
    ...state,
    activeClassId: "cp",
    classes: state.classes.map((classroom) =>
      classroom.id === "7p"
        ? { ...classroom, id: "cp", name: "CP" }
        : { ...classroom, id: "vip", name: "VIP" }
    )
  };
  const normalized = normalizeState(legacy);
  assert.deepEqual(normalized.classes.map((classroom) => classroom.name), ["7P", "8P"]);
  assert.equal(normalized.activeClassId, "7p");
});

test("normalizePupil keeps equipped cosmetics even if they are missing from ownedItems", () => {
  const state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  const raw = {
    ...state,
    classes: state.classes.map((classroom) => ({
      ...classroom,
      pupils: classroom.pupils.map((pupil) => {
        if (pupil.id !== pupilId) return pupil;
        return {
          ...pupil,
          hat: "explorer-cap",
          weapon: "pencil-sword",
          face: "cool",
          ownedItems: ["starter", "rookie", "no-hat", "no-weapon", "smile", "short", "long"]
        };
      })
    }))
  };
  const normalized = normalizeState(raw);
  const pupil = getPupilById(normalized, pupilId);
  assert.equal(pupil.hat, "explorer-cap");
  assert.equal(pupil.weapon, "pencil-sword");
  assert.equal(pupil.face, "cool");
  assert.equal(isItemOwned(pupil, "explorer-cap"), true);
  assert.equal(isItemOwned(pupil, "pencil-sword"), true);
  assert.equal(isItemOwned(pupil, "cool"), true);
});

test("normalizePupil migrates the legacy coins field to money", () => {
  const state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  const legacy = {
    ...state,
    classes: state.classes.map((classroom) => ({
      ...classroom,
      pupils: classroom.pupils.map((pupil) => {
        if (pupil.id !== pupilId) return pupil;
        const legacyPupil = { ...pupil, coins: 42 };
        delete legacyPupil.money;
        return legacyPupil;
      })
    }))
  };
  const normalized = normalizeState(legacy);
  assert.equal(getPupilById(normalized, pupilId).money, 42);
  assert.equal(getPupilById(normalized, pupilId).coins, undefined);
});
