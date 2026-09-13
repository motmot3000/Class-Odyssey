---
name: "Les équipements en 3D — Noa & Mila"
description: "Extension locale du vestiaire : essayer le catalogue du jeu, examiner ses volumes et exporter une combinaison statique."
colors:
  paper: "#f3f3ed"
  surface: "#fafbf6"
  ink: "#273e35"
  muted: "#596b60"
  line: "#d3dccd"
  accent: "#31674f"
  selected: "#e2ebdc"
  white: "#fff"
typography:
  display:
    fontSize: "clamp(26px, 2.8vw, 36px)"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-.035em"
  title:
    fontSize: "20px"
    fontWeight: 650
    letterSpacing: "-.02em"
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.55
rounded:
  stage: "14px"
  action: "7px"
  segment: "4px"
spacing:
  choices: "8px"
  workbench: "32px"
  mobile-gutter: "16px"
components:
  button-export:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    rounded: "{rounded.action}"
    padding: "12px"
    width: "100%"
  equipment-choice:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "13px 11px"
  equipment-choice-selected:
    backgroundColor: "{colors.selected}"
  export-select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.action}"
    padding: "10px"
    width: "100%"
---

# Design System: Les équipements en 3D — Noa & Mila

## Overview

**Creative North Star: "L’atelier de personnages en lumière du jour"**

Cette première proposition reprend le studio du vestiaire Noa/Mila : papier chaud, sauge, encre verte et laiton retenu. La tâche est une personnalisation pratique (Operate) : choisir, examiner, comparer au SVG du jeu, exporter. Le personnage équipé domine ; les commandes restent compactes et les équipements apportent la couleur.

**Key Characteristics:**
- Corps de référence réel, vêtements et objets en volumes séparés.
- Silhouettes médiévales-fantastiques lisibles et accueillantes pour les élèves de 7P–8P.
- Lumière douce, choix explicites et inspection sans mouvement imposé.

Périmètre : uniquement le prototype local `items-3d.html`, sans intégration d’animation. Le [contrat dans le commentaire body](../../items-3d.html) fixe cette extension ; [PRODUCT.md](../../PRODUCT.md) porte les contraintes de marque. La référence visuelle reste `/home/motmot3000/orca/workspaces/classquest/test-modelisation/docs/wardrobe/DESIGN.md` ; les corps courants proviennent désormais de la livraison `assets/characters-base/` de ce worktree.

Sources locales : [CSS](../../src/items-3d.css), [interface](../../src/items-3d.mjs), [sélection des modèles](../../src/items-3d-model.mjs), [viewer](../../src/items-3d-viewer.mjs) et [construction Blender](../../tools/build-items-3d.py). Les tokens ci-dessus décrivent cette implémentation ; les petites extensions documentaires sont dans [.impeccable/design.json](.impeccable/design.json).

La morphologie et les textures héritées sont créditées **Nintendo / The Models Resource — Trikeboy**, adaptées pour Noa/Mila. Les corps livrés avec nuque soudée et mains naturelles sont conservés entiers ; chaque tenue réutilise le haut à manches naturelles de son sexe, et les cinq coiffures locales remplacent les cheveux source filtrés par `cosmetic_slot`. Voir la [provenance](../../assets/items-3d/provenance.json). Les copies exactes `sources/boy-medium.glb`, `sources/girl-medium.glb` et `sources/manifest.json`, sous `assets/items-3d/`, font autorité ; le [manifest du catalogue](../../assets/items-3d/manifest.json) conserve révision, pose et SHA sources. Le [poster](../../assets/items-3d/preview.png) est un vrai rendu Blender Cycles, documenté par son [sidecar de provenance](../../assets/items-3d/preview.png.json).

La base stabilisée **`base-v2-2026-09` est livrée et le réajustement autorisé est réalisé**, sans changement de palette ni de composition. Seuls les fichiers garçon/fille **medium** sont intégrés, pas les dix carnations. Pose statique : bras à 82° depuis T, coudes à 8°, doigts à 10°, paumes vers les cuisses ; mètres, +Y vertical, +Z face, origine au sol. Les anciens morceaux de mains sculptées ne sont plus utilisés.

**Nouvelle revue indépendante rapportée : SHIP, sans correction demandée**, sur les sources et captures finales de base-v2. Le [bilan actuel](README.md#base-v2--bilan-actuel-rapporté) consigne 58 tests passés et les exports réels ; il distingue les anciens bilans V1 et le suivi ciblé des couronnes. La conservation des positions de peau est testée comme ensemble quantifié à 10⁻⁵, sans preuve de topologie intégrale. Le verdict reste celui d’une proposition statique, sans certification de collisions pour tous les angles. Aucun contrôle n’a été rejoué pour cette documentation.

## Colors

**Primary — vert atelier (`accent`) :** action d’export, focus et indication de sélection. L’encre verte (`ink`) porte les titres et la lecture principale.

**Secondary — matières de l’équipement :** laine verte, prune, bleu et bordeaux, cuir châtain, acier satiné, laiton brossé et cristaux turquoise. Ces matériaux restent définis dans le script Blender ; ils distinguent les silhouettes sans transformer l’interface en vitrine criarde. Les sept teintures de cheveux sont définies dans `HAIR_PALETTE`, indépendamment des tenues.

Les matériaux nommés `Hair /` déclinent chaque teinture en base, ombre (multiplicateur 0,78) et reflet (1,18). Préserver ces nuances jusque dans l’export pour garder les mèches lisibles.

**Neutral — papier et sauge :** `paper` pour la page, `surface` pour les contrôles, `selected` pour les choix actifs ; `line` sépare les rangées et `muted` accompagne les noms, niveaux et prix.

**The État explicite Rule.** Toujours accompagner la teinte active d’un état `aria-pressed` et, dans le catalogue, du texte « Équipé » ; les choix hors couleur de cheveux ont aussi un point de sélection.

## Typography

Une seule pile sans empattement : Inter déclarée, puis replis système ; la page ne charge aucun fichier de police dédié. Le titre de page utilise `display`, le nom du personnage `title`, et l’introduction `body`. Les commandes et métadonnées restent compactes (10–13 px), avec noms d’articles semi-gras et prix à chiffres tabulaires.

Sur mobile, le nom du personnage passe à 17 px et l’introduction à 12 px. Le signal Inter historique du détecteur V1 dégradé n’est pas, à lui seul, une demande de changement typographique.

## Layout

Conteneur de 1384 px maximum, marges internes de 32 px. Les ensembles Ranger / Mage / Knight / King précèdent une grille `minmax(0, 1fr) 365px`, espacée de 32 px. La scène à gauche reste sticky à 16 px, haute de `min(760px, calc(100dvh - 32px))`, avec un minimum de 550 px ; le catalogue à droite se termine par le récapitulatif et l’export.

À 1050 px et moins : catalogue de 310 px, intervalle de 20 px, marges de 22 px ; le texte visuel de rotation disparaît, son nom accessible reste présent. À 760 px et moins : colonne unique, marges de 16 px, intervalle de 24 px ; scène sticky de 390 px à 8 px du haut, au-dessus des choix. Les catégories se replient, leurs boutons atteignent 44 px et les rangées 66 px minimum.

**The Personnage visible Rule.** Garder le résultat équipé à l’écran pendant les choix mobiles ; les cinq vues et la rotation restent regroupées sous la figure. Le défilement vertical est préservé par `touch-action: pan-y`.

## Elevation & Depth

Interface plate, sans ombres de cartes : bordures fines et différences de teinte assurent la hiérarchie. Le halo crème–sauge de la scène, l’éclairage chaud avec remplissage froid et la discrète ellipse au sol (opacité 0,065) donnent la profondeur au personnage. Le relief vient des épaisseurs de tissu, capes, plastrons, bordures et accessoires réellement modélisés.

## Shapes

Coins modérés pour la scène et les actions ; segments de vue plus serrés. Le catalogue est une liste de rangées plates séparées par des traits de 1 px, avec points et pastilles circulaires. Les icônes d’action sont des SVG linéaires à bouts arrondis. Les volumes d’équipement conservent des arêtes adoucies et des silhouettes reconnaissables plutôt qu’une accumulation de détails.

Les cheveux utilisent des mèches Catmull effilées et aplaties, des brins fins et des tresses continûment entrelacées ; l’Afro est sculpté par bruit sans gros amas de sphères. Wizard Hat et Classy Hat ont des bords annulaires réellement ouverts ; le béret est incliné et ajusté, les couronnes abaissées. Le dégagement du métal préserve le volume supérieur et les longueurs des coupes.

## Components

- **Personnage et catalogue :** Noa/Mila, cinq catégories indépendantes, niveaux et prix issus du jeu ; tout est essayable sans achat. Les 27 modèles comprennent 7 tenues, 8 couvre-chefs, 7 ensembles d’objets et 5 coiffures géométriques. Les choix de retrait et les 7 couleurs portent le total à 37 choix de catalogue. Les ensembles changent tenue, couvre-chef et objet en conservant personnage et cheveux.
- **Ajustement :** `shop_slot`, `shop_id`, `hat_fit` et `fit_persona` filtrent les variantes et le sexe. Les deux couronnes utilisent `crowned` pour les cinq coupes, avec ajustement radial au bandeau préservant sommet et longueurs ; le casque masque les cheveux. `headFit` reste l’ancien gabarit de construction ; `headFits` le transforme vers l’ellipse `hat_seat` et la marge de cheveux propres à chaque base livrée. Les attaches canoniques `hat_seat`, `grip_right`, `grip_left`, `wrist_left`, `back` conservent position/quaternion sources et `template_to_character`, en axes glTF. L’ancien `hat-seat` fixe n’est plus l’attache courante.
- **Tenues et objets :** projection du torse sans retenir les intersections de manches plus proches, épaulières issues des ancrages d’épaule. Lames au repos vers le bas selon les quaternions de main, bouclier à l’extérieur de l’avant-bras gauche, baguette et lanterne dégagées des cuisses, livre aminci. Les mains naturelles restent statiques : elles ne deviennent pas des prises fermées ou animées.
- **Inspection :** Face, ¾, Dos, Tête et Objet ; glissement horizontal libre. Rotation initialement arrêtée, activée volontairement (0,27 rad/s) ; choisir une vue ou glisser l’arrête. Rendu à la demande, continu seulement en rotation, suspendu hors vue, en comparaison SVG, dans un onglet masqué ou après perte WebGL. DPR plafonné à 1,7 ; transitions désactivées en mouvement réduit.
- **Cadrage :** la vue Tête utilise les `head_bounds` enregistrées sur le corps entier et les limites des cheveux/chapeaux visibles après sélection. La vue ¾ utilise un angle de 0,55 rad. Le redimensionnement déclenche un redessin immédiat du canvas.
- **Comparaison et état :** le SVG représente la même sélection de catalogue. L’URL conserve les choix validés, pas l’angle de caméra. Réinitialiser revient à Noa / Ranger / Goggles / Lantern / Short Hair / Brown, vue ¾, rotation arrêtée.
- **Export :** bouton vert plein et sélecteur natif, choix entre personnage équipé et équipements seuls. Export des variantes visibles à leurs coordonnées d’ajustement ; le mode équipements exclut corps, persona et mains, conserve cheveux et teinture. Les fichiers sont statiques, sans rig ni animation intégrée.
- **Disponibilité et accès :** contrôles désactivés pendant chargement/export, messages de statut, lien d’évitement et groupes nommés. Focus vert de 2 px décalé de 4 px. Échec initial : poster Blender de Noa/Ranger et Réessayer ; ce poster fixe ne représente pas les sélections ultérieures. Perte de contexte : poster et demande de rechargement. Le lien d’en-tête télécharge la base medium du sexe sélectionné ; crédits actualisés et scène Blender éditable restent accessibles en pied de page.

## Do's and Don'ts

### Do:
- **Do** conserver le studio papier–sauge du vestiaire et laisser les équipements apporter la couleur.
- **Do** faire correspondre sélection, géométrie, comparaison SVG et export visible.
- **Do** préserver les crédits de la base et la provenance du véritable rendu de secours.

### Don't:
- **Don't** présenter cette pose statique comme une intégration animée ni l’anatomie dérivée comme entièrement originale.
- **Don't** remplacer les volumes distinctifs par de simples recolorations ou surcharger la silhouette au détriment de sa lisibilité.
- **Don't** aplatir le sommet d’une coupe pour dégager une couronne : ajuster progressivement au bandeau et préserver les longueurs.
- **Don't** confondre la livraison source complète avec les deux bases medium intégrées, ni le verdict statique SHIP avec une certification exhaustive des collisions.
