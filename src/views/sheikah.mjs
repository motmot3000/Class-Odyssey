/* ============================================================
   sheikah.mjs — interface « Tablette Sheikah »
   Le plateau, la console, la fiche et l'atelier partagent une seule
   dalle 3D : on ne recharge jamais le modèle, on change son état.
   Les règles du jeu et les actions restent celles de l'app.
   ============================================================ */

import { SKINS, WEAPONS, HAIR_COLORS, xpProgress, isEliminated, getNextReward } from "../domain.mjs";
import { escapeHtml, gearOf } from "../ui.mjs";
import { renderConsole } from "./console.mjs";
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
  return `
    <header class="topbar">
      <div class="brand">
        <svg class="seal" viewBox="0 0 48 48" aria-hidden="true"><use href="#seal"/></svg>
        <span class="brand-name">ClassQuest</span>
        <span class="brand-sub">Tablette Sheikah</span>
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
        ${account?.role === "admin" ? `<button type="button" class="ghost" data-action="show-admin" aria-label="${t("app.aria.accounts")}">${ico("rune")}<span>${t("app.aria.accounts")}</span></button>` : ""}
        ${unlocked ? `<button type="button" class="ghost" data-action="lock-adult" aria-label="${t("console.account.lock")}">${ico("lock")}<span>${t("console.account.lock")}</span></button>` : ""}
        <button type="button" class="ghost" data-action="show-rules" aria-label="${t("app.aria.rules")}">${ico("book")}<span>${t("app.aria.rules")}</span></button>
        <button type="button" class="ghost" data-action="toggle-theme" aria-label="Changer de thème" title="Changer de thème">${ico(document.documentElement.dataset.theme === "light" ? "moon" : "sun")}<span>Thème</span></button>
        <span class="account-tag" title="Connecté : ${escapeHtml(account?.username || "")}">${escapeHtml(account?.displayName || "")}</span>
        ${unlocked ? `<a class="ghost" href="./assets/labs/index.html">${t("app.labs")}</a>` : ""}
      </div>
    </header>`;
}

/* ---------- plateau enseignant ---------- */

export function renderSheikahTeacher({ classroom, ui, targets, focused, canUndo, account, selectedIds = [], events = [], armedReset = false, unlockedUntil = null }) {
  return `
    <main class="layout">
      ${renderSheikahBoard(classroom, ui, selectedIds)}
      <aside class="console ${ui.consoleOpen ? "is-open" : ""}" aria-label="Console de l'enseignant">
        <button class="console-mobile-toggle" type="button" data-action="toggle-console" aria-expanded="${ui.consoleOpen}" aria-controls="teacher-console-body">
          <span>${ico("rune")}Console enseignant</span>
          <strong>${ui.consoleOpen ? "Fermer" : targets.length ? `${targets.length} sélectionné${targets.length > 1 ? "s" : ""}` : "Ouvrir"}</strong>
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
    <section class="board" aria-label="Plateau ${escapeHtml(classroom.name)}">
      <div class="board-bar">
        <div class="board-title">
          <h2>${escapeHtml(classroom.name)}</h2>
          <p class="board-sub">Salle de classe · <span id="clock">--:--</span></p>
        </div>
        <div class="board-stats">
          <span class="chip">${ico("heroes")}<b>${total}</b> héros</span>
          <span class="chip ${out ? "danger" : ""}">${ico("skull")}<b>${out}</b> hors-jeu</span>
          <span class="chip">${ico("star")}<b>${average}</b> niveau moyen</span>
        </div>
        <div class="board-tools">
          <label class="search">${ico("search")}<input type="search" id="roster-search" data-action="search" value="${escapeHtml(ui.query)}" placeholder="Trouver un héros" aria-label="Trouver un héros" /></label>
        </div>
      </div>
      ${pupils.length ? `
        <div class="rune-grid" role="list">
          ${pupils.map((pupil, index) => renderRuneCard(pupil, index, selectedIds)).join("")}
        </div>
      ` : total ? `
        <div class="empty">${ico("search")}<h2>Aucun héros trouvé</h2><p>Essayez un autre prénom ou effacez la recherche.</p><button class="btn" type="button" data-action="clear-search">Effacer la recherche</button></div>
      ` : `
        <div class="empty">${ico("heroes")}<h2>Pas encore de héros</h2><p>Ajoutez un élève depuis la console enseignant.</p></div>
      `}
    </section>`;
}

function renderRuneCard(pupil, index, selectedIds) {
  const selected = selectedIds.includes(pupil.id);
  const progress = xpProgress(pupil);
  const out = isEliminated(pupil);
  const worth = nameOf(SKINS, pupil.skin);
  return `
    <article class="rune-card ${selected ? "is-selected" : ""} ${out ? "is-out" : ""}" role="listitem" style="--delay:${index * 40}ms">
      <button class="card-hit" type="button" data-action="toggle-pupil" data-pupil-id="${escapeHtml(pupil.id)}" aria-pressed="${selected}" aria-label="Sélectionner ${escapeHtml(pupil.name)}"></button>
      <header class="rune-card-head">
        <h3>${escapeHtml(pupil.name)}</h3>
        <span class="lvl-seal">${pupil.level}</span>
      </header>
      <div class="dais dais-card">
        <img class="hero-fig" src="./assets/wardrobe/${pupil.gender === "girl" ? "mila" : "noa"}-portrait.webp" alt="" loading="lazy" />
        ${out ? '<span class="out-tag">Hors-jeu</span>' : ""}
        <button class="card-open" type="button" data-action="sheikah-open" data-pupil-id="${escapeHtml(pupil.id)}" aria-label="Voir la fiche de ${escapeHtml(pupil.name)}">${ico("expand")}</button>
      </div>
      <p class="hero-role">${escapeHtml(worth)}</p>
      <div class="hearts" role="img" aria-label="${pupil.hp} points de vie sur ${pupil.maxHp}">
        ${Array.from({ length: pupil.maxHp }, (_, i) => `<span class="heart ${i < pupil.hp ? "" : "off"}">${ico("heart")}</span>`).join("")}
      </div>
      <div class="conduit" role="progressbar" aria-label="Expérience" aria-valuemin="0" aria-valuemax="${progress.needed}" aria-valuenow="${progress.current}"><i style="--p:${progress.percent}%"></i><span>${progress.current}/${progress.needed}</span></div>
      <footer class="rune-card-foot">
        <span class="coins">${ico("coin")}${pupil.money}</span>
        <button class="rune-act" type="button" data-action="sheikah-personalize" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>Atelier</span></button>
      </footer>
    </article>`;
}

/* ---------- espace élève ---------- */

export function renderSheikahStudent({ classroom, ui, pupil }) {
  if (!pupil) {
    if (!classroom.pupils.length) {
      return `<main class="single"><div class="empty">${ico("heroes")}<h1>Aucun héros dans ${escapeHtml(classroom.name)}</h1><p>L'enseignant doit d'abord ajouter les élèves de cette classe.</p></div></main>`;
    }
    return `
      <main class="single">
        <div class="picker">
          <p class="eyebrow">Espace élève</p>
          <h1>Quel héros est le tien ?</h1>
          <p class="atelier-sub">Touche ton prénom : cet appareil s'en souvient.</p>
          <div class="picker-grid">
            ${classroom.pupils.map((item) => `
              <button type="button" class="picker-card" data-action="student-pick" data-pupil-id="${escapeHtml(item.id)}">
                <span class="lvl-seal">${item.level}</span>
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
  const look = wardrobeLook(pupil);
  return `
    <main class="single">
      <div class="sheet">
        <div class="sheet-stage">
          <div class="dais dais-lg" data-viewer-host data-look='${escapeHtml(JSON.stringify(look))}'>
            <span class="loader" data-load-bar style="--p:0%"><i></i></span>
          </div>
          <div class="angle-bar">
            ${["front", "quarter", "back", "outfit", "face"].map((angle) => `<button type="button" class="${(ui.angle || "quarter") === angle ? "on" : ""}" data-action="sheikah-angle" data-value="${angle}" aria-pressed="${(ui.angle || "quarter") === angle}">${({ front: "Face", quarter: "Trois quarts", back: "Dos", outfit: "Tenue", face: "Visage" })[angle]}</button>`).join("")}
            <button type="button" class="rot ${ui.rotating ? "on" : ""}" data-action="sheikah-rotate" aria-pressed="${ui.rotating}">${ico("rotate")}Rotation</button>
          </div>
        </div>
        <div class="sheet-info">
          <p class="eyebrow">${student ? "Mon héros" : "Fiche de héros"}</p>
          <h1>${escapeHtml(pupil.name)}</h1>
          <p class="sheet-role">${escapeHtml(nameOf(SKINS, pupil.skin))} · ${escapeHtml(nameOf(HAIR_COLORS, pupil.hairColor))}</p>
          <div class="sheet-stats">
            <div class="stat"><span class="lvl-seal big">${pupil.level}</span><small>niveau</small></div>
            <div class="stat">${ico("coin")}<b>${pupil.money}</b><small>pièces</small></div>
            <div class="stat">${ico("star")}<b>${progress.current}/${progress.needed}</b><small>expérience</small></div>
          </div>
          <div class="hearts big" role="img" aria-label="${pupil.hp} points de vie sur ${pupil.maxHp}">${Array.from({ length: pupil.maxHp }, (_, i) => `<span class="heart ${i < pupil.hp ? "" : "off"}">${ico("heart")}</span>`).join("")}</div>
          <div class="conduit big" role="progressbar" aria-label="Expérience" aria-valuemin="0" aria-valuemax="${progress.needed}" aria-valuenow="${progress.current}"><i style="--p:${progress.percent}%"></i></div>
          <p class="sheet-role">${next ? `Niveau ${next.level} débloque ${next.rewards.map(escapeHtml).join(", ")}.` : "Toutes les récompenses sont débloquées."}</p>
          <div class="row">
            <button class="btn btn-primary" data-action="sheikah-personalize" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>Atelier</span></button>
            <button class="btn" data-action="sheikah-shop">${ico("shop")}<span>Boutique</span></button>
            ${student ? `<button class="btn" data-action="change-hero">Changer de héros</button>` : `<button class="btn" data-action="sheikah-back">Retour au plateau</button>`}
          </div>
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
      <div class="atelier">
        <div class="atelier-stage">
          <div class="dais dais-lg dais-live" data-viewer-host data-look='${escapeHtml(JSON.stringify(draft))}'>
            <span class="loader" data-load-bar style="--p:0%"><i></i></span>
          </div>
          <div class="angle-bar">
            ${["front", "quarter", "back", "outfit", "face"].map((angle) => `<button type="button" class="${(ui.angle || "quarter") === angle ? "on" : ""}" data-action="sheikah-angle" data-value="${angle}" aria-pressed="${(ui.angle || "quarter") === angle}">${({ front: "Face", quarter: "Trois quarts", back: "Dos", outfit: "Tenue", face: "Visage" })[angle]}</button>`).join("")}
            <button type="button" class="rot ${ui.rotating ? "on" : ""}" data-action="sheikah-rotate" aria-pressed="${ui.rotating}">${ico("rotate")}Rotation</button>
          </div>
        </div>

        <div class="atelier-panel">
          <p class="eyebrow">Atelier de personnalisation</p>
          <h1>${escapeHtml(pupil.name)}</h1>
          <p class="atelier-sub">Compose la silhouette, puis scelle la tenue sur le plateau.</p>

          <section class="rune-section">
            <p class="label">Tenue</p>
            <div class="rune-row">
              ${owned(SKINS).map((item) => option((ui.draft?.skin || pupil.skin) === item.id, "skin", item.id, escapeHtml(item.name))).join("")}
            </div>
          </section>

          <section class="rune-section">
            <p class="label">Objet</p>
            <div class="rune-row">
              ${owned(WEAPONS).map((item) => option((ui.draft?.weapon || pupil.weapon) === item.id, "weapon", item.id, escapeHtml(item.name))).join("")}
            </div>
          </section>

          <section class="rune-section">
            <p class="label">Couleur de cheveux</p>
            <div class="rune-row">
              ${owned(HAIR_COLORS).map((item) => option((ui.draft?.hairColor || pupil.hairColor) === item.id, "hairColor", item.id, escapeHtml(item.name))).join("")}
            </div>
          </section>

          <div class="atelier-actions">
            <button class="btn btn-primary btn-lg" data-action="sheikah-equip" data-pupil-id="${escapeHtml(pupil.id)}">${ico("rune")}<span>Sceller la tenue</span></button>
            <button class="btn btn-lg" data-action="sheikah-back">Annuler</button>
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
