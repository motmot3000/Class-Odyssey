# Sécurité et signalement privé

Class Odyssey est en développement. Le suivi se concentre sur `main` ; les tags
historiques ne sont pas des versions maintenues. Il n'y a pas d'audit de sécurité
indépendant certifié, de bug bounty ni de délai de réponse garanti.

## Signaler une vulnérabilité

**Ne pas publier d'issue, de capture ou de preuve contenant un secret, une donnée
personnelle ou une méthode d'exploitation contre l'instance en ligne.**

Utiliser « Report a vulnerability » dans l'onglet Security si GitHub propose ce
bouton. Sinon, écrire à
[thomas.walter.wunsche@gmail.com](mailto:thomas.walter.wunsche@gmail.com)
avec l'objet `Class Odyssey — security report`. Ce contact existe aussi dans
les textes légaux de l'application. L'e-mail n'est pas une boîte de dépôt
chiffrée garantie : n'envoyez pas de base de données, jeton ou export de classe.

Fournir le commit/version, le composant touché, l'impact supposé et une
reproduction locale avec des données fictives. Coordonner une publication du
correctif avant de diffuser une exploitation détaillée. Ne pas sonder des
comptes tiers, saturer le service ou extraire des données pour « prouver » le bug.

## Si un secret ou des données ont été exposés

Prévenir le mainteneur en privé, sans recopier les valeurs. Révoquer/remplacer
un secret compromis : supprimer sa ligne du dernier commit ne suffit pas.
L'historique, les tags, les PR, les journaux et les objets LFS peuvent conserver
des copies. Toute réécriture d'historique doit être coordonnée, jamais improvisée
par un contributeur.

## Limites à connaître

- La console enseignant est un verrou d'usage côté navigateur, **pas un rôle
  serveur distinct pour chaque élève**. Le jeton du compte permet de modifier
  son état. Ne pas partager une session enseignant sur un poste non maîtrisé.
- L'état est validé en forme/taille ; toutes les règles de jeu ne sont pas
  recalculées comme sur un serveur de jeu anti-triche.
- Le cache local conserve des données de classe, notamment les changements non
  synchronisés. La déconnexion ne garantit pas l'effacement de toutes les données
  de l'appareil. Utiliser des profils de navigateur adaptés.
- Les fichiers JSON supposent **un seul processus écrivain** par `DATA_DIR`.
- La console opérateur utilise une clé serveur et ne doit pas être exposée sur
  Internet. Toute personne qui peut ouvrir son interface peut disposer de ses
  fonctions d'administration ; voir [sa documentation](admin-console/README.md).
- Les serveurs de laboratoire ne sont pas des serveurs de production. Certains
  écoutent sur toutes les interfaces par défaut : garder les ateliers en boucle
  locale et ne pas y placer de données ou secrets réels.

## Pour l'auto-hébergement et les contributions

Configurer TLS, proxy de confiance, droits du volume, sauvegardes indépendantes,
restauration, rétention et textes légaux. Préserver les contrôles de sessions,
révisions, bornes de requête et fichiers publics. Vérifier les dépendances et
ne pas traiter un contrôle automatique réussi comme une garantie d'absence
de vulnérabilité. Voir [BACKEND.md](BACKEND.md) et [CONTRIBUTING.md](CONTRIBUTING.md).
