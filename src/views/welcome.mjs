/* ============================================================
   welcome.mjs — la page d'accueil
   La première chose que voit un appareil : à qui appartient cet écran ?
   L'enseignant se connecte, ou crée la classe qui n'existe pas encore.
   ============================================================ */

import { escapeHtml, icon } from "../ui.mjs";

export function renderWelcome({ tab = "signin", error = "", pending = false, values = {} } = {}) {
  const signup = tab === "signup";

  return `
    <section class="gate" aria-labelledby="gate-title">
      <div class="gate-card">
        <span class="gate-badge" aria-hidden="true">${icon(signup ? "plus" : "lock")}</span>
        <h2 id="gate-title">${signup ? "Create your class" : "Welcome back"}</h2>
        <p class="gate-lede">
          ${signup
            ? "Your class gets its own heroes, its own progress and its own backups. Nobody else can see them."
            : "Sign in to open your class. The pupils can then browse their heroes on this device."}
        </p>

        <div class="segmented gate-tabs" role="group" aria-label="Sign in or create a class">
          <button type="button" class="${signup ? "" : "is-active"}" data-action="gate-tab" data-tab="signin" aria-pressed="${!signup}">Sign in</button>
          <button type="button" class="${signup ? "is-active" : ""}" data-action="gate-tab" data-tab="signup" aria-pressed="${signup}">New class</button>
        </div>

        ${signup ? renderSignUpForm(values, pending) : renderSignInForm(values, pending)}

        ${error ? `<p class="gate-error" role="alert">${escapeHtml(error)}</p>` : ""}
      </div>
    </section>
  `;
}

function renderSignInForm(values, pending) {
  const off = pending ? "disabled" : "";
  return `
    <form class="gate-form" data-action="sign-in">
      <label class="field">
        <span>Username</span>
        <input
          id="gate-username"
          name="username"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          value="${escapeHtml(values.username || "")}"
          ${off}
        />
      </label>
      <label class="field">
        <span>Password</span>
        <input id="gate-password" name="password" type="password" autocomplete="current-password" ${off} />
      </label>
      <button class="btn btn-primary" type="submit" ${off}>
        ${icon("unlock")}<span>${pending ? "Signing in…" : "Sign in"}</span>
      </button>
    </form>
  `;
}

function renderSignUpForm(values, pending) {
  const off = pending ? "disabled" : "";
  return `
    <form class="gate-form" data-action="sign-up">
      <label class="field">
        <span>Class name</span>
        <input
          id="gate-display-name"
          name="displayName"
          placeholder="Mrs Dupont — 7P"
          value="${escapeHtml(values.displayName || "")}"
          ${off}
        />
      </label>
      <label class="field">
        <span>Username</span>
        <input
          id="gate-username"
          name="username"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          placeholder="mrs.dupont"
          value="${escapeHtml(values.username || "")}"
          ${off}
        />
        <small class="field-hint">3 to 32 characters: letters, digits, dot, dash or underscore.</small>
      </label>
      <label class="field">
        <span>Password</span>
        <input id="gate-password" name="password" type="password" autocomplete="new-password" ${off} />
      </label>
      <label class="field">
        <span>Repeat the password</span>
        <input id="gate-confirm" name="confirm" type="password" autocomplete="new-password" ${off} />
      </label>
      <button class="btn btn-primary" type="submit" ${off}>
        ${icon("plus")}<span>${pending ? "Creating…" : "Create the class"}</span>
      </button>
      <p class="gate-help">This password opens the class and, typed again, the teacher console. Keep it for yourself.</p>
    </form>
  `;
}
