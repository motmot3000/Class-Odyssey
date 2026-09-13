/* ============================================================
   sheikah.mjs — interface « Tablette Sheikah »
   Le plateau, la console, la fiche et l'atelier partagent une seule
   dalle 3D : on ne recharge jamais le modèle, on change son état.
   Les règles du jeu et les actions restent celles de l'app.
   ============================================================ */

import { SKINS, WEAPONS, HAIR_COLORS, xpProgress, isEliminated, getNextReward } from "../domain.mjs";
import { escapeHtml, gearOf, translateReward, renderCustomOrders, renderLevel, renderTitle } from "../ui.mjs";
import { renderConsole } from "./console.mjs";
import { renderShop } from "./shop.mjs";
import { t, tItem } from "../i18n.mjs";

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
    book: `<path d="M4 4.5h5a2 2 0 0 1 2 2v9a1.6 1.6 0 0 0-1.6-1.6H4z"/><path d="M16 4.5h-3.4a1.6 1.6 0 0 0-1.6 1.6v9.4"/>`,
    back: `<path d="M15 10H5"/><path d="M9 5.5 4.5 10 9 14.5"/>`,
    plus: `<path d="M10 4.5v11M4.5 10h11"/>`,
    shop: `<path d="M4 7.5h12l-1 8.5H5z"/><path d="M7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5"/>`
  };
  const path = paths[name];
  if (!path) return "";
  return `<svg class="ic ${cls}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
};

export const SHEIKAH_OUTFITS = ["base", "explorer", "traveller"];
export const SHEIKAH_DYES = ["sage", "mist", "sand"];
export const SHEIKAH_ITEMS = ["none", "satchel", "lantern"];

/* Traduit les cosmétiques de l'app vers l'état du vestiaire 3D. La
   correspondance est volontairement déterministe : un même élève garde
   toujours la même allure. */
export function wardrobeLook(pupil, draft = null) {
  const skin = draft?.skin || pupil.skin;
  const weapon = draft?.weapon || pupil.weapon;
  const hairColor = draft?.hairColor || pupil.hairColor;
  const skinIndex = Math.max(0, SKINS.findIndex((item) => item.id === skin));
  const colorIndex = Math.max(0, HAIR_COLORS.findIndex((item) => item.id === hairColor));
  const weaponIndex = Math.max(0, WEAPONS.findIndex((item) => item.id === weapon));
  return {
    gender: pupil.gender === "girl" ? "female" : "male",
    outfit: SHEIKAH_OUTFITS[skinIndex % SHEIKAH_OUTFITS.length],
    dye: SHEIKAH_DYES[colorIndex % SHEIKAH_DYES.length],
    item: weapon === "no-weapon" ? "none" : SHEIKAH_ITEMS[1 + (weaponIndex % 2)],
    pack: false
  };
}

export function cosmeticChangesFromDraft(draft = {}) {
  return {
    ...(draft.skin ? { outfit: draft.skin } : {}),
    ...(draft.weapon ? { weapon: draft.weapon } : {}),
    ...(draft.hairColor ? { hairColor: draft.hairColor } : {})
  };
}

const nameOf = (list, id) => {
  const item = list.find((item) => item.id === id);
  return item ? tItem(item, "name") : "";
};

/* ---------- barre supérieure ---------- */

export function renderSheikahTopbar({ view, state, account, unlocked, student }) {
  const teacherTab = view === "board" || view === "lock";
  const themeControl = `<button type="button" class="ghost" data-action="toggle-theme" aria-label="${t("common.changeTheme")}" title="${t("common.changeTheme")}">${ico(document.documentElement.dataset.theme === "light" ? "moon" : "sun")}<span>${t("common.theme")}</span></button>`;
  return `
    <header class="topbar ${view === "welcome" ? "topbar-welcome" : ""}">
      <div class="brand">
        <svg class="seal" viewBox="0 0 48 48" aria-hidden="true"><use href="#seal"/></svg>
        <span class="brand-name">ClassQuest</span>
        <span class="brand-sub">${t("sheikah.brand")}</span>
      </div>
      ${view === "welcome" ? `<div class="top-end">${themeControl}</div>` : `
      <nav class="tabs" aria-label="Classes">
        ${state.classes.map((classroom) => {
          const active = classroom.id === state.activeClassId;
          return `<button type="button" class="${active ? "on" : ""}" data-action="select-class" data-class-id="${escapeHtml(classroom.id)}" aria-pressed="${active}">${escapeHtml(classroom.name)}</button>`;
        }).join("")}
      </nav>
      <div class="top-end">
        <div class="tabs" role="group" aria-label="Interface">
          <button type="button" class="${teacherTab ? "on" : ""}" data-action="show-board" aria-pressed="${teacherTab}">${t("app.aria.teacher")}${unlocked ? "" : " " + ico("lock")}</button>
          <button type="button" class="${student ? "on" : ""}" data-action="show-student" aria-pressed="${student}">${t("app.aria.students")}</button>
        </div>
        ${account?.role === "admin" ? `<button type="button" class="ghost" data-action="show-admin" aria-current="${view === "admin" ? "page" : "false"}" aria-label="${t("app.aria.accounts")}" title="${t("app.aria.accounts")}">${ico("rune")}<span>${t("app.aria.accounts")}</span></button>` : ""}
        ${unlocked ? `<button type="button" class="ghost" data-action="lock-adult" aria-label="${t("console.account.lock")}" title="${t("console.account.lock")}">${ico("lock")}<span>${t("console.account.lock")}</span></button>` : ""}
        <button type="button" class="ghost" data-action="show-rules" aria-current="${view === "rules" ? "page" : "false"}" aria-label="${t("app.aria.rules")}" title="${t("app.aria.rules")}">${ico("book")}<span>${t("app.aria.rules")}</span></button>
        ${themeControl}
        <span class="account-tag" title="${t("app.aria.signedIn", { username: escapeHtml(account?.username || "") })}">${escapeHtml(account?.displayName || "")}</span>
      </div>`}
    </header>`;
}

/* ---------- plateau enseignant ---------- */

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
      <div class="board-bar">
        <div class="board-title">
          <h1>${escapeHtml(classroom.name)}</h1>
          <p class="board-sub">${t("sheikah.classroom")} · <span id="clock">--:--</span></p>
        </div>
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

function renderRuneCard(pupil, selectedIds) {
  const selected = selectedIds.includes(pupil.id);
  const progress = xpProgress(pupil);
  const out = isEliminated(pupil);
  const worth = nameOf(SKINS, pupil.skin);
  return `
    <article class="rune-card ${selected ? "is-selected" : ""} ${out ? "is-out" : ""}" role="listitem">
      <button class="card-hit" type="button" data-action="toggle-pupil" data-pupil-id="${escapeHtml(pupil.id)}" aria-pressed="${selected}" aria-label="${t("board.select", { name: escapeHtml(pupil.name) })}"></button>
      <header class="rune-card-head">
        <h3>${escapeHtml(pupil.name)}</h3>
        <span class="lvl-seal" aria-label="${t("app.aria.level", { level: pupil.level })}">${pupil.level}</span>
      </header>
      <div class="dais dais-card">
        <img class="hero-fig" src="./assets/wardrobe/${pupil.gender === "girl" ? "mila" : "noa"}-portrait.webp" alt="" loading="lazy" />
        ${out ? `<span class="out-tag">${t("common.out")}</span>` : ""}
        <button class="card-open" type="button" data-action="sheikah-open" data-pupil-id="${escapeHtml(pupil.id)}" aria-label="${t("console.hero.zoom", { name: escapeHtml(pupil.name) })}">${ico("expand")}</button>
      </div>
      <p class="hero-role">${escapeHtml(worth)}</p>
      <div class="hearts" role="img" aria-label="${t("app.aria.hp", { hp: pupil.hp, maxHp: pupil.maxHp })}">
        ${Array.from({ length: pupil.maxHp }, (_, i) => `<span class="heart ${i < pupil.hp ? "" : "off"}">${ico("heart")}</span>`).join("")}
      </div>
      <div class="conduit" role="progressbar" aria-label="${t("student.experience")}" aria-valuemin="0" aria-valuemax="${progress.needed}" aria-valuenow="${progress.current}"><i style="--p:${progress.percent}%"></i><span>${progress.current}/${progress.needed}</span></div>
      <footer class="rune-card-foot">
        <span class="coins" aria-label="${t("app.aria.coins", { amount: pupil.money })}">${ico("coin")}${pupil.money}</span>
        <button class="rune-act" type="button" data-action="sheikah-personalize" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>${t("sheikah.workshop")}</span></button>
      </footer>
    </article>`;
}

/* ---------- espace élève ---------- */

export function renderSheikahStudent({ classroom, ui, pupil }) {
  if (!pupil) {
    if (!classroom.pupils.length) {
      return `<main class="single"><div class="empty">${ico("heroes")}<h1>${t("student.noHeroesTitle", { name: escapeHtml(classroom.name) })}</h1><p>${t("sheikah.studentEmpty")}</p></div></main>`;
    }
    const query = (ui.query || "").trim().toLocaleLowerCase();
    const pupils = classroom.pupils.filter(item => item.name.toLocaleLowerCase().includes(query));
    return `
      <main class="single">
        <div class="picker">
          <h1>${t("student.whichHero")}</h1>
          <p class="atelier-sub">${t("student.tapName")}</p>
          <label class="search">${ico("search")}<input type="search" id="roster-search" data-action="search" value="${escapeHtml(ui.query || "")}" placeholder="${t("student.findName")}" aria-label="${t("student.findName")}" autocomplete="off" /></label>
          ${pupils.length ? `
          <div class="picker-grid">
            ${pupils.map((item) => `
              <button type="button" class="picker-card" data-action="student-pick" data-pupil-id="${escapeHtml(item.id)}">
                <img class="picker-portrait" src="./assets/wardrobe/${item.gender === "girl" ? "mila" : "noa"}-portrait.webp" alt="" width="80" height="96" loading="lazy" />
                ${renderLevel(item.level)}
                <strong>${escapeHtml(item.name)}</strong>
                <small>${escapeHtml(nameOf(SKINS, item.skin))}</small>
              </button>`).join("")}
          </div>` : `<div class="empty"><h2>${t("student.noMatchTitle", { query: escapeHtml(ui.query.trim()) })}</h2><button class="btn" data-action="clear-search">${t("student.clearSearch")}</button></div>`}
        </div>
      </main>`;
  }
  return renderSheikahSheet(pupil, ui, { student: true });
}

export function renderSheikahSheet(pupil, ui, { student = false } = {}) {
  const progress = xpProgress(pupil);
  const next = getNextReward(pupil.level);
  const look = wardrobeLook(pupil);
  return `
    <main class="single">
      <header class="hero-page-heading"><h1>${escapeHtml(pupil.name)}</h1><button class="btn" type="button" data-action="${student ? "change-hero" : "sheikah-back"}">${ico("back")}${t(student ? "student.changeHero" : "sheikah.back")}</button></header>
      <div class="sheet">
        <div class="sheet-stage">
          <div class="dais dais-lg" data-viewer-host data-look='${escapeHtml(JSON.stringify(look))}'>
            ${renderViewerFallback(pupil)}
          </div>
          <div class="angle-bar">
            ${["front", "quarter", "back", "outfit", "face"].map((angle) => `<button type="button" class="${(ui.angle || "quarter") === angle ? "on" : ""}" data-action="sheikah-angle" data-value="${angle}" aria-pressed="${(ui.angle || "quarter") === angle}">${t(`view.${angle}`)}</button>`).join("")}
            <button type="button" class="rot ${ui.rotating ? "on" : ""}" data-action="sheikah-rotate" aria-pressed="${ui.rotating}">${ico("rotate")}${t("view.rotation")}</button>
          </div>
          <p class="panel-note">${t("view.simplified")}</p>
        </div>
        <div class="sheet-info">
          ${renderTitle(pupil)}
          <p class="sheet-role">${escapeHtml(nameOf(SKINS, pupil.skin))} · ${escapeHtml(nameOf(HAIR_COLORS, pupil.hairColor))}</p>
          <div class="sheet-stats">
            <div class="stat"><span class="lvl-seal big">${pupil.level}</span><small>${t("common.level")}</small></div>
            <div class="stat">${ico("coin")}<b>${pupil.money}</b><small>${t("common.coins")}</small></div>
            <div class="stat">${ico("star")}<b>${progress.current}/${progress.needed}</b><small>${t("student.experience")}</small></div>
          </div>
          <div class="hearts big" role="img" aria-label="${t("app.aria.hp", { hp: pupil.hp, maxHp: pupil.maxHp })}">${Array.from({ length: pupil.maxHp }, (_, i) => `<span class="heart ${i < pupil.hp ? "" : "off"}">${ico("heart")}</span>`).join("")}</div>
          ${isEliminated(pupil) ? `<p class="alert alert-danger">${t("student.outOfHp")}</p>` : ""}
          <div class="conduit big" role="progressbar" aria-label="${t("student.experience")}" aria-valuemin="0" aria-valuemax="${progress.needed}" aria-valuenow="${progress.current}"><i style="--p:${progress.percent}%"></i></div>
          <p class="sheet-role">${next ? t("student.levelUnlock", { next: next.level, rewards: next.rewards.map(translateReward).map(escapeHtml).join(", ") }) : t("student.allUnlocked")}</p>
          <div class="row">
            <button class="btn btn-primary" data-action="sheikah-personalize" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>${t("sheikah.workshop")}</span></button>
            <button class="btn" data-action="sheikah-shop">${ico("shop")}<span>${t("student.shop")}</span></button>
          </div>
          <details class="equipment-details"><summary>${t("sheikah.equipment")}</summary>${renderSheikahGear(pupil)}${renderCustomOrders(pupil)}</details>
        </div>
      </div>
    </main>`;
}

export function renderSheikahPersonalize(pupil, ui) {
  const draft = wardrobeLook(pupil, ui.draft);
  const owned = (list) => list.filter((item) => item.price === 0 || pupil.ownedItems.includes(item.id));
  const option = (active, field, value, label, extra = "") =>
    `<button type="button" class="rune-choice ${active ? "on" : ""} ${extra}" data-action="sheikah-set" data-field="${field}" data-value="${escapeHtml(value)}" aria-pressed="${active}">${label}</button>`;
  return `
    <main class="single">
      <header class="hero-page-heading"><h1>${escapeHtml(pupil.name)}</h1><span class="panel-note">${t("sheikah.workshopTitle")}</span></header>
      <div class="atelier">
        <div class="atelier-stage">
          <div class="dais dais-lg dais-live" data-viewer-host data-look='${escapeHtml(JSON.stringify(draft))}'>
            ${renderViewerFallback(pupil)}
          </div>
          <p class="panel-note">${t("view.simplified")}</p>
          <div class="angle-bar">
            ${["front", "quarter", "back", "outfit", "face"].map((angle) => `<button type="button" class="${(ui.angle || "quarter") === angle ? "on" : ""}" data-action="sheikah-angle" data-value="${angle}" aria-pressed="${(ui.angle || "quarter") === angle}">${t(`view.${angle}`)}</button>`).join("")}
            <button type="button" class="rot ${ui.rotating ? "on" : ""}" data-action="sheikah-rotate" aria-pressed="${ui.rotating}">${ico("rotate")}${t("view.rotation")}</button>
          </div>
        </div>

        <div class="atelier-panel">
           <p class="atelier-sub">${t("sheikah.workshopHint")}</p>

          <section class="rune-section">
            <p class="label">${t("app.gear.outfit")}</p>
            <div class="rune-row">
              ${owned(SKINS).map((item) => option((ui.draft?.skin || pupil.skin) === item.id, "skin", item.id, escapeHtml(tItem(item, "name")))).join("")}
            </div>
          </section>

          <section class="rune-section">
            <p class="label">${t("app.gear.item")}</p>
            <div class="rune-row">
              ${owned(WEAPONS).map((item) => option((ui.draft?.weapon || pupil.weapon) === item.id, "weapon", item.id, escapeHtml(tItem(item, "name")))).join("")}
            </div>
          </section>

          <section class="rune-section">
            <p class="label">${t("app.gear.hairColor")}</p>
            <div class="rune-row">
              ${owned(HAIR_COLORS).map((item) => option((ui.draft?.hairColor || pupil.hairColor) === item.id, "hairColor", item.id, escapeHtml(tItem(item, "name")))).join("")}
            </div>
          </section>

          <div class="atelier-actions">
            <button class="btn btn-primary btn-lg" data-action="sheikah-equip" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>${t("sheikah.saveLook")}</span></button>
            <button class="btn btn-lg" data-action="sheikah-back">${t("common.cancel")}</button>
          </div>
        </div>
      </div>
    </main>`;
}

function renderViewerFallback(pupil) {
  return `<img class="viewer-fallback" src="./assets/wardrobe/${pupil.gender === "girl" ? "mila" : "noa"}-portrait.webp" alt="${t("view.character", { name: escapeHtml(pupil.name) })}" width="240" height="300" />
    <span class="loader" data-load-bar style="--p:0%" role="status" aria-label="${t("view.loading")}"><i></i></span>
    <div class="viewer-recovery" hidden><p class="viewer-error" role="status"></p><button class="btn" type="button" data-action="retry-viewer">${t("view.retry")}</button></div>`;
}

export function renderSheikahShop(pupil, ui) {
  return `<main class="page page-narrow shop-page">
    <header class="page-heading">
      <div><h1>${t("student.shop")}</h1><p class="lede">${t("student.shopHint")}</p></div>
      <button class="btn" type="button" data-action="shop-back">${ico("back")}${t("shop.backHero")}</button>
    </header>
    <div class="shop-hero-summary">
      <img src="./assets/wardrobe/${pupil.gender === "girl" ? "mila" : "noa"}-portrait.webp" alt="" width="56" height="72" />
      <strong>${escapeHtml(pupil.name)}</strong>${renderLevel(pupil.level)}${renderTitle(pupil)}
    </div>
    ${renderShop(pupil, ui.shopCategory)}
    ${renderCustomOrders(pupil)}
  </main>`;
}

export function renderSheikahGear(pupil) {
  return `
    <dl class="gear">
      ${gearOf(pupil).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
    </dl>`;
}
