import { escapeHtml, icon } from "../ui.mjs";
import { t, translateMessage } from "../i18n.mjs";

export function renderLockScreen({ account, error = "", pending = false } = {}) {
  const off = pending ? "disabled" : "";
  return `
    <section class="gate" aria-labelledby="lock-title"><div class="gate-card">
      <span class="gate-badge" aria-hidden="true">${icon("lock")}</span>
      <h1 id="lock-title">${t("lock.title")}</h1>
      <p class="gate-lede">${t("lock.prompt", { account: escapeHtml(account?.displayName || t("console.account")) })}</p>
      <form class="gate-form" data-action="unlock" aria-busy="${pending}">
        <label class="field"><span>${t("lock.field.password")}</span><input id="adult-password" name="password" type="password" autocomplete="current-password" required ${error ? 'aria-invalid="true" aria-describedby="lock-error"' : ""} ${off} /></label>
        <button class="btn btn-primary" type="submit" ${off}>${icon("unlock")}<span>${t(pending ? "lock.submit.checking" : "lock.submit.unlock")}</span></button>
      </form>
      ${error ? `<p id="lock-error" class="gate-error" role="alert">${escapeHtml(translateMessage(error))}</p>` : `<p class="gate-help">${t("lock.hint")}</p>`}
      <hr class="rule" />
      <div class="gate-actions"><button class="btn btn-ghost" type="button" data-action="show-student">${t("lock.action.back")}</button><button class="btn btn-ghost" type="button" data-action="sign-out">${t("lock.action.signout")}</button></div>
    </div></section>`;
}
