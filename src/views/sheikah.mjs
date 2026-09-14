/* ============================================================
   sheikah.mjs — interface « Tablette Sheikah »
   Le plateau, la console, la fiche et l'atelier partagent une seule
   dalle 3D : on ne recharge jamais le modèle, on change son état.
   Les règles du jeu et les actions restent celles de l'app.
   ============================================================ */

import { HATS, HAIRS, SKINS, WEAPONS, HAIR_COLORS, getShopItem, xpProgress, isEliminated, getNextReward } from "../domain.mjs";
import { escapeHtml, gearOf, translateReward } from "../ui.mjs";
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
    check: `<path d="m5 10 3.5 3.5L15 6.5"/>`,
    menu: `<path d="M4 5h12M4 10h12M4 15h12"/>`,
    shop: `<path d="M4 7.5h12l-1 8.5H5z"/><path d="M7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5"/>`
  };
  const path = paths[name];
  if (!path) return "";
  return `<svg class="ic ${cls}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
};

export const SHEIKAH_ANGLES = ["front", "quarter", "back", "head", "item"];

/* Champs du look qui correspondent à un modèle du catalogue items-3d. */
export const SHOP_FIELD = { outfit: "skin", hat: "hat", weapon: "weapon", hair: "hair", hairColor: "hairColor" };

/* Traduit les cosmétiques de l'app vers le look du catalogue 3D. C'est la
   source unique : la fiche, l'atelier et la boutique montrent tous le même
   personnage équipé des objets réels du jeu. */
export function gameLook(pupil, draft = null) {
  const value = (field) => draft?.[field] || pupil[field];
  return {
    persona: pupil.gender === "girl" ? "female" : "male",
    skin: value("skin"),
    hat: value("hat"),
    weapon: value("weapon"),
    hair: value("hair"),
    hairColor: value("hairColor")
  };
}

/* Aperçu boutique : le look du héros, avec l'article survolé/sélectionné
   appliqué quand il a un modèle 3D. Les catégories sans modèle (teinte,
   visage, titre) gardent la silhouette inchangée. */
export function shopPreviewLook(pupil, ui = {}) {
  const item = ui.shopPreview ? getShopItem(ui.shopPreview) : null;
  const field = item ? SHOP_FIELD[item.type] : null;
  return gameLook(pupil, field ? { [field]: item.id } : null);
}

export function cosmeticChangesFromDraft(draft = {}) {
  return {
    ...(draft.skin ? { outfit: draft.skin } : {}),
    ...(draft.hat ? { hat: draft.hat } : {}),
    ...(draft.weapon ? { weapon: draft.weapon } : {}),
    ...(draft.hair ? { hair: draft.hair } : {}),
    ...(draft.hairColor ? { hairColor: draft.hairColor } : {})
  };
}

const nameOf = (list, id) => {
  const item = list.find((item) => item.id === id);
  return item ? tItem(item, "name") : "";
};

/* Barre d'angles partagée par la fiche, l'atelier et la boutique. Les vues
   correspondent aux cadrages du catalogue items-3d. */
function renderAngleBar(ui) {
  const active = ui.angle || "quarter";
  return `<div class="angle-bar">
    ${SHEIKAH_ANGLES.map((angle) => `<button type="button" class="${active === angle ? "on" : ""}" data-action="sheikah-angle" data-value="${angle}" aria-pressed="${active === angle}">${t(`view.${angle}`)}</button>`).join("")}
    <button type="button" class="rot ${ui.rotating ? "on" : ""}" data-action="sheikah-rotate" aria-pressed="${ui.rotating}">${ico("rotate")}${t("view.rotation")}</button>
  </div>`;
}

function renderViewerHost(look, { live = false } = {}) {
  return `<div class="dais dais-lg${live ? " dais-live" : ""}" data-viewer-host data-look='${escapeHtml(JSON.stringify(look))}'>
    <span class="loader" data-load-bar style="--p:0%"><i></i></span>
  </div>`;
}

/* ---------- barre supérieure ---------- */

export function renderSheikahTopbar({ view, state, account, unlocked, student }) {
  const teacherTab = view === "board" || view === "lock";
  return `
    <header class="topbar">
      <div class="brand">
        <svg class="seal" viewBox="0 0 48 48" aria-hidden="true"><use href="#seal"/></svg>
        <span class="brand-wordmark"><span class="brand-name">ClassQuest</span><span class="brand-sub">${t("sheikah.brand")}</span></span>
      </div>
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
        <button type="button" class="ghost" data-action="show-rules" aria-label="${t("app.aria.rules")}" title="${t("app.aria.rules")}">${ico("book")}<span>${t("app.aria.rules")}</span></button>
        <button type="button" class="ghost" data-action="toggle-theme" aria-label="${t("common.changeTheme")}" title="${t("common.changeTheme")}">${ico(document.documentElement.dataset.theme === "light" ? "moon" : "sun")}<span>${t("common.theme")}</span></button>
        <details class="tablet-tools">
          <summary class="ghost" aria-label="${t("sheikah.tools")}" title="${t("sheikah.tools")}">${ico("menu")}</summary>
          <div class="tablet-tools-menu">
            <span class="account-tag" title="${t("app.aria.signedIn", { username: escapeHtml(account?.username || "") })}">${escapeHtml(account?.displayName || "")}</span>
            ${account?.role === "admin" ? `<button type="button" class="ghost" data-action="show-admin">${ico("rune")}<span>${t("app.aria.accounts")}</span></button>` : ""}
            ${unlocked ? `<button type="button" class="ghost" data-action="lock-adult">${ico("lock")}<span>${t("console.account.lock")}</span></button>` : ""}
            ${unlocked ? `<a class="ghost" href="./assets/labs/index.html">${ico("rune")}<span>${t("app.labs")}</span></a>` : ""}
          </div>
        </details>
      </div>
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
      <div class="board-heading">
        <span class="class-seal">${escapeHtml(classroom.name)}</span>
        <div class="board-title">
          <h1>${t("sheikah.roster")}</h1>
          <p class="board-sub">${t("sheikah.classroom")} · <span id="clock">--:--</span></p>
        </div>
        <span class="tablet-inscription" aria-hidden="true"></span>
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
        <div class="empty">${ico("heroes")}<h2>${t("sheikah.noHeroes")}</h2><p>${t("sheikah.noHeroesHint")}</p></div>
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
        <div class="rune-card-name"><h2>${escapeHtml(pupil.name)}</h2><p class="hero-role">${escapeHtml(worth)}</p></div>
        <span class="lvl-seal" aria-label="${t("app.aria.level", { level: pupil.level })}"><small>${t("common.levelShort")}</small><b>${pupil.level}</b></span>
      </header>
      <div class="dais dais-card">
        <img class="hero-fig" src="./assets/wardrobe/${pupil.gender === "girl" ? "mila" : "noa"}-portrait.webp" alt="" loading="lazy" />
        <span class="selection-mark" aria-hidden="true">${ico("check")}</span>
        ${out ? `<span class="out-tag">${t("common.out")}</span>` : ""}
        <button class="card-open" type="button" data-action="sheikah-open" data-pupil-id="${escapeHtml(pupil.id)}" aria-label="${t("console.hero.zoom", { name: escapeHtml(pupil.name) })}">${ico("expand")}</button>
      </div>
      <div class="rune-vitals">
        <div class="hearts" role="img" aria-label="${t("app.aria.hp", { hp: pupil.hp, maxHp: pupil.maxHp })}">
          ${Array.from({ length: pupil.maxHp }, (_, i) => `<span class="heart ${i < pupil.hp ? "" : "off"}">${ico("heart")}</span>`).join("")}
        </div>
        <div class="rune-xp-label"><span>XP</span><span>${progress.current}<span class="xp-needed"> / ${progress.needed}</span></span></div>
        <div class="conduit" role="progressbar" aria-label="${t("student.experience")}" aria-valuemin="0" aria-valuemax="${progress.needed}" aria-valuenow="${progress.current}"><i style="--progress:${progress.percent / 100}"></i></div>
      </div>
      <footer class="rune-card-foot">
        <span class="coins">${ico("coin")}${pupil.money}</span>
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
    return `
      <main class="single">
        <div class="picker">
          <h1>${t("student.whichHero")}</h1>
          <p class="atelier-sub">${t("sheikah.studentSpace")} · ${t("student.tapName")}</p>
          <div class="picker-grid">
            ${classroom.pupils.map((item) => `
              <button type="button" class="picker-card" data-action="student-pick" data-pupil-id="${escapeHtml(item.id)}">
                <img class="picker-portrait" src="./assets/wardrobe/${item.gender === "girl" ? "mila" : "noa"}-portrait.webp" alt="" loading="lazy" />
                <span class="lvl-seal" aria-label="${t("app.aria.level", { level: item.level })}"><small>${t("common.levelShort")}</small><b>${item.level}</b></span>
                <strong>${escapeHtml(item.name)}</strong>
                <small>${escapeHtml(nameOf(SKINS, item.skin))}</small>
              </button>`).join("")}
          </div>
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
          ${renderViewerHost(look)}
          ${renderAngleBar(ui)}
        </div>
        <div class="sheet-info">
          <p class="sheet-role">${escapeHtml(nameOf(SKINS, pupil.skin))} · ${escapeHtml(nameOf(HAIR_COLORS, pupil.hairColor))}</p>
          <div class="sheet-stats">
            <div class="stat"><span class="lvl-seal big">${pupil.level}</span><small>${t("common.level")}</small></div>
            <div class="stat">${ico("coin")}<b>${pupil.money}</b><small>${t("common.coins")}</small></div>
            <div class="stat">${ico("star")}<b>${progress.current}/${progress.needed}</b><small>${t("student.experience")}</small></div>
          </div>
          <div class="hearts big" role="img" aria-label="${t("app.aria.hp", { hp: pupil.hp, maxHp: pupil.maxHp })}">${Array.from({ length: pupil.maxHp }, (_, i) => `<span class="heart ${i < pupil.hp ? "" : "off"}">${ico("heart")}</span>`).join("")}</div>
          <div class="conduit big" role="progressbar" aria-label="${t("student.experience")}" aria-valuemin="0" aria-valuemax="${progress.needed}" aria-valuenow="${progress.current}"><i style="--progress:${progress.percent / 100}"></i></div>
          <p class="sheet-role">${next ? t("student.levelUnlock", { next: next.level, rewards: next.rewards.map(translateReward).map(escapeHtml).join(", ") }) : t("student.allUnlocked")}</p>
          <div class="row">
            <button class="btn btn-primary" data-action="sheikah-personalize" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>${t("sheikah.workshop")}</span></button>
            <button class="btn" data-action="sheikah-shop" data-pupil-id="${escapeHtml(pupil.id)}">${ico("shop")}<span>${t("student.shop")}</span></button>
            ${student ? `<button class="btn" data-action="change-hero">${t("student.changeHero")}</button>` : `<button class="btn" data-action="sheikah-back">${t("sheikah.back")}</button>`}
          </div>
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
          <h1>${escapeHtml(pupil.name)}</h1>
          <p class="sheet-context">${t("sheikah.workshopTitle")}</p>
        </header>
        <div class="atelier-stage">
          ${renderViewerHost(draft, { live: true })}
          ${renderAngleBar(ui)}
        </div>

        <div class="atelier-panel">
          <p class="atelier-sub">${t("sheikah.workshopHint")}</p>

          ${section(t("app.gear.outfit"), SKINS, "skin")}
          ${section(t("app.gear.hat"), HATS, "hat")}
          ${section(t("app.gear.item"), WEAPONS, "weapon")}
          ${section(t("app.gear.hair"), HAIRS, "hair")}
          ${section(t("app.gear.hairColor"), HAIR_COLORS, "hairColor")}

          <div class="atelier-actions">
            <button class="btn btn-primary btn-lg" data-action="sheikah-equip" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>${t("sheikah.saveLook")}</span></button>
            <button class="btn btn-lg" data-action="sheikah-back">${t("common.cancel")}</button>
          </div>
        </div>
      </div>
    </main>`;
}

/* ---------- boutique dans la tablette ---------- */

export function renderSheikahShop(pupil, ui) {
  const look = shopPreviewLook(pupil, ui);
  const active = ui.shopCategory || "outfit";
  return `
    <main class="single">
      <div class="atelier">
        <header class="sheet-heading">
          <h1>${escapeHtml(pupil.name)}</h1>
          <p class="sheet-context">${t("student.shop")}</p>
        </header>
        <div class="atelier-stage">
          ${renderViewerHost(look)}
          ${renderAngleBar(ui)}
        </div>

        <div class="atelier-panel">
          <p class="atelier-sub">${t("student.shopHint")}</p>
          ${renderShop(pupil, active, ui.shopPreview)}
          <div class="atelier-actions">
            <button class="btn btn-lg" data-action="sheikah-back">${t("sheikah.back")}</button>
          </div>
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
