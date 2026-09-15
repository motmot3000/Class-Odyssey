# Visages validés — version de référence figée

**Ne pas modifier ni régénérer les fichiers de ce dossier.**

La fille et le garçon ont les mêmes yeux validés, l'expression Douce et leurs
coiffures approuvées. Le complément capillaire arrière de la fille est inclus.

- `girl-approved.glb`, `boy-approved.glb` : instantanés 3D autonomes. Le corps
  est conservé dans le fichier pour ne pas couper ni altérer le maillage du cou.
- `*-face.webp` : gros plans des visages retenus.
- `*-front.webp` : portraits de face.
- `manifest.json` : validation, région protégée et SHA-256 de chaque fichier.

Les travaux suivants concernent uniquement le corps, sous **1,455 m** dans le
repère des modèles. Ils doivent conserver les positions, normales, UV,
matériaux et textures des visages ainsi que les cheveux. Le corps présent dans
ces instantanés n'est pas une validation définitive de la morphologie.

Pour contrôler l'intégrité : `python3 tools/freeze_approved_faces.py`.
Le script vérifie les empreintes lorsqu'une archive existe et refuse de la
remplacer. Une nouvelle approbation doit créer une nouvelle version, jamais
écraser celle-ci.
