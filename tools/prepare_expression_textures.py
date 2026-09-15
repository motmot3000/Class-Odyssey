"""Measured-UV detail pass and softer eyes for the expression proposals."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/characters-refit/textures'
OUT=ROOT/'assets/character-detail-study/expressions/textures'
OUT.mkdir(parents=True,exist_ok=True)

def save(name,rgb,origin):
    Image.fromarray(np.uint8(np.clip(rgb,0,1)*255)).save(OUT/name)
    (OUT/(name+'.json')).write_text(json.dumps({'origin':origin,'generator':'tools/prepare_expression_textures.py','revision':'welcoming-expressions-v1'},indent=2)+'\n')

n=2048
y,x=np.mgrid[0:n,0:n]/n
# The frontal skin halves share this UV island. Follow an arc below the eye,
# tapering out before either canthus, rather than drawing a flat stripe.
arc=.252+.012*((x-.081)/.042)**2
crease=np.exp(-((y-arc)/.0014)**2)*np.exp(-((x-.081)/.040)**4)
lip=np.exp(-((x-.070)/.10)**4-((y-.778)/.021)**2)
cheek=np.exp(-((x-.086)/.036)**2-((y-.300)/.028)**2)
for gender in ['girl','boy']:
    rgb=np.asarray(Image.open(SOURCE/f'head-{gender}-medium.png').convert('RGB'),dtype=np.float32)/255
    rgb*=1-crease[:,:,None]*.040
    rgb+=lip[:,:,None]*np.array([.019,-.015,-.010])
    rgb+=cheek[:,:,None]*np.array([.017,-.002,-.003])
    brow_mask=(x>.55)&(x<.985)&(y>.405)&(y<.555)&(rgb[:,:,0]<.43)
    rgb[brow_mask]=rgb[brow_mask]*.78+np.array([.69,.49,.34])*.22
    save(f'{gender}-face.png',rgb,'Derived from characters-refit head atlas; subtle lower-eyelid crease, lip warmth and cheek variation on measured UV islands.')
    for side in ['left','right']:
        # Keep the approved iris colour and fibre pattern, opening the pupil
        # and increasing iris coverage slightly to reduce the startled stare.
        source=np.asarray(Image.open(SOURCE/f'eye-{gender}-{side}.png').convert('RGB'),dtype=np.float32)/255
        saturated=source.max(axis=2)-source.min(axis=2)>.10
        sy,sx=np.where(saturated)
        cx,cy=sx.mean(),sy.mean()
        yy,xx=np.mgrid[0:512,0:512]
        ix=np.clip(np.round(cx+(xx-cx)/1.16).astype(int),0,511)
        iy=np.clip(np.round(cy+(yy-cy)/1.16).astype(int),0,511)
        eye=source[iy,ix].copy()
        r=np.sqrt((xx-cx)**2+(yy-cy)**2)
        pupil=np.clip((r-44)/5,0,1)
        eye=eye*pupil[:,:,None]+np.array([.018,.024,.020])*(1-pupil[:,:,None])
        white=(eye.min(axis=2)>.60)
        eye[white]*=.93
        glint=np.exp(-(((xx-(cx-23))/8)**2+((yy-(cy-26))/8)**2))
        eye+=glint[:,:,None]*.36
        save(f'{gender}-eye-{side}.png',eye,'Derived from refit iris: 16% larger iris coverage, more open pupil and softer sclera; original fibre colour retained.')

normal=np.asarray(Image.open(SOURCE/'normal-head.png').convert('RGB'),dtype=np.float32)/127.5-1
height=-.027*crease
height+=.003*np.sin(x*2500)*lip
dy,dx=np.gradient(height)
normal[:,:,0]-=dx*5
normal[:,:,1]+=dy*5
normal/=np.maximum(np.linalg.norm(normal,axis=2,keepdims=True),.0001)
save('face-normal.png',normal*.5+.5,'Refit normals with fine lower-lid crease and lip striations; original pores retained.')
print('EXPRESSION_TEXTURES_READY',OUT)
