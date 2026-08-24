# Game of More — Backend

Le backend sauvegarde les comptes enseignants et, pour chacun, ses classes,
élèves, XP, niveaux, HP, skins et monnaie, sur l'hébergement Infomaniak. Le
`localStorage` du navigateur reste un cache hors ligne.

## Production

```text
navigateur
    │ https://game-of-more.lecagibi.ch
    ▼
Apache Infomaniak
    ├── fichiers statiques : index.html, styles.css, src/, assets/
    └── /api/* → api/index.php
                      │
                      ▼
                 var/accounts.json          comptes et empreintes de mots de passe
                 var/sessions.json          jetons de session en cours
                 var/accounts/<id>/state.json
                 var/accounts/<id>/backups/state-*.json (60 versions)
```

Le dossier `var/` est refusé par Apache et ignoré par Git. Les fichiers de
données sont créés avec des permissions privées. Les écritures sont protégées
par `flock`, atomiques (fichier temporaire puis `rename`) et précédées d'une
sauvegarde horodatée.

`GAME_OF_MORE_DATA_DIR` permet de placer les données ailleurs si cette variable
d'environnement est fournie à PHP. Sans elle, `var/` à la racine du site est
utilisé.

## API

| Méthode | Route                   | Rôle                                          |
|---------|-------------------------|-----------------------------------------------|
| GET     | `/api/health`           | Vérifie l'API et identifie le stockage        |
| POST    | `/api/accounts`         | Crée une classe (`username`, `displayName`, `password`) |
| POST    | `/api/session`          | Connecte (`username`, `password`) → jeton     |
| DELETE  | `/api/session`          | Déconnecte le jeton présenté                  |
| POST    | `/api/session/verify`   | Revérifie le mot de passe (ouverture console) |
| PUT     | `/api/session/password` | Change le mot de passe (`current`, `next`)    |
| GET     | `/api/state`            | Lit l'état du compte connecté (404 si vide)   |
| PUT     | `/api/state`            | Valide puis remplace l'état du compte         |

Toutes les routes sauf `health`, `accounts` et la connexion exigent l'en-tête
**`X-Session-Token`**. Un en-tête à nous plutôt qu'`Authorization`, que
certaines configurations Apache retirent avant PHP.

La taille maximale d'un état est de 10 Mio. Le serveur pose lui-même
`updatedAt` après une écriture réussie.

## Comptes

Un compte porte un identifiant (3 à 32 caractères : lettres, chiffres, point,
tiret, souligné), un nom de classe affiché et l'empreinte `password_hash` de
son mot de passe. Le mot de passe en clair n'est jamais stocké ni renvoyé.

Chaque compte reçoit un dossier `var/accounts/<id>/` avec son état et ses
sauvegardes. Un jeton ne donne accès qu'au dossier de son compte : l'isolation
ne dépend pas du navigateur.

Les jetons vivent 30 jours dans `var/sessions.json`, sous forme de condensé
SHA-256 — le jeton lui-même n'existe que dans le navigateur. Changer un mot de
passe révoque tous les autres jetons du compte.

Dix échecs en cinq minutes renvoient `429` avec un `retryAfter` en secondes.
Le compteur vit dans la fiche du compte et se vide à la première réussite.

## Premier démarrage et reprise des données

Si `var/accounts.json` n'existe pas, l'API crée le compte `motmot3000` avec le
mot de passe `121517`, puis **adopte l'état déjà présent** : `var/state.json`
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
- Une réponse `401` ramène à la page d'accueil sans rien effacer : le cache
  local garde ce qui n'était pas encore parti.
- Pour que la console s'ouvre même sans réseau, l'appareil garde une
  dérivation PBKDF2 (150 000 tours, sel propre à l'appareil) du mot de passe.
  Le mot de passe lui-même ne quitte jamais le navigateur.
- Portée : cette barrière protège la console, pas les données. `PUT
  /api/state` reste ouvert au compte connecté, pour que les élèves puissent
  acheter dans la boutique.

## Déploiement Infomaniak

Le site se trouve dans `~/sites/game-of-more.lecagibi.ch` sur l'accès SSH
Infomaniak. Déployer les fichiers applicatifs sans supprimer `var/` :

```bash
rsync -az \
  --exclude .git --exclude node_modules --exclude var --exclude server/data \
  .htaccess index.html styles.css src assets api package.json \
  infomaniak-goM:sites/game-of-more.lecagibi.ch/
```

Vérifications après déploiement :

```bash
curl -fsS https://game-of-more.lecagibi.ch/api/health
curl -fsS https://game-of-more.lecagibi.ch/api/state
```

## Mise en service des comptes

1. Déployer, puis ouvrir le site : le compte `motmot3000` est créé et reprend
   les classes existantes.
2. Vérifier que `var/state.json.migrated` existe et que la classe s'affiche
   après connexion.
3. Changer le mot de passe depuis la console.
4. Garder `state.json.migrated` quelques semaines : c'est la copie d'avant.

## Sauvegarde manuelle

La console enseignant propose aussi l'export/import JSON. Utiliser un export
avant une longue période sans cours fournit une copie indépendante du serveur.
