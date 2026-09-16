# Class Odyssey

For maintainers: [code map, data flow and build ownership](docs/code-map.md).

Premier draft d'application web pour ludifier les cours d'anglais avec des personnages d'élèves, XP, niveaux, HP, skins et récompenses.

## Lancer (développement local)

Utiliser Node.js 22.9 ou ultérieur. À la première utilisation de chaque clone
ou worktree, préparer la configuration locale :

```bash
cp .env.example .env
```

Dans `.env`, choisir `FOUNDER_USERNAME` (3 à 32 caractères : lettres minuscules,
chiffres, points, tirets ou underscores) et renseigner `FOUNDER_PASSWORD`
(4 à 128 caractères). Puis lancer :

```bash
npm run dev
```

Puis ouvrir l'URL annoncée par le serveur, par défaut :

```text
http://localhost:5180
```

Go Live utilise automatiquement `npm run dev`. Ce mode essaie le port défini
par `PORT` dans `.env` (sinon `5180`) ; s'il est déjà occupé, le système lui
attribue un port libre. Go Live ouvre l'URL effective annoncée par le serveur.
`npm start` permet de démarrer sur un port strictement fixé et signale un conflit
si celui-ci est occupé.

`npm run dev` et `npm start` chargent automatiquement le fichier `.env`, ignoré
par Git. Les variables déjà exportées dans le terminal sont prioritaires.
Les deux identifiants servent à créer le compte administrateur lors de la
première initialisation ; modifier `.env` ensuite ne réinitialise pas son mot
de passe. Le mot de passe ne doit jamais être ajouté au dépôt.

Les données locales sont conservées dans `server/data/`, propre à chaque
worktree et ignoré par Git. `DATA_DIR` peut aussi pointer vers un dossier
temporaire. Pour lancer plusieurs branches en parallèle, choisir un `PORT`
différent dans chaque `.env` et ouvrir l'URL correspondante.

## Une vue Class

- **Class** (`#class`) affiche les héros de la classe avec leurs portraits de
  face, titres, niveaux, XP, cœurs et pièces. Les cartes donnent accès à la
  fiche, au **Dressing** et au **Shop**.
- La navigation suit une hiérarchie unique : **Classe → Fiche héros →
  Dressing / Shop**. La fiche héros revient à la **Classe** ; le Dressing et
  le Shop reviennent au **héros** par le même bouton, placé en haut à gauche.
- La console enseignant sélectionne un élève à la fois. **Toute la classe**
  est une bascule : un appui sélectionne tout le monde, un second efface la
  sélection. Les récompenses visent toujours la sélection visible.
- **Teacher console**, via l'onglet du bord droit, ouvre un panneau latéral protégé
  par le mot de passe du compte. Elle contient les récompenses, les données et
  le bouton **+ Add a student**. L'ajout se fait dans une boîte dédiée, puis
  revient à la console. L'accès reste déverrouillé cinq minutes après validation
  du mot de passe, y compris quand le panneau est replié. La classe reste
  interactive pendant l'utilisation de la console.

Un seul élève est sélectionné à la fois ; « Toute la classe » reste un choix
explicite pour les récompenses collectives. Les anciens liens `#board` et
`#student` ouvrent désormais la même vue Class.

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
src/sheikah.css     système visuel partagé, thèmes sombre et clair
src/shell.css       navigation, connexion, règles, comptes, boutique et dialogues
styles.css          ancien habillage conservé pour les prototypes
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
