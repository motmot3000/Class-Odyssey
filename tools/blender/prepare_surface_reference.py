"""Retrieve only the normal maps from the already-credited source archives."""
from pathlib import Path
from urllib.request import urlopen, Request
from zipfile import ZipFile
from io import BytesIO

ROOT=Path('/tmp/opencode/surface-reference')
ROOT.mkdir(parents=True,exist_ok=True)
for asset, names in [(303154, ['link_head_nrm.png','link_skin_nrm.png','link_head_ao.png','link_skin_ao.png']), (303172,['armor_043_lower_nrm.png','armor_043_lower_ao.png'])]:
    names=[name for name in names if not (ROOT/name).exists()]
    if not names:continue
    request=Request(f'https://models.spriters-resource.com/media/assets/300/{asset}.zip',headers={'User-Agent':'Mozilla/5.0','Referer':'https://models.spriters-resource.com/'})
    with urlopen(request,timeout=60) as response:
        archive=ZipFile(BytesIO(response.read()))
    for name in names:
        match=next((entry for entry in archive.namelist() if Path(entry).name==name),None)
        if match is None:
            if name.endswith('_ao.png'):continue
            raise RuntimeError('Required source map is missing: '+name)
        (ROOT/name).write_bytes(archive.read(match))
        print('Source normal map:',name)
