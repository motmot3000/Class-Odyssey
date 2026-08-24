# Game of More

Premier draft d'application web pour ludifier les cours d'anglais avec des personnages d'élèves, XP, niveaux, HP, skins et récompenses.

## Lancer (développement local)

```bash
export FOUNDER_USERNAME
export FOUNDER_PASSWORD
npm start
```

Puis ouvrir :

```text
http://localhost:5180
```

Les deux variables fondateur sont obligatoires lors de la première
initialisation. Le mot de passe ne doit jamais être ajouté au dépôt. Pour les
données de développement, `DATA_DIR` peut pointer vers un dossier temporaire.

## Deux interfaces

- **Teacher** (`#board`) : plateau de classe + console d'attribution (XP, HP,
  argent, ajout/suppression d'élèves), protégée par une seconde saisie du mot de
  passe du compte.
- **Students** (`#student`) : chaque élève retrouve son héros, consulte ses
  stats (HP, XP, niveau, argent) et dépense son argent dans la boutique
  (achat + équipement). Le héros choisi est mémorisé sur l'appareil.

La bascule entre les deux se fait via les onglets **Teacher / Students**
dans l'en-tête, à côté des onglets de classe.

Chaque enseignant dispose d'un compte, d'un état et de sauvegardes isolés. Le
compte fondateur a le rôle `admin` et voit en plus la page **Accounts**, qui
permet de consulter les comptes et de réinitialiser le mot de passe d'un autre
compte.

## Production (sauvegarde partagée)

En production, le frontend et le backend Node sont réunis dans le même
conteneur sur le VPS Infomaniak. Caddy sert le domaine public et les données
persistantes restent montées hors du conteneur. N'importe quelle machine qui
ouvre l'URL retrouve les données de son compte.

Voir `BACKEND.md` pour l'architecture, le déploiement Infomaniak et l'API.

## Structure du code

```text
index.html          coque HTML (topbar + zones app/toasts/dialogues)
styles.css          système visuel : tokens, composants, adaptations
src/app.mjs         état d'interface, routage, événements délégués, persistance
src/session.mjs     session du compte et verrou de la console enseignant
src/domain.mjs      règles du jeu (XP, HP, argent, boutique) — testé
src/avatar.mjs      héros et icônes en SVG
src/ui.mjs          briques de stats partagées (cœurs, barre XP, argent, niveau)
src/views/board.mjs      plateau de classe (grille et liste)
src/views/console.mjs    console de l'enseignant
src/views/student.mjs    choix du héros et casier de l'élève
src/views/shop.mjs       boutique, partagée entre les deux interfaces
src/views/rules.mjs      page des règles
src/views/modals.mjs     vue plein écran d'un héros, aperçu d'un article
src/views/admin.mjs      gestion des comptes réservée aux administrateurs
server/server.mjs        serveur HTTP Node et routes API
server/api.mjs           stockage atomique, comptes, sessions et sauvegardes
```

Les vues ne produisent que du HTML ; `app.mjs` est seul à écouter les
événements (`data-action` délégué sur `#app`) et à écrire l'état.

## Tester

```bash
npm test
```

## Documentation

Le cadrage du draft est dans `docs/PRODUCT_DRAFT.md`.
