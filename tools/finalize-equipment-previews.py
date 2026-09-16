"""Compress rendered previews and build a local review sheet (Pillow)."""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/items-3d/previews'
RAW = Path('/tmp/opencode/class-odyssey-equipment-previews')
report = json.loads((OUT/'manifest.json').read_text())
portraits_only = '--portraits-only' in sys.argv
for entry in ([] if portraits_only else list(report['items'].values())) + list(report['portraits'].values()):
    target = OUT/entry['file']
    target.parent.mkdir(parents=True,exist_ok=True)
    image = Image.open(RAW/Path(entry['file']).with_suffix('.png')).convert('RGBA')
    image.save(target, 'WEBP',quality=93,method=6)

files = [] if portraits_only else sorted((RAW/'review').glob('*.png'))
files += [RAW/Path(entry['file']).with_suffix('.png') for entry in (report['portraits'] if portraits_only else report['items']).values()]
cell_w,cell_h,columns=240,280,6
sheet = Image.new('RGB',(cell_w*columns,cell_h*((len(files)+columns-1)//columns)), '#e7e9df')
draw = ImageDraw.Draw(sheet)
for i, path in enumerate(files):
    image=Image.open(path).convert('RGBA');image.thumbnail((224,246))
    x=(i%columns)*cell_w;y=(i//columns)*cell_h
    sheet.paste(image,(x+(cell_w-image.width)//2,y+(246-image.height)//2),image)
    draw.text((x+8,y+252),path.stem,fill='#283d35')
sheet.save(RAW/'review-sheet.jpg',quality=90)
print(f"PREVIEWS_READY: {len(report['items'])} item-only thumbnails, {len(report['portraits'])} canonical portraits")
print(RAW/'review-sheet.jpg')
