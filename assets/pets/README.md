# Familiers — Pets

Cinq modèles adaptés depuis les archives fournies :

| Item | Source | Adaptation | Boutique |
| --- | --- | --- | --- |
| `fripouille` | `3d-modelling-my-cat-fripouille.zip`, FBX et textures | Pelage roux/blanc, foulard vert uni | Niveau 3, 40 pièces |
| `ranger-dog` | `dog.zip`, GLB | Labrador sable, foulard bleu uni | Niveau 4, 50 pièces |
| `starry-dragon` | `starry-skies-dragon.zip`, OBJ et texture | Palette turquoise/corail/or conservée ; visage de jeu : grands yeux ronds dorés cerclés de sombre, pupilles ovales, reflets, fin contour de paupières, petite crête dorée | Niveau 9, 90 pièces |
| `scarlet-parrot` | `parrot.zip`, Blender | Ara écarlate **perché sur l’épaule gauche**, près de l’oreille sans la toucher (≈1,6 cm chez Noa, 2,2 cm chez Mila). Pattes visibles sur le dessus de l’épaule : chaque semelle est ajustée à la surface réelle (toutes tenues), griffes agrippées, queue posée dans le dos sans la traverser | Niveau 7, 50 pièces |
| `meadow-rabbit` | `descriptive-text-of-rabbit (1).zip`, GLB | Tout petit lapin crème assis (30 cm), yeux noisette, sans foulard | Niveau 1, 10 pièces |

La silhouette et les textures proviennent des modèles fournis. Le dragon garde
ses ailes, ses cornes et le plumet de sa queue ; sa tête et ses yeux sont remaniés.
Les foulards du chat et du chien sont ajustés à la surface des cous, sans médaille.
Pose statique sans rig ni animation, notamment pour le lapin ; les familiers
sont placés au sol à côté du héros (sauf le perroquet, sur l’épaule) et partagés entre les deux personnages.
Un seul familier peut être équipé ; `no-pet` le retire gratuitement.

`catalogue.glb` est chargé avec le catalogue du héros par le viewer commun.
Les miniatures se trouvent dans `assets/items-3d/previews/items/`. Les sources,
leurs empreintes, les dimensions et les budgets géométriques sont consignés
dans `manifest.json`. Les archives originales ne sont pas copiées au dépôt.

## Reconstruction

Depuis la racine du projet, avec Blender 5.2 :

```bash
flatpak run --cwd="$PWD" org.blender.Blender -b --factory-startup \
  --python-exit-code 1 --python "$PWD/tools/build-pets.py" -- \
  /chemin/3d-modelling-my-cat-fripouille.zip /chemin/dog.zip \
  /chemin/starry-skies-dragon.zip "/chemin/descriptive-text-of-rabbit (1).zip" \
  /chemin/parrot.zip
npm run build:odyssey
npm run build:items-3d
npm run check
```

Le script reconstruit le GLB, les miniatures WebP et leurs manifestes. Après
une reconstruction générale des miniatures d’équipement, le relancer pour
réinscrire les familiers dans le manifeste commun. Incrémenter `PETS_REVISION`
dans `src/items-3d-model.mjs` et `REVISION` dans le script si leur aspect change.
