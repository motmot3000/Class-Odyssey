import { escapeHtml, icon } from "../ui.mjs";

export function renderLockScreen({ account, error = "", pending = false } = {}) {
  const off = pending ? "disabled" : "";
  return `
    <section class="gate" aria-labelledby="lock-title"><div class="gate-card">
      <span class="gate-badge" aria-hidden="true">${icon("lock")}</span>
      <h2 id="lock-title">Grown-ups only</h2>
      <p class="gate-lede">Type the password for <strong>${escapeHtml(account?.displayName || "this account")}</strong> to open teacher controls.</p>
      <form class="gate-form" data-action="unlock">
        <label class="field"><span>Account password</span><input id="adult-password" name="password" type="password" autocomplete="current-password" ${off} /></label>
        <button class="btn btn-primary" type="submit" ${off}>${icon("unlock")}<span>${pending ? "Checking..." : "Unlock"}</span></button>
      </form>
      ${error ? `<p class="gate-error" role="alert">${escapeHtml(error)}</p>` : `<p class="gate-help">The teacher console stays open on this device for eight hours.</p>`}
      <hr class="rule" />
      <div class="gate-actions"><button class="btn btn-ghost" type="button" data-action="show-student">Back to heroes</button><button class="btn btn-ghost" type="button" data-action="sign-out">Sign out</button></div>
    </div></section>`;
}
