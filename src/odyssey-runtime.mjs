/* One 3D engine for the whole app: hero sheet, workshop, shop AND the hero
 * card portraits. The Blender catalogue (~190 MB) is downloaded and uploaded
 * to the GPU once; portraits are snapshots of the same canvas, and the sheet
 * moves that canvas into its dais. Between sheets the canvas waits in a
 * stable, sized, invisible host so snapshots always have a real size.
 * Host identity protects navigation; resource generations protect retries.
 */

import { t } from "./i18n.mjs";
import { BASE_CATALOGUE_URL, DEFAULT_LOOK, VIEWER_REVISION } from "./items-3d-model.mjs";
import { createSharedResource } from "./shared-resource.mjs";

const GLB_URL = BASE_CATALOGUE_URL;
let runtime;
let currentHost = null;
let engineHost = null;
let viewerAngle = "quarter";
let viewerRotating = false;
let currentTheme = "light";
let onFreeView = () => {};
let onEngineProgress = null;

function loadRuntime() {
  if (!runtime) {
    runtime = import(new URL(`../assets/odyssey/viewer.js?v=${VIEWER_REVISION}`, import.meta.url).href)
      .catch((error) => { runtime = undefined; throw error; });
  }
  return runtime;
}

function ensureEngineHost() {
  if (engineHost?.isConnected) return engineHost;
  engineHost = document.createElement("div");
  engineHost.className = "odyssey-engine-host";
  engineHost.setAttribute("aria-hidden", "true");
  document.body.append(engineHost);
  return engineHost;
}

function parkEngine(instance) {
  const host = ensureEngineHost();
  if (instance.element.parentElement !== host) host.append(instance.element);
}

function updateProgress(percent) {
  onEngineProgress?.(percent);
  const bar = currentHost?.querySelector("[data-load-bar]");
  if (bar) bar.style.setProperty("--p", `${percent}%`);
}

function fail(error, host) {
  if (!host || currentHost !== host || !host.isConnected) return;
  console.warn("Odyssey viewer:", error);
  host.classList.remove("is-loading");
  const loader = host.querySelector("[data-load-bar]");
  if (loader) loader.hidden = true;
  const recovery = host.querySelector(".viewer-recovery");
  if (recovery) {
    recovery.hidden = false;
    recovery.querySelector(".viewer-error").textContent = t("view.equipmentUnavailable");
  }
  const fallback = host.querySelector(".viewer-fallback");
  if (fallback) fallback.hidden = false;
}

const resource = createSharedResource(async () => {
  const { createHeroViewer } = await loadRuntime();
  let instance;
  instance = await createHeroViewer(ensureEngineHost(), GLB_URL, DEFAULT_LOOK, {
    theme: currentTheme,
    onProgress: updateProgress,
    onError: message => {
      if (resource.peek() !== instance) return;
      resource.reset();
      fail(new Error(message), currentHost);
    },
    onFreeView: () => {
      viewerAngle = "free";
      viewerRotating = false;
      onFreeView();
    }
  });
  return instance;
});

/** Load the shared engine once. `onProgress` receives the real download
 * percentage of the Blender catalogues (0–100). Rejects when WebGL or the
 * download fails. */
export async function ensureHeroViewer(onProgress) {
  if (typeof onProgress === "function") onEngineProgress = onProgress;
  try {
    const instance = await resource.get();
    if (!instance) throw new Error("3D engine unavailable");
    onProgress?.(100);
    return instance;
  } finally {
    if (onEngineProgress === onProgress) onEngineProgress = null;
  }
}

export function heroViewerLoaded() {
  return Boolean(resource.peek());
}

/** Front-facing portrait of one look, rendered by the shared engine. Never
 * called while a sheet shows the canvas (board and sheet are exclusive). */
export async function portraitSnapshot(look) {
  const instance = await resource.get();
  if (!instance || currentHost) return null;
  parkEngine(instance);
  try {
    // Portraits are always lit with the reference (light) studio.
    instance.setTheme?.("light");
    instance.applyState(look);
    instance.setAngle("front");
    instance.setRotation(false);
    instance.setVisible(true);
    instance.resize();
    return instance.snapshot();
  } finally {
    instance.setVisible(false);
    instance.setTheme?.(currentTheme);
  }
}

export function mountOdysseyViewer(host, look) {
  if (!host) return;
  currentHost = host;
  host.classList.add("is-loading");
  const recovery = host.querySelector(".viewer-recovery");
  if (recovery) recovery.hidden = true;
  const loader = host.querySelector("[data-load-bar]");
  if (loader) loader.hidden = false;
  resource.get()
    .then((instance) => {
      if (!instance || currentHost !== host || !host.isConnected) return;
      // Do not expose a canvas with the previous screen's camera or dimensions.
      instance.element.style.visibility = 'hidden';
      if (instance.element.parentElement !== host) host.append(instance.element);
      instance.element.setAttribute("aria-label", t("view.keyboard"));
      instance.applyState(look);
      instance.setVisible(true);
      if (viewerAngle !== "free") instance.setAngle(viewerAngle);
      instance.setRotation(Boolean(viewerRotating));
      instance.setTheme?.(currentTheme);
      instance.resize?.();
      requestAnimationFrame(() => {
        if (currentHost !== host || !host.isConnected || resource.peek() !== instance) return;
        try {
          instance.resize?.();
          instance.element.style.visibility = '';
          host.classList.remove('is-loading');
          const loader = host.querySelector('[data-load-bar]');
          if (loader) loader.hidden = true;
          const fallback = host.querySelector('.viewer-fallback');
          if (fallback) fallback.hidden = true;
        } catch (error) { fail(error, host); }
      });
    })
    .catch((error) => fail(error, host));
}

export function unmountOdysseyViewer() {
  currentHost = null;
  const instance = resource.peek();
  if (!instance) return;
  instance.setVisible(false);
  instance.element.removeAttribute("aria-label");
  parkEngine(instance);
}

export function setOdysseyAngle(angle) {
  viewerAngle = angle;
  resource.peek()?.setAngle(angle);
}

export function setOdysseyRotation(rotating) {
  viewerRotating = rotating;
  resource.peek()?.setRotation(rotating);
}

export function setOdysseyTheme(theme) {
  currentTheme = theme === "dark" ? "dark" : "light";
  resource.peek()?.setTheme?.(currentTheme);
}

export function setOdysseyFreeViewHandler(handler) {
  onFreeView = typeof handler === "function" ? handler : () => {};
}

export function retryOdysseyViewer() {
  resource.reset();
  if (currentHost) {
    let look = {};
    try { look = JSON.parse(currentHost.dataset.look || "{}"); } catch { /* Keep the fallback look. */ }
    mountOdysseyViewer(currentHost, look);
  }
}
