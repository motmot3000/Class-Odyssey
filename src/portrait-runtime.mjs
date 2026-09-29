import { VIEWER_REVISION, PORTRAIT_REVISION } from "./items-3d-model.mjs";
import { portraitSnapshot } from "./odyssey-runtime.mjs";

const MAX_CACHED_PORTRAITS = 160;
const PRELOAD_MARGIN = "120px";
const STORAGE_KEY = "classquest.portrait-cache.v1";
const MAX_PERSISTED_PORTRAITS = 48;
const cache = new Map();
const pending = new Map();
let queue = Promise.resolve();
let observer;
let hydrated = false;
let persistTimer = 0;

// Bake-proof the cache key on the live base so a base change never reuses old images.
// The framing revision retires portraits cropped to their silhouette.
const FRAMING_REVISION = "fixed-frame-v1";
const KEY_PREFIX = `${VIEWER_REVISION}/${PORTRAIT_REVISION}/${FRAMING_REVISION}`;
const portraitKey = look => KEY_PREFIX + JSON.stringify(look);

/* Keep the last portraits across reloads so the equipped look is on screen
 * immediately instead of flashing the baked unequipped fallback. */
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (typeof localStorage === "undefined") return;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return;
    for (const entry of stored) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || typeof entry[1] !== "string") continue;
      if (!entry[0].startsWith(KEY_PREFIX) || cache.has(entry[0])) continue;
      cache.set(entry[0], entry[1]);
    }
  } catch { /* Private mode or corrupt entry: fall back to the baked portraits. */ }
}

function persist() {
  persistTimer = 0;
  if (typeof localStorage === "undefined") return;
  const entries = [...cache].slice(-MAX_PERSISTED_PORTRAITS);
  for (let limit = entries.length; limit > 0; limit -= 8) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-limit)));
      return;
    } catch { /* Quota: try fewer entries, then give up on persistence. */ }
  }
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Nothing else to do. */ }
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(persist, 600);
}

/** Use a cached image during HTML rendering, before IntersectionObserver fires.
 * This avoids flashing an unequipped fallback when returning to the pupil list.
 */
export function cachedHeroPortrait(look) {
  hydrate();
  const key = portraitKey(look);
  const url = cache.get(key);
  if (url) {
    cache.delete(key);
    cache.set(key, url);
  }
  return url;
}

function rememberPortrait(key, url) {
  cache.set(key, url);
  while (cache.size > MAX_CACHED_PORTRAITS) cache.delete(cache.keys().next().value);
  schedulePersist();
}

function showPortrait(image, url) {
  if (!url || !image.isConnected) return;
  image.src = url;
  image.dataset.portraitReady = "true";
}

/* Keys rendered by the live 3D renderer during this session. Persisted entries
 * may come from an older asset build, so class preloading never trusts them. */
const fresh = new Set();

function scheduleRender(look, { force = false } = {}) {
  const key = portraitKey(look);
  if (!pending.has(key)) {
    const targets = new Set();
    // Snapshots share the app's single 3D engine, one at a time. Equal looks
    // share one job; queued jobs are skipped when every interested DOM image
    // has disappeared (preload jobs are forced: nothing is on screen yet).
    const promise = queue.catch(() => {}).then(async () => {
      if (!force && ![...targets].some(target => target.isConnected)) return null;
      const url = await portraitSnapshot(look);
      if (url) {
        rememberPortrait(key, url);
        fresh.add(key);
      }
      return url;
    });
    queue = promise;
    pending.set(key, { promise, targets, force });
    promise.finally(() => pending.delete(key)).catch(() => {});
  }
  return pending.get(key);
}

/** True when every look already has a portrait rendered during this session. */
export function heroPortraitsReady(looks) {
  return looks.every(look => fresh.has(portraitKey(look)));
}

/** Render every look with the shared 3D engine (load it first with
 * ensureHeroViewer). Resolves even on failure: the baked fallbacks remain. */
export async function preloadHeroPortraits(looks, onProgress = () => {}) {
  hydrate();
  // Progress counts every requested look (one per pupil), even when pupils share one.
  const keys = looks.map(portraitKey);
  const settled = new Set(keys.filter(key => fresh.has(key)));
  const report = () => onProgress(keys.filter(key => settled.has(key)).length, keys.length);
  const todo = [...new Map(looks.map(look => [portraitKey(look), look])).values()]
    .filter(look => !settled.has(portraitKey(look)));
  report();
  for (const look of todo) {
    try { await scheduleRender(look, { force: true }).promise; } catch { /* Keep going. */ }
    settled.add(portraitKey(look));
    report();
  }
}

function requestPortrait(image) {
  let look;
  try { look = JSON.parse(image.dataset.look); } catch { return; }
  const cached = cachedHeroPortrait(look);
  if (cached) {
    showPortrait(image, cached);
    // A persisted image may predate the current assets: refresh it once.
    if (fresh.has(portraitKey(look))) return;
  }
  const job = scheduleRender(look);
  job.targets.add(image);
  job.promise.then(url => showPortrait(image, url)).catch(() => {
    // Keep the baked current-model portrait if WebGL or loading is unavailable.
  });
}

export function mountHeroPortraits(root) {
  observer?.disconnect();
  const images = [...root.querySelectorAll("img[data-hero-portrait]")];
  if (!images.length) return;
  if (!("IntersectionObserver" in window)) {
    images.forEach(requestPortrait);
    return;
  }
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      requestPortrait(entry.target);
    }
  }, { rootMargin: PRELOAD_MARGIN });
  images.forEach(image => observer.observe(image));
}
