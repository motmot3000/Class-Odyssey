/* ============================================================
   sheikah-viewer.mjs — dalle 3D de l'interface Sheikah
   Source unique : le catalogue d'équipements items-3d, le même que
   l'atelier « Les équipements prennent vie ». Le look est celui du jeu
   (persona, tenue, chapeau, objet, coiffure, couleur) et les 27 modèles
   du catalogue suivent l'équipement réel de l'élève.

   Le studio suit le thème de l'interface (clair ou sombre) ; le mode
   clair reste le rendu de référence.

   L'API reste `createHeroViewer` : `applyState`, `setAngle`,
   `setRotation`, `setVisible`, `setTheme`, `counts`, `resize`, `destroy`.
   ============================================================ */

import { createItemsViewer } from './items-3d-viewer.mjs';

export async function createHeroViewer(container, glbUrl, initialState, { onProgress, onError, onFreeView, theme = 'light' } = {}) {
  const viewer = await createItemsViewer(container, initialState, {
    onProgress,
    onError,
    onFreeView,
    modelURL: glbUrl,
    theme
  });

  return {
    element: viewer.element,
    applyState: viewer.applyLook,
    setAngle: viewer.setAngle,
    setRotation: viewer.setRotation,
    setVisible: viewer.setActive,
    setTheme: viewer.setTheme,
    counts: viewer.counts,
    resize: viewer.resize,
    destroy: viewer.destroy
  };
}
