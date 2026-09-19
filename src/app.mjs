/* Application coordinator: routing, UI state, action dispatch and persistence.
 * Views generate markup; domain.mjs owns game rules. Keep gameplay mutations
 * in the domain so teacher controls, pupil shopping and tests share one policy.
 */

import {
  STORAGE_KEY,
  RULE_SECTIONS,
  addPupil,
  addRule,
  awardMoney,
  awardXp,
  canBuyItem,
  changeHpMany,
  clearSelection,
  createInitialState,
  createClass,
  getCurrentClass,
  getPupilById,
  getRewardsBetween,
  getRules,
  getShopItem,
  importState,
  isItemOwned,
  normalizeState,
  purchaseItem,
  removePupil,
  removeRule,
  renamePupil,
  restoreHpAll,
  setRule,
  toggleSelection,
  toggleClassSelection,
  updateCosmetics
} from "./domain.mjs";
import { BRAND } from "./brand.mjs";
import { requestApi } from "./api.mjs";
import {
  SESSION_KEY,
  acceptTerms,
  captureSessionContext,
  changePassword,
  forgetSession,
  getAccount,
  isAdultUnlocked,
  isCurrentSession,
  isSignedIn,
  lockAdult,
  signIn,
  signInWithGoogleCode,
  signOut,
  signUp,
  unlockAdult,
  unlockUntil,
  updateSettings,
  validateNewPassword,
  verifyPassword
} from "./session.mjs";
import { escapeHtml, icon, translateReward } from "./ui.mjs";
import { renderAdmin } from "./views/admin.mjs";
import { renderConsent } from "./views/consent.mjs";
import { renderLockScreen } from "./views/lock.mjs";
import { renderConsole } from "./views/console.mjs";
import { renderWelcome } from "./views/welcome.mjs";
import { mountWelcomeScene } from "./welcome-scene.mjs";
import { renderRules } from "./views/rules.mjs";
import { renderMentions, renderPrivacy, renderTerms } from "./views/legal.mjs";
import { renderAppFooter } from "./views/footer.mjs";
import { renderAddPupilDialog, renderItemDialog, renderNewClassDialog, renderPupilDialog, renderRuleDialog } from "./views/modals.mjs";
import { renderOnboardingWelcome, renderOnboardingLanguage } from "./views/onboarding.mjs";
import { createGuidedTour } from "./tour.mjs";
import { TERMS_VERSION } from "./terms.mjs";
import { mountCharacterViewer } from "./character-runtime.mjs";
import { mountHeroPortraits } from "./portrait-runtime.mjs";
import {
  renderSheikahTopbar,
  renderSheikahNoClass,
  renderSheikahStudent,
  renderSheikahSheet,
  renderSheikahShop,
  renderSheikahPersonalize,
  cosmeticChangesFromDraft
} from "./views/sheikah.mjs";
import {
  mountSheikahViewer,
  unmountSheikahViewer,
  setSheikahAngle,
  setSheikahRotation,
  setSheikahTheme,
  retrySheikahViewer,
  setSheikahFreeViewHandler
} from "./sheikah-runtime.mjs";
import { t, tItem, getLang, setLang, initLanguage, translateMessage } from "./i18n.mjs";

const app = document.querySelector("#app");
const toastRoot = document.querySelector("#toasts");
const dialogRoot = document.querySelector("#dialog-root");
let releaseCharacterViewer = null;
let teacherUnlockRequest = 0;
let releaseWelcomeScene = null;
let activeTour = null;

// Remember the chosen pupil on this device only, never in shared server state.
const STUDENT_KEY = "classquest:student";

let account = getAccount();
let activeSession = captureSessionContext();
let state = account ? loadState(account.id) : createInitialState({ samples: false });
let history = [];
let studentPupilId = loadStudentId();
let persistTimer = null;
let saveInFlight = null;
let saveQueued = false;
let localDirty = account ? loadDirty(account.id) : false;
let syncConflict = false;
let gateRequest = 0;
let armedDanger = null;
let googleEnabled = false;
const pendingFlash = new Set();

/* Transient UI preferences. Resetting them must never change classroom data. */
const ui = {
  query: "",
  density: "auto",
  shopCategory: "outfit",
  xpAmount: 100,
  coinAmount: 20,
  consoleOpen: false,
  focusPanel: null,
  openPanels: new Set(["hero"]),
  lockError: "",
  lockPending: false,
  rulesEditing: false,
  onboardingStep: null,
  teacherDialog: null,
  teacherAfterUnlock: 'console',
  addFromConsole: false,
  addClassId: null,
  focusClassHeading: false,
  gateTab: "signin",
  gateError: "",
  gatePending: false,
  gateValues: {},
  adminAccounts: [],
  adminPending: false,
  adminError: "",
  consentPending: false,
  consentError: "",
  /* Interface Sheikah */
  sheikahView: "board",
  angle: "quarter",
  rotating: false,
  draft: null,
  shopPreview: null
};

setSheikahFreeViewHandler(() => {
  ui.rotating = false;
  const control = app.querySelector('[data-action="sheikah-rotate"]');
  control?.classList.remove("on");
  control?.setAttribute("aria-pressed", "false");
});

/* ---------- Theme preference ---------- */

const THEME_KEY = "classquest:theme";
let theme = (() => {
  const fromAccount = account?.settings?.theme;
  if (fromAccount === "light" || fromAccount === "dark") return fromAccount;
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* Storage may be blocked. */ }
  return "light";
})();

function applyTheme() {
  // The public entry is always light; retain the user's theme for the game.
  const displayedTheme = isSignedIn() ? theme : "light";
  document.documentElement.dataset.theme = displayedTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", displayedTheme === "light" ? "#e7e9df" : "#101b20");
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* Keep the in-memory theme. */ }
  setSheikahTheme(displayedTheme);
}

/* ---------- Hash routing ---------- */

/* True only when the account accepted the legal revision currently in force,
 * so bumping TERMS_VERSION re-asks consent, as the Terms of use state. */
function hasAcceptedTerms() {
  return Boolean(account?.terms?.acceptedAt) && account.terms.version === TERMS_VERSION;
}

function currentView() {
  if (location.hash === "#mentions-legales") return "mentions";
  if (location.hash === "#politique-de-confidentialite") return "privacy";
  if (location.hash === "#conditions-utilisation") return "terms";
  if (!isSignedIn()) return "welcome";
  // The current legal revision must be accepted. Accounts created through
  // Google accept it after login; a new TEXT revision asks it again.
  if (!hasAcceptedTerms()) return "consent";
  if (location.hash === "#rules") return "rules";
  if (location.hash === "#admin" && account?.role === "admin" && isAdultUnlocked()) return "admin";
  // Older #board/#student bookmarks now enter the same public class space.
  return "class";
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

window.addEventListener("hashchange", () => {
  if (activeTour && app.dataset.view !== currentView()) endSetupTour({ complete: true, silent: true });
  closeDialog({ resumeConsole: false });
  ui.query = "";
  ui.consoleOpen = false;
  ui.lockError = "";
  ui.sheikahView = "board";
  ui.draft = null;
  if (location.hash !== "#rules") ui.rulesEditing = false;
  window.scrollTo({ top: 0 });
  if (currentView() === "admin") loadAdminAccounts();
  else render();
});

/* ---------- Rendering ---------- */

function render() {
  releaseWelcomeScene?.();
  releaseWelcomeScene = null;
  const view = currentView();
  applyTheme();
  app.dataset.view = view;
  const memory = captureUiMemory();
  app.innerHTML = `
    ${renderSheikahTopbar({ view, state, account, unlocked: isAdultUnlocked() })}
    ${renderConflict()}
    ${renderViewBody(view)}
    ${renderAppFooter()}
  `;
  const titleKey = view === "welcome" ? "welcome.title.signin"
    : view === "rules" ? "app.aria.rules"
    : view === "admin" ? "app.aria.accounts"
    : view === "consent" ? "consent.title"
    : view === "mentions" ? "footer.mentions"
    : view === "privacy" ? "footer.privacy"
    : view === "terms" ? "footer.terms"
    : "nav.class";
  document.title = `${t(titleKey)} · ${BRAND.name}`;
  renderTeacherDialog();
  restoreUiMemory(memory);
  flushFlash();
  syncSheikahRuntime();
  mountHeroPortraits(document.body);
  if (view === "welcome") releaseWelcomeScene = mountWelcomeScene(app);
  updateClock();
  if (ui.focusClassHeading && view === 'class' && ui.sheikahView === 'board') {
    ui.focusClassHeading = false;
    app.querySelector('.picker h1')?.focus({ preventScroll:true });
    window.scrollTo({ top:0 });
  }
  // The setup tour highlights live DOM, so re-anchor it after any rebuild.
  if (activeTour) Promise.resolve(activeTour.refresh?.()).catch(() => {});
  revealCookieControls();
}

/* The cookie manager is loaded from index.html by the referencement branch.
 * The footer button only appears once that script is actually available, so
 * the control is never shown dead on builds without consent management. */
function revealCookieControls() {
  const available = typeof window.tarteaucitron !== "undefined";
  for (const el of document.querySelectorAll("[data-cookies-button], [data-cookies-dot]")) {
    el.hidden = !available;
  }
}

function renderSheikahBody(view) {
  const classroom = getCurrentClass(state);
  if (!classroom) return renderSheikahNoClass();
  const pupil = ui.sheikahView === 'board' ? null : getStudentPupil(classroom);
  if (pupil && ui.sheikahView === "shop") return renderSheikahShop(pupil, ui);
  if (pupil && ui.sheikahView === "personalize") return renderSheikahPersonalize(pupil, ui);
  return renderSheikahStudent({ classroom, ui, pupil, classView:true,
    selectionMode:ui.teacherDialog === 'console' && isAdultUnlocked(), selectedIds:state.selectedPupilIds });
}

function syncSheikahRuntime() {
  const host = app.querySelector("[data-viewer-host]");
  if (!host) {
    unmountSheikahViewer();
    return;
  }
  let look = {};
  try { look = JSON.parse(host.dataset.look || "{}"); } catch { /* Retain the fallback look. */ }
  mountSheikahViewer(host, look);
}

function renderViewBody(view) {
  if (view === "welcome") {
    return `<main class="welcome-page">${renderWelcome({
      tab: ui.gateTab,
      error: ui.gateError,
      pending: ui.gatePending,
      values: ui.gateValues,
      google: googleEnabled && !isSignedIn()
    })}</main>`;
  }
  if (view === "admin") return renderAdmin({ accounts: ui.adminAccounts, pending: ui.adminPending, error: ui.adminError, currentAccountId: account?.id });
  if (view === "consent") return renderConsent({ pending: ui.consentPending, error: ui.consentError });
  if (view === "rules") {
    return `<main class="page page-narrow">${renderRules({ unlocked: isAdultUnlocked(), rules: getRules(state), editing: ui.rulesEditing })}</main>`;
  }
  if (view === "mentions") {
    return `<main class="page page-narrow legal-page">${renderMentions()}</main>`;
  }
  if (view === "privacy") {
    return `<main class="page page-narrow legal-page">${renderPrivacy()}</main>`;
  }
  if (view === "terms") {
    return `<main class="page page-narrow legal-page">${renderTerms()}</main>`;
  }

  return renderSheikahBody(view);
}

function getStudentPupil(classroom) {
  const pupil = studentPupilId
    ? classroom.pupils.find((item) => item.id === studentPupilId) || null
    : null;
  if (studentPupilId && !pupil) rememberStudent(null);
  return pupil;
}

function renderConflict() {
  if (!syncConflict || !account) return "";
  return `<aside class="sync-conflict" role="alert"><strong>${t("app.conflict.title")} :</strong> ${t("app.conflict.body")} <button class="btn btn-sm" data-action="export">${t("app.conflict.export")}</button><button class="btn btn-sm" data-action="reload-server">${t("app.conflict.load")}</button></aside>`;
}

/* Reward targets are always the current selection. "Whole class" is a real
 * selection action, not a hidden mode, so the cards show exactly who receives. */
function getTargets() {
  const classroom = getCurrentClass(state);
  if (!classroom) return [];
  const inClass = new Set(classroom.pupils.map((pupil) => pupil.id));
  return state.selectedPupilIds.filter((id) => inClass.has(id));
}

function getShopPupil(source = null) {
  if (source && app.contains(source)) return studentPupilId ? getPupilById(state, studentPupilId) : null;
  const dialogPupil = dialogRoot.querySelector('dialog[data-pupil-id]')?.dataset.pupilId;
  if (dialogPupil) return getPupilById(state, dialogPupil);
  if (currentView() === "class" && ui.teacherDialog !== 'console') return studentPupilId ? getPupilById(state, studentPupilId) : null;
  return state.selectedPupilId ? getPupilById(state, state.selectedPupilId) : null;
}

/* Preserve focus, caret and scroll while rebuilding the view. A full DOM
 * render must not interrupt typing in the search box or moving through controls.
 */

function captureUiMemory() {
  const active = document.activeElement;
  const focusAction = active?.dataset?.action || null;
  const actionControls = focusAction
    ? [...document.querySelectorAll(`[data-action="${CSS.escape(focusAction)}"]`)]
    : [];
  return {
    focusId: active && active.id ? active.id : null,
    focusAction,
    focusActionIndex: actionControls.indexOf(active),
    caret: active && typeof active.selectionStart === "number" ? active.selectionStart : null,
    consoleScroll: dialogRoot.querySelector(".teacher-console-content")?.scrollTop ?? 0,
    pageScroll: window.scrollY
  };
}

function restoreUiMemory(memory) {
  const console_ = dialogRoot.querySelector(".teacher-console-content");
  if (console_) console_.scrollTop = memory.consoleScroll;

  let next = memory.focusId ? document.getElementById(memory.focusId) : null;
  if (!next && memory.focusAction && memory.focusActionIndex >= 0) {
    next = [...document.querySelectorAll(`[data-action="${CSS.escape(memory.focusAction)}"]`)][memory.focusActionIndex];
  }
  if (next) {
    next.focus({ preventScroll: true });
    if (memory.caret !== null && typeof next.setSelectionRange === "function") {
      try {
        next.setSelectionRange(memory.caret, memory.caret);
      } catch {
        // Number inputs do not implement text selection ranges.
      }
    }
  }

  window.scrollTo({ top: memory.pageScroll });
}

function flushFlash() {
  if (!pendingFlash.size) return;
  for (const id of pendingFlash) {
    const safe = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : String(id).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const card = app.querySelector(`[data-pupil-id="${safe}"]`)?.closest(".hero-card, .hero-row, .rune-card");
    if (!card) continue;
    card.classList.add("is-flash");
    card.addEventListener("animationend", () => card.classList.remove("is-flash"), { once: true });
  }
  pendingFlash.clear();
}

function updateClock() {
  const clock = app.querySelector("#clock");
  if (clock) clock.textContent = new Date().toLocaleTimeString(getLang() === "fr" ? "fr-CH" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  const access = dialogRoot.querySelector('[data-teacher-time]');
  if (access) {
    const seconds = Math.max(0, Math.ceil(((unlockUntil() || 0) - Date.now()) / 1000));
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    access.textContent = seconds ? t('console.accessRemaining', { time }) : t('console.accessExpired');
  }
}

/* Event delegation survives complete DOM replacement without accumulating
 * per-control listeners or losing newly rendered controls.
 */

// The teacher gate controls classroom UI actions, not the server's account
// authorization. Recheck it on each mutation because an open screen can expire.
const TEACHER_ACTIONS = new Set([
  "award-xp", "award-money", "hp-minus", "hp-plus", "heal-all",
  "remove-pupil", "reset-all", "export", "import", "refresh-admin", "focus-add", "add-class"
]);
const TEACHER_FORMS = new Set(["custom-xp", "custom-money", "add-pupil", "rename-pupil", "change-password", "admin-reset", "save-rule", "create-class"]);
function allowTeacherAction() {
  if (isAdultUnlocked()) return true;
  openTeacherGate();
  return false;
}

function dispatchActionClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger || trigger.tagName === "FORM") return;
  const action = trigger.dataset.action;
  if (!ACTIONS[action]) return;
  event.preventDefault();
  if (TEACHER_ACTIONS.has(action) && !isAdultUnlocked()) {
    openTeacherGate(action === "add-class" ? "add" : "console");
    return;
  }
  ACTIONS[action](trigger);
}
app.addEventListener("click", dispatchActionClick);
dialogRoot.addEventListener("click", dispatchActionClick);

app.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-action]");
  if (!form) return;
  event.preventDefault();
  if (TEACHER_FORMS.has(form.dataset.action) && !allowTeacherAction()) return;
  const action = FORMS[form.dataset.action];
  if (action) action(form);
});

dialogRoot.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-action]");
  if (!form) return;
  event.preventDefault();
  if (TEACHER_FORMS.has(form.dataset.action) && !allowTeacherAction()) return;
  const action = FORMS[form.dataset.action];
  if (action) action(form);
});

function handleInput(event) {
  const field = event.target;
  if (field.dataset.action === 'teacher-target') {
    if (!allowTeacherAction()) return;
    const pupil = getCurrentClass(state)?.pupils.find(item => item.id === field.value);
    state = { ...state, selectedPupilId:pupil?.id || null, selectedPupilIds:pupil ? [pupil.id] : [] };
    render();
    return;
  }
  if (field.form?.classList.contains("gate-form") && ["username", "email"].includes(field.name)) {
    ui.gateValues[field.name] = field.value;
  }
  if (field.dataset.action === "search") {
    ui.query = field.value;
    render();
    return;
  }
  if (field.id === "xp-amount") ui.xpAmount = field.value;
  if (field.id === "coin-amount") ui.coinAmount = field.value;
}
app.addEventListener("input", handleInput);
dialogRoot.addEventListener("input", handleInput);

function handlePanelToggle(event) {
  const panel = event.target.closest("details[data-panel]");
  if (!panel) return;
  if (panel.open) ui.openPanels.add(panel.dataset.panel);
  else ui.openPanels.delete(panel.dataset.panel);
}
app.addEventListener("toggle", handlePanelToggle, true);
dialogRoot.addEventListener("toggle", handlePanelToggle, true);

/* Topbar dropdowns (class picker, tools) behave like menus: one open at a time,
 * and clicking elsewhere closes them. */
document.addEventListener("toggle", (event) => {
  const details = event.target;
  if (!details.open || !details.matches(".class-picker, .tablet-tools")) return;
  document.querySelectorAll(".class-picker[open], .tablet-tools[open]").forEach((other) => {
    if (other !== details) other.open = false;
  });
}, true);
document.addEventListener("click", (event) => {
  document.querySelectorAll(".class-picker[open], .tablet-tools[open]").forEach((details) => {
    if (!details.contains(event.target)) details.open = false;
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === 'Escape' && ui.teacherDialog === 'console' && !event.defaultPrevented) {
    event.preventDefault();
    closeDialog();
    render();
    return;
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !typing) {
    event.preventDefault();
    undo();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === SESSION_KEY || event.key === null) {
    const next = captureSessionContext();
    if (next?.token === activeSession?.token && next?.accountId === activeSession?.accountId && next?.accountId === account?.id) return;
    ++gateRequest;
    closeDialog();
    lockAdult();
    const nextAccount = getAccount();
    if (nextAccount) openAccount(nextAccount);
    else endSession();
    return;
  }
  if (!account || localDirty || event.key !== stateKey(account.id) || !event.newValue) return;
  try {
    state = normalizeState(JSON.parse(event.newValue));
    history = [];
    render();
  } catch {
    // Ignore malformed cache writes from another tab.
  }
});

function showClassRoster() {
  if (ui.teacherDialog !== 'console') closeDialog({ resumeConsole:false });
  rememberStudent(null);
  state = { ...state, selectedPupilId:null, selectedPupilIds:[] };
  ui.sheikahView = "board";
  ui.draft = null;
  ui.shopPreview = null;
  ui.focusClassHeading = true;
  navigate("#class");
}

function chooseClassPupil(pupilId) {
  if (!getCurrentClass(state)?.pupils.some(pupil => pupil.id === pupilId)) return false;
  state = { ...state, selectedPupilId:pupilId, selectedPupilIds:[pupilId] };
  rememberStudent(pupilId);
  return true;
}

function resetHeroCamera() {
  ui.angle = 'quarter';
  ui.rotating = false;
  setSheikahAngle('quarter');
  setSheikahRotation(false);
}

const ACTIONS = {
  "show-class": showClassRoster,
  "show-board": showClassRoster,
  "show-student": showClassRoster,
  "show-rules": () => {
    ui.rulesEditing = false;
    navigate("#rules");
  },
  // Reopen the consent panel from anywhere. Kept off the hash so the router
  // is never disturbed by a #tarteaucitron link.
  "manage-cookies": () => {
    window.tarteaucitron?.userInterface?.openPanel?.();
  },

  /* ---------- Editable classroom rules ---------- */
  "rules-edit": () => {
    if (!allowRulesEdit()) return;
    ui.rulesEditing = true;
    render();
  },
  "rules-done": () => {
    ui.rulesEditing = false;
    render();
  },
  "rule-add": (el) => {
    if (!allowRulesEdit()) return;
    openRuleDialog(el.dataset.section, null);
  },
  "rule-edit": (el) => {
    if (!allowRulesEdit()) return;
    openRuleDialog(el.dataset.section, Number(el.dataset.index));
  },
  "rule-remove": (el) => {
    if (!allowRulesEdit()) return;
    const section = el.dataset.section;
    const index = Number(el.dataset.index);
    const next = removeRule(state, section, index);
    if (next === state) return;
    commit(next);
    toast(t("rules.edit.remove"), "warn", { undo: true });
  },

  /* ---------- First-run setup and classes ---------- */
  "onboarding-next": () => advanceOnboarding(),
  "onboarding-skip": () => finishOnboarding(),
  "onboarding-language": (el) => {
    const lang = el.dataset.lang === "en" ? "en" : "fr";
    setLang(lang);
    rememberAccountLanguage(lang);
    advanceOnboarding();
  },

  /* ---------- Sheikah navigation and customization ---------- */
  "toggle-theme": () => {
    theme = theme === "light" ? "dark" : "light";
    applyTheme();
    if (account) persistSettings({ theme });
    renderPreservingForms();
  },
  "sheikah-open": (el) => {
    if (!chooseClassPupil(el.dataset.pupilId)) return;
    resetHeroCamera();
    ui.sheikahView = "sheet";
    ui.draft = null;
    render();
    window.scrollTo({ top: 0 });
  },
  // Both hero tools (Dressing, Shop) are children of the hero sheet, so every
  // "back" from them returns to the hero — never straight to the class.
  "hero-back": () => {
    resetHeroCamera();
    ui.sheikahView = "sheet";
    ui.draft = null;
    ui.shopPreview = null;
    render();
    window.scrollTo({ top: 0 });
  },
  "sheikah-personalize": (el) => {
    const id = el.dataset.pupilId || studentPupilId || state.selectedPupilId;
    if (!chooseClassPupil(id)) return;
    resetHeroCamera();
    ui.sheikahView = "personalize";
    ui.draft = null;
    render();
    window.scrollTo({ top: 0 });
  },
  "retry-viewer": () => retrySheikahViewer(),
  "sheikah-set": (el) => {
    ui.draft = { ...(ui.draft || {}), [el.dataset.field]: el.dataset.value };
    render();
  },
  "sheikah-angle": (el) => {
    ui.angle = el.dataset.value;
    ui.rotating = false;
    setSheikahAngle(ui.angle);
    setSheikahRotation(false);
    render();
  },
  "sheikah-rotate": () => {
    ui.rotating = !ui.rotating;
    setSheikahRotation(ui.rotating);
    render();
  },
  "sheikah-equip": (el) => {
    resetHeroCamera();
    const draft = ui.draft;
    const next = draft && el.dataset.pupilId
      ? updateCosmetics(state, el.dataset.pupilId, cosmeticChangesFromDraft(draft))
      : state;
    ui.draft = null;
    ui.sheikahView = "sheet";
    if (draft) commit(next);
    else render();
    window.scrollTo({ top: 0 });
    toast(t("sheikah.savedLook"), "success");
  },
  "sheikah-shop": (el) => {
    const id = el.dataset.pupilId || studentPupilId || state.selectedPupilId;
    if (!chooseClassPupil(id)) return;
    resetHeroCamera();
    ui.sheikahView = "shop";
    ui.draft = null;
    ui.shopPreview = null;
    render();
    window.scrollTo({ top: 0 });
  },
  "show-admin": () => {
    if (account?.role !== "admin") return;
    if (!isAdultUnlocked()) { openTeacherGate('admin'); return; }
    if (location.hash === "#admin" && isAdultUnlocked()) loadAdminAccounts();
    else navigate("#admin");
  },
  "refresh-admin": () => loadAdminAccounts(),
  "account-settings": () => {
    ui.openPanels.add("account");
    openTeacherConsole();
  },
  "teacher-console": () => {
    if (ui.teacherDialog === 'console') { closeDialog(); render(); }
    else openTeacherConsole();
  },

  "gate-tab": (el) => {
    ui.gateTab = el.dataset.tab;
    ui.gateError = "";
    render();
  },

  "sign-out": async () => {
    const context = captureSessionContext();
    const name = account?.displayName || "";
    if (localDirty && !syncConflict) await saveToServer();
    if (context && !isCurrentSession(context)) return;
    const unsynced = localDirty;
    ++gateRequest;
    await signOut();
    if (getAccount()) return; // A newer sign-in must not be cleared by this logout.
    endSession();
    toast(unsynced
      ? "Signed out. Unsynced changes remain saved on this device."
      : (name ? t("notice.signedOutNamed", { name }) : "Signed out."), unsynced ? "warn" : "info");
  },

  "lock-adult": () => {
    closeDialog({ resumeConsole:false });
    lockAdult();
    ui.consoleOpen = false;
    ui.sheikahView = 'board';
    navigate("#class");
    toast("Adult access locked.", "info");
  },

  "reload-server": () => reloadServerCopy(),

  "toggle-console": () => {
    ui.consoleOpen = !ui.consoleOpen;
    render();
  },

  "select-class": (el) => {
    disarmDanger();
    ui.sheikahView = "board";
    ui.draft = null;
    if (ui.teacherDialog !== 'console') closeDialog({ resumeConsole:false });
    rememberStudent(null);
    state = { ...state, activeClassId: el.dataset.classId, selectedPupilId: null, selectedPupilIds: [] };
    navigate('#class');
  },

  // A new classroom is a teacher action: the "+" in the class menu opens a
  // small form for the name and, optionally, the first students.
  "add-class": () => {
    disarmDanger();
    showDialog(renderNewClassDialog(), 'add');
  },

  // Selecting a hero also focuses its details in the teacher console.
  "toggle-pupil": (el) => {
    const pupilId = el.dataset.pupilId;
    const next = toggleSelection(state, pupilId);
    if (next.selectedPupilIds.length) ui.openPanels.add("hero");
    commit(next, { record: false });
  },

  "zoom-pupil": (el) => {
    ACTIONS['sheikah-open'](el);
  },
  "close-dialog": () => { closeDialog(); render(); },

  "toggle-class-selection": () => commit(toggleClassSelection(state, state.activeClassId), { record: false }),

  "clear-selection": () => commit(clearSelection(state), { record: false }),

  density: (el) => {
    ui.density = el.dataset.density;
    render();
  },

  "clear-search": () => {
    ui.query = "";
    render();
  },

  "focus-add": () => {
    const classroom = getCurrentClass(state);
    if (!classroom) {
      showDialog(renderNewClassDialog(), 'add');
      dialogRoot.querySelector("#new-class-name")?.focus();
      return;
    }
    ui.addFromConsole = ui.teacherDialog === 'console';
    ui.addClassId = classroom.id;
    showDialog(renderAddPupilDialog(classroom), 'add');
    dialogRoot.querySelector('#pupil-name')?.focus();
  },

  "award-xp": (el) => giveXp(Number(el.dataset.amount), el.dataset.reason),

  step: (el) => {
    const field = document.getElementById(el.dataset.field);
    if (!field) return;
    const step = Number(el.dataset.step);
    const next = Math.max(1, (Number(field.value) || 0) + step);
    field.value = next;
    if (field.id === "xp-amount") ui.xpAmount = next;
    if (field.id === "coin-amount") ui.coinAmount = next;
  },

  "hp-minus": () => changeTargetHp(-1),
  "hp-plus": () => changeTargetHp(1),
  "heal-all": () => {
    commit(restoreHpAll(state, state.activeClassId));
    toast("Hit points restored for the whole class.", "success");
  },

  "award-money": (el) => giveMoney(Number(el.dataset.amount)),

  "remove-pupil": (el) => {
    const pupil = getPupilById(state, el.dataset.pupilId);
    if (!pupil) return;
    commit(removePupil(state, pupil.id));
    toast(t("notice.removed", { name: pupil.name }), "warn", { undo: true });
  },

  "shop-category": (el) => {
    ui.shopCategory = el.dataset.category;
    ui.shopPreview = null;
    render();
  },

  "preview-item": (el) => {
    if (currentView() === 'class' && app.contains(el) && ui.sheikahView === "shop") {
      ui.shopPreview = ui.shopPreview === el.dataset.itemId ? null : el.dataset.itemId;
      render();
      if (matchMedia('(max-width: 1100px)').matches) {
        const stage = app.querySelector('.atelier-stage');
        const headerHeight = app.querySelector('.topbar')?.getBoundingClientRect().height || 0;
        if (stage) window.scrollTo({ top: Math.max(0, window.scrollY + stage.getBoundingClientRect().top - headerHeight - 12), behavior: 'instant' });
      }
      return;
    }
    openItemDialog(el.dataset.itemId, getShopPupil(el));
  },
  "shop-item": (el) => buyOrEquip(el.dataset.itemId, getShopPupil(el)),

  "student-pick": (el) => {
    if (!chooseClassPupil(el.dataset.pupilId)) return;
    resetHeroCamera();
    ui.sheikahView = "sheet";
    ui.draft = null;
    ui.query = "";
    render();
    window.scrollTo({ top: 0 });
  },

  "change-hero": showClassRoster,

  undo: () => undo(),

  export: () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `class-odyssey-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast("Backup file downloaded.", "success");
  },

  import: () => document.querySelector("#import-file")?.click(),

  // The existing two-step reset keeps the pending destructive action visible.
  "reset-all": () => {
    if (armedDanger !== "reset") {
      armedDanger = "reset";
      render();
      setTimeout(disarmDanger, 5000);
      return;
    }
    armedDanger = null;
    commit(createInitialState({ samples: false }));
    toast("Every class was erased.", "warn", { undo: true });
  }
};

const FORMS = {
  "sign-in": async (form) => {
    if (ui.gatePending) return;
    const request = ++gateRequest;
    const data = new FormData(form);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    ui.gateValues = { username };
    if (!username || !password) {
      ui.gateError = "Type the username and password.";
      render();
      return;
    }
    ui.gatePending = true;
    ui.gateError = "";
    render();
    const result = await signIn(username, password);
    if (request !== gateRequest) return;
    ui.gatePending = false;
    if (!result.ok) {
      ui.gateError = result.error;
      render();
      return;
    }
    openAccount(result.account);
    toast(t("notice.welcome", { name: result.account.displayName }), "success");
  },

  "sign-up": async (form) => {
    if (ui.gatePending) return;
    const request = ++gateRequest;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    ui.gateValues = { email };
    const problem = validateNewPassword(password, data.get("confirm")) || (data.get("terms") ? "" : "the terms must be accepted");
    if (problem) {
      ui.gateError = problem;
      render();
      return;
    }
    ui.gatePending = true;
    ui.gateError = "";
    render();
    const result = await signUp({ email, password, termsAccepted: true });
    if (request !== gateRequest) return;
    ui.gatePending = false;
    if (!result.ok) {
      ui.gateError = result.error;
      render();
      return;
    }
    openAccount(result.account);
    toast(t("notice.accountReady", { name: result.account.displayName }), "levelup");
  },

  "accept-consent": async (form) => {
    if (ui.consentPending) return;
    const data = new FormData(form);
    if (!data.get("terms")) {
      ui.consentError = "the terms must be accepted";
      render();
      return;
    }
    ui.consentPending = true;
    ui.consentError = "";
    render();
    const result = await acceptTerms();
    if (result.stale) return;
    ui.consentPending = false;
    if (!result.ok) {
      ui.consentError = result.error;
      render();
      return;
    }
    account = result.account;
    activeSession = captureSessionContext();
    render();
    window.scrollTo({ top: 0 });
    maybeStartOnboarding();
  },

  unlock: async (form) => {
    if (ui.lockPending) return;
    const request = ++teacherUnlockRequest;
    const context = captureSessionContext();
    const password = String(new FormData(form).get("password") || "");
    if (!password) {
      ui.lockError = "Type the account password first.";
      render();
      return;
    }
    ui.lockPending = true;
    ui.lockError = "";
    render();
    const result = await verifyPassword(password);
    if (!isCurrentSession(context) || request !== teacherUnlockRequest || ui.teacherDialog !== 'unlock') return;
    ui.lockPending = false;
    if (result.expired) {
      endSession("The session ended. Sign in again. Your local cache was kept.", context);
      return;
    }
    if (!result.ok) {
      ui.lockError = result.error;
      render();
      dialogRoot.querySelector('#adult-password')?.focus();
      return;
    }
    unlockAdult();
    const target = ui.teacherAfterUnlock;
    closeDialog({ resumeConsole:false });
    if (target === 'admin' && account?.role === 'admin') navigate('#admin');
    else if (target === 'rules') { ui.rulesEditing = true; navigate('#rules'); }
    else if (target === 'add') ACTIONS['add-class']();
    else openTeacherConsole();
    toast(result.offline ? "Console unlocked offline." : "Console unlocked.", "success");
  },

  "change-password": async (form) => {
    const data = new FormData(form);
    const current = String(data.get("current") || "");
    const next = String(data.get("next") || "");
    const problem = validateNewPassword(next, data.get("confirm"));
    if (problem) return toast(problem, "error");
    const result = await changePassword(current, next);
    if (!result.ok) return toast(result.error, "error");
    form.reset();
    unlockAdult();
    toast("Password updated. Other devices were signed out.", "success");
  },

  "admin-reset": async (form) => {
    const password = String(new FormData(form).get("password") || "");
    const problem = validateNewPassword(password, password);
    if (problem) return toast(problem, "error");
    const context = captureSessionContext();
    const accountId = form.dataset.accountId;
    let response;
    try {
      response = await requestApi(`admin/accounts/${accountId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Session-Token": context?.token || "" },
        body: JSON.stringify({ password })
      });
    } catch {
      toast("The server is unreachable.", "error");
      return;
    }
    if (!isCurrentSession(context)) return;
    const payload = await response.json().catch(() => null);
    if (!response.ok) return toast(payload?.error || "Password reset failed.", "error");
    form.reset();
    toast("Password reset. That account's sessions were revoked.", "success");
    loadAdminAccounts();
  },

  "custom-xp": (form) => {
    const amount = Number(new FormData(form).get("amount"));
    giveXp(amount, t("event.customXp"));
  },

  "custom-money": (form) => {
    const amount = Number(new FormData(form).get("amount"));
    giveMoney(amount);
  },

  "add-pupil": (form) => {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) {
      toast("Type a first name before adding a hero.", "info");
      form.querySelector("#pupil-name")?.focus();
      return;
    }
    const classId = form.dataset.classId || state.activeClassId;
    const classroom = state.classes.find(item => item.id === classId);
    if (!classroom) { closeDialog(); return; }
    const wasDialog = dialogRoot.contains(form);
    const returnToConsole = ui.teacherDialog === 'add' && ui.addFromConsole;
    const next = addPupil(state, classId, {
      name,
      gender: String(data.get("gender") || "boy"),
      skinTone: String(data.get("skinTone") || "light")
    });
    if (wasDialog) closeDialog({ resumeConsole:false });
    commit(next);
    if (returnToConsole) { ui.addFromConsole=false; openTeacherConsole(); }
    toast(t("notice.joined", { name, classroom: classroom.name }), "success");
    dialogRoot.querySelector('[data-action="focus-add"]')?.focus({ preventScroll: true });
  },

  "create-class": (form) => {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) {
      toast(t("class.new.nameRequired"), "info");
      form.querySelector("#new-class-name")?.focus();
      return;
    }
    const students = String(data.get("students") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const next = createClass(state, { name, students });
    if (next === state) return;
    closeDialog({ resumeConsole:false });
    ui.sheikahView = "board";
    ui.draft = null;
    rememberStudent(null);
    commit(next);
    navigate("#class");
    toast(t("notice.classCreated", { name }), "success");
  },

  "rename-pupil": (form) => {
    if (!state.selectedPupilId) return;
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name) return;
    commit(renamePupil(state, state.selectedPupilId, name));
    toast("Name updated.", "success");
  },

  "save-rule": (form) => {
    const section = form.dataset.section;
    if (!RULE_SECTIONS.includes(section)) return;
    const data = new FormData(form);
    const fr = String(data.get("fr") || "").trim();
    const en = String(data.get("en") || "").trim();
    if (!fr) {
      toast(t("rules.edit.required"), "info");
      form.querySelector('textarea[name="fr"]')?.focus();
      return;
    }
    const index = form.dataset.index === "" ? null : Number(form.dataset.index);
    const next = index === null
      ? addRule(state, section, { fr, en })
      : setRule(state, section, index, { fr, en });
    closeDialog();
    if (next === state) render();
    else commit(next);
  },

  "order-bespoke": (form) => {
    const pupil = getShopPupil();
    const data = new FormData(form);
    const item = getShopItem(String(data.get("itemId") || ""));
    const note = String(data.get("note") || "").trim();
    if (!pupil || !item || item.type !== "bespoke" || !note) return;
    if (!canBuyItem(pupil, item)) {
      toast(t("notice.orderRequires", { level: item.minLevel, price: item.price }), "error");
      return;
    }
    const next = purchaseItem(state, pupil.id, item.id, note);
    closeDialog();
    commit(next);
    toast(t("notice.orderSaved", { name: pupil.name }), "levelup");
  }
};

/* ---------- Classroom rewards ---------- */

function giveXp(amount, reason) {
  const targets = getTargets();
  if (!targets.length || !Number.isFinite(amount) || amount < 1) return;
  targets.forEach((id) => pendingFlash.add(id));
  commit(awardXp(state, targets, amount, reason));
  toast(`+${amount} XP · ${reason} · ${describeTargets(targets)}`, "xp");
}

function giveMoney(amount) {
  const targets = getTargets();
  if (!targets.length || !Number.isFinite(amount) || amount < 1) return;
  targets.forEach((id) => pendingFlash.add(id));
  commit(awardMoney(state, targets, amount, t("event.teacherCoins")));
  toast(`+${amount} ${t("common.coins")} · ${describeTargets(targets)}`, "coin");
}

function changeTargetHp(delta) {
  const targets = getTargets();
  if (!targets.length) return;
  targets.forEach((id) => pendingFlash.add(id));
  commit(changeHpMany(state, targets, delta));
}

function describeTargets(targets) {
  const classroom = getCurrentClass(state);
  if (classroom && targets.length === classroom.pupils.length) return classroom.name;
  if (targets.length === 1) return getPupilById(state, targets[0])?.name || t("notice.oneHero");
  return t("notice.heroes", { count: targets.length });
}

function buyOrEquip(itemId, pupil = getShopPupil()) {
  const item = getShopItem(itemId);
  if (!pupil || !item) return;

  if (item.type === "bespoke") {
    openItemDialog(itemId);
    return;
  }

  if (isItemOwned(pupil, itemId) || !item.price) {
    commit(updateCosmetics(state, pupil.id, { [item.type]: itemId }));
    toast(t("notice.equipped", { name: tItem(item, "name") }), "success");
    return;
  }

  const next = purchaseItem(state, pupil.id, itemId);
  if (next === state) {
    const why = pupil.level < item.minLevel
      ? t("notice.itemLevel", { name: tItem(item, "name"), level: item.minLevel })
      : t("notice.itemPrice", { name: tItem(item, "name"), price: item.price, money: pupil.money });
    toast(why, "error");
    return;
  }
  commit(next);
  toast(t("notice.bought", { name: tItem(item, "name") }), "levelup");
}

/* ---------- Native dialog lifecycle ---------- */

function openPupilDialog(pupilId) {
  const pupil = getPupilById(state, pupilId);
  if (!pupil) return;
  showDialog(renderPupilDialog(pupil));
  const viewer = dialogRoot.querySelector("[data-base-character-viewer]");
  if (viewer) releaseCharacterViewer = mountCharacterViewer(viewer);
}

function openItemDialog(itemId, pupil = getShopPupil()) {
  const item = getShopItem(itemId);
  if (!pupil || !item) return;
  showDialog(renderItemDialog(item, pupil));
}

function showDialog(html, teacherMode = null) {
  const continuingUnlock = teacherMode === 'unlock' && ui.teacherDialog === 'unlock';
  closeDialog({ resumeConsole:false, preserveUnlock:continuingUnlock });
  ui.teacherDialog = teacherMode;
  dialogRoot.innerHTML = html;
  const dialog = dialogRoot.querySelector("dialog");
  if (!dialog) return;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && teacherMode !== 'console') closeDialog();
  });
  dialog.addEventListener("close", () => {
    if (dialogRoot.contains(dialog)) {
      closeDialog();
      render();
    }
  });
  if (teacherMode === 'console') dialog.show();
  else dialog.showModal();
  document.body.dataset.teacherPanel = teacherMode === 'console' || (teacherMode === 'add' && ui.addFromConsole) ? 'open' : 'closed';
  app.querySelector('.teacher-console-tab')?.setAttribute('aria-expanded', String(Boolean(teacherMode)));
}

/* Native close events arrive on the next turn. Clear immediately so a closed
 * dialog cannot remain in the DOM or accessibility tree between renders.
 */
function closeDialog({ resumeConsole = true, preserveUnlock = false } = {}) {
  const mode = ui.teacherDialog;
  ui.teacherDialog = null;
  if (mode === 'unlock' && !preserveUnlock) {
    teacherUnlockRequest += 1;
    ui.lockPending = false;
  }
  releaseCharacterViewer?.();
  releaseCharacterViewer = null;
  const dialog = dialogRoot.querySelector("dialog");
  if (dialog?.open) dialog.close();
  dialogRoot.innerHTML = "";
  document.body.dataset.teacherPanel = 'closed';
  app.querySelector('.teacher-console-tab')?.setAttribute('aria-expanded', 'false');
  if (resumeConsole && mode === 'add' && ui.addFromConsole && isAdultUnlocked()) {
    ui.addFromConsole = false;
    openTeacherConsole();
  } else if (resumeConsole && ['console','unlock'].includes(mode)) {
    app.querySelector('.teacher-console-tab')?.focus({ preventScroll:true });
  }
}

function openTeacherGate(after = 'console') {
  app.querySelector('.tablet-tools')?.removeAttribute('open');
  ui.teacherAfterUnlock = after;
  ui.lockPending = false;
  ui.lockError = '';
  ui.teacherDialog = 'unlock';
  renderTeacherDialog();
  dialogRoot.querySelector('#adult-password')?.focus();
}

function openTeacherConsole() {
  if (!isAdultUnlocked()) { openTeacherGate(); return; }
  window.history.replaceState(null, '', '#class');
  ui.sheikahView = 'board';
  ui.draft = null;
  ui.rulesEditing = false;
  ui.teacherDialog = 'console';
  render();
}

/* Editing rules is a teacher action; the gate reopens if the unlock expired. */
function allowRulesEdit() {
  if (isAdultUnlocked()) return true;
  openTeacherGate('rules');
  return false;
}

function openRuleDialog(section, index = null) {
  if (!RULE_SECTIONS.includes(section)) return;
  const list = getRules(state)[section] || [];
  const rule = index === null || index === undefined ? null : list[index] || null;
  showDialog(renderRuleDialog({ section, index, rule }));
  dialogRoot.querySelector('.dialog-rule textarea[name="fr"]')?.focus();
}

function renderTeacherDialog() {
  let mode = ui.teacherDialog;
  if (!mode) return;
  if (mode !== 'unlock' && !isAdultUnlocked()) mode = 'unlock';
  if (mode === 'unlock') {
    showDialog(`<dialog class="dialog teacher-unlock-dialog" aria-labelledby="lock-title"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t('modal.close')}">${icon('close')}</button>${renderLockScreen({account,error:ui.lockError,pending:ui.lockPending})}</dialog>`, 'unlock');
    return;
  }
  if (mode === 'add') {
    const classroom = state.classes.find(item => item.id === ui.addClassId);
    if (classroom) showDialog(renderAddPupilDialog(classroom), 'add');
    else closeDialog();
    return;
  }
  const classroom = getCurrentClass(state);
  const focused = classroom?.pupils.find(item => item.id === state.selectedPupilId) || null;
  showDialog(`<dialog class="dialog teacher-console-dialog" aria-label="${t('console.title')}" aria-modal="false"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t('modal.close')}">${icon('close')}</button><div class="teacher-console-content">${renderConsole({classroom,ui,targets:getTargets(),focused,canUndo:history.length>0,events:state.events,armedReset:armedDanger==='reset',unlockedUntil:unlockUntil(),account})}</div></dialog>`, 'console');
}

function disarmDanger() {
  armedDanger = null;
  const armed = document.querySelector("#app .is-armed, #dialog-root .is-armed");
  if (armed) render();
}

/* ---------- Undo history and persistence ---------- */

function commit(nextState, { record = true, notify = true } = {}) {
  if (nextState === state) { render(); return; }
  const previous = state;
  if (record) {
    history.push(previous);
    if (history.length > 60) history.shift();
  }
  state = nextState;

  if (notify) announce(previous, state);
  saveAndRender();
}

function undo() {
  if (!isAdultUnlocked() || ui.teacherDialog !== 'console') return;
  if (!history.length) {
    toast("Nothing left to undo.", "info");
    return;
  }
  state = { ...history.pop(), revision: state.revision };
  saveAndRender();
  toast("Last change undone.", "info");
}

function announce(previous, next) {
  for (const classroom of next.classes) {
    for (const pupil of classroom.pupils) {
      const before = getPupilById(previous, pupil.id);
      if (!before) continue;

      if (before.level < pupil.level) {
        const unique = getRewardsBetween(before.level, pupil.level);
        toast(t("notice.levelup", { name: pupil.name, level: pupil.level }) + (unique.length ? t("notice.unlocked", { rewards: unique.map(translateReward).join(", ") }) : ""), "levelup");
      }
      if (before.hp > 0 && pupil.hp <= 0) toast(t("notice.out", { name: pupil.name }), "warn");
      if (before.hp <= 0 && pupil.hp > 0) toast(t("notice.back", { name: pupil.name }), "success");
    }
  }
}

function saveAndRender() {
  state = { ...state, updatedAt: new Date().toISOString() };
  cacheState();
  setDirty(true);
  if (!syncConflict) scheduleServerSave();
  render();
}

function stateKey(accountId) {
  return `${STORAGE_KEY}:${accountId}`;
}

function dirtyKey(accountId) {
  return `${stateKey(accountId)}:dirty`;
}

function cacheState() {
  if (!account) return;
  try {
    localStorage.setItem(stateKey(account.id), JSON.stringify(state));
  } catch {
    toast("Could not save locally: storage is full or blocked.", "error");
  }
}

function setDirty(value) {
  localDirty = Boolean(value);
  if (!account) return;
  try {
    if (localDirty) localStorage.setItem(dirtyKey(account.id), "1");
    else localStorage.removeItem(dirtyKey(account.id));
  } catch {
    // State remains in memory when localStorage is unavailable.
  }
}

function loadDirty(accountId) {
  try {
    return localStorage.getItem(dirtyKey(accountId)) === "1";
  } catch {
    return false;
  }
}

function loadState(accountId) {
  try {
    const raw = localStorage.getItem(stateKey(accountId));
    return raw ? normalizeState(JSON.parse(raw)) : createInitialState({ samples: false });
  } catch {
    return createInitialState({ samples: false });
  }
}

function accountLangKey(id) {
  return `classquest.lang:${id}`;
}

function rememberAccountLanguage(language = getLang()) {
  if (!account) return;
  try { localStorage.setItem(accountLangKey(account.id), language); } catch { /* storage unavailable */ }
  persistSettings({ language });
}

// Each account keeps its language on the server; a device-local copy covers
// offline use, and a first sign-in adopts whatever the welcome page shows.
function applyAccountLanguage() {
  const fromAccount = account?.settings?.language;
  if (fromAccount === "fr" || fromAccount === "en") { setLang(fromAccount); return; }
  let preferred = null;
  try { preferred = localStorage.getItem(accountLangKey(account.id)); } catch { /* storage unavailable */ }
  if (preferred === "fr" || preferred === "en") setLang(preferred);
  else rememberAccountLanguage();
}

/* ---------- Account settings (server-backed, changeable at any time) ---------- */

function accountSettings() {
  return account?.settings || { language: null, theme: null, onboarding: { completed: false, step: 0 } };
}

function persistSettings(patch) {
  if (!account) return;
  const current = accountSettings();
  account = { ...account, settings: { ...current, ...patch, onboarding: { ...current.onboarding, ...(patch.onboarding || {}) } } };
  void updateSettings(patch).then((result) => {
    if (result.ok && account && account.id === result.account.id) {
      account = { ...account, settings: result.account.settings };
    }
  }).catch(() => { /* Offline: the local copy keeps the preference. */ });
}

/* ---------- First-run setup (resumable, once per account) ---------- */

const ONBOARDING_LAST_STEP = 5;
let onboardingFinishing = false;

function onboardingState() {
  return accountSettings().onboarding;
}

function setOnboardingStep(step) {
  const next = { ...onboardingState(), step };
  persistSettings({ onboarding: next });
}

function maybeStartOnboarding() {
  if (!account) return;
  const onboarding = onboardingState();
  if (onboarding.completed) return;
  // The tour highlights the class workspace; resume it there so targets exist.
  if (currentView() !== "class") return;
  if (onboarding.step <= 1) {
    render();
    showOnboardingDialog(onboarding.step);
  } else {
    startSetupTour();
  }
}

function showOnboardingDialog(step) {
  ui.onboardingStep = step;
  const html = step === 0
    ? renderOnboardingWelcome(account?.displayName || account?.username || "")
    : renderOnboardingLanguage();
  showDialog(html);
}

function advanceOnboarding() {
  const next = Math.min(ONBOARDING_LAST_STEP, (ui.onboardingStep ?? onboardingState().step) + 1);
  ui.onboardingStep = next;
  setOnboardingStep(next);
  if (next <= 1) {
    closeDialog({ resumeConsole: false });
    render();
    showOnboardingDialog(next);
  } else {
    closeDialog({ resumeConsole: false });
    render();
    startSetupTour();
  }
}

function finishOnboarding() {
  if (onboardingFinishing) return;
  onboardingFinishing = true;
  closeDialog({ resumeConsole: false });
  ui.onboardingStep = null;
  endSetupTour({ complete: true, silent: true });
  persistSettings({ onboarding: { completed: true, step: ONBOARDING_LAST_STEP + 1 } });
  render();
  toast(t("onboarding.done"), "success");
  onboardingFinishing = false;
}

function endSetupTour({ complete = true, silent = false } = {}) {
  const tour = activeTour;
  activeTour = null;
  if (tour) { try { tour.exit?.(); } catch { /* already gone */ } }
  if (complete && account && !onboardingState().completed) {
    persistSettings({ onboarding: { completed: true, step: ONBOARDING_LAST_STEP + 1 } });
    if (!silent) toast(t("onboarding.done"), "success");
  }
}

function setupTourSteps() {
  return [
    { target: '[data-action="toggle-theme"]', title: t("onboarding.theme.title"), body: t("onboarding.theme.body"), preview: true },
    {
      target: () => (state.classes.length ? ".class-picker" : '[data-action="add-class"]'),
      title: t("onboarding.class.title"),
      body: () => t(state.classes.length ? "onboarding.class.body" : "onboarding.class.body.empty")
    },
    { target: '[data-action="show-rules"]', title: t("onboarding.rules.title"), body: t("onboarding.rules.body") },
    { target: '[data-action="teacher-console"]', title: t("onboarding.console.title"), body: t("onboarding.console.body") }
  ];
}

function startSetupTour() {
  if (!account || activeTour) return;
  activeTour = createGuidedTour({
    steps: setupTourSteps(),
    labels: {
      next: t("onboarding.next"),
      prev: t("onboarding.prev"),
      finish: t("onboarding.finish"),
      skip: t("onboarding.skip"),
      close: t("onboarding.close"),
      progress: (current, total) => t("onboarding.step", { current, total })
    },
    onFinish: () => finishOnboarding(),
    onExit: () => {
      if (account && !onboardingState().completed) persistSettings({ onboarding: { completed: true, step: ONBOARDING_LAST_STEP + 1 } });
    }
  });
  activeTour.start();
}

function openAccount(next) {
  closeDialog({ resumeConsole:false });
  clearTimeout(persistTimer);
  persistTimer = null;
  saveQueued = false;
  account = next;
  applyAccountLanguage();
  activeSession = captureSessionContext();
  state = loadState(next.id);
  localDirty = loadDirty(next.id);
  syncConflict = false;
  history = [];
  ui.gateError = "";
  ui.gateValues = {};
  ui.adminAccounts = [];
  ui.adminPending = false;
  ui.lockPending = false;
  ui.lockError = "";
  studentPupilId = loadStudentId();
  ui.sheikahView = "board";
  ui.draft = null;
  const storedTheme = next?.settings?.theme;
  if (storedTheme === "light" || storedTheme === "dark") {
    theme = storedTheme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* keep in memory */ }
  }
  render();
  window.scrollTo({ top: 0 });
  if (currentView() === "admin") loadAdminAccounts();
  bootstrapFromServer();
  maybeStartOnboarding();
}

/* Google sign-in redirects back with a one-time code; errors arrive as a
 * short reason code so the gate can explain what happened. */
const GOOGLE_ERROR_KEYS = {
  denied: "google.error.denied",
  state: "google.error.state",
  email: "google.error.email",
  unavailable: "google.error.unavailable",
  failed: "google.error.failed"
};
const googleErrorMessage = (reason) => t(GOOGLE_ERROR_KEYS[reason] || "google.error.failed");

async function completeGoogleSignIn(code) {
  ui.gateError = "";
  ui.gatePending = true;
  render();
  const result = await signInWithGoogleCode(code);
  if (result.stale) return;
  ui.gatePending = false;
  if (!result.ok) {
    ui.gateError = result.error;
    render();
    return;
  }
  openAccount(result.account);
  toast(t("notice.accountReady", { name: result.account.displayName }), "levelup");
}

/* The gate only offers Google when the server has credentials configured. */
async function loadPublicConfig() {
  try {
    const response = await requestApi("config", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json().catch(() => null);
    const enabled = Boolean(payload?.google);
    if (enabled === googleEnabled) return;
    googleEnabled = enabled;
    if (currentView() === "welcome") render();
  } catch {
    // The button stays hidden while the server is unreachable.
  }
}

function endSession(message = "", context = null) {
  if (context && !isCurrentSession(context)) return;
  closeDialog({ resumeConsole:false });
  forgetSession(context);
  account = null;
  activeSession = null;
  state = createInitialState({ samples: false });
  history = [];
  localDirty = false;
  syncConflict = false;
  clearTimeout(persistTimer);
  persistTimer = null;
  saveQueued = false;
  ui.gateError = message;
  ui.gateTab = "signin";
  ui.gatePending = false;
  ui.lockPending = false;
  ui.adminPending = false;
  ui.adminAccounts = [];
  ui.consoleOpen = false;
  ui.focusPanel = null;
  if (location.hash) historyReplaceWithoutHash();
  render();
  window.scrollTo({ top: 0 });
  if (message) toast(message, "warn");
}

function historyReplaceWithoutHash() {
  try {
    window.history.replaceState(null, "", location.pathname + location.search);
  } catch {
    location.hash = "";
  }
}

function studentKey() {
  return account ? `${STUDENT_KEY}:${account.id}` : STUDENT_KEY;
}

function loadStudentId() {
  try {
    return localStorage.getItem(studentKey());
  } catch {
    return null;
  }
}

function rememberStudent(pupilId) {
  studentPupilId = pupilId;
  try {
    if (pupilId) localStorage.setItem(studentKey(), pupilId);
    else localStorage.removeItem(studentKey());
  } catch {
    // The current choice still works if private browsing prevents persistence.
  }
}

document.addEventListener("change", (event) => {
  if (event.target.id !== "import-file") return;
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!allowTeacherAction()) return;
  const context = captureSessionContext();
  file.text()
    .then((text) => {
      if (!isCurrentSession(context) || account?.id !== context.accountId || !isAdultUnlocked()) return;
      const imported = importState(text);
      const total = imported.classes.reduce((sum, classroom) => sum + classroom.pupils.length, 0);
      commit({ ...imported, revision: state.revision }, { record: true, notify: false });
      toast(t("notice.imported", { count: total }), "success", { undo: true });
    })
    .catch((error) => {
      if (isCurrentSession(context)) toast(error.message || "Could not read that file.", "error");
    });
});

/* Short notifications; destructive changes may expose an undo action. */

function toast(message, kind = "info", { undo: withUndo = false } = {}) {
  const node = document.createElement("div");
  node.className = `toast toast-${kind}`;
  node.innerHTML = `<p>${escapeHtml(translateMessage(message))}</p>`;

  if (withUndo) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-undo";
    button.textContent = t("console.undo");
    button.addEventListener("click", () => {
      undo();
      dismiss(node);
    });
    node.appendChild(button);
  }

  // Remove overflow immediately: waiting for the dismissal animation inside
  // this loop would never reduce the node count and would freeze the page.
  while (toastRoot.children.length >= 3) toastRoot.firstElementChild.remove();

  toastRoot.appendChild(node);
  requestAnimationFrame(() => node.classList.add("is-in"));
  setTimeout(() => dismiss(node), withUndo ? 7000 : 3200);
}

function dismiss(node) {
  if (!node.isConnected) return;
  node.classList.remove("is-in");
  setTimeout(() => node.remove(), 220);
}

/* ---------- Optimistic server synchronization ---------- */

function scheduleServerSave() {
  if (saveInFlight || syncConflict) {
    saveQueued = true;
    return;
  }
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    saveToServer();
  }, 300);
}

async function saveToServer() {
  if (saveInFlight) {
    saveQueued = true;
    return;
  }
  if (!account || syncConflict) return;
  const context = captureSessionContext();
  if (!context || context.accountId !== account.id) return;
  saveInFlight = context;
  const snapshot = JSON.stringify(state);
  try {
    const response = await requestApi("state", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Session-Token": context.token },
      body: snapshot
    });
    if (!isCurrentSession(context) || account?.id !== context.accountId) return;
    const payload = await response.json().catch(() => null);
    if (!isCurrentSession(context) || account?.id !== context.accountId) return;
    if (response.status === 401) {
      endSession("The session ended. Sign in again. Your local cache was kept.", context);
      return;
    }
    if (response.status === 409) {
      syncConflict = true;
      setDirty(true);
      saveQueued = false;
      render();
      toast("Synchronization paused because another device saved newer data.", "warn");
      return;
    }
    if (!response.ok || !Number.isSafeInteger(payload?.revision)) throw new Error(`save failed: ${response.status}`);
    const unchanged = snapshot === JSON.stringify(state);
    state = { ...state, revision: payload.revision, updatedAt: payload.updatedAt || state.updatedAt };
    cacheState();
    setDirty(!unchanged);
  } catch {
    // Keep the dirty cache offline; a later successful bootstrap retries it.
  } finally {
    if (saveInFlight === context) saveInFlight = null;
    // A stale request may finish after an account switch. Flush the current
    // account's queued edits as well, rather than leaving them dirty forever.
    if (saveQueued && !syncConflict && account && !saveInFlight) {
      saveQueued = false;
      scheduleServerSave();
    }
  }
}

async function bootstrapFromServer() {
  if (!account) return;
  const context = captureSessionContext();
  if (!context || context.accountId !== account.id) return;
  try {
    const response = await requestApi("state", {
      cache: "no-store",
      headers: { "X-Session-Token": context.token }
    });
    if (!isCurrentSession(context) || account?.id !== context.accountId) return;
    if (response.status === 401) {
      endSession("The session ended. Sign in again. Your local cache was kept.", context);
      return;
    }
    if (!response.ok) return;
    const remote = await response.json();
    if (!isCurrentSession(context) || account?.id !== context.accountId) return;
    if (!remote || !Array.isArray(remote.classes)) return;
    if ((Number(remote.revision) || 0) < state.revision) return;
    if (localDirty) {
      if ((Number(state.revision) || 0) === (Number(remote.revision) || 0)) saveToServer();
      else {
        syncConflict = true;
        render();
      }
      return;
    }
    state = normalizeState(remote);
    history = [];
    cacheState();
    render();
  } catch {
    // Stay on the local cache when the server is unavailable.
  }
}

async function reloadServerCopy() {
  if (!account || !syncConflict) return;
  const context = captureSessionContext();
  const accountId = account.id;
  try {
    const response = await requestApi("state", { cache: "no-store", headers: { "X-Session-Token": context?.token || "" } });
    if (!isCurrentSession(context) || account?.id !== accountId || !response.ok) return;
    const remote = await response.json();
    if (!isCurrentSession(context) || account?.id !== accountId) return;
    if (!remote || !Array.isArray(remote.classes)) return;
    localStorage.setItem(`${stateKey(accountId)}:conflict:${Date.now()}`, JSON.stringify(state));
    state = normalizeState(remote);
    history = [];
    syncConflict = false;
    cacheState();
    setDirty(false);
    render();
    toast("Server copy loaded. The previous local copy was archived on this device.", "success");
  } catch {
    toast("Could not load the server copy.", "error");
  }
}

async function loadAdminAccounts() {
  if (account?.role !== "admin") return;
  const context = captureSessionContext();
  ui.adminPending = true;
  ui.adminError = "";
  render();
  try {
    const response = await requestApi("admin/accounts", { cache: "no-store", headers: { "X-Session-Token": context?.token || "" } });
    if (!isCurrentSession(context) || account?.role !== "admin") return;
    const payload = await response.json().catch(() => null);
    if (!isCurrentSession(context) || account?.role !== "admin") return;
    if (response.status === 401) return endSession("The session ended. Sign in again.", context);
    if (!response.ok) throw new Error(payload?.error || "Could not load accounts.");
    ui.adminAccounts = Array.isArray(payload.accounts) ? payload.accounts : [];
  } catch (error) {
    if (isCurrentSession(context)) ui.adminError = error.message || "Could not load accounts.";
  } finally {
    if (isCurrentSession(context)) {
      ui.adminPending = false;
      render();
    }
  }
}

window.addEventListener("pagehide", () => {
  if (!localDirty || !account || syncConflict) return;
  clearTimeout(persistTimer);
  persistTimer = null;
  // Never race a newer keepalive write against an older request already in flight.
  // The dirty localStorage copy will be retried on the next visit.
  if (saveInFlight) return;
  const context = captureSessionContext();
  try {
    void requestApi("state", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Session-Token": context?.token || "" },
      body: JSON.stringify(state),
      keepalive: true
    }, 8000).catch(() => {});
  } catch {
    // The local dirty cache is already durable when the page is closing.
  }
});

function renderPreservingForms() {
  const forms = [...document.querySelectorAll("#app form, #dialog-root form")].map(form => [...form.elements].map(input => ({ name: input.name, value: input.value, checked: input.checked })));
  render();
  [...document.querySelectorAll("#app form, #dialog-root form")].forEach((form, index) => {
    for (const saved of forms[index] || []) {
      const input = saved.name && form.elements.namedItem(saved.name);
      if (!input || input.type === "file") continue;
      input.value = saved.value;
      if (typeof saved.checked === "boolean") input.checked = saved.checked;
    }
  });
}

initLanguage();
// A restored session applies the account's saved language, exactly like a fresh sign-in.
if (account) applyAccountLanguage();
document.getElementById("lang-toggle")?.addEventListener("click", () => {
  setLang(getLang() === "fr" ? "en" : "fr");
  rememberAccountLanguage();
  if (!ui.teacherDialog) closeDialog();
  renderPreservingForms();
});
const googleParams = new URLSearchParams(location.search);
const googleCode = googleParams.get("google_code") || "";
const googleError = googleParams.get("google_error") || "";
if (googleCode || googleError) {
  // Never keep the one-time code or the error in the address bar or history.
  try { window.history.replaceState(null, "", location.pathname + location.hash); } catch { /* keep the query */ }
}
if (googleError) ui.gateError = googleErrorMessage(googleError);
applyTheme();
render();
bootstrapFromServer();
if (currentView() === "admin") loadAdminAccounts();
maybeStartOnboarding();
if (googleCode) completeGoogleSignIn(googleCode);
else loadPublicConfig();
setInterval(updateClock, 1000);
