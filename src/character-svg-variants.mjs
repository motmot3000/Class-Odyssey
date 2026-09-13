import { renderHero } from './avatar.mjs';

const gender = document.querySelector('#svg-gender');
const outfit = document.querySelector('#svg-outfit');
const portrait = document.querySelector('#open-vector img');
const card = document.querySelector('#card-open-vector');
const detail = document.querySelector('#vector-detail-image');

function updateVariant() {
  const female = gender.value === 'female';
  const basic = outfit.value === 'base';
  const filename = basic ? `character-base-${gender.value}.svg` : female ? 'ranger-feminine.svg' : 'ranger-vector.svg';
  const title = basic ? 'Base neutre' : female ? 'Rôdeuse' : 'Rôdeur';
  const person = female ? 'Personnage féminin' : 'Personnage masculin';
  const fullTitle = `${person} 2.0 — ${basic ? 'tenue de base' : 'tenue de rôdeur'}`;
  const url = `/assets/character-lab/${filename}`;

  portrait.dataset.svgAsset = filename;
  portrait.dataset.svgTitle = title;
  portrait.dataset.svgDescription = fullTitle;
  portrait.src = url;
  portrait.alt = fullTitle;
  card.querySelector('img').src = url;
  card.querySelector('img').alt = fullTitle;
  card.querySelector('.pupil-version').firstChild.textContent = `${title} `;
  card.querySelector('.pupil-identity > span').textContent = basic ? 'Niveau 5 · Base' : 'Niveau 5 · Rôdeur';
  card.setAttribute('aria-label', `Alex, ${title}, version ${female ? 'féminine' : 'masculine'}, examiner le dessin`);
  document.querySelector('#vector-stage-title').textContent = title;
  document.querySelector('#vector-title').textContent = basic ? 'Personnage de base.' : `${title}, en SVG.`;
  document.querySelector('#vector-title + p').textContent = basic ? 'Une silhouette simple, prête à personnaliser.' : 'La même identité, en tenue d’aventure.';
  document.querySelector('#svg-download').href = url;
  document.querySelector('#vector-stage .viewport-top > span').textContent = `${title} · ${female ? 'féminin' : 'masculin'}`;
  document.querySelector('#vector-stage .model-details').innerHTML = `<div><dt>Version</dt><dd>${person} · vue de face</dd></div><div><dt>Tenue</dt><dd>${basic ? 'Haut simple, pantalon et chaussures' : 'Cape, tunique et bottes de voyage'}</dd></div><div><dt>Visage</dt><dd>Regard naturel, traits affinés</dd></div>`;
  document.querySelector('#vector-stage .model-explanation').textContent = basic ? 'Le visage, la coiffure et les vêtements simples sont des tracés vectoriels éditables. Cette base sert de point de départ au personnage 2.0.' : 'La tenue de rôdeur complète le personnage avec une capuche, une cape, une sacoche et une lanterne. Tous les tracés restent éditables.';

  const lamp = document.querySelector('[data-vector-view="lantern"]');
  lamp.hidden = basic;
  lamp.disabled = basic;
  document.querySelector('[data-vector-view="materials"]').textContent = basic ? 'Tenue' : 'Coutures';
  let view = document.querySelector('[data-vector-view][aria-pressed="true"]')?.dataset.vectorView || 'full';
  if (basic && view === 'lantern') view = 'full';
  detail.src = `${url}?view=${view}${view === 'full' ? '' : `#${view}`}`;
  detail.alt = `${fullTitle} — ${view === 'full' ? 'silhouette complète' : 'gros plan'}`;
  document.querySelectorAll('[data-vector-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.vectorView === view)));

  const original = { id: 'svg-variant-source', name: 'Alex', gender: female ? 'girl' : 'boy', skinTone: 'medium', hair: female ? 'long' : 'short', skin: basic ? 'starter' : 'vocab-ranger', hat: basic ? '' : 'shadow-hood', weapon: basic ? '' : 'lore-lantern', face: 'cool' };
  document.querySelector('#original-hero').innerHTML = renderHero(original);
  document.querySelector('#card-original').innerHTML = renderHero(original);
  document.querySelector('#card-original').closest('.pupil-card').querySelector('.pupil-identity > span').textContent = basic ? 'Niveau 5 · Base' : 'Niveau 5 · Rôdeur';
  document.querySelector('#original-hero').hidden = true;
  document.querySelector('#open-vector').hidden = false;
  document.querySelector('.vector-stage').classList.remove('source-visible');
  const toggle = document.querySelector('#toggle-original');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.textContent = 'Voir le SVG actuel';
}

gender.addEventListener('change', updateVariant);
outfit.addEventListener('change', updateVariant);
if (document.readyState === 'complete') updateVariant();
else window.addEventListener('load', updateVariant, { once: true });
