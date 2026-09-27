"""Held items: blades for the right fist, shields for the left arm.

Every item is authored once, as plain geometry pieces, and placed on each
character by the build (`tools/build-items-3d.py`, `hold_items`).

Blade space (metres): origin on the grip axis at the middle of the fist, +Z
along the grip towards the blade (the thumb side), +X towards the fingers
(the edge a blade leads with), +Y the palm normal (the flats face +/-Y). The
handle is a cylinder of `fist_model.GRIP_RADIUS` on z in [-.05, .05].

Shield space: origin on the handle, +X to the front of the body along the
handle, -Y the outer face of the shield (away from the arm), +Z up the forearm
towards the elbow. `SHIELD_TO_GRIP` maps it onto the fist's grip frame.

Designs are re-drawn in the game's palette (satin steel, brushed gold,
chestnut leather, enamel) from the supplied references; the hero shield
board is the supplied model itself, its crest texture flattened to clean
colour fields (`SOURCED`).
"""
import math

import bmesh
from mathutils import Matrix, Vector

TAU = math.tau
GRIP = .0135  # fist_model.GRIP_RADIUS, repeated so the module stays standalone

# Blade space -> grip frame: a quarter turn about the grip so the flats face
# the front camera and the edge leads outwards (the fist holds the grip
# thumb up, in a forearm bent up at the elbow).
BLADE_TO_GRIP = Matrix.Rotation(-math.pi / 2, 4, 'Z')
# Arm pose (arm_pose.POSES) each right-hand item asks for; `ready` otherwise.
ARM_POSES = {'wooden-staff': 'staff'}


# Roll about the grip, per item: blades are held in guard, edges up and down
# (the katana edge down, its back and curve towards the sky), flats to the
# side; the wand keeps its horns facing the camera.
BLADE_ROLL = {item: math.radians(90) for item in ('templar-dagger', 'medieval-sword', 'japanese-blade', 'epic-sword')}


def arm_pose_of(item):
    return ARM_POSES.get(item, 'ready')


def blade_to_grip(item):
    return BLADE_TO_GRIP @ Matrix.Rotation(BLADE_ROLL.get(item, 0.0), 4, 'Z')

# Shield space -> blade/grip space: X_S -> +Z, Y_S -> +Y, Z_S -> -X.
SHIELD_TO_GRIP = Matrix(((0, 0, -1, 0), (0, 1, 0, 0), (1, 0, 0, 0), (0, 0, 0, 1)))


class Piece:
    def __init__(self, name, verts, faces, finish, smooth=True, bevel=0.0):
        self.name, self.verts, self.faces = name, [tuple(v) for v in verts], [tuple(f) for f in faces]
        self.finish, self.smooth, self.bevel = finish, smooth, bevel


# ---------------------------------------------------------------- generators

def lathe(profile, segments=28, axis='Z', centre=(0, 0, 0), squash=(1, 1), phase=0.0):
    """Surface of revolution of [(radius, height)], closed at zero radius."""
    verts, faces, rings = [], [], []
    cx, cy, cz = centre
    for r, h in profile:
        if r <= 1e-7:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, h))
            continue
        ring = []
        for i in range(segments):
            a = phase + TAU * i / segments
            ring.append(len(verts))
            verts.append((r * math.cos(a) * squash[0], r * math.sin(a) * squash[1], h))
        rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            faces += [(a[0], b[i], b[(i + 1) % len(b)]) for i in range(len(b))]
        elif len(b) == 1:
            faces += [(a[(i + 1) % len(a)], a[i], b[0]) for i in range(len(a))]
        else:
            faces += [(a[i], a[(i + 1) % len(a)], b[(i + 1) % len(b)], b[i]) for i in range(len(a))]
    if len(rings[0]) > 1:
        faces.append(tuple(reversed(rings[0])))
    if len(rings[-1]) > 1:
        faces.append(tuple(rings[-1]))
    turn = {'Z': lambda x, y, z: (x, y, z), 'Y': lambda x, y, z: (x, z, -y), 'X': lambda x, y, z: (z, y, -x)}[axis]
    verts = [tuple(c + o for c, o in zip(turn(*v), centre)) for v in verts]
    return verts, faces


def loft(sections, cap=True):
    """Closed rings of equal size, joined in order (one ring may be a point)."""
    verts, rings = [], []
    for section in sections:
        rings.append(list(range(len(verts), len(verts) + len(section))))
        verts += [tuple(p) for p in section]
    faces = []
    for a, b in zip(rings[:-1], rings[1:]):
        if len(b) == 1:
            faces += [(a[i], a[(i + 1) % len(a)], b[0]) for i in range(len(a))]
        elif len(a) == 1:
            faces += [(a[0], b[(i + 1) % len(b)], b[i]) for i in range(len(b))]
        else:
            faces += [(a[i], a[(i + 1) % len(a)], b[(i + 1) % len(b)], b[i]) for i in range(len(a))]
    if cap and len(rings[0]) > 2:
        faces.append(tuple(reversed(rings[0])))
    if cap and len(rings[-1]) > 2:
        faces.append(tuple(rings[-1]))
    return verts, faces


def prism(outline, y0, y1, plane='XZ'):
    """Outline [(u, v)] extruded between y0 and y1 (plane XZ: u=x, v=z)."""
    n = len(outline)
    area = sum(outline[i][0] * outline[(i + 1) % n][1] - outline[(i + 1) % n][0] * outline[i][1] for i in range(n))
    if area < 0:
        outline = list(reversed(outline))
    if plane == 'XZ':
        place = lambda u, v, y: (u, y, v)
    else:  # XY: outline in x/y, extruded along z
        place = lambda u, v, y: (u, v, y)
    verts = [place(u, v, y) for y in (y0, y1) for u, v in outline]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))] if plane == 'XZ' else \
            [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) if plane == 'XZ' else (i + n, (i + 1) % n + n, (i + 1) % n, i)
              for i in range(n)]
    return verts, faces


def tube(points, radius, sides=10, cap=True, squash=1.0, closed=False):
    """Swept circle along a polyline; `radius` is a number or one per point."""
    radii = radius if isinstance(radius, (list, tuple)) else [radius] * len(points)
    pts = [Vector(p) for p in points]
    sections = []
    prev_normal = None
    for i, p in enumerate(pts):
        if closed:
            t = (pts[(i + 1) % len(pts)] - pts[i - 1]).normalized()
        else:
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if prev_normal is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0))
            prev_normal = (ref - t * ref.dot(t)).normalized()
        n = (prev_normal - t * prev_normal.dot(t)).normalized()
        prev_normal = n
        b = t.cross(n)
        sections.append([tuple(p + radii[i] * (n * math.cos(TAU * k / sides) + b * squash * math.sin(TAU * k / sides)))
                         for k in range(sides)])
    if closed:
        verts, faces = loft(sections + [sections[0]], cap=False)
        count = len(sections) * sides
        verts = verts[:count]
        faces = [tuple(i % count for i in f) for f in faces]
        return verts, faces
    return loft(sections, cap=cap)


def helix(radius, z0, z1, turns, wire, phase=0.0, samples_per_turn=24, squash=(1, 1)):
    n = max(8, int(turns * samples_per_turn))
    pts = [(radius * squash[0] * math.cos(phase + TAU * turns * i / n),
            radius * squash[1] * math.sin(phase + TAU * turns * i / n),
            z0 + (z1 - z0) * i / n) for i in range(n + 1)]
    return tube(pts, wire, sides=8, squash=.75)


def ellipsoid(centre, radii, segments=16, rings=10):
    verts, faces = [], []
    cx, cy, cz = centre
    verts.append((cx, cy, cz - radii[2]))
    for j in range(1, rings):
        t = math.pi * j / rings
        for i in range(segments):
            a = TAU * i / segments
            verts.append((cx + radii[0] * math.sin(t) * math.cos(a), cy + radii[1] * math.sin(t) * math.sin(a),
                          cz - radii[2] * math.cos(t)))
    verts.append((cx, cy, cz + radii[2]))
    top = len(verts) - 1
    faces += [(0, 1 + (i + 1) % segments, 1 + i) for i in range(segments)]
    for j in range(rings - 2):
        a0, b0 = 1 + j * segments, 1 + (j + 1) * segments
        faces += [(a0 + i, a0 + (i + 1) % segments, b0 + (i + 1) % segments, b0 + i) for i in range(segments)]
    last = 1 + (rings - 2) * segments
    faces += [(last + i, last + (i + 1) % segments, top) for i in range(segments)]
    return verts, faces


def blade(stations, section, curve=None):
    """Blade from stations [(z, half width, half thickness)], tip at the last.

    section(w, t) -> [(x, y)] ring; curve(z) -> x offset (curved blades).
    """
    rings = []
    for z, w, t in stations:
        dx = curve(z) if curve else 0.0
        if w <= 1e-6:
            rings.append([(dx, 0.0, z)])
        else:
            rings.append([(x + dx, y, z) for x, y in section(w, t)])
    return loft(rings)


def diamond(w, t):
    return [(w, 0), (0, t), (-w, 0), (0, -t)]


def hollow_ground(w, t):
    """Flat-faced blade with bevelled edges: reads crisp at small sizes."""
    return [(w, 0), (w * .45, t), (-w * .45, t), (-w, 0), (-w * .45, -t), (w * .45, -t)]


def katana_section(w, t):
    """Single edge at +x, ridge line (shinogi) and a rounded back at -x."""
    return [(w, 0), (-w * .25, t), (-w * .85, t * .7), (-w, 0), (-w * .85, -t * .7), (-w * .25, -t)]


def moved(piece_data, offset=(0, 0, 0), matrix=None):
    verts, faces = piece_data
    if matrix is not None:
        verts = [tuple(matrix @ Vector(v)) for v in verts]
    verts = [tuple(c + o for c, o in zip(v, offset)) for v in verts]
    return verts, faces


def mirrored_x(piece_data):
    verts, faces = piece_data
    return [(-x, y, z) for x, y, z in verts], [tuple(reversed(f)) for f in faces]


def circle(radius, n=48, start=0.0, arc=TAU, centre=(0, 0)):
    return [(centre[0] + radius * math.cos(start + arc * i / n), centre[1] + radius * math.sin(start + arc * i / n))
            for i in range(n + (0 if arc >= TAU - 1e-9 else 1))]


def cross_pattee(size):
    """Outline of a cross pattee (flared arms), centred at the origin."""
    a, n = size, size * .28   # arm reach, narrow waist half width
    f = size * .62            # flared tip half width
    return [(n, n), (f, a), (-f, a), (-n, n), (-a, f), (-a, -f), (-n, -n), (-f, -a), (f, -a), (n, -n), (a, -f), (a, f)]


# ---------------------------------------------------------------- blades

def _grip(name, finish, z0=-.052, z1=.052, radius=GRIP - .0004, squash=(1, .88), bulge=.0006):
    profile = [(0, z0 - .0015)]
    for i in range(9):
        t = i / 8
        profile.append((radius + bulge * math.sin(math.pi * t), z0 + (z1 - z0) * t))
    profile.append((0, z1 + .0015))
    return Piece(name, *lathe(profile, 24, squash=squash), finish)


def templar_dagger():
    """Short broad blade, black tapered grip, wheel pommel with a red cross."""
    pieces = [_grip('tapered black leather grip', 'dark_leather', radius=GRIP - .0010, bulge=.0012),
              Piece('grip ferrule', *lathe([(0, .049), (.0146, .049), (.0152, .053), (.0146, .057), (0, .057)], 24, squash=(1, .9)), 'steel'),
              Piece('pommel ferrule', *lathe([(0, -.058), (.0130, -.058), (.0138, -.054), (.0132, -.050), (0, -.050)], 24, squash=(1, .9)), 'steel')]
    guard = [(-.060, .053), (-.052, .057), (0, .0585), (.052, .057), (.060, .053), (.064, .061), (.060, .068),
             (.050, .065), (0, .0655), (-.050, .065), (-.060, .068), (-.064, .061)]
    pieces.append(Piece('straight steel crossguard', *prism(guard, -.0065, .0065), 'steel', False, .0018))
    stations = [(.0655, .0215, .0048), (.080, .0225, .0046), (.120, .0222, .0042), (.180, .0200, .0036),
                (.240, .0165, .0030), (.290, .0110, .0024), (.320, .0050, .0016), (.334, 0, 0)]
    pieces.append(Piece('broad double-edged blade', *blade(stations, diamond), 'steel', False))
    pieces.append(Piece('blade ridge line', *blade([(z, w * .12, t + .0002) for z, w, t in stations[:-2]] + [(.318, 0, 0)], diamond), 'bright_steel', False))
    # Wheel pommel, faces towards +/-Y: steel rim, ivory enamel, red cross.
    wheel = [(.0275 * math.cos(TAU * i / 8 + TAU / 16), -.0815 + .0275 * math.sin(TAU * i / 8 + TAU / 16)) for i in range(8)]
    pieces.append(Piece('octagonal wheel pommel', *prism(wheel, -.0085, .0085), 'steel', False, .0022))
    pieces.append(Piece('pommel neck', *lathe([(0, -.060), (.0085, -.060), (.0070, -.056), (0, -.052)], 16), 'steel'))
    inner = [(x * .78, (z + .0815) * .78 - .0815) for x, z in wheel]
    for side in (-1, 1):
        pieces.append(Piece('ivory pommel enamel', *prism(inner, side * .0086, side * .0094), 'ivory', False))
        cross = [(x, z - .0815) for x, z in cross_pattee(.0145)]
        pieces.append(Piece('red cross pattee', *prism(cross, side * .0093, side * .0102), 'red', False))
    return pieces


def medieval_sword():
    """Arming sword: curved quillons, corded leather grip, wheel pommel."""
    pieces = [_grip('leather grip', 'leather')]
    for phase in (0.0, math.pi):
        pieces.append(Piece('spiral leather cord', *helix(GRIP + .0002, -.046, .046, 3.5, .0021, phase, squash=(1, .88)), 'wood'))
    for z in (.054, -.054):
        pieces.append(Piece('steel collar', *lathe([(0, z - .004), (.0150, z - .004), (.0165, z), (.0150, z + .004), (0, z + .004)], 24, squash=(1, .9)), 'steel'))
    # Quillons curving towards the blade, flared tips, a langet over the blade.
    top, bottom = [], []
    for i in range(21):
        x = -.104 + .208 * i / 20
        u = abs(x) / .104
        centre = .066 + .026 * u ** 2.2
        half = .0072 - .0022 * u + (.0030 if u > .9 else 0)
        top.append((x, centre + half)); bottom.append((x, centre - half))
    outline = bottom + list(reversed(top))
    pieces.append(Piece('curved crossguard', *prism(outline, -.0070, .0070), 'steel', False, .0020))
    langet = [(-.016, .060), (.016, .060), (.018, .074), (0, .088), (-.018, .074)]
    pieces.append(Piece('guard langet', *prism(langet, -.0090, .0090), 'steel', False, .0018))
    stations = [(.072, .0245, .0050), (.120, .0240, .0046), (.300, .0215, .0040), (.500, .0185, .0033),
                (.640, .0150, .0027), (.720, .0090, .0020), (.760, .0030, .0012), (.772, 0, 0)]
    pieces.append(Piece('long double-edged blade', *blade(stations, hollow_ground), 'steel', False))
    fuller = [(.082, .0050, .0051), (.300, .0045, .0041), (.520, .0030, .0034), (.560, 0, 0)]
    pieces.append(Piece('fuller groove', *blade(fuller, lambda w, t: [(w, 0), (w, t), (-w, t), (-w, 0), (-w, -t), (w, -t)]), 'dark_steel', False))
    pieces.append(Piece('pommel neck', *lathe([(0, -.058), (.0100, -.058), (.0082, -.066), (.0075, -.074), (.0095, -.080), (0, -.082)], 20), 'steel'))
    pieces.append(Piece('wheel pommel', *lathe([(0, -.012), (.018, -.012), (.0265, -.008), (.0285, 0), (.0265, .008), (.018, .012), (0, .012)], 28, axis='Y', centre=(0, 0, -.103)), 'steel'))
    for side in (-1, 1):
        pieces.append(Piece('gold pommel boss', *ellipsoid((0, side * .0115, -.103), (.0115, .0045, .0115), 16, 8), 'gold'))
    return pieces


def ribbon_helix(radius, z0, z1, turns, width, thick, phase=0.0, squash=(1, 1), samples_per_turn=36):
    """Flat ribbon wound round the Z axis (a tsuka-ito cord), capped."""
    n = max(8, int(abs(turns) * samples_per_turn))
    rings = []
    for i in range(n + 1):
        u = i / n
        a = phase + TAU * turns * u
        z = z0 + (z1 - z0) * u
        c, s_ = math.cos(a), math.sin(a)
        ring = []
        for dr, dz in ((0, -width / 2), (thick, -width / 2 * .8), (thick, width / 2 * .8), (0, width / 2)):
            r = radius + dr
            ring.append((r * c * squash[0], r * s_ * squash[1], z + dz))
        rings.append(ring)
    return loft(rings)


def japanese_blade():
    """Katana: deep sori, kissaki tip, wavy hamon, bo-hi groove, gold habaki,
    round iron tsuba with a gold rim, diamond-wrapped tsuka over ivory
    same-gawa, gold menuki, fuchi and kashira."""
    squash = (1, .80)
    z_kashira, z_fuchi, z_tsuba = -.205, .040, .050
    # Tsuka: ivory ray-skin core, the silk cord crossing over it in diamonds.
    pieces = [Piece('same-gawa core', *lathe([(0, z_kashira), (.0136, z_kashira), (.0142, -.080), (.0140, z_fuchi), (0, z_fuchi)], 28, squash=squash), 'ivory')]
    length = z_fuchi - .004 - (z_kashira + .010)
    turns = length / .042  # one diamond every 2.1 cm
    for k, (direction, lift) in enumerate(((1, 0.0), (-1, .0007))):
        for phase in (0.0, math.pi):
            pieces.append(Piece('silk tsuka-ito', *ribbon_helix(.0138 + lift, z_kashira + .010, z_fuchi - .004, direction * turns,
                                                                  .0105, .0017, phase + (math.pi / 2 if k else 0), squash), 'burgundy', False))
    for side in (-1, 1):
        pieces.append(Piece('gold menuki', *ellipsoid((.002, side * .0138 * squash[1] + side * .0012, -.090), (.0085, .0030, .0145), 16, 8), 'gold'))
    pieces.append(Piece('gold kashira', *lathe([(0, z_kashira - .012), (.0090, z_kashira - .012), (.0138, z_kashira - .008),
                                                 (.0152, z_kashira - .002), (.0150, z_kashira + .004), (0, z_kashira + .004)], 28, squash=squash), 'gold'))
    pieces.append(Piece('gold fuchi', *lathe([(0, z_fuchi - .006), (.0150, z_fuchi - .006), (.0156, z_fuchi), (.0154, z_tsuba - .002), (0, z_tsuba - .002)], 28, squash=squash), 'gold'))
    # Seppa washers, round iron tsuba, gold rim.
    for z0, z1 in ((z_tsuba - .002, z_tsuba), (z_tsuba + .006, z_tsuba + .008)):
        pieces.append(Piece('gold seppa', *lathe([(0, z0), (.0175, z0), (.0175, z1), (0, z1)], 28, squash=(1, .82)), 'gold'))
    pieces.append(Piece('round iron tsuba', *lathe([(0, z_tsuba), (.0365, z_tsuba), (.0372, z_tsuba + .003), (.0365, z_tsuba + .006), (0, z_tsuba + .006)], 48, squash=(1, .92)), 'iron'))
    pieces.append(Piece('tsuba gold rim', *lathe([(.0345, z_tsuba - .0006), (.0382, z_tsuba - .0006), (.0386, z_tsuba + .003),
                                                   (.0382, z_tsuba + .0066), (.0345, z_tsuba + .0066)], 48, squash=(1, .92)), 'gold'))
    z0, z_tip = z_tsuba + .008, .805
    span = z_tip - z0
    sori = lambda z: -.046 * max(0.0, (z - z0) / span) ** 1.45
    z_yokote = z_tip - .068

    def half_width(z):
        return .0150 - .0032 * (z - z0) / span

    def thickness(z):
        return .0037 - .0013 * (z - z0) / span

    def station(z):
        """(centre offset, half width) with a straight back and the edge
        sweeping up to it through the kissaki."""
        w = half_width(z)
        if z <= z_yokote:
            return sori(z), w
        w_y = half_width(z_yokote)
        u = min(1.0, (z - z_yokote) / (z_tip - z_yokote))
        back = sori(z) - w_y
        edge = back + 2 * w_y * math.sqrt(max(0.0, 1 - u * u))
        return (edge + back) / 2, (edge - back) / 2
    zs = [z0 + span * i / 40 for i in range(41) if z0 + span * i / 40 < z_yokote] + \
         [z_yokote + (z_tip - z_yokote) * i / 12 for i in range(12)]
    rings = []
    for z in zs:
        dx, w = station(z)
        rings.append([(x + dx, y, z) for x, y in katana_section(w, thickness(z))])
    rings.append([(sori(z_tip) - half_width(z_yokote), 0.0, z_tip)])
    pieces.append(Piece('curved katana blade', *loft(rings), 'steel', False))
    # Habaki: the gold collar gripping the blade root.
    habaki = []
    for z in (z0, z0 + .024):
        dx, w = station(z)
        habaki.append([(x + dx, y, z) for x, y in katana_section(w + .0016, thickness(z) + .0017)])
    pieces.append(Piece('gold habaki', *loft(habaki), 'gold', False, .0006))
    # Hamon: a frosty temper line along the edge, gently waving.
    hamon = []
    for z in [z for z in zs if z > z0 + .026]:
        dx, w = station(z)
        t = thickness(z)
        hw = min(w * .95, .0040 + .0011 * math.sin((z - z0) * 95) + .0006 * math.sin((z - z0) * 233))
        f = hw / (1.25 * w)
        hamon.append([(dx + w + .00012, 0.0, z), (dx + w - hw, f * t + .00016, z), (dx + w - hw, -(f * t + .00016), z)])
    dx, w = station(zs[-1])
    hamon.append([(sori(z_tip) - half_width(z_yokote) + .0004, 0.0, z_tip - .001)])
    pieces.append(Piece('wavy hamon', *loft(hamon), 'bright_steel', False))
    # Bo-hi: the groove down each flat, stopping short of the tip.
    for side in (-1, 1):
        groove = []
        for z in [z for z in zs if z0 + .030 < z < z_yokote - .10]:
            dx, w = station(z)
            t = thickness(z)
            ring = []
            for x_rel in (-.36, -.70):
                s_ = (-.25 - x_rel) / .60
                ring.append((dx + x_rel * w, side * (t - .3 * t * s_ + .00012), z))
            ring += [(ring[1][0], ring[1][1] - side * .0004, z), (ring[0][0], ring[0][1] - side * .0004, z)]
            groove.append(ring if side > 0 else list(reversed(ring)))
        pieces.append(Piece('bo-hi groove', *loft(groove), 'dark_steel', False))
    return pieces


def epic_sword():
    """The luminous hero blade: crescent guard, crystal core, spear pommel."""
    pieces = [_grip('burgundy leather grip', 'burgundy')]
    for z in (-.034, -.012, .012, .034):
        pieces.append(Piece('gold grip ring', *lathe([(0, z - .0022), (.0142, z - .0022), (.0150, z), (.0142, z + .0022), (0, z + .0022)], 24, squash=(1, .9)), 'gold'))
    pieces.append(Piece('gold collar', *lathe([(0, .050), (.0160, .050), (.0180, .058), (.0150, .066), (0, .066)], 24, squash=(1, .9)), 'gold'))
    pieces.append(Piece('spear pommel', *lathe([(0, -.050), (.0160, -.050), (.0180, -.058), (.0165, -.066), (.0200, -.078),
                                                (.0150, -.100), (.0060, -.118), (0, -.124)], 8, squash=(1, .78), phase=TAU / 16), 'gold', False, .0012))
    for side in (-1, 1):
        pieces.append(Piece('pommel crystal', *ellipsoid((0, side * .0120, -.083), (.0075, .0035, .0120), 16, 8), 'gem'))
    # Crescent moon around the blade root, horns towards the tip.
    c, outer, inner, shift = .128, .060, .049, .015
    outline = circle(outer, 48, math.radians(90 + 24), math.radians(312), (0, c))
    inner_arc = circle(inner, 48, math.radians(90 + 30), math.radians(300), (0, c + shift))
    horns = outline + list(reversed(inner_arc))
    pieces.append(Piece('crescent guard', *prism(horns, -.0075, .0075), 'gold', False, .0020))
    arms = [(x, z + .030) for x, z in [(-.118, .098), (-.100, .091), (-.024, .088), (0, .080), (.024, .088), (.100, .091), (.118, .098),
            (.100, .105), (.024, .108), (0, .116), (-.024, .108), (-.100, .105)]]
    pieces.append(Piece('cross arms', *prism(arms, -.0060, .0060), 'gold', False, .0018))
    for sign in (-1, 1):
        tip = [(sign * .112, .128), (sign * .130, .117), (sign * .150, .128), (sign * .130, .139)]
        pieces.append(Piece('arm crystal tip', *prism(tip, -.0045, .0045), 'gem', False, .0010))
    star = []
    for i in range(8):
        r = .021 if i % 2 == 0 else .0075
        a = math.pi / 2 + TAU * i / 8
        star.append((r * math.cos(a), c + r * math.sin(a)))
    for side in (-1, 1):
        pieces.append(Piece('guard star crystal', *prism(star, side * .0060, side * .0100), 'gem', False, .0008))
    stations = [(.066, .0200, .0056), (.100, .0300, .0056), (.118, .0380, .0054), (.140, .0270, .0050), (.175, .0300, .0048),
                (.400, .0275, .0042), (.650, .0235, .0035), (.800, .0170, .0028), (.860, .0080, .0018),
                (.884, 0, 0)]
    pieces.append(Piece('flared heroic blade', *blade(stations, hollow_ground), 'bright_steel', False))
    core = [(.130, .0060, .0058), (.200, .0078, .0045), (.600, .0060, .0038), (.720, .0030, .0032), (.745, 0, 0)]
    pieces.append(Piece('crystal core inlay', *blade(core, lambda w, t: [(w, 0), (w * .5, t), (-w * .5, t), (-w, 0), (-w * .5, -t), (w * .5, -t)]), 'gem_glow', False))
    return pieces


def wooden_staff():
    """Mage staff after the supplied wooden staff, slimmer and refined:
    a tapered, gently knotted shaft resting on the ground, a bronze foot,
    a knotted leather cord, and two branches curling round a glowing stone
    with a sprig of leaves."""
    foot, top = -1.080, .455
    wobble = lambda z: (.0035 * math.sin(z * 3.3 + .4), .0025 * math.sin(z * 2.1 + 1.3))

    def radius(z):
        r = .0105 + .0024 * (1 - abs(z - .02) / 1.1) ** 2
        if -.058 < z < .058:
            r = GRIP - .0004
        for zk, h in ((-.62, .0020), (-.31, .0016), (.22, .0017)):
            r += h * math.exp(-((z - zk) / .018) ** 2)
        return r
    zs = [foot + (top - foot) * i / 90 for i in range(91)]
    path = [(wobble(z)[0] * (0 if -.07 < z < .07 else 1), wobble(z)[1] * (0 if -.07 < z < .07 else 1), z) for z in zs]
    pieces = [Piece('tapered oak shaft', *tube(path, [radius(z) for z in zs], 14), 'wood')]
    pieces.append(Piece('bronze foot', *lathe([(0, foot - .004), (.0085, foot - .004), (.0112, foot + .006), (.0118, foot + .040),
                                               (.0126, foot + .046), (0, foot + .046)], 18), 'bronze'))
    # Leather cord: two spirals above the fist, knotted, two tails.
    for z0, z1, turns in ((.075, .215, 2.5), (.300, .400, 1.75)):
        pieces.append(Piece('leather cord', *helix(.0120, z0, z1, turns, .0017, 0.0, samples_per_turn=28), 'leather'))
    pieces.append(Piece('cord knot', *ellipsoid((.0120, -.001, .214), (.0045, .0040, .0050), 12, 6), 'leather'))
    for dx in (-.004, .005):
        tail = [(.0140, 0, .212), (.0175 + dx * .3, -.002, .195), (.0185 + dx, -.001, .170)]
        pieces.append(Piece('cord tail', *tube(tail, [.0016, .0014, .0010], 6), 'leather'))
    # Head: two branches leave the shaft, curl round the stone and meet
    # above it; a slim twig carries the leaves.
    orb = (0.0, 0.0, .503)
    for sign in (-1, 1):
        pts, radii = [], []
        for i in range(25):
            t = i / 24
            x = sign * (.0055 + .0325 * math.sin(math.pi * t) ** .7) * (1 - .85 * t ** 6)
            z = .440 + .118 * t
            pts.append((x, .004 * sign * math.sin(TAU * t), z))
            radii.append(.0098 - .0060 * t)
        pieces.append(Piece('curling branch', *tube(pts, radii, 12), 'wood'))
    pieces.append(Piece('bound fork', *helix(.0115, .425, .452, 2.0, .0015, 1.0, samples_per_turn=28), 'leather'))
    pieces.append(Piece('bound tips', *ellipsoid((0, 0, .556), (.0068, .0060, .0075), 12, 6), 'leather'))
    pieces.append(Piece('glowing stone', *ellipsoid(orb, (.0215, .0195, .0265), 20, 12), 'gem_glow'))
    pieces.append(Piece('stone setting', *ellipsoid((0, 0, .474), (.0110, .0100, .0055), 14, 6), 'bronze'))
    twig = [(-.033, .003, .472), (-.052, .007, .495), (-.064, .010, .512)]
    pieces.append(Piece('leaf twig', *tube(twig, [.0026, .0018, .0010], 6), 'wood'))
    for (x, z, a, size) in ((-.064, .512, 35, 1.0), (-.054, .497, -25, .8), (-.066, .494, 70, .7)):
        c, s_ = math.cos(math.radians(a)), math.sin(math.radians(a))
        leaf = []
        for i in range(11):
            u = i / 10
            w = .0075 * size * math.sin(math.pi * u) ** .8
            leaf.append((u * .034 * size, w))
        outline = leaf + [(u, -w) for u, w in reversed(leaf[1:-1])]
        pts = [(x - (u * c - v * s_), .010, z + (u * s_ + v * c)) for u, v in outline]
        verts, faces = prism([(p[0], p[2]) for p in pts], .0085, .0115)
        pieces.append(Piece('leaf', verts, faces, 'leaf', False, .0006))
    return pieces


def _band(centre, half_widths, y0, y1):
    """Flat curved band in the XZ plane: a centre line [(x, z)] widened by
    half_widths (one per point), extruded between y0 and y1."""
    left, right = [], []
    for i, (x, z) in enumerate(centre):
        a = centre[max(i - 1, 0)]; b = centre[min(i + 1, len(centre) - 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        n = math.hypot(tx, tz) or 1.0
        nx, nz = -tz / n, tx / n
        h = half_widths[i]
        left.append((x + nx * h, z + nz * h)); right.append((x - nx * h, z - nz * h))
    return prism(left + list(reversed(right)), y0, y1)


def metal_wand():
    """Short silver wand after the supplied metal wand, slimmer and refined:
    verdigris shaft, flared pommel, swept collar fins, and two flame horns
    cradling an emerald."""
    pieces = [_grip('verdigris grip', 'verdigris', -.050, .050, radius=GRIP - .0006, bulge=.0004)]
    shaft = [(0, 0, .048), (.0008, 0, .080), (.0016, 0, .115), (.0008, 0, .150), (0, 0, .182)]
    pieces.append(Piece('tapering shaft', *tube(shaft, [.0112, .0096, .0082, .0072, .0068], 16), 'verdigris'))
    for z in (-.050, .050):
        pieces.append(Piece('silver ring', *lathe([(0, z - .003), (.0142, z - .003), (.0150, z), (.0142, z + .003), (0, z + .003)], 24), 'bright_steel'))
    pieces.append(Piece('flared pommel', *lathe([(0, -.082), (.0165, -.082), (.0178, -.078), (.0120, -.066), (.0110, -.054), (0, -.054)], 24), 'bright_steel', False, .0008))
    # Swept collar fins, the right one longer.
    for sign, reach, lift in ((-1, .026, .052), (1, .031, .064)):
        centre = [(sign * (.004 + reach * t ** 1.4), .138 + lift * t) for t in [i / 10 for i in range(11)]]
        pieces.append(Piece('swept collar fin', *_band(centre, [.0050 * (1 - t) ** .8 + .0003 for t in [i / 10 for i in range(11)]], -.0022, .0022), 'bright_steel', False, .0006))
    pieces.append(Piece('collar', *lathe([(0, .132), (.0088, .132), (.0098, .140), (.0080, .148), (0, .148)], 20), 'bright_steel'))
    pieces.append(Piece('emerald bead', *ellipsoid((0, -.0072, .170), (.0040, .0030, .0040), 12, 6), 'emerald'))
    # Flame horns round the emerald, rising from a small cup.
    pieces.append(Piece('horn cup', *lathe([(0, .180), (.0075, .180), (.0120, .188), (.0105, .194), (0, .192)], 20), 'bright_steel'))
    gem_z = .208
    for sign, height, width in ((-1, .112, .030), (1, .082, .026)):
        centre = []
        for i in range(17):
            t = i / 16
            x = sign * (.006 + width * math.sin(math.pi * t) ** .8 * (1 - .25 * t) - .012 * t ** 3)
            z = .186 + height * t
            centre.append((x, z))
        widths = [.0048 * (1 - t) ** .75 + .0004 for t in [i / 16 for i in range(17)]]
        pieces.append(Piece('flame horn', *_band(centre, widths, -.0030, .0030), 'bright_steel', False, .0008))
    pieces.append(Piece('emerald', *ellipsoid((0, 0, gem_z), (.0105, .0095, .0140), 18, 10), 'emerald'))
    return pieces


# ---------------------------------------------------------------- shields

def _bend(verts, depth, half_width, axis=0):
    """Convex face: the board curves back towards the arm at its sides."""
    return [tuple(v[i] + (depth * (v[axis] / half_width) ** 2 if i == 1 else 0) for i in range(3)) for v in verts]


def _sliced(verts, faces, cuts, axis=0):
    """Extra loops across a flat piece so it can be bent smoothly."""
    bm = bmesh.new()
    for v in verts:
        bm.verts.new(v)
    bm.verts.ensure_lookup_table()
    for f in faces:
        bm.faces.new([bm.verts[i] for i in f])
    normal = Vector((1, 0, 0)) if axis == 0 else Vector((0, 0, 1))
    for c in cuts:
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=normal * c, plane_no=normal, dist=1e-7)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    verts = [tuple(v.co) for v in bm.verts]
    bm.verts.index_update()
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return verts, faces


def _handle(finish='wood', length=.060, strap_z=None):
    """Handle bar along X through the fist, iron brackets to the board."""
    pieces = [Piece('shield handle', *lathe([(0, -length), (GRIP - .0010, -length), (GRIP - .0004, 0), (GRIP - .0010, length), (0, length)], 20, axis='X', squash=(1, 1)), finish)]
    return pieces


def _bracket(x, y_board):
    return Piece('handle bracket', *tube([(x, 0, 0), (x, y_board * .55, 0), (x, y_board, 0)], .0055, 8), 'iron')


def wooden_shield():
    """Round plank shield: painted quarters, iron rim and boss, centre grip."""
    R, back, front = .270, -.070, -.084
    pieces = []
    edges = [-R + 2 * R * i / 6 for i in range(7)]
    for i in range(6):
        x0, x1 = edges[i] + .0012, edges[i + 1] - .0012
        for top in (True, False):
            outline = []
            for k in range(25):
                x = x0 + (x1 - x0) * k / 24
                z = math.sqrt(max(R * R - x * x, 0))
                outline.append((x, z if top else -z))
            outline += [(x1, .0008 if top else -.0008), (x0, .0008 if top else -.0008)]
            if not top:
                outline = list(reversed(outline))
            painted = (x0 + x1 < 0) == top
            pieces.append(Piece('painted plank' if painted else 'oak plank', *prism(outline, front, back), 'ivory' if painted else 'wood', False, .0012))
    pieces.append(Piece('iron rim', *tube([(R * math.cos(TAU * i / 72), (front + back) / 2, R * math.sin(TAU * i / 72)) for i in range(72)],
                                          .0092, 10, closed=True, squash=.9), 'iron'))
    # Boss: flange and dome over the fist.
    pieces.append(Piece('iron boss', *lathe([(.070, 0), (.070, -.004), (.062, -.006), (.058, -.014), (.050, -.030),
                                             (.036, -.042), (.018, -.048), (0, -.050)], 32, axis='Y', centre=(0, front, 0)), 'iron'))
    for k in range(8):
        a = TAU * k / 8 + TAU / 16
        pieces.append(Piece('rim rivet', *ellipsoid((R * .93 * math.cos(a), front - .002, R * .93 * math.sin(a)), (.0065, .004, .0065), 12, 6), 'iron'))
        pieces.append(Piece('boss rivet', *ellipsoid((.064 * math.cos(a), front - .006, .064 * math.sin(a)), (.0042, .0030, .0042), 10, 5), 'iron'))
    pieces += _handle('wood')
    pieces += [_bracket(x, back) for x in (-.058, .058)]
    return pieces


def _strap(z, y_board):
    """Leather forearm strap: from the board, round the inner side of the
    forearm (its axis runs near y = -.03), back to the board."""
    centre_y, rx, ry = -.030, .047, .046
    arc = [(rx * math.cos(a), centre_y + ry * math.sin(a), z) for a in [math.pi * i / 24 for i in range(25)]]
    pts = [(rx, y_board, z)] + arc + [(-rx, y_board, z)]
    return Piece('forearm strap', *tube(pts, .0085, 8, squash=.35), 'dark_leather')


def knight_shield():
    """Domed bronze round shield: braided gold rim, volutes, gold boss."""
    R, back = .285, -.078
    pieces = []
    dome = lambda r: -.030 * (1 - (r / R) ** 2)
    profile = [(0, back - .012 + dome(0))]
    for i in range(1, 13):
        r = R * i / 12
        profile.append((r, back - .012 + dome(r)))
    profile += [(R, back), (R * .96, back + .004), (0, back + .004)]
    # lathe(axis='Y') puts each profile height on y directly.
    pieces.append(Piece('domed bronze field', *lathe(profile, 64, axis='Y'), 'bronze'))
    surface = lambda r: back - .012 + dome(min(r, R)) - .0015
    ring = lambda r, n=96: [(r * math.cos(TAU * i / n), surface(r), r * math.sin(TAU * i / n)) for i in range(n)]
    pieces.append(Piece('gold outer rim', *tube(ring(R - .004), .0085, 10, closed=True, squash=.8), 'gold'))
    # Braided interlace: two ropes twisting round the rim band.
    for phase in (0.0, math.pi):
        pts = []
        for i in range(288):
            a = TAU * i / 288
            twist = phase + a * 36
            r = R - .030 + .0075 * math.cos(twist)
            pts.append((r * math.cos(a), surface(r) - .0035 - .0030 * math.sin(twist), r * math.sin(a)))
        pieces.append(Piece('braided interlace', *tube(pts, .0034, 8, closed=True), 'gold'))
    pieces.append(Piece('inner band', *tube(ring(R - .050), .0035, 8, closed=True, squash=.7), 'dark_bronze'))
    for k in range(12):
        a = TAU * k / 12
        r = R - .062
        pieces.append(Piece('band rivet', *ellipsoid((r * math.cos(a), surface(r) - .002, r * math.sin(a)), (.0055, .0035, .0055), 10, 5), 'gold'))
    # Mirrored volutes around the boss (a quiet heraldic motif).
    for sign in (-1, 1):
        pts, radii = [], []
        for i in range(41):
            t = i / 40
            a = math.radians(115 - 250 * t)
            r = .165 - .075 * t + .02 * math.sin(t * math.pi)
            x, z = sign * r * math.cos(a) * .95 + sign * .012, r * math.sin(a) * 1.05
            pts.append((x, surface(math.hypot(x, z)) - .003, z))
            radii.append(.0085 * (1 - .65 * t) + .0015)
        pieces.append(Piece('gold volute', *tube(pts, radii, 10, squash=.6), 'gold'))
        head = pts[0]
        pieces.append(Piece('volute knot', *ellipsoid((head[0], head[1] - .001, head[2]), (.013, .006, .011), 14, 7), 'gold'))
    pieces.append(Piece('gold boss', *lathe([(.072, 0), (.070, -.006), (.062, -.012), (.048, -.026), (.030, -.036), (0, -.040)], 40, axis='Y',
                                            centre=(0, surface(0) + .002, 0)), 'gold'))
    pieces.append(Piece('boss ring', *tube(ring(.056), .0030, 8, closed=True), 'dark_bronze'))
    pieces.append(Piece('leather lining', *lathe([(0, back + .0045), (R * .96, back + .0045), (R * .96, back + .0055), (0, back + .0055)], 48, axis='Y'), 'dark_leather'))
    return pieces


def _heater_outline(w, h, n=24):
    """Heater shield: gently arched top, straight sides, curved to a point."""
    top = [(w * (1 - 2 * i / n), h * .5 + .018 * math.cos(math.pi * (i / n - .5))) for i in range(n + 1)]
    side = []
    for i in range(1, n + 1):
        t = i / n
        z = h * .5 - h * .38 * t
        side.append((-w, z))
    curve = []
    for i in range(1, n + 1):
        t = i / n
        a = math.pi * .5 * t
        curve.append((-w * math.cos(a) ** 1.15, h * .12 - (h * .62) * math.sin(a)))
    left = side + curve
    right = [(-x, z) for x, z in reversed(left[:-1])]
    return top + left + right


def hero_shield():
    """The board comes from the supplied model, crest kept exactly as drawn
    (`SOURCED`); only the handle and the forearm strap are authored here."""
    return []


# ---------------------------------------------------------------- registry

BLADES = {'templar-dagger': templar_dagger, 'medieval-sword': medieval_sword,
          'japanese-blade': japanese_blade, 'epic-sword': epic_sword, 'wooden-staff': wooden_staff,
          'metal-wand': metal_wand}
# (builder, board centre height on the forearm): centre grips sit on the fist,
# strapped shields ride up the forearm.
SHIELDS = {'wooden-shield': wooden_shield, 'knight-shield': knight_shield, 'hero-shield': hero_shield}
STRAPPED = {'knight-shield': (.120, -.078), 'hero-shield': (.120, -.078)}
# Boards taken from a supplied model (assets/items-3d/sources/held/): the
# build imports the file, centres it on the handle in shield space, puts its
# back face at `board` and lifts it like the other strapped shields.
SOURCED = {'hero-shield': {'file': 'hero-shield.glb', 'board': -.078, 'lift': .120}}


def shield_pieces(item):
    pieces = SHIELDS[item]()
    if item in STRAPPED:
        lift, board = STRAPPED[item]
        # The board rides up the forearm; the fist holds a handle near its
        # lower rim, a strap holds the forearm near its top.
        for piece in pieces:
            piece.verts = [(x, y, z + lift) for x, y, z in piece.verts]
        pieces += _handle('dark_leather', .055)
        pieces += [_bracket(x, board) for x in (-.052, .052)]
        pieces.append(_strap(.215, board))
    return pieces
