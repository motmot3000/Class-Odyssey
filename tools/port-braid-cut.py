"""Port the delivered fringe-and-braid cut into the authored head frame.

The source FBX carries its own head sphere; the game head is a different
ellipsoid, measured on Noa and Mila (top ~1.735 m, temple half-width ~.100 m,
authored space ~= character space). Mapping the source sphere onto that
ellipsoid gives the cut the same snug fit as the delivered Short and Long
cuts: the first uniform attempt floated 10 cm above the crown, which this
ellipsoid mapping removes.

Run: blender -b --factory-startup --python tools/port-braid-cut.py
Writes assets/characters-refit/hair/curly.glb
"""
import bpy
import mathutils
from mathutils import Vector

ROOT = '/home/motmot3000/orca/workspaces/class-odyssey/haircut'
SRC = '/tmp/opencode/ported-hair/inner/afro.fbx'
OUT = f'{ROOT}/assets/characters-refit/hair/curly.glb'

# Authored head frame, measured on the delivered stylized characters.
TARGET_HEAD_CENTER = Vector((0.0, -0.005, 1.639))
TARGET_HEAD_RADII = Vector((0.1045, 0.1000, 0.1000))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)

hair = bpy.data.objects.get('Model_mesh.001')
head_ref = bpy.data.objects.get('Sphere')
if not hair or not head_ref:
    raise RuntimeError('unexpected source objects: ' + repr([o.name for o in bpy.data.objects]))

corners = [head_ref.matrix_world @ mathutils.Vector(c) for c in head_ref.bound_box]
source_center = Vector(((min(v.x for v in corners) + max(v.x for v in corners)) / 2,
                        (min(v.y for v in corners) + max(v.y for v in corners)) / 2,
                        (min(v.z for v in corners) + max(v.z for v in corners)) / 2))
source_radii = Vector(((max(v.x for v in corners) - min(v.x for v in corners)) / 2,
                       (max(v.y for v in corners) - min(v.y for v in corners)) / 2,
                       (max(v.z for v in corners) - min(v.z for v in corners)) / 2))
scale = Vector((TARGET_HEAD_RADII[i] / source_radii[i] for i in range(3)))
print('source head center', tuple(round(v, 4) for v in source_center),
      'radii', tuple(round(v, 4) for v in source_radii),
      'scale', tuple(round(v, 4) for v in scale))

bpy.data.objects.remove(head_ref, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
hair.select_set(True)
bpy.context.view_layer.objects.active = hair
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for vertex in hair.data.vertices:
    vertex.co = TARGET_HEAD_CENTER + Vector(((vertex.co - source_center)[i] * scale[i] for i in range(3)))
hair.data.update()
for polygon in hair.data.polygons:
    polygon.use_smooth = True

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.dissolve_degenerate()
bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_animations=False)
print('EXPORTED', OUT, 'top', round(max(v.co.z for v in hair.data.vertices), 3),
      'bottom', round(min(v.co.z for v in hair.data.vertices), 3))
