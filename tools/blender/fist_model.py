"""Closed fist around a standard grip, sculpted as a signed distance field.

The delivered hands are open and static. A held item needs a real fist: the
fingers wrap the grip phalanx by phalanx, the thumb lies across the index and
middle fingers, and the wrist runs into the character's own forearm. The fist
replaces the open hand (`split_hand` cuts the skin at the wrist and closes the
forearm), so one fist serves every held item.

Hand frame H (metres), measured on the delivered hands (both characters, both
builds share them): origin at the wrist anchor, +Y towards the fingers, +Z the
palm normal (towards the thigh), +X towards the thumb. The left hand is the
mirror image: `hand_frame` returns a mirrored matrix for it.

The grip is a cylinder of radius `GRIP_RADIUS` on the axis `grip_frame()`:
every held item puts its handle on that axis, the part leaving the thumb side
towards the frame's +Z, so any later item fits the same fist.
"""
import math

import numpy as np
from mathutils import Matrix, Quaternion, Vector

VOXEL = .0008
# Anatomical fingers: (name, x across the palm, knuckle y, radius, phalanges).
FINGERS = [('index', .028, .100, .0104, (.049, .029, .021)),
           ('middle', .007, .103, .0109, (.053, .032, .022)),
           ('ring', -.014, .099, .0103, (.050, .030, .021)),
           ('little', -.033, .090, .0091, (.040, .024, .019))]
# Power grip flexion (MCP, PIP, DIP), degrees.
GRIP_RADIUS = .0135   # every held item's handle (2.7 cm)
GRIP_SETBACK = .023   # grip axis proximal of the knuckle row: the proximal phalanges drop past it
GRIP_HEIGHT = .0265   # ...and pressed into the palm (palm surface ~.0155)
# Thumb: carpometacarpal base, metacarpal head, interphalangeal joint, tip.
THUMB_BASE = (.022, .010, .006)
THUMB_RADII = (.0135, .0124, .0115, .0100)
# Wrist pose of a holding hand, applied distal to the wrist. The weapon hand
# rides a forearm bent up at the elbow (arm_pose.POSES), thumb up; ulnar or
# radial deviation sets the forward lean, supination the sideways one.
# `ready` (forearm 45° up): the blade raised ~40° forward of vertical, a touch
# outward, held in front without being brandished. `staff` (forearm nearly
# level): the staff upright, resting on the ground.
POSES = {'ready': {'ulnar': -5, 'supination': 14}, 'staff': {'ulnar': -6, 'supination': 12}, 'shield': {'ulnar': 0, 'supination': -35}}
CUT_Y = -.034         # the skin is split here, under the sleeve cuff
FIST_START_Y = -.046  # the fist overlaps the forearm from here, just outside it
SKIN_CLEARANCE = .0004
TWIST_START, TWIST_END = CUT_Y, .030   # no twist where the skin still runs


def _smin(a, b, k):
    k = np.maximum(k, 1e-6)
    h = np.clip(.5 + .5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def _segment(P, a, b, ra, rb, squash=1.0):
    """Tapered capsule; `squash` flattens it along Z (palm thickness)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    Q = P.copy()
    Q[..., 2] = a[2] + (P[..., 2] - a[2]) / squash
    e = b - a
    t = np.clip(((Q - a) @ e) / max(e @ e, 1e-14), 0, 1)
    d = np.linalg.norm(Q - a - t[..., None] * e, axis=-1)
    return (d - (ra + (rb - ra) * t)) * squash


def _ellipsoid(P, c, r):
    k = np.linalg.norm((P - np.asarray(c)) / np.asarray(r), axis=-1)
    return (k - 1) * min(r)


def _round_box(P, c, h, r):
    q = np.abs(P - np.asarray(c)) - (np.asarray(h) - r)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(-1), 0) - r


def grip_point(x):
    """Grip axis point at `x`: under the knuckles, pressed into the palm."""
    (x0, y0), (x1, y1) = [(f[1], f[2] - GRIP_SETBACK) for f in (FINGERS[2], FINGERS[0])]
    return np.array([x, y0 + (y1 - y0) * (x - x0) / (x1 - x0), GRIP_HEIGHT])


def finger_chains():
    """Joint points (MCP, PIP, DIP, tip) and radii of each finger, rest frame.

    Each phalanx flexes until it rests on the grip: the largest flexion that
    keeps it clear of the grip by the finger's own radius.
    """
    chains = []
    for name, x, y, r, lengths in FINGERS:
        radii = [r, r * .96, r * .91, r * .86]
        g = grip_point(x)[1:]
        p = np.array([y, 0.0]); points = [np.array([x, y, 0.0])]; angle = 0.0
        for i, length in enumerate(lengths):
            clear = GRIP_RADIUS + radii[i + 1] - .0006
            best = angle
            for step in range(1, 131):
                heading = angle + math.radians(step)
                q = p + length * np.array([math.cos(heading), math.sin(heading)])
                e = q - p
                t = min(1, max(0, (g - p) @ e / (e @ e)))
                if np.linalg.norm(p + t * e - g) < clear:
                    break
                best = heading
            angle = best
            p = p + length * np.array([math.cos(angle), math.sin(angle)])
            points.append(np.array([x, p[0], p[1]]))
        chains.append((name, points, radii))
    return chains


def thumb_chain(chains):
    """The thumb lies across the middle phalanges of the index and middle."""
    index = next(points for name, points, _ in chains if name == 'index')
    middle = next(points for name, points, _ in chains if name == 'middle')
    r_index = FINGERS[0][3]
    top = max(index[1][2], index[2][2])
    lie = top + r_index + THUMB_RADII[2] - .0025
    tip = (np.array(index[2]) + np.array(middle[2])) / 2
    tip = np.array([middle[0][0] - .004, tip[1] + .004, lie - .001])
    joint = np.array([.031, index[1][1] - .030, lie + .001])
    head = np.array([.041, joint[1] - .022, .030])
    return [np.array(THUMB_BASE), head, joint, tip]


def hand_field(P):
    """Signed distance to the fist (hand only, rest frame)."""
    chains = finger_chains()
    palm = _round_box(P, (-.002, .052, .002), (.037, .047, .0135), .010)
    for name, x, y, r, _ in FINGERS:
        base = (x * .58 - .003, .010, .0)
        palm = _smin(palm, _segment(P, base, (x, y, -.001), r + .0030, r + .0022, .80), .010)
    palm = _smin(palm, _ellipsoid(P, (.024, .036, .016), (.019, .030, .0165)), .010)
    palm = _smin(palm, _ellipsoid(P, (-.031, .046, .010), (.013, .036, .0125)), .008)
    knuckles = np.full(P.shape[:-1], 1.0)
    for name, x, y, r, _ in FINGERS:
        knuckles = np.minimum(knuckles, _ellipsoid(P, (x, y - .001, -.003), (r + .0012, r + .0018, r + .0010)))
    palm = _smin(palm, knuckles, .005)
    fingers = np.full(P.shape[:-1], 1.0)
    for name, points, radii in chains:
        chain = np.full(P.shape[:-1], 1.0)
        for i in range(3):
            chain = _smin(chain, _segment(P, points[i], points[i + 1], radii[i], radii[i + 1]), .0025)
        # Fingers press together: a sharp crease between them, not a mitten.
        fingers = _smin(fingers, chain, .0012)
    hand = _smin(palm, fingers, .0045)
    thumb_points = thumb_chain(chains)
    thumb = np.full(P.shape[:-1], 1.0)
    for i in range(3):
        thumb = _smin(thumb, _segment(P, thumb_points[i], thumb_points[i + 1], THUMB_RADII[i], THUMB_RADII[i + 1]), .003)
    # The thumb root melts into the thenar; its tip only rests on the index.
    k = .0015 + .0085 * np.clip((.075 - P[..., 1]) / .035, 0, 1)
    return _smin(hand, thumb, k)


def _grip_axis():
    """Grip axis and the clearance the sculpted fist actually leaves."""
    c = grip_point(0.0)
    axis = grip_point(1.0) - c
    axis /= np.linalg.norm(axis)
    xs = np.linspace(FINGERS[2][1] - .006, FINGERS[0][1] + .006, 61)
    clearance = float(hand_field(np.array([grip_point(x) for x in xs])).min())
    return c, axis, clearance


GRIP_CENTRE, GRIP_AXIS, GRIP_CLEARANCE = _grip_axis()


def pose_matrix(kind):
    """Rotation of the hand about the wrist, in the hand frame."""
    pose = POSES[kind]
    return (Matrix.Rotation(math.radians(pose['supination']), 4, 'Y')
            @ Matrix.Rotation(math.radians(pose['ulnar']), 4, 'Z'))


def grip_frame(kind):
    """Item frame in the hand frame: origin on the grip, +Z along the grip
    towards the thumb side (where a blade leaves the fist), +Y the palm normal
    (a blade's flat faces it), +X completing (towards the wrist, the guard)."""
    z = Vector(GRIP_AXIS).normalized()
    y = Vector((0, 0, 1)); y = (y - z * y.dot(z)).normalized()
    x = y.cross(z)
    rest = Matrix((x, y, z)).transposed().to_4x4()
    rest.translation = Vector(GRIP_CENTRE)
    return pose_matrix(kind) @ rest


def hand_frame(contract, gender, side):
    """Hand frame H -> Blender world. Mirrored (det < 0) for the left hand."""
    anchor = contract['characters'][gender]['anchors']['wrist_' + side]['world']
    x, y, z, w = anchor['quaternion']
    rotation = Quaternion((w, x, y, z)).to_matrix()
    to_blender = lambda v: Vector((v[0], -v[2], v[1]))
    X, Y, Z = (to_blender(rotation.col[i]) for i in range(3))
    # +X towards the thumb, i.e. the front of the body for a hanging arm.
    if X.dot(Vector((0, -1, 0))) < 0:
        X = -X
    frame = Matrix((X, Y, Z)).transposed().to_4x4()
    frame.translation = to_blender(anchor['position'])
    return frame


def forearm_tree(skin_points, skin_faces, frame):
    """Elliptical profile of the delivered forearm near the wrist (hand frame).

    Per 1 cm slice along the arm: centre (x, z) and half extents. The fist
    grows out of this smooth stand-in rather than the low-poly skin itself,
    whose open edges near the cuff make an exact distance unreliable.
    """
    inverse = frame.inverted()
    used = {i for face in skin_faces for i in face}
    local = [inverse @ Vector(skin_points[i]) for i in used]
    local = [p for p in local if -.11 < p.y < .012 and abs(p.x) < .07 and -.05 < p.z < .06]
    rows = []
    for y in np.arange(-.10, .011, .01):
        band = [p for p in local if abs(p.y - y) < .009]
        if len(band) < 4:
            continue
        x0, x1 = min(p.x for p in band), max(p.x for p in band)
        z0, z1 = min(p.z for p in band), max(p.z for p in band)
        rows.append((y, (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2))
    if len(rows) < 3:
        raise ValueError('Forearm profile: too few skin slices')
    rows = np.array(rows)
    # Light smoothing: the slices come from a coarse mesh.
    for col in range(1, 5):
        rows[1:-1, col] = (rows[:-2, col] + 2 * rows[1:-1, col] + rows[2:, col]) / 4
    return rows


def _forearm_field(P, profile):
    """Signed distance to the elliptical forearm, clipped just past the wrist."""
    y = P[..., 1]
    cx, cz, ax, az = (np.interp(y, profile[:, 0], profile[:, k]) for k in range(1, 5))
    k = np.sqrt(((P[..., 0] - cx) / ax) ** 2 + ((P[..., 2] - cz) / az) ** 2)
    d = (k - 1) * np.minimum(ax, az)
    # Proximal of the cut the skin still runs: sink the fist under it there, so
    # the only visible seam is the cut ring itself (inside the cuff).
    sink = .0025 * np.clip((CUT_Y + .003 - y) / .008, 0, 1)
    d = d - SKIN_CLEARANCE + sink
    return np.maximum(d, y - .012)


def hand_region(local):
    """True for a skin point (hand frame) on the hand or wrist, never the thigh."""
    return -.12 < local.y < .26 and abs(local.x) < .11 and -.05 < local.z < .062


def split_hand(skin, frame, texel):
    """Detach the open hand from the skin at the wrist and close the forearm.

    The cut follows the skin's own edges (a face goes to the hand when its
    centre lies past `CUT_Y`), so no vertex is added or moved: skin and open
    hand together are exactly the delivered surface. The ring the two share
    is capped on the forearm; the flat cap sits inside either hand.
    Returns the open hand as its own object (same materials and UVs).
    """
    import bpy
    import bmesh
    inverse = frame.inverted()
    world = skin.matrix_world.copy()
    bm = bmesh.new(); bm.from_mesh(skin.data); bm.transform(world)
    local = lambda co: inverse @ co
    hand = {f for f in bm.faces
            if all(hand_region(local(v.co)) for v in f.verts) and local(f.calc_center_median()).y > CUT_Y}
    if not hand:
        raise ValueError('No hand faces past the wrist cut')
    bm.faces.index_update()
    hand_ids = {f.index for f in hand}
    hand_bm = bm.copy()
    bmesh.ops.delete(hand_bm, geom=[f for f in hand_bm.faces if f.index not in hand_ids], context='FACES')
    # The skin is welded only in places: the ring is found by position, every
    # forearm vertex that coincides with a vertex of the hand.
    key = lambda co: tuple(round(c, 5) for c in co)
    hand_points = {key(v.co) for f in hand for v in f.verts}
    bmesh.ops.delete(bm, geom=list(hand), context='FACES')
    edges = [e for e in bm.edges if e.is_boundary and all(key(v.co) in hand_points for v in e.verts)
             and all(hand_region(local(v.co)) for v in e.verts)]
    if len(edges) < 5:
        raise ValueError(f'Wrist cut ring too small: {len(edges)} edges')
    # The skin is several unwelded pieces: bridge their coincident ring
    # vertices for the fill only, on a scratch copy, so the skin keeps them.
    cap_bm = bmesh.new()
    ring = sorted({v for e in edges for v in e.verts}, key=lambda v: v.index)
    lookup = {}
    for v in ring:
        k = key(v.co)
        if k not in lookup:
            lookup[k] = cap_bm.verts.new(v.co)
    for e in edges:
        a, b = (lookup[key(v.co)] for v in e.verts)
        if a is not b and not cap_bm.edges.get((a, b)):
            cap_bm.edges.new((a, b))
    filled = bmesh.ops.triangle_fill(cap_bm, use_beauty=True, use_dissolve=False, edges=list(cap_bm.edges))['geom']
    tris = [g for g in filled if isinstance(g, bmesh.types.BMFace)]
    # Rebuild the cap on the skin's own ring vertices (first of each position).
    first = {}
    for v in ring:
        first.setdefault(key(v.co), v)
    back_map = {lookup[k]: first[k] for k in lookup}
    uv = bm.loops.layers.uv.active
    material_index, texel_uv, colours = texel
    layers = {name: bm.loops.layers.color.get(name) for name in colours}
    centre = sum((v.co for v in ring), Vector()) / len(ring)
    axis = (frame.to_3x3() @ Vector((0, 1, 0))).normalized()
    cap = 0
    for tri in tris:
        verts = [back_map[v] for v in tri.verts]
        if len(set(verts)) < 3 or bm.faces.get(verts):
            continue
        face = bm.faces.new(verts)
        face.normal_update()
        if face.normal.dot(axis) < 0:   # the cap faces the hand side
            face.normal_flip()
        face.material_index = material_index
        for loop in face.loops:
            loop[uv].uv = texel_uv
            for name, layer in layers.items():
                if layer is not None:
                    loop[layer] = colours[name]
        cap += 1
    cap_bm.free()
    back = world.inverted()
    bm.transform(back); bm.to_mesh(skin.data); bm.free(); skin.data.update()
    hand_bm.transform(back)
    bmesh.ops.delete(hand_bm, geom=[v for v in hand_bm.verts if not v.link_faces], context='VERTS')
    data = bpy.data.meshes.new(skin.data.name + ' open hand')
    for material in skin.data.materials:
        data.materials.append(material)
    hand_bm.to_mesh(data); hand_bm.free()
    obj = bpy.data.objects.new(skin.name + ' open hand', data)
    obj.matrix_world = world
    for collection in skin.users_collection:
        collection.objects.link(obj)
    return obj, cap


def wrist_texel(skin, frame):
    """(material index, UV, {colour attribute: RGBA}) of a plain wrist texel.

    The fist is sculpted, so it takes one representative texel of the painted
    wrist (median colour) and the skin's vertex colours there: the viewer then
    tints it with the chosen skin tone like the rest of the body.
    """
    inverse = frame.inverted(); world = skin.matrix_world
    ids = {v.index for v in skin.data.vertices
           if -.03 < (inverse @ (world @ v.co)).y < .05 and hand_region(inverse @ (world @ v.co))}
    loops = [(p.material_index, l) for p in skin.data.polygons if all(v in ids for v in p.vertices) for l in p.loop_indices]
    index = max({m for m, _l in loops}, key=lambda m: sum(1 for k, _l in loops if k == m))
    loops = [l for m, l in loops if m == index]
    uv = skin.data.uv_layers.active
    colours = {}
    for layer in skin.data.color_attributes:
        if layer.domain != 'CORNER':
            continue
        values = np.array([layer.data[l].color[:] for l in loops])
        colours[layer.name] = tuple(np.median(values, axis=0))
    samples = np.array([uv.data[l].uv[:] for l in loops])
    material = skin.data.materials[index]
    image = None
    if material and material.node_tree:
        image = next((n.image for n in material.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
    best = 0
    if image:
        w, h = image.size
        pixels = np.empty(w * h * 4, np.float32); image.pixels.foreach_get(pixels)
        pixels = pixels.reshape(h, w, 4)[..., :3]
        rgb = np.array([pixels[min(h - 1, int((y % 1) * h)), min(w - 1, int((x % 1) * w))] for x, y in samples])
        best = int(np.argmin(((rgb - np.median(rgb, axis=0)) ** 2).sum(1)))
    return index, tuple(samples[best]), colours


def dress_as_skin(obj, skin, texel):
    """Skin material, one plain texel and the matching vertex colours."""
    index, uv, colours = texel
    data = obj.data
    data.materials.clear(); data.materials.append(skin.data.materials[index])
    layer = data.uv_layers.new(name=skin.data.uv_layers.active.name)
    for entry in layer.data:
        entry.uv = uv
    for name, colour in colours.items():
        attribute = data.color_attributes.new(name, 'BYTE_COLOR', 'CORNER')
        for entry in attribute.data:
            entry.color = colour
    return obj


def fist_geometry(tree, kind):
    """(vertices, faces) of the posed fist in the hand frame."""
    import openvdb as vdb
    lo = np.array([-.078, FIST_START_Y - .012, -.062])
    hi = np.array([.088, .150, .100])
    shape = np.ceil((hi - lo) / VOXEL).astype(int) + 1
    axes = [lo[i] + VOXEL * np.arange(shape[i]) for i in range(3)]
    # Supination turns the radius along the forearm: the twist ramps up from
    # the sleeve end to the palm, so the wrist stays round. Ulnar deviation is
    # a rigid turn of the hand at the wrist.
    sup = math.radians(POSES[kind]['supination'])
    ulnar = np.array(Matrix.Rotation(-math.radians(POSES[kind]['ulnar']), 3, 'Z'))
    field = np.empty(shape, np.float32)
    step = 24
    for start in range(0, shape[0], step):
        P = np.stack(np.meshgrid(axes[0][start:start + step], axes[1], axes[2], indexing='ij'), -1)
        t = np.clip((P[..., 1] - TWIST_START) / (TWIST_END - TWIST_START), 0, 1)
        angle = -sup * t * t * (3 - 2 * t)
        c, s_ = np.cos(angle), np.sin(angle)
        U = np.stack([c * P[..., 0] + s_ * P[..., 2], P[..., 1], -s_ * P[..., 0] + c * P[..., 2]], -1)
        hand = hand_field(U @ ulnar.T)
        forearm = _forearm_field(U, tree)
        chunk = _smin(forearm, hand, .010)
        field[start:start + step] = np.maximum(chunk, (FIST_START_Y - .004) - P[..., 1])
    grid = vdb.FloatGrid(background=float(field.max()))
    grid.copyFromArray(field)
    points, triangles, quads = grid.convertToPolygons(isovalue=0.0, adaptivity=0.0)
    points = points * VOXEL + lo
    return points, [tuple(f) for f in quads] + [tuple(f) for f in triangles]


def fist_mesh(name, tree, kind, frame, smooth=5, target_faces=7000):
    """World-space fist object: posed hand, forearm stub, open at the sleeve end."""
    import bpy
    import bmesh
    points, faces = fist_geometry(tree, kind)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(p) for p in points], [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bm.normal_update()
    centre = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    if sum((f.calc_center_median() - centre).dot(f.normal) for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(mesh); bm.free()
    for modifier, settings in (('DECIMATE', {'ratio': min(1.0, target_faces / max(len(mesh.polygons), 1))}),
                               ('CORRECTIVE_SMOOTH', {'iterations': smooth, 'factor': .5, 'smooth_type': 'SIMPLE',
                                                      'use_only_smooth': True})):
        mod = obj.modifiers.new(modifier.lower(), modifier)
        for key, value in settings.items():
            setattr(mod, key, value)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    clean = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    obj.modifiers.clear()
    old = obj.data; obj.data = clean; bpy.data.meshes.remove(old)
    clean.name = name
    # Open the sleeve end: the flat cap of the field sits inside the forearm.
    bm = bmesh.new(); bm.from_mesh(clean)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < FIST_START_Y], context='VERTS')
    bm.transform(frame)
    if frame.to_3x3().determinant() < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(clean); bm.free()
    for poly in clean.polygons:
        poly.use_smooth = True
    clean.update()
    return obj
