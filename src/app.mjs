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
  changePassword,
  forgetSession,
  getAccount,
  isAdultUnlocked,
  isSignedIn,
  lockAdult,
  sessionHeaders,
  signIn,
  signOut,
  signUp,
  unlockAdult,
  unlockUntil,
  validateNewPassword,
  verifyPassword
} from "./session.mjs";
import { escapeHtml, icon } from "./ui.mjs";
import { renderBoard } from "./views/board.mjs";
import { renderConsole } from "./views/console.mjs";
import { renderLockScreen } from "./views/lock.mjs";
import { renderWelcome } from "./views/welcome.mjs";
import { renderRules } from "./views/rules.mjs";
import { renderStudentLocker, renderStudentPicker } from "./views/student.mjs";
import { renderItemDialog, renderPupilDialog } from "./views/modals.mjs";

const app = document.querySelector("#app");
const toastRoot = document.querySelector("#toasts");
const dialogRoot = document.querySelector("#dialog-root");

// Mémorise le héros choisi sur CET appareil, pour rouvrir le casier
// directement à la visite suivante. Jamais synchronisé au serveur.
const STUDENT_KEY = "game-of-more:student";

/* Le compte décide de tout : quelles classes s'affichent, quel cache local
   sert de secours, vers quel dossier le serveur écrit. */
let account = getAccount();
let state = account ? loadState(account.id) : createInitialState();
let history = [];
let studentPupilId = loadStudentId();
let persistTimer = null;
let saveInFlight = false;
let saveQueued = false;
let localDirty = false;
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
  openPanels: new Set(["hero"]),
  lockError: "",
  lockPending: false,
  gateTab: "signin",
  gateError: "",
  gatePending: false,
  gateValues: {}
};

/* ---------- Routage ---------- */

function currentView() {
  if (!isSignedIn()) return "welcome";
  if (location.hash === "#rules") return "rules";
  if (location.hash.startsWith("#student")) return "student";
  if (location.hash.startsWith("#board")) return isAdultUnlocked() ? "board" : "lock";
  /* Sans route, l'appareil décide : la tablette d'un élève ouvre son casier,
     l'écran de la classe, déjà déverrouillé, retrouve son plateau. */
  return isAdultUnlocked() ? "board" : "student";
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/* Effacer la route sans passer par `hashchange` : l'appelant rend l'écran
   lui-même, une fois, au moment qui lui convient. */
function clearRoute() {
  if (!location.hash) return;
  try {
    window.history.replaceState(null, "", location.pathname + location.search);
  } catch {
    location.hash = "";
  }
}

window.addEventListener("hashchange", () => {
  closeDialog();
  ui.query = "";
  ui.consoleOpen = false;
  ui.lockError = "";
  ui.lockPending = false;
  render();
});

/* ---------- Rendu ---------- */

function render() {
  const view = currentView();
  const memory = captureUiMemory();

  app.innerHTML = `
    ${renderTopbar(view)}
    ${renderViewBody(view)}
  `;

  restoreUiMemory(memory);
  flushFlash();
}

function renderViewBody(view) {
  if (view === "welcome") {
    return `
      <main class="page page-narrow">
        ${renderBanner()}
        ${renderWelcome({
          tab: ui.gateTab,
          error: ui.gateError,
          pending: ui.gatePending,
          values: ui.gateValues
        })}
      </main>
    `;
  }

  const classroom = getCurrentClass(state);

  if (view === "rules") {
    return `<main class="page page-narrow">${renderBanner()}${renderRules()}</main>`;
  }

  if (view === "lock") {
    return `
      <main class="page page-narrow">
        ${renderBanner()}
        ${renderLockScreen({ account, error: ui.lockError, pending: ui.lockPending })}
      </main>
    `;
  }

  if (view === "student") {
    const pupil = studentPupilId ? getPupilById(state, studentPupilId) : null;
    if (studentPupilId && !pupil) rememberStudent(null);
    return `
      <main class="page page-narrow">
        ${renderBanner()}
        ${pupil ? renderStudentLocker(pupil, ui) : renderStudentPicker(classroom, ui)}
      </main>
    `;
  }

  const targets = getTargets();
  const focused = state.selectedPupilId ? getPupilById(state, state.selectedPupilId) : null;

  return `
    <main class="page page-board">
      ${renderBoard(classroom, ui, state.selectedPupilIds)}
      <aside class="console ${ui.consoleOpen ? "is-open" : ""}" aria-label="Teacher console">
        <button
          class="console-mobile-toggle"
          id="console-toggle"
          type="button"
          data-action="toggle-console"
          aria-expanded="${ui.consoleOpen}"
          aria-controls="teacher-console-body"
        >
          <span>${icon("shop")}Teacher console</span>
          <strong>${ui.consoleOpen ? "Close" : targets.length ? `${targets.length} selected` : "Open controls"}</strong>
        </button>
        <div class="console-body" id="teacher-console-body">
          ${renderConsole({
            classroom,
            ui,
            targets,
            focused,
            canUndo: history.length > 0,
            events: state.events,
            armedReset: armedDanger === "reset",
            unlockedUntil: unlockUntil(),
            account
          })}
        </div>
      </aside>
    </main>
    <input type="file" id="import-file" accept="application/json,.json" hidden />
  `;
}

function renderTopbar(view) {
  /* L'écran verrouillé reste « l'onglet Teacher » : l'élève doit comprendre
     qu'il a bien appuyé là où il voulait, et que c'est la porte qui résiste. */
  const teacherTab = view === "board" || view === "lock";
  const unlocked = isAdultUnlocked();

  const brand = `
    <div class="brand">
      <img class="brand-mark" src="./assets/emblem.svg" alt="" width="32" height="32" />
      <span class="brand-name">Game <em>of</em> More</span>
    </div>
  `;

  /* Avant la connexion, la barre ne porte que le nom du jeu : il n'y a
     encore aucune classe à afficher, donc aucun onglet à proposer. */
  if (view === "welcome") {
    return `<header class="topbar">${brand}</header>`;
  }

  return `
    <header class="topbar">
      ${brand}

      <nav class="segmented class-tabs" aria-label="Classes">
        ${state.classes.map((classroom) => {
          const active = classroom.id === state.activeClassId;
          return `<button type="button" class="${active ? "is-active" : ""}" data-action="select-class" data-class-id="${escapeHtml(classroom.id)}" aria-pressed="${active}">${escapeHtml(classroom.name)}</button>`;
        }).join("")}
      </nav>

      <div class="topbar-end">
        <div class="segmented" role="group" aria-label="Interface">
          <button type="button" class="${teacherTab ? "is-active" : ""}" data-action="show-board" aria-pressed="${teacherTab}">
            Teacher${unlocked ? "" : icon("lock", "icon-tab")}
          </button>
          <button type="button" class="${view === "student" ? "is-active" : ""}" data-action="show-student" aria-pressed="${view === "student"}">Students</button>
        </div>
        ${unlocked ? `<button type="button" class="btn btn-sm btn-ghost btn-lock" data-action="lock-adult" title="Close the adult session on this device">${icon("lock")}<span>Lock</span></button>` : ""}
        <button type="button" class="btn btn-sm btn-ghost ${view === "rules" ? "is-active" : ""}" data-action="show-rules">${icon("book")}<span>Rules</span></button>
        <span class="account-tag" title="Signed in as ${escapeHtml(account?.username || "")}">${escapeHtml(account?.displayName || "")}</span>
      </div>
    </header>
  `;
}

/* La grande bannière reste sur les écrans que la classe regarde ensemble ;
   le plateau, lui, rend chaque pixel vertical aux héros. */
function renderBanner() {
  return `
    <div class="banner">
      <img src="./assets/banner.png" alt="" width="1408" height="352" decoding="async" />
      <h1 class="banner-title">Game <em>of</em> More</h1>
    </div>
  `;
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
  return {
    focusId: active && active.id ? active.id : null,
    caret: active && typeof active.selectionStart === "number" ? active.selectionStart : null,
    consoleScroll: app.querySelector(".console")?.scrollTop ?? 0,
    pageScroll: window.scrollY
  };
}

function restoreUiMemory(memory) {
  const console_ = app.querySelector(".console");
  if (console_) console_.scrollTop = memory.consoleScroll;

  if (memory.focusId) {
    const next = document.getElementById(memory.focusId);
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
  }

  window.scrollTo({ top: memory.pageScroll });
}

function flushFlash() {
  if (!pendingFlash.size) return;
  for (const id of pendingFlash) {
    const safe = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : String(id).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const card = app.querySelector(`[data-pupil-id="${safe}"]`)?.closest(".hero-card, .hero-row");
    if (!card) continue;
    card.classList.add("is-flash");
    card.addEventListener("animationend", () => card.classList.remove("is-flash"), { once: true });
  }
  pendingFlash.clear();
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
  if (!account || event.key !== stateKey(account.id) || !event.newValue) return;
  try {
    state = normalizeState(JSON.parse(event.newValue));
    history = [];
    render();
  } catch {
    // Écriture malformée venue d'un autre onglet : on ignore.
  }
});

const ACTIONS = {
  "show-board": () => navigate("#board"),
  "show-student": () => navigate("#student"),
  "show-rules": () => navigate("#rules"),

  "gate-tab": (el) => {
    ui.gateTab = el.dataset.tab;
    ui.gateError = "";
    render();
  },

  /* Se déconnecter, c'est souvent rendre une tablette partagée : on pousse
     d'abord ce qui n'est pas encore parti, puis on efface le cache local —
     mais jamais tant qu'une modification n'a pas atteint le serveur. */
  "sign-out": async () => {
    const name = account?.displayName || "";
    const accountId = account?.id;
    if (localDirty) await saveToServer();
    const flushed = !localDirty;
    await signOut();
    if (accountId && flushed) {
      try {
        localStorage.removeItem(stateKey(accountId));
      } catch {
        // Le cache disparaîtra avec les données du site.
      }
    }
    endSession();
    toast(flushed
      ? (name ? `Signed out of ${name}.` : "Signed out.")
      : "Signed out. Some changes are still waiting to reach the server on this device.",
    flushed ? "info" : "warn");
  },

  /* Reverrouiller est le geste de fin de cours : un appui, et l'écran de la
     classe redevient celui des élèves. */
  "lock-adult": () => {
    lockAdult();
    ui.consoleOpen = false;
    navigate("#student");
    toast("Adult access locked.", "info");
  },

  "toggle-console": () => {
    ui.consoleOpen = !ui.consoleOpen;
    render();
  },

  "select-class": (el) => {
    disarmDanger();
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

  "zoom-pupil": (el) => openPupilDialog(el.dataset.pupilId),
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
    ui.openPanels.add("add");
    render();
    const input = document.querySelector("#pupil-name");
    input?.scrollIntoView({ block: "center", behavior: "smooth" });
    input?.focus();
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
    toast(`${pupil.name} removed.`, "warn", { undo: true });
  },

  "shop-category": (el) => {
    ui.shopCategory = el.dataset.category;
    render();
  },

  "preview-item": (el) => openItemDialog(el.dataset.itemId),
  "shop-item": (el) => buyOrEquip(el.dataset.itemId),

  "student-pick": (el) => {
    rememberStudent(el.dataset.pupilId);
    ui.query = "";
    render();
    window.scrollTo({ top: 0 });
  },

  "change-hero": () => {
    rememberStudent(null);
    render();
  },

  undo: () => undo(),

  export: () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `game-of-more-${new Date().toISOString().slice(0, 10)}.json`;
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
    commit(createInitialState());
    toast("Every class was erased.", "warn", { undo: true });
  }
};

const FORMS = {
  "sign-in": async (form) => {
    if (ui.gatePending) return;
    const data = new FormData(form);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    ui.gateValues = { username };

    if (!username || !password) {
      ui.gateError = "Type the username and the password.";
      render();
      return;
    }

    ui.gatePending = true;
    ui.gateError = "";
    render();

    const result = await signIn(username, password);
    ui.gatePending = false;

    if (!result.ok) {
      ui.gateError = result.error;
      render();
      // Le champ était désactivé pendant l'attente : on rend le curseur.
      document.querySelector("#gate-password")?.focus();
      return;
    }

    openAccount(result.account);
    toast(`Welcome back, ${result.account.displayName}.`, "success");
  },

  "sign-up": async (form) => {
    if (ui.gatePending) return;
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
    ui.gatePending = false;

    if (!result.ok) {
      ui.gateError = result.error;
      render();
      document.querySelector("#gate-username")?.focus();
      return;
    }

    /* Une classe neuve part vide : son enseignant ajoute ses vrais élèves,
       il n'a pas à effacer d'abord un plateau de démonstration. */
    openAccount(result.account, createInitialState({ samples: false }));
    toast(`${result.account.displayName} is ready.`, "levelup");
  },

  unlock: async (form) => {
    if (ui.lockPending) return;
    const password = String(new FormData(form).get("password") || "");
    if (!password) {
      ui.lockError = "Type the class password first.";
      render();
      return;
    }

    ui.lockPending = true;
    ui.lockError = "";
    render();

    const result = await verifyPassword(password);
    ui.lockPending = false;

    if (result.expired) {
      endSession("The session ended. Sign in again.");
      return;
    }
    if (!result.ok) {
      ui.lockError = result.error;
      render();
      document.querySelector("#adult-password")?.focus();
      return;
    }

    ui.lockError = "";
    unlockAdult();
    navigate("#board");
    toast(result.offline
      ? "Console unlocked — offline, without the server."
      : "Console unlocked.", "success");
  },

  "change-password": async (form) => {
    const data = new FormData(form);
    const current = String(data.get("current") || "");
    const next = String(data.get("next") || "");
    const problem = validateNewPassword(next, data.get("confirm"));
    if (problem) {
      toast(problem, "error");
      return;
    }

    const result = await changePassword(current, next);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    form.reset();
    /* Le mot de passe change pour tout le monde : cet appareil garde sa
       session ouverte, les autres devront saisir le nouveau. */
    unlockAdult();
    render();
    toast("Class password updated. The other devices were signed out.", "success");
  },

  "custom-xp": (form) => {
    const amount = Number(new FormData(form).get("amount"));
    giveXp(amount, "Custom XP");
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
    toast(`${name} joined ${getCurrentClass(state).name}.`, "success");
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
      toast(`This order requires level ${item.minLevel} and ${item.price} coins.`, "error");
      return;
    }
    const next = purchaseItem(state, pupil.id, item.id, note);
    closeDialog();
    commit(next);
    toast(`Custom order saved for ${pupil.name}.`, "levelup");
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
  commit(awardMoney(state, targets, amount, "Teacher coins"));
  toast(`+${amount} coins · ${describeTargets(targets)}`, "coin");
}

function changeTargetHp(delta) {
  const targets = getTargets();
  if (!targets.length) return;
  targets.forEach((id) => pendingFlash.add(id));
  commit(changeHpMany(state, targets, delta));
}

function describeTargets(targets) {
  if (ui.scope === "class") return getCurrentClass(state).name;
  if (targets.length === 1) return getPupilById(state, targets[0])?.name || "1 hero";
  return `${targets.length} heroes`;
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
    toast(`${item.name} equipped.`, "success");
    return;
  }

  const next = purchaseItem(state, pupil.id, itemId);
  if (next === state) {
    const why = pupil.level < item.minLevel
      ? `${item.name} unlocks at level ${item.minLevel}.`
      : `${item.name} costs ${item.price} coins, you have ${pupil.money}.`;
    toast(why, "error");
    return;
  }
  commit(next);
  toast(`${item.name} bought and equipped.`, "levelup");
}

/* ---------- Dialogues ---------- */

function openPupilDialog(pupilId) {
  const pupil = getPupilById(state, pupilId);
  if (!pupil) return;
  showDialog(renderPupilDialog(pupil));
}

function openItemDialog(itemId) {
  const pupil = getShopPupil();
  const item = getShopItem(itemId);
  if (!pupil || !item) return;
  showDialog(renderItemDialog(item, pupil));
}

function showDialog(html) {
  dialogRoot.innerHTML = html;
  const dialog = dialogRoot.querySelector("dialog");
  if (!dialog) return;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
    const close = event.target.closest("[data-action='close-dialog']");
    if (close) closeDialog();
  });
  dialog.addEventListener("close", () => {
    dialogRoot.innerHTML = "";
  });
  dialog.showModal();
}

/* `close()` déclenche l'événement qui vide le conteneur, mais seulement au
   tour suivant : on vide tout de suite pour qu'aucun dialogue fermé ne
   traîne dans le DOM (ni dans l'arbre d'accessibilité). */
function closeDialog() {
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
  if (!history.length) {
    toast("Nothing left to undo.", "info");
    return;
  }
  state = history.pop();
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
        toast(`${pupil.name} reached level ${pupil.level}.${unique.length ? ` Unlocked: ${unique.join(", ")}.` : ""}`, "levelup");
      }
      if (before.hp > 0 && pupil.hp <= 0) toast(`${pupil.name} is out of HP.`, "warn");
      if (before.hp <= 0 && pupil.hp > 0) toast(`${pupil.name} is back in the game.`, "success");
    }
  }
}

/* Un cache par compte : deux enseignants qui se succèdent sur le même
   navigateur ne doivent jamais voir les héros l'un de l'autre. */
function stateKey(accountId) {
  return `${STORAGE_KEY}:${accountId}`;
}

function cacheState() {
  if (!account) return;
  try {
    localStorage.setItem(stateKey(account.id), JSON.stringify(state));
  } catch {
    toast("Could not save locally: storage is full or blocked.", "error");
  }
}

function saveAndRender() {
  state = { ...state, updatedAt: new Date().toISOString() };
  cacheState();
  localDirty = true;
  scheduleServerSave();
  render();
}

function loadState(accountId) {
  const raw = localStorage.getItem(stateKey(accountId));
  if (!raw) return createInitialState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

/* ---------- Ouverture et fermeture d'une session ---------- */

function openAccount(next, seed = null) {
  account = next;
  history = [];
  localDirty = false;
  state = seed ?? loadState(account.id);
  ui.gateError = "";
  ui.gateValues = {};
  ui.query = "";
  studentPupilId = loadStudentId();
  /* Une classe neuve n'a encore rien sur le serveur : on y pousse le plateau
     de départ, sinon le premier rechargement retomberait sur un état vide. */
  if (seed) saveAndRender();
  else render();
  bootstrapFromServer();
}

/* Déconnexion, ou jeton que le serveur ne reconnaît plus : l'appareil oublie
   le compte et revient à la page d'accueil, sans rien perdre côté serveur. */
function endSession(message = "") {
  forgetSession();
  account = null;
  state = createInitialState();
  history = [];
  localDirty = false;
  clearTimeout(persistTimer);
  persistTimer = null;
  ui.gateError = message;
  ui.gateTab = "signin";
  ui.gatePending = false;
  ui.consoleOpen = false;
  /* La route de l'ancien compte ne doit pas suivre le suivant : sans cela,
     se reconnecter retomberait sur l'écran verrouillé au lieu de la classe. */
  clearRoute();
  render();
  if (message) toast(message, "warn");
}

/* Le héros choisi appartient à l'appareil ET au compte : une tablette
   prêtée à un collègue ne doit pas rouvrir le casier d'un autre élève. */
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
      commit(imported, { record: true, notify: false });
      toast(`Import done: ${total} heroes restored.`, "success", { undo: true });
    })
    .catch((error) => toast(error.message || "Could not read that file.", "error"));
});

/* ---------- Toasts ----------
   Court, nommé, et annulable quand l'action est destructrice. */

function toast(message, kind = "info", { undo: withUndo = false } = {}) {
  const node = document.createElement("div");
  node.className = `toast toast-${kind}`;
  node.innerHTML = `<p>${escapeHtml(message)}</p>`;

  if (withUndo) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-undo";
    button.textContent = "Undo";
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
  if (saveInFlight) {
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
  if (!account) return;
  saveInFlight = true;
  const snapshot = JSON.stringify(state);
  try {
    const response = await fetch(apiUrl("state"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...sessionHeaders() },
      body: snapshot
    });
    if (response.status === 401) {
      saveInFlight = false;
      saveQueued = false;
      endSession("The session ended. Sign in again — nothing was lost.");
      return;
    }
    if (!response.ok) throw new Error(`save failed: ${response.status}`);
    if (snapshot === JSON.stringify(state)) localDirty = false;
  } catch {
    // Hors ligne ou sans backend : localStorage suffit, la synchro se fera
    // au prochain chargement réussi.
  }
  saveInFlight = false;
  if (saveQueued) {
    saveQueued = false;
    saveToServer();
  }
}

async function bootstrapFromServer() {
  if (!account) return;
  try {
    const response = await fetch(apiUrl("state"), { cache: "no-store", headers: sessionHeaders() });
    if (response.status === 401) {
      endSession("The session ended. Sign in again — nothing was lost.");
      return;
    }
    if (response.status === 404) {
      saveToServer();
      return;
    }
    if (!response.ok) return;
    const remote = await response.json();
    if (!remote || !Array.isArray(remote.classes)) return;
    if (localDirty) return;
    const localAt = Date.parse(state.updatedAt || "");
    const remoteAt = Date.parse(remote.updatedAt || "");
    if (Number.isFinite(localAt) && (!Number.isFinite(remoteAt) || localAt > remoteAt)) {
      saveToServer();
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

window.addEventListener("pagehide", () => {
  if (!localDirty || !account) return;
  clearTimeout(persistTimer);
  persistTimer = null;
  // Never race a newer keepalive write against an older request already in flight.
  // The dirty localStorage copy will be retried on the next visit.
  if (saveInFlight) return;
  try {
    fetch(apiUrl("state"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...sessionHeaders() },
      body: JSON.stringify(state),
      keepalive: true
    });
  } catch {
    // Fermeture de page : localStorage a déjà la copie.
  }
});

render();
bootstrapFromServer();
