"""Procedural front locks for the medium cut, used by tools/port-medium-cut.py.

The supplied cut keeps its back; its front (a flat swept fringe that parted
the forehead open) is rebuilt here as ribbon locks like the back ones:
- an under layer of broad combed strands that hides the scalp,
- a clean off-centre parted fringe of wavy locks reaching the brow and
  lengthening toward the temples into the side locks,
- looser curly top locks for volume, S-waved side locks in front of the ears
  down to the jaw, and a few flyaways for the casual finish.
Each lock follows a chart path (u = azimuth, 0 front / +90 anatomical left,
v = polar angle from the crown, offset in mm) projected onto the boy and girl
skins, curls along its length, splits into sub-ribbons and is pushed outside
both skins. Space: boy seat, Blender Z up, front -Y, metres. UV v runs along
the lock so the shared hair normal map fibres follow each strand.
"""
import math
import random
from mathutils import Vector, Matrix

C0 = Vector((0.0, -0.025, 1.615))


def D(u, v):
    u, v = math.radians(u), math.radians(v)
    return Vector((math.sin(v) * math.sin(u), -math.sin(v) * math.cos(u), math.cos(v)))


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def spline(ctrl, t):
    n = len(ctrl) - 1
    x = t * n
    i = min(int(x), n - 1)
    f = x - i
    p0, p1, p2, p3 = ctrl[max(i - 1, 0)], ctrl[i], ctrl[i + 1], ctrl[min(i + 2, n)]
    return tuple(0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f
                        + (-a + 3 * b - 3 * c + d) * f ** 3) for a, b, c, d in zip(p0, p1, p2, p3))


class Heads:
    def __init__(self, trees):
        self.trees = trees

    def radius(self, d):
        best = None
        for tree in self.trees:
            loc, _n, _i, _dist = tree.ray_cast(C0 + d * 0.4, -d, 0.4)
            if loc is not None:
                r = (loc - C0).dot(d)
                best = r if best is None else max(best, r)
        return best if best is not None else 0.11

    def push(self, p, clear):
        for _ in range(4):
            moved = False
            for tree in self.trees:
                loc, n, _i, _dist = tree.find_nearest(p, 0.08)
                if loc is None:
                    continue
                s = (p - loc).dot(n)
                if s < clear:
                    p = p + n * (clear - s)
                    moved = True
            if not moved:
                break
        return p


def resample(points, count):
    lengths = [0.0]
    for a, b in zip(points, points[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]
    out, j = [], 0
    for i in range(count):
        s = total * i / (count - 1)
        while j < len(lengths) - 2 and lengths[j + 1] < s:
            j += 1
        seg = max(lengths[j + 1] - lengths[j], 1e-9)
        f = (s - lengths[j]) / seg
        out.append(points[j].lerp(points[j + 1], min(1.0, max(0.0, f))))
    return out, total


class Lock:
    """One lock: a chart path over the scalp shell plus curl, split in sub ribbons."""

    def __init__(self, ctrl, width, subs=2, amp=0.004, freq=1.3, phase=0.0,
                 flick=0.0, twist=0.35, rows=22, sub_len=(0.82, 1.0), seed=0, tip_width=0.22):
        self.ctrl, self.width, self.subs = ctrl, width, subs
        self.amp, self.freq, self.phase, self.flick = amp, freq, phase, flick
        self.twist, self.rows, self.sub_len, self.seed = twist, rows, sub_len, seed
        self.tip_width = tip_width


def build_lock(heads, lock, mesh):
    rng = random.Random(lock.seed)
    dense = []
    normals = []
    for i in range(72):
        t = i / 71
        u, v, off = spline(lock.ctrl, t)
        d = D(u, v)
        dense.append(C0 + d * (heads.radius(d) + off * 0.001))
        normals.append(d)
    pts, _total = resample(dense, 72)
    # Local frames along the base path.
    frames = []
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        T = (b - a).normalized()
        k = min(len(normals) - 1, i)
        N = (normals[k] - T * normals[k].dot(T)).normalized()
        B = T.cross(N).normalized()
        frames.append((T, N, B))
    # Curl: a lazy 3D wave that grows toward the tip, plus an outward tip flick.
    curled = []
    for i, p in enumerate(pts):
        t = i / (len(pts) - 1)
        T, N, B = frames[i]
        a = lock.amp * smooth(0.12, 0.9, t)
        phi = 2 * math.pi * lock.freq * t + lock.phase
        q = p + B * (a * math.sin(phi)) + N * (a * 0.9 * (0.5 + 0.5 * math.cos(phi)))
        q = q + N * (lock.flick * smooth(0.72, 1.0, t) ** 2)
        curled.append(heads.push(q, 0.0022))
    for k in range(lock.subs):
        centre = (k - (lock.subs - 1) / 2)
        length = rng.uniform(*lock.sub_len) if lock.subs > 1 else 1.0
        wig = rng.uniform(0, 6.28)
        wig_amp = rng.uniform(0.0008, 0.0022)
        sub_w = lock.width * (0.62 if lock.subs > 1 else 1.0)
        rows = lock.rows
        ring_start = len(mesh['verts'])
        v_acc = 0.0
        prev = None
        for r in range(rows + 1):
            t = length * r / rows
            x = t * (len(curled) - 1)
            i = min(int(x), len(curled) - 2)
            f = x - i
            c = curled[i].lerp(curled[i + 1], f)
            T, N, B = frames[i]
            ang = lock.twist * math.sin(math.pi * t + wig)
            rot = Matrix.Rotation(ang, 3, T)
            N2, B2 = rot @ N, rot @ B
            s = r / rows
            spread = centre * lock.width * 0.46 * (1 - 0.55 * s)
            c = c + B2 * (spread + wig_amp * math.sin(2 * math.pi * 2.2 * t + wig))
            w = sub_w * min(1.0, 0.6 + s / 0.1) * max(lock.tip_width, (1 - s ** 3.2) ** 0.5) + 0.001
            left = c - B2 * (w * 0.5) - N2 * (w * 0.04)
            mid = c + N2 * (w * 0.2)
            right = c + B2 * (w * 0.5) - N2 * (w * 0.04)
            if prev is not None:
                v_acc += (c - prev).length
            prev = c
            for j, q in enumerate((left, mid, right)):
                mesh['verts'].append(heads.push(q, 0.0014))
                mesh['uv'].append((mesh['uv_u'] * j * 0.5 * sub_w, v_acc * mesh['uv_v']))
        for r in range(rows):
            a = ring_start + r * 3
            b = a + 3
            mesh['faces'].append((a, a + 1, b + 1, b))
            mesh['faces'].append((a + 1, a + 2, b + 2, b + 1))


def front_locks(seed=7):
    rng = random.Random(seed)
    locks = []
    n = 0
    part = 16.0

    def sweep(u):
        return -14.0 if u < part else 10.0

    def hairline(u):
        au = abs(u)
        return 58 + 34 * smooth(35, 85, au) - 12 * smooth(98, 122, au)

    # Under layer: broad, close combed strands starting behind the crown so the
    # scalp never shows between the kept back locks and the new front.
    for u in range(-108, 109, 6):
        uj = u + rng.uniform(-1.5, 1.5)
        hl = hairline(uj)
        locks.append(Lock([(uj * 0.8, -16, 1.0), (uj * 0.92, 18, 2.2), (uj * 0.97 + sweep(uj) * 0.3, hl - 6, 3.0),
                           (uj + sweep(uj) * 0.6, hl + 8, 2.4)],
                          width=rng.uniform(0.022, 0.026), subs=1, amp=0.002, freq=0.8,
                          phase=rng.uniform(0, 6.3), twist=0.1, rows=20, seed=n)); n += 1
    # Fringe: clean, chunky wavy locks from a soft off-centre part. They reach
    # the brow in the middle and lengthen in a graduated curtain toward the
    # temples, sweeping outward so they flow into the side locks.
    for u in range(-66, 67, 7):
        uj = u + rng.uniform(-1, 1)
        away = abs(uj - part)
        side = -1.0 if uj < part else 1.0
        sw = side * (6 + 26 * smooth(5, 65, away))
        tip = 88 + 22 * smooth(10, 68, away) + 3 * math.sin(uj * 0.21) + rng.uniform(-1.5, 1.5)
        locks.append(Lock([(uj * 0.3, 2, 3.0), (uj * 0.7, 26, 9.5), (uj * 0.95 + sw * 0.35, 54, 10.5),
                           (uj + sw * 0.8, (54 + tip) / 2 + 4, 8.5), (uj + sw * 1.1, tip, 6.0)],
                          width=rng.uniform(0.027, 0.030), subs=2, amp=rng.uniform(0.0045, 0.0055),
                          freq=rng.uniform(0.9, 1.1), phase=rng.uniform(0, 6.3), flick=0.004,
                          twist=0.16, rows=30, sub_len=(0.84, 1.0), seed=n, tip_width=0.06)); n += 1
    # Top volume: soft wavy locks riding over the part, ending above the fringe.
    for u in range(-80, 81, 9):
        uj = u + rng.uniform(-2, 2)
        side = -1.0 if uj < part else 1.0
        sw = side * (6 + 12 * smooth(0, 60, abs(uj - part)))
        tip = 80 + 18 * smooth(10, 68, abs(uj - part)) + rng.uniform(-2, 2)
        locks.append(Lock([(uj * 0.2, -4, 4.0), (uj * 0.55, 22, 15.0), (uj * 0.9 + sw * 0.55, 46, 14.0),
                           (uj + sw * 1.1, tip, 11.0)],
                          width=rng.uniform(0.024, 0.028), subs=2, amp=rng.uniform(0.006, 0.008),
                          freq=rng.uniform(1.2, 1.5), phase=rng.uniform(0, 6.3), flick=0.005,
                          twist=0.28, rows=28, sub_len=(0.88, 1.0), seed=n, tip_width=0.08)); n += 1
    # Side locks: sweep back over the temple and fall past the ear to the jaw,
    # lifted off the cheek with S waves for a casual, lived-in volume.
    for s in (-1, 1):
        for u in (58, 66, 74, 82, 90):
            uj = u + rng.uniform(-2, 2)
            tip = rng.uniform(120, 132)
            locks.append(Lock([(s * 22, 6, 5.0), (s * (uj - 12), 36, 13.0), (s * (uj + 1), 66, 14.0),
                               (s * (uj + 3), 94, 16.0), (s * (uj + 4), tip, 19.0)],
                              width=rng.uniform(0.024, 0.028), subs=3, amp=rng.uniform(0.009, 0.012),
                              freq=rng.uniform(1.5, 1.9), phase=rng.uniform(0, 6.3), flick=rng.uniform(0.007, 0.010),
                              twist=0.4, rows=30, sub_len=(0.8, 1.0), seed=n)); n += 1
    # A few fine flyaways on the crown only, so the fringe stays clean.
    for _ in range(5):
        uj = rng.uniform(-60, 60)
        tip = rng.uniform(40, 52)
        locks.append(Lock([(uj * 0.3, -6, 5.0), (uj * 0.7, 18, 14.0), (uj * 1.05, tip, 12.0)],
                          width=rng.uniform(0.005, 0.007), subs=1, amp=0.007,
                          freq=1.6, phase=rng.uniform(0, 6.3), flick=0.004,
                          twist=0.4, rows=16, seed=n)); n += 1
    return locks


def build_front(heads, uv_u=40.0, uv_v=6.0, seed=7):
    mesh = {'verts': [], 'faces': [], 'uv': [], 'uv_u': uv_u, 'uv_v': uv_v}
    for lock in front_locks(seed):
        build_lock(heads, lock, mesh)
    return mesh
