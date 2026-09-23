# Assets de marque — Class Odyssey

Tous les fichiers du logo, du titre, des icônes et des polices Class Odyssey sont
ici. Le pack est livré avec sa propre documentation : voir `README-pack.md`
(choix des fichiers, formats, couleurs, provenance) et `TYPOGRAPHIE-COULEURS.md`
(polices, tailles, contrastes).

## Ce que l'application charge

Les chemins sont centralisés dans `src/brand.mjs` — c'est la seule source de
vérité. Pour changer un asset, remplacer le fichier sans toucher au code.

| Emplacement | Fichier |
| --- | --- |
| Favicon (onglet, favoris) | `icons/favicon.svg`, `icons/favicon.ico` |
| Raccourci Apple | `icons/apple-touch-icon.png` |
| Manifeste PWA | `icons/site.webmanifest` |
| Logo de la barre supérieure, thème clair | `svg/class-odyssey-horizontal-light.svg` |
| Logo de la barre supérieure, thème sombre | `svg/class-odyssey-horizontal-dark.svg` |
| Logo empilé (page d'accueil) | `svg/class-odyssey-stacked-light.svg` / `-dark.svg` |
| Blason seul (ateliers) | `svg/class-odyssey-emblem-light.svg` / `-dark.svg` |
| Titre / accroche | `svg/class-odyssey-wordmark-light.svg` / `-dark.svg` |

Les polices Barlow et Chakra Petch vivent dans `fonts/` (WOFF2 pour le web, TTF
pour le bureau) et sont déclarées en `@font-face` par `src/fonts.css`.

## Arborescence

```text
assets/brand/
├── README-pack.md            documentation d'origine du pack
├── TYPOGRAPHIE-COULEURS.md   note typographique d'origine
├── icons/                    favicons, icônes d'application, manifeste
├── fonts/                    Barlow + Chakra Petch (TTF, WOFF2, licences OFL)
├── integration/              palette.json, tokens, exemples CSS et HTML
├── png/                      exports matriciels du logo et du titre
├── preview/                  aperçu de tous les exports
└── svg/                      tracés vectoriels (source)
```

## Intégration dans l'application

- `index.html` charge le favicon, l'icône Apple, le manifeste et `src/fonts.css`.
- `src/fonts.css` charge les polices locales : plus aucun appel à Google Fonts.
- `src/brand.css` affiche le bon logo selon `data-theme` (clair/sombre).
- `src/brand.mjs` expose le nom et les chemins aux vues.
- La barre supérieure de la Tablette Odyssey affiche `class-odyssey-horizontal-*` ;
  la page d'accueil affiche `class-odyssey-stacked-*`.

Conserver les proportions, laisser respirer les marges ; pas d'ombre ni de
lueur. Préférer les SVG dans l'interface, les PNG pour les services qui exigent
une image matricielle.
