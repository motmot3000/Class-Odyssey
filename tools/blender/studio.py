"""Presentation/export for the Rodin-reconstructed ClassQuest ranger.

Run through Blender MCP after importing the image-to-3D result and orienting
it upright (Z). Geometry comes from the documented reference in provenance.json.
"""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'character-lab'


def setup():
    scene = bpy.context.scene
    model = bpy.data.objects['Ranger_Reconstructed']
    model['source_costume'] = 'src/avatar.mjs: vocab-ranger, shadow-hood, lore-lantern'
    model['method'] = 'Juggernaut XI reference -> Hyper3D Rodin Sketch -> Blender studio'
    model['prototype'] = True
    # PBR is already carried by the generated material and its texture maps.
    for mat in model.data.materials:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Roughness'].default_value=.82
    bpy.ops.object.select_all(action='DESELECT')
    model.select_set(True)
    bpy.context.view_layer.objects.active=model
    bpy.ops.export_scene.gltf(filepath=str(OUT/'ranger.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
    scene.render.engine='CYCLES'
    scene.cycles.samples=64
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1100
    scene.render.resolution_y=1400
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=0
    world=bpy.data.worlds.new('Muted blue studio')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.25,.31,.40,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.25
    scene.world=world
    def area(name,position,energy,color,size):
        bpy.ops.object.light_add(type='AREA',location=position)
        obj=bpy.context.object
        obj.name=name;obj.data.energy=energy;obj.data.color=color;obj.data.shape='DISK';obj.data.size=size
        obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    area('Key • warm daylight',(-2.2,-3.5,3.3),260,(1,.87,.72),2.8)
    area('Fill • open sky',(2,-1.8,2),100,(.72,.84,1),2.3)
    area('Rim • silhouette',(.9,1.9,2.7),310,(.77,.85,1),2)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.43,depth=.042,location=(0,0,-.025))
    plinth=bpy.context.object;plinth.name='Slate display plinth'
    bevel=plinth.modifiers.new('Soft edge','BEVEL');bevel.width=.014;bevel.segments=3
    plinth.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    stone=bpy.data.materials.new('Slate • matte blue')
    stone.diffuse_color=(.043,.061,.068,1);stone.use_nodes=True
    p=stone.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=stone.diffuse_color;p.inputs['Roughness'].default_value=.85
    plinth.data.materials.append(stone)
    bpy.ops.object.camera_add(location=(1.25,-6,2.25))
    camera=bpy.context.object;camera.name='Ranger portrait';camera.data.type='ORTHO';camera.data.ortho_scale=2.06
    camera.rotation_euler=(Vector((0,-.01,.86))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(OUT/'ranger-portrait.png')
    bpy.ops.file.pack_all()
    # The rejected procedural study is intentionally absent from the final file.
    for old in list(bpy.data.scenes):
        if old != scene:
            bpy.data.scenes.remove(old)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ranger.blend'))
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.overlay.show_overlays=False
    def render():
        bpy.ops.render.render(write_still=True)
        return None
    bpy.app.timers.register(render,first_interval=1)
    print('Reconstructed ranger exported, portrait queued.')
