"""Compress character review renders to WebP and stamp their provenance.

    python3 tools/finalize_character_views.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/character-detail-study'
LABELS = ['before', 'after', 'gentle', 'smile', 'serene', 'warm', 'sporty', 'athletic']
VIEWS = ['front', 'quarter', 'profile', 'back', 'full']
GENDERS = ['girl', 'boy']
count = 0
for gender in GENDERS:
    for label in LABELS:
        for view in VIEWS:
            stem = f'{gender}-{label}-{view}'
            source = OUT / f'{stem}.png'
            if not source.exists():
                raise FileNotFoundError(f'Required review render is missing: {source}')
            image = Image.open(source).convert('RGBA')
            image.save(OUT / f'{stem}.webp', 'WEBP', quality=94, method=6)
            (OUT / f'{stem}.webp.json').write_text(json.dumps({
                'origin': f'Blender Cycles render of the {label} catalogue revision, base starter outfit, view {view}.',
                'generator': 'tools/blender/render_character_views.py',
                'label': label, 'view': view,
            }, indent=2) + '\n')
            count += 1
            if label in ['gentle', 'smile', 'serene', 'warm', 'sporty', 'athletic'] and view == 'front':
                target=OUT/'expressions'/f'{gender}-{label}-face.webp'
                image.crop((205,300,695,745)).save(target,'WEBP',quality=96,method=6)
                target.with_suffix('.webp.json').write_text(json.dumps({
                    'origin':f'Close crop of {stem}.png, a real Blender render.',
                    'crop':[205,300,695,745],
                    'generator':'tools/finalize_character_views.py',
                },indent=2)+'\n')
print(f'CHARACTER_VIEWS_COMPRESSED {count}')
