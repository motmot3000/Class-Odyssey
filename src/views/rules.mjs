/* Classroom rules. The three lists are account data so teachers can adapt them;
 * existing accounts keep the current copy through defaultRules(). The layout and
 * reading order stay the same. app.mjs owns persistence and edit mode.
 */

import { escapeHtml, icon } from "../ui.mjs";
import { defaultRules, getLang, t } from "../i18n.mjs";

function ruleText(rule) {
  if (!rule) return "";
  const lang = getLang();
  return (lang === "fr" ? rule.fr : rule.en) || rule.fr || rule.en || "";
}

function renderList(section, rules, editing) {
  if (!editing) {
    if (!rules.length) return `<p class="rules-empty">${t("rules.empty")}</p>`;
    return `<ul class="rules-list">
      ${rules.map((rule) => `<li>${escapeHtml(ruleText(rule))}</li>`).join("")}
    </ul>`;
  }

  return `<ul class="rules-list rules-edit-list">
    ${rules.map((rule, index) => `<li class="rule-edit">
      <button class="rule-edit-open" type="button" data-action="rule-edit" data-section="${section}" data-index="${index}" aria-label="${escapeHtml(t("rules.edit.itemAria", { text: ruleText(rule) }))}">
        <span class="rule-edit-text">${escapeHtml(ruleText(rule)) || t("rules.edit.emptyItem")}</span>
        <span class="rule-edit-mark" aria-hidden="true">${icon("edit")}</span>
      </button>
      <button class="rule-remove" type="button" data-action="rule-remove" data-section="${section}" data-index="${index}" aria-label="${escapeHtml(t("rules.edit.remove"))}" title="${escapeHtml(t("rules.edit.remove"))}">${icon("trash")}</button>
    </li>`).join("")}
    ${rules.length ? "" : `<li class="rule-empty">${t("rules.edit.empty")}</li>`}
    <li class="rule-add">
      <button class="btn btn-sm" type="button" data-action="rule-add" data-section="${section}">${icon("plus")}<span>${t("rules.edit.add")}</span></button>
    </li>
  </ul>`;
}

export function renderRules({ unlocked = true, rules = null, editing = false } = {}) {
  const activeRules = rules || defaultRules();
  const isEditing = Boolean(editing && unlocked);

  return `
    <article class="rules${isEditing ? " is-editing" : ""}">
      <header class="rules-head">
        <span class="rules-emblem" aria-hidden="true">${icon('bookOpen')}</span>
        <div class="rules-heading-copy">
        <h1>${t("rules.title.how")}</h1>
        <p class="lede">${t("rules.lede")}</p>
        </div>
      </header>

      <div class="rules-toolbar">
        ${isEditing
          ? `<button class="btn btn-primary btn-sm" type="button" data-action="rules-done">${icon("check")}<span>${t("rules.edit.done")}</span></button><p class="panel-note">${t("rules.edit.hint")}</p>`
          : `<button class="btn btn-sm rules-change" type="button" data-action="rules-edit">${icon(unlocked ? "edit" : "lock")}<span>${t("rules.change")}</span></button>`}
      </div>

      <section class="rules-section rules-journey">
        ${renderList("journey", activeRules.journey, isEditing)}
      </section>

      <div class="rules-rewards">
      <section class="rules-section rules-xp">
        <h2><span class="rule-symbol" aria-hidden="true">${icon('spark')}</span>${t("rules.title.xp")}</h2>
        ${renderList("xp", activeRules.xp, isEditing)}
      </section>

      <section class="rules-section rules-money">
        <h2><span class="rule-symbol" aria-hidden="true">${icon('coin')}</span>${t("rules.title.money")}</h2>
        ${renderList("money", activeRules.money, isEditing)}
      </section>
      </div>

      <p class="rules-back">
          <button class="btn btn-primary" type="button" data-action="show-class">${icon("back")}<span>${t(unlocked ? "rules.back" : "lock.action.back")}</span></button>
      </p>
    </article>
  `;
}
