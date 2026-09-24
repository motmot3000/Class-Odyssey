# maj-accessoires — oreilles humaines, elfiques et percées

Branche `motmot3000/maj-accessoires`, basée sur `dev` @ `d0622c6`.
Worktree parent : `dev` (laissé propre, sans modification).

## Demande

- Oreilles **humaines arrondies** par défaut pour tous les personnages (les
  oreilles livrées sont de type elfe pointu).
- Les oreilles **elfiques pointues** ne sont pas supprimées : elles deviennent un
  **accessoire, niveau 4, 30 pièces**.
- Un second accessoire : **oreilles humaines percées** avec quelques bijoux,
  **niveau 5** (« Pierced Ears » / « Oreilles percées »).
- Vérifier que les **coupes de cheveux** restent correctes quand l'oreille
  rétrécit : pas de trou au contour, et un **contour identique quelle que soit
  l'oreille** (le contour est réglé sur l'oreille elfique, la plus grande).

## Décisions techniques déjà prises

- Les oreilles livrées sont des **coques libres** (4 par côté : face externe,
  face arrière, liseré bas, petit tragus) qui s'enfoncent dans le crâne. On peut
  donc les **séparer de la peau soudée sans couture**.
- Le build crée, par personnage :
  - `persona / human ears` (`ear_style: human`) — **défaut**, forme remodelée ;
  - `accessory / elf-ears` (`ear_style: elf`) — oreilles livrées intactes ;
  - `accessory / pierced-ears` (`ear_style: human`) — oreilles humaines + bijoux.
- Le maillage peau est **amputé** de ses oreilles dans le GLB (l'accessoire les
  remplace toujours).
- Les cheveux sont ajustés **au crâne seul** (BVH sans oreilles) :
  un seul contour pour toutes les oreilles, aucun cheveu ne repose sur l'elfe.
- Le remodelage est un warp dans la vue de côté le long de l'axe de l'oreille
  (`tools/blender/human_ears.py`) : racine et conque conservées, pointe
  triangulaire transformée en **hélix arrondi** (demi-ellipse), oreille
  raccourcie, redressée légèrement et rapprochée du crâne.
- Bijoux : `jewellery_layout()` place lobe + hélix + un piercing, **asymétrique
  gauche/droite**, à partir de la coque externe de l'oreille remodelée.

## État actuel

- `tools/build-items-3d.py` : `split_ears()` intégré avant l'export, `torus()`,
  `bead()`, `ear_copy()`, `conform_hair_to_head()` passé au crâne seul.
- `tools/blender/human_ears.py` : module autonome (détection des coques, BVH du
  crâne, warp, placement des bijoux).
- Le build 5.2 complet passe (~20 s hors rendu). Sortie test :
  `assets/character-stylized-test/` (créée par `STYLIZED_OUT`).
- **Reste à corriger** : 1 à 2 faces se retournent sur la conque côté M
  (trou sombre visible en vue rapprochée). Dernier essai : moyennage gaussien
  de la surface moyenne (`MID_SIGMA`) → il reste `-0.04` de retournement sur
  2 faces (M seulement). Piste : filtrer la surface moyenne (`mid`) ou
  détendre les positions dans la zone de conque.

## TODO

1. [en cours] Oreille humaine : supprimer les faces retournées (trou conque).
2. Oreilles elfiques en accessoire (niveau 4, 30 pièces) — données faites côté
   build, reste `src/domain.mjs`.
3. Oreilles percées (niveau 5) — bijoux faits, reste les données.
4. Ajouter le slot `accessory` : `src/domain.mjs` (ACCESSORIES + SHOP_ITEMS +
   normalisation sauvegarde), `src/items-3d-model.mjs` (CATEGORIES,
   DEFAULT_LOOK, visiblePart), `src/views/odyssey.mjs` (SHOP_FIELD,
   cosmeticChangesFromDraft, sections), `src/views/modals.mjs` (TYPE_LABEL),
   `src/views/shop.mjs` (onglet déjà présent), i18n FR/EN.
5. Vérifier oreilles × toutes les coupes (fichiers de revue plus bas) et
   corriger les trous éventuels dans les textures/maillages de cheveux.
6. Rebuild `assets/character-stylized/` + `assets/items-3d/`, previews,
   `npm test`, et docs (`docs/items-3d/README.md`).

## Commandes utiles

Blender est un **flatpak 5.2** : les chemins de script doivent être absolus et
le cwd doit être transmis.

```sh
# build stylisé (livrable jeu)
STYLIZED=1 STYLIZED_OUT=character-stylized-test SKIP_CATALOGUE_RENDER=1 \
  HAIR_ITEMS=short,long,medium-cut,curly,spiky,bun \
  flatpak run --cwd="$PWD" org.blender.Blender -b --factory-startup \
  --python-exit-code 1 --python "$PWD/tools/build-items-3d.py"
```

Harnais de revue (hors dépôt, machine locale) : `/tmp/opencode/ears/`
- `render2.py` : rend un catalogue en filtrant persona / coupe / accessoire /
  chapeau / angles (`-- CATALOGUE OUTDIR personas hairs accessories views [hat]`).
- `sheet.py` : assemble une planche de contrôle.
- `fold.py` : compte les faces retournées après remodelage.
- `blender` : wrapper flatpak qui absolutise `--python` et transmet le cwd.

Le contour de l'oreille mesurée est aussi dans `tools/blender/refit_female_base.py`
(`EAR_OUTLINE`, `ear_weight`) et `tools/blender/sculpt_straight_short.py` (`EAR`).
