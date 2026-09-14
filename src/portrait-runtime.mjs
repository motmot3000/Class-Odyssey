/* One offscreen renderer, a bounded cache and a serial queue for visible cards.
   Baked portraits are immediate fallbacks; the exact equipped look replaces them. */
import { CATALOGUE_URL, CATALOGUE_REVISION } from './items-3d-model.mjs';

const cache = new Map();
const pending = new Map();
let queue = Promise.resolve();
let instance;
let observer;
let host;

async function getRenderer() {
  if (!instance) {
    host = document.createElement('div');
    host.className = 'portrait-render-host';
    host.setAttribute('aria-hidden', 'true');
    document.body.append(host);
    instance = import(new URL(`../assets/sheikah/viewer.js?v=${CATALOGUE_REVISION}`, import.meta.url).href).then(({ createHeroViewer }) => createHeroViewer(host, CATALOGUE_URL, {
      persona:'male',skin:'starter',hat:'no-hat',weapon:'no-weapon',hair:'short',hairColor:'brown-hair'
    }, { theme:'light' })).catch(error => { host.remove(); instance=null; throw error; });
  }
  return instance;
}

function requestPortrait(image) {
  let look;
  try { look = JSON.parse(image.dataset.look); } catch { return; }
  const key = CATALOGUE_REVISION + JSON.stringify(look);
  if (cache.has(key)) { image.src=cache.get(key); image.dataset.portraitReady='true'; return; }
  if (!pending.has(key)) {
    const targets = new Set([image]);
    const promise = queue.catch(() => {}).then(async () => {
      if (![...targets].some(target => target.isConnected)) return null;
      const renderer = await getRenderer();
      renderer.applyState(look);
      renderer.setAngle('quarter');
      renderer.setRotation(false);
      renderer.setVisible(true);
      renderer.resize();
      const url = renderer.snapshot();
      renderer.setVisible(false);
      if (url) {
        cache.set(key, url);
        while (cache.size > 64) cache.delete(cache.keys().next().value);
      }
      return url;
    });
    queue = promise;
    pending.set(key, { promise, targets });
    promise.finally(() => pending.delete(key)).catch(() => {});
  }
  const job = pending.get(key);
  job.targets.add(image);
  job.promise.then(url => {
    if (url && image.isConnected) { image.src=url; image.dataset.portraitReady='true'; }
  }).catch(() => { /* The baked, current-model portrait remains visible. */ });
}

export function mountHeroPortraits(root) {
  observer?.disconnect();
  const images = [...root.querySelectorAll('img[data-hero-portrait]')];
  if (!images.length) return;
  if (!('IntersectionObserver' in window)) { images.forEach(requestPortrait); return; }
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      requestPortrait(entry.target);
    }
  }, { rootMargin:'120px' });
  images.forEach(image => observer.observe(image));
}
