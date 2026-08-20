# Game of More — Backend

Le backend sauvegarde les classes, élèves, XP, niveaux, HP, skins et monnaie
sur l'hébergement Infomaniak. Le `localStorage` du navigateur reste uniquement
un cache hors ligne.

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
                 var/state.json
                 var/backups/state-*.json (60 versions)
```

Le dossier `var/` est refusé par Apache et ignoré par Git. Les fichiers de
données sont créés avec des permissions privées. Les écritures sont protégées
par `flock`, atomiques (fichier temporaire puis `rename`) et précédées d'une
sauvegarde horodatée.

`GAME_OF_MORE_DATA_DIR` permet de placer les données ailleurs si cette variable
d'environnement est fournie à PHP. Sans elle, `var/` à la racine du site est
utilisé.

## API

| Méthode | Route         | Rôle                                |
|---------|---------------|-------------------------------------|
| GET     | `/api/health` | Vérifie l'API et identifie le stockage |
| GET     | `/api/state`  | Lit l'état sauvegardé (404 si vide) |
| PUT     | `/api/state`  | Valide puis remplace l'état complet |

La taille maximale d'un état est de 10 Mio. Le serveur pose lui-même
`updatedAt` après une écriture réussie.

## Côté navigateur

- L'application affiche immédiatement son cache `localStorage`, puis charge
  `/api/state` depuis la même origine.
- Chaque modification déclenche un `PUT /api/state` après 300 ms.
- En cas de coupure réseau, le cache local permet de continuer et une nouvelle
  synchronisation est tentée à la visite suivante.

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

## Migration depuis l'ancien Raspberry Pi

1. Arrêter brièvement les écritures ou mettre le site en maintenance.
2. Copier `~/services/game-of-more/data/state.json` du Pi vers le `var/` du
   site Infomaniak.
3. Déployer `.htaccess` et `api/index.php`, puis vérifier par HTTPS que l'état
   lu est identique.
4. Faire un PUT de contrôle, relire l'état et vérifier la création d'un backup.
5. Seulement après ces contrôles, désactiver le service et le Funnel du Pi.
6. Conserver une archive finale hors du dossier de service avant de supprimer
   l'ancienne copie d'exécution.

Le serveur Node historique (`server/server.mjs`) reste disponible pour lancer
une instance locale avec `npm start`; il n'est plus utilisé en production.

## Sauvegarde manuelle

La console enseignant propose aussi l'export/import JSON. Utiliser un export
avant une longue période sans cours fournit une copie indépendante du serveur.
