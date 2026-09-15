import assert from "node:assert/strict";
import test from "node:test";

globalThis.document = { baseURI: "https://classquest.example/" };

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
  store.set("classquest:session", JSON.stringify({ token: "token-b", account: nextAccount }));
  assert.equal(session.isCurrentSession(old), false);
  assert.equal(session.forgetSession(old), false);
  assert.equal(session.getAccount().id, "account-b");
});

test("signout forgets authentication but does not delete account-scoped dirty state", async () => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  await session.signIn("teacher", "class-password");
  store.set("classquest:v1:account-a", JSON.stringify({ classes: [] }));
  store.set("classquest:v1:account-a:dirty", "1");
  respond = () => {
    throw new Error("offline");
  };
  await session.signOut();
  assert.equal(session.isSignedIn(), false);
  assert.ok(store.has("classquest:v1:account-a"));
  assert.equal(store.get("classquest:v1:account-a:dirty"), "1");
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

test("a wrong teacher password does not expire a valid account session", async () => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  await session.signIn("teacher", "class-password");
  respond = () => jsonResponse(401, { error: "wrong username or password" });
  const wrong = await session.verifyPassword("incorrect");
  assert.equal(wrong.ok, false);
  assert.equal(wrong.expired, undefined);
  assert.equal(wrong.error, "Wrong password.");
  assert.equal(session.isSignedIn(), true);
  respond = () => jsonResponse(401, { error: "not signed in" });
  assert.equal((await session.verifyPassword("class-password")).expired, true);
});

test("teacher unlock state cannot follow a switch to another account", async () => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  await session.signIn("teacher", "class-password");
  session.unlockAdult();
  assert.equal(session.isAdultUnlocked(), true);
  store.set(session.SESSION_KEY, JSON.stringify({ token: "token-b", account: { ...ACCOUNT, id: "account-b" } }));
  assert.equal(session.isAdultUnlocked(), false);
  assert.equal(session.unlockUntil(), null);
});

test("teacher access has a fixed five-minute deadline", async (t) => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  await session.signIn("teacher", "class-password");
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  session.unlockAdult();
  const deadline = session.unlockUntil();
  assert.equal(deadline, now + 5 * 60 * 1000);
  now += 299999;
  assert.equal(session.isAdultUnlocked(), true);
  assert.equal(session.unlockUntil(), deadline);
  now += 1;
  assert.equal(session.isAdultUnlocked(), false);
  assert.equal(session.isSignedIn(), true);
});

test("old long teacher grants are discarded", async () => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  await session.signIn("teacher", "class-password");
  store.set("classquest:adult", JSON.stringify({ accountId: ACCOUNT.id, until: Date.now() + 8 * 60 * 60 * 1000 }));
  assert.equal(session.isAdultUnlocked(), false);
  assert.equal(store.has("classquest:adult"), false);
});

test("offline password checks still reject stale account contexts", async () => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  await session.signIn("teacher", "class-password");
  let reject;
  respond = () => new Promise((_, no) => { reject = no; });
  const verification = session.verifyPassword("class-password");
  session.forgetSession();
  reject(new Error("offline"));
  assert.equal((await verification).stale, true);
});

test("signout returns immediately even when remote revocation never answers", async () => {
  respond = () => jsonResponse(200, { token: "token-a", account: ACCOUNT });
  await session.signIn("teacher", "class-password");
  respond = () => new Promise(() => {});
  let timer;
  try {
    await Promise.race([session.signOut(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("signout waited for the network")), 100);
    })]);
    assert.equal(session.isSignedIn(), false);
  } finally { clearTimeout(timer); }
});
