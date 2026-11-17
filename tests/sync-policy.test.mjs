import assert from "node:assert/strict";
import test from "node:test";
import {
  sharedState,
  classroomData,
  sameClassroomData,
  decideBootstrap,
  adoptRemoteState
} from "../src/sync-policy.mjs";

/* Two devices on one account. The bug being locked down here: opening another
 * class or focusing another hero on one machine used to bump the shared
 * revision, so the other machine then reported a conflict for classroom data
 * nobody had changed. */

const classroom = (extra = {}) => ({
  revision: 5,
  updatedAt: "2026-11-17T10:00:00.000Z",
  activeClassId: "7p",
  selectedPupilId: "p1",
  selectedPupilIds: ["p1"],
  selectMode: false,
  classes: [
    { id: "7p", name: "7P", pupils: [{ id: "p1", name: "Fatih", xp: 600, money: 125 }] },
    { id: "8p", name: "8P", pupils: [{ id: "p2", name: "Léo", xp: 200, money: 155 }] }
  ],
  rules: { xpStep: 10 },
  events: [],
  ...extra
});

test("view state never reaches the server", () => {
  const payload = sharedState(classroom());
  for (const field of ["activeClassId", "selectedPupilId", "selectedPupilIds", "selectMode"]) {
    assert.equal(Object.hasOwn(payload, field), false, `${field} must not be shared`);
  }
  assert.ok(Array.isArray(payload.classes));
});

test("switching class on one device is not a classroom change", () => {
  const surface = classroom({ activeClassId: "8p", selectedPupilId: "p2", selectedPupilIds: ["p2"] });
  const minix = classroom({ activeClassId: "7p", selectedPupilId: "p1", selectedPupilIds: ["p1"] });
  assert.equal(sameClassroomData(surface, minix), true);
  assert.equal(JSON.stringify(classroomData(surface)), JSON.stringify(classroomData(minix)));
});

test("a real XP change is a classroom change", () => {
  const before = classroom();
  const after = classroom({
    classes: [
      { id: "7p", name: "7P", pupils: [{ id: "p1", name: "Fatih", xp: 700, money: 125 }] },
      { id: "8p", name: "8P", pupils: [{ id: "p2", name: "Léo", xp: 200, money: 155 }] }
    ]
  });
  assert.equal(sameClassroomData(before, after), false);
});

test("an unchanged device adopts the server copy instead of conflicting", () => {
  const local = classroom();
  const remote = classroom({ revision: 6, updatedAt: "2026-11-17T10:05:00.000Z" });
  assert.equal(decideBootstrap({ local, remote, localDirty: false }), "adopt");
});

test("a stale dirty flag on identical data does not raise a conflict", () => {
  // This is the Surface case: the device kept `dirty` set while holding
  // exactly what the server already stored, at the same revision.
  const local = classroom();
  const remote = classroom();
  assert.equal(decideBootstrap({ local, remote, localDirty: true }), "adopt");
});

test("a stale dirty flag at an older revision still adopts when nothing differs", () => {
  // The machine was offline, the server moved on, but the classroom content is
  // the same on both sides: there is nothing to reconcile.
  const local = classroom({ revision: 3 });
  const remote = classroom({ revision: 9, updatedAt: "2026-11-17T11:00:00.000Z" });
  assert.equal(decideBootstrap({ local, remote, localDirty: true }), "adopt");
});

test("genuine local edits at the server revision are pushed", () => {
  const local = classroom({
    classes: [
      { id: "7p", name: "7P", pupils: [{ id: "p1", name: "Fatih", xp: 750, money: 125 }] },
      { id: "8p", name: "8P", pupils: [{ id: "p2", name: "Léo", xp: 200, money: 155 }] }
    ]
  });
  const remote = classroom();
  assert.equal(decideBootstrap({ local, remote, localDirty: true }), "push");
});

test("two devices that both edited since the last sync do conflict", () => {
  const local = classroom({
    classes: [
      { id: "7p", name: "7P", pupils: [{ id: "p1", name: "Fatih", xp: 750, money: 125 }] },
      { id: "8p", name: "8P", pupils: [{ id: "p2", name: "Léo", xp: 200, money: 155 }] }
    ]
  });
  const remote = classroom({
    revision: 9,
    classes: [
      { id: "7p", name: "7P", pupils: [{ id: "p1", name: "Fatih", xp: 600, money: 100 }] },
      { id: "8p", name: "8P", pupils: [{ id: "p2", name: "Léo", xp: 200, money: 155 }] }
    ]
  });
  assert.equal(decideBootstrap({ local, remote, localDirty: true }), "conflict");
});

test("adopting the server copy keeps this device's open class when it still exists", () => {
  const previous = classroom({ activeClassId: "8p", selectedPupilId: "p2", selectedPupilIds: ["p2"] });
  const remote = classroom({ revision: 7, activeClassId: "7p", selectedPupilId: "p1" });
  const next = adoptRemoteState(remote, previous);
  assert.equal(next.activeClassId, "8p");
  assert.equal(next.selectedPupilId, "p2");
  assert.equal(next.revision, 7);
});

test("a class that no longer exists falls back to the server's own view", () => {
  const previous = classroom({ activeClassId: "gone", selectedPupilId: "ghost" });
  const remote = classroom({ revision: 7, activeClassId: "8p", selectedPupilId: "p2" });
  const next = adoptRemoteState(remote, previous);
  assert.equal(next.activeClassId, "8p");
  assert.equal(next.selectedPupilId, "p2");
});
