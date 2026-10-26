# Backend, données et auto-hébergement

Le serveur Node sert le frontend et l'API depuis la même origine.
Chaque compte dispose de son état et de ses sauvegardes JSON sous `DATA_DIR`.
Le cache navigateur permet de conserver des changements hors ligne, mais il
ne remplace pas une sauvegarde indépendante et ne garantit pas un lancement
hors réseau depuis un navigateur vierge.

## Points importants

- Un seul processus écrivain par dossier de données ; pas de réplication
  multi-processus sur un volume partagé sans autre conception de stockage.
- Sessions liées au compte, mots de passe dérivés avec `scrypt`, jetons stockés
  par condensat côté serveur.
- Révisions et erreurs 409 empêchent les écrasements silencieux entre copies.
- État limité à 4 Mio ; sauvegardes rotatives avec bornes de nombre et de volume.
- Un nouveau compte n'a ni classe ni élève. Les fixtures de test ne sont pas
  des données de démarrage pour les utilisateurs.
- Google, l'e-mail de récupération et la GeoIP locale sont facultatifs.
- Les données de classes, comptes, IP et support ne doivent jamais être commitées.

## Deux consoles différentes

La **console enseignant** est dans le navigateur du compte connecté, avec
déverrouillage temporaire. La **console opérateur** est un serveur séparé,
protégé par son accès réseau et une clé de serveur. Ne jamais l'exposer sur
Internet ou confondre son pouvoir avec celui d'un élève.

## Exploiter sa propre instance

Prévoir volume persistant avec droits adaptés, reverse proxy TLS de confiance,
sauvegardes indépendantes testées, migrations et retour arrière. Configurer les
services facultatifs et adapter les contacts/textes légaux à son instance.
L'auto-hébergement n'autorise pas à réutiliser les secrets ou accès de l'auteur.

Un merge de `main` n'est pas un déploiement. Vérifier séparément le commit,
le build, le service réellement lancé et les parcours utilisateur.

Références : [Backend/API](https://github.com/motmot3000/Class-Odyssey/blob/main/BACKEND.md),
[console opérateur](https://github.com/motmot3000/Class-Odyssey/blob/main/admin-console/README.md),
[sécurité](https://github.com/motmot3000/Class-Odyssey/blob/main/SECURITY.md).
