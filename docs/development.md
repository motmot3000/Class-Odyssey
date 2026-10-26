# Développer et vérifier un changement

[Documentation](README.md) · [Contribution](../CONTRIBUTING.md) · [Carte du code](code-map.md)

## Routine conseillée

1. Partir de `main` à jour et créer une branche courte pour un changement cohérent.
2. Installer avec `npm ci`, récupérer LFS et préparer un `.env` personnel.
3. Utiliser un `DATA_DIR` neuf et uniquement des comptes/classes fictifs.
4. Ajouter un test au niveau approprié avant ou avec la correction.
5. Lancer `npm run check`, relire le diff et vérifier les parcours affectés.
6. Expliquer la preuve, les limites et les migrations éventuelles dans la PR.

Ne pas confondre la réussite de tests HTTP avec une validation visuelle, ni un
build correct avec un déploiement. Aucun test ne doit utiliser la classe réelle
de l'auteur ou les secrets de l'instance en ligne.

## Commandes disponibles

| Commande | Effet |
| --- | --- |
| `npm test` | Tests JavaScript/HTTP avec `node --test` |
| `npm run check` | Analyse syntaxique JS et Python, puis `npm test` |
| `npm run dev:app` | Application/API locale, port de repli possible |
| `npm start` | Application/API avec port strict |
| `npm run dev` | Application 5180 + atelier 5201 en boucle locale |
| `HOST=127.0.0.1 npm run dev:items-3d` | Atelier 3D seul |
| `npm run build:items-3d` | Bundles JavaScript de l'atelier, pas la géométrie |
| `npm run build:odyssey` | Adaptateur JavaScript 3D du jeu |
| `npm run build:characters` | Viewer de l'étude des personnages de base |
| `npm run build:wardrobe` | Viewer de l'étude vestiaire |
| `npm run build:lab` | Viewer du laboratoire de personnages |
| `npm run build:mini` | Viewer du prototype miniature |
| `npm run build:svg` | Variantes SVG ; environnement Python du script nécessaire |
| `npm run console` | Console opérateur indépendante, configuration `.env.console` |

Pour cibler un test :

```sh
node --test tests/domain.test.mjs
node --test tests/server.test.mjs tests/session.test.mjs
```

Le contrôle syntaxique Python utilise `ast.parse`, sans lancer Blender ou les
scripts graphiques. La suite ordinaire examine de vrais fichiers GLB : des
pointeurs LFS ne suffisent pas. Aucun échec ne doit être masqué en supprimant
un test ou en mettant à jour une empreinte sans comprendre le changement.

## Quel fichier modifier ?

| Changement | Sources principales | Vérification attendue |
| --- | --- | --- |
| Progression, PV, achat | `src/domain.mjs` | `tests/domain.test.mjs`, règles documentées |
| Format importé/persisté | `src/state-schema.mjs`, normalisation et API | Cas anciens, limites, données invalides, migration réversible |
| Interface du jeu | `src/views/odyssey.mjs`, `src/app.mjs`, CSS | Tests interface/langues, clavier, mobile et TBI |
| Session ou sauvegarde | `src/session.mjs`, `src/api.mjs`, `server/` | Isolation des comptes, révocation, 401, 409, réseau interrompu |
| Texte traduit | `src/i18n.mjs`, `src/i18n-extra.mjs` | Couverture FR/EN et affichage réel |
| Équipement 3D | Domaine, modèle de look, scripts Blender, viewers | Slots, ancrages, modèle livré et aperçus synchronisés |

`src/views/odyssey.mjs` est l'unique renderer de l'écran de jeu actif (les
anciennes vues `board.mjs` et `student.mjs` ont été retirées). Les clés
historiques `classquest:*` restent utilisées pour le stockage
local ; les renommer sans migration peut rendre un cache inaccessible.

## Sources graphiques et fichiers générés

Ne pas corriger à la main les bundles minifiés dans `assets/odyssey/`,
`assets/items-3d/web/` ou les autres dossiers générés. Modifier la source,
reconstruire le bundle concerné et inclure un résultat cohérent quand il est
versionné. Le bundle d'entrée et ses imports doivent provenir du même build.
Un changement documentaire n'exige pas de reconstruire tous les assets.

La reconstruction géométrique utilise Blender et des scripts Python, distincts
des commandes esbuild. Les étapes, variables et prérequis sont détaillés dans
le [pipeline 3D](items-3d/README.md). Les archives d'origine externes ne sont pas
toutes disponibles dans le dépôt : ne pas annoncer une reconstruction complète
reproductible depuis un clone neuf sans l'avoir démontrée.

Un asset proposé doit préciser auteur, source, licence et méthode de création.
Le fait qu'il soit généré, transformé dans Blender ou téléchargeable ne décide
pas à lui seul de ses droits. Voir [les notices](assets-and-licenses.md).

## Scénarios manuels avant une PR d'interface

- Inscription/connexion, déverrouillage et expiration du verrou enseignant.
- Création de classe et de héros, sélection individuelle puis classe entière.
- Gain d'XP avec passage de niveau, PV, pièces et annulation.
- Shop → achat → Dressing → portrait réellement actualisé ; aperçu sans achat.
- Export/import fictif, rechargement et conservation des données.
- Conflit entre deux onglets/appareils : copie locale conservée, pas d'écrasement.
- Déconnexion/changement de compte pendant une opération asynchrone.
- FR/EN, clair/sombre, clavier, taille mobile et lisibilité en projection.
- Erreurs navigateur et réseau, chargement lent des modèles, nouvelle tentative.

Indiquer précisément ce qui a été essayé, sur quel navigateur/appareil, et ce
qui ne l'a pas été. Les captures doivent être anonymisées.

## Documentation et wiki

La documentation technique dans le dépôt est la référence relue avec le code.
Le wiki apporte une navigation et des résumés avec liens vers ces guides.
Ses sources sont dans `docs/wiki/` : modifier les pages concernées dans la même
PR lorsque le parcours d'accueil change.

Le wiki GitHub est un **dépôt Git séparé**. Le merge d'une PR ne le synchronise
pas automatiquement. Un mainteneur peut le publier après revue :

```sh
git clone https://github.com/motmot3000/Class-Odyssey.wiki.git ../Class-Odyssey.wiki
cp docs/wiki/*.md ../Class-Odyssey.wiki/
git -C ../Class-Odyssey.wiki diff
```

Puis commiter les pages explicitement et pousser le wiki. Au tout premier usage,
GitHub demande de créer une première page depuis l'onglet Wiki. Ne pas remplacer
des changements faits directement sur le wiki sans les comparer et les réintégrer
aux sources. Les liens techniques du wiki ciblent `main` ; pour examiner une
ancienne version, utiliser son commit ou son tag dans le dépôt principal.
