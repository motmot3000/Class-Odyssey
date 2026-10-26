# Installation

## Essayer le jeu

L'application est accessible sur [classodyssey.com](https://classodyssey.com).
C'est une bêta : avant un usage réel, examiner ses limites, les textes légaux,
les règles de l'établissement et la protection des données.

## Développer sur son ordinateur

Prérequis : Node.js 22.9 minimum, npm, Git et Git LFS. Python 3 est aussi
nécessaire pour le contrôle syntaxique complet. Blender n'est pas requis pour
le lancement ordinaire : les modèles livrés sont récupérés par LFS.

```sh
git clone https://github.com/motmot3000/Class-Odyssey.git
cd Class-Odyssey
git lfs install --local
git lfs pull
npm ci
cp .env.example .env
```

Renseigner un `FOUNDER_USERNAME` et un `FOUNDER_PASSWORD` personnels pour le
développement, sans jamais les commiter. Puis :

```sh
npm run dev:app
```

Ouvrir l'URL imprimée, normalement `http://127.0.0.1:5180`.
Créer une classe et des héros fictifs : un nouveau compte est vide.
Modifier `.env` ne réinitialise pas un compte déjà créé.

`npm run dev` lance plutôt l'application sur 5180 **et** l'atelier 3D sur 5201.
Pour découvrir le jeu, `dev:app` est le point d'entrée le plus simple.

Le [guide détaillé](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/getting-started.md)
explique les ports, Google facultatif, le stockage et les erreurs LFS.
Des modèles absents ou des erreurs « glTF » sont souvent dus à des pointeurs
LFS non remplacés : ne pas ignorer les tests pour contourner ce problème.

Suite : [Règles du jeu](Regles-du-jeu) · [Développement](Developpement-et-tests)
