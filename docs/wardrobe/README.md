# Le vestiaire 3D — Noa & Mila

**http://localhost:5199/assets/wardrobe/index.html**

La démo permet de choisir Noa ou Mila, une tenue et des accessoires, puis
d’examiner et d’exporter la combinaison réellement affichée.

## Ce qui est disponible

- **Personnages :** Noa, cheveux châtains courts et yeux ambrés ; Mila, carré
  auburn et yeux verts. Le visage et les oreilles sont adaptés pour chaque version.
- **Tenues :** Essentiel, Éclaireur, Voyageur. Le gilet, les poches et le foulard
  sont de la géométrie séparée, pas uniquement une modification de couleur.
- **Couleurs du haut essentiel :** Sauge, Brume, Sable.
- **Objet de ceinture :** aucun, sacoche ou lanterne.
- **Dos :** sac à dos activable indépendamment.
- **Vues :** face, trois quarts, dos, tenue et visage ; rotation ou glissement horizontal.
- **Export :** GLB ne contenant que le personnage et les pièces visibles.

## Construction

La morphologie source provient des archives Nintendo/Trikeboy référencées dans
le premier lien Sketchfab fourni. Les deux personnages sont des adaptations
visuelles pour ce prototype : coiffures remplacées, palettes et traits modifiés,
habits et accessoires ajoutés. Les sources et crédits sont accessibles dans
la page et dans `assets/wardrobe/provenance.json`.

Les fichiers source `.dae` ont été importés via le MCP Blender. Les couches
d’effets et équipements initiaux ont été retirés. Le haut neutre est dérivé de
la surface corporelle ; les autres volumes sont créés dans
`tools/blender/wardrobe.py`. Un support de projection sans épaisseur permet
d’ajuster le gilet et les sangles au-dessus du vêtement.

Le GLB web contient une **pose statique évaluée**. La scène `.blend` conserve
le squelette source et les pièces éditables. Le fichier exporté par le navigateur
est également statique ; il ne constitue pas une animation ou un personnage
intégré au moteur du jeu.

## Organisation

| Chemin | Usage |
| --- | --- |
| `assets/wardrobe/wardrobe.glb` | Toutes les pièces modulaires et leurs matériaux |
| `assets/wardrobe/wardrobe.blend` | Scène Blender éditable |
| `assets/wardrobe/*-portrait.webp` | Aperçus de secours rendus dans Blender |
| `src/wardrobe-viewer.mjs` | Moteur 3D, sélection de géométrie, angles et export |
| `src/wardrobe.mjs` | Contrôles du vestiaire et état du look |
| `src/wardrobe.css` | Présentation du vestiaire |
| `tools/blender/neutral_link.py` | Préparation des sources, du haut et de la pose |
| `tools/blender/wardrobe.py` | Personnages, habits, objets, ajustement et export |

Les propriétés `wardrobe_slot` et `wardrobe_variant` des objets Blender sont
exportées dans les `extras` glTF. Le navigateur les utilise pour afficher un seul
personnage, une seule tenue, un objet éventuel et le sac à dos. Les changements
ne téléchargent pas de nouveau modèle.

## Lancer / reconstruire le navigateur

```sh
npm run build:wardrobe
npm run lab
```

Le serveur existant écoute sur `0.0.0.0:5199`. Le build élimine seulement ses
anciens chunks JavaScript générés. Le module d’export glTF est chargé à la demande.

## Vérifications effectuées

- 36 combinaisons de personnage × tenue × objet × sac à dos confrontées à
  l’inventaire réel des primitives glTF et au nombre de pièces visibles.
- Aucun rechargement du GLB pendant ces changements.
- Export de Mila / Éclaireur / lanterne / sac à dos : seuls les tags de cette
  combinaison sont présents ; fichier glTF 2.0 statique, sans peau animée.
- Vues représentatives sur ordinateur et mobile ; pas de débordement horizontal
  à 390 px et aucune erreur JavaScript non interceptée dans ce parcours.

Les captures de vérification se trouvent dans `.impeccable/review/wardrobe-*.png`.
