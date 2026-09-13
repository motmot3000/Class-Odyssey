/* ============================================================
   rules.mjs — la page projetée en début d'année
   Les règles du jeu sont celles du projet, mot pour mot ; seule leur
   mise en page change, avec les composants réels du plateau pour que
   l'élève apprenne à lire sa carte en lisant les règles.
   ============================================================ */

import { icon } from "../ui.mjs";
import { t } from "../i18n.mjs";

function renderRuleList(keys) {
  return `<ul class="rules-list">
    ${keys.map((key) => `<li>${t(key)}</li>`).join("")}
  </ul>`;
}

export function renderRules() {
  return `
    <article class="rules">
      <header class="rules-head">
        <h1>${t("rules.title.how")}</h1>
        <p class="lede">${t("rules.lede")}</p>
      </header>

      <section class="rules-section">
        ${renderRuleList(["rules.game.0", "rules.game.1", "rules.game.2", "rules.game.3", "rules.game.4", "rules.game.5", "rules.game.6"])}
      </section>

      <section class="rules-section">
        <h2>${t("rules.title.xp")}</h2>
        ${renderRuleList(["rules.xp.0", "rules.xp.1"])}
      </section>

      <section class="rules-section">
        <h2>${t("rules.title.money")}</h2>
        ${renderRuleList(["rules.money.0", "rules.money.1", "rules.money.2"])}
      </section>

      <p class="rules-back">
        <button class="btn btn-primary" type="button" data-action="show-board">${icon("back")}<span>${t("rules.back")}</span></button>
      </p>
    </article>
  `;
}
