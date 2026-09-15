"""Prepare the two supplied hairstyles for the refit base characters.

The archive heads are discarded; only hair meshes are kept, decimated to a
web budget and placed in the catalogue construction frame (Blender Z up,
front -Y, metres). The catalogue then retargets them to each character head.

    blender -b --factory-startup --python-exit-code 1 \
      --python tools/blender/prepare_refit_hair.py -- GIRL_ZIP BOY_ZIP
"""
import bpy
import bmesh
import hashlib
import io
import json
import math
import sys
import tempfile
import zipfile
from pathlib import Path
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/characters-refit/hair'
OUT.mkdir(parents=True, exist_ok=True)
args = sys.argv[sys.argv.index('--') + 1:]
if len(args) != 2:
    raise SystemExit('Expected: GIRL_ZIP BOY_ZIP')

for gender, archive_path in zip(['girl', 'boy'], map(Path, args)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with tempfile.TemporaryDirectory(prefix='refit-hair-') as directory:
        with zipfile.ZipFile(archive_path) as archive:
            if gender == 'girl':
                member = 'source/Hair.fbx'
                source = archive.read(member)
                path = Path(directory) / 'Hair.fbx'
                path.write_bytes(source)
                bpy.ops.import_scene.fbx(filepath=str(path), use_anim=False)
            else:
                member = 'source/Hair Sketchfab.zip/Hair Sketchfab.obj'
                with zipfile.ZipFile(io.BytesIO(archive.read('source/Hair Sketchfab.zip'))) as inner:
                    source = inner.read('Hair Sketchfab.obj')
                path = Path(directory) / 'Hair Sketchfab.obj'
                path.write_bytes(source)
                bpy.ops.wm.obj_import(filepath=str(path))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if len(meshes) != 1:
        raise ValueError('Expected a single supplied head/hair mesh')
    obj = meshes[0]
    source_name = obj.name
    slots = {i for i, mat in enumerate(obj.data.materials)
             if mat and (mat.name == 'Hunter_Hair' if gender == 'boy' else mat.name != 'Skin')}
    if len(slots) != 1:
        raise ValueError('Cannot identify the source hair material')
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[face for face in bm.faces if face.material_index not in slots], context='FACES')
    bmesh.ops.delete(bm, geom=[vertex for vertex in bm.verts if not vertex.link_faces], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.shape_key_clear()
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)

    budget = 150000 if gender == 'girl' else 60000
    before = sum(len(face.vertices) - 2 for face in obj.data.polygons)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new('Web mesh / preserve sculpted locks', 'DECIMATE')
    modifier.ratio = min(1, budget / before)
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)

    # Construction frame: the catalogue head fit for each persona.
    fit = {'girl': ((.44, .43, .42), (-.0508 * .44, -.026, 1.6145)),
           'boy': ((.30, .30, .29), (-.0015, -.026, 1.787 - 2.013065 * .29))}[gender]
    scale, offset = fit
    for vertex in obj.data.vertices:
        vertex.co = tuple(vertex.co[i] * scale[i] + offset[i] for i in range(3))
        if gender == 'boy' and vertex.co.z > 1.55:
            # Fit the shallow source forehead to the delivered skull, retaining
            # separation between overlapping locks rather than collapsing them
            # onto one surface (which causes coplanar flickering).
            x, y, z = vertex.co.x, vertex.co.y + .015, vertex.co.z - 1.622
            radial = math.sqrt((x/.121)**2 + (y/.150)**2 + (z/.151)**2)
            if .001 < radial < 1.173077:
                factor = (1.025 + (radial-.75)*.35) / radial
                vertex.co = (x*factor, y*factor-.015, z*factor+1.622)
    obj.data.normals_split_custom_set([(0,0,0)] * len(obj.data.loops))
    for face in obj.data.polygons:
        face.use_smooth = True
        face.material_index = 0
    obj.data.materials.clear()
    material = bpy.data.materials.new('Hair / supplied locks')
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.088, .050, .029, 1)
    shader.inputs['Roughness'].default_value = .58
    obj.data.materials.append(material)
    obj.name = gender + ' / supplied hairstyle'
    for index in ('hair_source', 'hair_reference_revision'):
        obj[index] = ''
    obj['hair_source'] = f'{archive_path.name}/{member}'
    obj['hair_source_sha256'] = hashlib.sha256(source).hexdigest()
    obj['hair_reference_revision'] = 'refit-hair-v1'
    obj['source_head_removed'] = True
    obj.data.update()

    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{gender}.glb'), export_format='GLB',
                              use_selection=True, export_yup=True, export_animations=False, export_extras=True)
    report = {
        'revision': 'refit-hair-v1', 'source': archive_path.name, 'sourceMember': member,
        'sourceSha256': hashlib.sha256(source).hexdigest(), 'sourceObject': source_name,
        'attribution': 'User-supplied model; the archive carries no author or licence notice.',
        'sourceHeadRemoved': True, 'sourceHairTriangles': before,
        'optimizedHairTriangles': sum(len(face.vertices) - 2 for face in obj.data.polygons),
        'coordinates': 'Construction frame: Blender Z up, front -Y; glTF Y up, front +Z; metres',
        'fit': {'scale': list(scale), 'offset': list(offset)},
        'output': f'{gender}.glb',
    }
    (OUT / f'{gender}.json').write_text(json.dumps(report, indent=2) + '\n')
    print('REFIT_HAIR_READY', json.dumps(report), flush=True)
