---
name: "Petit aventurier — studio clair"
description: "Une étude de style statique, aux proportions affinées, présentée dans un studio papier-sauge."
colors:
  forest: "#28583d"
  paper: "#f3f4ee"
  ink: "#213e32"
  muted: "#5c6d60"
  line: "#d7dfd1"
  on-forest: "#fff"
typography:
  display:
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "41px"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-.035em"
  body:
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  studio: "16px"
  studio-mobile: "12px"
  action: "7px"
  control: "6px"
  retry: "5px"
  inner: "3px"
spacing:
  page: "32px"
  page-mobile: "16px"
  control-inset: "3px"
components:
  primary-action:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    rounded: "{rounded.action}"
    padding: "14px 15px"
    width: "100%"
  primary-action-hover:
    backgroundColor: "#1e4930"
  mode-switch:
    backgroundColor: "#f9fbf4d9"
    rounded: "{rounded.control}"
    padding: "{spacing.control-inset}"
  view-controls:
    backgroundColor: "#f8fbf3ed"
    rounded: "{rounded.control}"
    padding: "{spacing.control-inset}"
  retry-button:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.on-forest}"
    rounded: "{rounded.retry}"
    padding: "10px 14px"
  asset-link:
    textColor: "{colors.ink}"
---

# Design System: Petit aventurier — studio clair

## Overview

**Creative North Star: "L’atelier papier-sauge"**

Le personnage conduit cette surface en mode **Experience** : studio clair, interface discrète, volumes lisibles.
La référence fournie évoque un aventurier Zelda compact et lumineux ; aucune maquette de composition (« comp ») n’a été approuvée.
Le retour utilisateur demande ensuite des jambes plus longues et une allure plus classe ; la version finale affine cette direction.

**Key Characteristics:**
- Papier clair, sauge et vert profond ; l’or et le bleu viennent surtout du personnage.
- Silhouette arrondie plus élancée, finitions satinées, dos complet et équipement lisible.
- Portrait immédiat, exploration 3D volontaire et commandes secondaires sobres.

Périmètre : [page](../../assets/mini-hero/index.html), [styles](../../src/mini-hero.css), [interactions](../../src/mini-hero.mjs),
et branche `daylight` du [viewer partagé](../../src/character-viewer.mjs). Ce document décrit uniquement mini-hero.
Sources de fabrication : [README existant](README.md) et [provenance](../../assets/mini-hero/provenance.json).
Modèle authentique construit dans Blender 4.5.3 via MCP : 59 pièces, 202 350 triangles, matériaux PBR autonomes.
Le portrait transparent (1200 × 1400) est un véritable rendu Cycles ; le WebP en est dérivé.
Jambes allongées (+0,18 unité), tête réduite à 89 %, oreilles à 76 %, bottes affinées et fusionnées ; peau et cuir satinés.

## Colors

**Primary — Vert forêt :** action principale et reprise du chargement ; son survol assombrit discrètement le bouton.
**Neutral — Papier, encre verte, texte atténué, filet sauge :** fond, lecture et séparations fines, sans concurrence avec le modèle.
Le blanc sert les libellés sur vert ; les contrôles actifs prennent un aplat sauge distinct.
Le studio dégrade un centre presque ivoire vers une périphérie sauge ; les pastilles feuille et blond décrivent les matières.
Les valeurs du frontmatter sont extraites du CSS ; les rampes du sidecar sont des visualisations synthétiques, pas des couleurs supplémentaires de la page.

## Typography

Une seule pile sans sérif, Inter puis polices système, relie titre et commandes ; aucun chargement de fonte n’est déclaré ici.
Le titre éditorial actuel est « Petit format. Grand aventurier. » ; sa graisse et son approche serrée structurent le texte latéral.
Il passe à (44px) au grand écran, (36px) au palier intermédiaire et (35px) sur mobile.
L’introduction est aérée (15px, interligne 1,75), puis (14px) sur mobile ; les légendes restent secondaires (9–12px).
Conserver les libellés français courts et la hiérarchie entre découverte, caractéristiques et téléchargements.

## Layout

Sur bureau, une grille plafonnée à (1384px) donne la priorité au studio ; la colonne descriptive mesure (336px), l’écart (58px).
Le plateau mesure (675px) de haut, puis (740px) dès (1550px) ; à (1100px) et moins, il passe à (625px), avec une colonne de (300px).
À (760px) et moins, studio puis description s’empilent ; plateau (530px), détails sur deux colonnes, finitions sur toute la largeur.
À (380px) et moins, le plateau descend à (490px) et le petit libellé du studio disparaît.
Le portrait reste contenu, les commandes bordent le volume et le pied de page revient à la ligne sur mobile.

## Elevation & Depth

La profondeur appartient au modèle : lumière diffuse, reflets satinés et ombre légère sous le portrait ; les contrôles restent plats.
Le studio temps réel ajoute un socle sauge, des ombres douces et des lumières chaudes avec un contre-jour froid.
Sa branche `daylight` emploie une exposition (1,1) et une intensité d’environnement (0,75) ; elle ne reproduit pas exactement Cycles.
**The Portrait Rule.** Le portrait reste une présentation complète et le repli visible tant que le volume 3D n’est pas disponible.

## Shapes

Grand cadre adouci, boutons modérément arrondis, segments plus petits et filets fins : la géométrie soutient le personnage.
Visage arrondi, yeux ovales noirs, mèches dorées sculptées, bonnet plié et bottes continues constituent sa signature.
Le bouclier bleu porte une boussole originale Class Odyssey ; l’ensemble reste une étude de style statique, sans squelette d’animation.

## Components

**Présentation :** « Rendu Blender » / « Modèle 3D », hotspot du portrait et action principale pilotent la même bascule ; états `aria-pressed` explicites.
**Exploration :** Face, Trois quarts, Dos et Visage ; choisir une vue arrête la rotation. La rotation est volontaire, sans animation du personnage.
**Accessibilité :** lien d’évitement, boutons natifs, focus visible (contour 2px, décalage 4px), statut poli ; le nom ARIA suit le rendu ou l’angle 3D courant.
**Chargement :** import du viewer et GLB différés au clic ; progression, message d’échec, poster conservé et « Réessayer le chargement ».
**Mouvement :** transitions courtes (160ms), supprimées en mouvement réduit ; la boucle 3D s’interrompt lorsque le volume ou l’onglet est masqué.
**Fichiers :** liens secondaires vers la scène Blender, le GLB et l’aperçu ; formats et rôle du fichier accompagnent le libellé.

Verdict indépendant final **rapporté : ship**, après deux corrections : retrait du titre signalé en revue et synchronisation du libellé ARIA rendu/3D avec l’angle courant.
Vérifications rapportées : quatre vues, rotation, retour au portrait, activation clavier Entrée, absence de débordement à (390px), GLB différé.
Échec GLB simulé : nouvelle tentative disponible, poster préservé, puis récupération ; provenance PNG/WebP embarquée et sidecar, scan de 2 images, 0 manquante.
Captures finales consultées (dossier local non versionné `.impeccable/review/`) : `mini-desktop.png`, `mini-live-desktop.png`, `mini-back.png`, `mini-live-mobile.png`, `mini-mobile.png`.
La présente passe valide la documentation par lecture des sources et captures ; les essais interactifs ci-dessus sont ceux du bilan fourni.

## Do's and Don'ts

### Do:
- **Do** Laisser le modèle conduire la composition et conserver ses proportions affinées et ses matières satinées.
- **Do** Maintenir le portrait disponible et synchroniser état visible, commandes et nom accessible.
- **Do** Présenter les fichiers et leur provenance comme ceux d’une étude de style statique réalisée dans Blender.

### Don't:
- **Don't** Présenter la référence de personnage comme une composition approuvée ou un modèle téléchargé.
- **Don't** Promettre un rig, des animations de personnage, une identité parfaite entre Cycles et WebGL ou une perfection absolue.
