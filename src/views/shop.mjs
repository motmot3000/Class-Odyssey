/* Shared shop markup for teacher and pupil views. Previewing never purchases
 * or equips anything; the separate action button states its exact consequence.
 */

import { canBuyItem, cosmeticField, getShopItems, isItemOwned } from "../domain.mjs";
import { renderItemThumbnail } from "../equipment-previews.mjs";
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
        <div class="shop-tabs" role="group" aria-label="${t("shop.categories")}">
          ${SHOP_CATEGORIES.map((category) => `
            <button
              type="button"
              class="shop-tab ${category.type === active.type ? "is-active" : ""}"
              data-action="shop-category"
              data-category="${category.type}"
              aria-pressed="${category.type === active.type}"
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

// Explicit action labels distinguish buying, equipping and already equipped items.
function renderShopItem(item, pupil, previewed = false) {
  const field = cosmeticField(item.type);
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

  // Locked items still show their price so pupils can plan their purchases.
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
      >${renderItemThumbnail(item)}<span class="item-tier" aria-hidden="true">${getItemTier(item)}</span></button>
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
