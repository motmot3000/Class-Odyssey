---
name: "Le veilleur des sous-bois — SVG"
description: "Référence SVG de finition : visage affiné, bases neutres et tenues de rôdeur, variantes masculine et féminine."
colors:
  base-shirt: "#6A8A80"
  base-trouser: "#374749"
  base-shoe: "#4B4438"
  forest: "#2C493D"
  skin: "#D6A87D"
  leather: "#705036"
  brass: "#C1A16B"
  vector-action: "#c0d0a8"
  action-ink: "#18291f"
  selector-bg: "#172c26"
  selector-ink: "#dbe8d7"
typography:
  title:
    fontSize: "28px"
  selector:
    fontSize: "11px"
rounded:
  selector: "5px"
spacing:
  selector-gap: "8px"
components:
  vector-action:
    backgroundColor: "{colors.vector-action}"
    textColor: "{colors.action-ink}"
  variant-selector:
    backgroundColor: "{colors.selector-bg}"
    textColor: "{colors.selector-ink}"
    typography: "{typography.selector}"
    rounded: "{rounded.selector}"
    padding: "0 26px 0 10px"
    height: "33px"
---
# Design System: Le veilleur des sous-bois — SVG

## Overview
**Creative North Star: "Le veilleur des sous-bois"**
Personnages juvéniles debout de face, visage naturel et calme, silhouette centrée et relief discret. La base neutre masculine ouvre l’expérience; les deux versions du personnage partagent une tenue simple et peuvent retrouver la tenue d’aventure du rôdeur ou de la rôdeuse.
**Key Characteristics:**
- Visage affiné, pupilles circulaires et iris clippés, pièces appariées et tracés éditables.
- Quatre variantes, deux sélecteurs natifs, bases sans équipement et cadrages isolés.

Relevé de finition du 12 septembre 2026, limité aux illustrations et au parcours SVG : portrait, carte, sélecteurs, comparaison de source et inspection.
Demandes retenues : retoucher le visage, proposer une version féminine, conserver les bases neutres sans équipement ni capuche; haut simple, pantalon et chaussures pour les deux bases.
Sources éditables : `assets/character-lab/ranger-vector.svg` et `tools/svg/base-parts.svg`. `npm run build:svg` appelle `tools/svg/build-character-variants.py` et exporte trois variantes autonomes : `character-base-male.svg`, `character-base-female.svg`, `ranger-feminine.svg`, dans `assets/character-lab/`.
Le rôdeur masculin reste le SVG source; le générateur partage le visage, assemble les pièces et élague les définitions inutilisées. Les exports gardent leurs tracés natifs éditables.
Intégration observée : `src/character-svg-variants.mjs` et `.css`, `src/character-vector-lab.css`, parties SVG de `src/character-lab.mjs` et `character-lab.html`; commande confirmée dans `package.json`.

## Colors
Primaire : vert grisé du haut simple, verts forêt de la cape et de la capuche; secondaires : carnation chaude et cuir brun; tertiaire : laiton des accessoires d’aventure; neutres : pantalon ardoise et chaussures sobres.
Les tokens du dessin correspondent aux arrêts existants des dégradés, conservés dans le sidecar; les mains partagent `hand-color`, distinct du visage. Verre ambré et flamme claire restent propres aux variantes équipées.
Action vert clair à encre sombre, survol éclairci; cadrage actif vert sourd à texte clair. Les sélecteurs utilisent un fond vert profond, un texte clair et une bordure verte discrète.

## Typography
Les quatre SVG sont sans `<text>` ni police externe; chacun conserve un `<title>` et une `<desc>` accessibles.
Après initialisation, titre d’inspection « Personnage de base. », « Rôdeur, en SVG. » ou « Rôdeuse, en SVG. »; taille locale du frontmatter, ramenée à 24px à 700px et moins.
Sélecteurs à 10px entre 701 et 1000px, 12px à 700px et moins; cadrages à 11px sur mobile. Famille et styles généraux restent hérités du studio.

## Layout
Silhouette commune `full` : `viewBox="0 0 560 940"`; portrait et carte utilisent le fichier sélectionné sans query ni fragment, inspection initiale avec `?view=full`.
Deux cadrages natifs pour chaque base : `face="219 86 122 159"` et `materials="193 237 174 278"` — soit trois vues avec Silhouette.
Trois cadrages natifs pour chaque rôdeur : `face="209 80 142 169"`, `materials="187 284 186 270"`, `lantern="345 491 82 177"` — soit quatre vues avec Silhouette.
Images en `object-fit:contain`. Les sélecteurs sont centrés au-dessus du portrait, espacés selon le frontmatter, à 52px du haut; padding du portrait `93px 16px 64px`.
Entre 701 et 1000px : sélecteurs à 76px du haut, écart de 5px, hauteur de 31px; padding supérieur du portrait à 118px.
À 700px et moins : sélecteurs à 54px du haut, hauteur de 34px; padding du portrait `97px 16px 52px`.
La CSS SVG fixe le portrait à 574px, 535px à 1000px et moins, puis 495px à 700px et moins; portrait et inspection passent à 660px dès 1550px.
Inspection : minimum 574px, image à 49px du haut et 24px des côtés, hauteur `calc(100% - 124px)`; commandes à 22px du bas.
À 700px et moins : dessin avant la fiche, minimum 480px, image à 43px du haut et hauteur `calc(100% - 114px)`; commandes à 17px du bas.

## Elevation & Depth
Dégradés verticaux des tissus et du cuir, modelé radial du visage et ombre au sol composent un volume doux; le fond du portrait et de l’inspection passe du vert ardoise au bleu sombre.
Ovale raccourci, volume facial atténué, nez et bouche affinés gardent le regard naturel. Cape à plis appariés et halo local de lanterne ajoutent du relief aux variantes équipées.
Coutures espacées sur les bords utiles; aucun motif de tissage `<pattern>` ni filtre de flou dans les illustrations.

## Shapes
**The Axe 280 Rule.** Conserver l’axe de construction x=280 pour le visage et les pièces appariées; les accessoires du rôdeur gardent leur asymétrie fonctionnelle.
Chaque variante utilise cinq `<use>` miroir avec `translate(560 0) scale(-1 1)` : yeux, jambes, manches, chaussures et mains en base; bottes et plis de cape dans la tenue d’aventure.
Dans `eye-template`, iris circulaire (r=4.05) et pupille circulaire (r=2.1) sont clippés par `eye-opening`; les reflets sont posés séparément. Ce clip s’ajoute à celui de la cape dans les rôdeurs.
La version féminine adapte ovale, sourcils, lèvres et coiffure; sa base ajoute les cheveux arrière et réduit le corps à 97% en largeur autour de x=280. Haut, pantalon et chaussures restent simples.
Les sélecteurs ont les petits angles adoucis du frontmatter; leurs libellés masqués visuellement restent accessibles.

## Components
Deux `<select>` indépendants : « Version du personnage » (`#svg-gender`, Masculin/Féminin) et « Tenue du personnage » (`#svg-outfit`, Base neutre/Rôdeur), groupés sous « Personnage et tenue du SVG »; défaut `male` + `base`.
Correspondance : `male/base` → `character-base-male.svg`; `female/base` → `character-base-female.svg`; `male/ranger` → `ranger-vector.svg`; `female/ranger` → `ranger-feminine.svg`.
Chaque changement synchronise portrait, carte, titres, fiche, ALT, téléchargement et comparaison avec le SVG actuel; il réaffiche le SVG 2.0 et conserve le cadrage compatible.
Base : Silhouette / Visage / Tenue; rôdeur et rôdeuse : Silhouette / Visage / Coutures / Lanterne. `materials` conserve son identifiant; Lanterne est masquée et désactivée en base, avec retour à Silhouette si elle était sélectionnée.
Le portrait « Examiner le dessin » et la carte SVG ouvrent l’inspection et focalisent `#vector-title`; l’onglet « Détails du SVG » change le mode sans déplacer le focus.
Le retour « La comparaison » focalise `#open-vector`, ou `#toggle-original` si le portrait est masqué. Le nom accessible du portrait est « Examiner le dessin SVG en détail ».
**The Ressources isolées Rule.** Utiliser `/assets/character-lab/{fichier}.svg?view=nom#nom` pour les détails et `?view=full` sans fragment pour Silhouette; la query isole le cadrage du portrait et de la carte.
Les boutons synchronisent URL, ALT et `aria-pressed`. Correction ALT constatée : `dataset.svgDescription = fullTitle` conserve sexe et tenue; au clic, la description courante précède le nom générique exact du cadrage.
Noms ALT : « silhouette complète », « gros plan du visage et du regard », « gros plan de la tenue », « gros plan de la main et de la lanterne ». Au changement de variante, le suffixe est réinitialisé à « silhouette complète » ou « gros plan »; le bouton de vue précise ensuite le cadrage.
La bascule alterne « Voir le SVG actuel » / « Revenir au SVG retravaillé » et `aria-pressed`; « Télécharger le SVG » pointe vers le fichier de la variante, sans cadrage. Le parcours SVG n’appelle pas le chargement du viewer GLB.
Survol du portrait ×1.025 en 500ms; focus local décalé de −6px vers l’intérieur. Depuis la carte, le défilement devient instantané avec `prefers-reduced-motion: reduce`.

Vérifications transmises : quatre XML valides, IDs uniques dans chaque fichier, zéro bitmap, références résolues; aucun équipement dans les bases; 14 vues et quatre téléchargements corrects, activation clavier Entrée, aucun débordement à 390px, aucun GLB chargé en SVG et zéro `pageerror`.
Captures validées transmises, chemins depuis la racine : `.impeccable/review/base-male.png`, `base-female.png`, `ranger-male.png`, `ranger-female.png`, `face-refined.png`, `base-female-mobile.png`, `base-female-detail-mobile.png` (même dossier).
Revue indépendante transmise : **ship SVG**, avec réserve initiale sur les ALT génériques et l’ancienne copie des gros plans; correction des boutons de cadrage confirmée dans les sources locales. Cette actualisation documentaire ne rejoue pas la revue visuelle ni les essais navigateur.

## Do's and Don'ts
- **Do** Garder la base masculine par défaut, les deux bases en vêtements simples et les rôdeur/rôdeuse accessibles par les sélecteurs.
- **Do** Préserver le visage affiné, l’axe 280, les templates miroir, les deux sources éditables et les trois exports reproductibles.
- **Do** Synchroniser variante, cadrage, ALT, téléchargement et focus; conserver trois vues en base, quatre en rôdeur et leurs URLs isolées.
- **Don't** Ajouter équipement, capuche, cape ou accessoire aux bases neutres; remplacer les tracés par un bitmap.
- **Don't** Étendre le verdict SVG à la page globale, au PNG ou à la 3D, ni le présenter comme une perfection absolue.
