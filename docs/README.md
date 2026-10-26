# Documentation de Class Odyssey

Cette documentation décrit le code de `main`, pas nécessairement la version
actuellement déployée sur le site. Les documents techniques changent avec les PR ;
le [wiki GitHub](https://github.com/motmot3000/Class-Odyssey/wiki) en est la porte
d'entrée. Les études et anciens documents ne sont pas des spécifications actives.

## Utiliser et comprendre

| Guide | Contenu |
| --- | --- |
| [Présentation](../README.md) | Objectif, maturité, IA et engagement de maintenance |
| [Installation](getting-started.md) | Prérequis, Git LFS, lancement et dépannage |
| [Règles du jeu](game-rules.md) | XP, niveaux, PV, monnaie, boutique et sélection |
| [État et feuille de route](project-status.md) | Existant, limites et priorités sans échéance imposée |
| [Assets et licences](assets-and-licenses.md) | Provenance, droits à clarifier et ouverture publique |

## Développer

| Guide | Contenu |
| --- | --- |
| [Contribuer](../CONTRIBUTING.md) | Proposer un changement et préparer une PR |
| [Carte du code](code-map.md) | Couches, changements d'état et invariants |
| [Développement et tests](development.md) | Commandes, sources/builds et contrôles manuels |
| [Backend](../BACKEND.md) | API, configuration, persistance et déploiement générique |
| [Console d'administration](../admin-console/README.md) | Outil opérateur séparé, accès et limites |
| [Sécurité](../SECURITY.md) | Signalement privé et données de test |
| [Conduite](../CODE_OF_CONDUCT.md) | Échanges et modération des contributions |
| [Historique des branches](branch-archives.md) | Tags des anciennes branches et restauration |

## Graphisme et 3D

- [Pipeline des équipements](items-3d/README.md) : géométrie, aperçus et builds.
- [Révision des personnages](characters-refit/README.md) : textures et ancrages.
- [Identité visuelle](../assets/brand/README.md) : pack de marque et polices.
- [Inventaire de droits](assets-and-licenses.md) : à lire **avant** de réutiliser
  ou de proposer un modèle, une texture ou une image.

## Ateliers 3D et archives historiques

Les ateliers de développement (`items-3d.html`, `character-lab.html`,
`character-detail-study.html`, `assets/labs/index.html`) et leurs notes de
direction (`docs/*/DESIGN.md`) servent à inspecter et valider les modèles 3D.
Les anciens prototypes autonomes, vues remplacées et notes de passation ont été
retirés de l'arbre de travail ; ils restent consultables dans l'historique Git
et les tags `archive/*` ([Historique des branches](branch-archives.md)). Le
runtime actif est identifié dans la [carte du code](code-map.md).

Les sources Markdown du wiki vivent dans `docs/wiki/` pour être relues en PR.
Les indications de publication sont dans [Développement](development.md#documentation-et-wiki).
