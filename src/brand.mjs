/* ============================================================
   brand.mjs — identité de marque (nom + assets)
   Source de vérité unique pour le nom affiché et les chemins vers
   les fichiers de assets/brand/. Pour changer le logo ou le titre,
   remplacer les fichiers dans ce dossier ; ce module n'a pas besoin
   d'être modifié.
   ============================================================ */

export const BRAND = {
  id: "class-odyssey",
  name: "Class Odyssey",
  assets: {
    base: "./assets/brand/",
    favicon: "./assets/brand/icons/favicon.svg",
    faviconIco: "./assets/brand/icons/favicon.ico",
    appleTouchIcon: "./assets/brand/icons/apple-touch-icon.png",
    manifest: "./assets/brand/icons/site.webmanifest",
    logoLight: "./assets/brand/svg/class-odyssey-horizontal-light.svg",
    logoDark: "./assets/brand/svg/class-odyssey-horizontal-dark.svg",
    lockupStackedLight: "./assets/brand/svg/class-odyssey-stacked-light.svg",
    lockupStackedDark: "./assets/brand/svg/class-odyssey-stacked-dark.svg",
    emblemLight: "./assets/brand/svg/class-odyssey-emblem-light.svg",
    emblemDark: "./assets/brand/svg/class-odyssey-emblem-dark.svg",
    titleLight: "./assets/brand/svg/class-odyssey-wordmark-light.svg",
    titleDark: "./assets/brand/svg/class-odyssey-wordmark-dark.svg",
    pngEmblemLight: "./assets/brand/png/class-odyssey-emblem-light-512.png",
    pngEmblemDark: "./assets/brand/png/class-odyssey-emblem-dark-512.png"
  }
};
