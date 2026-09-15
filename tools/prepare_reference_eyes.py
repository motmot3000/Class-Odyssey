"""Reference-driven eye maps, preserving each supplied iris/pupil layout.

python3 tools/prepare_reference_eyes.py LINK_ZIP [ZELDA_ZIP]
The validated Link eyes now apply to both characters; the legacy second
argument remains accepted for existing reproduction commands.
"""
import hashlib,io,json,sys,zipfile
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/character-detail-study/warm-eyes'
OUT.mkdir(parents=True,exist_ok=True)
link=Path(sys.argv[1])
report={'revision':'reference-eyes-v1','integrated':False,'baseExpression':'gentle','references':{}}
for gender,archive_path in [('boy',link),('girl',link)]:
    with zipfile.ZipFile(archive_path) as archive:
        for side in ['left','right']:
            member=f'textures/link_eyeball_{"l" if side=="left" else "r"}_alb.png'
            raw=archive.read(member)
            image=Image.open(io.BytesIO(raw)).convert('RGB')
            original=np.asarray(image,dtype=np.float32)/255
            # Identify the iris against the supplied near-neutral sclera. Its
            # geometry and pupil proportions stay those of the reference.
            yy,xx=np.mgrid[0:original.shape[0],0:original.shape[1]]
            background=original[0,0]
            mask=np.linalg.norm(original-background,axis=2)>.22
            sy,sx=np.where(mask)
            center=(float(sx.mean()/image.width),float(sy.mean()/image.height))
            rgb=np.asarray(image.resize((512,512),Image.Resampling.LANCZOS),dtype=np.float32)/255
            # Neutral off-white avoids the glaring white ring of the previous
            # procedural iris. No green recolouring: Link / Zelda blues remain.
            delta=np.linalg.norm(rgb-background,axis=2)
            blend=np.clip((delta-.12)/.12,0,1)
            rgb=rgb*blend[:,:,None]+np.array([.84,.83,.80])*(1-blend[:,:,None])
            y,x=np.mgrid[0:512,0:512]/512
            dx,dy=x-center[0],y-center[1]
            r=np.sqrt(dx*dx+dy*dy);angle=np.arctan2(dy,dx)
            fibre=.012*np.sin(angle*109+r*48)*np.exp(-((r-.18)/.055)**2)
            rgb+=fibre[:,:,None]*blend[:,:,None]
            # Small soft studio glint, rather than a large luminous pupil.
            highlight=np.exp(-(((dx+.054)/.014)**2+((dy-.015)/.016)**2))
            rgb+=highlight[:,:,None]*.65
            filename=f'{gender}-{side}.png'
            Image.fromarray(np.uint8(np.clip(rgb,0,1)*255)).save(OUT/filename)
            provenance={'origin':archive_path.name,'member':member,'sourceSha256':hashlib.sha256(raw).hexdigest(),
                        'attribution':'Nintendo; user-supplied reference archive. Archive does not include a licence notice.',
                        'referenceIrisCenter':center,'sourceDimensions':[image.width,image.height],
                        'adaptation':'Original iris and pupil layout retained, softer sclera, fine radial detail and soft glint.',
                        'generator':'tools/prepare_reference_eyes.py'}
            (OUT/(filename+'.json')).write_text(json.dumps(provenance,indent=2)+'\n')
            report['references'][gender+'-'+side]=provenance
(OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print('REFERENCE_EYES_READY',OUT)
