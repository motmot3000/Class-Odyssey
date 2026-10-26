# Backend, API et exploitation

[Documentation](docs/README.md) · [Installation](docs/getting-started.md) ·
[Architecture](docs/code-map.md) · [Sécurité](SECURITY.md)

## Modèle d'exécution

Un serveur HTTP Node.js sert le frontend statique et l'API depuis la même
origine. Le navigateur garde un cache local par compte ; l'état persistant
de référence est enregistré côté serveur. Il n'y a pas de backend PHP ni
de base SQL. Three.js gère la 3D et MaxMind la GeoIP locale facultative.

```text
navigateur → HTTPS / reverse proxy → serveur Node.js
                                      ├── fichiers publics autorisés
                                      ├── /api/*
                                      └── DATA_DIR hors des sources publiques
```

**Un seul processus Node doit écrire dans un même `DATA_DIR`.** Le contrôle de
révision et les écritures synchrones sérialisent les mutations dans ce processus ;
ce n'est pas un verrou multi-processus. Ne pas lancer plusieurs réplicas sur le
même dossier sans concevoir une autre couche de persistance.

## Configuration

Les commandes npm de l'application lisent `.env` ; les variables déjà exportées
restent prioritaires. Ne jamais commiter de valeurs secrètes.

| Variable | Usage / défaut |
| --- | --- |
| `FOUNDER_USERNAME` | Identifiant du fondateur, requis à l'initialisation |
| `FOUNDER_PASSWORD` | Mot de passe initial, requis à l'initialisation ; ne réinitialise pas un compte existant |
| `HOST` | `127.0.0.1` hors Docker |
| `PORT` | `5180` |
| `DATA_DIR` | `server/data/` hors Docker, `/data` dans le conteneur |
| `MAX_BACKUPS` | `60` versions maximum par rotation, entier positif ou nul |
| `TRUST_PROXY` | `1` uniquement derrière un proxy de confiance contrôlant `X-Forwarded-For` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Les deux sont nécessaires à la connexion Google facultative |
| `GOOGLE_REDIRECT_URI` | URI OAuth explicite si nécessaire ; sinon calculée depuis la requête/proxy |
| `RESEND_API_KEY`, `MAIL_FROM` | Transport d'e-mail de réinitialisation, facultatif |
| `ADMIN_CONSOLE_KEY` | Active `/api/console/*` si au moins 32 caractères ; jamais envoyé au navigateur |
| `GEOIP_DB` | Base City `.mmdb` locale facultative, non fournie par le dépôt |
| `NODE_ENV` | `production` dans Docker ; empêche notamment l'affichage des codes de récupération dans les logs |

### Google et récupération du compte

Déclarer exactement `https://votre-instance.example/api/auth/google/callback`
comme URI autorisée, ou `http://127.0.0.1:5180/api/auth/google/callback` en local.
Un déploiement sous préfixe nécessite aussi le préfixe dans cette URI.
Le proxy doit contrôler les en-têtes d'hôte/protocole et `X-Forwarded-Prefix`.
Ne pas copier les identifiants OAuth de l'instance publique pour un fork.

Un nouveau compte Google accepte les textes légaux puis choisit un mot de passe
de console enseignant. Ce mot de passe n'est pas celui du compte Google et ne
transforme pas le compte en compte à connexion locale. Une authentification
Google récente permet sa récupération.

Sans transport d'e-mail, les codes de réinitialisation sont journalisés **hors
production seulement**. En production, il faut configurer un transport pour que
la personne reçoive le code. Les journaux de développement restent privés.

`compose.yaml` (projet `class-odyssey`) transmet au conteneur `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `RESEND_API_KEY`, `MAIL_FROM`,
`ADMIN_CONSOLE_KEY` et `GEOIP_DB` depuis le `.env` du déploiement. Vérifiez tout
de même la configuration effective (`docker compose config --quiet`) avant d'annoncer
que l'envoi d'e-mails ou Google OAuth sont actifs.

## API

Le contrat effectif est dans `server/server.mjs` et ses tests. Les corps JSON
et les erreurs restent susceptibles d'évoluer pendant la bêta.

| Méthode | Route | Accès / rôle |
| --- | --- | --- |
| GET | `/api/health` | Public, état du processus |
| GET | `/api/config` | Public, disponibilité de Google |
| GET | `/api/auth/google` | Départ OAuth |
| GET | `/api/auth/google/callback` | Retour OAuth |
| POST | `/api/auth/google/exchange` | Code à usage unique → session |
| POST | `/api/accounts` | Inscription avec acceptation des conditions |
| POST | `/api/session` | Connexion locale |
| GET / DELETE | `/api/session` | Vérification / révocation de la session |
| POST | `/api/session/verify` | Vérification du mot de passe enseignant |
| PUT | `/api/session/password` | Changement du mot de passe |
| POST | `/api/session/password/reset` | Demande de récupération |
| POST | `/api/session/password/reset/confirm` | Confirmation du code et nouveau mot de passe |
| PUT | `/api/account/profile` | Profil du compte connecté |
| PUT | `/api/account/settings` | Langue, thème et onboarding du compte |
| PUT | `/api/account/terms` | Acceptation des textes légaux |
| PUT | `/api/account/teacher-password` | Mot de passe console pour nouveau compte Google |
| PUT | `/api/account/teacher-password/recover` | Récupération après authentification Google récente |
| POST | `/api/support/messages` | Demande d'aide du compte connecté |
| GET / HEAD / PUT | `/api/state` | État du compte connecté ; PUT avec révision |
| GET | `/api/admin/accounts` | Session avec rôle `admin` |
| PUT | `/api/admin/accounts/:id/password` | Session `admin` |
| GET | `/api/console/overview` | Clé de console serveur |
| GET | `/api/console/audit` | Clé de console serveur |
| GET | `/api/console/support` | Clé de console serveur |
| PATCH | `/api/console/support/:id` | Clé de console serveur |
| PATCH / DELETE | `/api/console/accounts/:id` | Clé de console serveur |
| DELETE | `/api/console/accounts/:id/sessions` | Clé de console serveur |

Les opérations du compte exigent `X-Session-Token`, hors inscription, connexion,
configuration publique et parcours OAuth/récupération. Les routes `/api/console/*`
utilisent `X-Console-Key`, pas le déverrouillage enseignant du navigateur.
La liste précise des contrôles est à lire dans les handlers, pas à déduire du
seul préfixe de route.

## Persistance et limites

```text
DATA_DIR/
├── accounts.json
├── sessions.json
├── account-backups/
├── support-messages.json
├── admin-audit.jsonl
└── accounts/<id>/
    ├── state.json
    └── backups/
```

- Les nouveaux comptes commencent avec `classes: []` et aucun élève.
- Mots de passe dérivés avec `scrypt` et sel ; jetons de session indexés par
  condensat SHA-256. Une session expire après 14 jours.
- Le changement de mot de passe révoque les autres sessions.
- Écritures via fichier temporaire puis renommage ; copies de récupération des
  états et de l'index des comptes. Ce mécanisme n'équivaut pas à une sauvegarde
  indépendante du disque ou de la machine.
- Un état est limité à **4 Mio** ; sa forme partagée autorise au plus 50 classes
  et 300 héros par classe, avec bornes sur les noms et identifiants.
- La rotation est limitée en nombre (60 par défaut) et en volume (64 Mio par
  ensemble de sauvegardes géré par la rotation).
- Un PUT doit porter la révision courante ; le serveur l'incrémente après
  écriture. Une révision obsolète reçoit **409**, sans écrasement silencieux.
- Le client diffère les sauvegardes d'environ 300 ms et conserve les changements
  non synchronisés. Un conflit suspend les écritures et permet export ou
  chargement explicite de la copie serveur avec archivage local préalable.

Le schéma serveur borne la forme des données ; il ne recalcule pas toutes les
règles économiques du jeu. Le compte enseignant est une autorité de modification
de son propre état. Ne pas présenter l'application comme un serveur compétitif
anti-triche ou un système d'identités séparées pour chaque élève.

## Auto-hébergement

Ces indications sont génériques, pas un accès à l'instance de l'auteur.
Après configuration et récupération des objets LFS :

```sh
docker compose config --quiet
docker compose build
```

Le conteneur tourne sous l'utilisateur `node`, avec racine en lecture seule,
capacités supprimées et volume `./data:/data`. Préparez un dossier de données
accessible en écriture à cet utilisateur avec des droits restreints selon votre
environnement. Évitez une commande de permission globale copiée sans vérification.

Une fois le volume et la sauvegarde préparés :

```sh
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:5180/api/health
```

Le port hôte est publié sur `127.0.0.1` seulement. Un reverse proxy de confiance
termine TLS ; les fichiers `deploy/vps/` illustrent le déploiement de l'auteur,
à adapter avant réutilisation. `TRUST_PROXY=1` n'est approprié que si aucun client
ne peut joindre l'application en contournant ce proxy.

Avant une mise à jour : identifier le commit, sauvegarder `DATA_DIR`, vérifier
les migrations et le retour arrière, lancer les tests et tester avec des données
fictives. Une réponse de santé 200 ne valide ni l'authentification, ni les droits,
ni les sauvegardes, ni le rendu 3D. Après déploiement, vérifier la version réellement
servie et les parcours utilisateur. Le merge GitHub ne fait aucune de ces étapes.

La migration d'un ancien `data/state.json` et les scripts de
`server/migrations/` concernent des formats historiques. Ils ne doivent pas être
lancés au hasard sur une classe en cours d'utilisation.

## Sauvegardes et protection des données

Conserver une copie indépendante du volume, protégée comme les données actives,
et tester une restauration sur une instance isolée. L'export JSON enseignant est
un complément, pas une politique de sauvegarde complète. Ne pas publier un export
réel en issue ou dans une PR. La suppression d'un compte actif ne purge pas
magiquement les sauvegardes externes de l'hébergeur.

L'auto-hébergeur doit adapter les textes légaux, contacts, sous-traitants et durées
de conservation à son propre déploiement. La licence du code n'est ni une
validation juridique de cet usage ni une autorisation de traiter des données élèves.
