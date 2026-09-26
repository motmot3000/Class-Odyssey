"""Build the current wearable catalogue on the delivered base-v2 characters.

Blender 4.5, metres, Z up, front at -Y. Source body is a static evaluated
character snapshot; authored equipment uses the game's stable item identifiers.
Run: blender -b --factory-startup --python tools/build-items-3d.py
"""
import bpy
import bmesh
import hashlib
import json
import math
import os
import struct
import sys
import tempfile
import numpy as np
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector, noise
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
# STYLIZED=1 builds an isolated review catalogue from the delivered characters
# and their own materials: a natural, semi-realistic stylized look without the
# previous face reshaping, eye swap or body deformation. It never overwrites
# assets/items-3d, so the proposal can be inspected before any integration.
STYLIZED = bool(os.environ.get('STYLIZED'))
# STYLIZED_OUT lets a review build go to its own folder so the atelier can
# show it before anything is integrated into the live base.
OUT = ROOT / 'assets' / (os.environ.get('STYLIZED_OUT', 'character-stylized') if STYLIZED else 'items-3d')
SOURCES = ROOT / 'assets' / 'items-3d' / 'sources'
CONTRACT = json.loads((SOURCES / 'manifest.json').read_text())
OUT.mkdir(parents=True, exist_ok=True)
C = Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
CHARACTERS = {'male': 'boy', 'female': 'girl'}
TAU = math.tau
objects = []
slot = 'core'
item = 'base'
persona = None
# Authored equipment space. Geometry is retargeted from this frame to each
# delivered character's measured head frame, never by moving the base skin.
HEAD_FIT = {'center_y': -.012, 'hair_center_z': 1.625, 'hat_seat_z': 1.692,
            'hat_inner_x': .118, 'hat_inner_y': .143, 'under_hat_z': 1.700}
HEAD_FITS = {}
APPEARANCE_REVISION = 'stylized-v8' if STYLIZED else 'catalogue-v12-ear-drape'
# Haircuts are being signed off one family at a time. HAIR_ITEMS restricts the
# build to a comma-separated subset; an empty value ships a shaved head only.
# Unset keeps every authored cut for studio experiments.
HAIR_ITEMS = ['short', 'long', 'medium-cut', 'curly', 'spiky', 'bun', 'braided', 'royal-hair']
if 'HAIR_ITEMS' in os.environ:
    _wanted = {name.strip() for name in os.environ['HAIR_ITEMS'].split(',') if name.strip()}
    HAIR_ITEMS = [name for name in HAIR_ITEMS if name in _wanted]
# Delivered cuts (source file, item id), fitted to every head. Authored-in-
# Blender families are sculpted per item id. The previous delivered `short`
# (boy source) is now the `spiky` unlock; the new delivered `short` is the
# sculpted straight cut grown on the measured skulls by
# tools/blender/sculpt_straight_short.py.
SUPPLIED_HAIR = [('girl', 'long'), ('boy', 'spiky'), ('medium-cut', 'medium-cut'),
                 ('curly', 'curly'), ('straight-short', 'short'),
                 ('bun', 'bun')]
# The sculpted short cut already stops on the measured ear contour, so the
# generic ear clearance (which squeezes locks toward the skull and crumpled
# the first supplied plates) is skipped; it is still conformed to the skin.
CONFORMED_HAIR = {'short'}
# Cuts that carry a per-vertex shade (darker roots, per-strand tone). Their
# material multiplies it into the shop hair colour, and glTF exports it as
# COLOR_0, which the viewer multiplies by the colour it sets on `Hair /`.
SHADED_HAIR = {'short'}
SCULPTED_HAIR = ['braided', 'royal-hair']
REFINED = ROOT / 'assets' / 'characters-refit' / 'textures'
HAIR_REFIT = ROOT / 'assets' / 'characters-refit' / 'hair'
# Validated face, eye and expression maps. The frozen snapshots in
# assets/characters-approved/faces-v1 are the reference those maps were
# approved with; they are produced by the study tools documented in
# docs/characters-refit/README.md.
STUDY = ROOT / 'assets' / 'character-detail-study'
FACE_TEXTURES = STUDY / 'expressions' / 'textures'
WARM_EYES = STUDY / 'warm-eyes'
# Single source of truth for the validated body silhouettes.
sys.path.insert(0, str(ROOT / 'tools' / 'blender'))
from refit_body_shapes import apply_body_shape
from refit_female_base import rebuild_torso, clear_ear_space, ear_weight, swept_temple_locks, fit_posterior_hair
from human_ears import ear_islands, skull_tree, cap_openings, human_ear_matrix, jewellery_layout, side_outline, skull_x
from human_ear_model import ear_mesh as human_ear_mesh
from hair_fill import hair_tree, ear_attachment, ear_zone_shell, append_geometry


def texture_node(mat, filename):
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(str(filename), check_existing=True)
    return node


def surface_maps(mat, normal_path, rough_path, strength=.4):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    normal = texture_node(mat, normal_path)
    normal.image.colorspace_settings.name = 'Non-Color'
    mapping = nodes.new('ShaderNodeNormalMap')
    mapping.inputs['Strength'].default_value = strength
    links.new(normal.outputs['Color'], mapping.inputs['Color'])
    links.new(mapping.outputs['Normal'], shader.inputs['Normal'])
    rough = texture_node(mat, rough_path)
    rough.image.colorspace_settings.name = 'Non-Color'
    links.new(rough.outputs['Color'], shader.inputs['Roughness'])


def base_color_image_node(mat):
    """Albedo image node, whether it feeds Base Color directly or through the
    vertex-colour Mix that the glTF importer inserts for toned skin."""
    if not mat or not mat.use_nodes: return None
    shader = mat.node_tree.nodes.get('Principled BSDF')
    if not shader: return None
    for node in mat.node_tree.nodes:
        if node.type != 'TEX_IMAGE' or not node.image: continue
        for link in node.outputs['Color'].links:
            if link.to_node is shader: return node
            if link.to_node.type in {'MIX_RGB', 'MIX'} and any(
                    out.links and out.links[0].to_socket == shader.inputs['Base Color'] for out in link.to_node.outputs):
                return node
    return None


def refine_source_materials(obj, gender):
    """Swap in the refit skin, face and eye maps and set a matte, non-plastic
    response. The delivered body geometry and UV islands are untouched."""
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes: continue
        shader = mat.node_tree.nodes.get('Principled BSDF')
        if not shader or mat.get('catalogue_surface_revision'): continue
        key = mat.get('base_skin_map')
        if key:
            node = base_color_image_node(mat)
            if key == 'head':
                # Approved expression maps: subtle lower-eyelid crease, lip and
                # cheek variation, and a stronger face normal for the creases.
                if node: node.image = bpy.data.images.load(str(FACE_TEXTURES / f'{gender}-face.png'), check_existing=True)
                surface_maps(mat, FACE_TEXTURES/'face-normal.png', REFINED/'rough-head.png', .70)
                shader.inputs['Specular IOR Level'].default_value = .30
            else:
                if node: node.image = bpy.data.images.load(str(REFINED / 'skin-medium.png'), check_existing=True)
                surface_maps(mat, REFINED/'normal-skin.png', REFINED/'rough-skin.png', .26)
                shader.inputs['Specular IOR Level'].default_value = .26
            shader.inputs['Subsurface Weight'].default_value = .02
            shader.inputs['Subsurface Radius'].default_value = (1, .42, .24)
            shader.inputs['Subsurface Scale'].default_value = .02
            shader.inputs['Coat Weight'].default_value = 0
        elif 'Eye_L' in obj.name or 'Eye_R' in obj.name:
            # Validated Link eye maps, applied to both characters.
            side = 'left' if 'Eye_L' in obj.name else 'right'
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    node.image = bpy.data.images.load(str(WARM_EYES/f'{gender}-{side}.png'), check_existing=True)
            shader.inputs['Roughness'].default_value = .27
            shader.inputs['Coat Weight'].default_value = .10
            shader.inputs['Coat Roughness'].default_value = .19
        elif 'Eyelash' in obj.name:
            shader.inputs['Roughness'].default_value = .62
            shader.inputs['Specular IOR Level'].default_value = .18
        elif 'Pant_' in obj.name:
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    node.image = bpy.data.images.load(str(REFINED/'trousers.png'), check_existing=True)
            surface_maps(mat, REFINED/'normal-trousers.png', REFINED/'rough-trousers.png', .45)
        mat['catalogue_surface_revision'] = APPEARANCE_REVISION


def sculpt_head(obj, gender):
    """Refine the delivered head into a calmer, less doll-like face.

    Only the frontal face bowl is touched (z 1.49–1.665, in front of the ears),
    so the hairline, hat seat, ears and neck weld stay exactly as delivered.
    Skin, eyelids and eyeballs share one smooth field and move together.
    """
    feminine = gender == 'girl'
    center_x = .046 if feminine else .049
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        if z < 1.49 or z > 1.665 or y > -.055: continue
        def ease(t):
            t=max(0,min(1,t))
            return t*t*(3-2*t)
        mask=ease((z-1.49)/.025)*ease((1.665-z)/.020)*ease((-.055-y)/.035)
        original=vertex.co.copy()
        side = 1 if x >= 0 else -1
        dx, dz = x - side*center_x, z - 1.588
        weight = math.exp(-((dx/.037)**4 + (dz/.038)**4))
        # Smaller, better-proportioned eyes raised into a natural eye line.
        vertex.co.x -= dx * (.17 if feminine else .13) * weight
        vertex.co.z -= dz * (.28 if feminine else .25) * weight
        vertex.co.z += .006 * math.exp(-((dx/.046)**4 + (dz/.058)**4))
        # Calmer brow ridge, softer still on the girl.
        brow = math.exp(-((abs(x)-.042)/.036)**4 - ((z-1.628)/.018)**4)
        vertex.co.z += ((.008 if feminine else .004) - (.016 if feminine else .010) * min(1, abs(x)/.08)) * brow
        # A slightly fuller, better-defined mouth.
        vertex.co.y -= (.0018 if feminine else .0012) * math.exp(-((x/.030)**4 + ((z-1.512)/.010)**2))
        # Narrower jaw and a softer chin for the girl.
        if feminine and z < 1.545:
            jaw = math.exp(-((abs(x)-.055)/.045)**4) * max(0, min(1, (1.545-z)/.045))
            vertex.co.x -= (x - side*.055) * .30 * jaw
        vertex.co=original.lerp(vertex.co,mask)
    obj.data.normals_split_custom_set([(0,0,0)] * len(obj.data.loops))
    for polygon in obj.data.polygons: polygon.use_smooth = True


def soften_face(obj, gender):
    """Approved 'Douce' expression: relaxed inner brow and a gentle smile.

    Applied after sculpt_head so it works on the same approved frontal bowl.
    Hair, silhouette and provided textures stay untouched.
    """
    config = {'inner': .017, 'outer': -.008, 'smile': .0025, 'cheek': .0007}
    if obj.get('part') not in ['skin', 'eyes']: return
    matrix = obj.matrix_world.copy(); inverse = matrix.inverted()
    for vertex in obj.data.vertices:
        p = matrix @ vertex.co; x, y, z = p
        if y > -.065 or not 1.49 < z < 1.67: continue
        # Raise the inner brow and lower its outer end: remove the angry V.
        t = max(0, min(1, (abs(x)-.014)/.058))
        brow = math.exp(-((z-1.628)/.023)**4) * math.exp(-((abs(x)-.043)/.049)**6)
        p.z += (config['inner']*(1-t) + config['outer']*t) * brow
        # Gentle smile from the mouth corners, not a large painted grin.
        corners = min(1, (abs(x)/.037)**2) * math.exp(-((abs(x)/.055)**6) - ((z-1.515)/.018)**2)
        p.z += config['smile'] * corners
        cheek = math.exp(-((abs(x)-.053)/.025)**2 - ((z-1.567)/.024)**2)
        p.z += config['cheek'] * cheek
        vertex.co = inverse @ p
    obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
    for face in obj.data.polygons: face.use_smooth = True


def refine_eyelids(obj, gender):
    """Follow the validated reference aperture without deforming the globe."""
    if obj.get('part') not in ['skin', 'eyes']: return
    if 'Eye_L' in obj.name or 'Eye_R' in obj.name: return
    matrix = obj.matrix_world.copy(); inverse = matrix.inverted()
    center_x = .046 if gender == 'girl' else .049
    for vertex in obj.data.vertices:
        p = matrix @ vertex.co; x, y, z = p
        if y > -.082 or not 1.574 < z < 1.619: continue
        dx, dz = abs(x) - center_x, z - 1.596
        width = math.exp(-((dx/.030)**4))
        edge = max(0, min(1, (1.619-z)/.008)) * max(0, min(1, (z-1.574)/.008))
        p.z += -dz * .09 * width * edge
        vertex.co = inverse @ p
    obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))


def stylize_face(obj, gender):
    """Gentle, natural expression on the delivered face.

    The delivered head is already clean and semi-realistic; this only relaxes
    the angled brows into a calm arch, lifts the mouth corners into a soft
    smile and fills the cheeks a touch. Eyes, lids and gaze are left alone so
    the character never stares.
    """
    if obj.get('part') not in ['skin', 'eyes']: return
    matrix = obj.matrix_world.copy(); inverse = matrix.inverted()
    for vertex in obj.data.vertices:
        p = matrix @ vertex.co; x, y, z = p
        if y > -.060 or not 1.49 < z < 1.69: continue
        # Calm arch: raise the inner brow, let the outer end fall.
        t = max(0, min(1, (abs(x)-.014)/.058))
        brow = math.exp(-((z-1.630)/.021)**4) * math.exp(-((abs(x)-.045)/.052)**6)
        p.z += (.0026*(1-t) - .0018*t) * brow
        # Soft smile from the mouth corners, not a painted grin.
        corners = min(1, (abs(x)/.037)**2) * math.exp(-((abs(x)/.055)**6) - ((z-1.512)/.017)**2)
        p.z += .0022 * corners
        # Slightly fuller cheeks read younger and friendlier.
        cheek = math.exp(-((abs(x)-.052)/.026)**2 - ((z-1.566)/.024)**2)
        p.z += .0007 * cheek
        # A gently narrower jaw keeps Mila clearly feminine without reshaping
        # the skull, so the supplied hairstyles and hats still seat correctly.
        if gender == 'girl' and z < 1.552:
            jaw = math.exp(-((abs(x)-.055)/.045)**4) * max(0, min(1, (1.552-z)/.05))
            p.x -= (x - (1 if x >= 0 else -1)*.055) * .18 * jaw
        vertex.co = inverse @ p
    obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
    for face in obj.data.polygons: face.use_smooth = True


def stylize_materials(obj):
    """A matte, graphic response while keeping the delivered painted textures."""
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes: continue
        shader = mat.node_tree.nodes.get('Principled BSDF')
        if not shader: continue
        shader.inputs['Specular IOR Level'].default_value = .20
        shader.inputs['Coat Weight'].default_value = 0
        if 'Sheen Weight' in shader.inputs: shader.inputs['Sheen Weight'].default_value = 0


def make_surface_textures():
    """Small, portable tangent-space PBR textures: fibres instead of clay."""
    directory = OUT/'textures'
    directory.mkdir(exist_ok=True)
    size = 512
    v, u = np.mgrid[0:size, 0:size].astype(np.float32) / size
    for kind in ['hair', 'cloth']:
        if kind == 'hair':
            flow = u*143 + .23*np.sin(v*TAU*2+u*8) + .065*np.sin(v*TAU*9+u*19)
            nx = .15*np.cos(flow*TAU) + .045*np.cos((u*231+v*.13)*TAU)
            ny = .025*np.sin(v*TAU*7+u*TAU)
            rough = .43 + .055*np.sin(flow*TAU) + .045*np.sin(v*TAU*3+u*11)
        else:
            nx = .055*np.sin(u*TAU*26)*np.cos(v*TAU*26)
            ny = .055*np.cos(u*TAU*26)*np.sin(v*TAU*26)
            rough = .85+.035*np.sin(u*TAU*23)*np.cos(v*TAU*27)
        nz = np.sqrt(1-nx*nx-ny*ny)
        normal = np.stack((nx*.5+.5, ny*.5+.5, nz*.5+.5, np.ones_like(u)), axis=-1)
        roughness = np.stack((rough,rough,rough,np.ones_like(u)),axis=-1)
        for channel, pixels in [('normal',normal),('roughness',roughness)]:
            image = bpy.data.images.new(f'{kind} fine {channel}', width=size,height=size,alpha=False)
            image.colorspace_settings.name='Non-Color'
            image.pixels.foreach_set(pixels.ravel())
            image.filepath_raw = str(directory/f'{kind}-{channel}.png')
            image.file_format='PNG'; image.save()


def grid_uv(obj, columns, rows):
    uv = obj.data.uv_layers.new(name='FibreFlow')
    for polygon in obj.data.polygons:
        indices = [obj.data.loops[index].vertex_index for index in polygon.loop_indices]
        wrap = any(index % columns == 0 for index in indices) and any(index % columns == columns-1 for index in indices)
        for index in polygon.loop_indices:
            vertex = obj.data.loops[index].vertex_index
            across = vertex % columns
            if wrap and across == 0: across = columns
            uv.data[index].uv = (across/columns, (vertex//columns)/max(1,rows-1))


def cloth_uv(obj):
    uv = obj.data.uv_layers.new(name='WovenSurface')
    for loop in obj.data.loops:
        p = obj.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (p.x*3+p.y, p.z*3)


def trim_under_belt(obj):
    # Split at the waist, then remove only the lower component crossing the
    # body's centreline. Below this plane the two sleeves are separate islands.
    # This avoids both the retained hip flap and holes in the lowered sleeves.
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.faces)+list(bm.edges)+list(bm.verts),plane_co=(0,0,1.030),plane_no=(0,0,1),dist=.000001)
    remaining={f for f in bm.faces if all(v.co.z<=1.030001 for v in f.verts)}
    removed=[]
    while remaining:
        first=remaining.pop();group={first};pending=[first]
        while pending:
            for edge in pending.pop().edges:
                for face in edge.link_faces:
                    if face in remaining: remaining.remove(face);group.add(face);pending.append(face)
        xs=[v.co.x for f in group for v in f.verts]
        if min(xs)<-.03 and max(xs)>.03: removed.extend(group)
    if not removed: raise ValueError('Cannot identify the original tunic tail')
    bmesh.ops.delete(bm,geom=removed,context='FACES')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()


def anchor(name, who=None):
    return CONTRACT['characters'][CHARACTERS[who or persona]]['anchors'][name]['world']


def anchor_position(name, who=None):
    p = anchor(name, who)['position']
    return Vector((p[0], -p[2], p[1]))


def anchor_matrix(name, who=None):
    transform = anchor(name, who)
    x,y,z,w = transform['quaternion']
    gltf = Matrix.LocRotScale(Vector(transform['position']), Quaternion((w,x,y,z)), Vector((1,1,1)))
    return C.inverted() @ gltf @ C


def column_major(matrix):
    return [round(matrix[row][column], 9) for column in range(4) for row in range(4)]


def import_character(path):
    # Blender 4.5 also instantiates unused nodes from earlier source scenes.
    # Import only the selected, static character scene, retaining mesh/material
    # indices and every geometry/texture byte of the immutable source snapshot.
    data = path.read_bytes()
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20+json_size])
    active = document['scenes'][document.get('scene',0)]
    reachable = set()
    def visit(index):
        if index in reachable: return
        reachable.add(index)
        for child in document['nodes'][index].get('children',[]): visit(child)
    for root in active.get('nodes',[]): visit(root)
    if not reachable: raise ValueError(f'Empty character scene: {path.name}')
    order = sorted(reachable); remap = {old:new for new,old in enumerate(order)}
    nodes = [dict(document['nodes'][index]) for index in order]
    if any('skin' in node for node in nodes): raise ValueError('Equipment fitting expects evaluated static character geometry')
    for node in nodes:
        if 'children' in node: node['children'] = [remap[index] for index in node['children']]
    document['nodes'] = nodes
    document['scenes'] = [{**active,'nodes':[remap[index] for index in active.get('nodes',[])]}]
    document['scene'] = 0
    document.pop('skins',None); document.pop('animations',None)
    text = json.dumps(document, separators=(',',':'), ensure_ascii=False).encode('utf-8')
    text += b' ' * ((-len(text)) % 4)
    chunks = struct.pack('<I4s', len(text), b'JSON') + text + data[20+json_size:]
    normalized = struct.pack('<4sII', b'glTF', 2, 12+len(chunks)) + chunks
    with tempfile.TemporaryDirectory(prefix='items-gltf-import-', dir='/tmp/opencode') as directory:
        temporary = Path(directory)/path.name
        temporary.write_bytes(normalized)
        bpy.ops.import_scene.gltf(filepath=str(temporary))


def linear(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c < .04045 else ((c + .055) / 1.055) ** 2.4 for c in values)


def material(name, color, roughness=.8, metal=0, glow=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*linear(color), 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    if glow:
        shader.inputs['Emission Color'].default_value = (*linear(color), 1)
        shader.inputs['Emission Strength'].default_value = glow
    mat.diffuse_color = (*linear(color), 1)
    return mat


def tag(obj, name, mat=None):
    obj.name = f'{item} / {name}'
    obj['shop_slot'] = slot
    obj['shop_id'] = item
    if persona: obj['fit_persona'] = persona
    if slot in ['hair', 'hat']:
        obj['attachment'] = 'hat-seat'
        obj['attachment_origin'] = [0, HEAD_FIT['hat_seat_z'], -HEAD_FIT['center_y']]
        obj['attachment_axes'] = 'glTF: +Y up, +Z front, metres'
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    objects.append(obj)
    return obj


def mesh(name, vertices, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    for polygon in data.polygons:
        polygon.use_smooth = smooth
    return tag(obj, name, mat)


def ell(name, center, size, mat, segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, location=center)
    obj = bpy.context.object
    obj.scale = size
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return tag(obj, name, mat)


def box(name, center, size, mat, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('Rounded crafted edges', 'BEVEL')
    mod.width = bevel
    mod.segments = 3
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return tag(obj, name, mat)


def line(name, points, radius, mat, closed=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 5
    data.bevel_depth = radius
    data.bevel_resolution = 2
    curve = data.splines.new('BEZIER')
    curve.bezier_points.add(len(points) - 1)
    for point, co in zip(curve.bezier_points, points):
        point.co = co
        point.handle_left_type = point.handle_right_type = 'AUTO'
    curve.use_cyclic_u = closed
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    return tag(obj, name, mat)


def ring(name, x, y, z, rx, ry, radius, mat):
    return line(name, [(x + rx * math.cos(a), y + ry * math.sin(a), z)
                      for a in [i * TAU / 32 for i in range(32)]], radius, mat, True)


def shell(name, rows, mat, start=0, arc=TAU, thickness=.006):
    n = 40
    vertices = [(rx * math.cos(a), cy + ry * math.sin(a), z)
                for z, rx, ry, cy in rows
                for a in [start + arc * i / n for i in range(n + 1)]]
    faces = [(j * (n + 1) + i, j * (n + 1) + i + 1,
              (j + 1) * (n + 1) + i + 1, (j + 1) * (n + 1) + i)
             for j in range(len(rows) - 1) for i in range(n)]
    obj = mesh(name, vertices, faces, mat)
    solid = obj.modifiers.new('Real fabric thickness', 'SOLIDIFY')
    solid.thickness = thickness
    return obj


def prism(name, outline, center, depth, mat):
    x, y, z = center
    n = len(outline)
    vertices = [(x + px, y + dy, z + pz) for dy in [-depth / 2, depth / 2] for px, pz in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    obj = mesh(name, vertices, faces, mat, False)
    bevel = obj.modifiers.new('Fine finished rim', 'BEVEL')
    bevel.width = .002
    bevel.segments = 2
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def star(name, center, radius, mat, points=5):
    outline = [(math.sin(i * math.pi / points) * radius * (1 if i % 2 == 0 else .43),
                math.cos(i * math.pi / points) * radius * (1 if i % 2 == 0 else .43)) for i in range(points * 2)]
    return prism(name, outline, center, .006, mat)


def duplicate(source, name, mat=None):
    obj = source.copy()
    obj.data = source.data.copy()
    bpy.context.scene.collection.objects.link(obj)
    return tag(obj, name, mat)


def fitted_ring(shirt, z, offset=.012):
    points = []
    for i in range(48):
        a = i * TAU / 48
        radial = Vector((math.cos(a), math.sin(a), 0))
        origin = radial * .29 + Vector((0,0,z))
        co = None
        # With lowered arms the first intersection can be a sleeve. Follow
        # the positive ray intersections to the torso, before crossing its axis.
        for attempt in range(12):
            hit, point, normal, index = shirt.ray_cast(origin, -radial)
            if not hit or point.dot(radial) < .035: break
            co = point.copy(); origin = point - radial*.0001
        if co is None:
            co = Vector((.175 * math.cos(a), .155 * math.sin(a) - .015, z))
        points.append(tuple(co + radial * offset))
    return points


def fitted_skirt(shirt, hem, rx, ry, cloth):
    """The upper edge follows the actual waist and sits INSIDE the belt.

    The previous independent ellipse projected beyond it as a second rim.
    Preserve the lower silhouette while blending from the real waist contour.
    """
    waist = [Vector(p) for p in fitted_ring(shirt, 1.035, -.001)]
    n = len(waist)
    heights = [hem, .92, .96, 1.00, 1.025, 1.04]
    rows = []
    for z in heights:
        contour = [Vector(p) for p in fitted_ring(shirt,z,-.001 if z>=1.03 else .004)] if z>=.96 else waist
        t = max(0,min(1,(1.025-z)/.105)); t = t*t*(3-2*t)
        lower_t = max(0,min(1,(.92-z)/max(.001,.92-hem)))
        row=[]
        for i, p in enumerate(contour):
            a=i*TAU/n
            lower = Vector((rx*(.94+.06*lower_t)*math.cos(a), -.020+.005*lower_t+ry*(.98+.02*lower_t)*math.sin(a), z))
            fitted=Vector((p.x,p.y,z))
            row.append(tuple(fitted.lerp(lower,t)))
        rows.append(row)
    obj=mesh('continuous waist-fitted tunic skirt',[p for row in rows for p in row],
             [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rows)-1) for i in range(n)],cloth)
    obj.modifiers.new('Inward cloth thickness','SOLIDIFY').thickness=.003
    obj['waist_top_inset_metres']=.007
    obj['waist_profile']='same anatomical contour as the belt'
    cloth_uv(obj)
    return obj


CONTOUR_CACHE = {}

def contour_point(shirt,z,a,offset=.009):
    key=(shirt.as_pointer(),z,offset)
    if key not in CONTOUR_CACHE: CONTOUR_CACHE[key]=fitted_ring(shirt,z,offset)
    ring_points=CONTOUR_CACHE[key]
    index=(a%TAU)/TAU*len(ring_points)
    base=int(index)
    return Vector(ring_points[base]).lerp(Vector(ring_points[(base+1)%len(ring_points)]),index-base)


def armour_panel(shirt,name,heights,start,end,mat,edge,offset=.016):
    n=44
    heights=[heights[0]+(heights[-1]-heights[0])*i/24 for i in range(25)]
    rows=[[contour_point(shirt,z,start+(end-start)*i/n,offset) for i in range(n+1)] for z in heights]
    obj=mesh(name,[tuple(p) for row in rows for p in row],
             [(j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i) for j in range(len(rows)-1) for i in range(n)],mat)
    obj.modifiers.new('Forged plate thickness','SOLIDIFY').thickness=.003
    outline=rows[0]+[r[-1] for r in rows[1:]]+list(reversed(rows[-1][:-1]))+[r[0] for r in reversed(rows[1:-1])]
    line(name+' rolled edge',[tuple(p) for p in outline],.0015,edge,True)
    obj['armour_construction']='anatomical fitted plate'
    return rows


def articulated_armour(shirt):
    """Separate breast panels, overlapping lames and fitted limb plates."""
    royal=item=='realm-sovereign'
    warrior=item=='story-keeper'
    plate=material(item+' / tempered plate', '#96866D' if warrior else '#8296A5' if not royal else '#83908E', .32, .78)
    edge=GOLD if royal else STEEL
    # Chest panels follow the existing shirt instead of enclosing it in a barrel.
    for side,start,end in [('left',math.pi+.15,1.5*math.pi-.014),('right',1.5*math.pi+.014,TAU-.15)]:
        armour_panel(shirt,side+' sculpted breast panel',[1.15,1.21,1.27,1.32,1.355],start,end,plate,edge)
        for z in [1.18,1.30]:
            p=contour_point(shirt,z,start+.08 if side=='left' else end-.08,.013)
            ell('flush cuirass rivet',p,(.0028,.0028,.0028),GOLD,12)
        a=1.5*math.pi+(-.37 if side=='left' else .37)
        path=[tuple(contour_point(shirt,z,a,.013)) for z in [1.19,1.24,1.29,1.33]]
        line('fine engraved breast flute',path,.0009,GOLD)
    armour_panel(shirt,'fitted back plate',[1.15,1.23,1.31,1.35],.20,math.pi-.20,plate,edge)
    for i in range(3):
        z=1.068+i*.034
        armour_panel(shirt,f'articulated abdominal lame {i+1}',[z,z+.027,z+.044],math.pi+.20,TAU-.20,plate,edge,.009+i*.0008)
    # Small heraldic escutcheon with inset enamel, never a floating block.
    front=contour_point(shirt,1.27,1.5*math.pi,.017)
    outline=[(-.026,.034),(.026,.034),(.024,-.011),(0,-.037),(-.024,-.011)]
    prism('heraldic shield surround',outline,front,.004,GOLD)
    prism('inlaid heraldic enamel',[(x*.76,z*.76) for x,z in outline],front+Vector((0,-.003,0)),.002,RED if royal else ENAMEL)
    line('engraved heraldic chevron',[(front.x-.013,front.y-.005,front.z+.008),(front.x,front.y-.005,front.z-.009),(front.x+.013,front.y-.005,front.z+.008)],.0012,IVORY)
    for side in ['left','right']:
        shoulder=anchor_position('shoulder_'+side); elbow=anchor_position('elbow_'+side)
        axis=(elbow-shoulder).normalized()
        forward=Vector((0,-1,0));forward=(forward-axis*forward.dot(axis)).normalized()
        outward=axis.cross(forward).normalized()
        if outward.x*(1 if side=='left' else -1)<0: outward=-outward
        # Three thin, overlapping shells follow the shoulder and upper arm.
        for layer in range(3):
            rows=[]
            for along,radius in [(0,.072-layer*.005),(.026,.076-layer*.005),(.052,.071-layer*.005)]:
                center=shoulder+axis*(.004+layer*.038+along)
                rows.append([center+forward*math.cos(a)*radius+outward*math.sin(a)*radius for a in [i*math.pi/20 for i in range(21)]])
            obj=mesh(f'{side} articulated shoulder lame {layer+1}',[tuple(p) for r in rows for p in r],
                     [(j*21+i,j*21+i+1,(j+1)*21+i+1,(j+1)*21+i) for j in range(2) for i in range(20)],plate)
            obj.modifiers.new('Shoulder plate thickness','SOLIDIFY').thickness=.0025
            obj['armour_construction']='articulated shoulder'
            line(side+' shoulder rolled rim',[tuple(p) for p in rows[-1]],.0017,edge)
            for p in [rows[1][2],rows[1][-3]]: ell('shoulder hinge rivet',p,(.003,.003,.003),GOLD,12)


def prepare():
    global slot, item, persona
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bases = {}
    for persona, gender in CHARACTERS.items():
        before = set(bpy.context.scene.objects)
        import_character(SOURCES / f'{gender}-medium.glb')
        imported = list(set(bpy.context.scene.objects)-before)
        shirts = []
        for obj in imported:
            if obj.type != 'MESH': continue
            matrix = obj.matrix_world.copy()
            obj.parent = None
            obj.data.transform(matrix); obj.matrix_world = Matrix.Identity(4)
        for obj in imported:
            if obj.type != 'MESH' or obj.get('cosmetic_slot') == 'hair' or obj.get('part') == 'hair':
                bpy.data.objects.remove(obj, do_unlink=True)
                continue
            part = obj.get('part')
            if STYLIZED:
                stylize_materials(obj)
                if swap_clean_skin_maps(obj, gender):
                    repair_skin_vertex_colours(obj)
            else:
                refine_source_materials(obj, gender)
            # Skin, eyelids and eyeballs share the same facial field, so the
            # refined eye and mouth openings keep matching their surfaces.
            if part in ['skin', 'eyes']:
                if STYLIZED:
                    stylize_face(obj, gender)
                else:
                    sculpt_head(obj, gender)
                    soften_face(obj, gender)
                    refine_eyelids(obj, gender)
            is_shirt = part == 'clothes' and 'shirt' in obj.name.lower()
            if STYLIZED and gender == 'girl' and (part == 'skin' or is_shirt):
                rebuild_torso(obj, garment=is_shirt)
            if is_shirt:
                shirts.append(obj); continue
            if part not in ['skin','eyes','clothes']:
                raise ValueError(f'Unclassified character source mesh: {obj.name}')
            slot, item = ('persona', persona) if part in ['skin','eyes'] else ('core','base')
            obj['reference_file'] = f'{gender}-medium.glb'
            obj['base_revision'] = CONTRACT['revision']
            if part == 'skin':
                # The welded body remains whole. Head framing uses only the
                # recorded head region, rather than the body's full bounds.
                pts = [C.to_3x3() @ v.co for v in obj.data.vertices if v.co.z >= anchor_position('neck').z]
                obj['head_bounds_min'] = [min(p[i] for p in pts) for i in range(3)]
                obj['head_bounds_max'] = [max(p[i] for p in pts) for i in range(3)]
                obj['reference_skin_triangles'] = sum(len(p.vertices)-2 for p in obj.data.polygons)
            tag(obj, obj.name)
        if len(shirts) != 1: raise ValueError(f'{gender}: expected one fitted shirt, got {len(shirts)}')
        bases[persona] = {'shirt': shirts[0], 'surfaces':[obj for obj in objects if obj.get('fit_persona')==persona and obj.get('part') in ['skin','clothes']]}
    persona = None
    bpy.context.scene['character_revision'] = CONTRACT['revision']
    bpy.context.scene['character_source_credit'] = CONTRACT['sourceCredit']
    return bases


def garments(shirt):
    global slot, item
    slot = 'outfit'
    for item, color in [('starter', '#536776'), ('vocab-ranger', '#38634D'), ('grammar-mage', '#604571'),
                        ('story-keeper', '#913E37'), ('honor-knight', '#375B80')]:
        cloth = material(f'{item} / woven cloth', color, .92)
        surface_maps(cloth, OUT/'textures/cloth-normal.png', OUT/'textures/cloth-roughness.png', .28)
        top = duplicate(shirt, 'fitted long-sleeve tunic', cloth)
        trim_under_belt(top)
        cloth_uv(top)
        hem = .83 if item in ['starter', 'vocab-ranger'] else .42 if item == 'grammar-mage' else .67
        # A close-cut tunic below the waist, not the previous rigid flared skirt.
        rx = .204 if persona == 'male' else .194
        ry = .169 if persona == 'male' else .160
        fitted_skirt(shirt,hem,rx,ry,cloth)
        ring('bound hem', 0, -.015, hem, rx, ry, .002, GOLD if item != 'starter' else LEATHER)
        belt_points = fitted_ring(shirt, 1.035, .006)
        lower = fitted_ring(shirt, 1.018, .006)
        upper = fitted_ring(shirt, 1.052, .006)
        n = len(lower)
        belt = mesh('flat fitted leather waist belt', lower+upper,
                    [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)], LEATHER)
        belt.modifiers.new('Leather band thickness','SOLIDIFY').thickness=.003
        line('belt upper stitching', upper, .00065, GOLD, True)
        if STYLIZED and persona == 'female':
            # Seat the buckle on the actual band midpoint, including its slope.
            # Its back embeds in the leather instead of hovering in front.
            lo, hi = Vector(lower[3*n//4]), Vector(upper[3*n//4])
            center = (lo+hi)*.5
            angle = math.atan2(-(hi.y-lo.y), hi.z-lo.z)
            normal = Vector((0,-math.cos(angle),-math.sin(angle)))
            buckle = box('belt buckle', center+normal*.001, (.044,.007,.035), GOLD,.0015)
            inset = box('buckle inset', center+normal*.004, (.030,.002,.023), LEATHER,.0007)
            buckle.rotation_euler.x = inset.rotation_euler.x = angle
        else:
            front = min(y for x, y, z in belt_points)
            box('belt buckle', (0, front - .007, 1.035), (.044, .009, .035), GOLD, .003)
            box('buckle inset', (0, front - .013, 1.035), (.030, .003, .023), LEATHER, .001)
        if item == 'starter':
            # The base outfit stays plain: no neckerchief, scarf or pendant.
            pass
        else:
            cape_mat = cloth if item == 'vocab-ranger' else CHARCOAL
            cape_hem = .73 if item == 'vocab-ranger' else .42
            rows = [(cape_hem, .30, .17, .105), (.80, .295, .185, .083), (1.12, .257, .166, .075), (1.37, .20, .13, .045), (1.438, .077, .078, .008)]
            cape = shell('draped travelling cape', rows, cape_mat, -.07, math.pi + .14, .008)
            for sign in [-1, 1]:
                line('cape edge', [(sign * rx, cy - .01, z) for z, rx, ry, cy in rows], .004, LEATHER)
                ell('cape clasp', (sign * .075, -.093, 1.408), (.015, .008, .015), GOLD)
            if item == 'grammar-mage':
                for sign in [-1, 1]:
                    line('robe front embroidery', [(sign * .048, -.143, 1.375), (sign * .073, -.186, 1.21), (sign * .070, -.197, 1.045), (sign * .095, -.196, .78), (sign * .12, -.184, hem + .018)], .005, GOLD)
                prism('arcane chest crystal', [(0, .04), (.025, 0), (0, -.04), (-.025, 0)], (0, -.192, 1.257), .018, GEM)
            if item in ['story-keeper', 'honor-knight']:
                articulated_armour(shirt)
    bpy.data.objects.remove(shirt, do_unlink=True)


def tress(name, control, widths, depths, mat, detail=False):
    """Sculpted ribbon-like lock, smooth along its length and tapered at its tip."""
    control = [Vector(point) for point in control]
    if slot == 'hair': depths = [depth*.58 for depth in depths]
    centers, ws, ds = [], [], []
    for j in range(len(control) - 1):
        p0, p1 = control[max(0, j - 1)], control[j]
        p2, p3 = control[j + 1], control[min(j + 2, len(control) - 1)]
        for k in range(7):
            t = k / 7
            centers.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t*t + (-p0 + 3 * p1 - 3 * p2 + p3) * t*t*t))
            ws.append(widths[j] * (1-t) + widths[j+1] * t)
            ds.append(depths[j] * (1-t) + depths[j+1] * t)
    centers.append(control[-1]); ws.append(widths[-1]); ds.append(depths[-1])
    vertices, ridges = [], [[], [], [], [], []]
    n = 12
    for j, center in enumerate(centers):
        tangent = (centers[min(j+1, len(centers)-1)] - centers[max(0, j-1)]).normalized()
        side = tangent.cross(Vector((0, -1, 0)))
        if side.length < .01: side = Vector((1, 0, 0))
        side.normalize(); depth = tangent.cross(side).normalized()
        if depth.y > 0: depth = -depth
        for i in range(n):
            a = i * TAU / n
            vertices.append(center + side * math.cos(a) * ws[j] + depth * math.sin(a) * ds[j])
        for r,(ridge, fraction) in enumerate(zip(ridges, [-.66,-.35,-.08,.26,.57])):
            offset=fraction+.035*math.sin(j*.29+r*1.7)
            ridge.append(center + side * ws[j] * offset + depth * ds[j] * math.sqrt(max(.1,1-offset*offset)))
    faces = [tuple(reversed(range(n)))]
    faces += [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i) for j in range(len(centers)-1) for i in range(n)]
    faces.append(tuple((len(centers)-1)*n+i for i in range(n)))
    result = mesh(name, vertices, faces, mat)
    grid_uv(result,n,len(centers))
    if detail:
        for i, points in enumerate(ridges):
            line(name + ' / fine strand ' + str(i), [tuple(p) for p in points[3+i%3:-4:3]], .00022, HAIR_LIGHT if i%3 else HAIR_DARK)
    return result


def scalp_point(a, theta, afro=False):
    rx, ry, rz = (.156, .171, .171) if afro else (.115, .151, .151)
    zc = 1.65 if afro else HEAD_FIT['hair_center_z']
    direction = Vector((math.sin(theta)*math.cos(a), math.sin(theta)*math.sin(a), math.cos(theta)))
    ripple = .009*noise.noise_vector(direction*13).x + .0035*noise.noise_vector(direction*37).y if afro else 0
    return Vector(((rx+ripple) * math.sin(theta) * math.cos(a),
                   HEAD_FIT['center_y'] + (ry+ripple) * math.sin(theta) * math.sin(a),
                   zc + (rz+ripple) * math.cos(theta)))


def scalp(afro=False):
    n, rows = (128, 64) if afro else (64, 24)
    vertices = []
    for j in range(rows):
        for i in range(n):
            a = i * TAU / n
            # Follow forehead and temples, covering the baked root patch but
            # leaving eyebrows and the silhouette of both ears visible.
            end = (1.89 + .28*math.sin(a)) if afro else (1.69 + .28*math.sin(a))
            if afro: end += .023*math.sin(a*13)+.015*math.cos(a*21)
            else: end += .009*math.sin(a*23)+.006*math.sin(a*43+.7)
            theta = .002 + (end - .002) * j / (rows-1)
            vertices.append(scalp_point(a, theta, afro))
    obj = mesh('sculpted afro silhouette' if afro else 'fitted continuous hairline', vertices,
          [(j*n+i, (j+1)*n+i, (j+1)*n+(i+1)%n, j*n+(i+1)%n) for j in range(rows-1) for i in range(n)], HAIR)
    grid_uv(obj,n,rows)
    if not afro:
        for i in range(18):
            a=i*TAU/18+.04*math.sin(i*2.1)
            end=1.67+.28*math.sin(a)
            points=[tuple(scalp_point(a+.07*math.sin(j*.24+i),.16+(end-.18)*j/20)+Vector((0,0,.0005))) for j in range(21)]
            line('separate crown fibre '+str(i),points,.00024,HAIR_LIGHT if i%3 else HAIR_DARK)


def parted_fringe(short=False):
    # Side part with overlapping, finely tapered layers; no thick forehead slab.
    for i in range(6):
        u = i/5
        tress('combed side-part layer', [(.044-u*.014,.012+u*.009,1.767-u*.007),
              (.022-u*.036,-.089,1.755-u*.006),(-.040-u*.049,-.145+u*.012,1.690-u*.018),
              (-.087-u*.015,-.106+u*.013,1.630-u*.010)],
              [.010,.019,.018,.0006],[.004,.008,.006,.0004], HAIR, True)
    for i in range(3):
        tress('light right temple sweep', [(.050+i*.006,.005,1.764-i*.006),(.088+i*.006,-.070,1.733-i*.008),
              (.109,-.097+i*.010,1.674-i*.017),(.104,-.068+i*.012,1.617-i*.008)],
              [.008,.016,.013,.0005],[.004,.007,.006,.0004], HAIR, True)
    if short:
        for sign in [-1, 1]:
            tress('tapered temple', [(sign*.101, -.032, 1.688), (sign*.113, -.068, 1.629), (sign*.104, -.058, 1.575)],
                  [.019, .016, .001], [.009, .007, .001], HAIR, True)


def swap_clean_skin_maps(obj, gender):
    """Stylized keeps the delivered art but swaps in the speck-free palettes."""
    touched = False
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes: continue
        key = mat.get('base_skin_map')
        if not key: continue
        shader = mat.node_tree.nodes.get('Principled BSDF')
        if not shader: continue
        filename = f'head-{gender}-medium.png' if key == 'head' else 'skin-medium.png'
        stem = filename[:-4]
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image and stem in node.image.name:
                node.image = bpy.data.images.load(str(REFINED / filename), check_existing=False)
                node.image.name = f'clean / {filename}'
                mat['clean_skin_before'] = filename
                touched = True
        if not touched:
            print('SKIN_SWAP_MISS', obj.name[:30], mat.name[:26], flush=True)
        mat['clean_skin_revision'] = 'characters-refit-v1-clean'
    return touched


def repair_skin_vertex_colours(obj):
    """Stray black corners on the delivered skin read as dotted scars."""
    fixed = 0
    for layer in obj.data.color_attributes:
        for entry in layer.data:
            if sum(entry.color[:3])/3 < .5:
                entry.color = (1.0, 1.0, 1.0, entry.color[3]); fixed += 1
    if fixed: print('VCOL_REPAIR', obj.name[:34], fixed, flush=True)


def complete_back_hair(hair):
    """A fitted, combed underlayer behind the approved outer locks.

    The supplied cut leaves the occiput exposed at the nape. This smooth
    underlayer closes it while every validated outer strand keeps its place.
    """
    vertices, faces = [], []
    cols, rows = 64, 30
    for j in range(rows):
        theta = .92 + (2.23-.92)*j/(rows-1)
        for i in range(cols+1):
            a = math.pi*i/cols
            ripple = .0009*math.sin(a*44 + theta*3)
            # Keep the side edge inside the scalp, under the supplied locks.
            # The old .118 side radius exposed a rectangular plate at the ear.
            vertices.append(((.095+ripple)*math.sin(theta)*math.cos(a),
                             -.012+(.128+ripple)*math.sin(theta)*math.sin(a),
                             1.625+.147*math.cos(theta)))
    for j in range(rows-1):
        for i in range(cols):
            p = j*(cols+1)+i
            faces.append((p, p+cols+1, p+cols+2, p+1))
    material_node = hair.data.materials[0] if hair.data.materials else None
    cap = mesh('filled posterior hair', vertices, faces, material_node)
    if hair.get('template_persona'): cap['template_persona'] = hair['template_persona']
    cap['hair_repair'] = 'Fitted underlayer closes the exposed occiput without changing approved outer locks'
    return cap


def hairstyles(source):
    global slot, item
    for pieces in source.values():
        for obj in pieces: bpy.data.objects.remove(obj, do_unlink=True)
    slot = 'hair'
    # Only the authored-in-Blender families are sculpted here. Short and Long
    # come from the delivered cuts below, so both characters share one styling.
    for item in [name for name in HAIR_ITEMS if name in SCULPTED_HAIR]:
        scalp(item == 'curly')
        if item == 'curly':
            # Continuous fine irregular curl volume, without repeated stamped
            # spirals or disconnected spheres on the surface.
            continue
        parted_fringe(item == 'short')
        if item == 'short': continue
        if item in ['long', 'royal-hair']:
            royal = item == 'royal-hair'
            # Layered back curtain fans gently across the shoulders.
            for i in range(7):
                a = .18 + (math.pi-.36)*i/6
                x, y = .104*math.cos(a), HEAD_FIT['center_y'] + .128*math.sin(a)
                tress('layered back lengths', [(x*.83, y*.78, 1.722), (x*1.10, y*1.10, 1.60),
                      (x*1.27, y*1.12+.012, 1.455), (x*1.19, y*1.08+.035, 1.33),
                      (x*.93, y*1.03+.043, (1.25 if not royal else 1.20)+.035*math.sin(i*1.7))],
                      [.018,.031,.030,.020,.001], [.011,.017,.013,.008,.001], HAIR, True)
            for sign in [-1, 1]:
                for k in range(2 if not royal else 3):
                    phase = k*.014
                    points = [(sign*(.090+phase),-.072+phase,1.681),
                              (sign*(.118+phase),-.101+phase,1.555),
                              (sign*(.126 if royal else .142)+sign*phase,-.076+phase,1.44),
                              (sign*(.158 if royal else .121),-.020+phase,1.33),
                              (sign*(.100 if royal else .081),.035+phase,(1.20 if royal else 1.28)+k*.019)]
                    tress('flowing face-framing lock', points, [.019,.025,.026,.017,.001], [.008,.011,.011,.007,.001], HAIR, True)
                if royal:
                    tress('swept royal side braid', [(sign*.047, .082, 1.751), (sign*.112, .106, 1.683), (sign*.132, .046, 1.614)],
                          [.015, .018, .004], [.008, .012, .003], HAIR, True)
                    ell('small royal hair jewel', (sign*.131, -.089, 1.574), (.009, .005, .013), GEM, 12)
        else:
            for sign in [-1, 1]:
                tress('gathered hair behind ear', [(sign*.078, .083, 1.722), (sign*.118, .104, 1.621), (sign*.122, .073, 1.539)],
                      [.028, .034, .019], [.015, .020, .010], HAIR, True)
                for strand in range(3):
                    pts = []
                    for j in range(49):
                        t = j/48
                        phase = t*TAU*5 + strand*TAU/3
                        taper = 1-.34*t
                        pts.append((sign*(.122+.013*math.sin(phase)*taper), .064+.010*math.cos(phase)*taper, 1.554-.305*t))
                    line('continuous interwoven braid', pts, .0085, HAIR if strand != 1 else HAIR_DARK)
                ring('slim braid tie', sign*.122, .064, 1.248, .015, .015, .003, GOLD)
                tress('tapered braid end', [(sign*.122, .064, 1.248), (sign*.123, .064, 1.222), (sign*.115, .067, 1.203)],
                      [.012, .015, .001], [.009, .009, .001], HAIR)
    bpy.context.view_layer.update()
    # The delivered cuts are shared by both personas: no `template_persona`, so
    # `fit_equipment` fits the same Long (girl source) and Short (boy source) to
    # each head through that character's hat-seat transform. A boy wearing Long
    # gets the girl's default cut adapted to his head, and vice versa.
    use_supplied_hair = os.environ.get('HAIR_SUPPLIED', '1') != '0'
    supplied = [entry for entry in SUPPLIED_HAIR if entry[1] in HAIR_ITEMS] if use_supplied_hair else []
    # A cut sculpted around the ear comes in one version per ear shape: the
    # `-human-ear` file is grown around the default human ear (`ear_fit`).
    variants = []
    for gender, hair_id in supplied:
        variants.append((gender, hair_id, 'elf' if (HAIR_REFIT / f'{gender}-human-ear.glb').exists() else None))
        if variants[-1][2]:
            variants.append((f'{gender}-human-ear', hair_id, 'human'))
    for gender, hair_id, ear_fit in variants:
        item = hair_id
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(HAIR_REFIT / f'{gender}.glb'))
        imported = list(set(bpy.context.scene.objects) - before)
        if ear_fit:
            for obj in imported:
                obj['ear_fit'] = ear_fit
        # The delivered cuts wear the app hair material: the shared normal and
        # roughness maps keep the strands readable, and the viewer recolours
        # every 'Hair /' material from the shop palette.
        hair_material = HAIR_SHADED if hair_id in SHADED_HAIR else HAIR
        for obj in imported:
            if obj.type != 'MESH': continue
            matrix = obj.matrix_world.copy()
            obj.parent = None
            obj.data.transform(matrix)
            obj.matrix_world = Matrix.Identity(4)
            if hair_id in SHADED_HAIR:
                # The importer names COLOR_0 'Color'; the shaded material reads it.
                obj.data.color_attributes[0].name = 'HairShade'
            # The Bun's pin is jewellery, not hair: it keeps its gold whatever
            # hair colour the shop applies.
            tag(obj, f'{gender} / supplied hairstyle', GOLD if 'hair pin' in obj.name else hair_material)
        for obj in imported:
            if obj.type != 'MESH': bpy.data.objects.remove(obj, do_unlink=True)
    # Close the exposed occiput behind the approved outer locks with a fitted,
    # combed underlayer. The validated outer strands stay untouched.
    if use_supplied_hair and 'long' in HAIR_ITEMS:
        slot, item = 'hair', 'long'
        complete_back_hair(next(obj for obj in objects if obj.get('shop_slot') == 'hair'
                                and obj.get('shop_id') == 'long'))
    bpy.context.view_layer.update()
    # Hats compress and cover the crown; open crowns preserve the coiffure.
    for original in [o for o in objects if o.get('shop_slot') == 'hair']:
        item = original['shop_id']
        if original.type != 'MESH':
            bpy.ops.object.select_all(action='DESELECT'); original.select_set(True)
            bpy.context.view_layer.objects.active = original; bpy.ops.object.convert(target='MESH')
        original['hat_fit'] = 'open'
        crowned = duplicate(original, original.name + ' / fitted crown')
        crowned['hat_fit'] = 'crowned'
        matrix, inverse = crowned.matrix_world.copy(), crowned.matrix_world.inverted()
        for v in crowned.data.vertices:
            co = matrix @ v.co
            # The ported cuts keep their locks: only the crown volume tucks in
            # under the band. Squeezing the whole head used to pull the fringe
            # through the forehead, which is exactly the clipping we measure.
            # The ported cuts (Braid, Bun) only tuck from the band up, so the
            # Bun's chignon, entirely below 1.69 m, stays whole under a crown.
            ported = item in ('curly', 'bun')
            entry = max(0, min(1, (co.z-(1.712 if ported else 1.650))/(.020 if ported else .029)))
            exit = max(0, min(1, (1.831-co.z)/.031))
            weight = (entry*entry*(3-2*entry)) * (exit*exit*(3-2*exit))
            radial = math.hypot(co.x/.108, (co.y-HEAD_FIT['center_y'])/.132)
            if radial > 1:
                scale = 1+(1/radial-1)*weight
                co.x *= scale
                co.y = HEAD_FIT['center_y']+(co.y-HEAD_FIT['center_y'])*scale
            v.co = inverse @ co
        crowned.data.update()
        clipped = duplicate(original, original.name + ' / beneath hat')
        clipped['hat_fit'] = 'covered'
        bm = bmesh.new(); bm.from_mesh(clipped.data); bm.transform(clipped.matrix_world)
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                              plane_co=(0,0,HEAD_FIT['under_hat_z']), plane_no=(0,0,1), clear_outer=True, dist=.00001)
        bm.transform(clipped.matrix_world.inverted()); bm.to_mesh(clipped.data); bm.free()


def hat_brim(name, outer_x, outer_y, mat, wave=.007):
    """Real annular brim with a head-sized opening, not a flattened solid ball."""
    vertices = []
    n, rows = 64, 5
    for j in range(rows):
        t = j/(rows-1)
        rx = HEAD_FIT['hat_inner_x']*(1-t) + outer_x*t
        ry = HEAD_FIT['hat_inner_y']*(1-t) + outer_y*t
        for i in range(n):
            a = i*TAU/n
            vertices.append((rx*math.cos(a), HEAD_FIT['center_y']+ry*math.sin(a),
                             HEAD_FIT['hat_seat_z'] + t*t*(wave*math.sin(2*a+.5)-.003)))
    obj = mesh(name, vertices, [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i) for j in range(rows-1) for i in range(n)], mat)
    solid = obj.modifiers.new('Bound fabric brim thickness', 'SOLIDIFY'); solid.thickness = .005
    line('fine bound brim edge', vertices[-n:], .0025, mat, True)
    return obj


def hats():
    global slot, item
    slot = 'hat'
    item = 'explorer-cap'
    ring('leather goggle strap', 0, -.019, 1.709, .106, .13, .008, LEATHER)
    for sign in [-1, 1]:
        ell('brass goggle frame', (sign * .057, -.157, 1.709), (.048, .025, .038), GOLD)
        ell('blue glass lens', (sign * .057, -.179, 1.709), (.035, .008, .027), GEM)
    line('goggle bridge', [(-.016, -.177, 1.709), (0, -.185, 1.711), (.016, -.177, 1.709)], .006, LEATHER)
    item = 'sunglasses'
    for sign in [-1, 1]:
        box('black glasses frame', (sign * .050, -.149, 1.593), (.085, .014, .047), CHARCOAL, .014)
        box('dark tinted lens', (sign * .050, -.159, 1.595), (.068, .007, .032), GLASS, .009)
        line('glasses temple arm', [(sign * .092, -.144, 1.60), (sign * .111, -.08, 1.603), (sign * .116, .015, 1.585)], .005, CHARCOAL)
    line('glasses bridge', [(-.011, -.156, 1.60), (0, -.163, 1.603), (.011, -.156, 1.60)], .005, CHARCOAL)
    item = 'feather-beret'
    shell('fitted beret opening', [(1.690,.118,.143,-.012),(1.717,.119,.145,-.012)], LEATHER)
    beret = ell('soft angled beret crown', (-.030, -.003, 1.742), (.158, .155, .060), SAGE)
    beret.rotation_euler.y = -.10
    line('beret radial seam', [(-.151,-.012,1.744),(-.101,-.013,1.790),(-.032,-.013,1.805),(.065,-.013,1.767)], .0018, SAGE)
    tress('tapered ivory feather', [(-.118,-.097,1.736),(-.155,-.083,1.79),(-.169,-.064,1.847)], [.002,.014,.001],[.002,.004,.001], IVORY)
    ell('small beret pin', (-.119,-.110,1.726), (.011,.005,.011), GOLD)
    item = 'wizard-hat'
    hat_brim('shaped wizard brim', .217, .188, PURPLE)
    shell('curved cloth wizard crown', [(1.688,.118,.143,-.012),(1.735,.120,.144,-.01),(1.83,.099,.112,.003),
          (1.94,.061,.073,.013),(2.02,.030,.039,-.005),(2.046,.013,.018,-.039),(2.034,.002,.003,-.078)], PURPLE)
    shell('flat golden hat ribbon', [(1.705,.121,.146,-.012),(1.730,.123,.147,-.010)], GOLD, thickness=.002)
    prism('small hat crystal', [(0,.015),(.011,0),(0,-.015),(-.011,0)], (0,-.163,1.718), .009, GEM)
    item = 'classy-hat'
    hat_brim('tailored top hat brim', .181, .171, CHARCOAL, .004)
    shell('tailored top hat crown', [(1.690,.119,.144,-.012),(1.735,.121,.145,-.012),
          (1.928,.128,.142,-.009),(1.937,.122,.137,-.009),(1.937,.002,.002,-.009)], CHARCOAL)
    shell('burgundy silk ribbon', [(1.705,.124,.148,-.012),(1.742,.124,.148,-.012)], RED, thickness=.002)
    for item, high in [('gold-crown', False), ('celestial-crown', True)]:
        ring('fitted gold crown base', 0, -.012, 1.699, .119, .146, .005, GOLD)
        n = 48
        vertices = []
        for j in range(2):
            for i in range(n):
                a = i * TAU / n
                z = 1.699 if j == 0 else 1.737 + (.050 if high else .030) * (1 if i % 8 == 0 else 0)
                vertices.append((.121 * math.cos(a), -.012 + .148 * math.sin(a), z))
        crown = mesh('eight-point crown', vertices, [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)], GOLD, False)
        solid = crown.modifiers.new('Solid gold wall', 'SOLIDIFY'); solid.thickness = .009
        for i in range(8):
            a = i * TAU / 8
            ell('crown gemstone', (.125 * math.cos(a), -.012 + .152 * math.sin(a), 1.721), (.010, .010, .014), GEM if high else RED, 12)
        if high:
            for sign in [-1, 1]:
                line('arched royal band', [(sign*.119,-.012,1.754),(sign*.076,-.012,1.850),(0,-.012,1.892)], .006, GOLD)
            ell('royal top crystal', (0,-.012,1.912), (.017,.017,.025), GEM, 12)
    item = 'steel-helm'
    shell('rounded helmet dome', [(1.646, .134, .154, .005), (1.745, .137, .15, .005), (1.811, .098, .109, .005), (1.839, .002, .002, .005)], STEEL, thickness=.01)
    ring('helmet brow rim', 0, .005, 1.653, .137, .157, .009, GOLD)
    for sign in [-1, 1]:
        ell('temple plate', (sign * .131, .017, 1.60), (.023, .099, .075), STEEL)
        line('ivory helmet horn', [(sign * .119, .01, 1.777), (sign * .208, .01, 1.834), (sign * .245, .03, 1.934)], .023, IVORY)
    box('narrow nose guard', (0, -.168, 1.627), (.016, .014, .078), STEEL, .005)


def sword(x, y, z, length=.61, name='sword'):
    line(name + ' leather grip', [(x,y,z-.065),(x,y,z+.065)], .011, LEATHER)
    for j in range(6): ring(name + ' grip binding', x, y, z - .055 + j * .021, .0115, .0115, .0012, GOLD)
    ell(name + ' pommel', (x, y, z - .083), (.026, .023, .026), GOLD)
    prism(name + ' curved crossguard', [(-.101, -.017), (-.098, .012), (-.035, .027), (0, .009), (.035, .027), (.098, .012), (.101, -.017), (.035, -.007), (0, -.014), (-.035, -.007)], (x, y, z + .082), .028, GOLD)
    start = z + .095
    width = .037 if length > .4 else .025
    vertices = [(x - width, y, start), (x, y - .014, start), (x + width, y, start), (x, y + .014, start), (x - width * .7, y, start + length * .73), (x, y - .012, start + length * .73), (x + width * .7, y, start + length * .73), (x, y + .012, start + length * .73), (x, y, start + length)]
    mesh(name + ' faceted steel blade', vertices, [(i, (i + 1) % 4, (i + 1) % 4 + 4, i + 4) for i in range(4)] + [(i + 4, (i + 1) % 4 + 4, 8) for i in range(4)], STEEL, False)


def shield(x, y, z, royal=False):
    outline = [(-.145, .19), (0, .213), (.145, .19), (.146, .005), (.097, -.14), (0, -.218), (-.097, -.14), (-.146, .005)]
    prism('shield metal rim', outline, (x, y, z), .045, GOLD if royal else STEEL)
    prism('blue shield enamel', [(a * .88, b * .9) for a, b in outline], (x, y - .029, z), .022, ENAMEL)
    star('shield raised star', (x, y - .048, z), .09, GOLD)
    for dx, dz in [(-.12, .163), (.12, .163), (-.10, -.05), (.10, -.05)]: ell('shield rivet', (x + dx, y - .044, z + dz), (.009, .006, .009), GOLD)
    box('shield wrist bracket', (x, y + .064, z), (.032, .11, .081), LEATHER)


def mounted(start, name, source_origin, kind):
    for obj in objects[start:]:
        obj['mount_anchor'] = name
        obj['mount_source_origin'] = list(source_origin)
        obj['mount_kind'] = kind


def weapons():
    global slot, item
    slot = 'weapon'
    item = 'star-shield'; start = len(objects); shield(-.575, -.115, .982)
    mounted(start, 'wrist_left', (-.575,-.004,.982), 'shield')
    item = 'pencil-sword'; start = len(objects); sword(.582, -.023, .886)
    mounted(start, 'grip_right', (.582,-.023,.886), 'blade')
    item = 'dual-daggers'
    for sign, side in [(-1,'left'),(1,'right')]:
        start = len(objects); sword(sign*.582, -.023, .886, .28, 'dagger')
        mounted(start, 'grip_'+side, (sign*.582,-.023,.886), 'blade')
    item = 'swords-and-shield'; start = len(objects); shield(-.575, -.115, .982, True)
    mounted(start, 'wrist_left', (-.575,-.004,.982), 'shield')
    start = len(objects); sword(.582, -.023, .886, .66, 'royal sword')
    mounted(start, 'grip_right', (.582,-.023,.886), 'blade')
    before = len(objects); sword(0, .252, 1.38, .56, 'back sword')
    # The second sword rests diagonally outside the cloak.
    bpy.context.view_layer.update()
    transform = Matrix.Translation((.11, .252, 1.30)) @ Matrix.Rotation(math.radians(155), 4, 'Y') @ Matrix.Translation((0, -.252, -1.38))
    for obj in objects[before:]: obj.matrix_world = transform @ obj.matrix_world
    mounted(before, 'back', (0,.135,1.19), 'back')
    item = 'lore-lantern'
    start = len(objects)
    x, y = .582, -.023
    line('lantern carrying handle', [(x - .039, y, .79), (x - .037, y, .855), (x, y, .886), (x + .037, y, .855), (x + .039, y, .79)], .0045, GOLD)
    box('lantern glowing panes', (x, y, .7), (.078, .076, .151), AMBER)
    for z in [.612, .787]: box('lantern brass cap', (x, y, z), (.119, .112, .024), GOLD)
    for dx in [-.046, .046]:
        for dy in [-.043, .043]: line('lantern corner post', [(x + dx, y + dy, .622), (x + dx, y + dy, .779)], .0045, GOLD)
    ell('lantern vent', (x, y, .811), (.024, .022, .026), GOLD)
    mounted(start, 'grip_right', (.582,-.023,.886), 'lantern')
    item = 'spell-grimoire'
    start = len(objects)
    x, y, z = .591, -.042, .89
    box('parchment pages', (x, y, z), (.145, .032, .206), IVORY)
    for dy in [-.022, .022]: box('leather book cover', (x, y+dy, z), (.165, .009, .226), PURPLE)
    box('rounded book spine', (x-.074, y, z), (.025, .053, .226), LEATHER)
    for dz in [-.073,.073]: box('gold spine band', (x-.081,y,z+dz), (.013,.058,.015), GOLD)
    star('book cover sigil', (x,y-.031,z), .048, GOLD, 4)
    for dz in [-.073,.073]: line('page layers', [(x-.048,y-.019,z+dz),(x+.069,y-.019,z+dz)], .0015, LEATHER)
    mounted(start, 'grip_right', (.582,-.023,.886), 'book')
    item = 'word-wand'
    start = len(objects)
    line('wooden staff', [(.582, -.023, .74), (.582, -.023, 1.44)], .011, LEATHER)
    for z in [.79, .93, 1.405]: ring('staff metal band', .582, -.023, z, .017, .017, .005, GOLD)
    for sign in [-1, 1]: line('crystal cradle', [(.582, -.023, 1.435), (.582 + sign * .068, -.023, 1.518), (.582 + sign * .052, -.023, 1.582)], .009, GOLD)
    prism('wand crystal', [(0, .101), (.043, 0), (0, -.093), (-.043, 0)], (.582, -.023, 1.539), .052, GEM)
    mounted(start, 'grip_right', (.582,-.023,.886), 'wand')


def hand_mount(name, kind):
    """Mount orientation relative to the delivered anatomical anchor frame."""
    frame = anchor_matrix(name)
    position = frame.translation.copy()
    if kind in ['blade','back']:
        # The hand +Y axis points toward the relaxed fingers: blades point
        # down naturally and their guard follows the knuckle-row axis.
        return frame
    if kind == 'book':
        # Offset the book's edge into the palm rather than its thick centre.
        return frame @ Matrix.Translation((.045,0,0))
    side = 1 if name.endswith('left') else -1
    if kind == 'shield':
        elbow = anchor_position('elbow_left')
        up = (elbow-position).normalized()
        position = position.lerp(elbow, .30)
        outward = Vector((side,0,0))
        outward = (outward-up*up.dot(outward)).normalized()
    else:
        # Clear the thighs/upper arms while retaining the exact grip centre.
        up = Vector((side*(.20 if kind == 'wand' else -.20),0,.98)).normalized()
        outward = Vector((0,-1,0))
    right = up.cross(outward).normalized()
    outward = right.cross(up).normalized()
    # Authored item axes in Blender are +X right, +Z up, -Y front.
    basis = Matrix((right, -outward, up)).transposed().to_4x4()
    basis.translation = position
    return basis


def fit_equipment():
    global slot, item, persona
    bpy.context.view_layer.update()
    templates = [obj for obj in objects if obj.get('shop_slot') in ['hair','hat','weapon']]
    for persona, gender in CHARACTERS.items():
        seat = CONTRACT['characters'][gender]['anchors']['hat_seat']
        scale = Vector(((seat['ellipse']['rx']+.008)/HEAD_FIT['hat_inner_x'],
                        (seat['ellipse']['rz']+.018)/HEAD_FIT['hat_inner_y'], 1))
        head_matrix = anchor_matrix('hat_seat') @ Matrix.Translation((0,0,.012)) @ Matrix.Diagonal((*scale,1)) @ Matrix.Translation((0,-HEAD_FIT['center_y'],-HEAD_FIT['hat_seat_z']))
        HEAD_FITS[persona] = {'anchor': seat['world'], 'clearance': [0,.012,0],
                             'templateToCharacter': column_major(C @ head_matrix @ C.inverted())}
        for original in templates:
            if original.get('template_persona', persona) != persona:
                continue
            slot, item = original['shop_slot'], original['shop_id']
            fitted = duplicate(original, gender+' / '+original.name)
            if slot in ['hair','hat']:
                transform, name = head_matrix, 'hat_seat'
            else:
                name = original['mount_anchor']
                transform = hand_mount(name, original['mount_kind']) @ Matrix.Translation(-Vector(original['mount_source_origin']))
            fitted.matrix_world = transform @ original.matrix_world
            reference = anchor(name)
            fitted['attachment'] = name
            fitted['attachment_origin'] = reference['position']
            fitted['attachment_quaternion'] = reference['quaternion']
            fitted['attachment_axes'] = 'glTF: +Y up, +Z front, metres; anatomical left/right'
            fitted['template_to_character'] = column_major(C @ transform @ C.inverted())
            fitted['base_revision'] = CONTRACT['revision']
        bpy.context.view_layer.update()
    for original in templates:
        objects.remove(original); bpy.data.objects.remove(original, do_unlink=True)
    persona = None


SKULL_TREES = {}


def conform_hair_to_head(hair, skin, clearance=.002, floor_z=1.50, max_distance=.09):
    """Lift the strands that would sit inside that character's own head.

    A delivered cut is authored once, then fitted to Noa and Mila by the
    hat-seat transform. The two heads differ, so a strand that clears Mila's
    brow can still be buried in Noa's temple. Measuring the signed distance to
    each character's skin gives every head its own correction instead of one
    approximate global fit, and guarantees a visible hairline everywhere.
    """
    tree = SKULL_TREES.get(skin.name)
    if tree is None:
        # The ears are loose shells worn in several shapes (human by default,
        # elf or pierced as accessories), so hair is fitted to the skull
        # alone: it lies under whichever ear is worn, with one contour for
        # all of them, instead of wrapping the pointed elf ear.
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = skin.evaluated_get(depsgraph)
        bm = bmesh.new(); bm.from_mesh(evaluated.to_mesh()); bm.transform(skin.matrix_world)
        evaluated.to_mesh_clear()
        ears = {v.index for shells in ear_islands(bm).values() for shell in shells for v in shell}
        tree = SKULL_TREES[skin.name] = skull_tree(bm, ears)
        bm.free()
    hair_matrix = hair.matrix_world
    inverse = hair_matrix.inverted()
    # Cuts tucked behind the ear by clear_ear_space keep those locks inside
    # the skull: lifting them would press them flat on the skull, where the
    # smaller human ear no longer hides them. Only the contour's shoulder is
    # lifted; the skull under the ear is capped, so the tucked locks vanish.
    tucked = hair.get('ear_clearance_vertices') is not None
    weight = HUMAN_EAR_WEIGHT.get(skin.name) if hair.get('ear_fit') == 'human' else ear_weight
    lifted = 0
    for vertex in hair.data.vertices:
        world = hair_matrix @ vertex.co
        if world.z < floor_z: continue
        if (tucked and abs(world.x) > .06 and -.05 < world.y < .075 and 1.50 < world.z < 1.635
                and weight(world.y, world.z) > .5):
            continue
        location, normal, _index, _distance = tree.find_nearest(world, max_distance)
        if location is None: continue
        if (world - location).dot(normal) < clearance:
            vertex.co = inverse @ (location + normal * clearance)
            lifted += 1
    hair.data.update()
    return lifted


def refine_seat_silhouette(selected):
    """Reduce the posterior hip volume slightly, including every fitted outfit.

    Apply once to evaluated meshes, after tailoring. The smooth field leaves
    the waist anchors, front pelvis, legs and arms unchanged.
    """
    for obj in selected:
        if obj.type != 'MESH' or obj.get('shop_slot') not in ['core','persona','outfit']:
            continue
        matrix=obj.matrix_world.copy();inverse=matrix.inverted()
        for vertex in obj.data.vertices:
            p=matrix @ vertex.co
            if not (.68<p.z<1.025 and p.y>0 and abs(p.x)<.24):
                continue
            height=math.sin(math.pi*(p.z-.68)/.345)**2
            rear=min(1,p.y/.08);rear=rear*rear*(3-2*rear)
            side=min(1,(.24-abs(p.x))/.05);side=side*side*(3-2*side)
            weight=height*rear*side
            p.y*=1-.18*weight
            p.x*=1-.035*weight
            vertex.co=inverse @ p
        obj.data.update()


def torus(name, center, u, v, radius, wire, mat, segments=28, sides=10):
    """Closed ring of the circle center + radius*(cos t*u + sin t*v)."""
    w = u.cross(v).normalized()
    vertices = []
    for i in range(segments):
        t = TAU * i / segments
        axis = u * math.cos(t) + v * math.sin(t)
        for j in range(sides):
            s = TAU * j / sides
            vertices.append(tuple(center + axis * (radius + wire * math.cos(s)) + w * (wire * math.sin(s))))
    faces = [(i * sides + j, i * sides + (j + 1) % sides,
              ((i + 1) % segments) * sides + (j + 1) % sides, ((i + 1) % segments) * sides + j)
             for i in range(segments) for j in range(sides)]
    return mesh(name, vertices, faces, mat)


def bead(name, center, radius, mat):
    data = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=8, radius=radius)
    bmesh.ops.translate(bm, verts=bm.verts, vec=center)
    bm.to_mesh(data); bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    for polygon in data.polygons: polygon.use_smooth = True
    return tag(obj, name, mat)


def ear_copy(skin, name, ear_ids, positions=None):
    """Copy of the skin keeping only the ear shells (materials, UVs, colours).

    `positions` (vertex index -> world position) reshapes the copy; its
    normals are then recomputed, shell by shell, from the new surface.
    """
    obj = skin.copy()
    obj.data = skin.data.copy()
    bpy.context.scene.collection.objects.link(obj)
    for key in ['head_bounds_min', 'head_bounds_max', 'reference_skin_triangles']:
        if key in obj: del obj[key]
    inverse = obj.matrix_world.inverted()
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
    for index, position in (positions or {}).items():
        bm.verts[index].co = inverse @ position
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in ear_ids], context='VERTS')
    bm.to_mesh(obj.data); bm.free()
    if positions:
        obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
        for polygon in obj.data.polygons: polygon.use_smooth = True
    obj.data.update()
    obj['part'] = 'ears'
    return tag(obj, name)


HUMAN_EAR = {}
PRE_HAIR = {}


def human_ear_base():
    """Sculpted ear mesh in its local frame, built once per run."""
    if 'mesh' not in HUMAN_EAR:
        obj = human_ear_mesh('sculpted human ear')
        HUMAN_EAR['mesh'] = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
    return HUMAN_EAR['mesh']


def plain_skin_texel(skin, ear_ids):
    """(material index, UV) of a representative skin texel of the painted ear.

    The sculpted ear carries its own relief, so it takes one plain texel of the
    head map the elf ear was painted with (the median ear colour): the viewer
    then tints it with the chosen skin tone like the rest of the head.
    """
    import numpy as np
    uv = skin.data.uv_layers.active
    loops = [(poly.material_index, loop) for poly in skin.data.polygons
             if all(v in ear_ids for v in poly.vertices) for loop in poly.loop_indices]
    index = max({m for m, _l in loops}, key=lambda m: sum(1 for k, _l in loops if k == m))
    material = skin.data.materials[index]
    node = base_color_image_node(material)
    samples = [uv.data[loop].uv.copy() for m, loop in loops if m == index]
    if not node:
        return index, samples[0]
    image = node.image
    w, h = image.size
    pixels = np.empty(w * h * 4, np.float32); image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(h, w, 4)[..., :3]
    colours = np.array([pixels[min(h - 1, int((s.y % 1) * h)), min(w - 1, int((s.x % 1) * w))] for s in samples])
    median = np.median(colours, axis=0)
    best = int(np.argmin(((colours - median) ** 2).sum(1)))
    return index, samples[best]


def human_ear_object(skin, name, tree, texel):
    """Both sculpted human ears of one character, in world space, skin material."""
    base = human_ear_base()
    vertices, faces = [], []
    for side in (1, -1):
        matrix = human_ear_matrix(tree, side)
        offset = len(vertices)
        vertices += [tuple(matrix @ v.co) for v in base.vertices]
        for poly in base.polygons:
            indices = [offset + i for i in poly.vertices]
            faces.append(tuple(indices if side > 0 else reversed(indices)))
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    material_index, uv = texel
    data.materials.append(skin.data.materials[material_index])
    layer = data.uv_layers.new(name=skin.data.uv_layers.active.name)
    for entry in layer.data:
        entry.uv = uv
    for poly in data.polygons:
        poly.use_smooth = True
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj['part'] = 'ears'
    obj['ear_model'] = 'sculpted human ear (SDF, human_ear_model.py)'
    return tag(obj, name)


HUMAN_EAR_PAD = .0008     # locks clear the human ear by this much
HUMAN_EAR_BAND = .0045    # ...and turn inward over this band around it
HUMAN_EAR_WEIGHT = {}
# Cuts whose locks pass over the top of the human ear before tucking behind
# it, instead of stopping on its contour.
DRAPED_HAIR = {'long', 'curly'}
DRAPE_DEPTH = {'long': .042, 'curly': .030}   # the top of the ear the locks lie over
DRAPE_CLEARANCE = .0022   # above the ear surface
DRAPE_SLOPE = .85         # how fast the lift fades away from the ear
# Cuts that leave the skull bare where the elf ear stood: the human variant
# gets a hair underlayer there (hair_fill, elf window only).
UNDERLAYER_HAIR = {'spiky', 'curly'}
# ...and the spiky locks just above that window are copied down over it.
CLONED_HAIR = {'spiky'}
# Underlayer shade: under cloned locks it must read as depth, not as a plane.
UNDERLAYER_SHADE = {'spiky': .5}
# Braid: its side sweeps back high above the ear. With the human ear, one
# combed lock runs from the temple over the top of the ear into the braid
# (world frame after fitting, +X side; mirrored).
EAR_LOCK_PATHS = {'curly': [
    ([(.086, -.046, 1.636), (.101, -.026, 1.604), (.108, -.008, 1.589), (.108, .014, 1.581),
      (.098, .042, 1.568), (.082, .068, 1.554)],
     [.002, .010, .013, .013, .011, .002], [.002, .0035, .0042, .0042, .0035, .0008]),
]}


def human_ear_weight(skin):
    """ear_weight stencil of the sculpted human ear seated on this head."""
    if skin.name not in HUMAN_EAR_WEIGHT:
        bm = bmesh.new(); bm.from_mesh(skin.data); bm.transform(skin.matrix_world)
        ids = {v.index for shells in ear_islands(bm).values() for shell in shells for v in shell}
        cap_openings(bm, ids)
        tree = skull_tree(bm, ids)
        bm.free()
        base = human_ear_base()
        points = [human_ear_matrix(tree, side) @ v.co for side in (1, -1) for v in base.vertices]
        outline = side_outline(points, HUMAN_EAR_PAD)
        HUMAN_EAR_WEIGHT[skin.name] = lambda y, z: ear_weight(y, z, outline, HUMAN_EAR_BAND)
        HUMAN_EAR_WEIGHT[skin.name + ' outline'] = outline
        # Outer surface of each ear seen from the side: highest |x| per 2 mm cell.
        surface = {}
        for side in (1, -1):
            cells = {}
            for p in points:
                if p.x * side <= 0:
                    continue
                key = (round(p.y / .002), round(p.z / .002))
                if abs(p.x) > cells.get(key, (0,))[0]:
                    cells[key] = (abs(p.x), p.y, p.z)
            surface[side] = np.array(list(cells.values()))
        HUMAN_EAR_WEIGHT[skin.name + ' surface'] = surface
    return HUMAN_EAR_WEIGHT[skin.name]


def drape_human_ear(obj, skin, depth=.030):
    """Lay the locks over the top of the human ear, tucked behind it below.

    Over the top DRAPE_DEPTH of the ear, lock vertices are lifted onto a tent
    over the ear surface (DRAPE_CLEARANCE above it, fading at DRAPE_SLOPE), so
    the locks run over the ear. Below, they are tucked like `clear_ear_space`,
    which reads as hair slipped behind the ear.
    """
    weight = human_ear_weight(skin)
    surface = HUMAN_EAR_WEIGHT[skin.name + ' surface']
    matrix = obj.matrix_world.copy(); inverse = matrix.inverted()
    moved = 0
    for side in (1, -1):
        ear = surface[side]
        top = ear[:, 2].max()
        cut = top - depth
        for vertex in obj.data.vertices:
            p = matrix @ vertex.co
            if p.x * side < .06 or not -.06 < p.y < .09 or not 1.49 < p.z < 1.66:
                continue
            high = max(0.0, min(1.0, (p.z - cut) / .008))
            high = high * high * (3 - 2 * high)
            x = abs(p.x)
            w = weight(p.y, p.z) * (1 - high)
            if w > 0:
                inner = .077 + .001 * math.tanh((x - .077) / .025)
                x = x * (1 - w) + inner * w
            if high > 0:
                d = np.hypot(ear[:, 1] - p.y, ear[:, 2] - p.z)
                tent = float((ear[:, 0] + DRAPE_CLEARANCE - DRAPE_SLOPE * d).max())
                if tent > x:
                    x += (tent - x) * high
            if x != abs(p.x):
                p.x = side * x
                vertex.co = inverse @ p
                moved += 1
    obj.data.update()
    obj['ear_fit'] = 'human'
    obj['ear_clearance_revision'] = 'human-ear-drape-v1'
    obj['ear_clearance_vertices'] = moved
    return moved


def human_ear_twin(obj, skin):
    """Copy of an unclear haircut piece, to be cleared around the human ear."""
    twin = obj.copy(); twin.data = obj.data.copy()
    for collection in obj.users_collection:
        collection.objects.link(twin)
    twin['ear_fit'] = 'human'
    obj['ear_fit'] = 'elf'
    return twin


def clear_human_ear(obj, skin):
    obj['ear_fit'] = 'human'
    return clear_ear_space(obj, human_ear_weight(skin), 'human-ear-outline-v1')


def keep_faces(obj, mask):
    """Delete the faces of obj where mask is False, and the loose vertices."""
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not mask[f.index]], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()


def split_ear_variants(elf, human):
    """Share what the two clearances leave identical; keep one piece per ear.

    `elf` and `human` are the same haircut piece, cleared around the elf ear
    and around the human ear. Only faces touching a vertex that differs go to
    the per-ear pieces (`ear_fit`); the rest stays in the shared piece, so the
    catalogue carries the locks near the ear twice, not the whole cut. The
    pieces meet on unmoved vertices, without a seam.
    Returns the new elf piece (or None when nothing differs).
    """
    count = len(elf.data.vertices)
    a = np.empty(count * 3); b = np.empty(count * 3)
    elf.data.vertices.foreach_get('co', a); human.data.vertices.foreach_get('co', b)
    moved = np.abs((a - b).reshape(-1, 3)).max(1) > 1e-7
    loops = np.empty(len(elf.data.loops), np.int64); elf.data.loops.foreach_get('vertex_index', loops)
    starts = np.empty(len(elf.data.polygons), np.int64); elf.data.polygons.foreach_get('loop_start', starts)
    ear = np.logical_or.reduceat(moved[loops], starts) if len(starts) else np.zeros(0, bool)
    for key in ('ear_fit',):
        if key in elf: del elf[key]
    if not ear.any():
        return None
    piece = elf.copy(); piece.data = elf.data.copy()
    for collection in elf.users_collection:
        collection.objects.link(piece)
    piece.name = elf.name + ' / elf ear locks'
    human.name = elf.name + ' / human ear locks'
    piece['ear_fit'] = 'elf'; human['ear_fit'] = 'human'
    keep_faces(piece, ear); keep_faces(human, ear); keep_faces(elf, ~ear)
    elf['ear_fit_shared'] = int((~ear).sum())
    return piece


def clone_locks_down(sources, shell, skull, avoid):
    """bmesh of the cut's own locks, copied down over the hole `shell` covers.

    Per side, the locks just above the hole (as tall as the hole) are copied
    and lowered by its height, keeping their height above the skull, their
    UVs and their shade, so the hole is filled with the same hair. Faces over
    the human ear (`avoid`(y, z) > .3) are dropped.
    """
    out = bmesh.new()
    uv_out = out.loops.layers.uv.new('UVMap')
    shade_out = out.verts.layers.float.new('shade')
    for side in (1, -1):
        points = [v.co for v in shell.verts if v.co.x * side > 0]
        if len(points) < 3:
            continue
        y0, y1 = min(p.y for p in points), max(p.y for p in points)
        z0, z1 = min(p.z for p in points), max(p.z for p in points)
        height = z1 - z0
        for obj in sources:
            mesh, matrix = obj.data, obj.matrix_world
            uv = mesh.uv_layers.active.data if mesh.uv_layers else None
            colour = mesh.color_attributes[0] if mesh.color_attributes else None
            loop_colour = colour and colour.domain == 'CORNER'
            coords = [matrix @ v.co for v in mesh.vertices]
            moved, made = {}, {}
            for poly in mesh.polygons:
                c = matrix @ poly.center
                if c.x * side < .065 or not (y0 - .006 < c.y < y1 + .006) or not (z1 - .002 < c.z < z1 + height):
                    continue
                target = []
                for index in poly.vertices:
                    if index not in moved:
                        # Rigid drop, plus the skull's own change of width
                        # between the two heights: the lock keeps its volume.
                        p = coords[index]
                        q = p - Vector((0, 0, height * .9))
                        shift = skull_x(skull, side, q.y, q.z) - skull_x(skull, side, p.y, p.z)
                        moved[index] = q + Vector((side * shift, 0, 0))
                    target.append(moved[index])
                centre = sum(target, Vector()) / len(target)
                if centre.z < z0 - .004 or abs(centre.x) < .06:
                    continue
                verts = []
                for index, q in zip(poly.vertices, target):
                    # Shared vertices keep the locks welded (smooth shading).
                    v = made.get(index)
                    if v is None:
                        v = made[index] = out.verts.new(q)
                        value = 1.0
                        if colour and not loop_colour:
                            value = colour.data[index].color[0]
                        v[shade_out] = value
                    verts.append(v)
                try:
                    face = out.faces.new(verts)
                except ValueError:
                    continue
                for loop, index in zip(face.loops, poly.loop_indices):
                    if uv:
                        loop[uv_out].uv = uv[index].uv
                    if loop_colour:
                        loop.vert[shade_out] = colour.data[index].color[0]
    # Whole locks only, behind the ear: a lock touching the ear or reaching
    # in front of it is dropped entirely rather than cut into a ragged edge.
    seen = set()
    for start in list(out.verts):
        if start in seen:
            continue
        island, stack = [], [start]
        seen.add(start)
        while stack:
            v = stack.pop(); island.append(v)
            for e in v.link_edges:
                o = e.other_vert(v)
                if o not in seen:
                    seen.add(o); stack.append(o)
        if any(v.co.y < -.004 or avoid(v.co.y, v.co.z) > .05 for v in island):
            bmesh.ops.delete(out, geom=island, context='VERTS')
    return out


def split_ears(selected):
    """Human ears by default; the delivered elf ears become an accessory.

    The delivered ears are loose shells plugging an opening in the skin; the
    opening is capped, so any ear sits on a closed skull. Per character this makes:
      * `persona / human ears` — a sculpted anatomical ear (human_ear_model.py);
      * `elf-ears / pointed elf ears` — the delivered ears, untouched;
      * `pierced-ears / ...` — the sculpted ears again, with a few piercings.
    Hair was fitted around the elf ears (the larger ones); the bare skull that
    leaves around the human ear is then covered by a hair shell (hair_fill.py).
    """
    global slot, item, persona
    created = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for skin in [obj for obj in selected if obj.get('part') == 'skin' and obj.get('fit_persona')]:
        persona = skin['fit_persona']; gender = CHARACTERS[persona]
        bm = bmesh.new(); bm.from_mesh(skin.data); bm.transform(skin.matrix_world)
        sides = ear_islands(bm)
        ear_ids = {v.index for shells in sides.values() for shell in shells for v in shell}
        texel = plain_skin_texel(skin, ear_ids)
        slot, item = 'accessory', 'elf-ears'
        elf = ear_copy(skin, f'{gender} / pointed elf ears', ear_ids)
        elf['ear_style'] = 'elf'
        original_ids = set(ear_ids)
        # Cap the skin openings first: the skull is then measured, and the
        # sculpted ear seated, on the closed surface.
        cap_openings(bm, ear_ids)
        tree = skull_tree(bm, ear_ids)
        slot, item = 'persona', persona
        default = human_ear_object(skin, f'{gender} • human ears', tree, texel)
        default['ear_style'] = 'human'
        slot, item = 'accessory', 'pierced-ears'
        pierced = human_ear_object(skin, f'{gender} / human ears', tree, texel)
        pierced['ear_style'] = 'human'
        created += [default, elf, pierced]
        # Jewellery sits on the sculpted ear's outer face.
        ear_points = [default.matrix_world @ v.co for v in default.data.vertices]
        for side in (1, -1):
            matrix = human_ear_matrix(tree, side)
            out = (matrix.to_3x3() @ Vector((0, 0, 1))).normalized()
            outer = []
            for v in default.data.vertices:
                p = default.matrix_world @ v.co
                n = (default.matrix_world.to_3x3() @ v.normal).normalized()
                if p.x * side > 0 and n.dot(out) > .35:
                    outer.append((p, n))
            name = 'left' if side > 0 else 'right'
            for number, piece in enumerate(jewellery_layout(outer, side), 1):
                finish = {'gold': GOLD, 'gem': GEM, 'steel': STEEL}[piece['finish']]
                label = f'{gender} / {name} ear {piece["kind"]} {number}'
                if piece['kind'] == 'hoop':
                    obj = torus(label, piece['center'], piece['u'], piece['v'], piece['radius'], piece['wire'], finish)
                else:
                    obj = bead(label, piece['center'], piece['radius'], finish)
                obj['part'] = 'jewellery'
                created.append(obj)
        # Hair: cover the skull the elf-ear clearance left bare around the ear.
        attachments = {side: ear_attachment(ear_points, tree, side) for side in (1, -1)}
        elf_tree = hair_tree(elf, bpy.context.evaluated_depsgraph_get())
        # One shell per cut (and hat fit), on its largest hair-material piece,
        # under the cover of all its pieces.
        cuts = {}
        for obj in selected:
            if obj.get('shop_slot') == 'hair' and obj.get('fit_persona') == persona and obj.name in PRE_HAIR:
                cuts.setdefault((obj.get('shop_id'), obj.get('hat_fit', 'open')), []).append(obj)
        for pieces in cuts.values():
            fitted = [obj for obj in selected if obj.get('ear_fit') and obj.get('fit_persona') == persona
                      and obj.get('shop_slot') == 'hair' and (obj.get('shop_id'), obj.get('hat_fit', 'open'))
                      == (pieces[0].get('shop_id'), pieces[0].get('hat_fit', 'open'))]
            if fitted:
                # Cuts cleared per ear shape need no filler, except where the
                # cut itself stops at the elf ear: the human variant gets an
                # underlayer on that window only.
                human = [obj for obj in fitted if obj['ear_fit'] == 'human' and obj.data.materials
                         and 'hair' in obj.data.materials[0].name.lower()]
                if pieces[0].get('shop_id') in UNDERLAYER_HAIR and human:
                    cut_id = pieces[0].get('shop_id')
                    host = max(human, key=lambda obj: len(obj.data.polygons))
                    shell = ear_zone_shell(bm, ear_ids, tree, [], attachments, elf_tree)
                    top = max((obj.matrix_world @ v.co).z for obj in pieces for v in obj.data.vertices)
                    bmesh.ops.delete(shell, geom=[f for f in shell.faces if any(v.co.z > top - .0005 for v in f.verts)], context='FACES')
                    cut_pieces = [obj for obj in selected if obj.get('fit_persona') == persona
                                  and obj.get('shop_slot') == 'hair' and obj.get('ear_fit') != 'elf'
                                  and (obj.get('shop_id'), obj.get('hat_fit', 'open'))
                                  == (pieces[0].get('shop_id'), pieces[0].get('hat_fit', 'open'))
                                  and obj.data.materials and 'hair' in obj.data.materials[0].name.lower()]
                    clones = (clone_locks_down(cut_pieces, shell, tree, human_ear_weight(skin))
                              if cut_id in CLONED_HAIR else bmesh.new())
                    bmesh.ops.delete(clones, geom=[f for f in clones.faces if any(v.co.z > top - .0005 for v in f.verts)], context='FACES')
                    host['ear_zone_fill_faces'] = append_geometry(host, shell, UNDERLAYER_SHADE.get(cut_id, 1.0)) + append_geometry(host, clones)
                    host['ear_zone_cloned_faces'] = len(clones.faces)
                    shell.free(); clones.free()
                continue
            carriers = [obj for obj in pieces if obj.data.materials and 'hair' in obj.data.materials[0].name.lower()]
            if not carriers:
                continue
            host = max(carriers, key=lambda obj: len(obj.data.polygons))
            shell = ear_zone_shell(bm, ear_ids, tree, [PRE_HAIR[obj.name] for obj in pieces], attachments, elf_tree)
            # A cut trimmed under a hat keeps its trim: no shell above its top.
            top = max((obj.matrix_world @ v.co).z for obj in pieces for v in obj.data.vertices)
            bmesh.ops.delete(shell, geom=[f for f in shell.faces if any(v.co.z > top - .0005 for v in f.verts)], context='FACES')
            bmesh.ops.delete(shell, geom=[v for v in shell.verts if not v.link_faces], context='VERTS')
            host['ear_zone_fill_faces'] = append_geometry(host, shell)
            shell.free()
        bm.free()
        bm = bmesh.new(); bm.from_mesh(skin.data)
        # Close the openings the delivered ears plugged: every ear sits on the skull.
        ids = set(original_ids)
        cap_openings(bm, ids)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index in ids], context='VERTS')
        bm.to_mesh(skin.data); bm.free(); skin.data.update()
        skin['ears'] = 'separate: persona human ears, accessory elf-ears / pierced-ears'
    slot, item, persona = 'core', 'base', None
    for obj in created: obj.select_set(True)
    return created


def export():
    # The haircuts as fitted, before the elf-ear clearance tucks locks away:
    # their cover decides where hair_fill grows hair back around the human ear.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type == 'MESH' and obj.get('shop_slot') == 'hair' and obj.data.polygons:
            PRE_HAIR[obj.name] = hair_tree(obj, depsgraph)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        if obj.type == 'MESH' and not obj.data.polygons:
            continue
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.convert(target='MESH')
    if STYLIZED:
        # Mila's surface is rebuilt before wardrobe fitting, so shirts, belts
        # and armour all follow the same base. No second additive chest pass.
        # Both personas wear the shared cuts, so the ear clearance, the fitted
        # occiput and the temple locks are applied per character against that
        # character's own skin.
        skins = {obj.get('fit_persona'): obj for obj in bpy.context.selected_objects
                 if obj.get('part') == 'skin' and obj.get('fit_persona')}
        hair_variants = {}
        # Each supplied cut is cleared twice: around the elf ear and around
        # the human ear, from the same fitted locks. `split_ear_variants`
        # then keeps the locks near the ear once per ear shape (`ear_fit`).
        twins = []
        for obj in list(bpy.context.selected_objects):
            persona_id = obj.get('fit_persona')
            gender = CHARACTERS.get(persona_id)
            if not gender: continue
            if obj.get('shop_slot') == 'hair':
                skin = skins.get(persona_id)
                if 'filled posterior hair' in obj.name and skin:
                    fit_posterior_hair(obj, skin)
                pieces = [obj]
                if obj.get('shop_id') not in CONFORMED_HAIR:
                    # The occiput filler was ray-fitted over the elf ear and
                    # wraps its shape: it stays tucked for both ears.
                    if skin and 'filled posterior hair' not in obj.name:
                        twin = human_ear_twin(obj, skin)
                        objects.append(twin); twin.select_set(True)
                        if obj.get('shop_id') in DRAPED_HAIR:
                            drape_human_ear(twin, skin, DRAPE_DEPTH[obj.get('shop_id')])
                        else:
                            clear_human_ear(twin, skin)
                        twins.append((obj, twin)); pieces.append(twin)
                    clear_ear_space(obj)
                # The occiput filler lives inside the skull on purpose; every
                # other variant is measured against this character's skin and
                # lifted out of it, so Noa and Mila each get an exact hairline.
                for piece in pieces:
                    if skin and 'filled posterior hair' not in piece.name:
                        piece['conformed_vertices'] = conform_hair_to_head(piece, skin)
                if obj.get('shop_id') == 'long' and 'supplied hairstyle' in obj.name:
                    hair_variants[(persona_id, obj.get('hat_fit', 'open'))] = obj
            elif gender == 'boy':
                apply_body_shape(obj, gender, 'stylized')
        # Human-ear locks over the ear: only with the human ear variant.
        for obj in list(bpy.context.selected_objects):
            paths = EAR_LOCK_PATHS.get(obj.get('shop_id'))
            if (paths and obj.get('shop_slot') == 'hair' and obj.get('ear_fit') == 'human'
                    and skins.get(obj.get('fit_persona')) and obj.data.materials
                    and 'hair' in obj.data.materials[0].name.lower()
                    and obj == max((o for o in bpy.context.selected_objects if o.get('ear_fit') == 'human'
                                    and o.get('shop_id') == obj.get('shop_id') and o.get('fit_persona') == obj.get('fit_persona')
                                    and o.get('hat_fit', 'open') == obj.get('hat_fit', 'open')),
                                   key=lambda o: len(o.data.polygons))):
                skin = skins[obj['fit_persona']]
                for lock in swept_temple_locks(obj, clear=lambda o: drape_human_ear(o, skin, 1.0),
                                               paths=paths, label='lock over the ear'):
                    lock['ear_fit'] = 'human'
                    objects.append(lock); lock.select_set(True)
        # The swept temple locks were drawn around the elf ear; left uncleared
        # they stand out as a fin, so both ear shapes wear them tucked.
        for reference in hair_variants.values():
            for obj in swept_temple_locks(reference):
                objects.append(obj); obj.select_set(True)
        for elf, human in twins:
            piece = split_ear_variants(elf, human)
            if piece:
                objects.append(piece); piece.select_set(True)
            else:
                objects.remove(human); bpy.data.objects.remove(human, do_unlink=True)
            if not elf.data.polygons:
                objects.remove(elf); bpy.data.objects.remove(elf, do_unlink=True)
    else:
        refine_seat_silhouette(bpy.context.selected_objects)
        # Validated athletic silhouettes: the first pass softens the rear, the
        # second shapes the shoulders, chest, waist, hips and arms. Both use the
        # shared field in refit_body_shapes.py and protect everything above
        # 1.455 m, so the approved face and hair normals are copied verbatim.
        for obj in bpy.context.selected_objects:
            gender = CHARACTERS.get(obj.get('fit_persona'))
            if not gender: continue
            apply_body_shape(obj, gender, 'v1')
            apply_body_shape(obj, gender, 'v2')
        # The two sculpted short cuts get the same per-character skin
        # conformance as the live stylized base, so the production reference
        # and its thumbnails agree. They are authored clear of the ear.
        skins = {obj.get('fit_persona'): obj for obj in bpy.context.selected_objects
                 if obj.get('part') == 'skin' and obj.get('fit_persona')}
        for obj in bpy.context.selected_objects:
            persona_id = obj.get('fit_persona')
            if obj.get('shop_slot') != 'hair' or obj.get('shop_id') not in CONFORMED_HAIR:
                continue
            # `covered` is bisected flush with the hat plane below; conforming it
            # would push the clipped crown back through that plane.
            if obj.get('hat_fit') == 'covered':
                continue
            if skins.get(persona_id):
                obj['conformed_vertices'] = conform_hair_to_head(obj, skins[persona_id])
    # Last geometry step: every haircut is already fitted around the elf ears.
    split_ears(list(bpy.context.selected_objects))
    bpy.ops.export_scene.gltf(filepath=str(OUT / 'catalogue.glb'), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_animations=False, export_extras=True)
    manifest = {}
    for obj in bpy.context.selected_objects:
        key = f"{obj.get('shop_slot')}:{obj.get('shop_id')}"
        manifest[key] = manifest.get(key, 0) + 1
    report = {'appearanceRevision': APPEARANCE_REVISION, 'sourceRevision': CONTRACT['revision'], 'sourcePose': CONTRACT['pose'],
              'sourceSha256': {f'{gender}-medium.glb': hashlib.sha256((SOURCES/f'{gender}-medium.glb').read_bytes()).hexdigest() for gender in CHARACTERS.values()},
              'anchorManifestSha256': hashlib.sha256((SOURCES/'manifest.json').read_bytes()).hexdigest(),
              'coordinates': 'metres; Blender Z up, front -Y; glTF Y up, front +Z',
              'parts': manifest, 'staticPose': True, 'headFit': HEAD_FIT, 'headFits': HEAD_FITS}
    (OUT / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    # Saved workspace opens on one coherent loadout, all alternatives in Outliner.
    defaults = {'core': 'base', 'persona': 'male', 'outfit': 'vocab-ranger', 'hair': 'short', 'hat': 'explorer-cap', 'weapon': 'no-weapon'}
    for obj in bpy.context.scene.objects:
        visible = defaults.get(obj.get('shop_slot')) == obj.get('shop_id') and obj.get('hat_fit', 'open') == 'open' and obj.get('fit_persona','male') == 'male'
        obj.hide_render = not visible
        obj.hide_set(not visible)
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new('Daylight studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .65
    for name, pos, power in [('Key', (-3, -4, 5), 450), ('Fill', (3, -2, 3), 250), ('Rim', (0, 3, 4), 380)]:
        bpy.ops.object.light_add(type='AREA', location=pos)
        lamp = bpy.context.object; lamp.name = name; lamp.data.energy = power; lamp.data.shape = 'DISK'; lamp.data.size = 4
        lamp.rotation_euler = (Vector((0, 0, 1)) - lamp.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(location=(1.2, -5.7, 2.2))
    camera = bpy.context.object; camera.rotation_euler = (Vector((0, 0, 1.025)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'; camera.data.ortho_scale = 2.40; scene.camera = camera
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.use_denoising = True
    scene.render.resolution_x = 900; scene.render.resolution_y = 1000; scene.render.resolution_percentage = 100
    scene.render.film_transparent = True; scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.file.pack_all(); bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'catalogue.blend'), compress=True)
    scene.render.filepath = str(OUT / 'preview.png')
    if not os.environ.get('SKIP_CATALOGUE_RENDER'): bpy.ops.render.render(write_still=True)
    print('CATALOGUE_READY', json.dumps(manifest))


bases = prepare()
make_surface_textures()
GOLD = material('Brushed old gold', '#B49962', .38, .72)
STEEL = material('Satin steel', '#93A3AC', .34, .68)
LEATHER = material('Oiled chestnut leather', '#65503C', .84)
SAGE = material('Ranger green wool', '#38634D', .93)
PURPLE = material('Mage plum wool', '#604571', .9)
CHARCOAL = material('Charcoal felt', '#262C33', .86)
RED = material('Burgundy silk', '#943F48', .62)
IVORY = material('Warm ivory', '#DDD6BE', .84)
ENAMEL = material('Blue enamel', '#365B80', .38, .18)
GLASS = material('Dark blue lenses', '#172C35', .14, .3)
GEM = material('Turquoise crystal', '#6FBDC4', .21, .18, .18)
AMBER = material('Lantern warm light', '#E6B555', .38, .05, 1.1)
HAIR = material('Hair / selectable color', '#594432', .52)
HAIR_DARK = material('Hair / shadow strands', '#493829', .57)
HAIR_LIGHT = material('Hair / highlight strands', '#645039', .50)
surface_maps(HAIR, OUT/'textures/hair-normal.png', OUT/'textures/hair-roughness.png', .32)
HAIR.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.32


def shaded_hair_material():
    """Shop hair material whose colour is multiplied by the lock shade."""
    mat = HAIR.copy()
    mat.name = 'Hair / sculpted fibres'
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    shade = nodes.new('ShaderNodeVertexColor')
    shade.layer_name = 'HairShade'
    mix = nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[6].default_value = shader.inputs['Base Color'].default_value[:]
    links.new(shade.outputs['Color'], mix.inputs[7])
    links.new(mix.outputs[2], shader.inputs['Base Color'])
    return mat


HAIR_SHADED = shaded_hair_material()
for persona in CHARACTERS:
    garments(bases[persona]['shirt'])
persona = None
# Haircuts under sign-off: HAIR_ITEMS decides which families ship. The hair
# category stays in the game either way, with the shaved head always available.
if HAIR_ITEMS:
    hairstyles({})
hats()
fit_equipment()
export()
