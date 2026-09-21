"""Render the review sheet used to sign off a haircut.

Two passes over one catalogue cut: a set of close head angles (front, front
low, quarter, side, back, back three-quarter, top) and a set of region zooms
(part line, both temples, ear root, nape) that reveal seams, gaps and stray
locks the full-head views hide.

blender -b --factory-startup --python tools/render-hair-audit.py -- [hair] [persona ...]
Writes /tmp/opencode/hair-audit/*.png
"""
import bpy
import math
import os
import sys
from mathutils import Vector

ROOT = '/home/motmot3000/orca/workspaces/class-odyssey/haircut'
CATALOGUE = f'{ROOT}/assets/character-stylized/catalogue.glb'
OUT = '/tmp/opencode/hair-audit'
os.makedirs(OUT, exist_ok=True)

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HAIR = args[0] if args else 'curly'
PERSONAS = args[1:] if len(args) > 1 else ['female', 'male']

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CATALOGUE)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

scene = bpy.context.scene
camera_data = bpy.data.cameras.new('cam')
camera = bpy.data.objects.new('cam', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.lens = 85
for loc, energy in [((-1.4, -1.9, 2.7), 260), ((1.6, -0.6, 1.9), 150), ((0.4, 2.0, 2.4), 170)]:
    light_data = bpy.data.lights.new('key', 'AREA')
    light_data.energy = energy
    light_data.shape = 'DISK'
    light_data.size = 1.3
    light = bpy.data.objects.new('key', light_data)
    scene.collection.objects.link(light)
    light.location = loc
    light.rotation_euler = (Vector((0, 0, 1.6)) - light.location).to_track_quat('-Z', 'Y').to_euler()
world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND').inputs[0].default_value = (0.80, 0.83, 0.85, 1)
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except Exception:
    scene.render.engine = 'BLENDER_EEVEE'

CLOSEUPS = {
    'front':   ((0.02, -0.72, 1.68), (0, -0.01, 1.665), 560, 640),
    'frontlo': ((0.02, -0.72, 1.56), (0, -0.01, 1.665), 560, 640),
    'quarter': ((0.45, -0.58, 1.70), (0, -0.01, 1.665), 560, 640),
    'side':    ((0.72, -0.06, 1.68), (0, -0.01, 1.665), 560, 640),
    'back':    ((0.05, 0.72, 1.70), (0, -0.01, 1.665), 560, 640),
    'back34':  ((-0.48, 0.55, 1.74), (0, -0.01, 1.665), 560, 640),
    'top':     ((0.05, -0.28, 2.18), (0, -0.01, 1.665), 560, 640),
    'temple_r': ((0.42, -0.42, 1.70), (0.09, -0.06, 1.66), 640, 560),
    'temple_l': ((-0.42, -0.42, 1.70), (-0.09, -0.06, 1.66), 640, 560),
    'partline': ((0.10, -0.40, 2.02), (0.02, -0.02, 1.72), 640, 560),
    'ear_r':   ((0.50, 0.10, 1.62), (0.10, 0.0, 1.60), 640, 560),
    'ear_l':   ((-0.50, 0.10, 1.62), (-0.10, 0.0, 1.60), 640, 560),
    'nape':    ((0.10, 0.50, 1.55), (0.0, 0.08, 1.50), 640, 560),
}


def show(persona):
    for obj in meshes:
        slot, item = obj.get('shop_slot'), obj.get('shop_id')
        if slot == 'core':
            obj.hide_render = True
            continue
        owner = obj.get('fit_persona')
        if owner and owner != persona:
            obj.hide_render = True
            continue
        if slot == 'persona':
            obj.hide_render = False
        elif slot == 'hair':
            obj.hide_render = item != HAIR or obj.get('hat_fit', 'open') != 'open'
        else:
            obj.hide_render = True
    bpy.context.view_layer.update()


for persona in PERSONAS:
    show(persona)
    for name, (loc, target, width, height) in CLOSEUPS.items():
        camera_data.lens = 100 if name.startswith(('temple', 'part', 'ear', 'nape')) else 85
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        camera.location = loc
        camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{OUT}/{persona}_{HAIR}_{name}.png'
        bpy.ops.render.render(write_still=True)
print('HAIR_AUDIT_DONE', OUT)
