/* Active game views. Render only markup here: app.mjs dispatches actions,
 * the domain enforces purchases, and the runtime owns the shared 3D canvas.
 */

import { HATS, HAIRS, SKINS, HAIR_COLORS, SKIN_TONES, getShopItem, getShopItems, xpProgress, isEliminated, getNextReward } from "../domain.mjs";
import { escapeHtml, gearOf, translateReward, renderCustomOrders, renderLevel, renderTitle, titleBackdropAttributes } from "../ui.mjs";
import { renderConsole } from "./console.mjs";
import { renderShop } from "./shop.mjs";
import { BRAND } from "../brand.mjs";
import { t, tItem } from "../i18n.mjs";
import { pupilLook } from "../items-3d-model.mjs";
import { renderHeroPortrait, renderItemThumbnail, isModeledItem } from "../equipment-previews.mjs";

const ico = (name, cls = "") => {
  const paths = {
    board: `<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/>`,
    heroes: `<circle cx="7" cy="7" r="3"/><path d="M2 17c0-3 2.4-5 5-5s5 2 5 5Z"/><circle cx="14.5" cy="8" r="2.3"/><path d="M11.5 17c0-2.6 1.6-4.3 3.2-4.3S18 14.4 18 17Z"/>`,
    heart: `<path d="M10 17S3.5 12.8 3.5 8.6A3.9 3.9 0 0 1 10 5.9a3.9 3.9 0 0 1 6.5 2.7C16.5 12.8 10 17 10 17Z"/>`,
    coin: `<circle cx="10" cy="10" r="8"/><circle cx="10" cy="10" r="3.7" fill="none" stroke-width="1.4"/>`,
    star: `<path d="M10 2l2 5.4 5.8.3-4.5 3.7 1.5 5.6L10 14l-4.8 3 1.5-5.6L2.2 7.7l5.8-.3Z"/>`,
    skull: `<path d="M10 2.2A6.2 6.2 0 0 0 3.8 8.4c0 2.2 1.1 3.5 2.3 4.5v1.5a1.8 1.8 0 0 0 1.8 1.8h4.2a1.8 1.8 0 0 0 1.8-1.8v-1.5c1.2-1 2.3-2.3 2.3-4.5A6.2 6.2 0 0 0 10 2.2Z"/><circle cx="7.6" cy="8.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="12.4" cy="8.6" r="1.5" fill="currentColor" stroke="none"/>`,
    search: `<circle cx="9" cy="9" r="5.4"/><path d="M13.2 13.2 17 17"/>`,
    rune: `<path d="M10 2.5 16 10l-6 7.5L4 10Z"/><circle cx="10" cy="10" r="2"/>`,
    expand: `<path d="M8 3H3v5M12 3h5v5M12 17h5v-5M8 17H3v-5"/>`,
    rotate: `<path d="M16.4 2.8v4h-4"/><path d="M15.9 6.9A6.2 6.2 0 1 0 16.2 10"/>`,
    sun: `<circle cx="10" cy="10" r="3.4"/><path d="M10 1.8v2.2M10 16v2.2M1.8 10h2.2M16 10h2.2M4.2 4.2l1.6 1.6M14.2 14.2l1.6 1.6M15.8 4.2l-1.6 1.6M5.8 14.2l-1.6 1.6"/>`,
    moon: `<path d="M16.4 12.6A6.8 6.8 0 0 1 7.4 3.6a6.8 6.8 0 1 0 9 9Z"/>`,
    lock: `<rect x="4.5" y="8.5" width="11" height="8" rx="1.8"/><path d="M7.2 8.5V6.6a2.8 2.8 0 0 1 5.6 0v1.9"/>`,
    // Lucide "book-open": two pages and a spine, unmistakably a book at 16px.
    book: `<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>`,
    back: `<path d="M15 10H5"/><path d="M9 5.5 4.5 10 9 14.5"/>`,
    plus: `<path d="M10 4.5v11M4.5 10h11"/>`,
    check: `<path d="m5 10 3.5 3.5L15 6.5"/>`,
    menu: `<path d="M4 5h12M4 10h12M4 15h12"/>`,
    // Lucide "settings": a cog, so the options control reads as parameters.
    settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
    shop: `<path d="M4 7.5h12l-1 8.5H5z"/><path d="M7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5"/>`
  };
  const VIEWBOXES = { settings: "0 0 24 24", book: "0 0 24 24" };
  const path = paths[name];
  if (!path) return "";
  return `<svg class="ic ${cls}" viewBox="${VIEWBOXES[name] || "0 0 20 20"}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
};

export const SHEIKAH_ANGLES = ["front", "quarter", "back", "head", "item"];

// Map shop categories to persisted cosmetic fields (outfit is stored as skin).
export const SHOP_FIELD = { outfit: "skin", hat: "hat", weapon: "weapon", hair: "hair", hairColor: "hairColor" };

// Portraits and the workshop must derive exactly the same equipped look.
export function gameLook(pupil, draft = null) {
  return pupilLook(pupil, draft);
}

/* In the shop, show the product alone. The equipped look belongs in the workshop. */
export function shopPreviewItem(pupil, ui = {}) {
  const type = ui.shopCategory || 'outfit';
  const items = getShopItems(type);
  const requested = getShopItem(ui.shopPreview);
  if (requested?.type === type) return requested;
  const field = SHOP_FIELD[type] || (type === 'tone' ? 'skinTone' : type);
  return items.find(item => item.id === pupil[field]) || items[0] || getShopItems('outfit')[0];
}

export function shopPreviewLook(pupil, ui = {}) {
  const item = shopPreviewItem(pupil, ui);
  // Skin tones have no mesh of their own: show the equipped hero wearing the
  // tone, so the swatch is not the only feedback.
  if (item?.type === 'tone') return { ...gameLook(pupil), tone: item.id };
  if (!isModeledItem(item)) return null;
  return { ...gameLook(pupil, { [SHOP_FIELD[item.type]]: item.id }), preview: { slot:item.type, id:item.id } };
}

export function cosmeticChangesFromDraft(draft = {}) {
  return {
    ...(draft.skin ? { outfit: draft.skin } : {}),
    ...(draft.hat ? { hat: draft.hat } : {}),
    ...(draft.weapon ? { weapon: draft.weapon } : {}),
    ...(draft.hair ? { hair: draft.hair } : {}),
    ...(draft.hairColor ? { hairColor: draft.hairColor } : {}),
    ...(draft.skinTone ? { skinTone: draft.skinTone } : {})
  };
}

// Camera controls correspond to catalogue presets. Isolated products have no head view.
function renderAngleBar(ui, { itemOnly = false, dressing = false } = {}) {
  const angles = itemOnly ? ['front', 'quarter', 'back'] : dressing ? SHEIKAH_ANGLES.filter(angle => angle !== 'item') : SHEIKAH_ANGLES;
  const active = ui.angle === "free" ? null : angles.includes(ui.angle) ? ui.angle : "quarter";
  return `<div class="angle-bar">
    ${angles.map((angle) => `<button type="button" class="${active === angle ? "on" : ""}" data-action="sheikah-angle" data-value="${angle}" aria-pressed="${active === angle}">${t(`view.${angle}`)}</button>`).join("")}
    <button type="button" class="rot ${ui.rotating ? "on" : ""}" data-action="sheikah-rotate" aria-pressed="${ui.rotating}">${ico("rotate")}${t("view.rotation")}</button>
  </div>`;
}

function renderViewerHost(pupil, look, { live = false, item = null } = {}) {
  return `<div class="dais dais-lg is-loading${live ? " dais-live" : ""}" data-viewer-host data-look='${escapeHtml(JSON.stringify(look))}' ${titleBackdropAttributes(pupil)}>
    <span class="title-halo" aria-hidden="true"></span>
    <span class="title-emblem" aria-hidden="true"></span>
    <span class="title-frame" aria-hidden="true"></span>
    ${renderViewerFallback(pupil, item)}
  </div>`;
}

function renderViewerFallback(pupil, item = null) {
  return `${item ? renderItemThumbnail(item, { className:'viewer-fallback' }) : renderHeroPortrait(pupil, { className:'viewer-fallback', alt:t('view.character',{name:pupil.name}), large:true, dynamic:false })}
    <span class="loader" data-load-bar style="--p:0%" role="status" aria-label="${t("view.loading")}"><i></i></span>
    <div class="viewer-recovery" hidden><p class="viewer-error" role="status"></p><button class="btn" type="button" data-action="retry-viewer">${t("view.retry")}</button></div>`;
}

/* Navigation hierarchy: Class → Hero sheet → Dressing / Shop.
   Dressing and Shop are children of the hero, so their back control always
   returns to the hero, in the same top-left spot on both screens. */
function renderHeroBack() {
  return `<button class="btn btn-back" type="button" data-action="hero-back">${ico('back')}<span>${t('shop.backHero')}</span></button>`;
}

/* ---------- Application navigation ---------- */

export function renderSheikahTopbar({ view, state, account, unlocked }) {
  const activeClass = state.classes.find((classroom) => classroom.id === state.activeClassId) || state.classes[0];
  const themeControl = `<button type="button" class="ghost" data-action="toggle-theme" aria-label="${t("common.changeTheme")}" title="${t("common.changeTheme")}">${ico(document.documentElement.dataset.theme === "light" ? "moon" : "sun")}<span>${t("common.theme")}</span></button>`;
  return `
    <header class="topbar ${view === "welcome" ? "topbar-welcome" : ""}">
      <div class="brand">
        <button class="brand-home" type="button" data-action="show-class" aria-label="${t('nav.class')}">
        <img class="brand-logo brand-logo-light" src="${BRAND.assets.logoLight}" alt="ClassQuest" width="869" height="212" />
        <img class="brand-logo brand-logo-dark" src="${BRAND.assets.logoDark}" alt="" width="869" height="212" />
        </button>
      </div>
       ${view === "welcome" ? `<div class="top-end"><a class="welcome-nav-link" href="#gate-title" data-welcome-enter>${t("welcome.tab.signin")}</a></div>` : `
      <details class="class-picker">
        <summary class="class-picker-summary" aria-label="${t("nav.classes")}">
          ${ico("heroes")}
          <span class="class-picker-label">${t("nav.classes")}</span>
          <span class="class-picker-current">${escapeHtml(activeClass?.name || "")}</span>
          <span class="class-picker-caret" aria-hidden="true"></span>
        </summary>
        <div class="class-picker-menu" role="menu" aria-label="${t("nav.classes")}">
          ${state.classes.map((classroom) => {
            const active = classroom.id === state.activeClassId;
            return `<button type="button" role="menuitemradio" aria-checked="${active}" class="${active ? "on" : ""}" data-action="select-class" data-class-id="${escapeHtml(classroom.id)}">
              <span class="class-picker-name">${escapeHtml(classroom.name)}</span>${active ? ico("check") : ""}
            </button>`;
          }).join("")}
        </div>
      </details>
      <div class="top-end">
        <button type="button" class="ghost" data-action="show-rules" aria-current="${view === "rules" ? "page" : "false"}" aria-label="${t("app.aria.rules")}" title="${t("app.aria.rules")}">${ico("book")}<span>${t("app.aria.rules")}</span></button>
        ${themeControl}
        <details class="tablet-tools">
          <summary class="ghost" aria-label="${t("sheikah.tools")}" title="${t("sheikah.tools")}">${ico("settings")}</summary>
          <div class="tablet-tools-menu">
            <span class="account-tag" title="${t("app.aria.signedIn", { username: escapeHtml(account?.username || "") })}">${escapeHtml(account?.displayName || "")}</span>
            ${account?.role === "admin" ? `<button type="button" class="ghost" data-action="show-admin" aria-current="${view === "admin" ? "page" : "false"}" aria-label="${t("app.aria.accounts")}" title="${t("app.aria.accounts")}">${ico("rune")}<span>${t("app.aria.accounts")}</span></button>` : ""}
            ${unlocked ? `<button type="button" class="ghost" data-action="lock-adult" aria-label="${t("console.account.lock")}" title="${t("console.account.lock")}">${ico("lock")}<span>${t("console.account.lock")}</span></button>` : ""}
          </div>
        </details>
      </div>`}
    </header>
    ${view === 'welcome' ? '' : `<button class="teacher-console-tab" type="button" data-action="teacher-console" aria-haspopup="dialog" aria-expanded="false" aria-label="${t('console.title')}">${ico('lock')}<span>${t('console.title')}</span></button>`}`;
}

/* ---------- Teacher board ---------- */

export function renderSheikahTeacher({ classroom, ui, targets, focused, canUndo, account, selectedIds = [], events = [], armedReset = false, unlockedUntil = null }) {
  return `
    <main class="layout">
      ${renderSheikahBoard(classroom, ui, selectedIds)}
      <aside class="console ${ui.consoleOpen ? "is-open" : ""}" aria-label="${t("console.title")}">
        <button class="console-mobile-toggle" type="button" data-action="toggle-console" aria-expanded="${ui.consoleOpen}" aria-controls="teacher-console-body">
          <span>${ico("rune")}${t("console.title")}</span>
          <strong>${ui.consoleOpen ? t("app.console.close") : targets.length ? t("app.selected", { n: targets.length }) : t("common.open")}</strong>
        </button>
        <div class="console-body" id="teacher-console-body">
          ${renderConsole({ classroom, ui, targets, focused, canUndo, events, armedReset, unlockedUntil, account })}
        </div>
      </aside>
    </main>`;
}

function renderSheikahBoard(classroom, ui, selectedIds) {
  const total = classroom.pupils.length;
  const out = classroom.pupils.filter(isEliminated).length;
  const average = total ? (classroom.pupils.reduce((sum, pupil) => sum + pupil.level, 0) / total).toFixed(1) : "0.0";
  const query = ui.query.trim().toLowerCase();
  const pupils = query ? classroom.pupils.filter((pupil) => pupil.name.toLowerCase().includes(query)) : classroom.pupils;
  return `
    <section class="board" aria-label="${t("sheikah.board", { name: escapeHtml(classroom.name) })}">
      <div class="board-heading">
        <span class="class-seal">${escapeHtml(classroom.name)}</span>
        <div class="board-title">
          <h1>${t("sheikah.roster")}</h1>
          <p class="board-sub">${t("sheikah.classroom")} · <span id="clock">--:--</span></p>
        </div>
      </div>
      <div class="board-bar">
        <div class="board-stats">
          <span class="chip">${ico("heroes")}<b>${total}</b> ${t("common.heroes")}</span>
          <span class="chip ${out ? "danger" : ""}">${ico("skull")}<b>${out}</b> ${t("common.out")}</span>
          <span class="chip">${ico("star")}<b>${average}</b> ${t("board.avgLevel")}</span>
        </div>
        <div class="board-tools">
          <label class="search">${ico("search")}<input type="search" id="roster-search" data-action="search" value="${escapeHtml(ui.query)}" placeholder="${t("board.searchPlaceholder")}" aria-label="${t("board.searchAria")}" /></label>
        </div>
      </div>
      ${pupils.length ? `
        <div class="rune-grid" role="list">
          ${pupils.map((pupil) => renderRuneCard(pupil, selectedIds)).join("")}
        </div>
      ` : total ? `
        <div class="empty">${ico("search")}<h2>${t("sheikah.noResults")}</h2><p>${t("sheikah.noResultsHint")}</p><button class="btn" type="button" data-action="clear-search">${t("board.clearSearch")}</button></div>
      ` : `
        <div class="empty">${ico("heroes")}<h2>${t("sheikah.noHeroes")}</h2><p>${t("sheikah.noHeroesHint")}</p><button class="btn btn-primary" type="button" data-action="focus-add">${ico("plus")}${t("board.emptyAction")}</button></div>
      `}
    </section>`;
}

function renderRuneCard(pupil, selectedIds = [], { student = false, selecting = false } = {}) {
  const selected = (!student || selecting) && selectedIds.includes(pupil.id);
  const progress = xpProgress(pupil);
  const out = isEliminated(pupil);
  return `
    <article class="rune-card ${student ? 'student-card' : ''} ${selected ? "is-selected" : ""} ${out ? "is-out" : ""}" role="listitem">
      <button class="card-hit" type="button" data-action="${student && !selecting ? 'student-pick' : 'toggle-pupil'}" data-pupil-id="${escapeHtml(pupil.id)}" ${student && !selecting ? '' : `aria-pressed="${selected}"`} aria-label="${t(student && !selecting ? 'student.openHero' : 'board.select', { name: escapeHtml(pupil.name) })}"></button>
      <div class="dais dais-card" ${titleBackdropAttributes(pupil)}>
        <span class="title-halo" aria-hidden="true"></span>
        <span class="title-emblem" aria-hidden="true"></span>
        <span class="title-frame" aria-hidden="true"></span>
        ${renderHeroPortrait(pupil, { className: student ? 'hero-fig picker-portrait' : 'hero-fig' })}
        ${student && !selecting ? '' : `<span class="selection-mark" aria-hidden="true">${ico("check")}</span>`}
        ${out ? `<span class="out-tag">${t("common.out")}</span>` : ""}
        <button class="card-open" type="button" data-action="${student && !selecting ? 'student-pick' : 'sheikah-open'}" data-pupil-id="${escapeHtml(pupil.id)}" aria-label="${t("console.hero.zoom", { name: escapeHtml(pupil.name) })}">${ico("expand")}</button>
      </div>
      <header class="rune-card-head">
        <div class="rune-card-name"><h2>${escapeHtml(pupil.name)}</h2></div>
        <span class="lvl-seal" aria-label="${t("app.aria.level", { level: pupil.level })}"><small>${t("common.levelShort")}</small><b>${pupil.level}</b></span>
      </header>
      <div class="rune-card-title">${renderTitle(pupil)}</div>
      <div class="rune-vitals">
        <div class="card-health-money">
        <div class="hearts" role="img" aria-label="${t("app.aria.hp", { hp: pupil.hp, maxHp: pupil.maxHp })}">
          ${Array.from({ length: pupil.maxHp }, (_, i) => `<span class="heart ${i < pupil.hp ? "" : "off"}">${ico("heart")}</span>`).join("")}
        </div>
        <span class="coins" aria-label="${t("app.aria.coins", { amount: pupil.money })}">${ico("coin")}${pupil.money}</span>
        </div>
        <div class="rune-xp-label"><span>XP</span><span>${progress.current}<span class="xp-needed"> / ${progress.needed}</span></span></div>
        <div class="conduit" role="progressbar" aria-label="${t("student.experience")}" aria-valuemin="0" aria-valuemax="${progress.needed}" aria-valuenow="${progress.current}"><i style="--progress:${progress.percent / 100}"></i></div>
      </div>
      <footer class="rune-card-foot">
        <button class="rune-act" type="button" data-action="sheikah-personalize" data-pupil-id="${escapeHtml(pupil.id)}" aria-label="${t('student.openDressing',{name:escapeHtml(pupil.name)})}">${ico("rune")}<span>${t("sheikah.workshop")}</span></button>
        <button class="rune-act" type="button" data-action="sheikah-shop" data-pupil-id="${escapeHtml(pupil.id)}" aria-label="${t('student.openShop',{name:escapeHtml(pupil.name)})}">${ico("shop")}<span>${t("student.shop")}</span></button>
      </footer>
    </article>`;
}

/* ---------- Pupil picker and hero views ---------- */

export function renderSheikahStudent({ classroom, ui, pupil, classView = false, selectionMode = false, selectedIds = [] }) {
  if (!pupil) {
    if (!classroom.pupils.length) {
      return `<main class="single"><div class="empty">${ico("heroes")}<h1>${t("student.noHeroesTitle", { name: escapeHtml(classroom.name) })}</h1><p>${t("sheikah.studentEmpty")}</p></div></main>`;
    }
    const query = (ui.query || "").trim().toLocaleLowerCase();
    const pupils = classroom.pupils.filter(item => item.name.toLocaleLowerCase().includes(query));
    return `
      <main class="single">
        <div class="picker">
          <h1 tabindex="-1">${classView ? `${t('nav.class')} ${escapeHtml(classroom.name)}` : t("student.whichHero")}</h1>
          <p class="atelier-sub">${classView ? t('class.hint') : `${t("sheikah.studentSpace")} · ${t("student.tapName")}`}</p>
          <label class="search">${ico("search")}<input type="search" id="roster-search" data-action="search" value="${escapeHtml(ui.query || "")}" placeholder="${t("student.findName")}" aria-label="${t("student.findName")}" autocomplete="off" /></label>
          ${pupils.length ? `
          <div class="rune-grid picker-grid" role="list">
            ${pupils.map(item => renderRuneCard(item, selectedIds, { student:true, selecting:selectionMode })).join('')}
          </div>` : `<div class="empty"><h2>${t("student.noMatchTitle", { query: escapeHtml(ui.query.trim()) })}</h2><button class="btn" data-action="clear-search">${t("student.clearSearch")}</button></div>`}
        </div>
      </main>`;
  }
  return renderSheikahSheet(pupil, ui, { student: true });
}

export function renderSheikahSheet(pupil, ui, { student = false } = {}) {
  const progress = xpProgress(pupil);
  const next = getNextReward(pupil.level);
  const look = gameLook(pupil);
  return `
    <main class="single">
      <div class="sheet">
        <header class="sheet-heading">
          <h1>${escapeHtml(pupil.name)}</h1>
          <p class="sheet-context">${t(student ? "sheikah.myHero" : "sheikah.heroSheet")}</p>
        </header>
        <div class="sheet-stage">
          ${renderViewerHost(pupil, look)}
          ${renderAngleBar(ui)}
        </div>
        <div class="sheet-info">
          ${renderTitle(pupil, { labelled:true })}
          <div class="sheet-stats">
            <div class="stat"><span class="lvl-seal big">${pupil.level}</span><small>${t("common.level")}</small></div>
            <div class="stat">${ico("coin")}<b>${pupil.money}</b><small>${t("common.coins")}</small></div>
            <div class="stat">${ico("star")}<b>${progress.current}/${progress.needed}</b><small>${t("student.experience")}</small></div>
          </div>
          <div class="hearts big" role="img" aria-label="${t("app.aria.hp", { hp: pupil.hp, maxHp: pupil.maxHp })}">${Array.from({ length: pupil.maxHp }, (_, i) => `<span class="heart ${i < pupil.hp ? "" : "off"}">${ico("heart")}</span>`).join("")}</div>
          ${isEliminated(pupil) ? `<p class="alert alert-danger">${t("student.outOfHp")}</p>` : ""}
          <div class="conduit big" role="progressbar" aria-label="${t("student.experience")}" aria-valuemin="0" aria-valuemax="${progress.needed}" aria-valuenow="${progress.current}"><i style="--progress:${progress.percent / 100}"></i></div>
          <p class="sheet-role">${next ? t("student.levelUnlock", { next: next.level, rewards: next.rewards.map(translateReward).map(escapeHtml).join(", ") }) : t("student.allUnlocked")}</p>
          <div class="row">
            <button class="btn" data-action="sheikah-personalize" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>${t("sheikah.workshop")}</span></button>
            <button class="btn" data-action="sheikah-shop" data-pupil-id="${escapeHtml(pupil.id)}">${ico("shop")}<span>${t("student.shop")}</span></button>
          </div>
          <div class="hero-class-return"><button class="btn" type="button" data-action="show-class">${ico('back')}<span>${t('class.back')}</span></button></div>
        </div>
      </div>
    </main>`;
}

export function renderSheikahPersonalize(pupil, ui) {
  const draft = gameLook(pupil, ui.draft);
  const owned = (list) => list.filter((item) => item.price === 0 || pupil.ownedItems.includes(item.id));
  const option = (active, field, value, label) =>
    `<button type="button" class="rune-choice ${active ? "on" : ""}" data-action="sheikah-set" data-field="${field}" data-value="${escapeHtml(value)}" aria-pressed="${active}">${label}</button>`;
  const section = (label, list, field) => `
    <section class="rune-section">
      <p class="label">${label}</p>
      <div class="rune-row">
        ${owned(list).map((item) => option((ui.draft?.[field] || pupil[field]) === item.id, field, item.id, escapeHtml(tItem(item, "name")))).join("")}
      </div>
    </section>`;
  return `
    <main class="single">
      <div class="atelier">
        <header class="sheet-heading">
          ${renderHeroBack()}
          <h1>${escapeHtml(pupil.name)}</h1>
          <p class="sheet-context">${t("sheikah.workshopTitle")}</p>
        </header>
        <div class="atelier-stage">
          ${renderViewerHost(pupil, draft, { live: true })}
          ${renderAngleBar(ui, { dressing:true })}
        </div>

        <div class="atelier-panel">
          <div class="workshop-identity">${renderTitle(pupil, { labelled:true })}${renderLevel(pupil.level)}</div>
          <p class="atelier-sub">${t("sheikah.workshopHint")}</p>

          ${section(t("app.gear.outfit"), SKINS, "skin")}
          ${section(t("app.gear.hat"), HATS, "hat")}
          ${section(t("app.gear.hair"), HAIRS, "hair")}
          ${section(t("app.gear.hairColor"), HAIR_COLORS, "hairColor")}
          ${section(t("app.gear.skin"), SKIN_TONES, "skinTone")}

          <div class="atelier-actions">
            <button class="btn btn-primary btn-lg" data-action="sheikah-equip" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>${t("sheikah.saveLook")}</span></button>
          </div>
        </div>
      </div>
    </main>`;
}

/* ---------- Item-only shop ---------- */

/* Titles have no 3D model, so the shop renders the real title on its own
 * title backdrop: pupils can see exactly how prestigious a title looks. */
function renderTitleStage(item) {
  const pupil = { title: item.id };
  return `<div class="dais dais-lg title-stage" ${titleBackdropAttributes(pupil)}>
    <span class="title-halo" aria-hidden="true"></span>
    <span class="title-emblem" aria-hidden="true"></span>
    <span class="title-frame" aria-hidden="true"></span>
    <div class="title-stage-tag">${renderTitle(pupil, { labelled: true })}</div>
  </div>`;
}

export function renderSheikahShop(pupil, ui) {
  const look = shopPreviewLook(pupil, ui);
  const item = shopPreviewItem(pupil, ui);
  const active = ui.shopCategory || "outfit";
  const isTitle = item.type === "title";
  return `
    <main class="single">
      <div class="atelier atelier-shop">
        <header class="sheet-heading">
          ${renderHeroBack()}
          <h1>${escapeHtml(pupil.name)}</h1>
          <p class="sheet-context">${t("student.shop")}</p>
        </header>
        <div class="atelier-stage">
          ${isTitle
            ? renderTitleStage(item)
            : look ? renderViewerHost(pupil, look, { item }) : `<div class="dais dais-lg item-only-preview">${renderItemThumbnail(item)}</div>`}
          ${!isTitle && look ? renderAngleBar(ui, { itemOnly:true }) : ''}
          <p class="item-preview-caption">${escapeHtml(tItem(item, 'name'))}</p>
        </div>

        <div class="atelier-panel">
          <p class="atelier-sub">${t("shop.itemOnlyHint")}</p>
          <div class="shop-hero-summary">${renderLevel(pupil.level)}${renderTitle(pupil)}</div>
          ${renderShop(pupil, active, item.id)}
          ${renderCustomOrders(pupil)}
        </div>
      </div>
    </main>`;
}

export function renderSheikahGear(pupil) {
  return `
    <dl class="gear">
      ${gearOf(pupil).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>`;
}
