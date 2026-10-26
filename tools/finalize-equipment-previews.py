"""Compress rendered previews and build a local review sheet (Pillow)."""
from pathlib import Path
import json
import os
import sys
import tempfile
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/items-3d/previews'
RAW = Path(os.environ.get('EQUIPMENT_PREVIEWS_DIR', str(Path(tempfile.gettempdir()) / 'class-odyssey-equipment-previews')))
report = json.loads((OUT/'manifest.json').read_text())
portraits_only = '--portraits-only' in sys.argv

# Item thumbnails sit side by side in the shop and dressing. Each render keeps
# its own camera margins (a tunic could fill only the top half of its frame),
# so every item is re-fitted: same fill ratio, centred, square canvas kept.
ITEM_FILL = .84
def fit_to_frame(image, fill=ITEM_FILL):
    alpha = image.getchannel('A').point(lambda a: 255 if a > 8 else 0)
    box = alpha.getbbox()
    if not box:
        return image
    subject = image.crop(box)
    scale = min(image.width*fill/subject.width, image.height*fill/subject.height)
    subject = subject.resize((max(1, round(subject.width*scale)), max(1, round(subject.height*scale))), Image.LANCZOS)
    framed = Image.new('RGBA', image.size, (0, 0, 0, 0))
    framed.alpha_composite(subject, ((image.width-subject.width)//2, (image.height-subject.height)//2))
    return framed

if '--normalize-only' in sys.argv:
    # Re-fit the shipped thumbnails without re-rendering them in Blender.
    for path in sorted((OUT/'items').glob('*.webp')):
        fit_to_frame(Image.open(path).convert('RGBA')).save(path, 'WEBP', quality=93, method=6)
    for entry in report['items'].values():
        if 'bytes' in entry:
            entry['bytes'] = (OUT/entry['file']).stat().st_size
    (OUT/'manifest.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f"PREVIEWS_NORMALIZED: {len(list((OUT/'items').glob('*.webp')))} item thumbnails")
    sys.exit(0)

items = [] if portraits_only else list(report['items'].values())
for entry in items + list(report['portraits'].values()):
    target = OUT/entry['file']
    target.parent.mkdir(parents=True,exist_ok=True)
    image = Image.open(RAW/Path(entry['file']).with_suffix('.png')).convert('RGBA')
    if entry in items:
        image = fit_to_frame(image)
    image.save(target, 'WEBP',quality=93,method=6)
    if 'bytes' in entry:
        entry['bytes'] = target.stat().st_size
if any('bytes' in entry for entry in report['portraits'].values()):
    (OUT/'manifest.json').write_text(json.dumps(report, indent=2)+'\n')

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
