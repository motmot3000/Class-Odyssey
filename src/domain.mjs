import { isStateDocument, isRecord } from "./state-schema.mjs";
import { defaultRules } from "./i18n.mjs";

export const STORAGE_KEY = "classquest:v1";
// Imported counters must remain renderable and exactly representable as numbers.
const MAX_HEARTS = 100;
const MAX_COUNTER = Number.MAX_SAFE_INTEGER;
export const RULE_SECTIONS = ["journey", "xp", "money"];
const MAX_RULE_LENGTH = 240;
const MAX_RULES_PER_SECTION = 30;

export const SKINS = [
  {
    id: "starter",
    name: "Scout",
    minLevel: 1,
    colors: ["#64d2ff", "#f7d65a", "#24233a"],
    reward: "Scout outfit",
    description: "Scout outfit with a scarf.",
    price: 0
  },
  {
    id: "vocab-ranger",
    name: "Ranger",
    minLevel: 2,
    colors: ["#1fbf92", "#f4c64e", "#1b2f3f"],
    reward: "Ranger outfit",
    description: "Green ranger cloak.",
    price: 20
  },
  {
    id: "grammar-mage",
    name: "Mage",
    minLevel: 3,
    colors: ["#8f6cff", "#ff7b92", "#241a3a"],
    reward: "Mage outfit",
    description: "Purple mage robe.",
    price: 35
  },
  {
    id: "story-keeper",
    name: "Warrior",
    minLevel: 4,
    colors: ["#ffb545", "#3f8cff", "#2d2638"],
    reward: "Warrior outfit",
    description: "Red armor with a cape.",
    price: 55
  },
  {
    id: "honor-knight",
    name: "Knight",
    minLevel: 6,
    colors: ["#33507e", "#e2bc70", "#152036"],
    reward: "Knight armor",
    description: "Blue knight armor.",
    price: 75
  }
];

export const TITLES = [
  { id: "rookie", name: "Rookie", minLevel: 1, price: 0, description: "The first step of the quest." },
  { id: "perfect-pupil", name: "Pupil", minLevel: 2, price: 20, description: "A good student badge." },
  { id: "pathfinder", name: "Explorer", minLevel: 3, price: 30, description: "For curious students." },
  { id: "scholar-virtuoso", name: "Star", minLevel: 4, price: 45, description: "A shining star in class." },
  { id: "realm-champion", name: "Champion", minLevel: 5, price: 55, description: "A true class champion." },
  { id: "grand-archon", name: "Leader", minLevel: 6, price: 65, description: "A great team leader." },
  { id: "paragon-sovereign", name: "King", minLevel: 7, price: 75, description: "The supreme royal title." },
  { id: "grammar-master", name: "Master", minLevel: 8, price: 85, description: "English language master." },
  { id: "class-legend", name: "Legend", minLevel: 10, price: 100, description: "The ultimate classroom legend." }
];

export const HATS = [
  { id: "no-hat", name: "No Hat", minLevel: 1, price: 0, description: "No hat on your head." },
  { id: "explorer-cap", name: "Goggles", minLevel: 1, price: 15, description: "Cool explorer goggles." },
  { id: "sunglasses", name: "Sunglasses", minLevel: 2, price: 25, description: "Black sunglasses." },
  { id: "feather-beret", name: "Beret", minLevel: 2, price: 20, description: "A smart green beret with a gold pin." },
  { id: "wizard-hat", name: "Wizard Hat", minLevel: 3, price: 30, description: "A tall pointed wizard hat." },
  { id: "gold-crown", name: "King's Crown", minLevel: 5, price: 55, description: "Shiny gold crown." },
  { id: "steel-helm", name: "Helmet", minLevel: 6, price: 65, description: "Horned steel knight helmet." },
  { id: "classy-hat", name: "Classy Hat", minLevel: 7, price: 75, description: "A refined black top hat." },
  { id: "celestial-crown", name: "Royal Crown", minLevel: 10, price: 100, description: "The greatest golden crown." }
];

/* The Items category (weapons, shields, books) is withdrawn. `no-weapon`
 * remains as the internal empty-hands state for saved pupils and exports; it is
 * never offered as a shop tab. */
export const WEAPONS = [
  { id: "no-weapon", name: "Empty Hands", minLevel: 1, price: 0, description: "Ready for adventure." }
];

/* Short and Long are the delivered cuts, free and shared by both characters:
 * a boy starts on Short, a girl on Long. The old sculpted Afro is withdrawn;
 * the previous delivered Short became the Spiky unlock. */
export const HAIRS = [
  { id: "short", name: "Short Hair", minLevel: 1, price: 0, description: "A classic short cut with a swept side fringe." },
  { id: "long", name: "Long Hair", minLevel: 1, price: 0, description: "Nice long hair." },
  { id: "medium-cut", name: "Medium Cut", minLevel: 3, price: 30, description: "A wavy medium-length cut with a side-swept fringe." },
  { id: "bald", name: "Bald", minLevel: 2, price: 20, description: "A clean fully shaved head." },
  { id: "curly", name: "Braid", minLevel: 3, price: 30, description: "A neat long braid with bangs." },
  { id: "spiky", name: "Spiky Hair", minLevel: 6, price: 50, description: "Bold short hair with visible spikes." },
  { id: "bun", name: "Bun", minLevel: 6, price: 50, description: "A twisted bun held by a gold pin, with a swept fringe." }
];

export const HAIR_COLORS = [
  { id: "brown-hair", name: "Brown", minLevel: 1, price: 0, description: "Classic brown hair." },
  { id: "blond-hair", name: "Blond", minLevel: 3, price: 30, description: "Warm golden-blond hair." },
  { id: "black-hair", name: "Black", minLevel: 3, price: 30, description: "Deep black hair." },
  { id: "white-hair", name: "White", minLevel: 3, price: 30, description: "Bright silver-white hair." },
  { id: "red-hair", name: "Red", minLevel: 5, price: 50, description: "Bold red hair." },
  { id: "green-hair", name: "Green", minLevel: 5, price: 50, description: "Enchanted green hair." },
  { id: "blue-hair", name: "Blue", minLevel: 5, price: 50, description: "Vivid blue hair." }
];

/* Eye colours tint the delivered iris at runtime, so no extra mesh ships for
 * them. Brown is the default every hero starts with. */
export const EYE_COLORS = [
  { id: "brown-eyes", name: "Brown", minLevel: 1, price: 0, color: "#6E4A2E", description: "Classic brown eyes." },
  { id: "green-eyes", name: "Green", minLevel: 3, price: 30, color: "#2F4C36", description: "Fresh green eyes." },
  { id: "blue-eyes", name: "Blue", minLevel: 4, price: 30, color: "#3B5E86", description: "Bright blue eyes." },
  { id: "red-eyes", name: "Red", minLevel: 6, price: 50, color: "#7E3A34", description: "Striking red eyes." },
  { id: "violet-eyes", name: "Violet", minLevel: 8, price: 50, color: "#63497F", description: "Mysterious violet eyes." }
];

/* Every hero has rounded human ears. The ear accessories replace them: the
 * delivered pointed elf ears, or human ears with a few gold piercings. */
export const ACCESSORIES = [
  { id: "no-accessory", name: "No Accessory", minLevel: 1, price: 0, description: "Natural human ears." },
  { id: "elf-ears", name: "Elf Ears", minLevel: 4, price: 30, description: "Long pointed elf ears." },
  { id: "pierced-ears", name: "Pierced Ears", minLevel: 5, price: 50, description: "Human ears with gold hoops and studs." }
];

export const PETS = [
  { id: "no-pet", name: "No Pet", minLevel: 1, price: 0, description: "Adventure without a companion." },
  { id: "meadow-rabbit", name: "Meadow Rabbit", minLevel: 1, price: 10, description: "A tiny, quiet cream rabbit with hazel eyes." },
  { id: "fripouille", name: "Fripouille", minLevel: 3, price: 40, description: "A curious ginger-and-white cat with a ranger scarf." },
  { id: "ranger-dog", name: "Ranger Dog", minLevel: 4, price: 50, description: "A loyal golden dog with a traveller scarf." },
  { id: "scarlet-parrot", name: "Scarlet Parrot", minLevel: 7, price: 50, description: "A bright scarlet macaw that rides on your shoulder." },
  { id: "starry-dragon", name: "Starry Dragon", minLevel: 9, price: 90, description: "A proud turquoise, coral and gold dragon with bright golden eyes." }
];

export const SKIN_TONES = [
  { id: "light", name: "Light Skin", color: "#ffd7b0", minLevel: 1, price: 0, description: "A natural light skin tone." },
  { id: "medium", name: "Medium Skin", color: "#f2c193", minLevel: 1, price: 0, description: "A natural medium skin tone." },
  { id: "tan", name: "Tan Skin", color: "#d9a06b", minLevel: 1, price: 0, description: "A natural tan skin tone." },
  { id: "brown", name: "Brown Skin", color: "#b07a4f", minLevel: 1, price: 0, description: "A natural brown skin tone." },
  { id: "dark", name: "Dark Skin", color: "#7d4f33", minLevel: 1, price: 0, description: "A natural dark skin tone." }
];

export const SHOP_ITEMS = [
  ...SKINS.map((item) => ({ ...item, type: "outfit" })),
  ...HATS.map((item) => ({ ...item, type: "hat" })),
  ...WEAPONS.map((item) => ({ ...item, type: "weapon" })),
  ...HAIRS.map((item) => ({ ...item, type: "hair" })),
  ...HAIR_COLORS.map((item) => ({ ...item, type: "hairColor" })),
  ...EYE_COLORS.map((item) => ({ ...item, type: "eyeColor" })),
  ...ACCESSORIES.map((item) => ({ ...item, type: "accessory" })),
  ...PETS.map((item) => ({ ...item, type: "pet" })),
  ...TITLES.map((item) => ({ ...item, type: "title" })),
  ...SKIN_TONES.map((item) => ({ ...item, type: "tone" }))
];

const CLASS_NAMES = ["7P", "8P"];

// Maps the original class ids/names ("CP"/"VIP") to the renamed ones ("7P"/"8P").
const LEGACY_CLASS_MAP = { cp: "7p", vip: "8p", CP: "7P", VIP: "8P" };

/* Demo fixtures are opt-in at the call site; new accounts and damaged caches
   must never acquire fictional pupils as if they were saved classroom data. */
export function createInitialState({ samples = true } = {}) {
  const pupilsOf = (classId, names) => (samples ? samplePupils(classId, names) : []);

  return {
    revision: 0,
    activeClassId: samples ? "7p" : null,
    selectedPupilId: null,
    selectMode: false,
    selectedPupilIds: [],
    classes: samples ? [
      { id: "7p", name: "7P", pupils: pupilsOf("7p", [["Alex", "boy"], ["Mia", "girl"], ["Noah", "boy"], ["Lina", "girl"]]) },
      { id: "8p", name: "8P", pupils: pupilsOf("8p", [["Emma", "girl"], ["Leo", "boy"], ["Sara", "girl"], ["Niko", "boy"]]) }
    ] : [],
    rules: defaultRules(),
    events: []
  };
}

export function normalizeState(rawState) {
  if (!isStateDocument(rawState)) {
    return createInitialState({ samples: false });
  }

  const state = {
    ...rawState,
    revision: Number.isSafeInteger(rawState.revision) && rawState.revision >= 0 ? rawState.revision : 0,
    activeClassId: migrateClassValue(rawState.activeClassId) || rawState.classes[0]?.id || null,
    selectedPupilId: rawState.selectedPupilId || null,
    selectMode: Boolean(rawState.selectMode),
    selectedPupilIds: Array.isArray(rawState.selectedPupilIds) ? [...new Set(rawState.selectedPupilIds)] : [],
    classes: rawState.classes.map((classroom, index) => {
      const fallbackId = CLASS_NAMES[index]?.toLowerCase() || cryptoId();
      const fallbackName = CLASS_NAMES[index] || "Class";
      return {
        id: String(migrateClassValue(classroom.id) || fallbackId),
        name: String(migrateClassValue(classroom.name) || fallbackName),
        pupils: Array.isArray(classroom.pupils)
          ? classroom.pupils.map(normalizePupil)
          : []
      };
    }),
    events: Array.isArray(rawState.events)
      ? rawState.events
        .filter((event) => event && typeof event === "object")
        .map(normalizeEvent)
        .slice(0, 80)
      : []
  };

  state.rules = normalizeRules(rawState.rules);

  if (!getClassById(state, state.activeClassId)) {
    state.activeClassId = state.classes[0]?.id || null;
  }

  if (state.selectedPupilId && !getPupilById(state, state.selectedPupilId)) {
    state.selectedPupilId = null;
  }

  state.selectedPupilIds = state.selectedPupilIds.filter((id) => getPupilById(state, id));
  // Migrate earlier multi-selections to the last focused pupil, or the first
  // remaining selection. Whole-class rewards are an explicit UI scope.
  if (state.selectedPupilIds.length > 1) {
    const selected = state.selectedPupilIds.includes(state.selectedPupilId) ? state.selectedPupilId : state.selectedPupilIds[0];
    state.selectedPupilIds = [selected];
  }

  return state;
}

function migrateClassValue(value) {
  return Object.hasOwn(LEGACY_CLASS_MAP, value) ? LEGACY_CLASS_MAP[value] : value;
}

/* ---------- Classroom rules ----------
 * Rules are account data so each teacher adapts them and the server keeps one
 * copy per account. Each entry is a {fr, en} pair; an empty list is preserved,
 * while a missing list falls back to the current defaults.
 */

export function normalizeRules(rawRules) {
  const defaults = defaultRules();
  const source = isRecord(rawRules) ? rawRules : {};
  const rules = {};
  for (const section of RULE_SECTIONS) {
    rules[section] = Array.isArray(source[section])
      ? source[section].map(normalizeRule).filter(Boolean).slice(0, MAX_RULES_PER_SECTION)
      : defaults[section];
  }
  return rules;
}

export function getRules(state) {
  const rules = state?.rules;
  return rules && RULE_SECTIONS.every((section) => Array.isArray(rules[section]))
    ? rules
    : defaultRules();
}

export function addRule(state, section, text) {
  const rule = normalizeRule(text);
  if (!rule) return state;
  return updateRules(state, section, (list) => [...list, rule].slice(0, MAX_RULES_PER_SECTION));
}

export function setRule(state, section, index, text) {
  const rule = normalizeRule(text);
  if (!rule) return state;
  return updateRules(state, section, (list) => list.map((item, position) => (position === index ? rule : item)));
}

export function removeRule(state, section, index) {
  return updateRules(state, section, (list) => list.filter((_, position) => position !== index));
}

function updateRules(state, section, updater) {
  if (!RULE_SECTIONS.includes(section)) return state;
  const rules = getRules(state);
  const list = rules[section] || [];
  const next = updater(list);
  if (next === list) return state;
  return { ...state, rules: { ...rules, [section]: next } };
}

function normalizeRule(rule) {
  if (typeof rule === "string") {
    const text = rule.trim().slice(0, MAX_RULE_LENGTH);
    return text ? { fr: text, en: text } : null;
  }
  if (!isRecord(rule)) return null;
  const fr = String(rule.fr ?? rule.en ?? "").trim().slice(0, MAX_RULE_LENGTH);
  const en = String(rule.en ?? "").trim().slice(0, MAX_RULE_LENGTH);
  if (!fr && !en) return null;
  return { fr: fr || en, en: en || fr };
}

/* A new class starts empty and becomes the active one so its hero roster is
 * the obvious next workspace. Names are trimmed and capped for safety. */
export function addClass(state, name) {
  const trimmed = String(name || "").trim().slice(0, 60);
  if (!trimmed) return state;
  const id = cryptoId();
  return {
    ...state,
    activeClassId: id,
    selectedPupilId: null,
    selectedPupilIds: [],
    classes: [...state.classes, { id, name: trimmed, pupils: [] }]
  };
}

export function addPupil(state, classId, { name, gender, skinTone } = {}) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) return state;

  return updateClass(state, classId, (classroom) => ({
    ...classroom,
    pupils: [
      ...classroom.pupils,
      normalizePupil({
        id: cryptoId(),
        name: trimmedName,
        hp: 5,
        maxHp: 5,
        xp: 0,
        level: 1,
        skin: "starter",
        title: "rookie",
        gender,
        skinTone
      })
    ]
  }));
}

/* Selecting a class focuses its board and clears any cross-class selection. */
export function setActiveClass(state, classId) {
  if (!getClassById(state, classId)) return state;
  return {
    ...state,
    activeClassId: classId,
    selectedPupilId: null,
    selectMode: false,
    selectedPupilIds: []
  };
}

/* A brand-new classroom starts empty unless the teacher lists student names.
 * The new class becomes active so its roster is immediately ready to fill. */
export function createClass(state, { name, students = [] } = {}) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) return state;

  const classroom = { id: cryptoId(), name: trimmedName, pupils: [] };
  const next = setActiveClass({ ...state, classes: [...state.classes, classroom] }, classroom.id);
  return students.reduce((acc, studentName) => addPupil(acc, classroom.id, { name: studentName }), next);
}

export function removePupil(state, pupilId) {
  return {
    ...state,
    selectedPupilId: state.selectedPupilId === pupilId ? null : state.selectedPupilId,
    selectedPupilIds: state.selectedPupilIds.filter((id) => id !== pupilId),
    classes: state.classes.map((classroom) => ({
      ...classroom,
      pupils: classroom.pupils.filter((pupil) => pupil.id !== pupilId)
    }))
  };
}

export function renamePupil(state, pupilId, name) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) return state;

  return mapPupil(state, pupilId, (pupil) => ({
    ...pupil,
    name: trimmedName
  }));
}

export function restoreHpAll(state, classId) {
  return updateClass(state, classId, (classroom) => ({
    ...classroom,
    pupils: classroom.pupils.map((pupil) => ({ ...pupil, hp: pupil.maxHp }))
  }));
}

export function importState(jsonText) {
  let raw;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error("The file is not valid JSON.");
  }

  if (!isStateDocument(raw)) {
    throw new Error("This file is not a Class Odyssey backup.");
  }

  return normalizeState(raw);
}

export function awardXp(state, pupilIds, amount, reason = "XP") {
  const xpAmount = nonNegativeInteger(amount, 0);
  if (xpAmount <= 0 || pupilIds.length === 0) return state;

  const idSet = existingPupilIds(state, pupilIds);
  if (!idSet.size) return state;
  const nextState = {
    ...state,
    classes: state.classes.map((classroom) => ({
      ...classroom,
      pupils: classroom.pupils.map((pupil) =>
        idSet.has(pupil.id) ? applyXp(pupil, xpAmount) : pupil
      )
    }))
  };

  return appendEvent(nextState, {
    type: "xp",
    pupilIds: [...idSet],
    amount: xpAmount,
    reason
  });
}

export function changeHp(state, pupilId, delta) {
  const hpDelta = Number(delta);
  if (!Number.isFinite(hpDelta) || hpDelta === 0 || !getPupilById(state, pupilId)) return state;

  const nextState = mapPupil(state, pupilId, (pupil) => ({
    ...pupil,
    hp: clamp(pupil.hp + hpDelta, 0, pupil.maxHp)
  }));

  return appendEvent(nextState, {
    type: "hp",
    pupilIds: [pupilId],
    amount: hpDelta,
    reason: hpDelta > 0 ? "HP restored" : "HP lost"
  });
}

export function changeHpMany(state, pupilIds, delta) {
  const hpDelta = Number(delta);
  if (!Number.isFinite(hpDelta) || hpDelta === 0 || pupilIds.length === 0) return state;

  const idSet = existingPupilIds(state, pupilIds);
  if (!idSet.size) return state;
  const nextState = {
    ...state,
    classes: state.classes.map((classroom) => ({
      ...classroom,
      pupils: classroom.pupils.map((pupil) =>
        idSet.has(pupil.id) ? { ...pupil, hp: clamp(pupil.hp + hpDelta, 0, pupil.maxHp) } : pupil
      )
    }))
  };

  return appendEvent(nextState, {
    type: "hp",
    pupilIds: [...idSet],
    amount: hpDelta,
    reason: hpDelta > 0 ? "HP restored" : "HP lost"
  });
}

export function setSelectMode(state, enabled) {
  return {
    ...state,
    selectMode: Boolean(enabled),
    selectedPupilIds: enabled ? state.selectedPupilIds : [],
    selectedPupilId: enabled ? null : state.selectedPupilId
  };
}

export function toggleSelection(state, pupilId) {
  if (!getPupilById(state, pupilId)) return state;
  const deselect = state.selectedPupilIds.includes(pupilId);
  return { ...state, selectedPupilIds: deselect ? [] : [pupilId], selectedPupilId: deselect ? null : pupilId };
}

export function selectAllInClass(state, classId) {
  const classroom = getClassById(state, classId);
  if (!classroom) return state;
  return { ...state, selectedPupilIds: classroom.pupils.map((pupil) => pupil.id) };
}

// Whole-class selection is a reversible action: the first call selects every
// pupil of the active class, the second clears the selection.
export function toggleClassSelection(state, classId) {
  const classroom = getClassById(state, classId);
  if (!classroom) return state;
  const all = classroom.pupils.map((pupil) => pupil.id);
  const allSelected = all.length > 0 && all.every((id) => state.selectedPupilIds.includes(id));
  return { ...state, selectedPupilIds: allSelected ? [] : all, selectedPupilId: allSelected ? null : state.selectedPupilId };
}

export function clearSelection(state) {
  if (state.selectedPupilIds.length === 0) return state;
  return { ...state, selectedPupilIds: [] };
}

export function updateCosmetics(state, pupilId, changes) {
  if (!isRecord(changes)) return state;
  return mapPupil(state, pupilId, (pupil) => {
    const next = { ...pupil };
    let changed = false;
    for (const [type, itemId] of Object.entries(changes)) {
      const item = getShopItem(itemId);
      if (item?.type === type && type !== "bespoke" && isItemOwned(pupil, item.id) && next[cosmeticField(type)] !== item.id) {
        next[cosmeticField(type)] = item.id;
        changed = true;
      }
    }
    return changed ? next : pupil;
  });
}

export function awardMoney(state, pupilIds, amount, reason = "Money") {
  const moneyAmount = nonNegativeInteger(amount, 0);
  if (moneyAmount <= 0 || pupilIds.length === 0) return state;
  const idSet = existingPupilIds(state, pupilIds);
  if (!idSet.size) return state;
  const nextState = {
    ...state,
    classes: state.classes.map((classroom) => ({
      ...classroom,
      pupils: classroom.pupils.map((pupil) => (
        idSet.has(pupil.id) ? { ...pupil, money: Math.min(MAX_COUNTER, pupil.money + moneyAmount) } : pupil
      ))
    }))
  };
  return appendEvent(nextState, { type: "money", pupilIds: [...idSet], amount: Math.floor(moneyAmount), reason });
}

export function purchaseItem(state, pupilId, itemId, note = "") {
  const pupil = getPupilById(state, pupilId);
  const item = getShopItem(itemId);
  if (!pupil || !item || !canBuyItem(pupil, item)) return state;

  if (item.type === "bespoke") {
    const nextState = mapPupil(state, pupilId, (current) => {
      const customOrders = Array.isArray(current.customOrders) ? [...current.customOrders] : [];
      customOrders.push({
        id: cryptoId(),
        orderedAt: new Date().toISOString(),
        note: String(note || "").trim() || "Custom Item",
        cost: item.price
      });
      return {
        ...current,
        money: current.money - item.price,
        ownedItems: [...new Set([...current.ownedItems, item.id])],
        customOrders
      };
    });
    return appendEvent(nextState, {
      type: "bespoke_order",
      pupilIds: [pupilId],
      amount: -item.price,
      reason: note ? `Sur-mesure order: "${note}"` : "Sur-mesure item ordered"
    });
  }

  const nextState = mapPupil(state, pupilId, (current) => ({
    ...current,
    money: current.money - item.price,
    ownedItems: [...new Set([...current.ownedItems, item.id])],
    [cosmeticField(item.type)]: item.id
  }));
  return appendEvent(nextState, { type: "purchase", pupilIds: [pupilId], amount: -item.price, reason: `Bought ${item.name}` });
}

export function getShopItem(itemId) {
  return SHOP_ITEMS.find((item) => item.id === itemId) || null;
}

export function getShopItems(type) {
  return SHOP_ITEMS.filter((item) => item.type === type);
}

export function isItemOwned(pupil, itemId) {
  return pupil.ownedItems.includes(itemId);
}

export function canBuyItem(pupil, item) {
  if (item.type !== "bespoke" && isItemOwned(pupil, item.id)) return false;
  return pupil.level >= item.minLevel && pupil.money >= item.price;
}

export function getClassById(state, classId) {
  return state.classes.find((classroom) => classroom.id === classId) || null;
}

export function getPupilById(state, pupilId) {
  for (const classroom of state.classes) {
    const pupil = classroom.pupils.find((candidate) => candidate.id === pupilId);
    if (pupil) return pupil;
  }
  return null;
}

export function getCurrentClass(state) {
  return getClassById(state, state.activeClassId) || state.classes[0];
}

export function xpNeededForLevel(level) {
  return 1000 + Math.max(0, level - 1) * 500;
}

export function xpProgress(pupil) {
  const needed = xpNeededForLevel(pupil.level);
  return {
    current: pupil.xp,
    needed,
    percent: Math.min(100, Math.round((pupil.xp / needed) * 100))
  };
}

export function getUnlockedSkins(level) {
  return SKINS.filter((skin) => skin.minLevel <= level);
}

export function getUnlockedTitles(level) {
  return TITLES.filter((title) => title.minLevel <= level);
}

export function getRewardsForLevel(level) {
  const rewards = SHOP_ITEMS.filter((item) => item.minLevel === level).map((item) =>
    item.type === "title" ? `${item.name} title` : item.type === "hairColor" ? `${item.name} hair color` : item.type === "eyeColor" ? `${item.name} eye color` : item.name
  );
  if (level > 1) rewards.push("HP restored");
  return rewards;
}

export function getRewardsBetween(previousLevel, nextLevel) {
  if (nextLevel <= previousLevel) return [];
  // Only catalogue milestones matter; do not walk thousands of empty levels.
  const levels = [...new Set(SHOP_ITEMS.map(item => item.minLevel))]
    .filter(level => level > previousLevel && level <= nextLevel)
    .sort((a, b) => a - b);
  return [...new Set([...levels.flatMap(getRewardsForLevel), ...(nextLevel > 1 ? ["HP restored"] : [])])];
}

export function getNextReward(level) {
  const upcomingLevels = SHOP_ITEMS.map((item) => item.minLevel).filter((minLevel) => minLevel > level);
  if (!upcomingLevels.length) return null;
  const nextLevel = Math.min(...upcomingLevels);
  return { level: nextLevel, rewards: getRewardsForLevel(nextLevel) };
}

export function isEliminated(pupil) {
  return pupil.hp <= 0;
}

const SAMPLE_TONES = ["light", "medium", "tan", "brown", "dark"];

function samplePupils(prefix, entries) {
  return entries.map(([name, gender], index) =>
    normalizePupil({
      id: `${prefix}-${index + 1}`,
      name,
      hp: 5,
      maxHp: 5,
      xp: index * 120,
      level: 1,
      skin: "starter",
      title: "rookie",
      gender,
      skinTone: SAMPLE_TONES[index % SAMPLE_TONES.length]
    })
  );
}

function normalizePupil(pupil) {
  const level = Math.max(1, nonNegativeInteger(pupil.level, 1));
  const maxHp = Math.min(MAX_HEARTS, Math.max(1, nonNegativeInteger(pupil.maxHp, 5)));
  const skin = SKINS.some((item) => item.id === pupil.skin) ? pupil.skin : "starter";
  const title = TITLES.some((item) => item.id === pupil.title) ? pupil.title : "rookie";
  const hat = HATS.some((item) => item.id === pupil.hat) ? pupil.hat : "no-hat";
  const weapon = WEAPONS.some((item) => item.id === pupil.weapon) ? pupil.weapon : "no-weapon";
  const gender = pupil.gender === "girl" ? "girl" : "boy";
  const skinTone = SKIN_TONES.some((tone) => tone.id === pupil.skinTone) ? pupil.skinTone : "light";
  const defaultHair = gender === "girl" ? "long" : "short";
  const hair = HAIRS.some((item) => item.id === pupil.hair) ? pupil.hair : defaultHair;
  const hairColor = HAIR_COLORS.some((item) => item.id === pupil.hairColor) ? pupil.hairColor : "brown-hair";
  const eyeColor = EYE_COLORS.some((item) => item.id === pupil.eyeColor) ? pupil.eyeColor : "brown-eyes";
  const accessory = ACCESSORIES.some((item) => item.id === pupil.accessory) ? pupil.accessory : "no-accessory";
  const pet = PETS.some((item) => item.id === pupil.pet) ? pupil.pet : "no-pet";
  const starterItems = SHOP_ITEMS.filter((item) => item.price === 0).map((item) => item.id);
  const ownedItems = [...new Set([
    ...starterItems,
    skin,
    title,
    hat,
    weapon,
    hair,
    hairColor,
    eyeColor,
    accessory,
    pet,
    skinTone,
    ...(Array.isArray(pupil.ownedItems) ? pupil.ownedItems.filter((id) => getShopItem(id)) : [])
  ])];
  const customOrders = Array.isArray(pupil.customOrders)
    ? pupil.customOrders
      .filter((order) => order && typeof order === "object")
      .map((order) => ({
        id: String(order.id || cryptoId()),
        orderedAt: Number.isNaN(Date.parse(order.orderedAt)) ? new Date().toISOString() : order.orderedAt,
        note: String(order.note || "Custom Item").trim() || "Custom Item",
        cost: nonNegativeInteger(order.cost, 100)
      }))
    : [];
  return {
    id: String(pupil.id || cryptoId()),
    name: String(pupil.name || "New hero").trim() || "New hero",
    hp: clamp(nonNegativeInteger(pupil.hp, maxHp), 0, maxHp),
    maxHp,
    xp: nonNegativeInteger(pupil.xp, 0),
    level,
    money: nonNegativeInteger(pupil.money ?? pupil.coins, 0),
    ownedItems,
    customOrders,
    skin,
    title,
    hat: ownedItems.includes(hat) ? hat : "no-hat",
    weapon: ownedItems.includes(weapon) ? weapon : "no-weapon",
    gender,
    skinTone: ownedItems.includes(skinTone) ? skinTone : "light",
    face: "smile",
    hair: ownedItems.includes(hair) ? hair : defaultHair,
    hairColor: ownedItems.includes(hairColor) ? hairColor : "brown-hair",
    eyeColor: ownedItems.includes(eyeColor) ? eyeColor : "brown-eyes",
    accessory: ownedItems.includes(accessory) ? accessory : "no-accessory",
    pet: ownedItems.includes(pet) ? pet : "no-pet",
    lastLevelUpAt: pupil.lastLevelUpAt || null
  };
}

function applyXp(pupil, amount) {
  const total = Math.min(MAX_COUNTER, pupil.xp + amount);
  // Costs form an arithmetic series. Binary search avoids a potentially huge
  // per-level loop for imported counters or large teacher awards.
  const cost = count => count * xpNeededForLevel(pupil.level) + 250 * count * (count - 1);
  let low = 0;
  let high = Math.floor(total / xpNeededForLevel(pupil.level)) + 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (cost(mid) <= total) low = mid;
    else high = mid;
  }
  const xp = total - cost(low);
  const level = pupil.level + low;
  const didLevelUp = low > 0;

  return {
    ...pupil,
    xp,
    level,
    hp: didLevelUp ? pupil.maxHp : pupil.hp,
    lastLevelUpAt: didLevelUp ? new Date().toISOString() : pupil.lastLevelUpAt
  };
}

// Inventory category names differ from two persisted field names.
export function cosmeticField(type) {
  if (type === "outfit") return "skin";
  if (type === "tone") return "skinTone";
  return type;
}

function updateClass(state, classId, updater) {
  if (!getClassById(state, classId)) return state;
  return {
    ...state,
    classes: state.classes.map((classroom) =>
      classroom.id === classId ? updater(classroom) : classroom
    )
  };
}

function mapPupil(state, pupilId, updater) {
  let changed = false;
  const classes = state.classes.map(classroom => {
    let classChanged = false;
    const pupils = classroom.pupils.map(pupil => {
      const next = pupil.id === pupilId ? updater(pupil) : pupil;
      if (next !== pupil) classChanged = changed = true;
      return next;
    });
    return classChanged ? { ...classroom, pupils } : classroom;
  });
  return changed ? { ...state, classes } : state;
}

function existingPupilIds(state, ids) {
  return new Set(ids.filter(id => getPupilById(state, id)));
}

function appendEvent(state, event) {
  return {
    ...state,
    events: [
      {
        id: cryptoId(),
        at: new Date().toISOString(),
        ...event
      },
      ...state.events
    ].slice(0, 80)
  };
}

function normalizeEvent(event) {
  const amount = Number(event.amount);
  return {
    id: String(event.id || cryptoId()),
    at: Number.isNaN(Date.parse(event.at)) ? new Date().toISOString() : String(event.at),
    type: String(event.type || "event"),
    pupilIds: Array.isArray(event.pupilIds) ? event.pupilIds.map(String) : [],
    amount: Number.isFinite(amount) ? amount : 0,
    reason: String(event.reason || "Activity")
  };
}

function nonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed <= MAX_COUNTER ? Math.max(0, Math.floor(parsed)) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cryptoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
