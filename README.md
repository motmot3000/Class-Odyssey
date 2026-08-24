# Game of More

Premier draft d'application web pour ludifier les cours d'anglais avec des personnages d'élèves, XP, niveaux, HP, skins et récompenses.

## Lancer (développement local)

```bash
npm start
```

Puis ouvrir :

```text
http://127.0.0.1:5180
```

`npm start` sert l'application **et** son API : les comptes ont besoin d'un
serveur, un simple serveur de fichiers ne suffit plus. Au premier démarrage,
le compte `motmot3000` / `121517` est créé dans `server/data/`.

Le `localStorage` du navigateur reste un cache : une coupure réseau pendant
un cours ne fait rien perdre.

## Comptes

Chaque enseignant a son compte : ses classes, ses héros, ses sauvegardes.
Rien n'est partagé entre deux comptes. À l'ouverture, l'application demande
un identifiant et un mot de passe, ou propose de créer une classe.

- Compte de départ : **`motmot3000`** / **`121517`**. Il est créé au premier
  démarrage du serveur et adopte les données déjà en place.
- **Nouvelle classe** sur la page d'accueil : nom de la classe, identifiant,
  mot de passe, répétition. La classe est créée vide, prête pour de vrais
  prénoms.
- Le mot de passe se change dans la console, panneau **Class account**. Les
  autres appareils sont alors déconnectés.

## Deux interfaces

- **Teacher** (`#board`) : plateau de classe + console d'attribution (XP, HP,
  argent, ajout/suppression d'élèves). **Protégée par le mot de passe.**
- **Students** (`#student`) : chaque élève retrouve son héros, consulte ses
  stats (HP, XP, niveau, argent) et dépense son argent dans la boutique
  (achat + équipement). Le héros choisi est mémorisé sur l'appareil.

La bascule entre les deux se fait via les onglets **Teacher / Students**
dans l'en-tête, à côté des onglets de classe.

## Une connexion, deux portes

C'est toujours l'enseignant qui connecte l'appareil ; les élèves n'ont pas
d'identifiants.

1. **Ouvrir la classe** — identifiant + mot de passe sur la page d'accueil.
   L'appareil retient la classe pendant 30 jours et s'ouvre sur la vue élève.
   Les élèves naviguent alors librement dans leur casier et la boutique.
2. **Ouvrir la console** — retaper le même mot de passe donne accès au
   plateau et à la console pour 8 heures, ou jusqu'au bouton **Lock**.

Détails utiles :

- Dix essais ratés en cinq minutes ferment la porte pour le reste de ces
  cinq minutes.
- Sans réseau, la classe continue : l'appareil sait reconnaître le mot de
  passe hors ligne (dérivation PBKDF2 stockée localement, jamais le mot de
  passe) et les modifications repartent à la prochaine connexion.
- Se déconnecter pousse d'abord les modifications en attente, puis efface le
  cache local — une tablette rendue ne garde rien.
- Portée : la seconde porte empêche un élève d'attribuer des points. Ce n'est
  pas une autorisation par champ : un élève à l'aise avec les outils de
  développement du navigateur peut la contourner et écrire dans les données
  de SA classe. Les autres classes lui restent inaccessibles.

## Production (sauvegarde partagée)

En production, le frontend reste sur l'hébergement Web Infomaniak classique.
Ses appels `/api` sont transmis au backend Node conteneurisé sur le VPS
Infomaniak, qui conserve l'état et ses sauvegardes. N'importe quelle machine qui
ouvre l'URL retrouve les données.

Voir `BACKEND.md` pour l'architecture, le déploiement Infomaniak et l'API.

## Structure du code

```text
index.html          coque HTML (topbar + zones app/toasts/dialogues)
styles.css          système visuel : tokens, composants, adaptations
src/app.mjs         état d'interface, routage, événements délégués, persistance
src/api.mjs         adresse de l'API, partagée par les modules qui l'appellent
src/session.mjs     compte, connexion et verrou de la console — testé
src/domain.mjs      règles du jeu (XP, HP, argent, boutique) — testé
src/avatar.mjs      héros et icônes en SVG
src/ui.mjs          briques de stats partagées (cœurs, barre XP, argent, niveau)
src/views/board.mjs      plateau de classe (grille et liste)
src/views/console.mjs    console de l'enseignant
src/views/student.mjs    choix du héros et casier de l'élève
src/views/shop.mjs       boutique, partagée entre les deux interfaces
src/views/welcome.mjs    page d'accueil : connexion et création de classe
src/views/lock.mjs       porte de l'interface adulte
src/views/rules.mjs      page des règles
src/views/modals.mjs     vue plein écran d'un héros, aperçu d'un article

server/server.mjs   serveur Node de développement et de production
server/api.mjs      comptes, sessions et stockage isolé par compte
```

Les vues ne produisent que du HTML ; `app.mjs` est seul à écouter les
événements (`data-action` délégué sur `#app`) et à écrire l'état.

## Tester

```bash
npm test
```

## Documentation

Le cadrage du draft est dans `docs/PRODUCT_DRAFT.md`.
