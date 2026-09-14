/* Legacy base-character markup and dialog asset selection. Active equipped
 * portraits use equipment-previews.mjs / portrait-runtime.mjs.
 */
import { escapeHtml } from "./ui.mjs";
import { t } from "./i18n.mjs";

const ROOT = new URL("../assets/characters-base/", import.meta.url);
export const BASE_CHARACTER_TONES = ["light", "medium", "tan", "brown", "dark"];
const TONES = new Set(BASE_CHARACTER_TONES);

export function characterAppearance(pupil = {}) {
  return {
    gender: pupil.gender === "girl" ? "girl" : "boy",
    tone: TONES.has(pupil.skinTone) ? pupil.skinTone : "light"
  };
}

export function characterAssets(pupil = {}) {
  const { gender, tone } = characterAppearance(pupil);
  const stem = `${gender}-${tone}`;
  return {
    gender,
    tone,
    model: new URL(`${stem}.glb`, ROOT).href,
    portrait: new URL(`${stem}.webp`, ROOT).href,
    thumbnail: new URL(`${stem}-small.webp`, ROOT).href
  };
}

export function renderBaseCharacter(pupil, { large = false } = {}) {
  const assets = characterAssets(pupil);
  return `<img class="avatar avatar-base3d" data-character-gender="${assets.gender}" data-character-tone="${assets.tone}" src="${escapeHtml(large ? assets.portrait : assets.thumbnail)}" srcset="${escapeHtml(assets.thumbnail)} 256w, ${escapeHtml(assets.portrait)} 512w" sizes="${large ? "(max-width: 700px) 75vw, 340px" : "180px"}" width="512" height="896" alt="${escapeHtml(t("view.character", { name: pupil?.name || t("sheikah.myHero") }))}" loading="${large ? "eager" : "lazy"}" decoding="async" />`;
}

export function baseStageAttributes() {
  return 'data-outfit="starter" data-gear="no-weapon" data-character-stage="base-v2"';
}

export function renderBaseCharacterViewer(pupil) {
  const assets = characterAssets(pupil);
  return `<div class="base-character-viewer" data-base-character-viewer data-model-url="${escapeHtml(assets.model)}" data-character-name="${escapeHtml(pupil.name)}">
    <div class="base-character-canvas" role="img" aria-label="${escapeHtml(t("view.label", { name: pupil.name, view: t("view.quarter") }))}">
      ${renderBaseCharacter(pupil, { large: true })}
    </div>
    <p class="base-character-status" role="status" aria-live="polite">${t("view.loading")}</p>
    <button type="button" class="btn btn-sm base-character-retry" data-character-retry hidden>${t("view.retry")}</button>
    <div class="base-character-controls" role="group" aria-label="${t("view.controls")}">
      <button type="button" data-character-angle="front" aria-pressed="false" disabled>${t("view.front")}</button>
      <button type="button" data-character-angle="quarter" aria-pressed="true" disabled>${t("view.quarter")}</button>
      <button type="button" data-character-angle="back" aria-pressed="false" disabled>${t("view.back")}</button>
      <button type="button" data-character-angle="face" aria-pressed="false" disabled>${t("view.face")}</button>
    </div>
  </div>`;
}
