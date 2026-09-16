# Class Odyssey — pack de marque pour l’application

Version : 16 septembre 2026.

Dessin retenu : blason arrondi, quatre barres larges qui épousent sa pointe, épée orientée vers le bas et bordures intérieures dorées. Les mêmes tracés sont utilisés dans les deux thèmes.

## Choisir un fichier

| Usage | Fichier conseillé |
|---|---|
| En-tête sur fond clair | `svg/class-odyssey-horizontal-light.svg` |
| En-tête sur fond sombre | `svg/class-odyssey-horizontal-dark.svg` |
| Blason seul sur fond clair | `svg/class-odyssey-emblem-light.svg` |
| Blason seul sur fond sombre | `svg/class-odyssey-emblem-dark.svg` |
| Titre sans blason | `svg/class-odyssey-wordmark-light.svg` ou `-dark.svg` |
| Accueil, chargement, présentation verticale | `svg/class-odyssey-stacked-light.svg` ou `-dark.svg` |
| Impression en une couleur | Versions `mono-dark` |
| Marquage blanc sur fond coloré | Versions `mono-white` |
| Onglet du navigateur | `icons/favicon.svg`, adaptatif clair/sombre |
| Compatibilité favicon ICO | `icons/favicon.ico` |
| Raccourci Apple | `icons/apple-touch-icon.png` |
| Icône d’application | `icons/class-odyssey-app-dark-512.png` ou variante `light` |
| Icône adaptative avec marge de sécurité | `icons/class-odyssey-maskable-dark-512.png` ou variante `light` |

`light` signifie « prévu pour un fond clair » ; `dark` signifie « prévu pour un fond sombre ».

## Formats

- **SVG** : tracés vectoriels Bézier, fond transparent, sans image matricielle incorporée. Le lettrage est vectorisé et ne dépend d’aucune police installée.
- **PNG de logos** : fond transparent. Blason seul en largeurs 256, 512 et 1024 px ; titre et compositions en largeurs 1024 et 2048 px. La hauteur respecte les proportions du SVG.
- **Icônes carrées** : PNG 192, 512 et 1024 px, avec fond uni volontaire pour les raccourcis d’application. Versions maskable en 512 px et Apple en 180 px.
- **Favicons** : PNG 16, 32, 48 et 64 px ; ICO contenant ces quatre tailles. À 16 px, le blason sert de repère de marque ; les détails de l’épée sont plus lisibles dans les tailles supérieures.
- **Aperçu** : `preview/class-odyssey-preview-1600.png` présente les exports, avec les couleurs uniformisées.

## Origine et fidélité

Le symbole et les lettres « Class » reprennent exactement les tracés vectoriels validés. Le mot « Odyssey » combine des lettres redessinées et des tracés repris du lettrage précédent, dans le même style angulaire pour composer « Class Odyssey ». Les contours ont été lissés et les couleurs rendues uniformes pour obtenir des fichiers exploitables. Il s’agit d’une conversion de l’image en tracés, avec de petites différences possibles au niveau des contours ; ce n’est pas une police commerciale identifiée ni un fichier typographique éditable.

Les variantes PNG sont rendues depuis ces mêmes SVG : elles partagent donc exactement leur dessin. Les compositions horizontales et verticales réutilisent les mêmes éléments maîtres, avec une marge transparente intégrée.

## Couleurs

| Rôle | Sur fond clair | Sur fond sombre |
|---|---|---|
| Contour du blason | `#101F25` | `#E4F5FB` |
| Mot « Class » | `#000000` | `#FFFFFF` |
| Mot « Odyssey » | `#1C5B56` | `#8ADBD3` |
| Barres du blason | `#1C5B56` | `#8ADBD3` |
| Épée et bordures dorées | `#AD7123` | `#F0B554` |
| Fond de référence | `#E7E9DF` | `#101B20` |

La palette du pack est normalisée à partir du visuel validé. `integration/palette.json` fournit les valeurs réutilisables.

## Intégration

1. Copier le dossier `svg` vers un emplacement public de l’app, par exemple `assets/class-odyssey/svg`.
2. Utiliser les exemples de `integration/usage.html` et `integration/class-odyssey-brand.css`. Ils suivent l’attribut `data-theme` déjà utilisé par Class Odyssey.
3. Copier le **contenu** du dossier `icons` à la racine publique de l’application si les chemins de l’exemple sont conservés. Les chemins relatifs conviennent aussi à une application servie dans un sous-dossier, à condition que le manifeste et les icônes restent ensemble.
4. Fusionner les entrées d’icônes avec le manifeste existant plutôt que de remplacer ses autres réglages. `site.webmanifest` est un exemple ; son `start_url: "./"` désigne le dossier où il est servi.

Le favicon SVG suit le thème du navigateur via `prefers-color-scheme`. Le logo d’en-tête suit le thème choisi dans l’application via `data-theme` : ce sont deux comportements distincts.

Conserver les proportions, laisser respirer les marges et éviter les effets d’ombre ou de lueur. Pour les interfaces, privilégier les SVG ; les PNG conviennent aux services qui demandent une image matricielle.

Aucun fichier du dépôt GitHub n’a été modifié.

## Typographie et couleurs de texte

Voir `TYPOGRAPHIE-COULEURS.md` : Barlow pour les textes, Chakra Petch Bold pour les titres proches du logo, fichiers TTF/WOFF2 et licences, palette de texte avec contrastes calculés, CSS et aperçu.
