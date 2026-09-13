"""Surface-v3: a non-destructive PBR pass over the validated base-v2 geometry.

blender -b assets/characters-base/base-characters.blend --python-exit-code 1 \
  --python tools/blender/refine_character_surfaces.py
SURFACE_GENDERS=boy can be used for a first visual check.
"""
import bpy
import math
import hashlib
import json
import os
import struct
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/characters-refined'
TEX=OUT/'textures'
OUT.mkdir(parents=True,exist_ok=True);TEX.mkdir(exist_ok=True)
MANIFEST=json.loads((ROOT/'assets/characters-base/manifest.json').read_text())
MANIFEST['appearanceRevision']='surface-v3'
MANIFEST['geometryRevision']=MANIFEST['revision']
REPORT={}
SKIN_COLORS=json.loads((ROOT/'assets/characters-base/textures/skin-colors.json').read_text())

def plain_skin(shader,tone):
    def linear(value):
        value/=255
        return value/12.92 if value<.04045 else ((value+.055)/1.055)**2.4
    shader.inputs['Base Color'].default_value=tuple(linear(v) for v in SKIN_COLORS[tone])+(1,)


def fingerprint(objects,part=None):
    points=[]
    for obj in objects:
        if obj.type=='MESH' and (part is None or obj.get('part')==part):
            points.extend(tuple(round(v,7) for v in obj.matrix_world @ vertex.co) for vertex in obj.data.vertices)
    digest=hashlib.sha256()
    for point in sorted(points):digest.update(struct.pack('<3d',*point))
    return {'sha256':digest.hexdigest(),'vertices':len(points)}


def texture(mat,name,path,noncolor=False):
    node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.name=name
    node.image=bpy.data.images.load(str(path),check_existing=True)
    if noncolor:node.image.colorspace_settings.name='Non-Color'
    return node


def original_materials(objects,gender):
    for obj in objects:
        if obj.type!='MESH':continue
        part=obj.get('part')
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes:continue
            nodes=mat.node_tree.nodes;links=mat.node_tree.links
            shader=nodes.get('Principled BSDF')
            if not shader:continue
            shader.inputs['Coat Weight'].default_value=0
            if part=='skin':
                key=mat.get('base_skin_map')
                if key:
                    for node in list(nodes):
                        if node.type=='TEX_IMAGE' and node.image and any(link.to_socket==shader.inputs['Base Color'] for link in node.outputs['Color'].links):
                            filename=('head-'+gender+'-medium.png') if key=='head' else 'skin-medium.png'
                            node.image=bpy.data.images.load(str(TEX/filename),check_existing=True)
                    normal=texture(mat,'Restored source facial/body normals',TEX/('normal-'+key+'.png'),True)
                    normalmap=nodes.new('ShaderNodeNormalMap');normalmap.inputs['Strength'].default_value=.62 if key=='head' else .42
                    links.new(normal.outputs['Color'],normalmap.inputs['Color']);links.new(normalmap.outputs['Normal'],shader.inputs['Normal'])
                    rough=texture(mat,'Region-specific skin roughness',TEX/('rough-'+key+'.png'),True)
                    links.new(rough.outputs['Color'],shader.inputs['Roughness'])
                else:shader.inputs['Roughness'].default_value=.66
                shader.inputs['Specular IOR Level'].default_value=.3
                shader.inputs['Subsurface Weight'].default_value=.035
            elif part=='eyes':
                if 'Eye_L' in obj.name or 'Eye_R' in obj.name:
                    side='left' if 'Eye_L' in obj.name else 'right'
                    for node in nodes:
                        if node.type=='TEX_IMAGE' and node.image:node.image=bpy.data.images.load(str(TEX/('eye-'+gender+'-'+side+'.png')),check_existing=True)
                    shader.inputs['Roughness'].default_value=.18
                    shader.inputs['Coat Weight'].default_value=.3
                    shader.inputs['Coat Roughness'].default_value=.14
            elif 'Pant_' in obj.name:
                for node in list(nodes):
                    if node.type=='TEX_IMAGE' and node.image:node.image=bpy.data.images.load(str(TEX/'trousers.png'),check_existing=True)
                normal=texture(mat,'Stitching and leather relief',TEX/'normal-trousers.png',True)
                nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.8
                links.new(normal.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],shader.inputs['Normal'])
                rough=texture(mat,'Cloth and boot roughness',TEX/'rough-trousers.png',True)
                links.new(rough.outputs['Color'],shader.inputs['Roughness'])


def bake_surface(obj,gender,kind,size=1024):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    flow=obj.data.uv_layers.get('FibreFlow') or obj.data.uv_layers.new(name='FibreFlow')
    obj.data.uv_layers.new(name='SurfaceUV')
    obj.data.uv_layers.active_index=len(obj.data.uv_layers)-1
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.015)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.uv_layers.active.active_render=True
    old=obj.data.materials[0]
    base=tuple(old.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value)
    mat=bpy.data.materials.new(gender+' • '+kind+' material authoring');mat.use_nodes=True
    obj.data.materials.clear();obj.data.materials.append(mat)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    shader=nodes.get('Principled BSDF');output=nodes.get('Material Output')
    def mathnode(op,a,b=None):
        node=nodes.new('ShaderNodeMath');node.operation=op
        for i,value in enumerate([a,b]):
            if value is None:continue
            if isinstance(value,bpy.types.NodeSocket):links.new(value,node.inputs[i])
            else:node.inputs[i].default_value=value
        return node.outputs[0]
    def noise(vector,scale,detail=2):
        node=nodes.new('ShaderNodeTexNoise');node.inputs['Scale'].default_value=scale;node.inputs['Detail'].default_value=detail
        links.new(vector,node.inputs['Vector']);return node.outputs['Fac']
    geom=nodes.new('ShaderNodeNewGeometry')
    split=nodes.new('ShaderNodeSeparateXYZ');links.new(geom.outputs['Position'],split.inputs[0])
    x,z=split.outputs['X'],split.outputs['Z']
    if kind=='hair':
        uv=nodes.new('ShaderNodeUVMap');uv.uv_map='FibreFlow'
        separate=nodes.new('ShaderNodeSeparateXYZ');links.new(uv.outputs['UV'],separate.inputs[0]);u=separate.outputs['X']
        variation=noise(uv.outputs['UV'],60)
        fine=mathnode('SINE',mathnode('ADD',mathnode('MULTIPLY',u,math.tau*520),mathnode('MULTIPLY',variation,2)))
        broad=mathnode('SINE',mathnode('ADD',mathnode('MULTIPLY',u,math.tau*95),variation))
        height=mathnode('ADD',mathnode('MULTIPLY',fine,.055),mathnode('MULTIPLY',broad,.045))
        rough=mathnode('ADD',.48,mathnode('MULTIPLY',variation,.12))
        tint=mathnode('ADD',.985,mathnode('MULTIPLY',broad,.030))
        bump_distance=.00035
    else:
        weave=noise(geom.outputs['Position'],220,2)
        variation=noise(geom.outputs['Position'],160)
        outside=mathnode('GREATER_THAN',mathnode('ABSOLUTE',x),.18)
        dz=mathnode('DIVIDE',mathnode('SUBTRACT',z,1.12),.14)
        foldmask=mathnode('MULTIPLY',outside,mathnode('EXPONENT',mathnode('MULTIPLY',mathnode('MULTIPLY',dz,dz),-1)))
        folds=mathnode('SINE',mathnode('ADD',mathnode('MULTIPLY',z,math.tau*18),mathnode('MULTIPLY',x,29)))
        collar=mathnode('LESS_THAN',mathnode('ABSOLUTE',mathnode('SUBTRACT',z,1.429)),.0015)
        collar=mathnode('MULTIPLY',collar,mathnode('LESS_THAN',mathnode('ABSOLUTE',x),.075))
        height=mathnode('ADD',mathnode('MULTIPLY',weave,.015),mathnode('MULTIPLY',mathnode('MULTIPLY',folds,foldmask),.18))
        height=mathnode('ADD',height,mathnode('MULTIPLY',collar,.22))
        rough=mathnode('ADD',.80,mathnode('MULTIPLY',variation,.14))
        tint=mathnode('SUBTRACT',mathnode('ADD',.965,mathnode('MULTIPLY',variation,.035)),mathnode('MULTIPLY',collar,.06))
        bump_distance=.003
    multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1;multiply.inputs[1].default_value=base
    links.new(tint,multiply.inputs[2]);albedo=multiply.outputs[0]
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.55;bump.inputs['Distance'].default_value=bump_distance
    links.new(height,bump.inputs['Height']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
    links.new(albedo,shader.inputs['Base Color']);links.new(rough,shader.inputs['Roughness'])
    emission=nodes.new('ShaderNodeEmission')
    result={}
    for channel,socket in [('albedo',albedo),('roughness',rough),('normal',None)]:
        image=bpy.data.images.new(gender+'-'+kind+'-'+channel,width=size,height=size,alpha=False)
        if channel!='albedo':image.colorspace_settings.name='Non-Color'
        target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target
        if channel=='normal':
            links.new(shader.outputs['BSDF'],output.inputs['Surface'])
            bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT',margin=16,use_clear=True)
        else:
            links.new(socket,emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface'])
            bpy.ops.object.bake(type='EMIT',margin=16,use_clear=True)
        image.filepath_raw=str(TEX/(gender+'-'+kind+'-'+channel+'.png'));image.file_format='PNG';image.save();result[channel]=image
    final=bpy.data.materials.new(('Dye • refined cotton ' if kind=='cloth' else 'Hair • refined fibres ')+gender);final.use_nodes=True
    final['surface_kind']=kind
    p=final.node_tree.nodes.get('Principled BSDF');p.inputs['Specular IOR Level'].default_value=.32 if kind=='hair' else .22
    for channel in ['albedo','roughness']:
        node=final.node_tree.nodes.new('ShaderNodeTexImage');node.image=result[channel]
        final.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color' if channel=='albedo' else 'Roughness'])
    node=final.node_tree.nodes.new('ShaderNodeTexImage');node.image=result['normal']
    nm=final.node_tree.nodes.new('ShaderNodeNormalMap');final.node_tree.links.new(node.outputs['Color'],nm.inputs['Color']);final.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    obj.data.materials.clear();obj.data.materials.append(final)
    obj.data.uv_layers.remove(obj.data.uv_layers['FibreFlow'])
    obj.data.uv_layers.active_index=len(obj.data.uv_layers)-1
    return result


def process(gender):
    scene=next(s for s in bpy.data.scenes if s.name=='Base character • '+gender)
    bpy.context.window.scene=scene
    collection=next(c for c in scene.collection.children if c.name=='Base • '+gender)
    objects=list(collection.objects)
    before={part:fingerprint(objects,part) for part in ['skin','eyes','clothes','hair']}
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.bake.use_selected_to_active=False
    original_materials(objects,gender)
    # Consolidating hair into one material atlas changes no vertex positions.
    hair=[o for o in objects if o.get('part')=='hair']
    for obj in hair:
        flow=obj.data.uv_layers.new(name='FibreFlow')
        coordinates=np.array([tuple(v.co) for v in obj.data.vertices])
        center=coordinates.mean(axis=0)
        _,axes=np.linalg.eigh(np.cov((coordinates-center).T))
        across=Vector(axes[:,1]);along=Vector(axes[:,2])
        for polygon in obj.data.polygons:
            values=[]
            for index in polygon.loop_indices:
                p=obj.data.vertices[obj.data.loops[index].vertex_index].co
                if 'crown' in obj.name:
                    values.append(((math.atan2(p.x,-p.y-.015)+math.pi)*.11,p.z-1.42))
                else:
                    delta=p-Vector(center);values.append((delta.dot(across),delta.dot(along)))
            if 'crown' in obj.name and max(v[0] for v in values)-min(v[0] for v in values)>math.pi*.11:
                values=[(u+math.tau*.11 if u<math.pi*.11 else u,v) for u,v in values]
            for index,value in zip(polygon.loop_indices,values):flow.data[index].uv=value
    bpy.ops.object.select_all(action='DESELECT')
    for obj in hair:obj.select_set(True)
    bpy.context.view_layer.objects.active=hair[0];bpy.ops.object.join()
    hair=bpy.context.object;hair.name='Hair • detailed '+gender
    bake_surface(hair,gender,'hair',2048)
    shirt=next(o for o in collection.objects if 'Plain shirt' in o.name)
    bake_surface(shirt,gender,'cloth',1024)
    after={part:fingerprint(list(collection.objects),part) for part in before}
    if before!=after:raise RuntimeError('Protected geometry changed during the surface pass')
    REPORT[gender]={'geometryUnchanged':True,'parts':after}
    # More directional soft light, reducing the uniformly chalky appearance.
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.24
    for light in [o for o in scene.objects if o.type=='LIGHT']:
        if 'Key' in light.name:light.data.size=2.2;light.data.energy=280
        elif 'Fill' in light.name:light.data.energy=120
    scene.view_settings.exposure=.05
    scene.camera.location=(.8,-6,2.02);scene.camera.data.ortho_scale=1.95
    scene.camera.rotation_euler=(Vector((0,0,.90))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    variants={}
    for tone in os.environ.get('SURFACE_TONES','light,medium,tan,brown,dark').split(','):
        for obj in collection.objects:
            for mat in obj.data.materials:
                if not mat or not mat.use_nodes:continue
                if mat.get('skin_plain'):plain_skin(mat.node_tree.nodes.get('Principled BSDF'),tone)
                key=mat.get('base_skin_map')
                for node in mat.node_tree.nodes:
                    if node.type=='TEX_IMAGE' and node.image and node.name not in ['Restored source facial/body normals','Region-specific skin roughness'] and key:
                        node.image=bpy.data.images.load(str(TEX/((('head-'+gender) if key=='head' else 'skin')+'-'+tone+'.png')),check_existing=True)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in collection.objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=shirt
        bpy.ops.export_scene.gltf(filepath=str(OUT/(gender+'-'+tone+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True,export_animations=False,export_extras=True)
        scene.render.resolution_x=512;scene.render.resolution_y=896;scene.render.resolution_percentage=100
        scene.render.filepath=str(OUT/(gender+'-'+tone+'.png'));bpy.ops.render.render(write_still=True)
        variants[tone]={'model':gender+'-'+tone+'.glb','portrait':gender+'-'+tone+'.webp','portraitSmall':gender+'-'+tone+'-small.webp'}
    MANIFEST['characters'][gender]['variants']=variants
    # Close-ups use the medium appearance for judging skin/hair and cloth.
    for obj in collection.objects:
        for mat in obj.data.materials:
            if mat and mat.use_nodes and mat.get('skin_plain'):plain_skin(mat.node_tree.nodes.get('Principled BSDF'),'medium')
            if mat and mat.use_nodes and mat.get('base_skin_map'):
                key=mat['base_skin_map']
                for node in mat.node_tree.nodes:
                    if node.type=='TEX_IMAGE' and node.image and node.name not in ['Restored source facial/body normals','Region-specific skin roughness']:
                        node.image=bpy.data.images.load(str(TEX/((('head-'+gender) if key=='head' else 'skin')+'-medium.png')),check_existing=True)
    scene.render.resolution_x=720;scene.render.resolution_y=720
    for name,target,scale in [('face',(0,-.02,1.62),.40),('body',(0,0,1.20),.70)]:
        scene.camera.data.ortho_scale=scale;scene.camera.rotation_euler=(Vector(target)-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/(gender+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
    scene.camera.data.ortho_scale=1.95;scene.camera.rotation_euler=(Vector((0,0,.90))-scene.camera.location).to_track_quat('-Z','Y').to_euler()


for gender in os.environ.get('SURFACE_GENDERS','boy,girl').split(','):process(gender)
MANIFEST['surfaceValidation']=REPORT
(OUT/'manifest.json').write_text(json.dumps(MANIFEST,ensure_ascii=False,indent=2)+'\n')
(OUT/'geometry-check.json').write_text(json.dumps(REPORT,indent=2)+'\n')
bpy.ops.file.pack_all()
bpy.data.libraries.write(str(OUT/'refined-characters.blend'),set(s for s in bpy.data.scenes if s.name.startswith('Base character •')),path_remap='RELATIVE',compress=True)
print('SURFACE_REVISION_COMPLETE',json.dumps(REPORT))
