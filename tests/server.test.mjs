import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createGameServer } from "../server/server.mjs";

const FOUNDER = { username: "founder.test", password: "founder-secret" };

async function fixture({ legacyState, rateLimit } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-of-more-"));
  if (legacyState) fs.writeFileSync(path.join(dataDir, "state.json"), JSON.stringify(legacyState));
  const server = createGameServer({
    dataDir,
    founderUsername: FOUNDER.username,
    founderPassword: FOUNDER.password,
    rateLimit
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  async function request(route, { method = "GET", token, body, rawBody } = {}) {
    const headers = {};
    if (token) headers["X-Session-Token"] = token;
    if (body !== undefined || rawBody !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${base}${route}`, {
      method,
      headers,
      body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  return { dataDir, request, close };
}

async function signIn(request, username = FOUNDER.username, password = FOUNDER.password) {
  const result = await request("/api/session", { method: "POST", body: { username, password } });
  assert.equal(result.response.status, 200);
  return result.payload;
}

async function signUp(request, username, password = "teacher-secret") {
  const result = await request("/api/accounts", {
    method: "POST",
    body: { username, displayName: `Class ${username}`, password }
  });
  assert.equal(result.response.status, 201);
  return result.payload;
}

test("first initialization requires environment-supplied founder credentials", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-of-more-init-"));
  try {
    assert.throws(() => createGameServer({ dataDir }), /FOUNDER_USERNAME and FOUNDER_PASSWORD/);
    assert.equal(fs.existsSync(path.join(dataDir, "accounts.json")), false);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("legacy state is transactionally adopted by the admin founder and retained for recovery", async () => {
  const legacy = {
    activeClassId: "7p",
    classes: [{ id: "7p", name: "7P", pupils: [{ id: "legacy-pupil", name: "Legacy" }] }],
    events: []
  };
  const app = await fixture({ legacyState: legacy });
  try {
    assert.equal(fs.existsSync(path.join(app.dataDir, "state.json")), false);
    assert.equal(fs.existsSync(path.join(app.dataDir, "state.json.migrated")), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(app.dataDir, "state.json.migrated"), "utf8")), legacy);

    const founder = await signIn(app.request);
    assert.equal(founder.account.role, "admin");
    const state = await app.request("/api/state", { token: founder.token });
    assert.equal(state.payload.classes[0].pupils[0].name, "Legacy");
    assert.equal(state.payload.revision, 0);

    const stored = fs.readFileSync(path.join(app.dataDir, "accounts.json"), "utf8");
    assert.doesNotMatch(stored, new RegExp(FOUNDER.password));
  } finally {
    await app.close();
  }
});

test("signup, sessions, empty state, isolation, backups and revision conflicts work over HTTP", async () => {
  const app = await fixture();
  try {
    const alpha = await signUp(app.request, "teacher.alpha");
    const beta = await signUp(app.request, "teacher.beta");
    assert.equal(alpha.account.role, "teacher");

    const empty = await app.request("/api/state", { token: alpha.token });
    assert.equal(empty.response.status, 200);
    assert.deepEqual(empty.payload.classes.map((item) => [item.name, item.pupils.length]), [["7P", 0], ["8P", 0]]);
    assert.equal(empty.payload.revision, 0);
    assert.equal((await app.request("/api/state", { method: "PUT", token: alpha.token, rawBody: "[]" })).response.status, 400);
    assert.equal((await app.request("/api/state", { method: "PUT", token: alpha.token, body: { revision: 0, classes: [1] } })).response.status, 400);
    assert.equal((await app.request("/api/session/verify", { method: "POST", token: alpha.token, rawBody: "true" })).response.status, 400);

    const alphaState = {
      ...empty.payload,
      classes: [{ id: "7p", name: "7P", pupils: [{ id: "alpha-pupil", name: "Alpha pupil" }] }]
    };
    const saved = await app.request("/api/state", { method: "PUT", token: alpha.token, body: alphaState });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.payload.revision, 1);

    const betaState = await app.request("/api/state", { token: beta.token });
    assert.equal(betaState.payload.classes.some((item) => item.pupils.length), false);

    const stale = await app.request("/api/state", { method: "PUT", token: alpha.token, body: alphaState });
    assert.equal(stale.response.status, 409);
    assert.deepEqual(stale.payload, { error: "state revision conflict", revision: 1 });
    const current = await app.request("/api/state", { token: alpha.token });
    assert.equal(current.payload.classes[0].pupils[0].name, "Alpha pupil");

    const backups = path.join(app.dataDir, "accounts", alpha.account.id, "backups");
    assert.ok(fs.readdirSync(backups).some((name) => name.startsWith("state-")));

    const signedOut = await app.request("/api/session", { method: "DELETE", token: beta.token });
    assert.equal(signedOut.response.status, 200);
    const rejected = await app.request("/api/state", { token: beta.token });
    assert.equal(rejected.response.status, 401);
  } finally {
    await app.close();
  }
});

test("password changes revoke other sessions while preserving the requesting session", async () => {
  const app = await fixture();
  try {
    const created = await signUp(app.request, "teacher.password", "old-password");
    const second = await signIn(app.request, "teacher.password", "old-password");
    const changed = await app.request("/api/session/password", {
      method: "PUT",
      token: created.token,
      body: { current: "old-password", next: "new-password" }
    });
    assert.equal(changed.response.status, 200);
    assert.equal((await app.request("/api/session", { token: created.token })).response.status, 200);
    assert.equal((await app.request("/api/session", { token: second.token })).response.status, 401);
    assert.equal((await app.request("/api/session", { method: "POST", body: { username: "teacher.password", password: "old-password" } })).response.status, 401);
    assert.equal((await app.request("/api/session", { method: "POST", body: { username: "teacher.password", password: "new-password" } })).response.status, 200);
  } finally {
    await app.close();
  }
});

test("admin listing and password reset are protected, sanitized and revoke target sessions", async () => {
  const app = await fixture();
  try {
    const founder = await signIn(app.request);
    const teacher = await signUp(app.request, "teacher.admin", "before-reset");
    const teacherSecond = await signIn(app.request, "teacher.admin", "before-reset");
    const teacherState = await app.request("/api/state", { token: teacher.token });
    teacherState.payload.classes[0].pupils.push({ id: "pupil", name: "Pupil" });
    await app.request("/api/state", { method: "PUT", token: teacher.token, body: teacherState.payload });

    assert.equal((await app.request("/api/admin/accounts", { token: teacher.token })).response.status, 403);
    const listing = await app.request("/api/admin/accounts", { token: founder.token });
    assert.equal(listing.response.status, 200);
    const item = listing.payload.accounts.find((entry) => entry.id === teacher.account.id);
    assert.equal(item.pupilCount, 1);
    assert.equal(item.activeSessionCount, 2);
    assert.ok(item.createdAt);
    assert.ok(item.lastLoginAt);
    assert.deepEqual(Object.keys(item).sort(), ["activeSessionCount", "createdAt", "id", "lastLoginAt", "pupilCount", "role", "username"]);
    assert.equal(JSON.stringify(listing.payload).includes("hash"), false);
    assert.equal(JSON.stringify(listing.payload).includes(teacher.token), false);

    assert.equal((await app.request(`/api/admin/accounts/${founder.account.id}/password`, {
      method: "PUT", token: founder.token, body: { password: "not-allowed" }
    })).response.status, 400);
    const reset = await app.request(`/api/admin/accounts/${teacher.account.id}/password`, {
      method: "PUT", token: founder.token, body: { password: "after-reset" }
    });
    assert.equal(reset.response.status, 200);
    assert.equal((await app.request("/api/session", { token: teacher.token })).response.status, 401);
    assert.equal((await app.request("/api/session", { token: teacherSecond.token })).response.status, 401);
    assert.equal((await app.request("/api/session", { method: "POST", body: { username: "teacher.admin", password: "after-reset" } })).response.status, 200);
  } finally {
    await app.close();
  }
});

test("scalar JSON is rejected and signin/signup throttling does not depend on username existence", async () => {
  const app = await fixture({ rateLimit: { maxAttempts: 2, windowMs: 60_000 } });
  try {
    assert.equal((await app.request("/api/accounts", { method: "POST", rawBody: "42" })).response.status, 400);
    assert.equal((await app.request("/api/accounts", { method: "POST", rawBody: "null" })).response.status, 400);
    assert.equal((await app.request("/api/accounts", { method: "POST", body: { username: "blocked", password: "password" } })).response.status, 429);
  } finally {
    await app.close();
  }

  const signinApp = await fixture({ rateLimit: { maxAttempts: 2, windowMs: 60_000 } });
  try {
    const first = await signinApp.request("/api/session", { method: "POST", body: { username: "does.not.exist", password: "wrong" } });
    const second = await signinApp.request("/api/session", { method: "POST", body: { username: FOUNDER.username, password: "wrong" } });
    const blocked = await signinApp.request("/api/session", { method: "POST", body: { username: FOUNDER.username, password: FOUNDER.password } });
    assert.equal(first.response.status, 401);
    assert.equal(second.response.status, 401);
    assert.equal(first.payload.error, second.payload.error);
    assert.equal(blocked.response.status, 429);
  } finally {
    await signinApp.close();
  }
});

test("the latest account index can be recovered from its atomic backup", async () => {
  const app = await fixture();
  try {
    const teacher = await signUp(app.request, "teacher.recovery");
    fs.writeFileSync(path.join(app.dataDir, "accounts.json"), "broken", "utf8");
    const recovered = await app.request("/api/session", {
      method: "POST",
      body: { username: "teacher.recovery", password: "teacher-secret" }
    });
    assert.equal(recovered.response.status, 200);
    assert.equal(recovered.payload.account.id, teacher.account.id);

    fs.rmSync(path.join(app.dataDir, "accounts.json"));
    const recoveredAfterDeletion = await app.request("/api/session", {
      method: "POST",
      body: { username: "teacher.recovery", password: "teacher-secret" }
    });
    assert.equal(recoveredAfterDeletion.response.status, 200);
    assert.equal(recoveredAfterDeletion.payload.account.id, teacher.account.id);
  } finally {
    await app.close();
  }
});
