from pathlib import Path
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/characters-base'
manifest=json.loads((OUT/'manifest.json').read_text())
for gender,character in manifest['characters'].items():
    for tone,variant in character['variants'].items():
        source=Image.open(OUT/(gender+'-'+tone+'.png')).convert('RGBA')
        source.save(OUT/variant['portrait'],format='WEBP',quality=90,method=6)
        small=source.resize((256,448),Image.Resampling.LANCZOS)
        small.save(OUT/variant['portraitSmall'],format='WEBP',quality=85,method=6)
        print(gender,tone,(OUT/variant['model']).stat().st_size,(OUT/variant['portraitSmall']).stat().st_size)
