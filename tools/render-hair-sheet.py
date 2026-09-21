"""Render a contact sheet of each character wearing every haircut and hat.

blender -b --factory-startup --python tools/render-hair-sheet.py -- [hair] [persona]
Writes /tmp/opencode/hair-sheet/*.png
"""
import bpy, math, sys, os
import mathutils

CATALOGUE = '/home/motmot3000/orca/workspaces/class-odyssey/haircut/assets/character-stylized/catalogue.glb'
OUT = '/tmp/opencode/hair-sheet'
os.makedirs(OUT, exist_ok=True)

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HAIR = args[0] if args else 'curly'
PERSONAS = [args[1]] if len(args) > 1 else ['male', 'female']

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CATALOGUE)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
HATS = ['no-hat', 'explorer-cap', 'sunglasses', 'feather-beret', 'wizard-hat', 'gold-crown', 'classy-hat', 'celestial-crown', 'steel-helm']

sc = bpy.context.scene
cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data)
sc.collection.objects.link(cam); sc.camera = cam; cam_data.lens = 70
for loc, energy in [((-1.4, -1.9, 2.7), 260), ((1.6, -0.6, 1.9), 150), ((0.4, 2.0, 2.4), 170)]:
    ld = bpy.data.lights.new('k', 'AREA'); ld.energy = energy; ld.shape = 'DISK'; ld.size = 1.3
    lo = bpy.data.objects.new('k', ld); sc.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (mathutils.Vector((0, 0, 1.6)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND').inputs[0].default_value = (0.80, 0.83, 0.85, 1)
try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
except Exception: sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x = 300; sc.render.resolution_y = 380

def show(persona, hat):
    # Mirror of src/items-3d-model.mjs: the hat decides which hair variant shows.
    covered = hat in ('feather-beret', 'wizard-hat', 'classy-hat')
    crowned = hat in ('gold-crown', 'celestial-crown')
    hair_fit = 'covered' if covered else 'crowned' if crowned else 'open'
    hair_visible = hat != 'steel-helm'
    for o in meshes:
        if o.get('shop_slot') in ('core',):
            o.hide_render = True; continue
        owner = o.get('fit_persona')
        if owner and owner != persona:
            o.hide_render = True; continue
        slot, item = o.get('shop_slot'), o.get('shop_id')
        if slot == 'persona':
            o.hide_render = False
        elif slot == 'hair':
            o.hide_render = (not hair_visible) or item != HAIR or o.get('hat_fit', 'open') != hair_fit
        elif slot == 'hat':
            o.hide_render = item != hat
        else:
            o.hide_render = True
    bpy.context.view_layer.update()

def frame(angle):
    if angle == 'front':
        cam.location = (0.06, -1.05, 1.70)
    elif angle == 'quarter':
        cam.location = (0.62, -0.92, 1.72)
    else:
        cam.location = (0.30, 1.05, 1.74)
    cam.rotation_euler = (mathutils.Vector((0, 0, 1.62)) - cam.location).to_track_quat('-Z', 'Y').to_euler()

for persona in PERSONAS:
    for hat in HATS:
        show(persona, hat)
        for angle in ['front', 'quarter', 'back']:
            frame(angle)
            sc.render.filepath = f'{OUT}/{persona}_{HAIR}_{hat}_{angle}.png'
            bpy.ops.render.render(write_still=True)
print('SHEET_DONE', OUT)
