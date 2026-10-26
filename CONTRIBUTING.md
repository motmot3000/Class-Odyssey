# Contribuer à Class Odyssey

**Bienvenue !** Les contributions de code, tests, documentation, traduction,
accessibilité, création graphique et retours pédagogiques sont utiles.
French and English contributions are welcome. Merci de lire aussi le
[code de conduite](CODE_OF_CONDUCT.md) et la [politique de sécurité](SECURITY.md).

Le projet est jeune et personnel. Thomas Wünsche décide des orientations et
des merges ; les relectures et réponses se font selon ses disponibilités, sans
délai garanti. Ouvrir une PR ne garantit pas son intégration.

## Avant de commencer

- Lire le [README](README.md), l'[installation](docs/getting-started.md), les
  [règles](docs/game-rules.md) et la [carte du code](docs/code-map.md).
- Chercher une issue ou PR existante pour éviter les doublons.
- Pour un gros changement de pédagogie, d'architecture, de stockage, de dépendance
  ou de catalogue, proposer d'abord le problème et l'approche dans une issue.
- Pour une petite correction claire, une PR ciblée suffit.
- Une faille ou une donnée personnelle exposée doit être signalée **en privé**,
  jamais dans un rapport public détaillé.

## Branches et pull requests

`main` est l'unique branche active d'intégration. Il n'y a pas de branche `dev`
à cibler. Les anciennes versions sont conservées par [tags d'archive](docs/branch-archives.md).

```sh
git clone https://github.com/VOTRE-COMPTE/Class-Odyssey.git
cd Class-Odyssey
git remote add upstream https://github.com/motmot3000/Class-Odyssey.git
git fetch upstream
git switch -c fix/short-description upstream/main
```

Ces commandes supposent que vous avez d'abord créé votre fork sur GitHub.
Suivre ensuite l'installation locale, puis proposer une PR **vers `main` du
dépôt d'origine**. Un accès collaborateur permet aussi une branche directement
sur le dépôt. Ne pas pousser directement sur `main`, réécrire l'historique
partagé ou créer une branche permanente pour chaque ancienne version.

Une PR doit être cohérente et limitée à son objectif. Le titre et les commits
sont en anglais, de préférence `type(scope): short imperative subject`.
Le corps peut être en français ou anglais et doit expliquer :

1. Le problème, l'effet attendu et les fichiers/couches concernés.
2. Les tests réellement exécutés et leur résultat, pas seulement la commande prévue.
3. Les captures anonymisées si l'interface change, FR/EN et mobile si concernés.
4. Les risques, limites, migrations et retour arrière éventuels.
5. L'origine et la licence des nouveaux fichiers graphiques ou du code tiers.

Après intégration, une branche de travail peut être supprimée ; un merge ne
déclenche pas automatiquement une publication sur le site.

## Règles de code

- Modules JavaScript ESM `.mjs`, style et conventions du fichier existant.
- Garder les transitions du jeu dans `src/domain.mjs`, sans DOM ni réseau.
- Les vues rendent du HTML échappé ; l'orchestration passe par `src/app.mjs`.
- Préserver les invariants de session, de révision et d'isolation des comptes.
  Toute opération asynchrone doit vérifier qu'elle vise toujours le même compte.
- Les changements de format doivent conserver les anciens états ou fournir une
  migration documentée, testée et récupérable.
- Préserver les identifiants d'objets et de stockage utilisés dans les sauvegardes ;
  renommer une étiquette ne justifie pas de casser les données existantes.
- Traduire les chaînes visibles en FR/EN par les clés existantes.
- Pas de dépendance lourde, de service externe ou de refonte sans besoin discuté.
- Modifier les sources des bundles, pas les fichiers minifiés à la main.
- Ne jamais réduire la couverture ou contourner un contrôle pour faire passer un test.

Les [invariants détaillés](docs/code-map.md) et le
[guide de développement](docs/development.md) complètent ces règles.

## Vérification minimale

```sh
git lfs pull
npm ci
npm run check
git diff --check
```

Python 3 est requis pour le contrôle syntaxique ; Blender ne l'est pas pour cette
suite. Les tests de GLB nécessitent les vrais objets LFS.
Une PR documentaire n'a pas besoin de modifier/reconstruire les assets.
Pour les parcours affectés, compléter les tests automatiques par des vérifications
manuelles ciblées et indiquer ce qui n'a pas été testé. Ne pas annoncer « tous
les tests passent » si une commande n'a pas été exécutée ou a échoué.

## IA et « vibe coding »

L'aide d'outils d'IA est autorisée et une partie du projet a été développée ainsi.
Mentionnez une aide substantielle dans la PR, sans publier votre conversation
privée, des secrets ou des données de classe. Vous restez responsable de :

- comprendre le changement et pouvoir l'expliquer ;
- vérifier les API, le comportement et les tests générés ;
- contrôler la licence et la provenance de ce qui est ajouté ;
- limiter le bruit et les modifications sans rapport avec le sujet.

Une sortie d'IA n'est ni une preuve de test ni une garantie d'originalité.
Pas de réécriture massive non relue ou de série de PR automatiques sans objectif.

## Données, secrets et licences

Utiliser uniquement des personnes et classes fictives dans les tests et captures.
Ne jamais ajouter `.env`, jetons, mots de passe, exports réels, journaux de
production, fichiers de comptes ou base GeoIP. Nettoyer un screenshot ne suffit
pas si les mêmes données sont présentes dans un JSON joint.

Les contributions originales de code/documentation sont proposées sous la
[licence MIT](LICENSE) du projet ; vous devez avoir les droits nécessaires.
Aucun CLA ni transfert de propriété supplémentaire n'est demandé.
Les médias et composants tiers gardent leurs droits : lire les
[notices](THIRD_PARTY_NOTICES.md) et l'[inventaire](docs/assets-and-licenses.md).

## Bonnes premières contributions

- Corriger un guide en reproduisant ses commandes sur un clone propre.
- Ajouter un test de non-régression à un bug confirmé.
- Vérifier clavier, contraste, lisibilité sur TBI et écrans étroits.
- Améliorer une traduction en gardant les deux langues cohérentes.
- Proposer un modèle original avec sources et licence explicitement documentées.

Une issue utile explique ce qui a été fait, attendu et observé, avec la version
du code, le navigateur et une reproduction fictive. Merci de rester patient et
respectueux : [code de conduite](CODE_OF_CONDUCT.md).
