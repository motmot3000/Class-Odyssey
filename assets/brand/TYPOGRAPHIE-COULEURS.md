# Typographie et couleurs de texte — Class Odyssey

Recommandations de design, 16 septembre 2026. Le logo validé et ses couleurs sont conservés.

## Deux polices, deux rôles

| Usage | Choix conseillé | Graisse / réglage |
|---|---|---|
| Texte courant et consignes | Barlow | Regular 400, 18–20 px, interligne 1,5 |
| Boutons, navigation, libellés | Barlow | Medium 500 ou SemiBold 600, 16–18 px |
| Noms d’élèves et données importantes | Barlow | SemiBold 600 ou Bold 700, 18–24 px |
| Titres de page | Chakra Petch | Bold 700, 32–40 px, interligne 1,2 |
| Sous-titres et panneaux | Chakra Petch | SemiBold 600 ou Bold 700, 22–28 px |
| Métadonnées peu prioritaires | Barlow | Regular 400, 14–16 px sur écran individuel |
| Texte projeté en classe | Barlow | Point de départ : 24 px ou plus ; vérifier depuis le fond de la salle |

**Mon choix pour approcher le titre : Chakra Petch Bold (700).** Ses formes carrées et ses angles biseautés rappellent la direction du logo. C’est une approximation stylistique : le vrai lettrage « Class Odyssey » est dessiné en tracés SVG et n’est pas une police installable. Pour écrire le nom officiel avec son dessin exact, utiliser le SVG du pack.

Barlow apporte un contraste plus souple pour les consignes et les textes longs. Ces choix, tailles et graisses sont des recommandations pour cette app, et non des garanties de lisibilité pour toutes les distances ou tous les écrans.

## Couleurs recommandées

Fonds clair : page `#E7E9DF`, panneau `#F8F7EF`.
Fonds sombre : page `#101B20`, panneau `#1B2C32`.

| Rôle | Clair | Contraste min. | Sombre | Contraste min. |
|---|---|---:|---|---:|
| Texte principal | `#283D35` | 9.46:1 | `#E4F5FB` | 12.91:1 |
| Texte secondaire | `#4A6055` | 5.53:1 | `#BBCDCF` | 8.77:1 |
| Métadonnées | `#5C6B5E` | 4.60:1 | `#99B1B4` | 6.40:1 |
| Liens / progression | `#245B51` | 6.36:1 | `#8ADBD3` | 9.05:1 |
| Récompenses / or textuel | `#7F612C` | 4.69:1 | `#F0B554` | 7.88:1 |

Les ratios ci-dessus sont calculés sur les couleurs opaques, en retenant le contraste le plus faible entre le fond de page et le fond de panneau. Formule : `(L_clair + 0,05) / (L_sombre + 0,05)`, luminance relative sRGB. Les valeurs affichées sont arrondies ; le contrôle du seuil utilise les valeurs non arrondies.

Ces associations dépassent 4,5:1 pour du texte de taille normale, seuil du critère WCAG 2.2 1.4.3. Cela ne constitue pas une certification d’accessibilité de l’application. Une opacité réduite, une image ou un autre fond nécessitent un nouveau calcul.

- Utiliser le texte principal pour les consignes, noms et informations essentielles.
- Réserver le texte secondaire aux explications et les métadonnées aux informations moins prioritaires ; conserver l’opacité à 100 %.
- Garder les liens soulignés, pour qu’ils soient identifiables sans se fier uniquement à la couleur.
- L’or du logo reste inchangé. Pour les petits textes sur fond clair, employer l’or textuel plus sombre `#7F612C` plutôt que l’or décoratif du blason.
- Les états importants doivent aussi avoir un libellé ou une icône.

## Fichiers inclus

- `fonts/barlow/` : Regular, Italic, Medium, SemiBold, Bold, en TTF et WOFF2.
- `fonts/chakrapetch/` : Medium, SemiBold, Bold, en TTF et WOFF2.
- `OFL.txt` : licence officielle conservée dans chaque dossier de police.
- `METADATA.pb` et `fonts/sources.json` : sources, révisions et empreintes des fichiers téléchargés.
- `integration/typography-colors.css` : chargement local des polices, variables et classes proposées.
- `integration/ui-text-tokens.json` : palette de texte exploitable dans le code.
- `preview/typography-colors.png` : exemples visuels avec les polices incluses.

Les TTF officiels sont conservés ; les WOFF2 sont des conversions de format réalisées pour ce pack. Les caractères français « é è ê à ç ù œ É À » et les chiffres sont présents dans les fichiers vérifiés.

## Intégration locale

Conserver les dossiers `fonts/` et `integration/` au même niveau. Charger `integration/typography-colors.css` et ajouter la classe `co-app` à la zone concernée. Les chemins `@font-face` sont relatifs au fichier CSS. L’attribut `data-theme="light"` ou `data-theme="dark"` sur `<html>` sélectionne les couleurs. Les sélecteurs sont volontairement limités à `.co-app` ; adapter cette classe au code existant.

Si les polices sont déjà chargées ailleurs, conserver une seule méthode de chargement. Avec ces fichiers locaux, leur affichage ne nécessite aucun appel à Google Fonts. Les fichiers TTF peuvent aussi être installés sur un poste pour composer des documents. Conserver les notices de licence avec les fichiers redistribués.

## Sources

Sources consultées le 16 septembre 2026 :

- Cadson Demak / Google Fonts, **Chakra Petch**, fiche de famille : https://fonts.google.com/specimen/Chakra+Petch
- Jeremy Tribby / Google Fonts, **Barlow**, fiche de famille : https://fonts.google.com/specimen/Barlow
- Google Fonts, fichiers sources et notices SIL Open Font License 1.1 : https://github.com/google/fonts/tree/main/ofl/chakrapetch et https://github.com/google/fonts/tree/main/ofl/barlow ; révisions exactes dans `fonts/sources.json`.
- W3C WAI, **Understanding SC 1.4.3: Contrast (Minimum), WCAG 2.2** : https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
