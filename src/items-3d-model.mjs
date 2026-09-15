import { getShopItem, getShopItems } from './domain.mjs';

export const CATEGORIES = [
  { type: 'outfit', field: 'skin', label: 'Outfits' },
  { type: 'hat', field: 'hat', label: 'Hats' },
  { type: 'weapon', field: 'weapon', label: 'Items' },
  { type: 'hair', field: 'hair', label: 'Hair Cut' },
  { type: 'hairColor', field: 'hairColor', label: 'Hair Color' }
];
export const DEFAULT_LOOK = { persona: 'male', skin: 'vocab-ranger', hat: 'explorer-cap', weapon: 'lore-lantern', hair: 'short', hairColor: 'brown-hair' };
export const HAIR_PALETTE = { 'brown-hair': '#594432', 'blond-hair': '#CBA75B', 'black-hair': '#252630', 'white-hair': '#E4DFD5', 'red-hair': '#A34A37', 'green-hair': '#4D785C', 'blue-hair': '#447CB0' };
export const CATALOGUE_REVISION = 'catalogue-v7-approved-bases';
export const PORTRAIT_REVISION = `${CATALOGUE_REVISION}-front-hd`;
export const CATALOGUE_URL = new URL(`../assets/items-3d/catalogue.glb?v=${CATALOGUE_REVISION}`, import.meta.url).href;

export function pupilLook(pupil, draft = null) {
  const value = (field, fallback) => draft?.[field] || pupil[field] || fallback;
  return {
    persona: pupil.gender === 'girl' ? 'female' : 'male',
    skin: value('skin', 'starter'), hat: value('hat', 'no-hat'),
    weapon: value('weapon', 'no-weapon'), hair: value('hair', pupil.gender === 'girl' ? 'long' : 'short'),
    hairColor: value('hairColor', 'brown-hair')
  };
}
export const PRESETS = {
  ranger: { skin: 'vocab-ranger', hat: 'explorer-cap', weapon: 'lore-lantern' },
  mage: { skin: 'grammar-mage', hat: 'wizard-hat', weapon: 'word-wand' },
  knight: { skin: 'honor-knight', hat: 'steel-helm', weapon: 'pencil-sword' },
  king: { skin: 'realm-sovereign', hat: 'celestial-crown', weapon: 'swords-and-shield' }
};
const COVERED_HATS = new Set(['feather-beret', 'wizard-hat', 'classy-hat']);
const OPEN_CROWNS = new Set(['gold-crown', 'celestial-crown']);

export function visiblePart(data, look, itemsOnly = false) {
  if (data.fit_persona && data.fit_persona !== look.persona) return false;
  const slot = data.shop_slot;
  if (!slot) return true;
  if (look.preview) {
    if (slot !== look.preview.slot || data.shop_id !== look.preview.id) return false;
    return slot !== 'hair' || !data.hat_fit || data.hat_fit === 'open';
  }
  if (slot === 'core') return !itemsOnly;
  if (slot === 'persona') return !itemsOnly && data.shop_id === look.persona;
  const category = CATEGORIES.find((entry) => entry.type === slot);
  if (!category || look[category.field] !== data.shop_id) return false;
  if (slot === 'hair') {
    if (look.hat === 'steel-helm') return false;
    const fit = COVERED_HATS.has(look.hat) ? 'covered' : OPEN_CROWNS.has(look.hat) ? 'crowned' : 'open';
    if (data.hat_fit && data.hat_fit !== fit) return false;
  }
  return true;
}

export function lookFromParams(params) {
  const look = { ...DEFAULT_LOOK };
  if (['male', 'female'].includes(params.get('persona'))) look.persona = params.get('persona');
  for (const category of CATEGORIES) {
    const value = params.get(category.field);
    if (getShopItem(value)?.type === category.type) look[category.field] = value;
  }
  return look;
}

export function lookSummary(look) {
  return CATEGORIES.slice(0, 3).map(({ field }) => getShopItem(look[field])?.name).join(' · ');
}

export function modeledItemIds() {
  return CATEGORIES.filter(({ type }) => type !== 'hairColor').flatMap(({ type }) => getShopItems(type).filter(({ id }) => !['no-hat', 'no-weapon', 'bald'].includes(id)).map(({ id }) => id));
}
