import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { BASE_CHARACTER_TONES } from "../src/characters.mjs";

const root=new URL("../assets/characters-base/",import.meta.url);

test("integrated character bundle contains valid base-only GLBs and lightweight portraits", async () => {
  for(const gender of ["boy","girl"]) for(const tone of BASE_CHARACTER_TONES){
    const data=await readFile(new URL(`${gender}-${tone}.glb`,root));
    assert.equal(data.readUInt32LE(0),0x46546c67);
    assert.equal(data.readUInt32LE(4),2);
    assert.equal(data.readUInt32LE(8),data.length);
    const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString("utf8"));
    assert.ok(json.meshes.length>0);
    assert.ok(json.nodes.some(node=>node.extras?.cosmetic_slot==="hair"));
    assert.ok(!json.nodes.some(node=>["item","pack"].includes(node.extras?.wardrobe_slot)));
    assert.ok(!json.nodes.some(node=>node.extras?.wardrobe_slot==="outfit"&&node.extras.wardrobe_variant!=="base"));
    const small=await stat(new URL(`${gender}-${tone}-small.webp`,root));
    assert.ok(small.size>1000&&small.size<60000);
    assert.ok((await stat(new URL(`${gender}-${tone}.webp`,root))).size>small.size);
  }
});

test("shared item attachment contract has finite transforms and normalized quaternions", async () => {
  const manifest=JSON.parse(await readFile(new URL("manifest.json",root),"utf8"));
  assert.equal(manifest.up,"+Y");assert.equal(manifest.forward,"+Z");assert.equal(manifest.units,"metres");
  assert.equal(manifest.pose.armsFromT,82);
  const required=["skull_center","skull_top","hair_top","hat_seat","forehead","temple_left","temple_right","occiput","neck","nape","shoulder_left","shoulder_right","wrist_left","wrist_right","grip_left","grip_right"];
  for(const gender of ["boy","girl"]){
    const entry=manifest.characters[gender];
    assert.ok(entry.height>1.7&&entry.height<1.9);
    for(const key of required){
      const anchor=entry.anchors[key];assert.ok(anchor,`${gender}: ${key}`);
      for(const frame of ["local","world"]){
        assert.equal(anchor[frame].position.length,3);
        assert.ok(anchor[frame].position.every(Number.isFinite));
        const q=anchor[frame].quaternion;
        assert.equal(q.length,4);assert.ok(q.every(Number.isFinite));
        assert.ok(Math.abs(Math.hypot(...q)-1)<.00001);
      }
    }
    assert.ok(entry.anchors.wrist_left.local.position[0]>0);
    assert.ok(entry.anchors.wrist_right.local.position[0]<0);
    assert.ok(entry.anchors.wrist_left.local.position[1]<1.0);
    assert.ok(entry.anchors.hat_seat.ellipse.rx>0&&entry.anchors.hat_seat.ellipse.rz>0);
  }
});
