import { escapeHtml, icon } from "../ui.mjs";
import { t, translateMessage } from "../i18n.mjs";

export function renderWelcome({ tab = "signin", error = "", pending = false, values = {} } = {}) {
  const signup = tab === "signup";
  const off = pending ? "disabled" : "";
  return `
    <section class="gate-intro" aria-labelledby="adventure-title">
      <h1 id="adventure-title">${t("welcome.adventure")}</h1>
      <p class="lede">${t("welcome.adventureHint")}</p>
      <div class="gate-heroes" aria-hidden="true">
        <img src="./assets/wardrobe/noa-portrait.webp" alt="" width="240" height="300" />
        <img src="./assets/wardrobe/mila-portrait.webp" alt="" width="240" height="300" />
      </div>
    </section>
    <section class="gate" aria-labelledby="gate-title"><div class="gate-card">
      <h2 id="gate-title">${t(signup ? "welcome.title.create" : "welcome.title.welcome")}</h2>
      <p class="gate-lede">${t(signup ? "welcome.lede.signup" : "welcome.lede.signin")}</p>
      <div class="segmented gate-tabs" role="group" aria-label="${t("welcome.aria")}">
        <button type="button" class="${signup ? "" : "is-active"}" data-action="gate-tab" data-tab="signin" aria-pressed="${!signup}" ${off}>${t("welcome.tab.signin")}</button>
        <button type="button" class="${signup ? "is-active" : ""}" data-action="gate-tab" data-tab="signup" aria-pressed="${signup}" ${off}>${t("welcome.tab.signup")}</button>
      </div>
      ${signup ? `
        <form class="gate-form" data-action="sign-up" aria-busy="${pending}" ${error ? 'aria-describedby="gate-error"' : ""}>
          <label class="field"><span>${t("welcome.field.class")}</span><input name="displayName" maxlength="80" value="${escapeHtml(values.displayName || "")}" ${off} /></label>
          <label class="field"><span>${t("welcome.field.username")}</span><input id="gate-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="32" aria-describedby="username-hint" value="${escapeHtml(values.username || "")}" ${off} /></label>
          <p class="field-hint" id="username-hint">${t("welcome.usernameHint")}</p>
          <label class="field"><span>${t("welcome.field.password")}</span><input id="gate-password" name="password" type="password" autocomplete="new-password" required minlength="4" maxlength="128" aria-describedby="password-hint" ${off} /></label>
          <p class="field-hint" id="password-hint">${t("welcome.passwordHint")}</p>
          <label class="field"><span>${t("welcome.field.repeat")}</span><input name="confirm" type="password" autocomplete="new-password" required maxlength="128" ${off} /></label>
          <button class="btn btn-primary" type="submit" ${off}>${icon("plus")}<span>${t(pending ? "welcome.submit.creating" : "welcome.submit.create")}</span></button>
        </form>` : `
        <form class="gate-form" data-action="sign-in" aria-busy="${pending}" ${error ? 'aria-describedby="gate-error"' : ""}>
          <label class="field"><span>${t("welcome.field.username")}</span><input id="gate-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${escapeHtml(values.username || "")}" ${off} /></label>
          <label class="field"><span>${t("welcome.field.password")}</span><input id="gate-password" name="password" type="password" autocomplete="current-password" required ${off} /></label>
          <button class="btn btn-primary" type="submit" ${off}>${icon("unlock")}<span>${t(pending ? "welcome.submit.signing" : "welcome.submit.signin")}</span></button>
        </form>`}
      ${error ? `<p id="gate-error" class="gate-error" role="alert">${escapeHtml(translateMessage(error))}</p>` : ""}
    </div></section>`;
}
