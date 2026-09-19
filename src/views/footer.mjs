/* Discreet application footer: copyright, publisher and legal links.
 * The year is computed at render time so it stays correct without maintenance.
 * The cookie button is wired by the referencement branch; it stays hidden
 * until the consent manager has loaded, so it is never a dead control.
 */

import { t } from "../i18n.mjs";

export function renderAppFooter() {
  const year = new Date().getFullYear();
  return `
    <footer class="app-footer">
      <p class="app-footer-copy">© ${year} · ${t("footer.rights")}</p>
      <nav class="app-footer-links" aria-label="${t("footer.legal")}">
        <a href="#mentions-legales">${t("footer.mentions")}</a>
        <span class="app-footer-dot" aria-hidden="true">·</span>
        <a href="#conditions-utilisation">${t("footer.terms")}</a>
        <span class="app-footer-dot" aria-hidden="true">·</span>
        <a href="#politique-de-confidentialite">${t("footer.privacy")}</a>
        <span class="app-footer-dot" data-cookies-dot hidden>·</span>
        <button type="button" class="app-footer-cookie" data-action="manage-cookies" data-cookies-button hidden>${t("footer.cookies")}</button>
      </nav>
    </footer>`;
}
