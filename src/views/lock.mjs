/* ============================================================
   lock.mjs — la porte de l'interface adulte
   L'écran que voit un élève qui touche l'onglet « Teacher ». Il doit
   expliquer sans gronder : la console appartient à l'adulte, le casier
   du héros est à un bouton d'ici.
   ============================================================ */

import { escapeHtml, icon } from "../ui.mjs";

export function renderLockScreen({ account, error = "", pending = false } = {}) {
  const off = pending ? "disabled" : "";

  return `
    <section class="gate" aria-labelledby="lock-title">
      <div class="gate-card">
        <span class="gate-badge" aria-hidden="true">${icon("lock")}</span>
        <h2 id="lock-title">Grown-ups only</h2>
        <p class="gate-lede">
          The teacher console hands out XP, hit points and coins. Type the
          password of ${account ? `<strong>${escapeHtml(account.displayName)}</strong>` : "this class"} again to open it.
        </p>

        <form class="gate-form" data-action="unlock">
          <label class="field">
            <span>Class password</span>
            <input
              id="adult-password"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••"
              aria-describedby="${error ? "lock-error" : "lock-help"}"
              ${off}
            />
          </label>
          <button class="btn btn-primary" type="submit" ${off}>
            ${icon("unlock")}<span>${pending ? "Checking…" : "Unlock"}</span>
          </button>
        </form>

        ${error
          ? `<p class="gate-error" id="lock-error" role="alert">${escapeHtml(error)}</p>`
          : `<p class="gate-help" id="lock-help">The console stays open on this device for the school day.</p>`}

        <hr class="rule" />

        <div class="gate-actions">
          <button class="btn btn-ghost" type="button" data-action="show-student">
            ${icon("back")}<span>Back to my hero</span>
          </button>
          <button class="btn btn-ghost" type="button" data-action="sign-out">
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </section>
  `;
}
