import { escapeHtml, icon } from "../ui.mjs";

export function renderWelcome({ tab = "signin", error = "", pending = false, values = {} } = {}) {
  const signup = tab === "signup";
  const off = pending ? "disabled" : "";
  return `
    <section class="gate" aria-labelledby="gate-title"><div class="gate-card">
      <span class="gate-badge" aria-hidden="true">${icon(signup ? "plus" : "lock")}</span>
      <h2 id="gate-title">${signup ? "Create your class" : "Welcome back"}</h2>
      <p class="gate-lede">${signup ? "Your account gets private classes, progress and backups." : "Sign in to open your classes."}</p>
      <div class="segmented gate-tabs" role="group" aria-label="Sign in or create an account">
        <button type="button" class="${signup ? "" : "is-active"}" data-action="gate-tab" data-tab="signin">Sign in</button>
        <button type="button" class="${signup ? "is-active" : ""}" data-action="gate-tab" data-tab="signup">New account</button>
      </div>
      ${signup ? `
        <form class="gate-form" data-action="sign-up">
          <label class="field"><span>Class name</span><input name="displayName" value="${escapeHtml(values.displayName || "")}" ${off} /></label>
          <label class="field"><span>Username</span><input id="gate-username" name="username" autocomplete="username" value="${escapeHtml(values.username || "")}" ${off} /></label>
          <label class="field"><span>Password</span><input name="password" type="password" autocomplete="new-password" ${off} /></label>
          <label class="field"><span>Repeat password</span><input name="confirm" type="password" autocomplete="new-password" ${off} /></label>
          <button class="btn btn-primary" type="submit" ${off}>${icon("plus")}<span>${pending ? "Creating..." : "Create account"}</span></button>
        </form>` : `
        <form class="gate-form" data-action="sign-in">
          <label class="field"><span>Username</span><input id="gate-username" name="username" autocomplete="username" value="${escapeHtml(values.username || "")}" ${off} /></label>
          <label class="field"><span>Password</span><input id="gate-password" name="password" type="password" autocomplete="current-password" ${off} /></label>
          <button class="btn btn-primary" type="submit" ${off}>${icon("unlock")}<span>${pending ? "Signing in..." : "Sign in"}</span></button>
        </form>`}
      ${error ? `<p class="gate-error" role="alert">${escapeHtml(error)}</p>` : ""}
    </div></section>`;
}
