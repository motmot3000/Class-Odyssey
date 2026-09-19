import { escapeHtml, icon } from "../ui.mjs";
import { t, translateMessage } from "../i18n.mjs";
import { BRAND } from "../brand.mjs";
import { termsConsentMarkup } from "./consent.mjs";

const GOOGLE_MARK = `<svg class="google-mark" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>`;

export function renderWelcome({ tab = "signin", error = "", pending = false, values = {}, google = false } = {}) {
  const signup = tab === "signup";
  const off = pending ? "disabled" : "";
  return `
    <div class="welcome-landscape" aria-hidden="true"><img src="./assets/welcome-valley.webp" alt="" width="1536" height="1024" fetchpriority="high" /></div>
    <div class="welcome-content">
      <section class="welcome-intro" aria-labelledby="adventure-title">
        <p class="welcome-brand">
          <img class="welcome-lockup welcome-lockup-light" src="${BRAND.assets.lockupStackedLight}" alt="${BRAND.name}" width="861" height="409" />
          <img class="welcome-lockup welcome-lockup-dark" src="${BRAND.assets.lockupStackedDark}" alt="" width="861" height="409" />
        </p>
        <span class="welcome-rule" aria-hidden="true"></span>
        <p class="welcome-kicker">${t("welcome.kicker")}</p>
        <h1 id="adventure-title">${t("welcome.headlineStart")}<br /><span>${t("welcome.headlineEnd")}</span></h1>
        <p>${t("welcome.adventureHint")}</p>
        <aside class="welcome-gamification" aria-labelledby="gamification-title">
          <h2 id="gamification-title">${t("welcome.gamificationQuestion")}</h2>
          <p>${t("welcome.gamificationTeaser")}</p>
          <div class="welcome-gamification-foot">
            <a class="welcome-gamification-cta" href="./gamification.html">${t("welcome.gamificationCta")}${icon("back", "welcome-arrow")}</a>
            <span class="welcome-gamification-meta">${t("welcome.gamificationMeta")}</span>
          </div>
        </aside>
        <a class="welcome-mobile-enter" href="#gate-title" data-welcome-enter>${t("welcome.enter")}${icon("back", "welcome-arrow")}</a>
      </section>
      <section class="gate welcome-gate" aria-labelledby="gate-title"><div class="gate-card">
        <img class="welcome-gate-seal welcome-gate-seal-light" src="${BRAND.assets.emblemLight}" alt="" width="48" height="48" />
        <img class="welcome-gate-seal welcome-gate-seal-dark" src="${BRAND.assets.emblemDark}" alt="" width="48" height="48" />
        <h2 id="gate-title" tabindex="-1">${t(signup ? "welcome.createTitle" : "welcome.formTitle")}</h2>
        <p class="gate-lede">${t(signup ? "welcome.createHint" : "welcome.formHint")}</p>
        <div class="segmented gate-tabs" role="group" aria-label="${t("welcome.aria")}">
          <button type="button" class="${signup ? "" : "is-active"}" data-action="gate-tab" data-tab="signin" aria-pressed="${!signup}" ${off}>${t("welcome.tab.signin")}</button>
          <button type="button" class="${signup ? "is-active" : ""}" data-action="gate-tab" data-tab="signup" aria-pressed="${signup}" ${off}>${t("welcome.tab.signup")}</button>
        </div>
        ${signup ? `
          <form class="gate-form" data-action="sign-up" aria-busy="${pending}" ${error ? 'aria-describedby="gate-error"' : ""}>
            <label class="field"><span>${t("welcome.field.email")}</span><input id="gate-email" name="email" type="email" autocomplete="email" required maxlength="160" value="${escapeHtml(values.email || "")}" ${off} /></label>
            <label class="field"><span>${t("welcome.field.password")}</span><input id="gate-password" name="password" type="password" autocomplete="new-password" required minlength="6" maxlength="128" aria-describedby="password-hint" ${off} /></label>
            <p class="field-hint" id="password-hint">${t("welcome.passwordHint")}</p>
            <label class="field"><span>${t("welcome.field.repeat")}</span><input name="confirm" type="password" autocomplete="new-password" required maxlength="128" ${off} /></label>
            <label class="field-check"><input name="terms" type="checkbox" value="accepted" required ${off} /><span>${termsConsentMarkup()}</span></label>
            <button class="btn btn-primary" type="submit" ${off}><span>${t(pending ? "welcome.submit.creating" : "welcome.submit.create")}</span>${icon("back", "welcome-arrow")}</button>
          </form>` : `
          <form class="gate-form" data-action="sign-in" aria-busy="${pending}" ${error ? 'aria-describedby="gate-error"' : ""}>
            <label class="field"><span>${t("welcome.field.emailOrUsername")}</span><input id="gate-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${escapeHtml(values.username || "")}" ${off} /></label>
            <label class="field"><span>${t("welcome.field.password")}</span><input id="gate-password" name="password" type="password" autocomplete="current-password" required ${off} /></label>
            <button class="btn btn-primary" type="submit" ${off}><span>${t(pending ? "welcome.submit.signing" : "welcome.enter")}</span>${icon("back", "welcome-arrow")}</button>
          </form>`}
        ${google ? `
          <p class="gate-or" aria-hidden="true"><span>${t("welcome.or")}</span></p>
          <a class="btn btn-google" href="api/auth/google" data-action="google-signin">${GOOGLE_MARK}<span>${t("welcome.google")}</span></a>` : ""}
        ${error ? `<p id="gate-error" class="gate-error" role="alert">${escapeHtml(translateMessage(error))}</p>` : ""}
        <p class="welcome-account-note">${icon("user")}<span>${t("welcome.classAccount")}</span></p>
        <p class="welcome-disclaimer"><span class="welcome-beta">${t("welcome.beta")}</span>${t("welcome.disclaimer")}</p>
      </div></section>
    </div>`;
}
