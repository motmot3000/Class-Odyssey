"""Neutral Link study assembled in Blender from the sources credited on Sketchfab.

Source geometry: Nintendo / The Models Resource, uploaded by Trikeboy.
The first user-supplied Sketchfab listing credits these exact body/hair sources.
This script operates on the imported source scene; it adds a plain fitted shirt,
repairs the materials, preserves the source skeleton and exports two poses.
"""
import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'neutral-hero'
character = None
rig = None


def linear(hex_color):
    values = [int(hex_color[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in values)


def material(name, texture=None, color=None, roughness=.8):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Specular IOR Level'].default_value=.25
    if color:
        shader.inputs['Base Color'].default_value=(*linear(color),1)
        mat.diffuse_color=(*linear(color),1)
    if texture:
        image=bpy.data.images.load(str(OUT/'textures'/(texture+'.png')),check_existing=True)
        node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
        mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
        if texture=='eyelashes':
            mat.node_tree.links.new(node.outputs['Alpha'],shader.inputs['Alpha'])
            mat.surface_render_method='DITHERED'
    return mat


def prepare_imports():
    global character, rig
    scene=bpy.context.scene
    scene.name='Link • neutral base study'
    character=bpy.data.collections.new('Neutral Link • source geometry and plain clothing')
    scene.collection.children.link(character)
    rig=next(o for o in scene.objects if o.type=='ARMATURE' and o.name=='Armature')
    keep=('Face__Mt_Face','Face__Mt_Head','Eyelashes__Mt_Eyelashes','Eye_L__Mt_Eyeball_L','Eye_R__Mt_Eyeball_R','Skin__Mt_Upper_Skin','Hairband__Mt_Hairband','Hair_1__Mt_Hair','Lower_Skin_043__Mt_Lower_Skin','Pant_043__Mt_Lower_043')
    for obj in list(scene.objects):
        if obj.type=='MESH' and obj.name not in keep:
            bpy.data.objects.remove(obj,do_unlink=True)
    for obj in list(scene.objects):
        if obj.type not in {'MESH','ARMATURE'}:
            continue
        if obj.type=='ARMATURE' and obj!=rig:
            continue
        if obj.type=='MESH':
            matrix=obj.matrix_world.copy()
            obj.parent=rig;obj.matrix_world=matrix
            for modifier in obj.modifiers:
                if modifier.type=='ARMATURE': modifier.object=rig
            for polygon in obj.data.polygons: polygon.use_smooth=True
        for collection in list(obj.users_collection): collection.objects.unlink(obj)
        character.objects.link(obj)
    for obj in list(scene.objects):
        if obj.type=='ARMATURE' and obj!=rig:
            bpy.data.objects.remove(obj,do_unlink=True)
    mappings={
        'Face__Mt_Face':('head',.78), 'Face__Mt_Head':('head',.78),
        'Eyelashes__Mt_Eyelashes':('eyelashes',.85),
        'Eye_L__Mt_Eyeball_L':('eye-left',.3), 'Eye_R__Mt_Eyeball_R':('eye-right',.3),
        'Skin__Mt_Upper_Skin':('skin',.82), 'Hairband__Mt_Hairband':('hair',.8),
        'Hair_1__Mt_Hair':('hair',.8), 'Lower_Skin_043__Mt_Lower_Skin':('skin',.82),
        'Pant_043__Mt_Lower_043':('trousers',.9)}
    for name,(texture,roughness) in mappings.items():
        obj=bpy.data.objects[name]
        obj.data.materials.clear()
        obj.data.materials.append(material('Neutral • '+name,texture=texture,roughness=roughness))
        obj['source_credit']='Nintendo / The Models Resource — Trikeboy'
    rig['source_credit']='Nintendo / The Models Resource — Trikeboy'
    for path in [OUT/'neutral-reference.png',OUT/'reference-info.json']:
        path.unlink(missing_ok=True)
    print('Source geometry assembled:',len(character.objects),'objects;',len(rig.data.bones),'bones')


def make_shirt():
    body=bpy.data.objects['Skin__Mt_Upper_Skin']
    shirt=body.copy();shirt.data=body.data.copy();shirt.name='Plain shirt • neutral sage'
    character.objects.link(shirt)
    world=body.matrix_world.copy()
    bm=bmesh.new();bm.from_mesh(shirt.data);bm.transform(world)
    for point,normal in [((0,0,1.435),(0,0,1)),((.695,0,0),(1,0,0)),((-.695,0,0),(-1,0,0))]:
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=point,plane_no=normal,clear_outer=True,clear_inner=False,dist=.00001)
    bm.normal_update()
    for vertex in bm.verts:
        vertex.co+=vertex.normal*.008
        if abs(vertex.co.x)<.22 and vertex.co.z<1.30:
            vertex.co.x*=1.06
            vertex.co.y*=1.10
    bottom=[edge for edge in bm.edges if edge.is_boundary and all(v.co.z<.99 for v in edge.verts)]
    if bottom:
        result=bmesh.ops.extrude_edge_only(bm,edges=bottom)
        for vertex in result['geom']:
            if isinstance(vertex,bmesh.types.BMVert):
                vertex.co.z-=.055
                vertex.co.x*=1.035
                vertex.co.y*=1.035
    bm.normal_update();bm.transform(world.inverted());bm.to_mesh(shirt.data);bm.free()
    shirt.data.materials.clear();shirt.data.materials.append(material('Plain cotton • sage',color='#80998D',roughness=.92))
    for polygon in shirt.data.polygons: polygon.use_smooth=True
    sub=shirt.modifiers.new('Soft plain cotton silhouette','SUBSURF');sub.levels=sub.render_levels=1
    solid=shirt.modifiers.new('Cotton thickness','SOLIDIFY');solid.thickness=.003;solid.offset=0
    shirt['authored_for_test']='Plain neutral shirt derived from body geometry; no fantasy equipment'
    print('Plain shirt ready:',len(shirt.data.vertices),'vertices')


def pose(relaxed=True):
    for bone in rig.pose.bones:
        bone.rotation_mode='QUATERNION'
        bone.rotation_quaternion=Quaternion((1,0,0,0))
    bpy.context.view_layer.update()
    if relaxed:
        for name in ['Arm_1_L','Arm_1_R']:
            bone=rig.pose.bones.get(name)
            if not bone: continue
            head = rig.matrix_world @ bone.head
            axis = (rig.matrix_world.to_3x3() @ bone.matrix.to_3x3()).inverted() @ Vector((0,1,0))
            bone.rotation_quaternion=Quaternion(axis.normalized(),math.radians(52)*(1 if head.x>0 else -1))
        bpy.context.view_layer.update()


def studio():
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
    scene.render.resolution_x=1200;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.15
    world=bpy.data.worlds.new('Neutral character • daylight');world.use_nodes=True;scene.world=world
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.7,.8,1,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.40
    def area(name,loc,power,color,size):
        bpy.ops.object.light_add(type='AREA',location=loc)
        light=bpy.context.object;light.name=name;light.data.energy=power;light.data.color=linear(color);light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(Vector((0,0,1.1))-light.location).to_track_quat('-Z','Y').to_euler()
    area('Key • soft warm daylight',(-2.5,-4,3.8),290,'#FFF0DC',3.5)
    area('Fill • clear sky',(2.3,-3,2.3),190,'#EAF4FF',3)
    area('Rim • edge separation',(.7,2.5,3),280,'#EFF8FF',2.5)
    bpy.ops.object.camera_add(location=(1.2,-6,2.25))
    camera=bpy.context.object;camera.name='Neutral Link • portrait';camera.data.type='ORTHO';camera.data.ortho_scale=2.06
    camera.rotation_euler=(Vector((0,0,.89))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
    scene.render.filepath=str(OUT/'neutral-portrait.png')


def export():
    scene=bpy.context.scene
    bpy.ops.object.select_all(action='DESELECT')
    for obj in character.objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    pose(False)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'neutral-tpose.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False)
    pose(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'neutral-hero.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False)
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'neutral-hero.blend'))
    for area in (bpy.context.screen.areas if bpy.context.screen else []):
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL';area.spaces.active.overlay.show_overlays=False
    def render():
        bpy.ops.render.render(write_still=True)
        return None
    bpy.app.timers.register(render,first_interval=1)
    print('Neutral and T-pose GLBs, packed Blender scene saved; portrait queued.')
