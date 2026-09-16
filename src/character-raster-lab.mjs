const ASSETS = '/assets/character-lab/raster/';
const $ = selector => document.querySelector(selector);
const canvas = $('#character-canvas');
const context = canvas.getContext('2d');
const card = $('#card-canvas');
const cardContext = card.getContext('2d');
const status = $('#render-status');
const errorBox = $('#error-message');
const workbench = $('#workbench');
const cache = new Map();
const tunicNames = { foret: 'Forêt', ardoise: 'Ardoise', grenat: 'Grenat', sable: 'Sable' };
const state = { style: 'peint', tunic: 'foret', equipment: {}, custom: null };
let manifest;
let revision = 0;
let ready = false;
let importing = 0;

function reportError(message) { errorBox.textContent = message; errorBox.hidden = !message; }
function loadImage(url) {
  if (!cache.has(url)) {
    const image = new Image();
    image.src = url;
    cache.set(url, image.decode().then(() => image).catch(error => { cache.delete(url); throw error; }));
  }
  return cache.get(url);
}
function setBusy(busy) {
  workbench.setAttribute('aria-busy', String(busy));
  $('#export-png').disabled = busy || !ready;
  $('#export-settings').disabled = busy || !ready;
  $('#base-file').disabled = busy || !manifest;
  $('#equipment-file').disabled = busy || !manifest;
}
function drawEquipment(ctx, piece) {
  const width = piece.initialWidth * piece.scale / 100;
  const height = piece.initialHeight * piece.scale / 100;
  ctx.drawImage(piece.image, piece.x * canvas.width / 100 - width / 2, piece.y * canvas.height / 100 - height / 2, width, height);
}
async function render() {
  if (!manifest) return;
  const current = ++revision;
  const style = state.style;
  const tunic = state.tunic;
  setBusy(true);
  status.textContent = 'Préparation de la tenue…';
  try {
    const styleConfig = manifest.styles[style];
    const [base, overlay] = await Promise.all([
      style === 'custom' ? state.custom.image : loadImage(ASSETS + styleConfig.base),
      style !== 'custom' && styleConfig.tunics[tunic] ? loadImage(ASSETS + styleConfig.tunics[tunic]) : null,
    ]);
    if (current !== revision) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const pieces = Object.values(state.equipment);
    for (const piece of pieces.filter(piece => piece.behind)) drawEquipment(context, piece);
    if (style === 'custom') context.drawImage(base, ...state.custom.rect);
    else context.drawImage(base, 0, 0);
    if (overlay) context.drawImage(overlay, 0, 0);
    for (const piece of pieces.filter(piece => !piece.behind)) drawEquipment(context, piece);
    cardContext.clearRect(0, 0, card.width, card.height);
    cardContext.drawImage(canvas, 0, 0, card.width, card.height);
    document.querySelectorAll('.raster-fallback').forEach(image => { image.hidden = true; });
    canvas.hidden = false;
    card.hidden = false;
    const caption = style === 'custom' ? 'Personnage importé · Tenue incluse' : `Rendu ${styleConfig.label.toLowerCase()} · Tunique ${tunicNames[tunic]}`;
    $('#outfit-caption').textContent = caption;
    canvas.setAttribute('aria-label', `${caption}${pieces.length ? `, ${pieces.length} équipement${pieces.length > 1 ? 's' : ''}` : ''}`);
    card.setAttribute('aria-label', `Carte de démonstration : ${canvas.getAttribute('aria-label')}`);
    const count = 1 + Number(Boolean(overlay)) + pieces.length;
    $('#layer-count').textContent = `${count} calque${count > 1 ? 's' : ''}`;
    status.textContent = `${caption}. ${count} calque${count > 1 ? 's' : ''} assemblé${count > 1 ? 's' : ''} sur fond transparent.`;
    ready = true;
    setBusy(importing > 0);
  } catch (error) {
    if (current !== revision) return;
    ready = false;
    setBusy(false);
    status.textContent = 'La tenue sélectionnée n’a pas pu être chargée.';
    reportError('Une image manque ou n’est pas accessible. Réessaie en sélectionnant une tenue, ou recharge la page.');
    console.error('Raster character:', error);
  }
}

document.querySelectorAll('input[name="style"]').forEach(input => input.addEventListener('change', () => {
  if (!input.checked) return;
  state.style = input.value;
  $('#tunic-picker').disabled = input.value === 'custom';
  $('#tunic-note').textContent = input.value === 'custom'
    ? 'La tenue est incluse dans ta base. Les tuniques du rôdeur ne s’appliquent pas à un autre personnage.'
    : 'La couleur change. Les plis, les ombres et le visage restent en place.';
  reportError('');
  render();
}));
document.querySelectorAll('input[name="tunic"]').forEach(input => input.addEventListener('change', () => {
  if (!input.checked) return;
  state.tunic = input.value;
  reportError('');
  render();
}));
for (const attribute of ['view', 'background']) {
  document.querySelectorAll(`button[data-${attribute}]`).forEach(button => button.addEventListener('click', () => {
    $('#character-stage').dataset[attribute] = button.dataset[attribute];
    document.querySelectorAll(`button[data-${attribute}]`).forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
}

function selectedSlot() { return $('#equipment-slot').value; }
function syncEquipment() {
  const slot = selectedSlot();
  const piece = state.equipment[slot];
  $('#equipment-empty').hidden = Boolean(piece);
  $('#equipment-adjustments').hidden = !piece;
  const names = { cape: 'Aucune cape équipée.', headwear: 'Aucune coiffe équipée.', accessory: 'Aucun accessoire équipé.' };
  $('#equipment-empty').textContent = `${names[slot]} Importe une pièce détourée pour voir la superposition.`;
  if (!piece) return;
  $('#equipment-name').textContent = piece.name;
  $('#equipment-behind').checked = piece.behind;
  for (const key of ['x', 'y', 'scale']) {
    $(`#equipment-${key}`).value = piece[key];
    $(`#${key}-value`).value = `${Number(piece[key]).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
  }
}
$('#equipment-slot').addEventListener('change', syncEquipment);
for (const key of ['x', 'y', 'scale']) {
  $(`#equipment-${key}`).addEventListener('input', event => {
    const piece = state.equipment[selectedSlot()];
    if (!piece) return;
    piece[key] = Number(event.target.value);
    syncEquipment();
    render();
  });
}
$('#equipment-behind').addEventListener('change', event => {
  const piece = state.equipment[selectedSlot()];
  if (piece) { piece.behind = event.target.checked; render(); }
});
$('#remove-equipment').addEventListener('click', () => {
  delete state.equipment[selectedSlot()];
  syncEquipment();
  render();
  $('#equipment-file').focus();
});
$('#reset-equipment').addEventListener('click', () => {
  const piece = state.equipment[selectedSlot()];
  if (!piece) return;
  Object.assign(piece, piece.defaults);
  syncEquipment();
  render();
});

async function readTransparentImage(file) {
  if (!['image/png', 'image/webp'].includes(file.type)) throw new Error('Choisis une image PNG ou WebP avec un fond transparent.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Cette image dépasse 12 Mo. Réduis sa taille avant de l’importer.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.width > 4096 || image.height > 4096) throw new Error('Cette image dépasse 4 096 pixels par côté. Redimensionne-la avant de l’importer.');
    const probe = document.createElement('canvas');
    probe.width = image.width;
    probe.height = image.height;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
    let clear = 0;
    let visible = 0;
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] < 32) clear++; if (pixels[i] > 32) visible++; }
    if (clear < image.width * image.height * 0.01) throw new Error('Cette image n’a pas de fond réellement transparent. Un damier peint dans le PNG ne suffit pas : exporte une image avec canal alpha.');
    if (visible === 0) throw new Error('Cette image est entièrement transparente. Choisis un PNG contenant un personnage ou une pièce visible.');
    return { image, dataURL: probe.toDataURL('image/png'), name: file.name };
  } finally { URL.revokeObjectURL(url); }
}
async function importFile(event, kind) {
  const input = event.target;
  const file = input.files?.[0];
  const slot = selectedSlot();
  if (!file || !manifest) return;
  importing++;
  setBusy(true);
  reportError('');
  try {
    const asset = await readTransparentImage(file);
    if (kind === 'base') {
      const sameFrame = asset.image.width === canvas.width && asset.image.height === canvas.height;
      const factor = Math.min(824 / asset.image.width, 1448 / asset.image.height);
      const width = asset.image.width * factor;
      const height = asset.image.height * factor;
      state.custom = { ...asset, rect: sameFrame ? [0, 0, canvas.width, canvas.height] : [512 - width / 2, 1484 - height, width, height] };
      $('#custom-choice').hidden = false;
      $('#custom-name').textContent = file.name;
      const radio = $('#custom-choice input');
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    } else {
      const config = manifest.equipmentSlots[slot];
      const aligned = asset.image.width === canvas.width && asset.image.height === canvas.height;
      const factor = aligned ? 1 : Math.min(config.fit[0] / asset.image.width, config.fit[1] / asset.image.height);
      const defaults = { x: aligned ? 50 : config.center[0] / canvas.width * 100, y: aligned ? 50 : config.center[1] / canvas.height * 100, scale: 100, behind: config.behind };
      state.equipment[slot] = { ...asset, ...defaults, defaults, initialWidth: asset.image.width * factor, initialHeight: asset.image.height * factor };
      $('#equipment-slot').value = slot;
      syncEquipment();
    }
  } catch (error) { reportError(error.message || 'L’image n’a pas pu être décodée. Essaie un autre PNG.'); }
  finally { importing--; input.value = ''; await render(); }
}
$('#base-file').addEventListener('change', event => importFile(event, 'base'));
$('#equipment-file').addEventListener('change', event => importFile(event, 'equipment'));

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$('#export-png').addEventListener('click', async () => {
  if (!ready || workbench.getAttribute('aria-busy') === 'true') return;
  const filename = `class-odyssey-${state.style}-${state.style === 'custom' ? 'personnage' : state.tunic}.png`;
  canvas.toBlob(blob => {
    if (!blob) { reportError('Le PNG n’a pas pu être créé. Réessaie l’export.'); return; }
    download(blob, filename);
    status.textContent = 'PNG transparent exporté en 1 024 × 1 536 pixels.';
  }, 'image/png');
});
$('#export-settings').addEventListener('click', () => {
  if (!ready || workbench.getAttribute('aria-busy') === 'true') return;
  const base = state.style === 'custom'
    ? { image: state.custom.dataURL, rect: state.custom.rect, name: state.custom.name }
    : { image: ASSETS + manifest.styles[state.style].base, rect: [0, 0, canvas.width, canvas.height] };
  const equipment = Object.entries(state.equipment).map(([slot, piece]) => {
    const { name, x, y, scale, behind, initialWidth, initialHeight, dataURL } = piece;
    return { slot, name, image: dataURL, x, y, scale, behind, initialWidth, initialHeight };
  });
  const tunic = state.style === 'custom' ? null : manifest.styles[state.style].tunics[state.tunic];
  const configuration = { version: 1, canvas: manifest.canvas, anchor: manifest.anchor, base, tunic: tunic ? ASSETS + tunic : null, equipment, coordinates: 'Equipment x/y are center percentages of the canvas; dimensions = initialWidth/Height × scale/100. Draw behind equipment, base, tunic, then front equipment in listed order.' };
  download(new Blob([JSON.stringify(configuration, null, 2)], { type: 'application/json' }), 'class-odyssey-personnage.json');
  status.textContent = 'Réglages exportés avec les images importées et leurs positions.';
});

try {
  const response = await fetch(ASSETS + 'manifest.json');
  if (!response.ok) throw new Error(`Manifest: ${response.status}`);
  manifest = await response.json();
  await render();
} catch (error) {
  setBusy(false);
  reportError('Le kit de calques n’a pas pu être chargé. Vérifie que cette page est ouverte depuis le serveur de l’atelier, puis recharge-la.');
  status.textContent = 'L’aperçu fixe reste disponible.';
  console.error('Raster manifest:', error);
}
