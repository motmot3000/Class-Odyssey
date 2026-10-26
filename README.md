# Class Odyssey

**Transformer la progression en classe en aventure, sans ralentir le cours.**

Class Odyssey est une application web de ludification : chaque élève possède un
héros, gagne de l'expérience, progresse et personnalise son personnage avec des
pièces virtuelles. Le projet est conçu pour les cours d'anglais de 7P/8P, avec
un tableau projeté et une console pilotée par l'enseignant.

[Site](https://classodyssey.com) · [Documentation](docs/README.md) ·
[Wiki](https://github.com/motmot3000/Class-Odyssey/wiki) ·
[Contribuer](CONTRIBUTING.md) · [Feuille de route](docs/project-status.md)

## Un projet jeune, ouvert aux contributions

Class Odyssey est un **projet personnel en début de développement**, avec déjà
un socle conséquent : comptes, classes, sauvegardes, progression, boutique,
personnages 3D, interface français/anglais et outils d'administration.
Il reste des imperfections, des expérimentations et du travail de consolidation.
Ce n'est pas une solution scolaire certifiée ni un service avec support garanti.

Une partie du projet a été **« vibe codée »**, avec l'aide d'outils d'IA.
Cette transparence n'exonère pas de comprendre le code : les changements doivent
être relus, testés et documentés. La présence de tests n'est pas une garantie
d'absence de bugs ou une certification de sécurité.

Thomas Wünsche développe le projet pour qu'il soit **fonctionnel, utilisable et
maintenable dans la durée**. Il en suit l'évolution et reprend progressivement
les problèmes, les dépendances et la documentation, au rythme permis par son
agenda. Il n'y a ni surveillance humaine permanente, ni délai de réponse promis.

**Les contributions sont les bienvenues** : développement, tests, accessibilité,
traduction, documentation, retours pédagogiques et création d'assets originaux.
Commencez par le [guide de contribution](CONTRIBUTING.md).

> **Code sous licence MIT ; médias à distinguer.** Le code original et la
> documentation du projet sont open source sous [MIT](LICENSE). Les dépendances
> et médias tiers ne sont pas relicenciés. La présentation graphique est celle
> d'un jeu d'aventure fantasy : héros stylisés, tenues et accessoires modulaires.
> Certains fichiers de médias conservent une provenance ou des droits à clarifier.
> Voir l'[inventaire des assets](docs/assets-and-licenses.md) et les
> [notices tierces](THIRD_PARTY_NOTICES.md). Aucune autorisation de réutiliser ces
> modèles tiers n'est accordée par la licence du code.

## Ce que l'application propose

- Classes et héros : noms, XP, niveaux, points de vie, inventaire et portraits.
- Récompenses individuelles ou pour toute la classe, avec annulation locale.
- Boutique en **monnaie virtuelle**, équipements et personnalisation 3D.
- Console enseignant déverrouillée pour cinq minutes ; comptes séparés côté API.
- Interface FR/EN, thèmes clair/sombre et visite guidée.
- Persistance serveur, cache local par compte, export/import JSON et détection
  des conflits de sauvegarde.
- Connexion Google et envoi d'e-mails facultatifs ; console d'administration séparée.

Les règles effectivement implémentées et leurs limites sont décrites dans
[Règles du jeu](docs/game-rules.md). Il ne s'agit pas d'un système de comptes
élèves indépendants : le navigateur connecté utilise le compte de l'enseignant.

## Démarrer en local

Prérequis : **Node.js 22.9 ou ultérieur** (Node 22 testé), npm, Git et Git LFS.
Python 3 est requis pour `npm run check`, mais pas pour lancer le serveur.
Blender n'est nécessaire que pour reconstruire la géométrie 3D.

```sh
git clone https://github.com/motmot3000/Class-Odyssey.git
cd Class-Odyssey
git lfs install --local
git lfs pull
npm ci
cp .env.example .env
```

Renseignez `FOUNDER_USERNAME` et un **mot de passe local personnel** dans `.env`,
puis lancez :

```sh
npm run dev:app
```

Ouvrez l'adresse annoncée, normalement **http://127.0.0.1:5180**. Les nouveaux
comptes commencent sans classe ni élève. Utilisez uniquement des données fictives
pour développer. `.env` et `server/data/` ne doivent jamais être commités.

[Installation détaillée et dépannage](docs/getting-started.md) ·
[Backend et configuration](BACKEND.md) · [Architecture](docs/code-map.md)

## Vérifier et contribuer

```sh
npm run check
```

Cette commande vérifie la syntaxe JavaScript/Python puis exécute les tests.
Le code inclut notamment des tests de domaine, HTTP, sessions, langues et assets.
Les parcours visuels et le comportement réel sur TBI/mobile nécessitent aussi
une vérification manuelle : [guide de développement](docs/development.md).

**`main` est l'unique branche active d'intégration.** Proposez vos changements
depuis une branche de travail ou un fork, par pull request vers `main`.
Les versions historiques sont conservées par tags `archive/*`, pas comme
branches de développement. Un merge GitHub ne déploie pas automatiquement le site.

Pour une faille ou des données personnelles exposées, suivez
[SECURITY.md](SECURITY.md), sans créer d'issue publique contenant les détails.

## English summary

Class Odyssey is an early-stage classroom gamification app, initially built for
French-speaking teachers of English. It includes teacher accounts, classroom
progression, virtual rewards and 3D characters. Contributions in French or
English are welcome. Some code was developed with AI assistance; contributors
remain responsible for understanding, testing and reviewing their changes.
The maintainer works on usability and long-term maintenance as time allows,
without a support SLA. Original code and project documentation use the MIT
license; third-party assets are **not** covered by that grant. Check the asset
inventory and third-party notices before reusing media.
