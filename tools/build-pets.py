"""Adapt supplied pets for the game (Blender 5.2, run with --factory-startup).

flatpak run --cwd="$PWD" org.blender.Blender -b --factory-startup \
  --python-exit-code 1 --python "$PWD/tools/build-pets.py" -- CAT.zip DOG.zip DRAGON.zip RABBIT.zip PARROT.zip

Only generated GLB, thumbnails and provenance ship. Archives are extracted to
a temporary directory; the supplied originals are never modified.
"""
import bpy
import bmesh
import hashlib
import json
import math
import sys
import tempfile
import zipfile
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/pets'
PREVIEWS = ROOT / 'assets/items-3d/previews'
REVISION = 'pets-v9'


def enum(owner, name, value):
    allowed = [item.identifier for item in owner.bl_rna.properties[name].enum_items]
    if value not in allowed:
        raise ValueError(f'{name}: {value} not in {allowed}')
    setattr(owner, name, value)


def material(name, color, roughness=.8, metallic=0):
    mat = bpy.data.materials.new(name)
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return mat


def textured_material(name, image, roughness=.8):
    mat = material(name, (1, 1, 1), roughness)
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    mat.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])
    # Drop tiny fur detail: painted coat markings read better beside the heroes.
    size = 512 if 'eyes' in name else 1024
    if max(image.size) > size:
        ratio = size / max(image.size)
        image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
    image.pack()
    return mat


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = True
    return obj


def bounds(objects):
    points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    return (Vector([min(p[i] for p in points) for i in range(3)]),
            Vector([max(p[i] for p in points) for i in range(3)]))


def accessories(body, kind, scale):
    """Fit the scarf to the actual neck surface, rather than floating primitives."""
    colors = {'cat': (.045, .17, .115), 'dog': (.065, .115, .21), 'rabbit': (.20, .10, .18)}
    cloth = material(f'Pet / {kind} / woven scarf', colors[kind])
    bvh = BVHTree.FromPolygons([v.co for v in body.data.vertices], [list(p.vertices) for p in body.data.polygons])
    center = Vector((.01, -.065, .145) if kind == 'rabbit' else (.004 if kind == 'cat' else 0, -.30, .355 if kind == 'cat' else .465)) * scale
    axis = Vector((0, -.85, .52)).normalized()
    u, v = Vector((1, 0, 0)), Vector((0, .52, .85)).normalized()
    vertices = []
    count = 48
    for row in [-1, 1]:
        origin = center + axis * row * (.007 if kind == 'rabbit' else .013) * scale
        for i in range(count):
            a = math.tau * i / count
            direction = u * math.cos(a) + v * math.sin(a)
            hit, normal, _, _ = bvh.ray_cast(origin, direction, .4 * scale)
            if hit is None:
                raise ValueError(f'Scarf misses {kind} neck at {i}')
            vertices.append(hit + direction * .004 * scale)
    faces = [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    scarf = mesh(f'{kind} / scarf collar', vertices, faces, cloth)
    solid = scarf.modifiers.new('Cloth thickness', 'SOLIDIFY')
    solid.thickness = .002 * scale

    def front(x, z):
        hit, _, _, _ = bvh.ray_cast(Vector((x, -2, z)), Vector((0, 1, 0)), 3)
        return Vector((x, hit.y - .006 * scale if hit else center.y - .08 * scale, z))

    # A short folded neckerchief, safely above the paws.
    top, bottom, width = {'cat': (.32, .225, .072), 'dog': (.40, .28, .10), 'rabbit': (.132, .085, .035)}[kind]
    top, bottom, width = top * scale, bottom * scale, width * scale
    verts = []
    rows, columns = 8, 12
    for row in range(rows + 1):
        t = row / rows
        for column in range(columns + 1):
            x = (column / columns * 2 - 1) * width * (1 - t * .96)
            p = front(x, top + (bottom - top) * t)
            p.y -= math.sin(column / columns * math.pi * 4) * .002 * scale
            verts.append(p)
    faces = []
    for row in range(rows):
        for col in range(columns):
            i = row * (columns + 1) + col
            faces.append((i, i + 1, i + columns + 2, i + columns + 1))
    bib = mesh(f'{kind} / folded neckerchief', verts, faces, cloth)
    solid = bib.modifiers.new('Cloth thickness', 'SOLIDIFY')
    solid.thickness = .002 * scale
    return [scarf, bib]


def extract_archive(archive, dest):
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            if not (dest / entry.filename).resolve().is_relative_to(dest.resolve()):
                raise ValueError('Unsafe archive path')
        source.extractall(dest)


def import_pet(archive, kind, temporary):
    dest = temporary / kind
    extract_archive(archive, dest)
    before = set(bpy.context.scene.objects)
    if kind == 'cat':
        bpy.ops.import_scene.fbx(filepath=str(dest / 'source/frip_F_export.fbx'))
    else:
        bpy.ops.import_scene.gltf(filepath=str(dest / ('source/kelinci 3d.glb' if kind == 'rabbit' else 'source/dog.glb')))
    imported = set(bpy.context.scene.objects) - before
    objects = [o for o in imported if o.type == 'MESH']
    # Freeze the supplied pose BEFORE reorienting; the FBX includes an armature.
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.data = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        obj.modifiers.clear()
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        obj.data.transform(Matrix.Rotation({'cat': -math.pi / 3, 'dog': 0, 'rabbit': 1.17}[kind], 4, 'Z') @ world)
    for obj in imported - set(objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    lower, upper = bounds(objects)
    height = {'cat': .44, 'dog': .62, 'rabbit': .30}[kind]
    factor = height / (upper.z - lower.z)
    center = (lower + upper) * .5
    transform = Matrix.Scale(factor, 4) @ Matrix.Translation(Vector((-center.x, -center.y, -lower.z)))
    for obj in objects:
        obj.data.transform(transform)
        old = obj.data.materials[0]
        if kind == 'cat':
            if old.name.startswith('whiskers'):
                mat = material('Pet / cat / whiskers', (.04, .025, .015))
            else:
                eye = old.name.startswith('SHD_eye')
                image = bpy.data.images.load(str(dest / 'textures' / ('eye_3.tga.png' if eye else 'SHD_frip_Base_Color.tga.png')))
                mat = textured_material('Pet / cat / eyes' if eye else 'Pet / cat / painted coat', image, .32 if eye else .84)
        else:
            shader = next(n for n in old.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            image = shader.inputs['Base Color'].links[0].from_node.image
            if kind == 'rabbit':
                # Only the two eye islands of the supplied UV atlas change.
                # Preserve the ears and nose; turn the albino-red irises hazel.
                import numpy as np
                image.scale(1024, 1024)
                pixels = np.array(image.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)
                vv, uu = np.mgrid[0:1024, 0:1024] / 1024
                # The GLB embeds a vertically flipped copy of the supplied PNG.
                vv = 1 - vv
                # The atlas also paints the lids directly onto the head island.
                for u, v, rx, ry in [(.050, .779, .041, .058), (.946, .754, .039, .057), (.455, .134, .018, .023), (.542, .150, .016, .024)]:
                    radius = ((uu - u) / rx) ** 2 + ((vv - v) / ry) ** 2
                    blend = np.clip((1 - radius) / .18, 0, 1)[..., None]
                    luminance = (pixels[:, :, :3] * np.array([.299, .587, .114])).sum(axis=2)[..., None]
                    hazel = luminance * np.array([.43, .32, .22])
                    pixels[:, :, :3] = pixels[:, :, :3] * (1 - blend) + hazel * blend
                image = bpy.data.images.new('Rabbit / painted hazel eyes', width=1024, height=1024, alpha=True)
                image.pixels.foreach_set(pixels.ravel())
                image.update()
            mat = textured_material(f'Pet / {kind} / painted coat', image, .84)
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for face in obj.data.polygons:
            face.material_index = 0
            face.use_smooth = True
    body = max(objects, key=lambda o: len(o.data.vertices))
    # The rabbit stays a small, bare companion: no scarf.
    if kind != 'rabbit':
        objects += accessories(body, kind, height / {'cat': .5, 'dog': .65}[kind])
    if kind in ['dog', 'rabbit']:
        decimate = body.modifiers.new('Companion triangle budget', 'DECIMATE')
        decimate.ratio = .34 if kind == 'dog' else .42
    pet_id = {'cat': 'fripouille', 'dog': 'ranger-dog', 'rabbit': 'meadow-rabbit'}[kind]
    # The world-space companion sits to the hero's left (+X), feet on the floor.
    for index, obj in enumerate(objects):
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        obj.data.transform(Matrix.Translation(Vector(({'cat': .34, 'dog': .40, 'rabbit': .35}[kind], .03, 0))))
        obj.name = f'Pet / {pet_id} / {index:02d}'
        obj['shop_slot'] = 'pet'
        obj['shop_id'] = pet_id
        obj['source_archive'] = archive.name
    bpy.context.view_layer.update()
    triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objects)
    lower, upper = bounds(objects)
    assert triangles < 22000, (pet_id, triangles)
    assert abs(lower.z) < .001 and upper.z < .7
    assert all(all(math.isfinite(c) for c in v.co) for o in objects for v in o.data.vertices)
    return pet_id, objects, {
        'sourceArchive': archive.name, 'sourceSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'triangles': triangles, 'meshes': len(objects), 'heightMeters': height,
        'bounds': [list(lower), list(upper)], 'validation': 'PASS',
        'adaptation': ('Small seated still pose, soft cream coat, hazel eyes, no scarf; no rig or animation.' if kind == 'rabbit' else 'Original coat and anatomy; matte painted materials and a plain fitted woven scarf; static supplied pose.')
    }


def import_dragon(archive, temporary):
    dest = temporary / 'dragon'
    extract_archive(archive, dest)
    extract_archive(dest / 'source/dragonFinal.zip', dest / 'model')
    before = set(bpy.context.scene.objects)
    bpy.ops.wm.obj_import(filepath=str(dest / 'model/dragoPosato.obj'))
    body = next(o for o in set(bpy.context.scene.objects) - before if o.type == 'MESH')
    body.data.transform(body.matrix_world)
    body.matrix_world = Matrix.Identity(4)
    # The delivered OBJ has separate eyes and a separate spiky hair tuft, but
    # keeps them in one mesh. Identify islands before editing to retain body UVs.
    adjacency = {v.index: set() for v in body.data.vertices}
    for edge in body.data.edges:
        a, b = edge.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)
    pending, islands = set(adjacency), []
    while pending:
        first = pending.pop()
        island, queue = {first}, [first]
        while queue:
            for neighbor in adjacency[queue.pop()] & pending:
                pending.remove(neighbor)
                island.add(neighbor)
                queue.append(neighbor)
        islands.append(island)
    eye_material = next(i for i, mat in enumerate(body.data.materials) if mat.name.startswith('occhiSG'))
    eye_vertices = {v for p in body.data.polygons if p.material_index == eye_material for v in p.vertices}
    eyes = [island for island in islands if island <= eye_vertices]
    crest = [island for island in islands if len(island) > 1000 and min(body.data.vertices[i].co.z for i in island) > 2]
    assert len(eyes) == 2 and len(crest) == 1, 'Unexpected source head topology'
    centers = [sum((body.data.vertices[i].co for i in island), Vector()) / len(island) for island in eyes]
    centers.sort(key=lambda c: c.x)
    right = (centers[1] - centers[0]).normalized()
    forward = Vector((right.y, -right.x, 0)).normalized()
    up = Vector((0, 0, 1))
    removed = eye_vertices | crest[0]
    # Contract the surrounding sockets as well as replacing the globes: smaller
    # eyes must sit in the skull, not float inside the original oversized holes.
    for vertex in body.data.vertices:
        if vertex.index in removed:
            continue
        center = min(centers, key=lambda c: (vertex.co - c).length)
        delta = vertex.co - center
        weight = max(0, min(1, (.37 - delta.length) / .19))
        weight = weight * weight * (3 - 2 * weight)
        vertex.co -= delta * (.10 * weight) + forward * (.014 * weight)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in removed], context='VERTS')
    bm.to_mesh(body.data)
    bm.free()
    image = bpy.data.images.load(str(dest / 'textures/dragonExploded5_lo_body_M_BaseColor.png'))
    coat = textured_material('Pet / dragon / original turquoise coral gold', image, .78)
    body.data.materials.clear()
    body.data.materials.append(coat)
    for polygon in body.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True
    # Game-style face: large, round, bright eyes read as friendly; a dark rim
    # and eyelid outline, a vertical oval pupil and a gold crest keep it epic.
    rim = material('Pet / dragon / deep teal eye rim', (.012, .055, .07), .4)
    liner = material('Pet / dragon / dark teal eyelids', (.03, .15, .17), .7)
    gold = material('Pet / dragon / bright gold iris', (.95, .60, .12), .28)
    dark = material('Pet / dragon / rounded vertical pupils', (.012, .03, .045), .25)
    shine = material('Pet / dragon / eye catchlights', (1, 1, 1), .1)
    glow = next(n for n in shine.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    glow.inputs['Emission Color'].default_value = (1, 1, 1, 1)
    glow.inputs['Emission Strength'].default_value = .8
    crest_gold = material('Pet / dragon / gold head crest', (.80, .52, .16), .45, .3)
    objects = [body]

    def disc(name, point, radius_x, radius_z, mat, lift, cx=0, cz=0):
        # Concentric rings so the decal follows the eye curvature instead of
        # cutting chords through it.
        rings, count = 4, 24
        verts = [point(cx, cz, lift)]
        for ring in range(1, rings + 1):
            s = ring / rings
            for i in range(count):
                a = math.tau * i / count
                verts.append(point(cx + s * radius_x * math.cos(a), cz + s * radius_z * math.sin(a), lift))
        faces = [(0, i + 1, (i + 1) % count + 1) for i in range(count)]
        for ring in range(rings - 1):
            base = 1 + ring * count
            for i in range(count):
                j = (i + 1) % count
                faces.append((base + i, base + count + i, base + count + j, base + j))
        objects.append(mesh(name, verts, faces, mat))

    for side, original in enumerate(centers):
        center = original - forward * .025
        # Round, open eyes: friendly, not sleepy or menacing.
        rx, ry, rz = .148, .11, .15
        vertices, faces = [], []
        rows, cols = 16, 24
        for row in range(rows + 1):
            phi = math.pi * row / rows
            for col in range(cols):
                theta = math.tau * col / cols
                vertices.append(center + right * (rx * math.sin(phi) * math.cos(theta))
                                + forward * (ry * math.sin(phi) * math.sin(theta)) + up * (rz * math.cos(phi)))
        for row in range(rows):
            for col in range(cols):
                a = row * cols + col
                b = row * cols + (col + 1) % cols
                faces.append((a, a + cols, b + cols, b))
        objects.append(mesh(f'dragon / eye rim {side}', vertices, faces, rim))

        def eye_front(x, z, lift=0):
            depth = ry * math.sqrt(max(0, 1 - (x / rx) ** 2 - (z / rz) ** 2))
            return center + right * x + up * z + forward * (depth + .0015 + lift)

        # Large gold iris leaving a thin dark rim, a soft vertical oval pupil
        # and two catchlights on the same upper-left side of both eyes.
        disc(f'dragon / gold iris {side}', eye_front, .118, .124, gold, .002)
        disc(f'dragon / oval pupil {side}', eye_front, .036, .066, dark, .004)
        disc(f'dragon / catchlight {side}', eye_front, .027, .027, shine, .006, -.045, .052)
        disc(f'dragon / small catchlight {side}', eye_front, .012, .012, shine, .006, .038, -.038)
        # Thin dark lids only trim the top and bottom: a clean outline instead
        # of heavy half-closed lids.
        for upper in [True, False]:
            verts, faces = [], []
            for i in range(25):
                a = math.pi * i / 24
                x = rx * math.cos(a)
                sign = 1 if upper else -1
                z = sign * (.128 if upper else .136) * math.sin(a)
                verts.append(eye_front(x, z, .002))
                verts.append(center + right * (x * 1.12) + up * (sign * .176 * math.sin(a)) + forward * .012)
            for i in range(24):
                a = i * 2
                faces.append((a, a + 2, a + 3, a + 1))
            objects.append(mesh(f'dragon / {"upper" if upper else "lower"} lid {side}', verts, faces, liner))
    # Replace only the head tuft with one low gold crest. The tail plume,
    # horns, wings, armour and their authored colour placement remain intact.
    crest_center = Vector((-.15, .24, 2.29))
    verts, faces = [], []
    for row in range(13):
        t = row / 12
        height = .012 + .12 * math.sin(math.pi * t)
        width = .008 + .045 * math.sin(math.pi * t)
        for col in range(12):
            a = math.tau * col / 12
            verts.append(crest_center + forward * (.34 - .70 * t) + right * (width * math.cos(a)) + up * (height * (.5 + .5 * math.sin(a))))
    for row in range(12):
        for col in range(12):
            a, b = row * 12 + col, row * 12 + (col + 1) % 12
            faces.append((a, b, b + 12, a + 12))
    faces += [tuple(reversed(range(12))), tuple(range(144, 156))]
    objects.append(mesh('dragon / low gold crest', verts, faces, crest_gold))
    lower, upper = bounds(objects)
    factor = .70 / (upper.z - lower.z)
    middle = (lower + upper) * .5
    # Swing the long tail backwards (away from the hero's feet); the head then
    # turns slightly towards the hero.
    transform = Matrix.Rotation(-.6, 4, 'Z') @ Matrix.Scale(factor, 4) @ Matrix.Translation(Vector((-middle.x, -middle.y, -lower.z)))
    for obj in objects:
        obj.data.transform(transform)
    lower, upper = bounds(objects)
    # Keep the whole dragon, tail tip included, clear of the hero's boots.
    place = Matrix.Translation(Vector((.24 - lower.x, -(lower.y + upper.y) * .5, 0)))
    for index, obj in enumerate(objects):
        obj.data.transform(place)
        obj.name = f'Pet / starry-dragon / {index:02d}'
        obj['shop_slot'] = 'pet'
        obj['shop_id'] = 'starry-dragon'
        obj['source_archive'] = archive.name
    bpy.context.view_layer.update()
    lower, upper = bounds(objects)
    triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objects)
    assert triangles < 30000 and abs(lower.z) < .001 and upper.z < .71
    return 'starry-dragon', objects, {
        'sourceArchive': archive.name, 'sourceSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'triangles': triangles, 'meshes': len(objects), 'heightMeters': .70,
        'bounds': [list(lower), list(upper)], 'validation': 'PASS',
        'adaptation': 'Original turquoise, coral and gold body texture; game-style face: large round gold eyes with dark rim, soft oval pupils, catchlights, thin dark eyelid outline and a low gold crest. Original wings, horns and tail plume retained.',
        'headRevision': 'friendly-epic-v2'
    }


def shoulder_surface():
    """The hero's actual shoulder: both bases and every outfit, as one BVH.

    A downward ray returns the highest surface, so the feet rest on whichever
    outfit is thickest there and never sink into another one.
    """
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/character-stylized/catalogue.glb'))
    bpy.context.view_layer.update()
    imported = set(bpy.data.objects) - before
    verts, polys = [], []
    for obj in imported:
        if obj.type != 'MESH' or obj.get('shop_slot') not in ('persona', 'outfit', 'core'):
            continue
        base = len(verts)
        verts += [obj.matrix_world @ v.co for v in obj.data.vertices]
        # Only geometry below 1.45 m: the chin starts ~1.48 m and the shoulder
        # tops out at 1.433 m, so this keeps the head out of the seat raycasts.
        polys += [[base + i for i in p.vertices] for p in obj.data.polygons
                  if min((obj.matrix_world @ obj.data.vertices[i].co).z for i in p.vertices) < 1.45]
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    return BVHTree.FromPolygons(verts, polys)


def seat_on_shoulder(body, sink=.002, lift=0., hug=.004, stance=.01):
    """Seat the bird on the hero's shoulder, both feet flat on the cloth.

    1. One rigid roll of the whole bird follows the shoulder slope.
    2. `lift` raises the body a touch; the short legs stretch to keep contact,
       so the feet show between the belly and the cloth.
    3. Each foot gets its own planar fit (a small rigid-like tilt, blended up
       its leg) so the whole sole lies on the domed shoulder, not one claw.
    4. The toes hug the cloth with a capped correction (`hug`), so the claws
       never stretch down the slope.
    The shoulder is the real geometry of both bases and every outfit.
    Returns [inner, outer] mean sole clearance (negative = claws in fabric).
    """
    bvh = shoulder_surface()
    legs = body.vertex_groups['feet'].index
    soles = body.vertex_groups['sole'].index

    def weight(v, group):
        return next((e.weight for e in v.groups if e.group == group), 0)

    def cast(co):
        hit = bvh.ray_cast(Vector((co.x, co.y, 1.52)), Vector((0, 0, -1)), .45)[0]
        return hit if hit is not None and hit.z > 1.30 else None

    sole = [v for v in body.data.vertices if weight(v, soles) > .5]
    split = sum(v.co.x for v in sole) / len(sole)

    def side(v):
        return v.co.x < split

    # A narrower stance: the outer foot steps in, off the edge of the shoulder
    # roll, the leg leaning in as a bird's does when it grips a round perch.
    for v in body.data.vertices:
        w = weight(v, legs)
        if w and not side(v):
            v.co.x -= stance * w
    split -= stance / 2

    def clearances(inner):
        rows = []
        for v in sole:
            if side(v) == inner:
                hit = cast(v.co)
                if hit is not None:
                    rows.append((v.co.z - hit.z, v))
        if not rows:
            raise ValueError('Parrot feet are off the shoulder')
        return rows

    # 1. Rigid roll: the two feet meet the slope, the deepest sole point grips.
    for _ in range(5):
        inner, outer = clearances(True), clearances(False)
        g1 = sum(sorted(g for g, _ in inner)[:4]) / 4
        g2 = sum(sorted(g for g, _ in outer)[:4]) / 4
        x1 = sum(v.co.x for _, v in inner) / len(inner)
        x2 = sum(v.co.x for _, v in outer) / len(outer)
        tilt = max(-.2, min(.2, (g2 - g1) / (x2 - x1)))
        pivot = Vector((x1, 0, 1.41))
        body.data.transform(Matrix.Translation(Vector((0, 0, -(min(g1, g2) + sink))))
                            @ Matrix.Translation(pivot) @ Matrix.Rotation(tilt, 4, 'Y') @ Matrix.Translation(-pivot))
    # 2. Lift the body; the feet are brought back down below.
    body.data.transform(Matrix.Translation(Vector((0, 0, lift))))
    # 3. Per-foot planar fit: dz = a + b*(x-cx) + c*(y-cy) brings every sole
    #    point to -sink; applied to the whole foot and faded up the leg.
    for inner in (True, False):
        rows = clearances(inner)
        cx = sum(v.co.x for _, v in rows) / len(rows)
        cy = sum(v.co.y for _, v in rows) / len(rows)
        A = [[1, v.co.x - cx, v.co.y - cy] for _, v in rows]
        t = [-(g + sink) for g, _ in rows]
        ata = Matrix([[sum(r[i] * r[j] for r in A) for j in range(3)] for i in range(3)])
        atb = Vector([sum(r[i] * b for r, b in zip(A, t)) for i in range(3)])
        a, b, c = ata.inverted() @ atb
        b, c = max(-.45, min(.45, b)), max(-.45, min(.45, c))
        for v in body.data.vertices:
            w = weight(v, legs)
            if w and side(v) == inner:
                v.co.z += (a + b * (v.co.x - cx) + c * (v.co.y - cy)) * w
    # 4. Capped hug: the toes follow the last millimetres of the cloth.
    for v in body.data.vertices:
        if weight(v, legs) > .99:
            hit = cast(v.co)
            if hit is not None:
                below = v.co.z - hit.z + sink   # >0: above the cloth
                # Only sole-level points are pulled; upper toe skin just follows.
                if weight(v, soles) > .5:
                    v.co.z -= max(-hug, min(hug, below))
    # Tail feathers resting on the upper back: push any tip that dips into
    # the cloth back onto it.
    for v in body.data.vertices:
        if weight(v, legs) < .3:
            loc, normal, _, dist = bvh.find_nearest(v.co)
            if loc is not None and dist < .03 and (v.co - loc).dot(normal) < 0:
                v.co = loc + normal * .002
    body.data.update()
    inner, outer = clearances(True), clearances(False)
    worst = max(g for g, _ in inner + outer)
    deepest = min(g for g, _ in inner + outer)
    gaps = [round(sum(g for g, _ in rows) / len(rows), 4) for rows in (inner, outer)]
    print('PARROT_FEET', gaps, 'worst', round(worst, 4), 'deepest', round(deepest, 4))
    return gaps, round(worst, 4)


def import_parrot(archive, temporary, anchor=(.16, 0., 1.412), lift=.006):
    """A shoulder companion: perched on the hero's left shoulder, not on the floor."""
    dest = temporary / 'parrot'
    extract_archive(archive, dest)
    with bpy.data.libraries.load(str(dest / 'source/Parrot.blend')) as (source, target):
        target.objects = [name for name in source.objects if name == 'node_id30']
    body = target.objects[0]
    bpy.context.scene.collection.objects.link(body)
    body.data = body.data.copy()
    # The perch (claws) is at z=0 in the source; the bird looks towards +X.
    # Turn it to look forward with the hero (-Y): the tail then hangs down the back.
    # matrix_world is not evaluated yet for an appended object; the stored
    # basis is its world transform (it has no parent).
    body.data.transform(body.matrix_basis)
    body.matrix_basis = Matrix.Identity(4)
    points = [v.co for v in body.data.vertices]
    head = max(p.z for p in points)
    feet = [p for p in points if abs(p.z) < .2 and -1.2 < p.x < 1.2]
    # Toes and lower legs, in source units: full weight on the toes, fading
    # up the leg. The group survives decimation and drives the foot patch.
    # The two feet stand in columns (source y≈-0.88 and y≈+0.37); the belly and
    # the under-tail lie between them and must never follow the feet.
    legs = body.vertex_groups.new(name='feet')
    sole = body.vertex_groups.new(name='sole')
    for v in body.data.vertices:
        column = abs(v.co.y + .88) < .45 or abs(v.co.y - .37) < .45
        if column and v.co.x > -.95 and v.co.z < .9:
            legs.add([v.index], 1 if v.co.z < .35 else (.9 - v.co.z) / .55, 'REPLACE')
            if v.co.z < .1:
                sole.add([v.index], 1, 'REPLACE')
    perch = Vector((sum(p.x for p in feet) / len(feet), sum(p.y for p in feet) / len(feet), 0))
    factor = .21 / head
    # On top of the shoulder, beside the neck: ~1.6 cm from Noa's ear and
    # ~2.2 cm from Mila's (never touching), feet on the front half of the
    # shoulder so they show from the front and three-quarter views.
    shoulder = Vector(anchor)
    body.data.transform(Matrix.Translation(shoulder) @ Matrix.Rotation(-math.pi / 2, 4, 'Z')
                        @ Matrix.Scale(factor, 4) @ Matrix.Translation(-perch))
    old = body.data.materials[0]
    image = next(n.image for n in old.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image.name.startswith('Image_0'))
    coat = textured_material('Pet / parrot / painted scarlet feathers', image, .8)
    body.data.materials.clear()
    body.data.materials.append(coat)
    for polygon in body.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True
    decimate = body.modifiers.new('Companion triangle budget', 'DECIMATE')
    decimate.ratio = .55
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    foot_gaps, foot_worst = seat_on_shoulder(body, lift=lift)
    body.name = 'Pet / scarlet-parrot / 00'
    body['shop_slot'] = 'pet'
    body['shop_id'] = 'scarlet-parrot'
    body['mount'] = 'shoulder'
    body['source_archive'] = archive.name
    bpy.context.view_layer.update()
    lower, upper = bounds([body])
    triangles = sum(len(p.vertices) - 2 for p in body.data.polygons)
    assert triangles < 22000 and 1.1 < lower.z and upper.z < 1.7, (triangles, lower, upper)
    return 'scarlet-parrot', [body], {
        'sourceArchive': archive.name, 'sourceSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'triangles': triangles, 'meshes': 1, 'heightMeters': .21, 'mount': 'shoulder',
        'footGaps': foot_gaps, 'footWorstGap': foot_worst,
        'bounds': [list(lower), list(upper)], 'validation': 'PASS',
        'adaptation': 'Scarlet macaw perched on the hero’s left shoulder (shared by both bases), looking forward, tail down the back; matte painted feathers, static pose.'
    }


def render_previews(pets):
    scene = bpy.context.scene
    try:
        scene.render.engine = 'CYCLES'
    except TypeError as error:
        raise RuntimeError(f'Cycles is required: {error}')
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    enum(scene.render.image_settings, 'file_format', 'WEBP')
    enum(scene.render.image_settings, 'color_mode', 'RGBA')
    scene.render.image_settings.quality = 90
    scene.render.resolution_x = scene.render.resolution_y = 480
    scene.render.resolution_percentage = 100
    scene.world.color = (.23, .23, .23)
    for pos, energy in [((1, -3, 4), 180), ((-3, -1, 2), 100), ((1, 3, 3), 160)]:
        light = bpy.data.lights.new('Pet studio', 'AREA')
        light.energy = energy
        light.size = 3
        obj = bpy.data.objects.new('Pet studio', light)
        scene.collection.objects.link(obj)
        obj.location = pos
        obj.rotation_euler = (Vector((.5, 0, .3)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.cameras.new('Pet studio')
    enum(data, 'type', 'ORTHO')
    camera = bpy.data.objects.new('Pet studio', data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    for pet_id, objects in pets.items():
        for other in pets.values():
            for obj in other:
                obj.hide_render = obj not in objects
        lower, upper = bounds(objects)
        center = (lower + upper) * .5
        camera.location = center + Vector((1.8, -3, .95))
        camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        points = [camera.matrix_world.inverted() @ (o.matrix_world @ v.co) for o in objects for v in o.data.vertices]
        data.ortho_scale = max(max(p[i] for p in points) - min(p[i] for p in points) for i in [0, 1]) * 1.2
        midpoint = Vector([(max(p[i] for p in points) + min(p[i] for p in points)) * .5 for i in [0, 1]] + [0])
        camera.location += camera.rotation_euler.to_matrix() @ midpoint
        scene.render.filepath = str(PREVIEWS / 'items' / (pet_id + '.webp'))
        bpy.ops.render.render(write_still=True)


args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 5:
    raise SystemExit('Expected: -- CAT.zip DOG.zip DRAGON.zip RABBIT.zip PARROT.zip')
OUT.mkdir(parents=True, exist_ok=True)
(PREVIEWS / 'items').mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
pets, report = {}, {'revision': REVISION, 'units': 'meters', 'up': '+Y in glTF', 'forward': '+Z in glTF', 'items': {}}
with tempfile.TemporaryDirectory(prefix='odyssey-pets-') as temp:
    for archive, kind in zip(args[:2], ['cat', 'dog']):
        pet_id, objects, info = import_pet(Path(archive).resolve(), kind, Path(temp))
        pets[pet_id] = objects
        report['items'][pet_id] = info
    pet_id, objects, info = import_dragon(Path(args[2]).resolve(), Path(temp))
    pets[pet_id] = objects
    report['items'][pet_id] = info
    pet_id, objects, info = import_pet(Path(args[3]).resolve(), 'rabbit', Path(temp))
    pets[pet_id] = objects
    report['items'][pet_id] = info
    pet_id, objects, info = import_parrot(Path(args[4]).resolve(), Path(temp))
    pets[pet_id] = objects
    report['items'][pet_id] = info
    bpy.ops.object.select_all(action='DESELECT')
    for objects in pets.values():
        for obj in objects:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / 'catalogue.glb'), use_selection=True,
                              export_extras=True, export_animations=False, export_image_format='JPEG', export_jpeg_quality=90)
    render_previews(pets)
report['bytes'] = (OUT / 'catalogue.glb').stat().st_size
report['sha256'] = hashlib.sha256((OUT / 'catalogue.glb').read_bytes()).hexdigest()
(OUT / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
preview_report = json.loads((PREVIEWS / 'manifest.json').read_text())
for pet_id, objects in pets.items():
    preview_report['items'][pet_id] = {'slot': 'pet', 'file': f'items/{pet_id}.webp', 'meshCount': len(objects), 'containsBody': False, 'source': 'assets/pets/catalogue.glb', 'revision': REVISION}
(PREVIEWS / 'manifest.json').write_text(json.dumps(preview_report, indent=2) + '\n')
print('PETS_READY', json.dumps(report), flush=True)
