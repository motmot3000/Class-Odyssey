# Installation et premier lancement

[Documentation](README.md) · [Contribuer](../CONTRIBUTING.md)

## Prérequis

- Git et **Git LFS**, pour les quatre catalogues `.glb`/`.blend` marqués dans
  `.gitattributes`. Le dépôt et son historique sont volumineux.
- Node.js **22.9 minimum** et npm. La vérification de cette documentation utilise
  Node 22 ; ne supposez pas qu'une ancienne version fonctionne.
- Python 3 pour la vérification syntaxique de `npm run check`.
- Navigateur récent avec WebGL pour les personnages 3D.
- Blender/Pillow uniquement pour les travaux de génération 3D, pas pour jouer
  ni pour la suite de tests ordinaire.

## Préparer le dépôt

```sh
git clone https://github.com/motmot3000/Class-Odyssey.git
cd Class-Odyssey
git lfs install --local
git lfs pull
npm ci
cp .env.example .env
```

Un téléchargement ZIP peut laisser des pointeurs LFS au lieu des modèles.
Préférez le clone Git avec LFS pour contribuer et lancer les tests 3D.

Dans `.env`, choisissez vos identifiants **de développement** :

- `FOUNDER_USERNAME` : 3–32 caractères ; commence par une lettre minuscule ou un
  chiffre, puis lettres minuscules, chiffres, points, tirets ou underscores.
- `FOUNDER_PASSWORD` : 6–128 caractères ; choisissez un mot de passe unique,
  plus long que le minimum accepté. Ne réutilisez pas un identifiant de production.
- `HOST=127.0.0.1` et `PORT=5180` : paramètres locaux proposés par l'exemple.

Le fondateur est créé au premier démarrage et possède le rôle `admin`.
Changer ensuite le fichier `.env` ne change pas le mot de passe du compte existant.
Les variables déjà exportées prennent le pas sur `.env`.

## Choisir le lanceur

| Commande | Usage |
| --- | --- |
| `npm run dev:app` | Application/API ; cherche un port libre si celui demandé est occupé |
| `npm start` | Application/API ; échoue si le port est occupé |
| `npm run dev` | Application sur 5180 et atelier 3D sur 5201, tous deux en boucle locale |
| `npm run dev:items-3d` | Atelier seul ; définir `HOST=127.0.0.1` pour le garder local |
| `npm run console` | Console opérateur séparée, après configuration spécifique |

Pour découvrir le jeu, utilisez **`npm run dev:app`** et l'URL imprimée.
`npm run dev` privilégie l'atelier pour le flux de travail graphique et impose
ses deux ports : il ne respecte pas un `PORT` personnalisé de `.env`.
Le lien historique de connexion rapide de l'atelier ne correspond pas à vos
identifiants ; ouvrez l'application normalement et connectez-vous avec `.env`.
Ne mettez jamais un vrai mot de passe dans une URL.

## Première utilisation

1. Connectez-vous avec le compte fondateur local, ou créez un compte de test.
2. Validez les textes légaux si l'application le demande.
3. Créez une classe et des héros **fictifs** : les nouveaux comptes sont vides.
4. Déverrouillez la console enseignant, sélectionnez un héros et attribuez de l'XP.
5. Testez la fiche, le Shop, le Dressing, le changement de langue et les thèmes.
6. Essayez l'export JSON avec ces seules données fictives.

Les données sont dans `server/data/` par défaut. Pour un essai isolé, définissez
`DATA_DIR` vers un dossier neuf hors Git avant le lancement. Ne pointez jamais
des tests ou des scripts de migration sur des données de classe réelles.

## Fonctionnalités facultatives

La connexion Google nécessite `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.
L'URI autorisée doit correspondre exactement à l'instance, par exemple
`http://127.0.0.1:5180/api/auth/google/callback` en local. Le serveur n'a pas
besoin de Google pour le compte local. La configuration détaillée et l'envoi
d'e-mails sont décrits dans [BACKEND.md](../BACKEND.md).

## Dépannage

| Symptôme | Vérification |
| --- | --- |
| Serveur refusé au premier lancement | `.env` créé et identifiants valides ? |
| Mot de passe inchangé après édition de `.env` | Le compte existe déjà ; utiliser le changement de mot de passe de l'application |
| Port occupé | Utiliser `dev:app`, lire l'URL réellement imprimée, ou choisir un autre `PORT` |
| Erreur « glTF » / « version https://git-lfs… » / tests de modèle en échec | `git lfs install --local`, puis `git lfs pull` et `git lfs checkout` |
| Modèles absents malgré LFS | Vérifier l'accès au dépôt et les erreurs/quota LFS ; ne pas contourner les tests |
| `python3` introuvable | Installer Python 3 pour `npm run check` ; `npm test` ne fait pas le contrôle Python |
| `409` pendant une sauvegarde | Conflit de révision : exporter la copie locale avant de charger la version serveur |
| Erreur Google | Vérifier domaine, port et URI de retour ; ne pas publier de code OAuth ou de jeton |

Enfin : `npm run check`. Un succès local ne prouve ni un déploiement ni le bon
fonctionnement d'un parcours visuel sur un appareil réel.
