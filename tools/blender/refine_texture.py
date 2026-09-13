"""Transfer the high-resolution reference onto the front of the reconstruction.

Blend with Rodin's existing atlas on the sides/back, then bake a portable 2K
base-color atlas. This is a texture projection on real geometry, not a billboard.
"""
import bpy
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def refine():
    obj=bpy.data.objects['Ranger_Reconstructed']
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    mat=obj.data.materials[0]
    mat.name='Ranger • reference-refined PBR'
    nodes=mat.node_tree.nodes; links=mat.node_tree.links
    principled=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    old=principled.inputs['Base Color'].links[0].from_socket
    uv=obj.data.uv_layers.new(name='ReferenceProjection')
    for loop in obj.data.loops:
        co=obj.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=((435+672*co.x)/832,(16+1176*co.z/1.75)/1216)
    obj.data.uv_layers.active_index=0
    obj.data.uv_layers[0].active_render=True
    reference=nodes.new('ShaderNodeTexImage')
    reference.name='High resolution costume reference'
    reference.image=bpy.data.images.load(str(ROOT/'assets/character-lab/ranger-reference.png'),check_existing=True)
    reference.extension='CLIP'
    coord=nodes.new('ShaderNodeUVMap');coord.uv_map='ReferenceProjection'
    links.new(coord.outputs['UV'],reference.inputs['Vector'])
    geom=nodes.new('ShaderNodeNewGeometry')
    dot=nodes.new('ShaderNodeVectorMath');dot.operation='DOT_PRODUCT';dot.inputs[1].default_value=(0,-1,0)
    links.new(geom.outputs['Normal'],dot.inputs[0])
    remap=nodes.new('ShaderNodeMapRange')
    remap.inputs['From Min'].default_value=.20;remap.inputs['From Max'].default_value=.65
    links.new(dot.outputs['Value'],remap.inputs['Value'])
    weight=nodes.new('ShaderNodeMath');weight.operation='MULTIPLY'
    links.new(remap.outputs['Result'],weight.inputs[0]);links.new(reference.outputs['Alpha'],weight.inputs[1])
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX'
    links.new(weight.outputs[0],mix.inputs[0]);links.new(old,mix.inputs[1]);links.new(reference.outputs['Color'],mix.inputs[2])
    emission=nodes.new('ShaderNodeEmission');links.new(mix.outputs[0],emission.inputs['Color'])
    output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
    links.new(emission.outputs[0],output.inputs['Surface'])
    image=bpy.data.images.new('Ranger_BaseColor_2K',width=2048,height=2048,alpha=False)
    target=nodes.new('ShaderNodeTexImage');target.image=image;target.name='Baked reference-refined base color'
    nodes.active=target
    bpy.context.scene.render.engine='CYCLES'
    bpy.context.scene.cycles.bake_type='EMIT'
    bpy.context.scene.render.bake.margin=12
    bpy.ops.object.bake(type='EMIT')
    links.new(principled.outputs['BSDF'],output.inputs['Surface'])
    links.new(target.outputs['Color'],principled.inputs['Base Color'])
    # Generated normal/metal maps are too coarse for a natural face and wool.
    for channel in ['Normal','Metallic','Roughness']:
        for link in list(principled.inputs[channel].links): links.remove(link)
    principled.inputs['Roughness'].default_value=.82
    principled.inputs['Metallic'].default_value=0
    image.pack()
    obj.data.uv_layers.remove(uv)
    for node in (coord,geom,dot,remap,weight,mix,emission,reference): nodes.remove(node)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/character-lab/ranger.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
    scene=bpy.context.scene
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/character-lab/ranger.blend'))
    scene.render.filepath=str(ROOT/'assets/character-lab/ranger-portrait.png')
    bpy.ops.render.render(write_still=True)
    print('2K reference transfer baked, packed, exported and rendered.')
