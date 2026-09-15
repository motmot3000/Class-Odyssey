const root = '/assets/character-detail-study/';
const names = { girl: 'Mila', boy: 'Noa' };
const views = { quarter: 'visage de trois-quarts', front: 'visage de face', profile: 'profil en pied', back: 'dos en pied', full: 'silhouette' };
const status = document.querySelector('#study-status');
const dialog = document.querySelector('#portrait-dialog');
const versions = { athletic: 'Morphologies sportives', sporty: 'Corps précédents' };
let version = 'athletic';
let view = 'full';
let generation = 0;

async function update() {
  const current = ++generation;
  document.querySelectorAll('[data-version]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.version === version)));
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  status.textContent = 'Chargement des deux portraits…';
  const selected = { version, view };
  const results = await Promise.allSettled(Object.keys(names).map(async gender => {
    const image = new Image();
    image.src = `${root}${gender}-${selected.version}-${selected.view}.webp`;
    await image.decode();
    return { gender, image };
  }));
  if (current !== generation) return;
  if (results.some(result => result.status === 'rejected')) {
    status.textContent = 'Cette vue n’a pas pu être chargée. Choisissez à nouveau un point de vue pour réessayer.';
    return;
  }
  for (const { value: { gender, image } } of results) {
    const target = document.querySelector(`#${gender}-portrait`);
    target.src = image.src;
    target.alt = `${names[gender]}, expression ${versions[version].toLowerCase()}, ${views[view]}`;
    document.querySelector(`[data-model="${gender}"]`).href = `${root}${gender}-${version}.glb`;
  }
  status.textContent = `${versions[version]} · ${views[view]} · rendus des modèles 3D`;
}
document.querySelectorAll('[data-version]').forEach(button => button.addEventListener('click', () => { version = button.dataset.version; update(); }));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; update(); }));
document.querySelectorAll('[data-enlarge]').forEach(button => button.addEventListener('click', () => {
  const image = document.querySelector(`#${button.dataset.enlarge}-portrait`);
  document.querySelector('#zoom-title').textContent = image.alt;
  const zoom = document.querySelector('#zoom-image');
  zoom.src = image.src;
  zoom.alt = image.alt;
  dialog.showModal();
}));
document.querySelector('#close-zoom').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
update();
