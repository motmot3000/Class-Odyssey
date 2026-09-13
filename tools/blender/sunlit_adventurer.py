"""An original, bright toy-scale adventurer, authored in Blender via MCP.

Reference: the user's supplied Link's Awakening-style character image.
Shape language: generous rounded head, glossy oval eyes, broad golden locks,
small cloth body and readable blue shield. The compass emblem is ClassQuest's.
MCP entry points: build_body(), build_head(), equipment_and_studio(), export().
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'mini-hero'
character = None
materials = {}


def rgb(hex_color):
    h = hex_color.lstrip('#')
    srgb = [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(c/12.92 if c < .04045 else ((c+.055)/1.055)**2.4 for c in srgb)


def material(name, color, rough=.42, metal=0, coat=.15):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb(color), 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = m.diffuse_color
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Coat Weight'].default_value = coat
    shader.inputs['Coat Roughness'].default_value = .28
    materials[name] = m
    return m


def finish(obj, name, mat, sub=0):
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    character.objects.link(obj)
    obj.data.materials.append(materials[mat] if isinstance(mat, str) else mat)
    if obj.type == 'MESH':
        for face in obj.data.polygons:
            face.use_smooth = True
    if sub:
        modifier = obj.modifiers.new('Soft sculpted surface', 'SUBSURF')
        modifier.levels = modifier.render_levels = sub
    return obj


def mesh(name, vertices, faces, mat, sub=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    character.objects.link(obj)
    return finish(obj, name, mat, sub)


def ell(name, loc, scale, mat, rotation=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    if rotation:
        obj.rotation_euler = rotation
    return finish(obj, name, mat)


def box(name, loc, scale, mat, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel_mod = obj.modifiers.new('Rounded handmade edges', 'BEVEL')
    bevel_mod.width = bevel
    bevel_mod.segments = 4
    obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return finish(obj, name, mat)


def stroke(name, points, radius, mat, cyclic=False, radii=None):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 16
    data.bevel_depth = radius
    data.bevel_resolution = 4
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for i, (point, position) in enumerate(zip(spline.bezier_points, points)):
        point.co = position
        point.handle_left_type = point.handle_right_type = 'AUTO'
        if radii:
            point.radius = radii[i]
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    character.objects.link(obj)
    obj.data.materials.append(materials[mat])
    return obj


def rings(name, rows, mat, count=48, sub=2):
    vertices = []
    for x, y, z, rx, ry in rows:
        for i in range(count):
            a = math.tau*i/count
            vertices.append((x+rx*math.cos(a), y+ry*math.sin(a), z))
    faces = [tuple(reversed(range(count)))]
    for row in range(len(rows)-1):
        for i in range(count):
            j = (i+1)%count
            faces.append((row*count+i, row*count+j, (row+1)*count+j, (row+1)*count+i))
    faces.append(tuple((len(rows)-1)*count+i for i in range(count)))
    return mesh(name, vertices, faces, mat, sub)


def sweep(name, points, widths, depths, mat, count=20, sub=2, width_axis=None):
    """Sculpted elliptical cross-sections along a spine; useful for locks/ears."""
    centers = [Vector(p) for p in points]
    vertices = []
    for j, p in enumerate(centers):
        tangent = (centers[min(j+1,len(centers)-1)]-centers[max(0,j-1)]).normalized()
        if width_axis is not None:
            axis=Vector(width_axis)
            side=(axis-tangent*tangent.dot(axis)).normalized()
        else:
            guide = Vector((0,-1,0))
            if abs(tangent.dot(guide)) > .94:
                guide = Vector((1,0,0))
            side = tangent.cross(guide).normalized()
        depth_axis = tangent.cross(side).normalized()
        for i in range(count):
            a = i*math.tau/count
            vertices.append(p+side*math.cos(a)*widths[j]+depth_axis*math.sin(a)*depths[j])
    faces = [tuple(reversed(range(count)))]
    faces += [(j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i) for j in range(len(centers)-1) for i in range(count)]
    faces.append(tuple((len(centers)-1)*count+i for i in range(count)))
    return mesh(name, vertices, faces, mat, sub)


def limb(name, a, b, rx, ry, mat):
    a, b = Vector(a), Vector(b)
    obj = ell(name, (a+b)/2, (rx,ry,(b-a).length/2+rx*.45), mat)
    obj.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    return obj


def build_body():
    global character
    # A separate scene preserves any scene already open in the user's Blender.
    scene = bpy.data.scenes.new('Petit aventurier • daylight study')
    bpy.context.window.scene = scene
    character = bpy.data.collections.new('Mini hero • editable character pieces')
    scene.collection.children.link(character)
    OUT.mkdir(parents=True, exist_ok=True)
    material('Skin • warm porcelain', '#F2C68F', .42, coat=.15)
    material('Ear • soft peach', '#DE9575', .55, coat=.03)
    material('Tunic • fresh leaf', '#37964D', .55, coat=.06)
    material('Cap • deep leaf', '#26784B', .51, coat=.08)
    material('Cloth hem • sage', '#68AC69', .62, coat=.03)
    material('Hair • golden honey', '#F2AD20', .32, coat=.3)
    material('Hair • amber undertone', '#D99229', .4, coat=.16)
    material('Boots • chestnut', '#98592E', .4, coat=.2)
    material('Belt • cocoa leather', '#6A412A', .57, coat=.05)
    material('Outsole • warm umber', '#49372A', .66, coat=.03)
    material('Leggings • warm linen', '#EFE5C7', .7, coat=0)
    material('Eyes • obsidian', '#171F19', .19, coat=.48)
    material('Brows • walnut', '#624026', .47, coat=.03)
    material('Brass • satin gold', '#DCBA60', .3, .7, .16)
    material('Steel • pale silver', '#D2E1E2', .26, .68, .2)
    material('Steel • blue facet', '#92AFB8', .3, .6, .1)
    material('Shield • enamel blue', '#388ED0', .3, .15, .4)
    material('Shield • midnight edge', '#28546E', .43, .2, .12)

    for sign in (-1,1):
        x=sign*.135
        y=-.05 if sign<0 else .035
        limb('Linen knee '+str(sign),(x,y,.26),(x*.82,.012,.51),.078,.075,'Leggings • warm linen')
        box('Soft boot sole '+str(sign),(x,y-.055,.024),(.203,.298,.032),'Outsole • warm umber',.015)
        ell('Rounded boot vamp '+str(sign),(x,y-.071,.083),(.106,.164,.060),'Boots • chestnut')
        rings('Boot ankle '+str(sign),[(x,y,.1,.079,.082),(x,y,.14,.09,.09),(x,y+.015,.24,.075,.072),(x,y+.015,.278,.067,.065)],'Boots • chestnut',sub=2)
        rings('Turned boot cuff '+str(sign),[(x,y+.015,.267,.084,.079),(x,y+.015,.28,.091,.086),(x,y+.015,.31,.091,.086),(x,y+.015,.318,.085,.08)],'Boots • chestnut',sub=1)
        stroke('Subtle boot seam '+str(sign),[(x-.061,y-.168,.115),(x,y-.201,.114),(x+.061,y-.168,.115)],.0025,'Hair • amber undertone')
    rings('Compact flared tunic',[(0,.016,.475,.18,.118),(0,.012,.49,.225,.147),(0,.008,.525,.248,.16),(0,.006,.61,.232,.153),(0,.006,.7,.213,.147),(0,.008,.8,.239,.157),(0,.01,.885,.222,.131),(0,.006,.949,.129,.09),(0,.006,.966,.084,.066)],'Tunic • fresh leaf',sub=2)
    stroke('Rolled tunic hem',[(.237*math.cos(a),.008+.155*math.sin(a),.516) for a in [i*math.tau/40 for i in range(40)]],.006,'Cloth hem • sage',True)
    rings('Leather waist belt',[(0,.005,.616,.24,.164),(0,.005,.622,.244,.168),(0,.005,.671,.233,.165),(0,.005,.677,.227,.161)],'Belt • cocoa leather',sub=1)
    stroke('Buckle frame',[(-.041,-.166,.621),(.041,-.166,.621),(.041,-.169,.674),(-.041,-.169,.674)],.007,'Brass • satin gold',True)
    stroke('Buckle pin',[(0,-.179,.624),(0,-.180,.671)],.003,'Brass • satin gold')
    ell('Neck',(0,.005,.958),(.071,.064,.075),'Skin • warm porcelain')
    for sign in (-1,1):
        # Sleeve volume overlaps the shoulder, then forearm and compact mitten hand.
        a=(sign*.198,0,.865)
        elbow=(sign*.32,-.025,.781)
        wrist=(sign*.397,-.092,.724 if sign<0 else .821)
        limb('Short green sleeve '+str(sign),a,elbow,.098,.095,'Tunic • fresh leaf')
        limb('Bare forearm '+str(sign),elbow,wrist,.068,.065,'Skin • warm porcelain')
        ell('Holding hand '+str(sign),(wrist[0],wrist[1]-.005,wrist[2]),(.073,.064,.074),'Skin • warm porcelain')
        ell('Opposed thumb '+str(sign),(wrist[0]-sign*.046,wrist[1]-.045,wrist[2]+.011),(.029,.031,.040),'Skin • warm porcelain')
    print('Body ready:',len(character.objects),'pieces')


def hair_crown():
    # The hair follows the same rounded-square surface as the head, including the nape.
    def spow(value,power): return math.copysign(abs(value)**power,value)
    vertices=[];count=64;nr=16
    for j in range(nr):
        t=j/(nr-1)
        for k in range(count):
            a=k*math.tau/count
            theta=.005+(1.7+.48*math.sin(a)-.005)*t
            h=spow(math.cos(theta),.76)
            r=spow(math.sin(theta),.76)
            vertices.append((.374*r*spow(math.cos(a),.76)*(1-.08*max(0,-h)),.296*r*spow(math.sin(a),.76),1.193+.34*h))
    return mesh('Golden hair crown',vertices,[(j*count+k,(j+1)*count+k,(j+1)*count+(k+1)%count,j*count+(k+1)%count) for j in range(nr-1) for k in range(count)],'Hair • golden honey',1)


def adventure_cap():
    return sweep('Bent green adventure cap',[(0,.052,1.299),(0,.075,1.354),(0,.14,1.439),(.02,.232,1.486),(.075,.353,1.463),(.14,.456,1.339),(.15,.473,1.263)],[.335,.353,.305,.223,.133,.049,.002],[.225,.233,.174,.10,.09,.04,.002],'Cap • deep leaf',count=40,sub=2,width_axis=(1,0,0))


def build_head():
    # Rounded-square silhouette: a superellipsoid, not a spherical toy head.
    def spow(value,power):
        return math.copysign(abs(value)**power,value)
    rows=40;columns=80;vertices=[]
    for j in range(rows+1):
        latitude=-math.pi/2+math.pi*j/rows
        height=spow(math.sin(latitude),.76)
        jaw=1-.10*max(0,-height)
        for i in range(columns):
            a=math.tau*i/columns
            vertices.append((.36*spow(math.cos(latitude),.76)*spow(math.cos(a),.76)*jaw,
                             .282*spow(math.cos(latitude),.76)*spow(math.sin(a),.76),
                             1.193+.327*height))
    faces=[(j*columns+i,j*columns+(i+1)%columns,(j+1)*columns+(i+1)%columns,(j+1)*columns+i) for j in range(rows) for i in range(columns)]
    head=mesh('Soft sculpted face',vertices,faces,'Skin • warm porcelain')
    head['design']='Rounded-square head and simple oval eyes, based on the supplied toy-scale reference.'
    for sign in (-1,1):
        eye_x=sign*.112
        ell('Black oval eye '+str(sign),(eye_x,-.279,1.198),(.037,.017,.076),'Eyes • obsidian',rotation=(0,sign*.015,sign*-.025))
        stroke('Quiet eyebrow '+str(sign),[(eye_x-.045,-.268,1.307),(eye_x,-.281,1.327),(eye_x+.047,-.267,1.318)],.010,'Brows • walnut',radii=[.45,1,.55])
        sweep('Pointed ear '+str(sign),[(sign*.32,.005,1.151),(sign*.365,-.005,1.173),(sign*.432,.0,1.229),(sign*.545,.012,1.291),(sign*.568,.015,1.303)],[.07,.084,.067,.016,.002],[.052,.063,.049,.012,.0015],'Skin • warm porcelain',sub=2)
        sweep('Peach ear hollow '+str(sign),[(sign*.363,-.047,1.166),(sign*.411,-.052,1.211),(sign*.491,-.017,1.26),(sign*.54,.001,1.289)],[.018,.045,.025,.001],[.006,.009,.005,.001],'Ear • soft peach',sub=2)
    ell('Soft button nose',(0,-.297,1.12),(.027,.023,.023),'Skin • warm porcelain')
    stroke('Small confident mouth',[(-.051,-.273,1.053),(0,-.278,1.039),(.051,-.273,1.053)],.004,'Brows • walnut',radii=[.45,1,.45])
    hair_crown()
    sweep('Hero swept fringe',[(.18,-.09,1.497),(.14,-.23,1.55),(-.04,-.318,1.489),(-.245,-.332,1.392),(-.35,-.286,1.31)],[.04,.114,.124,.094,.002],[.034,.07,.068,.045,.0015],'Hair • golden honey',sub=2)
    sweep('Parted right fringe',[(.17,-.10,1.493),(.272,-.18,1.47),(.31,-.23,1.369),(.282,-.245,1.279)],[.04,.083,.066,.002],[.037,.062,.044,.0015],'Hair • golden honey',sub=2)
    for sign in (-1,1):
        sweep('Golden temple lock '+str(sign),[(sign*.31,-.052,1.365),(sign*.338,-.112,1.25),(sign*.338,-.103,1.117),(sign*.421,-.099,1.012)],[.036,.071,.063,.002],[.031,.049,.038,.0015],'Hair • golden honey',sub=2)
    # Soft, folded pointed cap follows the back of the skull and has a real tip.
    adventure_cap()
    print('Head and hat ready:',len(character.objects),'pieces')


def equipment_and_studio():
    # Curved, layered shield with an original compass rose instead of a traced logo.
    boundary=[(-.176,.197),(-.122,.24),(.122,.24),(.176,.197),(.158,-.07),(.09,-.192),(0,-.247),(-.09,-.192),(-.158,-.07)]
    center=Vector((-.346,-.276,.665))
    def shield_panel(name,scale,y,mat):
        vs=[center+Vector((0,y-.038,0))]
        vs += [center+Vector((x*scale,y,z*scale)) for x,z in boundary]
        faces=[(0,(i+1)%len(boundary)+1,i+1) for i in range(len(boundary))]
        obj=mesh(name,vs,faces,mat,2)
        solid=obj.modifiers.new('Substantial shield thickness','SOLIDIFY');solid.thickness=.024
        return obj
    shield_panel('Shield • silver rim',1,0,'Steel • pale silver')
    shield_panel('Shield • blue enamel inset',.84,-.019,'Shield • enamel blue')
    stroke('Shield raised silver edge',[center+Vector((x*.97,-.006,z*.97)) for x,z in boundary],.010,'Steel • pale silver',True)
    for x,z in [(-.122,.184),(.122,.184),(-.09,-.107),(.09,-.107)]:
        ell('Shield rivet',center+Vector((x,-.045,z)),(.012,.009,.012),'Steel • pale silver')
    # Compass badge lies on the curved centre of the shield.
    badge_center=center+Vector((0,-.074,.014))
    stroke('Compass badge rim',[badge_center+Vector((.070*math.cos(a),0,.070*math.sin(a))) for a in [i*math.tau/40 for i in range(40)]],.0035,'Brass • satin gold',True)
    points=[(0,.096),(.023,.025),(.067,0),(.023,-.023),(0,-.081),(-.023,-.023),(-.067,0),(-.023,.025)]
    emblem=mesh('Original compass star',[badge_center+Vector((0,-.008,0))]+[badge_center+Vector((x,0,z)) for x,z in points],[(0,(i+1)%8+1,i+1) for i in range(8)],'Brass • satin gold')
    emblem.modifiers.new('Raised compass metal','SOLIDIFY').thickness=.009
    ell('Compass centre',badge_center+Vector((0,-.014,0)),(.016,.010,.016),'Brass • satin gold')
    # Compact fantasy blade held outwards, faceted but with softened edges.
    hand=Vector((.404,-.102,.818));direction=Vector((.81,.045,.586)).normalized()
    side=Vector((-direction.z,0,direction.x));normal=Vector((0,-1,0))
    def point(length,width=0,depth=0): return hand+direction*length+side*width+normal*depth
    limb('Sword wrapped grip',point(-.044),point(.071),.026,.026,'Belt • cocoa leather')
    ell('Sword rounded pommel',point(-.063),(.037,.032,.034),'Brass • satin gold')
    stroke('Sword hand guard',[point(.084,-.107),point(.098,-.075),point(.108,0),point(.098,.075),point(.084,.107)],.017,'Brass • satin gold')
    blade_vertices=[point(.115,-.038),point(.115,0,.019),point(.115,.038),point(.115,0,-.015),point(.448,-.045),point(.448,0,.022),point(.448,.045),point(.448,0,-.016),point(.58,0)]
    blade_faces=[(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0),(4,8,5),(5,8,6),(6,8,7),(7,8,4),(0,1,2,3)]
    blade=mesh('Sword • four polished facets',blade_vertices,blade_faces,'Steel • pale silver')
    blade.data.materials.append(materials['Steel • blue facet'])
    for i,polygon in enumerate(blade.data.polygons):
        polygon.use_smooth=False
        polygon.material_index=i%2
    bevel=blade.modifiers.new('Blade softened edge','BEVEL');bevel.width=.003;bevel.segments=2
    blade.modifiers.new('Weighted blade normals','WEIGHTED_NORMAL')
    for k in range(3):
        for sign in (-1,1):
            ell('Knuckle crease '+str(k),(.388+k*.015,-.153,.8+sign*.012),(.009,.003,.004),'Skin • warm porcelain')

    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
    scene.render.resolution_x=1200;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.15
    world=bpy.data.worlds.new('Bright neutral daylight')
    world.use_nodes=True;scene.world=world
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.8,.87,1,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    def area(name,position,energy,color,size):
        bpy.ops.object.light_add(type='AREA',location=position)
        obj=bpy.context.object;obj.name=name;obj.data.energy=energy;obj.data.color=rgb(color);obj.data.shape='DISK';obj.data.size=size
        obj.rotation_euler=(Vector((0,0,.95))-obj.location).to_track_quat('-Z','Y').to_euler()
    area('Key • oversized softbox',(-2.5,-3.5,4),320,'#FFF0D6',3.8)
    area('Fill • clear front',(2.4,-3,2.4),180,'#EEF7FF',3.1)
    area('Rim • morning sun',(1.4,2.3,3.1),330,'#FFF6DA',2.5)
    bpy.ops.object.camera_add(location=(2.6,-6.3,2.5))
    camera=bpy.context.object;camera.name='Mini hero • three-quarter portrait';camera.data.type='ORTHO';camera.data.ortho_scale=1.96
    camera.rotation_euler=(Vector((.085,.005,.845))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    scene.render.filepath=str(OUT/'sunlit-portrait.png')
    print('Equipment and daylight studio ready.')


def merge_boots():
    """Fuse each boot into a single smooth volume, with an integrated dark sole."""
    for sign in (-1,1):
        if any(obj.name == 'Crafted boot '+str(sign) for obj in character.objects):
            continue
        objects=[obj for obj in character.objects if obj.name in ['Soft boot sole '+str(sign),'Rounded boot vamp '+str(sign),'Boot ankle '+str(sign)]]
        if len(objects)!=3:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=next(obj for obj in objects if obj.name.startswith('Rounded boot vamp'))
        bpy.ops.object.join()
        obj=bpy.context.object
        obj.name='Crafted boot '+str(sign)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        remesh=obj.modifiers.new('Continuous sculpted boot','REMESH')
        remesh.mode='VOXEL';remesh.voxel_size=.005;remesh.use_smooth_shade=True
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        smooth=obj.modifiers.new('Gentle boot surface polish','SMOOTH');smooth.factor=.65;smooth.iterations=3
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        obj.data.materials.clear()
        obj.data.materials.append(materials['Boots • chestnut'])
        obj.data.materials.append(materials['Outsole • warm umber'])
        for polygon in obj.data.polygons:
            polygon.use_smooth=True
            polygon.material_index=1 if polygon.center.z < .042 else 0


def refine_proportions():
    """User refinement: longer legs, smaller head/ears, slimmer boots, satin skin."""
    head_names = ('Soft sculpted face', 'Black oval eye', 'Quiet eyebrow', 'Pointed ear',
                  'Peach ear hollow', 'Soft button nose', 'Small confident mouth',
                  'Golden hair crown', 'Hero swept fringe', 'Parted right fringe',
                  'Golden temple lock', 'Bent green adventure cap')
    boot_names = ('Crafted boot', 'Soft boot sole', 'Rounded boot vamp', 'Boot ankle', 'Turned boot cuff', 'Subtle boot seam')
    for obj in character.objects:
        if obj.type != 'MESH' or obj.get('longer_leg_revision'):
            continue
        is_head = obj.name.startswith(head_names)
        is_boot = obj.name.startswith(boot_names)
        is_leg = obj.name.startswith('Linen knee')
        is_ear = obj.name.startswith(('Pointed ear', 'Peach ear hollow'))
        matrix = obj.matrix_world.copy()
        foot_sign = -1 if sum((matrix @ Vector(c)).x for c in obj.bound_box) < 0 else 1
        foot_x = foot_sign*.135
        foot_y = -.05 if foot_sign < 0 else .035
        for vertex in obj.data.vertices:
            co = matrix @ vertex.co
            if is_head:
                if is_ear:
                    root_x = -.33 if co.x < 0 else .33
                    co.x = root_x + (co.x-root_x)*.76
                pivot = Vector((0,0,1.193))
                co = pivot+(co-pivot)*.89
            if is_boot:
                co.x = foot_x+(co.x-foot_x)*.88
                co.y = foot_y+(co.y-foot_y)*.9
            if is_leg:
                taper=.68+.32*min(1,max(0,(co.z-.28)/.14))
                co.x=foot_x+(co.x-foot_x)*taper
                co.y=foot_y+(co.y-foot_y)*taper
                if co.z > .32:
                    co.z += .18*min(1,(co.z-.32)/.16)
            elif not is_boot:
                co.z += .18
            vertex.co = co
        obj.matrix_world = Matrix.Identity(4)
        obj.data.update()
        obj['longer_leg_revision'] = True
    for name, roughness, coat in [('Skin • warm porcelain',.50,.08),('Hair • golden honey',.38,.20),('Boots • chestnut',.48,.10)]:
        shader=materials[name].node_tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value=roughness
        shader.inputs['Coat Weight'].default_value=coat
    scene=bpy.context.scene
    scene.camera.rotation_euler=(Vector((.085,.005,.88))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene['silhouette_revision']='Longer legs +0.18, head 89%, ear reach 76%, boots slimmer, satin materials'


def export():
    scene=bpy.context.scene
    bpy.ops.object.select_all(action='DESELECT')
    for obj in character.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=next(iter(character.objects))
    bpy.ops.object.convert(target='MESH')
    merge_boots()
    refine_proportions()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in character.objects: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'sunlit-adventurer.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'sunlit-adventurer.blend'))
    for area in (bpy.context.screen.areas if bpy.context.screen else []):
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.overlay.show_overlays=False
    def render_later():
        bpy.ops.render.render(write_still=True)
        return None
    if bpy.app.background:
        bpy.ops.render.render(write_still=True)
    else:
        bpy.app.timers.register(render_later,first_interval=1)
    print('GLB and editable Blender file saved. Portrait rendering requested.')


if __name__ == '__main__':
    build_body()
    build_head()
    equipment_and_studio()
    export()
