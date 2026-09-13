"""Build the simplified, stylized comparison alternative in Blender.

blender --background --factory-startup --python tools/blender/playful_ranger.py
No input model or generated image: the portrait is rendered from this scene.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'character-lab'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
character = bpy.data.collections.new('Jeune éclaireur — editable pieces')
scene.collection.children.link(character)


def material(name, color, roughness=.65, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat


skin = material('Warm peach • skin', (.63, .32, .17), .72)
blush = material('Terracotta • rosy cheeks', (.58, .18, .12), .8)
green = material('Fern green • plain cotton tunic', (.075, .18, .12), .86)
hood_mat = material('Moss • simple cloth hood', (.055, .115, .074), .9)
edge = material('Muted sage • sewn edges', (.14, .235, .145), .85)
ochre = material('Ochre • small scarf', (.34, .19, .065), .85)
leather = material('Cinnamon • boots and satchel', (.22, .085, .037))
sole = material('Dark cocoa • soles', (.075, .032, .022))
trousers = material('Blue spruce • trousers', (.075, .16, .16))
hair = material('Chestnut • swept hair', (.045, .021, .012), .85)
eyes = material('Espresso • eyes and smile', (.018, .012, .01), .3)
ivory = material('Warm ivory • eye lights and stitches', (.9, .83, .64), .48)
brass = material('Aged brass • lantern frame', (.34, .205, .065), .62, .3)
glow = material('Amber • lantern light', (.9, .45, .12), .5, emission=.25)


def finish(obj, name, mat):
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    character.objects.link(obj)
    obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def ellipsoid(name, location, scale, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location)
    obj = finish(bpy.context.object, name, mat)
    obj.scale = scale
    obj.rotation_euler = rotation
    return obj


def pebble(name, location, size, mat, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = finish(bpy.context.object, name, mat)
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('Soft tailored corners', 'BEVEL')
    mod.width = bevel
    mod.segments = 4
    obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return obj


def stroke(name, points, radius, mat, cyclic=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = point.handle_right_type = 'AUTO'
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    character.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def limb(name, start, end, width, depth, mat):
    a, b = Vector(start), Vector(end)
    obj = ellipsoid(name, (a+b)/2, (width, depth, (b-a).length/2 + width*.48), mat)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def garment(name, rings, mat, segments=48):
    vertices, faces = [], []
    for z, rx, ry, x, y in rings:
        for i in range(segments):
            t = i * math.tau / segments
            vertices.append((x + rx*math.cos(t), y + ry*math.sin(t), z))
    for ring in range(len(rings)-1):
        for i in range(segments):
            j = (i+1) % segments
            faces.append((ring*segments+i, ring*segments+j, (ring+1)*segments+j, (ring+1)*segments+i))
    faces.extend([tuple(reversed(range(segments))), tuple((len(rings)-1)*segments+i for i in range(segments))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    character.objects.link(obj)
    mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    sub = obj.modifiers.new('Soft cloth volume', 'SUBSURF')
    sub.levels = sub.render_levels = 2
    return obj


# A small relaxed stride, with rounded walking boots rather than armour.
for side, x, y in [('Left', -.145, -.055), ('Right', .145, .035)]:
    limb(f'{side} trouser leg', (x, y, .26), (x*.85, .015, .68), .085, .082, trousers)
    pebble(f'{side} boot sole', (x, y-.065, .055), (.255, .36, .085), sole, .038)
    ellipsoid(f'{side} rounded boot toe', (x, y-.095, .14), (.128, .185, .105), leather)
    pebble(f'{side} boot upper', (x, y+.025, .205), (.207, .21, .22), leather, .065)
    pebble(f'{side} folded boot cuff', (x, y+.025, .294), (.211, .216, .055), leather, .015)
    for z in [.175, .21]:
        stroke(f'{side} boot lace', [(x-.055, y-.087, z), (x, y-.095, z-.014), (x+.055, y-.087, z)], .009, ivory)

garment('Rounded A-line tunic', [(.52,.23,.155,0,0),(.54,.26,.17,0,0),(.62,.25,.18,0,0),(.83,.20,.16,0,0),(1.08,.245,.165,-.018,0),(1.19,.19,.14,-.02,0),(1.22,.12,.11,0,0)], green)
stroke('Tunic hem piping', [(.244*math.cos(i*math.tau/24), .167*math.sin(i*math.tau/24), .558) for i in range(24)], .012, edge, True)
garment('Soft short cape', [(.61,.29,.09,0,.16),(.64,.32,.11,0,.18),(.89,.30,.12,-.015,.175),(1.13,.31,.135,-.02,.1),(1.22,.13,.09,0,.03)], hood_mat)
pebble('Canvas backpack', (0,.255,.96), (.32,.17,.34), leather, .048)
pebble('Backpack flap', (0,.343,1.06), (.30,.035,.14), leather, .025)
stroke('Backpack loop', [(-.06,.255,1.145),(-.06,.255,1.24),(.06,.255,1.24),(.06,.255,1.145)], .018, leather)
for x in [-.17,.17]:
    stroke('Backpack shoulder strap', [(x,.2,1.1),(x,-.06,1.17),(x,-.17,1.02),(x,-.165,.87)], .017, leather)
garment('Cinnamon waist belt', [(.75,.216,.172,0,0),(.758,.22,.177,0,0),(.82,.22,.176,0,0),(.827,.217,.171,0,0)], leather)
pebble('Rounded brass belt buckle', (.035,-.185,.791), (.105,.025,.092), brass, .018)
pebble('Buckle opening', (.035,-.202,.791), (.059,.01,.049), sole, .009)
pebble('Small side satchel', (.24,-.025,.708), (.15,.18,.19), leather, .044)
pebble('Satchel flap', (.24,-.118,.753), (.145,.025,.10), leather, .023)
ellipsoid('Satchel snap', (.24,-.138,.735), (.015,.01,.015), brass)
ellipsoid('Neck', (0,0,1.23), (.10,.095,.14), skin)

# A relaxed asymmetric stance, with one hand resting by the hip.
limb('Relaxed sleeve', (-.205,0,1.12), (-.34,.005,.945), .085,.082,green)
limb('Relaxed forearm', (-.351,.005,.945), (-.29,-.075,.778), .054,.050,skin)
ellipsoid('Relaxed cuff', (-.345,.005,.949), (.071,.064,.043), edge, (0,.20,0))
ellipsoid('Relaxed hand', (-.282,-.093,.753), (.057,.039,.072), skin, (0,-.18,0))
for i in range(3):
    stroke('Resting finger crease', [(-.319+i*.021,-.128,.763),(-.315+i*.021,-.13,.73)], .0025, leather)
limb('Lantern sleeve', (.21,0,1.125), (.315,-.005,.94), .085,.082,green)
limb('Lantern forearm', (.32,-.015,.942), (.39,-.12,.825), .056,.052,skin)
ellipsoid('Lantern cuff', (.33,-.032,.925), (.072,.065,.043), edge, (0,.25,0))
ellipsoid('Lantern holding hand', (.405,-.123,.798), (.056,.045,.065), skin)

# Honey neckerchief, gently rounded points and a separate knot.
stroke('Neckerchief collar', [(-.13,-.045,1.215),(-.125,-.137,1.192),(0,-.174,1.175),(.125,-.137,1.192),(.13,-.045,1.215)], .027, ochre)
ellipsoid('Neckerchief knot', (-.025,-.195,1.17), (.029,.025,.029), ochre)
ellipsoid('Neckerchief tip', (-.047,-.181,1.098), (.034,.014,.083), ochre, (0,-.20,0))

# Stylized face, kept in its own group for adolescent head/body proportions.
body_objects = set(character.objects)
ellipsoid('Soft forest hood', (0,.064,1.587), (.383,.31,.414), hood_mat)
ellipsoid('Friendly face', (0,-.077,1.554), (.297,.252,.329), skin)
stroke('Hood opening seam', [(-.273,-.13,1.334),(-.334,-.13,1.51),(-.299,-.15,1.755),(-.16,-.155,1.92),(.055,-.15,1.97),(.267,-.135,1.81),(.339,-.12,1.56),(.279,-.13,1.337)], .018, edge)
for sign in [-1,1]:
    ellipsoid('Round ear', (sign*.287,-.08,1.533), (.055,.051,.074), skin)
    ellipsoid('Ear inset', (sign*.312,-.118,1.533), (.022,.012,.039), blush)
    x = sign*.117
    ellipsoid('Almond eye', (x,-.303,1.607), (.049,.015,.034), ivory)
    ellipsoid('Espresso iris', (x+.008,-.318,1.606), (.022,.011,.029), eyes)
    ellipsoid('Small eye glint', (x+.001,-.329,1.616), (.006,.004,.008), ivory)
    stroke('Quiet eyebrow', [(x-.052,-.292,1.677),(x,-.31,1.692),(x+.048,-.285,1.68)], .012, hair)
ellipsoid('Sculpted nose', (.015,-.331,1.527), (.030,.043,.057), skin)
stroke('Subtle smile', [(-.077,-.287,1.438),(-.022,-.307,1.425),(.033,-.305,1.432),(.066,-.289,1.444)], .006, leather)
# Three broad swept locks, tapered instead of the first version's round curls.
for i, (x, y, z, angle) in enumerate([(-.17,-.218,1.80,-.65),(-.034,-.242,1.838,-.80),(.117,-.206,1.834,-.85)]):
    obj = garment(f'Swept hair plane {i+1}', [(-.16,.004,.004,0,0),(-.09,.065,.028,0,0),(.015,.085,.035,0,0),(.10,.055,.025,0,0),(.13,.015,.01,0,0)], hair, segments=16)
    obj.location = (x,y,z)
    obj.rotation_euler.y = angle
head_objects = set(character.objects) - body_objects

# A compact lantern, the one recognizable accessory of this simpler outfit.
lx, ly = .425, -.12
stroke('Lantern carrying loop', [(lx-.064,ly,.657),(lx-.073,ly,.753),(lx,ly,.792),(lx+.073,ly,.753),(lx+.064,ly,.657)], .014, brass)
ellipsoid('Lantern warm light', (lx,ly,.519), (.099,.09,.133), glow)
pebble('Lantern bottom', (lx,ly,.386), (.235,.215,.055), brass, .023)
pebble('Lantern cap', (lx,ly,.651), (.216,.205,.054), brass, .021)
ellipsoid('Lantern cap finial', (lx,ly,.69), (.03,.03,.029), brass)
for dx in [-.084,.084]:
    for dy in [-.077,.077]:
        stroke('Lantern cage post', [(lx+dx,ly+dy,.407),(lx+dx*1.11,ly+dy*1.11,.52),(lx+dx,ly+dy,.631)], .012, brass)

# Convert curves and evaluate modifiers for a portable, material-only GLB.
bpy.ops.object.select_all(action='DESELECT')
for obj in character.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = next(iter(character.objects))
bpy.ops.object.convert(target='MESH')
# Lengthen the legs, narrow the boots and reduce the head to roughly 1:4.
# Apply in world space so seams, facial features and accessories remain aligned.
for obj in character.objects:
    matrix = obj.matrix_world.copy()
    for vertex in obj.data.vertices:
        co = matrix @ vertex.co
        if obj in head_objects:
            co.x *= .58
            co.y *= .58
            co.z = 1.50 + (co.z - 1.235) * .58
        else:
            if obj.name.startswith(('Lantern carrying', 'Lantern warm', 'Lantern bottom', 'Lantern cap', 'Lantern cage')):
                co = Vector((lx, ly, .79)) + (co-Vector((lx, ly, .79)))*.76
            if 'boot' in obj.name:
                co.x = obj.location.x + (co.x-obj.location.x)*.85
                co.y = obj.location.y + (co.y-obj.location.y)*.87
            co.z = co.z*1.03 if co.z < .3 else (.309+(co.z-.3)*1.6 if co.z < .7 else .949+(co.z-.7)*1.06)
        vertex.co = co
    obj.matrix_world = Matrix.Identity(4)
bpy.ops.export_scene.gltf(filepath=str(OUT/'ranger-playful.glb'), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_animations=False)
triangles = sum(len(obj.data.polygons) and sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in character.objects)
scene['art_direction'] = 'Jeune éclaireur: a simple stylized adolescent adventurer, approximately four heads tall, relaxed asymmetric stance, small calm eyes, subtle smile, matte fern-green tunic, understated ochre scarf and brass lantern. Approachable video-game character, neither epic realism nor a child mascot.'
scene['source_costume'] = 'ClassQuest: vocab-ranger, shadow-hood, lore-lantern'
scene['prototype'] = 'Static, no rig. Independently modeled in Blender; no AI reconstruction.'

# Transparent studio portrait, matching the existing comparison asset format.
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 1100
scene.render.resolution_y = 1400
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
world = bpy.data.worlds.new('Soft daylight')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.65,.75,.85,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
scene.world = world


def area(name, position, energy, color, size):
    bpy.ops.object.light_add(type='AREA', location=position)
    obj = bpy.context.object
    obj.name = name
    obj.data.energy = energy
    obj.data.color = color
    obj.data.shape = 'DISK'
    obj.data.size = size
    obj.rotation_euler = (Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()


area('Large warm window', (-3,-4,5), 380, (1,.88,.72), 4)
area('Soft cool fill', (3,-2,3), 190, (.8,.9,1), 3)
area('Mint rim', (1,3,4), 420, (.85,1,.9), 3)
bpy.ops.object.camera_add(location=(.65,-6,2.55))
camera = bpy.context.object
camera.name = 'Jeune éclaireur — portrait'
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.38
camera.rotation_euler = (Vector((-.03,0,1.02))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera = camera
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT/'ranger-playful-portrait.png')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ranger-playful.blend'))
bpy.ops.render.render(write_still=True)
provenance = {
    'character': 'ClassQuest — Jeune éclaireur',
    'date': '2026-09-12',
    'method': 'Procedural Blender mesh modeling, no generated reference or reconstruction service',
    'blender': bpy.app.version_string,
    'script': 'tools/blender/playful_ranger.py',
    'direction': scene['art_direction'],
    'sourceCostume': scene['source_costume'],
    'model': {'file': 'ranger-playful.glb', 'triangles': triangles, 'rigged': False},
    'scene': 'ranger-playful.blend',
    'portrait': {'files': ['ranger-playful-portrait.png', 'ranger-playful-portrait.webp'], 'origin': 'Actual Cycles render of ranger-playful.blend, transparent film, three area lights. WebP converted from PNG.'}
}
(OUT/'ranger-playful-provenance.json').write_text(json.dumps(provenance, indent=2)+'\n')
print(f'PLAYFUL_RANGER_DONE: {triangles} triangles')
