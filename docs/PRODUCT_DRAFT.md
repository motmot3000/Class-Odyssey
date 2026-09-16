# Class Odyssey - Draft produit

Sources utilisées :

- `description.md`
- `Class Odyssey.docx`

## Périmètre du premier draft

L'application est un tableau de classe pour ludifier les leçons d'anglais en 7P/8P. Elle fonctionne localement dans le navigateur et sauvegarde les données dans `localStorage`.

Fonctions incluses :

- deux classes prêtes à l'emploi : 7P et 8P ;
- ajout d'élèves (avec choix du genre et de la couleur de peau), renommage et suppression ;
- personnage nominatif pour chaque élève, personnalisable (tenue, chapeau, objet, visage, cheveux, titre) ;
- niveau, XP et 5 HP de base ;
- perte et récupération de HP, individuellement ou par groupe sélectionné ;
- élimination visuelle quand un personnage atteint 0 HP, avec retour en jeu possible en restaurant les HP ;
- attribution rapide d'XP pour devoirs, vocabulaire, comportement ou bonus ;
- attribution d'XP à un élève, à un groupe sélectionné (mode sélection multiple) ou à toute la classe ;
- argent de récompense (Money) donné par l'enseignant, affiché sur chaque carte, et boutique pour débloquer tenues/chapeaux/objets/visages/cheveux/titres ;
- aperçu de chaque objet seul (vignette + grand aperçu au clic), boutique organisée en menu déroulant par catégorie ;
- montée de niveau avec récupération des HP ;
- skins, visages, cheveux, titres, chapeaux et objets débloqués par niveau ;
- récompenses affichées dans la console élève (débloqués au niveau actuel + aperçu du prochain palier) et rappelées dans le message de montée de niveau ;
- annuler la dernière action (undo) ;
- export et import JSON des données (sauvegarde/restauration complète) ;
- synchronisation automatique si l'app est ouverte dans plusieurs onglets du même navigateur.

## Règles retenues

Le DOCX dit "Every 1000XP, you level up". `description.md` demande une progression où les niveaux deviennent plus difficiles. Le draft combine les deux : le premier passage de niveau demande 1000 XP, puis chaque niveau ajoute 500 XP au seuil suivant.

Exemples :

- niveau 1 vers 2 : 1000 XP ;
- niveau 2 vers 3 : 1500 XP ;
- niveau 3 vers 4 : 2000 XP.

Les HP sont à 5 par défaut. A 0 HP, l'élève est marqué comme éliminé visuellement, conformément au DOCX. Le draft ne supprime pas automatiquement l'élève, pour éviter une perte de données pendant un cours.

## Limites connues

- La persistance est locale au navigateur (`localStorage`). Pour plusieurs postes ou sauvegarde serveur, il faudra ajouter un backend ; en attendant, l'export JSON régulier reste la sauvegarde de secours recommandée.
- Les avatars sont des SVG générés par le code, pas encore une direction artistique finale.
- La vue grande classe passe en liste au-delà de 24 élèves pour garder une densité lisible sur TBI.
- Aucune donnée réelle d'élèves n'est fournie dans le dépôt ; les noms initiaux sont des exemples.
- La synchronisation multi-onglets ne fonctionne qu'au sein du même navigateur sur le même poste, pas entre plusieurs ordinateurs.
