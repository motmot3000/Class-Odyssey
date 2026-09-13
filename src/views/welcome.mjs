import { escapeHtml, icon } from "../ui.mjs";
import { t } from "../i18n.mjs";

export function renderWelcome({ tab = "signin", error = "", pending = false, values = {} } = {}) {
  const signup = tab === "signup";
  const off = pending ? "disabled" : "";
  return `
    <section class="gate" aria-labelledby="gate-title"><div class="gate-card">
      <span class="gate-badge" aria-hidden="true">${icon(signup ? "plus" : "lock")}</span>
      <h2 id="gate-title">${t(signup ? "welcome.title.create" : "welcome.title.welcome")}</h2>
      <p class="gate-lede">${t(signup ? "welcome.lede.signup" : "welcome.lede.signin")}</p>
      <div class="segmented gate-tabs" role="group" aria-label="${t("welcome.aria")}">
        <button type="button" class="${signup ? "" : "is-active"}" data-action="gate-tab" data-tab="signin">${t("welcome.tab.signin")}</button>
        <button type="button" class="${signup ? "is-active" : ""}" data-action="gate-tab" data-tab="signup">${t("welcome.tab.signup")}</button>
      </div>
      ${signup ? `
        <form class="gate-form" data-action="sign-up">
          <label class="field"><span>${t("welcome.field.class")}</span><input name="displayName" value="${escapeHtml(values.displayName || "")}" ${off} /></label>
          <label class="field"><span>${t("welcome.field.username")}</span><input id="gate-username" name="username" autocomplete="username" value="${escapeHtml(values.username || "")}" ${off} /></label>
          <label class="field"><span>${t("welcome.field.password")}</span><input name="password" type="password" autocomplete="new-password" ${off} /></label>
          <label class="field"><span>${t("welcome.field.repeat")}</span><input name="confirm" type="password" autocomplete="new-password" ${off} /></label>
          <button class="btn btn-primary" type="submit" ${off}>${icon("plus")}<span>${t(pending ? "welcome.submit.creating" : "welcome.submit.create")}</span></button>
        </form>` : `
        <form class="gate-form" data-action="sign-in">
          <label class="field"><span>${t("welcome.field.username")}</span><input id="gate-username" name="username" autocomplete="username" value="${escapeHtml(values.username || "")}" ${off} /></label>
          <label class="field"><span>${t("welcome.field.password")}</span><input id="gate-password" name="password" type="password" autocomplete="current-password" ${off} /></label>
          <button class="btn btn-primary" type="submit" ${off}>${icon("unlock")}<span>${t(pending ? "welcome.submit.signing" : "welcome.submit.signin")}</span></button>
        </form>`}
      ${error ? `<p class="gate-error" role="alert">${escapeHtml(error)}</p>` : ""}
    </div></section>`;
}
