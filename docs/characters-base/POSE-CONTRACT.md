# Contrat commun — personnages de base / items

Accord avec `items/update` : bras abaissés de 82–85° depuis la pose T,
coudes légèrement fléchis, paumes vers les cuisses. La cible d’export est
**82°**, avec un léger dégagement pour éviter les collisions avec le pantalon.

- glTF : repère droit, **+Y vers le haut, visage vers +Z**, mètres.
- Blender : **+Z vers le haut, visage vers −Y**, mètres.
- Origine du modèle : au sol, au milieu des pieds.
- Gauche/droite : côtés anatomiques du personnage ; gauche vers +X en vue de face.
- Quaternions JSON : ordre **x, y, z, w**.
- Ancrages locaux : relatifs à la racine du personnage ; `world` donne la
  transformation dans la scène de référence, dont la racine est à l’identité.

Le manifeste final `assets/characters-base/manifest.json` doit contenir, pour
chaque personnage : centre et sommet du crâne, sommet des cheveux, assise de
chapeau avec ellipse et repères front/tempes/occiput, nuque/cou, épaules,
poignets et centres de prise, avec positions et quaternions.

Les cheveux sont séparés du visage et du cuir chevelu et identifiés par
`short` (garçon) et `long` (fille), en cohérence avec le catalogue existant.
Les textures de peau ne portent pas de racines peintes.

**État :** exports stabilisés et manifeste généré. Les dix variantes conservent
la même géométrie par personnage ; seule la carnation varie.

- `boy-medium.glb` et `girl-medium.glb` : références pour l’ajustement des items.
- `base-characters.blend` : scènes éditables des deux bases.
- `manifest.json` : ancrages et variantes. Les rayons de l’assise sont mesurés
  sur une section du crâne, avec 6 mm de marge ; le centre du crâne est un repère
  anatomique de placement. Les ancrages de membres sont issus des articulations.
- Meshes cheveux : `cosmetic_slot=hair`, `hair_id=short` ou `long`.
- Autres pièces : `part=skin`, `part=eyes` ou `part=clothes`.

La nuque est fermée par un raccord aux sommets exacts des bords tête/corps,
puis soudée. Les contrôles `boy-neck-check.png` et `girl-neck-check.png`
montrent ce raccord sans les cheveux.

## Réimport Blender 4.5

`items/update` a confirmé la compatibilité des ancrages. Il a également relevé
un défaut de l’importeur Blender 4.5 : certaines scènes vides du GLB omettent
`nodes` (valide selon glTF), ce qui peut provoquer une erreur dans `imp/vnode.py`.
Son contournement consiste à ajouter `nodes: []` à ces seules scènes dans une
copie temporaire avant import. Les géométries, textures et identifiants de scènes
restent identiques. Les exports stabilisés ne sont pas modifiés pendant le retargeting.

Le retour final d’`items/update` précise que l’import normalise également les
nœuds historiques non atteignables depuis la scène active (par exemple
`Rolled tunic hem`). Cette normalisation reste limitée à une copie temporaire.

## Validation du retarget par items/update

Validation communiquée par l’agent `items/update` après livraison de base-v2 :

- Retarget terminé, aucun problème d’ancrage signalé.
- 27 modèles ; chaque pièce porte `fit_persona`. Les cheveux, chapeaux et
  objets tenus conservent les ancrages anatomiques et `template_to_character`.
- Corps et mains repris sans découpe ; comparaison de tous les points de peau
  source à une tolérance de `1e-5`, pour les deux personnages.
- 58 tests et revue visuelle `SHIP` rapportés par cet agent.
- Exports du look et des items contrôlés ; aucun corps ni autre personnage
  inclus dans l’export des seuls items.

Sorties dans le worktree `items-update` :

- `assets/items-3d/catalogue.glb` — environ 27 Mo.
- `assets/items-3d/catalogue.blend` — environ 9 Mo, compressé.
- `assets/items-3d/manifest.json` — révision et pose source, SHA et `headFits`
  par personnage.

Démo de ce retarget : <http://localhost:5201/items-3d.html>.
Ces résultats sont ceux communiqués par `items/update`, pas une nouvelle
exécution des tests dans `test-modelisation`.
