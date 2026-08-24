import assert from "node:assert/strict";
import test from "node:test";

globalThis.document = { baseURI: "https://game-of-more.example/" };

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key)
};

let respond;
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  return respond(url, options);
};

const session = await import("../src/session.mjs");
const ACCOUNT = { id: "account-a", username: "teacher", displayName: "Teacher", role: "teacher" };

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json; charset=utf-8" },
    json: async () => payload
  };
}

test.beforeEach(() => {
  store.clear();
  calls.length = 0;
  respond = () => {
    throw new Error("offline");
  };
});

test("signin stores only the current token/account and leaves the teacher gate locked", async () => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  assert.equal((await session.signIn("teacher", "class-password")).ok, true);
  assert.deepEqual(session.getAccount(), ACCOUNT);
  assert.deepEqual(session.sessionHeaders(), { "X-Session-Token": "token-a" });
  assert.equal(session.isAdultUnlocked(), false);
  session.unlockAdult();
  assert.equal(session.isAdultUnlocked(), true);
});

test("captured session contexts prevent an old async response from clearing a newer account", async () => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  await session.signIn("teacher", "class-password");
  const old = session.captureSessionContext();

  const nextAccount = { ...ACCOUNT, id: "account-b", username: "other" };
  store.set("game-of-more:session", JSON.stringify({ token: "token-b", account: nextAccount }));
  assert.equal(session.isCurrentSession(old), false);
  assert.equal(session.forgetSession(old), false);
  assert.equal(session.getAccount().id, "account-b");
});

test("signout forgets authentication but does not delete account-scoped dirty state", async () => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  await session.signIn("teacher", "class-password");
  store.set("game-of-more:v1:account-a", JSON.stringify({ classes: [] }));
  store.set("game-of-more:v1:account-a:dirty", "1");
  respond = () => {
    throw new Error("offline");
  };
  await session.signOut();
  assert.equal(session.isSignedIn(), false);
  assert.ok(store.has("game-of-more:v1:account-a"));
  assert.equal(store.get("game-of-more:v1:account-a:dirty"), "1");
});

test("password validation and API failures are reported safely", async () => {
  assert.match(session.validateNewPassword("abc", "abc"), /at least 4/);
  assert.match(session.validateNewPassword("abcd", "other"), /do not match/);
  assert.equal(session.validateNewPassword("valid-password", "valid-password"), "");

  respond = () => jsonResponse(401, { error: "wrong username or password" });
  const refused = await session.signIn("unknown", "wrong");
  assert.equal(refused.ok, false);
  assert.match(refused.error, /Wrong username or password/);
  assert.equal(session.isSignedIn(), false);
});
