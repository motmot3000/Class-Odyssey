# Branches et versions historiques

[Documentation](README.md) · [Contribuer](../CONTRIBUTING.md)

`main` est la branche active et la cible des pull requests. Les branches de
travail sont temporaires ; il n'y a plus de branche d'intégration `dev` ni de
branche de version historique à utiliser pour du nouveau développement.

## Archives du 2026-10-26

Les pointes des deux anciennes branches sont conservées par des **tags annotés**,
vérifiés sur le dépôt distant avant suppression des références de branches.
L'historique n'est ni réécrit ni fusionné de force dans `main`.

| Ancienne branche | Tag | Commit conservé |
| --- | --- | --- |
| `version/alpha` | `archive/alpha-2026-10-26` | `cb3db4a8ba9621ece6bea0030b609e0489abaa1c` |
| `version/beta` | `archive/beta-2026-10-26` | `756813b6dd7252d2661f3bb3c1463361f193406e` |

Lors de l'archivage, beta est un ancêtre de `main`. Alpha contient deux commits
qui ne sont pas dans `main` ; le tag conserve donc du travail qui ne doit pas
être supprimé sous prétexte que la branche n'est plus active.

Ces tags ne sont pas des releases stables, des versions maintenues ou une
attestation de ce qui est déployé. Ils conservent aussi les limitations de leurs
époques : documentation, modèles, configuration et dépendances peuvent différer.

## Consulter ou reprendre une archive

Depuis un arbre de travail propre :

```sh
git fetch origin --tags
git show --no-patch archive/alpha-2026-10-26
git switch --detach archive/alpha-2026-10-26
```

Pour créer du nouveau travail à partir de l'archive :

```sh
git switch -c work/revisit-alpha archive/alpha-2026-10-26
```

Pour restaurer l'ancienne branche si cela devient réellement nécessaire :

```sh
git branch version/alpha archive/alpha-2026-10-26
git push origin version/alpha
```

Un « stash » n'est pas adapté : il sauvegarde des modifications locales non
commitées, pas les versions publiées d'une branche. Ici les tags gardent un
repère durable consultable et récupérable, sans encombrer les branches actives.
