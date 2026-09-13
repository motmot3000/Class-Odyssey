"""Prepare material maps for the non-destructive surface-v3 study."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/characters-base/textures'
SOURCE=Path('/tmp/opencode/surface-reference')
OUT=ROOT/'assets/characters-refined/textures'
OUT.mkdir(parents=True,exist_ok=True)
SIZE=1024
rng=np.random.default_rng(73019)

def load(path):
    return Image.open(path).convert('RGBA').resize((SIZE,SIZE),Image.Resampling.LANCZOS)

def save_rgb(array,path):
    Image.fromarray(np.uint8(np.clip(array,0,1)*255)).save(path)

for part,source in [('head','link_head'),('skin','link_skin'),('trousers','armor_043_lower')]:
    image=load(SOURCE/(source+'_nrm.png'))
    normal=np.asarray(image,dtype=np.float32)[:,:,:3]/127.5-1
    # Very fine surface variation, not exaggerated skin pores.
    grain=rng.normal(0,.004 if part!='trousers' else .007,(SIZE,SIZE,2))
    normal[:,:,:2]+=grain
    normal/=np.maximum(np.linalg.norm(normal,axis=2,keepdims=True),.0001)
    save_rgb(normal*.5+.5,OUT/('normal-'+part+'.png'))

head_ao=np.asarray(load(SOURCE/'link_head_ao.png'),dtype=np.float32)/255
skin_ao=np.asarray(load(SOURCE/'link_skin_ao.png'),dtype=np.float32)/255
# The head AO source is channel-packed: red is AO, not magenta RGB color.
for part,ao in [('head',head_ao),('skin',skin_ao)]:
    rough=.66-(.15*ao[:,:,1] if part=='head' else 0)+rng.normal(0,.018,(SIZE,SIZE))
    save_rgb(rough,OUT/('rough-'+part+'.png'))
    for source in BASE.glob(('head-*-' if part=='head' else 'skin-')+'*.png'):
        if part=='head' and not source.name.startswith(('head-boy-','head-girl-')):continue
        albedo=np.asarray(load(source),dtype=np.float32)/255
        rgb=albedo[:,:,:3]*(.91+.09*ao[:,:,0,None])
        rgb*=1+rng.normal(0,.002,(SIZE,SIZE,1))
        save_rgb(np.concatenate([rgb,albedo[:,:,3,None]],axis=2),OUT/source.name)

trousers=load(ROOT/'assets/neutral-hero/textures/trousers.png')
rgb=np.asarray(trousers,dtype=np.float32)[:,:,:3]/255
rough=np.where(rgb.max(axis=2)<.30,.56,.86)+rng.normal(0,.02,(SIZE,SIZE))
save_rgb(rough,OUT/'rough-trousers.png')
trousers.filter(ImageFilter.UnsharpMask(radius=1.0,percent=90,threshold=3)).save(OUT/'trousers.png')

for gender,persona in [('boy','noa'),('girl','mila')]:
    for side in ['left','right']:
        eye=Image.open(ROOT/'assets/neutral-hero/textures'/('eye-'+side+'-'+persona+'.png')).convert('RGBA').resize((512,512),Image.Resampling.LANCZOS)
        pixels=np.asarray(eye,dtype=np.float32)/255
        rgb=pixels[:,:,:3];saturation=rgb.max(axis=2)-rgb.min(axis=2)
        mask=saturation>.18
        ys,xs=np.where(mask)
        if len(xs):
            yy,xx=np.mgrid[0:512,0:512];cx=xs.mean();cy=ys.mean()
            radius=np.sqrt((xx-cx)**2+(yy-cy)**2);angle=np.arctan2(yy-cy,xx-cx)
            fibers=.975+.025*np.sin(angle*61+radius*.11)
            rgb[mask]*=fibers[mask,None]
        save_rgb(pixels,OUT/('eye-'+gender+'-'+side+'.png'))
print('Prepared normal, roughness, albedo and iris maps in',OUT)
