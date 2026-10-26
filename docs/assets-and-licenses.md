# Assets : description, provenance et licences

[Documentation](README.md) · [Notices](../THIRD_PARTY_NOTICES.md) · [Contribuer](../CONTRIBUTING.md)

## Description graphique

L'application propose des héros d'aventure fantasy stylisés : silhouettes
humanoïdes, oreilles humaines ou elfiques, expressions lisibles, tenues médiévales
imaginaires et accessoires modulaires. Les personnages sont travaillés dans
Blender et affichés avec Three.js. Cette description esthétique n'est pas une
déclaration d'origine de chaque maillage ou texture.

La licence MIT couvre le code original et la documentation du projet, **pas les
droits des auteurs tiers sur des fichiers importés ou leurs dérivés**. Les
polices et dépendances conservent leurs licences. Aucune conclusion juridique
sur la totalité des médias ne doit être déduite de la seule visibilité du dépôt.

## Inventaire technique à clarifier

Les éléments ci-dessous sont observables dans le dépôt. Ils ne constituent pas
une expertise juridique, et une notice peut devoir être corrigée si une preuve
plus précise de création est disponible. En attendant, ne pas effacer la chaîne
de provenance ni annoncer indistinctement tous les médias comme MIT.

| Famille | Fichiers / dérivés concernés | Éléments de provenance conservés |
| --- | --- | --- |
| Morphologie et premiers personnages | `assets/wardrobe/`, `assets/characters-base/`, `assets/items-3d/sources/boy-medium.glb`, `girl-medium.glb` | Les fichiers `provenance.json` créditent Nintendo / The Models Resource — Trikeboy ; `tools/blender/neutral_link.py` travaille sur une scène importée, puis `build_base_characters.py` adapte le vestiaire |
| Surfaces et visages | `assets/characters-refined/`, `assets/characters-refit/textures/`, `assets/character-detail-study/`, `assets/characters-approved/faces-v1/` | `prepare_surface_reference.py` télécharge des cartes depuis les archives 303154/303172 ; les scripts suivants les retravaillent ; certaines notices d'yeux indiquent aussi une archive sans licence |
| Catalogues assemblés | `assets/items-3d/catalogue.glb`, `catalogue.blend`, `assets/character-stylized/catalogue.glb`, `catalogue.blend` | `tools/build-items-3d.py` importe les snapshots de corps et les modèles de cheveux ; les manifestes relient les builds à leurs empreintes |
| Coiffures fournies | `assets/characters-refit/hair/boy.glb`, `girl.glb`, `medium-cut.glb`, et les variantes qui les réemploient | `boy.json`, `girl.json`, `medium-cut.json` indiquent des archives fournies sans auteur/licence ; archives nommées `blender-hair-model.zip`, `hunter-hairr-obj.zip`, `beautiful-hair-1.zip` |
| Autres imports graphiques | `assets/items-3d/sources/held/hero-shield.glb`, `assets/pets/catalogue.glb`, coiffures `curly.glb`/`bun.glb` | Import de fichiers fournis dans les scripts `held_items`, `build-pets`, `port-braid-cut` et `port-bun-cut` ; compléter les informations d'auteur/licence plutôt que supposer une origine |
| Images dérivées | Portraits de personnages, rendus d'études, `assets/items-3d/previews/portraits/`, image d'accueil dont la provenance est `assets/welcome-valley.provenance.json` | Un rendu du modèle reste lié à sa source ; ne pas considérer le passage en PNG/WebP comme un changement de licence |

Cette table désigne des familles et des dépendances, pas une liste certifiant
que chaque octet de chaque dossier est tiers. Des équipements, scripts et formes
ont aussi été créés localement. Les éléments procéduraux doivent être distingués
des imports au niveau du fichier ou du composant avant une réutilisation séparée.

Les mêmes assets peuvent exister dans les prototypes, anciens commits, tags et
objets LFS. Supprimer une référence dans `main` ne supprime ni un fichier de son
historique, ni les droits qui lui sont applicables.

## Ajouter ou remplacer un asset

Une PR graphique doit fournir :

1. Nom, auteur et URL d'origine, ou indication claire de création originale.
2. Licence exacte et texte/autorisation permettant la redistribution et les modifications.
3. Méthode : création procédurale, modélisation, génération, import ou adaptation.
4. Empreinte du fichier source, dépendances et liste des sorties régénérées.
5. Captures et tests : slots, silhouettes, ancrages, transparence et coût de chargement.

Pour un asset original, indiquer explicitement la licence choisie pour le média ;
ne pas déduire celle-ci de la licence du JavaScript. Pour un fichier tiers,
« téléchargeable », « gratuit » ou « fait dans Blender » ne remplace pas une licence.
Ne pas supprimer les notices OFL ou les crédits nécessaires.

## Corriger la provenance

Une description neutre de l'inspiration convient aux textes de présentation.
Une attribution technique factuelle est différente : la correction doit préciser
quels fichiers étaient mal attribués, comment leur origine a été établie, et
quels builds/portraits/historiques restent concernés. Un remplacement de source
doit être testé sans simplement réécrire les empreintes attendues.
