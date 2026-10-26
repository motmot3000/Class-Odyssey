# Surface-v3 — examen avant adoption

## Avis

**Compatible avec les placements base-v2 ; poursuite de la passe de matières
recommandée avant adoption globale.** Cet examen n’adopte pas les nouveaux
assets et ne modifie pas les snapshots, le catalogue ni les modèles livrés.

Deux évaluations indépendantes ont été réalisées : visuelle
(`ses_f642a551cffei9diRti9nZQB7d`) et technique
(`ses_f642a549cffeprT5nie2xoJ54E`). La cible est l’apparence des modèles,
pas une refonte de l’interface de comparaison.

## Apparence à lumière identique

Comparaison dans `http://localhost:5182/assets/characters-refined/index.html`,
mode **Comparer en 3D** : garçon/fille medium, visage et tenue, plus visage
fille dark. Les caméras et les lumières utilisent le même runtime.

- Les cheveux gagnent des stries directionnelles et une variation des reflets.
- Le pantalon montre des plis de surface plus lisibles.
- Le gain sur la peau et les iris est discret aux tailles examinées.
- Le haut reste très lisse : le coton se distingue encore peu d’une matière
  moulée. La distinction peau/tissu/cheveux mérite une passe supplémentaire.

Les rendus Blender avant/après ont des mises en lumière différentes : ils
illustrent le potentiel de présentation, mais ne suffisent pas à attribuer
tout le gain aux seules matières.

## Compatibilité vérifiée

Les fichiers medium garçon/fille ont été décodés indépendamment, en parcourant
uniquement leur scène active et en appliquant les transformations monde.

- Les ensembles de positions peau/yeux/vêtements/cheveux correspondent avant
  et après à **10⁻⁷ m**, pour les huit comparaisons.
- Les triangles restent **51 108** pour le garçon et **55 460** pour la fille.
- Tous les champs du manifeste base-v2, dont la pose et les **20 ancrages par
  personnage**, sont conservés exactement.
- Les nouveaux fichiers contiennent une seule scène active, sans les nœuds
  historiques inutilisés des anciens exports.
- La consolidation des cheveux et les nouveaux UV augmentent les enregistrements
  de sommets exportés sans modifier les ensembles de positions.

La preuve fournie utilise un multiensemble de sommets Blender. Ses hashes
peau/cheveux ont été reproduits ; les hashes yeux/vêtements ne sont pas
directement équivalents aux ensembles exportés à cause des duplications.
L’égalité des positions livrées de ces parties a néanmoins été contrôlée
indépendamment. Cet examen ne prétend pas certifier une topologie ou des UV
identiques.

Les huit autres variantes ont été inventoriées, pas décodées indépendamment.
La carnation dark de la fille a été examinée visuellement seulement.

## Conséquences pour le catalogue

1. Les placements et les ancrages validés ne demandent pas un nouveau retarget.
2. Peau, yeux, pantalon et bottes sont les candidats au transfert direct de
   matières depuis les nouveaux fichiers.
3. `garments()` remplace actuellement la matière du haut : il faudra conserver
   explicitement ses normal/roughness maps et leur canal UV (`TEXCOORD_1`).
   Les capes et jupes générées doivent recevoir leur propre mapping.
4. `prepare()` retire les cheveux source, puis `hairstyles()` construit les
   cinq coupes du catalogue. Leur géométrie diffère des coiffures source :
   l’atlas consolidé ne peut pas être appliqué aveuglément. Il faut adapter
   les UV/rebaker les maps en conservant le choix de couleur.
5. Les exports de l’atelier plafonnent actuellement les textures à 1024 px ;
   ce réglage doit être examiné si l’on conserve l’atlas cheveux de 2048 px.

Le poids passe d’environ **5,3 à 13,9 Mo** pour le garçon medium et de
**6,3 à 13,7 Mo** pour la fille medium. Le gain visuel doit justifier ce coût.

## Éléments de vérification

Les maps de normales et metallic-roughness passent de 0 à 7 matières équipées
de chaque type de map par personnage. Chaque nouveau GLB contient 18 PNG
embarqués ; leurs références et les canaux UV ont été vérifiés.

Le scan déterministe ciblé sur la page de comparaison retourne `[]`, mais en
mode regex dégradé, sans analyse de contraste calculé. Il ne constitue pas
une certification de l’interface.

Preuves de revue (captures temporaires hors dépôt) :

- `surface-v3-results.json` : données techniques et hashes complets ;
- `surface-v3-boy-medium-face.png`, `surface-v3-boy-medium-outfit.png` ;
- `surface-v3-girl-medium-face.png`, `surface-v3-girl-medium-outfit.png` ;
- `surface-v3-girl-dark-face.png`.

Aucun build d’intégration ni suite complète de tests du projet n’a été lancé
pour cet examen. L’approbation d’apparence et la passe d’intégration des
matières restent distinctes de la compatibilité géométrique confirmée.
