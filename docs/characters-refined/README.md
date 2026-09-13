# Surface-v3 — visage et matières

Comparaison : `http://localhost:5182/assets/characters-refined/index.html`.

Cette étude reprend les deux personnages de base pour réduire la lecture
uniforme de la peau, des cheveux et des vêtements. Elle reste un rendu de jeu
stylisé, avec une anatomie et des proportions identiques à base-v2.

## Travail réalisé

- Reliefs originaux du visage, de la peau, du pantalon et des chaussures
  restaurés avec des normal maps.
- Roughness distincte selon peau, zones du visage, tissu et cuir.
- Iris affinés et couche de reflet des yeux.
- Fibres orientées selon les mèches, matériaux de cheveux moins uniformes.
- Matière coton, plis localisés et détails de col cuits dans des textures PBR.
- Dix variantes garçon/fille × cinq carnations, plus gros plans visage/tenue.

Les cartes de relief changent la réponse à la lumière, pas les positions des
sommets. `geometry-check.json` garde la preuve de l’invariance des quatre
familles de géométrie. Les ancrages sont identiques au manifeste base-v2 et la
pose validée avec `items/update` est conservée. Les UV/atlases de cheveux et de
coton sont nouveaux ; les fichiers base-v2 ne sont pas remplacés.

## Vérifier la différence

La page propose les rendus Blender et une comparaison de deux modèles 3D.
En mode 3D, angle et éclairage sont identiques à gauche et à droite. Les vues
Visage et Tenue permettent d’examiner les différences de relief et de matière.

## Reproduire

```sh
python tools/blender/prepare_surface_reference.py
uv run --with pillow --with numpy python tools/blender/prepare_refined_surfaces.py
blender --background assets/characters-base/base-characters.blend --python-exit-code 1 --python tools/blender/refine_character_surfaces.py
uv run --with pillow python tools/blender/finalize_refined_surfaces.py
npm run build:characters
npm test
```

`SURFACE_GENDERS=boy` et `SURFACE_TONES=medium` permettent une prévisualisation
ciblée. L’export glTF n’inclut que la scène active pour éviter le problème de
réimport des scènes historiques vides signalé sur Blender 4.5.

Les sources Nintendo/Trikeboy et la transformation des textures sont précisées
dans `assets/characters-refined/provenance.json`.
