# Game of More — Backend

Le backend sauvegarde les comptes enseignants et, pour chacun, ses classes,
élèves, XP, niveaux, HP, skins et monnaie sur le VPS Infomaniak. Le
`localStorage` du navigateur reste un cache hors ligne.

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
       backend Node
           └── /data/accounts.json
           └── /data/sessions.json
           └── /data/accounts/<id>/state.json
           └── /data/accounts/<id>/backups/state-*.json
```

Le frontend reste donc sur l'hébergement classique. Seuls l'API et son stockage
persistent tournent sur le VPS.

En attendant la publication DNS de `api.game-of-more.lecagibi.ch`, le transport
HTTPS entre les deux hébergements passe par le chemin privé
`www.thomaswunsche.com/_game-of-more-api/`. Le navigateur ne voit jamais cette
URL : pour lui, l'API reste `/api` sur le domaine Game of More.

## API

| Méthode | Route                   | Rôle                                          |
|---------|-------------------------|-----------------------------------------------|
| GET     | `/api/health`           | Vérifie que le conteneur fonctionne           |
| POST    | `/api/accounts`         | Crée une classe (`username`, `displayName`, `password`) |
| POST    | `/api/session`          | Connecte (`username`, `password`) → jeton     |
| DELETE  | `/api/session`          | Déconnecte le jeton présenté                  |
| POST    | `/api/session/verify`   | Revérifie le mot de passe (ouverture console) |
| PUT     | `/api/session/password` | Change le mot de passe (`current`, `next`)    |
| GET     | `/api/state`            | Lit l'état du compte connecté (404 si vide)   |
| PUT     | `/api/state`            | Valide puis remplace l'état du compte         |

Toutes les routes sauf `health`, `accounts` et la connexion exigent l'en-tête
**`X-Session-Token`**.

Les écritures sont atomiques et précédées d'une sauvegarde horodatée. Les 60
dernières versions de chaque compte sont conservées dans son dossier
`data/accounts/<id>/backups/`. Cette limite est configurable avec
`MAX_BACKUPS`.

## Comptes

Un compte porte un identifiant (3 à 32 caractères : lettres, chiffres, point,
tiret, souligné), un nom de classe affiché et une empreinte scrypt de son mot
de passe. Le mot de passe en clair n'est jamais stocké ni renvoyé.

Chaque compte reçoit un dossier `data/accounts/<id>/` avec son état et ses
sauvegardes. Un jeton ne donne accès qu'au dossier de son compte : l'isolation
ne dépend pas du navigateur.

Les jetons vivent 30 jours dans `data/sessions.json`, sous forme de condensé
SHA-256 — le jeton lui-même n'existe que dans le navigateur. Changer un mot de
passe révoque tous les autres jetons du compte.

Dix échecs en cinq minutes renvoient `429` avec un `retryAfter` en secondes.
Le compteur vit dans la fiche du compte et se vide à la première réussite.

## Premier démarrage et reprise des données

Si `data/accounts.json` n'existe pas, l'API crée le compte `motmot3000` avec le
mot de passe `121517`, puis **adopte l'état déjà présent** : `data/state.json`
est copié dans le dossier du nouveau compte et renommé `state.json.migrated`.
Aucune classe n'est perdue et le déploiement ne demande aucune étape manuelle.

Changer ce mot de passe depuis la console juste après la mise en service : il
est écrit dans ce dépôt, donc public.

## Côté navigateur

- L'application demande d'abord un compte ; sans session, aucune donnée n'est
  chargée.
- Elle affiche ensuite son cache `localStorage` (une clé par compte), puis
  charge `/api/state`.
- Chaque modification déclenche un `PUT /api/state` après 300 ms.
- Apache transmet la requête au VPS sans exposer un changement de domaine au
  navigateur.
- Une réponse `401` ramène à la page d'accueil sans rien effacer : le cache
  local garde ce qui n'était pas encore parti.
- Pour que la console s'ouvre même sans réseau, l'appareil garde une
  dérivation PBKDF2 (150 000 tours, sel propre à l'appareil) du mot de passe.
  Le mot de passe lui-même ne quitte jamais le navigateur.
- Portée : cette barrière protège la console, pas les données. `PUT
  /api/state` reste ouvert au compte connecté, pour que les élèves puissent
  acheter dans la boutique.

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
├── server/
│   ├── server.mjs
│   └── api.mjs
└── data/
    ├── accounts.json
    ├── sessions.json
    └── accounts/<id>/
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

## Mise en service des comptes

1. Déployer, puis ouvrir le site : le compte `motmot3000` est créé et reprend
   les classes existantes.
2. Vérifier que `data/state.json.migrated` existe et que la classe s'affiche
   après connexion.
3. Changer le mot de passe depuis la console.
4. Garder `state.json.migrated` quelques semaines : c'est la copie d'avant.

## Sauvegardes

- Données actives : `/srv/apps/game-of-more/data/` sur le VPS.
- Rotation applicative : 60 versions par compte dans
  `data/accounts/<id>/backups/`.
- Archive de la migration depuis le Pi conservée sur l'hébergement Infomaniak
  dans `~/cagipi_backup/`.
- La console enseignant propose aussi l'export/import JSON pour conserver une
  copie indépendante du serveur.
