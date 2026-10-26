/* Shared, escaped HTML components: stats, icons, titles and equipment labels.
 * User-provided names and notes must pass through escapeHtml before insertion.
 */

import { getShopItems, isEliminated, xpProgress, SHOP_ITEMS } from "./domain.mjs";
import { renderCoinIcon, renderHeartIcon } from "./avatar.mjs";
import { t, tItem, getLang, translateMessage } from "./i18n.mjs";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* Icons share a 20-unit grid, 1.8-unit strokes and rounded ends. */

const PATHS = {
  spark: `<path d="m10 2 2 5 5 3-5 2-2 6-2-6-5-2 5-3 2-5Z"/>`,
  heroes: `<circle cx="7" cy="7" r="3"/><path d="M2 17c0-3 2.4-5 5-5s5 2 5 5Z"/><circle cx="14.5" cy="8" r="2.3"/><path d="M11.5 17c0-2.6 1.6-4.3 3.2-4.3S18 14.4 18 17Z"/>`,
  coin: `<circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><path d="m10 6 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>`,
  palette: `<path d="M10 3a7 7 0 1 0 0 14h1a2 2 0 0 0 1-3.7 1.4 1.4 0 0 1 .8-2.6H15A3 3 0 0 0 18 8c0-3-4-5-8-5Z"/><circle cx="6" cy="9" r=".7"/><circle cx="8" cy="6" r=".7"/><circle cx="12" cy="6" r=".7"/>`,
  undo: `<path d="M4 9h9a4.5 4.5 0 0 1 0 9h-4"/><path d="M7.5 5.5 4 9l3.5 3.5"/>`,
  search: `<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/>`,
  check: `<path d="M4.5 10.5l3.8 3.8L15.5 6"/>`,
  plus: `<path d="M10 4.5v11M4.5 10h11"/>`,
  minus: `<path d="M4.5 10h11"/>`,
  expand: `<path d="M12 4h4v4"/><path d="M8 16H4v-4"/><path d="M16 4l-5 5"/><path d="M4 16l5-5"/>`,
  grid: `<rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1.2"/><rect x="11" y="3.5" width="5.5" height="5.5" rx="1.2"/><rect x="3.5" y="11" width="5.5" height="5.5" rx="1.2"/><rect x="11" y="11" width="5.5" height="5.5" rx="1.2"/>`,
  list: `<path d="M7 5.5h9.5M7 10h9.5M7 14.5h9.5"/><path d="M3.6 5.5h.01M3.6 10h.01M3.6 14.5h.01"/>`,
  upload: `<path d="M10 15V5"/><path d="M6 8.5 10 4.5l4 4"/><path d="M4 15.5v1.5h12v-1.5"/>`,
  download: `<path d="M10 4.5v10"/><path d="M6 11l4 4 4-4"/><path d="M4 15.5v1.5h12v-1.5"/>`,
  trash: `<path d="M4.5 6h11"/><path d="M8 6V4.5h4V6"/><path d="M6 6l.8 10h6.4L14 6"/>`,
  close: `<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>`,
  book: `<path d="M4 4.5h5a2 2 0 0 1 2 2v9a1.6 1.6 0 0 0-1.6-1.6H4z"/><path d="M16 4.5h-3.4a1.6 1.6 0 0 0-1.6 1.6v9.4"/>`,
  user: `<circle cx="10" cy="7" r="3"/><path d="M4.5 16.5c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5"/>`,
  shop: `<path d="M4 7.5h12l-1 8.5H5z"/><path d="M7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5"/>`,
  clock: `<circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/>`,
  back: `<path d="M15 10H5"/><path d="M9 5.5 4.5 10 9 14.5"/>`,
  lock: `<rect x="4.5" y="8.5" width="11" height="8" rx="1.8"/><path d="M7.2 8.5V6.6a2.8 2.8 0 0 1 5.6 0v1.9"/><path d="M10 11.6v2"/>`,
  unlock: `<rect x="4.5" y="8.5" width="11" height="8" rx="1.8"/><path d="M7.2 8.5V6.6a2.8 2.8 0 0 1 5.5-.6"/><path d="M10 11.6v2"/>`,
  /* Same Lucide "book-open" as the rules button in the topbar, so the rules
   * emblem and its entry point share one mark. */
  bookOpen: `<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>`,
  edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
  bug: `<rect x="6.5" y="7" width="7" height="9.5" rx="3.5"/><path d="M8 7V5.8a2 2 0 0 1 4 0V7"/><path d="M10 10v6.5"/><path d="M3.5 9.5 6.5 10.5M16.5 9.5l-3 1M3.5 15l3-1.5M16.5 15l-3-1.5"/>`,
  coffee: `<path d="M4 8h10v4.5A4.5 4.5 0 0 1 9.5 17h-1A4.5 4.5 0 0 1 4 12.5Z"/><path d="M14 9.5h1a2.2 2.2 0 0 1 0 4.4h-1.3"/><path d="M7 3.5c-.6.8.6 1.4 0 2.3M10 3.5c-.6.8.6 1.4 0 2.3"/>`
};
const VIEWBOXES = { bookOpen: "0 0 24 24", edit: "0 0 24 24" };

export function icon(name, extraClass = "") {
  const path = PATHS[name];
  if (!path) return "";
  return `<svg class="icon ${extraClass}" viewBox="${VIEWBOXES[name] || "0 0 20 20"}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/* Keep stat shapes and semantics stable across every view. */

export function renderHearts(pupil) {
  const hearts = Array.from({ length: pupil.maxHp }, (_, index) => renderHeartIcon(index < pupil.hp)).join("");
  return `<div class="hearts" role="img" aria-label="${t("app.aria.hp", { hp: pupil.hp, maxHp: pupil.maxHp })}">${hearts}</div>`;
}

export function renderXpBar(pupil, { showLabel = true } = {}) {
  const progress = xpProgress(pupil);
  return `
    <div class="xp">
      <div class="xp-track" role="img" aria-label="${t("app.aria.xp", { current: progress.current, needed: progress.needed })}">
        <span class="xp-fill" style="width:${progress.percent}%"></span>
      </div>
      ${showLabel ? `<p class="xp-label"><strong>${progress.current}</strong><span>/${progress.needed} XP</span></p>` : ""}
    </div>
  `;
}

export function renderMoney(amount) {
  return `<span class="money" aria-label="${t("app.aria.coins", { amount })}">${renderCoinIcon()}<strong>${amount}</strong></span>`;
}

export function renderLevel(level) {
  return `<span class="level" aria-label="${t("app.aria.level", { level })}"><span class="level-word">${t("common.levelShort")}</span><strong>${level}</strong></span>`;
}

export function getItemName(type, id) {
  const item = getShopItems(type).find((item) => item.id === id);
  return item ? tItem(item, "name") : tItem({ id: "rookie", name: "Rookie" }, "name");
}

/* Titles are a prestige ladder. The earned title (not the pupil level) decides a
 * 1-5 tier used for colour, ornament and the backdrop behind the character.
 */
export function titleItemOf(pupil) {
  const titles = getShopItems("title");
  return titles.find((item) => item.id === pupil?.title) || titles[0];
}

export function titleTierOf(pupil) {
  const level = titleItemOf(pupil)?.minLevel || 1;
  if (level >= 8) return 5;
  if (level >= 6) return 4;
  if (level >= 4) return 3;
  if (level >= 2) return 2;
  return 1;
}

export function titleBackdropAttributes(pupil) {
  const item = titleItemOf(pupil);
  return `data-title-tier="${titleTierOf(pupil)}" data-title-id="${escapeHtml(item?.id || "rookie")}"`;
}

/* Decorative layers around the hero. Each title decides in CSS which layers it
 * lights up (aura, orbit, side flourishes, emblems, particles, floor), so early
 * titles stay quiet and later ones accumulate ornament. None of them sits on
 * the character: they frame it from the sides, the floor and above the head. */
export function renderTitleBackdrop() {
  return ["halo", "orbit", "flourish", "emblem", "sparkles", "frame"]
    .map((layer) => `<span class="title-${layer}" aria-hidden="true"></span>`)
    .join("");
}

export function renderTitle(pupil, { labelled = false } = {}) {
  const item = titleItemOf(pupil);
  const tier = titleTierOf(pupil);
  const ornament = `<svg class="title-ornament" viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path class="orn-base" d="M2 16h22"/>
    <path class="orn-gem" d="m26 16 4-4 4 4-4 4z"/>
    ${tier >= 2 ? '<path class="orn-leaf" d="M9 16c1-4 4-6 8-6"/><path class="orn-leaf" d="M9 16c1 4 4 6 8 6"/>' : ""}
    ${tier >= 3 ? '<path class="orn-star" d="m14 3 1.7 3.3 3.6.5-2.6 2.5.6 3.6L14 11.3l-3.3 1.6.6-3.6-2.6-2.5 3.6-.5z"/>' : ""}
    ${tier >= 4 ? '<path class="orn-crown" d="M5 11l3-6 4 3.5L16 4l3 7z"/>' : ""}
    ${tier >= 5 ? '<path class="orn-rays" d="M30 2l2 5M37 1l1 5M44 4l-2 4"/><circle class="orn-dot" cx="33" cy="21" r="1.3"/><circle class="orn-dot" cx="39" cy="23" r="1.1"/><circle class="orn-dot" cx="45" cy="19" r="1"/>' : ""}
  </svg>`;
  return `<span class="hero-title-tag title-${escapeHtml(item.id)}" data-title-tier="${tier}" data-title-id="${escapeHtml(item.id)}" ${labelled ? 'data-title-labelled' : ''}>
    ${labelled ? `<span class="hero-title-label">${t('modal.type.title')}</span>` : ''}
    ${labelled && tier >= 2 ? '<span class="title-glyph" aria-hidden="true"></span>' : ''}
    <span class="hero-title-ribbon">${ornament}<span class="hero-title-name">${escapeHtml(tItem(item,'name'))}</span>${ornament}</span>
  </span>`;
}

export function statusClass(pupil) {
  return isEliminated(pupil) ? "is-out" : "";
}

export function renderOutBadge(pupil) {
  return isEliminated(pupil) ? `<span class="out-badge">${t("app.aria.out")}</span>` : "";
}

export function gearOf(pupil) {
  return [
    [t("app.gear.outfit"), getItemName("outfit", pupil.skin)],
    [t("app.gear.hat"), getItemName("hat", pupil.hat)],
    [t("app.gear.hair"), getItemName("hair", pupil.hair)],
    [t("app.gear.hairColor"), getItemName("hairColor", pupil.hairColor || "brown-hair")],
    [t("app.gear.pet"), getItemName("pet", pupil.pet || "no-pet")],
    [t("app.gear.skin"), getItemName("tone", pupil.skinTone)]
  ];
}

export function renderCustomOrders(pupil) {
  if (!pupil.customOrders?.length) return "";
  return `
    <section class="custom-orders" aria-label="${t("app.aria.custom")}">
      <h3 class="section-label">${t("app.aria.custom")}</h3>
      <ul>
        ${pupil.customOrders.map((order) => `
          <li>
            <strong>${escapeHtml(order.note)}</strong>
             <time datetime="${escapeHtml(order.orderedAt)}">${new Date(order.orderedAt).toLocaleDateString(getLang() === "fr" ? "fr-FR" : "en-GB")}</time>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}

export function translateReward(reward) {
  if (reward === "HP restored") return t("reward.hp");
  for (const item of SHOP_ITEMS) {
    const name = tItem(item, "name");
    if (reward === item.name) return name;
    if (reward === `${item.name} title`) return t("reward.title", { name });
    if (reward === `${item.name} hair color`) return t("reward.hairColor", { name });
    if (reward === `${item.name} eye color`) return t("reward.eyeColor", { name });
  }
  return translateMessage(reward);
}

export function getItemRarity(item) {
  if (item.minLevel >= 8) return "legendary";
  if (item.minLevel >= 5) return "epic";
  if (item.minLevel >= 3) return "uncommon";
  return "common";
}

export function getItemTier(item) {
  const tiers = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return tiers[Math.min(10, Math.max(1, item.minLevel)) - 1];
}
