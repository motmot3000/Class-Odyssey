import assert from "node:assert/strict";
import test from "node:test";
import { createSharedResource } from "../src/shared-resource.mjs";
import { alphaBounds } from "../src/portrait-image.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("concurrent viewers share one load; reset disposes an obsolete late result", async () => {
  const first = deferred();
  let loads = 0, disposed = 0;
  const second = { name: "current", destroy() { disposed += 1; } };
  const resource = createSharedResource(() => ++loads === 1 ? first.promise : second);
  const old = resource.get();
  assert.equal(old, resource.get());
  await Promise.resolve();
  resource.reset();
  assert.equal(await resource.get(), second);
  first.resolve({ destroy() { disposed += 1; } });
  assert.equal(await old, null);
  assert.equal(disposed, 1);
  assert.equal(resource.peek(), second);
  resource.reset();
  resource.reset();
  assert.equal(disposed, 2);
});

test("an obsolete rejection cannot clear or fail a newer viewer", async () => {
  const first = deferred();
  const current = {};
  let loads = 0;
  const resource = createSharedResource(() => ++loads === 1 ? first.promise : current);
  const old = resource.get();
  await Promise.resolve();
  resource.reset();
  await resource.get();
  first.reject(new Error("old request failed"));
  assert.equal(await old, null);
  assert.equal(await resource.get(), current);
  assert.equal(loads, 2);
});

test("failed current loads can be retried", async () => {
  let attempts = 0;
  const resource = createSharedResource(() => {
    if (++attempts === 1) throw new Error("offline");
    return { ready: true };
  });
  await assert.rejects(resource.get(), /offline/);
  assert.deepEqual(await resource.get(), { ready: true });
});

test("portrait bounds retain equipment at image edges and ignore transparent margins", () => {
  const pixels = new Uint8ClampedArray(6 * 8 * 4);
  assert.equal(alphaBounds(pixels, 6, 8), null);
  for (const [x, y] of [[0, 2], [3, 7], [5, 1]]) pixels[(y * 6 + x) * 4 + 3] = 255;
  assert.deepEqual(alphaBounds(pixels, 6, 8), { x: 0, y: 1, width: 6, height: 7 });
});
