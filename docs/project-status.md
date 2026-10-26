# État du projet et feuille de route

[Documentation](README.md) · [Contribuer](../CONTRIBUTING.md)

## Maturité

Class Odyssey est un projet jeune, actuellement présenté comme une bêta.
Beaucoup de fonctionnalités sont implémentées, mais des prototypes, documents
historiques et compromis subsistent. `package.json` indique `0.1.0` ; ce numéro
n'est ni un contrat de stabilité ni une certification de la version en ligne.

Le code de `main`, un build local et le site déployé sont trois états distincts.
Une PR fusionnée n'est pas automatiquement en production.

## Socle déjà présent

- Comptes enseignant, sessions, inscription et acceptation des textes légaux.
- Classes, héros, XP/niveaux, PV, monnaie virtuelle et inventaire.
- Shop, Dressing, portraits et catalogue d'équipements 3D.
- FR/EN, thèmes clair/sombre, onboarding et visite guidée.
- Écritures atomiques, sauvegardes rotatives, exports/imports et conflits de révision.
- Connexion Google et réinitialisation par e-mail configurables.
- Console opérateur séparée, support et modération des comptes.
- Tests automatiques du domaine, de l'API, des sessions, des langues et de la 3D.

« Présent » signifie implémenté dans le dépôt, pas audité indépendamment ni
garanti sans erreur sur tous les appareils.

## Priorités de consolidation

Sans dates promises et sans ordre immuable :

1. **Provenance des assets** : compléter les preuves de création et les licences
   des modèles/textures ; distinguer les éléments originaux, les imports et
   les rendus dérivés. La licence du code ne couvre pas les droits tiers.
   [Inventaire](assets-and-licenses.md).
2. **Données et fiabilité** : tests de restauration, migrations réversibles,
   conflits réseau, sessions et changements de compte ; ne pas exposer de données élèves.
3. **Prise en main** : documentation vérifiée depuis un clone neuf, installation
   LFS et suppression des indications héritées trompeuses de l'atelier.
4. **Usage réel** : tests sur TBI, clavier, mobile, performances WebGL et accessibilité.
5. **Maintenance** : suivi des dépendances, reproductibilité des builds et
   simplification progressive des zones expérimentales.

Les propositions ne valent pas engagements de livraison. Une idée importante
doit être discutée avant une grosse PR, particulièrement si elle modifie la
pédagogie, les données, les droits ou l'architecture.

## IA, relecture et pérennité

Une partie du code a été produite avec l'aide d'outils d'IA, selon une démarche
parfois appelée « vibe coding ». Des tests et contrôles ont été ajoutés au fil
du développement. Cela n'implique pas que chaque ligne ait été auditée.

Le mainteneur, Thomas Wünsche, vise un outil réellement utilisable et sa pérennité.
Il suit les problèmes et consolide le projet **au fur et à mesure que son agenda
le permet**. Il n'y a pas de permanence de support, de garantie de disponibilité,
de surveillance de sécurité 24/7 ni d'échéance imposée pour les PR.

Les contributions ne se limitent pas au code : un scénario reproductible, une
correction de documentation, un test ciblé ou un asset original correctement
licencié peuvent être particulièrement utiles.
