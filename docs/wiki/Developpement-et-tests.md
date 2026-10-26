# Développement et tests

## Vérification automatique

Après récupération de Git LFS et installation des dépendances :

```sh
npm run check
```

Cette commande analyse la syntaxe des sources JavaScript et Python, puis lance
la suite `node --test`. Python 3 est nécessaire ; Blender ne l'est pas pour
la suite ordinaire. `npm test` lance seulement les tests JavaScript/HTTP.

Les tests couvrent notamment domaine, sessions, isolation des comptes, sauvegardes,
conflits, fichiers publics, traductions, ancrages et cohérence des modèles.
Un succès ne constitue pas une certification de sécurité ou de disponibilité.

## Vérification manuelle

Pour une PR d'interface, tester avec des données fictives : connexion et verrou,
classe et sélection, XP/niveau/PV, Shop → achat → Dressing → portrait,
export/import, conflit de sauvegarde, FR/EN, clair/sombre, clavier et mobile/TBI.
Indiquer précisément les parcours et appareils réellement vérifiés.

## Sources et builds

Modifier les modules sources, puis construire les bundles concernés. Ne pas
éditer à la main les JavaScript minifiés dans les assets.
`npm run build:items-3d` et `npm run build:odyssey` construisent du JavaScript ;
ils ne remodélisent pas les personnages. La chaîne Blender est séparée et
certains travaux historiques nécessitent des archives externes.

Le [guide détaillé](https://github.com/motmot3000/Class-Odyssey/blob/main/docs/development.md)
donne les commandes, la carte des tests et les contrôles manuels.

## Documentation et wiki

Les pages techniques sont versionnées avec le code. Les sources de ce wiki
sont dans `docs/wiki/` et peuvent être corrigées en PR. Le wiki est un dépôt Git
séparé : sa publication reste une action de maintenance explicite, pas une
synchronisation automatique après chaque merge.
