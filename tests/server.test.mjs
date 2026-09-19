import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createGameServer, startServer } from "../server/server.mjs";

const FOUNDER = { username: "founder.test", password: "founder-secret" };

for (const { name, autoPort, dynamicPort } of [
  { name: "startup reports the actual OS-assigned port", autoPort: false, dynamicPort: true },
  { name: "development startup recovers from an occupied port", autoPort: true, dynamicPort: false },
  { name: "normal startup preserves the configured port on a conflict", autoPort: false, dynamicPort: false }
]) {
  test(name, { timeout: 5000 }, async (t) => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "class-odyssey-startup-"));
    const blocker = net.createServer();
    let server;
    t.after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      await new Promise((resolve) => blocker.close(resolve));
      fs.rmSync(dataDir, { recursive: true, force: true });
    });
    const log = t.mock.method(console, "log", () => {});
    const warn = t.mock.method(console, "warn", () => {});
    await new Promise((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", resolve);
    });
    const occupiedPort = blocker.address().port;
    server = startServer({
      dataDir,
      founderUsername: FOUNDER.username,
      founderPassword: FOUNDER.password,
      host: "127.0.0.1",
      port: dynamicPort ? 0 : occupiedPort,
      autoPort
    });
    if (!autoPort && !dynamicPort) {
      const error = await new Promise((resolve) => server.once("error", resolve));
      assert.equal(error.code, "EADDRINUSE");
      assert.equal(server.listening, false);
      assert.equal(log.mock.callCount(), 0);
      assert.equal(warn.mock.callCount(), 0);
      return;
    }
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;
    assert.ok(port > 0);
    assert.notEqual(port, occupiedPort);
    assert.deepEqual(log.mock.calls.map((call) => call.arguments), [
      [`Class Odyssey backend on http://127.0.0.1:${port}`]
    ]);
    assert.equal(warn.mock.callCount(), autoPort ? 1 : 0);
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
}

async function fixture({ legacyState, rateLimit, publicDir } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "class-odyssey-"));
  if (legacyState) fs.writeFileSync(path.join(dataDir, "state.json"), JSON.stringify(legacyState));
  const server = createGameServer({
    dataDir,
    founderUsername: FOUNDER.username,
    founderPassword: FOUNDER.password,
    rateLimit,
    publicDir
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
  return { dataDir, request, close, base, server };
}

async function signIn(request, username = FOUNDER.username, password = FOUNDER.password) {
  const result = await request("/api/session", { method: "POST", body: { username, password } });
  assert.equal(result.response.status, 200);
  return result.payload;
}

test("merged workshop entry points are served without exposing private files", async () => {
  const app = await fixture();
  try {
    for (const route of ["/items-3d.html", "/character-lab.html", "/character-detail-study.html", "/gamification.html", "/prototype/sheikah/index.html", "/assets/labs/index.html", "/assets/characters-refined/index.html"]) {
      const { response } = await app.request(route);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get("content-type"), /text\/html/);
    }
    for (const route of ["/.git", "/.env", "/.env.missing", "/server/server.mjs", "/server/missing.mjs", "/package.json"]) {
      assert.equal((await app.request(route)).response.status, 404, route);
    }
  } finally { await app.close(); }
});

test("oversized request bodies produce a usable 413 response", async () => {
  const app = await fixture();
  try {
    const result = await app.request("/api/session", { method: "POST", rawBody: JSON.stringify({ username: "x".repeat(6000) }) });
    assert.equal(result.response.status, 413);
    assert.equal(result.payload.error, "payload too large");
    assert.equal((await app.request("/api/health")).response.status, 200);
  } finally { await app.close(); }
});

test("static serving handles indexes and rejects missing assets, dotfiles and private symlinks", async () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "class-odyssey-public-"));
  fs.mkdirSync(path.join(publicDir, "assets", "demo"), { recursive: true });
  fs.writeFileSync(path.join(publicDir, "index.html"), "<h1>App</h1>");
  fs.writeFileSync(path.join(publicDir, "assets", "demo", "index.html"), "<h1>Workshop</h1>");
  fs.writeFileSync(path.join(publicDir, "assets", ".env"), "private-test-marker");
  const app = await fixture({ publicDir });
  try {
    fs.symlinkSync(path.join(app.dataDir, "accounts.json"), path.join(publicDir, "assets", "leak.json"));
    for (const route of ["/src/missing.mjs", "/assets/missing.glb", "/assets/.env", "/assets/leak.json"]) {
      assert.equal((await app.request(route)).response.status, 404, route);
    }
    const response = await fetch(app.base + "/assets/demo/");
    assert.equal(await response.text(), "<h1>Workshop</h1>");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    const head = await fetch(app.base + "/assets/demo/index.html", { method: "HEAD" });
    assert.equal(await head.text(), "");
    assert.equal(head.headers.get("content-length"), String(Buffer.byteLength("<h1>Workshop</h1>")));
  } finally { await app.close(); fs.rmSync(publicDir, { recursive: true, force: true }); }
});

test("a token revoked while a state body arrives cannot perform a late write", async () => {
  const app = await fixture();
  let upload;
  try {
    const { token } = await signIn(app.request);
    const received = new Promise(resolve => app.server.once("request", resolve));
    const result = new Promise((resolve, reject) => {
      upload = http.request(app.base + "/api/state", { method: "PUT", headers: { "X-Session-Token": token, "Content-Type": "application/json" } }, response => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      });
      upload.on("error", reject);
    });
    upload.write('{"revision":0,"classes":');
    await received;
    await app.request("/api/session", { method: "DELETE", token });
    upload.end('[{"id":"7p","pupils":[{"id":"late","name":"Late write"}]}]}');
    assert.equal(await result, 401);
    const next = await signIn(app.request);
    const state = await app.request("/api/state", { token: next.token });
    assert.equal(state.payload.revision, 0);
    assert.equal(state.payload.classes.length, 0);
  } finally { upload?.destroy(); await app.close(); }
});

async function signUp(request, username, password = "teacher-secret") {
  const result = await request("/api/accounts", {
    method: "POST",
    body: { username, email: `${username}@example.test`, displayName: `Class ${username}`, password }
  });
  assert.equal(result.response.status, 201);
  return result.payload;
}

test("first initialization requires environment-supplied founder credentials", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "class-odyssey-init-"));
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
    assert.deepEqual(empty.payload.classes, []);
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

test("account settings and email persist per account and stay changeable", async () => {
  const app = await fixture();
  try {
    const teacher = await signUp(app.request, "settings.teacher");
    assert.ok(teacher.account.email.startsWith("settings.teacher@") && teacher.account.email.includes("."));
    assert.deepEqual(teacher.account.settings, { language: null, theme: null, onboarding: { completed: false, step: 0 } });

    const updated = await app.request("/api/account/settings", {
      method: "PUT", token: teacher.token,
      body: { language: "fr", theme: "dark", onboarding: { step: 2 } }
    });
    assert.equal(updated.response.status, 200);
    assert.deepEqual(updated.payload.account.settings, { language: "fr", theme: "dark", onboarding: { completed: false, step: 2 } });

    // A partial patch keeps the keys it does not send.
    const completed = await app.request("/api/account/settings", {
      method: "PUT", token: teacher.token, body: { onboarding: { completed: true } }
    });
    assert.deepEqual(completed.payload.account.settings, { language: "fr", theme: "dark", onboarding: { completed: true, step: 2 } });

    // Invalid values are ignored rather than stored.
    const invalid = await app.request("/api/account/settings", {
      method: "PUT", token: teacher.token, body: { theme: "neon", language: "de" }
    });
    assert.equal(invalid.payload.account.settings.theme, "dark");
    assert.equal(invalid.payload.account.settings.language, "fr");

    // Settings are protected and signup requires a usable email address.
    assert.equal((await app.request("/api/account/settings", { method: "PUT", body: { theme: "dark" } })).response.status, 401);
    assert.equal((await app.request("/api/accounts", { method: "POST", body: { username: "noemail", password: "password" } })).response.status, 400);
    assert.equal((await app.request("/api/accounts", { method: "POST", body: { username: "bademail", email: "nope", password: "password" } })).response.status, 400);
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
    teacherState.payload.classes = [{ id: "7p", name: "7P", pupils: [{ id: "pupil", name: "Pupil" }] }];
    teacherState.payload.activeClassId = "7p";
    await app.request("/api/state", { method: "PUT", token: teacher.token, body: teacherState.payload });

    assert.equal((await app.request("/api/admin/accounts", { token: teacher.token })).response.status, 403);
    const listing = await app.request("/api/admin/accounts", { token: founder.token });
    assert.equal(listing.response.status, 200);
    const item = listing.payload.accounts.find((entry) => entry.id === teacher.account.id);
    assert.equal(item.pupilCount, 1);
    assert.equal(item.activeSessionCount, 2);
    assert.ok(item.createdAt);
    assert.ok(item.lastLoginAt);
    assert.deepEqual(Object.keys(item).sort(), ["activeSessionCount", "createdAt", "email", "id", "lastLoginAt", "pupilCount", "role", "username"]);
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
