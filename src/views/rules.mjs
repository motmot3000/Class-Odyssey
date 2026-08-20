/* ============================================================
   rules.mjs — la page projetée en début d'année
   Les règles du jeu sont celles du projet, mot pour mot ; seule leur
   mise en page change, avec les composants réels du plateau pour que
   l'élève apprenne à lire sa carte en lisant les règles.
   ============================================================ */

import { icon } from "../ui.mjs";

const GAME_RULES = [
  "When you have a good behaviour, you get XP and money.",
  "When you have a bad behaviour, you lose HP.",
  "Everybody starts at LVL 1 with 5 HP.",
  "If you reach 0 HP, you are out of the game!",
  "Level up and you get your HP back.",
  "Every level unlocks new rewards.",
  "You can buy items with your money."
];

const XP_ACTIONS = [
  "Do your homework.",
  "Learn your vocabulary."
];

const MONEY_ACTIONS = [
  "Be nice.",
  "Work well.",
  "Good grades."
];

function renderRuleList(items) {
  return `<ul class="rules-list">
    ${items.map((item) => `<li>${item}</li>`).join("")}
  </ul>`;
}

export function renderRules() {
  return `
    <article class="rules">
      <header class="rules-head">
        <h1>How does it work?</h1>
        <p class="lede">Every pupil has a character with HP, XP and LVL.</p>
      </header>

      <section class="rules-section">
        ${renderRuleList(GAME_RULES)}
      </section>

      <section class="rules-section">
        <h2>How to get XP?</h2>
        ${renderRuleList(XP_ACTIONS)}
      </section>

      <section class="rules-section">
        <h2>How to get money?</h2>
        ${renderRuleList(MONEY_ACTIONS)}
      </section>

      <p class="rules-back">
        <button class="btn btn-primary" type="button" data-action="show-board">${icon("back")}<span>Back to class</span></button>
      </p>
    </article>
  `;
}
