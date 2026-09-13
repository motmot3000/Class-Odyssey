import { escapeHtml } from "../ui.mjs";
import { t, getLang } from "../i18n.mjs";

function date(value) {
  const locale = getLang() === "fr" ? "fr-FR" : "en-GB";
  return value ? new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : t("admin.never");
}

export function renderAdmin({ accounts = [], pending = false, error = "", currentAccountId = null } = {}) {
  return `
    <main class="page page-narrow admin-page">
      <section class="admin-card">
        <div class="admin-heading"><div><p class="section-label">${t("admin.title")}</p><h1>${t("admin.accounts")}</h1></div><button class="btn btn-sm" data-action="refresh-admin" ${pending ? "disabled" : ""}>${t("admin.refresh")}</button></div>
        ${error ? `<p class="gate-error" role="alert">${escapeHtml(error)}</p>` : ""}
        ${pending && !accounts.length ? `<p class="panel-note">${t("admin.loading")}</p>` : `
          <div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>${t("admin.col.name")}</th><th>Role</th><th>Created</th><th>${t("admin.col.last")}</th><th>Sessions</th><th>Pupils</th><th>${t("admin.newPassword")}</th></tr></thead>
            <tbody>${accounts.map((item) => `<tr>
              <td><strong>@${escapeHtml(item.username)}</strong></td><td>${escapeHtml(item.role)}</td><td>${date(item.createdAt)}</td><td>${date(item.lastLoginAt)}</td><td>${item.activeSessionCount}</td><td>${item.pupilCount}</td>
              <td>${item.id === currentAccountId ? `<span class="panel-note">${t("admin.useSettings")}</span>` : `<form class="admin-reset" data-action="admin-reset" data-account-id="${escapeHtml(item.id)}"><input name="password" type="password" autocomplete="new-password" placeholder="${t("admin.newPassword")}" aria-label="${t("admin.newPasswordFor", { username: escapeHtml(item.username) })}" /><button class="btn btn-sm" type="submit">${t("admin.reset")}</button></form>`}</td>
            </tr>`).join("")}</tbody>
          </table></div>`}
      </section>
    </main>`;
}
