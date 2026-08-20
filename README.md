# Game of More

Premier draft d'application web pour ludifier les cours d'anglais avec des personnages d'élèves, XP, niveaux, HP, skins et récompenses.

## Lancer (développement local)

```bash
python3 -m http.server 5173
```

Puis ouvrir :

```text
http://localhost:5173
```

Sans backend, l'application sauvegarde dans le `localStorage` du navigateur.

## Deux interfaces

- **Teacher** (`#board`) : plateau de classe + console d'attribution (XP, HP,
  argent, ajout/suppression d'élèves). C'est la vue ouverte par défaut.
- **Students** (`#student`) : chaque élève retrouve son héros, consulte ses
  stats (HP, XP, niveau, argent) et dépense son argent dans la boutique
  (achat + équipement). Le héros choisi est mémorisé sur l'appareil.

La bascule entre les deux se fait via les onglets **Teacher / Students**
dans l'en-tête, à côté des onglets de classe.

## Production (sauvegarde partagée)

En production, l'application et son API PHP sont servies par Infomaniak. L'API
stocke l'état dans un fichier JSON privé, avec sauvegardes horodatées. N'importe
quelle machine qui ouvre l'URL retrouve les données.

Voir `BACKEND.md` pour l'architecture, le déploiement Infomaniak et l'API.

## Structure du code

```text
index.html          coque HTML (topbar + zones app/toasts/dialogues)
styles.css          système visuel : tokens, composants, adaptations
src/app.mjs         état d'interface, routage, événements délégués, persistance
src/domain.mjs      règles du jeu (XP, HP, argent, boutique) — testé
src/avatar.mjs      héros et icônes en SVG
src/ui.mjs          briques de stats partagées (cœurs, barre XP, argent, niveau)
src/views/board.mjs      plateau de classe (grille et liste)
src/views/console.mjs    console de l'enseignant
src/views/student.mjs    choix du héros et casier de l'élève
src/views/shop.mjs       boutique, partagée entre les deux interfaces
src/views/rules.mjs      page des règles
src/views/modals.mjs     vue plein écran d'un héros, aperçu d'un article
```

Les vues ne produisent que du HTML ; `app.mjs` est seul à écouter les
événements (`data-action` délégué sur `#app`) et à écrire l'état.

## Tester

```bash
npm test
```

## Documentation

Le cadrage du draft est dans `docs/PRODUCT_DRAFT.md`.
