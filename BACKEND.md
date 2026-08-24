# Game of More — Backend

Le backend sauvegarde les classes, élèves, XP, niveaux, HP, skins et monnaie
sur le VPS Infomaniak. Le `localStorage` du navigateur reste un cache hors
ligne.

## Production

```text
navigateur
    │ https://game-of-more.lecagibi.ch
    ▼
hébergement Web Infomaniak classique
    ├── frontend statique : index.html, styles.css, src/, assets/
    └── Apache /api/*
             │ proxy HTTPS
             ▼
       endpoint HTTPS du VPS
             │ Caddy
             ▼
       127.0.0.1:5180
             │ Docker
             ▼
       backend Node + /srv/apps/game-of-more/data
```

Le frontend reste donc sur l'hébergement classique. Seuls l'API et son stockage
persistent tournent sur le VPS.

En attendant la publication DNS de `api.game-of-more.lecagibi.ch`, le transport
HTTPS entre les deux hébergements passe par le chemin privé
`www.thomaswunsche.com/_game-of-more-api/`. Le navigateur ne voit jamais cette
URL : pour lui, l'API reste `/api` sur le domaine Game of More.

## API

| Méthode | Route         | Rôle                                |
|---------|---------------|-------------------------------------|
| GET     | `/api/health` | Vérifie que le conteneur fonctionne |
| GET     | `/api/state`  | Lit l'état sauvegardé (404 si vide) |
| PUT     | `/api/state`  | Valide puis remplace l'état complet |

Les écritures sont atomiques et précédées d'une sauvegarde horodatée. Les 60
dernières versions sont conservées dans `data/backups/`.

## Côté navigateur

- L'application affiche immédiatement son cache `localStorage`, puis charge
  `/api/state` depuis la même origine.
- Chaque modification déclenche un `PUT /api/state` après 300 ms.
- Apache transmet la requête au VPS sans exposer un changement de domaine au
  navigateur.
- En cas de coupure réseau, le cache local permet de continuer et une nouvelle
  synchronisation est tentée à la visite suivante.

## Déploiement du frontend

Le frontend reste dans `~/sites/game-of-more.lecagibi.ch` sur l'hébergement
classique :

```bash
ssh infomaniak-goM
cd sites/game-of-more.lecagibi.ch
git pull --ff-only
```

Le dossier historique `var/` n'est plus utilisé après la migration, mais reste
ignoré par Git afin qu'une archive ou une restauration locale ne soit jamais
commitée.

## Déploiement du backend VPS

Les fichiers d'exécution se trouvent dans `/srv/apps/game-of-more` :

```text
/srv/apps/game-of-more/
├── Dockerfile
├── compose.yaml
├── server/server.mjs
└── data/
    ├── state.json
    └── backups/
```

Depuis le dépôt local, copier la configuration avec la clé SSH du VPS :

```bash
rsync -az \
  -e "ssh -i ~/.ssh/infomaniak_ssh/infomaniak_vps" \
  .dockerignore Dockerfile compose.yaml server \
  debian@<IP_DU_VPS>:/srv/apps/game-of-more/
```

Puis reconstruire et contrôler le service :

```bash
cd /srv/apps/game-of-more
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=100
curl -fsS http://127.0.0.1:5180/api/health
```

Le port Docker est publié uniquement sur `127.0.0.1`. Caddy est le seul service
Web exposé publiquement et utilise la configuration versionnée dans
`deploy/vps/api.game-of-more.lecagibi.ch.caddy`.

Après une modification Caddy :

```bash
sudo -u caddy -H caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Sauvegardes

- Données actives : `/srv/apps/game-of-more/data/` sur le VPS.
- Rotation applicative : 60 versions dans `data/backups/`.
- Archive de la migration depuis le Pi conservée sur l'hébergement Infomaniak
  dans `~/cagipi_backup/`.
- La console enseignant propose aussi l'export/import JSON pour conserver une
  copie indépendante du serveur.
