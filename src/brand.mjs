/* ============================================================
   brand.mjs — identité de marque (nom + assets)
   Source de vérité unique pour le nom affiché et les chemins vers
   les fichiers de assets/brand/. Pour changer le logo ou le titre,
   remplacer les fichiers dans ce dossier ; ce module n'a pas besoin
   d'être modifié.
   ============================================================ */

export const BRAND = {
  id: "classquest",
  name: "ClassQuest",
  assets: {
    base: "./assets/brand/",
    favicon: "./assets/brand/icons/favicon.svg",
    faviconIco: "./assets/brand/icons/favicon.ico",
    appleTouchIcon: "./assets/brand/icons/apple-touch-icon.png",
    manifest: "./assets/brand/icons/site.webmanifest",
    logoLight: "./assets/brand/svg/classquest-horizontal-light.svg",
    logoDark: "./assets/brand/svg/classquest-horizontal-dark.svg",
    lockupStackedLight: "./assets/brand/svg/classquest-stacked-light.svg",
    lockupStackedDark: "./assets/brand/svg/classquest-stacked-dark.svg",
    emblemLight: "./assets/brand/svg/classquest-emblem-light.svg",
    emblemDark: "./assets/brand/svg/classquest-emblem-dark.svg",
    titleLight: "./assets/brand/svg/classquest-wordmark-light.svg",
    titleDark: "./assets/brand/svg/classquest-wordmark-dark.svg"
  }
};
