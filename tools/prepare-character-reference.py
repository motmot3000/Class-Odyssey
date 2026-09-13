"""Remove the neutral studio backdrop before image-to-3D reconstruction."""
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

root = Path(__file__).resolve().parents[1]
source = Image.open('/home/motmot3000/Images/cagibi-generees/cagibi_00019_.png')
result = remove(source, session=new_session('u2net'))
result.save(root / 'assets/character-lab/ranger-reference.png')
print('Transparent character reference prepared.')
