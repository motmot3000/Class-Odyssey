/* Application coordinator: routing, UI state, action dispatch and persistence.
 * Views generate markup; domain.mjs owns game rules. Keep gameplay mutations
 * in the domain so teacher controls, pupil shopping and tests share one policy.
 */

import {
  STORAGE_KEY,
  addPupil,
  awardMoney,
  awardXp,
  canBuyItem,
  changeHpMany,
  clearSelection,
  createInitialState,
  getCurrentClass,
  getPupilById,
  getRewardsBetween,
  getShopItem,
  importState,
  isItemOwned,
  normalizeState,
  purchaseItem,
  removePupil,
  renamePupil,
  restoreHpAll,
  toggleSelection,
  updateCosmetics
} from "./domain.mjs";
import { BRAND } from "./brand.mjs";
import { requestApi } from "./api.mjs";
import {
  SESSION_KEY,
  captureSessionContext,
  changePassword,
  forgetSession,
  getAccount,
  isAdultUnlocked,
  isCurrentSession,
  isSignedIn,
  lockAdult,
  signIn,
  signOut,
  signUp,
  unlockAdult,
  unlockUntil,
  validateNewPassword,
  verifyPassword
} from "./session.mjs";
import { escapeHtml, icon, translateReward } from "./ui.mjs";
import { renderAdmin } from "./views/admin.mjs";
import { renderLockScreen } from "./views/lock.mjs";
import { renderConsole } from "./views/console.mjs";
import { renderWelcome } from "./views/welcome.mjs";
import { mountWelcomeScene } from "./welcome-scene.mjs";
import { renderRules } from "./views/rules.mjs";
import { renderAddPupilDialog, renderItemDialog, renderPupilDialog } from "./views/modals.mjs";
import { mountCharacterViewer } from "./character-runtime.mjs";
import { mountHeroPortraits } from "./portrait-runtime.mjs";
import {
  renderSheikahTopbar,
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
const pendingFlash = new Set();

/* Transient UI preferences. Resetting them must never change classroom data. */
const ui = {
  scope: "selection",
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

function currentView() {
  if (!isSignedIn()) return "welcome";
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
  closeDialog({ resumeConsole: false });
  ui.query = "";
  ui.consoleOpen = false;
  ui.lockError = "";
  ui.sheikahView = "board";
  ui.draft = null;
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
  `;
  document.title = `${t(view === "welcome" ? "welcome.title.signin" : view === "rules" ? "app.aria.rules" : view === "admin" ? "app.aria.accounts" : "nav.class")} · ${BRAND.name}`;
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
}

function renderSheikahBody(view) {
  const classroom = getCurrentClass(state);
  const pupil = ui.sheikahView === 'board' ? null : getStudentPupil(classroom);
  if (pupil && ui.sheikahView === "shop") return renderSheikahShop(pupil, ui);
  if (pupil && ui.sheikahView === "personalize") return renderSheikahPersonalize(pupil, ui);
  return renderSheikahStudent({ classroom, ui, pupil, classView:true });
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
      values: ui.gateValues
    })}</main>`;
  }
  if (view === "admin") return renderAdmin({ accounts: ui.adminAccounts, pending: ui.adminPending, error: ui.adminError, currentAccountId: account?.id });
  if (view === "rules") {
    return `<main class="page page-narrow">${renderRules({ unlocked: isAdultUnlocked() })}</main>`;
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

/* ---------- Reward targets ---------- */

function getTargets() {
  const classroom = getCurrentClass(state);
  if (ui.scope === "class") return classroom.pupils.map((pupil) => pupil.id);
  const inClass = new Set(classroom.pupils.map((pupil) => pupil.id));
  return state.selectedPupilIds.filter((id) => inClass.has(id));
}

function getShopPupil() {
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
}

/* Event delegation survives complete DOM replacement without accumulating
 * per-control listeners or losing newly rendered controls.
 */

// The teacher gate controls classroom UI actions, not the server's account
// authorization. Recheck it on each mutation because an open screen can expire.
const TEACHER_ACTIONS = new Set([
  "award-xp", "award-money", "hp-minus", "hp-plus", "heal-all",
  "remove-pupil", "reset-all", "export", "import", "refresh-admin", "focus-add"
]);
const TEACHER_FORMS = new Set(["custom-xp", "custom-money", "add-pupil", "rename-pupil", "change-password", "admin-reset"]);
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
  if (TEACHER_ACTIONS.has(action) && !allowTeacherAction()) return;
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
    const pupil = getCurrentClass(state).pupils.find(item => item.id === field.value);
    state = { ...state, selectedPupilId:pupil?.id || null, selectedPupilIds:pupil ? [pupil.id] : [] };
    ui.scope = 'selection';
    render();
    return;
  }
  if (field.form?.classList.contains("gate-form") && ["username", "displayName"].includes(field.name)) {
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

document.addEventListener("keydown", (event) => {
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
  closeDialog({ resumeConsole:false });
  rememberStudent(null);
  state = { ...state, selectedPupilId:null, selectedPupilIds:[] };
  ui.sheikahView = "board";
  ui.draft = null;
  ui.shopPreview = null;
  ui.focusClassHeading = true;
  navigate("#class");
}

function chooseClassPupil(pupilId) {
  if (!getCurrentClass(state).pupils.some(pupil => pupil.id === pupilId)) return false;
  state = { ...state, selectedPupilId:pupilId, selectedPupilIds:[pupilId] };
  ui.scope = 'selection';
  rememberStudent(pupilId);
  return true;
}

const ACTIONS = {
  "show-class": showClassRoster,
  "show-board": showClassRoster,
  "show-student": showClassRoster,
  "show-rules": () => navigate("#rules"),

  /* ---------- Sheikah navigation and customization ---------- */
  "toggle-theme": () => {
    theme = theme === "light" ? "dark" : "light";
    applyTheme();
    renderPreservingForms();
  },
  "sheikah-open": (el) => {
    if (!chooseClassPupil(el.dataset.pupilId)) return;
    ui.sheikahView = "sheet";
    ui.draft = null;
    render();
    window.scrollTo({ top: 0 });
  },
  "sheikah-back": () => {
    ui.sheikahView = ui.sheikahView === "shop" ? "sheet" : "board";
    ui.draft = null;
    ui.shopPreview = null;
    render();
    window.scrollTo({ top: 0 });
  },
  "sheikah-personalize": (el) => {
    const id = el.dataset.pupilId || studentPupilId || state.selectedPupilId;
    if (!chooseClassPupil(id)) return;
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
    ui.sheikahView = "shop";
    ui.draft = null;
    ui.shopPreview = null;
    render();
    window.scrollTo({ top: 0 });
  },
  "shop-back": () => {
    ui.sheikahView = "sheet";
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
  "teacher-console": () => openTeacherConsole(),

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
    ui.scope = "selection";
    closeDialog({ resumeConsole:false });
    rememberStudent(null);
    state = { ...state, activeClassId: el.dataset.classId, selectedPupilId: null, selectedPupilIds: [] };
    navigate('#class');
  },

  // Selecting a hero also focuses its details in the teacher console.
  "toggle-pupil": (el) => {
    const pupilId = el.dataset.pupilId;
    const next = toggleSelection(state, pupilId);
    ui.scope = "selection";
    if (next.selectedPupilIds.length) ui.openPanels.add("hero");
    commit(next, { record: false });
  },

  "zoom-pupil": (el) => {
    closeDialog({ resumeConsole:false });
    lockAdult();
    ACTIONS['sheikah-open'](el);
  },
  "close-dialog": () => closeDialog(),

  scope: (el) => {
    ui.scope = el.dataset.scope;
    render();
  },

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
    ui.addFromConsole = ui.teacherDialog === 'console';
    ui.addClassId = state.activeClassId;
    showDialog(renderAddPupilDialog(getCurrentClass(state)), 'add');
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
    if (currentView() === 'class' && ui.teacherDialog !== 'console' && ui.sheikahView === "shop") {
      ui.shopPreview = ui.shopPreview === el.dataset.itemId ? null : el.dataset.itemId;
      render();
      if (matchMedia('(max-width: 1100px)').matches) {
        const stage = app.querySelector('.atelier-stage');
        const headerHeight = app.querySelector('.topbar')?.getBoundingClientRect().height || 0;
        if (stage) window.scrollTo({ top: Math.max(0, window.scrollY + stage.getBoundingClientRect().top - headerHeight - 12), behavior: 'instant' });
      }
      return;
    }
    openItemDialog(el.dataset.itemId);
  },
  "shop-item": (el) => buyOrEquip(el.dataset.itemId),

  "student-pick": (el) => {
    if (!chooseClassPupil(el.dataset.pupilId)) return;
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
    anchor.download = `classquest-${new Date().toISOString().slice(0, 10)}.json`;
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
    const username = String(data.get("username") || "").trim();
    const displayName = String(data.get("displayName") || "").trim();
    const password = String(data.get("password") || "");
    ui.gateValues = { username, displayName };
    const problem = validateNewPassword(password, data.get("confirm"));
    if (problem) {
      ui.gateError = problem;
      render();
      return;
    }
    ui.gatePending = true;
    ui.gateError = "";
    render();
    const result = await signUp({ username, displayName, password });
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
    else openTeacherConsole({ verified:true });
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
    if (returnToConsole) { ui.addFromConsole=false; openTeacherConsole({ verified:true }); }
    toast(t("notice.joined", { name, classroom: classroom.name }), "success");
    dialogRoot.querySelector('[data-action="focus-add"]')?.focus({ preventScroll: true });
  },

  "rename-pupil": (form) => {
    if (!state.selectedPupilId) return;
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name) return;
    commit(renamePupil(state, state.selectedPupilId, name));
    toast("Name updated.", "success");
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
  if (ui.scope === "class") return getCurrentClass(state).name;
  if (targets.length === 1) return getPupilById(state, targets[0])?.name || t("notice.oneHero");
  return t("notice.heroes", { count: targets.length });
}

function buyOrEquip(itemId) {
  const pupil = getShopPupil();
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

function openItemDialog(itemId) {
  const pupil = getShopPupil();
  const item = getShopItem(itemId);
  if (!pupil || !item) return;
  showDialog(renderItemDialog(item, pupil));
}

function showDialog(html, teacherMode = null) {
  if (!teacherMode && ui.teacherDialog === 'console') lockAdult();
  const continuingUnlock = teacherMode === 'unlock' && ui.teacherDialog === 'unlock';
  closeDialog({ resumeConsole:false, preserveUnlock:continuingUnlock });
  ui.teacherDialog = teacherMode;
  dialogRoot.innerHTML = html;
  const dialog = dialogRoot.querySelector("dialog");
  if (!dialog) return;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("close", () => {
    if (dialogRoot.contains(dialog)) {
      closeDialog();
    }
  });
  dialog.showModal();
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
  if (resumeConsole && mode === 'add' && ui.addFromConsole && isAdultUnlocked()) {
    ui.addFromConsole = false;
    openTeacherConsole({ verified:true });
  } else if (resumeConsole && ['console','unlock'].includes(mode)) {
    lockAdult();
    app.querySelector('.tablet-tools summary')?.focus({ preventScroll:true });
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

function openTeacherConsole({ verified = false } = {}) {
  if (!verified || !isAdultUnlocked()) { openTeacherGate(); return; }
  ui.teacherDialog = 'console';
  renderTeacherDialog();
  mountHeroPortraits(document.body);
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
  const focused = classroom.pupils.find(item => item.id === state.selectedPupilId) || null;
  showDialog(`<dialog class="dialog teacher-console-dialog" aria-label="${t('console.title')}"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t('modal.close')}">${icon('close')}</button><div class="teacher-console-content">${renderConsole({classroom,ui,targets:getTargets(),focused,canUndo:history.length>0,events:state.events,armedReset:armedDanger==='reset',unlockedUntil:unlockUntil(),account})}</div></dialog>`, 'console');
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

function openAccount(next) {
  closeDialog({ resumeConsole:false });
  clearTimeout(persistTimer);
  persistTimer = null;
  saveQueued = false;
  account = next;
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
  render();
  window.scrollTo({ top: 0 });
  if (currentView() === "admin") loadAdminAccounts();
  bootstrapFromServer();
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
document.getElementById("lang-toggle")?.addEventListener("click", () => {
  setLang(getLang() === "fr" ? "en" : "fr");
  if (!ui.teacherDialog) closeDialog();
  renderPreservingForms();
});
applyTheme();
render();
bootstrapFromServer();
if (currentView() === "admin") loadAdminAccounts();
setInterval(updateClock, 30_000);
