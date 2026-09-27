"""Bent weapon arm: the right forearm swings up so a blade stands upright.

The delivered characters are static, arms hanging. A hand hanging by the
thigh can only point a blade at the ground, so a character holding a weapon
bends the right elbow: forearm forward, palm facing in, thumb up. The fist
then holds the grip upright.

Every mesh around the forearm (skin and the sleeve of each outfit) is split
along its own edges into the part the bend moves and the rest; the moving
part ships once hanging (`arm_pose: straight`) and once per named bend of
`POSES` (`arm_pose: ready`, `staff`), and the viewer shows the one the held
weapon asks for. Since the bend fades to zero
before the split line, both variants meet the rest exactly.

World space is Blender's: metres, Z up, front at -Y.
"""
import math

import numpy as np
from mathutils import Matrix, Quaternion, Vector

FLEXION = 78          # elbow bend, degrees (0 = hanging)
# Named bends: a blade or a wand is held ready, the forearm halfway up, the
# weapon raised in front without being brandished; a staff stands upright on
# the ground in a forearm nearly level.
POSES = {'ready': 45, 'staff': 78}
BLEND = (-.020, .060)  # along the forearm from the elbow: bend fades in here
SEED_SPAN = (.07, .42)  # forearm and hand: the skin is unwelded at the wrist
SEED_MARGIN = .025      # a seed lies this close outside the arm skin (cuffs, trims)
GROW_MARGIN = .050      # the region grows this far off the arm, never past
INWARD_MARGIN = .012    # ...and only this far past the arm towards the body (the
                        # flank touches the sleeve by the elbow: past this, it would go too)
CLOTH_MARGIN = .032     # clothes: a sleeve hugs the arm
OWNERSHIP_MARGIN = .002  # a sleeve is nearer the forearm skin than the body skin
WRIST_MARGIN = .012     # ...and ends at the wrist
HUG_DEPTH = .002        # a welded body corner of the skin sinks this far under it
CLOTH_HUG = .008        # ...of a sleeve, stays this far off the arm skin


def _anchor(contract, gender, name):
    a = contract['characters'][gender]['anchors'][name]['world']
    x, y, z, w = a['quaternion']
    p = a['position']
    return Vector((p[0], -p[2], p[1])), Quaternion((w, x, y, z))


def arm_frame(contract, gender, side='right'):
    """(elbow, forearm direction, flexion axis) of one arm."""
    elbow, _q = _anchor(contract, gender, 'elbow_' + side)
    wrist, _q = _anchor(contract, gender, 'wrist_' + side)
    forearm = (wrist - elbow).normalized()
    # Flexion swings the forearm towards the front (-Y).
    axis = forearm.cross(Vector((0, -1, 0))).normalized()
    return elbow, forearm, axis


def bend_matrix(contract, gender, side='right', degrees=FLEXION):
    """Rigid transform of the fully bent forearm (and of the hand frame)."""
    elbow, _f, axis = arm_frame(contract, gender, side)
    return Matrix.Translation(elbow) @ Matrix.Rotation(math.radians(degrees), 4, axis) @ Matrix.Translation(-elbow)


def _smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


class ArmBend:
    """Measured forearm of one character, reused for every mesh it wears."""

    def __init__(self, contract, gender, skin_points, side='right', degrees=FLEXION):
        self.elbow, self.forearm, self.axis = arm_frame(contract, gender, side)
        self.degrees = degrees
        wrist, _q = _anchor(contract, gender, 'wrist_' + side)
        self.wrist = (wrist - self.elbow).length
        # Towards the body, across the forearm: the thigh, the hips and the
        # skirts lie that way, so the region never reaches past the arm there.
        inward = Vector((-1 if self.elbow.x > 0 else 1, 0, 0))
        self.medial = (inward - self.forearm * inward.dot(self.forearm)).normalized()
        P = np.asarray(skin_points, float)
        t, d = self.coordinates(P)
        m = self.inward_offset(P)
        # Arm radius along the forearm, from the skin: the 90th percentile of
        # the skin's distance to the axis per 1 cm slice (hand included).
        self.slices = np.arange(-.06, .46, .01)
        radius, inward_extent = [], []
        for s in self.slices:
            arm = (np.abs(t - s) < .006) & (d < .052)
            inward_extent.append(np.percentile(m[arm], 95) if arm.sum() > 8 and s < .26 else np.nan)
            # The forearm is ~4 cm thick; past the wrist the hand is wider.
            # Anything farther off the axis is the torso or the thigh.
            band = d[(np.abs(t - s) < .006) & (d < (.052 if s < .27 else .09))]
            radius.append(np.percentile(band, 90) if len(band) > 8 else np.nan)
        radius = np.array(radius)
        good = ~np.isnan(radius)
        self.radius = np.interp(self.slices, self.slices[good], radius[good])
        inward_extent = np.array(inward_extent)
        good = ~np.isnan(inward_extent)
        # The hand is flat against the thigh: past the wrist, keep the wrist's
        # inward extent (plus the palm), never the whole hand radius.
        self.inward = np.interp(self.slices, self.slices[good], inward_extent[good]) + np.where(self.slices > .26, .006, 0)

    def inward_offset(self, P):
        return (np.asarray(P, float) - np.array(self.elbow)) @ np.array(self.medial)

    def coordinates(self, P):
        E = np.array(self.elbow); f = np.array(self.forearm)
        rel = P - E
        t = rel @ f
        d = np.linalg.norm(rel - t[:, None] * f, axis=1)
        return t, d

    def arm_radius(self, t):
        return np.interp(t, self.slices, self.radius)

    def weights(self, t):
        return _smooth((t - BLEND[0]) / (BLEND[1] - BLEND[0]))

    def attach_skin(self, points, edges):
        """Measure which skin vertices bend; clothes then follow the skin."""
        from mathutils.kdtree import KDTree
        P = np.asarray(points, float)
        arm = self.region(P, edges, skin=True)
        t, _d = self.coordinates(P)
        # Forearm skin (hand left out: it rests on the thigh) against the body
        # skin (the arm skin that does not move included).
        # From the elbow on: the sleeve round the elbow must follow the bend.
        forearm = arm & (t > BLEND[0]) & (t < self.wrist)
        body = ~arm

        def tree(mask):
            k = KDTree(int(mask.sum()))
            for i, p in enumerate(P[mask]):
                k.insert(p, i)
            k.balance()
            return k
        self.forearm_tree, self.body_tree = tree(forearm), tree(body)

    def over_arm(self, P):
        """Per point: the nearest skin belongs to the bending arm."""
        if getattr(self, 'forearm_tree', None) is None:
            return np.ones(len(P), bool)
        out = np.zeros(len(P), bool)
        for i, p in enumerate(P):
            arm = self.forearm_tree.find(p)[2]
            body = self.body_tree.find(p)[2]
            out[i] = arm < GROW_MARGIN and arm < body - OWNERSHIP_MARGIN
        return out

    def region(self, points, edges, skin=False, normals=None):
        """Vertex mask of the part the bend moves, grown along the mesh from
        seeds on the forearm, never jumping to the body across a gap.

        Clothes stop at the wrist (a sleeve never runs past it) and hug the
        arm; the skin carries on into the hand."""
        P = np.asarray(points, float)
        if not len(P):
            return np.zeros(0, bool)
        t, d = self.coordinates(P)
        excess = d - self.arm_radius(t)
        inward = self.inward_offset(P) - np.interp(t, self.slices, self.inward)
        allowed = (t > BLEND[0] - .004) & (excess < (GROW_MARGIN if skin else CLOTH_MARGIN)) & (inward < INWARD_MARGIN)
        if not skin:
            allowed &= t < self.wrist + WRIST_MARGIN
        seeds = allowed & (t > SEED_SPAN[0]) & (t < SEED_SPAN[1]) & (excess < SEED_MARGIN)
        if not skin:
            # A sleeve lies over the arm skin; a hip or a skirt brushing the
            # hand lies over the thigh.
            over = self.over_arm(P)
            allowed &= over
            seeds &= over
        if not seeds.any():
            return np.zeros(len(P), bool)
        neighbours = [[] for _ in range(len(P))]
        for a, b in edges:
            if allowed[a] and allowed[b]:
                neighbours[a].append(b); neighbours[b].append(a)
        mask = np.zeros(len(P), bool)
        for seed in np.nonzero(seeds & allowed)[0]:
            if mask[seed]:
                continue
            component, stack = [seed], [seed]
            mask[seed] = True
            while stack:
                v = stack.pop()
                for n in neighbours[v]:
                    if not mask[n]:
                        mask[n] = True; stack.append(n); component.append(n)
            if not skin and not self.wraps(P[component]):
                mask[component] = False
        return mask

    def wraps(self, P):
        """A sleeve goes round the arm; a skirt edge by the hand does not."""
        rel = P - np.array(self.elbow)
        f = np.array(self.forearm); med = np.array(self.medial)
        angle = np.arctan2(rel @ np.cross(f, med), rel @ med)
        bins = np.histogram(angle, bins=8, range=(-np.pi, np.pi))[0]
        return (bins > 0).sum() >= 6

    def hug(self, points, outside, skin=False):
        """Pull the `outside` points in to the arm (under its skin, or onto
        the sleeve), by their bend weight: a body corner welded to the arm must
        not stand off it once the arm bends away."""
        P = np.asarray(points, float).copy()
        t, d = self.coordinates(P)
        limit = self.arm_radius(t) + (-HUG_DEPTH if skin else CLOTH_HUG)
        w = self.weights(t)
        E = np.array(self.elbow); f = np.array(self.forearm)
        for i in np.nonzero(outside & (d > limit) & (w > 0))[0]:
            axis = E + t[i] * f
            target = axis + (P[i] - axis) * (limit[i] / d[i])
            P[i] += (target - P[i]) * w[i]
        return P

    def bend(self, points, movable=None, degrees=None):
        """Bent positions: each point turns about the elbow by its weight."""
        degrees = self.degrees if degrees is None else degrees
        P = np.asarray(points, float)
        t, _d = self.coordinates(P)
        w = self.weights(t)
        if movable is not None:
            w = np.where(movable, w, 0)
        E = np.array(self.elbow)
        out = P.copy()
        for i in np.nonzero(w > 0)[0]:
            rotation = np.array(Matrix.Rotation(math.radians(degrees * w[i]), 3, self.axis))
            out[i] = E + rotation @ (P[i] - E)
        return out


def split_arm(obj, bend, world=None, skin=False, poses=None):
    """Split `obj` into rest + arm pieces; return [straight, *bent] or None.

    The faces moved by the bend (any vertex with a weight) leave `obj`; they
    ship as a straight copy and one bent copy per pose of `poses` (name ->
    degrees, default POSES), with the same materials, UVs and colours. `obj`
    keeps every other face untouched.
    """
    poses = POSES if poses is None else poses
    import bpy
    import bmesh
    world = obj.matrix_world if world is None else world
    points = [world @ v.co for v in obj.data.vertices]
    turn = world.to_3x3().inverted().transposed()
    normals = [(turn @ v.normal).normalized() for v in obj.data.vertices]
    mask = bend.region(points, [tuple(e.vertices) for e in obj.data.edges], skin, normals)
    if not mask.any():
        return None
    t, _d = bend.coordinates(np.asarray(points, float))
    moving = mask & (bend.weights(t) > 0)
    if not moving.any():
        return None
    # Every face touching a moving vertex goes. All its corners turn by their
    # weight: the elbow side of the fade barely moves, while a corner the
    # region left out further down (the inner sleeve pressed on the flank)
    # follows the arm instead of stretching the face into a shard.
    faces = {p.index for p in obj.data.polygons if any(moving[v] for v in p.vertices)}
    if not faces:
        return None
    pieces = []
    for pose in ['straight', *poses]:
        data = obj.data.copy()
        piece = obj.copy(); piece.data = data
        for collection in obj.users_collection:
            collection.objects.link(piece)
        bm = bmesh.new(); bm.from_mesh(data)
        bm.faces.ensure_lookup_table()
        region_layer = bm.verts.layers.int.new('arm_region')
        bm.verts.ensure_lookup_table()
        for v in bm.verts:
            v[region_layer] = int(mask[v.index])
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in faces], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        if pose != 'straight':
            bm.transform(world)
            # Body corners welded to the arm come along, pressed onto it.
            outside = np.array([not v[region_layer] for v in bm.verts], bool)
            points = bend.hug([v.co[:] for v in bm.verts], outside, skin)
            moved = bend.bend(points, None, poses[pose])
            for v, p in zip(bm.verts, moved):
                v.co = Vector(p)
            bm.transform(world.inverted())
        bm.verts.layers.int.remove(region_layer)
        bm.to_mesh(data); bm.free(); data.update()
        piece['arm_pose'], piece['arm_side'] = pose, 'right'
        if pose != 'straight':
            piece['arm_flexion'] = poses[pose]
        pieces.append(piece)
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in sorted(faces)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    return pieces


HIDDEN_SPAN = (.05, .48)  # along the hanging forearm: what it used to hide
HIDDEN_REACH = .15


def fill_hidden_holes(obj, bend, world=None):
    """Close the openings a garment had under the hanging arm.

    Some outfits were cut away where the arm covered them; bent away, the arm
    reveals the gap. Each boundary loop lying entirely in that shadow is
    filled, borrowing UVs and colours from the faces around it. Returns the
    number of loops filled.
    """
    import bmesh
    world = obj.matrix_world if world is None else world
    bm = bmesh.new(); bm.from_mesh(obj.data)
    boundary = [e for e in bm.edges if e.is_boundary]
    seen, loops = set(), []
    for e in boundary:
        if e in seen:
            continue
        loop, stack = [], [e]
        seen.add(e)
        while stack:
            x = stack.pop(); loop.append(x)
            for v in x.verts:
                for y in v.link_edges:
                    if y.is_boundary and y not in seen:
                        seen.add(y); stack.append(y)
        loops.append(loop)
    filled = 0
    for loop in loops:
        verts = {v for e in loop for v in e.verts}
        P = np.array([world @ v.co for v in verts])
        t, d = bend.coordinates(P)
        if not ((t > HIDDEN_SPAN[0]) & (t < HIDDEN_SPAN[1]) & (d < HIDDEN_REACH)).all():
            continue
        new = bmesh.ops.holes_fill(bm, edges=loop, sides=0)['faces']
        if not new:
            continue
        filled += 1
        bmesh.ops.triangulate(bm, faces=new)
        new = [f for f in bm.faces if f.select is False and any(l.edge.is_boundary is False for l in f.loops)] and \
            [f for f in bm.faces if all(v in verts for v in f.verts)]
        for f in new:
            neighbour = next((g for e in f.edges for g in e.link_faces if g is not f and g not in new), None)
            if neighbour is not None:
                f.material_index = neighbour.material_index
            for loop_ in f.loops:
                source = next((l for l in loop_.vert.link_loops if l.face not in new), None)
                if source is None:
                    continue
                for layer in bm.loops.layers.uv.values():
                    loop_[layer].uv = source[layer].uv
                for layer in bm.loops.layers.color.values():
                    loop_[layer] = source[layer]
                for layer in bm.loops.layers.float_color.values():
                    loop_[layer] = source[layer]
            f.smooth = True
    bm.normal_update()
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    return filled
