/* ============================================================
   shop.mjs — boutique du héros
   Même composant côté prof et côté élève : ce qu'un élève voit chez lui
   est exactement ce que le prof voit au tableau.
   ============================================================ */

import { canBuyItem, getShopItems, isItemOwned } from "../domain.mjs";
import { renderItemArt } from "../avatar.mjs";
import { escapeHtml, getItemRarity, getItemTier, renderMoney } from "../ui.mjs";
import { t, tItem } from "../i18n.mjs";

export const SHOP_CATEGORIES = [
  { type: "outfit", label: () => t("shop.cat.outfit") },
  { type: "hat", label: () => t("shop.cat.hat") },
  { type: "weapon", label: () => t("shop.cat.item") },
  { type: "hair", label: () => t("shop.cat.hair") },
  { type: "hairColor", label: () => t("shop.cat.hairColor") },
  { type: "face", label: () => t("shop.cat.face") },
  { type: "title", label: () => t("shop.cat.title") },
  { type: "tone", label: () => t("shop.cat.skin") },
  { type: "bespoke", label: () => t("shop.cat.custom") }
];

export function renderShop(pupil, activeType, previewId = null) {
  const active = SHOP_CATEGORIES.find((category) => category.type === activeType) || SHOP_CATEGORIES[0];
  const items = getShopItems(active.type);

  return `
    <div class="shop">
      <div class="shop-head">
        <div class="shop-tabs" role="tablist" aria-label="${t("shop.categories")}">
          ${SHOP_CATEGORIES.map((category) => `
            <button
              type="button"
              role="tab"
              class="shop-tab ${category.type === active.type ? "is-active" : ""}"
              data-action="shop-category"
              data-category="${category.type}"
              aria-selected="${category.type === active.type}"
            >${category.label()}</button>
          `).join("")}
        </div>
        <p class="shop-balance">${renderMoney(pupil.money)}<span>${t("shop.toSpend")}</span></p>
      </div>
      <div class="shop-items">
        ${items.map((item) => renderShopItem(item, pupil, item.id === previewId)).join("")}
      </div>
    </div>
  `;
}

/* Un seul bouton par article, dont le libellé dit ce qui va se passer :
   « Buy 40 », « Equip », « Equipped ». Jamais « OK ». */
function renderShopItem(item, pupil, previewed = false) {
  const field = item.type === "outfit" ? "skin" : item.type === "tone" ? "skinTone" : item.type;
  const bespoke = item.type === "bespoke";
  const equipped = !bespoke && pupil[field] === item.id;
  const owned = isItemOwned(pupil, item.id);
  const locked = pupil.level < item.minLevel;
  const affordable = canBuyItem(pupil, item);

  let label = t("shop.buy", { price: item.price });
  let state = "buy";
  let disabled = "";
  if (bespoke && locked) {
    label = t("shop.level", { level: item.minLevel });
    state = "locked";
    disabled = "disabled";
  } else if (bespoke && !affordable) {
    label = t("shop.need", { price: item.price });
    state = "poor";
    disabled = "disabled";
  } else if (bespoke) {
    label = t("shop.order", { price: item.price });
    state = "buy";
  } else if (equipped) {
    label = t("shop.equipped");
    state = "equipped";
    disabled = "disabled";
  } else if (owned) {
    label = t("shop.equip");
    state = "equip";
  } else if (locked) {
    label = t("shop.level", { level: item.minLevel });
    state = "locked";
    disabled = "disabled";
  } else if (!affordable) {
    label = t("shop.need", { price: item.price });
    state = "poor";
    disabled = "disabled";
  } else if (!item.price) {
    label = t("shop.equip");
    state = "equip";
  }

  // Un article verrouillé annonce aussi son prix : un élève économise pour
  // ce qu'il convoite, il doit savoir combien avant d'y avoir droit.
  const price = item.price ? t("shop.coins", { price: item.price }) : t("shop.free");
  const meta = locked ? `${t("shop.level", { level: item.minLevel })} · ${price}` : price;

  return `
    <article class="shop-item rarity-${getItemRarity(item)} ${bespoke ? "is-bespoke" : ""} ${equipped ? "is-equipped" : ""} ${locked ? "is-locked" : ""} ${previewed ? "is-preview" : ""}">
      <button
        class="shop-thumb"
        type="button"
        data-action="preview-item"
        data-item-id="${escapeHtml(item.id)}"
        aria-pressed="${previewed}"
        aria-label="${t("shop.preview", { name: escapeHtml(tItem(item, "name")) })}"
      >${renderThumb(item, pupil)}<span class="item-tier" aria-hidden="true">${getItemTier(item)}</span></button>
      <div class="shop-item-text">
        <strong>${escapeHtml(tItem(item, "name"))}</strong>
        <small>${meta}</small>
        ${item.description ? `<span class="shop-item-description">${escapeHtml(tItem(item, "description"))}</span>` : ""}
      </div>
      <button
        class="btn btn-sm ${state === "buy" ? "btn-primary" : ""}"
        type="button"
        data-action="shop-item"
        data-item-id="${escapeHtml(item.id)}"
        ${disabled}
      >${label}</button>
    </article>
  `;
}

function renderThumb(item, pupil) {
  if (item.type === "title") {
    return `<span class="title-chip title-${item.id}">${escapeHtml(tItem(item, "name"))}</span>`;
  }
  return renderItemArt({ ...item, name: tItem(item, "name") }, pupil);
}
