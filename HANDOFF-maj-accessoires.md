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
  - `persona / human ears` (`ear_style: human`) — **défaut**, oreille sculptée ;
  - `accessory / elf-ears` (`ear_style: elf`) — oreilles livrées intactes ;
  - `accessory / pierced-ears` (`ear_style: human`) — oreilles humaines + bijoux.
- Le maillage peau est **amputé** de ses oreilles dans le GLB (l'accessoire les
  remplace toujours).
- Les cheveux sont ajustés **au crâne seul** (BVH sans oreilles) :
  un seul contour pour toutes les oreilles, aucun cheveu ne repose sur l'elfe.
- L'oreille humaine est **sculptée** (`tools/blender/human_ear_model.py`,
  champ de distance signée maillé par OpenVDB), plus dérivée de l'elfe : le
  warp du premier essai donnait une oreille grossière, rejetée.
- Bijoux : `jewellery_layout()` place lobe + hélix + un piercing, **asymétrique
  gauche/droite**, sur la face externe de l'oreille sculptée.
- Trous de cheveux autour de l'oreille : `tools/blender/hair_fill.py` ajoute une
  sous-couche de cheveux sur le crâne là où la coupe d'origine couvrait.

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

## Mise à jour (reprise)

- Les faces retournées étaient déjà réglées par `relax()` (0 sur les 4
  oreilles). Le vrai défaut visible était autre : la peau est **ouverte** sous
  chaque oreille (bord non soudé, sur plusieurs pièces de peau), et la racine
  de l'oreille elfique bouchait exactement ce bord. L'oreille humaine ne peut
  pas suivre ce bord (il monte vers la pointe elfique) : la paroi apparaissait.
  Geler les sommets du bord laissait un aileron ; les aplatir repliait la conque.
- Correction : `cap_openings()` (human_ears.py) soude les coins du bord puis
  **referme l'ouverture** (triangle_fill, UV du bord) avant l'amputation des
  oreilles. Toute oreille se pose sur un crâne fermé. Vérifié : 0 face
  retournée, aucune couture, elfe/humaine/percée propres en chauve.
- Slot `accessory` fait : `ACCESSORIES` (`no-accessory` gratuit, `elf-ears`
  niv. 4 / 30, `pierced-ears` niv. 5 / 50 — prix non spécifié, aligné sur les
  articles de niveau 5), normalisation de sauvegarde, `EAR_ACCESSORIES` masque
  l'oreille humaine du slot persona, aperçu boutique = héros portant les
  oreilles, section du dressing, libellés FR/EN (`i18n-extra.mjs`).

## Mise à jour (2e tour, retours utilisateur)

Retour : oreilles « pas jolies, pas clean, gros morceaux » et trous dans les
coupes autour de l'oreille.

- Nouvelle oreille anatomique `human_ear_model.py` (`ear_mesh`, `LANDMARKS`),
  posée par `human_ear_matrix` (origine `EAR_ORIGIN`, évasement 20°,
  inclinaison 12°, échelle 1,05) ; matériau = texel médiane de la peau de
  l'oreille livrée (`plain_skin_texel`), donc teinte suivie. Ancien warp
  `humanize_points` supprimé.
- `hair_fill.py` : une coque par coupe (et variante chapeau), sur la plus
  grosse pièce en matériau cheveux (pas l'attache dorée du chignon), couverture
  = toutes les pièces de la coupe avant `clear_ear_space` (`PRE_HAIR`) + la
  fenêtre de l'oreille elfique. Marge nue de 3,5 mm autour de l'attache de
  l'oreille, pas de coque sous le lobe, ligne relaxée, décalage radial lisse
  (les normales par face creusaient des fossettes), sillons de mèches légers.
- Vérifié en rendu : 6 coupes × 3 oreilles × 2 personnages, vues côté/dos/¾.

## TODO

1. [fait] Oreille humaine : trou autour de la racine (capuchon de peau).
2. [fait] Oreilles elfiques en accessoire (niveau 4, 30 pièces).
3. [fait] Oreilles percées (niveau 5, 50 pièces).
4. [fait] Slot `accessory` (domaine, modèle 3D, dressing, boutique, i18n).
5. [fait] Oreilles × coupes : `conform_hair_to_head` plaquait sur le crâne les
   mèches rentrées par `clear_ear_space` (long, bun, medium-cut) ; elles restent
   désormais sous le crâne (fermé). Capuchon : une seule UV de peau unie (sinon
   carré tacheté derrière l'oreille).
6. [fait] Rebuild production (`HAIR_ITEMS=short,long,medium-cut,curly,spiky,bun`,
   sinon Braids/Royal Hair reviennent) et stylisé, révisions
   `catalogue-v10-ear-accessories` / `stylized-v6` (puis v11 / v7, 3e tour), previews (accessoires
   cadrés de côté), bundles web, docs. `npm run check` : 152/152.

## Mise à jour (3e tour) : les coupes suivent l'oreille humaine

- Lobes réduits (`human_ear_model.py` : bas du contour relevé, lobe plus fin).
- La coque `hair_fill` donnait un contour plat autour de l'oreille (bun...).
  Remplacée, dans le catalogue stylisé, par les **vraies mèches** de chaque
  coupe dégagées autour de l'oreille humaine : chaque pièce de cheveux est
  dégagée deux fois (elfe / humaine), `split_ear_variants` sépare les faces qui
  diffèrent en pièces `ear_fit: elf|human`, le viewer choisit selon
  l'accessoire (`visiblePart`, `items-3d-model.mjs`).
- Short : nouveau `assets/characters-refit/hair/straight-short-human-ear.glb`
  (`EAR_SHAPE=human` dans `sculpt_straight_short.py`, contour mesuré sur les
  `human ears` du catalogue stylisé). Le build l'importe comme `ear_fit: human`.
- Long : couche occipitale et mèches de tempe restent dégagées « elfe » (sinon
  aileron à la forme de l'oreille elfique).
- Révisions `catalogue-v11-ear-hair` / `stylized-v7`. Vérifié : 6 coupes ×
  2 personnages × 3 oreilles, avec couronne et chapeau de sorcier.

## Mise à jour (4e tour) : retouches par coupe

Tout est dans `tools/build-items-3d.py` (catalogue stylisé, variante humaine) :
- Dégagement plus serré (`HUMAN_EAR_PAD=.0008`, `HUMAN_EAR_BAND=.0045`) : bun.
- `DRAPED_HAIR` (long, curly) : `drape_human_ear` pose les mèches sur une
  « tente » au-dessus de l'oreille et les rentre dessous, au lieu de les couper.
- Curly (Braid) : `EAR_LOCK_PATHS['curly']`, une mèche de la tempe passe
  par-dessus l'oreille jusqu'à la tresse.
- `UNDERLAYER_HAIR` (spiky, curly) : sous-couche sur la fenêtre elfe ; pour
  spiky (`CLONED_HAIR`), `clone_locks_down` recopie les mèches au-dessus du trou
  vers le bas (mèches entières uniquement, derrière l'oreille), sous-couche
  assombrie (`UNDERLAYER_SHADE`).
- Révisions `catalogue-v12-ear-drape` / `stylized-v8`.

## Reste / à valider

- Non committé. `assets/character-stylized-test/` est une sortie de test
  (non suivie), à supprimer quand plus utile.
- Prix des oreilles percées (50) : choisi par cohérence, à confirmer.
- Parcours complet boutique → achat → dressing non joué dans le navigateur
  (couvert par les tests de domaine et de markup) ; atelier 3D vérifié.
- Le rendu headless (Playwright) montre la peau jaune, y compris avec le GLB
  de HEAD : artefact antérieur, hors périmètre.

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
- `earpreview.py` : rendu isolé de l'oreille sculptée.
- `red.py` : colore en rouge la coque `hair_fill` pour la diagnostiquer.
- `blender` : wrapper flatpak qui absolutise `--python` et transmet le cwd.

Le contour de l'oreille mesurée est aussi dans `tools/blender/refit_female_base.py`
(`EAR_OUTLINE`, `ear_weight`) et `tools/blender/sculpt_straight_short.py` (`EAR`).
