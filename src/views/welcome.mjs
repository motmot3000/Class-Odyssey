import { escapeHtml, icon } from "../ui.mjs";
import { t, translateMessage } from "../i18n.mjs";
import { BRAND } from "../brand.mjs";

export function renderWelcome({ tab = "signin", error = "", pending = false, values = {} } = {}) {
  const signup = tab === "signup";
  const off = pending ? "disabled" : "";
  return `
    <div class="welcome-landscape" aria-hidden="true"><img src="./assets/welcome-valley.webp" alt="" width="1536" height="1024" fetchpriority="high" /></div>
    <div class="welcome-content">
      <section class="welcome-intro" aria-labelledby="adventure-title">
        <h1 id="adventure-title">${t("welcome.headlineStart")}<br /><span>${t("welcome.headlineEnd")}</span></h1>
        <p>${t("welcome.adventureHint")}</p>
        <a class="welcome-mobile-enter" href="#gate-title" data-welcome-enter>${t("welcome.enter")}${icon("back", "welcome-arrow")}</a>
      </section>
      <section class="gate welcome-gate" aria-labelledby="gate-title"><div class="gate-card">
        <img class="welcome-gate-seal welcome-gate-seal-light" src="${BRAND.assets.emblemLight}" alt="" width="48" height="48" />
        <h2 id="gate-title" tabindex="-1">${t(signup ? "welcome.createTitle" : "welcome.formTitle")}</h2>
        <p class="gate-lede">${t(signup ? "welcome.createHint" : "welcome.formHint")}</p>
        <div class="segmented gate-tabs" role="group" aria-label="${t("welcome.aria")}">
          <button type="button" class="${signup ? "" : "is-active"}" data-action="gate-tab" data-tab="signin" aria-pressed="${!signup}" ${off}>${t("welcome.tab.signin")}</button>
          <button type="button" class="${signup ? "is-active" : ""}" data-action="gate-tab" data-tab="signup" aria-pressed="${signup}" ${off}>${t("welcome.tab.signup")}</button>
        </div>
        ${signup ? `
          <form class="gate-form" data-action="sign-up" aria-busy="${pending}" ${error ? 'aria-describedby="gate-error"' : ""}>
            <label class="field"><span>${t("welcome.field.class")}</span><input name="displayName" maxlength="80" autocomplete="organization" value="${escapeHtml(values.displayName || "")}" ${off} /></label>
            <label class="field"><span>${t("welcome.field.username")}</span><input id="gate-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="32" aria-describedby="username-hint" value="${escapeHtml(values.username || "")}" ${off} /></label>
            <p class="field-hint" id="username-hint">${t("welcome.usernameHint")}</p>
            <label class="field"><span>${t("welcome.field.password")}</span><input id="gate-password" name="password" type="password" autocomplete="new-password" required minlength="4" maxlength="128" aria-describedby="password-hint" ${off} /></label>
            <p class="field-hint" id="password-hint">${t("welcome.passwordHint")}</p>
            <label class="field"><span>${t("welcome.field.repeat")}</span><input name="confirm" type="password" autocomplete="new-password" required maxlength="128" ${off} /></label>
            <button class="btn btn-primary" type="submit" ${off}><span>${t(pending ? "welcome.submit.creating" : "welcome.submit.create")}</span>${icon("back", "welcome-arrow")}</button>
          </form>` : `
          <form class="gate-form" data-action="sign-in" aria-busy="${pending}" ${error ? 'aria-describedby="gate-error"' : ""}>
            <label class="field"><span>${t("welcome.field.username")}</span><input id="gate-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${escapeHtml(values.username || "")}" ${off} /></label>
            <label class="field"><span>${t("welcome.field.password")}</span><input id="gate-password" name="password" type="password" autocomplete="current-password" required ${off} /></label>
            <button class="btn btn-primary" type="submit" ${off}><span>${t(pending ? "welcome.submit.signing" : "welcome.enter")}</span>${icon("back", "welcome-arrow")}</button>
          </form>`}
        ${error ? `<p id="gate-error" class="gate-error" role="alert">${escapeHtml(translateMessage(error))}</p>` : ""}
        <p class="welcome-account-note">${icon("user")}<span>${t("welcome.classAccount")}</span></p>
      </div></section>
    </div>`;
}
