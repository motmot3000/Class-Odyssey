/* ============================================================
   sheikah-runtime.mjs — une seule dalle 3D réutilisée
   Le vestiaire est chargé une fois, puis déplacé dans le conteneur
   visible à chaque rendu. Aucun rechargement du GLB au changement de vue.
   ============================================================ */

const GLB_URL = new URL("../assets/wardrobe/wardrobe.glb", import.meta.url).href;
let runtime;
let viewer;
let instancePromise = null;
let currentHost = null;
let viewerAngle = "quarter";
let viewerRotating = false;
let currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
let onFreeView = () => {};

function loadRuntime() {
  if (!runtime) {
    runtime = import(new URL("../assets/sheikah/viewer.js", import.meta.url).href)
      .catch((error) => { runtime = undefined; throw error; });
  }
  return runtime;
}

function updateProgress(percent) {
  const bar = currentHost?.querySelector("[data-load-bar]");
  if (bar) bar.style.setProperty("--p", `${percent}%`);
}

function fail(error, host) {
  console.warn("Sheikah viewer:", error);
  host?.classList.remove("is-loading");
  const loader = host?.querySelector("[data-load-bar]");
  if (loader) loader.outerHTML = '<p class="viewer-error" role="status">Le vestiaire 3D est indisponible.</p>';
}

function getInstance(host, look) {
  if (!instancePromise) {
    instancePromise = loadRuntime()
      .then(({ createHeroViewer }) => createHeroViewer(host, GLB_URL, look, {
        theme: currentTheme,
        onProgress: updateProgress,
        onError: (message) => fail(new Error(message), currentHost),
        onFreeView: () => {
          viewerRotating = false;
          onFreeView();
        }
      }))
      .then((instance) => { viewer = instance; return instance; })
      .catch((error) => { instancePromise = null; throw error; });
  }
  return instancePromise;
}

export function mountSheikahViewer(host, look) {
  if (!host) return;
  currentHost = host;
  host.classList.add("is-loading");
  getInstance(host, look)
    .then((instance) => {
      if (!instance) return;
      if (instance.element.parentElement !== host) host.append(instance.element);
      instance.applyState(look);
      instance.setVisible(true);
      instance.setAngle(viewerAngle);
      instance.setRotation(Boolean(viewerRotating));
      instance.setTheme(currentTheme);
      instance.resize?.();
      host.classList.remove("is-loading");
      const loader = host.querySelector("[data-load-bar]");
      if (loader) loader.hidden = true;
    })
    .catch((error) => fail(error, host));
}

export function unmountSheikahViewer() {
  viewer?.setVisible(false);
}

export function setSheikahAngle(angle) {
  viewerAngle = angle;
  viewer?.setAngle(angle);
}

export function setSheikahRotation(rotating) {
  viewerRotating = rotating;
  viewer?.setRotation(rotating);
}

export function setSheikahTheme(theme) {
  currentTheme = theme;
  viewer?.setTheme(theme);
}

export function setSheikahFreeViewHandler(handler) {
  onFreeView = typeof handler === "function" ? handler : () => {};
}

export function retrySheikahViewer() {
  viewer?.destroy?.();
  viewer = null;
  instancePromise = null;
  if (currentHost) {
    let look = {};
    try { look = JSON.parse(currentHost.dataset.look || "{}"); } catch { /* défaut */ }
    mountSheikahViewer(currentHost, look);
  }
}
