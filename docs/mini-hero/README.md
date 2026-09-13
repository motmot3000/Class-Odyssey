# Petit aventurier — studio clair

**Page : http://localhost:5199/assets/mini-hero/index.html**

Le modèle prend la référence fournie comme direction de proportions et de
matières : grande tête arrondie, yeux noirs ovales, cheveux dorés en volumes
larges et tenue verte. Le bouclier reprend une boussole originale Game of More.

Après le retour sur les jambes trop courtes, la silhouette a été allongée :
jambes +0,18 unité, tête à 89 %, oreilles raccourcies, bottes affinées et fusionnées
en volumes continus. Les finitions de peau et de cuir sont satinées.

## Fichiers

- `assets/mini-hero/sunlit-adventurer.blend` : scène éditable, modèle et studio.
- `assets/mini-hero/sunlit-adventurer.glb` : 59 pièces, 202 350 triangles, matériaux intégrés.
- `assets/mini-hero/sunlit-portrait.png` : rendu Cycles transparent, 1200 × 1400.
- `assets/mini-hero/sunlit-portrait.webp` : aperçu web dérivé du véritable rendu.
- `assets/mini-hero/provenance.json` : référence, méthode et réglages.
- `tools/blender/sunlit_adventurer.py` : construction, proportions, export et rendu.

Il s’agit d’un personnage statique avec un dos complet, pas d’une image plane
placée dans une scène. Le modèle n’a pas de squelette d’animation.

## Lancer

```sh
npm run build:mini
npm run lab
```

Le serveur de test existant sert la page sur le port 5199, y compris depuis le
réseau local. Le modèle est chargé au clic ; les vues face / trois quarts / dos /
visage et la rotation facultative permettent de vérifier son volume.

## Reproduire dans Blender 4.5

```sh
blender --background --factory-startup --python tools/blender/sunlit_adventurer.py
magick assets/mini-hero/sunlit-portrait.png -quality 90 assets/mini-hero/sunlit-portrait.webp
```

Dans une session MCP, charger le module puis appeler successivement
`build_body()`, `build_head()`, `equipment_and_studio()` et `export()`.
