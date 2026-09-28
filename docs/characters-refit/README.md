# Refonte des personnages de base — characters-refit

Nouvelle révision des deux héros de base (Mila / fille, Noa / garçon) : visages
plus naturels et moins « poupée », coiffures fournies, tenue de base simple et
encolure dégagée. Elle alimente le catalogue d'équipements, donc les portraits
de classe, la garde-robe et l'atelier.

## Intégration au catalogue

La référence des visages et la seconde passe de corps sont maintenant **intégrées
au catalogue** (`catalogue-v7-approved-bases`). `tools/build-items-3d.py` porte
les trois étapes validées directement dans la construction :

- l'expression Douce (`soften_face`), l'ajustement de paupière (`refine_eyelids`)
  et les cartes approuvées du visage et des yeux remplacent les versions d'étude ;
- le complément capillaire arrière de Mila est reconstruit pour chaque variante de
  coiffure ;
- les silhouettes sportives (`refit_body_shapes.py`, passes `v1` puis `v2`) sont
  appliquées au corps, aux pantalons et à toutes les tenues, tout ce qui dépasse
  1,455 m restant protégé.

Un test (`tests/items-3d.test.mjs`) vérifie que le corps livré correspond
exactement à `assets/character-detail-study/*-athletic.glb`. Les variantes
`warm`, `sporty` et `athletic` restent consultables dans la présentation.

### Expressions en cours de validation

### Référence définitive des visages

Les visages sont maintenant **validés et figés** dans
`assets/characters-approved/faces-v1/`. Les deux GLB autonomes et leurs aperçus
portent des SHA-256 dans le manifeste. `tools/freeze_approved_faces.py` vérifie
l'archive existante et refuse de l'écraser. La page `faces-v1/index.html` permet
de consulter la référence retenue indépendamment des silhouettes.

La seconde passe de corps (`athletic`) utilise uniquement ces instantanés :
fesses moins projetées pour les deux, épaules/torse/bras davantage dessinés chez
Noa, hanches/cuisses plus pleines et volume de poitrine très léger chez Mila.
Les contours restent ceux d'aventuriers sportifs. La tête est exclue du champ
de déformation et ses normales sont protégées.

```sh
BODY_SHAPE_REVISION=v2 blender -b assets/items-3d/catalogue.blend \
  --python-exit-code 1 --python tools/blender/build_body_shape_study.py
python3 tools/finalize_character_views.py
node --test tests/approved-faces.test.mjs
```

Le test contrôle les empreintes des fichiers figés, les positions et UV du
visage et des cheveux, et les normales (tolérance de réexport inférieure à
0,06°). Le compte rendu de la morphologie est dans
`assets/character-detail-study/athletic-body-shapes.json`.

### Silhouettes sportives — première proposition

`girl-sporty.glb` et `boy-sporty.glb` partent des versions `warm`, avec les yeux
validés de Noa appliqués également à Mila. La déformation est limitée au corps
et appliquée aux vêtements par le même champ continu :

- fille : largeur des hanches jusqu'à +5%, léger galbe du haut du buste
  (4,5 mm au maximum) et bras discrètement dessinés ;
- garçon : hanches jusqu'à −3,5%, torse jusqu'à +3,5% en largeur et épaules
  légèrement plus présentes ;
- hauteur, pose, visages, yeux et coiffures conservés.

Les coefficients et le compte rendu figurent dans `refit_body_shapes.py` et
`assets/character-detail-study/body-shapes.json`. Ces variantes servent d'étape
de comparaison ; la silhouette retenue est la passe `athletic` intégrée plus haut.

```sh
blender -b assets/items-3d/catalogue.blend --python-exit-code 1 \
  --python tools/blender/build_body_shape_study.py
python3 tools/finalize_character_views.py
```

**Dernière correction : le garçon est validé ; les mêmes yeux sont appliqués
à la fille.** Les deux côtés utilisent désormais les mêmes textures issues de
Link, sans la correction bleu-gris spécifique à Zelda, et le même réglage des
paupières. La forme féminine du visage et les coiffures restent conservées.

**Étape précédente : expression Douce retenue.** Cette passe travaillait
uniquement le regard à partir des deux nouvelles références : Link BotW pour
Noa, Zelda Twilight Princess pour Mila. Cheveux (dont le complément arrière),
bouche, sourcils et silhouette de Douce sont conservés.

```sh
python3 tools/prepare_reference_eyes.py /chemin/link-the-legend-of-zelda-breath-of-the-wild.zip /chemin/zelda-the-legend-of-zelda-twilight-princes.zip
blender -b assets/items-3d/catalogue.blend --python-exit-code 1 \
  --python tools/blender/build_warm_eyes_study.py
python3 tools/finalize_character_views.py
```

Les iris/pupilles reprennent les cartes des références fournies (avec provenance
Nintendo et SHA-256), puis reçoivent un blanc adouci, des détails fins et un
petit reflet. La paupière est ajustée indépendamment du globe oculaire pour
garder un iris rond. Les résultats `girl-warm.glb` et `boy-warm.glb` sont des
propositions séparées ; `warm-eyes/geometry.json` consigne les changements.

Après validation des coiffures et proportions, trois expressions ont été
proposées dans `character-detail-study.html` : **Douce**, **Souriante**,
**Sereine**. L'expression **Douce** a été retenue et intégrée au catalogue.

- `tools/prepare_expression_textures.py` : iris plus ouverts, sclère adoucie,
  sourcils moins contrastés, plis fins de paupières et détails de lèvres.
- `tools/blender/build_expression_study.py` : variantes de sourcils et de bouche,
  avec exactement les mêmes mèches extérieures ; une couche arrière complète
  la zone dégarnie de Mila.
- `assets/character-detail-study/expressions/manifest.json` : paramètres et statut.

```sh
python3 tools/prepare_expression_textures.py
blender -b assets/items-3d/catalogue.blend --python-exit-code 1 \
  --python tools/blender/build_expression_study.py
python3 tools/finalize_character_views.py
node tools/serve-character-study.mjs
```

## Ce qui change

- **Visages.** La calotte frontale est re-sculptée (yeux plus petits et remontés
  à une ligne naturelle, arcade adoucie, bouche plus dessinée) ; la fille reçoit
  en plus une mâchoire plus fine et un menton plus doux. Peau, paupières et
  globes oculaires partagent le même champ de déformation pour rester alignés.
- **Peau.** Grain fin, variation basse fréquence non répétitive, rendu mat
  (subsurface discret, plus de vernis). Iris reconstruits : fibres radiales,
  anneau limbique, pupille réduite, reflet.
- **Coiffures.** La coupe longue de la fille et la coupe courte du garçon
  reprennent les deux modèles Blender fournis par l'utilisateur. Seuls les
  cheveux sont conservés ; les têtes fournies sont écartées.
- **Tenue.** Le col-foulard, l'écharpe et le pendentif de la tenue `starter`
  sont retirés. Le volume arrière des hanches est légèrement réduit sur les
  deux personnages, pantalons et toutes les tenues, avec des transitions douces.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `assets/characters-refit/textures/` | Peau, visage, normales, rugosités et iris refit, avec leur provenance (`.json`) |
| `assets/characters-refit/hair/*.glb` | Coiffures fournies, décimées et placées dans le repère de construction |
| `tools/port-medium-cut.py` | Extrait, cale et place la coupe mi-longue fournie (`beautiful-hair-1.zip`) dans le repère du catalogue |
| `tools/medium_cut_locks.py` | Reconstruit l'avant de la coupe mi-longue en mèches-rubans (frange ondulée à raie décalée, dessus bouclé, mèches latérales jusqu'à la mâchoire), ajustées aux peaux de Noa et Mila |
| `tools/prepare_refit_textures.py` | Génère les cartes refit depuis la révision surface-v3 (reproductible, graine fixe) |
| `tools/blender/prepare_refit_hair.py` | Extrait, allège et replace les deux coiffures fournies |
| `tools/blender/render_character_views.py` | Rendus de comparaison avant/après (ne modifie jamais le catalogue) |
| `tools/finalize_character_views.py` | Convertit ces rendus en WebP avec provenance |
| `character-detail-study.html` | Présentation comparative avant/après |
| `tools/serve-character-study.mjs` | Serveur de démonstration de cette présentation (port 5202) |

## Reproduction

```sh
python3 tools/prepare_refit_textures.py
blender -b --factory-startup --python-exit-code 1 \
  --python tools/blender/prepare_refit_hair.py -- \
  /chemin/blender-hair-model.zip /chemin/hunter-hairr-obj.zip
blender -b --factory-startup --python-exit-code 1 --python tools/build-items-3d.py
blender -b assets/items-3d/catalogue.blend --python-exit-code 1 \
  --python tools/render-equipment-previews.py
python3 tools/finalize-equipment-previews.py
npm test
```

Rendus de présentation :

```sh
blender -b /chemin/catalogue-avant.blend --python-exit-code 1 \
  --python tools/blender/render_character_views.py -- before assets/character-detail-study
blender -b assets/items-3d/catalogue.blend --python-exit-code 1 \
  --python tools/blender/render_character_views.py -- after assets/character-detail-study
python3 tools/finalize_character_views.py
node tools/serve-character-study.mjs
```

## Provenance et licence

Les corps restent issus des fichiers livrés (Nintendo / The Models Resource —
Trikeboy). Les deux coiffures fournies n'embarquent ni auteur ni licence dans
leurs archives ; leur empreinte SHA-256 est conservée dans
`assets/characters-refit/hair/*.json`. Les textures de visage conservent
l'origine Nintendo des cartes surface-v3, puis sont retravaillées localement par
`tools/prepare_refit_textures.py`.

## Vérification

`npm test` couvre le catalogue. Le test historique de conservation de la peau
garantit que les positions hors du visage et des hanches arrière sont
conservées à ±10⁻⁵, notamment les mains et la soudure de nuque. Un test mesure
la réduction du profil arrière des deux bases. Un autre vérifie que les coupes de base sont
bien les coiffures fournies et que la tenue `starter` ne contient plus le col.
