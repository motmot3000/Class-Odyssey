"""Measure each fitted haircut against its character's skin and every hat.

Run: blender -b --factory-startup --python tools/measure-hair-fit.py
Reports, per character and per hair variant: how many hair vertices sit inside
the skin (clipping) or inside a hat, and the worst depth, so the fit is tuned
from numbers instead of eyeballing.
"""
import bpy
import json
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = str(ROOT / 'assets/character-stylized/catalogue.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CATALOGUE)


def tree_for(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    matrix = obj.matrix_world
    verts = [matrix @ v.co for v in mesh.vertices]
    faces = [list(p.vertices) for p in mesh.polygons]
    tree = BVHTree.FromPolygons(verts, faces)
    evaluated.to_mesh_clear()
    return tree, matrix


def signed_stats(obj, tree, region=None):
    matrix = obj.matrix_world
    inside = 0
    worst = 0.0
    far = 0.0
    for vertex in obj.data.vertices:
        world = matrix @ vertex.co
        if region and not region(world):
            continue
        location, normal, _index, _distance = tree.find_nearest(world, 0.12)
        if location is None:
            continue
        signed = (world - location).dot(normal)
        if signed < 0:
            inside += 1
            worst = min(worst, signed)
        elif world.z > 1.70:
            far = max(far, signed)
    return inside, round(worst * 1000, 1), round(far * 1000, 1)


# The visible face is where a buried strand reads as clipping: the bare brow,
# the cheeks and the jaw, in front of the ears.
def face_region(p):
    return p.z > 1.52 and p.y < -0.045


meshes = [o for o in bpy.data.objects if o.type == 'MESH']
skins = {o.get('fit_persona'): o for o in meshes if o.get('part') == 'skin' and o.get('fit_persona')}
skin_trees = {persona: tree_for(obj) for persona, obj in skins.items()}
hats = [o for o in meshes if o.get('shop_slot') == 'hat']
hat_trees = {o.name: tree_for(o) for o in hats}

# Mirror of src/items-3d-model.mjs: each hat picks the hair variant it needs.
COVERED_HATS = {'feather-beret', 'wizard-hat', 'classy-hat'}
OPEN_CROWNS = {'gold-crown', 'celestial-crown'}


def fit_for(hat):
    if hat == 'steel-helm':
        return None
    return 'covered' if hat in COVERED_HATS else 'crowned' if hat in OPEN_CROWNS else 'open'

report = {}
for hair in meshes:
    if hair.get('shop_slot') != 'hair':
        continue
    persona = hair.get('fit_persona')
    if persona not in skin_trees:
        continue
    tree, _ = skin_trees[persona]
    inside_skin, worst_skin, far_skin = signed_stats(hair, tree)
    face_inside, face_worst, _ = signed_stats(hair, tree, face_region)
    # A hair variant only meets the hats that actually select it.
    hat_inside = None
    for hat in hats:
        if hat.get('fit_persona') not in (persona, None):
            continue
        if fit_for(hat.get('shop_id')) != hair.get('hat_fit', 'open'):
            continue
        htree, _ = hat_trees[hat.name]
        hat_inside_count, hat_worst, _ = signed_stats(hair, htree)
        if hat_inside_count:
            hat_inside = (hat.get('shop_id'), hat_inside_count, hat_worst)
            break
    key = f"{persona}:{hair.get('shop_id')}:{hair.get('hat_fit', 'open')}"
    entry = report.setdefault(key, {
        'verts': 0,
        'inside_skin': 0,
        'worst_skin_mm': 0.0,
        'face_inside': 0,
        'face_worst_mm': 0.0,
        'crown_gap_mm': 0.0,
        'inside_hat': None
    })
    # A cut can be several meshes (e.g. the braid cut plus its hairline
    # underlayer): accumulate them so no piece hides another's clipping.
    entry['verts'] += len(hair.data.vertices)
    entry['inside_skin'] += inside_skin
    entry['worst_skin_mm'] = min(entry['worst_skin_mm'], worst_skin)
    entry['face_inside'] += face_inside
    entry['face_worst_mm'] = min(entry['face_worst_mm'], face_worst)
    entry['crown_gap_mm'] = max(entry['crown_gap_mm'], far_skin)
    if hat_inside and (not entry['inside_hat'] or hat_inside[1] > entry['inside_hat'][1]):
        entry['inside_hat'] = hat_inside

print('HAIR_FIT_REPORT ' + json.dumps(report, indent=1, sort_keys=True))
print('TOTAL_OBJECTS', len(meshes), 'skins', sorted(skins), 'hats', sorted(o.get('shop_id') for o in hats))
