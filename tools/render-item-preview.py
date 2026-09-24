"""Render one item-only shop thumbnail from the deployed stylized catalogue.

Mirrors tools/render-equipment-previews.py (same camera framing, Cycles samples,
AgX view transform) so a single changed item keeps the shipped thumbnail style
without rewriting the whole preview set.

blender -b assets/character-stylized/catalogue.blend --python tools/render-item-preview.py -- curly
blender -b assets/character-stylized/catalogue.blend --python tools/render-item-preview.py -- bun male back

The optional third argument `back` turns the camera to the back three-quarter
view, for cuts whose signature (the Bun's chignon) sits behind the head.
"""
import bpy
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
RAW = Path('/tmp/opencode/class-odyssey-item-preview')

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ITEM = args[0] if args else 'curly'
PERSONA = args[1] if len(args) > 1 else 'male'
BACK = len(args) > 2 and args[2] == 'back'

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

piece = [obj for obj in meshes if obj.get('shop_slot') == 'hair' and obj.get('shop_id') == ITEM
         and obj.get('fit_persona') == PERSONA and obj.get('hat_fit', 'open') == 'open']
if not piece:
    raise ValueError(f'no meshes for hair {ITEM} on {PERSONA}')
for obj in meshes:
    visible = obj in piece
    obj.hide_render = not visible
    obj.hide_set(not visible)
bpy.context.view_layer.update()

points = [obj.matrix_world @ Vector(corner) for obj in piece for corner in obj.bound_box]
lower = Vector(tuple(min(p[i] for p in points) for i in range(3)))
upper = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (lower + upper) * .5
scene.render.resolution_x = 320
scene.render.resolution_y = 320
scene.render.resolution_percentage = 100
camera.location = center + Vector((-1.8, 5.2, 1.05) if BACK else (1.8, -5.2, 1.05))
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.view_layer.update()
inverse = camera.matrix_world.inverted()
projected = [inverse @ point for point in points]
span_x = max(p.x for p in projected) - min(p.x for p in projected)
span_y = max(p.y for p in projected) - min(p.y for p in projected)
camera.data.ortho_scale = max(span_y, span_x) * 1.15
RAW.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(RAW / f'{ITEM}_{PERSONA}.png')
bpy.ops.render.render(write_still=True)
print('ITEM_PREVIEW_READY', scene.render.filepath)
