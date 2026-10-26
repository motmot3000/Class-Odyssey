# Règles du jeu

## Le principe

Chaque héros commence au niveau 1, avec 0 XP, 5/5 PV et 0 pièce virtuelle.
L'enseignant attribue les récompenses ; l'application ne corrige pas le travail
scolaire et n'évalue pas automatiquement les comportements.

- L'**XP** fait progresser de niveau. Le premier passage coûte 1 000 XP, puis
  chaque passage coûte 200 XP de plus. L'XP affiché est le reste du niveau courant.
- Monter de niveau restaure les PV. Cela débloque l'accès aux achats, sans donner
  automatiquement les objets payants ou les pièces.
- Les **PV** sont bornés entre zéro et le maximum du héros. Le texte par défaut
  parle d'élimination à zéro ; le logiciel ne supprime pas le personnage.
- Les **pièces** sont des récompenses virtuelles indépendantes de l'XP, sans
  achat en argent réel dans le jeu actuel.
- Un **achat** exige niveau et solde suffisants, débite les pièces, ajoute
  l'objet à l'inventaire et l'équipe. Un aperçu ne déclenche pas d'achat.

## Utilisation en classe

Navigation : **Classe → Fiche du héros → Dressing / Shop**.
La console sélectionne un héros à la fois ; « Toute la classe » est une bascule
explicite pour les récompenses collectives. Le verrou enseignant dure cinq
minutes après validation, sans prolongation lorsqu'on replie le panneau.

Ce verrou est une protection de manipulation, pas un compte élève séparé ni une
nouvelle autorisation serveur. Ne pas partager les identifiants de l'enseignant.

Les textes pédagogiques sont personnalisables par compte en FR/EN. Ils ne
modifient pas les calculs du logiciel. Le cadre d'usage doit être explicite,
adapté à la classe et éviter de réduire la participation à un classement.

Le [guide complet des règles](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/game-rules.md)
donne la formule, les exemples, les limites, les sélections et les sauvegardes.
Le catalogue de référence est `SHOP_ITEMS` dans `src/domain.mjs`, pas une copie
manuelle des prix dans ce wiki.

Suite : [Architecture](Architecture) · [Backend et données](Backend-et-donnees)
