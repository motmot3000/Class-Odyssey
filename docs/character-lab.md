# Atelier SVG / 3D — le rôdeur

## Ouvrir le test

```sh
npm ci
npm run build:lab
npm run lab
```

**http://localhost:5199/character-lab.html**

Le serveur de démonstration écoute sur `0.0.0.0:5199`, donc il peut aussi être
ouvert depuis un autre appareil avec l’adresse réseau de cette machine.
`PORT` permet de changer le port. Ce serveur est en lecture seule et ne sert
ni les données des classes, ni les routes API. Le lien de retour au jeu vise
le port 5180 sur le même hôte.

## Contenu

- À gauche : la nouvelle illustration `ranger-vector.svg`, entièrement dessinée
  avec des tracés éditables. Le bouton « Voir le SVG actuel » affiche le vrai
  `renderHero` du jeu, tenue `vocab-ranger`, capuche `shadow-hood`, lanterne
  `lore-lantern`.
- Au centre : **3D aventure**, le rendu du modèle Blender reconstruit.
- À droite : **3D stylisée — Jeune éclaireur**, un deuxième modèle créé dans
  Blender : proportions plus naturelles, pose détendue, tenue simple et mate,
  foulard ocre et lanterne. Les deux portraits sont de vrais rendus 3D.
- Clic sur le dessin : gros plans SVG natifs (silhouette, visage, coutures,
  lanterne), sans rasterisation ni moteur 3D. L’illustration reste nette au zoom.
- Clic sur un portrait 3D : chargement différé du GLB correspondant dans Three.js,
  vues face / trois quarts / dos / détail, rotation facultative. Le sélecteur
  Aventure / Stylisée change le modèle, les informations et les téléchargements.
  Aucun mouvement au chargement ; chaque modèle est chargé une seule fois.
- Plus bas : quatre cartes comparatives (actuel, SVG retravaillé, 3D aventure,
  3D stylisée) avec un personnage fictif et des valeurs
  explicitement présentées comme démonstration.
- Un aperçu fixe reste visible si WebGL ou le chargement du modèle échoue.

## Fabrication et fichiers

1. Référence illustrée générée localement avec **Juggernaut XI**, seed 312509.
2. Détourage U2Net pour que le fond ne devienne pas de la géométrie.
3. Reconstruction avec **Hyper3D Rodin Sketch**, piloté via le MCP Blender.
4. Reprise dans **Blender 4.5.3** : orientation, échelle, éclairage studio,
   transfert de la référence sur les surfaces frontales, texture 2K précalculée.
5. Export GLB autonome et rendu Cycles transparent, converti en WebP.

| Fichier | Rôle |
| --- | --- |
| `assets/character-lab/ranger-vector.svg` | Illustration vectorielle originale, avec groupes nommés et vues de détail |
| `assets/character-lab/ranger.blend` | Scène Blender, modèle et textures intégrées |
| `assets/character-lab/ranger.glb` | Modèle web texturé, 23 332 triangles |
| `assets/character-lab/ranger-portrait.webp` | Aperçu web du modèle réellement rendu |
| `assets/character-lab/ranger-portrait.png` | Rendu source transparent |
| `assets/character-lab/ranger-reference.png` | Référence générée détourée, pas le rendu 3D |
| `assets/character-lab/provenance.json` | Prompt, seed, origines et transformations |
| `tools/blender/studio.py` | Mise en scène et export après import du modèle |
| `tools/blender/refine_texture.py` | Transfert frontal et texture 2K précalculée |
| `src/character-lab.mjs` | Comparaison et navigation |
| `src/character-vector-lab.css` | Extension locale pour la comparaison SVG/3D et les gros plans |
| `src/character-viewer.mjs` | Affichage WebGL, chargé au clic |
| `assets/character-lab/ranger-playful.blend` | Scène du Jeune éclaireur, pièces et matériaux nommés |
| `assets/character-lab/ranger-playful.glb` | Modèle stylisé autonome, 88 840 triangles |
| `assets/character-lab/ranger-playful-portrait.webp` | Portrait du modèle stylisé rendu avec Cycles |
| `assets/character-lab/ranger-playful-provenance.json` | Fabrication et origine de l’alternative stylisée |
| `tools/blender/playful_ranger.py` | Modélisation, studio, export et rendu reproductibles |
| `src/character-playful-lab.css` | Comparaison à trois pistes et cartes adaptées au mobile |

Le premier personnage procédural de l’étude aventure a été rejeté et remplacé.
`ranger.blend` contient seulement la reconstruction retenue et son studio.
L’alternative stylisée est une nouvelle proposition indépendante.

### Proposition Blender stylisée

Le Jeune éclaireur est modélisé directement avec des volumes simples, des
surfaces subdivisées et des courbes converties en maillages. Il possède un dos
complet, une petite cape et un sac à dos. Ses couleurs sont des matériaux
autonomes, sans texture projetée ni service de reconstruction.

La première version, trop enfantine et proche d’une mascotte, a été revue
après retour utilisateur : tête et yeux réduits, jambes allongées, bras baissé,
sourire discret, couleurs plus sobres et équipement simplifié. L’objectif est
un jeune aventurier stylisé, moins épique que la reconstruction réaliste.
Les noms techniques `playful` sont conservés pour la continuité des liens.

Reproduction avec Blender 4.5 :

```sh
blender --background --factory-startup --python tools/blender/playful_ranger.py
magick assets/character-lab/ranger-playful-portrait.png -quality 88 -define webp:method=6 assets/character-lab/ranger-playful-portrait.webp
```

### Proposition SVG

Le SVG est une interprétation dessinée du même rôdeur, revue après la demande
de plus de symétrie : vue de face, visage doux, cape régulière, cuir cousu,
bottes assorties, fermoir-boussole centré et lanterne verticale.
Les manches, jambes, bottes, yeux et plis de cape partagent des tracés miroir
autour de l’axe x=280. Le tissage et les petits traits décoratifs ont été retirés.
Le fichier conserve ses dégradés de matières et ses groupes de vêtements nommés.
Il n’embarque aucune image bitmap, police ou ressource distante. Ce n’est pas
une vectorisation automatique du rendu 3D. Son origine est également consignée
dans les métadonnées SVG et dans `provenance.json`.

Les ressources des gros plans utilisent `?view=nom#nom` pour isoler leur
cadrage de celui des portraits. L’image du personnage reste identique après
une visite des quatre gros plans, vérifiée par comparaison exacte des pixels.

## Portée du prototype

### Bases neutres SVG 2.0

Le panneau SVG propose **Masculin / Féminin** et **Base neutre / Rôdeur**.
La base masculine est affichée par défaut. Les bases portent un haut simple,
un pantalon et des chaussures : aucune capuche, cape, sacoche, ceinture,
lanterne ou autre pièce d’équipement.

- `assets/character-lab/character-base-male.svg`
- `assets/character-lab/character-base-female.svg`
- `assets/character-lab/ranger-vector.svg`
- `assets/character-lab/ranger-feminine.svg`

Le visage est retouché sur les quatre variantes. Les bases et la rôdeuse sont
exportées par `npm run build:svg`, à partir du rôdeur SVG éditable et de
`tools/svg/base-parts.svg`. Le générateur retire les définitions inutilisées.
Le téléchargement, la carte et les cadrages suivent la variante choisie.
Les bases disposent de trois cadrages : Silhouette, Visage et Tenue.

### Modèles 3D

Le test sert à juger la **direction visuelle** et le passage carte → personnage.
Les deux modèles sont statiques, sans squelette d’animation ni garde-robe modulaire.
Sur la piste aventure, la texture frontale est plus définie que les côtés et le dos reconstruits ;
les accessoires fins, notamment la lanterne, restent approximatifs.
Ce n’est donc pas encore un asset de production pour tous les élèves.

Les images ont été produites avec le moteur local disponible, pas avec GPT Image.
La reconstruction utilise l’essai intégré de Rodin.

## Vérification

`npm test` vérifie les tests existants du jeu. `npm run build:lab` produit deux
modules locaux : la page légère et le moteur 3D différé. Aucune dépendance CDN
n’est requise à l’utilisation. La page est vérifiée sur ordinateur et mobile,
avec navigation clavier, vues 3D et traitement d’un échec de chargement.

L’ajout stylisé a été vérifié à 1440 × 1000 et 390 × 844 : trois portraits,
quatre cartes, bascule des deux GLB, quatre angles, rotation, téléchargement
des fichiers, retour du focus et absence de débordement horizontal. Un échec
GLB simulé conserve le portrait ; le réessai charge le modèle. Les captures
de cette révision sont dans `.impeccable/review/stylized-*.png`.

La comparaison utilise trois colonnes égales sur ordinateur ; sur mobile,
les portraits s’empilent et les quatre cartes forment une grille 2 × 2.
Le viewer précède ses informations sur mobile. Les couleurs, la typographie
et les cadres restent ceux du laboratoire existant.

Revue indépendante : **ship**, au périmètre de l’ajout local. Réserve
artistique : le rendu demeure cartoon et lisse, proche d’une figurine ;
l’équilibre final du style reste à valider par l’utilisateur.
