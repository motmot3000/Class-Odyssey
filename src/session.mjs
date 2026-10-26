/* Account sessions and the five-minute classroom teacher gate.
 * Capture the account/token before asynchronous work; never apply a late
 * response to a different session. The teacher gate is not server-side auth.
 */
import { requestApi } from "./api.mjs";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "./password-policy.mjs";

// Persisted keys retain their historical prefix for existing installations.
export const SESSION_KEY = "classquest:session";
const UNLOCK_KEY = "classquest:adult";
export const TEACHER_UNLOCK_MS = 5 * 60 * 1000;
const PBKDF2_ROUNDS = 150_000;
let authGeneration = 0;

export const SESSION_ENDED = "The session ended. Sign in again.";

function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A private browser session may not provide persistent storage.
  }
}

export function getSession() {
  const session = readStored(SESSION_KEY);
  if (!session?.token || !session?.account?.id) return null;
  return session;
}

export const getAccount = () => getSession()?.account ?? null;
export const isSignedIn = () => getSession() !== null;
// Pass the captured context, not a fresh session, when completing async work.
export const sessionHeaders = (context = captureSessionContext()) => {
  const token = context?.token;
  return token ? { "X-Session-Token": token } : {};
};

export function captureSessionContext() {
  const session = getSession();
  return session ? { accountId: session.account.id, token: session.token } : null;
}

export function isCurrentSession(context) {
  const current = getSession();
  return Boolean(context && current && context.accountId === current.account.id && context.token === current.token);
}

async function deriveVerifier(password, saltHex) {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const pairs = saltHex.match(/../g);
    if (!pairs) return null;
    const salt = Uint8Array.from(pairs.map((byte) => parseInt(byte, 16)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
      key,
      256
    );
    return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

async function makeVerifier(password) {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) return null;
  const salt = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const verifier = await deriveVerifier(password, salt);
  return verifier ? { salt, verifier } : null;
}

async function matchesVerifier(password, offline) {
  if (!offline?.salt || !offline?.verifier) return false;
  const derived = await deriveVerifier(password, offline.salt);
  return derived !== null && derived === offline.verifier;
}

export function isAdultUnlocked() {
  const session = getSession();
  const unlock = readStored(UNLOCK_KEY);
  if (!session || unlock?.accountId !== session.account.id) return false;
  const until = Number(unlock?.until);
  if (!Number.isFinite(until)) return false;
  const now = Date.now();
  // Discard old eight-hour grants as well as expired grants.
  if (until <= now || until > now + TEACHER_UNLOCK_MS) {
    lockAdult();
    return false;
  }
  return true;
}

export const unlockUntil = () => isAdultUnlocked() ? Number(readStored(UNLOCK_KEY)?.until) : null;
export const unlockAdult = () => {
  const account = getAccount();
  if (account) writeStored(UNLOCK_KEY, { accountId: account.id, until: Date.now() + TEACHER_UNLOCK_MS });
};
export const lockAdult = () => writeStored(UNLOCK_KEY, null);

export function validateNewPassword(next, confirmation) {
  const chosen = String(next ?? "");
  if (chosen.trim().length < MIN_PASSWORD_LENGTH) return `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (chosen.length > MAX_PASSWORD_LENGTH) return `The password cannot be longer than ${MAX_PASSWORD_LENGTH} characters.`;
  if (String(confirmation ?? "") !== chosen) return "The two passwords do not match.";
  return "";
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const looksLikeApi = (response) => (response.headers?.get("content-type") || "").includes("json");
const OFFLINE = "The server is unreachable. Check the connection and try again.";

function retryMessage(payload) {
  const seconds = Number(payload?.retryAfter);
  const minutes = Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds / 60)) : 5;
  return `Too many tries. Wait ${minutes} minute${minutes > 1 ? "s" : ""} and try again.`;
}

async function callApi(path, { method = "POST", body, context = captureSessionContext() } = {}) {
  let response;
  try {
    response = await requestApi(path, {
      method,
      headers: { "Content-Type": "application/json", ...sessionHeaders(context) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    return { offline: true, context };
  }
  if (!looksLikeApi(response)) return { offline: true, context };
  return { response, payload: await readJson(response), context };
}

async function openSession(path, credentials) {
  const generation = ++authGeneration;
  const { offline, response, payload } = await callApi(path, { body: credentials, context: null });
  if (offline) return { ok: false, error: OFFLINE };
  if (generation !== authGeneration) return { ok: false, stale: true, error: "A newer sign-in replaced this request." };
  if (response.status === 429) return { ok: false, error: retryMessage(payload) };
  if (response.status === 401) return { ok: false, error: "Wrong username or password." };
  if (!response.ok) return { ok: false, error: payload?.error || "The server refused the request." };
  if (!payload?.token || !payload?.account) return { ok: false, error: "The server sent an unexpected answer." };
  const offlineVerifier = await makeVerifier(credentials.password);
  if (generation !== authGeneration) return { ok: false, stale: true, error: "A newer sign-in replaced this request." };
  writeStored(SESSION_KEY, {
    token: payload.token,
    account: payload.account,
    offline: offlineVerifier
  });
  lockAdult();
  // The account was just created with this password: let its teacher set up
  // the first class without asking them to type it again immediately.
  if (path === "accounts") unlockAdult();
  return { ok: true, account: payload.account };
}

export const signIn = (username, password) =>
  openSession("session", { username: String(username ?? "").trim(), password: String(password ?? "") });

export const signUp = ({ username, email, password, termsAccepted = false }) =>
  openSession("accounts", {
    username: String(username ?? "").trim(),
    email: String(email ?? "").trim(),
    password: String(password ?? ""),
    termsAccepted: Boolean(termsAccepted)
  });

/* Google sign-in returns a one-time code through the URL; exchanging it stores
 * the same session shape as password sign-in, without an offline verifier. */
export async function signInWithGoogleCode(code) {
  const generation = ++authGeneration;
  const { offline, response, payload } = await callApi("auth/google/exchange", {
    body: { code: String(code ?? "") },
    context: null
  });
  if (offline) return { ok: false, error: OFFLINE };
  if (generation !== authGeneration) return { ok: false, stale: true, error: "A newer sign-in replaced this request." };
  if (!response.ok || !payload?.token || !payload?.account) {
    return { ok: false, error: payload?.error || "The server refused the request." };
  }
  writeStored(SESSION_KEY, { token: payload.token, account: payload.account });
  lockAdult();
  if (payload.created === true) unlockAdult();
  return { ok: true, account: payload.account };
}

export async function setupTeacherPassword(password, recovery = false) {
  const context = captureSessionContext();
  const { offline, response, payload } = await callApi(recovery ? "account/teacher-password/recover" : "account/teacher-password", {
    method: "PUT", body: { password: String(password ?? "") }, context
  });
  if (offline) return { ok: false, error: OFFLINE };
  if (!isCurrentSession(context)) return { ok: false, stale: true, error: "The account changed while saving." };
  if (!response.ok || !payload?.account) return { ok: false, error: payload?.error || "The server refused the new password." };
  const offlineVerifier = await makeVerifier(password);
  if (!isCurrentSession(context)) return { ok: false, stale: true, error: "The account changed while saving." };
  const session = getSession();
  writeStored(SESSION_KEY, { ...session, account: payload.account, offline: offlineVerifier });
  return { ok: true, account: payload.account };
}

/* Account settings (language, theme, onboarding) live on the server account so
 * they survive across devices while remaining changeable at any time. */
export async function updateSettings(patch) {
  const context = captureSessionContext();
  const { offline, response, payload } = await callApi("account/settings", { method: "PUT", body: patch, context });
  if (offline) return { ok: false, offline: true, error: OFFLINE };
  if (!isCurrentSession(context)) return { ok: false, stale: true, error: "The account changed while saving." };
  if (response.status === 401) return { ok: false, error: SESSION_ENDED };
  if (!response.ok || !payload?.account) return { ok: false, error: payload?.error || "The server refused the request." };
  const session = readStored(SESSION_KEY);
  if (session && session.account?.id === payload.account.id) {
    writeStored(SESSION_KEY, { ...session, account: payload.account });
  }
  return { ok: true, account: payload.account };
}

/* Profile changes move the display name and the email identity (username)
 * together, so the session account is refreshed from the server answer. */
export async function updateProfile(patch) {
  const context = captureSessionContext();
  const { offline, response, payload } = await callApi("account/profile", { method: "PUT", body: patch, context });
  if (offline) return { ok: false, offline: true, error: OFFLINE };
  if (!isCurrentSession(context)) return { ok: false, stale: true, error: "The account changed while saving." };
  if (response.status === 401) return { ok: false, error: SESSION_ENDED };
  if (!response.ok || !payload?.account) return { ok: false, error: payload?.error || "The server refused the request." };
  const session = readStored(SESSION_KEY);
  if (session && session.account?.id === payload.account.id) {
    writeStored(SESSION_KEY, { ...session, account: payload.account });
  }
  return { ok: true, account: payload.account };
}

/* Recovery is a two-step, email-delivered flow: ask for a code, then confirm
 * it with a new password. Both steps work signed out. */
export async function requestPasswordReset(email, lang = "fr") {
  const { offline, response, payload } = await callApi("session/password/reset", {
    body: { email: String(email ?? "").trim(), lang: lang === "en" ? "en" : "fr" },
    context: null
  });
  if (offline) return { ok: false, offline: true, error: OFFLINE };
  if (response.status === 429) return { ok: false, error: retryMessage(payload) };
  if (!response.ok) return { ok: false, error: payload?.error || "The server refused the request." };
  return { ok: true, delivered: Boolean(payload?.delivered) };
}

export async function confirmPasswordReset(email, code, next) {
  const { offline, response, payload } = await callApi("session/password/reset/confirm", {
    body: { email: String(email ?? "").trim(), code: String(code ?? "").trim(), next: String(next ?? "") },
    context: null
  });
  if (offline) return { ok: false, offline: true, error: OFFLINE };
  if (response.status === 429) return { ok: false, error: retryMessage(payload) };
  if (response.status === 400) return { ok: false, error: payload?.error || "The code is invalid or has expired." };
  if (!response.ok) return { ok: false, error: payload?.error || "The server refused the request." };
  const session = getSession();
  if (session) writeStored(SESSION_KEY, { ...session, offline: await makeVerifier(next) });
  return { ok: true };
}

/* Help requests are delivered to the admin console inbox. */
export async function sendSupportMessage({ category, subject, message }) {
  const context = captureSessionContext();
  const { offline, response, payload } = await callApi("support/messages", {
    method: "POST",
    body: { category, subject, message },
    context
  });
  if (offline) return { ok: false, offline: true, error: OFFLINE };
  if (!isCurrentSession(context)) return { ok: false, stale: true, error: "The account changed while saving." };
  if (response.status === 429) return { ok: false, error: retryMessage(payload) };
  if (response.status === 401) return { ok: false, error: SESSION_ENDED };
  if (!response.ok) return { ok: false, error: payload?.error || "The server refused the request." };
  return { ok: true, id: payload?.id };
}

/* Records the legal-text acceptance for accounts created through a provider
 * (Google), whose redirect flow cannot display the sign-up checkbox. */
export async function acceptTerms() {
  const context = captureSessionContext();
  const { offline, response, payload } = await callApi("account/terms", { method: "PUT", context, body: {} });
  if (offline) return { ok: false, offline: true, error: OFFLINE };
  if (!isCurrentSession(context)) return { ok: false, stale: true, error: "The account changed while saving." };
  if (!response.ok || !payload?.account) return { ok: false, error: payload?.error || "The server refused the request." };
  const session = getSession();
  if (session && session.account?.id === payload.account.id) {
    writeStored(SESSION_KEY, { ...session, account: payload.account });
  }
  return { ok: true, account: payload.account };
}

export async function signOut() {
  ++authGeneration;
  const context = captureSessionContext();
  writeStored(SESSION_KEY, null);
  lockAdult();
  if (!context) return;
  // Local sign-out is immediate even if token revocation is slow or offline.
  // The request captures the old token, so it cannot revoke a subsequent login.
  void requestApi("session", {
    method: "DELETE", headers: sessionHeaders(context),
  }, 8000).catch(() => {});
}

export function forgetSession(context = null) {
  if (context && !isCurrentSession(context)) return false;
  ++authGeneration;
  writeStored(SESSION_KEY, null);
  lockAdult();
  return true;
}

export async function verifyPassword(password) {
  const typed = String(password ?? "");
  if (!typed) return { ok: false, error: "Type the password first." };
  const result = await callApi("session/verify", { body: { password: typed } });
  if (!isCurrentSession(result.context)) return { ok: false, stale: true, error: "The account changed while checking." };
  if (result.offline) {
    const matches = await matchesVerifier(typed, getSession()?.offline);
    if (!isCurrentSession(result.context)) return { ok: false, stale: true, error: "The account changed while checking." };
    if (matches) return { ok: true, offline: true };
    return { ok: false, error: getSession()?.offline ? "Wrong password." : OFFLINE };
  }
  if (!isCurrentSession(result.context)) return { ok: false, stale: true, error: "The account changed while checking." };
  if (result.response.status === 429) return { ok: false, error: retryMessage(result.payload) };
  if (result.response.status === 401) {
    if (result.payload?.error === "not signed in") return { ok: false, expired: true, error: SESSION_ENDED };
    return { ok: false, error: "Wrong password." };
  }
  if (!result.response.ok) return { ok: false, error: "The server could not check the password. Try again." };
  return { ok: true };
}

export async function changePassword(current, next) {
  const result = await callApi("session/password", {
    method: "PUT",
    body: { current: String(current ?? ""), next: String(next ?? "") }
  });
  if (result.offline) return { ok: false, error: "The password can only be changed with the server reachable." };
  if (!isCurrentSession(result.context)) return { ok: false, stale: true, error: "The account changed while saving." };
  if (result.response.status === 429) return { ok: false, error: retryMessage(result.payload) };
  if (result.response.status === 401) return { ok: false, error: "The current password is wrong." };
  if (!result.response.ok) return { ok: false, error: result.payload?.error || "The server refused the new password." };
  const offline = await makeVerifier(String(next ?? ""));
  if (!isCurrentSession(result.context)) return { ok: false, stale: true, error: "The account changed while saving." };
  const currentSession = getSession();
  if (currentSession) writeStored(SESSION_KEY, { ...currentSession, offline });
  return { ok: true };
}
