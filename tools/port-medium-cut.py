"""Port the supplied medium cut into the authored equipment frame.

The archive (beautiful-hair-1.zip) carries a single hair shell and its strand
map: a wavy, medium-length bob with a side-swept fringe, 10 154 vertices and
5 066 quads. It has no head, so the delivered cut is placed straight into the
authored frame instead of mapping a source skull like the braid port does.

The shell already arrives at head scale, front at -Y, and it seats on Noa and
Mila without a rigid re-scale: enlarging it only lifts the crown off the skull
(see the comparison renders), while the identity seat keeps the fringe on the
brow. A 15 mm drop and 4 mm forward nudge then bring the swept fringe onto the
brow at game framing.

The supplied front did not hold up on the stylized heads (flat swept fringe,
open forehead parting, bare temples), so it is removed: every lock island whose
centre lies ahead of FRONT_CUT_Y is dropped, and tools/medium_cut_locks.py
rebuilds the front as ribbon locks like the kept back ones (wavy parted fringe,
curly top, side locks to the jaw), fitted against both Noa's and Mila's skins.
What is left is the authored-frame conversion.
`build-items-3d.py` maps the authored frame onto each character with the
hat-seat transform; for the boy that transform scales depth by 0.931195796,
drops 0.004000068 m and shifts 0.005275651 m forward (assets/items-3d/manifest.json,
templateToCharacter). Baking its inverse here means the catalogue maps the cut
back to exactly this measured seat, and the girl receives the same cut narrowed
5 % on X.

Run: blender -b --factory-startup --python-exit-code 1 \
  --python tools/port-medium-cut.py -- /path/beautiful-hair-1.zip
Writes assets/characters-refit/hair/medium-cut.glb and medium-cut.json.
"""
import bpy
import bmesh
import hashlib
import io
import json
import sys
import tempfile
import zipfile
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import medium_cut_locks  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'characters-refit' / 'hair'
OUT.mkdir(parents=True, exist_ok=True)
DEFAULT_ARCHIVE = Path('/home/motmot3000/Téléchargements/beautiful-hair-1.zip')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
archive_path = Path(args[0]) if args else DEFAULT_ARCHIVE

# Authored-frame conversion: the inverse of the boy hat-seat transform, taken
# from the catalogue contract so the medium cut lands where it was measured.
AUTHORED = Vector((1.0 / 1.001398325,
                   1.0 / 0.931195796,
                   1.0))
AUTHORED_SHIFT = Vector((0.0, 0.005275651, 0.004000068))


def load_source(archive_path):
    """Extract the hair OBJ and its strand map from the nested archive."""
    with zipfile.ZipFile(archive_path) as archive:
        member = 'source/HairTest.zip'
        inner = zipfile.ZipFile(io.BytesIO(archive.read(member)))
        obj_bytes = inner.read('HairTest.obj')
        texture_bytes = inner.read('Hair4.png')
    directory = Path(tempfile.mkdtemp(prefix='medium-cut-'))
    obj_path = directory / 'HairTest.obj'
    obj_path.write_bytes(obj_bytes)
    (directory / 'Hair4.png').write_bytes(texture_bytes)
    return obj_path, obj_bytes, texture_bytes, member


obj_path, obj_bytes, texture_bytes, member = load_source(archive_path)
obj_sha = hashlib.sha256(obj_bytes).hexdigest()

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(obj_path))

meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if len(meshes) != 1:
    raise ValueError('Expected a single supplied hair mesh')
obj = meshes[0]
source_name = obj.name
source_polygons = len(obj.data.polygons)
source_vertices = len(obj.data.vertices)
source_triangles = sum(len(face.vertices) - 2 for face in obj.data.polygons)

# Only the hair is kept: the archive holds no head, and every material here is
# hair. Drop any stray non-hair material slot defensively.
hair_slots = [i for i, mat in enumerate(obj.data.materials)
              if mat and 'skin' not in mat.name.lower()]
bm = bmesh.new()
bm.from_mesh(obj.data)
bmesh.ops.delete(bm, geom=[face for face in bm.faces if face.material_index not in hair_slots], context='FACES')
bmesh.ops.delete(bm, geom=[vertex for vertex in bm.verts if not vertex.link_faces], context='VERTS')
bm.to_mesh(obj.data)
bm.free()
obj.shape_key_clear()
obj.data.transform(obj.matrix_world)
obj.matrix_world = Matrix.Identity(4)

# Tidy the shell without touching its sculpted locks: weld only coincident
# import splits and drop degenerate faces, so shading stays smooth.
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.00001)
bpy.ops.mesh.dissolve_degenerate()
bpy.ops.object.mode_set(mode='OBJECT')

# Match the delivered cuts: smooth shaded, one app hair material the shop
# palette can recolour (the source strand map is superseded by hair-normal /
# hair-roughness in the catalogue, as for Short, Long and the Braid).
obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
for face in obj.data.polygons:
    face.use_smooth = True
    face.material_index = 0
obj.data.materials.clear()
material = bpy.data.materials.new('Hair / supplied locks')
material.use_nodes = True
shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
shader.inputs['Base Color'].default_value = (.088, .050, .029, 1)
shader.inputs['Roughness'].default_value = .58
obj.data.materials.append(material)
obj.name = 'medium / supplied hairstyle'
obj['hair_source'] = f'{archive_path.name}/{member}'
obj['hair_source_sha256'] = obj_sha
obj['hair_reference_revision'] = 'refit-hair-v2-front'
obj['source_head_removed'] = False
obj.data.update()

# Seat the cut for the delivered stylized head. The source shell was modelled
# on a narrower, shallower realistic skull, so on Noa and Mila the swept fringe
# rides above the brow and parts the forehead open. Dropping it 15 mm and
# nudging it 4 mm forward brings the fringe back onto the brow at game framing,
# while the crown still clears the skull (top 1.760 m over a 1.735 m crown).
# A hairline underlayer was tried instead and rejected: the fringe lies flat on
# the forehead, so any cap either hid behind the skin or surfaced in front of
# the locks and read as a swim cap.
SEAT_SHIFT = Vector((0.0, -0.004, -0.015))
for vertex in obj.data.vertices:
    vertex.co = vertex.co + SEAT_SHIFT
obj.data.update()

# Rebuild the front. Drop the supplied front islands, then add the generated
# locks, fitted in the boy seat against both skins (the girl skin is widened by
# the inverse of her extra X narrowing, so it lands in the same space).
FRONT_CUT_Y = -0.005
GIRL_X = 0.950466096 / 1.001398325
LOCK_SEED = 7
bm = bmesh.new()
bm.from_mesh(obj.data)
seen, drop = set(), []
for vertex in bm.verts:
    if vertex.index in seen:
        continue
    stack, island = [vertex], []
    seen.add(vertex.index)
    while stack:
        current = stack.pop()
        island.append(current)
        for edge in current.link_edges:
            other = edge.other_vert(current)
            if other.index not in seen:
                seen.add(other.index)
                stack.append(other)
    if sum(v.co.y for v in island) / len(island) < FRONT_CUT_Y:
        drop += island
bmesh.ops.delete(bm, geom=drop, context='VERTS')
bm.to_mesh(obj.data)
bm.free()
kept_back_vertices = len(obj.data.vertices)


def skin_tree(glb, prefix, x_scale=1.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets' / 'characters-base' / glb))
    new = set(bpy.data.objects) - before
    skin = next(o for o in new if o.type == 'MESH' and o.name.startswith(prefix) and 'continuous skin' in o.name)
    matrix = skin.matrix_world.copy()
    verts = [matrix @ v.co for v in skin.data.vertices]
    tree = BVHTree.FromPolygons([Vector((v.x * x_scale, v.y, v.z)) for v in verts],
                                [list(p.vertices) for p in skin.data.polygons])
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    return tree


heads = medium_cut_locks.Heads([skin_tree('boy-medium.glb', 'boy •'),
                                skin_tree('girl-medium.glb', 'girl •', 1 / GIRL_X)])
locks = medium_cut_locks.build_front(heads, seed=LOCK_SEED)
front_mesh = bpy.data.meshes.new('medium front locks')
front_mesh.from_pydata(locks['verts'], [], locks['faces'])
uv_name = obj.data.uv_layers.active.name if obj.data.uv_layers else 'UVMap'
uv_layer = front_mesh.uv_layers.new(name=uv_name)
for polygon in front_mesh.polygons:
    for loop in polygon.loop_indices:
        uv_layer.data[loop].uv = locks['uv'][front_mesh.loops[loop].vertex_index]
front = bpy.data.objects.new('medium front locks', front_mesh)
bpy.context.scene.collection.objects.link(front)
front.data.materials.append(material)
for polygon in front.data.polygons:
    polygon.use_smooth = True
bpy.ops.object.select_all(action='DESELECT')
front.select_set(True)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.join()
front_vertices = len(obj.data.vertices) - kept_back_vertices
obj.data.update()

# Authored frame. The cut arrives in the character frame at the measured seat;
# this is the inverse of the catalogue's authored -> boy transform.
for vertex in obj.data.vertices:
    vertex.co = Vector((vertex.co[i] * AUTHORED[i] + AUTHORED_SHIFT[i] for i in range(3)))
obj.data.update()

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=str(OUT / 'medium-cut.glb'), export_format='GLB',
                          use_selection=True, export_yup=True, export_animations=False, export_extras=True)

corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
report = {
    'revision': 'refit-hair-v2-front',
    'source': archive_path.name,
    'sourceMember': member,
    'sourceObject': source_name,
    'sourceObjSha256': obj_sha,
    'sourceTexture': 'source/HairTest.zip/Hair4.png',
    'sourceTextureSha256': hashlib.sha256(texture_bytes).hexdigest(),
    'attribution': 'User-supplied model; the archive carries no author or licence notice.',
    'sourceHeadRemoved': False,
    'sourceHairTriangles': source_triangles,
    'optimizedHairTriangles': sum(len(face.vertices) - 2 for face in obj.data.polygons),
    'sourceVertices': source_vertices,
    'front': {
        'rebuilt': True,
        'generator': 'tools/medium_cut_locks.py',
        'seed': LOCK_SEED,
        'sourceIslandsDroppedAheadOfY': FRONT_CUT_Y,
        'keptBackVertices': kept_back_vertices,
        'generatedVertices': front_vertices,
    },
    'sourcePolygons': source_polygons,
    'coordinates': 'Authored frame: Blender Z up, front -Y; glTF Y up, front +Z; metres',
    'fit': {
        'scale': [round(1.0 / AUTHORED[i], 9) for i in range(3)],
        'authoredScale': [round(value, 9) for value in AUTHORED],
        'authoredShift': [round(value, 9) for value in AUTHORED_SHIFT],
        'seatShift': [round(value, 9) for value in SEAT_SHIFT],
        'seat': 'measured on the boy head, then mapped authored -> each character',
    },
    'bounds': {
        'min': [round(min(c[i] for c in corners), 5) for i in range(3)],
        'max': [round(max(c[i] for c in corners), 5) for i in range(3)],
    },
    'output': 'medium-cut.glb',
}
(OUT / 'medium-cut.json').write_text(json.dumps(report, indent=2) + '\n')
print('MEDIUM_CUT_READY', json.dumps(report), flush=True)
