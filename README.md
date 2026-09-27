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
(6 à 128 caractères). Puis lancer :

```bash
npm run dev
```

`npm run dev` démarre deux serveurs : l'**atelier 3D** sur le port `5201` et
l'**application** sur le port `5180`. L'atelier est annoncé en premier, donc Go
Live ouvre :

```text
http://127.0.0.1:5201/items-3d.html
```

L'atelier embarque un bouton **Lancer l'application en temps réel** qui ouvre
l'application sur `http://127.0.0.1:5180` et connecte automatiquement le compte
administrateur local (les identifiants ne sont acceptés que depuis `localhost` /
`127.0.0.1`). `npm run dev:app` démarre l'application seule, et `npm start`
démarre sur un port strictement fixé en signalant un conflit s'il est occupé.

`npm run dev` et `npm start` chargent automatiquement le fichier `.env`, ignoré
par Git. Les variables déjà exportées dans le terminal sont prioritaires.
Les deux identifiants servent à créer le compte administrateur lors de la
première initialisation ; modifier `.env` ensuite ne réinitialise pas son mot
de passe. Le mot de passe ne doit jamais être ajouté au dépôt.

### Connexion Google (facultatif)

Le bouton **Se connecter avec son compte Google** apparaît dès que `GOOGLE_CLIENT_ID` et
`GOOGLE_CLIENT_SECRET` sont renseignés. Dans la console Google Cloud, créer un
identifiant OAuth 2.0 de type « application Web » et autoriser l'URI de
redirection `https://www.thomaswunsche.com/classodyssey/api/auth/google/callback`
(ou `https://classodyssey.thomaswunsche.com/api/auth/google/callback`, puis
`https://classodyssey.com/api/auth/google/callback` après l'ouverture du domaine ; en local,
`http://127.0.0.1:5180/api/auth/google/callback`, ou le port choisi). À la
première connexion, Class Odyssey crée le compte à partir de l'adresse Google
vérifiée ; si un compte existe déjà avec cet e-mail, Google ouvre ce compte.
Un nouveau compte Google accepte les textes légaux puis choisit un **mot de
passe de console du professeur** (6 caractères minimum). Il est déverrouillé
pour cinq minutes après sa création, puis demandé pour accéder aux commandes
enseignant après reconnexion. Ce mot de passe ne sert jamais à se connecter au
compte Google : il peut être modifié depuis la console et réinitialisé après
une nouvelle authentification Google avec l'adresse e-mail vérifiée.

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

À l'inscription, une case à cocher obligatoire recueille l'acceptation des
[Conditions d'utilisation](src/views/legal.mjs) et de la Politique de
confidentialité ; la date et la version acceptées sont conservées sur le compte
(`src/terms.mjs`). Un compte créé via Google valide ces textes à sa première
connexion.

## Production (sauvegarde partagée)

En production, le frontend et le backend Node sont réunis dans le même
conteneur sur le VPS Infomaniak. Caddy sert le domaine public et les données
persistantes restent montées hors du conteneur. N'importe quelle machine qui
ouvre l'URL retrouve les données de son compte.

Voir `BACKEND.md` pour l'architecture, le déploiement Infomaniak et l'API.

## Console d'administration locale

La console séparée est dans `admin-console/` et s'ouvre sur
`http://127.0.0.1:5191` avec `npm run console`. Elle lit les comptes en direct
depuis le backend du site, sans mot de passe à saisir dans le navigateur.
L'installation et la connexion au VPS sont décrites dans
[`admin-console/README.md`](admin-console/README.md).

## Structure du code

```text
index.html          coque HTML (topbar + zones app/toasts/dialogues)
src/odyssey.css     système visuel partagé, thèmes sombre et clair
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
