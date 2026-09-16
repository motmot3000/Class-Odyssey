"""Smooth the dotted lines painted across the refit skin palettes.

The delivered facial palettes carry faint dark dotted lines running over the
temple, cheek and neck; once rendered they read as dotted scars. The marks are
small enough to sit below any threshold that still protects the eyes, brows and
lip, but a median filter removes them while every large painted feature keeps
its edge.

python3 tools/clean_skin_specks.py
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / 'assets' / 'characters-refit' / 'textures'
TARGETS = ['head-girl-medium.png', 'head-boy-medium.png', 'skin-medium.png']
MEDIAN_SIZE = 17


def main():
    checked = 0
    for name in TARGETS:
        path = TEXTURES / name
        if not path.exists():
            continue
        image = Image.open(path).convert('RGBA')
        cleaned = image.filter(ImageFilter.MedianFilter(MEDIAN_SIZE))
        before = np.asarray(image).astype(np.int16)
        after = np.asarray(cleaned).astype(np.int16)
        touched = int((np.abs(before[..., :3] - after[..., :3]).max(axis=2) > 2).sum())
        cleaned.save(path)
        sidecar = path.with_suffix('.png.json')
        if sidecar.exists():
            record = json.loads(sidecar.read_text())
            record['cleanup'] = (f'tools/clean_skin_specks.py median {MEDIAN_SIZE} '
                                 f'smoothed the painted dotted lines ({touched} pixels)')
            sidecar.write_text(json.dumps(record, indent=2) + '\n')
        print(f'{name}: smoothed {touched} pixels')
        checked += 1
    if not checked:
        print('No refit palette found.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())