const beforeRoot = new URL('../assets/characters-base/', import.meta.url);
const afterRoot = new URL('../assets/characters-refined/', import.meta.url);
let mode = 'image';
let angle = 'quarter';
let generation = 0;
let viewers = [];
let abort;
let runtime;
const gender = document.querySelector('#surface-gender');
const tone = document.querySelector('#surface-tone');
const status = document.querySelector('#surface-status');
const retry = document.querySelector('#surface-retry');
const stages = [document.querySelector('#before-viewer'), document.querySelector('#after-viewer')];
const posters = [document.querySelector('#before-poster'), document.querySelector('#after-poster')];
const viewNames = { quarter:'silhouette', face:'visage', outfit:'tenue', back:'dos' };

function dispose() {
  generation++;
  abort?.abort();
  viewers.forEach(viewer => viewer.dispose());
  viewers = [];
}

function labels() {
  const name = gender.value === 'boy' ? 'Noa' : 'Mila';
  stages.forEach((stage, index) => stage.setAttribute('aria-label', `${name}, ${index ? 'matières détaillées' : 'version intégrée'}, ${viewNames[angle]}`));
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === angle)));
}

async function update() {
  dispose();
  const id = generation;
  const stem = `${gender.value}-${tone.value}`;
  const name = gender.value === 'boy' ? 'Noa' : 'Mila';
  posters.forEach((poster, index) => {
    poster.src = new URL(stem+'.webp', index ? afterRoot : beforeRoot).href;
    poster.hidden = false;
    poster.alt = `${name}, ${index ? 'matières détaillées' : 'version intégrée'}`;
  });
  document.querySelector('#surface-download').href = new URL(stem+'.glb', afterRoot).href;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  retry.hidden = true;
  labels();
  if (mode === 'image') {
    status.textContent = 'La pose et les ancrages des équipements sont conservés.';
    return;
  }
  status.textContent = 'Chargement des deux versions 3D…';
  const controller = new AbortController();
  abort = controller;
  try {
    runtime ||= import(new URL('../assets/characters-base/runtime/viewer.js', import.meta.url).href);
    const { createBaseViewer } = await runtime;
    if (id !== generation) return;
    const results = await Promise.allSettled(stages.map((stage, index) => createBaseViewer(stage, {
      url: new URL(stem+'.glb', index ? afterRoot : beforeRoot).href,
      signal: controller.signal,
      onContextLost() {
        dispose();
        posters.forEach(poster => { poster.hidden = false; });
        status.textContent = 'La 3D a été interrompue. Réessayez le chargement.';
        retry.hidden = false;
      }
    })));
    const created = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    const failed = results.find(result => result.status === 'rejected');
    if (id !== generation || failed) {
      created.forEach(viewer => viewer.dispose());
      if (failed && id === generation) throw failed.reason;
      return;
    }
    viewers = created;
    viewers.forEach(viewer => viewer.setAngle(angle));
    posters.forEach(poster => { poster.hidden = true; });
    status.textContent = 'Caméras et lumière synchronisées · les matières font la différence.';
  } catch (error) {
    if (id !== generation) return;
    runtime = undefined;
    console.warn('Surface comparison:', error);
    status.textContent = 'La 3D n’a pas pu être chargée ; les rendus restent visibles.';
    retry.hidden = false;
  }
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode;
  if (mode === 'image') angle = 'quarter';
  update();
}));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  angle = button.dataset.view;
  labels();
  if (mode !== 'live') { mode = 'live'; update(); }
  else viewers.forEach(viewer => viewer.setAngle(angle));
}));
gender.addEventListener('change', update);
tone.addEventListener('change', update);
retry.addEventListener('click', update);
window.addEventListener('pagehide', dispose);
update();
