"""Remove a neutral studio backdrop before image-to-3D reconstruction.

python3 tools/prepare-character-reference.py /path/to/source.png [--output path.png]
Requires Pillow and rembg; original input images are not shipped.
"""
import argparse
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, default=root / 'assets/character-lab/ranger-reference.png')
args = parser.parse_args()
source = Image.open(args.source)
result = remove(source, session=new_session('u2net'))
result.save(args.output)
print('Transparent character reference prepared.')
