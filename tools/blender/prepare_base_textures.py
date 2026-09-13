"""Build the five existing game skin tones and remove painted scalp hair.

The scalp is actual skin; equipable hair is supplied as separate 3D meshes.
Run with Pillow: uv run --with pillow python tools/blender/prepare_base_textures.py
"""
from pathlib import Path
from collections import Counter, deque
import colorsys
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/neutral-hero/textures'
OUT = ROOT / 'assets/characters-base/textures'
OUT.mkdir(parents=True, exist_ok=True)
TONES = {'light':(255,215,176),'medium':(242,193,147),'tan':(217,160,107),'brown':(176,122,79),'dark':(125,79,51)}
REFERENCE = TONES['medium']

def pixels(image):
    return list(image.get_flattened_data() if hasattr(image,'get_flattened_data') else image.getdata())

def skin_color(image):
    values=[]
    for r,g,b,a in pixels(image):
        h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
        if a>128 and .025<h<.09 and .2<s<.65 and .4<v<.95:values.append((r,g,b))
    return Counter(values).most_common(1)[0][0]

reference=Image.open(SOURCE/'head.png').convert('RGBA')
width,height=reference.size
raw=pixels(reference)
candidate=set()
for index,(r,g,b,a) in enumerate(raw):
    h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
    if a>128 and .085<h<.18 and s>.4:candidate.add(index)
scalp=set()
while candidate:
    start=candidate.pop();component={start};queue=deque([start])
    while queue:
        current=queue.popleft();x=current%width;y=current//width
        neighbors=[]
        if x:neighbors.append(current-1)
        if x<width-1:neighbors.append(current+1)
        if y:neighbors.append(current-width)
        if y<height-1:neighbors.append(current+width)
        for neighbor in neighbors:
            if neighbor in candidate:candidate.remove(neighbor);component.add(neighbor);queue.append(neighbor)
    if len(component)>300 and sum(i//width for i in component)/len(component)<115:scalp.update(component)

skin=Image.open(SOURCE/'skin.png').convert('RGBA')
skin_pixels=pixels(skin);skin_base=skin_color(skin)
for index,(r,g,b,a) in enumerate(skin_pixels):
    h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
    if index//skin.width<40 and .085<h<.18 and s>.4:skin_pixels[index]=(*skin_base,a)
skin.putdata(skin_pixels)
sources={'skin':skin}
for gender,persona in [('boy','noa'),('girl','mila')]:
    image=Image.open(SOURCE/('head-'+persona+'.png')).convert('RGBA')
    data=pixels(image);base=skin_color(reference)
    for index in scalp:data[index]=(*base,data[index][3])
    image.putdata(data);sources['head-'+gender]=image

colors={}
for tone,target in TONES.items():
    ratio=[target[i]/REFERENCE[i] for i in range(3)]
    colors[tone]=[round(skin_color(reference)[i]*ratio[i]) for i in range(3)]
    for name,image in sources.items():
        data=[]
        for r,g,b,a in pixels(image):
            h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
            if .015<h<.095 and .13<s<.72 and v>.30:
                r,g,b=[min(255,round(c*ratio[i])) for i,c in enumerate((r,g,b))]
            data.append((r,g,b,a))
        result=image.copy();result.putdata(data);result.save(OUT/(name+'-'+tone+'.png'))
(OUT/'skin-colors.json').write_text(json.dumps(colors,indent=2)+'\n')
print(json.dumps({'tones':list(TONES),'scalp_pixels_cleared':len(scalp),'skin_colors':colors}))
