# Game of More — Backend

Le backend Node sauvegarde les comptes, classes, élèves, XP, niveaux, HP, skins
et monnaie sur le VPS Infomaniak. Le `localStorage` du navigateur reste un cache
hors ligne isolé par compte. Aucun backend PHP n'est utilisé.

## Production

```text
navigateur
    │ https://game-of-more.lecagibi.ch
    ▼
Caddy sur le VPS
    │ reverse proxy vers 127.0.0.1:5180
    ▼
conteneur Docker Node
    ├── frontend statique : index.html, styles.css, src/, assets/
    ├── API comptes et jeu : /api/*
    └── volume persistant : /srv/apps/game-of-more/data
```

Le frontend, l'API et les données sont donc centralisés sur le VPS. Pendant la
propagation DNS, l'ancien hébergement peut relayer provisoirement toutes les
requêtes vers `www.thomaswunsche.com/_game-of-more-site/`. Le navigateur garde
dans tous les cas l'URL Game of More.

## Configuration obligatoire

Le premier démarrage requiert exclusivement ces variables d'environnement :

- `FOUNDER_USERNAME` : identifiant du compte fondateur ;
- `FOUNDER_PASSWORD` : mot de passe initial du compte fondateur.

Elles doivent être fournies au processus `docker compose` par l'environnement
du VPS ou un fichier `.env` non versionné. Aucune valeur secrète ne doit être
écrite dans le dépôt. `HOST`, `PORT`, `DATA_DIR` et `MAX_BACKUPS` restent
configurables ; le conteneur utilise `HOST=0.0.0.0`, tandis que son port est
publié uniquement sur la boucle locale du VPS.

Au premier démarrage, `data/state.json`, s'il existe, est copié atomiquement
dans l'état du compte fondateur (`admin`). Le fichier d'origine n'est renommé
en `state.json.migrated` qu'après l'écriture durable de l'index des comptes. Il
reste ainsi récupérable. Les comptes créés ensuite commencent avec des classes
7P et 8P vides.

## API

| Méthode | Route                                      | Rôle |
|---------|--------------------------------------------|------|
| GET     | `/api/health`                              | Vérifie le conteneur |
| POST    | `/api/accounts`                            | Crée un compte et son état vide |
| POST    | `/api/session`                             | Ouvre une session |
| GET     | `/api/session`                             | Vérifie la session courante |
| DELETE  | `/api/session`                             | Révoque la session courante |
| POST    | `/api/session/verify`                      | Vérifie le mot de passe pour la console enseignant |
| PUT     | `/api/session/password`                    | Change le mot de passe et révoque les autres sessions |
| GET     | `/api/state`                               | Lit l'état du compte connecté |
| PUT     | `/api/state`                               | Écrit l'état si sa révision est courante |
| GET     | `/api/admin/accounts`                      | Liste les comptes (`admin`) |
| PUT     | `/api/admin/accounts/:id/password`         | Réinitialise le mot de passe d'un autre compte (`admin`) |

Les routes autres que `health`, inscription et connexion exigent
`X-Session-Token`. Les jetons ne sont stockés que sous forme de condensat
SHA-256, les mots de passe avec `scrypt`, et aucune réponse d'administration
n'expose ces valeurs. Connexion et inscription sont limitées par adresse sans
différencier un identifiant existant d'un identifiant inconnu.

Chaque état porte une `revision`. Un `PUT` obsolète reçoit `409` et ne remplace
jamais une sauvegarde plus récente. Les écritures sont atomiques et les 60
dernières versions sont conservées dans le dossier `backups/` propre au compte.
L'index des comptes possède également ses propres copies de récupération.

## Côté navigateur

- L'application affiche le cache `localStorage` du compte connecté, puis charge
  `/api/state` depuis la même origine.
- Chaque modification déclenche un `PUT /api/state` après 300 ms.
- Le frontend et l'API partagent directement la même origine sur le VPS.
- En cas de coupure réseau, le cache local permet de continuer et une nouvelle
  synchronisation est tentée à la visite suivante.
- Une réponse `401` ou une déconnexion oublie la session, jamais un cache local
  marqué comme non synchronisé.
- Un conflit `409` suspend les écritures, conserve la copie locale et propose
  de l'exporter ou de charger explicitement la copie serveur. La copie locale
  est archivée sur l'appareil avant ce chargement.

## Déploiement VPS

Les fichiers d'exécution se trouvent dans `/srv/apps/game-of-more` :

```text
/srv/apps/game-of-more/
├── Dockerfile
├── compose.yaml
├── server/
│   ├── server.mjs
│   └── api.mjs
├── index.html
├── styles.css
├── src/
├── assets/
└── data/
    ├── accounts.json
    ├── sessions.json
    ├── account-backups/
    ├── state.json.migrated
    └── accounts/<id>/
        ├── state.json
        └── backups/
```

Depuis le dépôt local, copier la configuration avec la clé SSH du VPS :

```bash
rsync -az \
  -e "ssh -i ~/.ssh/infomaniak_ssh/infomaniak_vps" \
  .dockerignore Dockerfile compose.yaml server index.html styles.css src assets \
  debian@<IP_DU_VPS>:/srv/apps/game-of-more/
```

Puis reconstruire et contrôler le service :

```bash
cd /srv/apps/game-of-more
export FOUNDER_USERNAME
export FOUNDER_PASSWORD
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=100
curl -fsS http://127.0.0.1:5180/api/health
```

Le port Docker est publié uniquement sur `127.0.0.1`. Caddy est le seul service
Web exposé publiquement et utilise la configuration versionnée dans
`deploy/vps/game-of-more.lecagibi.ch.caddy`.

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
