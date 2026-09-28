"""Rebuild the female torso surface before fitting the wardrobe to it.

The supplied torso has sparse, angular chest rings. Adding local bumps after
clothing generation exaggerates those planes; sample a smooth surface instead,
and give the shirt its own small, continuous ease over the same shape.
"""
import math

import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


def smooth(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def torso_point(point, garment=False, shell_depth=0.0):
    p = point.copy()
    x, y, z = p
    if not 1.01 < z < 1.445 or abs(x) >= .205:
        return p
    height = smooth((z - 1.01) / .075) * smooth((1.445 - z) / .075)
    side = 1.0 - smooth((abs(x) - .125) / .065)
    weight = height * side
    waist = math.exp(-((z - 1.09) / .13) ** 2)
    p.x *= 1.0 - (.045 * waist + .020) * weight
    # Smooth rib cage and abdomen, with no pectoral or abdominal definition.
    depth = .103 + .010 * math.exp(-((z - 1.10) / .11) ** 2)
    radius = .181 - .032 * math.exp(-((z - 1.075) / .11) ** 2)
    baseline = -depth * math.sqrt(max(.04, 1.0 - (p.x / radius) ** 2))
    # Broad upper transition and a rounder lower pole, softly joined at centre.
    dz = z - 1.274
    vertical = .086 if dz >= 0.0 else .069
    spread = .065 if garment else .061
    fullness = sum(math.exp(-((p.x - sign * .063) / spread) ** 2
                            - (dz / vertical) ** 2) for sign in (-1, 1))
    target = baseline - .043 * fullness - (.013 if garment else 0.0) + shell_depth
    front = smooth((-y - .018) / .055)
    p.y += (target - y) * weight * front
    return p


def upper_body_balance(point):
    """Soften the shoulder line and taper the arms to match the rebuilt torso."""
    p = point.copy()
    x, y, z = p
    if not .93 < z < 1.445:
        return p
    height = smooth((z - .93) / .14) * smooth((1.445 - z) / .075)
    arm_start = .195 - .045 * smooth((z - 1.15) / .20)
    arm = smooth((abs(x) - arm_start) / .045) * height
    axis = .205 + .22 * (1.30 - z)
    sign = 1.0 if x >= 0 else -1.0
    p.x += sign * (-.10 * (abs(x) - axis) - .006) * arm
    p.y += -.055 * (y + .012) * arm
    shoulder = (math.exp(-((z - 1.365) / .065) ** 2)
                * smooth((abs(x) - .09) / .10) * smooth((z - 1.20) / .10))
    p.z -= .005 * shoulder * height
    return p


def rebuild_torso(obj, garment=False):
    """Densify only the torso; preserve the face, legs and their corner normals."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    normals = bm.loops.layers.float_vector.new('refit_preserved_normal')
    source = [tuple(n.vector) for n in obj.data.corner_normals]
    for face, polygon in zip(bm.faces, obj.data.polygons):
        for loop, index in zip(face.loops, polygon.loop_indices):
            loop[normals] = source[index]
    # Linear subdivision followed by surface reconstruction retains UVs and
    # does not shrink the head or change the delivered limbs.
    for _ in range(4):
        edges = [e for e in bm.edges if e.calc_length() > .010
                 and all(1.005 < v.co.z < 1.445 and abs(v.co.x) < .205 for v in e.verts)]
        if not edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
    # The delivered shirt contains both surfaces of its cloth shell. Preserve
    # their separation when replacing the front surface (otherwise Z-fighting).
    reference = BVHTree.FromBMesh(bm) if garment else None
    for vertex in bm.verts:
        depth = 0.0
        p = vertex.co
        if reference and 1.01 < p.z < 1.445 and abs(p.x) < .205 and p.y < -.018:
            hit, _, _, _ = reference.ray_cast(Vector((p.x, -.5, p.z)), Vector((0, 1, 0)))
            if hit is not None:
                depth = max(0.0, p.y - hit.y)
        vertex.co = upper_body_balance(torso_point(p, garment, depth))
    bm.normal_update()
    # Average geometric normals across duplicated UV vertices in the rebuilt
    # area only. Head/ear/eyelid custom normals are restored verbatim.
    averaged = {}
    for face in bm.faces:
        for loop in face.loops:
            key = tuple(round(c, 6) for c in loop.vert.co)
            if key not in averaged:
                averaged[key] = Vector()
            averaged[key] += face.normal * face.calc_area()
    result = []
    for face in bm.faces:
        for loop in face.loops:
            p = loop.vert.co
            key = tuple(round(c, 6) for c in p)
            weight = (smooth((p.z - 1.01) / .075) * smooth((1.445 - p.z) / .075)
                      * (1.0 - smooth((abs(p.x) - .125) / .065))
                      * smooth((-p.y - .018) / .055))
            original = Vector(loop[normals])
            if weight > 0.0:
                original = original.lerp(averaged[key].normalized(), weight).normalized()
            result.append(tuple(original))
        if any(1.01 < v.co.z < 1.445 for v in face.verts):
            face.smooth = True
    bm.loops.layers.float_vector.remove(normals)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.normals_split_custom_set(result)
    obj.data.update()
    obj['female_torso_revision'] = 'continuous-surface-v1'
    obj['female_torso_garment'] = garment


EAR_OUTLINE = ((-.0150, 1.5180), (-.0300, 1.5340), (-.0300, 1.5625), (-.0204, 1.5908),
               (-.0008, 1.5996), (.0495, 1.6104), (.0502, 1.6035),
               (.0316, 1.5693), (.0232, 1.5553), (.0110, 1.5424))


def ear_weight(y, z, outline=EAR_OUTLINE, band=.014):
    """Soft stencil of the actual ear outline, not a rectangular shaved side."""
    inside = False
    distance = float('inf')
    for i, (ay, az) in enumerate(outline):
        by, bz = outline[(i + 1) % len(outline)]
        dy, dz = by - ay, bz - az
        t = max(0.0, min(1.0, ((y - ay) * dy + (z - az) * dz) / (dy * dy + dz * dz)))
        distance = min(distance, math.hypot(y - ay - t * dy, z - az - t * dz))
        if (az > z) != (bz > z) and y < ay + (z - az) * dy / dz:
            inside = not inside
    signed = distance if inside else -distance
    return smooth((signed + band) / band)


def clear_ear_space(obj, weight=ear_weight, revision='anatomical-outline-v2'):
    """Tuck whole hair surfaces medially behind the ear, with smooth shoulders.

    The ear extends from x=±.090 to ±.135, z=1.52..1.61 on the current base.
    Only its measured outline is cleared; the surrounding temple volume stays
    in place. Locks turn inward at the ear edge instead of being cut away.
    """
    matrix = obj.matrix_world.copy()
    inverse = matrix.inverted()
    moved = 0
    for vertex in obj.data.vertices:
        p = matrix @ vertex.co
        side = 1.0 if p.x >= 0 else -1.0
        if not -.05 < p.y < .075 or not 1.50 < p.z < 1.635:
            continue
        w = weight(p.y, p.z)
        if w <= 0 or abs(p.x) <= .077:
            continue
        # Monotonic compression (not face removal) preserves connected locks.
        inner = .077 + .001 * math.tanh((abs(p.x) - .077) / .025)
        p.x = side * (abs(p.x) * (1.0 - w) + inner * w)
        vertex.co = inverse @ p
        moved += 1
    obj.data.update()
    obj['ear_clearance_revision'] = revision
    obj['ear_clearance_vertices'] = moved
    return moved


def fit_posterior_hair(obj, skin):
    """Close the back of the hairstyle against the actual head surface.

    An ellipse narrower than the delivered skull disappears inside the head,
    exposing skin between the braid and side locks. Ray-fit the combed layer
    after equipment retargeting, so it stays just outside the whole occiput.
    """
    import bpy
    points=[skin.matrix_world @ v.co for v in skin.data.vertices]
    surface=BVHTree.FromPolygons(points,[list(p.vertices) for p in skin.data.polygons])
    cols,rows=192,52
    upper=1.658 if obj.get('hat_fit')=='covered' else 1.716
    radii=[]
    for j in range(rows):
        z=1.49+(upper-1.49)*j/(rows-1)
        row=[]
        for i in range(cols+1):
            a=math.pi*i/cols
            direction=Vector((math.cos(a),math.sin(a),0))
            origin=Vector((0,-.012,z))+direction*.35
            hit,normal,_,_=surface.ray_cast(origin,-direction)
            if hit is None:
                hit,_,_,_=surface.find_nearest(Vector((0,-.012,z)))
            row.append(max(.001,(hit-Vector((0,-.012,z))).dot(direction)))
        radii.append(row)
    fair=[row[:] for row in radii]
    for _ in range(10):
        fair=[[.5*fair[j][i]+.125*(fair[max(0,j-1)][i]+fair[min(rows-1,j+1)][i]
               +fair[j][max(0,i-1)]+fair[j][min(cols,i+1)]) for i in range(cols+1)] for j in range(rows)]
    vertices=[]
    for j in range(rows):
        z=1.49+(upper-1.49)*j/(rows-1)
        vertical=smooth((z-1.49)/.030)*smooth((upper-z)/.022)
        for i in range(cols+1):
            a=math.pi*i/cols
            direction=Vector((math.cos(a),math.sin(a),0))
            angular=smooth(a/.20)*smooth((math.pi-a)/.20)
            radius=max(radii[j][i]+.002,fair[j][i]+.005)
            radius=radii[j][i]-.006+(radius-radii[j][i]+.006)*vertical*angular
            gathering=.65+1.5*smooth((z-1.52)/.19)
            flow=(a-math.pi/2)*65/gathering
            radius+=.00065*math.sin(flow)*vertical*angular
            vertices.append(Vector((0,-.012,z))+direction*radius)
    faces=[(j*(cols+1)+i,j*(cols+1)+i+1,(j+1)*(cols+1)+i+1,(j+1)*(cols+1)+i)
           for j in range(rows-1) for i in range(cols)]
    data=bpy.data.meshes.new('Mila fitted combed occiput')
    data.from_pydata(vertices,[],faces);data.update()
    for mat in obj.data.materials:data.materials.append(mat)
    for face in data.polygons:face.use_smooth=True
    obj.data=data;obj.matrix_world=Matrix.Identity(4)
    obj['hair_repair']='Ray-fitted combed back layer, outside the actual scalp'
    return obj


def swept_temple_locks(reference, clear=clear_ear_space, paths=None, label='swept temple'):
    """Join the supplied temple curls to the back lengths around each ear.

    These are tapered, volumetric, combed locks, rather than a flat scalp plate.
    They sit outside the scalp above/behind the ear while leaving its rim clear.
    Coordinates are in the final character frame, after equipment fitting.
    """
    import bpy
    paths = paths or [
        ([(.084, -.035, 1.670), (.100, -.010, 1.637), (.102, .027, 1.622),
          (.100, .057, 1.606), (.092, .081, 1.580)],
         [.002, .013, .012, .014, .001], [.002, .004, .004, .005, .0005]),
        ([(.085, .017, 1.671), (.095, .044, 1.642), (.092, .074, 1.612),
          (.082, .087, 1.583), (.075, .093, 1.550)],
         [.003, .015, .017, .013, .001], [.002, .004, .006, .004, .0005]),
    ]
    created = []
    for sign in (-1, 1):
        for index, (path, widths, depths) in enumerate(paths):
            controls = [Vector((sign*x, y, min(z, 1.656) if reference.get('hat_fit') == 'covered' else z))
                        for x, y, z in path]
            centers, ws, ds = [], [], []
            for j in range(len(controls)-1):
                a, b = controls[max(0,j-1)], controls[j]
                c, d = controls[j+1], controls[min(j+2,len(controls)-1)]
                for k in range(12):
                    t=k/12
                    centers.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
                    ws.append(widths[j]*(1-t)+widths[j+1]*t)
                    ds.append(depths[j]*(1-t)+depths[j+1]*t)
            centers.append(controls[-1]); ws.append(widths[-1]); ds.append(depths[-1])
            vertices=[]; n=64
            for j, center in enumerate(centers):
                tangent=(centers[min(j+1,len(centers)-1)]-centers[max(0,j-1)]).normalized()
                radial=Vector((sign,0,0))
                normal=(radial-tangent*radial.dot(tangent)).normalized()
                across=tangent.cross(normal).normalized()
                for i in range(n):
                    angle=math.tau*i/n
                    comb=1+.24*math.cos(math.cos(angle)*math.pi*6+j*.035)
                    vertices.append(center+across*(math.cos(angle)*ws[j])
                                    +normal*(math.sin(angle)*ds[j]*comb))
            faces=[tuple(reversed(range(n)))]
            faces += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i)
                      for j in range(len(centers)-1) for i in range(n)]
            faces.append(tuple((len(centers)-1)*n+i for i in range(n)))
            data=bpy.data.meshes.new('Natural swept temple lock')
            data.from_pydata(vertices,[],faces); data.update()
            # Recalculate outward normals consistently on the closed volume.
            bm=bmesh.new();bm.from_mesh(data)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
            for polygon in data.polygons:polygon.use_smooth=True
            obj=bpy.data.objects.new(f'{reference.get("shop_id")} / {label} {sign} {index} / {reference.get("hat_fit", "open")}',data)
            bpy.context.scene.collection.objects.link(obj)
            for key in ['shop_slot','shop_id','fit_persona','hat_fit','appearance_revision','base_revision']:
                if key in reference:obj[key]=reference[key]
            for mat in reference.data.materials:data.materials.append(mat)
            clear(obj)
            created.append(obj)
    return created
