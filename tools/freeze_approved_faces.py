"""Freeze the explicitly approved faces in complete, self-contained snapshots.

The snapshots include the body to preserve the original head/neck geometry,
materials, UVs and normals without a destructive cut. Future body studies use
these files as immutable sources and protect everything above 1.455 metres.
Run once: python3 tools/freeze_approved_faces.py
"""
import hashlib,json
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/character-detail-study'
OUT=ROOT/'assets/characters-approved/faces-v1'
manifest=OUT/'manifest.json'

def sha(data):return hashlib.sha256(data).hexdigest()

if manifest.exists():
    report=json.loads(manifest.read_text())
    for name,expected in report['files'].items():
        if sha((OUT/name).read_bytes())!=expected:
            raise RuntimeError(f'Approved snapshot changed: {name}')
    print('APPROVED_FACES_VERIFIED',OUT)
else:
    OUT.mkdir(parents=True,exist_ok=True)
    payload={}
    for gender in ['girl','boy']:
        payload[f'{gender}-approved.glb']=(SOURCE/f'{gender}-sporty.glb').read_bytes()
        payload[f'{gender}-face.webp']=(SOURCE/'expressions'/f'{gender}-sporty-face.webp').read_bytes()
        payload[f'{gender}-front.webp']=(SOURCE/f'{gender}-sporty-front.webp').read_bytes()
    for name,data in payload.items():
        if (OUT/name).exists() and (OUT/name).read_bytes()!=data:
            raise RuntimeError(f'Refusing to overwrite an existing approved snapshot: {name}')
    for name,data in payload.items():(OUT/name).write_bytes(data)
    report={
        'revision':'approved-faces-v1','approvedAt':datetime.now(timezone.utc).isoformat(),
        'approval':'Les visages on est nickel, tu bouges plus comme ça, tu sauvegardes les visages, tu les mets à un endroit pour être sûr que ce soit la version qui soit retenue.',
        'scope':'Faces, eyes, expression and hairstyles are frozen. Body silhouettes remain under review.',
        'snapshotFormat':'Full self-contained GLB to preserve the original head/neck, UVs and normals without cutting the mesh.',
        'protectedRegion':{'axis':'glTF +Y / Blender +Z','minimumHeightMetres':1.455},
        'sourceVariant':'sporty','files':{name:sha(data) for name,data in payload.items()},
    }
    manifest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('APPROVED_FACES_FROZEN',OUT)
