import { getShopItem, getShopItems } from './domain.mjs';

export const CATEGORIES = [
  { type: 'outfit', field: 'skin', label: 'Outfits' },
  { type: 'hat', field: 'hat', label: 'Hats' },
  { type: 'hair', field: 'hair', label: 'Hair Cut' },
  { type: 'hairColor', field: 'hairColor', label: 'Hair Color' }
];
export const DEFAULT_LOOK = { persona: 'male', skin: 'vocab-ranger', hat: 'explorer-cap', weapon: 'no-weapon', hair: 'short', hairColor: 'brown-hair', tone: 'medium' };
export const HAIR_PALETTE = { 'brown-hair': '#594432', 'blond-hair': '#CBA75B', 'black-hair': '#252630', 'white-hair': '#E4DFD5', 'red-hair': '#A34A37', 'green-hair': '#4D785C', 'blue-hair': '#447CB0' };

/* One baked body serves every tone. The viewer multiplies the medium albedo
 * by the target tone so the live 3D matches the vector palette in avatar.mjs.
 * Values are the rendered skin base colours, not the raw delivery maps. */
export const SKIN_TONE_COLORS = {
  light: 0xf0c9a4, medium: 0xdfae7e, tan: 0xc68a55, brown: 0x9a6440, dark: 0x6b452f
};
export const SKIN_TONE_NEUTRAL = 'medium';
export const CATALOGUE_REVISION = 'catalogue-v8-scoped-cosmetics';
export const CATALOGUE_URL = new URL(`../assets/items-3d/catalogue.glb?v=${CATALOGUE_REVISION}`, import.meta.url).href;

/* Live base characters used by the game. These are the delivered, stylized
 * reference models (isolated stylized build): natural faces, delivered
 * silhouettes and their own painted materials. The baked production catalogue
 * above stays available for the standalone lab and for the pipeline tests. */
export const BASE_CATALOGUE_REVISION = 'stylized-v4';
export const BASE_CATALOGUE_URL = new URL(`../assets/character-stylized/catalogue.glb?v=${BASE_CATALOGUE_REVISION}`, import.meta.url).href;

/* Baked fallback portraits must match the live base, otherwise the old base
 * flashes on the cards before the live portrait replaces it. */
export const PORTRAIT_REVISION = `${BASE_CATALOGUE_REVISION}-front-hd`;

export function pupilLook(pupil, draft = null) {
  const value = (field, fallback) => draft?.[field] || pupil[field] || fallback;
  return {
    persona: pupil.gender === 'girl' ? 'female' : 'male',
    skin: value('skin', 'starter'), hat: value('hat', 'no-hat'),
    weapon: value('weapon', 'no-weapon'), hair: value('hair', pupil.gender === 'girl' ? 'long' : 'short'),
    hairColor: value('hairColor', 'brown-hair'), tone: value('skinTone', SKIN_TONE_NEUTRAL)
  };
}
export const PRESETS = {
  ranger: { skin: 'vocab-ranger', hat: 'explorer-cap' },
  mage: { skin: 'grammar-mage', hat: 'wizard-hat' },
  knight: { skin: 'honor-knight', hat: 'steel-helm' }
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
  if (getShopItem(params.get('tone'))?.type === 'tone') look.tone = params.get('tone');
  return look;
}

export function lookSummary(look) {
  return CATEGORIES.slice(0, 3).map(({ field }) => getShopItem(look[field])?.name).join(' · ');
}

export function modeledItemIds() {
  return CATEGORIES.filter(({ type }) => type !== 'hairColor').flatMap(({ type }) => getShopItems(type).filter(({ id }) => !['no-hat', 'no-weapon', 'bald'].includes(id)).map(({ id }) => id));
}
