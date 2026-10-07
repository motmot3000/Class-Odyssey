# Objets à modéliser — backlog & workflow

Ce fichier est le point d'entrée pour déléguer la modélisation d'un nouvel
item : « modélise la tenue de pirate », « modélise la hache », « modélise le
cheval ». Un agent lit ce document, choisit le pipeline concerné (§ Workflow),
cherche des exemples (§ Sources), produit les assets et les intègre à
l'application, puis incrémente les révisions.

Style cible : médiéval-fantastique accueillant, silhouettes lisibles, matières
mates, sans mascotte enfantine ni chibi ni violence sombre
([PRODUCT.md](../PRODUCT.md)). Détails de construction :
[docs/items-3d/DESIGN.md](items-3d/DESIGN.md) et
[docs/items-3d/README.md](items-3d/README.md).

---

## 1. Backlog validé

Niveaux et prix sont des suggestions dans la continuité de la boutique actuelle
(une tenue par niveau jusqu'au niveau 10, prix croissants) ; ils se discutent
avant intégration.

### 1.1 Armes (main droite / bras gauche) — pipeline A

| # | Item | Slot | Niv. | Prix | Notes |
|---|------|------|------|------|-------|
| 1 | Hache | weapon | 4 | 40 | Manche bois + tête acier |
| 2 | Arc | weapon | 6 | 65 | Avec carquois dans le dos (`back`) |
| 3 | Marteau | weapon | 7 | 80 | Alternative « force » à l'épée |
| 4 | Lance | weapon | 8 | 95 | Complète `honor-knight` |
| 5 | Sceptre | weapon | 10 | 110 | Cohérent avec `gold-crown` |
| 6 | Lanterne | weapon | 2 | 15 | Une main, prix bas ; existe déjà en 2D (`lore-lantern`) |
| 7 | Grimoire | weapon | 5 | 50 | Existe déjà en 2D (`spell-grimoire`) |

### 1.2 Animaux / familiers — pipeline B

| # | Item | Niv. | Prix | Notes |
|---|------|------|------|-------|
| 1 | Poney / cheval | 10 | 150 | **Très cher**, modèle compact (~0,9 m au garrot), au sol |
| 2 | Chouette | 5 | 60 | Épaule ou au sol ; thème école/mage |
| 3 | Renard | 6 | 70 | |
| 4 | Tortue | 2 | 20 | Petit format, niveau d'entrée |

### 1.3 Tenues — pipeline C

| # | Item | Niv. | Prix | Notes |
|---|------|------|------|-------|
| 1 | Maillot de foot | 2 | 35 | Tenue funky, numéro au dos, short + chaussettes |
| 2 | Smoking | 6 | 80 | Nœud papillon |
| 3 | Costard | 5 | 70 | Costume complet, cravate |
| 4 | Robe de soirée | 7 | 90 | Longue, élégante |
| 5 | Robe classe | 4 | 55 | Mi-longue, habillée |
| 6 | Samouraï | 7 | 85 | Complète le katana (`japanese-blade`) existant |
| 7 | Viking | 6 | 75 | Complète hache/marteau |
| 8 | Druide | 5 | 65 | Thème nature/animaux |
| 9 | Pirate | 4 | 60 | Va avec cache-œil (accessoire) |
| 10 | Érudit | 3 | 45 | Complète le grimoire |
| 11 | Prince / Princesse | 9 | 105 | Complète sceptre + couronne |
| 12 | Grand Archmage | 9 | 100 | **Déjà dessiné en 2D** (`grand-archmage` dans `src/avatar.mjs`), retiré du catalogue |
| 13 | Souverain du Royaume | 10 | 120 | **Déjà dessiné en 2D** (`realm-sovereign`), retiré du catalogue |

### 1.4 Chaussures — **nouvelle catégorie `shoes`** (slot à créer)

Les bottes sont aujourd'hui fondues dans chaque tenue
(`split_footwear` / `core_part: 'boots'` dans `tools/build-items-3d.py`) et
toujours visibles. La catégorie exige : pieds neutres dans les tenues
complètes, pièce `shoes` interchangeable montée sur les deux bases.

| # | Item | Niv. | Prix | Notes |
|---|------|------|------|-------|
| 1 | Chaussures classiques | 1 | 0 | Défaut gratuit (les bottes actuelles) |
| 2 | Baskets | 2 | 20 | |
| 3 | Bottes | 3 | 30 | |
| 4 | Bottes de cowboy | 5 | 55 | |
| 5 | Chaussures classe | 4 | 40 | Richelieues vernies |
| 6 | Chaussures d'aventurier | 3 | 35 | Bottines lacées |
| 7 | Tongs | 2 | 15 | Fun |
| 8 | Sandales gladiateur | 4 | 35 | Reste dans le ton médiéval |
| 9 | Bottes de pluie | 2 | 25 | Couleurs vives |

### 1.5 Peaux / marquages (catégorie `tone`)

| # | Item | Niv. | Prix | Notes |
|---|------|------|------|-------|
| 1 | Tatouages de runes | 7 | 60 | **Déjà dessiné en 2D** (`tattooed-skin`), retiré du catalogue |
| 2 | Peau dorée | 9 | 80 | **Déjà dessinée en 2D** (`golden-skin`), retirée du catalogue |
| 3 | Taches de rousseur | 1 | 0 | Naturel, se combine avec les 5 teints |
| 4 | Peinture de guerre | 5 | 45 | Traits de couleur sur les joues |

Attention : l'ancien `yakuza-tattoos` (2D) ne convient pas à un public 11-13
ans — s'il est repris, redessiner en motifs tribaux/runes.

### 1.6 Couleurs de cheveux

| # | Item | Niv. | Prix | Notes |
|---|------|------|------|-------|
| 1 | Violet | 4 | 30 | Cohérent avec les tenues mage |
| 2 | Rose | 4 | 30 | |
| 3 | Cuivre / orange | 3 | 25 | Entre rouge et blond |

### 1.7 Coiffures

| # | Item | Niv. | Prix | Notes |
|---|------|------|------|-------|
| 1 | Queue de cheval | 2 | 20 | |
| 2 | Couettes | 3 | 30 | Deux tresses |
| 3 | Tresse longue | 4 | 35 | Vérifier doublon avec `curly` (la Tresse actuelle) avant modélisation |
| 4 | Coupe royale | 8 | 85 | **Déjà dessinée en 2D** (`royal-hair`), retirée du catalogue |

### 1.8 Titres

| # | Item | Niv. | Prix | Notes |
|---|------|------|------|-------|
| 1 | Chasseur de mots | 9 | 90 | Comble le trou niveau 9 (actuellement 8 → 10) |
| 2 | Polyglotte | 8 | 85 | Thème anglais |
| 3 | Bon camarade | 2 | 20 | Valorise l'entraide (valeur produit) |
| 4 | Esprit d'équipe | 3 | 30 | Idem |

### 1.9 Yeux

| # | Item | Niv. | Prix | Notes |
|---|------|------|------|-------|
| 1 | Ambre / doré | 5 | 40 | Va avec peau dorée et dragon |
| 2 | Gris | 2 | 20 | Neutre manquant |

---

## 2. Sources d'exemples (à consulter avant de modéliser de zéro)

- Flux Sketchfab (donné par l'enseignant) : <https://sketchfab.com/feed>
- Recherche filtrée « téléchargeable » :
  - Armes : <https://sketchfab.com/search?features=downloadable&q=stylized+medieval+weapon+pack&type=models>
  - Animaux : <https://sketchfab.com/search?features=downloadable&q=stylized+low+poly+animal&type=models>
  - Tenues/persos : <https://sketchfab.com/search?features=downloadable&q=stylized+outfit+low+poly&type=models>
- Autres sources libres : [poly.pizza](https://poly.pizza) (CC0),
  [kenney.nl](https://kenney.nl) (CC0), packs gratuits itch.io.

Exemples repérés (vérifier la licence avant tout usage) :

| Usage | Lien | Intérêt |
|-------|------|---------|
| Pack armes (hache, marteau, arc, lance, bouclier, carquois) | [Weapons Low Poly — Azuria](https://sketchfab.com/3d-models/weapons-low-poly-shield-axe-hammer-bow-spear-f19ef91889834d438e8ee90cf27e6ee8) | Jeu de stylisé low-poly cohérent, palette partagée |
| Pack armes médiévales | [Lowpoly Medieval Weapon Pack — Mongze](https://sketchfab.com/3d-models/lowpoly-medieval-weapon-pack-267dbe8a05ad4d50a7c0ff3cc28cbb5f) | Gratuit, ~350 tris par arme |
| Pack viking (hache, marteau, lance) | [Viking Weapon Pack](https://sketchfab.com/3d-models/viking-weapon-pack-low-poly-game-ready-43e24ec645814ea7b208d5819f11e5a3) | FBX/GLB/OBJ/Blender |
| Cheval | [Low Poly Horse — Ravenlilli](https://sketchfab.com/3d-models/low-poly-horse-482710cb9b0b4020a852ee709abd6cb9), [Stylized Horse — Riina Koivisto](https://sketchfab.com/3d-models/stylized-horse-183a31d34fb04f7aa66a979fa50cacf3) | Silhouette stylisée |
| Chouette, renard, animaux | [Stylized Animals — GameAssetsFin](https://sketchfab.com/MarkoJantti/collections/stylized-animals-8e3ea651d11f4e4c86d60d48c4048b0b) | Collection entière, même style |
| Pirate | [Stylized Pirate — JoshyClintoon](https://sketchfab.com/3d-models/stylized-pirate-193d614d8f2c4df9b58809c96ef92987) | Référence de silhouette |

**Règles de licence :** « téléchargeable » ne veut pas dire « libre d'usage ».
Privilégier CC0 / CC-BY (crédit obligatoire) / « free to use ». Écarter les
modèles payants, les mentions `NoAI` (interdisent l'usage comme entrée d'IA —
or nos adaptations passent par des agents) et toute licence ambiguë. Consigner
la source dans `provenance.json` (nom d'archive, SHA-256, auteur, licence,
adaptations) ; les archives originales ne sont **jamais** commitées (voir
[assets/pets/README.md](../assets/pets/README.md)).

---

## 3. Workflow d'un nouvel item (délégation agent)

### Étape 0 — Cadrer

Identifier : slot (`weapon`, `shield`, `hat`, `outfit`, `shoes`, `pet`,
`hair`, `hairColor`, `eyeColor`, `tone`, `accessory`, `title`), niveau/prix,
pipeline (A/B/C ci-dessous), et s'il existe déjà en 2D dans `src/avatar.mjs`
(raccourci de référence visuelle).

### Étape 1 — Chercher des exemples

Parcourir § Sources (Sketchfab, poly.pizza, kenney.nl). Si un modèle téléchargeable
avec licence compatible et style cohérent existe → **pipeline B (adaptation)**.
Sinon → **pipeline A ou C (procédural Blender)**, en utilisant les modèles
trouvés comme référence visuelle uniquement.

### Étape 2 — Modéliser / adapter

| Pipeline | Pour quoi | Où | Comment |
|----------|-----------|----|---------|
| **A — procédural** | armes, boucliers, objets tenus | `tools/blender/held_items.py` + `tools/build-items-3d.py` | Ajouter une fonction maker dans `BLADES`/`SHIELDS` (ou `SOURCED` pour un GLB fourni) ; matières mates (acier satiné, laiton brossé, bois, cuir châtain) ; lame au repos vers le bas |
| **B — adaptation** | animaux/familiers | `tools/build-pets.py` | Archive zip en argument (GLB/FBX/OBJ + textures) ; adapter : matières mates peintes, pose statique, pas de rig ni animation, visage de jeu si besoin (grands yeux ronds), échelle réelle (`heightMeters`), partagé garçon/fille |
| **C — procédural** | tenues, couvre-chefs | `tools/build-items-3d.py` | Volumes mesurés sur les bases `sources/boy-medium.glb` et `sources/girl-medium.glb` ; drapé des capes depuis le col ; `coversLegs` si la tenue apporte ses jambes |

Constantes de construction : mètres, Blender Z-up face -Y / glTF Y-up face +Z,
origine au sol, pose statique (bras 82° depuis T, coudes 8°, doigts 10°).
Budgets : ~2k–22k triangles selon l'item (voir les budgets dans
`assets/pets/manifest.json` et `assets/items-3d/manifest.json`).

### Étape 3 — Adapter garçon/fille

Tout item se monte sur **les deux** bases (personas `male`/`female`) :

- objets tenus : ancrages `grip_right`, `grip_left`, `wrist_left` (quaternions
  par main ; bouclier à l'extérieur de l'avant-bras gauche) ;
- objets dorsaux : `back` (arc, carquois, lanterne ?) ;
- couvre-chefs : `hat_seat` + marges `headFits` (pas de flottement, pas de
  coupe de cheveux traversée) ;
- tenues : `fit_persona`, `shop_slot`, `shop_id` ; pas d'intersection avec les
  cuisses ni les mains (cf. lanterne/livre dégagés) ;
- familiers : au sol près du héros (sauf monté épaule comme le perroquet),
  hauteurs cohérentes (lapin 0,30 m → dragon 0,70 m).

### Étape 4 — Intégrer au catalogue 3D

1. Reconstruire : commandes § 4.
2. Mettre à jour le manifeste (`assets/items-3d/manifest.json` ou
   `assets/pets/manifest.json`) : parties, triangles, bounds, `validation: PASS`.
3. Régénérer les miniatures (`assets/items-3d/previews/items/<id>.webp` + manifests).
4. Incrémenter les révisions : `CATALOGUE_REVISION` ou `PETS_REVISION` dans
   `src/items-3d-model.mjs`, et `APPEARANCE_REVISION` / `REVISION` dans les scripts.
5. Compléter la provenance (`provenance.json`, README du dossier d'assets).

### Étape 5 — Intégrer à l'application

1. `src/domain.mjs` : ajouter l'entrée dans le tableau du slot
   (`WEAPONS`, `PETS`, `SKINS` (tenues), `HATS`, `SHIELDS`, `HAIRS`,
   `HAIR_COLORS`, `EYE_COLORS`, `ACCESSORIES`, `SKIN_TONES`, `TITLES`) avec
   `{ id, name, minLevel, price, description }` — l'id doit matcher le nom de
   pièce du catalogue 3D.
2. `src/items-3d-model.mjs` : catégorie, palettes (`HAIR_PALETTE`,
   `SKIN_TONE_COLORS`…), révisions.
3. Nouvelle catégorie `shoes` : créer le slot dans `domain.mjs`,
   `items-3d-model.mjs` (CATEGORIES, `visiblePart`) et le viewer.
4. noms traduits si besoin : `src/i18n.mjs` / `src/i18n-extra.mjs`.

### Étape 6 — Tests et vérification

```sh
npm run build:items-3d
npm run build:odyssey
npm run check        # check-source + tests
npm test
```

Contrôle visuel dans le viewer (`items-3d.html?model=/assets/...`) : cinq vues,
rotation, **garçon et fille**, item essayé avec et sans chapeau/cheveux, pas
d'intersection, lisible en petite carte. Seules les preuves de ces commandes
permettent d'annoncer « terminé ».

---

## 4. Commandes utiles

```sh
# Catalogue complet d'équipements (pipeline A + C)
flatpak run --cwd="$PWD" org.blender.Blender -b --factory-startup \
  --python-exit-code 1 --python "$PWD/tools/build-items-3d.py"

# Base stylisée (live)
STYLIZED=1 HAIR_ITEMS=short,long,medium-cut,curly,spiky,bun \
  flatpak run --cwd="$PWD" org.blender.Blender -b --factory-startup \
  --python-exit-code 1 --python "$PWD/tools/build-items-3d.py"

# Familiers depuis des archives sources (pipeline B)
flatpak run --cwd="$PWD" org.blender.Blender -b --factory-startup \
  --python-exit-code 1 --python "$PWD/tools/build-pets.py" -- \
  /chemin/archives.zip ...

npm run build:items-3d && npm run build:odyssey && npm run check
```

Détails de reconstruction : [assets/pets/README.md](../assets/pets/README.md) et
[docs/items-3d/README.md](items-3d/README.md#reconstruction-blender).

---

## 5. Format de tâche déléguée

> **Modélise la tenue de pirate** — voir `docs/objets-a-modeliser.md` § 1.3 (ligne
> Pirate) et § 3. Pipeline C. Cherche d'abord des exemples (§ 2), sinon modélise
> en procédural dans le style du catalogue. Garçon/fille, manifeste, previews,
> entrée `domain.mjs`, révisions, `npm run check` au final.

L'agent rapporte : source retenue (et licence) ou « procédural », révisions
incrémentées, résultats des commandes de § 6, et toute décision de style
(écart au DESIGN.md).
