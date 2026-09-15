import { getShopItems, getShopItem } from './domain.mjs';
import { renderHero } from './avatar.mjs';
import { CATEGORIES, DEFAULT_LOOK, HAIR_PALETTE, PRESETS, lookFromParams, lookSummary, modeledItemIds } from './items-3d-model.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let look = lookFromParams(new URLSearchParams(location.search));
const reviewModel = new URLSearchParams(location.search).get('model');
let category = 'outfit';
let viewer;
let pending = false;
let controlsReady = false;
let rotating = false;
let compare = false;
let inView = true;
let angle = 'quarter';
const viewNames = { front: 'de face', quarter: 'de trois quarts', back: 'de dos', head: 'détail de la tête', item: 'détail de l’objet', free: 'libre' };
const names = { male: 'Noa', female: 'Mila' };

$('#collection-count').textContent = `${modeledItemIds().length} modèles`;
$('#categories').innerHTML = CATEGORIES.map(({ type, label }) => `<button type="button" data-category="${type}" aria-pressed="${type === category}">${label}</button>`).join('');

function setReady(ready) {
  controlsReady = ready;
  $$('[data-persona], [data-preset], [data-angle], [data-category], #choices button, #rotate, #export, #export-kind, #reset, #compare').forEach(button => { button.disabled = !ready; });
}

function renderChoices() {
  const field = CATEGORIES.find(entry => entry.type === category).field;
  $('#choices').innerHTML = getShopItems(category).map(item => `
    <button class="choice" data-item="${item.id}" type="button" aria-pressed="${look[field] === item.id}" ${controlsReady ? '' : 'disabled'}>
      ${category === 'hairColor' ? `<span class="swatch" style="--hair-color:${HAIR_PALETTE[item.id]}" aria-hidden="true"></span>` : '<span class="selection-dot" aria-hidden="true"></span>'}
      <span><strong>${item.name}</strong><small>Niveau ${item.minLevel}${look[field] === item.id ? ' · Équipé' : ''}</small></span>
      <span class="price">${item.price ? `${item.price} pièces` : 'Gratuit'}</span>
    </button>`).join('');
}

function sync() {
  const name = names[look.persona];
  const referenceFile = `${look.persona === 'female' ? 'girl' : 'boy'}-medium.glb`;
  $('#reference-link').href = `/assets/items-3d/sources/${referenceFile}`;
  $('#reference-link').download = referenceFile;
  $('#reference-link').setAttribute('aria-label', `Télécharger la base de référence de ${name} (.glb)`);
  $('#character-name').textContent = name;
  $('#loadout').textContent = lookSummary(look);
  $('#viewer').setAttribute('aria-label', `${name} — ${lookSummary(look)}, vue ${rotating ? 'en rotation' : viewNames[angle]}`);
  $$('[data-persona]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.persona === look.persona)));
  $$('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(Object.entries(PRESETS[button.dataset.preset]).every(([field, id]) => look[field] === id))));
  $('#equipped-list').innerHTML = CATEGORIES.map(({ label, field }) => `<div><dt>${label}</dt><dd>${getShopItem(look[field]).name}</dd></div>`).join('');
  $('#svg-reference').innerHTML = renderHero({ id: '3d-reference', name, ...look, gender: look.persona === 'female' ? 'girl' : 'boy', skinTone: 'light', face: 'smile' });
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(look)) url.searchParams.set(key, value);
  history.replaceState(null, '', url);
  if (viewer) {
    const { pieces, triangles } = viewer.applyLook(look);
    $('#geometry-info').textContent = `${pieces} pièces · ${new Intl.NumberFormat('fr').format(triangles)} triangles`;
  }
  renderChoices();
}

function syncView() {
  $$('[data-angle]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.angle === angle)));
  $('#rotate').setAttribute('aria-pressed', String(rotating));
  $('#compare').setAttribute('aria-pressed', String(compare));
  $('#compare').textContent = compare ? 'Revenir au personnage 3D' : 'Voir la référence 2D';
  $('#viewer').hidden = compare;
  $('#svg-reference').hidden = !compare;
  $('#render-mode').textContent = compare ? 'Référence SVG du jeu' : viewer ? '3D en temps réel' : 'Aperçu Blender';
  viewer?.setActive(inView && !document.hidden && !compare);
  $('#viewer').setAttribute('aria-label', `${names[look.persona]} — ${lookSummary(look)}, vue ${rotating ? 'en rotation' : viewNames[angle]}`);
}

async function load() {
  if (pending || viewer) return;
  pending = true; setReady(false); $('#retry').hidden = true; $('#loading-status').hidden = false;
  $('#loading-status').textContent = 'Préparation du personnage et des équipements…';
  try {
    const { createItemsViewer } = await import('./items-3d-viewer.mjs');
    viewer = await createItemsViewer($('#viewer'), look, {
      modelURL: reviewModel || undefined,
      onProgress: value => { $('#loading-status').textContent = `Chargement des modèles… ${value} %`; },
      onError: text => { setReady(false); $('#loading-status').textContent = text; $('#loading-status').hidden = false; $('#poster').hidden = false; $('#viewer canvas').hidden = true; $('#render-mode').textContent = 'Aperçu Blender'; },
      onFreeView: () => { angle = 'free'; rotating = false; syncView(); }
    });
    $('#poster').hidden = true; $('#loading-status').hidden = true; setReady(true); sync(); syncView();
  } catch (error) {
    console.error('Equipment viewer:', error);
    $('#loading-status').textContent = 'La 3D n’a pas pu être chargée. L’aperçu Blender reste disponible.';
    $('#retry').hidden = false; $('#render-mode').textContent = 'Aperçu Blender';
  } finally { pending = false; }
}

$('#categories').addEventListener('click', event => {
  const button = event.target.closest('[data-category]'); if (!button) return;
  category = button.dataset.category;
  $$('[data-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  renderChoices();
});
$('#choices').addEventListener('click', event => {
  const button = event.target.closest('[data-item]'); if (!button || !viewer) return;
  const item = getShopItem(button.dataset.item);
  look[CATEGORIES.find(entry => entry.type === item.type).field] = item.id;
  $('#action-status').textContent = ''; sync();
  $(`[data-item="${item.id}"]`).focus({ preventScroll: true });
});
$$('[data-persona]').forEach(button => button.addEventListener('click', () => {
  look.persona = button.dataset.persona;
  if (['short', 'long'].includes(look.hair)) look.hair = look.persona === 'female' ? 'long' : 'short';
  sync();
}));
$$('[data-preset]').forEach(button => button.addEventListener('click', () => { look = { ...look, ...PRESETS[button.dataset.preset] }; compare = false; sync(); syncView(); }));
$$('[data-angle]').forEach(button => button.addEventListener('click', () => { angle = button.dataset.angle; rotating = false; compare = false; viewer.setAngle(angle); syncView(); }));
$('#rotate').addEventListener('click', () => { rotating = !rotating; if (rotating) angle = 'free'; compare = false; viewer.setRotation(rotating); syncView(); });
$('#compare').addEventListener('click', () => { compare = !compare; syncView(); });
$('#reset').addEventListener('click', () => { look = { ...DEFAULT_LOOK }; angle = 'quarter'; rotating = false; compare = false; viewer.setAngle(angle); $('#action-status').textContent = ''; sync(); syncView(); });
$('#retry').addEventListener('click', load);
$('#export').addEventListener('click', async () => {
  setReady(false);
  $('#action-status').textContent = 'Préparation du fichier 3D…';
  const onlyItems = $('#export-kind').value === 'items';
  try {
    const data = await viewer.exportLook(onlyItems);
    const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `classquest-${onlyItems ? 'items' : names[look.persona].toLowerCase()}-${look.skin}-${look.weapon}.glb`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    $('#action-status').textContent = 'La combinaison affichée a été exportée.';
  } catch (error) { console.error('Equipment export:', error); $('#action-status').textContent = 'L’export a échoué. Réessayez.'; }
  finally { setReady(true); }
});
document.addEventListener('visibilitychange', () => viewer?.setActive(inView && !document.hidden && !compare));
new IntersectionObserver(entries => { inView = entries[0].isIntersecting; viewer?.setActive(inView && !document.hidden && !compare); }).observe($('.stage'));
sync(); load();
