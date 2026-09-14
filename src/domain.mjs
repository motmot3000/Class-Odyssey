import { isStateDocument, isRecord } from "./state-schema.mjs";

export const STORAGE_KEY = "classquest:v1";
// Imported counters must remain renderable and exactly representable as numbers.
const MAX_HEARTS = 100;
const MAX_COUNTER = Number.MAX_SAFE_INTEGER;

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
  },
  {
    id: "grand-archmage",
    name: "Archmage",
    minLevel: 8,
    colors: ["#573566", "#7fc7d9", "#25142b"],
    reward: "Archmage robes",
    description: "Magic archmage coat.",
    price: 90
  },
  {
    id: "realm-sovereign",
    name: "King",
    minLevel: 10,
    colors: ["#8e3230", "#e2bc70", "#211b16"],
    reward: "King outfit",
    description: "Royal king outfit.",
    price: 100
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

export const WEAPONS = [
  { id: "no-weapon", name: "Empty Hands", minLevel: 1, price: 0, description: "Ready for adventure." },
  { id: "star-shield", name: "Shield", minLevel: 2, price: 20, description: "A blue shield with a star." },
  { id: "lore-lantern", name: "Lantern", minLevel: 3, price: 30, description: "A bright yellow lantern." },
  { id: "spell-grimoire", name: "Magic Book", minLevel: 4, price: 45, description: "An ancient magic spellbook." },
  { id: "dual-daggers", name: "Daggers", minLevel: 5, price: 55, description: "Two fast silver daggers." },
  { id: "pencil-sword", name: "Sword", minLevel: 6, price: 65, description: "A fierce pointed steel sword." },
  { id: "word-wand", name: "Wand", minLevel: 8, price: 85, description: "A powerful glowing magic wand." },
  { id: "swords-and-shield", name: "Swords & Shield", minLevel: 10, price: 100, description: "A legendary pair of swords and royal shield." }
];

export const FACES = [
  { id: "smile", name: "Smile", minLevel: 1, price: 0, description: "A happy smile." },
  { id: "wink", name: "Wink", minLevel: 2, price: 20, description: "A clever wink." },
  { id: "cool", name: "Cool", minLevel: 3, price: 30, description: "A determined cool face." },
  { id: "evil", name: "Evil Face", minLevel: 6, price: 55, description: "Small red demon eyes and a sly smile." },
  { id: "star-eyes", name: "Star Eyes", minLevel: 8, price: 70, description: "Eyes shining like bright stars." },
  { id: "transcendent", name: "God Face", minLevel: 10, price: 100, description: "Divine golden eyes and celestial marks." }
];

export const HAIRS = [
  { id: "short", name: "Short Hair", minLevel: 1, price: 0, description: "Classic short haircut." },
  { id: "long", name: "Long Hair", minLevel: 1, price: 0, description: "Nice long hair." },
  { id: "bald", name: "Bald", minLevel: 1, price: 10, description: "A clean fully shaved head." },
  { id: "curly", name: "Afro", minLevel: 2, price: 40, description: "A classic rounded afro." },
  { id: "braided", name: "Braids", minLevel: 6, price: 50, description: "Warrior braids." },
  { id: "royal-hair", name: "Royal Hair", minLevel: 10, price: 90, description: "Long curls with subtle royal jewels." }
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

export const BESPOKE_ITEMS = [
  {
    id: "custom-bespoke",
    name: "Custom Item",
    minLevel: 10,
    price: 100,
    type: "bespoke",
    reward: "Custom Item",
    description: "At level 10, create your own special item for 100 coins."
  }
];

export const SKIN_TONES = [
  { id: "light", name: "Light Skin", color: "#ffd7b0", minLevel: 1, price: 0, description: "A natural light skin tone." },
  { id: "medium", name: "Medium Skin", color: "#f2c193", minLevel: 1, price: 0, description: "A natural medium skin tone." },
  { id: "tan", name: "Tan Skin", color: "#d9a06b", minLevel: 1, price: 0, description: "A natural tan skin tone." },
  { id: "brown", name: "Brown Skin", color: "#b07a4f", minLevel: 1, price: 0, description: "A natural brown skin tone." },
  { id: "dark", name: "Dark Skin", color: "#7d4f33", minLevel: 1, price: 0, description: "A natural dark skin tone." },
  { id: "tattooed-skin", name: "Regular Tattoos", color: "#c68a55", minLevel: 5, price: 50, description: "Simple geometric tattoos." },
  { id: "yakuza-tattoos", name: "Yakuza Tattoos", color: "#c68a55", minLevel: 8, price: 80, description: "Detailed wave and blossom tattoos." },
  { id: "golden-skin", name: "Golden Skin", color: "#d8ad4a", minLevel: 10, price: 100, description: "Living gold skin decorated with diamonds." }
];

export const SHOP_ITEMS = [
  ...SKINS.map((item) => ({ ...item, type: "outfit" })),
  ...HATS.map((item) => ({ ...item, type: "hat" })),
  ...WEAPONS.map((item) => ({ ...item, type: "weapon" })),
  ...FACES.map((item) => ({ ...item, type: "face" })),
  ...HAIRS.map((item) => ({ ...item, type: "hair" })),
  ...HAIR_COLORS.map((item) => ({ ...item, type: "hairColor" })),
  ...TITLES.map((item) => ({ ...item, type: "title" })),
  ...SKIN_TONES.map((item) => ({ ...item, type: "tone" })),
  ...BESPOKE_ITEMS
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
    activeClassId: "7p",
    selectedPupilId: null,
    selectMode: false,
    selectedPupilIds: [],
    classes: [
      { id: "7p", name: "7P", pupils: pupilsOf("7p", [["Alex", "boy"], ["Mia", "girl"], ["Noah", "boy"], ["Lina", "girl"]]) },
      { id: "8p", name: "8P", pupils: pupilsOf("8p", [["Emma", "girl"], ["Leo", "boy"], ["Sara", "girl"], ["Niko", "boy"]]) }
    ],
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
    activeClassId: migrateClassValue(rawState.activeClassId) || rawState.classes[0]?.id || "7p",
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

  if (!getClassById(state, state.activeClassId)) {
    state.activeClassId = state.classes[0]?.id || "7p";
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

  if (Array.isArray(raw?.classes) && !raw.classes.length) throw new Error("No classes found in the file.");
  if (!isStateDocument(raw)) {
    throw new Error("This file is not a ClassQuest backup.");
  }

  const state = normalizeState(raw);
  if (!state.classes.length) {
    throw new Error("No classes found in the file.");
  }
  return state;
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
    item.type === "title" ? `${item.name} title` : item.type === "hairColor" ? `${item.name} hair color` : item.name
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
  const face = FACES.some((item) => item.id === pupil.face) ? pupil.face : "smile";
  const defaultHair = gender === "girl" ? "long" : "short";
  const hair = HAIRS.some((item) => item.id === pupil.hair) ? pupil.hair : defaultHair;
  const hairColor = HAIR_COLORS.some((item) => item.id === pupil.hairColor) ? pupil.hairColor : "brown-hair";
  const starterItems = SHOP_ITEMS.filter((item) => item.price === 0).map((item) => item.id);
  const ownedItems = [...new Set([
    ...starterItems,
    skin,
    title,
    hat,
    weapon,
    face,
    hair,
    hairColor,
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
    face: ownedItems.includes(face) ? face : "smile",
    hair: ownedItems.includes(hair) ? hair : defaultHair,
    hairColor: ownedItems.includes(hairColor) ? hairColor : "brown-hair",
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
