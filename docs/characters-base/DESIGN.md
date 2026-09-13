---
name: Game of More — personnages de base
description: Documentation de finition de l’intégration existante, UI historique anglaise et bleu nuit.
colors:
  bg: "#0a1220"
  surface-1: "#101d33"
  surface-2: "#16263f"
  surface-3: "#0c1729"
  surface-hover: "#1c3050"
  line: "#24395c"
  ink: "#eaf3ff"
  ink-2: "#c6d9f2"
  xp: "#38c9ff"
  hp: "#ff5a5f"
  money: "#ffc93c"
  rank: "#b69cff"
typography:
  display: { fontFamily: '"Baloo 2", ui-rounded, system-ui, sans-serif' }
  body: { fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif', fontSize: "1rem", lineHeight: 1.5 }
rounded: { sm: "8px", md: "12px", lg: "18px" }
spacing: { s1: "4px", s2: "8px", s3: "12px", s4: "16px", s5: "24px" }
components:
  button: { backgroundColor: "{colors.surface-2}", textColor: "{colors.ink}", rounded: "{rounded.sm}", padding: "0 16px" }
  hero-card: { backgroundColor: "{colors.surface-1}", rounded: "{rounded.lg}", padding: "12px" }
---

# Design System: Game of More — personnages de base

## Overview
**Creative North Star: "Le plateau de classe bleu nuit"**
Cette fiche locale documente l’intégration livrée, sans refonte. L’UI historique anglaise et `styles.css` font autorité : lecture à distance, actions explicites, mêmes repères dans le plateau et le casier.
**Key Characteristics:**
- Mode de cette surface : Operate ; prénom → héros → niveau/XP → HP → argent.
- Bases garçon/fille en tenue basique, cinq carnations : `light`, `medium`, `tan`, `brown`, `dark`.
- Images légères dans les vues courantes ; un seul WebGL à la demande dans le dialogue.

## Colors
Bleu nuit en fond et surfaces étagées ; encres claires pour la lecture. Cyan pour XP/actions, rouge pour HP, or pour argent et violet pour rang : conserver cette sémantique historique.

## Typography
Inter porte les contrôles et informations ; Baloo 2 les titres expressifs. Conserver l’échelle fixe historique et les libellés anglais (`View in 3D`, `Front`, `¾`, `Back`, `Face`, `Retry 3D`).

## Layout
Le plateau conserve grille/liste (bascule automatique au-delà de 24 élèves). Les images sont contenues, ancrées en bas, avec `srcset` 256/512 et décodage asynchrone.
`src/characters.css` cadre la scène à 340 px de large, hauteur `min(62dvh,510px)`, minimum 350 px ; à ≤700 px : pleine largeur et hauteur 390 px. Les commandes restent sous le personnage.

## Elevation & Depth
Surfaces et bordures structurent la lecture ; le dialogue reprend l’ombre forte et le fond occultant historiques. La sélection associe anneau cyan, fond teinté et coche ; le statut « out » désature aussi le personnage.

## Shapes
Cartes et dialogue aux grands arrondis, scène aux arrondis moyens ; commandes de caméra compactes (rayon 5 px, hauteur minimale 34 px). La fermeture garde une cible de 44 px.

## Components
- `src/characters.mjs` résout genre/carnation et images WebP ; attributs de scène `starter` / `no-weapon`, aperçu immédiat et balisage accessible du viewer.
- `src/views/board.mjs`, `console.mjs`, `student.mjs` réemploient les images pour grille/liste, fiche enseignant, sélection élève et casier ; ce dernier expose `View in 3D`.
- `src/views/modals.mjs` place le viewer dans le `<dialog>` élève en lecture seule ; achats/inventaire restent au domaine existant et aperçus d’items en SVG.
- `src/app.mjs` monte le viewer à l’ouverture et le libère à la fermeture/remplacement ; `src/character-runtime.mjs` gère import différé, interruption, aperçu de secours, statut annoncé et retry.
- `src/base-character-viewer.mjs` charge/cache le modèle choisi, propose quatre cadrages et rend au changement de vue/taille ; nettoyage géométries, matériaux, textures, observateur et contexte GPU à la fermeture.
- Anatomie : accord `items/update`, bras abaissés de 82° depuis la T-pose, coudes à 8°, doigts détendus, paumes vers les cuisses. Nuque raccordée puis soudée, sans cheveux masquant un trou ; coiffures séparées, aucune racine peinte sur la peau. Voir [POSE-CONTRACT.md](POSE-CONTRACT.md).
- Provenance : anatomie et textures initiales Nintendo — *The Legend of Zelda: Breath of the Wild* ; archives mises en ligne par Trikeboy / The Models Resource, créditées dans `assets/wardrobe/provenance.json`.
- Validation rapportée : [README.md](README.md) indique 36 tests Node et le parcours navigateur ordinateur/mobile (variantes, vues, casier, XP/annulation, fermeture, interruption, retry et cache). Revue indépendante rapportée par le commanditaire : **ship, sans correction**.
- Captures référencées, chemins depuis la racine : `.impeccable/review/base-game-board.png`, `.impeccable/review/base-game-dialog.png`, `.impeccable/review/base-game-back.png`, `.impeccable/review/base-game-girl-face.png`, `.impeccable/review/base-game-student-mobile.png`, `.impeccable/review/base-game-mobile-dialog.png`.
- Contrôles de nuque référencés : `assets/characters-base/boy-neck-check.png` et `assets/characters-base/girl-neck-check.png`. Cette passe documentaire ne relance ni tests ni navigateur et ne lit ni ne mesure les binaires/captures.

## Do's and Don'ts
- **Do** conserver l’anglais, le bleu nuit et les repères sémantiques historiques.
- **Do** maintenir les deux bases, cinq carnations, la pose convenue et les crédits de provenance.
- **Don't** démarrer WebGL sur plateau/liste/casier ni masquer un défaut de nuque avec les cheveux.
- **Don't** présenter cette livraison base-only comme un habillage 3D des items ou réinterpréter les validations rapportées comme de nouveaux contrôles.
