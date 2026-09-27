"""Hats and eyewear of the shop, modelled procedurally in Blender.

Every item is built from parametric surfaces and swept profiles (no stretched
primitives), then its parts are merged per material so the viewer draws each
item in a handful of meshes.

Two authoring spaces are used:
  * `template`: the historical hat space of build-items-3d.py (HEAD_FIT: seat
    at z 1.692, opening .118 x .143 around y -.012). The covered hats keep this
    exact opening, which the trimmed haircuts were cut for.
  * `world`: Noa's (male) head as delivered, measured on the stylized base
    (metres, Z up, front at -Y). Face-fitted pieces (eyewear, helmet) are drawn
    here and moved to template space with the inverse of Noa's hat-seat fit,
    so the shared fit then reproduces them exactly on Noa and scaled on Mila.

`build(emit, world_to_template)` creates every item and hands each merged
part to `emit(obj, item_id, part_name, material_key)`.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

TAU = math.tau

# Material keys -> (name, colour, roughness, metallic, emission).
MATERIALS = {
    'brass': ('Aged brass', '#A9803C', .32, .9, 0),
    'gold': ('Polished royal gold', '#D0A443', .24, 1.0, 0),
    'gold-dark': ('Engraved gold', '#9C7424', .34, 1.0, 0),
    'steel': ('Polished helmet steel', '#B7C1C8', .2, .92, 0),
    'steel-dark': ('Blued band steel', '#5C6770', .36, .9, 0),
    'leather': ('Oiled chestnut leather', '#6A4A33', .72, 0, 0),
    'leather-dark': ('Dark saddle leather', '#3F2C20', .66, 0, 0),
    'lens-teal': ('Teal goggle glass', '#2B7C84', .05, .35, 0),
    'lens-smoke': ('Smoked sunglass lens', '#141920', .04, .55, 0),
    'acetate': ('Gloss black acetate', '#121317', .18, 0, 0),
    'felt-black': ('Black silk plush', '#1C1F26', .52, 0, 0),
    'silk-burgundy': ('Burgundy grosgrain', '#7E2331', .5, 0, 0),
    'wool-sage': ('Ranger green wool', '#3B6A50', .92, 0, 0),
    'felt-plum': ('Mage plum felt', '#5A3C6E', .86, 0, 0),
    'feather': ('Ivory feather', '#EEE7D3', .8, 0, 0),
    'feather-russet': ('Russet feather', '#9A5431', .78, 0, 0),
    'ruby': ('Ruby', '#A3142C', .08, .1, 0),
    'sapphire': ('Sapphire', '#1D4FA8', .08, .1, 0),
    'emerald': ('Emerald', '#15805A', .08, .1, 0),
    'turquoise': ('Turquoise crystal', '#58B8C2', .1, .15, .12),
    'pearl': ('Pearl', '#F1EBDD', .28, .05, 0),
    'horn': ('Polished ivory horn', '#E6DDC5', .46, 0, 0),
    'horn-tip': ('Dark horn tip', '#5E4A36', .42, 0, 0),
}


# --------------------------------------------------------------- geometry kit

def spline(points, per=8, closed=False):
    """Catmull-Rom resampling: `per` samples per segment."""
    P = [Vector(p) for p in points]
    n = len(P)
    out = []
    for j in range(n if closed else n - 1):
        p0 = P[(j - 1) % n] if closed else P[max(j - 1, 0)]
        p1, p2 = P[j % n], P[(j + 1) % n]
        p3 = P[(j + 2) % n] if closed else P[min(j + 2, n - 1)]
        for k in range(per):
            t = k / per
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                             + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    if not closed:
        out.append(P[-1])
    return out


def link(name, bm, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for polygon in me.polygons:
        polygon.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def grid(name, rows, closed_u=True, closed_v=False, cap_start=False, cap_end=False, smooth=True):
    """Quad grid from rows of points: u runs along a row, v from row to row.

    With u counter-clockwise seen from +v, faces point outward.
    """
    bm = bmesh.new()
    verts = [[bm.verts.new(p) for p in row] for row in rows]
    nu, nv = len(rows[0]), len(rows)
    for j in range(nv - 1 + (1 if closed_v else 0)):
        a, b = verts[j], verts[(j + 1) % nv]
        for i in range(nu - (0 if closed_u else 1)):
            k = (i + 1) % nu
            try:
                bm.faces.new((a[i], a[k], b[k], b[i]))
            except ValueError:
                pass
    if cap_start:
        bm.faces.new(list(reversed(verts[0])))
    if cap_end:
        bm.faces.new(verts[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-7)
    return link(name, bm, smooth)


def surface(name, S, nu, nv, closed_u=True, cap_end=False, smooth=True):
    """Mesh of a parametric surface S(u, v), u, v in [0, 1]."""
    us = [i / nu for i in range(nu)] if closed_u else [i / (nu - 1) for i in range(nu)]
    rows = [[S(u, j / (nv - 1)) for u in us] for j in range(nv)]
    return grid(name, rows, closed_u, cap_end=cap_end, smooth=smooth)


def normal_at(S, u, v, e=1e-3):
    du = S(u + e, v) - S(u - e, v)
    dv = S(u, min(1, v + e)) - S(u, max(0, v - e))
    return du.cross(dv).normalized()


def sweep(name, path, profile, scales=None, closed=False, caps=True, up=None, smooth=True):
    """Sweep a 2D profile (x along the frame normal, y along the binormal)."""
    path = [Vector(p) for p in path]
    n = len(path)
    rows, previous = [], None
    for i, p in enumerate(path):
        a = path[(i - 1) % n] if closed else path[max(i - 1, 0)]
        b = path[(i + 1) % n] if closed else path[min(i + 1, n - 1)]
        t = (b - a).normalized()
        if up is not None:
            ref = up(p, t, i) if callable(up) else Vector(up)
        elif previous is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0))
        else:
            ref = previous
        N = (ref - t * ref.dot(t)).normalized()
        previous = N
        B = t.cross(N)
        sx, sy = scales[i] if scales else (1, 1)
        rows.append([p + N * (x * sx) + B * (y * sy) for x, y in profile])
    return grid(name, rows, True, closed, caps and not closed, caps and not closed, smooth)


def circle(r=1.0, n=16):
    return [(r * math.cos(i * TAU / n), r * math.sin(i * TAU / n)) for i in range(n)]


def rrect(w, h, r, n=3):
    """Counter-clockwise rounded rectangle centred on the origin."""
    r = min(r, w / 2, h / 2)
    out = []
    for cx, cy, a0 in [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                       (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]:
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return out


def ring(name, center, axis, radius, tube, n=48, m=10, squash=1.0):
    """Torus around `axis` through `center`."""
    axis = Vector(axis).normalized()
    side = axis.cross(Vector((0, 0, 1)) if abs(axis.z) < .9 else Vector((1, 0, 0))).normalized()
    upv = axis.cross(side)
    path = [Vector(center) + (side * math.cos(i * TAU / n) + upv * math.sin(i * TAU / n)) * radius for i in range(n)]
    return sweep(name, path, [(x, y * squash) for x, y in circle(tube, m)], closed=True,
                 up=lambda p, t, i: p - Vector(center))


def beads(name, points, radius, segments=10, rings=6):
    bm = bmesh.new()
    for p in points:
        r = radius(p) if callable(radius) else radius
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=r,
                                  matrix=Matrix.Translation(Vector(p)))
    return link(name, bm)


def frame_from(normal, hint=(0, 0, 1)):
    """Orthonormal (side, up, normal) around a direction."""
    n = Vector(normal).normalized()
    h = Vector(hint)
    if abs(n.dot(h.normalized())) > .95:
        h = Vector((1, 0, 0))
    side = h.cross(n).normalized()
    return side, n.cross(side), n


def gem(name, center, normal, r, h, facets=10, oval=1.0, hint=(0, 0, 1)):
    """Brilliant-cut stone: girdle, crown, table, pavilion (flat shaded)."""
    side, upv, n = frame_from(normal, hint)
    c = Vector(center)
    bm = bmesh.new()

    def ring_verts(radius, height, offset=0.0):
        return [bm.verts.new(c + n * height + (side * math.cos(a) * oval + upv * math.sin(a)) * radius)
                for a in [(i + offset) * TAU / facets for i in range(facets)]]
    girdle = ring_verts(r, 0)
    crown = ring_verts(r * .64, h * .5, .5)
    apex = bm.verts.new(c - n * h * .9)
    for i in range(facets):
        j = (i + 1) % facets
        bm.faces.new((girdle[i], girdle[j], crown[i]))
        bm.faces.new((crown[i], girdle[j], crown[j]))
        bm.faces.new((girdle[j], girdle[i], apex))
    bm.faces.new(crown)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return link(name, bm, smooth=False)


def plate(name, outline, place, thickness, smooth=False):
    """Extrude a 2D outline [(s, t)] placed by place(s, t) -> (point, normal)."""
    bm = bmesh.new()
    back, front = [], []
    for s, t in outline:
        p, nrm = place(s, t)
        back.append(bm.verts.new(p))
        front.append(bm.verts.new(p + nrm * thickness))
    k = len(outline)
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return link(name, bm, smooth)


def solid(ob, thickness, offset=-1.0):
    mod = ob.modifiers.new('thickness', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = offset
    mod.use_even_offset = True
    return ob


def bevel(ob, width, segments=2, angle=40):
    mod = ob.modifiers.new('edge', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = False
    return ob


class Item:
    """Collects the parts of one shop item, keyed by material."""

    def __init__(self, item_id, space):
        self.item_id, self.space, self.parts = item_id, space, []

    def add(self, ob, name, mat):
        self.parts.append((ob, name, mat))
        return ob


def bake_join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.convert(target='MESH')
    if len(objects) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    # Keep crisp creases on hard pieces, soft shading everywhere else.
    ob.data.set_sharp_from_angle(angle=math.radians(50))
    return ob


# ----------------------------------------------------------- measured heads

# Noa's skull radius (m) from the axis x=0, y=-.012, measured on the stylized
# base every 30 degrees (0 = +x, 90 = back +y, 270 = front -y).
_SKULL_Z = [1.54, 1.57, 1.60, 1.63, 1.66, 1.69, 1.72]
_SKULL = [
    [.093, .088, .086, .089, .086, .088, .093, .105, .123, .153, .123, .105],
    [.101, .104, .102, .103, .102, .104, .101, .110, .118, .134, .118, .110],
    [.105, .111, .112, .113, .112, .111, .105, .109, .120, .130, .120, .109],
    [.106, .114, .114, .114, .114, .114, .106, .110, .127, .128, .127, .110],
    [.105, .109, .109, .108, .109, .109, .105, .108, .119, .125, .119, .108],
    [.096, .096, .091, .090, .091, .096, .096, .098, .107, .113, .107, .098],
    [.067, .060, .057, .058, .057, .060, .067, .071, .071, .080, .071, .071],
]


def skull_radius(angle, z):
    a = (math.degrees(angle) % 360) / 30
    i0, fa = int(a) % 12, a - int(a)
    z = min(max(z, _SKULL_Z[0]), _SKULL_Z[-1])
    j0 = min(len(_SKULL_Z) - 2, max(0, [k for k in range(len(_SKULL_Z)) if _SKULL_Z[k] <= z][-1]))
    fz = (z - _SKULL_Z[j0]) / (_SKULL_Z[j0 + 1] - _SKULL_Z[j0])

    def at(j):
        return _SKULL[j][i0] * (1 - fa) + _SKULL[j][(i0 + 1) % 12] * fa
    return at(j0) * (1 - fz) + at(j0 + 1) * fz


def skull_point(angle, z, offset=0.0):
    r = skull_radius(angle, z) + offset
    return Vector((r * math.cos(angle), -.012 + r * math.sin(angle), z))


# ---------------------------------------------------------------- eyewear

def goggles():
    """Brass explorer goggles pushed up on the forehead (world space)."""
    it = Item('explorer-cap', 'world')
    cups = {}
    for s in (1, -1):
        axis = Vector((s * .26, -.95, .17)).normalized()
        rear = Vector((s * .0435, -.1265, 1.655))
        side = axis.cross(Vector((0, 0, 1))).normalized()
        upv = axis.cross(side).normalized()
        cups[s] = (rear, axis, side, upv)
        length = .033

        def lathe(stations, n=40):
            rows = []
            for t, r in stations:
                c = rear + axis * (length * t)
                rows.append([c + (side * math.cos(a) + upv * math.sin(a)) * r
                             for a in [i * TAU / n for i in range(n)]])
            return rows
        # Leather cushion that presses on the brow, then the brass cup.
        cushion = grid('leather goggle cushion', lathe([(-.05, .0182), (0, .0216), (.1, .0234), (.22, .0231),
                                                        (.32, .021)]), cap_start=True)
        it.add(cushion, 'leather goggle cushions', 'leather-dark')
        cup = grid('brass goggle cup', lathe([(.3, .0206), (.36, .0216), (.55, .021), (.6, .022), (.64, .021),
                                              (.86, .0206), (.9, .0199)]))
        it.add(cup, 'brass goggle cups', 'brass')
        # Rolled front bezel and its screws.
        it.add(ring('goggle bezel', rear + axis * (length * .93), axis, .0198, .0032, 56, 12),
               'brass goggle cups', 'brass')
        screws = [rear + axis * (length * .98) + (side * math.cos(a) + upv * math.sin(a)) * .0198
                  for a in [(k + .5) * TAU / 6 for k in range(6)]]
        it.add(beads('bezel screw', screws, .0016, 8, 5), 'brass goggle cups', 'brass')
        # Domed tinted lens seated inside the bezel.
        lens_rows = []
        for k in range(7):
            q = k / 6
            radius = .0182 * math.sin(q * math.pi / 2)
            bulge = .0042 * math.cos(q * math.pi / 2)
            c = rear + axis * (length * .9 + bulge)
            lens_rows.append([c + (side * math.cos(a) + upv * math.sin(a)) * radius
                              for a in [i * TAU / 40 for i in range(40)]])
        lens = grid('goggle lens', list(reversed(lens_rows)))
        it.add(solid(lens, .0012), 'teal goggle lenses', 'lens-teal')
        # Glint ring engraved on the cup.
        it.add(ring('cup ridge', rear + axis * (length * .6), axis, .022, .0011, 48, 8), 'brass goggle cups', 'brass')

    def cup_side(s, sign, t=.5):
        rear, axis, side, upv = cups[s]
        return rear + axis * (.033 * t) + side * (.022 * sign)
    # Bridge: a curved brass bar with a leather sleeve.
    bridge = spline([cup_side(1, -1, .55), Vector((0, -.1505, 1.667)), cup_side(-1, 1, .55)], 10)
    it.add(sweep('goggle bridge bar', bridge, circle(.0022, 12)), 'brass goggle cups', 'brass')
    sleeve = spline([Vector((.011, -.1493, 1.6675)), Vector((0, -.1505, 1.6678)), Vector((-.011, -.1493, 1.6675))], 6)
    it.add(sweep('bridge leather sleeve', sleeve, rrect(.0068, .0095, .0025)), 'leather goggle strap', 'leather')
    # Strap around the head: follows the skull just behind the cups and rises
    # slightly towards the crown at the back.
    arc = []
    start, end = math.radians(-58), math.radians(238)
    for k in range(49):
        a = start + (end - start) * k / 48
        back = max(0, math.sin(a))
        z = 1.665 + .02 * back
        arc.append(skull_point(a, z, .0042))
    path = [cup_side(1, 1, .5)] + spline(arc[::4], 4)[1:-1] + [cup_side(-1, -1, .5)]
    path = spline(path, 2)
    strap = sweep('leather goggle strap', path, rrect(.0026, .0135, .0011), caps=True,
                  up=lambda p, t, i: Vector((p.x, p.y + .012, 0)))
    it.add(strap, 'leather goggle strap', 'leather')
    # Stitching along both edges of the visible front of the strap.
    for s in (1, -1):
        for edge in (1, -1):
            pts = []
            for k in range(1, 8):
                a = (math.radians(-58) + k * math.radians(9)) if s > 0 else (math.radians(238) - k * math.radians(9))
                p = skull_point(a, 1.665 + .02 * max(0, math.sin(a)) + edge * .0048, .0058)
                pts.append(p)
            it.add(beads('strap stitch', pts, .0008, 6, 4), 'leather goggle strap', 'leather-dark')
        # Brass rivet where the strap meets each cup.
        it.add(beads('strap rivet', [cup_side(s, s, .5) + cups[s][2] * s * .0018], .0024, 10, 6),
               'brass goggle cups', 'brass')
    return it


def _shades_wrap(x, z):
    """Front surface of the sunglasses: wrapped and slightly tilted."""
    return -.1595 + 1.75 * x * x + .08 * (1.5945 - z)


def _shades_outline(s, theta):
    """Lens outline, side s (+1 left of the wearer, +x), angle theta."""
    cx, cz, A, B, n = s * .0495, 1.5945, .0285, .0212, 3.4
    c, si = math.cos(theta), math.sin(theta)
    x = A * math.copysign(abs(c) ** (2 / n), c)
    z = B * math.copysign(abs(si) ** (2 / n), si)
    outer = max(0.0, x / A * s)  # 0 at the nose, 1 at the temple
    if z > 0:
        z += .0024 * outer * (z / B)          # up-swept outer top corner
    else:
        x *= 1 - .09 * (1 - outer) * (-z / B)  # softer inner bottom corner
        z *= 1 - .08 * outer
    return Vector((cx + x, 0, cz + z))


def sunglasses():
    """Wayfarer-style sunglasses in gloss black acetate (world space)."""
    it = Item('sunglasses', 'world')
    n = 72
    for s in (1, -1):
        outline = []
        for k in range(n):
            theta = k * TAU / n if s > 0 else math.pi - k * TAU / n
            p = _shades_outline(s, theta)
            p.y = _shades_wrap(p.x, p.z)
            outline.append(p)
        center = Vector((s * .0495, 0, 1.5945))
        center.y = _shades_wrap(center.x, center.z)
        # Rim: heavier brow line, finer lower rim.
        scales = []
        for p in outline:
            top = max(0.0, (p.z - 1.5945) / .0212)
            scales.append((1, .0045 + .0028 * top))
        rim_profile = [(x, y) for x, y in rrect(1, 1, .3, 2)]
        rows = []
        for i, p in enumerate(outline):
            a, b = outline[i - 1], outline[(i + 1) % n]
            t = (b - a).normalized()
            fwd = Vector((0, -1, 0))
            N = t.cross(fwd).normalized()
            if N.dot(Vector((p.x - center.x, 0, p.z - center.z))) < 0:
                N = -N
            depth, width = .0056, scales[i][1]
            rows.append([p + N * (width * (x + .5) - .0012) + fwd * (depth * y + .0006) for x, y in rim_profile])
        rim = grid('acetate lens rim', rows, True, True)
        it.add(rim, 'gloss black frame', 'acetate')
        # Smoked lens, slightly domed, sitting inside the rim.
        lens_rows = []
        for k in range(8):
            q = k / 7
            row = []
            for p in outline:
                x = center.x + (p.x - center.x) * q
                z = center.z + (p.z - center.z) * q
                row.append(Vector((x, _shades_wrap(x, z) - .0012 * (1 - q * q), z)))
            lens_rows.append(row)
        lens = grid('smoked lens', lens_rows, True)
        it.add(solid(lens, .0014), 'smoked lenses', 'lens-smoke')
        # Hinge block, front rivets and temple arm.
        hinge_x = s * .0835
        hinge = Vector((hinge_x, _shades_wrap(hinge_x, 1.608) + .0032, 1.6075))
        block = sweep('temple hinge', [hinge + Vector((0, -.0035, 0)), hinge + Vector((0, .006, 0))],
                      rrect(.0058, .0098, .0018), up=(1, 0, 0), smooth=True)
        it.add(block, 'gloss black frame', 'acetate')
        for dz in (.0028, -.0028):
            x = s * .0795
            it.add(beads('frame rivet', [Vector((x, _shades_wrap(x, 1.609 + dz) - .0036, 1.609 + dz))], .0011, 8, 5),
                   'gold frame rivets', 'gold')
        arm = spline([hinge + Vector((0, .005, 0)), (s * .0955, -.12, 1.6065), (s * .1045, -.08, 1.6045),
                      (s * .1095, -.04, 1.6010), (s * .1128, -.012, 1.5985), (s * .1122, .010, 1.5945),
                      (s * .1085, .025, 1.5810), (s * .1035, .032, 1.5665)], 6)
        count = len(arm)
        arm_scales = [(1, 1 - .38 * min(1, i / (count * .55))) for i in range(count)]
        it.add(sweep('temple arm', arm, rrect(.0032, .0064, .0012), arm_scales, up=(s, 0, 0)),
               'gloss black frame', 'acetate')
    # Keyhole bridge joining the two rims above the nose.
    bridge = spline([(.0195, _shades_wrap(.0195, 1.606) - .003, 1.6065), (0, -.1628, 1.6102),
                     (-.0195, _shades_wrap(.0195, 1.606) - .003, 1.6065)], 10)
    it.add(sweep('keyhole bridge', bridge, rrect(.0048, .0056, .0018), up=(0, -1, 0)), 'gloss black frame', 'acetate')
    return it


# ------------------------------------------------------------------ hats

SEAT_Z, IN_RX, IN_RY, CY = 1.692, .118, .143, -.012   # template hat opening


def brim(it, name, outer_rx, outer_ry, height, mat, edge_mat=None, rows=9, n=96, thickness=.0045):
    """Annular brim from the head opening; height(t, a) lifts it (template)."""
    def S(u, v):
        a = u * TAU
        rx = IN_RX + (outer_rx - IN_RX) * v
        ry = IN_RY + (outer_ry - IN_RY) * v
        return Vector((rx * math.cos(a), CY + ry * math.sin(a), SEAT_Z + height(v, a)))
    ob = surface(name, S, n, rows)
    it.add(solid(ob, thickness, 0), name, mat)
    edge = [S(i / n, 1) for i in range(n)]
    it.add(sweep(name + ' binding', edge, circle(thickness * .62, 10), closed=True,
                 up=lambda p, t, i: Vector((p.x, p.y - CY, 0))), name, edge_mat or mat)
    return S


def feather(it, name, root, direction, bend, length, width, mat, twist=0.0):
    """Tapered vane with notches along a curved quill."""
    root, direction, bend = Vector(root), Vector(direction).normalized(), Vector(bend)
    steps = 26
    spine = [root + direction * (length * k / steps) + bend * ((k / steps) ** 2 * length) for k in range(steps + 1)]
    rows = []
    for k, p in enumerate(spine):
        q = k / steps
        t = (spine[min(k + 1, steps)] - spine[max(k - 1, 0)]).normalized()
        side = t.cross(Vector((0, -1, 0))).normalized()
        side = (side * math.cos(twist * q) + t.cross(side) * math.sin(twist * q)).normalized()
        normal = t.cross(side)
        w = width * math.sin(min(1, q * 1.15) * math.pi) ** .7 * (1 - .1 * q)
        notch = 1 - .35 * (1 if k in (9, 16, 21) else 0)
        curl = normal * (.0022 * math.sin(q * math.pi))
        rows.append([p - side * w * .9 * notch + curl, p + normal * .0006, p + side * w * notch + curl])
    vane = grid(name, rows, closed_u=False)
    it.add(solid(vane, .0009, 0), name, mat)
    it.add(sweep(name + ' quill', spine[:-2], circle(.0012, 8),
                 [(1 - .7 * k / steps, 1 - .7 * k / steps) for k in range(steps - 1)]), name, mat)


def beret():
    it = Item('feather-beret', 'template')
    # Leather headband holding the opening.
    def band(u, v):
        a = u * TAU
        rx, ry = IN_RX + .001 + .002 * v, IN_RY + .001 + .002 * v
        return Vector((rx * math.cos(a), CY + ry * math.sin(a), 1.690 + .014 * v))
    it.add(solid(surface('beret leather band', band, 96, 4), .004, 0), 'beret leather band', 'leather')
    for z in (1.6905,):
        it.add(sweep('band piping', [band(i / 96, (z - 1.69) / .014) for i in range(96)], circle(.0024, 8), closed=True,
                     up=lambda p, t, i: Vector((p.x, p.y - CY, 0))), 'beret leather band', 'leather-dark')
    # Soft crown: it balloons over the band, sags towards the right side and
    # carries a few gathered folds.
    tilt = Matrix.Rotation(-.15, 4, 'Y')
    pivot = Vector((0, CY, 1.703))

    def crown(u, v):
        a = u * TAU
        bulge = math.sin(min(1, v * 1.6) * math.pi / 2)
        top = max(0, (v - .45) / .55)
        r = (1 + .33 * bulge) * (1 - top ** 1.8)
        fold = 1 + .018 * math.sin(7 * a + .6) * math.sin(v * math.pi) ** 2
        rx, ry = IN_RX * r * fold, IN_RY * r * .97 * fold
        z = 1.702 + .032 * math.sin(v * math.pi / 2) + .036 * top ** .8 - .004 * (1 - bulge)
        p = Vector((rx * math.cos(a) - .012 * bulge, CY + ry * math.sin(a), z))
        return pivot + (tilt @ (p - pivot)) if v > .02 else p
    it.add(solid(surface('beret wool crown', crown, 96, 26), .004, -1), 'beret wool crown', 'wool-sage')
    top = crown(0, 1)
    it.add(sweep('beret stalk', [top - Vector((0, 0, .002)), top + Vector((.002, 0, .010))],
                 circle(.0026, 10), [(1, 1), (.7, .7)]), 'beret wool crown', 'wool-sage')
    # Brooch and feathers on the wearer's right, above the band.
    a = math.radians(214)
    pin = Vector(((IN_RX + .012) * math.cos(a), CY + (IN_RY + .012) * math.sin(a), 1.711))
    normal = Vector((math.cos(a), math.sin(a) * .8, .1)).normalized()
    feather(it, 'ivory pheasant feather', pin + Vector((.002, .008, .004)), (-.35, .5, 1), (-.3, .3, -.1), .14, .019,
            'feather', .25)
    feather(it, 'russet feather', pin + Vector((.004, .006, .002)), (-.6, .35, .75), (-.25, .25, -.18), .095, .015,
            'feather-russet', .15)
    it.add(ring('brooch rim', pin, normal, .0092, .0022, 32, 8), 'gold brooch', 'gold')
    it.add(gem('brooch gem', pin + normal * .0014, normal, .0072, .004, 12), 'brooch gem', 'turquoise')
    it.add(beads('brooch beads', [pin + (frame_from(normal)[0] * math.cos(k * TAU / 10)
                                         + frame_from(normal)[1] * math.sin(k * TAU / 10)) * .0122
                                  for k in range(10)], .0017, 8, 5), 'gold brooch', 'gold')
    return it


def _star_outline(r, points=5, inner=.45):
    return [(math.sin(i * math.pi / points) * r * (1 if i % 2 == 0 else inner),
             math.cos(i * math.pi / points) * r * (1 if i % 2 == 0 else inner)) for i in range(points * 2)]


def wizard_hat():
    it = Item('wizard-hat', 'template')

    def lift(v, a):
        return -.003 * v + v * v * (.0075 * math.sin(2 * a + .5)) - .013 * v ** 3 + .016 * v ** 4 * max(0, math.sin(a))
    brim(it, 'wide wizard brim', .238, .222, lift, 'felt-plum', thickness=.005)
    # Crown swept along a bent spine: tall, creased, with a drooping tip.
    spine = spline([(0, CY, 1.689), (0, -.010, 1.77), (0, -.002, 1.85), (.004, .012, 1.93), (.008, .022, 1.995),
                    (.010, .014, 2.045), (.009, -.012, 2.074), (.007, -.044, 2.078), (.004, -.068, 2.062)], 8)
    radii = spline([(.1185, .1435, 0), (.111, .132, 0), (.093, .107, 0), (.068, .077, 0), (.045, .050, 0),
                    (.031, .033, 0), (.019, .020, 0), (.010, .010, 0), (.0015, .0015, 0)], 8)
    count = len(spine)
    scales = []
    for k, r in enumerate(radii):
        q = k / (count - 1)
        crease = 1 + .07 * math.exp(-((q - .66) / .05) ** 2) + .04 * math.exp(-((q - .42) / .05) ** 2)
        scales.append((r.x * crease, r.y * crease))
    crown_ob = sweep('wizard crown', spine, circle(1, 64), scales, up=(1, 0, 0))
    it.add(solid(crown_ob, .004, -1), 'wizard crown', 'felt-plum')

    # Gold band with a square buckle and a turquoise stone at the front.
    def band(u, v):
        a = u * TAU
        return Vector(((IN_RX + .0015 - .004 * v) * math.cos(a), CY + (IN_RY + .0015 - .005 * v) * math.sin(a),
                       1.700 + .028 * v))
    it.add(solid(surface('gold band', band, 96, 3), .0022, 0), 'gold band', 'gold')
    front = band(.75, .5) + Vector((0, -.004, 0))
    for (dx, dz, w, h) in [(0, .0125, .03, .005), (0, -.0125, .03, .005), (.0125, 0, .005, .03), (-.0125, 0, .005, .03)]:
        it.add(bevel(sweep('buckle bar', [front + Vector((dx, .002, dz)), front + Vector((dx, -.003, dz))],
                           rrect(w, h, .0012), up=(1, 0, 0)), .0008, 2), 'gold band', 'gold')
    it.add(gem('buckle stone', front + Vector((0, -.001, 0)), (0, -1, 0), .0085, .006, 12), 'buckle stone', 'turquoise')

    # Gold stars stitched on the crown.
    for q, a, size in [(.24, 215, .017), (.37, 300, .013), (.52, 245, .011), (.3, 20, .014), (.64, 290, .009),
                       (.46, 150, .012), (.2, 110, .013), (.42, 70, .010), (.58, 340, .009)]:
        k = min(count - 2, int(q * (count - 1)))
        centre, t = spine[k], (spine[k + 1] - spine[k]).normalized()
        ang = math.radians(a)
        p = centre + Vector((scales[k][0] * math.cos(ang), scales[k][1] * math.sin(ang), 0))
        nrm = Vector((math.cos(ang) / scales[k][0], math.sin(ang) / scales[k][1], 0)).normalized()
        nrm = (nrm - t * nrm.dot(t)).normalized()
        side, upv, nn = frame_from(nrm, t)
        outline = _star_outline(size)
        it.add(bevel(plate('crown star', outline, lambda s, tt: (p - nn * .0008 + side * s + upv * tt, nn), .0022),
                     .0008, 1), 'gold stars', 'gold')
    return it


def classy_hat():
    it = Item('classy-hat', 'template')

    def lift(v, a):
        side = math.cos(a) ** 2
        return -.002 * v + .021 * side * v ** 2.6 - .004 * (1 - side) * v * v
    brim(it, 'curled top hat brim', .186, .178, lift, 'felt-black', thickness=.0045)
    # Waisted crown with a slight bell towards the top.
    rows = [(1.690, 1.0), (1.72, .992), (1.78, .975), (1.84, .99), (1.895, 1.035), (1.918, 1.05), (1.925, 1.03),
            (1.9285, .98)]
    n = 80
    grid_rows = [[Vector((IN_RX * q.y * math.cos(a), CY + IN_RY * q.y * math.sin(a), q.x))
                  for a in [i * TAU / n for i in range(n)]] for q in spline([(z, f, 0) for z, f in rows], 4)]
    top = grid('top hat crown', grid_rows, cap_end=True)
    it.add(solid(top, .004, -1), 'top hat crown', 'felt-black')

    # Grosgrain band with a flat bow on the wearer's left.
    def band(u, v):
        a = u * TAU
        z = 1.700 + .036 * v
        f = .992 + .0 * v
        return Vector(((IN_RX * f + .0024) * math.cos(a), CY + (IN_RY * f + .0024) * math.sin(a), z))
    it.add(solid(surface('silk band', band, 96, 4), .0018, 0), 'grosgrain band', 'silk-burgundy')
    for v in (0, 1):
        it.add(sweep('band edge', [band(i / 96, v) for i in range(96)], circle(.0012, 6), closed=True,
                     up=lambda p, t, i: Vector((p.x, p.y - CY, 0))), 'grosgrain band', 'silk-burgundy')
    knot = band(0, .5)

    def on_crown(y, z, lift=0.0):
        """Point on the band's outer surface at the wearer's left, and its normal."""
        x = math.sqrt(max(0.0, 1 - ((y - CY) / (IN_RY * .992 + .0024)) ** 2)) * (IN_RX * .992 + .0024)
        nrm = Vector((x / (IN_RX * .992) ** 2, (y - CY) / (IN_RY * .992) ** 2, 0)).normalized()
        return Vector((x, y, z)) + nrm * lift, nrm
    for sign in (1, -1):
        lobe = []
        for k in range(28):
            f = k * TAU / 28
            reach = .5 + .5 * math.cos(f)            # 1 at the lobe's far end
            lobe.append((knot.y + sign * (.0205 + .0195 * math.cos(f)),
                         knot.z + .0125 * math.sin(f) * (.4 + .6 * reach)))
        it.add(bevel(plate('bow loop', lobe, lambda s, t: on_crown(s, t, .0024), .011, smooth=True), .0046, 4),
               'grosgrain band', 'silk-burgundy')
        tail = [(knot.y + sign * .002, knot.z - .002), (knot.y + sign * .012, knot.z - .026),
                (knot.y + sign * .0195, knot.z - .031), (knot.y + sign * .0155, knot.z - .023),
                (knot.y + sign * .008, knot.z - .002)]
        it.add(bevel(plate('bow tail', tail if sign < 0 else list(reversed(tail)), lambda s, t: on_crown(s, t, .0026),
                           .0026), .0009, 2), 'grosgrain band', 'silk-burgundy')
    knot_outline = [(knot.y + .0068 * math.cos(k * TAU / 16), knot.z + .0092 * math.sin(k * TAU / 16)) for k in range(16)]
    it.add(bevel(plate('bow knot', knot_outline, lambda s, t: on_crown(s, t, .005), .0118, smooth=True), .0048, 4),
           'grosgrain band', 'silk-burgundy')
    return it


def kings_crown():
    it = Item('gold-crown', 'template')
    z0, z1 = 1.697, 1.733

    def band(u, v):
        a = u * TAU
        rx, ry = .1205 + .0055 * v, .1475 + .0055 * v
        return Vector((rx * math.cos(a), CY + ry * math.sin(a), z0 + (z1 - z0) * v))

    def outward(u, v):
        a = u * TAU
        return Vector((math.cos(a) / .123, math.sin(a) / .15, -.05)).normalized()
    it.add(solid(surface('crown band', band, 128, 6), .0055, 1), 'gold crown', 'gold')
    # Beaded rims above and below the band.
    for v, count, r in [(0.0, 64, .0029), (1.0, 64, .0026)]:
        pts = [band(k / count, v) + outward(k / count, v) * .0058 for k in range(count)]
        it.add(beads('crown beading', pts, r, 8, 6), 'crown pearls', 'pearl' if v else 'gold')

    def place(u0):
        def at(s, t):
            a = u0 * TAU + s / .135
            u = (a / TAU) % 1
            v = min(1.0, max(0.0, t / (z1 - z0)))
            p = band(u, v) if t <= z1 - z0 else band(u, 1) + Vector((0, 0, t - (z1 - z0)))
            if t > z1 - z0:
                # Points lean slightly outward like a real open crown.
                p += outward(u, 1) * (t - (z1 - z0)) * .16
            return p + outward(u, 1) * .0005, outward(u, 1)
        return at
    fleur = [(0, .052), (.004, .046), (.0075, .036), (.0078, .026), (.006, .019), (.009, .022), (.014, .031),
             (.020, .036), (.0245, .033), (.0252, .026), (.0215, .019), (.016, .0145), (.0125, .0118),
             (.0135, .0060), (.0105, .0020), (.0105, -.002)]
    fleur = [(x, z + .028) for x, z in fleur]
    fleur_outline = fleur + [(-x, z) for x, z in reversed(fleur)]
    spike = [(0, .074), (.0045, .062), (.0085, .045), (.0125, .031), (.0145, .026), (-.0145, .026), (-.0125, .031),
             (-.0085, .045), (-.0045, .062)]
    for k in range(8):
        u = .75 + k / 8
        at = place(u)
        if k % 2 == 0:
            it.add(bevel(plate('fleur-de-lis', fleur_outline, at, .0048), .0012, 2), 'gold crown', 'gold')
            it.add(bevel(plate('fleur band', [(-.017, .037), (.017, .037), (.017, .043), (-.017, .043)],
                               lambda s, t: (at(s, t)[0] + at(s, t)[1] * .0045, at(s, t)[1]), .0022), .0008, 1),
                   'gold crown', 'gold-dark')
            gem_key = ['ruby', 'sapphire', 'ruby', 'sapphire'][k // 2]
            p, nrm = at(0, .0165)
            it.add(ring('gem setting', p + nrm * .0048, nrm, .0088, .0019, 32, 8), 'gold crown', 'gold')
            it.add(gem('band jewel', p + nrm * .0052, nrm, .0082, .0055, 12, .82), 'band jewels ' + gem_key, gem_key)
        else:
            it.add(bevel(plate('crown point', list(reversed(spike)), at, .0045), .0012, 2),
                   'gold crown', 'gold')
            p, nrm = at(0, .079)
            it.add(beads('point pearl', [p + nrm * .0022], .0058, 14, 9), 'crown pearls', 'pearl')
            p, nrm = at(0, .0165)
            it.add(gem('band emerald', p + nrm * .0052, nrm, .0056, .004, 10), 'band jewels emerald', 'emerald')
            it.add(ring('emerald setting', p + nrm * .0048, nrm, .0062, .0015, 24, 8), 'gold crown', 'gold')
        # Small studs between the jewels.
        for side in (-1, 1):
            p, nrm = at(side * .027, .0165)
            it.add(beads('band stud', [p + nrm * .0052], .0021, 8, 5), 'crown pearls', 'pearl')
    return it


def helmet():
    """Horned steel helmet: spangen dome, brow band, nasal, cheek and neck guards."""
    it = Item('steel-helm', 'world')
    cy, apex, wall = -.02, 1.776, 1.655
    RX, RY = .1255, .1375

    def edge(a):
        return 1.623 - .029 * math.sin(a) + .004 * math.cos(2 * a)

    def shape(z):
        if z <= wall:
            return 1 + .035 * min(1, (wall - z) / .06)
        s = min(1, (z - wall) / (apex - wall))
        return max(0, 1 - s ** 2.3) ** .55

    def dome(u, v, offset=0.0):
        a = u * TAU - math.pi / 2
        z = edge(a) + (apex - edge(a)) * v
        f = shape(z)
        n2 = Vector((math.cos(a) / RX, math.sin(a) / RY, 0)).normalized()
        return Vector((RX * f * math.cos(a), cy + RY * f * math.sin(a), z)) + n2 * offset * min(1, f * 3)
    shell = surface('helmet dome', dome, 112, 44, cap_end=False)
    it.add(solid(shell, .0045, -1), 'polished steel', 'steel')

    # Brow band, trims and rivets.
    loop = [dome(i / 112, .045, .0022) for i in range(112)]
    it.add(sweep('brow band', loop, rrect(.0044, .0235, .0018), closed=True,
                 up=lambda p, t, i: Vector((p.x, p.y - cy, 0))), 'band steel', 'steel-dark')
    for v, dz, r in [(0, -.0046, .0024), (.12, 0, .0018)]:
        trim = [dome(i / 112, v, .0046) + Vector((0, 0, dz)) for i in range(112)]
        it.add(sweep('brass trim', trim, circle(r, 10), closed=True,
                     up=lambda p, t, i: Vector((p.x, p.y - cy, 0))), 'brass trim', 'brass')
    rivets = [dome(k / 20 + .025, .045, .0068) for k in range(20) if k not in (0, 5, 15)]
    it.add(beads('band rivet', rivets, .0026, 10, 6), 'brass trim', 'brass')

    # Crest ridge from brow to nape and side spangen bands with rivets.
    crest = [dome(.0, .1 + .9 * k / 15, .001) for k in range(15)] + [dome(.5, 1 - .9 * k / 15, .001) for k in range(16)]
    it.add(sweep('crest ridge', spline(crest, 4), [(-.003, -.0075), (.0012, -.0052), (.0036, -.0016), (.0042, 0),
                                                         (.0036, .0016), (.0012, .0052), (-.003, .0075)], up=lambda p, t, i: Vector((p.x, p.y - cy, p.z - 1.6))),
           'polished steel', 'steel')
    for u in (.25, .75):
        strap = [dome(u, v, .0028) for v in [.11 + k * .8 / 24 for k in range(25)]]
        it.add(sweep('spangen band', strap, rrect(.003, .0165, .0012),
                     up=lambda p, t, i: Vector((p.x, p.y - cy, p.z - 1.62))), 'band steel', 'steel-dark')
        it.add(beads('spangen rivet', [dome(u, v, .0062) for v in (.2, .36, .52, .68)], .0022, 10, 6), 'brass trim', 'brass')
    for u in (0, .5):
        it.add(beads('crest rivet', [dome(u, v, .0092) for v in (.16, .3)], .0021, 10, 6), 'brass trim', 'brass')

    # Nasal: a tapered bar that stays clear of any eyewear.
    top = dome(.0, .02, .004)
    nasal = [top + Vector((0, 0, .004)), Vector((0, -.1655, 1.628)), Vector((0, -.1685, 1.606)),
             Vector((0, -.1695, 1.596))]
    nasal = spline(nasal, 6)
    count = len(nasal)
    it.add(bevel(sweep('nasal guard', nasal, rrect(.0048, 1, .0015),
                       [(1, .0205 - .008 * (k / (count - 1)) + .004 * max(0, (k / (count - 1) - .8) / .2))
                        for k in range(count)], up=(0, -1, 0)), .0008, 2), 'band steel', 'steel-dark')
    it.add(beads('nasal rivet', [top + Vector((0, -.0052, -.012))], .0024, 10, 6), 'brass trim', 'brass')

    # Cheek guards hinged under the band, in front of the ears.
    for s in (1, -1):
        def guard(u, v, s=s):
            y = (-.109 + .032 * v ** 1.5) * (1 - u) + (-.043 - .014 * v) * u
            z = 1.642 - .094 * v * (1 - .28 * (2 * u - 1) ** 2)
            x = (.107 + .012 * (y + .109) / .066) - .010 * v * v + .0035 * math.sin(math.pi * u) * math.sin(math.pi * v)
            return Vector((s * x, y, z))
        g = surface('cheek guard', guard, 18, 14, closed_u=False)
        if s < 0:
            g.data.flip_normals()
        it.add(solid(g, .0038, -s), 'polished steel', 'steel')
        rim = [guard(k / 20, 0) for k in range(21)] + [guard(1, k / 16) for k in range(1, 17)] + \
              [guard(1 - k / 20, 1) for k in range(1, 21)] + [guard(0, 1 - k / 16) for k in range(1, 16)]
        it.add(sweep('guard trim', rim, circle(.0017, 8), closed=True,
                     up=lambda p, t, i: Vector((p.x, 0, 0))), 'brass trim', 'brass')
        it.add(beads('guard rivet', [guard(u, v) + Vector((s * .0055, 0, 0)) for u, v in [(.3, .22), (.7, .22), (.5, .7)]],
                     .0022, 10, 6), 'brass trim', 'brass')
        it.add(sweep('guard hinge', [guard(.15, 0) + Vector((s * .003, 0, .003)), guard(.85, 0) + Vector((s * .003, 0, .003))],
                     circle(.0032, 12), up=(0, 0, 1)), 'brass trim', 'brass')

    # Neck guard in two overlapping lames.
    for lame, (v0, v1, grow) in enumerate([(0, .55, 0), (.45, 1, .0035)]):
        def neck(u, v, v0=v0, v1=v1, grow=grow):
            a = math.radians(48 + 84 * u)
            w = v0 + (v1 - v0) * v
            ends = 1 - .45 * abs(2 * u - 1) ** 3
            z = edge(a) + .003 - .046 * w * ends
            f = 1.035 + .045 * w
            return Vector((RX * f * math.cos(a), cy + RY * f * math.sin(a), z)) + \
                Vector((math.cos(a), math.sin(a), 0)) * (.001 + grow)
        it.add(solid(surface('neck guard lame', neck, 30, 6, closed_u=False), .0035, 1), 'polished steel', 'steel')
        it.add(sweep('lame trim', [neck(k / 30, 1) for k in range(31)], circle(.0016, 8),
                     up=(0, 0, 1)), 'brass trim', 'brass')

    # Horns in brass sockets: out, up, then forward.
    for s in (1, -1):
        base = dome(.25 if s > 0 else .75, .40)
        out = Vector((s, 0, .25)).normalized()
        it.add(sweep('horn socket', [base - out * .006, base + out * .013], circle(.0235, 24),
                     [(1, 1), (.92, .92)], up=(0, 0, 1)), 'brass trim', 'brass')
        it.add(ring('socket ring', base + out * .012, out, .0215, .0026, 36, 8), 'brass trim', 'brass')
        pts = [base + out * .01, base + Vector((s * .038, -.002, .014)), base + Vector((s * .066, -.009, .040)),
               base + Vector((s * .080, -.021, .076)), base + Vector((s * .077, -.037, .110)),
               base + Vector((s * .064, -.050, .132))]
        horn = spline(pts, 10)
        count = len(horn)
        split = int(count * .8)

        def radius(k):
            q = k / (count - 1)
            ridge = 1 + .05 * max(0, math.sin(q * math.pi * 10)) * (1 - q)
            return (.0182 * (1 - q) ** .8 + .0012) * ridge
        body = [(radius(k), radius(k)) for k in range(count)]
        it.add(sweep('ivory horn', horn[:split + 1], circle(1, 20), body[:split + 1], caps=False), 'ivory horns', 'horn')
        it.add(sweep('horn tip', horn[split:], circle(1, 20), body[split:]), 'horn tips', 'horn-tip')
    return it


ITEMS = [goggles, sunglasses, beret, wizard_hat, classy_hat, kings_crown, helmet]


def build(emit, world_to_template, materials, only=None):
    """Create every item; `emit(obj, item_id, name, material)` tags each part."""
    for maker in ITEMS:
        it = maker()
        if only and it.item_id not in only:
            for ob, _name, _mat in it.parts:
                bpy.data.objects.remove(ob, do_unlink=True)
            continue
        groups = {}
        for ob, name, mat in it.parts:
            groups.setdefault(mat, (name, []))[1].append(ob)
        for mat, (name, obs) in groups.items():
            ob = bake_join(obs, name)
            if it.space == 'world':
                ob.matrix_world = world_to_template @ ob.matrix_world
            ob.data.materials.clear()
            ob.data.materials.append(materials[mat])
            emit(ob, it.item_id, name, mat)


def make_materials(material):
    """Materials through the build's own factory: material(name, colour, rough, metal, glow)."""
    return {key: material(*spec) for key, spec in MATERIALS.items()}
