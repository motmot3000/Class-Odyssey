import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { getShopItems } from '../src/domain.mjs';
import { DEFAULT_LOOK, PRESETS, visiblePart, lookFromParams, modeledItemIds } from '../src/items-3d-model.mjs';

function readGlb(filename = '../assets/items-3d/catalogue.glb') {
  const data = readFileSync(new URL(filename, import.meta.url));
  assert.equal(data.readUInt32LE(0), 0x46546c67);
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  gltf.binary = data.subarray(28 + data.readUInt32LE(12));
  return gltf;
}

function worldMeshes(gltf, callback) {
  function visit(index, parent, inherited = {}) {
    const node = gltf.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3().fromArray(node.translation || [0,0,0]), new Quaternion().fromArray(node.rotation || [0,0,0,1]), new Vector3().fromArray(node.scale || [1,1,1])
    );
    const world = parent.clone().multiply(local);
    const data = { ...inherited, ...node.extras };
    for (const primitive of gltf.meshes?.[node.mesh]?.primitives || []) callback(node, primitive, world, data);
    for (const child of node.children || []) visit(child, world, data);
  }
  for (const index of gltf.scenes[gltf.scene || 0].nodes || []) visit(index, new Matrix4());
}

function positions(gltf, accessor, matrix) {
  const view = gltf.bufferViews[accessor.bufferView];
  const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = view.byteStride || 12;
  assert.equal(accessor.componentType, 5126);
  return Array.from({ length: accessor.count }, (_, i) => new Vector3(...[0,4,8].map(delta => gltf.binary.readFloatLE(offset+i*stride+delta))).applyMatrix4(matrix));
}

test('the real GLB covers every current modeled catalogue item and only the intended base', () => {
  const gltf = readGlb();
  const parts = gltf.nodes.filter(node => node.mesh !== undefined);
  const ids = new Set(parts.map(node => node.extras?.shop_id));
  for (const id of modeledItemIds()) assert.ok(ids.has(id), `Missing 3D item: ${id}`);
  assert.equal(modeledItemIds().length, 27);
  for (const node of parts) {
    assert.ok(node.extras?.shop_slot, `Untagged source mesh: ${node.name}`);
    assert.ok(['core', 'persona', 'outfit', 'hat', 'weapon', 'hair'].includes(node.extras.shop_slot));
    assert.ok(['male','female'].includes(node.extras.fit_persona), `Missing body fit: ${node.name}`);
  }
  for (const id of ['spiky', 'buzz-cut', 'monk-cut']) assert.equal(ids.has(id), false);
  assert.equal(gltf.skins?.length || 0, 0);
});

test('all equipment retains human-scale world bounds, including the transformed back sword', () => {
  const gltf = readGlb();
  const manifest = JSON.parse(readFileSync(new URL('../assets/items-3d/manifest.json', import.meta.url)));
  const hairTops = new Map();
  function visit(index, parent) {
    const node = gltf.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3().fromArray(node.translation || [0, 0, 0]),
      new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
      new Vector3().fromArray(node.scale || [1, 1, 1])
    );
    const world = parent.clone().multiply(local);
    for (const primitive of gltf.meshes?.[node.mesh]?.primitives || []) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      for (const x of [accessor.min[0], accessor.max[0]]) {
        for (const y of [accessor.min[1], accessor.max[1]]) {
          for (const z of [accessor.min[2], accessor.max[2]]) {
            const p = new Vector3(x, y, z).applyMatrix4(world);
            assert.ok(Math.abs(p.x) < 1 && p.y > -.03 && p.y < 2.22 && Math.abs(p.z) < .7, `${node.name} escaped fitted bounds: ${p.toArray()}`);
            if (node.extras?.shop_slot === 'hair') p.applyMatrix4(new Matrix4().fromArray(node.extras.template_to_character).invert());
            if (node.extras?.shop_slot === 'hair' && node.extras.hat_fit === 'covered') {
              assert.ok(p.y <= manifest.headFit.under_hat_z + .0001, `${node.name} extends above the hat fitting plane`);
            }
            if (node.extras?.shop_slot === 'hair') {
              const key = `${node.extras.fit_persona}:${node.extras.shop_id}:${node.extras.hat_fit}`;
              hairTops.set(key, Math.max(hairTops.get(key) || 0, p.y));
            }
          }
        }
      }
      if (node.extras?.shop_slot === 'hair' && node.extras.hat_fit === 'crowned') {
        const view = gltf.bufferViews[accessor.bufferView];
        const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
        const stride = view.byteStride || 12;
        assert.equal(accessor.componentType, 5126);
        for (let i = 0; i < accessor.count; i++) {
          const p = new Vector3(...[0,4,8].map(delta => gltf.binary.readFloatLE(offset+i*stride+delta))).applyMatrix4(world);
          p.applyMatrix4(new Matrix4().fromArray(node.extras.template_to_character).invert());
          if (p.y >= 1.698 && p.y <= 1.746) {
            const radial = Math.hypot(p.x/.112, (p.z+manifest.headFit.center_y)/.137);
            assert.ok(radial <= 1.001, `${node.name} pierces the crown band at ${p.toArray()}`);
          }
        }
      }
    }
    for (const child of node.children || []) visit(child, world);
  }
  for (const root of gltf.scenes[gltf.scene || 0].nodes) visit(root, new Matrix4());
  for (const persona of ['male','female']) {
    for (const hair of ['short','long','curly','braided','royal-hair']) {
      assert.ok(Math.abs(hairTops.get(`${persona}:${hair}:open`)-hairTops.get(`${persona}:${hair}:crowned`)) < .0001, `${hair} loses its top under an open crown`);
    }
  }
});

test('hat fit, haircuts and both personas select exactly one variant from actual GLB parts', () => {
  const parts = readGlb().nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
  for (const persona of ['male', 'female']) {
    for (const hat of getShopItems('hat')) {
      for (const hair of getShopItems('hair')) {
        const look = { ...DEFAULT_LOOK, persona, hat: hat.id, hair: hair.id };
        const visible = parts.filter(part => visiblePart(part, look));
        assert.deepEqual([...new Set(visible.filter(part => part.shop_slot === 'persona').map(part => part.shop_id))], [persona]);
        const hairs = visible.filter(part => part.shop_slot === 'hair');
        if (hair.id === 'bald' || hat.id === 'steel-helm') assert.equal(hairs.length, 0);
        else {
          assert.ok(hairs.length > 0, `Missing hair: ${hair.id}/${hat.id}`);
          assert.ok(hairs.every(part => part.shop_id === hair.id));
          assert.equal(new Set(hairs.map(part => part.hat_fit)).size, 1);
        }
      }
    }
  }
});

test('open crowns keep complete hairstyles instead of chopping off the top of the hair', () => {
  const parts = readGlb().nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
  for (const hair of ['short', 'long', 'curly', 'braided', 'royal-hair']) {
    for (const hat of ['gold-crown', 'celestial-crown']) {
      const visible = parts.filter(part => part.shop_slot === 'hair' && visiblePart(part, { ...DEFAULT_LOOK, hair, hat }));
      assert.ok(visible.length > 0);
      assert.ok(visible.every(part => part.hat_fit === 'crowned'));
    }
  }
});

test('items-only export excludes the welded body but keeps the equipped models', () => {
  const parts = readGlb().nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
  for (const preset of Object.values(PRESETS)) {
    const look = { ...DEFAULT_LOOK, ...preset };
    const exported = parts.filter(part => visiblePart(part, look, true));
    assert.ok(exported.length > 0);
    assert.ok(exported.every(part => !['core', 'persona', 'hand'].includes(part.shop_slot)));
    for (const id of Object.values(preset)) assert.ok(exported.some(part => part.shop_id === id));
  }
});

test('the catalogue is rebuilt from the delivered base-v2 files and pose contract', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/items-3d/manifest.json', import.meta.url)));
  const contract = readFileSync(new URL('../assets/items-3d/sources/manifest.json', import.meta.url));
  const source = JSON.parse(contract);
  assert.equal(manifest.sourceRevision, source.revision);
  assert.deepEqual(manifest.sourcePose, source.pose);
  assert.equal(manifest.sourcePose.armsFromT, 82);
  assert.equal(manifest.anchorManifestSha256, createHash('sha256').update(contract).digest('hex'));
  for (const gender of ['boy','girl']) {
    const bytes = readFileSync(new URL(`../assets/items-3d/sources/${gender}-medium.glb`, import.meta.url));
    assert.equal(manifest.sourceSha256[`${gender}-medium.glb`], createHash('sha256').update(bytes).digest('hex'));
  }
});

test('the shipped bodies match the validated athletic silhouettes exactly', () => {
  const catalogue = readGlb();
  // The approved faces are frozen in assets/characters-approved/faces-v1 and
  // the athletic silhouettes are the validated body pass over them. The live
  // catalogue must reproduce those approved meshes vertex for vertex, which
  // also proves the protected face and hair regions were carried over.
  for (const [persona, gender] of [['male','boy'],['female','girl']]) {
    const reference = readGlb(`../assets/character-detail-study/${gender}-athletic.glb`);
    const collect = (gltf, fitted) => {
      const points = new Set();
      worldMeshes(gltf, (node, primitive, world, data) => {
        if (data.part !== 'skin') return;
        if (fitted && data.fit_persona !== persona) return;
        for (const p of positions(gltf, gltf.accessors[primitive.attributes.POSITION], world)) {
          points.add(p.toArray().map(v => Math.round(v*10000)).join(','));
        }
      });
      return points;
    };
    const approved = collect(reference, false);
    const shipped = collect(catalogue, true);
    assert.ok(approved.size > 1000, `${gender} has too little approved body to check`);
    assert.deepEqual(shipped, approved, `${gender} catalogue body differs from the approved silhouette`);
  }
});

test('both base characters have a slightly slimmer posterior hip profile', () => {
  const catalogue = readGlb();
  for (const [persona, gender] of [['male','boy'],['female','girl']]) {
    const source = readGlb(`../assets/items-3d/sources/${gender}-medium.glb`);
    const posterior = (gltf, isSource) => {
      const depths=[];
      worldMeshes(gltf, (node, primitive, world, data) => {
        if (!isSource && data.fit_persona !== persona) return;
        if (data.part !== 'skin' && !node.name.includes('Pant_')) return;
        for (const p of positions(gltf,gltf.accessors[primitive.attributes.POSITION],world)) {
          if (p.y>.78 && p.y<.93 && p.z<0 && Math.abs(p.x)<.16) depths.push(-p.z);
        }
      });
      assert.ok(depths.length>10, `${gender}: posterior profile missing`);
      return Math.max(...depths);
    };
    const before=posterior(source,true), after=posterior(catalogue,false);
    assert.ok(after<before-.015, `${gender}: posterior volume was not reduced`);
    assert.ok(after>before*.55, `${gender}: posterior reduction is excessive`);
    assert.ok(after<before*.80, `${gender}: posterior reduction is not the approved athletic profile`);
  }
});

test('the refit base characters use the supplied hairstyles and a plain starter outfit', () => {
  const gltf = readGlb();
  const nodes = gltf.nodes.filter(node => node.mesh !== undefined);
  for (const [persona, hairId] of [['female', 'long'], ['male', 'short']]) {
    const parts = nodes.filter(node => node.extras?.shop_slot === 'hair' && node.extras.fit_persona === persona && node.extras.shop_id === hairId);
    assert.ok(parts.length >= 3, `${persona}: missing supplied hairstyle fits`);
    assert.ok(parts.every(node => gltf.materials[gltf.meshes[node.mesh].primitives[0].material].name.startsWith('Hair / supplied locks')), `${persona}: base cut is not the supplied hairstyle`);
  }
  for (const banned of ['neckerchief', 'scout scarf', 'compass fastening']) {
    assert.ok(!nodes.some(node => node.name.toLowerCase().includes(banned)), `starter outfit still contains ${banned}`);
  }
});

test('head and held item mounts match each character’s anatomical anchors', () => {
  const contract = JSON.parse(readFileSync(new URL('../assets/items-3d/sources/manifest.json', import.meta.url)));
  const parts = readGlb().nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
  for (const part of parts.filter(data => ['hair','hat','weapon'].includes(data.shop_slot))) {
    const gender = part.fit_persona === 'male' ? 'boy' : 'girl';
    const expected = contract.characters[gender].anchors[part.attachment]?.world;
    assert.ok(expected, `Unknown mount ${part.attachment}`);
    assert.ok(part.attachment_origin.every((v,i) => Math.abs(v-expected.position[i]) < .000001));
    assert.ok(part.attachment_quaternion.every((v,i) => Math.abs(v-expected.quaternion[i]) < .000001));
    if (['hair','hat'].includes(part.shop_slot)) assert.equal(part.attachment, 'hat_seat');
    if (part.shop_id === 'pencil-sword') assert.equal(part.attachment, 'grip_right');
    if (part.shop_id === 'star-shield') assert.equal(part.attachment, 'wrist_left');
  }
});

test('shareable looks validate item categories and preserve colour independently of the haircut', () => {
  const look = lookFromParams(new URLSearchParams('persona=female&hair=curly&hairColor=blue-hair&skin=word-wand&hat=monk-cut'));
  assert.equal(look.persona, 'female');
  assert.equal(look.hair, 'curly');
  assert.equal(look.hairColor, 'blue-hair');
  assert.equal(look.skin, DEFAULT_LOOK.skin);
  assert.equal(look.hat, DEFAULT_LOOK.hat);
});

test('every outfit hides its continuous waist edge inside the belt and has no old central tunic tail', () => {
  const gltf=readGlb();
  const skirts=new Set(), tops=new Set();
  worldMeshes(gltf,(node,primitive,world,data)=>{
    if(data.shop_slot!=='outfit') return;
    const points=positions(gltf,gltf.accessors[primitive.attributes.POSITION],world);
    const key=`${data.fit_persona}:${data.shop_id}`;
    if(node.name.includes('continuous waist-fitted tunic skirt')){
      skirts.add(key);
      assert.ok(Math.max(...points.map(p=>p.y))<1.047,`${key}: upper rim must remain below belt top`);
      assert.equal(data.waist_profile,'same anatomical contour as the belt');
    }
    if(node.name.includes('fitted long-sleeve tunic')){
      tops.add(key);
      assert.ok(points.every(p=>Math.abs(p.x)>=.10||p.y>=1.0299),`${key}: old torso tail remains below waist`);
    }
  });
  assert.equal(skirts.size,14);
  assert.equal(tops.size,14);
});

test('armoured outfits have fitted chest panels, articulated shoulders and contoured greaves',()=>{
  const nodes=readGlb().nodes.filter(node=>node.mesh!==undefined);
  for(const persona of ['male','female']) for(const id of ['story-keeper','honor-knight','realm-sovereign']){
    const parts=nodes.filter(node=>node.extras?.fit_persona===persona&&node.extras?.shop_id===id);
    assert.ok(parts.filter(node=>node.extras.armour_construction==='anatomical fitted plate').length>=6);
    assert.equal(parts.filter(node=>node.extras.armour_construction==='articulated shoulder').length,6);
    assert.equal(parts.filter(node=>node.extras.armour_construction==='contoured greave').length,2);
    assert.ok(parts.some(node=>node.name.includes('hinge rivet')));
    assert.ok(!parts.some(node=>node.name.includes('fitted shoulder plate')||node.name.includes('steel greave')));
  }
});
