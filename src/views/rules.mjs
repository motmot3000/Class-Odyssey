/* Classroom rules: layout can evolve, but the existing text and reading order
 * are contractual. The bilingual copy regression test protects that constraint.
 */

import { icon } from "../ui.mjs";
import { t } from "../i18n.mjs";

function renderRuleList(keys) {
  return `<ul class="rules-list">
    ${keys.map((key) => `<li>${t(key)}</li>`).join("")}
  </ul>`;
}

export function renderRules({ unlocked = true } = {}) {
  return `
    <article class="rules">
      <header class="rules-head">
        <span class="rules-emblem" aria-hidden="true">${icon('bookOpen')}</span>
        <div class="rules-heading-copy">
        <h1>${t("rules.title.how")}</h1>
        <p class="lede">${t("rules.lede")}</p>
        </div>
      </header>

      <section class="rules-section rules-journey">
        ${renderRuleList(["rules.game.0", "rules.game.1", "rules.game.2", "rules.game.3", "rules.game.4", "rules.game.5", "rules.game.6"])}
      </section>

      <div class="rules-rewards">
      <section class="rules-section rules-xp">
        <h2><span class="rule-symbol" aria-hidden="true">${icon('spark')}</span>${t("rules.title.xp")}</h2>
        ${renderRuleList(["rules.xp.0", "rules.xp.1"])}
      </section>

      <section class="rules-section rules-money">
        <h2><span class="rule-symbol" aria-hidden="true">${icon('coin')}</span>${t("rules.title.money")}</h2>
        ${renderRuleList(["rules.money.0", "rules.money.1", "rules.money.2"])}
      </section>
      </div>

      <p class="rules-back">
          <button class="btn btn-primary" type="button" data-action="${unlocked ? "show-board" : "show-student"}">${icon("back")}<span>${t(unlocked ? "rules.back" : "lock.action.back")}</span></button>
      </p>
    </article>
  `;
}
