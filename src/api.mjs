/* ============================================================
   api.mjs — adresse du backend
   En production, Infomaniak sert l'API sous /api/ sur le même domaine que
   l'application. L'URL reste relative pour fonctionner aussi en local et
   sous un éventuel sous-chemin — voir BACKEND.md.
   ============================================================ */

export function apiUrl(path) {
  return new URL(`api/${path}`, document.baseURI).toString();
}
