# Contribuer

Développeurs, enseignants, testeurs, traducteurs et artistes sont les bienvenus.
Une bonne contribution peut être une correction de guide, un scénario de bug,
un test de non-régression ou un asset original bien documenté.
Le français et l'anglais sont acceptés.

## Le parcours d'une contribution

1. Lire les guides d'[installation](Installation) et d'[architecture](Architecture).
2. Chercher une issue/PR existante. Discuter d'abord les gros changements de
   pédagogie, de données, d'architecture, de dépendances ou de catalogue.
3. Créer un fork et une branche de travail depuis `main`.
4. Faire un changement ciblé avec ses tests et sa documentation.
5. Exécuter `npm run check` et vérifier manuellement les parcours affectés.
6. Ouvrir une PR **vers `main`**, expliquer le problème, les preuves et les risques.

Pas de branche `dev` permanente. Les anciennes versions sont conservées en
[tags d'archive](Branches-et-archives). Le mainteneur décide des merges selon
ses disponibilités ; une PR ne crée ni engagement de délai, ni déploiement automatique.

## Responsabilités

- Code et commits en anglais ; échanges de revue possibles en FR/EN.
- Pas de données élèves réelles, exports de production, secrets ou logs privés.
- Comprendre le code proposé, y compris lorsqu'il vient d'une IA ; signaler une
  aide substantielle et présenter les résultats de tests réels.
- Respecter les licences et conserver les notices des composants tiers.
- Ne pas contourner un test pour faire passer la suite.
- Rester respectueux et tenir compte du temps de chacun.

Le contrat détaillé est dans
[CONTRIBUTING.md](https://github.com/motmot3000/Class-Odyssey/blob/main/CONTRIBUTING.md),
avec les commandes Git et la checklist. Lire aussi le
[code de conduite](https://github.com/motmot3000/Class-Odyssey/blob/main/CODE_OF_CONDUCT.md).

Une faille se signale [en privé](https://github.com/motmot3000/Class-Odyssey/blob/main/SECURITY.md),
pas dans une issue publique avec une exploitation ou des données sensibles.
