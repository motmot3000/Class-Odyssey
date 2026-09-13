from pathlib import Path
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/characters-refined'
manifest=json.loads((OUT/'manifest.json').read_text())
for gender,entry in manifest['characters'].items():
    for tone,variant in entry['variants'].items():
        source=Image.open(OUT/(gender+'-'+tone+'.png')).convert('RGBA')
        source.save(OUT/variant['portrait'],format='WEBP',quality=91,method=6)
        source.resize((256,448),Image.Resampling.LANCZOS).save(OUT/variant['portraitSmall'],format='WEBP',quality=86,method=6)
    for name in ['face','body']:
        image=Image.open(OUT/(gender+'-'+name+'.png'))
        image.save(OUT/(gender+'-'+name+'.webp'),format='WEBP',quality=92,method=6)
print('Surface-v3 portraits prepared.')
