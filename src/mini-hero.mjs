let viewer;
let pending;
let live = false;
let contextLost = false;
let liveLabel = 'Modèle 3D du petit aventurier, vue de trois quarts';
const container = document.querySelector('#mini-viewer');
const fallback = container.querySelector('.viewer-fallback');
const status = document.querySelector('#mini-status');
const controls = document.querySelector('#view-controls');
const retry = document.querySelector('#mini-retry');
const primary = document.querySelector('#primary-open');

function sync() {
  document.querySelector('#mode-render').setAttribute('aria-pressed', String(!live));
  document.querySelector('#mode-live').setAttribute('aria-pressed', String(live));
  document.querySelector('#portrait-open').hidden = live;
  controls.hidden = !live || !viewer || contextLost;
  fallback.hidden = live && !!viewer && !contextLost;
  const canvas = container.querySelector('canvas');
  if (canvas) canvas.hidden = !live || contextLost;
  container.setAttribute('aria-label', live && viewer && !contextLost ? liveLabel : 'Portrait Blender du petit aventurier, vue de trois quarts');
  viewer?.setVisible(live && !contextLost && !document.hidden);
  document.querySelector('#mode-caption').textContent = live ? 'Volume 3D · éclairage de jour' : 'Portrait rendu dans Blender';
  document.querySelector('#mesh-count').textContent = live && viewer ? `${viewer.triangles.toLocaleString('fr-FR')} triangles` : 'Éclairage doux · fond transparent';
  primary.innerHTML = live ? 'Revenir au rendu Blender' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9ZM4 7.5l8 4.5 8-4.5M12 12v9"/></svg>Voir le personnage en 3D<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
  if (!live) status.hidden = retry.hidden = true;
  else if (contextLost) status.hidden = false;
}

async function openLive() {
  live = true;
  sync();
  if (viewer || pending) return;
  status.hidden = false;
  status.classList.remove('error');
  status.textContent = 'Chargement du personnage 3D…';
  retry.hidden = true;
  pending = (async () => {
    const { createViewer } = await import('./character-viewer.mjs');
    viewer = await createViewer(container, {
      modelURL: '/assets/mini-hero/sunlit-adventurer.glb', label: 'du petit aventurier', studio: 'daylight',
      onProgress: progress => { status.textContent = `Chargement du personnage 3D… ${progress} %`; },
      onError: message => { contextLost = true; status.textContent = message; status.hidden = false; status.classList.add('error'); sync(); }
    });
    liveLabel = container.getAttribute('aria-label');
    status.hidden = true;
    sync();
  })().catch(error => {
    console.error('Mini hero viewer:', error);
    status.textContent = 'La 3D n’a pas pu être chargée. Le rendu Blender reste disponible.';
    status.classList.add('error');
    status.hidden = !live;
    retry.hidden = !live;
    sync();
  }).finally(() => { pending = undefined; });
  return pending;
}

document.querySelector('#mode-live').addEventListener('click', openLive);
document.querySelector('#portrait-open').addEventListener('click', openLive);
document.querySelector('#mode-render').addEventListener('click', () => { live = false; sync(); });
primary.addEventListener('click', () => { if (live) { live = false; sync(); } else openLive(); });
retry.addEventListener('click', openLive);
document.querySelectorAll('[data-mini-angle]').forEach(button => button.addEventListener('click', () => {
  viewer?.setAngle(button.dataset.miniAngle);
  liveLabel = container.getAttribute('aria-label');
  document.querySelectorAll('[data-mini-angle]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelector('#mini-rotate').setAttribute('aria-pressed', 'false');
}));
document.querySelector('#mini-rotate').addEventListener('click', event => {
  const button = event.currentTarget;
  const active = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(active));
  viewer?.setRotation(active);
  liveLabel = active ? 'Modèle 3D du petit aventurier, rotation en cours' : 'Modèle 3D du petit aventurier, rotation arrêtée';
  container.setAttribute('aria-label', liveLabel);
});
document.addEventListener('visibilitychange', sync);
