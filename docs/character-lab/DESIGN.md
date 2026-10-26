---
name: "Class Odyssey — Atelier du rôdeur"
description: "Relevé du prototype local avant/après et de son exploration 3D."
colors:
  bg: "#0a1220"
  surface: "#101d30"
  line: "#293b50"
  ink: "#eaf3ff"
  muted: "#a1b4cc"
  gold: "#d9bc82"
  blue: "#38c9ff"
typography:
  display:
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "34px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-.025em"
  body:
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "15px"
    lineHeight: 1.5
rounded:
  panel: "12px"
  tabs: "8px"
  action: "6px"
  tab: "5px"
spacing:
  mobile-gutter: "18px"
  desktop-gutter: "32px"
  panel-inset: "28px"
components:
  portrait-action:
    backgroundColor: "{colors.gold}"
    textColor: "#1d2527"
    rounded: "{rounded.action}"
    padding: "13px 19px"
  mode-tab:
    textColor: "{colors.muted}"
    rounded: "{rounded.tab}"
    padding: "10px 16px"
  mode-tab-selected:
    backgroundColor: "#27384a"
    textColor: "{colors.ink}"
  pupil-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "14px 16px"
    height: "345px"
---

# Design System: Class Odyssey — Atelier du rôdeur

## Overview

Relevé du monde effectivement construit au 12 septembre 2026, limité à `character-lab.html`, `src/character-lab.css`, `src/character-lab.mjs` et `src/character-viewer.mjs`. Le prototype prolonge le monde bleu nuit existant : figures centrales, texte bleu pâle, cadres discrets et accent laiton sur l’accès à la 3D. Aucune composition approuvée ni nouvelle métaphore de marque n’est établie.

La surface est en mode **Experience** : elle expose un seul rôdeur, sa comparaison SVG/rendu Blender, son volume au clic et sa lecture dans une carte de démonstration. Ce mode décrit cette surface seulement, pas l’ensemble du produit.

**Key Characteristics:**
- Monde bleu nuit maintenu, accent laiton ponctuel et progression cyan.
- Personnage en pied, portrait prioritaire et commandes secondaires.
- Prototype local explicitement signalé, avec données fictives.

**Preuves :** les quatre sources ci-dessus, [la documentation technique](../character-lab.md), [la provenance](../../assets/character-lab/provenance.json) et les captures locales non versionnées (`.impeccable/review/{desktop,mobile,model-desktop,model-mobile}.png`). Les valeurs normatives proviennent du CSS ; les captures attestent les compositions. Aucun navigateur ni serveur relancé pour ce relevé.

**Finition :** verdict indépendant **ship**, au périmètre prototype, transmis par le demandeur. Réserves non bloquantes : dos moins détaillé, lanterne approximative, métadonnées avant le viewer sur mobile, fidélité d’archétype plutôt que reproduction des personnalisations exactes. Ce verdict ne vaut pas validation d’un asset de production.

Le sidecar local [`.impeccable/design.json`](.impeccable/design.json) complète ce fichier avec profondeur, mouvement, points de rupture et extraits de composants. Son emplacement respecte la frontière documentaire ; il ne constitue pas un enregistrement global dans le panneau Impeccable. Aucune gamme tonale synthétique n’est ajoutée.

## Colors

- **Primary — laiton (`gold`) :** appel à explorer, badge « Étude 3D », liens de téléchargement et libellé de la nouvelle carte.
- **Secondary — cyan (`blue`) :** progression XP et contour de focus visible.
- **Neutral — bleu nuit (`bg`), surface bleutée (`surface`), traits ardoise (`line`) :** fond, cartes, panneau d’informations et séparations fines. Le studio ajoute un halo bleu-vert derrière le personnage.
- **Neutral — texte pâle (`ink`), texte secondaire (`muted`) :** titres et informations principales, puis légendes et commandes au repos. Le badge de prototype emploie un vert désaturé distinct.

## Typography

Une seule pile sans sérif, déclarée avec Inter en tête ; aucun chargement de police Inter n’est déclaré par la page ou son CSS. La police effectivement utilisée dépend donc des polices disponibles.

Le titre principal reprend `display` et passe à (28px) sur mobile. Le titre du modèle est à (30px, graisse 600), puis (26px) sur mobile ; celui des cartes à (26px), puis (24px). Les titres de scène sont à (15px, graisse 600). Commandes et métadonnées occupent surtout (11–13px), avec progression et pied de page à (10px). Les valeurs XP utilisent des chiffres tabulaires. Ces petites tailles sont celles du laboratoire observé, sans certification de lisibilité en projection.

## Layout

- **Desktop :** conteneur centré de largeur maximale (1384px), gouttières `desktop-gutter`, barre supérieure (80px). Comparaison en colonnes (1fr / 1.55fr), intervalle (18px), scènes hautes de (574px). Le modèle remplace ces deux scènes par une colonne d’informations (320px) et un viewer extensible.
- **À 1000px et moins :** comparaison (1fr / 1.25fr), scènes (535px), informations du modèle (260px), disparition du nom d’atelier et des légendes verticales du portrait.
- **À 700px et moins :** gouttières `mobile-gutter`, barre (64px), sélecteur pleine largeur. La référence devient un bandeau (168px) au-dessus du portrait (495px). Les informations et téléchargements précèdent le viewer, haut d’au moins (495px). Cet ordre est visible dans la capture mobile et reste une réserve de finition.
- **À partir de 1550px :** scènes et viewer (660px).
- **Cartes :** texte à gauche puis deux cartes (210px chacune ; 180px au palier intermédiaire). Sur mobile, texte au-dessus de deux colonnes égales ; cartes hautes de (309px). La section demeure présente dans les deux modes.

## Elevation & Depth

La profondeur combine surfaces tonales, contours d’un pixel et halo radial du studio. Les panneaux et cartes n’ont pas d’ombre portée CSS ; le portrait reçoit une ombre découpée et son appel à l’action une ombre courte, consignées dans le sidecar.

Le viewer présente une géométrie réelle sur un socle cylindrique, avec ombres douces, éclairage principal chaud et appoints froids. Le portrait fixe provient de Cycles ; l’éclairage WebGL est propre au viewer, ce qui explique un rendu de matières différent entre les deux captures.

## Shapes

Panneaux et cartes rectangulaires à coins arrondis `panel`, sélecteur `tabs`, petites commandes `action` ou `tab`. Les scènes masquent leur débordement ; les images en pied utilisent `object-fit: contain`. Les icônes sont des SVG au trait fin, sans remplissage. La progression est une barre basse (4px), accompagnée d’une valeur textuelle.

## Components

- **En-tête et sélection de mode :** emblème, marque, mention « Prototype visuel » et retour au jeu sur le même hôte, port 5180. Le lien de retour disparaît sur mobile. « Comparer » et « Explorer en 3D » sont des boutons à `aria-pressed`, sans navigation de route.
- **Avant/après :** le vrai `renderHero` dessine le rôdeur `vocab-ranger`, capuche `shadow-hood`, accessoire `lore-lantern`. En regard, le WebP est un rendu du modèle Blender retenu, pas l’image de référence générée. La chaîne déclarée est Juggernaut XI → détourage U2Net → reconstruction Rodin Sketch → reprise Blender et texture 2K → GLB et portrait Cycles. Les écarts de visage, de proportions et d’équipement visibles relèvent de la réinterprétation d’archétype.
- **Portrait cliquable :** le bouton couvre toute la scène et porte le libellé d’exploration ; son appel laiton est un élément interne. Au survol, le portrait grandit légèrement (×1.025) et l’appel s’éclaircit. Le clic charge le module 3D et le GLB à la demande, remplace la comparaison et place le focus sur le titre du modèle.
- **Viewer :** modèle statique de (23 332 triangles), initialement au repos en trois quarts. Boutons Face / ¾ / Dos / Détail, puis rotation facultative ; sélectionner un angle arrête la rotation. Pas de commande d’orbite libre implémentée. Liens de téléchargement GLB et scène Blender. Le modèle n’a ni squelette d’animation ni garde-robe modulaire.
- **Chargement et repli :** aperçu fixe conservé pendant le chargement, statut annoncé avec `aria-live`, commandes désactivées jusqu’au succès. En échec, texte explicite et bouton « Réessayer ». Une perte de contexte WebGL réaffiche le portrait et demande de recharger la page.
- **Carte de démonstration :** Alex fictif, niveau 5, (340 / 500 XP), barre à (68 %). Deux versions côte à côte ; seule la nouvelle carte ouvre la 3D, ramène vers l’introduction et place le focus sur le titre du modèle.
- **Clavier et mouvement :** lien d’évitement, focus cyan (2px, décalage 5px ; intérieur du portrait à −6px), états sélectionnés explicites. Le retour à la comparaison rend le focus au portrait. La réduction des mouvements supprime transitions et défilement doux ; la rotation reste une action volontaire. Le rendu animé est suspendu quand le viewer ou l’onglet est masqué. Sans JavaScript, les portraits et la structure demeurent, mais ni les SVG injectés ni la 3D ne sont disponibles.

## Do's and Don'ts

### Do:
- Préserver le monde bleu nuit et la priorité visuelle du personnage sur cette surface.
- Garder explicites la comparaison, le statut de prototype et les données de démonstration.
- Distinguer le rendu Blender, la référence générée et le modèle interactif dans toute présentation des assets.

### Don't:
- Ne pas présenter cette réinterprétation comme une reproduction exacte des personnalisations du SVG.
- Ne pas convertir le verdict ship du prototype en validation de production ou en composition approuvée.
- Ne pas étendre ces relevés locaux à un système visuel global du jeu.
