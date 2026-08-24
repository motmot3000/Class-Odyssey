import { escapeHtml } from "../ui.mjs";

function date(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Never";
}

export function renderAdmin({ accounts = [], pending = false, error = "", currentAccountId = null } = {}) {
  return `
    <main class="page page-narrow admin-page">
      <section class="admin-card">
        <div class="admin-heading"><div><p class="section-label">Administration</p><h1>Accounts</h1></div><button class="btn btn-sm" data-action="refresh-admin" ${pending ? "disabled" : ""}>Refresh</button></div>
        ${error ? `<p class="gate-error" role="alert">${escapeHtml(error)}</p>` : ""}
        ${pending && !accounts.length ? `<p class="panel-note">Loading accounts...</p>` : `
          <div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>Username</th><th>Role</th><th>Created</th><th>Last login</th><th>Sessions</th><th>Pupils</th><th>Reset password</th></tr></thead>
            <tbody>${accounts.map((item) => `<tr>
              <td><strong>@${escapeHtml(item.username)}</strong></td><td>${escapeHtml(item.role)}</td><td>${date(item.createdAt)}</td><td>${date(item.lastLoginAt)}</td><td>${item.activeSessionCount}</td><td>${item.pupilCount}</td>
              <td>${item.id === currentAccountId ? `<span class="panel-note">Use account settings</span>` : `<form class="admin-reset" data-action="admin-reset" data-account-id="${escapeHtml(item.id)}"><input name="password" type="password" autocomplete="new-password" placeholder="New password" aria-label="New password for ${escapeHtml(item.username)}" /><button class="btn btn-sm" type="submit">Reset</button></form>`}</td>
            </tr>`).join("")}</tbody>
          </table></div>`}
      </section>
    </main>`;
}
