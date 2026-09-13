"""Prepare aligned, genuinely transparent PNGs from the user's ChatGPT exports.

Usage: python3 tools/prepare-raster-character.py --illustrated IMAGE --painted IMAGE
Requires Pillow and NumPy. No generation, vectorization or 3D reconstruction.
"""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/character-lab/raster'
COLORS = {
    'ardoise': {'label': 'Ardoise', 'hue': 0.57, 'saturation': 0.83, 'value': 0.94},
    'grenat': {'label': 'Grenat', 'hue': 0.97, 'saturation': 0.89, 'value': 0.93},
    'sable': {'label': 'Sable', 'hue': 0.105, 'saturation': 0.73, 'value': 1.17},
}


def silhouette(image):
    """Key the low-saturation checkerboard, preserving enclosed body highlights."""
    hsv = np.asarray(image.convert('HSV'))
    saturated = Image.fromarray(np.uint8(hsv[:, :, 1] > 37) * 255)
    saturated = saturated.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    # Flood only the exterior. Neutral highlights inside the figure remain intact.
    ImageDraw.floodfill(saturated, (0, 0), 128, thresh=0)
    matte = Image.fromarray(np.uint8(np.asarray(saturated) != 128) * 255)
    return matte.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.4))


def provenance(source, operation):
    return {
        'origin': f'User-supplied ChatGPT image: {source.name}',
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'generator': 'ChatGPT Images (as supplied by the user)',
        'model': None,
        'prompt': None,
        'note': 'Exact generation model and prompt were not supplied. No new image generation was performed.',
        'processing': operation,
    }


def save_png(image, name, origin):
    metadata = PngImagePlugin.PngInfo()
    metadata.add_itxt('Description', json.dumps(origin, ensure_ascii=False))
    metadata.add_text('impeccable:prompt', f'Origin, not a generation prompt: {origin["origin"]}. Processing: {origin["processing"]} {origin["note"]}')
    image.save(OUTPUT / name, optimize=True, pnginfo=metadata)
    (OUTPUT / f'{name}.json').write_text(json.dumps(origin, ensure_ascii=False, indent=2) + '\n')


def tunic_mask(image):
    hsv = np.asarray(image.convert('HSV')).astype(float) / 255
    height, width = hsv.shape[:2]
    y, x = np.mgrid[:height, :width]
    # Select the actual green fabric, not a geometric approximation of its outline.
    fabric = (hsv[:, :, 0] > 0.13) & (hsv[:, :, 0] < 0.39) & (hsv[:, :, 1] > 0.16)
    fabric &= (y > 218) & (y < 828) & (x > 248) & (x < 766)
    fabric &= np.asarray(image.getchannel('A')) > 0
    mask = Image.fromarray(np.uint8(fabric) * 255).filter(ImageFilter.GaussianBlur(0.6))
    return np.minimum(np.asarray(mask), np.asarray(image.getchannel('A')))


def prepare(illustrated, painted):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sources = {'illustre': illustrated, 'peint': painted}
    reference = Image.open(illustrated).convert('RGBA')
    if reference.size != (1024, 1536):
        raise ValueError('This asset recipe expects the supplied 1024 × 1536 reference.')
    matte = np.asarray(silhouette(reference))
    manifest = {
        'version': 1,
        'canvas': {'width': 1024, 'height': 1536},
        'anchor': {'name': 'feet', 'x': 512, 'y': 1484},
        'layerOrder': ['cape', 'base', 'tunic', 'headwear', 'accessory'],
        'styles': {},
        'equipmentSlots': {
            'cape': {'label': 'Cape', 'center': [505, 735], 'fit': [630, 1000], 'behind': True},
            'headwear': {'label': 'Coiffe', 'center': [500, 136], 'fit': [260, 250], 'behind': False},
            'accessory': {'label': 'Accessoire', 'center': [750, 860], 'fit': [240, 400], 'behind': False},
        },
        'notes': [
            'One character, two rendering styles, one fixed pose; these are not two different people.',
            'The forest tunic is baked into each base. Colored tunics are replacement overlays.',
            'Equipment artwork must be supplied as separate transparent PNG or WebP images.',
            'No unseen anatomy, alternate pose, cape, headwear or accessory has been generated.',
        ],
    }
    for style, source in sources.items():
        image = Image.open(source).convert('RGBA')
        if image.size != reference.size:
            raise ValueError('The two supplied character images must have the same dimensions.')
        # The painted export also fades the body itself. Its broken alpha is
        # replaced by the clean silhouette, rather than retaining that fade.
        image.putalpha(Image.fromarray(matte))
        base_name = f'ranger-{style}.png'
        save_png(image, base_name, provenance(source, 'Chromatic foreground matte; halo/checkerboard removed; original framing preserved.'))
        manifest['styles'][style] = {'label': 'Peint' if style == 'peint' else 'Illustré', 'base': base_name, 'tunics': {'foret': None}}
        fabric_alpha = tunic_mask(image)
        hsv = np.asarray(image.convert('HSV')).astype(float) / 255
        for color, values in COLORS.items():
            tinted = hsv.copy()
            tinted[:, :, 0] = (values['hue'] + (hsv[:, :, 0] - 0.23) * 0.22) % 1
            tinted[:, :, 1] = np.clip(hsv[:, :, 1] * values['saturation'], 0, 1)
            tinted[:, :, 2] = np.clip(hsv[:, :, 2] * values['value'], 0, 1)
            overlay = Image.fromarray(np.uint8(tinted * 255), 'HSV').convert('RGBA')
            overlay.putalpha(Image.fromarray(fabric_alpha))
            name = f'tunique-{style}-{color}.png'
            save_png(overlay, name, provenance(source, f'Green fabric isolated as an aligned RGBA layer; recolored {values["label"]}; original folds and shading retained.'))
            manifest['styles'][style]['tunics'][color] = name
        bbox = image.getchannel('A').getbbox()
        opaque = int(np.count_nonzero(np.asarray(image.getchannel('A')) == 255))
        print(f'{base_name}: {image.size}, foreground={bbox}, opaque pixels={opaque}')
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    readme = '''# ClassQuest — kit de personnage PNG

Deux rendus du même personnage ChatGPT, détourés à 1024 × 1536 pixels.
Le modèle exact et le prompt de génération ne sont pas connus.

Afficher la base, puis le calque de tunique sélectionné aux coordonnées (0, 0).
La couleur Forêt est déjà présente dans la base et ne demande aucun calque.
Les calques ne doivent pas être recadrés indépendamment : garder le cadre commun.
Le manifest.json décrit les fichiers, l'ancrage et l'ordre des équipements.

Les capes, coiffes et accessoires ne sont pas fournis : l'atelier permet de les
importer, de les positionner et d'exporter le personnage assemblé. Pour un rendu
cohérent, générer chaque pièce en utilisant cette base comme référence et garder
strictement la pose, le cadrage, la perspective et l'éclairage.

Ce test n'invente pas le corps caché par la tunique et n'est pas une animation.
Les fichiers .png.json et les métadonnées PNG documentent chaque dérivation.
'''
    (OUTPUT / 'README.txt').write_text(readme)
    with ZipFile(OUTPUT / 'ranger-png-kit.zip', 'w', ZIP_DEFLATED) as archive:
        for file in sorted(OUTPUT.iterdir()):
            if file.suffix in {'.png', '.json', '.txt'}:
                archive.write(file, file.name)
    print(f'Kit created: {OUTPUT / "ranger-png-kit.zip"}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--illustrated', type=Path, required=True)
    parser.add_argument('--painted', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.illustrated, args.painted)
