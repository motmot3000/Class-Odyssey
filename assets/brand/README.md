# Assets de marque

Tous les fichiers du logo et du titre ClassQuest sont ici. Le pack complet est
livré avec sa propre documentation : voir `README-pack.md` (choix des fichiers,
formats, couleurs, provenance).

## Ce que l'application charge

Les chemins sont centralisés dans `src/brand.mjs` — c'est la seule source de
vérité. Pour changer un asset, remplacer le fichier sans toucher au code.

| Emplacement | Fichier |
| --- | --- |
| Favicon (onglet, favoris) | `icons/favicon.svg`, `icons/favicon.ico` |
| Raccourci Apple | `icons/apple-touch-icon.png` |
| Manifeste PWA | `icons/site.webmanifest` |
| Logo de la barre supérieure, thème clair | `svg/classquest-horizontal-light.svg` |
| Logo de la barre supérieure, thème sombre | `svg/classquest-horizontal-dark.svg` |
| Blason seul (ateliers) | `svg/classquest-emblem-light.svg` / `-dark.svg` |
| Titre / accroche | `svg/classquest-wordmark-light.svg` / `-dark.svg` |
| Présentation verticale | `svg/classquest-stacked-light.svg` / `-dark.svg` |

## Arborescence

```text
assets/brand/
├── README-pack.md      documentation d'origine du pack
├── icons/              favicons, icônes d'application, manifeste
├── integration/        palette.json, exemple CSS et HTML du pack
├── png/                exports matriciels du logo et du titre
├── preview/            aperçu de tous les exports
└── svg/                tracés vectoriels (source)
```

## Intégration dans l'application

- `index.html` charge le favicon, l'icône Apple et le manifeste.
- `src/brand.css` affiche le bon logo selon `data-theme` (clair/sombre).
- `src/brand.mjs` expose le nom et les chemins aux vues.
- La barre supérieure de la Tablette Sheikah affiche `classquest-horizontal-*` ;
  le sous-titre « Tablette Sheikah » a été retiré au profit du logo.
- Les ateliers (`character-lab.html`, `items-3d.html`, `assets/wardrobe`,
  `assets/mini-hero`, `assets/character-lab/raster`) réutilisent le blason et
  le favicon.

Conserver les proportions, laisser respirer les marges ; pas d'ombre ni de
lueur. Préférer les SVG dans l'interface, les PNG pour les services qui exigent
une image matricielle.
