"""Refine only the eye region of the approved gentle expression.

blender -b assets/items-3d/catalogue.blend --python-exit-code 1 --python THIS_FILE
"""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/character-detail-study'
scene=bpy.context.scene
for obj in scene.objects:
    if obj.type=='MESH':obj.hide_render=True
scene.render.engine='CYCLES';scene.cycles.samples=56;scene.cycles.use_denoising=True
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA';scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.4
for obj in scene.objects:
    if obj.type=='LIGHT':
        obj.hide_render=False;obj.hide_set(False)
        obj.data.energy=340 if 'Key' in obj.name else 200 if 'Fill' in obj.name else 110
        obj.data.size=3.5
camera=scene.camera;camera.data.type='ORTHO'
report={'revision':'reference-eyes-v1','base':'gentle','integrated':False,'characters':{}}
previous_report=OUT/'warm-eyes/geometry.json'
if previous_report.exists():
    report['characters']=json.loads(previous_report.read_text()).get('characters',{})
for gender in ['girl','boy']:
    if os.environ.get('WARM_GENDERS') and gender not in os.environ['WARM_GENDERS'].split(','):
        continue
    old=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/f'{gender}-gentle.glb'))
    imported=list(set(scene.objects)-old)
    objects=[obj for obj in imported if obj.type=='MESH']
    changed=0
    for obj in objects:
        globe='Eye_L' in obj.name or 'Eye_R' in obj.name
        if obj.get('part') in ['skin','eyes'] and not globe:
            # Keep the globe/iris round. Only the eyelid aperture follows the
            # validated boy reference, now shared by both characters.
            matrix=obj.matrix_world.copy();inverse=matrix.inverted()
            cx=.046 if gender=='girl' else .049
            for vertex in obj.data.vertices:
                p=matrix @ vertex.co;x,y,z=p
                if y>-.082 or not 1.574<z<1.619:continue
                dx=abs(x)-cx;dz=z-1.596
                width=math.exp(-((dx/.030)**4))
                edge=max(0,min(1,(1.619-z)/.008))*max(0,min(1,(z-1.574)/.008))
                amount=.09
                displacement=-dz*amount*width*edge
                p.z+=displacement
                if abs(displacement)>.00001:changed+=1
                vertex.co=inverse @ p
            obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
        if globe:
            side='left' if 'Eye_L' in obj.name else 'right'
            for index,original in enumerate(list(obj.data.materials)):
                mat=original.copy();obj.data.materials[index]=mat
                nodes=mat.node_tree.nodes;links=mat.node_tree.links
                shader=nodes.get('Principled BSDF')
                for node in nodes:
                    if node.type=='TEX_IMAGE' and node.image:
                        node.image=bpy.data.images.load(str(OUT/'warm-eyes'/f'{gender}-{side}.png'),check_existing=True)
                shader.inputs['Roughness'].default_value=.27
                shader.inputs['Coat Weight'].default_value=.10
                shader.inputs['Coat Roughness'].default_value=.19
        obj['eye_reference_revision']='reference-eyes-v1'
    for obj in scene.objects:
        if obj.type=='MESH':obj.hide_render=obj not in objects
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.hide_set(False);obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{gender}-warm.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_extras=True)
    for view,yaw in [('front',0),('quarter',.42),('profile',math.pi/2),('back',math.pi),('full',.18)]:
        full=view=='full'
        target=Vector((0,-.015,.93 if full else 1.60))
        camera.location=target+Vector((math.sin(yaw)*4,-math.cos(yaw)*4,.05))
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=1.98 if full else .55
        scene.render.resolution_x=640 if full else 900
        scene.render.resolution_y=1024 if full else 900
        scene.render.filepath=str(OUT/f'{gender}-warm-{view}.png');bpy.ops.render.render(write_still=True)
    report['characters'][gender]={'reference':'Link Breath of the Wild',
                                 'eyelidVerticesAdjusted':changed,'hairChanged':False,'mouthAndBrowsChanged':False}
(OUT/'warm-eyes/geometry.json').write_text(json.dumps(report,indent=2)+'\n')
print('WARM_EYES_STUDY_READY',report,flush=True)
