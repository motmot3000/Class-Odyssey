"""Render comparative base-character views from one catalogue blend.

Review only: this never writes the catalogue. Run once per revision.

    blender -b <catalogue.blend> --python-exit-code 1 \
      --python tools/blender/render_character_views.py -- <label> <output-dir>
"""
import bpy
import json
import math
import os
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index('--') + 1:]
label, out_dir = args[0], Path(args[1])
out_dir.mkdir(parents=True, exist_ok=True)
VIEWS = {
    'front': (0, .55), 'quarter': (.42, .55), 'profile': (math.pi / 2, .55),
    'back': (math.pi, 1.98), 'full': (.18, 1.98),
}
if os.environ.get('STUDY_VIEWS'):
    VIEWS = {key: value for key, value in VIEWS.items() if key in os.environ['STUDY_VIEWS'].split(',')}
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0
for obj in scene.objects:
    if obj.type == 'LIGHT':
        obj.hide_set(False); obj.hide_render = False
        obj.data.energy = 340 if 'Key' in obj.name else 200 if 'Fill' in obj.name else 110
        obj.data.size = 3.5
if scene.world and scene.world.use_nodes:
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .4
physical = [obj for obj in scene.objects if obj.type == 'MESH' and obj.get('shop_slot')]
camera = scene.camera
camera.hide_render = False
camera.data.type = 'ORTHO'
report = {'label': label, 'views': {}}
for persona, gender in [('female', 'girl'), ('male', 'boy')]:
    defaults = {'core': 'base', 'persona': persona, 'outfit': 'starter',
                'hair': 'long' if persona == 'female' else 'short'}
    visible = [obj for obj in physical
               if obj.get('fit_persona') == persona
               and defaults.get(obj.get('shop_slot')) == obj.get('shop_id')
               and obj.get('hat_fit', 'open') == 'open']
    for obj in physical:
        obj.hide_render = obj not in visible
    for view, (yaw, scale) in VIEWS.items():
        full_body = view in ['full', 'back']
        target = Vector((0, -.015, .93 if full_body else 1.60))
        camera.location = target + Vector((math.sin(yaw) * 4, -math.cos(yaw) * 4, .05))
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = scale
        scene.render.resolution_x = 640 if full_body else 900
        scene.render.resolution_y = 1024 if full_body else 900
        scene.render.filepath = str(out_dir / f'{gender}-{label}-{view}.png')
        bpy.ops.render.render(write_still=True)
    report['views'][gender] = {view: f'{gender}-{label}-{view}.png' for view in VIEWS}
    if os.environ.get('STUDY_RENDER_ONLY'):
        continue
    # A downloadable base-character model for the presentation page.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in visible:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = visible[0]
    bpy.ops.export_scene.gltf(filepath=str(out_dir / f'{gender}-{label}.glb'), export_format='GLB',
                              use_selection=True, export_apply=True, export_yup=True,
                              export_animations=False, export_extras=True)

if os.environ.get('STUDY_SAVE_BLEND'):
    keep = set()
    for persona in ['female', 'male']:
        defaults = {'core': 'base', 'persona': persona, 'outfit': 'starter',
                    'hair': 'long' if persona == 'female' else 'short'}
        for obj in physical:
            if (obj.get('fit_persona') == persona and defaults.get(obj.get('shop_slot')) == obj.get('shop_id')
                    and obj.get('hat_fit', 'open') == 'open'):
                keep.add(obj)
    for obj in list(scene.objects):
        if obj.type == 'MESH' and obj.get('shop_slot') and obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in scene.objects:
        obj.hide_set(False)
        obj.hide_render = False
        if obj in keep:
            obj.location.x += -.40 if obj.get('fit_persona') == 'female' else .40
    camera.location=(0,-5.0,1.15)
    camera.rotation_euler=(Vector((0,0,.95))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=2.20
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out_dir / 'base-characters-refit.blend'), compress=True)
print('CHARACTER_VIEWS_READY', json.dumps(report), flush=True)
