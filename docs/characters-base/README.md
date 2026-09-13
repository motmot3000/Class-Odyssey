# Première intégration des personnages de base

Les vues principales du jeu utilisent les deux bases corrigées : plateau en
grille/liste, console enseignant, sélection élève, casier et dialogue agrandi.

## Modèles

- Garçon et fille, tenue basique uniquement.
- Nuque raccordée aux bords réels tête/corps, puis soudée.
- Coiffures refaites et séparées du visage/scalp ; racines peintes retirées.
- Pose commune convenue avec `items/update` : bras à 82° depuis la T-pose,
  coudes à 8°, doigts détendus ; paumes vers les cuisses.
- Cinq carnations correspondant aux identifiants existants du jeu.
- `assets/characters-base/manifest.json` fournit les fichiers et les ancrages
  position/quaternion locaux et monde. Convention : mètres, +Y haut, +Z face,
  origine au sol, quaternions x/y/z/w.

## Rendu dans l’application

`src/characters.mjs` produit des images WebP légères pour les listes et les
cartes. Le plateau ne crée aucun contexte WebGL. Les portraits de liste pèsent
environ 16 Ko et disposent d’une version 512 px pour les vues plus grandes.

Le dialogue élève charge le modèle choisi selon `gender` et `skinTone`.
`src/character-runtime.mjs` gère le chargement/retry ; le moteur Three.js de
`src/base-character-viewer.mjs` est compilé à part et chargé à la demande.
La fermeture du dialogue libère géométries, matériaux, textures et contexte GPU.
Une fermeture pendant le chargement ne laisse pas de canvas orphelin.

Les achats et l’inventaire restent gérés par le domaine existant. Les aperçus
d’objets utilisent encore leur rendu SVG ; cette livraison concerne la base
du personnage. Le contrat d’items est dans `POSE-CONTRACT.md`.

## Reconstruire

```sh
uv run --with pillow python tools/blender/prepare_base_textures.py
blender --background assets/wardrobe/wardrobe.blend --python-exit-code 1 --python tools/blender/build_base_characters.py
uv run --with pillow python tools/blender/finalize_base_characters.py
npm run build:characters
npm test
```

Pour un contrôle ciblé, `BASE_OUTPUT` et `BASE_TONES=medium` permettent au script
Blender d’écrire un aperçu dans un dossier séparé. Les GLB stabilisés ne doivent
pas être remplacés pendant le retargeting de `items/update`.

## Validation

- 36 tests Node : domaine existant, rendu des vues, résolution des variantes,
  intégrité des GLB/images et contrat d’ancrages.
- Parcours navigateur : plateau sans chargement GLB, garçon/fille et carnations,
  dialogue 3D, dos/visage, vue liste, casier élève, attribution XP et annulation.
- Fermeture clavier et tactile, libération du canvas, chargement interrompu,
  échec réseau puis retry, réutilisation du cache du même modèle.
- Vérifications ordinateur/mobile ; données de test isolées sur le port 5182.

La morphologie source et les textures initiales proviennent des archives
Nintendo/Trikeboy référencées dans `assets/wardrobe/provenance.json`. Cette
intégration conserve ces crédits et ajoute les corrections décrites ici.
