/* ============================================================
   shop.mjs — boutique du héros
   Même composant côté prof et côté élève : ce qu'un élève voit chez lui
   est exactement ce que le prof voit au tableau.
   ============================================================ */

import { canBuyItem, getShopItems, isItemOwned } from "../domain.mjs";
import { renderItemArt } from "../avatar.mjs";
import { escapeHtml, getItemRarity, getItemTier, renderMoney } from "../ui.mjs";

export const SHOP_CATEGORIES = [
  { type: "outfit", label: "Outfits" },
  { type: "hat", label: "Hats" },
  { type: "weapon", label: "Items" },
  { type: "hair", label: "Hair" },
  { type: "face", label: "Faces" },
  { type: "title", label: "Titles" },
  { type: "tone", label: "Skins" },
  { type: "bespoke", label: "Custom" }
];

export function renderShop(pupil, activeType) {
  const active = SHOP_CATEGORIES.find((category) => category.type === activeType) || SHOP_CATEGORIES[0];
  const items = getShopItems(active.type);

  return `
    <div class="shop">
      <div class="shop-head">
        <div class="shop-tabs" role="tablist" aria-label="Shop categories">
          ${SHOP_CATEGORIES.map((category) => `
            <button
              type="button"
              role="tab"
              class="shop-tab ${category.type === active.type ? "is-active" : ""}"
              data-action="shop-category"
              data-category="${category.type}"
              aria-selected="${category.type === active.type}"
            >${category.label}</button>
          `).join("")}
        </div>
        <p class="shop-balance">${renderMoney(pupil.money)}<span>to spend</span></p>
      </div>
      <div class="shop-items">
        ${items.map((item) => renderShopItem(item, pupil)).join("")}
      </div>
    </div>
  `;
}

/* Un seul bouton par article, dont le libellé dit ce qui va se passer :
   « Buy 40 », « Equip », « Equipped ». Jamais « OK ». */
function renderShopItem(item, pupil) {
  const field = item.type === "outfit" ? "skin" : item.type === "tone" ? "skinTone" : item.type;
  const bespoke = item.type === "bespoke";
  const equipped = !bespoke && pupil[field] === item.id;
  const owned = isItemOwned(pupil, item.id);
  const locked = pupil.level < item.minLevel;
  const affordable = canBuyItem(pupil, item);

  let label = `Buy ${item.price}`;
  let state = "buy";
  let disabled = "";
  if (bespoke && locked) {
    label = `Level ${item.minLevel}`;
    state = "locked";
    disabled = "disabled";
  } else if (bespoke && !affordable) {
    label = `Need ${item.price}`;
    state = "poor";
    disabled = "disabled";
  } else if (bespoke) {
    label = `Order ${item.price}`;
    state = "buy";
  } else if (equipped) {
    label = "Equipped";
    state = "equipped";
    disabled = "disabled";
  } else if (owned) {
    label = "Equip";
    state = "equip";
  } else if (locked) {
    label = `Level ${item.minLevel}`;
    state = "locked";
    disabled = "disabled";
  } else if (!affordable) {
    label = `Need ${item.price}`;
    state = "poor";
    disabled = "disabled";
  } else if (!item.price) {
    label = "Equip";
    state = "equip";
  }

  // Un article verrouillé annonce aussi son prix : un élève économise pour
  // ce qu'il convoite, il doit savoir combien avant d'y avoir droit.
  const price = item.price ? `${item.price} coins` : "Free";
  const meta = locked ? `Level ${item.minLevel} · ${price}` : price;

  return `
    <article class="shop-item rarity-${getItemRarity(item)} ${bespoke ? "is-bespoke" : ""} ${equipped ? "is-equipped" : ""} ${locked ? "is-locked" : ""}">
      <button
        class="shop-thumb"
        type="button"
        data-action="preview-item"
        data-item-id="${escapeHtml(item.id)}"
        aria-label="Preview ${escapeHtml(item.name)}"
      >${renderThumb(item)}<span class="item-tier" aria-hidden="true">${getItemTier(item)}</span></button>
      <div class="shop-item-text">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${meta}</small>
        ${item.description ? `<span class="shop-item-description">${escapeHtml(item.description)}</span>` : ""}
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

function renderThumb(item) {
  if (item.type === "title") {
    return `<span class="title-chip title-${item.id}">${escapeHtml(item.name)}</span>`;
  }
  return renderItemArt(item);
}
