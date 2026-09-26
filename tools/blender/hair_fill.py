"""Close the bare skull a haircut leaves around the ear.

Haircuts were fitted around the delivered elf ears: `clear_ear_space` tucks
every lock inside the elf-ear outline behind the skull. Under the smaller
human ear that outline shows as a bald, ragged window in the hair. This module
grows a thin hair shell on the skull under the cut, everywhere the original
(untucked) hair covered it, down to a clean hairline around the human ear.
Elf ears come out of the skull through that shell, like real ears through hair.

Coordinates are Blender world space: metres, Z up, front at -Y.
"""
import math

import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

OFFSET = .0036          # shell height above the skin
EDGE_OFFSET = .0009     # the hairline edge sinks towards the skin
REACH = .035            # hair at most this far above the skull counts as cover
EAR_MARGIN = .0030      # bare skin kept around the human ear attachment (lock tips)
SHELL_MARGIN = .0050    # the dark underlayer stops a little further out
HEAD_CENTRE = Vector((0, -.01, 1.60))
UV_SCALE = 14.0


def _surface(skull, co, height):
    """Point `height` above the skull under `co`, and the smooth outward direction."""
    location, normal, _i, _d = skull.find_nearest(co, .05)
    if location is None:
        return co, (co - HEAD_CENTRE).normalized()
    # Offset along a smooth direction: per-face normals jump at the skin's
    # vertices and dimple the surface.
    radial = (location - HEAD_CENTRE).normalized()
    if normal.dot(radial) < 0:
        normal = -normal
    direction = (radial * .75 + normal * .25).normalized()
    return location + direction * height, direction


def hair_tree(obj, depsgraph):
    """BVH of a hair object's evaluated surface, in world space."""
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    matrix = obj.matrix_world
    tree = BVHTree.FromPolygons([matrix @ v.co for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons])
    evaluated.to_mesh_clear()
    return tree


def _in_zone(c, side):
    if c.x * side < .055 or not (-.042 < c.y < .095) or not (1.49 < c.z < 1.69):
        return False
    # In front of the ear only a sideburn: above the tragus, never the cheek.
    if c.y <= -.018:
        return c.z > 1.537
    # Behind the ear, never below the lobe: the cut's own locks end there.
    return c.z > 1.522


def ear_attachment(ear_points, skull, side):
    """KD tree of the ear points lying on the skull (its attachment line)."""
    from human_ears import skull_x
    near = [p for p in ear_points if p.x * side > 0 and abs(p.x) - skull_x(skull, side, p.y, p.z) < .004]
    tree = KDTree(max(len(near), 1))
    for i, p in enumerate(near):
        tree.insert(p, i)
    tree.balance()
    return tree, bool(near)


def ear_zone_shell(skin_bm, skip, skull, cover, attachments, elf=None):
    """New bmesh: hair shell over the skull around both ears.

    `skin_bm` is the capped skin in world space, `skip` the indices of ear
    vertices, `cover` the BVHs of the original haircut pieces, `attachments` {side:
    (kd, valid)} from `ear_attachment`, `elf` the BVH of the elf ears: the
    window a cut left for them (above the human ear) is covered as well.
    """
    skin_bm.faces.ensure_lookup_table()
    skin_bm.normal_update()
    shell = bmesh.new()
    mapping = {}
    for face in skin_bm.faces:
        if any(v.index in skip for v in face.verts):
            continue
        c = face.calc_center_median()
        side = 1 if c.x > 0 else -1
        if not _in_zone(c, side) or face.normal.x * side < .15:
            continue
        verts = []
        for v in face.verts:
            if v.index not in mapping:
                mapping[v.index] = shell.verts.new(v.co)
            verts.append(mapping[v.index])
        try:
            shell.faces.new(verts)
        except ValueError:
            pass
    bmesh.ops.remove_doubles(shell, verts=shell.verts, dist=1e-6)
    bmesh.ops.subdivide_edges(shell, edges=shell.edges[:], cuts=5, use_grid_fill=True)
    bmesh.ops.triangulate(shell, faces=shell.faces[:])

    def surface(co, height):
        return _surface(skull, co, height)

    for v in shell.verts:
        v.co, _n = surface(v.co, OFFSET)
    doomed = []
    for face in shell.faces:
        c = face.calc_center_median()
        side = 1 if c.x > 0 else -1
        _p, n = surface(c, 0)
        kd, valid = attachments[side]
        near_ear = valid and kd.find(c)[2] < SHELL_MARGIN
        # Low on the nape only hair actually lying over the skull counts.
        near = .010 if c.z > 1.535 else 0
        reach = REACH if c.z > 1.545 else .016
        hit = any(t.ray_cast(c, n, reach)[0] is not None or (near and t.find_nearest(c, near)[0] is not None)
                  for t in cover)
        if not hit and elf is not None and c.z > 1.538:
            hit = elf.ray_cast(c, n, .06)[0] is not None or elf.find_nearest(c, .006)[0] is not None
        if near_ear or not hit or not _in_zone(c, side):
            doomed.append(face)
    bmesh.ops.delete(shell, geom=doomed, context='FACES')
    bmesh.ops.delete(shell, geom=[v for v in shell.verts if not v.link_faces], context='VERTS')
    # Drop crumbs: islands of a few triangles read as noise, not hair.
    seen = set()
    for start in list(shell.faces):
        if start in seen or not start.is_valid:
            continue
        island, stack = [], [start]
        seen.add(start)
        while stack:
            face = stack.pop(); island.append(face)
            for edge in face.edges:
                for other in edge.link_faces:
                    if other not in seen:
                        seen.add(other); stack.append(other)
        if len(island) < 12:
            bmesh.ops.delete(shell, geom=island, context='FACES')
    bmesh.ops.delete(shell, geom=[v for v in shell.verts if not v.link_faces], context='VERTS')
    # A clean hairline: the boundary, stepped by the face test, is relaxed
    # along itself and laid back on the skin.
    boundary = [v for v in shell.verts if v.is_boundary]
    for _ in range(10):
        moved = {}
        for v in boundary:
            ring = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(ring) == 2:
                moved[v] = v.co * .4 + (ring[0].co + ring[1].co) * .3
        for v, co in moved.items():
            v.co = co
        for v in boundary:
            v.co, _n = surface(v.co, OFFSET)
    inner = {e.other_vert(v) for v in boundary for e in v.link_edges} - set(boundary)
    for v in inner:
        v.co, _n = surface((v.co + sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)) * .5, OFFSET)
    # Relax the whole shell on the skull: subdivision and snapping leave pinches.
    interior = [v for v in shell.verts if not v.is_boundary and v.link_edges]
    for _ in range(4):
        target = {v: sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges) for v in interior}
        for v, co in target.items():
            v.co, _n = surface(co, OFFSET)
    for v in boundary:
        v.co, _n = surface(v.co, EDGE_OFFSET)
    shell.normal_update()
    for face in shell.faces:
        if face.normal.dot(face.calc_center_median() - HEAD_CENTRE) < 0:
            face.normal_flip()
    return shell


# Locks laid over the underlayer, following the cut's own strand flow.
LOCK_WIDTH = .0056
LOCK_SPACING = .0036    # distance between neighbouring lock centre lines
LOCK_STEP = .0015
LOCK_HEIGHT = .0050     # above the skin (the underlayer is at OFFSET)
LOCK_OVERSHOOT = .006   # tips may run this far past the underlayer
LOCK_ROOT_REACH = .010  # roots may start this far under the cut's own hair
STRAND_DENSITY = 10.0   # V (strand axis of the hair maps) per metre


def flow_samples(pieces, skull, fill_faces=None):
    """(KD tree, directions) of the cut's strand axis around the ears.

    The hair maps carry their strands along V, so each face's dP/dv is the
    direction of its lock. Locks tucked inside the skull are ignored.
    """
    from human_ears import skull_x
    points, directions = [], []
    for obj in pieces:
        mesh, matrix = obj.data, obj.matrix_world
        if not mesh.uv_layers:
            continue
        uv = mesh.uv_layers.active.data
        rotation = matrix.to_3x3()
        for poly in mesh.polygons:
            c = matrix @ poly.center
            if abs(c.x) < .05 or not (-.07 < c.y < .12) or not (1.46 < c.z < 1.71):
                continue
            side = 1 if c.x > 0 else -1
            if abs(c.x) < skull_x(skull, side, c.y, c.z) - .0005:
                continue
            location = skull.find_nearest(c, .03)[0]
            if location is None:
                continue
            loops = list(poly.loop_indices)[:3]
            P = [rotation @ mesh.vertices[mesh.loops[l].vertex_index].co for l in loops]
            U = [uv[l].uv for l in loops]
            e1, e2 = P[1] - P[0], P[2] - P[0]
            du1, dv1 = U[1] - U[0]
            du2, dv2 = U[2] - U[0]
            det = du1 * dv2 - du2 * dv1
            if abs(det) < 1e-12:
                continue
            along = (e2 * du1 - e1 * du2) / det
            if along.length < 1e-7:
                continue
            points.append(c)
            directions.append(along.normalized())
    tree = KDTree(max(len(points), 1))
    for i, p in enumerate(points):
        tree.insert(p, i)
    tree.balance()
    return tree, directions


def _flow(flow, p, normal, previous):
    """Strand direction at p, tangent to the skull, oriented like `previous`."""
    tree, directions = flow
    near = tree.find_n(p, 28) if directions else []
    if len(near) < 4:
        d = previous
    else:
        # Dominant axis of the neighbours' (unsigned) strand directions.
        d = previous.copy()
        for _ in range(3):
            acc = Vector()
            for _co, index, dist in near:
                w = 1.0 / (dist + .004)
                e = directions[index]
                acc += e * (e.dot(d) * w)
            if acc.length < 1e-9:
                break
            d = acc.normalized()
    d = d - normal * d.dot(normal)
    if d.length < 1e-6:
        return previous
    d.normalize()
    return d if d.dot(previous) >= 0 else -d


def ear_zone_locks(shell, skull, flow, cover, attachments, seed=7):
    """New bmesh of hair locks over the underlayer `shell`, with UVs and shade.

    Evenly spaced streamlines of the cut's strand flow cover the underlayer.
    An end that runs under the cut's own hair is a hidden root; a free end
    tapers into a pointed tip, so the hairline around the ear is made of lock
    tips like the rest of the cut, not a clean-cut edge.
    """
    import random
    rng = random.Random(seed)
    if not shell.faces:
        return bmesh.new()
    region = BVHTree.FromBMesh(shell)
    cell = LOCK_SPACING
    grid = {}

    def key(p):
        return (int(math.floor(p.x / cell)), int(math.floor(p.y / cell)), int(math.floor(p.z / cell)))

    def crowded(p, limit, own=()):
        k = key(p)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for q, lock in grid.get((k[0] + dx, k[1] + dy, k[2] + dz), ()):
                        if lock not in own and (q - p).length < limit:
                            return True
        return False

    def covered(p, n):
        return any(t.ray_cast(p + n * .001, n, REACH)[0] is not None for t in cover)

    def allowed(p, side, reach):
        if p.x * side < .05 or not _in_zone_loose(p, side):
            return False
        kd, valid = attachments[side]
        if valid and kd.find(p)[2] < EAR_MARGIN:
            return False
        location = region.find_nearest(p, reach)[0]
        return location is not None

    def trace(start, direction, side, lock_id):
        points, d = [], direction
        p = start
        outside = 0.0
        for _ in range(70):
            p_next, n = _surface(skull, p + d * LOCK_STEP, 0)
            d_next = _flow(flow, p_next, n, d)
            if region.find_nearest(p_next, .0015)[0] is None:
                # Past the underlayer: a root may continue under the cut's
                # hair, a tip may overshoot a little.
                outside += LOCK_STEP
                if outside > max(LOCK_OVERSHOOT, LOCK_ROOT_REACH if covered(p_next, n) else 0):
                    break
            else:
                outside = 0.0
            if not allowed(p_next, side, .02) or crowded(p_next, LOCK_SPACING * .55, {lock_id}):
                break
            points.append(p_next)
            p, d = p_next, d_next
        return points

    seeds = [v.co.copy() for v in shell.verts]
    rng.shuffle(seeds)
    streamlines = []
    for lock_id, start in enumerate(seeds):
        side = 1 if start.x > 0 else -1
        start, n = _surface(skull, start, 0)
        if crowded(start, LOCK_SPACING) or not allowed(start, side, .002):
            continue
        d0 = _flow(flow, start, n, Vector((0, .35, -1)).normalized())
        forward = trace(start, d0, side, lock_id)
        backward = trace(start, -d0, side, lock_id)
        line = list(reversed(backward)) + [start] + forward
        if len(line) < 7:
            continue
        for q in line:
            grid.setdefault(key(q), []).append((q, lock_id))
        streamlines.append((line, side))

    out = bmesh.new()
    uv_layer = out.loops.layers.uv.new('UVMap')
    shade_layer = out.verts.layers.float.new('shade')
    for line, side in streamlines:
        lengths = [0.0]
        for a, b in zip(line, line[1:]):
            lengths.append(lengths[-1] + (b - a).length)
        total = lengths[-1]
        ends = []
        for end in (line[0], line[-1]):
            _p, n = _surface(skull, end, 0)
            ends.append(covered(end, n))
        # Orient every lock root -> tip; two free ends make a spindle.
        if ends[1] and not ends[0]:
            line = list(reversed(line)); ends.reverse()
            lengths = [total - x for x in reversed(lengths)]
        width = LOCK_WIDTH * rng.uniform(.85, 1.15)
        height = LOCK_HEIGHT + rng.uniform(0, .0016)
        u0, v0 = rng.uniform(0, 1), rng.uniform(0, 1)
        rows = []
        for i, p in enumerate(line):
            t = lengths[i] / total
            taper = 1.0
            if not ends[1]:
                taper *= min(1.0, (1 - t) / .45) ** .75
            if not ends[0]:
                taper *= min(1.0, t / .25) ** .6
            else:
                taper *= .85 + .15 * min(1.0, t / .2)
            prev_p = line[max(i - 1, 0)]
            next_p = line[min(i + 1, len(line) - 1)]
            tangent = (next_p - prev_p).normalized()
            base, n = _surface(skull, p, 0)
            across = n.cross(tangent).normalized()
            w = width * max(taper, .04) / 2
            lift = height - .0012 * (1 - taper)
            row = []
            for k, (offset, bump) in enumerate(((-1, -.0007), (0, .0004), (1, -.0007))):
                v = out.verts.new(base + n * (lift + bump * taper) + across * (offset * w))
                v[shade_layer] = .72 + .25 * t
                row.append((v, (u0 + .06 * k, v0 + lengths[i] * STRAND_DENSITY)))
            rows.append(row)
        for r0, r1 in zip(rows, rows[1:]):
            for k in range(2):
                quad = [r0[k], r0[k + 1], r1[k + 1], r1[k]]
                try:
                    face = out.faces.new([q[0] for q in quad])
                except ValueError:
                    continue
                for loop, (_v, uv) in zip(face.loops, quad):
                    loop[uv_layer].uv = uv
    out.normal_update()
    for face in out.faces:
        if face.normal.dot(face.calc_center_median() - HEAD_CENTRE) < 0:
            face.normal_flip()
    return out


def _in_zone_loose(c, side):
    """The fill zone, a little larger so lock tips can hang past it."""
    if c.x * side < .05 or not (-.046 < c.y < .10) or not (1.49 < c.z < 1.70):
        return False
    if c.y <= -.018:
        return c.z > 1.530
    return c.z > 1.512


def append_geometry(hair, geometry, shade=.82):
    """Add world-space geometry to a hair object in its first material.

    UVs and a per-vertex shade are taken from the geometry's 'UVMap' loop
    layer and 'shade' vertex layer when present; otherwise the UVs are
    planar with strands (V) running down, and the shade is uniform.
    """
    inverse = hair.matrix_world.inverted()
    bm = bmesh.new(); bm.from_mesh(hair.data)
    uv = bm.loops.layers.uv.active
    loop_colours = [layers.get(name) for layers in (bm.loops.layers.float_color, bm.loops.layers.color)
                    for name in layers.keys()]
    vert_colours = [layers.get(name) for layers in (bm.verts.layers.float_color, bm.verts.layers.color)
                    for name in layers.keys()]
    source_uv = geometry.loops.layers.uv.get('UVMap')
    source_shade = geometry.verts.layers.float.get('shade')
    new = {}
    for v in geometry.verts:
        nv = bm.verts.new(inverse @ v.co)
        value = v[source_shade] if source_shade else shade
        for layer in vert_colours:
            nv[layer] = (value, value, value, 1.0)
        new[v] = nv
    count = 0
    for face in geometry.faces:
        try:
            nf = bm.faces.new([new[v] for v in face.verts])
        except ValueError:
            continue
        count += 1
        nf.material_index = 0
        nf.smooth = True
        for loop, source in zip(nf.loops, face.loops):
            if uv:
                if source_uv:
                    loop[uv].uv = source[source_uv].uv
                else:
                    world = source.vert.co
                    loop[uv].uv = (world.y * UV_SCALE, world.z * UV_SCALE)
            value = source.vert[source_shade] if source_shade else shade
            for layer in loop_colours:
                loop[layer] = (value, value, value, 1.0)
    bm.to_mesh(hair.data); bm.free(); hair.data.update()
    return count
