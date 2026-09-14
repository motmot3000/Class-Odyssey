"""Render item-only product shots and canonical character portraits from the catalogue.

blender -b assets/items-3d/catalogue.blend --python-exit-code 1 --python tools/render-equipment-previews.py
python3 tools/finalize-equipment-previews.py
"""
import bpy
import hashlib
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/items-3d/previews'
RAW = Path('/tmp/opencode/classquest-equipment-previews')
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
camera = scene.camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
camera.data.type = 'ORTHO'
meshes = [obj for obj in scene.objects if obj.type == 'MESH' and obj.get('shop_slot')]
report = {
    'revision': 'catalogue-v5-tailored-armour',
    'catalogueSha256': hashlib.sha256((ROOT/'assets/items-3d/catalogue.glb').read_bytes()).hexdigest(),
    'renderSource': 'catalogue.blend',
    'items': {}, 'portraits': {}
}
PORTRAITS_ONLY = '--portraits-only' in sys.argv
if PORTRAITS_ONLY:
    report = json.loads((OUT/'manifest.json').read_text())
report['portraitRevision'] = 'catalogue-v5-tailored-armour-front-hd'


def set_visibility(predicate):
    selected = []
    for obj in meshes:
        visible = predicate(obj)
        obj.hide_render = not visible
        obj.hide_set(not visible)
        if visible: selected.append(obj)
    bpy.context.view_layer.update()
    return selected


def frame(selected, width, height, focus=None, front=False):
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    points = [obj.matrix_world @ Vector(corner) for obj in selected for corner in obj.bound_box]
    lower = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    upper = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = (lower + upper)*.5
    if focus == 'head': center = Vector((0,-.015,1.645))
    if focus == 'waist': center = Vector((0,-.015,.99))
    camera.location = center + Vector((0,-5.2,.12) if front else (1.8,-5.2,1.05))
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()
    inverse = camera.matrix_world.inverted()
    projected = [inverse @ point for point in points]
    span_x = max(p.x for p in projected)-min(p.x for p in projected)
    span_y = max(p.y for p in projected)-min(p.y for p in projected)
    camera.data.ortho_scale = max(span_y, span_x*height/width)*1.15
    if focus: camera.data.ortho_scale = .55 if focus == 'head' else .66


def render(path):
    scene.render.filepath = str(RAW/path)
    Path(scene.render.filepath).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('PREVIEW_READY', path, flush=True)


ids = sorted({(obj['shop_slot'],obj['shop_id']) for obj in meshes if obj['shop_slot'] in ['outfit','hat','weapon','hair']})
for slot, item in ([] if PORTRAITS_ONLY else ids):
    selected = set_visibility(lambda obj: obj.get('fit_persona') == 'male' and obj.get('shop_slot') == slot and obj.get('shop_id') == item and obj.get('hat_fit','open') == 'open')
    if not selected: raise ValueError(f'No meshes for {item}')
    assert all(obj.get('shop_slot') not in ['core','persona'] for obj in selected)
    frame(selected, 320, 320)
    render(f'items/{item}.png')
    report['items'][item] = {'slot':slot,'file':f'items/{item}.webp','meshCount':len(selected),'containsBody':False}

for persona, hair in [('male','short'),('female','long')]:
    defaults = {'core':'base','persona':persona,'outfit':'starter','hair':hair}
    selected = set_visibility(lambda obj: obj.get('fit_persona') == persona and defaults.get(obj.get('shop_slot')) == obj.get('shop_id') and obj.get('hat_fit','open') == 'open')
    frame(selected,768,1152,front=True)
    render(f'portraits/{persona}.png')
    report['portraits'][persona] = {'file':f'portraits/{persona}.webp','pose':'base-v2-arms-lowered','view':'front','width':768,'height':1152,'hair':hair}
    if not PORTRAITS_ONLY:
        frame(selected,600,600,'head')
        render(f'review/{persona}-head.png')
        frame(selected,600,600,'waist')
        render(f'review/{persona}-waist.png')

for persona in ([] if PORTRAITS_ONLY else ['male','female']):
    for outfit in ['story-keeper','honor-knight','realm-sovereign']:
        defaults={'core':'base','persona':persona,'outfit':outfit,'hair':'short' if persona=='male' else 'long'}
        selected=set_visibility(lambda obj: obj.get('fit_persona')==persona and defaults.get(obj.get('shop_slot'))==obj.get('shop_id') and obj.get('hat_fit','open')=='open')
        frame(selected,600,900)
        render(f'review/{persona}-{outfit}.png')

# Refresh the catalogue's fallback render with the current fitted equipment.
if not PORTRAITS_ONLY:
    defaults = {'core':'base','persona':'male','outfit':'vocab-ranger','hair':'short','hat':'explorer-cap','weapon':'lore-lantern'}
    selected = set_visibility(lambda obj: obj.get('fit_persona') == 'male' and defaults.get(obj.get('shop_slot')) == obj.get('shop_id') and obj.get('hat_fit','open') == 'open')
    frame(selected,600,900)
    scene.render.filepath = str(ROOT/'assets/items-3d/preview.png')
    bpy.ops.render.render(write_still=True)
(OUT/'manifest.json').write_text(json.dumps(report, indent=2)+'\n')
print('ALL_PREVIEWS_RENDERED',len(ids), flush=True)
