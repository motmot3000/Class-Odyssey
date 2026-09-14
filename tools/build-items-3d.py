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
import tempfile
import numpy as np
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector, noise

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'items-3d'
SOURCES = OUT / 'sources'
CONTRACT = json.loads((SOURCES / 'manifest.json').read_text())
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
APPEARANCE_REVISION = 'catalogue-v4-fibres-fit'
REFINED = ROOT / 'assets' / 'characters-refined' / 'textures'


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


def refine_source_materials(obj, gender):
    """Reuse the surface-v3 UV-compatible face/skin/eye maps, not its old hair."""
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes: continue
        shader = mat.node_tree.nodes.get('Principled BSDF')
        if not shader or mat.get('catalogue_surface_revision'): continue
        key = mat.get('base_skin_map')
        if key:
            filename = f'head-{gender}-medium.png' if key == 'head' else 'skin-medium.png'
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and any(link.to_socket == shader.inputs['Base Color'] for link in node.outputs['Color'].links):
                    node.image = bpy.data.images.load(str(REFINED / filename), check_existing=True)
            surface_maps(mat, REFINED/f'normal-{key}.png', REFINED/f'rough-{key}.png', .50 if key == 'head' else .30)
            shader.inputs['Specular IOR Level'].default_value = .28
            shader.inputs['Subsurface Weight'].default_value = .025
        elif 'Eye_L' in obj.name or 'Eye_R' in obj.name:
            side = 'left' if 'Eye_L' in obj.name else 'right'
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    node.image = bpy.data.images.load(str(REFINED/f'eye-{gender}-{side}.png'), check_existing=True)
            shader.inputs['Roughness'].default_value = .22
            shader.inputs['Coat Weight'].default_value = .18
        elif 'Pant_' in obj.name:
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    node.image = bpy.data.images.load(str(REFINED/'trousers.png'), check_existing=True)
            surface_maps(mat, REFINED/'normal-trousers.png', REFINED/'rough-trousers.png', .45)
        mat['catalogue_surface_revision'] = APPEARANCE_REVISION


def make_surface_textures():
    """Small, portable tangent-space PBR textures: fibres instead of clay."""
    directory = OUT/'textures'
    directory.mkdir(exist_ok=True)
    size = 512
    v, u = np.mgrid[0:size, 0:size].astype(np.float32) / size
    for kind in ['hair', 'cloth']:
        if kind == 'hair':
            flow = u*93 + .16*np.sin(v*TAU*2) + .04*np.sin(v*TAU*7)
            nx = .20*np.cos(flow*TAU) + .07*np.cos((u*207+v*.13)*TAU)
            ny = .035*np.sin(v*TAU*5+u*TAU)
            rough = .49 + .075*np.sin(flow*TAU) + .025*np.sin(v*TAU*3)
        else:
            nx = .09*np.sin(u*TAU*126)*np.cos(v*TAU*126)
            ny = .09*np.cos(u*TAU*126)*np.sin(v*TAU*126)
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
    # Keep the lowered sleeves, but remove the hidden original tunic tail.
    # Otherwise it pokes through the new close-cut skirt beneath the belt.
    bm = bmesh.new(); bm.from_mesh(obj.data)
    arms = [(anchor_position(f'elbow_{side}'), anchor_position(f'wrist_{side}')) for side in ['left','right']]
    def outside_sleeves(point):
        for start, end in arms:
            direction = end-start
            weight = max(0,min(1,(point-start).dot(direction)/direction.length_squared))
            if (point-(start+direction*weight)).length < .085: return False
        return True
    faces = [face for face in bm.faces if all(abs(v.co.x) < .215 and outside_sleeves(v.co) for v in face.verts)]
    edges = {edge for face in faces for edge in face.edges}
    verts = {vertex for face in faces for vertex in face.verts}
    bmesh.ops.bisect_plane(bm, geom=faces+list(edges)+list(verts),
                          plane_co=(0,0,1.030), plane_no=(0,0,1), clear_inner=True, dist=.00001)
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


def fitted_plate(shirt, mat):
    rows = [fitted_ring(shirt, z, .014) for z in [1.075, 1.13, 1.20, 1.27, 1.32, 1.35]]
    n = len(rows[0])
    obj = mesh('smooth fitted breastplate', [point for row in rows for point in row],
               [(j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i)
                for j in range(len(rows) - 1) for i in range(n)], mat)
    solid = obj.modifiers.new('Solid breastplate edge', 'SOLIDIFY'); solid.thickness = .006
    line('breastplate lower edge', rows[0], .004, GOLD, True)


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
            refine_source_materials(obj, gender)
            if part == 'clothes' and 'shirt' in obj.name.lower():
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
        bases[persona] = {'shirt': shirts[0]}
    persona = None
    bpy.context.scene['character_revision'] = CONTRACT['revision']
    bpy.context.scene['character_source_credit'] = CONTRACT['sourceCredit']
    return bases


def garments(shirt):
    global slot, item
    slot = 'outfit'
    for item, color in [('starter', '#536776'), ('vocab-ranger', '#38634D'), ('grammar-mage', '#604571'),
                        ('story-keeper', '#913E37'), ('honor-knight', '#375B80'),
                        ('grand-archmage', '#453555'), ('realm-sovereign', '#853A42')]:
        cloth = material(f'{item} / woven cloth', color, .92)
        surface_maps(cloth, OUT/'textures/cloth-normal.png', OUT/'textures/cloth-roughness.png', .28)
        top = duplicate(shirt, 'fitted long-sleeve tunic', cloth)
        trim_under_belt(top)
        cloth_uv(top)
        hem = .83 if item in ['starter', 'vocab-ranger'] else .42 if item in ['grammar-mage', 'grand-archmage'] else .67
        # A close-cut tunic below the waist, not the previous rigid flared skirt.
        rx = .204 if persona == 'male' else .194
        ry = .169 if persona == 'male' else .160
        skirt = shell('tailored tunic skirt', [(hem,rx,ry,-.015),(.92,rx*.94,ry*.98,-.020),(1.025,.175,.163,-.01)], cloth, thickness=.004)
        cloth_uv(skirt)
        ring('bound hem', 0, -.015, hem, rx, ry, .002, GOLD if item != 'starter' else LEATHER)
        belt_points = fitted_ring(shirt, 1.035, .006)
        lower = fitted_ring(shirt, 1.018, .006)
        upper = fitted_ring(shirt, 1.052, .006)
        n = len(lower)
        belt = mesh('flat fitted leather waist belt', lower+upper,
                    [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)], LEATHER)
        belt.modifiers.new('Leather band thickness','SOLIDIFY').thickness=.003
        line('belt upper stitching', upper, .00065, GOLD, True)
        front = min(y for x, y, z in belt_points)
        box('belt buckle', (0, front - .007, 1.035), (.044, .009, .035), GOLD, .003)
        box('buckle inset', (0, front - .013, 1.035), (.030, .003, .023), LEATHER, .001)
        if item == 'starter':
            ring('scout neckerchief', 0, -.015, 1.436, .071, .075, .013, SAGE)
            prism('folded scout scarf', [(-.048, .025), (.048, .025), (.018, -.095), (0, -.068), (-.023, -.094)], (0, -.09, 1.404), .008, SAGE)
            ell('compass fastening', (.033, -.108, 1.408), (.014, .007, .014), GOLD)
        else:
            cape_mat = cloth if item in ['vocab-ranger', 'realm-sovereign'] else CHARCOAL
            cape_hem = .73 if item == 'vocab-ranger' else .42
            rows = [(cape_hem, .30, .17, .105), (.80, .295, .185, .083), (1.12, .257, .166, .075), (1.37, .20, .13, .045), (1.438, .077, .078, .008)]
            cape = shell('draped travelling cape', rows, cape_mat, -.07, math.pi + .14, .008)
            for sign in [-1, 1]:
                line('cape edge', [(sign * rx, cy - .01, z) for z, rx, ry, cy in rows], .004, GOLD if item in ['grand-archmage', 'realm-sovereign'] else LEATHER)
                ell('cape clasp', (sign * .075, -.093, 1.408), (.015, .008, .015), GOLD)
            if item in ['grammar-mage', 'grand-archmage']:
                for sign in [-1, 1]:
                    line('robe front embroidery', [(sign * .048, -.143, 1.375), (sign * .073, -.186, 1.21), (sign * .070, -.197, 1.045), (sign * .095, -.196, .78), (sign * .12, -.184, hem + .018)], .005, GOLD)
                prism('arcane chest crystal', [(0, .04), (.025, 0), (0, -.04), (-.025, 0)], (0, -.192, 1.257), .018, GEM)
            if item in ['story-keeper', 'honor-knight', 'realm-sovereign']:
                fitted_plate(shirt, STEEL if item != 'realm-sovereign' else GOLD)
                star('chest crest', (0, -.202, 1.238), .05, GOLD if item != 'realm-sovereign' else ENAMEL)
                for sign in [-1, 1]:
                    shoulder = anchor_position('shoulder_left' if sign > 0 else 'shoulder_right')
                    pauldron = ell('fitted shoulder plate', shoulder+Vector((sign*.027,-.004,-.003)), (.088,.116,.056), STEEL if item != 'realm-sovereign' else GOLD)
                    pauldron.rotation_euler.y = sign*.12
                    ell('steel greave', (sign * .128, -.070, .31), (.064, .081, .18), STEEL)
                    line('greave centre ridge', [(sign * .128, -.148, .20), (sign * .128, -.154, .32), (sign * .128, -.137, .46)], .005, GOLD)
            if item == 'grand-archmage':
                shell('high ceremonial mantle', [(1.30, .265, .166, 0), (1.385, .205, .14, 0), (1.435, .079, .082, 0)], cloth)
                ring('mantle gold edge', 0, 0, 1.30, .265, .166, .007, GOLD)
            if item == 'realm-sovereign':
                for i in range(18):
                    a = -.15 + (math.pi + .3) * i / 17
                    ell('ivory cape collar', (.172 * math.cos(a), .132 * math.sin(a), 1.405), (.038, .032, .029), IVORY, 12)
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
    vertices, ridges = [], [[], []]
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
        for ridge, fraction in zip(ridges, [-.32, .30]):
            ridge.append(center + side * ws[j] * fraction + depth * ds[j] * .96)
    faces = [tuple(reversed(range(n)))]
    faces += [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i) for j in range(len(centers)-1) for i in range(n)]
    faces.append(tuple((len(centers)-1)*n+i for i in range(n)))
    result = mesh(name, vertices, faces, mat)
    grid_uv(result,n,len(centers))
    if detail:
        for i, points in enumerate(ridges):
            line(name + ' / fine strand ' + str(i), [tuple(p) for p in points[3:-4:3]], .00035, HAIR_LIGHT if i else HAIR_DARK)
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
            else: end += .024*math.sin(a*17)+.010*math.sin(a*31+.7)
            theta = .002 + (end - .002) * j / (rows-1)
            vertices.append(scalp_point(a, theta, afro))
    obj = mesh('sculpted afro silhouette' if afro else 'fitted continuous hairline', vertices,
          [(j*n+i, (j+1)*n+i, (j+1)*n+(i+1)%n, j*n+(i+1)%n) for j in range(rows-1) for i in range(n)], HAIR)
    grid_uv(obj,n,rows)


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


def hairstyles(source):
    global slot, item
    for pieces in source.values():
        for obj in pieces: bpy.data.objects.remove(obj, do_unlink=True)
    slot = 'hair'
    for item in ['short', 'long', 'curly', 'braided', 'royal-hair']:
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
            if item == 'curly':
                co.x *= .79
                co.y = HEAD_FIT['center_y'] + (co.y-HEAD_FIT['center_y'])*.86
            # Fit the hair INSIDE the band's inner wall, including raised
            # fringe/strand meshes. Ease into the band without removing the
            # top or lengths of an open-crown hairstyle.
            entry = max(0, min(1, (co.z-1.650)/.029))
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
        for v in bm.verts:
            if item == 'curly':
                v.co.x *= .72
                v.co.y = HEAD_FIT['center_y'] + (v.co.y-HEAD_FIT['center_y'])*.80
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


def export():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        if obj.type == 'MESH' and not obj.data.polygons:
            continue
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.convert(target='MESH')
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
    defaults = {'core': 'base', 'persona': 'male', 'outfit': 'vocab-ranger', 'hair': 'short', 'hat': 'explorer-cap', 'weapon': 'lore-lantern'}
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
for persona in CHARACTERS:
    garments(bases[persona]['shirt'])
persona = None
hairstyles({})
hats()
weapons()
fit_equipment()
export()
