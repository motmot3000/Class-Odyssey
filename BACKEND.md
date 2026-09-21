# Class Odyssey — Backend

Le backend Node sauvegarde les comptes, classes, élèves, XP, niveaux, HP, skins
et monnaie sur le VPS Infomaniak. Le `localStorage` du navigateur reste un cache
hors ligne isolé par compte. Aucun backend PHP n'est utilisé.

## Production

```text
navigateur
    │ https://classodyssey.com
    ▼
Caddy sur le VPS
    │ reverse proxy vers 127.0.0.1:5180
    ▼
conteneur Docker Node
    ├── frontend statique : index.html, styles.css, src/, assets/
    ├── API comptes et jeu : /api/*
    └── volume persistant : /srv/apps/classquest/data
```

Le frontend, l'API et les données sont donc centralisés sur le VPS. Pendant la
propagation DNS, l'ancien hébergement peut relayer provisoirement toutes les
requêtes vers `www.thomaswunsche.com/_class-odyssey-site/`. Le navigateur garde
dans tous les cas l'URL Class Odyssey.

## Configuration obligatoire

Le premier démarrage requiert exclusivement ces variables d'environnement :

- `FOUNDER_USERNAME` : identifiant du compte fondateur ;
- `FOUNDER_PASSWORD` : mot de passe initial du compte fondateur.

La connexion Google est facultative : renseigner à la fois `GOOGLE_CLIENT_ID` et
`GOOGLE_CLIENT_SECRET` (identifiants OAuth 2.0 « application Web » créés dans la
console Google) pour activer le bouton. L'URI de redirection autorisée est
`https://<domaine>/api/auth/google/callback` (ou l'URL locale
`http://127.0.0.1:<port>/api/auth/google/callback` en développement).
`GOOGLE_REDIRECT_URI` force cette adresse si le proxy ne transmet pas le bon
hôte. Sans ces variables, `/api/config` annonce `google: false` et aucune
connexion Google n'est proposée.

Elles doivent être fournies au processus `docker compose` par l'environnement
du VPS ou un fichier `.env` non versionné. Aucune valeur secrète ne doit être
écrite dans le dépôt. `HOST`, `PORT`, `DATA_DIR`, `MAX_BACKUPS` et `TRUST_PROXY`
restent configurables ; le conteneur utilise `HOST=0.0.0.0`,
tandis que son port est publié uniquement sur la boucle locale du VPS.

`TRUST_PROXY=1` fait lire l'adresse client dans `X-Forwarded-For` (posée par
Caddy) : nécessaire pour que la limitation de débit soit par visiteur et non
partagée par toute l'instance derrière le reverse proxy. À ne pas activer sans
proxy de confiance devant l'application, car l'en-tête serait alors falsifiable.

En développement local, `npm run dev` (utilisé par Go Live) et `npm start`
chargent automatiquement le fichier `.env` à la racine du worktree. Copier `.env.example`
vers `.env` et y renseigner les identifiants avant le premier démarrage, comme
décrit dans `README.md`. Les variables déjà exportées restent prioritaires.
Le mode de développement choisit automatiquement un port libre si le port
configuré est occupé et affiche l'URL effective.

Au premier démarrage, `data/state.json`, s'il existe, est copié atomiquement
dans l'état du compte fondateur (`admin`). Le fichier d'origine n'est renommé
en `state.json.migrated` qu'après l'écriture durable de l'index des comptes. Il
reste ainsi récupérable. Les comptes créés ensuite commencent avec des classes
7P et 8P vides.

## API

| Méthode | Route                                      | Rôle |
|---------|--------------------------------------------|------|
| GET     | `/api/health`                              | Vérifie le conteneur |
| GET     | `/api/config`                              | Fonctionnalités publiques (connexion Google active ou non) |
| GET     | `/api/auth/google`                         | Redirige vers Google (OAuth 2.0 + PKCE) |
| GET     | `/api/auth/google/callback`                | Reçoit le code Google et ouvre la session |
| POST    | `/api/auth/google/exchange`                | Échange le code à usage unique contre un jeton de session |
| POST    | `/api/accounts`                            | Crée un compte et son état vide |
| POST    | `/api/session`                             | Ouvre une session |
| GET     | `/api/session`                             | Vérifie la session courante |
| DELETE  | `/api/session`                             | Révoque la session courante |
| POST    | `/api/session/verify`                      | Vérifie le mot de passe pour la console enseignant |
| PUT     | `/api/session/password`                    | Change le mot de passe et révoque les autres sessions |
| PUT     | `/api/account/terms`                       | Enregistre l'acceptation des textes légaux (comptes créés via Google) |
| GET     | `/api/state`                               | Lit l'état du compte connecté |
| PUT     | `/api/state`                               | Écrit l'état si sa révision est courante |
| GET     | `/api/admin/accounts`                      | Liste les comptes (`admin`) |
| PUT     | `/api/admin/accounts/:id/password`         | Réinitialise le mot de passe d'un autre compte (`admin`) |

Les routes autres que `health`, inscription et connexion exigent
`X-Session-Token`. Les jetons ne sont stockés que sous forme de condensat
SHA-256, les mots de passe avec `scrypt` (asynchrone, sel de 16 octets, dérivé
de 32 octets, comparaison en temps constant), et aucune réponse d'administration
n'expose ces valeurs. Le mot de passe fait au minimum 6 caractères. Une session
dure 14 jours ; le changement de mot de passe révoque les autres sessions.
La création d'un compte exige `termsAccepted: true` ; le serveur enregistre
`terms: { acceptedAt, version }` sur le compte (version issue de
`src/terms.mjs`). Les comptes créés via Google, dont le flux ne peut pas
afficher la case, acceptent les textes à la première connexion via
`PUT /api/account/terms`.
Connexion et inscription sont limitées par adresse (via `X-Forwarded-For` quand
`TRUST_PROXY=1`) sans différencier un identifiant existant d'un identifiant
inconnu. Le nombre de comptes n'est pas plafonné ; c'est la **taille** qui est
bornée : un état fait au plus 4 Mo et les sauvegardes d'un compte au plus 64 Mo
au total (en plus de la rotation des 60 versions), donc un compte ne peut pas
remplir le disque à lui seul.

Les réponses API portent `Cache-Control: no-store`, `X-Content-Type-Options:
nosniff` et `Referrer-Policy`. Caddy, seul service public, ajoute HSTS et les
en-têtes de sécurité du snippet `deploy/vps/security-headers.caddy`.
L'état écrit est borné (classes, élèves, longueurs, caractères de contrôle
interdits) avant persistance.

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

Les fichiers d'exécution se trouvent dans `/srv/apps/classquest` :

```text
/srv/apps/classquest/
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
  debian@<IP_DU_VPS>:/srv/apps/classquest/
```

Puis reconstruire et contrôler le service :

```bash
cd /srv/apps/classquest
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
`deploy/vps/classodyssey.com.caddy`.

Après une modification Caddy :

```bash
sudo -u caddy -H caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Sauvegardes

- Données actives : `/srv/apps/classquest/data/` sur le VPS.
- Rotation applicative : 60 versions dans `data/backups/`.
- Archive de la migration depuis le Pi conservée sur l'hébergement Infomaniak
  dans `~/cagipi_backup/`.
- La console enseignant propose aussi l'export/import JSON pour conserver une
  copie indépendante du serveur.
