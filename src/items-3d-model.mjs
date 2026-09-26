import { getShopItem, getShopItems } from './domain.mjs';

export const CATEGORIES = [
  { type: 'outfit', field: 'skin', label: 'Outfits' },
  { type: 'hat', field: 'hat', label: 'Hats' },
  { type: 'hair', field: 'hair', label: 'Hair Cut' },
  { type: 'hairColor', field: 'hairColor', label: 'Hair Color' },
  { type: 'eyeColor', field: 'eyeColor', label: 'Eye Color' }
];
export const DEFAULT_LOOK = { persona: 'male', skin: 'vocab-ranger', hat: 'explorer-cap', weapon: 'no-weapon', hair: 'short', hairColor: 'brown-hair', eyeColor: 'brown-eyes', tone: 'medium' };
export const HAIR_PALETTE = { 'brown-hair': '#594432', 'blond-hair': '#CBA75B', 'black-hair': '#252630', 'white-hair': '#E4DFD5', 'red-hair': '#A34A37', 'green-hair': '#4D785C', 'blue-hair': '#447CB0' };
export const EYE_PALETTE = { 'brown-eyes': '#6E4A2E', 'green-eyes': '#2F4C36', 'blue-eyes': '#3B5E86', 'red-eyes': '#7E3A34', 'violet-eyes': '#63497F' };

/* One baked body serves every tone. The viewer multiplies the medium albedo
 * by the target tone so the live 3D matches the vector palette in avatar.mjs.
 * Values are the rendered skin base colours, not the raw delivery maps. */
export const SKIN_TONE_COLORS = {
  light: 0xf0c9a4, medium: 0xdfae7e, tan: 0xc68a55, brown: 0x9a6440, dark: 0x6b452f
};
export const SKIN_TONE_NEUTRAL = 'medium';
/* Asset paths resolve against the PAGE, never against this module. The 3D
 * workshop ships as a bundle under /assets/items-3d/web, where a module-relative
 * URL would point inside the bundle folder and the deployed avatars would 404. */
const ASSET_BASE = typeof document === 'undefined' || !document.baseURI
  ? new URL('../assets/', import.meta.url)
  : new URL('../assets/', document.baseURI);
export const CATALOGUE_REVISION = 'catalogue-v9-shared-hair';
export const CATALOGUE_URL = new URL(`items-3d/catalogue.glb?v=${CATALOGUE_REVISION}`, ASSET_BASE).href;

/* Live base characters used by the game and by the 3D workshop. These are the
 * delivered, stylized reference models (isolated stylized build): natural faces,
 * delivered silhouettes and their own painted materials. The older baked
 * production catalogue (CATALOGUE_URL) stays only for the pipeline tests. */
export const BASE_CATALOGUE_REVISION = 'stylized-v5';
export const BASE_CATALOGUE_URL = new URL(`character-stylized/catalogue.glb?v=${BASE_CATALOGUE_REVISION}`, ASSET_BASE).href;
/* The workshop's loading poster must show the delivered base, not the older
 * baked Blender preview, and must carry the revision so a refresh never shows
 * a character cached from an earlier build. */
export const BASE_PREVIEW_URL = new URL(`character-stylized/preview.png?v=${BASE_CATALOGUE_REVISION}`, ASSET_BASE).href;

/* Baked fallback portraits must match the live base, otherwise the old base
 * flashes on the cards before the live portrait replaces it. */
export const PORTRAIT_REVISION = `${BASE_CATALOGUE_REVISION}-front-hd`;

export function pupilLook(pupil, draft = null) {
  const value = (field, fallback) => draft?.[field] || pupil[field] || fallback;
  return {
    persona: pupil.gender === 'girl' ? 'female' : 'male',
    skin: value('skin', 'starter'), hat: value('hat', 'no-hat'),
    weapon: value('weapon', 'no-weapon'), hair: value('hair', pupil.gender === 'girl' ? 'long' : 'short'),
    hairColor: value('hairColor', 'brown-hair'), eyeColor: value('eyeColor', 'brown-eyes'),
    tone: value('skinTone', SKIN_TONE_NEUTRAL)
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
  return CATEGORIES.filter(({ type }) => !['hairColor', 'eyeColor'].includes(type)).flatMap(({ type }) => getShopItems(type).filter(({ id }) => !['no-hat', 'no-weapon', 'bald'].includes(id)).map(({ id }) => id));
}
