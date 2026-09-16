"""Correct and export the two basic game characters from the wardrobe source.

blender --background assets/wardrobe/wardrobe.blend --python tools/blender/build_base_characters.py
The source file is not overwritten. Outputs live in assets/characters-base/.
"""
import bpy
import bmesh
import math
import json
import os
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector

ROOT=Path(__file__).resolve().parents[2]
TEXTURES=ROOT/'assets/characters-base/textures'
OUT=Path(os.environ.get('BASE_OUTPUT',str(ROOT/'assets/characters-base')))
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=bpy.context.scene
RIG=next(o for o in SOURCE.objects if o.type=='ARMATURE')
COLLECTION=next(c for c in SOURCE.collection.children if c.name.startswith('Wardrobe •'))
SKIN_COLORS=json.loads((TEXTURES/'skin-colors.json').read_text())
TONES=os.environ.get('BASE_TONES',','.join(SKIN_COLORS)).split(',')
C=Matrix(((1,0,0),(0,0,1),(0,-1,0)))
RESULT={'revision':'base-v2-2026-09','units':'metres','up':'+Y','forward':'+Z','quaternionOrder':'xyzw','origin':'ground between feet','originToleranceMetres':.0001,'sourceCredit':'Source morphology: Nintendo / The Models Resource — Trikeboy. Base-character adaptation, neck repair and hair: Class Odyssey study.','pose':{'armsFromT':82,'elbowFlexion':8,'fingerFlexion':10,'palms':'toward thighs'},'characters':{}}
SCENES={}


def srgb(v): return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
def color(hexvalue): return tuple(srgb(int(hexvalue[i:i+2],16)/255) for i in (1,3,5))


def material(name,hexvalue,rough=.7):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color(hexvalue),1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.25
    return m


def world_rotate(name,axis,angle):
    bone=RIG.pose.bones.get(name)
    if not bone:return
    frame=RIG.matrix_world.to_3x3() @ bone.matrix.to_3x3()
    local=frame.inverted() @ Vector(axis)
    bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(local.normalized(),angle)
    bpy.context.view_layer.update()


def natural_pose():
    for bone in RIG.pose.bones:
        bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion((1,0,0,0))
    bpy.context.view_layer.update()
    for suffix,sign in [('L',1),('R',-1)]:
        world_rotate('Arm_1_'+suffix,(0,1,0),math.radians(82)*sign)
        world_rotate('Arm_2_'+suffix,(1,0,0),math.radians(-8))
        # Relax the long fingers toward the palm, not a flat display hand.
        wrist=RIG.pose.bones['Wrist_'+suffix]
        finger=RIG.pose.bones['Finger_C_1_'+suffix]
        along=(RIG.matrix_world @ finger.head)-(RIG.matrix_world @ wrist.head)
        palm=Vector((-sign,0,0))
        axis=along.normalized().cross(palm).normalized()
        for letter in ['B','C','D','E']:
            for joint,amount in [('1',10),('2',9)]:
                world_rotate('Finger_'+letter+'_'+joint+'_'+suffix,axis,math.radians(amount))


def make_mesh(name,vertices,faces,mat,collection):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);collection.objects.link(obj);data.materials.append(mat)
    for polygon in data.polygons:polygon.use_smooth=True
    return obj


def neck_bridge(gender,collection,mat):
    # Match the ACTUAL open neck boundary. The old head morph moved these
    # points 7–12 mm away from the body, leaving the visible nape opening.
    body=bpy.data.objects['Skin__Mt_Upper_Skin']
    bm=bmesh.new();bm.from_mesh(body.data)
    points=[body.matrix_world @ v.co for v in bm.verts if v.is_boundary and (body.matrix_world @ v.co).z>1.44]
    bm.free();points.sort(key=lambda p:math.atan2(p.y+.012,p.x))
    scale=1.04 if gender=='boy' else .98;lift=.010 if gender=='boy' else .012
    target=[Vector((p.x*scale,p.y,p.z+lift*max(0,min(1,(1.56-p.z)/.10)))) for p in points]
    n=len(points);faces=[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]
    obj=make_mesh('Skin • continuous neck bridge',points+target,faces,mat,collection)
    obj['part']='skin';obj['neck_boundary_vertices']=n
    return obj


def curve_lock(name,points,widths,depths,mat,collection):
    pts=[Vector(p) for p in points];vertices=[];n=16
    for j,p in enumerate(pts):
        tangent=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized()
        side=tangent.cross(Vector((0,-1,0))).normalized();depth=tangent.cross(side).normalized()
        for i in range(n):
            a=i*math.tau/n;ridge=1+.06*math.cos(3*a)
            vertices.append(p+side*math.cos(a)*widths[j]+depth*math.sin(a)*depths[j]*ridge)
    faces=[tuple(reversed(range(n)))]
    faces.extend((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(pts)-1) for i in range(n))
    faces.append(tuple((len(pts)-1)*n+i for i in range(n)))
    obj=make_mesh(name,vertices,faces,mat,collection)
    mod=obj.modifiers.new('Sculpted locks','SUBSURF');mod.levels=mod.render_levels=2
    obj['part']='hair'
    return obj


def hair(gender,collection):
    mat=material('Hair • '+gender,'#493629' if gender=='boy' else '#6E4032',.58)
    style='short' if gender=='boy' else 'long'
    # A continuous fitted crown/nape: no disconnected side tubes or bald holes.
    rows=20;n=64;vertices=[]
    for j in range(rows):
        t=j/(rows-1)
        for i in range(n):
            a=i*math.tau/n;front=max(0,-math.sin(a))
            end=2.06-.88*front if gender=='boy' else 2.17-.98*front
            theta=.006+(end-.006)*t
            x=(.123 if gender=='boy' else .118)*math.sin(theta)*math.cos(a)
            y=-.015+.132*math.sin(theta)*math.sin(a)
            z=1.625+.139*math.cos(theta)
            if gender=='girl' and t>.70:
                z-=.085*((t-.70)/.30)*(1-front)
            vertices.append((x,y,z))
    cap=make_mesh('Hair • '+style+' • fitted crown',vertices,[(j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n) for j in range(rows-1) for i in range(n)],mat,collection)
    sub=cap.modifiers.new('Smooth crown','SUBSURF');sub.levels=sub.render_levels=1
    solid=cap.modifiers.new('Closed hair edge','SOLIDIFY');solid.thickness=.006
    cap['part']='hair'
    if gender=='boy':
        for i in range(5):
            u=i/4
            curve_lock('Hair • short • side sweep '+str(i),[(.052-u*.018,-.025,1.746),(.026-u*.036,-.100,1.747),(-.026-u*.034,-.143,1.687),(-.070-u*.013,-.126,1.639+u*.012)],[.009,.023,.022,.001],[.007,.011,.010,.001],mat,collection)
        for sign in [-1,1]:
            curve_lock('Hair • short • temple '+str(sign),[(sign*.081,-.047,1.677),(sign*.100,-.082,1.633),(sign*.092,-.095,1.581)],[.020,.018,.001],[.010,.009,.001],mat,collection)
    else:
        for sign in [-1,1]:
            for i in range(3):
                spread=i*.009
                curve_lock('Hair • long • face frame '+str(sign)+' '+str(i),[(sign*(.071+spread),-.027,1.717),(sign*(.103+spread),-.098+i*.013,1.636),(sign*(.111+spread),-.072+i*.018,1.536),(sign*(.099+spread),-.020+i*.02,1.469)],[.013,.019,.018,.001],[.009,.012,.010,.001],mat,collection)
        for i in range(4):
            u=i/3
            curve_lock('Hair • long • parted fringe '+str(i),[(.032-u*.02,-.018,1.746),(-.009-u*.028,-.115,1.726),(-.062-u*.017,-.139,1.656+u*.012)],[.01,.023,.001],[.006,.010,.001],mat,collection)
    for obj in collection.objects:
        if obj.get('part')=='hair':obj['hair_id']=style;obj['cosmetic_slot']='hair'


def configure_tone(objects,gender,tone):
    for obj in objects:
        if obj.type!='MESH':continue
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes:continue
            shader=mat.node_tree.nodes.get('Principled BSDF')
            if mat.get('skin_plain'):
                shader.inputs['Base Color'].default_value=tuple(srgb(c/255) for c in SKIN_COLORS[tone])+(1,)
            for node in mat.node_tree.nodes:
                if node.type!='TEX_IMAGE' or not node.image:continue
                key=mat.get('base_skin_map')
                if key:
                    path=TEXTURES/((('head-'+gender) if key=='head' else 'skin')+'-'+tone+'.png')
                    node.image=bpy.data.images.load(str(path),check_existing=True)


def anchor(position,y_axis=None,z_hint=None):
    p=C @ Vector(position)
    q=Quaternion((1,0,0,0))
    if y_axis is not None:
        y=(C @ Vector(y_axis)).normalized();hint=(C @ Vector(z_hint)).normalized()
        z=(hint-y*y.dot(hint)).normalized();x=y.cross(z).normalized()
        q=Matrix((x,y,z)).transposed().to_quaternion()
    transform={'position':[round(v,6) for v in p],'quaternion':[round(v,7) for v in (q.x,q.y,q.z,q.w)]}
    return {'local':transform,'world':dict(transform),'parent':'character-root'}


def anchors(gender,objects):
    headpoints=[];hairpoints=[]
    for obj in objects:
        if obj.type!='MESH':continue
        pts=[obj.matrix_world @ v.co for v in obj.data.vertices]
        if obj.get('part')=='hair':hairpoints.extend(pts)
        elif obj.get('part')=='skin':headpoints.extend(p for p in pts if p.z>1.51 and abs(p.x)<.115)
    center=Vector((0,-.015,1.636));top=max(p.z for p in headpoints)
    seat_z=1.676
    section=[p for p in headpoints if abs(p.z-seat_z)<.014]
    rx=max(abs(p.x) for p in section)+.006
    front=min(p.y for p in section)-.006;back=max(p.y for p in section)+.006;cy=(front+back)/2
    result={'skull_center':anchor(center),'skull_top':anchor((0,0,top)),'hair_top':anchor((0,0,max(p.z for p in hairpoints))),
            'hat_seat':{**anchor((0,cy,seat_z)),'ellipse':{'rx':round(rx,6),'rz':round((back-front)/2,6)},'planeNormal':[0,1,0]},
            'forehead':anchor((0,front,seat_z)),'temple_left':anchor((rx,cy,seat_z)),'temple_right':anchor((-rx,cy,seat_z)),
            'occiput':anchor((0,back,seat_z)),'neck':anchor((0,0,1.443)),'nape':anchor((0,.046,1.47)),
            'waist':anchor((0,0,.943)),'back':anchor((0,.135,1.19))}
    for suffix,side in [('L','left'),('R','right')]:
        def pos(name):return RIG.matrix_world @ RIG.pose.bones[name+'_'+suffix].head
        shoulder=pos('Arm_1');elbow=pos('Arm_2');wrist=pos('Wrist')
        knuckles=[pos('Finger_'+letter+'_1') for letter in ['B','C','D','E']]
        middle=sum(knuckles,Vector())/4;along=(middle-wrist).normalized()
        across=(knuckles[-1]-knuckles[0]).normalized();normal=across.cross(along).normalized()
        inward=Vector((-1 if suffix=='L' else 1,0,0))
        if normal.dot(inward)<0:normal=-normal
        result['shoulder_'+side]=anchor(shoulder,elbow-shoulder,(0,-1,0))
        result['elbow_'+side]=anchor(elbow,wrist-elbow,(0,-1,0))
        result['wrist_'+side]=anchor(wrist,along,normal)
        result['grip_'+side]=anchor(wrist.lerp(middle,.60),along,normal)
    return result


def build(gender):
    scene=bpy.data.scenes.new('Base character • '+gender)
    bpy.context.window.scene=scene
    collection=bpy.data.collections.new('Base • '+gender);scene.collection.children.link(collection)
    source_gender='male' if gender=='boy' else 'female'
    bpy.context.window.scene=SOURCE
    for obj in COLLECTION.objects:obj.hide_set(False)
    natural_pose();deps=bpy.context.evaluated_depsgraph_get()
    for obj in COLLECTION.objects:
        slot=obj.get('wardrobe_slot');variant=obj.get('wardrobe_variant')
        keep=slot=='core' or (slot=='gender' and variant==source_gender) or(slot=='outfit' and variant=='base')
        if not keep or obj.type!='MESH':continue
        if ('hair' in obj.name.lower() and 'Face__' not in obj.name) or any(s in obj.name for s in ['swept lock','short temple','parted fringe','cheek framing','bob back','neck transition']):continue
        data=bpy.data.meshes.new_from_object(obj.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
        clone=bpy.data.objects.new(gender+' • '+obj.name,data);collection.objects.link(clone);clone.matrix_world=obj.matrix_world.copy()
        for key in obj.keys():clone[key]=obj[key]
        clone['character_gender']=gender
        skin=('Face__' in obj.name or obj.name.startswith('Skin__') or obj.name.startswith('Lower_Skin'))
        clone['part']='skin' if skin else 'eyes' if ('Eye_' in obj.name or 'Eyelashes' in obj.name) else 'clothes'
        # COLLADA parts may use different UV-layer names. Joining them without
        # canonicalizing the render UV silently samples the wrong atlas layer.
        if data.uv_layers:
            uv=next((layer for layer in data.uv_layers if layer.active_render),data.uv_layers.active)
            values=[tuple(loop.uv) for loop in uv.data]
            for layer in list(data.uv_layers):data.uv_layers.remove(layer)
            uv=data.uv_layers.new(name='BaseUV');uv.active_render=True
            for loop,value in zip(uv.data,values):loop.uv=value
        for i,mat in enumerate(list(clone.data.materials)):
            if not mat:continue
            copy=mat.copy();clone.data.materials[i]=copy
            if skin:copy['base_skin_map']='head' if 'Face__' in obj.name else 'skin'
        # Static, canonical world coordinates for both the game and item fitting.
        matrix=clone.matrix_world.copy()
        data.transform(matrix)
        clone.matrix_world=Matrix.Identity(4);data.update()
    bpy.context.window.scene=scene
    skinmat=material(gender+' • skin bridge','#BB916F',.83);skinmat['skin_plain']=True
    bridge=neck_bridge(gender,collection,skinmat)
    # The bridge shares exact endpoints with the imported body/head boundaries.
    skin_objects=[o for o in collection.objects if o.get('part')=='skin']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in skin_objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=bridge;bpy.ops.object.join()
    bridge.name=gender+' • continuous skin';bridge['part']='skin'
    bridge['source_credit']=RESULT['sourceCredit']
    bm=bmesh.new();bm.from_mesh(bridge.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000005)
    bm.to_mesh(bridge.data);bm.free();bridge.data.update()
    hair(gender,collection)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in collection.objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=bridge;bpy.ops.object.convert(target='MESH')
    for obj in collection.objects:
        obj['character_gender']=gender;obj['base_revision']=RESULT['revision']
    configure_tone(collection.objects,gender,'medium')
    info={'defaultHairId':'short' if gender=='boy' else 'long','anchors':anchors(gender,list(collection.objects)),
          'axisConventions':{'head':'+Y up, +Z face forward','limbs':'+Y along limb away from torso, +Z anterior','hands':'+Y wrist to fingers, +Z palm normal, +X completing right-handed frame'},'variants':{}}
    # Light stage for portraits; the live game keeps its incumbent dark stage.
    scene.world=SOURCE.world.copy();scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.1
    for original in SOURCE.objects:
        if original.type=='LIGHT':clone=original.copy();clone.data=original.data.copy();scene.collection.objects.link(clone)
    bpy.ops.object.camera_add(location=(.8,-6,2.02));camera=bpy.context.object;camera.name='Base portrait '+gender;camera.data.type='ORTHO';camera.data.ortho_scale=1.95
    camera.rotation_euler=(Vector((0,0,.90))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
    for tone in TONES:
        configure_tone(collection.objects,gender,tone)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in collection.objects:obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUT/(gender+'-'+tone+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_extras=True)
        scene.render.resolution_x=512;scene.render.resolution_y=896;scene.render.resolution_percentage=100
        scene.render.filepath=str(OUT/(gender+'-'+tone+'.png'));bpy.ops.render.render(write_still=True)
        info['variants'][tone]={'model':gender+'-'+tone+'.glb','portrait':gender+'-'+tone+'.webp','portraitSmall':gender+'-'+tone+'-small.webp'}
    configure_tone(collection.objects,gender,'medium')
    # Inspect the repaired neck from the back without hair obscuring the seam.
    for obj in collection.objects:
        if obj.get('part')=='hair':obj.hide_render=True
    camera.location=(.45,4.5,1.9);camera.data.ortho_scale=.43
    camera.rotation_euler=(Vector((0,.0,1.51))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=640;scene.render.resolution_y=640
    scene.render.filepath=str(OUT/(gender+'-neck-check.png'));bpy.ops.render.render(write_still=True)
    for obj in collection.objects:obj.hide_render=False
    camera.location=(.8,-6,2.02);camera.data.ortho_scale=1.95
    camera.rotation_euler=(Vector((0,0,.90))-camera.location).to_track_quat('-Z','Y').to_euler()
    info['height']=round(max(v.co.z for obj in collection.objects for v in obj.data.vertices),6)
    info['triangles']=sum(len(p.vertices)-2 for obj in collection.objects for p in obj.data.polygons)
    RESULT['characters'][gender]=info;SCENES[gender]=scene


for gender in ['boy','girl']:build(gender)
(OUT/'manifest.json').write_text(json.dumps(RESULT,ensure_ascii=False,indent=2)+'\n')
bpy.ops.file.pack_all()
bpy.data.libraries.write(str(OUT/'base-characters.blend'),set(SCENES.values()),path_remap='RELATIVE',compress=True)
print('BASE_CHARACTERS_EXPORTED',json.dumps({g:{'height':v['height'],'triangles':v['triangles']} for g,v in RESULT['characters'].items()}))
