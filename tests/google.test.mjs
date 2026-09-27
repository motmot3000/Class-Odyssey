import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createGameServer } from "../server/server.mjs";
import { createGoogleAuth, decodeIdToken, claimsProblem } from "../server/google.mjs";

const FOUNDER = { username: "founder.test", password: "founder-secret" };
const CLIENT_ID = "class-odyssey.apps.googleusercontent.com";

function idToken(claims) {
  return ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");
}

function googleClaims(overrides = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: "marie.dupont@example.test",
    email_verified: true,
    name: "Marie Dupont",
    ...overrides
  };
}

async function fixture({ google = true, claims = googleClaims(), tokenStatus = 200 } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "class-odyssey-google-"));
  const tokenCalls = [];
  const fetchImpl = async (url, options = {}) => {
    assert.equal(url, "https://oauth2.googleapis.com/token");
    tokenCalls.push({ url: String(url), body: String(options.body || "") });
    if (tokenStatus !== 200) return new Response("{}", { status: tokenStatus });
    return new Response(JSON.stringify({ id_token: idToken(claims), access_token: "access" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  const server = createGameServer({
    dataDir,
    founderUsername: FOUNDER.username,
    founderPassword: FOUNDER.password,
    googleClientId: google ? CLIENT_ID : "",
    googleClientSecret: google ? "google-secret" : "",
    fetchImpl
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    tokenCalls,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  };
}

function cookieFrom(response) {
  return (response.headers.getSetCookie?.() || []).map((value) => value.split(";")[0]).join("; ");
}

async function startFlow(base) {
  const start = await fetch(`${base}/api/auth/google`, { redirect: "manual" });
  assert.equal(start.status, 302);
  const location = new URL(start.headers.get("location"));
  assert.equal(location.origin + location.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(location.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(location.searchParams.get("response_type"), "code");
  assert.equal(location.searchParams.get("scope"), "openid email profile");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.equal(location.searchParams.get("redirect_uri"), `${base}/api/auth/google/callback`);
  return { state: location.searchParams.get("state"), cookie: cookieFrom(start) };
}

async function completeFlow(base, { state, cookie }, query = "") {
  const callback = await fetch(`${base}/api/auth/google/callback?code=fake-code&state=${encodeURIComponent(state)}${query}`, {
    headers: { Cookie: cookie },
    redirect: "manual"
  });
  assert.equal(callback.status, 302);
  return callback.headers.get("location");
}

test("Google sign-in creates an account from the verified email, then reuses it", async () => {
  const app = await fixture();
  try {
    assert.deepEqual(await (await fetch(`${app.base}/api/config`)).json(), { google: true });

    const flow = await startFlow(app.base);
    const location = await completeFlow(app.base, flow);
    assert.match(location, /^\/\?google_code=/);
    assert.equal(app.tokenCalls.length, 1);
    assert.match(app.tokenCalls[0].body, /code_verifier=/);
    assert.match(app.tokenCalls[0].body, /code=fake-code/);

    const code = new URL(location, app.base).searchParams.get("google_code");
    const exchanged = await fetch(`${app.base}/api/auth/google/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    assert.equal(exchanged.status, 200);
    const login = await exchanged.json();
    assert.equal(login.account.email, "marie.dupont@example.test");
    assert.equal(login.account.username, "marie.dupont@example.test");
    assert.equal(login.account.displayName, "Marie Dupont");
    assert.equal(login.account.teacherPasswordSetupRequired, true);
    // Provider accounts accept the legal texts once, from the in-app panel.
    assert.equal(login.account.terms, null);
    const accepted = await fetch(`${app.base}/api/account/terms`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Session-Token": login.token },
      body: "{}"
    });
    assert.equal(accepted.status, 200);
    const acceptedPayload = await accepted.json();
    assert.equal(acceptedPayload.account.terms.version, "2026-09-18");
    assert.ok(acceptedPayload.account.terms.acceptedAt);
    // Accepting twice keeps the first timestamp.
    const again = await (await fetch(`${app.base}/api/account/terms`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Session-Token": login.token },
      body: "{}"
    })).json();
    assert.equal(again.account.terms.acceptedAt, acceptedPayload.account.terms.acceptedAt);

    const teacherPassword = "short-but-private";
    const headers = { "Content-Type": "application/json", "X-Session-Token": login.token };
    const verifyBeforeSetup = await fetch(`${app.base}/api/session/verify`, {
      method: "POST", headers, body: JSON.stringify({ password: teacherPassword })
    });
    assert.equal(verifyBeforeSetup.status, 403);
    const setup = await fetch(`${app.base}/api/account/teacher-password`, {
      method: "PUT", headers, body: JSON.stringify({ password: teacherPassword })
    });
    assert.equal(setup.status, 200);
    assert.equal((await setup.json()).account.teacherPasswordSetupRequired, false);
    const repeatedSetup = await fetch(`${app.base}/api/account/teacher-password`, {
      method: "PUT", headers, body: JSON.stringify({ password: "replacement-secret" })
    });
    assert.equal(repeatedSetup.status, 409);
    const verify = await fetch(`${app.base}/api/session/verify`, {
      method: "POST", headers, body: JSON.stringify({ password: teacherPassword })
    });
    assert.equal(verify.status, 200);
    const passwordSignIn = await fetch(`${app.base}/api/session`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: login.account.email, password: teacherPassword })
    });
    assert.equal(passwordSignIn.status, 401);

    // A code is single use.
    const replay = await fetch(`${app.base}/api/auth/google/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    assert.equal(replay.status, 400);

    const session = await fetch(`${app.base}/api/session`, { headers: { "X-Session-Token": login.token } });
    assert.equal(session.status, 200);

    // Signing in again with the same email keeps the same account.
    const second = await completeFlow(app.base, await startFlow(app.base));
    const secondCode = new URL(second, app.base).searchParams.get("google_code");
    const secondLogin = await (await fetch(`${app.base}/api/auth/google/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: secondCode })
    })).json();
    assert.equal(secondLogin.account.id, login.account.id);
    assert.equal(secondLogin.account.teacherPasswordSetupRequired, false);
    const changePassword = await fetch(`${app.base}/api/session/password`, {
      method: "PUT", headers: { ...headers, "X-Session-Token": secondLogin.token },
      body: JSON.stringify({ current: teacherPassword, next: "new-console-secret" })
    });
    assert.equal(changePassword.status, 200);
    const recovered = await fetch(`${app.base}/api/account/teacher-password/recover`, {
      method: "PUT", headers: { ...headers, "X-Session-Token": secondLogin.token },
      body: JSON.stringify({ password: "recovered-console-secret" })
    });
    assert.equal(recovered.status, 200);
    assert.equal((await recovered.json()).account.googleOnly, true);
    const afterRecovery = await fetch(`${app.base}/api/session/verify`, {
      method: "POST", headers: { ...headers, "X-Session-Token": secondLogin.token },
      body: JSON.stringify({ password: "recovered-console-secret" })
    });
    assert.equal(afterRecovery.status, 200);
  } finally {
    await app.close();
  }
});

test("trusted proxy prefix keeps OAuth cookie, callback URI and return path on the public subpath", () => {
  const auth = createGoogleAuth({ clientId: CLIENT_ID, clientSecret: "test", trustProxy: true });
  const req = {
    headers: { host: "www.thomaswunsche.com", "x-forwarded-proto": "https", "x-forwarded-prefix": "/classodyssey" },
    socket: { encrypted: false }
  };
  let headers;
  const res = { writeHead: (_status, value) => { headers = value; }, end: () => {} };
  auth.start(req, res);
  assert.equal(new URL(headers.Location).searchParams.get("redirect_uri"), "https://www.thomaswunsche.com/classodyssey/api/auth/google/callback");
  assert.match(headers["Set-Cookie"], /Path=\/classodyssey\/api\/auth\/google;.*Secure/);
  auth.callback({ ...req, url: "/api/auth/google/callback?error=access_denied" }, res, () => {});
  assert.equal(headers.Location, "/classodyssey/?google_error=denied");
});

test("Google sign-in links an existing password account with the same email", async () => {
  const app = await fixture();
  try {
    const signup = await fetch(`${app.base}/api/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "marie.dupont@example.test", password: "teacher-secret", termsAccepted: true })
    });
    assert.equal(signup.status, 201);
    const created = await signup.json();

    const location = await completeFlow(app.base, await startFlow(app.base));
    const code = new URL(location, app.base).searchParams.get("google_code");
    const login = await (await fetch(`${app.base}/api/auth/google/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    })).json();
    assert.equal(login.account.id, created.account.id);
    assert.equal(login.account.googleOnly, false);
    const deniedRecovery = await fetch(`${app.base}/api/account/teacher-password/recover`, {
      method: "PUT", headers: { "X-Session-Token": login.token, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "replacement-secret" })
    });
    assert.equal(deniedRecovery.status, 403);
  } finally {
    await app.close();
  }
});

test("Google callback rejects a missing state and an unverified email", async () => {
  const app = await fixture();
  try {
    const noState = await fetch(`${app.base}/api/auth/google/callback?code=fake&state=forged`, { redirect: "manual" });
    assert.equal(noState.status, 302);
    assert.match(noState.headers.get("location"), /google_error=state/);

    const unverified = await fixture({ claims: googleClaims({ email_verified: false }) });
    try {
      const flow = await startFlow(unverified.base);
      const location = await completeFlow(unverified.base, flow);
      assert.match(location, /google_error=email/);
    } finally {
      await unverified.close();
    }

    const denied = await fetch(`${app.base}/api/auth/google/callback?error=access_denied`, { redirect: "manual" });
    assert.match(denied.headers.get("location"), /google_error=denied/);
  } finally {
    await app.close();
  }
});

test("Google sign-in stays hidden and unavailable without credentials", async () => {
  const app = await fixture({ google: false });
  try {
    assert.deepEqual(await (await fetch(`${app.base}/api/config`)).json(), { google: false });
    const start = await fetch(`${app.base}/api/auth/google`, { redirect: "manual" });
    assert.match(start.headers.get("location"), /google_error=unavailable/);
  } finally {
    await app.close();
  }
});

test("id token claims are validated against issuer, audience and expiry", () => {
  const token = idToken(googleClaims());
  assert.equal(decodeIdToken(token).email, "marie.dupont@example.test");
  assert.equal(decodeIdToken("not-a-jwt"), null);
  assert.equal(claimsProblem(decodeIdToken(token), CLIENT_ID), null);
  assert.equal(claimsProblem(googleClaims({ iss: "evil.example" }), CLIENT_ID), "issuer");
  assert.equal(claimsProblem(googleClaims({ aud: "other-client" }), CLIENT_ID), "audience");
  assert.equal(claimsProblem(googleClaims({ exp: 1 }), CLIENT_ID), "expired");
  assert.equal(claimsProblem(googleClaims({ email_verified: false }), CLIENT_ID), "email");
});
