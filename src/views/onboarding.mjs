/* First-run setup dialogs. The steps run once per account and resume where the
 * teacher left off; each one can be skipped. The tour steps live in app.mjs.
 */

import { escapeHtml, icon } from "../ui.mjs";
import { getLang, t } from "../i18n.mjs";

export function renderOnboardingWelcome(name = "") {
  return `<dialog class="dialog dialog-onboarding" aria-labelledby="onboarding-title">
    <h2 id="onboarding-title">${t("onboarding.welcome.title", { name: escapeHtml(name) })}</h2>
    <p class="panel-note">${t("onboarding.welcome.body")}</p>
    <div class="row">
      <button class="btn btn-primary" type="button" data-action="onboarding-next">${icon("check")}<span>${t("onboarding.start")}</span></button>
      <button class="btn" type="button" data-action="onboarding-skip">${t("onboarding.skip")}</button>
    </div>
  </dialog>`;
}

export function renderOnboardingLanguage() {
  const lang = getLang();
  return `<dialog class="dialog dialog-onboarding" aria-labelledby="onboarding-title">
    <h2 id="onboarding-title">${t("onboarding.language.title")}</h2>
    <p class="panel-note">${t("onboarding.language.body")}</p>
    <div class="onboarding-choices">
      <button class="btn${lang === "fr" ? " is-active" : ""}" type="button" data-action="onboarding-language" data-lang="fr" aria-pressed="${lang === "fr"}">Français</button>
      <button class="btn${lang === "en" ? " is-active" : ""}" type="button" data-action="onboarding-language" data-lang="en" aria-pressed="${lang === "en"}">English</button>
    </div>
    <div class="row">
      <button class="btn" type="button" data-action="onboarding-skip">${t("onboarding.skip")}</button>
    </div>
  </dialog>`;
}
