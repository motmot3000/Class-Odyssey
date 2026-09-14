import { CATALOGUE_URL, CATALOGUE_REVISION, PORTRAIT_REVISION, DEFAULT_LOOK } from "./items-3d-model.mjs";
import { createSharedResource } from "./shared-resource.mjs";

const MAX_CACHED_PORTRAITS = 64;
const PRELOAD_MARGIN = "120px";
const cache = new Map();
const pending = new Map();
let queue = Promise.resolve();
let observer;

const portraitKey = look => PORTRAIT_REVISION + JSON.stringify(look);

/** Use a cached image during HTML rendering, before IntersectionObserver fires.
 * This avoids flashing an unequipped fallback when returning to the pupil list.
 */
export function cachedHeroPortrait(look) {
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
    const { createHeroViewer } = await import(new URL(`../assets/sheikah/viewer.js?v=${CATALOGUE_REVISION}`, import.meta.url).href);
    const renderer = await createHeroViewer(host, CATALOGUE_URL, DEFAULT_LOOK, {
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
