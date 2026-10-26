# Règles du jeu et comportement actuel

[Documentation](README.md) · sources : [`domain.mjs`](../src/domain.mjs),
[`console.mjs`](../src/views/console.mjs), [`i18n.mjs`](../src/i18n.mjs)

Ce guide distingue les calculs du logiciel des décisions pédagogiques.
Modifier le texte des règles dans un compte **ne modifie pas** les calculs d'XP,
les prix ni les autorisations du code.

## Personnages et classes

- Un nouveau compte n'a ni classe ni élève. Les exemples nommés dans les tests
  et la fonction de démonstration ne constituent pas des données à injecter
  dans un vrai compte.
- Un héros ajouté commence au **niveau 1**, avec **0 XP**, **5/5 PV** et
  **0 pièce**, la tenue Scout et le titre Rookie.
- Les objets gratuits du catalogue sont possédés dès la normalisation du héros.
- Les classes sont séparées dans l'état du compte ; changer de classe efface
  la sélection précédente.

## XP et niveaux

L'enseignant attribue l'XP. Les boutons proposés sont `+50`, `+100`, `+200`,
`+500`, `+1000`, avec un montant personnalisé positif.
Le programme ne corrige pas automatiquement les devoirs ou le vocabulaire.

Pour passer du niveau `L` au suivant :

```text
XP nécessaire = 1000 + (L - 1) × 200
```

| Passage | Coût | XP cumulé depuis le début |
| --- | ---: | ---: |
| 1 → 2 | 1 000 | 1 000 |
| 2 → 3 | 1 200 | 2 200 |
| 3 → 4 | 1 400 | 3 600 |
| 4 → 5 | 1 600 | 5 200 |

L'XP stocké sur le héros est le **reste dans le niveau actuel**, pas le total
historique. Un gros gain peut traverser plusieurs niveaux. Monter de niveau
restaure les PV à leur maximum, mais ne donne pas automatiquement les objets
payants ni de pièces. Le niveau donne accès à l'achat.

## Points de vie

Les variations de PV sont bornées entre `0` et `maxHp` (5 pour un nouveau héros).
À 0 PV, `isEliminated()` renvoie vrai et le texte par défaut parle d'élimination.
Cela ne supprime ni le héros, ni ses données, ni ses objets : ce n'est pas un
mécanisme de sanction automatique ni une définition d'une procédure pédagogique.
Les PV peuvent être restaurés par l'enseignant ou par un passage de niveau.

Les règles de participation, les alternatives et l'usage des récompenses doivent
rester explicites et adaptés à la classe. Aucun gain pédagogique n'est garanti
par la présence d'un système de points.

## Pièces, boutique et inventaire

- Les pièces sont **virtuelles**, sans achat en argent réel dans le jeu actuel.
- Le gain de pièces est indépendant du gain d'XP et est décidé par l'enseignant.
- Pour acheter : objet connu, niveau minimal atteint, solde suffisant et objet
  non déjà possédé (hors ancien cas technique `bespoke`, absent du catalogue actuel).
- Un achat retire le prix une fois, ajoute l'objet à l'inventaire et l'équipe.
- Un aperçu n'achète rien. Le Dressing équipe seulement des objets possédés.
- Le titre vient du champ `title` ; il ne change pas selon la tenue.
- Les armes sont des accessoires visuels, pas un système de combat ou de dégâts.

Le catalogue actuel comprend tenues, chapeaux, armes, boucliers, coupes,
couleurs de cheveux et d'yeux, accessoires, compagnons, titres et carnations.
Les cinq carnations sont gratuites. Les tenues payantes s'échelonnent de Bard
(niveau 1, 10 pièces) à Horse Keeper (niveau 10, 110 pièces).
Le détail de référence reste `SHOP_ITEMS` dans `src/domain.mjs` : ne pas maintenir
un second catalogue à la main dans le wiki.

## Sélection et navigation

Parcours : **Classe → Fiche du héros → Dressing / Shop**.
Le Dressing et le Shop reviennent à la fiche ; la fiche revient à la classe.
La console sélectionne un seul héros à la fois. **Toute la classe** est une
bascule explicite : un clic sélectionne tous les héros de la classe active,
un second efface la sélection. Les récompenses visent la sélection visible.

## Console enseignant : protection d'usage, pas identité distincte

Le déverrouillage dure **cinq minutes après validation**. Replier le panneau ne
prolonge pas ce délai. Verrouillage et déconnexion l'annulent. Le droit local
reste lié au compte qui l'a obtenu.

Ce verrou limite les manipulations en classe ; **ce n'est pas une autorisation
serveur distincte par élève**. Le serveur reconnaît le jeton du compte connecté.
Ne distribuez pas ce jeton et ne laissez pas une session enseignant sur un poste
non maîtrisé. La console opérateur séparée n'est pas la console enseignant.

## Sauvegarde, annulation et conflits

Chaque changement est conservé dans le cache local du compte, puis envoyé au
serveur. L'annulation de l'interface n'est pas une restauration d'archives serveur.
Un `409` protège une version serveur plus récente : conserver/exporter la copie
locale avant de demander explicitement son remplacement par celle du serveur.
Le journal de jeu ne conserve que les **80 derniers événements** ; ce n'est pas
un registre scolaire exhaustif.

## Adapter les règles pédagogiques

Chaque compte peut adapter trois listes : `journey`, `xp`, `money`.
Les entrées sont des paires FR/EN, limitées à 240 caractères et 30 entrées par
section. Une liste vide est conservée ; une section absente reprend les défauts.
Ces textes expliquent la pratique de classe, sans remplacer les transitions
testées dans `domain.mjs` ni les validations serveur.
