---
name: "Le vestiaire 3D — Noa & Mila"
description: "Atelier ClassQuest : choisir, examiner et exporter le personnage réellement habillé."
colors:
  accent: "#31674f"
  bg: "#f3f3ed"
  ink: "#273e35"
  muted: "#65736a"
  line: "#d9e0d4"
  selected: "#e4ecdE"
  paper: "#fafbf6"
  white: "#fff"
  dye-sage: "#80998d"
  dye-mist: "#718999"
  dye-sand: "#b8a586"
typography:
  display:
    fontSize: "35px"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-.035em"
  title:
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.015em"
  body:
    fontFamily: '"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontSize: "12px"
    fontWeight: 650
rounded:
  view: "3px"
  compact: "6px"
  action: "7px"
  choice: "8px"
  stage-mobile: "11px"
  stage: "14px"
spacing:
  outfit-gap: "7px"
  item-gap: "8px"
  section-gap: "20px"
  mobile-section-gap: "22px"
  workbench-gap: "34px"
components:
  button-export:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    rounded: "{rounded.action}"
    padding: "13px"
    width: "100%"
  button-export-hover:
    backgroundColor: "#285941"
  button-reset:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "10px 0"
  button-retry:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    rounded: "{rounded.compact}"
    padding: "11px 15px"
  character-choice:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.choice}"
    padding: "11px 10px"
  character-choice-selected:
    backgroundColor: "{colors.selected}"
  outfit-choice:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.choice}"
    padding: "10px 12px"
    width: "100%"
  outfit-choice-selected:
    backgroundColor: "{colors.selected}"
  view-button:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.view}"
    padding: "8px 12px"
---

# Design System: Le vestiaire 3D — Noa & Mila

## Overview
**Creative North Star: "L’atelier de personnages en lumière du jour"**
Un studio calme, papier chaud et verts assourdis, où la silhouette habillée domine et les commandes restent compactes. La surface sert une tâche de personnalisation (Operate) : choisir, examiner, exporter ; sa signature est le personnage réel accompagné d’un vestiaire ordonné.
**Key Characteristics:**
- Personnage 3D prioritaire, choix immédiatement lisibles.
- Vêtements modulaires réels et accessoires indépendants.
- Lumière douce, surfaces sobres et états explicites.

Périmètre : le vestiaire seul ; les études PNG/SVG/3D voisines sont des travaux concurrents, pas des références normatives pour cette surface.

Autorité : [HTML](../../assets/wardrobe/index.html), [CSS](../../src/wardrobe.css), [état UI](../../src/wardrobe.mjs), [viewer](../../src/wardrobe-viewer.mjs), [README](README.md) et [provenance](../../assets/wardrobe/provenance.json). Extensions : [.impeccable/design.json](.impeccable/design.json).

Morphologie Nintendo / Trikeboy (The Models Resource), adaptée et créditée ; coiffures, gilet, détails vestimentaires et accessoires créés dans Blender pour le prototype. Le haut Essentiel dérive du torse source : aucune prétention d’anatomie 100 % originale. Portraits de secours issus de rendus Blender Cycles, textures issues des archives créditées puis adaptées.

Finition indépendante **rapportée : ship**, après l’unique correction ARIA du bouton « Rotation automatique », validé à 390 px avec `aria-pressed="false"` puis `"true"`. Détecteur rapporté dégradé par ses parsers ; le signal Inter hérité n’est pas actionnable seul.

Vérifications **rapportées**, non rejouées ici : 36 combinaisons personnage × tenue × objet × sac à dos confrontées à l’inventaire GLB, aucun rechargement du modèle pendant les choix ; les trois couleurs Base sont une dimension distincte.

Export contrôlé Mila / Éclaireur / lanterne / sac à dos : **40 meshes, 0 skins**, tags de sélection exacts `gender=female`, `outfit=explorer`, `item=lantern`, `pack=on`. Fallback/retry testé, aucun overflow à 390 px, provenance de 17 rasters vérifiée avec 0 manquant.

Captures finales consultées : [Noa](../../.impeccable/review/wardrobe-noa.png), [Mila Éclaireur](../../.impeccable/review/wardrobe-mila-explorer.png), [Voyageur](../../.impeccable/review/wardrobe-traveller.png), [sac à dos](../../.impeccable/review/wardrobe-backpack.png), [mobile](../../.impeccable/review/wardrobe-mobile.png), [mobile en usage](../../.impeccable/review/wardrobe-mobile-live.png), [visage mobile](../../.impeccable/review/wardrobe-face-mobile.png).

## Colors
**Primary — vert atelier (`accent`) :** export, reprise du chargement et retours d’action ; l’encre verte (`ink`) structure la lecture.

**Secondary — couleurs du vêtement :** Sauge, Brume et Sable (`dye-*`) pilotent uniquement le haut Essentiel ; bleu-vert et terre cuite distinguent Éclaireur et Voyageur dans leurs pictogrammes et géométries.

**Neutral — papier et feuillage :** `bg` pose le fond chaud, `paper` porte les choix au repos, `selected` leur état actif ; `line` sépare, `muted` accompagne, `white` contraste les actions pleines.

**The État explicite Rule.** Associer la couleur sélectionnée à un état accessible et, selon le contrôle, une coche, un point, un anneau ou la position du curseur.
Les rampes OKLCH du sidecar sont dérivées pour le panneau documentaire ; elles ne constituent pas des variantes CSS livrées.

## Typography
Une seule pile sans empattement, Inter déclarée puis replis système ; aucun fichier de police dédié n’est chargé par cette page. Les rôles héritent de la pile `body` du frontmatter.

Titre de page compact (`display`), nom du personnage (`title`), légendes de groupes (`label`) ; les descriptions et notes utilisent des tailles de 10–13 px, sans emphase décorative.

À 760 px et moins : titre de page à 29 px, nom à 17 px, légendes à 13 px ; les choix de personnage, tenues et objets gagnent en lisibilité tactile.

## Layout
Sur ordinateur : conteneur principal de 1384 px maximum, marges internes de 32 px ; grille `minmax(0,1fr) 370px`, intervalle de 34 px. Scène sticky à 22 px, haute de 704 px ; commandes en colonne avec groupes espacés de 20 px.

À 1100 px et moins : colonne de commandes de 330 px, intervalle de 24 px, scène de 670 px. À partir de 1600 px : scène de 760 px et intervalle de 48 px.

À 760 px et moins : colonne unique, marges de 16 px, scène **sticky haute de 390 px**, à 8 px du haut (`z-index:4`), visible pendant les choix ; le canvas occupe l’intérieur, entre 57 px et 60 px d’inset vertical. Cette dernière règle prévaut aussi sous 380 px.

**The Personnage visible Rule.** Conserver le retour visuel pendant l’équipement mobile ; à 390 px de largeur, les cinq vues et la rotation tiennent ensemble, puis les contrôles défilent sous la scène.

## Elevation & Depth
Interface presque plate : bordures fines et niveaux de teinte, sans ombres de cartes. La scène utilise un halo radial crème–sauge ; l’éclairage 3D de studio et une ombre au sol très légère (opacité 0,06) ancrent le personnage.

Les seuls `box-shadow` d’interface sont les anneaux des couleurs et la petite ombre du curseur de sac à dos ; leurs valeurs exactes sont dans le sidecar. Le rendu conserve la pose A statique, sans animation de squelette.

## Shapes
Coins modérés : scène ample (`stage`, puis `stage-mobile`), cartes de choix (`choice`), actions et objets (`action`), barre de vues (`compact`) et segments (`view`). Traits de 1 px ; avatars, points et pastilles circulaires.

Icônes SVG en traits arrondis, vêtements en silhouettes légèrement remplies ; interrupteur de sac à dos de 37 × 22 px et pastilles de couleur de 27 px. La géométrie des habits, poches, foulard et sangles reste distincte du corps.

## Components
- **Choix :** Noa (`male`, cheveux courts châtains, yeux ambrés) ou Mila (`female`, carré auburn, yeux verts) ; Essentiel (`base`), Éclaireur (`explorer`) ou Voyageur (`traveller`). Cartes claires, contour renforcé au survol, sélection teintée avec coche ou point ; groupes nommés et boutons `aria-pressed`.
- **Équipement :** Sauge/Brume/Sable seulement quand Essentiel est actif ; ceinture exclusive Aucun/Sacoche/Lanterne ; sac à dos natif coché/décoché, indépendant. Les choix filtrent les vrais objets par `wardrobe_slot` / `wardrobe_variant` et recolorent les matériaux `Dye`, sans recharger le GLB.
- **Inspection :** Face, ¾, Dos, Tenue, Visage ; glissement horizontal pour tourner librement, défilement vertical préservé (`pan-y`). Rotation volontaire, initialement arrêtée (0,27 rad/s) ; vue prédéfinie ou glissement l’arrêtent. Le nom accessible « Rotation automatique » subsiste quand son texte visuel est masqué sous 1100 px.
- **Rendu :** à la demande, boucle continue seulement pendant la rotation ; arrêt hors vue, onglet masqué ou contexte WebGL perdu. DPR plafonné à 1,7 ; préférences de mouvement réduit appliquées aux transitions CSS, rotation toujours commandée explicitement.
- **Actions :** export vert plein de la combinaison visible (`onlyVisible:true`), module d’export chargé à la demande, état occupé et message de résultat ; réinitialisation discrète vers Noa/Essentiel/Sauge/sans objet/sans sac, vue ¾ et rotation arrêtée. GLB web et export en pose A statique ; rig conservé dans le `.blend` éditable.
- **Disponibilité :** contrôles désactivés pendant chargement/export, progression et messages `role="status"` / `aria-live="polite"`. Échec initial : portrait Blender et bouton Réessayer ; perte du contexte : portrait et demande de rechargement. L’aperçu de secours représente Essentiel, pas la combinaison équipée.
- **Accès :** lien d’évitement, fieldsets/légendes, libellé du viewer synchronisé, focus vert de 2 px décalé de 4 px ; sources dépliables et téléchargement Blender en pied de page.

## Do's and Don'ts
### Do:
- **Do** garder le personnage visible pendant les choix, notamment sur mobile à 390 px.
- **Do** préserver les crédits Nintendo / Trikeboy et distinguer anatomie dérivée, pièces créées et pose web statique.
- **Do** faire correspondre choix, géométrie visible, états accessibles et export GLB.

### Don't:
- **Don't** présenter les trois tenues comme de simples recolorations ou étendre la teinture aux tenues qui ne l’exposent pas.
- **Don't** présenter le GLB statique comme un personnage animé prêt pour le moteur, ni l’anatomie comme 100 % originale.
- **Don't** imposer une boucle de rendu au repos ou remplacer Inter sur le seul signal d’un détecteur dégradé.
