# Personnage ChatGPT : test PNG modulaire

Ouvrir **http://localhost:5199/assets/character-lab/raster/index.html** après `npm run lab`.
La page de comparaison propose aussi le lien **Tester la version PNG**.

## Identité locale livrée

Cette surface prolonge l’atelier existant. Les références visuelles sont
`src/character-lab.css` et son extension `src/character-raster-lab.css`.

- **Palette héritée** : fond minuit (`--bg: #0a1220`), surfaces bleu nuit
  (`--surface: #101d30`), texte bleu pâle (`--ink: #eaf3ff`) et secondaire
  (`--muted: #a1b4cc`). Le laiton (`--gold: #d9bc82`) souligne l’export et les
  sélections ; le bleu (`--blue: #38c9ff`) sert au focus et à la progression.
- **Hiérarchie compacte** : pile Inter avec replis sans-serif, corps de base
  à 15 px, commandes et aides à 11–13 px. Le titre principal utilise
  `clamp(28px, 2.6vw, 38px)` ; les titres de section restent subordonnés.
- **Personnage au centre** : sur grand écran, garde-robe, aperçu principal et
  carte de démonstration forment trois colonnes. À 900 px et moins, l’aperçu
  passe en tête ; à 600 px et moins, l’atelier s’empile sur une colonne.
- **Surfaces délimitées** : fonds tonaux, bordures fines (`--line: #293b50`),
  panneaux arrondis à 12 px et commandes à angles légèrement adoucis.
- **Aperçu indépendant de l’export** : nuit, clair, damier et cadrage portrait
  servent à inspecter le personnage ; seul l’assemblage transparent est exporté.

## Sources et traitement

L’utilisateur a fourni trois exports de la conversation ChatGPT
`https://chatgpt.com/c/6aa55de4-fb7c-83eb-a286-e92a437f2ef5` :

- `ChatGPT Image 12 sept. 2026, 16_25_58 (3).png` : rendu illustré, damier opaque.
- `ChatGPT Image 12 sept. 2026, 16_25_58 (2).png` : variante du même rendu, damier opaque irrégulier ; non retenue.
- `ChatGPT Image 12 sept. 2026, 16_25_57 (1).png` : rendu peint, alpha existant mais halo et corps semi-transparent.

Le modèle exact et le prompt réellement utilisés ne sont pas disponibles. Ces fichiers
sont des images ChatGPT **fournies par l’utilisateur**, pas des générations effectuées
par cette session. Deux rendus du même personnage ont été préparés localement.

`tools/prepare-raster-character.py` extrait une silhouette de la référence illustrée
par séparation chromatique du damier, conserve les reflets neutres intérieurs et
remplace l’alpha défectueux des deux exports. Il sélectionne ensuite le tissu vert
pour créer trois calques colorimétriques : Ardoise, Grenat et Sable. Le visage, les
bras, la ceinture et les bottes restent ceux de la base. La tunique Forêt est intégrée
à la base ; on ne reconstitue pas l’anatomie cachée.

Reproduction (Pillow et NumPy requis) :

```sh
python3 tools/prepare-raster-character.py \
  --illustrated "/chemin/ChatGPT Image 12 sept. 2026, 16_25_58 (3).png" \
  --painted "/chemin/ChatGPT Image 12 sept. 2026, 16_25_57 (1).png"
```

## Contrat d’assemblage

Le kit livre **deux bases détourées et six calques de tunique**, soit trois couleurs
par rendu en plus de Forêt intégrée à chaque base. Les huit PNG conservent
**1024 × 1536 px**, le même cadre et un véritable canal alpha.
Ne pas recadrer séparément les calques de tunique. `manifest.json` décrit les fichiers,
les emplacements et l’ancrage des pieds `(512, 1484)`.

Ordre d’affichage : équipements arrière → base → tunique → équipements avant.
Les calques de tunique se dessinent à `(0, 0)` à la taille du canevas. Le kit ZIP contient
les PNG, leurs provenances, le manifeste et une notice. Chaque PNG embarque également
sa provenance et l’empreinte du fichier source dans ses métadonnées.

La page permet de :

- choisir le rendu et la couleur de la tunique ;
- vérifier la silhouette et le portrait sur fond nuit, clair ou damier ;
- importer un autre personnage transparent (les tuniques du rôdeur sont alors désactivées) ;
- importer une cape, une coiffe et un accessoire indépendants ;
- régler leur centre, leur taille et leur ordre avant/arrière ;
- retirer ou replacer chaque pièce ;
- exporter le PNG assemblé, **sans le fond d’aperçu**, et une configuration JSON
  contenant les positions et les images importées encodées en PNG.

Les imports de base et d’équipement acceptent les PNG et WebP transparents,
jusqu’à 12 Mo par image et 4 096 px par côté. Les images opaques (y compris un
damier peint) ou entièrement transparentes sont rejetées sans remplacer le montage existant.

Un import de 1024 × 1536 px conserve son cadre. Les autres images sont ajustées à
l’emplacement choisi. Les imports restent en mémoire dans l’onglet ; aucun téléversement
ni changement de données de classe n’est effectué. Le JSON permet de conserver le montage,
mais sa réimportation dans l’atelier n’est pas implémentée. Le kit ZIP ne contient que
les ressources livrées, pas les équipements ajoutés dans le navigateur.

## Prochaines images à demander à ChatGPT

Joindre **ranger-peint.png** ou **ranger-illustre.png**, selon le rendu retenu, avec :

> Use the attached character as the exact visual and registration reference. Create
> only a detachable [forest cloak / leather cap / brass lantern] for this character,
> without redrawing the body. Match the reference perspective, fixed pose, scale,
> material rendering and lighting. Keep the original 1024 × 1536 canvas and place
> the equipment where it belongs on that canvas. Output a PNG with a real alpha
> channel, not a painted checkerboard or studio backdrop. No text, contact sheet,
> 3D render, SVG, duplicate object or cast shadow outside the equipment.

Vérifier ensuite l’alignement et le détourage : une image générée ne garantit pas
une concordance pixel à pixel. Les capes/coiffes/accessoires ne sont pas présents dans
les trois fichiers fournis. Le test livre donc l’import et le montage, pas de fausses
pièces présentées comme ayant été générées. Une animation ou un autre angle demande
des images supplémentaires.

## État final et vérifications

Le finish reviewer a rendu **SHIP**, sans correction matérielle, sur les captures
`.impeccable/review/raster-desktop.png` et `.impeccable/review/raster-mobile.png`.
Les résultats ci-dessous proviennent du compte rendu de vérification transmis pour
cette livraison ; la passe documentaire les consigne après lecture du code, sans
relancer le navigateur.

- **Tenues** : les 2 rendus × 4 tuniques ont été exercés ; pour chaque rendu,
  changer de tunique change les pixels du vêtement et laisse le visage invariant.
- **Aperçu** : les fonds et le cadrage ne changent pas les pixels du PNG exporté.
- **Imports** : PNG opaque rejeté sans perte du montage ; import d’équipement,
  position, taille, ordre avant/arrière, retrait et remise en place vérifiés.
  L’import d’une base personnalisée désactive les tuniques du rôdeur.
- **Exports** : PNG et JSON téléchargés, alpha du PNG valide ; le JSON contient
  les images importées et leurs réglages.
- **Navigateur** : aucune erreur console lors de la dernière navigation ; sur
  mobile, largeur du document mesurée à 375 px pour un viewport de 390 px.
- **Ressources** : provenance présente sur 8 PNG sur 8 et CRC du ZIP valides.
  Le détecteur dégradé par expressions régulières a retourné `[]` ; les parseurs
  étaient absents, ce résultat reste limité à ce mode de détection.
