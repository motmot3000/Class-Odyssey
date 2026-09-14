import { getShopItem } from './domain.mjs';
import { modeledItemIds, pupilLook, HAIR_PALETTE, CATALOGUE_REVISION, PORTRAIT_REVISION } from './items-3d-model.mjs';
import { escapeHtml, icon } from './ui.mjs';
import { t, tItem } from './i18n.mjs';
import { cachedHeroPortrait } from './portrait-runtime.mjs';

const modeled = new Set(modeledItemIds());
const root = new URL('../assets/items-3d/previews/', import.meta.url);
export const isModeledItem = item => Boolean(item && modeled.has(item.id));

export function previewAsset(path) {
  const revision = path.startsWith('portraits/') ? PORTRAIT_REVISION : CATALOGUE_REVISION;
  return new URL(`${path}?v=${revision}`, root).href;
}

export function renderHeroPortrait(pupil, { className = 'hero-fig', alt = '', large = false, dynamic = true } = {}) {
  const look = pupilLook(pupil);
  const cached = dynamic && cachedHeroPortrait(look);
  return `<img class="${escapeHtml(className)}" ${dynamic ? 'data-hero-portrait' : ''} ${cached ? 'data-portrait-ready="true"' : ''} data-look='${escapeHtml(JSON.stringify(look))}' src="${cached || previewAsset(`portraits/${look.persona}.webp`)}" alt="${escapeHtml(alt)}" width="256" height="384" loading="${large ? 'eager' : 'lazy'}" decoding="async" />`;
}

export function renderEquippedCharacter(pupil, options = {}) {
  return renderHeroPortrait(pupil, { className: 'avatar avatar-base3d', alt: portraitLabel(pupil), ...options });
}

export function renderItemThumbnail(item, { className = 'item-thumbnail' } = {}) {
  if (isModeledItem(item)) {
    return `<img class="${escapeHtml(className)}" data-item-thumbnail="${escapeHtml(item.id)}" src="${previewAsset(`items/${item.id}.webp`)}" alt="" width="320" height="320" loading="lazy" decoding="async" />`;
  }
  if (item.type === 'title') return `<span class="title-chip title-${escapeHtml(item.id)}">${escapeHtml(tItem(item, 'name'))}</span>`;
  const canonical = getShopItem(item.id);
  const color = item.type === 'hairColor' ? HAIR_PALETTE[item.id] : item.type === 'tone' ? canonical?.color : null;
  if (color && /^#[\da-f]{6}$/i.test(color)) return `<span class="cosmetic-swatch" style="--swatch:${color}" aria-hidden="true"></span>`;
  const symbol = item.type === 'bespoke' ? 'palette' : item.type === 'face' ? 'spark' : 'close';
  return `<span class="empty-slot-preview" aria-hidden="true">${icon(symbol)}</span>`;
}

export function portraitLabel(pupil) {
  return t('view.character', { name: pupil.name });
}
