import { createHeroViewer } from './viewer.mjs';

/* ============================================================
   Game of More — Tablette Sheikah (prototype complet)
   Le plateau, la fiche et le vestiaire partagent une seule dalle 3D :
   on ne recharge jamais le modèle, on change l'état du vestiaire.
   ============================================================ */

const GLB_URL = new URL('../assets/wardrobe.glb', import.meta.url).href;
const STORE_KEY = 'gom-sheikah-demo-v1';
const THEME_KEY = 'gom-sheikah-theme';
const SESSION_KEY = 'gom-sheikah-session';

const OUTFITS = [
  { id: 'base', name: 'Essentiel' },
  { id: 'explorer', name: 'Éclaireur' },
  { id: 'traveller', name: 'Voyageur' }
];
const DYES = [
  { id: 'sage', name: 'Sauge', css: '#80998d' },
  { id: 'mist', name: 'Brume', css: '#718999' },
  { id: 'sand', name: 'Sable', css: '#b8a586' }
];
const BELTS = [
  { id: 'none', name: 'Aucune' },
  { id: 'satchel', name: 'Sacoche' },
  { id: 'lantern', name: 'Lanterne' }
];
const ANGLES = [
  { id: 'front', name: 'Face' },
  { id: 'quarter', name: 'Trois quarts' },
  { id: 'back', name: 'Dos' },
  { id: 'outfit', name: 'Tenue' },
  { id: 'face', name: 'Visage' }
];
const XP_PRESETS = [
  { amount: 100, reason: 'Devoirs' },
  { amount: 150, reason: 'Vocabulaire' },
  { amount: 50, reason: 'Bravo' },
  { amount: 500, reason: 'Bonus' }
];
const COIN_PRESETS = [10, 20, 30, 50];

const ico = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

function xpNeeded(level) {
  return 300 + (level - 1) * 150;
}
function xpProgress(pupil) {
  return { current: pupil.xp, needed: xpNeeded(pupil.level) };
}
const isOut = (pupil) => pupil.hp <= 0;

/* ---------------- fixtures ---------------- */

function pupil(id, name, gender, level, xp, hp, money, outfit, dye, belt, pack) {
  return { id, name, gender, level, xp, hp, money, outfit, dye, belt, pack };
}

function fixture() {
  return {
    activeClassId: '7p',
    ui: { mode: 'teacher', view: 'board', focusId: null, selected: [], query: '', scope: 'selection', gateTab: 'signin', gateError: '', gateValues: {} },
    classes: [
      {
        id: '7p',
        name: '7P',
        pupils: [
          pupil('a', 'Alex', 'male', 5, 310, 4, 120, 'explorer', 'sage', 'lantern', true),
          pupil('b', 'Mia', 'female', 7, 740, 5, 305, 'traveller', 'mist', 'satchel', false),
          pupil('c', 'Noah', 'male', 3, 160, 3, 60, 'base', 'sand', 'none', false),
          pupil('d', 'Lina', 'female', 4, 330, 0, 40, 'explorer', 'mist', 'none', true),
          pupil('e', 'Emma', 'female', 6, 520, 5, 230, 'traveller', 'sage', 'lantern', true),
          pupil('f', 'Niko', 'male', 2, 75, 0, 15, 'base', 'mist', 'none', false),
          pupil('g', 'Sara', 'female', 5, 260, 4, 95, 'explorer', 'sand', 'satchel', false),
          pupil('h', 'Léo', 'male', 4, 400, 5, 150, 'traveller', 'sage', 'lantern', true)
        ]
      },
      {
        id: '8p',
        name: '8P',
        pupils: [
          pupil('i', 'Ines', 'female', 6, 480, 5, 210, 'explorer', 'sage', 'satchel', false),
          pupil('j', 'Theo', 'male', 8, 910, 4, 420, 'traveller', 'sand', 'lantern', true),
          pupil('k', 'Aya', 'female', 5, 300, 5, 130, 'base', 'mist', 'none', false),
          pupil('l', 'Malo', 'male', 3, 220, 2, 55, 'explorer', 'mist', 'satchel', true),
          pupil('m', 'Zoé', 'female', 7, 660, 5, 280, 'traveller', 'sage', 'none', false),
          pupil('n', 'Eli', 'male', 4, 360, 0, 70, 'base', 'sand', 'lantern', false)
        ]
      }
    ]
  };
}

/* ---------------- state ---------------- */

let state = load();
let viewer = null;
let viewerReady = null;
let toastTimer = null;
let theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
let session = loadSession();

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveSession() {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked */
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage blocked */
  }
  viewer?.setTheme?.(theme);
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* first run */
  }
  return fixture();
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked */
  }
}
const currentClass = () => state.classes.find((c) => c.id === state.activeClassId) || state.classes[0];
const getPupil = (id) => currentClass().pupils.find((p) => p.id === id) || null;
const focusPupil = () => (state.ui.focusId ? getPupil(state.ui.focusId) : null);

/* ---------------- viewer ---------------- */

async function ensureViewer() {
  if (viewer) return viewer;
  if (viewerReady) return viewerReady;
  const host = document.createElement('div');
  viewerReady = createHeroViewer(host, GLB_URL, { gender: 'male', outfit: 'base', dye: 'sage', belt: 'none', pack: false }, {
    theme,
    onProgress: (pct) => {
      const bar = document.querySelector('[data-load-bar]');
      if (bar) bar.style.setProperty('--p', `${pct}%`);
    },
    onError: (message) => toast(message, 'danger')
  }).then((instance) => {
    viewer = instance;
    return instance;
  });
  return viewerReady;
}

async function syncViewer() {
  const slot = document.querySelector('[data-viewer-host]');
  if (!slot) {
    viewer?.setVisible(false);
    return;
  }
  slot.classList.add('is-loading');
  const instance = await ensureViewer();
  slot.append(instance.element);
  slot.classList.remove('is-loading');
  const subject = state.ui.view === 'personalize' ? draftSubject() : focusPupil();
  if (subject) {
    instance.applyState({
      gender: subject.gender,
      outfit: subject.outfit,
      dye: subject.dye,
      belt: subject.belt,
      pack: Boolean(subject.pack)
    });
  }
  instance.setVisible(true);
  if (state.ui.angle) instance.setAngle(state.ui.angle);
  instance.setRotation(Boolean(state.ui.rotating));
}

function draftSubject() {
  const pupil = focusPupil();
  if (!pupil) return null;
  return { ...pupil, ...state.ui.draft };
}

/* ---------------- actions ---------------- */

const actions = {
  'select-class'(el) {
    state.activeClassId = el.dataset.classId;
    state.ui.selected = [];
    state.ui.focusId = null;
    render();
  },
  mode(el) {
    state.ui.mode = el.dataset.mode;
    state.ui.view = 'board';
    if (state.ui.mode === 'student' && !state.ui.focusId) {
      state.ui.focusId = currentClass().pupils[0]?.id || null;
      state.ui.view = 'sheet';
    }
    render();
  },
  view(el) {
    state.ui.view = el.dataset.view;
    if (el.dataset.view === 'personalize') startDraft();
    render();
  },
  'toggle-theme'() {
    theme = theme === 'light' ? 'dark' : 'light';
    applyTheme();
    render();
  },
  'gate-tab'(el) {
    state.ui.gateTab = el.dataset.tab;
    state.ui.gateError = '';
    render();
  },
  'sign-in'(form) {
    const data = new FormData(form);
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');
    state.ui.gateValues = { username };
    if (!username || !password) {
      state.ui.gateError = 'Renseignez l’identifiant et le mot de passe.';
      render();
      return;
    }
    session = { username, displayName: username };
    saveSession();
    state.ui.gateError = '';
    state.ui.gateValues = {};
    announce(`Bienvenue, ${username}.`);
    render();
  },
  'sign-up'(form) {
    const data = new FormData(form);
    const displayName = String(data.get('displayName') || '').trim();
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');
    const confirm = String(data.get('confirm') || '');
    state.ui.gateValues = { username, displayName };
    if (!username || !password) state.ui.gateError = 'Renseignez l’identifiant et le mot de passe.';
    else if (password.length < 6) state.ui.gateError = 'Le mot de passe doit faire au moins 6 caractères.';
    else if (password !== confirm) state.ui.gateError = 'Les deux mots de passe ne correspondent pas.';
    else state.ui.gateError = '';
    if (state.ui.gateError) {
      render();
      return;
    }
    session = { username, displayName: displayName || username };
    saveSession();
    state.ui.gateValues = {};
    announce(`${session.displayName} est prête.`);
    render();
  },
  'toggle-password'(el) {
    const input = el.closest('.field-pass')?.querySelector('input');
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    el.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    el.innerHTML = ico(show ? 'eye-off' : 'eye');
  },
  'sign-out'() {
    session = null;
    saveSession();
    state.ui.view = 'board';
    render();
  },
  'toggle-pupil'(el) {
    const id = el.dataset.pupilId;
    const index = state.ui.selected.indexOf(id);
    if (index >= 0) state.ui.selected.splice(index, 1);
    else state.ui.selected.push(id);
    render();
  },
  'open-pupil'(el) {
    state.ui.focusId = el.dataset.pupilId;
    state.ui.view = 'sheet';
    render();
  },
  personalize(el) {
    state.ui.focusId = el.dataset.pupilId;
    startDraft();
    state.ui.view = 'personalize';
    render();
  },
  back() {
    state.ui.view = 'board';
    state.ui.draft = null;
    render();
  },
  'award-xp'(el) {
    const amount = Number(el.dataset.amount);
    for (const pupil of targets()) awardXp(pupil, amount, el.dataset.reason);
    announce(`+${amount} XP · ${el.dataset.reason}`);
    save();
    render();
  },
  'award-money'(el) {
    const amount = Number(el.dataset.amount);
    for (const pupil of targets()) pupil.money += amount;
    announce(`+${amount} pièces`);
    save();
    render();
  },
  'hp-minus'(el) {
    for (const pupil of targets()) pupil.hp = Math.max(0, pupil.hp - 1);
    announce('−1 PV');
    save();
    render();
  },
  'hp-plus'() {
    for (const pupil of targets()) pupil.hp = Math.min(5, pupil.hp + 1);
    announce('+1 PV');
    save();
    render();
  },
  'heal-all'() {
    for (const pupil of currentClass().pupils) pupil.hp = 5;
    announce('Classe restaurée');
    save();
    render();
  },
  scope(el) {
    state.ui.scope = el.dataset.scope;
    render();
  },
  'select-all'() {
    state.ui.selected = currentClass().pupils.map((p) => p.id);
    render();
  },
  'clear-selection'() {
    state.ui.selected = [];
    render();
  },
  'set-gender'(el) {
    state.ui.draft.gender = el.dataset.value;
    syncViewer();
    render({ keepViewer: true });
  },
  'set-outfit'(el) {
    state.ui.draft.outfit = el.dataset.value;
    syncViewer();
    render({ keepViewer: true });
  },
  'set-dye'(el) {
    state.ui.draft.dye = el.dataset.value;
    syncViewer();
    render({ keepViewer: true });
  },
  'set-belt'(el) {
    state.ui.draft.belt = el.dataset.value;
    syncViewer();
    render({ keepViewer: true });
  },
  'set-pack'(el) {
    state.ui.draft.pack = el.dataset.value === 'on';
    syncViewer();
    render({ keepViewer: true });
  },
  angle(el) {
    state.ui.angle = el.dataset.value;
    state.ui.rotating = false;
    viewer?.setAngle(state.ui.angle);
    render({ keepViewer: true });
  },
  'toggle-rotate'() {
    state.ui.rotating = !state.ui.rotating;
    viewer?.setRotation(state.ui.rotating);
    render({ keepViewer: true });
  },
  equip() {
    const pupil = focusPupil();
    if (!pupil) return;
    Object.assign(pupil, state.ui.draft);
    save();
    announce(`${pupil.name} porte la nouvelle tenue`);
    state.ui.view = 'board';
    state.ui.draft = null;
    render();
  },
  reset() {
    state = fixture();
    save();
    state.ui.draft = null;
    render();
  },
  'dismiss-toast'() {
    document.querySelector('.toast')?.remove();
  }
};

function startDraft() {
  const pupil = focusPupil();
  state.ui.draft = pupil
    ? { gender: pupil.gender, outfit: pupil.outfit, dye: pupil.dye, belt: pupil.belt, pack: Boolean(pupil.pack) }
    : { gender: 'male', outfit: 'base', dye: 'sage', belt: 'none', pack: false };
  state.ui.angle = 'quarter';
  state.ui.rotating = false;
}

function targets() {
  if (state.ui.scope === 'class') return currentClass().pupils;
  return state.ui.selected.map(getPupil).filter(Boolean);
}

function awardXp(pupil, amount, reason) {
  pupil.xp += amount;
  while (pupil.xp >= xpNeeded(pupil.level)) {
    pupil.xp -= xpNeeded(pupil.level);
    pupil.level += 1;
    pupil.money += 25;
  }
}

function announce(message, tone = 'ok') {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div');
  node.className = `toast toast-${tone}`;
  node.setAttribute('role', 'status');
  node.innerHTML = `${ico('rune')}<span>${message}</span><button type="button" data-action="dismiss-toast" aria-label="Fermer">${ico('close')}</button>`;
  document.getElementById('toasts').append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 2600);
}

function toast(message, tone) {
  announce(message, tone);
}

/* ---------------- render ---------------- */

const app = document.getElementById('app');

function render({ keepViewer = false } = {}) {
  const before = document.querySelector('[data-viewer-host]');
  if (before && viewer) before.replaceChildren();

  if (!session) {
    app.innerHTML = renderLogin();
    updateClock();
    return;
  }

  let view;
  if (state.ui.mode === 'student') view = state.ui.view === 'personalize' ? renderPersonalize() : renderSheet(true);
  else if (state.ui.view === 'sheet') view = renderSheet(false);
  else if (state.ui.view === 'personalize') view = renderPersonalize();
  else view = renderTeacher();

  app.innerHTML = `${renderTopbar()}${view}`;
  updateClock();
  syncViewer();
}

function renderLogin() {
  const signup = state.ui.gateTab === 'signup';
  const values = state.ui.gateValues || {};
  const error = state.ui.gateError || '';
  const passField = (name, label, autocomplete) => `
    <label class="field"><span>${label}</span>
      <span class="field-pass">
        <input name="${name}" type="password" autocomplete="${autocomplete}" />
        <button type="button" class="pass-toggle" data-action="toggle-password" aria-label="Afficher le mot de passe">${ico('eye')}</button>
      </span>
    </label>`;
  return `
    <main class="gate">
      <header class="gate-top">
        <div class="brand">
          <svg class="seal" viewBox="0 0 48 48" aria-hidden="true"><use href="#seal"/></svg>
          <span class="brand-name">Game <em>of</em> More</span>
          <span class="brand-sub">Tablette Sheikah</span>
        </div>
        <button type="button" class="ghost" data-action="toggle-theme" aria-pressed="${theme === 'light'}" title="${theme === 'light' ? 'Passer au thème sombre' : 'Passer au thème clair'}">${ico(theme === 'light' ? 'moon' : 'sun')}<span>${theme === 'light' ? 'Sombre' : 'Clair'}</span></button>
      </header>

      <div class="gate-stage">
        <section class="gate-pitch">
          <svg class="gate-seal" viewBox="0 0 48 48" aria-hidden="true"><use href="#seal"/></svg>
          <p class="eyebrow">Aventure d'anglais</p>
          <h1>Ouvrez la tablette de la classe</h1>
          <p class="gate-lede">Progression, expérience et vestiaire des héros réunis sur une seule dalle.</p>
          <ul class="gate-points">
            <li>XP, cœurs et pièces distribués en un geste</li>
            <li>Héros 3D personnalisables en direct</li>
            <li>Chaque classe garde sa progression</li>
          </ul>
        </section>

        <section class="gate-card" aria-labelledby="gate-title">
          <span class="gate-badge">${ico(signup ? 'rune' : 'lock')}</span>
          <h2 id="gate-title">${signup ? 'Créer la classe' : 'Bon retour'}</h2>
          <p class="gate-sub">${signup ? 'Un compte privé pour vos classes, votre progression et vos sauvegardes.' : 'Connectez-vous pour ouvrir vos classes.'}</p>

          <div class="tabs gate-tabs" role="group" aria-label="Connexion ou nouveau compte">
            <button type="button" class="${signup ? '' : 'on'}" data-action="gate-tab" data-tab="signin" aria-pressed="${!signup}">Connexion</button>
            <button type="button" class="${signup ? 'on' : ''}" data-action="gate-tab" data-tab="signup" aria-pressed="${signup}">Nouveau compte</button>
          </div>

          <form class="gate-form" data-action="${signup ? 'sign-up' : 'sign-in'}" novalidate>
            ${signup ? `<label class="field"><span>Nom de la classe</span><input name="displayName" autocomplete="organization" value="${escapeAttr(values.displayName || '')}" /></label>` : ''}
            <label class="field"><span>Identifiant</span><input name="username" autocomplete="username" value="${escapeAttr(values.username || '')}" /></label>
            ${passField('password', 'Mot de passe', signup ? 'new-password' : 'current-password')}
            ${signup ? passField('confirm', 'Répéter le mot de passe', 'new-password') : ''}
            <button class="btn btn-primary btn-lg" type="submit">${ico(signup ? 'rune' : 'exit')}<span>${signup ? 'Créer la classe' : 'Ouvrir la tablette'}</span></button>
          </form>

          ${error ? `<p class="gate-error" role="alert">${escapeHtml(error)}</p>` : ''}
          <p class="gate-note">Démo : n'importe quel identifiant et mot de passe ouvrent la tablette.</p>
        </section>
      </div>
    </main>`;
}

function renderTopbar() {
  const student = state.ui.mode === 'student';
  return `
    <header class="topbar">
      <div class="brand">
        <svg class="seal" viewBox="0 0 48 48" aria-hidden="true"><use href="#seal"/></svg>
        <span class="brand-name">Game <em>of</em> More</span>
        <span class="brand-sub">Tablette Sheikah</span>
      </div>
      <nav class="tabs" aria-label="Classes">
        ${state.classes.map((c) => `<button type="button" class="${c.id === state.activeClassId ? 'on' : ''}" data-action="select-class" data-class-id="${c.id}" aria-pressed="${c.id === state.activeClassId}">${c.name}</button>`).join('')}
      </nav>
      <div class="top-end">
        <div class="tabs" role="group" aria-label="Interface">
          <button type="button" class="${student ? '' : 'on'}" data-action="mode" data-mode="teacher" aria-pressed="${!student}">Enseignant</button>
          <button type="button" class="${student ? 'on' : ''}" data-action="mode" data-mode="student" aria-pressed="${student}">Élèves</button>
        </div>
        ${student ? '' : `<button type="button" class="ghost ${state.ui.view === 'board' ? 'on' : ''}" data-action="view" data-view="board">${ico('board')}<span>Plateau</span></button>`}
        <button type="button" class="ghost" data-action="toggle-theme" aria-pressed="${theme === 'light'}" title="${theme === 'light' ? 'Passer au thème sombre' : 'Passer au thème clair'}">${ico(theme === 'light' ? 'moon' : 'sun')}<span>${theme === 'light' ? 'Sombre' : 'Clair'}</span></button>
        <button type="button" class="ghost" data-action="reset" title="Réinitialiser la démo">${ico('refresh')}<span>Réinitialiser</span></button>
        <span class="who" title="Connecté en tant que ${escapeAttr(session?.username || '')}">${escapeHtml(session?.displayName || session?.username || '')}</span>
        <button type="button" class="ghost" data-action="sign-out" title="Se déconnecter">${ico('exit')}<span>Déconnexion</span></button>
      </div>
    </header>`;
}

function renderTeacher() {
  return `
    <main class="layout">
      ${renderBoard()}
      ${renderConsole()}
    </main>`;
}

function renderBoard() {
  const classroom = currentClass();
  const total = classroom.pupils.length;
  const out = classroom.pupils.filter(isOut).length;
  const average = total ? (classroom.pupils.reduce((sum, p) => sum + p.level, 0) / total).toFixed(1) : '0.0';
  const query = state.ui.query.trim().toLowerCase();
  const pupils = query ? classroom.pupils.filter((p) => p.name.toLowerCase().includes(query)) : classroom.pupils;

  return `
    <section class="board" aria-label="Plateau ${classroom.name}">
      <div class="board-bar">
        <div class="board-title">
          <h2>${classroom.name}</h2>
          <p class="board-sub">Leçon du mardi · session 12 · <span id="clock">--:--</span></p>
        </div>
        <div class="board-stats">
          <span class="chip">${ico('heroes')}<b>${total}</b> héros</span>
          <span class="chip ${out ? 'danger' : ''}">${ico('skull')}<b>${out}</b> hors-jeu</span>
          <span class="chip">${ico('star')}<b>${average}</b> niveau moyen</span>
        </div>
        <div class="board-tools">
          <label class="search">${ico('search')}<input type="search" id="roster-search" data-action="search" value="${escapeAttr(state.ui.query)}" placeholder="Trouver un héros" aria-label="Trouver un héros" /></label>
        </div>
      </div>
      <div class="rune-grid" role="list">
        ${pupils.map((p, i) => renderRuneCard(p, i)).join('')}
      </div>
    </section>`;
}

function renderRuneCard(pupil, index) {
  const selected = state.ui.selected.includes(pupil.id);
  const progress = xpProgress(pupil);
  const pct = Math.min(100, Math.round((progress.current / progress.needed) * 100));
  const dye = DYES.find((d) => d.id === pupil.dye) || DYES[0];
  const portrait = pupil.gender === 'female' ? './assets/mila-portrait.webp' : './assets/noa-portrait.webp';
  const outfit = OUTFITS.find((o) => o.id === pupil.outfit)?.name || '';
  return `
    <article class="rune-card ${selected ? 'is-selected' : ''} ${isOut(pupil) ? 'is-out' : ''}" role="listitem" style="--dye:${dye.css};--delay:${index * 40}ms">
      <button class="card-hit" type="button" data-action="toggle-pupil" data-pupil-id="${pupil.id}" aria-pressed="${selected}" aria-label="Sélectionner ${escapeAttr(pupil.name)}"></button>
      <header class="rune-card-head">
        <h3>${escapeHtml(pupil.name)}</h3>
        <span class="lvl-seal">${pupil.level}</span>
      </header>
      <div class="dais dais-card">
        <img class="hero-fig" src="${portrait}" alt="" loading="lazy" />
        ${isOut(pupil) ? '<span class="out-tag">Hors-jeu</span>' : ''}
        <button class="card-open" type="button" data-action="open-pupil" data-pupil-id="${pupil.id}" aria-label="Voir la fiche de ${escapeAttr(pupil.name)}">${ico('expand')}</button>
      </div>
      <p class="hero-role">${outfit} · ${dye.name}</p>
      <div class="hearts" aria-label="${pupil.hp} points de vie sur 5">
        ${Array.from({ length: 5 }, (_, i) => `<span class="heart ${i < pupil.hp ? '' : 'off'}">${ico('heart')}</span>`).join('')}
      </div>
      <div class="conduit" aria-label="${progress.current} sur ${progress.needed} XP"><i style="--p:${pct}%"></i><span>${progress.current}/${progress.needed}</span></div>
      <footer class="rune-card-foot">
        <span class="coins">${ico('coin')}${pupil.money}</span>
        <button class="rune-act" type="button" data-action="personalize" data-pupil-id="${pupil.id}" aria-label="Personnaliser ${escapeAttr(pupil.name)}">${ico('rune')}<span>Personnaliser</span></button>
      </footer>
    </article>`;
}

function renderConsole() {
  const classroom = currentClass();
  const pupils = targets();
  const names = state.ui.scope === 'class'
    ? `Toute la classe — ${classroom.pupils.length} héros.`
    : pupils.length
      ? pupils.map((p) => escapeHtml(p.name)).join(', ')
      : 'Touchez des héros sur le plateau pour choisir qui reçoit.';
  const off = pupils.length ? '' : 'disabled';

  return `
    <aside class="console" aria-label="Console de l'enseignant">
      <div class="console-head">
        <h2>Console</h2>
        <span class="console-hint">${classroom.name}</span>
      </div>

      <section class="panel-block">
        <p class="label">Destinataires</p>
        <div class="seg seg-wide">
          <button type="button" class="${state.ui.scope === 'selection' ? 'on' : ''}" data-action="scope" data-scope="selection">Sélection <b>${state.ui.selected.length}</b></button>
          <button type="button" class="${state.ui.scope === 'class' ? 'on' : ''}" data-action="scope" data-scope="class">Classe entière</button>
        </div>
        <p class="target-names">${names}</p>
        ${state.ui.scope === 'selection' ? `<div class="row"><button class="btn btn-sm" data-action="select-all">Tout sélectionner</button><button class="btn btn-sm" data-action="clear-selection" ${pupils.length ? '' : 'disabled'}>Effacer</button></div>` : ''}
      </section>

      <section class="panel-block">
        <p class="label">Expérience</p>
        <div class="awards">
          ${XP_PRESETS.map((preset) => `<button class="award" type="button" data-action="award-xp" data-amount="${preset.amount}" data-reason="${preset.reason}" ${off}><strong>+${preset.amount}</strong><span>${preset.reason}</span></button>`).join('')}
        </div>
      </section>

      <section class="panel-block">
        <p class="label">Points de vie</p>
        <div class="row"><button class="btn btn-danger" data-action="hp-minus" ${off}>−1 PV</button><button class="btn btn-ok" data-action="hp-plus" ${off}>+1 PV</button><button class="btn" data-action="heal-all">Restaurer la classe</button></div>
      </section>

      <section class="panel-block">
        <p class="label">Pièces</p>
        <div class="row">${COIN_PRESETS.map((amount) => `<button class="btn btn-coin" data-action="award-money" data-amount="${amount}" ${off}>+${amount}</button>`).join('')}</div>
      </section>
    </aside>`;
}

function renderSheet(studentMode) {
  const pupil = focusPupil();
  if (!pupil) {
    return `<main class="single"><div class="empty">${ico('heroes')}<h2>Aucun héros choisi</h2><p>Revenez au plateau et touchez une plaque.</p><button class="btn btn-primary" data-action="back">Retour au plateau</button></div></main>`;
  }
  const progress = xpProgress(pupil);
  const pct = Math.min(100, Math.round((progress.current / progress.needed) * 100));
  const dye = DYES.find((d) => d.id === pupil.dye) || DYES[0];
  const outfit = OUTFITS.find((o) => o.id === pupil.outfit)?.name || '';
  const belt = BELTS.find((b) => b.id === pupil.belt)?.name || '';
  return `
    <main class="single">
      <div class="sheet">
        <div class="sheet-stage">
          <div class="dais dais-lg" data-viewer-host data-angle="${state.ui.angle || 'quarter'}">
            <span class="loader" data-load-bar style="--p:0%"><i></i></span>
          </div>
          <div class="angle-bar">
            ${ANGLES.map((a) => `<button type="button" data-action="angle" data-value="${a.id}">${a.name}</button>`).join('')}
            <button type="button" class="rot ${state.ui.rotating ? 'on' : ''}" data-action="toggle-rotate">${ico('rotate')}Rotation</button>
          </div>
        </div>
        <div class="sheet-info">
          <p class="eyebrow">Fiche de héros</p>
          <h1>${escapeHtml(pupil.name)}</h1>
          <p class="sheet-role">${outfit} · teinture ${dye.name}${belt !== 'Aucune' ? ` · ${belt}` : ''}${pupil.pack ? ' · sac' : ''}</p>
          <div class="sheet-stats">
            <div class="stat"><span class="lvl-seal big">${pupil.level}</span><small>niveau</small></div>
            <div class="stat">${ico('coin')}<b>${pupil.money}</b><small>pièces</small></div>
            <div class="stat">${ico('star')}<b>${pupil.xp}/${xpNeeded(pupil.level)}</b><small>expérience</small></div>
          </div>
          <div class="hearts big">${Array.from({ length: 5 }, (_, i) => `<span class="heart ${i < pupil.hp ? '' : 'off'}">${ico('heart')}</span>`).join('')}</div>
          <div class="conduit big"><i style="--p:${pct}%"></i></div>
          <div class="row">
            <button class="btn btn-primary" data-action="personalize" data-pupil-id="${pupil.id}">${ico('rune')}<span>Personnaliser</span></button>
            ${studentMode ? '' : `<button class="btn" data-action="back">Retour au plateau</button>`}
            ${studentMode ? `<button class="btn" data-action="back">Retour</button>` : ''}
          </div>
        </div>
      </div>
    </main>`;
}

function renderPersonalize() {
  const pupil = focusPupil();
  if (!pupil) return renderSheet();
  const draft = draftSubject();
  const dye = DYES.find((d) => d.id === draft.dye) || DYES[0];
  const optionButton = (active, action, value, label, extra = '') =>
    `<button type="button" class="rune-choice ${active ? 'on' : ''} ${extra}" data-action="${action}" data-value="${value}" aria-pressed="${active}">${label}</button>`;

  return `
    <main class="single">
      <div class="atelier">
        <div class="atelier-stage">
          <div class="dais dais-lg dais-live" data-viewer-host data-angle="${state.ui.angle || 'quarter'}" style="--dye:${dye.css}">
            <span class="loader" data-load-bar style="--p:0%"><i></i></span>
          </div>
          <div class="angle-bar">
            ${ANGLES.map((a) => `<button type="button" class="${state.ui.angle === a.id ? 'on' : ''}" data-action="angle" data-value="${a.id}">${a.name}</button>`).join('')}
            <button type="button" class="rot ${state.ui.rotating ? 'on' : ''}" data-action="toggle-rotate">${ico('rotate')}Rotation</button>
          </div>
        </div>

        <div class="atelier-panel">
          <p class="eyebrow">Atelier de personnalisation</p>
          <h1>${escapeHtml(pupil.name)}</h1>
          <p class="atelier-sub">Composez la silhouette, puis scellez la tenue sur le plateau.</p>

          <section class="rune-section">
            <p class="label">Personnage</p>
            <div class="rune-row">
              ${optionButton(draft.gender === 'male', 'set-gender', 'male', 'Noa')}
              ${optionButton(draft.gender === 'female', 'set-gender', 'female', 'Mila')}
            </div>
          </section>

          <section class="rune-section">
            <p class="label">Tenue</p>
            <div class="rune-row">
              ${OUTFITS.map((o) => optionButton(draft.outfit === o.id, 'set-outfit', o.id, o.name)).join('')}
            </div>
          </section>

          <section class="rune-section">
            <p class="label">Teinture</p>
            <div class="rune-row dye-row">
              ${DYES.map((d) => optionButton(draft.dye === d.id, 'set-dye', d.id, `<span class="dye" style="--c:${d.css}"></span>${d.name}`)).join('')}
            </div>
          </section>

          <section class="rune-section">
            <p class="label">Ceinture</p>
            <div class="rune-row">
              ${BELTS.map((b) => optionButton(draft.belt === b.id, 'set-belt', b.id, b.name)).join('')}
            </div>
          </section>

          <section class="rune-section">
            <p class="label">Sac à dos</p>
            <div class="rune-row">
              ${optionButton(!draft.pack, 'set-pack', 'off', 'Sans')}
              ${optionButton(draft.pack, 'set-pack', 'on', 'Avec')}
            </div>
          </section>

          <div class="atelier-actions">
            <button class="btn btn-primary btn-lg" data-action="equip">${ico('rune')}<span>Sceller la tenue</span></button>
            <button class="btn btn-lg" data-action="back">Annuler</button>
          </div>
        </div>
      </div>
    </main>`;
}

function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ---------------- helpers ---------------- */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const escapeAttr = escapeHtml;

/* ---------------- events ---------------- */

app.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const handler = actions[el.dataset.action];
  if (handler) {
    event.preventDefault();
    handler(el);
  }
});

app.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-action]');
  if (!form) return;
  event.preventDefault();
  actions[form.dataset.action]?.(form);
});

app.addEventListener('input', (event) => {
  const el = event.target;
  if (el.dataset.action === 'search') {
    state.ui.query = el.value;
    const board = document.querySelector('.board');
    if (board) {
      const caret = el.selectionStart;
      render();
      const next = document.getElementById('roster-search');
      if (next) {
        next.focus();
        next.setSelectionRange(caret, caret);
      }
    }
  }
});

app.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.ui.view !== 'board') actions.back();
});

/* ---------------- wake ---------------- */

function wake() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const node = document.createElement('div');
  node.className = 'wake';
  node.innerHTML = `
    <svg class="wake-eye" viewBox="0 0 48 48" aria-hidden="true"><use href="#seal"/></svg>
    <span class="wake-line"></span>
    <p>Tablette Sheikah · activation</p>`;
  document.body.append(node);
  setTimeout(() => node.classList.add('is-open'), 40);
  setTimeout(() => {
    node.classList.add('is-closing');
    setTimeout(() => node.remove(), 500);
  }, 1150);
}

applyTheme();
render();
wake();