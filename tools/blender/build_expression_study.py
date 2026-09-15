"""Three review-only expressions, preserving approved hair and proportions.

blender -b assets/items-3d/catalogue.blend --python-exit-code 1 --python THIS_FILE
Writes only assets/character-detail-study/. Does not change the live catalogue.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/character-detail-study'
TEX=OUT/'expressions/textures'
scene=bpy.context.scene
source=[obj for obj in scene.objects if obj.type=='MESH' and obj.get('shop_slot')]
EXPRESSIONS={
    'gentle': {'label':'Douce','inner':.017,'outer':-.008,'smile':.0025,'cheek':.0007},
    'smile': {'label':'Souriante','inner':.020,'outer':-.006,'smile':.0045,'cheek':.0015},
    'serene': {'label':'Sereine','inner':.015,'outer':-.010,'smile':.0010,'cheek':.0003},
}

def complete_back_hair(hair):
    """A fitted, combed underlayer behind the approved girl's outer locks."""
    vertices=[];faces=[];cols=64;rows=30
    for j in range(rows):
        theta=.92+(2.23-.92)*j/(rows-1)
        for i in range(cols+1):
            a=math.pi*i/cols
            ripple=.0009*math.sin(a*44+theta*3)
            vertices.append(((.118+ripple)*math.sin(theta)*math.cos(a),
                             -.012+(.134+ripple)*math.sin(theta)*math.sin(a),
                             1.625+.147*math.cos(theta)))
    for j in range(rows-1):
        for i in range(cols):
            p=j*(cols+1)+i
            faces.append((p,p+cols+1,p+cols+2,p+1))
    data=bpy.data.meshes.new('Posterior scalp / combed underlayer')
    data.from_pydata(vertices,[],faces);data.update()
    cap=bpy.data.objects.new('girl / filled posterior hair',data);scene.collection.objects.link(cap)
    cap.matrix_world=hair.matrix_world.copy()
    for polygon in data.polygons:polygon.use_smooth=True
    data.materials.append(hair.data.materials[0])
    for key in hair.keys():cap[key]=hair[key]
    cap['hair_repair']='Fitted underlayer closes the exposed occiput without changing approved outer locks'
    return cap

def soften_face(obj,config):
    if obj.get('part') not in ['skin','eyes']:return
    matrix=obj.matrix_world.copy();inverse=matrix.inverted()
    for vertex in obj.data.vertices:
        p=matrix @ vertex.co;x,y,z=p
        if y>-.065 or not 1.49<z<1.67:continue
        # Raise the inner brow and lower its outer end: remove the angry V.
        t=max(0,min(1,(abs(x)-.014)/.058))
        brow=math.exp(-((z-1.628)/.023)**4)*math.exp(-((abs(x)-.043)/.049)**6)
        p.z+=(config['inner']*(1-t)+config['outer']*t)*brow
        # Gentle smile from mouth corners, not a large painted grin.
        corners=min(1,(abs(x)/.037)**2)*math.exp(-((abs(x)/.055)**6)-((z-1.515)/.018)**2)
        p.z+=config['smile']*corners
        cheek=math.exp(-((abs(x)-.053)/.025)**2-((z-1.567)/.024)**2)
        p.z+=config['cheek']*cheek
        vertex.co=inverse @ p
    obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
    for face in obj.data.polygons:face.use_smooth=True

def face_materials(obj,gender):
    for i,original in enumerate(list(obj.data.materials)):
        if not original or not original.use_nodes:continue
        mat=original.copy();obj.data.materials[i]=mat
        shader=mat.node_tree.nodes.get('Principled BSDF')
        for node in mat.node_tree.nodes:
            if node.type!='TEX_IMAGE' or not node.image:continue
            filename=Path(node.image.filepath).name
            target=None
            if filename==f'head-{gender}-medium.png':target=TEX/f'{gender}-face.png'
            elif filename=='normal-head.png':target=TEX/'face-normal.png'
            elif 'Eye_L' in obj.name:target=TEX/f'{gender}-eye-left.png'
            elif 'Eye_R' in obj.name:target=TEX/f'{gender}-eye-right.png'
            if target:
                node.image=bpy.data.images.load(str(target),check_existing=True)
                if 'normal' in target.name:node.image.colorspace_settings.name='Non-Color'
        if mat.get('base_skin_map')=='head':
            for node in mat.node_tree.nodes:
                if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.70
            shader.inputs['Specular IOR Level'].default_value=.30

scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA';scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
for obj in scene.objects:
    if obj.type=='LIGHT':
        obj.hide_render=False;obj.hide_set(False)
        obj.data.energy=340 if 'Key' in obj.name else 200 if 'Fill' in obj.name else 110
        obj.data.size=3.5
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.4
camera=scene.camera;camera.data.type='ORTHO'
all_proposals=[]
report={'integrated':False,'expressions':EXPRESSIONS,'hair':'Outer hairstyles unchanged; posterior underlayer added on girl only.'}
for gender,persona in [('girl','female'),('boy','male')]:
    defaults={'core':'base','persona':persona,'outfit':'starter','hair':'long' if gender=='girl' else 'short'}
    base=[obj for obj in source if obj.get('fit_persona')==persona and defaults.get(obj.get('shop_slot'))==obj.get('shop_id') and obj.get('hat_fit','open')=='open']
    for expression,config in EXPRESSIONS.items():
        proposal=[]
        for original in base:
            obj=original.copy();obj.data=original.data.copy();scene.collection.objects.link(obj)
            obj.name=f'{gender} / {expression} / {original.name}'
            soften_face(obj,config);face_materials(obj,gender)
            obj['expression_proposal']=expression
            proposal.append(obj)
        if gender=='girl':
            hair=next(obj for obj in proposal if obj.get('shop_slot')=='hair')
            proposal.append(complete_back_hair(hair))
        bpy.ops.object.select_all(action='DESELECT')
        for obj in proposal:obj.hide_set(False);obj.select_set(True)
        bpy.context.view_layer.objects.active=proposal[0]
        bpy.ops.export_scene.gltf(filepath=str(OUT/f'{gender}-{expression}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_extras=True)
        for obj in scene.objects:
            if obj.type=='MESH':obj.hide_render=obj not in proposal
        for view,yaw in [('front',0),('quarter',.42),('profile',math.pi/2),('back',math.pi),('full',.18)]:
            full=view=='full'
            target=Vector((0,-.015,.93 if full else 1.60))
            camera.location=target+Vector((math.sin(yaw)*4,-math.cos(yaw)*4,.05))
            camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
            camera.data.ortho_scale=1.98 if full else .55
            scene.render.resolution_x=640 if full else 900
            scene.render.resolution_y=1024 if full else 900
            scene.render.filepath=str(OUT/f'{gender}-{expression}-{view}.png')
            bpy.ops.render.render(write_still=True)
        all_proposals.extend(proposal)
(OUT/'expressions/manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print('EXPRESSION_PROPOSALS_READY',list(EXPRESSIONS),flush=True)
