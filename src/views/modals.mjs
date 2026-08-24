/* ============================================================
   modals.mjs — les deux seules fenêtres de l'app
   `<dialog>` natif : piège de focus, Esc et fond inerte gratuits, donc
   rien à réinventer.
   ============================================================ */

import { canBuyItem, getNextReward, isItemOwned, xpProgress } from "../domain.mjs";
import { renderHero, renderItemArt } from "../avatar.mjs";
import {
  escapeHtml,
  getItemRarity,
  gearOf,
  heroStageAttributes,
  icon,
  renderHearts,
  renderCustomOrders,
  renderLevel,
  renderMoney,
  renderOutBadge,
  renderTitle,
  renderXpBar,
  statusClass
} from "../ui.mjs";

const TYPE_LABEL = {
  outfit: "Outfit",
  hat: "Hat",
  weapon: "Item",
  face: "Face",
  hair: "Hair",
  title: "Title",
  tone: "Skin",
  bespoke: "Custom"
};

/* Vue « plein tableau » d'un héros : lecture seule. On montre un élève à
   toute la classe sans risquer de modifier ses stats d'un doigt posé. */
export function renderPupilDialog(pupil) {
  const progress = xpProgress(pupil);
  const next = getNextReward(pupil.level);

  return `
    <dialog class="dialog dialog-hero ${statusClass(pupil)}" aria-label="${escapeHtml(pupil.name)}">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon("close")}</button>
      <div class="dialog-hero-art" ${heroStageAttributes(pupil)}>
        ${renderHero(pupil)}
        ${renderOutBadge(pupil)}
      </div>
      <div class="dialog-hero-facts">
        <header class="locker-name">
          <h2>${escapeHtml(pupil.name)}</h2>
          ${renderLevel(pupil.level)}
        </header>
        ${renderTitle(pupil)}
        ${renderHearts(pupil)}
        ${renderXpBar(pupil)}
        <p class="panel-note">${progress.needed - progress.current} XP to level ${pupil.level + 1}.</p>
        ${renderMoney(pupil.money)}
        <dl class="gear">
          ${gearOf(pupil).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
        </dl>
        ${renderCustomOrders(pupil)}
        <p class="panel-note">${next
          ? `Level ${next.level} unlocks ${next.rewards.map(escapeHtml).join(", ")}.`
          : "Every reward is unlocked."}</p>
      </div>
    </dialog>
  `;
}

export function renderItemDialog(item, pupil) {
  const field = item.type === "outfit" ? "skin" : item.type === "tone" ? "skinTone" : item.type;
  const bespoke = item.type === "bespoke";
  const equipped = !bespoke && pupil[field] === item.id;
  const owned = isItemOwned(pupil, item.id);
  const locked = pupil.level < item.minLevel;

  const status = bespoke
    ? locked
      ? `Unlocks at level ${item.minLevel}.`
      : canBuyItem(pupil, item)
        ? "Ready to order. Describe what should be created."
        : `Costs ${item.price} coins. You have ${pupil.money}.`
    : equipped
    ? "Worn right now."
    : owned
      ? "Owned. Equip it whenever you like."
      : locked
        ? `Unlocks at level ${item.minLevel}.`
        : `Costs ${item.price} coins. You have ${pupil.money}.`;

  const previewPupil = bespoke
    ? pupil
    : { ...pupil, [field]: item.id };
  const visual = bespoke
    ? renderItemArt(item)
    : `${renderHero(previewPupil)}${item.type === "title" ? `<span class="preview-title title-${item.id}">${escapeHtml(item.name)}</span>` : ""}`;

  return `
    <dialog class="dialog dialog-item" aria-label="${escapeHtml(item.name)}">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${icon("close")}</button>
      <div class="dialog-item-art ${bespoke ? "" : "is-hero-preview"}" ${bespoke ? "" : heroStageAttributes(previewPupil)}>${visual}</div>
      <h2>${escapeHtml(item.name)}</h2>
      <p class="panel-note item-meta"><span class="rarity-label rarity-${getItemRarity(item)}">${getItemRarity(item)}</span>${TYPE_LABEL[item.type] || "Item"} · level ${item.minLevel} · ${item.price ? `${item.price} coins` : "free"}</p>
      ${item.description ? `<p class="dialog-item-description">${escapeHtml(item.description)}</p>` : ""}
      <p class="dialog-status">${status}</p>
      ${bespoke && canBuyItem(pupil, item) ? `
        <form class="bespoke-order-form" data-action="order-bespoke">
          <input type="hidden" name="itemId" value="${escapeHtml(item.id)}" />
          <label class="field">
            <span>Describe your custom item</span>
            <textarea name="note" rows="4" required maxlength="500" placeholder="Shape, colors, powers..."></textarea>
          </label>
          <button class="btn btn-primary" type="submit">Order for ${item.price} coins</button>
        </form>
      ` : ""}
    </dialog>
  `;
}
