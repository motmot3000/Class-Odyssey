"""Review the small body-shape changes over the approved warm-eye bases.

blender -b assets/items-3d/catalogue.blend --python-exit-code 1 --python THIS_FILE
"""
import bpy,math,json,sys,os,hashlib
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from refit_body_shapes import apply_body_shape

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/character-detail-study'
REVISION=os.environ.get('BODY_SHAPE_REVISION','v1')
BEFORE='sporty' if REVISION=='v2' else 'warm'
AFTER='athletic' if REVISION=='v2' else 'sporty'
APPROVED=ROOT/'assets/characters-approved/faces-v1'
if REVISION=='v2':
    approval=json.loads((APPROVED/'manifest.json').read_text())
    for name,expected in approval['files'].items():
        assert hashlib.sha256((APPROVED/name).read_bytes()).hexdigest()==expected, f'Approved file changed: {name}'
scene=bpy.context.scene
for obj in scene.objects:
    if obj.type=='MESH':obj.hide_render=True
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
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
report={'revision':'sportive-bases-'+REVISION,'integrated':False,'base':BEFORE,'characters':{}}
for gender in ['girl','boy']:
    old=set(scene.objects)
    source_path=APPROVED/f'{gender}-approved.glb' if REVISION=='v2' else OUT/f'{gender}-warm.glb'
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    original=[obj for obj in set(scene.objects)-old if obj.type=='MESH']
    changed=[];count=0
    for source in original:
        obj=source.copy();obj.data=source.data.copy();scene.collection.objects.link(obj)
        obj.name='sportive / '+source.name
        count+=apply_body_shape(obj,gender,REVISION)
        obj['body_shape_revision']='sportive-bases-'+REVISION
        changed.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in changed:obj.hide_set(False);obj.select_set(True)
    bpy.context.view_layer.objects.active=changed[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{gender}-{AFTER}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_extras=True)
    for version,objects in [(BEFORE,original),(AFTER,changed)]:
        for obj in scene.objects:
            if obj.type=='MESH':obj.hide_render=obj not in objects
        for view,yaw in [('front',0),('quarter',.42),('profile',math.pi/2),('back',math.pi),('full',.18)]:
            full=view in ['profile','back','full']
            target=Vector((0,-.015,.93 if full else 1.60))
            camera.location=target+Vector((math.sin(yaw)*4,-math.cos(yaw)*4,.05))
            camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
            camera.data.ortho_scale=1.98 if full else .55
            scene.render.resolution_x=640 if full else 900
            scene.render.resolution_y=1024 if full else 900
            scene.render.filepath=str(OUT/f'{gender}-{version}-{view}.png');bpy.ops.render.render(write_still=True)
    report['characters'][gender]={'verticesAdjusted':count,'faceAndHairChanged':False,
        'hipWidthAdjustment':'+5% maximum' if gender=='girl' else '-3.5% maximum',
        'chestAdjustment':'4.5mm maximum projection' if gender=='girl' else '+3.5% maximum width; 2.5mm projection',
        'clothing':'Same smooth deformation field as the body; height and pose retained.'}
    if REVISION=='v2':
        report['characters'][gender].update({
            'faceSource':str(source_path.relative_to(ROOT)),
            'hipWidthAdjustment':'+3.5% maximum over v1' if gender=='girl' else '-2.5% maximum over v1',
            'chestAdjustment':'3.5mm extra maximum projection; subtle abdominal planes',
            'upperArmAdjustment':'+5% local radius maximum' if gender=='girl' else '+7.5% local radius maximum',
            'posteriorAdjustment':'-22% maximum depth in the targeted posterior region',
            'thighAdjustment':'+7.5% local lateral radius' if gender=='girl' else 'unchanged',
            'protectedHeadNormals':True,
        })
(OUT/('athletic-body-shapes.json' if REVISION=='v2' else 'body-shapes.json')).write_text(json.dumps(report,indent=2)+'\n')
print('BODY_SHAPE_STUDY_READY',report,flush=True)
