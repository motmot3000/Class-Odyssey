import { renderHero } from './avatar.mjs';

const gameURL = new URL('/', location.href);
gameURL.port = '5180';
document.querySelectorAll('[data-game-link]').forEach(link => { link.href = gameURL.href; });

const hero = { id: 'ranger-lab-source', name: 'Alex', skin: 'vocab-ranger', skinTone: 'medium', hair: 'short', hat: 'shadow-hood', weapon: 'lore-lantern', face: 'cool', gender: 'boy' };
document.querySelector('#original-hero').innerHTML = renderHero(hero);
document.querySelector('#card-original').innerHTML = renderHero(hero);

const variants = {
  adventure: {
    file: 'ranger', container: '#viewer', title: 'Le rôdeur', label: 'du rôdeur aventure',
    description: 'Une silhouette d’aventurier, pensée pour Class Odyssey.',
    outfit: 'Éclaireur des sous-bois', materials: 'Laine · cuir · laiton', accessory: 'Lanterne du savoir'
  },
  playful: {
    file: 'ranger-playful', container: '#viewer-playful', title: 'Jeune éclaireur', label: 'du Jeune éclaireur',
    description: 'Un aventurier accessible : pose détendue, lignes simples et expression calme.',
    outfit: 'Tunique verte · foulard ocre', materials: 'Étoffe mate · cuir simple · laiton', accessory: 'Lanterne de voyage'
  }
};
const viewers = new Map();
const pending = new Map();
const contextErrors = new Map();
let activeVariant = 'adventure';
let modelOpener = document.querySelector('#open-model');
let activeMode = 'compare';
const status = document.querySelector('#viewer-status');
const retry = document.querySelector('#retry-viewer');
const controls = [...document.querySelectorAll('[data-angle], #rotate-model')];

function activeViewer() { return viewers.get(activeVariant); }
function syncViewers() {
  viewers.forEach((viewer, variant) => viewer.setVisible(activeMode === 'model' && activeVariant === variant && !document.hidden && !contextErrors.has(variant)));
}
function readyViewer(variant) {
  if (activeVariant !== variant) return;
  const viewer = viewers.get(variant);
  status.hidden = !contextErrors.has(variant);
  status.classList.toggle('error', contextErrors.has(variant));
  if (contextErrors.has(variant)) status.textContent = contextErrors.get(variant);
  document.querySelector('#model-size').textContent = `${viewer.triangles.toLocaleString('fr-FR')} triangles`;
  controls.forEach(button => { button.disabled = contextErrors.has(variant); });
  syncViewers();
}
async function loadViewer() {
  const variant = activeVariant;
  const config = variants[variant];
  if (viewers.has(variant)) { readyViewer(variant); return viewers.get(variant); }
  controls.forEach(button => { button.disabled = true; });
  retry.hidden = true;
  status.hidden = false;
  status.classList.remove('error');
  status.textContent = 'Chargement du modèle 3D…';
  if (pending.has(variant)) return pending.get(variant);
  const loading = (async () => {
    const { createViewer } = await import('./character-viewer.mjs');
    const viewer = await createViewer(document.querySelector(config.container), {
      modelURL: `/assets/character-lab/${config.file}.glb`,
      label: config.label,
      onProgress: value => { if (activeVariant === variant) status.textContent = `Chargement du modèle 3D… ${value} %`; },
      onError: message => {
        contextErrors.set(variant, message);
        if (viewers.has(variant)) readyViewer(variant);
      }
    });
    viewers.set(variant, viewer);
    viewer.setVisible(activeMode === 'model' && activeVariant === variant && !document.hidden);
    readyViewer(variant);
    return viewer;
  })().catch(error => {
    console.error('Character viewer:', error);
    if (activeVariant !== variant) return;
    status.textContent = 'Le modèle 3D n’a pas pu être chargé. Le rendu fixe reste disponible.';
    status.classList.add('error');
    retry.hidden = false;
  }).finally(() => { pending.delete(variant); });
  pending.set(variant, loading);
  return loading;
}

function selectVariant(variant) {
  activeVariant = variant;
  const config = variants[variant];
  document.querySelector('#model-stage').dataset.variant = variant;
  document.querySelector('#model-title').textContent = config.title;
  for (const field of ['description', 'outfit', 'materials', 'accessory']) {
    document.querySelector(`#model-${field}`).textContent = config[field];
  }
  for (const format of ['glb', 'blend']) {
    document.querySelector(`#model-${format}-download`).href = `/assets/character-lab/${config.file}.${format}`;
  }
  Object.entries(variants).forEach(([key, value]) => { document.querySelector(value.container).hidden = key !== variant; });
  document.querySelectorAll('[data-model-variant]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.modelVariant === variant)));
  document.querySelectorAll('[data-angle]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.angle === 'quarter')));
  document.querySelector('#rotate-model').setAttribute('aria-pressed', 'false');
  document.querySelector('#model-size').textContent = '';
  retry.hidden = true;
  activeViewer()?.setAngle('quarter');
  syncViewers();
  if (activeMode === 'model') loadViewer();
}

function showMode(mode, focus = false) {
  activeMode = mode;
  document.querySelector('#comparison').hidden = mode !== 'compare';
  document.querySelector('#model-stage').hidden = mode !== 'model';
  document.querySelector('#vector-stage').hidden = mode !== 'vector';
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  if (mode === 'model') {
    loadViewer();
    if (focus) document.querySelector('#model-title').focus({ preventScroll: true });
  }
  if (mode === 'vector' && focus) document.querySelector('#vector-title').focus({ preventScroll: true });
  syncViewers();
}
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => showMode(button.dataset.mode)));
document.querySelectorAll('[data-open-model]').forEach(button => button.addEventListener('click', () => {
  modelOpener = button;
  selectVariant(button.dataset.openModel);
  showMode('model', true);
  document.querySelector('.intro').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}));
document.querySelectorAll('[data-model-variant]').forEach(button => button.addEventListener('click', () => selectVariant(button.dataset.modelVariant)));
document.querySelector('#open-vector').addEventListener('click', () => showMode('vector', true));
document.querySelector('#card-open-vector').addEventListener('click', () => {
  showMode('vector', true);
  document.querySelector('.intro').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
document.querySelector('#return-vector-comparison').addEventListener('click', () => {
  showMode('compare');
  const portrait = document.querySelector('#open-vector');
  (portrait.hidden ? document.querySelector('#toggle-original') : portrait).focus({ preventScroll: true });
});
document.querySelector('#toggle-original').addEventListener('click', event => {
  const button = event.currentTarget;
  const original = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(original));
  button.textContent = original ? 'Revenir au SVG retravaillé' : 'Voir le SVG actuel';
  document.querySelector('#original-hero').hidden = !original;
  document.querySelector('#open-vector').hidden = original;
  document.querySelector('#vector-stage-title').textContent = original ? 'SVG actuel' : (document.querySelector('#open-vector img').dataset.svgTitle || 'SVG retravaillé');
  document.querySelector('.vector-stage').classList.toggle('source-visible', original);
});
const vectorViews = { full: 'silhouette complète', face: 'gros plan du visage et du regard', materials: 'gros plan de la tenue', lantern: 'gros plan de la main et de la lanterne' };
document.querySelectorAll('[data-vector-view]').forEach(button => button.addEventListener('click', () => {
  const view = button.dataset.vectorView;
  const image = document.querySelector('#vector-detail-image');
  // Separate SVG image resources keep fragment viewports from affecting the card/portrait.
  const asset = document.querySelector('#open-vector img').dataset.svgAsset || 'ranger-vector.svg';
  image.src = `/assets/character-lab/${asset}?view=${view}${view === 'full' ? '' : `#${view}`}`;
  image.alt = `${document.querySelector('#open-vector img').dataset.svgDescription || 'Personnage SVG'} — ${vectorViews[view]}`;
  document.querySelectorAll('[data-vector-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
document.querySelector('#return-comparison').addEventListener('click', () => {
  showMode('compare');
  modelOpener.focus({ preventScroll: true });
});
retry.addEventListener('click', loadViewer);
document.querySelectorAll('[data-angle]').forEach(button => button.addEventListener('click', () => {
  activeViewer()?.setAngle(button.dataset.angle);
  document.querySelectorAll('[data-angle]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelector('#rotate-model').setAttribute('aria-pressed', 'false');
}));
document.querySelector('#rotate-model').addEventListener('click', event => {
  const button = event.currentTarget;
  const active = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(active));
  activeViewer()?.setRotation(active);
});
document.addEventListener('visibilitychange', syncViewers);
