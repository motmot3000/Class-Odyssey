---
name: Game of More — étude de matières surface-v3
description: Comparaison des matières à géométrie et ancrages base-v2 préservés.
colors:
  bg: "#f2f3ee"
  ink: "#253d34"
  muted: "#617168"
  line: "#d4ddd0"
  green: "#315e48"
typography:
  display: {fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "34px", fontWeight: 650, lineHeight: 1.2, letterSpacing: "-.025em"}
  body: {fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "14px", lineHeight: 1.5}
  label: {fontSize: "11px"}
rounded:
  button: "4px"
  field: "5px"
  group: "6px"
  stage: "12px"
spacing:
  controls: "12px"
  comparison: "18px"
  page: "28px"
components:
  retry: {backgroundColor: "{colors.green}", textColor: "#fff", rounded: "{rounded.button}", padding: "8px 11px"}
  view-button: {backgroundColor: "transparent", textColor: "{colors.muted}", rounded: "{rounded.button}", padding: "8px 13px"}
  view-button-active: {backgroundColor: "#dbe7d3", textColor: "#274a35", rounded: "{rounded.button}", padding: "8px 13px"}
  select: {backgroundColor: "#fafcf6", textColor: "{colors.ink}", rounded: "{rounded.field}", height: "36px", padding: "0 10px"}
---

# Design System: Game of More — étude de matières

## Overview
**Creative North Star: "Le monde papier sauge de Game of More"**
Une présentation calme et accueillante laisse les personnages stylisés au premier plan. Les commandes discrètes et les surfaces claires facilitent une comparaison honnête des matières.
**Key Characteristics:**
- Papier sauge, encre végétale, contours fins.
- Personnages dominants, commandes compactes, comparaison explicite.
Périmètre local : mode **Experience**, outil comparatif ; version matières séparée surface-v3, préservant base-v2. Dix variantes : Noa/Mila × light, medium, tan, brown, dark.
**Review : ship**, uniquement pour l’étude de matériaux. Amélioration visuelle **MODÉRÉE**, surtout pantalon et reliefs ; effet mou encore visible sur les cheveux et le shirt. L’objectif de réalisme n’est pas pleinement atteint.

## Colors
Primaire : vert végétal pour la reprise 3D ; neutres : papier sauge, encre sombre, texte secondaire et séparateurs doux. La sélection reçoit un aplat sauge et un état `aria-pressed` explicite.

## Typography
Inter avec repli système ; aucun chargement de police dédié dans la page. Titre compact, labels discrets ; sous-titre (13px), commandes (12px), titres de panneaux (15px, graisse 600). Sur mobile, le titre passe à (29px).

## Layout
Conteneur centré (1360px maximum), deux panneaux égaux espacés selon `comparison`, hauteur (630px). Introduction et choix précèdent les commandes ; statut, trois notes matières et méthode suivent les modèles.
À (800px) et moins : marge intérieure (16px), panneaux empilés (490px de haut, écart 14px), commandes repliables et notes sur une colonne. Conserver l’ordre avant/après et les images en `contain`.

## Elevation & Depth
Interface sans ombre portée : bordures et fond radial crème vers sauge donnent une profondeur douce. Les reliefs PBR, la rugosité différenciée et les iris détaillés agissent sur la lumière, pas sur les positions des sommets.
La 3D partage cadrages et éclairage ; les rendus Blender ont leur mise en scène respective et ne constituent pas une comparaison lumineuse contrôlée.

## Shapes
Petits arrondis pour les commandes, panneaux plus ouverts ; bordure (1px), légèrement renforcée côté surface-v3. Préserver silhouette, proportions, pose et ancrages base-v2 ; les UV/atlases peuvent différer.

## Components
- Deux viewers synchronisés : Silhouette, Visage, Tenue, Dos ; un changement de vue active la 3D. Retour aux rendus : vue Silhouette.
- Sélecteurs natifs Personnage/Carnation ; téléchargement GLB associé à la variante courante ; liens Blender, provenance et retour au jeu.
- Chargement annoncé via `role="status"`/`aria-live="polite"` ; posters conservés en échec, bouton Réessayer ; focus visible (2px, décalage 4px). Aucun mouvement décoratif ni survol spécifique défini.
- Cycle de vie : annulation des générations obsolètes, nettoyage des viewers créés lors d’un échec partiel, reprise après erreur/perte de contexte et libération à `pagehide`.
- Vérifications **rapportées** : 38 tests ; deux viewers, nettoyage partiel, retry, genres, carnations et mobile ; 76 provenances, 0 missing. Non réexécutées pour cette documentation.
- Invariants : `deepEqual` de la pose et des ancrages dans `tests/refined-surfaces.test.mjs` ; hashes SHA-256 des sommets triés peau/yeux/vêtements/cheveux dans `assets/characters-refined/geometry-check.json`.
- Sources : `assets/characters-refined/index.html`, `src/surface-study.css`, `src/surface-study.mjs`, `docs/characters-refined/README.md`, `assets/characters-refined/provenance.json` (chemins depuis la racine).
- Captures finales examinées : `.impeccable/review/{surface-comparison,surface-face-3d,surface-body-3d,surface-girl-3d,surface-mobile}.png` ; détails `assets/characters-refined/{boy-face,girl-face,boy-body}.png`.

## Do's and Don'ts
- **Do** préserver la version matières séparée, la pose et les ancrages base-v2 ; comparer à caméra et lumière communes en 3D.
- **Do** créditer Nintendo / The Models Resource, dépôt de Trikeboy, pour la morphologie et les cartes sources ; Game of More pour l’adaptation et la passe matières, conformément à la provenance.
- **Don't** revendiquer une qualité AAA, une transformation majeure ou un objectif de réalisme pleinement atteint.
- **Don't** masquer l’effet mou résiduel des cheveux et du shirt, ni confondre validation technique et gain visuel.
