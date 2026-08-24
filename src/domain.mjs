export const STORAGE_KEY = "game-of-more:v1";

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
  { id: "grin", name: "Grin", minLevel: 1, price: 10, description: "A friendly grin." },
  { id: "wink", name: "Wink", minLevel: 2, price: 20, description: "A clever wink." },
  { id: "cool", name: "Cool", minLevel: 3, price: 30, description: "A determined cool face." },
  { id: "evil", name: "Evil Face", minLevel: 6, price: 55, description: "Small red demon eyes and a sly smile." },
  { id: "star-eyes", name: "Star Eyes", minLevel: 8, price: 70, description: "Eyes shining like bright stars." },
  { id: "transcendent", name: "God Face", minLevel: 10, price: 100, description: "Divine golden eyes and celestial marks." }
];

export const HAIRS = [
  { id: "short", name: "Short Hair", minLevel: 1, price: 0, description: "Classic short haircut." },
  { id: "long", name: "Long Hair", minLevel: 1, price: 0, description: "Nice long hair." },
  { id: "bald", name: "Bald", minLevel: 1, price: 0, description: "A clean fully shaved head." },
  { id: "buzz-cut", name: "Buzz Cut", minLevel: 2, price: 15, description: "A clean close-cropped haircut." },
  { id: "curly", name: "Afro", minLevel: 2, price: 20, description: "A classic rounded afro." },
  { id: "spiky", name: "Spiky Hair", minLevel: 3, price: 30, description: "Bold hair with sharp visible spikes." },
  { id: "monk-cut", name: "Monk Cut", minLevel: 4, price: 40, description: "A traditional monk tonsure." },
  { id: "braided", name: "Braids", minLevel: 6, price: 50, description: "Warrior braids." },
  { id: "royal-hair", name: "Royal Hair", minLevel: 10, price: 90, description: "Long curls with subtle royal jewels." }
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
  { id: "blue-skin", name: "Blue Skin", color: "#6096c7", minLevel: 3, price: 30, description: "Mystical sapphire-blue skin." },
  { id: "red-skin", name: "Red Skin", color: "#b65b57", minLevel: 4, price: 40, description: "Bold ruby-red skin." },
  { id: "green-skin", name: "Green Skin", color: "#638f68", minLevel: 5, price: 50, description: "Enchanted emerald-green skin." },
  { id: "tattooed-skin", name: "Tattoos", color: "#c68a55", minLevel: 8, price: 80, description: "Warrior skin marked with elegant tattoos." },
  { id: "golden-skin", name: "Golden Skin", color: "#d8ad4a", minLevel: 10, price: 100, description: "Living gold skin decorated with diamonds." }
];

export const SHOP_ITEMS = [
  ...SKINS.map((item) => ({ ...item, type: "outfit" })),
  ...HATS.map((item) => ({ ...item, type: "hat" })),
  ...WEAPONS.map((item) => ({ ...item, type: "weapon" })),
  ...FACES.map((item) => ({ ...item, type: "face" })),
  ...HAIRS.map((item) => ({ ...item, type: "hair" })),
  ...TITLES.map((item) => ({ ...item, type: "title" })),
  ...SKIN_TONES.map((item) => ({ ...item, type: "tone" })),
  ...BESPOKE_ITEMS
];

const CLASS_NAMES = ["7P", "8P"];

// Maps the original class ids/names ("CP"/"VIP") to the renamed ones ("7P"/"8P").
const LEGACY_CLASS_MAP = { cp: "7p", vip: "8p", CP: "7P", VIP: "8P" };

/* `samples` donne le plateau de démonstration, celui qui montre à quoi
   ressemble le jeu. Une classe qui vient d'être créée part vide : son
   enseignant tape de vrais prénoms, il n'a pas à effacer des faux. */
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
  if (!rawState || !Array.isArray(rawState.classes)) {
    return createInitialState();
  }

  const state = {
    ...rawState,
    revision: Number.isSafeInteger(rawState.revision) && rawState.revision >= 0 ? rawState.revision : 0,
    activeClassId: LEGACY_CLASS_MAP[rawState.activeClassId] || rawState.activeClassId || rawState.classes[0]?.id || "7p",
    selectedPupilId: rawState.selectedPupilId || null,
    selectMode: Boolean(rawState.selectMode),
    selectedPupilIds: Array.isArray(rawState.selectedPupilIds) ? [...new Set(rawState.selectedPupilIds)] : [],
    classes: rawState.classes.map((classroom, index) => {
      const fallbackId = CLASS_NAMES[index]?.toLowerCase() || cryptoId();
      const fallbackName = CLASS_NAMES[index] || "Class";
      return {
        id: LEGACY_CLASS_MAP[classroom.id] || classroom.id || fallbackId,
        name: LEGACY_CLASS_MAP[classroom.name] || classroom.name || fallbackName,
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

  return state;
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

  if (!raw || !Array.isArray(raw.classes)) {
    throw new Error("This file is not a Game of More backup.");
  }

  const state = normalizeState(raw);
  if (!state.classes.length) {
    throw new Error("No classes found in the file.");
  }
  return state;
}

export function awardXp(state, pupilIds, amount, reason = "XP") {
  const xpAmount = Number(amount);
  if (!Number.isFinite(xpAmount) || xpAmount <= 0 || pupilIds.length === 0) return state;

  const idSet = new Set(pupilIds);
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
  if (!Number.isFinite(hpDelta) || hpDelta === 0) return state;

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

  const idSet = new Set(pupilIds);
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
  const set = new Set(state.selectedPupilIds);
  if (set.has(pupilId)) set.delete(pupilId);
  else set.add(pupilId);
  return { ...state, selectedPupilIds: [...set] };
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
  return mapPupil(state, pupilId, (pupil) => {
    const next = { ...pupil };
    for (const [type, itemId] of Object.entries(changes)) {
      const item = getShopItem(itemId);
      if (item?.type === type && isItemOwned(pupil, item.id)) {
        next[cosmeticField(type)] = item.id;
      }
    }
    return next;
  });
}

export function awardMoney(state, pupilIds, amount, reason = "Money") {
  const moneyAmount = Number(amount);
  if (!Number.isFinite(moneyAmount) || moneyAmount <= 0 || pupilIds.length === 0) return state;
  const idSet = new Set(pupilIds);
  const nextState = {
    ...state,
    classes: state.classes.map((classroom) => ({
      ...classroom,
      pupils: classroom.pupils.map((pupil) => (
        idSet.has(pupil.id) ? { ...pupil, money: pupil.money + Math.floor(moneyAmount) } : pupil
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
    item.type === "title" ? `${item.name} title` : item.name
  );
  if (level > 1) rewards.push("HP restored");
  return rewards;
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
  const level = positiveInteger(pupil.level, 1);
  const maxHp = positiveInteger(pupil.maxHp, 5);
  const skin = SKINS.some((item) => item.id === pupil.skin) ? pupil.skin : "starter";
  const title = TITLES.some((item) => item.id === pupil.title) ? pupil.title : "rookie";
  const hat = HATS.some((item) => item.id === pupil.hat) ? pupil.hat : "no-hat";
  const weapon = WEAPONS.some((item) => item.id === pupil.weapon) ? pupil.weapon : "no-weapon";
  const gender = pupil.gender === "girl" ? "girl" : "boy";
  const skinTone = SKIN_TONES.some((tone) => tone.id === pupil.skinTone) ? pupil.skinTone : "light";
  const face = FACES.some((item) => item.id === pupil.face) ? pupil.face : "smile";
  const defaultHair = gender === "girl" ? "long" : "short";
  const hair = HAIRS.some((item) => item.id === pupil.hair) ? pupil.hair : defaultHair;
  const starterItems = SHOP_ITEMS.filter((item) => item.price === 0).map((item) => item.id);
  const ownedItems = [...new Set([
    ...starterItems,
    skin,
    title,
    hat,
    weapon,
    face,
    hair,
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
        cost: Math.max(0, positiveInteger(order.cost, 100))
      }))
    : [];
  return {
    id: pupil.id || cryptoId(),
    name: String(pupil.name || "New hero").trim() || "New hero",
    hp: clamp(positiveInteger(pupil.hp, maxHp), 0, maxHp),
    maxHp,
    xp: Math.max(0, positiveInteger(pupil.xp, 0)),
    level,
    money: Math.max(0, positiveInteger(pupil.money ?? pupil.coins, 0)),
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
    lastLevelUpAt: pupil.lastLevelUpAt || null
  };
}

function applyXp(pupil, amount) {
  let xp = pupil.xp + amount;
  let level = pupil.level;
  let didLevelUp = false;

  while (xp >= xpNeededForLevel(level)) {
    xp -= xpNeededForLevel(level);
    level += 1;
    didLevelUp = true;
  }

  return {
    ...pupil,
    xp,
    level,
    hp: didLevelUp ? pupil.maxHp : pupil.hp,
    lastLevelUpAt: didLevelUp ? new Date().toISOString() : pupil.lastLevelUpAt
  };
}

function cosmeticField(type) {
  if (type === "outfit") return "skin";
  if (type === "tone") return "skinTone";
  return type;
}

function updateClass(state, classId, updater) {
  return {
    ...state,
    classes: state.classes.map((classroom) =>
      classroom.id === classId ? updater(classroom) : classroom
    )
  };
}

function mapPupil(state, pupilId, updater) {
  return {
    ...state,
    classes: state.classes.map((classroom) => ({
      ...classroom,
      pupils: classroom.pupils.map((pupil) => (pupil.id === pupilId ? updater(pupil) : pupil))
    }))
  };
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

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cryptoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
