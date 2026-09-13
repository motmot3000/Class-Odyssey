/* ============================================================
   student.mjs — l'écran des élèves
   Deux temps : je me retrouve dans la classe, puis je gère mon héros.
   Aucune attribution d'XP ici : récompenser reste un geste d'enseignant.
   ============================================================ */

import { getNextReward, isEliminated, xpProgress } from "../domain.mjs";
import { renderBaseCharacter as renderHero, baseStageAttributes as heroStageAttributes } from "../characters.mjs";
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

export function renderStudentPicker(classroom, ui) {
  if (classroom.pupils.length === 0) {
    return `
      <section class="student-view">
        <div class="empty-state">
          <h3>No heroes in ${escapeHtml(classroom.name)} yet</h3>
          <p>Your teacher has not created the heroes for this class. Check the other class tab, or come back next lesson.</p>
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
        <h2>Which hero is yours?</h2>
        <p>Tap your name. This device remembers you next time.</p>
        <div class="search">
          ${icon("search")}
          <input
            type="search"
            id="roster-search"
            data-action="search"
            value="${escapeHtml(ui.query)}"
            placeholder="Find your name"
            aria-label="Find your name"
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
          <h3>No name matches “${escapeHtml(ui.query.trim())}”</h3>
          <button class="btn" type="button" data-action="clear-search">Clear search</button>
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
        aria-label="Open ${escapeHtml(pupil.name)}'s hero"
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
          ${icon("back")}<span>Change hero</span>
        </button>
        <p class="panel-note">This device is showing <strong>${escapeHtml(pupil.name)}</strong>. Tap the button if this is not you.</p>
      </div>

      <div class="locker ${statusClass(pupil)}">
      <div class="locker-hero">
        <div class="locker-art" ${heroStageAttributes(pupil)}>
          ${renderHero(pupil, { large: true })}
          ${renderOutBadge(pupil)}
          <button type="button" class="btn btn-sm base-character-open" data-action="zoom-pupil" data-pupil-id="${escapeHtml(pupil.id)}">${icon("expand")}<span>View in 3D</span></button>
        </div>

        <div class="locker-facts">
          <header class="locker-name">
            <h2>${escapeHtml(pupil.name)}</h2>
            ${renderLevel(pupil.level)}
          </header>
          ${renderTitle(pupil)}

          <div class="locker-stat">
            <h3 class="section-label">Hit points</h3>
            ${renderHearts(pupil)}
          </div>

          <div class="locker-stat">
            <h3 class="section-label">Experience</h3>
            ${renderXpBar(pupil)}
            <p class="panel-note">${progress.needed - progress.current} XP to reach level ${pupil.level + 1}.</p>
          </div>

          <div class="locker-stat">
            <h3 class="section-label">Coins</h3>
            ${renderMoney(pupil.money)}
          </div>

          <dl class="gear">
            ${gearOf(pupil).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
          </dl>
          ${renderCustomOrders(pupil)}

          ${isEliminated(pupil)
            ? `<p class="alert alert-danger">You are out of HP. Level up or ask your teacher to restore hit points to get back in the game.</p>`
            : ""}

          <p class="panel-note">${next
            ? `Level ${next.level} unlocks ${next.rewards.map(escapeHtml).join(", ")}.`
            : "You have unlocked every reward."}</p>
        </div>
      </div>

      <div class="locker-shop">
        <h2 class="section-heading">Shop</h2>
        <p class="panel-note">Buy once, then equip and swap whenever you like.</p>
        ${renderShop(pupil, ui.shopCategory)}
      </div>
      </div>
    </section>
  `;
}
