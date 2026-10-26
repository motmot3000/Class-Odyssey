# Branches et archives

**`main` est la seule branche active d'intégration.** Les contributions utilisent
des branches temporaires ou des forks et proposent une PR vers `main`.
Il n'y a pas de branche `dev` permanente à cibler.

Les anciennes branches de version ne sont plus actives. Leur pointe et leur
historique sont conservés par des tags annotés avant leur retrait de la liste
des branches :

| Ancienne branche | Tag d'archive |
| --- | --- |
| `version/alpha` | `archive/alpha-2026-10-26` |
| `version/beta` | `archive/beta-2026-10-26` |

Ces tags sont des **archives**, pas des versions prises en charge, des releases
stables ou la preuve d'un déploiement. L'archive alpha conserve notamment des
commits non intégrés à `main` ; leur suppression de la liste des branches ne
doit donc pas signifier une perte de travail.

Consulter une archive sans modifier `main` :

```sh
git fetch origin --tags
git switch --detach archive/alpha-2026-10-26
```

Pour reprendre ce travail, créer une nouvelle branche depuis le tag plutôt
que modifier le tag lui-même. Les détails et empreintes sont dans
[Historique des branches](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/branch-archives.md).

Une PR fusionnée n'est pas automatiquement déployée sur le site.
