"""Sculpted human ear, built as a signed distance field and meshed with OpenVDB.

The delivered characters only have pointed elf ears, and warping those into a
human shape leaves a flat, lumpy plate. This module models an anatomical ear
instead: rolled helix rim, crus of the helix sinking into the concha,
Y-shaped antihelix (stem, superior and inferior crura), triangular fossa,
scapha, deep concha with the ear canal, tragus, antitragus, intertragic notch
and a soft lobe. Each part is a smooth SDF primitive; OpenVDB extracts one
clean closed surface.

Ear-local frame (metres): X = `a`, towards the back of the head; Y = `b`, up;
Z = `w`, out of the ear plane (away from the skull). The root (front edge) is
at a = 0; w < 0 near the root runs into the skull.

    mesh = ear_mesh('human ear')      # bpy mesh in the local frame
    LANDMARKS['lobe']                 # local points for jewellery
"""
import math

import numpy as np

WIDTH = .040    # a extent
LENGTH = .074   # b extent
VOXEL = .00032

# Silhouette in normalised (u across, v up) coordinates, clockwise from the
# upper root where the helix leaves the head.
OUTLINE = [(.13, .80), (.20, .93), (.34, .995), (.50, 1.0), (.66, .975), (.81, .91),
           (.93, .80), (.99, .66), (.985, .52), (.94, .40), (.87, .30), (.79, .215),
           (.71, .14), (.61, .09), (.50, .07), (.40, .08), (.32, .115), (.26, .17),
           (.22, .24), (.12, .30), (.05, .36), (.02, .46), (.03, .58), (.07, .70)]

# Normalised landmarks shared with the jewellery layout.
LANDMARKS_UV = {'lobe': (.47, .115), 'lobe_second': (.64, .165), 'helix_upper': (.78, .90),
                'helix_top': (.52, .975), 'tragus': (.06, .44)}


def _uv(u, v):
    return u * WIDTH, (v - .5) * LENGTH


def _catmull(points, samples=12):
    """Closed Catmull-Rom spline through the points."""
    out, n = [], len(points)
    for i in range(n):
        p0, p1, p2, p3 = (np.array(points[(i + k) % n]) for k in (-1, 0, 1, 2))
        for s in range(samples):
            t = s / samples
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                             + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(out)


def _open_spline(points, samples=10):
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = (np.array(pts[i + k]) for k in (-1, 0, 1, 2))
        for s in range(samples):
            t = s / samples
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                             + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(np.array(points[-1]))
    return np.array(out)


def _smin(a, b, k):
    h = np.clip(.5 + .5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def _smax(a, b, k):
    return -_smin(-a, -b, k)


def _polygon_sdf(A, B, poly):
    """Signed 2D distance to a closed polygon (negative inside)."""
    d = np.full(A.shape, np.inf)
    inside = np.zeros(A.shape, bool)
    n = len(poly)
    for i in range(n):
        (ax, ay), (bx, by) = poly[i], poly[(i + 1) % n]
        ex, ey = bx - ax, by - ay
        t = np.clip(((A - ax) * ex + (B - ay) * ey) / (ex * ex + ey * ey), 0, 1)
        d = np.minimum(d, np.hypot(A - ax - t * ex, B - ay - t * ey))
        cross = ((ay > B) != (by > B)) & (A < ax + (B - ay) * ex / (ey if ey else 1e-12))
        inside ^= cross
    return np.where(inside, -d, d)


def _tube(A, B, W, path, radius):
    """Distance to a swept sphere of varying radius along a 3D polyline."""
    d = np.full(A.shape, np.inf)
    for (p, rp), (q, rq) in zip(zip(path[:-1], radius[:-1]), zip(path[1:], radius[1:])):
        e = q - p
        t = np.clip(((A - p[0]) * e[0] + (B - p[1]) * e[1] + (W - p[2]) * e[2]) / max(e @ e, 1e-14), 0, 1)
        dist = np.sqrt((A - p[0] - t * e[0]) ** 2 + (B - p[1] - t * e[1]) ** 2 + (W - p[2] - t * e[2]) ** 2)
        d = np.minimum(d, dist - (rp + (rq - rp) * t))
    return d


def _ellipsoid(A, B, W, centre, radii):
    k0 = np.sqrt(((A - centre[0]) / radii[0]) ** 2 + ((B - centre[1]) / radii[1]) ** 2 + ((W - centre[2]) / radii[2]) ** 2)
    return (k0 - 1) * min(radii)


def _path(points_uv, w, radius, samples=8):
    """3D path from normalised points, per-point w and radius (metres)."""
    uv = _open_spline(points_uv, samples)
    ws = np.interp(np.linspace(0, 1, len(uv)), np.linspace(0, 1, len(w)), w)
    rs = np.interp(np.linspace(0, 1, len(uv)), np.linspace(0, 1, len(radius)), radius)
    return [np.array([*_uv(u, v), wz]) for (u, v), wz in zip(uv, ws)], list(rs)


def _smooth01(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def ear_field():
    """Return (sdf array [a, b, w], origin, voxel)."""
    lo = np.array([-.012, -LENGTH / 2 - .006, -.014])
    hi = np.array([WIDTH + .006, LENGTH / 2 + .006, .012])
    shape = np.ceil((hi - lo) / VOXEL).astype(int) + 1
    A, B, W = (lo[i] + VOXEL * np.arange(shape[i]) for i in range(3))
    A, B, W = np.meshgrid(A, B, W, indexing='ij')
    u, v = A / WIDTH, B / LENGTH + .5

    outline = np.array([_uv(*p) for p in _catmull(OUTLINE)])
    d2 = _polygon_sdf(A[:, :, 0], B[:, :, 0], outline)[:, :, None]

    # Cartilage plate: thin in the scapha and fossa, a soft thick lobe, and a
    # deep root that runs into the skull behind the concha.
    lobe = _smooth01((.26 - v) / .12)
    front = .0011 + .0010 * lobe
    back = -.0011 - .0010 * lobe
    root = _smooth01((.36 - u) / .22) * _smooth01((v - .20) / .1) * _smooth01((.84 - v) / .1)
    # The concha and cymba are bowls in the side of the head: the ear is solid
    # behind them, so carving them never opens a hole.
    ac, bc = _uv(.33, .47)
    k_concha = np.sqrt(((A[:, :, :1] - ac) / .0100) ** 2 + ((B[:, :, :1] - bc) / .0140) ** 2)
    ay, by = _uv(.42, .645)
    k_cymba = np.sqrt(((A[:, :, :1] - ay) / .0078) ** 2 + ((B[:, :, :1] - by) / .0050) ** 2)
    deep = np.maximum(root, _smooth01((1.5 - np.minimum(k_concha, k_cymba)) / .5))
    back = back - .011 * deep
    plate = _smax(d2 + .0004, np.maximum(W - front, back - W), .0011)

    # Helix: a rolled rim from the upper root, over the top and down the back,
    # dying out into the lobe.
    rim = _catmull(OUTLINE, 24)
    start = int(np.argmin([(p[0] - .13) ** 2 + (p[1] - .80) ** 2 for p in rim]))
    end = int(np.argmin([(p[0] - .76) ** 2 + (p[1] - .17) ** 2 for p in rim]))
    arc = rim[start:end + 1] if end > start else np.concatenate([rim[start:], rim[:end + 1]])
    inward = []
    centre = np.array([.52, .52])
    for p in arc:
        n = centre - p
        inward.append(p + n / np.linalg.norm(n) * np.array([.072, .040]))
    arc = np.array(inward)
    t = np.linspace(0, 1, len(arc))
    helix_r = .0029 - .0014 * _smooth01((t - .72) / .28) - .0009 * _smooth01((.08 - t) / .08)
    helix_w = .0016 - .0010 * _smooth01((t - .75) / .25)
    helix = _tube(A, B, W, [np.array([*_uv(*p), wz]) for p, wz in zip(arc, helix_w)], list(helix_r))
    field = _smin(plate, helix, .0010)

    # Crus of the helix: the rim continues forward and sinks into the concha.
    path, radius = _path([(.13, .80), (.19, .70), (.28, .625), (.38, .59)],
                         [.0014, .0008, -.0008, -.0026], [.0024, .0021, .0016, .0009])
    field = _smin(field, _tube(A, B, W, path, radius), .0012)

    # Antihelix: stem from the antitragus, then the superior crus up under the
    # helix and the inferior crus forward over the concha.
    stem, rs = _path([(.50, .29), (.61, .40), (.67, .52), (.66, .60)], [.0026, .0030, .0029, .0028],
                     [.0021, .0024, .0023, .0021])
    upper, ru = _path([(.66, .60), (.66, .71), (.62, .81), (.54, .885)], [.0028, .0026, .0021, .0012],
                      [.0020, .0018, .0016, .0012])
    lower, rl = _path([(.66, .60), (.56, .66), (.45, .70), (.33, .715)], [.0027, .0024, .0018, .0010],
                      [.0019, .0017, .0015, .0011])
    antihelix = np.minimum(np.minimum(_tube(A, B, W, stem, rs), _tube(A, B, W, upper, ru)),
                           _tube(A, B, W, lower, rl))
    field = _smin(field, antihelix, .0009)

    # Tragus and antitragus frame the concha opening.
    a0, b0 = _uv(.075, .445)
    field = _smin(field, _ellipsoid(A, B, W, (a0, b0, .0024), (.0030, .0048, .0026)), .0015)
    a1, b1 = _uv(.47, .27)
    field = _smin(field, _ellipsoid(A, B, W, (a1, b1, .0017), (.0036, .0027, .0022)), .0013)

    # Concha: a deep bowl behind the tragus, split by the crus into the cymba
    # (upper) and cavum (lower); the ear canal opens at its front.
    ac, bc = _uv(.31, .47)
    concha = _ellipsoid(A, B, W, (ac, bc, .0032), (.0072, .0112, .0082))
    cymba = _ellipsoid(A, B, W, (*_uv(.41, .645), .0020), (.0064, .0036, .0046))
    fossa = _ellipsoid(A, B, W, (*_uv(.555, .775), .0030), (.0048, .0040, .0024))
    scapha_path, scapha_r = _path([(.40, .92), (.62, .90), (.80, .78), (.84, .60), (.80, .42), (.72, .30)],
                                  [.0024] * 6, [.0013, .0016, .0017, .0017, .0014, .0009])
    scapha = _tube(A, B, W, scapha_path, scapha_r)
    field = _smax(field, -concha, .0016)
    field = _smax(field, -cymba, .0012)
    field = _smax(field, -fossa, .0010)
    field = _smax(field, -scapha, .0008)
    canal_path = [np.array([*_uv(.20, .455), .0010]), np.array([*_uv(.16, .45), -.0080])]
    field = _smax(field, -_tube(A, B, W, canal_path, [.0024, .0019]), .0010)

    # Nothing may poke through the skull side beyond the root.
    field = np.maximum(field, -.012 - W)
    return field.astype(np.float32), lo, VOXEL


def ear_geometry():
    """(vertices, faces) of the ear surface in the local frame."""
    import openvdb as vdb
    field, lo, voxel = ear_field()
    grid = vdb.FloatGrid(background=float(field.max()))
    grid.copyFromArray(field)
    points, triangles, quads = grid.convertToPolygons(isovalue=0.0, adaptivity=0.0)
    points = points * voxel + lo
    faces = [tuple(f) for f in quads] + [tuple(f) for f in triangles]
    return points, faces


LANDMARKS = {name: _uv(*uv) for name, uv in LANDMARKS_UV.items()}


def ear_mesh(name, smooth=6, target_faces=5200):
    """Blender object with the sculpted ear in the local frame, cleaned up."""
    import bpy
    import bmesh
    points, faces = ear_geometry()
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(p) for p in points], [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    # OpenVDB winds faces inward for this field; the surface faces outwards.
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    centre = sum((v.co for v in bm.verts), bm.verts[0].co * 0) / len(bm.verts)
    outward = sum(((f.calc_center_median() - centre).dot(f.normal) for f in bm.faces))
    if outward < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(mesh); bm.free()
    for modifier, settings in (('DECIMATE', {'ratio': min(1.0, target_faces / max(len(mesh.polygons), 1))}),
                               ('CORRECTIVE_SMOOTH', {'iterations': smooth, 'factor': .5, 'smooth_type': 'SIMPLE',
                                                      'use_only_smooth': True}),):
        mod = obj.modifiers.new(modifier.lower(), modifier)
        for key, value in settings.items():
            setattr(mod, key, value)
    obj.data.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    clean = bpy.data.meshes.new_from_object(evaluated)
    obj.modifiers.clear()
    old = obj.data; obj.data = clean; bpy.data.meshes.remove(old)
    clean.name = name
    for poly in clean.polygons:
        poly.use_smooth = True
    return obj
