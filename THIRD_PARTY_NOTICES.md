# Licences et notices tierces

La [licence MIT de Class Odyssey](LICENSE) couvre le **code original** et la
documentation du projet. Elle ne remplace pas les licences de composants tiers,
ne donne pas de droits sur leurs médias et ne constitue pas une licence de marque.
Un dépôt public n'implique pas que tous ses fichiers graphiques soient sous MIT.

## Logiciels

| Composant | Usage | Licence / notice |
| --- | --- | --- |
| Three.js 0.180.0 | Rendu 3D, également inclus dans les bundles construits | MIT, copyright © 2010–2025 three.js authors ; voir la notice ci-dessous |
| maxmind | Lecture locale d'une base GeoIP facultative | MIT ; licence dans le paquet installé, dépendances exactes dans `package-lock.json` |
| esbuild | Construction des bundles de développement | MIT ; licence dans le paquet installé |
| tarteaucitron.js 1.32.0 | Gestion du consentement, code vendorisé | MIT ; [notice embarquée](assets/consent/tarteaucitron/NOTICE.md) |

Conserver les notices des dépendances et celles des bundles lors d'une
redistribution. La liste ci-dessus est une orientation ; le lockfile et les
licences des versions effectivement installées restent à consulter.
Une base GeoLite2 n'est pas fournie et possède ses propres conditions.

### Three.js — texte de licence

```text
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Polices

**Barlow** et **Chakra Petch** sont distribuées sous SIL Open Font License 1.1,
pas sous la MIT du projet. Les textes sont conservés dans
[`assets/brand/fonts/barlow/OFL.txt`](assets/brand/fonts/barlow/OFL.txt) et
[`assets/brand/fonts/chakrapetch/OFL.txt`](assets/brand/fonts/chakrapetch/OFL.txt).
Les révisions et empreintes sont dans
[`assets/brand/fonts/sources.json`](assets/brand/fonts/sources.json).

## Modèles, textures et images

L'[inventaire détaillé](docs/assets-and-licenses.md) distingue les sources
techniques et les points de droits encore non documentés.

Les notices existantes attribuent notamment la morphologie source et certaines
textures à **Nintendo / The Models Resource — Trikeboy**. Plusieurs coiffures et
autres modèles ont été importés depuis des archives dont la licence n'est pas
consignée. La transformation ou le rendu dans Blender ne les place pas sous MIT.
Ces mentions techniques sont conservées pour la traçabilité ; elles ne sont
ni un partenariat, ni une approbation de Class Odyssey, ni une autorisation de
redistribution donnée par ces tiers.

Les médias tiers ou à droits non clarifiés sont **exclus de la licence MIT du
code**. Ne pas les extraire en prétendant disposer d'une autorisation MIT.
Compléter une provenance erronée exige une preuve ou une vérification du fichier,
pas le seul remplacement de son attribution par une description visuelle.
