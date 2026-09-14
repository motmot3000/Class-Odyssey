/* Reuse one visible viewer across sheet, workshop and shop renders.
 * Host identity protects navigation; resource generations protect retries.
 * These are separate races: changing a DOM host must not reload the GLB.
 */

import { t } from "./i18n.mjs";
import { CATALOGUE_URL, CATALOGUE_REVISION } from "./items-3d-model.mjs";
import { createSharedResource } from "./shared-resource.mjs";

const GLB_URL = CATALOGUE_URL;
let runtime;
let currentHost = null;
let viewerAngle = "quarter";
let viewerRotating = false;
let currentTheme = "light";
let onFreeView = () => {};

function loadRuntime() {
  if (!runtime) {
    runtime = import(new URL(`../assets/sheikah/viewer.js?v=${CATALOGUE_REVISION}`, import.meta.url).href)
      .catch((error) => { runtime = undefined; throw error; });
  }
  return runtime;
}

function updateProgress(percent) {
  const bar = currentHost?.querySelector("[data-load-bar]");
  if (bar) bar.style.setProperty("--p", `${percent}%`);
}

function fail(error, host) {
  if (!host || currentHost !== host || !host.isConnected) return;
  console.warn("Sheikah viewer:", error);
  host?.classList.remove("is-loading");
  const loader = host?.querySelector("[data-load-bar]");
  if (loader) loader.hidden = true;
  const recovery = host?.querySelector(".viewer-recovery");
  if (recovery) {
    recovery.hidden = false;
    recovery.querySelector(".viewer-error").textContent = t("view.equipmentUnavailable");
  }
  const fallback = host?.querySelector(".viewer-fallback");
  if (fallback) fallback.hidden = false;
}

const resource = createSharedResource(async (host, look) => {
  const { createHeroViewer } = await loadRuntime();
  let instance;
  instance = await createHeroViewer(host, GLB_URL, look, {
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

export function mountSheikahViewer(host, look) {
  if (!host) return;
  currentHost = host;
  host.classList.add("is-loading");
  const recovery = host.querySelector(".viewer-recovery");
  if (recovery) recovery.hidden = true;
  const loader = host.querySelector("[data-load-bar]");
  if (loader) loader.hidden = false;
  resource.get(host, look)
    .then((instance) => {
      if (!instance || currentHost !== host || !host.isConnected) return;
      if (instance.element.parentElement !== host) host.append(instance.element);
      instance.element.setAttribute("aria-label", t("view.keyboard"));
      instance.applyState(look);
      instance.setVisible(true);
      if (viewerAngle !== "free") instance.setAngle(viewerAngle);
      instance.setRotation(Boolean(viewerRotating));
      instance.setTheme?.(currentTheme);
      instance.resize?.();
      host.classList.remove("is-loading");
      const loader = host.querySelector("[data-load-bar]");
      if (loader) loader.hidden = true;
      const fallback = host.querySelector(".viewer-fallback");
      if (fallback) fallback.hidden = true;
    })
    .catch((error) => fail(error, host));
}

export function unmountSheikahViewer() {
  currentHost = null;
  resource.peek()?.setVisible(false);
}

export function setSheikahAngle(angle) {
  viewerAngle = angle;
  resource.peek()?.setAngle(angle);
}

export function setSheikahRotation(rotating) {
  viewerRotating = rotating;
  resource.peek()?.setRotation(rotating);
}

export function setSheikahTheme(theme) {
  currentTheme = theme === "dark" ? "dark" : "light";
  resource.peek()?.setTheme?.(currentTheme);
}

export function setSheikahFreeViewHandler(handler) {
  onFreeView = typeof handler === "function" ? handler : () => {};
}

export function retrySheikahViewer() {
  resource.reset();
  if (currentHost) {
    let look = {};
    try { look = JSON.parse(currentHost.dataset.look || "{}"); } catch { /* Keep the fallback look. */ }
    mountSheikahViewer(currentHost, look);
  }
}
