/* Beta notice (a slim strip under the top bar) and its two dialogs:
 * a bug report delivered to the admin console inbox as "user-bug", and a
 * "buy the developer a coffee" chooser that opens Stripe Payment Links. */

import { escapeHtml, icon } from "../ui.mjs";
import { t } from "../i18n.mjs";
import { SUPPORT, methodAvailable } from "../support-links.mjs";

// Payments are paused. Keep this disabled until live payment links have been
// configured and verified; the dialogs and bug inbox remain available in code.
export const BETA_NOTICE_ENABLED = false;

export function renderBetaNotice() {
  if (!BETA_NOTICE_ENABLED) return "";
  return `<aside class="beta-notice" aria-label="${t("beta.label")}">
    <span class="beta-tag">${t("beta.tag")}</span>
    <p class="beta-text">${t("beta.text")}</p>
    <div class="beta-actions">
      <button class="btn btn-sm beta-btn" type="button" data-action="open-bug-report">${icon("bug")}<span>${t("beta.report")}</span></button>
      <button class="btn btn-sm beta-btn beta-btn-coffee" type="button" data-action="open-coffee">${icon("coffee")}<span>${t("beta.coffee")}</span></button>
    </div>
  </aside>`;
}

export function renderBugReportDialog() {
  return `<dialog class="dialog dialog-bug" aria-labelledby="bug-dialog-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t("modal.close")}">${icon("close")}</button>
    <h2 id="bug-dialog-title">${icon("bug")} ${t("beta.bug.title")}</h2>
    <p class="panel-note">${t("beta.bug.body")}</p>
    <form class="help-form" data-action="send-bug-report">
      <label class="field"><span>${t("beta.bug.subject")}</span><input name="subject" maxlength="120" placeholder="${escapeHtml(t("beta.bug.subjectPlaceholder"))}" /></label>
      <label class="field"><span>${t("beta.bug.message")}</span><textarea name="message" rows="6" maxlength="1800" required autofocus placeholder="${escapeHtml(t("beta.bug.placeholder"))}"></textarea></label>
      <p class="panel-note beta-context-note">${t("beta.bug.context")}</p>
      <div class="row"><button class="btn btn-primary" type="submit">${icon("bug")}${t("beta.bug.send")}</button><button class="btn" type="button" data-action="close-dialog">${t("common.cancel")}</button></div>
    </form>
  </dialog>`;
}

export function renderCoffeeDialog() {
  const amounts = SUPPORT.amounts.map((tier) => `<label class="coffee-tier">
      <input type="radio" name="coffee-amount" value="${escapeHtml(tier.id)}" ${tier.id === SUPPORT.defaultAmount ? "checked" : ""} />
      <strong>${tier.amount} ${escapeHtml(SUPPORT.currency)}</strong>
      <span>${t(`beta.coffee.tier.${tier.id}`)}</span>
    </label>`).join("");
  const methods = SUPPORT.methods.map((method) => {
    const ready = methodAvailable(method);
    return `<button class="btn coffee-method coffee-method-${escapeHtml(method.id)}" type="button" data-action="coffee-pay" data-method="${escapeHtml(method.id)}" ${ready ? "" : 'aria-disabled="true"'}>
      <span>${t(`beta.coffee.method.${method.id}`)}</span>${ready ? "" : `<small>${t("beta.coffee.later")}</small>`}
    </button>`;
  }).join("");
  return `<dialog class="dialog dialog-coffee" aria-labelledby="coffee-dialog-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t("modal.close")}">${icon("close")}</button>
    <h2 id="coffee-dialog-title">${icon("coffee")} ${t("beta.coffee.title")}</h2>
    <p class="panel-note">${t("beta.coffee.body")}</p>
    <fieldset class="coffee-step"><legend>${t("beta.coffee.chooseAmount")}</legend><div class="coffee-tiers">${amounts}</div></fieldset>
    <fieldset class="coffee-step"><legend>${t("beta.coffee.chooseMethod")}</legend><div class="coffee-methods">${methods}</div></fieldset>
    <p class="panel-note coffee-secure">${t("beta.coffee.secure")}</p>
  </dialog>`;
}
