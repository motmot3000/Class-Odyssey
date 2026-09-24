"""Author the Bun (chignon) cut from the supplied chignon model.

Source: `ком.blend` (ported-hair pack, `source/ком.zip`): one sculpted scalp
shell, a knot of nine twisted locks and a centre-parted curtain fringe around
a head of about the game's size (inner scalp radius ~0.106 m). Extract it once:

    unzip -o 'ported-hair.zip' -d /tmp/opencode/hair
    mkdir -p /tmp/opencode/hair/source/kom && cd /tmp/opencode/hair/source/kom
    unzip -o ../ком.zip && mv ./*.blend kom.blend            # or BUN_SOURCE=…

What the port does:

* `gathered crown`: the source scalp shell. Its inner surface is mapped,
  direction by direction, onto the skull of Noa and Mila measured in the
  delivered catalogue (assets/character-stylized, skin brought back to the
  authored frame through each character's headFits), so the cut hugs both
  heads and the build's conform pass has almost nothing to lift. A detail
  pass then combs fine strand grooves into its outer surface, all converging
  on the knot with a slight twist, so the back reads as hair pulled into the
  bun rather than a smooth cap.
* `knotted bun`: the source knot, moved rigidly. The source wears it high on
  the crown; it is swung down onto the occiput (the scalp around it follows
  with a falloff) so it stays entirely below 1.69 m: the build's `covered`
  cut (1.70 m) and `crowned` squeeze (above 1.712 m) never reach it, and the
  bun stays whole under hats.
* `bun fringe locks`: a centre-parted curtain fringe rebuilt as rounded
  locks (the source one is flat open ribbons that pass through one another).
  Two layers of locks follow the source's front: from the parting they arc
  around a tall oval face opening, pass beside (never over) the eyes and
  fall long down the cheeks to about the chin. The source shell is removed
  below a drawn hairline so it never shows on the forehead.
* `hair pin`: a slim beaded pin crossing the knot (gold in the catalogue).

UVs run along the strands (V), matching the vertical streaks of the app's
hair-normal map. Run:

    blender -b --factory-startup --python tools/port-bun-cut.py

Writes assets/characters-refit/hair/bun.glb (BUN_OUT=… to write elsewhere).
"""
import bpy
import bmesh
import json
import math
import os
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SRC = os.environ.get('BUN_SOURCE', '/tmp/opencode/hair/source/kom/kom.blend')
OUT = Path(os.environ.get('BUN_OUT', ROOT / 'assets' / 'characters-refit' / 'hair' / 'bun.glb'))
TAU = math.tau

CATALOGUE = ROOT / 'assets' / 'character-stylized' / 'catalogue.glb'
HC = Vector((0.0, -0.005, 1.639))            # authored head centre (port-braid-cut.py)
SKULL_MARGIN = 0.0025                         # hair shell above the measured skin
THETA_MAX = math.radians(96)                  # below: brows, ears; keep the rim radius
# Source frame: face toward -Y, Z up, like the game. Centre of a sphere fitted
# on the inner scalp above the ears.
SOURCE_CENTER = Vector((0.0, -0.0668, -0.0307))
SOURCE_BUN_DIR = Vector((0.0, 0.906, 0.422)).normalized()
# The knot is swung down about X onto the occiput, slightly below the centre.
BUN_DROP = math.radians(-29.0)
BUN_TOP_LIMIT = 1.690


def clamp(value, lo=0.0, hi=1.0):
    return max(lo, min(hi, value))


def smooth(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def table(points, u):
    for (u0, v0), (u1, v1) in zip(points, points[1:]):
        if u <= u1:
            return v0 + (v1 - v0) * smooth((u - u0) / (u1 - u0))
    return points[-1][1]


def rot_x(angle):
    return Matrix.Rotation(angle, 3, 'X')


# --- 0. Skulls of Noa and Mila in the authored frame -------------------------
def measure_skulls():
    """Noa's and Mila's skin, brought back into the authored frame.

    The build fits every cut to each character through `templateToCharacter`
    (depth x0.931, Mila 5% narrower). Measuring the delivered skins through
    the inverse transform makes the cut hug both heads before it is fitted.
    """
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fits = json.loads((CATALOGUE.parent / 'manifest.json').read_text())['headFits']
    bpy.ops.import_scene.gltf(filepath=str(CATALOGUE))
    to_gltf = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
    trees = []
    for persona, fit in fits.items():
        m = fit['templateToCharacter']
        gl = Matrix([[m[c * 4 + r] for c in range(4)] for r in range(4)])
        to_template = (to_gltf.inverted() @ gl @ to_gltf).inverted()
        skin = next(o for o in bpy.data.objects if o.type == 'MESH'
                    and o.get('part') == 'skin' and o.get('fit_persona') == persona)
        matrix = to_template @ skin.matrix_world
        trees.append(BVHTree.FromPolygons([matrix @ v.co for v in skin.data.vertices],
                                          [list(p.vertices) for p in skin.data.polygons]))
    return trees


SKULLS = measure_skulls()


def direction(theta, phi):
    return Vector((math.sin(theta) * math.cos(phi), math.sin(theta) * math.sin(phi), math.cos(theta)))


def to_angles(d):
    d = d.normalized()
    return math.acos(clamp(d.z, -1.0, 1.0)), math.atan2(d.y, d.x) % TAU


G_T, G_P = 49, 96                             # radius grids over theta <= THETA_MAX


def make_grid(sample):
    """Sample `sample(direction)` (None = unknown) on a theta/phi grid, fill
    the holes by diffusion and smooth, so the mapping has no seams."""
    grid = [[sample(direction(THETA_MAX * j / (G_T - 1), TAU * i / G_P)) for i in range(G_P)]
            for j in range(G_T)]
    known = [[value is not None for value in row] for row in grid]
    values = [v for row in grid for v in row if v is not None]
    mean = sum(values) / len(values)
    grid = [[mean if v is None else v for v in row] for row in grid]

    def neighbours(g, j, i):
        return [g[jj][ii % G_P] for jj, ii in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1))
                if 0 <= jj < G_T]

    for _ in range(200):
        grid = [[grid[j][i] if known[j][i] else sum(neighbours(grid, j, i)) / len(neighbours(grid, j, i))
                 for i in range(G_P)] for j in range(G_T)]
    for _ in range(3):
        grid = [[(grid[j][i] * 2 + sum(neighbours(grid, j, i))) / (2 + len(neighbours(grid, j, i)))
                 for i in range(G_P)] for j in range(G_T)]
    return grid


def grid_value(grid, d):
    theta, phi = to_angles(d)
    theta = min(theta, THETA_MAX)
    y = theta / THETA_MAX * (G_T - 1)
    x = phi / TAU * G_P
    j0 = min(int(y), G_T - 2)
    i0 = int(x) % G_P
    fy, fx = y - j0, x - int(x)
    i1 = (i0 + 1) % G_P
    top = grid[j0][i0] * (1 - fx) + grid[j0][i1] * fx
    bottom = grid[j0 + 1][i0] * (1 - fx) + grid[j0 + 1][i1] * fx
    return top * (1 - fy) + bottom * fy


def skull_sample(d):
    """Skin radius of both characters along `d` from the head centre, cast
    from the inside so the pointed ears never count as skull."""
    best = None
    for tree in SKULLS:
        hit = tree.ray_cast(HC, d, 0.3)
        if hit[0] is not None and (hit[0] - HC).length > 0.075:
            best = max(best or 0.0, (hit[0] - HC).length)
    return best


GAME = make_grid(skull_sample)


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


# --- 1. Source: shell, knot and fringe ---------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(SRC) as (data_from, data_to):
    data_to.objects = ['Model_mesh']
source = link(data_to.objects[0])
source.data.transform(source.matrix_world)
source.matrix_world = Matrix.Identity(4)

bm = bmesh.new()
bm.from_mesh(source.data)
bm.verts.ensure_lookup_table()
seen, islands = set(), []
for vert in bm.verts:
    if vert.index in seen:
        continue
    stack, component = [vert], []
    seen.add(vert.index)
    while stack:
        current = stack.pop()
        component.append(current.index)
        for edge in current.link_edges:
            other = edge.other_vert(current)
            if other.index not in seen:
                seen.add(other.index)
                stack.append(other)
    islands.append(component)
islands.sort(key=len, reverse=True)
role = {}
for n, component in enumerate(islands):
    centroid = sum((bm.verts[i].co for i in component), Vector()) / len(component)
    if n == 0:
        kind = 'crown'
    elif len(component) < 150:
        kind = None                       # brows and stray wisps (one-sided)
    elif centroid.y > -0.02:
        kind = 'bun'
    else:
        kind = 'fringe'
    for i in component:
        role[i] = kind
bm.free()


def split(kind, name):
    """Copy of the source keeping only the islands of `kind`."""
    mesh = source.data.copy()
    mesh.name = name
    obj = link(bpy.data.objects.new(name, mesh))
    b = bmesh.new()
    b.from_mesh(mesh)
    b.verts.ensure_lookup_table()
    bmesh.ops.delete(b, geom=[v for v in b.verts if role[v.index] != kind], context='VERTS')
    b.to_mesh(mesh)
    b.free()
    return obj


crown = split('crown', 'gathered crown')
bun = split('bun', 'knotted bun')
# The source fringe is flat, open ribbons that pass through one another;
# section 5c rebuilds it as rounded locks.
bpy.data.objects.remove(source, do_unlink=True)
# The knot is sculpted far denser (2.9 mm edges) than the rest of the cut:
# halve it, the twisted locks keep their shape.
decimate = bun.modifiers.new('decimate', 'DECIMATE')
decimate.ratio = 0.5
dense = bun.data
bun.data = bpy.data.meshes.new_from_object(bun.evaluated_get(bpy.context.evaluated_depsgraph_get()))
bun.modifiers.remove(decimate)
bpy.data.meshes.remove(dense)
bun.data.name = bun.name
print('SOURCE verts', {o.name: len(o.data.vertices) for o in (crown, bun)})

# --- 2. Swing the knot down; the scalp around it follows ---------------------
DROP = rot_x(BUN_DROP)
for v in bun.data.vertices:
    v.co = SOURCE_CENTER + DROP @ (v.co - SOURCE_CENTER)
for v in crown.data.vertices:
    offset = v.co - SOURCE_CENTER
    angle = offset.normalized().angle(SOURCE_BUN_DIR)
    w = smooth((math.radians(98) - angle) / math.radians(66))
    if w:
        v.co = SOURCE_CENTER + rot_x(BUN_DROP * w) @ offset
BUN_DIR = (DROP @ SOURCE_BUN_DIR).normalized()

# --- 3. Map the source scalp onto the measured skulls ------------------------
crown_tree = BVHTree.FromObject(crown, bpy.context.evaluated_depsgraph_get())


def source_sample(d):
    hit = crown_tree.ray_cast(SOURCE_CENTER, d, 0.3)
    if hit[0] is None:
        return None
    r = (hit[0] - SOURCE_CENTER).length
    return r if 0.075 < r < 0.15 else None


SOURCE_GRID = make_grid(source_sample)


def lift(d):
    """Radial shift that lays the source inner scalp on the game skin."""
    return grid_value(GAME, d) - grid_value(SOURCE_GRID, d) + SKULL_MARGIN


def map_point(p):
    offset = p - SOURCE_CENTER
    return HC + offset + offset.normalized() * lift(offset)


for v in crown.data.vertices:
    v.co = map_point(v.co)
# The knot moves as one piece, seated by the lift under its centre.
bun_shift = HC - SOURCE_CENTER + BUN_DIR * lift(BUN_DIR)
for v in bun.data.vertices:
    v.co += bun_shift

# Below the ears the source scalp (nape, under the knot) has no rim radius to
# follow and sinks into the neck: push it out, direction by direction, by what
# its inner surface lacks over the skin. Both shell faces move together.
mapped_tree = BVHTree.FromObject(crown, bpy.context.evaluated_depsgraph_get())
D_T, D_P = 72, 96


def deficit_sample(theta, phi):
    d = direction(theta, phi)
    hair = mapped_tree.ray_cast(HC, d, 0.3)
    if hair[0] is None:
        return 0.0
    skin = 0.0
    for tree in SKULLS:
        hit = tree.ray_cast(HC, d, 0.3)
        if hit[0] is not None:
            skin = max(skin, (hit[0] - HC).length)
    lack = skin + 0.0035 - (hair[0] - HC).length
    # Beyond 2 cm the ray has left the head (neck base, shoulders): not a sink.
    return lack if 0.0 < lack < 0.02 else 0.0


DEFICIT = [[deficit_sample(math.pi * j / (D_T - 1), TAU * i / D_P) for i in range(D_P)] for j in range(D_T)]
for _ in range(2):
    # Dilate then blur: the push covers the whole sunk patch and fades out.
    DEFICIT = [[max([DEFICIT[j][i]] + [DEFICIT[jj][ii % D_P] for jj, ii in
                ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)) if 0 <= jj < D_T])
                for i in range(D_P)] for j in range(D_T)]
for _ in range(3):
    DEFICIT = [[(DEFICIT[j][i] * 2 + sum(DEFICIT[jj][ii % D_P] for jj, ii in
                ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)) if 0 <= jj < D_T)) /
                (2 + sum(1 for jj in (j - 1, j + 1) if 0 <= jj < D_T) + 2)
                for i in range(D_P)] for j in range(D_T)]


def deficit(d):
    theta, phi = to_angles(d)
    y = theta / math.pi * (D_T - 1)
    x = phi / TAU * D_P
    j0 = min(int(y), D_T - 2)
    i0 = int(x) % D_P
    fy, fx = y - j0, x - int(x)
    i1 = (i0 + 1) % D_P
    return ((DEFICIT[j0][i0] * (1 - fx) + DEFICIT[j0][i1] * fx) * (1 - fy)
            + (DEFICIT[j0 + 1][i0] * (1 - fx) + DEFICIT[j0 + 1][i1] * fx) * fy)


pushed = 0
for v in crown.data.vertices:
    d = v.co - HC
    push = deficit(d)
    if push > 0.0003:
        pushed += 1
        v.co = HC + d.normalized() * (d.length + push)
crown.data.update()
print('NAPE pushed verts', pushed, 'max push mm', round(max(max(r) for r in DEFICIT) * 1000, 1))

# The source shell runs down to the brows under its fringe. Draw a hairline
# instead (high at the parting, lower at the temples, sideburns in front of
# the ears) and sink the shell below it into the skin.
HAIRLINE = ((0.0, 40.0), (25.0, 31.0), (45.0, 15.0), (60.0, -8.0), (75.0, -40.0), (82.0, -90.0))
sunk, below = 0, []
for v in crown.data.vertices:
    d = v.co - HC
    a = math.degrees(math.atan2(abs(d.x), -d.y))
    if a > 82.0:
        continue
    e = math.degrees(math.asin(clamp(d.z / d.length, -1.0, 1.0)))
    w = smooth((table(HAIRLINE, a) - e) / 6.0)
    skin = skull_sample(d.normalized())
    if not w or skin is None:
        continue
    r = d.length
    target = min(r, skin - 0.002)
    v.co = HC + d.normalized() * (r + (target - r) * w)
    sunk += 1
    if w > 0.5:
        below.append(v.index)
crown.data.update()
# The build's conform pass lifts anything under the skin back onto it, so the
# shell well below the hairline is removed rather than left sunk.
cut_bm = bmesh.new()
cut_bm.from_mesh(crown.data)
cut_bm.verts.ensure_lookup_table()
bmesh.ops.delete(cut_bm, geom=[cut_bm.verts[i] for i in below], context='VERTS')
cut_bm.to_mesh(crown.data)
cut_bm.free()
print('HAIRLINE sunk verts', sunk, 'removed', len(below))

# --- 5. Detail: fine strand grooves combed toward the knot -------------------
E1 = Vector((1.0, 0.0, 0.0))
E2 = BUN_DIR.cross(E1).normalized()
if E2.z < 0:
    E2 = -E2


def bun_angles(p):
    d = (p - HC).normalized()
    u = math.acos(clamp(d.dot(BUN_DIR), -1.0, 1.0))
    phi = math.atan2(d.dot(E2), d.dot(E1))
    return u, phi


crown.data.update()
normals = [v.normal.copy() for v in crown.data.vertices]
for v, n in zip(crown.data.vertices, normals):
    radial = (v.co - HC).normalized()
    if n.dot(radial) < 0.35:
        continue                         # inner surface and rim: untouched
    u, phi = bun_angles(v.co)
    # Locks (period ~3 cm) with crisp partings between them, and one groove
    # inside each lock; wavy, twisted into the knot, uneven in depth. Finer
    # strands come from the app's hair-normal map, whose V runs the same way.
    sweep = phi + 0.35 * u + 0.05 * math.sin(9 * u + 2 * phi)
    lock = abs(math.sin(9 * sweep + 0.6 * math.sin(3 * phi))) ** 0.45
    inner = abs(math.sin(18 * sweep + 1.1 + 0.9 * math.sin(4 * phi + u))) ** 0.6
    vary = 0.75 + 0.25 * math.sin(7 * phi + 2.0) * math.cos(4 * u)
    # Grooves fade under the knot and toward the front hairline.
    fade = smooth((u - 0.40) / 0.22) * smooth((2.60 - u) / 0.40)
    v.co += n * fade * vary * (0.0012 * (lock - 0.7) + 0.0005 * (inner - 0.6))
crown.data.update()

# --- 5b. Combed locks: real strands laid over the scalp into the knot --------
# Two layers of flattened locks run from the hairline (nape, temples, behind
# the fringe) to under the knot, twisting slightly as they gather. They give
# the back a true silhouette and the shadows of pulled-back hair.
outer_tree = BVHTree.FromObject(crown, bpy.context.evaluated_depsgraph_get())


def outer_surface(d):
    """Outer scalp point along `d` from the head centre, or None past the rim."""
    d = d.normalized()
    hit = outer_tree.ray_cast(HC + d * 0.3, -d, 0.3)
    if hit[0] is None or (hit[0] - HC).length < 0.08:
        return None
    return hit[0]


def bun_direction(u, phi):
    return (BUN_DIR * math.cos(u) + (E1 * math.cos(phi) + E2 * math.sin(phi)) * math.sin(u)).normalized()


U_END, U_FRONT, TWIST = 0.34, 2.15, 0.30
L_SAMPLES, L_RING = 36, 8


def lock_path(phi0, u_start, twist, wave):
    points = []
    for k in range(L_SAMPLES):
        t = k / (L_SAMPLES - 1)
        u = u_start + (U_END - u_start) * t
        phi = phi0 + twist * (u_start - u) + 0.035 * math.sin(7 * u + wave) * math.sin(math.pi * t)
        point = outer_surface(bun_direction(u, phi))
        if point is None:
            return None
        points.append(point)
    return points


def below_hairline(point):
    d = point - HC
    a = math.degrees(math.atan2(abs(d.x), -d.y))
    e = math.degrees(math.asin(clamp(d.z / d.length, -1.0, 1.0)))
    return a < 82.0 and e < table(HAIRLINE, a) + 5.0


def lock_start(phi0, twist):
    """Last scalp point before the rim or the hairline. Toward the face the
    locks run on under the fringe roots, so no bare shell shows between."""
    u = U_END + 0.1
    while u < U_FRONT:
        point = outer_surface(bun_direction(u + 0.03, phi0 - twist * 0.03))
        if point is None or below_hairline(point) or point.y < HC.y - 0.075:
            break
        u += 0.03
    return u - 0.05


def rand(seed):
    value = math.sin(seed * 12.9898) * 43758.5453
    return value - math.floor(value)


vertices, faces, uvs = [], [], []
layers = ((21, 0.0, 0.0010, 0.0044, 1.40), (14, 0.5, 0.0030, 0.0038, 1.20))
count = 0
for n_locks, phase, lift_mm, thick, width_scale in layers:
    for s in range(n_locks):
        seed = s + 31 * phase + 1
        jitter = rand(seed) - 0.5
        twist = TWIST * (1 + 0.4 * (rand(seed + 7) - 0.5))
        phi0 = (s + phase + 0.45 * jitter) * TAU / n_locks
        u_start = lock_start(phi0, twist) - 0.02 - 0.08 * rand(seed + 3)
        path = lock_path(phi0, u_start, twist, rand(seed + 5) * TAU)
        if path is None or u_start < U_END + 0.3:
            continue
        length = sum((path[k] - path[k - 1]).length for k in range(1, len(path)))
        base = len(vertices)
        arc = 0.0
        for k, point in enumerate(path):
            t = k / (L_SAMPLES - 1)
            if k:
                arc += (point - path[k - 1]).length
            tangent = (path[min(k + 1, L_SAMPLES - 1)] - path[max(k - 1, 0)]).normalized()
            normal = (point - HC).normalized()
            normal = (normal - tangent * normal.dot(tangent)).normalized()
            binormal = tangent.cross(normal).normalized()
            u = math.acos(clamp((point - HC).normalized().dot(BUN_DIR), -1.0, 1.0))
            # Width follows the convergence; thickness blends in at the
            # hairline and flattens under the knot.
            root = smooth(t / 0.15)
            width = (0.0085 + 0.0065 * math.sin(min(u, math.pi / 2))) * width_scale * (1 + 0.35 * jitter) * (0.35 + 0.65 * root)
            th = thick * (0.04 + 0.96 * root) * (0.55 + 0.45 * smooth((1 - t) / 0.2))
            centre = point + normal * (lift_mm + th * 0.2)
            for b in range(L_RING):
                beta = b * TAU / L_RING
                # A slightly lens-shaped section: a crest along the lock.
                c, sn = math.cos(beta), math.sin(beta)
                vertices.append(centre + binormal * c * width * 0.5 + normal * sn * th * 0.5 * (1 - 0.25 * c * c))
                uvs.append((b / L_RING * 0.5 + (s % 4) * 0.25, arc * 12.0))
        for k in range(L_SAMPLES - 1):
            for b in range(L_RING):
                nb = (b + 1) % L_RING
                faces.append((base + k * L_RING + b, base + k * L_RING + nb,
                              base + (k + 1) * L_RING + nb, base + (k + 1) * L_RING + b))
        count += 1
mesh = bpy.data.meshes.new('combed locks')
mesh.from_pydata([tuple(v) for v in vertices], [], faces)
layer = mesh.uv_layers.new(name='UVMap')
for loop in mesh.loops:
    layer.data[loop.index].uv = uvs[loop.vertex_index]
combed = link(bpy.data.objects.new('combed locks', mesh))
print('COMBED locks', count)

# --- 5c. Fringe: long curtain locks from a centre parting -------------------
# After the supplied model's front: from the parting each lock arcs outward
# around a tall oval face opening (a heart-shaped dip at the parting, the
# forehead left clear), passes beside (never over) the eyes, then falls long
# down the cheeks to about the chin, tapering to a point that curls slightly
# in. The section is rounded on top and flatter underneath; top-layer locks
# split into two finer strands toward the tip.
cover_tree = BVHTree.FromObject(combed, bpy.context.evaluated_depsgraph_get())

# Control points (azimuth from the front, elevation), in degrees, per lock
# position u (0 = front of the parting, 1 = back): shoulder of the arch,
# beside the eyes, tip.
SHOULDER = (((0.0, 24.0), (0.5, 50.0), (1.0, 72.0)), ((0.0, 26.0), (0.5, 32.0), (1.0, 34.0)))
BESIDE_EYES = (((0.0, 41.0), (0.5, 57.0), (1.0, 75.0)), ((0.0, -2.0), (0.5, -8.0), (1.0, -10.0)))
TIP = (((0.0, 32.0), (0.5, 48.0), (1.0, 66.0)), ((0.0, -42.0), (0.5, -54.0), (1.0, -42.0)))
F_SAMPLES = 26


def head_direction(a, e, side):
    return Vector((side * math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))


def surface_radius(d):
    """Outermost of skin, scalp shell and combed locks along `d`."""
    best = skull_sample(d) or 0.0
    hit = outer_surface(d)
    if hit is not None:
        best = max(best, (hit - HC).length)
    hit = cover_tree.ray_cast(HC + d * 0.3, -d, 0.3)
    if hit[0] is not None and (hit[0] - HC).length > 0.08:
        best = max(best, (hit[0] - HC).length)
    return best


def catmull(points, t):
    segments = len(points) - 1
    x = clamp(t) * segments
    i = min(int(x), segments - 1)
    f = x - i
    p0, p1 = points[max(i - 1, 0)], points[i]
    p2, p3 = points[i + 1], points[min(i + 2, segments)]
    return tuple(0.5 * (2 * p1[c] + (p2[c] - p0[c]) * f + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * f * f
                        + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * f ** 3) for c in range(2))


def fringe_path(u, side, lift_m, jitter):
    controls = [(2.5 + 2.0 * u, 42.0 + 28.0 * u)]
    for a_table, e_table in (SHOULDER, BESIDE_EYES, TIP):
        controls.append((table(a_table, u), table(e_table, u)))
    controls[-1] = (controls[-1][0] + 3.0 * jitter, controls[-1][1] + 6.0 * jitter)
    # Resample the spline evenly along its length on the sphere.
    dense = [catmull(controls, k / 199) for k in range(200)]
    lengths = [0.0]
    for p, q in zip(dense, dense[1:]):
        lengths.append(lengths[-1] + math.hypot((q[0] - p[0]) * math.cos(math.radians(p[1])), q[1] - p[1]))
    samples, j = [], 0
    for k in range(F_SAMPLES):
        target = lengths[-1] * k / (F_SAMPLES - 1)
        while j < len(lengths) - 2 and lengths[j + 1] < target:
            j += 1
        f = clamp((target - lengths[j]) / max(1e-9, lengths[j + 1] - lengths[j]))
        samples.append(tuple(dense[j][c] + (dense[j + 1][c] - dense[j][c]) * f for c in range(2)))
    radii, dirs, drops = [], [], []
    for a, e in samples:
        d = head_direction(math.radians(a), math.radians(e), side)
        dirs.append(d)
        drops.append(max(0.0, -e))
        radii.append(surface_radius(d))
    for k in range(1, F_SAMPLES):                       # holes: carry on
        radii[k] = radii[k] or radii[k - 1]
    for _ in range(4):                                   # no skin bumps
        radii = [radii[0]] + [(radii[k - 1] + 2 * radii[k] + radii[k + 1]) / 4
                              for k in range(1, F_SAMPLES - 1)] + [radii[-1]]
    points = []
    for k, (d, r, drop) in enumerate(zip(dirs, radii, drops)):
        t = k / (F_SAMPLES - 1)
        # Buried at the parting, a soft dome over the scalp, off the cheek
        # as it falls, the tip curled in.
        clear = (0.0022 + lift_m) * smooth(t / 0.08) - 0.0006
        clear += 0.008 * (1 - 0.6 * u) * smooth(t / 0.15) * (1 - 0.5 * smooth((t - 0.35) / 0.4))
        clear += 0.008 * smooth(drop / 35.0) - 0.003 * smooth((t - 0.75) / 0.25)
        points.append(HC + d * (r + clear))
    return points


def sweep_tube(path, widths, thicks, ring, v_scale, u_offset):
    base = len(vertices)
    n = len(path)
    arc = 0.0
    for k, point in enumerate(path):
        if k:
            arc += (point - path[k - 1]).length
        tangent = (path[min(k + 1, n - 1)] - path[max(k - 1, 0)]).normalized()
        normal = (point - HC).normalized()
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        binormal = tangent.cross(normal).normalized()
        for b in range(ring):
            beta = b * TAU / ring
            c, sn = math.cos(beta), math.sin(beta)
            # Rounded crown on top, flatter underside.
            depth = sn * (1.0 if sn > 0 else 0.45)
            vertices.append(point + binormal * c * widths[k] * 0.5 + normal * depth * thicks[k] * 0.5)
            uvs.append((u_offset + b / ring * 0.25, arc * v_scale))
    for k in range(n - 1):
        for b in range(ring):
            nb = (b + 1) % ring
            faces.append((base + k * ring + b, base + k * ring + nb,
                          base + (k + 1) * ring + nb, base + (k + 1) * ring + b))
    # Close the tip.
    tip = len(vertices)
    vertices.append(path[-1] + (path[-1] - path[-2]).normalized() * widths[-1] * 0.5)
    uvs.append((u_offset, arc * v_scale))
    for b in range(ring):
        faces.append((base + (n - 1) * ring + b, base + (n - 1) * ring + (b + 1) % ring, tip))


vertices, faces, uvs = [], [], []
# (locks per side, phase, lift, width, split tips)
F_LAYERS = ((6, 0.5, 0.0, 0.036, False), (8, 0.0, 0.002, 0.032, True))
for side in (1, -1):
    for n_locks, phase, lift_m, width, split in F_LAYERS:
        for s in range(n_locks):
            seed = s * 3.1 + phase * 17 + 5
            jitter = rand(seed) - 0.5
            u = clamp((s + phase + 0.3 * jitter) / (n_locks - 0.5))
            path = fringe_path(u, side, lift_m, jitter)
            n = len(path)
            w = width * (1 + 0.25 * (rand(seed + 2) - 0.5)) * (0.8 + 0.2 * u)
            # Full width down to a rounded tip (a quarter ellipse).
            # Full width over the scalp, a long taper to a fine point.
            env = [(0.55 + 0.45 * smooth(k / (n - 1) / 0.12))
                   * (0.04 + 0.96 * (1 - smooth((k / (n - 1) - 0.5) / 0.5)) ** 0.75)
                   for k in range(n)]
            widths = [w * e for e in env]
            thicks = [clamp(0.32 * x, 0.0012, 0.006) for x in widths]
            u_off = (s % 4) * 0.25
            if not split:
                sweep_tube(path, widths, thicks, 7, 12.0, u_off)
                continue
            # Two strands sharing the lock, parting over the last half.
            for strand in (-1, 1):
                sub = []
                for k, p in enumerate(path):
                    t = k / (n - 1)
                    tangent = (path[min(k + 1, n - 1)] - path[max(k - 1, 0)]).normalized()
                    normal = (p - HC).normalized()
                    binormal = tangent.cross(normal).normalized()
                    spread = widths[k] * 0.2 + 0.0015 * smooth((t - 0.55) / 0.45) * (1 + 0.5 * jitter * strand)
                    sub.append(p + binormal * strand * side * spread - normal * 0.0004 * (strand + 1))
                cut = n
                sub = sub[:cut]
                sw = [x * 0.6 for x in widths[:cut]]
                sw[-1] = widths[-1] * 0.6
                sweep_tube(sub, sw, [clamp(0.45 * x, 0.0011, 0.0045) for x in sw], 6, 12.0, u_off)
mesh = bpy.data.meshes.new('bun fringe locks')
mesh.from_pydata([tuple(v) for v in vertices], [], faces)
layer = mesh.uv_layers.new(name='UVMap')
for loop in mesh.loops:
    layer.data[loop.index].uv = uvs[loop.vertex_index]
fringe = link(bpy.data.objects.new('bun fringe locks', mesh))

# --- 6. UVs along the strands -------------------------------------------------
def set_uvs(obj, uv_of):
    mesh = obj.data
    layer = mesh.uv_layers[0] if mesh.uv_layers else mesh.uv_layers.new(name='UVMap')
    for loop in mesh.loops:
        layer.data[loop.index].uv = uv_of(mesh.vertices[loop.vertex_index].co)


def crown_uv(p):
    u, phi = bun_angles(p)
    return (phi / TAU * 7.0, u / math.pi * 4.0)


BUN_CENTER = sum((v.co for v in bun.data.vertices), Vector()) / len(bun.data.vertices)


def bun_uv(p):
    d = p - BUN_CENTER
    return ((d.dot(BUN_DIR)) * 14.0, math.atan2(d.dot(E2), d.dot(E1)) / TAU * 3.0)


set_uvs(crown, crown_uv)
set_uvs(bun, bun_uv)
for obj in (crown, bun, fringe, combed):
    obj.data.materials.clear()
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

# --- 7. Hair pin through the knot (gold in the catalogue) --------------------
bun_points = [v.co for v in bun.data.vertices]
height = max((p - BUN_CENTER).dot(BUN_DIR) for p in bun_points)
reach = max(((p - BUN_CENTER) - BUN_DIR * (p - BUN_CENTER).dot(BUN_DIR)).length for p in bun_points)
PIN_MID = BUN_CENTER + BUN_DIR * (height * 0.25)
PIN_START = PIN_MID - E1 * (reach + 0.030) + E2 * 0.028
PIN_END = PIN_MID + E1 * (reach + 0.022) - E2 * 0.020
vertices, faces, uvs = [], [], []
P_SEG, P_RING = 40, 10
pin_axis = (PIN_END - PIN_START).normalized()
side = pin_axis.cross(BUN_DIR).normalized()
up = side.cross(pin_axis).normalized()
for k in range(P_SEG + 1):
    t = k / P_SEG
    centre = PIN_START.lerp(PIN_END, t)
    # A round bead at the head end, a slim shaft tapering to a blunt tip.
    bead = max(0.0, 1 - ((t - 0.045) / 0.045) ** 2)
    radius = 0.0024 * (1 - 0.45 * smooth((t - 0.6) / 0.4)) + 0.0050 * math.sqrt(bead)
    if k == 0 or k == P_SEG:
        radius = 0.0004
    for b in range(P_RING):
        beta = b * TAU / P_RING
        vertices.append(centre + (side * math.cos(beta) + up * math.sin(beta)) * radius)
        uvs.append((b / P_RING, t))
for k in range(P_SEG):
    for b in range(P_RING):
        nb = (b + 1) % P_RING
        faces.append((k * P_RING + b, k * P_RING + nb, (k + 1) * P_RING + nb, (k + 1) * P_RING + b))
mesh = bpy.data.meshes.new('hair pin')
mesh.from_pydata([tuple(v) for v in vertices], [], faces)
layer = mesh.uv_layers.new(name='UVMap')
for loop in mesh.loops:
    layer.data[loop.index].uv = uvs[loop.vertex_index]
for polygon in mesh.polygons:
    polygon.use_smooth = True
pin = link(bpy.data.objects.new('hair pin', mesh))

# --- Export -------------------------------------------------------------------
parts = [fringe, crown, combed, bun, pin]
top = max(v.co.z for o in (bun, pin) for v in o.data.vertices)
assert top < BUN_TOP_LIMIT, f'bun top {top:.3f} m reaches the hat cut'
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_animations=False)
low = min(v.co.z for o in (bun, pin) for v in o.data.vertices)
print('EXPORTED', OUT, 'bun z', round(low, 3), round(top, 3),
      'verts', {o.name: len(o.data.vertices) for o in parts})
