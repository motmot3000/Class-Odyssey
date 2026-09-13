/* ============================================================
   modals.mjs — les deux seules fenêtres de l'app
   `<dialog>` natif : piège de focus, Esc et fond inerte gratuits, donc
   rien à réinventer.
   ============================================================ */

import { canBuyItem, getNextReward, isItemOwned, xpProgress } from "../domain.mjs";
import { renderHero, renderItemArt } from "../avatar.mjs";
import { renderBaseCharacterViewer, baseStageAttributes } from "../characters.mjs";
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
import { translateReward } from "../ui.mjs";
import { t, tItem } from "../i18n.mjs";

const TYPE_LABEL = {
  outfit: () => t("modal.type.outfit"),
  hat: () => t("modal.type.hat"),
  weapon: () => t("modal.type.weapon"),
  face: () => t("modal.type.face"),
  hair: () => t("modal.type.hair"),
  hairColor: () => t("modal.type.hairColor"),
  title: () => t("modal.type.title"),
  tone: () => t("modal.type.tone"),
  bespoke: () => t("modal.type.bespoke")
};

/* Vue « plein tableau » d'un héros : lecture seule. On montre un élève à
   toute la classe sans risquer de modifier ses stats d'un doigt posé. */
export function renderPupilDialog(pupil) {
  const progress = xpProgress(pupil);
  const next = getNextReward(pupil.level);

  return `
    <dialog class="dialog dialog-hero ${statusClass(pupil)}" aria-label="${escapeHtml(pupil.name)}">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t("modal.close")}">${icon("close")}</button>
      <div class="dialog-hero-art dialog-hero-art-3d" ${baseStageAttributes(pupil)}>
        ${renderBaseCharacterViewer(pupil)}
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
        <p class="panel-note">${t("modal.xpToLevel", { n: progress.needed - progress.current, level: pupil.level + 1 })}</p>
        ${renderMoney(pupil.money)}
        <dl class="gear">
          ${gearOf(pupil).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
        </dl>
        ${renderCustomOrders(pupil)}
        <p class="panel-note">${next
          ? t("modal.levelUnlocks", { level: next.level, rewards: next.rewards.map(translateReward).map(escapeHtml).join(", ") })
          : t("modal.allUnlocked")}</p>
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
      ? t("modal.unlocksAt", { level: item.minLevel })
      : canBuyItem(pupil, item)
        ? t("modal.readyOrder")
        : t("modal.costs", { price: item.price, money: pupil.money })
    : equipped
    ? t("modal.worn")
    : owned
      ? t("modal.owned")
      : locked
        ? t("modal.unlocksAt", { level: item.minLevel })
        : t("modal.costs", { price: item.price, money: pupil.money });

  const previewPupil = bespoke
    ? pupil
    : { ...pupil, [field]: item.id };
  const visual = bespoke
    ? renderItemArt({ ...item, name: tItem(item, "name") })
    : `${renderHero(previewPupil)}${item.type === "title" ? `<span class="preview-title title-${item.id}">${escapeHtml(tItem(item, "name"))}</span>` : ""}`;

  return `
    <dialog class="dialog dialog-item" aria-label="${escapeHtml(tItem(item, "name"))}">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t("modal.close")}">${icon("close")}</button>
      <div class="dialog-item-art ${bespoke ? "" : "is-hero-preview"}" ${bespoke ? "" : heroStageAttributes(previewPupil)}>${visual}</div>
      <h2>${escapeHtml(tItem(item, "name"))}</h2>
      <p class="panel-note item-meta"><span class="rarity-label rarity-${getItemRarity(item)}">${t(`rarity.${getItemRarity(item)}`)}</span>${t("modal.meta", { type: TYPE_LABEL[item.type]?.() || t("modal.type.weapon"), level: item.minLevel, price: item.price ? t("shop.coins", { price: item.price }) : t("shop.free") })}</p>
      ${item.description ? `<p class="dialog-item-description">${escapeHtml(tItem(item, "description"))}</p>` : ""}
      <p class="dialog-status">${status}</p>
      ${bespoke && canBuyItem(pupil, item) ? `
        <form class="bespoke-order-form" data-action="order-bespoke">
          <input type="hidden" name="itemId" value="${escapeHtml(item.id)}" />
          <label class="field">
            <span>${t("modal.describe")}</span>
            <textarea name="note" rows="4" required maxlength="500" placeholder="${t("modal.placeholder")}"></textarea>
          </label>
          <button class="btn btn-primary" type="submit">${t("modal.orderFor", { price: item.price })}</button>
        </form>
      ` : ""}
    </dialog>
  `;
}
