import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { getShopItem, getShopItems } from '../src/domain.mjs';
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
for (const id of modeledItemIds().filter(id => getShopItem(id).type !== 'pet')) assert.ok(ids.has(id), `Missing 3D item: ${id}`);
  assert.equal(modeledItemIds().length, 40);
  for (const node of parts) {
    assert.ok(node.extras?.shop_slot, `Untagged source mesh: ${node.name}`);
    assert.ok(['core', 'persona', 'outfit', 'hat', 'weapon', 'shield', 'hair', 'accessory'].includes(node.extras.shop_slot));
    assert.ok(['male','female'].includes(node.extras.fit_persona), `Missing body fit: ${node.name}`);
  }
  for (const id of ['straight-short', 'spiky-short', 'buzz-cut', 'monk-cut']) assert.equal(ids.has(id), false);
  assert.equal(gltf.skins?.length || 0, 0);
});

test('every hero wears exactly one pair of ears: human by default, or the ear accessory', () => {
  for (const file of [undefined, '../assets/character-stylized/catalogue.glb']) {
    const parts = readGlb(file).nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
    for (const persona of ['male', 'female']) {
      for (const [accessory, style, jewellery] of [['no-accessory', 'human', false], ['elf-ears', 'elf', false], ['pierced-ears', 'human', true]]) {
        const visible = parts.filter(data => visiblePart(data, { ...DEFAULT_LOOK, persona, accessory }));
        const ears = visible.filter(data => data.part === 'ears');
        assert.equal(ears.length, 1, `${persona} ${accessory}`);
        assert.equal(ears[0].ear_style, style);
        assert.equal(visible.some(data => data.part === 'jewellery'), jewellery);
      }
    }
  }
});

test('all equipment retains human-scale world bounds, including the transformed back sword', () => {
  const gltf = readGlb();
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
            // A weapon held ready points forward: the longest blade reaches ~.81 m.
            const reach = node.extras?.shop_slot === 'weapon' ? .9 : .7;
            assert.ok(Math.abs(p.x) < 1 && p.y > -.03 && p.y < 2.22 && Math.abs(p.z) < reach, `${node.name} escaped fitted bounds: ${p.toArray()}`);
          }
        }
      }
    }
    for (const child of node.children || []) visit(child, world);
  }
  for (const root of gltf.scenes[gltf.scene || 0].nodes) visit(root, new Matrix4());
});

test('hair under a closed crown stays flush under the hat fitting plane', () => {
  const gltf = readGlb();
  const manifest = JSON.parse(readFileSync(new URL('../assets/items-3d/manifest.json', import.meta.url)));
  worldMeshes(gltf, (node, primitive, world, data) => {
    if (data.shop_slot !== 'hair' || data.hat_fit !== 'covered') return;
    const inverse = new Matrix4().fromArray(data.template_to_character).invert();
    for (const point of positions(gltf, gltf.accessors[primitive.attributes.POSITION], world)) {
      point.applyMatrix4(inverse);
      assert.ok(point.y <= manifest.headFit.under_hat_z + .0001, `${node.name} extends above the hat fitting plane`);
    }
  });
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

test('the shared haircuts ship while Braids and Royal Hair stay out', () => {
  const parts = readGlb().nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
  const shipped = [...new Set(parts.filter(part => part.shop_slot === 'hair').map(part => part.shop_id))].sort();
  assert.deepEqual(shipped, ['bun', 'curly', 'long', 'medium-cut', 'short', 'spiky']);
  for (const hair of ['short', 'long', 'medium-cut', 'curly', 'spiky', 'bun']) {
    for (const persona of ['male', 'female']) {
      const visible = parts.filter(part => part.shop_slot === 'hair' && part.fit_persona === persona
        && visiblePart(part, { ...DEFAULT_LOOK, persona, hair }));
      assert.ok(visible.length > 0, `${persona} must wear ${hair}`);
    }
  }
  for (const removed of ['braided', 'royal-hair', 'straight-short']) {
    assert.ok(!parts.some(part => part.shop_id === removed), `${removed} is withdrawn`);
  }
});

test('a held item closes its hand: open hands and fists swap per side', () => {
  for (const file of [undefined, '../assets/character-stylized/catalogue.glb']) {
    const parts = readGlb(file).nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
    for (const persona of ['male', 'female']) {
      const hands = (look, part) => parts.filter(data => ['hand', 'fist'].includes(data.part) && visiblePart(data, { ...DEFAULT_LOOK, persona, ...look }))
        .filter(data => data.part === part).map(data => data.hand_side).sort();
      assert.deepEqual(hands({}, 'hand'), ['left', 'right']);
      assert.deepEqual(hands({}, 'fist'), []);
      assert.deepEqual(hands({ weapon: 'epic-sword' }, 'fist'), ['right']);
      assert.deepEqual(hands({ weapon: 'epic-sword' }, 'hand'), ['left']);
      assert.deepEqual(hands({ weapon: 'templar-dagger', shield: 'hero-shield' }, 'fist'), ['left', 'right']);
      assert.deepEqual(hands({ shield: 'wooden-shield' }, 'hand'), ['right']);
      const held = parts.filter(data => visiblePart(data, { ...DEFAULT_LOOK, persona, weapon: 'medieval-sword', shield: 'knight-shield' }) && ['weapon', 'shield'].includes(data.shop_slot));
      assert.deepEqual(held.map(data => data.shop_id).sort(), ['knight-shield', 'medieval-sword']);
    }
  }
});

test('the weapon arm bends as its weapon asks: ready for blades and wands, level for a staff', () => {
  for (const file of [undefined, '../assets/character-stylized/catalogue.glb']) {
    const parts = readGlb(file).nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
    for (const persona of ['male', 'female']) {
      const arms = (weapon) => [...new Set(parts.filter(data => data.arm_pose && visiblePart(data, { ...DEFAULT_LOOK, persona, weapon }))
        .map(data => data.arm_pose))];
      assert.deepEqual(arms('no-weapon'), ['straight']);
      assert.deepEqual(arms('japanese-blade'), ['ready']);
      assert.deepEqual(arms('metal-wand'), ['ready']);
      assert.deepEqual(arms('wooden-staff'), ['staff']);
      // Each weapon rides the fist of the bend it asks for.
      for (const data of parts.filter(data => data.shop_slot === 'weapon' && data.fit_persona === persona)) {
        assert.equal(data.held_arm_pose, data.shop_id === 'wooden-staff' ? 'staff' : 'ready', data.shop_id);
      }
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
    for (const id of Object.values(preset).filter(id => id !== 'no-hat')) assert.ok(exported.some(part => part.shop_id === id));
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
  // The delivered ears now ship apart from the skin: the elf-ears accessory
  // carries them untouched, so skin + elf ears must still match exactly.
  for (const [persona, gender] of [['male','boy'],['female','girl']]) {
    const reference = readGlb(`../assets/character-detail-study/${gender}-athletic.glb`);
    const collect = (gltf, fitted) => {
      const points = new Set();
      worldMeshes(gltf, (node, primitive, world, data) => {
        const deliveredEars = fitted && data.part === 'ears' && data.ear_style === 'elf';
        // The open hands ship apart too (a fist replaces them when holding).
        const openHands = fitted && data.part === 'hand';
        if (data.part !== 'skin' && !deliveredEars && !openHands) return;
        // The weapon forearm also ships bent up; the hanging one is the body.
        if (fitted && data.arm_pose && data.arm_pose !== 'straight') return;
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

test('open crowns keep complete hairstyles instead of chopping off the top of the hair', () => {
  const parts = readGlb().nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
  for (const hair of ['short', 'long', 'medium-cut', 'spiky', 'bun']) {
    for (const hat of ['gold-crown']) {
      const visible = parts.filter(part => part.shop_slot === 'hair' && visiblePart(part, { ...DEFAULT_LOOK, hair, hat }));
      assert.ok(visible.length > 0);
      assert.ok(visible.every(part => part.hat_fit === 'crowned'));
    }
  }
});

test('the shipped catalogue ships the supplied haircuts and a plain starter outfit', () => {
  const gltf = readGlb();
  const nodes = gltf.nodes.filter(node => node.mesh !== undefined);
  const hairs = new Set(nodes.filter(node => node.extras?.shop_slot === 'hair').map(node => node.extras.shop_id));
  assert.deepEqual([...hairs].sort(), ['bun', 'curly', 'long', 'medium-cut', 'short', 'spiky']);
  for (const banned of ['neckerchief', 'scout scarf', 'compass fastening']) {
    assert.ok(!nodes.some(node => node.name.toLowerCase().includes(banned)), `starter outfit still contains ${banned}`);
  }
});

test('head and held item mounts match each character’s anatomical anchors', () => {
  const contract = JSON.parse(readFileSync(new URL('../assets/items-3d/sources/manifest.json', import.meta.url)));
  const parts = readGlb().nodes.filter(node => node.mesh !== undefined).map(node => node.extras);
  for (const part of parts.filter(data => ['hair','hat','weapon','shield'].includes(data.shop_slot))) {
    const gender = part.fit_persona === 'male' ? 'boy' : 'girl';
    const expected = contract.characters[gender].anchors[part.attachment]?.world;
    assert.ok(expected, `Unknown mount ${part.attachment}`);
    assert.ok(part.attachment_origin.every((v,i) => Math.abs(v-expected.position[i]) < .000001));
    assert.ok(part.attachment_quaternion.every((v,i) => Math.abs(v-expected.quaternion[i]) < .000001));
    if (['hair','hat'].includes(part.shop_slot)) assert.equal(part.attachment, 'hat_seat');
    if (part.shop_id === 'pencil-sword') assert.equal(part.attachment, 'grip_right');
    if (part.shop_id === 'star-shield') assert.equal(part.attachment, 'wrist_left');
    if (part.shop_slot === 'weapon') assert.equal(part.attachment, 'grip_right');
    if (part.shop_slot === 'shield') assert.equal(part.attachment, 'grip_left');
  }
});

test('shareable looks validate item categories and preserve colour independently of the haircut', () => {
  const look = lookFromParams(new URLSearchParams('persona=female&hair=royal-hair&hairColor=blue-hair&skin=word-wand&hat=monk-cut&tone=dark'));
  assert.equal(look.persona, 'female');
  assert.equal(look.hair, DEFAULT_LOOK.hair);
  assert.equal(look.hairColor, 'blue-hair');
  assert.equal(look.tone, 'dark');
  assert.equal(look.skin, DEFAULT_LOOK.skin);
  assert.equal(look.hat, DEFAULT_LOOK.hat);
  assert.equal(lookFromParams(new URLSearchParams('hair=curly')).hair, 'curly');
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
  assert.equal(skirts.size,22);
  assert.equal(tops.size,22);
});

test('armoured outfits have fitted chest panels, articulated shoulders and full leg armour',()=>{
  const nodes=readGlb().nodes.filter(node=>node.mesh!==undefined);
  for(const persona of ['male','female']) for(const id of ['story-keeper','honor-knight','horse-keeper']){
    const parts=nodes.filter(node=>node.extras?.fit_persona===persona&&node.extras?.shop_id===id);
    const kind=name=>parts.filter(node=>node.extras.armour_construction===name).length;
    assert.ok(kind('anatomical fitted plate')>=6);
    assert.equal(kind('articulated shoulder'),6);
    assert.equal(kind('contoured greave'),2);
    assert.equal(kind('cuisse'),2);
    assert.equal(kind('vambrace'),2);
    assert.equal(kind('gorget'),1);
    assert.ok(parts.some(node=>node.name.includes('knee poleyn')));
    assert.ok(parts.some(node=>node.name.includes('hinge rivet')));
  }
  // The Knight is the Warrior's construction with more plates and gilding.
  const count=id=>nodes.filter(node=>node.extras?.fit_persona==='male'&&node.extras?.shop_id===id).length;
  assert.ok(count('honor-knight')>count('story-keeper'));
  assert.ok(count('horse-keeper')>count('honor-knight'));
  assert.ok(nodes.some(node=>node.extras?.shop_id==='honor-knight'&&node.name.includes('besagew')));
  assert.ok(nodes.some(node=>node.extras?.shop_id==='horse-keeper'&&node.name.includes('horseshoe')));
});

test('there is exactly one new outfit per level up to 10, each more detailed than the last tier', () => {
  const outfits = getShopItems('outfit').filter(outfit => outfit.id !== 'starter');
  assert.deepEqual(outfits.map(outfit => outfit.minLevel), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const nodes = readGlb().nodes.filter(node => node.mesh !== undefined && node.extras?.fit_persona === 'male');
  const pieces = id => nodes.filter(node => node.extras.shop_id === id).length;
  // Beginner tops stay light; the late outfits are the richest.
  assert.ok(pieces('bard') < pieces('vocab-ranger'));
  for (const late of ['cartographer', 'healer', 'alchemist']) assert.ok(pieces(late) > pieces('grammar-mage'), late);
  assert.equal(Math.max(...outfits.map(outfit => pieces(outfit.id))), pieces('horse-keeper'));
});

test('full outfits replace the trousers while every outfit keeps the delivered boots', () => {
  const nodes = readGlb().nodes.filter(node => node.mesh !== undefined);
  const core = nodes.filter(node => node.extras?.shop_slot === 'core');
  for (const persona of ['male', 'female']) {
    const mine = core.filter(node => node.extras.fit_persona === persona);
    assert.deepEqual(mine.map(node => node.extras.core_part).sort(), ['boots', 'trousers']);
  }
  const full = ['grammar-mage', 'black-mage', 'story-keeper', 'honor-knight', 'cartographer', 'healer', 'alchemist', 'horse-keeper'];
  for (const outfit of getShopItems('outfit')) {
    assert.equal(Boolean(outfit.coversLegs), full.includes(outfit.id), `${outfit.id} leg coverage`);
    for (const persona of ['male', 'female']) {
      const look = { ...DEFAULT_LOOK, persona, skin: outfit.id };
      const visible = core.map(node => node.extras).filter(part => visiblePart(part, look));
      assert.deepEqual(visible.map(part => part.core_part).sort(), outfit.coversLegs ? ['boots'] : ['boots', 'trousers']);
      if (outfit.coversLegs) {
        const legs = nodes.filter(node => node.extras?.fit_persona === persona && node.extras?.shop_id === outfit.id && node.name.includes('fitted hose'));
        assert.equal(legs.length, 3, `${persona}/${outfit.id} needs two hose legs and a seat`);
      }
    }
  }
});
