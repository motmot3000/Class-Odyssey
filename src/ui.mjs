/* ============================================================
   ui.mjs — vocabulaire visuel partagé
   Les trois vues (board, console, student) composent leurs écrans
   avec ces briques. Une stat = une brique = une couleur, partout.
   ============================================================ */

import { getShopItems, isEliminated, xpProgress } from "./domain.mjs";
import { renderCoinIcon, renderHeartIcon } from "./avatar.mjs";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Icônes ----------
   Un seul style : trait de 1.8, bouts arrondis, grille de 20.
   Mélanger des familles d'icônes est le premier signe d'une UI bricolée. */

const PATHS = {
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
  unlock: `<rect x="4.5" y="8.5" width="11" height="8" rx="1.8"/><path d="M7.2 8.5V6.6a2.8 2.8 0 0 1 5.5-.6"/><path d="M10 11.6v2"/>`
};

export function icon(name, extraClass = "") {
  const path = PATHS[name];
  if (!path) return "";
  return `<svg class="icon ${extraClass}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/* ---------- Stats ----------
   Chaque stat garde son gabarit d'une vue à l'autre : l'élève apprend
   à lire sa carte une fois, pas trois. */

export function renderHearts(pupil) {
  const hearts = Array.from({ length: pupil.maxHp }, (_, index) => renderHeartIcon(index < pupil.hp)).join("");
  return `<div class="hearts" role="img" aria-label="${pupil.hp} of ${pupil.maxHp} hit points">${hearts}</div>`;
}

export function renderXpBar(pupil, { showLabel = true } = {}) {
  const progress = xpProgress(pupil);
  return `
    <div class="xp">
      <div class="xp-track" role="img" aria-label="${progress.current} of ${progress.needed} XP">
        <span class="xp-fill" style="width:${progress.percent}%"></span>
      </div>
      ${showLabel ? `<p class="xp-label"><strong>${progress.current}</strong><span>/${progress.needed} XP</span></p>` : ""}
    </div>
  `;
}

export function renderMoney(amount) {
  return `<span class="money" aria-label="${amount} coins">${renderCoinIcon()}<strong>${amount}</strong></span>`;
}

export function renderLevel(level) {
  return `<span class="level" aria-label="Level ${level}"><span class="level-word">LVL</span><strong>${level}</strong></span>`;
}

export function getItemName(type, id) {
  return getShopItems(type).find((item) => item.id === id)?.name || "Rookie";
}

/* Le titre par défaut n'apprend rien : on ne l'affiche que lorsqu'il a été
   gagné, sinon chaque carte porte le même mot gris. */
export function renderTitle(pupil) {
  if (!pupil.title || pupil.title === "rookie") return "";
  return `<p class="hero-title-tag title-${pupil.title}">${escapeHtml(getItemName("title", pupil.title))}</p>`;
}

export function statusClass(pupil) {
  return isEliminated(pupil) ? "is-out" : "";
}

export function renderOutBadge(pupil) {
  return isEliminated(pupil) ? `<span class="out-badge">Out of HP</span>` : "";
}

export function gearOf(pupil) {
  return [
    ["Outfit", getItemName("outfit", pupil.skin)],
    ["Hat", getItemName("hat", pupil.hat)],
    ["Item", getItemName("weapon", pupil.weapon)],
    ["Hair", getItemName("hair", pupil.hair)],
    ["Face", getItemName("face", pupil.face)],
    ["Skin", getItemName("tone", pupil.skinTone)]
  ];
}

export function renderCustomOrders(pupil) {
  if (!pupil.customOrders?.length) return "";
  return `
    <section class="custom-orders" aria-label="Custom orders">
      <h3 class="section-label">Custom orders</h3>
      <ul>
        ${pupil.customOrders.map((order) => `
          <li>
            <strong>${escapeHtml(order.note)}</strong>
            <time datetime="${escapeHtml(order.orderedAt)}">${new Date(order.orderedAt).toLocaleDateString("en-GB")}</time>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}

export function heroStageAttributes(pupil) {
  return `data-outfit="${escapeHtml(pupil.skin || "starter")}" data-gear="${escapeHtml(pupil.weapon || "no-weapon")}"`;
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
