/* ============================================================
   app.mjs — coque, routage, état d'interface, persistance
   Le rendu est délégué aux vues ; ce fichier ne décide que de « quoi
   afficher » et « que faire quand on touche l'écran ».
   ============================================================ */

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
  getRewardsForLevel,
  getShopItem,
  importState,
  isItemOwned,
  normalizeState,
  purchaseItem,
  removePupil,
  renamePupil,
  restoreHpAll,
  selectAllInClass,
  toggleSelection,
  updateCosmetics
} from "./domain.mjs";
import { apiUrl } from "./api.mjs";
import {
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
import { renderWelcome } from "./views/welcome.mjs";
import { renderRules } from "./views/rules.mjs";
import { renderItemDialog, renderPupilDialog } from "./views/modals.mjs";
import { mountCharacterViewer } from "./character-runtime.mjs";
import {
  renderSheikahTopbar,
  renderSheikahTeacher,
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

// Mémorise le héros choisi sur CET appareil, pour rouvrir le casier
// directement à la visite suivante. Jamais synchronisé au serveur.
const STUDENT_KEY = "classquest:student";

let account = getAccount();
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

/* État d'interface : préférences de la session, jamais persistées avec le
   jeu. Les remettre à zéro ne doit rien coûter à personne. */
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

/* ---------- Thème ---------- */

const THEME_KEY = "classquest:theme";
let theme = (() => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch { /* stockage bloqué */ }
  return "light";
})();

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#e7e9df" : "#101b20");
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* stockage bloqué */ }
  setSheikahTheme(theme);
}

/* ---------- Routage ---------- */

function currentView() {
  if (!isSignedIn()) return "welcome";
  if (location.hash === "#rules") return "rules";
  if (location.hash.startsWith("#student")) return "student";
  if (location.hash === "#admin" && account?.role === "admin") return isAdultUnlocked() ? "admin" : "lock";
  if (location.hash.startsWith("#board")) return isAdultUnlocked() ? "board" : "lock";
  return isAdultUnlocked() ? "board" : "student";
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

window.addEventListener("hashchange", () => {
  closeDialog();
  ui.query = "";
  ui.consoleOpen = false;
  ui.lockError = "";
  ui.sheikahView = "board";
  ui.draft = null;
  window.scrollTo({ top: 0 });
  if (currentView() === "admin") loadAdminAccounts();
  else render();
});

/* ---------- Rendu ---------- */

function render() {
  const view = currentView();
  const memory = captureUiMemory();
  const focusPanel = view === "board" ? ui.focusPanel : null;
  if (focusPanel) {
    ui.openPanels.add(focusPanel);
    ui.consoleOpen = true;
    ui.sheikahView = "board";
    ui.focusPanel = null;
  }
  app.innerHTML = `
    ${renderSheikahTopbar({ view, state, account, unlocked: isAdultUnlocked(), student: view === "student" })}
    ${renderConflict()}
    ${renderViewBody(view)}
  `;
  document.title = `${t(view === "welcome" ? "welcome.title.signin" : view === "rules" ? "app.aria.rules" : view === "admin" ? "app.aria.accounts" : view === "lock" ? "lock.title" : view === "student" ? "app.aria.students" : "app.aria.teacher")} · ClassQuest`;
  restoreUiMemory(memory);
  flushFlash();
  syncSheikahRuntime();
  updateClock();
  if (focusPanel) {
    const field = app.querySelector(`[data-panel="${focusPanel}"] input`);
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ block: "nearest" });
  }
}

function renderSheikahBody(view) {
  const classroom = getCurrentClass(state);
  if (view === "student") {
    const pupil = getStudentPupil(classroom);
    if (pupil && ui.sheikahView === "shop") return renderSheikahShop(pupil, ui);
    if (pupil && ui.sheikahView === "personalize") return renderSheikahPersonalize(pupil, ui);
    return renderSheikahStudent({ classroom, ui, pupil });
  }
  const targets = getTargets();
  const focused = state.selectedPupilId ? getPupilById(state, state.selectedPupilId) : null;
  if (focused && ui.sheikahView === "shop") return renderSheikahShop(focused, ui);
  if (focused && ui.sheikahView === "sheet") return renderSheikahSheet(focused, ui);
  if (focused && ui.sheikahView === "personalize") return renderSheikahPersonalize(focused, ui);
  return renderSheikahTeacher({ classroom, ui, targets, focused, canUndo: history.length > 0, account, selectedIds: state.selectedPupilIds, events: state.events, armedReset: armedDanger === "reset", unlockedUntil: unlockUntil() });
}

function syncSheikahRuntime() {
  const host = app.querySelector("[data-viewer-host]");
  if (!host) {
    unmountSheikahViewer();
    return;
  }
  let look = {};
  try { look = JSON.parse(host.dataset.look || "{}"); } catch { /* valeur par défaut */ }
  mountSheikahViewer(host, look);
}

function renderViewBody(view) {
  if (view === "welcome") {
    return `<main class="page gate-page">${renderWelcome({
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

  if (view === "lock") {
    return `<main class="page lock-page">${renderLockScreen({ account, error: ui.lockError, pending: ui.lockPending })}</main>`;
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

/* ---------- Cible des récompenses ---------- */

function getTargets() {
  const classroom = getCurrentClass(state);
  if (ui.scope === "class") return classroom.pupils.map((pupil) => pupil.id);
  const inClass = new Set(classroom.pupils.map((pupil) => pupil.id));
  return state.selectedPupilIds.filter((id) => inClass.has(id));
}

function getShopPupil() {
  if (currentView() === "student") return studentPupilId ? getPupilById(state, studentPupilId) : null;
  return state.selectedPupilId ? getPupilById(state, state.selectedPupilId) : null;
}

/* ---------- Mémoire d'interface entre deux rendus ----------
   Un rendu complet est simple et sûr ; encore faut-il qu'il ne vole ni le
   curseur de la recherche ni la position de la console. */

function captureUiMemory() {
  const active = document.activeElement;
  const focusAction = active?.dataset?.action || null;
  const actionControls = focusAction
    ? [...app.querySelectorAll(`[data-action="${CSS.escape(focusAction)}"]`)]
    : [];
  return {
    focusId: active && active.id ? active.id : null,
    focusAction,
    focusActionIndex: actionControls.indexOf(active),
    caret: active && typeof active.selectionStart === "number" ? active.selectionStart : null,
    consoleScroll: app.querySelector(".console")?.scrollTop ?? 0,
    pageScroll: window.scrollY
  };
}

function restoreUiMemory(memory) {
  const console_ = app.querySelector(".console");
  if (console_) console_.scrollTop = memory.consoleScroll;

  let next = memory.focusId ? document.getElementById(memory.focusId) : null;
  if (!next && memory.focusAction && memory.focusActionIndex >= 0) {
    next = [...app.querySelectorAll(`[data-action="${CSS.escape(memory.focusAction)}"]`)][memory.focusActionIndex];
  }
  if (next) {
    next.focus({ preventScroll: true });
    if (memory.caret !== null && typeof next.setSelectionRange === "function") {
      try {
        next.setSelectionRange(memory.caret, memory.caret);
      } catch {
        // Les champs number refusent setSelectionRange : sans importance.
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

/* ---------- Événements ----------
   Un seul écouteur par type sur #app : le DOM est reconstruit à chaque
   rendu, donc rien à rebrancher, rien à oublier de débrancher. */

app.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger || trigger.tagName === "FORM") return;
  const action = trigger.dataset.action;
  if (!ACTIONS[action]) return;
  event.preventDefault();
  ACTIONS[action](trigger);
});

app.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-action]");
  if (!form) return;
  event.preventDefault();
  const action = FORMS[form.dataset.action];
  if (action) action(form);
});

dialogRoot.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-action]");
  if (!form) return;
  event.preventDefault();
  const action = FORMS[form.dataset.action];
  if (action) action(form);
});

app.addEventListener("input", (event) => {
  const field = event.target;
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
});

app.addEventListener("toggle", (event) => {
  const panel = event.target.closest("details[data-panel]");
  if (!panel) return;
  if (panel.open) ui.openPanels.add(panel.dataset.panel);
  else ui.openPanels.delete(panel.dataset.panel);
}, true);

document.addEventListener("keydown", (event) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !typing) {
    event.preventDefault();
    undo();
  }
});

window.addEventListener("storage", (event) => {
  if (!account || localDirty || event.key !== stateKey(account.id) || !event.newValue) return;
  try {
    state = normalizeState(JSON.parse(event.newValue));
    history = [];
    render();
  } catch {
    // Écriture malformée venue d'un autre onglet : on ignore.
  }
});

const ACTIONS = {
  "show-board": () => {
    ui.sheikahView = "board";
    ui.draft = null;
    navigate("#board");
  },
  "show-student": () => {
    ui.sheikahView = "board";
    ui.draft = null;
    navigate("#student");
  },
  "show-rules": () => navigate("#rules"),

  /* ---------- interface Sheikah ---------- */
  "toggle-theme": () => {
    theme = theme === "light" ? "dark" : "light";
    applyTheme();
    renderPreservingForms();
  },
  "sheikah-open": (el) => {
    state = { ...state, selectedPupilId: el.dataset.pupilId };
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
    const id = el.dataset.pupilId || (currentView() === "student" ? studentPupilId : state.selectedPupilId);
    if (id) state = { ...state, selectedPupilId: id };
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
    const studentView = currentView() === "student";
    const id = el.dataset.pupilId || (studentView ? studentPupilId : state.selectedPupilId);
    if (!id) return;
    state = { ...state, selectedPupilId: id };
    if (studentView) rememberStudent(id);
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
    if (location.hash === "#admin" && isAdultUnlocked()) loadAdminAccounts();
    else navigate("#admin");
  },
  "refresh-admin": () => loadAdminAccounts(),
  "account-settings": () => {
    ui.focusPanel = "account";
    navigate("#board");
  },

  "gate-tab": (el) => {
    ui.gateTab = el.dataset.tab;
    ui.gateError = "";
    render();
  },

  "sign-out": async () => {
    const name = account?.displayName || "";
    if (localDirty && !syncConflict) await saveToServer();
    const unsynced = localDirty;
    ++gateRequest;
    await signOut();
    endSession();
    toast(unsynced
      ? "Signed out. Unsynced changes remain saved on this device."
      : (name ? t("notice.signedOutNamed", { name }) : "Signed out."), unsynced ? "warn" : "info");
  },

  "lock-adult": () => {
    lockAdult();
    ui.consoleOpen = false;
    navigate("#student");
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
    commit({ ...state, activeClassId: el.dataset.classId, selectedPupilId: null, selectedPupilIds: [] }, { record: false });
  },

  /* Toucher un héros le coche ET l'ouvre dans la console : deux besoins,
     un seul geste, aucun mode à connaître. */
  "toggle-pupil": (el) => {
    const pupilId = el.dataset.pupilId;
    const wasSelected = state.selectedPupilIds.includes(pupilId);
    let next = toggleSelection(state, pupilId);
    next = {
      ...next,
      selectedPupilId: wasSelected
        ? (state.selectedPupilId === pupilId ? null : state.selectedPupilId)
        : pupilId
    };
    ui.scope = "selection";
    if (!wasSelected) ui.openPanels.add("hero");
    commit(next, { record: false });
  },

  "zoom-pupil": (el) => {
    if (["board", "student"].includes(currentView())) {
      if (el.dataset.pupilId) state = { ...state, selectedPupilId: el.dataset.pupilId };
      ui.sheikahView = "sheet";
      ui.draft = null;
      render();
      return;
    }
    openPupilDialog(el.dataset.pupilId);
  },
  "close-dialog": () => closeDialog(),

  scope: (el) => {
    ui.scope = el.dataset.scope;
    render();
  },

  "select-all": () => {
    ui.scope = "selection";
    commit(selectAllInClass(state, state.activeClassId), { record: false });
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
    ui.focusPanel = "add";
    render();
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
    if (["board", "student"].includes(currentView()) && ui.sheikahView === "shop") {
      ui.shopPreview = ui.shopPreview === el.dataset.itemId ? null : el.dataset.itemId;
      render();
      return;
    }
    openItemDialog(el.dataset.itemId);
  },
  "shop-item": (el) => buyOrEquip(el.dataset.itemId),

  "student-pick": (el) => {
    rememberStudent(el.dataset.pupilId);
    ui.sheikahView = "board";
    ui.draft = null;
    ui.query = "";
    render();
    window.scrollTo({ top: 0 });
  },

  "change-hero": () => {
    rememberStudent(null);
    ui.sheikahView = "board";
    ui.draft = null;
    render();
  },

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

  /* Effacement en deux temps plutôt qu'un confirm() natif : le second
     appui est un choix, pas un réflexe, et la classe voit ce qui se passe. */
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
    if (!isCurrentSession(context)) return;
    ui.lockPending = false;
    if (result.expired) {
      endSession("The session ended. Sign in again. Your local cache was kept.", context);
      return;
    }
    if (!result.ok) {
      ui.lockError = result.error;
      render();
      return;
    }
    unlockAdult();
    if (location.hash === "#admin" && account?.role === "admin") {
      render();
      loadAdminAccounts();
    } else navigate("#board");
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
      response = await fetch(apiUrl(`admin/accounts/${accountId}/password`), {
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
    commit(addPupil(state, state.activeClassId, {
      name,
      gender: String(data.get("gender") || "boy"),
      skinTone: String(data.get("skinTone") || "light")
    }));
    toast(t("notice.joined", { name, classroom: getCurrentClass(state).name }), "success");
    document.querySelector("#pupil-name")?.focus();
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

/* ---------- Attribution ---------- */

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

/* ---------- Dialogues ---------- */

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

function showDialog(html) {
  closeDialog();
  dialogRoot.innerHTML = html;
  const dialog = dialogRoot.querySelector("dialog");
  if (!dialog) return;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
    const close = event.target.closest("[data-action='close-dialog']");
    if (close) closeDialog();
  });
  dialog.addEventListener("close", () => {
    if (dialogRoot.contains(dialog)) {
      releaseCharacterViewer?.();
      releaseCharacterViewer = null;
      dialogRoot.innerHTML = "";
    }
  });
  dialog.showModal();
}

/* `close()` déclenche l'événement qui vide le conteneur, mais seulement au
   tour suivant : on vide tout de suite pour qu'aucun dialogue fermé ne
   traîne dans le DOM (ni dans l'arbre d'accessibilité). */
function closeDialog() {
  releaseCharacterViewer?.();
  releaseCharacterViewer = null;
  const dialog = dialogRoot.querySelector("dialog");
  if (dialog?.open) dialog.close();
  dialogRoot.innerHTML = "";
}

function disarmDanger() {
  armedDanger = null;
  const armed = app.querySelector(".is-armed");
  if (armed) render();
}

/* ---------- Historique et persistance ---------- */

function commit(nextState, { record = true, notify = true } = {}) {
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
  if (!isAdultUnlocked()) return;
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
        const rewards = [];
        for (let level = before.level + 1; level <= pupil.level; level += 1) {
          rewards.push(...getRewardsForLevel(level));
        }
        const unique = [...new Set(rewards)];
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
  account = next;
  state = loadState(next.id);
  localDirty = loadDirty(next.id);
  syncConflict = false;
  history = [];
  ui.gateError = "";
  ui.gateValues = {};
  ui.adminAccounts = [];
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
  forgetSession(context);
  account = null;
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
    // Stockage indisponible (navigation privée…) : le choix ne survivra pas.
  }
}

document.addEventListener("change", (event) => {
  if (event.target.id !== "import-file") return;
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  file.text()
    .then((text) => {
      const imported = importState(text);
      const total = imported.classes.reduce((sum, classroom) => sum + classroom.pupils.length, 0);
      commit({ ...imported, revision: state.revision }, { record: true, notify: false });
      toast(t("notice.imported", { count: total }), "success", { undo: true });
    })
    .catch((error) => toast(error.message || "Could not read that file.", "error"));
});

/* ---------- Toasts ----------
   Court, nommé, et annulable quand l'action est destructrice. */

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

  // Trois messages suffisent : au-delà, la pile masque la console au lieu
  // de l'informer. Le retrait est immédiat, pas fondu : `dismiss` ne
  // détache le nœud qu'après son animation, et la boucle tournerait sans
  // fin en attendant une place qui ne se libère pas.
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

/* ---------- Serveur ---------- */

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
    const response = await fetch(apiUrl("state"), {
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
    // Hors ligne ou sans backend : localStorage suffit, la synchro se fera
    // au prochain chargement réussi.
  } finally {
    if (saveInFlight === context) saveInFlight = null;
  }
  if (saveQueued && !syncConflict && isCurrentSession(context)) {
    saveQueued = false;
    saveToServer();
  }
}

async function bootstrapFromServer() {
  if (!account) return;
  const context = captureSessionContext();
  if (!context || context.accountId !== account.id) return;
  try {
    const response = await fetch(apiUrl("state"), {
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
    // Hors ligne : on garde ce que localStorage contenait.
  }
}

async function reloadServerCopy() {
  if (!account || !syncConflict) return;
  const context = captureSessionContext();
  const accountId = account.id;
  try {
    const response = await fetch(apiUrl("state"), { cache: "no-store", headers: { "X-Session-Token": context?.token || "" } });
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
    const response = await fetch(apiUrl("admin/accounts"), { cache: "no-store", headers: { "X-Session-Token": context?.token || "" } });
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
    fetch(apiUrl("state"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Session-Token": context?.token || "" },
      body: JSON.stringify(state),
      keepalive: true
    });
  } catch {
    // Fermeture de page : localStorage a déjà la copie.
  }
});

function renderPreservingForms() {
  const forms = [...app.querySelectorAll("form")].map(form => [...form.elements].map(input => ({ name: input.name, value: input.value, checked: input.checked })));
  render();
  [...app.querySelectorAll("form")].forEach((form, index) => {
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
  closeDialog();
  renderPreservingForms();
});
applyTheme();
render();
bootstrapFromServer();
if (currentView() === "admin") loadAdminAccounts();
setInterval(updateClock, 30_000);
