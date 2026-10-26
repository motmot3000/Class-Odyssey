# Architecture et règles de fonctionnement

Class Odyssey utilise du JavaScript ESM côté navigateur et un serveur HTTP
Node.js. Three.js gère les personnages. Les données sont des fichiers JSON
isolés par compte ; le navigateur maintient un cache local.

| Couche | Responsabilité |
| --- | --- |
| `src/domain.mjs` | Catalogue et transitions de jeu, sans DOM ni réseau |
| `src/state-schema.mjs` | Validation de forme partagée entre navigateur et API |
| `src/app.mjs` | Routage, actions, état d'interface et synchronisation |
| `src/views/` | HTML échappé ; écran actif principal dans `odyssey.mjs` |
| `src/session.mjs`, `src/api.mjs` | Compte, session et appels API bornés |
| `server/server.mjs` | Routes et contrôles HTTP |
| `server/api.mjs` | Comptes, dérivation des mots de passe, stockage et sauvegardes |
| `server/static.mjs` | Fichiers publics autorisés, pas les données ou secrets |

## Invariants à préserver dans une PR

1. Une action produit une transition de domaine avant sauvegarde.
2. Le cache reste lié au bon compte et conserve les changements non synchronisés.
3. Un PUT porte la révision courante ; un conflit reçoit 409, sans écrasement implicite.
4. Un résultat asynchrone ne doit pas modifier le compte qui a remplacé celui
   capturé au départ de la requête.
5. Le verrou enseignant n'est pas une identité serveur distincte par élève.
6. Le stockage suppose un seul écrivain Node par dossier de données.

## Chaîne 3D

Les modèles de look, slots et sélections sont distincts du rendu Three.js.
Un canvas visible est partagé entre vues ; les portraits utilisent un renderer
hors écran et un cache borné. La durée de vie de l'hôte et celle des ressources
doivent toutes deux être vérifiées pour éviter les montages tardifs.
Les bundles générés doivent provenir des sources, pas être retouchés à la main.

Voir la [carte complète du code](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/code-map.md)
et le [pipeline 3D](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/items-3d/README.md).
Les prototypes et anciens renderers ne sont pas automatiquement le runtime du jeu.
