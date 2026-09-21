"""Port the delivered fringe-and-braid cut into the authored head frame.

The source FBX carries its own head sphere; the game head is a different
ellipsoid, measured on Noa and Mila (top ~1.735 m, temple half-width ~.100 m,
authored space ~= character space). Mapping the source sphere onto that
ellipsoid gives the cut the same snug fit as the delivered Short and Long
cuts: the first uniform attempt floated 10 cm above the crown, which this
ellipsoid mapping removes.

The audit then found three front defects that only appear once the cut sits
on the real face, all fixed here at the source:

* The fringe is an open shell of separated locks, so the bare forehead showed
  through every gap. A skin-tight `hairline underlayer` cap now backs the
  fringe, ending in a scalloped hairline just above the brows.
* The right temple wisp sat 16 mm inside the head and reached below the brow,
  so the per-persona conform pass pasted it across the eye. It is shortened
  and lifted back above the hairline.
* The z-compression of the ellipsoid mapping flattened the fringe against the
  forehead; a falloff puff restores the delivered volume.

Run: blender -b --factory-startup --python tools/port-braid-cut.py
Writes assets/characters-refit/hair/curly.glb
"""
import bpy
import math
import mathutils
from mathutils import Vector

ROOT = '/home/motmot3000/orca/workspaces/class-odyssey/haircut'
SRC = '/tmp/opencode/ported-hair/inner/afro.fbx'
OUT = f'{ROOT}/assets/characters-refit/hair/curly.glb'
TAU = math.pi * 2

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

HC = TARGET_HEAD_CENTER


def clamp(value, lo=0.0, hi=1.0):
    return max(lo, min(hi, value))


# Drop the two locks the audit caught crossing the face: the centre spike
# darting between the brows and the long right temple wisp that sat inside
# the head (the conform pass used to glue it across the eye). Each lock is a
# separate mesh island (outer shell + inner lining share the lock's bbox), so
# deleting whole islands keeps every other lock pixel-identical.
import bmesh

bm = bmesh.new()
bm.from_mesh(hair.data)
seen = set()
islands = []
for vert in bm.verts:
    if vert.index in seen:
        continue
    stack, component = [vert], []
    seen.add(vert.index)
    while stack:
        current = stack.pop()
        component.append(current)
        for edge in current.link_edges:
            other = edge.other_vert(current)
            if other.index not in seen:
                seen.add(other.index)
                stack.append(other)
    islands.append(component)

drop = []
for component in islands:
    xs = [v.co.x for v in component]
    ys = [v.co.y for v in component]
    zs = [v.co.z for v in component]
    front_lock = max(ys) < -0.04
    centre_spike = max(ys) < -0.07 and min(zs) < 1.645 and min(xs) > -0.015 and max(xs) < 0.06
    right_wisp = front_lock and min(zs) < 1.58 and min(xs) > 0.04
    if centre_spike or right_wisp:
        drop.extend(component)
        print('DROP_LOCK', len(component), 'x', round(min(xs), 3), round(max(xs), 3),
              'z', round(min(zs), 3), round(max(zs), 3))
bmesh.ops.delete(bm, geom=drop, context='VERTS')
bm.to_mesh(hair.data)
bm.free()
hair.data.update()

# Restore the fringe volume the z-compression flattened: a smooth puff over
# the front band only, so the braid and the crown fit stay untouched.
for vertex in hair.data.vertices:
    co = vertex.co
    if co.y < -0.05 and co.z > 1.60:
        w = clamp((co.z - 1.60) / 0.04) * clamp((1.745 - co.z) / 0.08)
        w = w * w * (3 - 2 * w)
        vertex.co = HC + (co - HC) * (1 + 0.030 * w)

hair.data.update()
for polygon in hair.data.polygons:
    polygon.use_smooth = True


def build_hairline_underlayer():
    """Skin-tight cap backing the fringe so lock gaps read as hair, not skin.

    The front edge is a scalloped hairline above the brows; sides pass over
    the ear tops and the back runs to the nape under the gathered crown.
    """
    cols, rows = 128, 48
    radii = Vector((0.1075, 0.1030, 0.1035))
    vertices, faces, uvs = [], [], []
    for j in range(rows):
        ring = j / (rows - 1)
        for i in range(cols):
            a = i * TAU / cols
            s = math.sin(a)
            if s < 0:
                theta_max = 1.720 + (1.250 - 1.720) * (-s)
                theta_max += 0.010 * math.sin(a * 6.0 + 1.2) * (-s)
            else:
                theta_max = 1.720 + (2.42 - 1.720) * s
                # Drop lower behind each ear: the locks parting there exposed
                # their dark linings against the bare skull.
                a_side = min(a, math.pi - a)
                ear_band = clamp((a_side - 0.15) / 0.15) * clamp((1.05 - a_side) / 0.15)
                theta_max = max(theta_max, 1.720 + (2.10 - 1.720) * ear_band)
            theta = 0.02 + (theta_max - 0.02) * ring
            vertex = Vector((radii.x * math.sin(theta) * math.cos(a),
                             HC.y + radii.y * math.sin(theta) * math.sin(a),
                             HC.z + radii.z * math.cos(theta)))
            # Plug the crevice above and behind each ear: without hair depth
            # there, the gap between the outer locks showed the dark shell
            # interior. The bump stays above the ear root and behind its tip.
            vx = abs(vertex.x)
            wx = clamp((vx - 0.090) / 0.015)
            wz = clamp((vertex.z - 1.625) / 0.015) * clamp((1.700 - vertex.z) / 0.015)
            wy = clamp((vertex.y + 0.01) / 0.02) * clamp((0.075 - vertex.y) / 0.02)
            bump = wx * wz * wy
            bump = bump * bump * (3 - 2 * bump)
            if bump:
                vertex = HC + (vertex - HC) * (1 + 0.13 * bump)
            vertices.append(tuple(vertex))
            uvs.append((i / cols, ring))
    for j in range(rows - 1):
        for i in range(cols):
            ni = (i + 1) % cols
            faces.append((j * cols + i, (j + 1) * cols + i, (j + 1) * cols + ni, j * cols + ni))
    mesh = bpy.data.meshes.new('hairline underlayer')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    layer = mesh.uv_layers.new(name='UVMap')
    mesh.uv_layers.active = layer
    for loop in mesh.loops:
        layer.data[loop.index].uv = uvs[loop.vertex_index]
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new('hairline underlayer', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


underlayer = build_hairline_underlayer()

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.dissolve_degenerate()
bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.object.select_all(action='DESELECT')
hair.select_set(True)
underlayer.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_animations=False)
print('EXPORTED', OUT, 'top', round(max(v.co.z for v in hair.data.vertices), 3),
      'bottom', round(min(v.co.z for v in hair.data.vertices), 3),
      'underlayer', len(underlayer.data.vertices))
