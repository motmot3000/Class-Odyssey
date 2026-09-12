# Game of More - Backend

## Production

Etat verifie le 7 septembre 2026 : le site et son API Node fonctionnent sur
le VPS Infomaniak, pas sur l'ancien hebergement Web Apache/PHP.

```text
https://game-of-more.lecagibi.ch
    -> Caddy
    -> 127.0.0.1:5180
    -> service Docker Compose api, dans /srv/apps/game-of-more
    -> /data, monte depuis /srv/apps/game-of-more/data
```

Le volume contient les comptes, sessions, donnees applicatives et sauvegardes.
Il doit rester prive et persistant. Ne jamais le remplacer par des donnees de
developpement ou par l'ancien etat PHP. La configuration `.env` de production
doit egalement rester sur le VPS, hors Git.

Les limites ressources canoniques du service `api` sont dans
`/srv/apps/game-of-more/compose.yaml` sur le VPS : `mem_limit: 512m`,
`memswap_limit: 512m`, `cpus: 1.0`, `pids_limit: 64`. Les conserver lors
des prochains deploiements. Les copies sources locales divergent de la
production ; la copie `/orca` est ancienne et ne doit pas servir de reference
ni etre synchronisee en production sans comparaison prealable.

## Deploiement

La cible SSH est `infomaniak-vps`, repertoire `/srv/apps/game-of-more`.
L'alias `infomaniak-goM` designe l'ancien hebergement et ne doit plus servir
aux deploiements.

Attention : cette copie locale contient encore des elements historiques.
Comparer les sources avec celles du VPS avant toute synchronisation ; ne pas
envoyer ce repertoire en bloc en production. Ne jamais ecraser `.env` ou `data/`.

Apres sauvegarde privee des donnees et mise a jour des seules sources validees,
reconstruire depuis le repertoire de production sur le VPS :

```bash
docker compose up -d --build --wait api
docker compose ps
curl -fsS https://game-of-more.lecagibi.ch/api/health
```

Ne pas utiliser `docker compose down -v`. Le controle de sante ne remplace pas
un test fonctionnel avec un compte autorise ; ne pas afficher les donnees
des classes dans les journaux de verification.

## Historique et sauvegardes

Les migrations Raspberry Pi et PHP sont terminees. Ne pas rejouer les anciennes
instructions de copie vers `sites/game-of-more.lecagibi.ch/` ou `var/state.json`.
Les anciennes copies Web et les deux exports historiques de Game of More sont
conserves sur le VPS dans `/srv/backups/web-legacy-20260907/`.

La console enseignant propose aussi un export/import JSON. Une copie sur le
meme VPS n'est pas une sauvegarde independante contre la perte du serveur.
