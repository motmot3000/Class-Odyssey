"""Prepare display-referred albedo maps for the public Link source assets."""
from pathlib import Path
from PIL import Image, ImageEnhance
import colorsys

ROOT = Path(__file__).resolve().parents[2]
RAW = Path('/tmp/opencode/neutral-link-source')
OUT = ROOT / 'assets' / 'neutral-hero' / 'textures'
OUT.mkdir(parents=True, exist_ok=True)
maps = {
    'head': ('body/link_head_alb.png', 1.30),
    'skin': ('body/link_skin_alb.png', 1.30),
    'hair': ('hair/link_hair_alb.png', 2.05),
    'eye-left': ('body/link_eyeball_l_alb.png', 1.15),
    'eye-right': ('body/link_eyeball_r_alb.png', 1.15),
    'eyelashes': ('body/link_eyelashes_alb.png', 1.0),
    'trousers': ('trousers/armor_043_lower_alb.0.png', 1.65),
}
for name, (source, factor) in maps.items():
    image = Image.open(RAW / source).convert('RGBA')
    alpha = image.getchannel('A')
    image = ImageEnhance.Brightness(image.convert('RGB')).enhance(factor).convert('RGBA')
    image.putalpha(alpha)
    image.save(OUT / (name+'.png'))
    print(name, image.size)

for character, hue in [('noa', .095), ('mila', .37)]:
    for side in ['left','right']:
        image=Image.open(OUT/('eye-'+side+'.png')).convert('RGBA')
        pixels=[]
        for r,g,b,a in image.getdata():
            h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
            if .40<h<.75 and s>.25:
                r,g,b=[round(channel*255) for channel in colorsys.hsv_to_rgb(hue,s*.82,v)]
            pixels.append((r,g,b,a))
        image.putdata(pixels)
        image.save(OUT/('eye-'+side+'-'+character+'.png'))

for character, hue in [('noa', .067), ('mila', .038)]:
    image=Image.open(OUT/'head.png').convert('RGBA')
    pixels=[]
    for r,g,b,a in image.getdata():
        h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
        if .085<h<.18 and s>.4:
            r,g,b=[round(c*255) for c in colorsys.hsv_to_rgb(hue,.53,.23+.30*v)]
        pixels.append((r,g,b,a))
    image.putdata(pixels)
    image.save(OUT/('head-'+character+'.png'))
