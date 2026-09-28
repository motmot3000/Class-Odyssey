const content = document.querySelector("#content");
const detail = document.querySelector("#detail");
const alertBox = document.querySelector("#alert");
const dialog = document.querySelector("#confirm-dialog");
const state = { accounts: [], selectedId: null, view: "accounts", query: "", filter: "all", sort: "newest", page: 0, updatedAt: null, geoipAvailable: false, supportUnread: 0, busy: false };
const PAGE_SIZE = 12;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function date(value, time = false) {
  if (!value || Number.isNaN(Date.parse(value))) return "Jamais";
  return new Intl.DateTimeFormat("fr-CH", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
}
function initials(name) { return String(name || "?").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase(); }
function avatar(account) { return `<span class="avatar ${account.status === "suspended" ? "muted" : account.role === "admin" ? "alt" : ""}">${escapeHtml(initials(account.displayName || account.username))}</span>`; }
function status(account) { return `<span class="status ${account.status === "suspended" ? "suspended" : "active"}">${account.status === "suspended" ? "Suspendu" : "Actif"}</span>`; }
function notify(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, 3800);
}
function showError(message = "") { alertBox.textContent = message; alertBox.hidden = !message; }

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Erreur ${response.status}`);
  return body;
}

async function load() {
  document.querySelector("#refresh").disabled = true;
  try {
    const data = await request("/api/overview");
    state.accounts = data.accounts;
    state.updatedAt = data.updatedAt;
    state.geoipAvailable = data.geoipAvailable;
    state.supportUnread = data.supportUnread || 0;
    const supportCount = document.querySelector("#support-count");
    supportCount.textContent = state.supportUnread;
    supportCount.hidden = !state.supportUnread;
    document.querySelector("#nav-count").textContent = state.accounts.length;
    document.querySelector("#updated").textContent = `Mis à jour ${date(data.updatedAt, true)}`;
    if (state.selectedId && !state.accounts.some((account) => account.id === state.selectedId)) state.selectedId = null;
    showError();
    render();
    renderDetail();
  } catch (error) {
    showError(`${error.message} Réessayez après avoir vérifié la configuration de la console et du backend.`);
    if (!state.accounts.length) content.innerHTML = `<div class="notice"><h2>Connexion indisponible</h2><p>La console n’a pas pu charger les comptes. Vérifiez que l’API déployée et la clé d’administration correspondent, puis actualisez.</p></div>`;
  } finally { document.querySelector("#refresh").disabled = false; }
}

function visibleAccounts() {
  const q = state.query.trim().toLocaleLowerCase("fr");
  const results = state.accounts.filter((account) => {
    if (state.filter !== "all" && account.status !== state.filter) return false;
    return !q || [account.displayName, account.username, account.email, account.id].some((value) => String(value || "").toLocaleLowerCase("fr").includes(q));
  });
  results.sort((a, b) => {
    if (state.sort === "name") return (a.displayName || a.username).localeCompare(b.displayName || b.username, "fr");
    if (state.sort === "last") return String(b.lastLoginAt || "").localeCompare(String(a.lastLoginAt || ""));
    return state.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
  });
  return results;
}

function renderRows() {
  const accounts = visibleAccounts();
  const maxPage = Math.max(0, Math.ceil(accounts.length / PAGE_SIZE) - 1);
  state.page = Math.min(state.page, maxPage);
  const rows = accounts.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
  const tbody = document.querySelector("#account-rows");
  if (!tbody) return;
  tbody.innerHTML = rows.length ? rows.map((account) => `<tr tabindex="0" role="button" aria-label="Ouvrir le compte de ${escapeHtml(account.displayName || account.username)}" data-id="${account.id}" class="${state.selectedId === account.id ? "active" : ""}">
    <td><div class="identity">${avatar(account)}<span><strong>${escapeHtml(account.displayName || account.username)}</strong><small>@${escapeHtml(account.username)}</small></span></div></td>
    <td title="${escapeHtml(account.email || "Aucune adresse")}">${escapeHtml(account.email || "—")}</td>
    <td>${status(account)}</td><td>${account.classCount} <span class="count">/ ${account.pupilCount} élèves</span></td>
    <td>${date(account.lastLoginAt)}</td><td class="row-arrow"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></td></tr>`).join("") : `<tr><td colspan="6"><div class="empty-state"><strong>Aucun compte trouvé</strong>Essayez une autre recherche ou un autre filtre.</div></td></tr>`;
  document.querySelector("#result-count").textContent = `${accounts.length} résultat${accounts.length > 1 ? "s" : ""}`;
  document.querySelector("#page-count").textContent = `Page ${state.page + 1} / ${maxPage + 1}`;
  document.querySelector("#page-prev").disabled = state.page === 0;
  document.querySelector("#page-next").disabled = state.page >= maxPage;
  for (const tab of document.querySelectorAll(".tab")) {
    const current = tab.dataset.filter === state.filter;
    tab.classList.toggle("current", current);
    tab.setAttribute("aria-selected", String(current));
  }
}

function renderAccounts() {
  const total = state.accounts.length;
  const active = state.accounts.filter((account) => account.status !== "suspended").length;
  const pupils = state.accounts.reduce((sum, account) => sum + account.pupilCount, 0);
  const sessions = state.accounts.reduce((sum, account) => sum + account.activeSessionCount, 0);
  content.innerHTML = `<div class="page-heading"><div><h1>Comptes</h1><p>Les personnes inscrites à Class Odyssey, réunies au même endroit.</p></div><div class="heading-meta">Registre des utilisateurs</div></div>
    <div class="ledger" aria-label="Vue d’ensemble"><div class="metric"><span class="metric-label">Comptes inscrits</span><strong class="metric-value">${total}</strong><span class="metric-suffix">Tous les profils</span></div><div class="metric"><span class="metric-label">Comptes actifs</span><strong class="metric-value">${active}</strong><span class="metric-suffix">${total - active} suspendu${total - active > 1 ? "s" : ""}</span></div><div class="metric"><span class="metric-label">Élèves enregistrés</span><strong class="metric-value">${pupils}</strong><span class="metric-suffix">Dans les classes des comptes</span></div><div class="metric"><span class="metric-label">Sessions ouvertes</span><strong class="metric-value">${sessions}</strong><span class="metric-suffix">Connexions valides</span></div></div>
    <section class="registry" aria-labelledby="registry-title"><div class="registry-head"><div><h2 id="registry-title">Registre des comptes</h2><p>Ouvrez une ligne pour voir sa fiche et intervenir.</p></div><span id="result-count" class="count"></span></div>
    <div class="filters"><label class="search-wrap"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.2"/><path d="m15.5 15.5 5 5"/></svg><input class="field" type="search" id="search" value="${escapeHtml(state.query)}" placeholder="Nom, e-mail ou identifiant" aria-label="Rechercher un compte"></label><select id="sort" aria-label="Trier les comptes"><option value="newest" ${state.sort === "newest" ? "selected" : ""}>Plus récents</option><option value="oldest" ${state.sort === "oldest" ? "selected" : ""}>Plus anciens</option><option value="last" ${state.sort === "last" ? "selected" : ""}>Dernière activité</option><option value="name" ${state.sort === "name" ? "selected" : ""}>Nom A–Z</option></select></div>
    <div class="tabs" role="tablist" aria-label="Statut des comptes"><button class="tab" role="tab" data-filter="all">Tous <span>(${total})</span></button><button class="tab" role="tab" data-filter="active">Actifs <span>(${active})</span></button><button class="tab" role="tab" data-filter="suspended">Suspendus <span>(${total - active})</span></button></div>
    <div class="table-scroll"><table><thead><tr><th>Compte</th><th>Adresse e-mail</th><th>Statut</th><th>Classes / élèves</th><th>Dernière visite</th><th aria-label="Ouvrir"></th></tr></thead><tbody id="account-rows"></tbody></table></div><div class="table-footer"><span>12 comptes par page</span><div class="pager"><button id="page-prev" aria-label="Page précédente"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><span id="page-count"></span><button id="page-next" aria-label="Page suivante"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></div></div></section>`;
  renderRows();
}

function renderSubscriptions() {
  content.innerHTML = `<div class="page-heading"><div><h1>Abonnements</h1><p>État de la facturation et des formules.</p></div></div><div class="notice"><h2>Aucune source d’abonnement connectée</h2><p>Le backend actuel contient les comptes et leurs données de classe, mais aucun plan, paiement ou statut d’abonnement. Aucune personne ne peut donc être identifiée ici comme « abonnée » de manière fiable. Ce panneau sera alimenté lorsqu’une source de facturation sera disponible.</p></div>`;
}

async function renderSupport() {
  content.innerHTML = `<div class="page-heading"><div><h1>Messages</h1><p>Demandes d’aide envoyées depuis les paramètres des comptes.</p></div></div><div class="loading"><span class="spinner"></span> Chargement des messages…</div>`;
  try {
    const { messages, unread } = await request("/api/support");
    if (state.view !== "support") return;
    state.supportUnread = unread;
    const badge = document.querySelector("#support-count");
    badge.textContent = unread;
    badge.hidden = !unread;
    const statusLabel = { open: "À lire", read: "Lu", done: "Traité" };
    content.innerHTML = `<div class="page-heading"><div><h1>Messages</h1><p>Demandes d’aide envoyées depuis les paramètres des comptes.</p></div><span class="heading-meta">${unread} non lu${unread > 1 ? "s" : ""}</span></div>${messages.length ? `<div class="support-list">${messages.map((item) => `<article class="support-card ${item.status === "open" ? "open" : ""}" data-support-id="${escapeHtml(item.id)}"><div class="support-card-head"><div><span class="support-badge ${escapeHtml(item.status)}">${escapeHtml(statusLabel[item.status] || item.status)}</span><h2>${escapeHtml(item.subject || item.category || "Demande d’aide")}</h2><p class="support-card-meta">${escapeHtml(item.displayName || item.username || "Compte inconnu")} · ${escapeHtml(item.category || "Autre")} · ${escapeHtml(item.email || "Sans e-mail")}</p></div><time datetime="${escapeHtml(item.at)}">${date(item.at, true)}</time></div><p class="support-message">${escapeHtml(item.message)}</p><label class="field-label" for="support-note-${escapeHtml(item.id)}">Note interne</label><textarea id="support-note-${escapeHtml(item.id)}" maxlength="1000" placeholder="Suivi de la demande…">${escapeHtml(item.note || "")}</textarea><div class="support-actions"><button class="button secondary" data-support-action="save">Enregistrer</button>${item.status !== "read" ? `<button class="button secondary" data-support-action="read">Marquer comme lu</button>` : ""}${item.status !== "done" ? `<button class="button secondary" data-support-action="done">Marquer traité</button>` : ""}${item.email ? `<a class="button ghost" href="mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(`Re: ${item.subject || "Class Odyssey — aide"}`)}">Répondre par e-mail</a>` : ""}</div></article>`).join("")}</div>` : `<div class="notice"><h2>Aucun message pour le moment</h2><p>Les demandes envoyées depuis « Demander de l’aide » apparaîtront ici dès que la fonctionnalité sera disponible sur le site.</p></div>`}`;
  } catch (error) { showError(error.message); content.innerHTML = ""; }
}

async function renderAudit() {
  content.innerHTML = `<div class="page-heading"><div><h1>Journal des actions</h1><p>Les opérations de modération récentes, sans mots de passe ni contenu des comptes.</p></div></div><div class="loading"><span class="spinner"></span> Chargement du journal…</div>`;
  try {
    const { entries } = await request("/api/audit");
    if (state.view !== "audit") return;
    const labels = { "account.updated": "Fiche modifiée", "account.suspended": "Compte suspendu", "account.active": "Compte réactivé", "account.deleted": "Compte supprimé", "sessions.revoked": "Sessions révoquées" };
    content.innerHTML = `<div class="page-heading"><div><h1>Journal des actions</h1><p>Les opérations de modération récentes, sans mots de passe ni contenu des comptes.</p></div><span class="heading-meta">100 dernières actions</span></div>${entries.length ? `<div class="audit-list">${entries.map((entry) => { const account = state.accounts.find((item) => item.id === entry.accountId); return `<div class="audit-entry"><span class="audit-dot"></span><div><strong>${escapeHtml(labels[entry.action] || entry.action)}</strong><small>${escapeHtml(account?.displayName || `Compte ${entry.accountId.slice(0, 8)}`)}</small></div><time datetime="${escapeHtml(entry.at)}">${date(entry.at, true)}</time></div>`; }).join("")}</div>` : `<div class="notice"><h2>Journal vide</h2><p>Aucune opération n’a encore été effectuée depuis cette console.</p></div>`}`;
  } catch (error) { showError(error.message); content.innerHTML = ""; }
}

function render() {
  const names = { accounts: "Comptes", support: "Messages", audit: "Journal", subscriptions: "Abonnements" };
  document.querySelector("#crumb").textContent = names[state.view];
  document.querySelector(".shell").classList.toggle("other-view", state.view !== "accounts");
  detail.hidden = state.view !== "accounts";
  for (const nav of document.querySelectorAll(".nav-item")) {
    const current = nav.dataset.view === state.view;
    nav.classList.toggle("selected", current);
    if (current) nav.setAttribute("aria-current", "page"); else nav.removeAttribute("aria-current");
  }
  if (state.view === "accounts") renderAccounts();
  if (state.view === "subscriptions") renderSubscriptions();
  if (state.view === "audit") renderAudit();
  if (state.view === "support") renderSupport();
}

function renderDetail() {
  const account = state.accounts.find((entry) => entry.id === state.selectedId);
  detail.classList.toggle("open", Boolean(account));
  if (!account) {
    detail.innerHTML = `<div class="detail-empty"><span class="detail-symbol" aria-hidden="true"><svg viewBox="0 0 42 42" fill="none"><path d="m21 3 18 18-18 18L3 21 21 3Z"/></svg></span><h2>Un compte, en détail.</h2><p>Sélectionnez une personne dans le registre pour retrouver son activité et les actions disponibles.</p></div>`;
    return;
  }
  const protectedAccount = account.role === "admin";
  detail.innerHTML = `<div class="detail-header"><div class="detail-top"><span>Fiche de compte</span><button class="detail-close" data-action="close" aria-label="Fermer la fiche"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg></button></div><div class="detail-person">${avatar(account)}<div><h2>${escapeHtml(account.displayName || account.username)}</h2><p>@${escapeHtml(account.username)} · ${protectedAccount ? "Fondateur" : "Enseignant"}</p></div></div><div class="detail-email">${escapeHtml(account.email || "Aucune adresse e-mail renseignée")}</div><div style="margin-top:13px">${status(account)}</div></div>
    <div class="detail-body"><section class="section"><h3>Informations du compte</h3><div class="fact"><span>Inscription</span><strong>${date(account.createdAt, true)}</strong></div><div class="fact"><span>Dernière visite</span><strong>${date(account.lastLoginAt, true)}</strong></div><div class="fact"><span>Sessions actives</span><strong>${account.activeSessionCount}</strong></div><div class="fact"><span>Conditions acceptées</span><strong>${account.terms?.acceptedAt ? date(account.terms.acceptedAt) : "Non renseigné"}</strong></div><div class="fact"><span>Identifiant</span><strong>${escapeHtml(account.id)}</strong></div></section>
    <section class="section"><h3>Classes associées · ${account.classCount}</h3>${account.classes.length ? account.classes.map((item) => `<div class="class-row"><strong>${escapeHtml(item.name)}</strong><span>${item.pupilCount} élève${item.pupilCount > 1 ? "s" : ""}</span></div>`).join("") : `<p class="help">Aucune classe enregistrée.</p>`}</section>
    <section class="section"><h3>Dernières adresses IP</h3>${account.recentAccesses.length ? account.recentAccesses.map((item) => `<div class="access-row"><div><strong>${escapeHtml(item.ip)}</strong><small>${escapeHtml(item.location || "Localisation indisponible")}</small></div><time datetime="${escapeHtml(item.at)}">${date(item.at, true)}</time></div>`).join("") : `<p class="help">Aucune connexion récente enregistrée. L’historique débute après l’activation de cette fonctionnalité.</p>`}<p class="help" style="margin-top:11px">${state.geoipAvailable ? "Localisation approximative issue d’une base locale ; elle peut être inexacte." : "Base GeoIP locale non installée : les IP sont visibles, sans estimation géographique."} Historique limité à 5 IP et 90 jours.</p></section>
    <section class="section"><h3>Contact</h3>${account.email ? `<p class="help">Rédigez un message avec votre logiciel de messagerie. L’envoi ne se fait pas depuis Class Odyssey.</p><div class="action-stack"><a class="button secondary" href="mailto:${encodeURIComponent(account.email)}?subject=${encodeURIComponent("Class Odyssey — votre compte")}">Écrire un e-mail</a></div>` : `<p class="help">Aucune adresse disponible pour contacter cette personne.</p>`}</section>
    ${protectedAccount ? `<section class="section"><h3>Compte fondateur</h3><p class="help">Les actions de modération sont désactivées pour ce compte.</p></section>` : `<section class="section"><h3>Modération</h3><form id="edit-account"><label class="field-label" for="edit-name">Nom affiché</label><input id="edit-name" name="displayName" class="field" maxlength="60" required value="${escapeHtml(account.displayName || account.username)}"><label class="field-label" for="edit-note">Note interne</label><textarea id="edit-note" name="moderationNote" maxlength="500" placeholder="Contexte utile pour une prochaine intervention…">${escapeHtml(account.moderationNote)}</textarea><div class="action-stack"><button class="button" type="submit">Enregistrer les modifications</button></div></form><div class="action-stack"><button type="button" class="button secondary" data-action="status">${account.status === "suspended" ? "Réactiver le compte" : "Suspendre le compte"}</button><button type="button" class="button secondary" data-action="revoke" ${account.activeSessionCount ? "" : "disabled"}>Révoquer les sessions</button></div><p class="help" style="margin-top:12px">La suspension bloque les connexions et coupe immédiatement les sessions en cours.</p></section><section class="section danger-section"><h3>Zone sensible</h3><p class="help">La suppression retire ce compte et ses classes du serveur actif.</p><button type="button" class="button ghost-danger" data-action="delete">Supprimer le compte</button></section>`}</div>`;
}

async function mutate(path, options, success) {
  if (state.busy) return;
  state.busy = true;
  try { await request(path, options); notify(success); await load(); }
  catch (error) { showError(error.message); }
  finally { state.busy = false; }
}

document.querySelector("#refresh").addEventListener("click", load);
document.querySelector("#cancel-delete").addEventListener("click", () => dialog.close());
document.querySelector("#confirm-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const account = state.accounts.find((entry) => entry.id === state.selectedId);
  if (!account) return dialog.close();
  if (document.querySelector("#confirm-input").value.trim() !== account.username) {
    document.querySelector("#confirm-input").setCustomValidity("L’identifiant ne correspond pas.");
    document.querySelector("#confirm-input").reportValidity();
    return;
  }
  dialog.close();
  await mutate(`/api/accounts/${account.id}`, { method: "DELETE", body: JSON.stringify({ confirmUsername: account.username }) }, "Compte supprimé.");
});
document.querySelector("#confirm-input").addEventListener("input", (event) => event.target.setCustomValidity(""));

document.addEventListener("input", (event) => {
  if (event.target.id === "search") { state.query = event.target.value; state.page = 0; renderRows(); }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "sort") { state.sort = event.target.value; state.page = 0; renderRows(); }
});
document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav) { state.view = nav.dataset.view; render(); return; }
  const supportAction = event.target.closest("[data-support-action]");
  if (supportAction && !state.busy) {
    const card = supportAction.closest("[data-support-id]");
    const patch = { note: card.querySelector("textarea").value };
    if (supportAction.dataset.supportAction !== "save") patch.status = supportAction.dataset.supportAction;
    state.busy = true;
    try {
      await request(`/api/support/${card.dataset.supportId}`, { method: "PATCH", body: JSON.stringify(patch) });
      notify("Message mis à jour.");
      await load();
    } catch (error) { showError(error.message); }
    finally { state.busy = false; }
    return;
  }
  const tab = event.target.closest("[data-filter]");
  if (tab) { state.filter = tab.dataset.filter; state.page = 0; renderRows(); return; }
  if (event.target.closest("#page-prev")) { state.page--; renderRows(); return; }
  if (event.target.closest("#page-next")) { state.page++; renderRows(); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "close") { state.selectedId = null; renderDetail(); renderRows(); return; }
  const account = state.accounts.find((entry) => entry.id === state.selectedId);
  if (action && account && !state.busy) {
    if (action === "delete") {
      document.querySelector("#confirm-description").textContent = `Cette action supprime « ${account.displayName || account.username} », ses classes et ses sauvegardes applicatives. Elle ne peut pas être annulée depuis la console.`;
      document.querySelector("#confirm-input").value = "";
      dialog.showModal();
    }
    if (action === "status" && confirm(account.status === "suspended" ? `Réactiver ${account.username} ?` : `Suspendre ${account.username} et déconnecter ses sessions ?`)) {
      await mutate(`/api/accounts/${account.id}`, { method: "PATCH", body: JSON.stringify({ status: account.status === "suspended" ? "active" : "suspended" }) }, "Statut du compte mis à jour.");
    }
    if (action === "revoke" && confirm(`Déconnecter toutes les sessions de ${account.username} ?`)) {
      await mutate(`/api/accounts/${account.id}/sessions`, { method: "DELETE" }, "Sessions révoquées.");
    }
    return;
  }
  const row = event.target.closest("tr[data-id]");
  if (row) { state.selectedId = row.dataset.id; renderRows(); renderDetail(); }
});
document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("tr[data-id]")) { event.preventDefault(); event.target.click(); }
  if (event.key === "Escape" && !dialog.open && state.selectedId) { state.selectedId = null; renderRows(); renderDetail(); }
});
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "edit-account") return;
  event.preventDefault();
  const account = state.accounts.find((entry) => entry.id === state.selectedId);
  if (!account) return;
  const form = new FormData(event.target);
  await mutate(`/api/accounts/${account.id}`, { method: "PATCH", body: JSON.stringify({ displayName: form.get("displayName"), moderationNote: form.get("moderationNote") }) }, "Fiche mise à jour.");
});

load();
