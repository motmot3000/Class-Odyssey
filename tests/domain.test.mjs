import assert from "node:assert/strict";
import test from "node:test";
import {
  addPupil,
  addClass,
  addRule,
  awardMoney,
  awardXp,
  canBuyItem,
  changeHp,
  changeHpMany,
  clearSelection,
  createClass,
  createInitialState,
  getCurrentClass,
  getNextReward,
  getPupilById,
  getRewardsForLevel,
  getRewardsBetween,
  getRules,
  getShopItem,
  getShopItems,
  getUnlockedSkins,
  importState,
  isEliminated,
  isItemOwned,
  normalizeState,
  purchaseItem,
  removeRule,
  renamePupil,
  restoreHpAll,
  selectAllInClass,
  setRule,
  setSelectMode,
  toggleSelection,
  toggleClassSelection,
  updateCosmetics,
  xpNeededForLevel
} from "../src/domain.mjs";

test("malformed imports are rejected instead of crashing or duplicating identities", () => {
  for (const classes of [[null], [{ id: "a", pupils: [null] }], [{ id: "a", pupils: [] }, { id: "a", pupils: [] }], [{ id: "a", pupils: [{ id: "same" }, { id: "same" }] }]]) {
    assert.throws(() => importState(JSON.stringify({ classes })), /backup|classes/i);
  }
  const empty = normalizeState({ classes: [] });
  assert.equal(empty.classes.length, 0);
  assert.equal(empty.activeClassId, null);
  assert.equal(importState(JSON.stringify({ classes: [] })).classes.length, 0);
});

test("imported counters stay valid and cannot create an unbounded heart row", () => {
  const raw = createInitialState();
  Object.assign(raw.classes[0].pupils[0], { level: 0, maxHp: 1e9, hp: 1e9, xp: 1e100, money: 1e100 });
  const pupil = normalizeState(raw).classes[0].pupils[0];
  assert.equal(pupil.level, 1);
  assert.equal(pupil.maxHp, 100);
  assert.equal(pupil.hp, 100);
  assert.equal(pupil.xp, 0);
  assert.equal(pupil.money, 0);
});

test("large XP awards use bounded work and preserve the progression formula", () => {
  const state = createInitialState();
  const old = getCurrentClass(state).pupils[0];
  const next = getPupilById(awardXp(state, [old.id], 1e12), old.id);
  const gained = next.level - old.level;
  const spent = gained * xpNeededForLevel(old.level) + 250 * gained * (gained - 1);
  assert.equal(next.xp + spent, old.xp + 1e12);
  assert.ok(next.xp >= 0 && next.xp < xpNeededForLevel(next.level));
  assert.ok(getRewardsBetween(1, next.level).length < 100);
  assert.equal(awardXp(state, [old.id], 1e100), state);
});

test("missing targets and zero-value fractional awards do not create phantom activity", () => {
  const state = createInitialState();
  assert.equal(awardXp(state, ["missing"], 10), state);
  assert.equal(awardMoney(state, ["missing"], 10), state);
  assert.equal(changeHp(state, "missing", -1), state);
  assert.equal(changeHpMany(state, ["missing"], -1), state);
  assert.equal(awardMoney(state, [state.classes[0].pupils[0].id], .5), state);
  assert.equal(toggleSelection(state, "missing"), state);
});

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

test("a new class can be created with a name and its first students", () => {
  let state = createInitialState({ samples: false });
  const before = state.classes.length;
  state = createClass(state, { name: "  9P  ", students: ["Zoé", "Max", "   "] });
  const created = state.classes.at(-1);
  assert.equal(state.classes.length, before + 1);
  assert.equal(created.name, "9P");
  assert.equal(state.activeClassId, created.id);
  assert.deepEqual(created.pupils.map((pupil) => pupil.name), ["Zoé", "Max"]);
  assert.deepEqual(createClass(state, { name: "   " }), state);
});

test("the shared haircuts ship with Bald and the Braid", () => {
  assert.deepEqual(getShopItems("hair").map((item) => item.id), ["short", "long", "bald", "curly"]);
  assert.equal(getShopItem("short").price, 0);
  assert.equal(getShopItem("long").price, 0);
  assert.equal(getShopItem("bald").minLevel, 2);
  assert.equal(getShopItem("bald").price, 20);
  assert.equal(getShopItem("curly").minLevel, 3);
  assert.equal(getShopItem("curly").price, 30);
  assert.equal(getShopItem("braided"), null);
  assert.equal(getShopItem("royal-hair"), null);
  assert.equal(getShopItem("wink"), null);
  assert.equal(getShopItem("sunglasses")?.type, "hat");
  assert.equal(getShopItem("evil"), null);
  assert.equal(getShopItem("story-keeper")?.name, "Warrior");
  assert.equal(getShopItem("scholar-virtuoso")?.name, "Star");
});

test("shop item names use simple English for 7P and 8P pupils", () => {
  const names = {
    "gold-crown": "King's Crown",
    "explorer-cap": "Goggles",
    "wizard-hat": "Wizard Hat",
    "steel-helm": "Helmet",
    "classy-hat": "Classy Hat",
    short: "Short Hair",
    long: "Long Hair",
    bald: "Bald",
    curly: "Braid",
    "custom-bespoke": "Custom Item"
  };

  for (const [id, name] of Object.entries(names)) {
    assert.equal(getShopItem(id)?.name, name);
  }

  for (const removedId of [
    "shadow-hood", "winged-circlet", "star-cowl", "grand-archmage", "realm-sovereign",
    "astral-scepter", "wisdom-relic", "ponytail", "flowing", "celestial-hair", "monk-cut", "spiky", "buzz-cut", "grin",
    "smile", "wink", "cool", "evil", "star-eyes", "transcendent",
    "braided", "royal-hair",
    "star-shield", "lore-lantern", "spell-grimoire", "dual-daggers", "pencil-sword", "word-wand", "swords-and-shield",
    "golden-skin", "red-skin", "green-skin", "blue-skin"
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
  for (const cat of ["outfit", "hat", "title"]) {
    const items = getShopItems(cat);
    assert.ok(items.length > 0);
    assert.ok(items.some((item) => item.minLevel >= 6));
  }
  // Faces are withdrawn; Items only keeps the empty-hands state; hair and
  // skin tones stop at the first unlocks. None of them carries a level-6 item.
  assert.deepEqual(getShopItems("weapon").map((item) => item.id), ["no-weapon"]);
  assert.deepEqual(getShopItems("hair").map((item) => item.id), ["short", "long", "bald", "curly"]);
  assert.equal(getShopItems("tone").length, 5);
});

test("items and titles follow their intended progression", () => {
  assert.deepEqual(getShopItems("weapon").map((item) => item.id), ["no-weapon"]);
  assert.deepEqual(
    getShopItems("outfit").map((item) => item.id),
    ["starter", "vocab-ranger", "grammar-mage", "story-keeper", "honor-knight"]
  );
  assert.deepEqual(
    getShopItems("title").map((item) => item.name),
    ["Rookie", "Pupil", "Explorer", "Star", "Champion", "Leader", "King", "Master", "Legend"]
  );
});

test("tattoo and golden skins are withdrawn with the paused cosmetics", () => {
  for (const itemId of ["tattooed-skin", "yakuza-tattoos", "golden-skin"]) {
    assert.equal(getShopItem(itemId), null);
  }
  assert.deepEqual(getShopItems("tone").map((item) => item.id), ["light", "medium", "tan", "brown", "dark"]);
});

test("hair colors unlock at the requested levels and keep the haircut through purchases and saves", () => {
  for (const [itemId, minLevel, price] of [
    ["blond-hair", 3, 30], ["black-hair", 3, 30], ["white-hair", 3, 30],
    ["red-hair", 5, 50], ["green-hair", 5, 50], ["blue-hair", 5, 50]
  ]) {
    let state = createInitialState();
    const pupilId = getCurrentClass(state).pupils[1].id;
    const item = getShopItem(itemId);
    assert.equal(item.type, "hairColor");
    assert.equal(item.minLevel, minLevel);
    assert.equal(item.price, price);
    state = awardMoney(state, [pupilId], price, "reward");
    for (let level = 1; level < minLevel - 1; level++) {
      state = awardXp(state, [pupilId], xpNeededForLevel(level), "level up");
    }
    assert.equal(purchaseItem(state, pupilId, itemId), state);
    state = updateCosmetics(state, pupilId, { hairColor: itemId });
    assert.equal(getPupilById(state, pupilId).hairColor, "brown-hair");
    state = awardXp(state, [pupilId], xpNeededForLevel(minLevel - 1), "level up");
    assert.equal(canBuyItem({ ...getPupilById(state, pupilId), money: price - 1 }, item), false);
    state = purchaseItem(state, pupilId, itemId);
    state = importState(JSON.stringify(state));
    const pupil = getPupilById(state, pupilId);
    assert.equal(pupil.hair, "long");
    assert.equal(pupil.hairColor, itemId);
    assert.equal(pupil.money, 0);
    assert.equal(isItemOwned(pupil, itemId), true);
    state = updateCosmetics(state, pupilId, { hairColor: "brown-hair", hair: "short" });
    state = updateCosmetics(state, pupilId, { hairColor: itemId });
    assert.equal(getPupilById(state, pupilId).hair, "short");
    assert.equal(getPupilById(state, pupilId).hairColor, itemId);
    assert.equal(getPupilById(state, pupilId).money, 0);
  }
});

test("old saves fall back from removed cosmetics and missing or invalid hair colors", () => {
  for (const gender of ["boy", "girl"]) {
    for (const [hair, skinTone] of [["monk-cut", "red-skin"], ["spiky", "green-skin"], ["buzz-cut", "blue-skin"]]) {
      const state = createInitialState();
      const pupil = getCurrentClass(state).pupils[0];
      Object.assign(pupil, { gender, hair, skinTone, face: "grin", ownedItems: [hair, skinTone, "grin"] });
      delete pupil.hairColor;
      const normalized = getPupilById(normalizeState(state), pupil.id);
      assert.equal(normalized.hair, gender === "girl" ? "long" : "short");
      assert.equal(normalized.face, "smile");
      assert.equal(normalized.skinTone, "light");
      assert.equal(normalized.hairColor, "brown-hair");
      assert.equal(isItemOwned(normalized, hair), false);
      assert.equal(isItemOwned(normalized, "grin"), false);
      assert.equal(isItemOwned(normalized, skinTone), false);
      assert.equal(isItemOwned(normalized, "brown-hair"), true);
      pupil.hairColor = "unknown-color";
      assert.equal(getPupilById(normalizeState(state), pupil.id).hairColor, "brown-hair");
    }
  }
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

test("clicking a pupil replaces the previous selection and clicking again clears it", () => {
  let state = createInitialState();
  const pupilId = getCurrentClass(state).pupils[0].id;
  state = toggleSelection(state, pupilId);
  assert.deepEqual(state.selectedPupilIds, [pupilId]);
  const second = getCurrentClass(state).pupils[1].id;
  state = toggleSelection(state, second);
  assert.deepEqual(state.selectedPupilIds, [second]);
  assert.equal(state.selectedPupilId, second);
  state = toggleSelection(state, second);
  assert.deepEqual(state.selectedPupilIds, []);
  assert.equal(state.selectedPupilId, null);
});

test("old multiple selections are reduced to the focused pupil on load", () => {
  const raw = createInitialState();
  const ids = getCurrentClass(raw).pupils.map(pupil=>pupil.id);
  raw.selectedPupilIds=ids;
  raw.selectedPupilId=ids[2];
  assert.deepEqual(normalizeState(raw).selectedPupilIds,[ids[2]]);
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

test("toggling the whole class selects every pupil, then clears on the second press", () => {
  let state = createInitialState();
  const ids = getCurrentClass(state).pupils.map((pupil) => pupil.id);
  state = toggleClassSelection(state, "7p");
  assert.deepEqual([...state.selectedPupilIds].sort(), [...ids].sort());
  state = toggleClassSelection(state, "7p");
  assert.deepEqual(state.selectedPupilIds, []);
  assert.equal(toggleClassSelection(state, "missing"), state);
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
          hat: "wizard-hat",
          skin: "grammar-mage",
          weapon: "pencil-sword",
          ownedItems: ["starter", "rookie", "no-hat", "no-weapon"]
        };
      })
    }))
  };
  const normalized = normalizeState(raw);
  const pupil = getPupilById(normalized, pupilId);
  assert.equal(pupil.hat, "wizard-hat");
  assert.equal(pupil.skin, "grammar-mage");
  assert.equal(pupil.weapon, "no-weapon");
  assert.equal(isItemOwned(pupil, "wizard-hat"), true);
  assert.equal(isItemOwned(pupil, "grammar-mage"), true);
});

test("a new class is appended, becomes active and starts empty", () => {
  const state = addClass(createInitialState(), "  9P  ");
  assert.equal(state.classes.length, 3);
  const created = state.classes.at(-1);
  assert.equal(created.name, "9P");
  assert.deepEqual(created.pupils, []);
  assert.equal(state.activeClassId, created.id);
  assert.equal(addClass(state, "   "), state);
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

test("rules are account data with three bilingual lists that survive a round trip", () => {
  const initial = createInitialState();
  assert.deepEqual(Object.keys(getRules(initial)).sort(), ["journey", "money", "xp"]);
  assert.ok(getRules(initial).journey.every((rule) => rule.fr && rule.en));

  let state = addRule(initial, "xp", { fr: "Range ton bureau.", en: "Tidy your desk." });
  assert.equal(getRules(state).xp.at(-1).en, "Tidy your desk.");
  state = setRule(state, "xp", 0, { fr: "Fais tes devoirs !", en: "" });
  assert.deepEqual(getRules(state).xp[0], { fr: "Fais tes devoirs !", en: "Fais tes devoirs !" });
  state = removeRule(state, "xp", 0);
  assert.equal(getRules(state).xp[0].en, "Learn your vocabulary.");

  // A reload keeps an edited empty list instead of restoring the defaults.
  state = removeRule(removeRule(state, "money", 1), "money", 1);
  state = removeRule(state, "money", 0);
  assert.deepEqual(normalizeState(state).rules.money, []);

  // Old accounts with no rules keep the current copy in both languages.
  const legacy = { ...createInitialState(), classes: createInitialState().classes };
  delete legacy.rules;
  const restored = getRules(normalizeState(legacy));
  assert.ok(restored.journey.length === 7 && restored.journey[0].fr.length > 0);
  assert.ok(restored.money[0].en.length > 0);
});
