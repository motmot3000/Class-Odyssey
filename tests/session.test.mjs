import assert from "node:assert/strict";
import test from "node:test";

/* session.mjs parle au navigateur (localStorage, fetch, Web Crypto) et au
   serveur : on lui fournit les deux ici, pour vérifier les deux portes sans
   ouvrir Chrome. */
globalThis.document = { baseURI: "https://game-of-more.example/" };

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key)
};

let respond = () => {
  throw new Error("no backend");
};
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  return respond(url, options);
};

const {
  changePassword,
  getAccount,
  isAdultUnlocked,
  isSignedIn,
  lockAdult,
  sessionHeaders,
  signIn,
  signOut,
  signUp,
  unlockAdult,
  validateNewPassword,
  verifyPassword
} = await import("../src/session.mjs");

const ACCOUNT = { id: "abc123", username: "motmot3000", displayName: "Classes de motmot3000" };

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json; charset=utf-8" },
    json: async () => payload
  };
}

/* Ce que répond un hébergement statique, sans API : une page, pas du JSON. */
function pageResponse(status) {
  return {
    ok: false,
    status,
    headers: { get: () => "text/html; charset=utf-8" },
    json: async () => {
      throw new Error("not JSON");
    }
  };
}

test.beforeEach(() => {
  store.clear();
  calls.length = 0;
  respond = () => {
    throw new Error("no backend");
  };
});

test("an unknown device starts outside every door", () => {
  assert.equal(isSignedIn(), false);
  assert.equal(getAccount(), null);
  assert.deepEqual(sessionHeaders(), {});
});

test("signing in stores the token and the account", async () => {
  respond = () => jsonResponse(200, { ok: true, token: "tok-1", account: ACCOUNT });
  const result = await signIn(" MotMot3000 ", "121517");

  assert.equal(result.ok, true);
  assert.deepEqual(getAccount(), ACCOUNT);
  assert.deepEqual(sessionHeaders(), { "X-Session-Token": "tok-1" });
  assert.equal(JSON.parse(calls[0].options.body).username, "MotMot3000");
});

test("signing in leaves the console locked", async () => {
  respond = () => jsonResponse(200, { ok: true, token: "tok-1", account: ACCOUNT });
  await signIn("motmot3000", "121517");
  assert.equal(isAdultUnlocked(), false);
});

test("the wrong credentials never open a session", async () => {
  respond = () => jsonResponse(401, { error: "wrong username or password" });
  const result = await signIn("motmot3000", "guess");
  assert.equal(result.ok, false);
  assert.match(result.error, /Wrong username or password/);
  assert.equal(isSignedIn(), false);
});

test("a taken username is reported as such", async () => {
  respond = () => jsonResponse(409, { error: "this username is already taken" });
  const result = await signUp({ username: "motmot3000", displayName: "x", password: "soleil42" });
  assert.equal(result.ok, false);
  assert.match(result.error, /already taken/);
});

test("too many tries are answered with a waiting time", async () => {
  respond = () => jsonResponse(429, { error: "too many attempts", retryAfter: 240 });
  const result = await signIn("motmot3000", "guess");
  assert.match(result.error, /Wait 4 minutes/);
});

test("signing in needs the server, and says so plainly", async () => {
  const offline = await signIn("motmot3000", "121517");
  assert.equal(offline.ok, false);
  assert.match(offline.error, /server is unreachable/);

  respond = () => pageResponse(501);
  const staticHost = await signIn("motmot3000", "121517");
  assert.match(staticHost.error, /server is unreachable/);
});

test("signing out forgets the account even without the server", async () => {
  respond = () => jsonResponse(200, { ok: true, token: "tok-1", account: ACCOUNT });
  await signIn("motmot3000", "121517");
  unlockAdult();

  respond = () => {
    throw new Error("no backend");
  };
  await signOut();
  assert.equal(isSignedIn(), false);
  assert.equal(isAdultUnlocked(), false);
});

/* ---------- La seconde porte : la console ---------- */

test("the console never opens without a session", () => {
  unlockAdult();
  assert.equal(isAdultUnlocked(), false);
});

test("an expired unlock closes the console again", async () => {
  respond = () => jsonResponse(200, { ok: true, token: "tok-1", account: ACCOUNT });
  await signIn("motmot3000", "121517");

  store.set("game-of-more:adult", JSON.stringify({ until: Date.now() - 1000 }));
  assert.equal(isAdultUnlocked(), false);
  assert.equal(store.has("game-of-more:adult"), false);

  unlockAdult();
  assert.equal(isAdultUnlocked(), true);
  lockAdult();
  assert.equal(isAdultUnlocked(), false);
});

test("the console asks the server, and the server decides", async () => {
  respond = () => jsonResponse(200, { ok: true, token: "tok-1", account: ACCOUNT });
  await signIn("motmot3000", "121517");

  respond = () => jsonResponse(200, { ok: true });
  assert.equal((await verifyPassword("121517")).ok, true);

  respond = () => jsonResponse(401, { error: "wrong username or password" });
  const refused = await verifyPassword("guess");
  assert.equal(refused.ok, false);
  assert.match(refused.error, /Wrong password/);
});

test("an ended session is reported so the device can sign in again", async () => {
  respond = () => jsonResponse(200, { ok: true, token: "tok-1", account: ACCOUNT });
  await signIn("motmot3000", "121517");

  respond = () => jsonResponse(401, { error: "session expired" });
  const result = await verifyPassword("121517");
  assert.equal(result.expired, true);
});

test("a lesson without wifi can still open the console", async () => {
  respond = () => jsonResponse(200, { ok: true, token: "tok-1", account: ACCOUNT });
  await signIn("motmot3000", "121517");

  respond = () => {
    throw new Error("no backend");
  };
  const opened = await verifyPassword("121517");
  assert.equal(opened.ok, true);
  assert.equal(opened.offline, true);

  const refused = await verifyPassword("121518");
  assert.equal(refused.ok, false);
  assert.match(refused.error, /Wrong password/);
});

test("the offline check follows a password change", async () => {
  respond = () => jsonResponse(200, { ok: true, token: "tok-1", account: ACCOUNT });
  await signIn("motmot3000", "121517");

  respond = () => jsonResponse(200, { ok: true, updatedAt: "2026-08-24T09:00:00.000Z" });
  assert.deepEqual(await changePassword("121517", "nouvelle-classe"), { ok: true });

  respond = () => {
    throw new Error("no backend");
  };
  assert.equal((await verifyPassword("nouvelle-classe")).ok, true);
  assert.equal((await verifyPassword("121517")).ok, false);
});

test("changing the password needs the current one, and the server", async () => {
  respond = () => jsonResponse(401, { error: "wrong username or password" });
  const wrong = await changePassword("guess", "brand new one");
  assert.match(wrong.error, /current password is wrong/);

  respond = () => {
    throw new Error("no backend");
  };
  const offline = await changePassword("121517", "brand new one");
  assert.match(offline.error, /with the server reachable/);
});

test("a new password must be long enough and typed twice", () => {
  assert.match(validateNewPassword("abc", "abc"), /at least 4/);
  assert.match(validateNewPassword("abcd", "abce"), /do not match/);
  assert.match(validateNewPassword("x".repeat(200), "x".repeat(200)), /longer than/);
  assert.equal(validateNewPassword("abcd", "abcd"), "");
});
