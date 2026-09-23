import { BASE_CATALOGUE_URL, BASE_CATALOGUE_REVISION, PORTRAIT_REVISION, DEFAULT_LOOK } from "./items-3d-model.mjs";
import { createSharedResource } from "./shared-resource.mjs";

const MAX_CACHED_PORTRAITS = 64;
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
const KEY_PREFIX = `${BASE_CATALOGUE_REVISION}/${PORTRAIT_REVISION}`;
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

const resource = createSharedResource(async () => {
  const host = document.createElement("div");
  host.className = "portrait-render-host";
  host.setAttribute("aria-hidden", "true");
  document.body.append(host);
  try {
    let ownedResource;
    const { createHeroViewer } = await import(new URL(`../assets/odyssey/viewer.js?v=${BASE_CATALOGUE_REVISION}`, import.meta.url).href);
    const renderer = await createHeroViewer(host, BASE_CATALOGUE_URL, DEFAULT_LOOK, {
      theme: "light",
      onError: () => { if (ownedResource && resource.peek() === ownedResource) resource.reset(); }
    });
    ownedResource = {
      ...renderer,
      destroy() {
        renderer.destroy();
        host.remove();
      }
    };
    return ownedResource;
  } catch (error) {
    host.remove();
    throw error;
  }
});

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

function requestPortrait(image) {
  let look;
  try { look = JSON.parse(image.dataset.look); } catch { return; }
  const key = portraitKey(look);
  const cached = cachedHeroPortrait(look);
  if (cached) return showPortrait(image, cached);

  if (!pending.has(key)) {
    const targets = new Set([image]);
    // Different looks share one WebGL context. Equal looks share one job;
    // queued jobs are skipped when every interested DOM image has disappeared.
    const promise = queue.catch(() => {}).then(async () => {
      if (![...targets].some(target => target.isConnected)) return null;
      const renderer = await resource.get();
      if (!renderer) return null;
      try {
        renderer.applyState(look);
        renderer.setAngle("front");
        renderer.setRotation(false);
        renderer.setVisible(true);
        renderer.resize();
        const url = renderer.snapshot();
        if (url) rememberPortrait(key, url);
        else resource.reset();
        return url;
      } finally {
        renderer.setVisible(false);
      }
    });
    queue = promise;
    pending.set(key, { promise, targets });
    promise.finally(() => pending.delete(key)).catch(() => {});
  }
  const job = pending.get(key);
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
