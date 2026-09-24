"""Human ears for the delivered characters, and the sites of pierced-ear jewellery.

The delivered Noa and Mila heads carry pointed elf ears. Each ear is a set of
loose shells (outer face, back face, lower rim and a small tragus flap) that
sink into the skull, so they can be split out of the welded skin without
opening a seam.

`humanize_points` reshapes those shells into rounded human ears with a warp
along the ear's own axis, in the side view:

* the root that enters the skull and the concha are kept as delivered;
* the ear body is shortened;
* the narrowing elf tip (a triangle) is mapped onto a half ellipse, so its
  two edges become the rounded helix instead of converging into a point;
* the shortened ear turns a little towards the vertical and sits closer to
  the head, curling in at the top so it is rounded from the front as well.

The painted ear detail follows the vertices, so the helix and concha shading
are kept. Haircuts are fitted around the elf ear, the larger of the two, so
the hair contour is identical whichever ear is worn.

Coordinates are Blender world space: metres, Z up, front at -Y.
"""
import math

from mathutils import Vector
from mathutils.bvhtree import BVHTree

# Side view (y, z) of the right ear; the left ear is its mirror in x. The axis
# runs from the middle of the root (ROOT) to the far tip, measured on the mesh.
ROOT = (-.024, 1.546)
# Share of the elf axis kept exactly as delivered (the root and the concha).
KEEP = .30
# Share of the elf axis where its tip starts to narrow: the rest becomes the helix.
TIP = .56
# Human ear length along the axis, as a share of the elf ear length.
LENGTH = .62
# Where the human helix (half ellipse) starts, as a share of the human length.
CAP_START = .58
# The shortened ear also turns towards the vertical, like a human ear.
TURN = math.radians(22)
# How far the back rim of the human ear stands off the skull (metres)...
FLARE = .020
# ...and the share of it kept at the very top, where the helix curls in.
CURL = .45
BINS = 24
# Radius of the Gaussian that finds the mid-surface of the ear shells.
MID_SIGMA = .006


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


def skull_x(tree, side, y, z, fallback=.086):
    hit = tree.ray_cast(Vector((side * .30, y, z)), Vector((-side, 0, 0)), .4)
    return abs(hit[0].x) if hit[0] is not None else fallback


def _smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def _frame(points):
    """Axis unit vector, its normal and the elf length, from ROOT to the far tip."""
    tip = max(points, key=lambda p: (p[0] - ROOT[0]) ** 2 + (p[1] - ROOT[1]) ** 2)
    ay, az = tip[0] - ROOT[0], tip[1] - ROOT[1]
    length = math.hypot(ay, az)
    return (ay / length, az / length), (-az / length, ay / length), length


def _local(p, axis, normal):
    dy, dz = p[0] - ROOT[0], p[1] - ROOT[1]
    return dy * axis[0] + dz * axis[1], dy * normal[0] + dz * normal[1]


def _profile(points, axis, normal, length):
    """Half widths of the elf ear on both sides of the axis, per axis bin.

    The envelope narrows monotonically towards the tip yet encloses every
    vertex, so no point is ever mapped past the rim.
    """
    upper, lower = [0.0] * BINS, [0.0] * BINS
    for p in points:
        u, v = _local(p, axis, normal)
        i = min(BINS - 1, max(0, int(u / length * BINS)))
        if v >= 0: upper[i] = max(upper[i], v)
        else: lower[i] = max(lower[i], -v)
    for side in (upper, lower):
        for i in range(BINS - 2, -1, -1):
            side[i] = max(side[i], side[i + 1], .002)
    return upper, lower


def _sample(table, u, length):
    position = min(BINS - 1.0, max(0.0, u / length * BINS - .5))
    i = int(position); t = position - i
    return table[i] * (1 - t) + table[min(BINS - 1, i + 1)] * t


def _human_side_view(u, v, length, upper, lower):
    """Map elf axis coordinates (u, v) to human ones; also return the helix progress."""
    keep, tip = KEEP * length, TIP * length
    human = LENGTH * length
    cap = CAP_START * human
    width = lambda sign: _sample(upper if sign >= 0 else lower, tip, length)
    if u <= tip:
        # Root and concha as delivered, then the body shortened linearly so
        # that the start of the elf tip lands on the start of the helix.
        t = _smooth((u - keep * .5) / keep)
        nu = u + ((keep + (u - keep) * (cap - keep) / (tip - keep)) - u) * t if u > keep * .5 else u
        elf = _sample(upper if v >= 0 else lower, u, length)
        # Never wider than delivered; only as wide as the helix it leads to.
        nv = v * min(1.0, 1 + (width(v) / max(elf, 1e-6) - 1) * t) if elf > width(v) else v
        return nu, nv, 0.0
    # Narrowing elf tip -> half ellipse: its two edges become the helix arc.
    # A point at relative height t of the tip and relative offset s across it
    # lands at angle phi on the arc (s = +-1) or inside the half ellipse.
    # The exponent spreads the vertices crowded at the elf tip along the arc.
    t = min(1.0, (u - tip) / (length - tip))
    elf = max(_sample(upper if v >= 0 else lower, u, length), 1e-6)
    s = max(-1.0, min(1.0, v / elf))
    phi = (1 - t) ** .65 * math.pi / 2
    radius = human - cap
    nu = cap + radius * math.cos(phi)
    nv = s * width(v) * math.sin(phi)
    return nu, nv, (nu - cap) / radius


def humanize_points(points, side, tree, edges=None):
    """Warp world-space ear points of one side into the human ear.

    `points` is a list of Vectors (all shells of that ear together, so the
    shells keep fitting each other); `edges` are the index pairs linking them.
    Returns the new positions.
    """
    flat = [(p.y, p.z) for p in points]
    axis, normal, length = _frame(flat)
    upper, lower = _profile(flat, axis, normal, length)
    human = LENGTH * length
    keep = KEEP * length
    # Height of each point above the skull, split into the flare of the ear
    # plane (mean per axis bin) and the local thickness of the shells.
    samples = []
    for p, (y0, z0) in zip(points, flat):
        u, v = _local((y0, z0), axis, normal)
        samples.append((u, v, abs(p.x) - skull_x(tree, side, y0, z0)))
    # Mid-surface of the elf ear: a Gaussian average of the neighbouring
    # heights in the side view. It is smooth, so the remaining thickness term
    # is continuous and no face turns over when the plane is redrawn.
    mid = []
    for u, v, _lift in samples:
        total = weight = 0.0
        for u2, v2, lift2 in samples:
            w = math.exp(-((u - u2) ** 2 + (v - v2) ** 2) / (2 * MID_SIGMA ** 2))
            total += w * lift2; weight += w
        mid.append(total / weight)
    side_view = []
    for (u, v, lift), elf_plane in zip(samples, mid):
        nu, nv, _helix = _human_side_view(u, v, length, upper, lower)
        # Turn the shortened ear towards the vertical, pivoting on the root,
        # which stays exactly as delivered so it keeps plugging the skull.
        turn = TURN * _smooth((nu - keep) / (human - keep))
        c_t, s_t = math.cos(turn), math.sin(turn)
        ly, lz = nu * axis[0] + nv * normal[0], nu * axis[1] + nv * normal[1]
        side_view.append((ROOT[0] + ly * c_t - lz * s_t, ROOT[1] + ly * s_t + lz * c_t, nu, u, lift, elf_plane))
    top = max(z for _y, z, *_ in side_view)
    bottom = min(z for _y, z, *_ in side_view)
    result = []
    for y, z, nu, u, lift, elf_plane in side_view:
        thickness = lift - elf_plane
        # Human flare: grows away from the root, largest along the middle of
        # the back rim, smaller at the top (the helix curls in, so the ear is
        # rounded from the front) and at the lobe.
        height = (z - bottom) / max(top - bottom, 1e-6)
        shape = 1 - (1 - CURL) * _smooth((height - .62) / .38) - .35 * _smooth((.30 - height) / .30)
        human_plane = elf_plane + (FLARE * _smooth(nu / human) * shape - elf_plane) * _smooth((u - keep * .5) / keep)
        new_lift = human_plane + thickness * (1 if u < keep else .85)
        if lift <= 0 and u < keep:
            new_lift = lift          # the root stays buried exactly as delivered
        result.append(Vector((side * (skull_x(tree, side, y, z) + new_lift), y, z)))
    if edges:
        # The root ring is frozen: it seals the opening left in the skull.
        relax(result, edges, weights=[_smooth((u - keep) / (.35 * length))
                                      for _nu, _nv, _h, u, _lift, _plane in side_view])
    return result


def relax(points, edges, weights, iterations=3, strength=.35):
    """Light Laplacian smoothing of the humanized ear.

    The shells are loose but share their rim positions, so vertices that end
    up coincident are relaxed as one and the shells stay welded with each
    other. This removes the last few faces that would otherwise turn over on
    the tight inner fold of the concha.
    """
    key = lambda p: (round(p.x, 5), round(p.y, 5), round(p.z, 5))
    groups = {}
    for i, p in enumerate(points):
        groups.setdefault(key(p), []).append(i)
    node, order = {}, sorted(groups)
    for n, k in enumerate(order):
        for i in groups[k]: node[i] = n
    neighbour = [set() for _ in order]
    for a, b in edges:
        if node[a] != node[b]:
            neighbour[node[a]].add(node[b]); neighbour[node[b]].add(node[a])
    position = [None] * len(order)
    weight = [0.0] * len(order)
    for i, p in enumerate(points):
        position[node[i]] = p.copy()
        weight[node[i]] = max(weight[node[i]], weights[i])
    for _ in range(iterations):
        moved = position[:]
        for n in range(len(order)):
            if not neighbour[n] or weight[n] <= 0: continue
            mean = sum((position[m] for m in neighbour[n]), Vector()) / len(neighbour[n])
            moved[n] = position[n].lerp(mean, strength * weight[n])
        position = moved
    for i in range(len(points)): points[i] = position[node[i]].copy()


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
