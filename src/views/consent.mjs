import { escapeHtml } from "../ui.mjs";
import { t, translateMessage } from "../i18n.mjs";

/* The legal consent sentence, shared by the sign-up form and the consent page
 * shown to accounts created through a provider (Google). */
export function termsConsentMarkup() {
  return `${t("consent.lead")} <a href="#conditions-utilisation" target="_blank" rel="noopener">${t("consent.terms")}</a> ${t("consent.and")} <a href="#politique-de-confidentialite" target="_blank" rel="noopener">${t("consent.privacy")}</a>.`;
}

export function renderConsent({ pending = false, error = "" } = {}) {
  const off = pending ? "disabled" : "";
  return `
    <main class="page page-narrow consent-page">
      <form class="consent-card" data-action="accept-consent" aria-busy="${pending}" ${error ? 'aria-describedby="consent-error"' : ""}>
        <h1>${t("consent.title")}</h1>
        <p>${t("consent.body")}</p>
        <label class="consent-check"><input name="terms" type="checkbox" required value="accepted" ${off} /><span>${termsConsentMarkup()}</span></label>
        ${error ? `<p id="consent-error" class="gate-error" role="alert">${escapeHtml(translateMessage(error))}</p>` : ""}
        <div class="consent-actions">
          <button class="btn btn-primary" type="submit" ${off}><span>${t(pending ? "consent.pending" : "consent.submit")}</span></button>
          <button class="btn btn-ghost" type="button" data-action="sign-out" ${off}>${t("lock.action.signout")}</button>
        </div>
      </form>
    </main>`;
}

export function renderTeacherSetup({ pending = false, error = "", recovery = false } = {}) {
  const off = pending ? "disabled" : "";
  return `
    <main class="page page-narrow consent-page">
      <form class="consent-card" data-action="setup-teacher-password" aria-busy="${pending}" ${error ? 'aria-describedby="teacher-setup-error"' : ""}>
        <h1>${t(recovery ? "google.teacher.recoveryTitle" : "google.teacher.title")}</h1>
        <p>${t(recovery ? "google.teacher.recoveryBody" : "google.teacher.body")}</p>
        <label class="field"><span>${t("google.teacher.password")}</span><input name="password" type="password" autocomplete="new-password" required minlength="6" maxlength="128" ${off} /></label>
        <label class="field"><span>${t("welcome.field.repeat")}</span><input name="confirm" type="password" autocomplete="new-password" required maxlength="128" ${off} /></label>
        <p class="field-hint">${t("welcome.passwordHint")}</p>
        ${error ? `<p id="teacher-setup-error" class="gate-error" role="alert">${escapeHtml(translateMessage(error))}</p>` : ""}
        <div class="consent-actions">
          <button class="btn btn-primary" type="submit" ${off}>${t(pending ? "consent.pending" : recovery ? "google.teacher.recoverySubmit" : "google.teacher.submit")}</button>
          <button class="btn btn-ghost" type="button" data-action="sign-out" ${off}>${t("lock.action.signout")}</button>
        </div>
      </form>
    </main>`;
}
