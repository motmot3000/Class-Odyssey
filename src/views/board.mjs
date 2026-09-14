/* Legacy grid/list renderer retained for compatibility and regression tests.
 * The live Sheikah board is rendered by views/sheikah.mjs.
 */

import { isEliminated } from "../domain.mjs";
import { renderBaseCharacter as renderHero, baseStageAttributes as heroStageAttributes } from "../characters.mjs";
import {
  escapeHtml,
  icon,
  renderHearts,
  renderLevel,
  renderMoney,
  renderOutBadge,
  renderTitle,
  renderXpBar,
  statusClass
} from "../ui.mjs";
import { t } from "../i18n.mjs";

const LIST_THRESHOLD = 24;

export function renderBoard(classroom, ui, selectedIds) {
  const pupils = filterPupils(classroom.pupils, ui.query);
  const density = resolveDensity(ui.density, pupils.length);

  return `
    <section class="board" aria-label="${t("board.roster", { name: escapeHtml(classroom.name) })}">
      ${renderBoardBar(classroom, ui, density, pupils.length)}
      ${renderRoster(classroom, pupils, ui, selectedIds, density)}
    </section>
  `;
}

export function resolveDensity(preference, total) {
  if (preference === "grid" || preference === "list") return preference;
  return total > LIST_THRESHOLD ? "list" : "grid";
}

function filterPupils(pupils, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return pupils;
  return pupils.filter((pupil) => pupil.name.toLowerCase().includes(needle));
}

function renderBoardBar(classroom, ui, density, shown) {
  const total = classroom.pupils.length;
  const out = classroom.pupils.filter(isEliminated).length;
  const average = total ? (classroom.pupils.reduce((sum, p) => sum + p.level, 0) / total).toFixed(1) : "0.0";

  return `
    <div class="board-bar">
      <div class="board-bar-stats">
        <h2 class="board-title">${escapeHtml(classroom.name)}</h2>
        <p class="chip"><strong>${total}</strong> ${t("board.heroes", { n: total })}</p>
        <p class="chip ${out ? "chip-danger" : ""}"><strong>${out}</strong> ${t("board.out", { n: out })}</p>
        <p class="chip"><span>${t("board.avgLevel")}</span><strong>${average}</strong></p>
      </div>
      <div class="board-bar-tools">
        <div class="search">
          ${icon("search")}
          <input
            type="search"
            id="roster-search"
            data-action="search"
            value="${escapeHtml(ui.query)}"
            placeholder="${t("board.searchPlaceholder")}"
            aria-label="${t("board.searchAria")}"
            autocomplete="off"
          />
        </div>
        <div class="segmented" role="group" aria-label="${t("board.density")}">
          <button type="button" class="${density === "grid" ? "is-active" : ""}" data-action="density" data-density="grid" aria-pressed="${density === "grid"}">${icon("grid")}<span>${t("board.grid")}</span></button>
          <button type="button" class="${density === "list" ? "is-active" : ""}" data-action="density" data-density="list" aria-pressed="${density === "list"}">${icon("list")}<span>${t("board.list")}</span></button>
        </div>
      </div>
      ${ui.query.trim() ? `<p class="board-bar-note">${t("board.match", { shown, total, query: escapeHtml(ui.query.trim()) })}</p>` : ""}
    </div>
  `;
}

function renderRoster(classroom, pupils, ui, selectedIds, density) {
  if (classroom.pupils.length === 0) {
    return `
      <div class="empty-state">
        <h3>${t("board.emptyTitle", { name: escapeHtml(classroom.name) })}</h3>
        <p>${t("board.emptyBody")}</p>
        <button class="btn btn-primary" type="button" data-action="focus-add">${t("board.emptyAction")}</button>
      </div>
    `;
  }

  if (pupils.length === 0) {
    return `
      <div class="empty-state">
        <h3>${t("board.noMatchTitle", { query: escapeHtml(ui.query.trim()) })}</h3>
        <p>${t("board.noMatchBody")}</p>
        <button class="btn" type="button" data-action="clear-search">${t("board.clearSearch")}</button>
      </div>
    `;
  }

  if (density === "list") {
    return `
      <div class="roster-list" role="list">
        ${pupils.map((pupil) => renderRow(pupil, selectedIds.includes(pupil.id))).join("")}
      </div>
    `;
  }

  return `
    <div class="roster-grid" role="list">
      ${pupils.map((pupil) => renderCard(pupil, selectedIds.includes(pupil.id))).join("")}
    </div>
  `;
}

/* A real selection button sits under the card content. This exposes pressed
 * state to assistive technology while leaving the separate zoom button usable.
 */
function renderCard(pupil, selected) {
  return `
    <article class="hero-card ${selected ? "is-selected" : ""} ${statusClass(pupil)}" role="listitem">
      <button
        class="card-hit"
        type="button"
        data-action="toggle-pupil"
        data-pupil-id="${escapeHtml(pupil.id)}"
        aria-pressed="${selected}"
        aria-label="${t("board.select", { name: escapeHtml(pupil.name) })}"
      ></button>

      <header class="hero-card-head">
        <h3>${escapeHtml(pupil.name)}</h3>
        ${renderLevel(pupil.level)}
      </header>

      <div class="hero-card-art" ${heroStageAttributes(pupil)}>
        ${renderHero(pupil)}
        ${renderOutBadge(pupil)}
        <button
          class="card-zoom"
          type="button"
          data-action="zoom-pupil"
          data-pupil-id="${escapeHtml(pupil.id)}"
          aria-label="${t("board.show", { name: escapeHtml(pupil.name) })}"
        >${icon("expand")}</button>
      </div>

      ${renderTitle(pupil)}

      <div class="hero-card-stats">
        ${renderHearts(pupil)}
        ${renderXpBar(pupil)}
      </div>

      <footer class="hero-card-foot">
        ${renderMoney(pupil.money)}
      </footer>

      <span class="card-check" aria-hidden="true">${icon("check")}</span>
    </article>
  `;
}

function renderRow(pupil, selected) {
  return `
    <article class="hero-row ${selected ? "is-selected" : ""} ${statusClass(pupil)}" role="listitem">
      <button
        class="card-hit"
        type="button"
        data-action="toggle-pupil"
        data-pupil-id="${escapeHtml(pupil.id)}"
        aria-pressed="${selected}"
        aria-label="${t("board.select", { name: escapeHtml(pupil.name) })}"
      ></button>
      <span class="row-check" aria-hidden="true">${icon("check")}</span>
      <div class="row-art" ${heroStageAttributes(pupil)}>${renderHero(pupil)}</div>
      <h3 class="row-name">${escapeHtml(pupil.name)}</h3>
      ${renderLevel(pupil.level)}
      ${renderHearts(pupil)}
      ${renderXpBar(pupil)}
      ${renderMoney(pupil.money)}
      <button
        class="card-zoom"
        type="button"
        data-action="zoom-pupil"
        data-pupil-id="${escapeHtml(pupil.id)}"
        aria-label="${t("board.show", { name: escapeHtml(pupil.name) })}"
      >${icon("expand")}</button>
    </article>
  `;
}
