/* One renderer per open hero dialog, disposed on every close/navigation. */
import { t } from "./i18n.mjs";
let runtime;

function loadRuntime() {
  if (!runtime) {
    runtime = import(new URL("../assets/characters-base/runtime/viewer.js", import.meta.url).href)
      .catch(error => { runtime = undefined; throw error; });
  }
  return runtime;
}

export function mountCharacterViewer(root) {
  let active = true;
  let pending = false;
  let instance;
  const abort = new AbortController();
  const stage = root.querySelector(".base-character-canvas");
  const poster = stage.querySelector("img");
  const status = root.querySelector(".base-character-status");
  const retry = root.querySelector("[data-character-retry]");
  const buttons = [...root.querySelectorAll("[data-character-angle]")];

  async function start() {
    if (!active || pending || instance) return;
    pending = true;
    retry.hidden = true;
    status.hidden = false;
    status.textContent = t("view.loading");
    try {
      const { createBaseViewer } = await loadRuntime();
      if (!active || !root.isConnected) return;
      const created = await createBaseViewer(stage, {
        url: root.dataset.modelUrl,
        signal: abort.signal,
        onContextLost() {
          if (!active) return;
          poster.hidden = false;
          status.hidden = false;
          status.textContent = t("view.interrupted");
          buttons.forEach(button => { button.disabled = true; });
        }
      });
      if (!active || !root.isConnected) { created.dispose(); return; }
      instance = created;
      poster.hidden = true;
      status.hidden = true;
      buttons.forEach(button => { button.disabled = false; });
    } catch (error) {
      if (!active || abort.signal.aborted) return;
      console.warn("Base character viewer:", error);
      poster.hidden = false;
      status.textContent = t("view.unavailable");
      retry.hidden = false;
    } finally {
      pending = false;
    }
  }

  function chooseView(event) {
    const button = event.currentTarget;
    instance?.setAngle(button.dataset.characterAngle);
    buttons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    stage.setAttribute("aria-label", t("view.label", { name: root.dataset.characterName, view: t(`view.${button.dataset.characterAngle}`) }));
  }

  buttons.forEach(button => button.addEventListener("click", chooseView));
  retry.addEventListener("click", start);
  start();
  return () => {
    active = false;
    abort.abort();
    instance?.dispose();
    buttons.forEach(button => button.removeEventListener("click", chooseView));
    retry.removeEventListener("click", start);
  };
}
