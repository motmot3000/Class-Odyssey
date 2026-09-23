/* Legacy pupil views retained for compatibility. The active picker, sheet,
 * workshop and shop live in views/odyssey.mjs; rewards remain teacher actions.
 */

import { getNextReward, isEliminated, xpProgress } from "../domain.mjs";
import { renderBaseCharacter as renderHero, baseStageAttributes as heroStageAttributes } from "../characters.mjs";
import { t } from "../i18n.mjs";
import {
  escapeHtml,
  gearOf,
  icon,
  renderHearts,
  renderCustomOrders,
  renderLevel,
  renderMoney,
  renderOutBadge,
  renderTitle,
  renderXpBar,
  statusClass
} from "../ui.mjs";
import { renderShop } from "./shop.mjs";
import { translateReward } from "../ui.mjs";

export function renderStudentPicker(classroom, ui) {
  if (classroom.pupils.length === 0) {
    return `
      <section class="student-view">
        <div class="empty-state">
          <h3>${t("student.noHeroesTitle", { name: escapeHtml(classroom.name) })}</h3>
          <p>${t("student.noHeroesBody")}</p>
        </div>
      </section>
    `;
  }

  const needle = ui.query.trim().toLowerCase();
  const pupils = needle
    ? classroom.pupils.filter((pupil) => pupil.name.toLowerCase().includes(needle))
    : classroom.pupils;

  return `
    <section class="student-view">
      <header class="picker-head">
        <h2>${t("student.whichHero")}</h2>
        <p>${t("student.tapName")}</p>
        <div class="search">
          ${icon("search")}
          <input
            type="search"
            id="roster-search"
            data-action="search"
            value="${escapeHtml(ui.query)}"
            placeholder="${t("student.findName")}"
            aria-label="${t("student.findName")}"
            autocomplete="off"
          />
        </div>
      </header>

      ${pupils.length ? `
        <div class="roster-grid roster-grid-pick" role="list">
          ${pupils.map(renderPickCard).join("")}
        </div>
      ` : `
        <div class="empty-state">
          <h3>${t("student.noMatchTitle", { query: escapeHtml(ui.query.trim()) })}</h3>
          <button class="btn" type="button" data-action="clear-search">${t("student.clearSearch")}</button>
        </div>
      `}
    </section>
  `;
}

function renderPickCard(pupil) {
  return `
    <article class="hero-card is-pick ${statusClass(pupil)}" role="listitem">
      <button
        class="card-hit"
        type="button"
        data-action="student-pick"
        data-pupil-id="${escapeHtml(pupil.id)}"
        aria-label="${t("student.open", { name: escapeHtml(pupil.name) })}"
      ></button>
      <header class="hero-card-head">
        <h3>${escapeHtml(pupil.name)}</h3>
        ${renderLevel(pupil.level)}
      </header>
      <div class="hero-card-art" ${heroStageAttributes(pupil)}>
        ${renderHero(pupil)}
        ${renderOutBadge(pupil)}
      </div>
      ${renderTitle(pupil)}
      <div class="hero-card-stats">
        ${renderHearts(pupil)}
        ${renderXpBar(pupil)}
      </div>
      <footer class="hero-card-foot">${renderMoney(pupil.money)}</footer>
    </article>
  `;
}

export function renderStudentLocker(pupil, ui) {
  const progress = xpProgress(pupil);
  const next = getNextReward(pupil.level);

  return `
    <section class="student-view">
      <div class="student-back">
        <button class="btn btn-primary" type="button" data-action="change-hero">
          ${icon("back")}<span>${t("student.changeHero")}</span>
        </button>
        <p class="panel-note">${t("student.showing", { name: escapeHtml(pupil.name) })}</p>
      </div>

      <div class="locker ${statusClass(pupil)}">
      <div class="locker-hero">
        <div class="locker-art" ${heroStageAttributes(pupil)}>
          ${renderHero(pupil, { large: true })}
          ${renderOutBadge(pupil)}
          <button type="button" class="btn btn-sm base-character-open" data-action="zoom-pupil" data-pupil-id="${escapeHtml(pupil.id)}">${icon("expand")}<span>${t("view.open")}</span></button>
        </div>

        <div class="locker-facts">
          <header class="locker-name">
            <h2>${escapeHtml(pupil.name)}</h2>
            ${renderLevel(pupil.level)}
          </header>
          ${renderTitle(pupil)}

          <div class="locker-stat">
            <h3 class="section-label">${t("student.hitPoints")}</h3>
            ${renderHearts(pupil)}
          </div>

          <div class="locker-stat">
            <h3 class="section-label">${t("student.experience")}</h3>
            ${renderXpBar(pupil)}
            <p class="panel-note">${t("student.xpToLevel", { xp: progress.needed - progress.current, level: pupil.level + 1 })}</p>
          </div>

          <div class="locker-stat">
            <h3 class="section-label">${t("student.coins")}</h3>
            ${renderMoney(pupil.money)}
          </div>

          <dl class="gear">
            ${gearOf(pupil).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
          </dl>
          ${renderCustomOrders(pupil)}

          ${isEliminated(pupil)
            ? `<p class="alert alert-danger">${t("student.outOfHp")}</p>`
            : ""}

          <p class="panel-note">${next
            ? t("student.levelUnlock", { next: next.level, rewards: next.rewards.map(translateReward).map(escapeHtml).join(", ") })
            : t("student.allUnlocked")}</p>
        </div>
      </div>

      <div class="locker-shop">
        <h2 class="section-heading">${t("student.shop")}</h2>
        <p class="panel-note">${t("student.shopHint")}</p>
        ${renderShop(pupil, ui.shopCategory)}
      </div>
      </div>
    </section>
  `;
}
