import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';

const approved = new URL('../assets/characters-approved/faces-v1/', import.meta.url);
const hash = data => createHash('sha256').update(data).digest('hex');

function glb(url) {
  const bytes = readFileSync(url);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  const length = bytes.readUInt32LE(12);
  return { json: JSON.parse(bytes.subarray(20, 20 + length)), bin: bytes.subarray(28 + length) };
}

function frozenSurface(url) {
  const { json, bin } = glb(url);
  const result = new Map();
  function tuple(id, index, count) {
    if (id === undefined) return [];
    const accessor = json.accessors[id], view = json.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType, 5126, 'Expected float position, normal or UV');
    const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0) + index * (view.byteStride || count * 4);
    return Array.from({ length: count }, (_, i) => bin.readFloatLE(offset + i * 4));
  }
  const quantize = (values, scale) => values.map(value => Math.round(value * scale));
  function visit(id, parent, inherited) {
    const node = json.nodes[id];
    const transform = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3(...(node.translation || [0, 0, 0])),
      new Quaternion(...(node.rotation || [0, 0, 0, 1])),
      new Vector3(...(node.scale || [1, 1, 1])),
    );
    const world = parent.clone().multiply(transform);
    const data = { ...inherited, ...node.extras };
    if (node.mesh !== undefined && ['hair', 'persona'].includes(data.shop_slot)) {
      const normalMatrix = new Matrix3().getNormalMatrix(world);
      for (const primitive of json.meshes[node.mesh].primitives) {
        const attributes = primitive.attributes;
        const count = json.accessors[attributes.POSITION].count;
        for (let i = 0; i < count; i++) {
          const p = new Vector3(...tuple(attributes.POSITION, i, 3)).applyMatrix4(world);
          if (data.shop_slot !== 'hair' && p.y < 1.455) continue;
          const normal = new Vector3(...tuple(attributes.NORMAL, i, 3)).applyMatrix3(normalMatrix).normalize();
          const uv = tuple(attributes.TEXCOORD_0, i, 2);
          const key = JSON.stringify([quantize(p.toArray(), 1e5), quantize(uv, 1e5)]);
          const normals = result.get(key) || [];
          normals.push(normal.toArray());
          result.set(key, normals);
        }
      }
    }
    for (const child of node.children || []) visit(child, world, data);
  }
  for (const root of json.scenes[json.scene || 0].nodes) visit(root, new Matrix4(), {});
  return result;
}

test('approved face snapshots and previews retain their recorded SHA-256', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', approved)));
  assert.equal(manifest.revision, 'approved-faces-v1');
  assert.equal(Object.keys(manifest.files).length, 6);
  for (const [file, expected] of Object.entries(manifest.files)) {
    assert.equal(hash(readFileSync(new URL(file, approved))), expected, `Approved file changed: ${file}`);
  }
});

test('body v2 preserves approved head and hair positions, normals and UVs', () => {
  for (const gender of ['girl', 'boy']) {
    const reference = frozenSurface(new URL(`${gender}-approved.glb`, approved));
    const proposal = frozenSurface(new URL(`../assets/character-detail-study/${gender}-athletic.glb`, import.meta.url));
    assert.ok(reference.size > 1000, `${gender}: missing protected surface`);
    assert.deepEqual(new Set(proposal.keys()), new Set(reference.keys()), `${gender}: protected positions or UVs changed`);
    // Blender stores imported custom normals at finite precision. Compare
    // vector distance rather than rounded bins (a rounding boundary is not
    // a changed surface); 0.001 corresponds to less than 0.06 degrees.
    for (const [key, normals] of reference) {
      const candidates = proposal.get(key);
      for (const normal of normals) {
        assert.ok(candidates.some(candidate => normal.reduce((sum, v, i) => sum + (v - candidate[i]) ** 2, 0) <= 1e-6), `${gender}: protected normal changed at ${key}`);
      }
    }
  }
});
