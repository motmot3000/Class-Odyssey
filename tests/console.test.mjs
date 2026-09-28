import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createGameServer } from "../server/server.mjs";
import { createConsoleServer } from "../admin-console/server.mjs";

const KEY = "test-key-0123456789-0123456789-0123456789";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test("the local console controls real accounts without exposing credentials", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "odyssey-console-"));
  const backend = createGameServer({ dataDir, consoleKey: KEY, founderUsername: "founder.test", founderPassword: "founder-secret" });
  const remote = await listen(backend);
  const consoleServer = createConsoleServer({ apiUrl: remote, key: KEY });
  const local = await listen(consoleServer);
  const restrictedServer = createConsoleServer({ apiUrl: remote, key: KEY, host: "0.0.0.0", allowedCidr: [10, 20, 0, 0].join(".") + "/16" });
  const restrictedLocal = await listen(restrictedServer);
  t.after(async () => {
    await new Promise((resolve) => restrictedServer.close(resolve));
    await new Promise((resolve) => consoleServer.close(resolve));
    await new Promise((resolve) => backend.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  const post = (url, body) => fetch(`${remote}${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const signup = await (await post("/api/accounts", { username: "teacher.one", displayName: "Classe Une", email: "one@example.test", password: "teacher-secret", termsAccepted: true })).json();
  const id = signup.account.id;
  fs.writeFileSync(path.join(dataDir, "support-messages.json"), JSON.stringify({ messages: [{ id: "0123456789abcdef", at: "2026-09-24T18:00:00.000Z", status: "open", note: "", accountId: id, username: "teacher.one", displayName: "Classe Une", email: "one@example.test", category: "bug", subject: "Un souci", message: "Besoin d’aide" }] }));
  const founder = await (await post("/api/session", { username: "founder.test", password: "founder-secret" })).json();
  const headers = { Origin: local, "Content-Type": "application/json" };
  const call = (route, method, body, custom = headers) => fetch(`${local}${route}`, { method, headers: custom, body: body === undefined ? undefined : JSON.stringify(body) });

  assert.equal((await fetch(`${remote}/api/console/overview`)).status, 401);
  assert.equal((await fetch(`${restrictedLocal}/api/overview`)).status, 200);
  assert.equal((await fetch(`${remote}/admin-console/index.html`)).status, 404);
  const reboundStatus = await new Promise((resolve, reject) => {
    http.get(local, { headers: { Host: "rebound.example" } }, (response) => { response.resume(); resolve(response.statusCode); }).on("error", reject);
  });
  assert.equal(reboundStatus, 403);
  assert.equal((await call(`/api/accounts/${id}`, "PATCH", { status: "suspended" }, { ...headers, Origin: "http://evil.example" })).status, 403);
  assert.equal((await call(`/api/accounts/${founder.account.id}`, "DELETE", { confirmUsername: "founder.test" })).status, 403);

  const listed = await (await fetch(`${local}/api/overview`)).json();
  const teacher = listed.accounts.find((item) => item.id === id);
  assert.equal(teacher.email, "one@example.test");
  assert.equal(teacher.recentAccesses[0].ip, "127.0.0.1");
  assert.equal(teacher.recentAccesses[0].location, null);
  assert.equal(listed.geoipAvailable, false);
  assert.equal(listed.subscriptionsAvailable, false);
  assert.equal(listed.supportUnread, 1);
  assert.equal(JSON.stringify(listed).includes("scrypt$"), false);
  assert.equal(JSON.stringify(listed).includes(signup.token), false);
  assert.equal(JSON.stringify(listed).includes("teacher-secret"), false);

  assert.equal((await fetch(`${remote}/api/console/support`)).status, 401);
  const inbox = await (await fetch(`${local}/api/support`)).json();
  assert.equal(inbox.unread, 1);
  assert.equal(inbox.messages[0].subject, "Un souci");
  assert.equal((await call("/api/support/0123456789abcdef", "PATCH", { status: "other" })).status, 400);
  const updatedSupport = await (await call("/api/support/0123456789abcdef", "PATCH", { status: "read", note: "Réponse en cours" })).json();
  assert.equal(updatedSupport.message.status, "read");
  assert.equal((await fetch(`${local}/api/overview`).then((response) => response.json())).supportUnread, 0);

  assert.equal((await call(`/api/accounts/${id}`, "PATCH", { role: "admin" })).status, 400);
  assert.equal((await call(`/api/accounts/${id}`, "PATCH", { displayName: "Nouvelle classe", moderationNote: "À suivre" })).status, 200);
  assert.equal((await call(`/api/accounts/${id}`, "PATCH", { status: "suspended" })).status, 200);
  assert.equal((await fetch(`${remote}/api/session`, { headers: { "X-Session-Token": signup.token } })).status, 401);
  assert.equal((await post("/api/session", { username: "teacher.one", password: "teacher-secret" })).status, 401);
  assert.equal((await call(`/api/accounts/${id}`, "PATCH", { status: "active" })).status, 200);
  const relog = await (await post("/api/session", { username: "teacher.one", password: "teacher-secret" })).json();
  assert.ok(relog.token);
  assert.equal((await call(`/api/accounts/${id}/sessions`, "DELETE")).status, 200);
  assert.equal((await fetch(`${remote}/api/session`, { headers: { "X-Session-Token": relog.token } })).status, 401);
  assert.equal((await call(`/api/accounts/${id}`, "DELETE", { confirmUsername: "wrong" })).status, 400);
  assert.equal((await call(`/api/accounts/${id}`, "DELETE", { confirmUsername: "teacher.one" })).status, 200);
  assert.equal(fs.existsSync(path.join(dataDir, "accounts", id)), false);
  assert.equal((await fetch(`${local}/api/overview`).then((response) => response.json())).accounts.some((item) => item.id === id), false);
  const audit = await (await fetch(`${local}/api/audit`)).json();
  assert.ok(audit.entries.some((item) => item.accountId === id && item.action === "account.deleted"));
  assert.equal(JSON.stringify(audit).includes("one@example.test"), false);
});
