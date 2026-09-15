"""Review renderer: import a character GLB and shoot neutral studio views.

blender -b --factory-startup --python tools/blender/stylized_preview.py -- \
  <input.glb> <output-dir> <id>

The scene keeps the imported materials; nothing is written to the catalogue.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
source, out_dir, name = Path(argv[0]), Path(argv[1]), argv[2]
out_dir.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(source))
for obj in scene.objects:
    if obj.type == 'MESH':
        obj.hide_render = False

scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.world = bpy.data.worlds.new('Neutral studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .55
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.62, .64, .60, 1)
for position, energy, size in [((-3, -4, 5), 420, 3.5), ((3.4, -2.6, 2.4), 190, 3.5), ((0.4, 3.6, 3.4), 260, 3.0)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    lamp = bpy.context.object
    lamp.data.energy = energy
    lamp.data.size = size
    lamp.rotation_euler = (Vector((0, 0, 1.35)) - lamp.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = 'ORTHO'
scene.camera = camera

VIEWS = [('front', 0), ('quarter', .42), ('profile', math.pi / 2), ('back', math.pi), ('full', .18)]
for view, yaw in VIEWS:
    full = view in ['profile', 'back', 'full']
    target = Vector((0, -.015, .93 if full else 1.60))
    camera.location = target + Vector((math.sin(yaw) * 4, -math.cos(yaw) * 4, .05))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = 1.98 if full else .55
    scene.render.resolution_x = 640 if full else 900
    scene.render.resolution_y = 1024 if full else 900
    scene.render.filepath = str(out_dir / f'{name}-{view}.png')
    bpy.ops.render.render(write_still=True)
print('STYLIZED_PREVIEW_READY', out_dir)
