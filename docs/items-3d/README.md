# Première collection d’équipements 3D

## Intégration courante dans Class Odyssey

### Base de personnage live

Le jeu affiche désormais les personnages **stylisés livrés**, servis depuis
`assets/character-stylized/catalogue.glb` (`stylized-v8`) via
`BASE_CATALOGUE_URL`. Cette base garde les visages et les silhouettes livrés,
ajoute une expression naturelle (sourcils détendus, léger sourire) et des
matières mates. Le catalogue de production `assets/items-3d/catalogue.glb`
(`catalogue-v13-ear-outfits`) reste la référence de la chaîne d'outils et des
tests.

Le **catalogue de cosmétiques est réduit** :

- **Tenues** : une nouvelle tenue par niveau jusqu'au niveau 10, de plus en
  plus travaillée. Éclaireur est la tenue de départ gratuite ; puis Barde (1),
  Ranger (2), Mage (3), Guerrier (4), Mage noir (5), Chevalier (6),
  Cartographe / Map Maker (7), Guérisseur (8), Alchimiste (9) et Gardien des
  chevaux / Horse Keeper (10), l'armure du Chevalier la plus ornée (argent,
  bordeaux, fers à cheval dorés, cape blanche). Archimage et Roi restent
  retirés ; le **titre** Roi reste. Éclaireur, Barde et Ranger gardent le
  pantalon livré ; toutes les autres sont des tenues complètes (`coversLegs`)
  qui apportent leurs propres jambes et masquent le pantalon. Les bottes
  livrées restent identiques pour toutes les tenues.
- **Objets** : catégorie retirée (armes, boucliers, livre, lanterne). L'état
  interne `no-weapon` subsiste pour les sauvegardes, sans onglet.
- **Cheveux** : **Courts** et **Longs** sont gratuits et partagés par les deux
  personnages — un garçon démarre en Short (coupe courte sculptée), une fille en
  Long. **Chauve** (niveau 2, 20), **Tresse** (niveau 3, 30, coupe portée avec
  frange et longue natte, `characters-refit/hair/curly.glb`) et **Medium Cut**
  (niveau 3, 30, `characters-refit/hair/medium-cut.glb`) suivent, puis
  **Spiky Hair** (niveau 6, 50, l'ancienne coupe courte livrée) et **Chignon**
  (niveau 6, 50, `characters-refit/hair/bun.glb`, épingle dorée). L'ancien Afro
  sculpté, Braids et Royal Hair sont retirés.
- **Visages** : catégorie supprimée ; l'expression vient de la base 3D.
- **Yeux** : cinq couleurs — **brun** par défaut, **vert** (niveau 3, 30),
  **bleu** (niveau 4, 30), **rouge** (niveau 6, 50) et **violet** (niveau 8,
  50). La couleur est appliquée à l'iris livré en temps réel (teinte et
  saturation), sans modèle supplémentaire. La catégorie **Personnalisé** est
  retirée.
- **Teints** : tatouages et Peau dorée retirés ; les cinq teints naturels
  restent.
- **Titres** : Explorer, Champion, King et Legend gardent leur nom mais portent
  une identité visuelle propre (accent et badge distincts, `data-title-id`).
- **Oreilles et accessoires** : tous les personnages ont des **oreilles
  humaines sculptées** par défaut (`persona / human ears`). L'onglet
  Accessoires propose **Oreilles d'elfe** (niveau 4, 30 ; les oreilles pointues
  livrées, intactes) et **Oreilles percées** (niveau 5, 50 ; oreilles humaines,
  anneaux et clous dorés, disposition asymétrique). `no-accessory` est l'état
  gratuit par défaut. Un accessoire d'oreilles masque l'oreille humaine
  (`EAR_ACCESSORIES` dans `items-3d-model.mjs`).

Les oreilles livrées sont des coques libres posées sur une **ouverture de la
peau**. `split_ears` (`tools/build-items-3d.py`) les sépare de la peau, garde
les oreilles elfiques intactes (accessoire) et **referme l'ouverture**
(`cap_openings`, une seule UV de peau unie) : toute oreille se pose sur un
crâne fermé. L'oreille humaine est une **oreille anatomique sculptée**
(`tools/blender/human_ear_model.py` : champ de distance signée — hélix, anthélix
en Y, fossette, conque, tragus, antitragus, lobe — maillé par OpenVDB, ~5 200
faces), posée sur le crâne par `human_ear_matrix` (`human_ears.py`) et teintée
par une texel unie de la peau. Les bijoux des oreilles percées sont placés sur
sa face externe (`jewellery_layout`).

Les cheveux sont ajustés au crâne seul, mais les **mèches proches de l'oreille
existent en deux versions** (propriété `ear_fit`) : rentrées autour de
l'oreille elfique (`clear_ear_space`, contour `EAR_OUTLINE`) ou autour de
l'oreille humaine (même dégagement, contour = enveloppe de l'oreille sculptée,
`side_outline` + `human_ear_weight`). Ce sont les vraies mèches de la coupe,
avec sa texture et son sens de coiffage, pas une coque de remplissage.
`split_ear_variants` ne duplique que les faces qui diffèrent ; le reste de la
coupe est partagé. Le viewer (`visiblePart`) affiche `ear_fit: 'elf'` avec
l'accessoire `elf-ears`, sinon `human` (oreilles par défaut et percées).

Cas particuliers : Short (sculptée) est regénérée autour de l'oreille humaine
(`EAR_SHAPE=human tools/blender/sculpt_straight_short.py` →
`straight-short-human-ear.glb`) ; pour Long, la couche occipitale et les mèches
de tempe (dessinées sur l'oreille elfique) restent rentrées pour les deux.
`tools/blender/hair_fill.py` (coque sur le crâne) ne sert plus qu'aux coupes
sans variante (catalogue de production).

Les coupes partagées utilisent les coiffures livrées et portées
(`SUPPLIED_HAIR`), ajustées à chaque tête par la transformation du siège de
chapeau ; `SCULPTED_HAIR` reste réservé aux familles sculptées dans Blender.
La coupe courte `short` est sculptée par
`tools/blender/sculpt_straight_short.py` : raie sur le côté, frange balayée en
diagonale avec du volume à la racine, dessus plus fourni, côtés près du crâne et
nuque dégradée. Les mèches poussent sur le crâne mesuré de Noa et Mila, en
faisceaux qui se séparent en pointes fines. Le contour suit la silhouette
latérale mesurée de l'oreille (patte devant, arc net au-dessus, dégradé
derrière) et les mèches se plaquent en l'approchant. Une nuance par sommet
(racines plus sombres, ton propre à chaque mèche) multiplie la couleur de
cheveux choisie en boutique (`Hair / sculpted fibres`, exporté en `COLOR_0`).
Elle ne passe donc pas par le dégagement d'oreille générique ; seule la
conformation à la peau s'applique.

```sh
blender -b --factory-startup --python-exit-code 1 --python tools/blender/sculpt_straight_short.py
```

`HAIR_ITEMS=short,long,medium-cut,curly,spiky,bun` limite le build à ces familles.

La **couleur de peau** est fonctionnelle : une seule peau est cuite (médium) et
le viewer multiplie son albédo par le teint cible (`SKIN_TONE_COLORS` dans
`items-3d-model.mjs`), corps, visage et pont de cou. Le teint se choisit à la
création (console professeur), dans la section Peau du dressing et sous l'onglet
Peaux de la boutique.

Pour reconstruire la base stylisée :

```sh
STYLIZED=1 HAIR_ITEMS=short,long,medium-cut,curly,spiky,bun blender -b --factory-startup --python-exit-code 1 --python tools/build-items-3d.py
```

L'atelier autonome peut inspecter n'importe quelle base : `items-3d.html?model=/assets/character-stylized/catalogue.glb`.

Les **portraits de secours** (`previews/portraits/*.webp`) sont rendus depuis cette
même base stylisée, et `PORTRAIT_REVISION` suit `BASE_CATALOGUE_REVISION` : l'ancien
personnage ne peut donc plus apparaître avant le rendu live.

### Détails

La passe `catalogue-v8-scoped-cosmetics` intègre les visages et les silhouettes
validés. Les cartes approuvées de l'expression Douce et les yeux de référence
remplacent les précédentes ; la seconde passe de corps applique les morphologies
sportives (fesses moins projetées, épaules/torse/bras plus dessinés chez Noa,
hanches et cuisses plus pleines chez Mila) en protégeant tout ce qui dépasse
1,455 m. Les géométries source du corps et le contrat d'ancrage restent
inchangés.
La taille de toutes les tenues suit le contour réel de la ceinture, sans bord
elliptique rapporté.

La passe `catalogue-v10-full-outfits` / `stylized-v6` restructure les tenues :

- Le vêtement bas livré est découpé à la construction (`split_footwear`) en
  deux pièces `core` : `core_part: 'boots'` (toujours visible) et
  `core_part: 'trousers'`, masqué par `visiblePart` quand la tenue porte
  `coversLegs`. Le corps livré n'a pas de peau sous le pantalon : les tenues
  complètes ajoutent donc des chausses mesurées (`LegFit`) sur le pantalon et
  le tibia, rentrées dans les bottes.
- Capes, pèlerine et capuche sont drapées depuis le col (`drape`) : chaque
  colonne ne fait que s'élargir en rencontrant épaules, bras ou dos, et passe
  derrière les bras. Elles sont exclues de l'affinement du bassin.
- Bandes, fermoirs, sangles, runes et plaques sont posés par lancer de rayons
  sur le vêtement porteur (`on_surface`, `limb_rings`), sans coordonnées
  fixes.
- Passe `catalogue-v11-ten-levels` / `stylized-v7` : Barde (couleur, écharpe
  et broche), Cartographe (manteau aux genoux, étui à cartes, boussole,
  longue-vue, pèlerine), Guérisseur (robe ivoire, tabard turquoise, emblème
  coupe et feuilles, capuche, pèlerine, sacoche et fioles), Alchimiste
  (tablier de cuir, bandoulière de fioles lumineuses, gantelets, lunettes,
  pèlerine à signes lumineux, cape) et Horse Keeper (troisième palier de
  `articulated_armour`).
- Ranger : pèlerine brune à capuche, fermoir à cabillot, baudrier, bourses et
  brassards lacés. Mage : robe longue évasée, manches cloche, cape indigo.
  Mage noir : robe pourpre à ourlet dentelé, pèlerine noire à pointes,
  plastron noir et runes lumineuses, écharpe. Guerrier : gorgerin, épaulières
  en dôme, canons d'avant-bras, cubitières, tassettes, cuissards, genouillères
  et grèves. Chevalier : même construction, bords dorés, filigranes, rondelles,
  quatre tassettes, chaîne de cape et écu à l'étoile.

Les cartes de classe et la sélection d’élève sont rendues depuis le même
catalogue que le workshop. Deux portraits actuels servent de secours, puis
un renderer hors-écran unique produit les looks réellement équipés et les
conserve dans un cache borné (64 combinaisons).

La boutique présente **l’objet seul**, dans ses vignettes et son aperçu 3D.
Les 27 images WebP proviennent de `catalogue.blend`, sans personnage ajouté.
Après achat, l’atelier montre l’objet porté. Les carnations, expressions,
couleurs et titres utilisent des pastilles/symboles dédiés, pas un ancien avatar.

Reconstruction complète (Blender 4.5 et Pillow) :

```sh
blender -b --factory-startup --python-exit-code 1 --python tools/build-items-3d.py
blender -b assets/items-3d/catalogue.blend --python-exit-code 1 --python tools/render-equipment-previews.py
python3 tools/finalize-equipment-previews.py
npm run build:items-3d
npm run build:odyssey
npm test
```

`previews/manifest.json` lie les vignettes au SHA-256 du catalogue. Les
cheveux, chapeaux et prises restent ajustés séparément pour Noa et Mila ;
les mains restent statiques, sans animation de fermeture des doigts.

Ouvrir **http://localhost:5201/items-3d.html**.

```sh
npm ci
npm run build:items-3d
npm run dev:items-3d
```

Le serveur de l’atelier est en lecture seule. Son port par défaut est 5201
(`PORT` permet de le changer). Les comptes et les données des classes ne sont
pas nécessaires pour essayer les équipements.

## Base livrée et ajustement actuel

La base stabilisée **`base-v2-2026-09` est livrée et intégrée**, après
autorisation du réajustement. Les entrées sont les copies exactes
`assets/items-3d/sources/boy-medium.glb`, `girl-medium.glb` et `manifest.json`,
issues de `test-modelisation/assets/characters-base/`. Seules les deux bases
**medium** sont intégrées, pas les dix carnations de la livraison.
Le manifeste du catalogue conserve la révision, la pose et les SHA-256 sources.

Pose livrée : bras abaissés de **82° depuis T**, coudes fléchis de **8°**, doigts
de **10°**, paumes vers les cuisses ; glTF en mètres, +Y vertical, +Z face,
origine au sol. Le corps avec nuque soudée et ses mains naturelles est importé
entier. Les anciens morceaux de mains à prise sculptée sont abandonnés : les
mains restent dans leur pose naturelle, sans fermeture animée autour des objets.
Les crédits **Nintendo / The Models Resource — Trikeboy** et les adaptations
sont conservés dans `assets/items-3d/provenance.json`.

Les cheveux source sont filtrés via `cosmetic_slot` et remplacés par les cinq
coupes affinées. Chaque sexe réutilise son haut source à manches naturelles ;
l’ajustement du torse ignore les intersections de manches plus proches lors
des projections, et les épaulières partent des ancrages d’épaule. `fit_persona`
filtre chaque pièce selon le personnage. Les lames reposent vers le bas selon
le quaternion de main, le bouclier longe l’extérieur de l’avant-bras gauche ;
lanterne et baguette ont des angles de dégagement, le livre est aminci.

## Contenu de cette version

Les sélections utilisent directement les identifiants et les prix de
`src/domain.mjs` :

- **5 tenues** : Scout, Ranger, Mage, Warrior, Knight. Archmage et King sont
  retirés ; le **titre** King reste.
- **9 couvre-chefs** : No Hat, Goggles, Sunglasses, Beret, Wizard Hat, King’s
  Crown, Helmet, Classy Hat, Royal Crown.
- **Objets** : catégorie retirée ; Empty Hands reste l’état interne
  (`no-weapon`) sans onglet.
- **6 coiffures** : Short Hair (livrée, gratuite, par défaut des garçons) et
  Long Hair (livrée, gratuite, par défaut des filles), Bald (niveau 2, 20),
  Braid (niveau 3, 30), Medium Cut (niveau 3, 30), Spiky Hair (niveau 6, 50) et
  Bun (niveau 6, 50).
- **5 couleurs d'yeux** : Brown (défaut), Green (niveau 3, 30), Blue (niveau 4,
  30), Red (niveau 6, 50) et Violet (niveau 8, 50).
- **7 couleurs de cheveux** : Brown, Blond, Black, White, Red, Green, Blue.
- **5 teints naturels** et **9 titres**.
- No Hat et Empty Hands retirent les objets de leur emplacement.

Soit **une trentaine de modèles équipables**, avec plusieurs pièces nommées par
modèle et des ajustements par sexe. Les carnations sont celles des deux bases
medium.

Les tenues comportent de vrais volumes : jupes de tunique, capes, plastrons,
épaulières, jambières, mantelet et col. Les anneaux de ceinture suivent la
surface du haut de référence. Les coiffures disposent des variantes `open`,
`covered` et `crowned` ; le casque masque les cheveux. Les mains naturelles
de la base livrée sont conservées.

### Finition actuelle des cheveux et couvre-chefs

Les coupes livrées (Short, Long) et la coupe portée (Braid) partagent la matière
cheveux de l’app : carte de normales et de rugosité `hair-normal` /
`hair-roughness`, matière nommée `Hair / …` que le viewer recolore depuis la
palette de la boutique. Chaque coupe existe en trois variantes — `open`,
`covered` (beret, chapeau de sorcier, chapeau chic) et `crowned` (les deux
couronnes) — ajustées une fois pour chaque personnage : une passe de conformité
mesure la distance signée au crâne de **Noa** et de **Mila** et ne relève que
les mèches enfoncées, avec un dégagement minimal de 2 mm sur le visage, le
front et les tempes. `tools/measure-hair-fit.py` rend ce contrôle reproductible
et `tools/port-braid-cut.py` documente l’import de la natte dans le repère de
tête du jeu.

**Finition de l’avant de la Tresse** : la frange portée est une coquille de
mèches séparées ; sur la vraie tête, le front nu apparaissait dans chaque
interstice. `tools/port-braid-cut.py` ajoute donc une **sous-couche de
chevelure** (`hairline underlayer`) au ras du crâne, qui se termine par une
ligne de cheveux festonnée au-dessus des sourcils et referme la nuque et les
côtés ; elle est ajustée par personnage comme le reste de la coupe. La même
passe retire la mèche longue de la tempe droite et raccourcit la mèche centrale
autour de sa racine. Les mèches balayées descendent légèrement sur le front,
en restant avancées devant la peau. Le volume arrière est resserré en
profondeur, avec une transition progressive vers la natte pour conserver
ses entrelacs et le dégagement du dos. La sous-couche descend derrière chaque oreille ; des ombres
entre les mèches restent visibles en très gros plan.
`measure-hair-fit.py` **cumule désormais tous les maillages d’une coupe** pour
qu’aucune pièce ne masque le clipping d’une autre.

Wizard Hat et Classy Hat ont des bords annulaires
avec une véritable ouverture ; le béret est ajusté et
incliné, les couronnes abaissées. **Les deux couronnes utilisent `crowned`**
pour chaque coupe : ajustement radial progressif au niveau du bandeau
métallique, en n’écrasant que le volume du crâne et jamais la frange, ce qui
évite de la faire traverser le visage.

`manifest.json.headFit` conserve l’ancien espace de construction `HEAD_FIT`
(assise à 1,692 m) ; **`headFits` décrit sa transformation vers chaque base
livrée**, à partir de l’ellipse `hat_seat` et de la marge des cheveux.
Les ancrages canoniques sont `hat_seat`, `grip_right`, `grip_left`, `wrist_left`
et `back`. Les pièces attachées conservent la position et le quaternion exacts
du manifeste source dans `attachment_origin` / `attachment_quaternion`, avec
`template_to_character` pour la transformation, en axes glTF. L’ancien
`hat-seat` fixe du snapshot V1 n’est plus le contrat d’attache courant.

## Essayer, comparer et exporter

- Les quatre ensembles Ranger / Mage / Knight / King donnent un point de départ.
- Chaque catégorie reste indépendante et tous les articles sont essayables,
  quel que soit leur niveau dans le jeu. Aucun achat n’est effectué.
- Vues face, trois quarts, dos, tête et objet ; glissement pour tourner,
  rotation automatique uniquement à la demande ; vue ¾ à 0,55 rad.
- La vue Tête recadre automatiquement les limites tête/cheveux/couvre-chef
  après sélection, en utilisant les `head_bounds` enregistrées sur le corps
  entier ; le canvas est redessiné immédiatement au redimensionnement.
  Les matériaux de cheveux conservent trois nuances : base, ombre (×0,78)
  et reflet (×1,18) pour chaque couleur choisie.
- « Voir la référence 2D » montre le rendu SVG actuel avec la même sélection.
- L’adresse contient la combinaison : recharger ou partager cette URL restitue
  les choix, après validation des identifiants.
- Export GLB du **personnage équipé** ou des **équipements seuls**, à leurs
  coordonnées d’ajustement. Les autres variantes sont exclues de l’export.
- Un rendu Blender réel sert de secours si WebGL ou le téléchargement échoue.
- Le lien de référence de l’en-tête télécharge le véritable fichier
  `boy-medium.glb` ou `girl-medium.glb` selon le personnage sélectionné.

Le modèle est en **pose statique évaluée**, comme les bases livrées.
Il ne contient pas de rig d’animation. Les groupes du catalogue
et leurs surfaces restent éditables dans `catalogue.blend`.

## Reconstruction Blender

Avec Blender 4.5 :

```sh
blender --background --factory-startup --python tools/build-items-3d.py
npm run build:items-3d
npm test
```

Le script part des deux snapshots medium locaux et recrée :

| Fichier | Usage |
| --- | --- |
| `assets/items-3d/catalogue.glb` | Collection web avec toutes les alternatives, environ 27 Mo |
| `assets/items-3d/catalogue.blend` | Scène éditable compressée, studio et combinaison de départ, environ 9 Mo |
| `assets/items-3d/preview.png` | Rendu Cycles de la combinaison de départ |
| `assets/items-3d/manifest.json` | Inventaire, révision/pose/SHA sources et ajustements `headFits` |
| `assets/items-3d/web/` | Modules navigateur compilés avec Three.js local |

La modélisation utilise les mètres, Z vertical et face vers −Y dans Blender.
L’export glTF est en Y vertical, face vers +Z. Les propriétés `shop_slot`,
`shop_id`, `hat_fit` et `fit_persona` pilotent la visibilité ; les identifiants sont identiques
à ceux du catalogue du jeu.

Compatibilité d’import Blender : les GLB livrés comportent des scènes vides
sans `nodes` et des nœuds hérités inaccessibles que Blender importe néanmoins.
Le constructeur extrait temporairement le seul graphe de la scène active par
défaut et remappe nœuds/scènes. Il rejette les nœuds actifs liés à un skin, puis
retire les skins et animations inutilisés. Tous les octets BIN de géométrie et
texture, les snapshots originaux et leurs SHA sont conservés ; la branche
productrice n’est pas modifiée.

## Vérification

`tests/items-3d.test.mjs` lit le vrai fichier GLB et vérifie sa couverture du
catalogue, ses dimensions après transformations, les combinaisons de coiffure
et couvre-chef pour les deux personnages, les ancrages des objets, l’exclusion du
corps pour l’export d’items et la validation des URLs partagées.

### Base-v2 — bilan actuel rapporté

Résultats fournis après réajustement, **non rejoués pour cette documentation** :

- **58 tests passés** : SHA et pose sources, conservation pour les deux sexes
  de l’ensemble des positions de peau quantifiées à **10⁻⁵** (pas une preuve
  de topologie intégrale), positions/quaternions de chaque attache conformes au
  manifeste livré, 27 modèles, 108 combinaisons et dégagement de toutes les
  couronnes dans le repère inverse du gabarit. `git diff --check` : réussi.
- Export navigateur réel **Mila / King / Long Hair bleu / Royal Crown /
  Swords & Shield** : personnage **2 794 344 octets, 137 meshes**, dont
  **5 primitives de peau**, toutes les pièces `female`, révision v2 ;
  équipements **2 403 232 octets, 128 meshes**, tous `female`, sans peau,
  `core` ni `persona`. Cheveux `crowned`, ancrages `wrist_left`, `grip_right`,
  `back` et trois nuances conservés.
- Téléchargement de la bonne base selon le sexe, comparaison SVG et restauration
  URL : validés. Bureau **1440 × 1000** et mobile **390 × 844**, commandes sticky
  comprises : sans débordement horizontal.
- Détecteur exécuté une fois : `[]`, mais **DEGRADED** (analyse regex, parser
  manquant). Aperçu réellement rendu dans Blender, provenance embarquée :
  **1 raster, 0 manquant**.

**Nouvelle revue indépendante : SHIP, sans correction demandée**, sur les
sources et captures finales. Verdict limité à cette proposition statique ;
il ne certifie pas l’absence de collisions pour tous les angles et ensembles.

Preuves fournies dans `/tmp/opencode/` : `basev2-desktop-final.png`,
`basev2-mobile-final.png`, `basev2-mobile-controls-final.png` ;
`basev2-collection-first.png` et
`basev2-{male,female}-{ranger,mage,knight,king}-first.png` montrent bien la
**géométrie finale** (seule la copie du lien de référence a changé ensuite).
Les autres `basev2-*-first.png` couvrent grimoire, dagues, crâne chauve et
détail tête/couronne. Captures temporaires, non copiées ici.

### Historique — finition cheveux et couvre-chefs avant base-v2

Résultats de l’ancien snapshot, **non rejoués pour cette documentation** :

- **56 tests passés**, dont contrôle des sommets du vrai GLB binaire pour le
  dégagement radial du bandeau et la conservation de la hauteur du sommet des
  cinq coupes ; couverture des 108 combinaisons et 27 identifiants.
  Bundle et `git diff --check` : **réussis**.
- Export navigateur réel **Long Hair bleu + Royal Crown** : **49 meshes de
  cheveux, tous `crowned`**, ancrages présents et trois nuances conservées.
- Bureau **1440 × 1000**, mobile **390 × 844**, captures des commandes sticky :
  validés sans débordement horizontal. Détecteur sur le JS modifié : `[]` ;
  scan de provenance embarquée PNG : **1 raster, 0 manquant**.

Le même reviewer indépendant a d’abord signalé **FIX** pour les intersections
avec les bandeaux des couronnes. Après une seule passe de correction, son
verdict sur ce point était **RESOLVED / SHIP** pour Noa/Mila de ce snapshot : aucun
blocage restant dans ce périmètre. Il ne s’agit pas d’une nouvelle revue
complète du prototype, ni de la validation base-v2 rapportée ci-dessus.

Captures fournies dans `/tmp/opencode/` : `refined-hair-contact-final.png`,
`refined-hats-contact-final.png`, `refined-desktop-final.png`,
`refined-mobile-final.png`, `refined-mobile-controls-final.png`,
`refined-celestial-crown-final.png`, `refined-afro-crown-final.png` et
`refined-gold-crown-final.png` (preuves temporaires, non copiées ici).

### Historique V1 — bilan rapporté avant la finition

Résultats historiques, **non rejoués ici** : les 55 tests, comptes et tailles
d’export ci-dessous décrivent la V1, pas les géométries actuelles.

- `npm test` : **55 tests passés**, dont lecture du vrai GLB, couverture des
  27 identifiants, dimensions en coordonnées monde, 108 combinaisons
  couvre-chef × coiffure × personnage, filtres d’export, prises et URLs.
- `npm run build:items-3d` : **réussi**. Dans le navigateur, **37 choix**
  sélectionnés : 7 tenues, 9 couvre-chefs, 8 objets, 6 coiffures, 7 couleurs
  (choix de retrait inclus).
- Exports GLB réels de **Mila / Mage / Wizard Hat / Wand / Braids bleues**
  téléchargés et parsés : personnage équipé **99 meshes, 2 305 708 octets**,
  slots `hand/outfit/hair/hat/weapon/core/persona` ; équipements seuls
  **82 meshes, 1 866 196 octets**, slots `outfit/hair/hat/weapon`, sans corps.
  Le matériau bleu des cheveux est conservé.
- Comparaison SVG, arrêt de rotation sur vue prédéfinie, état URL après
  rechargement, poster de secours sur GLB bloqué et reprise : **validés**.
  Mobile **390 × 844 sans débordement horizontal** ; bureau **1440 × 1000**.

Finition indépendante V1 : **SHIP**, première proposition d’équipements statiques,
aucune correction bloquante. La racine brune du cuir chevelu avec cheveux blancs
était consignée comme limitation de texture héritée **non bloquante**.
Détecteur V1 dégradé
(parser manquant), un avertissement Inter hérité sans action à entreprendre.
Le crédit Nintendo / Trikeboy reste applicable au corps ; aucune intégration
d’animation n’est revendiquée. Direction et limites : [DESIGN.md](DESIGN.md).

Captures fournies dans `/tmp/opencode/` : `equipment-desktop-final.png`,
`equipment-mobile-final.png`, `equipment-ranger-final.png`,
`equipment-mage-final.png`, `equipment-knight-final.png`,
`equipment-king-final.png`, `equipment-king-back-final.png` et
`equipment-hair-mobile-final.png` (preuves temporaires, non copiées ici).
Le snapshot source V1 était `assets/items-3d/reference.glb`, remplacé comme
entrée du constructeur par les deux fichiers `sources/*-medium.glb`.
`preview.png` reste un rendu Blender réel avec son sidecar `preview.png.json`.
