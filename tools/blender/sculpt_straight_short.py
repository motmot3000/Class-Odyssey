"""Sculpt Straight Short Hair, the shared short cut worn by Noa and Mila.

A classic short cut rather than a helmet: a side part, a fringe swept
diagonally across the forehead with lift at its roots, fuller top, sides kept
close to the skull and a graduated nape. Every lock is grown on the measured
skull of the live characters:

* clumps of hair split into finer strands toward their tips, each a tapered
  lens-section volume, so the surface reads as hair instead of ribbons;
* the side contour follows the measured ear outline with a constant margin
  (sideburn in front, a clean arc over the ear, a taper behind it); locks flatten
  against the skull as they approach that contour, like a barber's finish;
* a vertex shade (darker roots, lighter tips, per-strand tone) multiplies the
  shop hair colour, which the game still sets on every `Hair /` material;
* a fitted underlayer closes the scalp between the locks.

The output keeps the catalogue construction frame (Blender Z up, front -Y,
metres) of every supplied cut; `build-items-3d.py` fits it to each head through
the hat-seat transform and conforms it to that character's skin.

    blender -b --factory-startup --python-exit-code 1 \
      --python tools/blender/sculpt_straight_short.py
"""
import bmesh
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/characters-refit/hair'
CATALOGUE = ROOT / 'assets/character-stylized/catalogue.glb'
MANIFEST = ROOT / 'assets/character-stylized/manifest.json'
HEAD_CACHE = Path('/tmp/opencode/sculpt-short-cuts-head.json')
HAIR_ID = 'straight-short'
REVISION = 'sculpted-straight-short-v2'
SEED = 9031
TAU = math.tau
O = Vector((0.0, -0.005, 1.625))      # skull centre in the construction frame
C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
SHADE = 'HairShade'


# --------------------------------------------------------------------------
# Measured head: both personas' skins, mapped back into the construction frame
# --------------------------------------------------------------------------

def load_heads():
    if HEAD_CACHE.exists():
        data = json.loads(HEAD_CACHE.read_text())
        if data.get('source_size') == CATALOGUE.stat().st_size:
            return [BVHTree.FromPolygons([Vector(v) for v in h['verts']], h['faces']) for h in data['heads']]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(CATALOGUE))
    manifest = json.loads(MANIFEST.read_text())
    heads = []
    for persona in ['male', 'female']:
        m = manifest['headFits'][persona]['templateToCharacter']
        inverse = (C.inverted() @ Matrix([[m[c * 4 + r] for c in range(4)] for r in range(4)]) @ C).inverted()
        skin = next(o for o in bpy.data.objects if o.type == 'MESH' and o.get('part') == 'skin'
                    and o.get('fit_persona') == persona)
        verts = [inverse @ (skin.matrix_world @ v.co) for v in skin.data.vertices]
        keep = {i for i, v in enumerate(verts) if v.z > 1.38}
        index = {old: new for new, old in enumerate(sorted(keep))}
        faces = [[index[i] for i in p.vertices] for p in skin.data.polygons if all(i in keep for i in p.vertices)]
        heads.append({'verts': [tuple(round(c, 6) for c in verts[i]) for i in sorted(keep)], 'faces': faces})
    HEAD_CACHE.parent.mkdir(parents=True, exist_ok=True)
    HEAD_CACHE.write_text(json.dumps({'source_size': CATALOGUE.stat().st_size, 'heads': heads}))
    return [BVHTree.FromPolygons([Vector(v) for v in h['verts']], h['faces']) for h in heads]


HEADS = load_heads()


def _cast(origin, d):
    best = 0.0
    for tree in HEADS:
        hit = tree.ray_cast(origin, d, .45)
        if hit[0] is not None:
            best = max(best, (hit[0] - O).length)
    return best


def skull_radius(d):
    """Outer skin along d; under the ear flap, the cranium the flap grows from."""
    outer = _cast(O + d * .40, -d) or .115
    if abs(d.x) > .5 and d.z < .15:
        inner = _cast(O, d)
        if inner and outer - inner > .004:
            return inner
    return outer


def direction(az, el):
    """az 0 = front (-Y), +90 = +X; el up from the skull-centre equator."""
    return Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))


def azimuth_deg(p):
    return abs(math.degrees(math.atan2(p.x, -(p.y - O.y))))


def lerp_table(table, x):
    if x <= table[0][0]:
        return table[0][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def rotate(v, axis, angle):
    return v * math.cos(angle) + axis.cross(v) * math.sin(angle) + axis * axis.dot(v) * (1 - math.cos(angle))


def tangent(d, v):
    t = v - d * v.dot(d)
    return t.normalized() if t.length > 1e-6 else t


# --------------------------------------------------------------------------
# Contour: forehead, temples, sideburns, the measured ear, the nape
# --------------------------------------------------------------------------

# Side projection of the ear flap (y, z) in the construction frame, measured by
# lateral rays on both skins: front edge y -.026, tip y .056 / z 1.614.
EAR = [(-.026, 1.593), (-.015, 1.600), (.000, 1.604), (.015, 1.607), (.030, 1.610),
       (.045, 1.614), (.056, 1.615), (.058, 1.606), (.051, 1.592), (.045, 1.582),
       (.037, 1.570), (.030, 1.560), (.024, 1.552), (.016, 1.545), (.007, 1.536),
       (-.002, 1.527), (-.012, 1.520), (-.022, 1.522), (-.028, 1.535), (-.028, 1.560),
       (-.027, 1.580)]

# Lowest hair by |azimuth| (deg): forehead with a soft temple recess, sideburn
# in front of the ear, the level behind the ear, then the graduated nape.
FLOOR = [(0, 1.694), (20, 1.692), (36, 1.686), (48, 1.672), (56, 1.645), (62, 1.606),
         (67, 1.572), (74, 1.566), (76, 1.540), (125, 1.536), (145, 1.522), (165, 1.513), (180, 1.509)]
FRONT = 60          # below this |azimuth| the fringe may fall over the forehead

# Fringe stop above the brows by |x| (the face), same as the delivered cuts.
BROW = [(0.0, 1.648), (.035, 1.652), (.070, 1.657), (.088, 1.632), (.098, 1.600), (.106, 1.550), (.2, 1.550)]


def ear_distance(y, z):
    """Signed distance to the ear outline in side view: negative inside."""
    inside = False
    best = float('inf')
    for i, (ay, az) in enumerate(EAR):
        by, bz = EAR[(i + 1) % len(EAR)]
        dy, dz = by - ay, bz - az
        t = max(0.0, min(1.0, ((y - ay) * dy + (z - az) * dz) / (dy * dy + dz * dz)))
        best = min(best, math.hypot(y - ay - t * dy, z - az - t * dz))
        if (az > z) != (bz > z) and y < ay + (z - az) * dy / dz:
            inside = not inside
    return -best if inside else best


def contour_distance(p):
    """How far p sits inside the side/back contour (metres); large at the front/top."""
    az = azimuth_deg(p)
    dist = 1.0
    if az > FRONT:
        dist = p.z - lerp_table(FLOOR, az)
    if abs(p.x) > .05:
        dist = min(dist, ear_distance(p.y, p.z))
    return dist


def on_face(p, offset=0.0):
    if p.y > -.045:
        return False
    return p.z < lerp_table(BROW, abs(p.x)) + offset


# --------------------------------------------------------------------------
# Flow: side part, diagonal fringe, sides combed down and back, crown whorl
# --------------------------------------------------------------------------

PART_FRONT = direction(math.radians(-26), math.radians(40))
PART_CROWN = direction(math.radians(-14), math.radians(78))
PART = PART_CROWN.cross(PART_FRONT).normalized()     # points toward the full (+X) side
WHORL = direction(math.pi + .18, math.radians(58))


def part_side(d):
    return 1 if d.dot(PART) >= 0 else -1


def flow(d, seed):
    side = part_side(d)
    near_part = math.exp(-abs(d.dot(PART)) / .16) * smooth((d.z - .35) / .4)
    front = smooth((-d.y - .2) / .35) * smooth((d.z + .05) / .35)
    back = smooth((d.y - .05) / .4) * smooth((d.z - .05) / .5)
    # Down and slightly back behind the temple; straight down over the sideburn.
    temple = smooth((-d.y - .05) / .3)
    down = Vector((0, .32 - .45 * temple, -1))
    across = PART * side
    # Full side sweeps over the forehead toward the far temple; the short side
    # of the part falls neatly toward its own temple.
    # Forward-and-across at the top becomes a diagonal sweep over the forehead.
    sweep = Vector((.55, -1, -.15)) if side > 0 else Vector((-.35, -.4, -1))
    v = (down * (1 - .7 * front) + across * (2.3 * near_part * (1 - .75 * front) + .55 * smooth((d.z - .15) / .5))
         + sweep * front * (3.0 if side > 0 else 1.2) + (d - WHORL) * back * 2.2)
    crown = math.exp(-d.angle(WHORL) / .22)
    v += d.cross(WHORL).normalized() * crown * 1.4 if crown > .01 else Vector()
    v += noise.noise_vector(d * 4.5 + Vector((seed, 0, 0))) * .10
    return tangent(d, v)


# --------------------------------------------------------------------------
# Geometry
# --------------------------------------------------------------------------

def resample(points, count):
    lengths = [0.0]
    for a, b in zip(points, points[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]
    out, j = [], 0
    for k in range(count + 1):
        s = total * k / count
        while j < len(points) - 2 and lengths[j + 1] < s:
            j += 1
        span = max(1e-9, lengths[j + 1] - lengths[j])
        out.append(points[j].lerp(points[j + 1], (s - lengths[j]) / span))
    return out, total


def truncate(points, fraction):
    total = sum((b - a).length for a, b in zip(points, points[1:]))
    keep, run = [points[0]], 0.0
    for a, b in zip(points, points[1:]):
        step = (b - a).length
        if run + step >= total * fraction:
            keep.append(a.lerp(b, (total * fraction - run) / max(step, 1e-9)))
            break
        keep.append(b)
        run += step
    return keep


def surface_normal(p):
    centre = Vector((0.0, O.y, min(p.z, O.z)))
    n = p - centre
    return n.normalized() if n.length > 1e-6 else Vector((0, 0, 1))


def frames(points):
    out = []
    for k, p in enumerate(points):
        forward = (points[min(k + 1, len(points) - 1)] - points[max(k - 1, 0)]).normalized()
        n = surface_normal(p)
        n = (n - forward * n.dot(forward)).normalized()
        out.append((forward, forward.cross(n).normalized(), n))
    return out


def lock_mesh(path, width, depth, taper, tone, sides=5, segments=10, tip=.00035, root_width=.35):
    """Lens-section tapered strand; returns vertices, faces, uvs, shades."""
    points, total = resample(path, segments)
    verts, faces, uvs, shades = [], [], [], []
    for k, (p, (forward, side, n)) in enumerate(zip(points, frames(points))):
        t = k / segments
        body = 1 - smooth((t - taper) / (1 - taper)) ** .8
        root = root_width + (1 - root_width) * smooth(t / .2)
        w = max(tip, width * body * root)
        h = max(tip * .6, depth * body ** .6 * (.6 + .4 * root))
        shade = min(1.0, tone * (.70 + .30 * smooth(t / .45)) + .05 * smooth((t - .75) / .25))
        for i in range(sides):
            a = TAU * i / sides + .3
            y = math.sin(a)
            y *= 1.0 if y > 0 else .4
            verts.append(p + side * (w * math.cos(a)) + n * (h * y))
            uvs.append((i / sides, t * total / .06))
            shades.append(shade)
    for k in range(segments):
        for i in range(sides):
            a, b = k * sides + i, k * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple(segments * sides + i for i in range(sides)))
    return verts, faces, uvs, shades


class Builder:
    def __init__(self, name, material):
        self.name, self.material = name, material
        self.verts, self.faces, self.uvs, self.shades = [], [], [], []
        self.strands = 0

    def add(self, verts, faces, uvs, shades):
        base = len(self.verts)
        self.verts += verts
        self.uvs += uvs
        self.shades += shades
        self.faces += [tuple(base + i for i in f) for f in faces]
        self.strands += 1

    def build(self):
        data = bpy.data.meshes.new(self.name)
        data.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        uv = data.uv_layers.new(name='FibreFlow')
        for poly in data.polygons:
            poly.use_smooth = True
            for loop in poly.loop_indices:
                uv.data[loop].uv = self.uvs[data.loops[loop].vertex_index]
        shade = data.color_attributes.new(SHADE, 'FLOAT_COLOR', 'POINT')
        for i, value in enumerate(self.shades):
            shade.data[i].color = (value, value, value, 1.0)
        data.validate(clean_customdata=False)
        data.update()
        obj = bpy.data.objects.new(self.name, data)
        bpy.context.scene.collection.objects.link(obj)
        data.materials.append(self.material)
        return obj


def hair_material():
    material = bpy.data.materials.new('Hair / sculpted fibres')
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Roughness'].default_value = .5
    attribute = nodes.new('ShaderNodeVertexColor')
    attribute.layer_name = SHADE
    mix = nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[6].default_value = (.20, .12, .07, 1)
    links.new(attribute.outputs['Color'], mix.inputs[7])
    links.new(mix.outputs[2], shader.inputs['Base Color'])
    return material


# --------------------------------------------------------------------------
# Cut
# --------------------------------------------------------------------------

CAP_MARGIN = .0045


def cap_inside(d, lift=.0022):
    p = O + d * (skull_radius(d) + lift)
    az = azimuth_deg(p)
    if az <= FRONT:
        return p.z >= lerp_table(FLOOR, az)
    return contour_distance(p) >= CAP_MARGIN


def underlayer(material, cols=168, step=math.radians(2.1)):
    """Fitted scalp cap clipped exactly on the cut's contour.

    A fine az/el grid is kept where it lies inside the contour; vertices just
    outside are slid onto the contour along their grid edge, so the edge
    follows the ear arc smoothly instead of stepping column by column.
    """
    rows = int((math.pi / 2 + 1.0) / step)
    grid = [[direction(TAU * i / cols, math.pi / 2 - .004 - j * step) for i in range(cols)] for j in range(rows)]
    inside = [[cap_inside(d) for d in row] for row in grid]

    def boundary(d_in, d_out):
        a, b = d_in, d_out
        for _ in range(9):
            m = (a + b).normalized()
            if cap_inside(m):
                a = m
            else:
                b = m
        return a

    index, verts, uvs, shades, faces = {}, [], [], [], []

    def vertex(j, i):
        key = (j, i)
        if key in index:
            return index[key]
        d = grid[j][i]
        if not inside[j][i]:
            best = None
            for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                jj, ii = j + dj, (i + di) % cols
                if 0 <= jj < rows and inside[jj][ii]:
                    candidate = boundary(grid[jj][ii], d)
                    if best is None or (candidate - d).length < (best - d).length:
                        best = candidate
            d = best if best is not None else d
        index[key] = len(verts)
        verts.append(O + d * (skull_radius(d) + .0022 + .0005 * noise.noise(d * 30)))
        uvs.append((i / cols * 12, j / rows * 6))
        shades.append(.60 + .05 * noise.noise(d * 12))
        return index[key]

    for j in range(rows - 1):
        for i in range(cols):
            quad = [(j, i), (j + 1, i), (j + 1, (i + 1) % cols), (j, (i + 1) % cols)]
            if any(inside[a][b] for a, b in quad):
                faces.append(tuple(vertex(a, b) for a, b in quad))
    b = Builder(f'{HAIR_ID} / hairline underlayer', material)
    b.add(verts, faces, uvs, shades)
    cap = b.build()
    # Slid edge vertices can fold a quad: drop slivers, keep normals outward.
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    bmesh.ops.dissolve_degenerate(bm, dist=.0006, edges=bm.edges[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(cap.data)
    bm.free()
    cap.data.update()
    return cap


def roots(rng, count, accept):
    golden = math.pi * (3 - math.sqrt(5))
    n = int(count * 1.8)
    out = []
    for k in range(n):
        z = 1 - (k + .5) / n * 2
        d = direction(k * golden + rng.uniform(-.04, .04), math.asin(z) + rng.uniform(-.02, .02))
        p = O + d * skull_radius(d)
        az = azimuth_deg(p)
        if az <= FRONT and p.z < lerp_table(FLOOR, az) + .004:
            continue
        if az > FRONT and contour_distance(p) < .006:
            continue
        if abs(d.dot(PART)) < .005 and d.z > .45:   # keep a clean, thin part line
            continue
        if accept(d, p):
            out.append(d)
    rng.shuffle(out)
    return out


def lift_profile(d, rng, scale=1.0):
    """Volume on the top and at the fringe roots, close at the sides and nape."""
    top = smooth((d.z - .15) / .6)
    front = smooth((-d.y - .45) / .3) * smooth((d.z - .3) / .4)
    part = math.exp(-abs(d.dot(PART)) / .12) * smooth((d.z - .4) / .35)
    short_side = .6 if part_side(d) < 0 else 1.0
    base = (.0022 + .0068 * top + .0020 * front + .0028 * part) * rng.uniform(.7, 1.15) * scale * short_side
    rise = base * (1.15 + .25 * front)

    def lift(t):
        # Stands off at the root, then settles onto the layer below.
        return rise * smooth(t / .16) * (1 - .45 * smooth((t - .2) / .8)) + .0012
    return lift


def grow(d, params):
    step = .003
    heading = flow(d, params['seed'])
    points = []
    travelled = 0.0
    params['stop'] = 'length'
    while travelled < params['length']:
        t = travelled / params['length']
        r = skull_radius(d)
        probe = O + d * r
        # Locks flatten onto the skull as they reach the side contour.
        near = .22 + .78 * smooth(contour_distance(probe) / .022)
        p = O + d * (r + params['lift'](t) * near)
        if points:
            az = azimuth_deg(p)
            if az > FRONT and contour_distance(probe) < params['margin']:
                params['stop'] = 'contour'
                break
            if on_face(p, params['brow']):
                params['stop'] = 'face'
                break
        points.append(p)
        f = flow(d, params['seed'])
        if params.get('bias'):
            f = rotate(f, d, params['bias'] * (1 - .6 * t))
        heading = tangent(d, heading.lerp(f, .3))
        wave = params.get('wave', 0.0)
        h = rotate(heading, d, wave * math.sin(travelled * 90 + params['seed'])) if wave else heading
        d = (d + h * (step / max(.08, r))).normalized()
        travelled += step
    return points


def split(path, params, rng):
    """A clump of hair: strands share the guide, then fan out toward the tips."""
    k = params['strands']
    if k == 1:
        return [(path, params['width'], params['depth'], params['tone'])]
    dense, _ = resample(path, 24)
    out = []
    for s in range(k):
        across = ((s + .5) / k - .5) * params['width'] * 1.7 + rng.uniform(-.0012, .0012)
        rise = rng.uniform(-.4, .4) * params['depth']
        fan = rng.uniform(.8, 1.3)
        pts = []
        for j, (p, (_f, side, n)) in enumerate(zip(dense, frames(dense))):
            t = j / 24
            spread = .35 + .65 * t ** 1.2 * fan
            pts.append(p + side * across * spread + n * rise * t)
        pts = truncate(pts, rng.uniform(params.get('keep', .80), 1.0))
        width = params['width'] * rng.uniform(.52, .70) * (1.5 / k + .25)
        out.append((pts, width, params['depth'] * rng.uniform(.75, .95),
                    params['tone'] * rng.uniform(.94, 1.04)))
    return out


def layers():
    def clump(d, rng):
        side_hair = smooth((.35 - d.z) / .5)
        top = smooth((d.z - .45) / .4)
        front = smooth((-d.y - .4) / .35)
        back = smooth((d.y - .15) / .4)
        return {
            'length': rng.uniform(.080, .110) + .035 * top + .03 * front + .03 * back - .025 * side_hair,
            'lift': lift_profile(d, rng), 'width': rng.uniform(.0100, .0145), 'depth': rng.uniform(.0032, .0042),
            'taper': rng.uniform(.45, .62), 'strands': rng.choice([2, 3, 3]),
            'bias': rng.uniform(-.14, .14), 'wave': rng.uniform(0, .05), 'segments': 8, 'sides': 4,
        }

    def fringe(d, rng):
        # The swept fringe: long clumps with lifted roots, uneven diagonal tips.
        return {
            'length': rng.uniform(.13, .18), 'lift': lift_profile(d, rng, 1.15),
            'width': rng.uniform(.0105, .0140), 'depth': rng.uniform(.0032, .0040),
            'taper': rng.uniform(.58, .70), 'strands': rng.choice([2, 3, 3]),
            'bias': rng.uniform(-.10, .12), 'wave': .03, 'segments': 9, 'sides': 4,
        }

    def under(d, rng):
        return {
            'length': rng.uniform(.06, .09), 'lift': (lambda t, b=rng.uniform(.0012, .0026): b),
            'width': rng.uniform(.012, .016), 'depth': .0028, 'taper': .5, 'strands': 1,
            'tone': rng.uniform(.74, .82), 'segments': 5, 'sides': 4,
        }

    def contour(d, rng):
        # Short fine hair along the contour: a clean, precise edge.
        return {
            'length': rng.uniform(.018, .034), 'lift': (lambda t: .0011),
            'width': rng.uniform(.0032, .0048), 'depth': .0016, 'taper': .7, 'strands': 1,
            'margin': CAP_MARGIN - .0015, 'segments': 5, 'sides': 4, 'min_length': .008,
        }

    def flyaway(d, rng):
        lift = lift_profile(d, rng, 1.0)
        return {
            'length': rng.uniform(.06, .10), 'lift': (lambda t, f=lift: f(t) + .0012 * t),
            'width': rng.uniform(.0018, .0028), 'depth': .0013, 'taper': .35, 'strands': 1,
            'bias': rng.uniform(-.3, .3), 'wave': .08, 'segments': 9, 'sides': 4,
        }

    def parting(d, rng):
        # Flat clumps laid away from the part line: a clean part, no gap.
        return {
            'length': rng.uniform(.05, .08), 'lift': lift_profile(d, rng, .45),
            'width': rng.uniform(.0085, .0115), 'depth': .0030, 'taper': .5, 'strands': 2,
            'segments': 6, 'sides': 4, 'root_width': .85,
        }

    def crown(d, rng):
        return {
            'length': rng.uniform(.06, .09), 'lift': lift_profile(d, rng, .8),
            'width': rng.uniform(.0095, .013), 'depth': .0034, 'taper': .5, 'strands': rng.choice([2, 3]),
            'segments': 7, 'sides': 4,
        }

    def is_fringe(d, p):
        return d.y < -.30 and part_side(d) > 0 and p.z < lerp_table(FLOOR, azimuth_deg(p)) + .06

    return [
        {'count': 150, 'params': under},
        {'count': 900, 'params': fringe, 'accept': is_fringe},
        {'count': 205, 'params': clump, 'accept': lambda d, p: not is_fringe(d, p)},
        {'count': 3400, 'params': contour, 'accept': lambda d, p: azimuth_deg(p) > FRONT - 4
         and contour_distance(p) < .016},
        {'count': 900, 'params': crown, 'accept': lambda d, p: d.angle(WHORL) < .46},
        {'count': 2600, 'params': parting, 'accept': lambda d, p: d.z > .42 and abs(d.dot(PART)) < .07
         and d.angle(WHORL) > .3},
        {'count': 24, 'params': flyaway, 'accept': lambda d, p: d.z > .25 and abs(d.dot(PART)) > .12},
    ]


def build(material):
    rng = random.Random(SEED)
    cap = underlayer(material)
    locks = Builder(f'{HAIR_ID} / sculpted locks', material)
    for layer in layers():
        before = (locks.strands, len(locks.faces))
        for d in roots(rng, layer['count'], layer.get('accept', lambda d, p: True)):
            params = layer['params'](d, rng)
            params.setdefault('seed', rng.uniform(0, 50))
            params.setdefault('tone', rng.uniform(.86, 1.0))
            params.setdefault('margin', CAP_MARGIN - .0005 + rng.uniform(0, .001))
            params.setdefault('brow', rng.uniform(-.002, .012) if abs(d.x) < .6 else 0.0)
            path = grow(d, params)
            if len(path) < 3:
                continue
            length = sum((b - a).length for a, b in zip(path, path[1:]))
            if length < max(params.get('min_length', .012), 3.2 * params['width']):
                continue
            path[0] = path[0] - surface_normal(path[0]) * .004   # root sinks into the cap
            if params['stop'] == 'contour':
                # Cut at the contour: full width to the edge, then a short point.
                params['taper'] = max(params['taper'], .88)
                params['keep'] = .96
            for pts, width, depth, tone in split(path, params, rng):
                if len(pts) < 3:
                    continue
                locks.add(*lock_mesh(pts, width, depth, params['taper'], tone,
                                     sides=params.get('sides', 5), segments=params['segments'],
                                     root_width=params.get('root_width', .35)))
        print('LAYER', layer['params'].__name__, locks.strands - before[0], 'strands', len(locks.faces) - before[1], 'faces', flush=True)
    return locks.build(), cap, locks.strands


def export():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    material = hair_material()
    obj, cap, count = build(material)
    for o in (obj, cap):
        o['hair_reference_revision'] = REVISION
        o['hair_source'] = 'tools/blender/sculpt_straight_short.py'
    cap['hair_layer'] = 'fitted underlayer ending on the cut contour'
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    cap.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = OUT / f'{HAIR_ID}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_yup=True, export_animations=False, export_extras=True)
    points = [v.co for v in obj.data.vertices]
    report = {
        'revision': REVISION, 'hairId': HAIR_ID,
        'source': 'tools/blender/sculpt_straight_short.py', 'seed': SEED,
        'attribution': 'Authored for Class Odyssey; locks grown on the measured Noa and Mila skulls.',
        'strands': count,
        'outerTriangles': sum(len(f.vertices) - 2 for f in obj.data.polygons),
        'underlayerTriangles': sum(len(f.vertices) - 2 for f in cap.data.polygons),
        'vertexShade': f'{SHADE}: multiplies the shop hair colour (roots darker, tips lighter)',
        'earOutline': 'side projection measured on both skins, construction frame (y, z)',
        'coordinates': 'Construction frame: Blender Z up, front -Y; glTF Y up, front +Z; metres',
        'bounds': {'min': [round(min(p[i] for p in points), 4) for i in range(3)],
                   'max': [round(max(p[i] for p in points), 4) for i in range(3)]},
        'output': path.name,
    }
    (OUT / f'{HAIR_ID}.json').write_text(json.dumps(report, indent=2) + '\n')
    print('SCULPTED_HAIR_READY', json.dumps(report), flush=True)


export()
