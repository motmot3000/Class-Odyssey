"""Human ears for the delivered characters, and the sites of pierced-ear jewellery.

The delivered Noa and Mila heads carry pointed elf ears. Each ear is a set of
loose shells (outer face, back face, lower rim and a small tragus flap) that
sink into the skull, so they can be split out of the welded skin without
opening a seam. The skin is open under them: `cap_openings` closes it.

The human ear is not derived from the elf ear: it is the sculpted anatomical
ear of `human_ear_model.py`, seated on the capped skull by `human_ear_matrix`.
Haircuts are cleared around the worn ear: the build keeps two versions of the
locks near the ear, tucked around the elf ear or around the human ear
(`side_outline`), and the viewer shows the one matching the ears worn.

Coordinates are Blender world space: metres, Z up, front at -Y.
"""
import math

from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

def ear_islands(bm, min_abs_x=.07, z_range=(1.49, 1.63), max_vertices=80):
    """Loose ear shells of one skin mesh, grouped per side: {+1: [...], -1: [...]}.

    Each shell is a list of BMVerts. Coordinates must already be world space.
    """
    bm.verts.ensure_lookup_table()
    seen, sides = set(), {1: [], -1: []}
    for start in bm.verts:
        if start.index in seen:
            continue
        stack, island = [start], []
        seen.add(start.index)
        while stack:
            vertex = stack.pop()
            island.append(vertex)
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other.index not in seen:
                    seen.add(other.index)
                    stack.append(other)
        if len(island) > max_vertices:
            continue
        xs = [abs(v.co.x) for v in island]
        zs = [v.co.z for v in island]
        signs = {1 if v.co.x > 0 else -1 for v in island}
        if min(xs) > min_abs_x and z_range[0] < min(zs) and max(zs) < z_range[1] and len(signs) == 1:
            sides[signs.pop()].append(island)
    if not sides[1] or not sides[-1] or len(sides[1]) != len(sides[-1]):
        raise ValueError(f'Unexpected ear shells: {[len(s) for s in sides[1]]} / {[len(s) for s in sides[-1]]}')
    return sides


def skull_tree(bm, exclude):
    """BVH of the skin without the ear shells, to measure the skull under the ear."""
    faces = [f for f in bm.faces if not any(v.index in exclude for v in f.verts)]
    used = sorted({v.index for f in faces for v in f.verts})
    remap = {old: new for new, old in enumerate(used)}
    return BVHTree.FromPolygons([bm.verts[i].co.copy() for i in used],
                                [[remap[v.index] for v in f.verts] for f in faces])


def cap_openings(bm, ear_ids, tolerance=1e-5):
    """Close the skin openings the delivered ears plug, and return the caps.

    The skin is open under each ear: the elf ear's root ring sits exactly on
    the rim, unwelded. The human ear is smaller and cannot follow that rim
    (it runs up towards the elf tip), so the socket would show around it.
    The rim loops touching an ear are filled instead, with one plain skin
    texel, so any ear simply sits on a closed skull.
    """
    import bmesh
    from mathutils.kdtree import KDTree
    bm.verts.ensure_lookup_table()
    ears = KDTree(len(ear_ids))
    for index in ear_ids:
        ears.insert(bm.verts[index].co, index)
    ears.balance()
    # The skin is made of unwelded pieces: a seam is a pair of coincident
    # boundary edges. Only unpaired boundary edges are real openings; an
    # opening may run across several pieces, so its corners are welded first.
    key = lambda e: tuple(sorted(tuple(round(c, 5) for c in v.co) for v in e.verts))

    def openings():
        edges = [e for e in bm.edges if e.is_boundary and not any(v.index in ear_ids for v in e.verts)]
        count = {}
        for edge in edges:
            count[key(edge)] = count.get(key(edge), 0) + 1
        return [e for e in edges if count[key(e)] == 1]

    ear_verts = {bm.verts[i] for i in ear_ids}
    rim_verts = list({v for e in openings() for v in e.verts})
    bmesh.ops.remove_doubles(bm, verts=rim_verts, dist=tolerance)
    bm.verts.index_update(); bm.verts.ensure_lookup_table()
    # Welding renumbers vertices: refresh the ear indices the caller relies on.
    ear_ids.clear(); ear_ids.update(v.index for v in ear_verts if v.is_valid)
    boundary = openings()
    # Opening loops (connected components), kept if they meet an ear.
    links = {}
    for edge in boundary:
        for vertex in edge.verts:
            links.setdefault(vertex, []).append(edge)
    seen, rims = set(), []
    for start in boundary:
        if start in seen:
            continue
        loop, stack = [], [start]
        seen.add(start)
        while stack:
            edge = stack.pop(); loop.append(edge)
            for vertex in edge.verts:
                for other in links[vertex]:
                    if other not in seen:
                        seen.add(other); stack.append(other)
        if any(ears.find(v.co)[2] <= tolerance for edge in loop for v in edge.verts):
            rims.append(loop)
    if len(rims) != 2:
        raise ValueError(f'Expected one skin opening per ear, found {len(rims)}')
    uv = bm.loops.layers.uv.active
    caps = []
    for loop in rims:
        # The rim crosses several UV islands, so interpolating its UVs would
        # smear unrelated texels over the cap: it takes one plain skin texel,
        # the rim's lowest point (behind the lobe, far from painted detail).
        low = min((v for edge in loop for v in edge.verts), key=lambda v: v.co.z)
        skin_uv = low.link_loops[0][uv].uv.copy() if uv else None
        faces = [f for f in bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=loop)['geom']
                 if isinstance(f, bmesh.types.BMFace)]
        side = 1 if sum(v.co.x for edge in loop for v in edge.verts) > 0 else -1
        for face in faces:
            face.normal_update()
            if face.normal.x * side < 0:
                face.normal_flip()
            face.smooth = True
            for corner in face.loops:
                if uv: corner[uv].uv = skin_uv
        caps += faces
    return caps


# Placement of the sculpted human ear (human_ear_model.py) on the head: the
# front of its root (the tragus side) sits at EAR_ORIGIN in the side view, it
# stands off the skull by EAR_FLARE (back edge out) and leans back by EAR_TILT.
EAR_ORIGIN = (-.031, 1.556)
EAR_SCALE = 1.05
EAR_FLARE = math.radians(20)
EAR_TILT = math.radians(12)


def human_ear_matrix(tree, side):
    """World matrix of the sculpted ear's local frame (a back, b up, w out).

    The skin must already be capped (`cap_openings`), so the skull is measured
    where the elf ear used to plug it. The left ear (side -1) is a mirror: its
    faces must be reversed.
    """
    y, z = EAR_ORIGIN
    x = skull_x(tree, side, y, z) - .001
    basis = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0)))
    rotation = Matrix.Rotation(-EAR_FLARE, 3, 'Z') @ Matrix.Rotation(-EAR_TILT, 3, 'X') @ basis
    linear = Matrix.Diagonal((side, 1, 1)) @ rotation * EAR_SCALE
    matrix = linear.to_4x4()
    matrix.translation = Vector((side * x, y, z))
    return matrix


def side_outline(points, pad=.0):
    """Convex outline (y, z) of world points seen from the side, grown by `pad`.

    Used to clear a haircut around the worn ear: the ear seen from the side
    is close to convex, and the hull is what the locks have to go around.
    """
    pts = sorted({(round(p.y, 5), round(p.z, 5)) for p in points})

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    cy = sum(p[0] for p in hull) / len(hull)
    cz = sum(p[1] for p in hull) / len(hull)
    grown = []
    for y, z in hull:
        d = math.hypot(y - cy, z - cz) or 1.0
        grown.append((y + (y - cy) / d * pad, z + (z - cz) / d * pad))
    return tuple(grown)


def skull_x(tree, side, y, z, fallback=.086):
    hit = tree.ray_cast(Vector((side * .30, y, z)), Vector((-side, 0, 0)), .4)
    return abs(hit[0].x) if hit[0] is not None else fallback


def _side_view_unit(dy, dz):
    length = math.hypot(dy, dz) or 1.0
    return Vector((0, dy / length, dz / length))


def jewellery_layout(outer, side):
    """Piercings of one humanized ear, from its outer shell.

    `outer` is a list of (position, normal) pairs in world space, normals
    pointing away from the head. Returns jewellery descriptions:
    {'kind': 'hoop' | 'stud', 'center', 'u', 'v', 'radius', 'wire', 'finish'}.
    A hoop is the circle center + radius*(cos t*u + sin t*v); it passes through
    the pierced point and its plane contains the piercing direction, so the
    wire goes through the ear. The two ears are deliberately asymmetric.
    """
    points = [p for p, _n in outer]
    cy = sum(p.y for p in points) / len(points)
    cz = sum(p.z for p in points) / len(points)

    def site(direction_deg, inset):
        """Point `inset` metres inside the rim, towards the ear centre."""
        d = (math.cos(math.radians(direction_deg)), math.sin(math.radians(direction_deg)))
        rim, normal = max(outer, key=lambda pn: (pn[0].y - cy) * d[0] + (pn[0].z - cz) * d[1])
        inward = _side_view_unit(cy - rim.y, cz - rim.z)
        target = rim + inward * inset
        # Sit on the ear surface nearest to the inset point.
        surface, surface_normal = min(outer, key=lambda pn: (pn[0] - target).length)
        point = Vector((surface.x, target.y, target.z))
        normal = (normal + surface_normal).normalized()
        return point, normal, -inward

    def hoop(point, normal, outward, radius, wire, finish):
        out = (outward - normal * outward.dot(normal)).normalized()
        return {'kind': 'hoop', 'center': point + out * radius, 'u': -out, 'v': normal,
                'radius': radius, 'wire': wire, 'finish': finish}

    def stud(point, normal, radius, finish):
        return {'kind': 'stud', 'center': point + normal * radius * .45, 'u': normal, 'v': normal,
                'radius': radius, 'wire': radius, 'finish': finish}

    # Directions in the side view, degrees from +Y (the back of the head) to +Z.
    lobe, lobe_n, lobe_out = site(-100, .0042)
    items = [hoop(lobe, lobe_n, lobe_out, .0056, .00100, 'gold')]
    if side > 0:
        second, second_n, _ = site(-58, .0050)
        helix, helix_n, helix_out = site(38, .0028)
        items += [stud(second, second_n, .0018, 'gold'),
                  hoop(helix, helix_n, helix_out, .0040, .00085, 'gold')]
    else:
        upper, upper_n, _ = site(62, .0045)
        items.append(stud(upper, upper_n, .0020, 'gem'))
    return items
