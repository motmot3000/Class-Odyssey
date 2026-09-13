"""Modular Noa/Mila dressing-room prototype built on the credited source body.

Requires neutral_link.prepare_imports(), make_shirt(), pose(True), studio().
All visible meshes carry wardrobe_slot / wardrobe_variant extras for WebGL.
Hair, vest, jacket details and accessories are authored for this local study.
"""
import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector, Matrix
import neutral_link as neutral

OUT=neutral.ROOT/'assets'/'wardrobe'
collection=None
materials={}


def tag(obj,slot,value):
    obj['wardrobe_slot']=slot;obj['wardrobe_variant']=value
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def mat(name,color,rough=.8,metal=0):
    m=neutral.material(name,color=color,roughness=rough)
    m.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=metal
    materials[name]=m
    return m


def mesh(name,vertices,faces,material,slot,value,sub=0):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);collection.objects.link(obj);obj.data.materials.append(material)
    for p in data.polygons:p.use_smooth=True
    if sub:
        modifier=obj.modifiers.new('Soft sculpted surface','SUBSURF');modifier.levels=modifier.render_levels=sub
    return tag(obj,slot,value)


def box(name,loc,size,material,slot,value,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    obj=bpy.context.object;obj.name=name;obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(material)
    modifier=obj.modifiers.new('Soft crafted edges','BEVEL');modifier.width=bevel;modifier.segments=3
    obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return tag(obj,slot,value)


def ell(name,loc,size,material,slot,value):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=loc)
    obj=bpy.context.object;obj.name=name;obj.scale=size;obj.data.materials.append(material)
    for p in obj.data.polygons:p.use_smooth=True
    return tag(obj,slot,value)


def line(name,points,radius,material,slot,value,cyclic=False):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=12;data.bevel_depth=radius;data.bevel_resolution=3
    spline=data.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for point,co in zip(spline.bezier_points,points):point.co=co;point.handle_left_type=point.handle_right_type='AUTO'
    spline.use_cyclic_u=cyclic
    obj=bpy.data.objects.new(name,data);collection.objects.link(obj);obj.data.materials.append(material)
    return tag(obj,slot,value)


def lock(name,points,widths,depths,material,value):
    pts=[Vector(p) for p in points];vertices=[];count=16
    for j,p in enumerate(pts):
        tangent=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized()
        side=tangent.cross(Vector((0,-1,0))).normalized();depth=tangent.cross(side).normalized()
        for i in range(count):
            a=i*math.tau/count
            vertices.append(p+side*math.cos(a)*widths[j]+depth*math.sin(a)*depths[j])
    faces=[tuple(reversed(range(count)))]
    faces +=[(j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i) for j in range(len(pts)-1) for i in range(count)]
    faces.append(tuple((len(pts)-1)*count+i for i in range(count)))
    return mesh(name,vertices,faces,material,'gender',value,2)


def bob_back(hairmat):
    rows=[(1.679,.100,.111),(1.61,.117,.141),(1.53,.127,.142),(1.455,.123,.131),(1.40,.109,.112),(1.385,.090,.095)]
    vertices=[];n=25
    for j,(z,rx,ry) in enumerate(rows):
        for i in range(n):
            a=i*math.pi/(n-1)
            wave=.0015*math.sin(a*6)*j/(len(rows)-1)
            vertices.append(((rx+wave)*math.cos(a),.004+(ry+wave)*math.sin(a),z+.006*math.cos(a*2)*j/(len(rows)-1)))
    obj=mesh('Mila • smooth bob back',vertices,[(j*n+i,(j+1)*n+i,(j+1)*n+i+1,j*n+i+1) for j in range(len(rows)-1) for i in range(n-1)],hairmat,'gender','female',2)
    solid=obj.modifiers.new('Hair shell thickness','SOLIDIFY');solid.thickness=.010
    return obj


def characters():
    global collection
    scene=bpy.context.scene;scene.name='ClassQuest • Noa & Mila wardrobe'
    OUT.mkdir(parents=True,exist_ok=True)
    collection=bpy.data.collections.new('Wardrobe • tagged modular pieces');scene.collection.children.link(collection)
    for obj in list(neutral.character.objects):
        if obj.name in ['Hair_1__Mt_Hair','Hairband__Mt_Hairband']:
            bpy.data.objects.remove(obj,do_unlink=True)
        elif obj.type=='ARMATURE':
            tag(obj,'core','all')
        elif obj.name.startswith(('Face__','Eye_','Eyelashes__')):
            tag(obj,'gender','male')
        elif obj.name.startswith('Plain shirt'):
            tag(obj,'outfit','base')
        else:
            tag(obj,'core','all')
    heads=[obj for obj in collection.objects if obj.get('wardrobe_slot')=='gender']
    for original in heads:
        female=original.copy();female.data=original.data.copy();female.name='Mila • '+original.name;collection.objects.link(female);tag(female,'gender','female')
        for obj,gender in [(original,'male'),(female,'female')]:
            matrix=obj.matrix_world.copy();inverse=matrix.inverted()
            for vertex in obj.data.vertices:
                co=matrix @ vertex.co
                if abs(co.x)>.105 and co.z<1.66:
                    sign=1 if co.x>0 else -1
                    co.x=sign*(.105+(abs(co.x)-.105)*.55)
                co.x*=1.04 if gender=='male' else .98
                if co.z<1.56:
                    co.z+=(.010 if gender=='male' else .012)*max(0,min(1,(1.56-co.z)/.10))
                vertex.co=inverse @ co
            obj.data.update()
            if obj.name.startswith('Eye_') or 'Eye_' in obj.name:
                side='left' if 'Eye_L' in obj.name else 'right'
                persona='noa' if gender=='male' else 'mila'
                obj.data.materials.clear();obj.data.materials.append(neutral.material(persona+' • '+side+' iris',texture='eye-'+side+'-'+persona,roughness=.42))
            elif obj.name.startswith('Face__') or 'Face__' in obj.name:
                persona='noa' if gender=='male' else 'mila'
                obj.data.materials.clear();obj.data.materials.append(neutral.material(persona+' • facial palette',texture='head-'+persona,roughness=.82))
    brown=mat('Noa • chestnut hair','#594432',.72)
    auburn=mat('Mila • warm auburn hair','#734938',.73)
    for gender,hairmat in [('male',brown),('female',auburn)]:
        neckmat=materials.get('Face • soft neck transition') or mat('Face • soft neck transition','#BB916F',.86)
        ell(gender+' • jaw to neck transition',(0,-.043,1.49),(.063 if gender=='male' else .059,.050,.026),neckmat,'gender',gender)
        vertices=[];n=48;rows=13
        for j in range(rows):
            t=j/(rows-1)
            for i in range(n):
                a=i*math.tau/n
                end=1.64+(.49 if gender=='male' else .67)*math.sin(a)
                theta=.005+(end-.005)*t
                vertices.append((.111*math.sin(theta)*math.cos(a),-.019+.146*math.sin(theta)*math.sin(a),1.63+.138*math.cos(theta)))
        mesh(gender+' • fitted hair crown',vertices,[(j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n) for j in range(rows-1) for i in range(n)],hairmat,'gender',gender,1)
        if gender=='male':
            for i in range(6):
                u=i/5
                lock('Noa • swept lock '+str(i),[(.059-u*.012,-.013,1.743),(.025-u*.025,-.100,1.754),(-.025-u*.044,-.143,1.690),(-.077-u*.015,-.126,1.635+u*.012)],[.01,.024,.025,.001],[.008,.014,.015,.001],hairmat,gender)
            for sign in (-1,1):
                lock('Noa • short temple '+str(sign),[(sign*.094,-.044,1.678),(sign*.105,-.083,1.615),(sign*.089,-.096,1.565)],[.021,.026,.001],[.014,.013,.001],hairmat,gender)
        else:
            for sign in (-1,1):
                lock('Mila • cheek framing lock '+str(sign),[(sign*.069,-.017,1.743),(sign*.096,-.102,1.694),(sign*.113,-.112,1.567),(sign*.116,-.047,1.458),(sign*.094,-.022,1.414)],[.015,.034,.029,.023,.001],[.013,.018,.018,.015,.001],hairmat,gender)
            bob_back(hairmat)
            for i in range(4):
                u=i/3
                lock('Mila • parted fringe '+str(i),[(.027-u*.026,-.02,1.754),(-.010-u*.037,-.118,1.733),(-.065-u*.02,-.144,1.643+u*.016)],[.013,.027,.001],[.009,.014,.001],hairmat,gender)
    print('Distinct faces and authored hairstyles ready.')


def outfits():
    basic=next(o for o in collection.objects if o.name.startswith('Plain shirt'))
    basic.data.materials[0].name='Dye • Base cotton'
    cream=mat('Explorer • cream undershirt','#D2CDBC',.92)
    teal=mat('Explorer • teal woven vest','#296C67',.88)
    trim=mat('Tailoring • flax thread','#BBAA7B',.88)
    leather=mat('Equipment • tobacco leather','#796044',.8)
    dark=mat('Equipment • dark seam','#4E4433',.84)
    brass=mat('Equipment • brushed brass','#B39962',.44,.55)
    rust=mat('Traveller • clay jacket','#8B6952',.88)
    coral=mat('Traveller • rust scarf','#B7795E',.93)
    for value,material in [('explorer',cream),('traveller',rust)]:
        obj=basic.copy();obj.data=basic.data.copy();obj.name=value+' • shirt layer';collection.objects.link(obj);obj.data.materials.clear();obj.data.materials.append(material);tag(obj,'outfit',value)
    # The open waistcoat is a separate volume, not a recolor of the base shirt.
    rows=[(.925,.211,.143),(1.00,.193,.138),(1.10,.164,.116),(1.20,.172,.122),(1.30,.198,.140),(1.37,.226,.13),(1.395,.21,.108)]
    vertices=[];n=40
    for j,(z,rx,ry) in enumerate(rows):
        for i in range(n):
            a=-math.pi/2+.22+(math.tau-.44)*i/(n-1)
            height=z-(.065*max(0,-math.sin(a)) if j==len(rows)-1 else 0)
            vertices.append((rx*math.cos(a),ry*math.sin(a),height))
    vest=mesh('Explorer • open waistcoat',vertices,[(j*n+i,j*n+i+1,(j+1)*n+i+1,(j+1)*n+i) for j in range(len(rows)-1) for i in range(n-1)],teal,'outfit','explorer',2)
    fit=vest.modifiers.new('Fit waistcoat over cotton','SHRINKWRAP');fit.target=basic;fit.wrap_method='NEAREST_SURFACEPOINT';fit.offset=.012
    thick=vest.modifiers.new('Woven vest thickness','SOLIDIFY');thick.thickness=.006
    for index in (0,n-1):line('Explorer • bound opening',[vertices[j*n+index] for j in range(len(rows))],.0024,trim,'outfit','explorer')
    line('Explorer • bound hem',vertices[:n],.0024,trim,'outfit','explorer')
    # Jacket details follow the evaluated front surface of the posed shirt.
    depsgraph=bpy.context.evaluated_depsgraph_get();evaluated=basic.evaluated_get(depsgraph);inverse=basic.matrix_world.inverted()
    def front(x,z):
        hit,point,normal,index=evaluated.ray_cast(inverse @ Vector((x,-1,z)),inverse.to_3x3() @ Vector((0,1,0)))
        return (basic.matrix_world @ point).y-.005 if hit else -.12
    for sign in (-1,1):
        x=sign*.095;z=1.075;y=front(x,z)-.009
        pocket=box('Traveller • patch pocket '+str(sign),(x,y,z),(.074,.014,.091),leather,'outfit','traveller',.011)
        pocket.rotation_euler.z=sign*.12
        flap=box('Traveller • pocket flap '+str(sign),(x,y-.009,z+.030),(.078,.009,.029),rust,'outfit','traveller',.008)
        flap.rotation_euler.z=sign*.12
        ell('Traveller • pocket stud '+str(sign),(x,y-.017,z+.028),(.004,.002,.004),brass,'outfit','traveller')
    line('Traveller • front placket',[(0,front(0,z)-.006,z) for z in [.954,1.04,1.15,1.25,1.34,1.407]],.003,dark,'outfit','traveller')
    for z in [1.00,1.12,1.24,1.36]:ell('Traveller • simple button',(0,front(0,z)-.011,z),(.0045,.0025,.0045),brass,'outfit','traveller')
    line('Traveller • soft neckerchief',[(.059*math.cos(a),-.02+.063*math.sin(a),1.426) for a in [i*math.tau/28 for i in range(28)]],.010,coral,'outfit','traveller',True)
    ell('Traveller • scarf knot',(-.04,-.082,1.412),(.015,.011,.014),coral,'outfit','traveller')
    tail=ell('Traveller • short scarf end',(-.046,-.085,1.367),(.019,.006,.039),coral,'outfit','traveller');tail.rotation_euler.y=-.14
    print('Three real garment combinations ready.')


def accessories():
    leather=materials['Equipment • tobacco leather'];dark=materials['Equipment • dark seam'];brass=materials['Equipment • brushed brass']
    cream=materials['Tailoring • flax thread']
    for value in ['satchel','lantern']:
        line(value+' • waist strap',[(.212*math.cos(a),.145*math.sin(a),.943) for a in [i*math.tau/40 for i in range(40)]],.011,leather,'item',value,True)
    box('Satchel • body',(.226,-.015,.857),(.121,.094,.14),leather,'item','satchel',.02)
    box('Satchel • overlapping flap',(.226,-.066,.893),(.127,.013,.078),dark,'item','satchel',.016)
    line('Satchel • belt loop',[(.208,-.012,.915),(.20,-.031,.957),(.243,-.03,.957),(.246,-.013,.92)],.008,leather,'item','satchel')
    ell('Satchel • clasp',(.226,-.077,.88),(.008,.004,.008),brass,'item','satchel')
    line('Satchel • seam',[(.176,-.077,.91),(.177,-.078,.869),(.225,-.081,.857),(.277,-.078,.869),(.276,-.077,.91)],.0014,cream,'item','satchel')
    x=-.235;y=-.018
    line('Lantern • belt hook',[(x-.025,y,.879),(x-.027,y,.936),(x+.024,y,.936),(x+.025,y,.879)],.005,brass,'item','lantern')
    glass=mat('Lantern • honey glass','#EFC06A',.3)
    shader=glass.node_tree.nodes.get('Principled BSDF');shader.inputs['Emission Color'].default_value=(*neutral.linear('#E5A64C'),1);shader.inputs['Emission Strength'].default_value=.7
    box('Lantern • warm core',(x,y,.797),(.065,.063,.110),glass,'item','lantern',.009)
    box('Lantern • top',(x,y,.861),(.094,.086,.018),brass,'item','lantern',.008)
    box('Lantern • base',(x,y,.732),(.094,.086,.018),brass,'item','lantern',.008)
    ell('Lantern • finial',(x,y,.88),(.020,.018,.016),brass,'item','lantern')
    for dx in [-.037,.037]:
        for dy in [-.034,.034]:line('Lantern • corner post',[(x+dx,y+dy,.743),(x+dx,y+dy,.85)],.003,brass,'item','lantern')
    box('Backpack • canvas body',(0,.196,1.17),(.244,.139,.285),leather,'pack','on',.027)
    box('Backpack • curved flap',(0,.273,1.235),(.244,.018,.118),dark,'pack','on',.022)
    box('Backpack • front pocket',(0,.273,1.08),(.15,.036,.077),leather,'pack','on',.012)
    line('Backpack • hanging loop',[(-.045,.17,1.312),(-.045,.17,1.37),(.045,.17,1.37),(.045,.17,1.312)],.010,leather,'pack','on')
    for sign in [-1,1]:
        line('Backpack • shoulder strap '+str(sign),[(sign*.083,.188,1.305),(sign*.135,.061,1.397),(sign*.132,-.08,1.374),(sign*.146,-.13,1.25),(sign*.145,-.113,1.105),(sign*.089,.179,1.05)],.010,leather,'pack','on')
        ell('Backpack • flap stud '+str(sign),(sign*.062,.287,1.208),(.006,.004,.006),brass,'pack','on')
    print('Independent satchel, lantern and backpack groups ready.')


def set_look(gender='male',outfit='base',item='none',pack=False):
    state={'gender':gender,'outfit':outfit,'item':item,'pack':'on' if pack else 'off','core':'all'}
    for obj in collection.objects:
        visible=obj.type=='ARMATURE' or state.get(obj.get('wardrobe_slot'))==obj.get('wardrobe_variant')
        obj.hide_render=not visible
        obj.hide_set(not visible)


def fit_layers():
    basic=next(obj for obj in collection.objects if obj.name.startswith('Plain shirt'))
    helper=bpy.data.objects.get('Wardrobe • outer cotton fit surface')
    if not helper:
        helper=basic.copy();helper.data=basic.data.copy();helper.name='Wardrobe • outer cotton fit surface'
        bpy.context.scene.collection.objects.link(helper)
        for modifier in list(helper.modifiers):
            if modifier.type=='SOLIDIFY':helper.modifiers.remove(modifier)
        helper.hide_render=True;helper.hide_set(True)
    vest=next(obj for obj in collection.objects if obj.name=='Explorer • open waistcoat')
    if not vest.modifiers.get('Fit waistcoat over cotton'):
        fit=vest.modifiers.new('Fit waistcoat over cotton','SHRINKWRAP');fit.target=basic;fit.wrap_method='NEAREST_SURFACEPOINT';fit.offset=.012
        bpy.context.view_layer.objects.active=vest
        bpy.ops.object.modifier_move_up(modifier=fit.name)
    fit=vest.modifiers['Fit waistcoat over cotton'];fit.target=helper;fit.wrap_mode='ABOVE_SURFACE';fit.offset=.014
    for obj in collection.objects:
        target=None;offset=.019
        if obj.name.startswith('Explorer • bound'):target=helper
        elif obj.name.startswith('Backpack • shoulder strap') or obj.name.endswith(' • waist strap'):target=helper;offset=.024
        if target:
            fit=obj.modifiers.get('Follow garment surface') or obj.modifiers.new('Follow garment surface','SHRINKWRAP')
            fit.target=target;fit.wrap_method='NEAREST_SURFACEPOINT';fit.wrap_mode='ABOVE_SURFACE';fit.offset=offset


def export():
    scene=bpy.context.scene
    for obj in collection.objects:obj.hide_set(False);obj.hide_render=False
    neutral.pose(True)
    curves=[obj for obj in collection.objects if obj.type=='CURVE']
    if curves:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in curves:obj.select_set(True)
        bpy.context.view_layer.objects.active=curves[0]
        bpy.ops.object.convert(target='MESH')
    fit_layers()
    # Bake evaluated meshes into the relaxed pose for the web demo. Keep the
    # editable source skeleton in the .blend instead of exporting a rest-pose rig.
    temporary=bpy.data.collections.new('Temporary wardrobe web export')
    scene.collection.children.link(temporary)
    depsgraph=bpy.context.evaluated_depsgraph_get()
    clones=[]
    for obj in collection.objects:
        if obj.type!='MESH': continue
        data=bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph),preserve_all_data_layers=True,depsgraph=depsgraph)
        clone=bpy.data.objects.new(obj.name+' • web',data);temporary.objects.link(clone);clone.matrix_world=obj.matrix_world.copy()
        for key in obj.keys():clone[key]=obj[key]
        clones.append(clone)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in clones:obj.select_set(True)
    bpy.context.view_layer.objects.active=clones[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/'wardrobe.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_extras=True)
    for obj in clones:
        data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
        if not data.users:bpy.data.meshes.remove(data)
    bpy.data.collections.remove(temporary)
    set_look()
    bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'wardrobe.blend'))
    scene.render.resolution_x=1100;scene.render.resolution_y=1400
    scene.render.filepath=str(OUT/'noa-portrait.png')
    def render():
        set_look('male');scene.render.filepath=str(OUT/'noa-portrait.png');bpy.ops.render.render(write_still=True)
        set_look('female');scene.render.filepath=str(OUT/'mila-portrait.png');bpy.ops.render.render(write_still=True)
        set_look('male');scene.render.filepath=str(OUT/'noa-portrait.png')
        return None
    bpy.app.timers.register(render,first_interval=1)
    print('Modular GLB and packed scene saved. Two portraits queued.')
