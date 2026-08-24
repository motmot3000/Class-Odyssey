import { apiUrl } from "./api.mjs";

const SESSION_KEY = "game-of-more:session";
const UNLOCK_KEY = "game-of-more:adult";
const UNLOCK_MS = 8 * 60 * 60 * 1000;
const PBKDF2_ROUNDS = 150_000;
let authGeneration = 0;

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 128;

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
export const sessionHeaders = () => {
  const token = getSession()?.token;
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
  if (!isSignedIn()) return false;
  const until = Number(readStored(UNLOCK_KEY)?.until);
  if (!Number.isFinite(until)) return false;
  if (until <= Date.now()) {
    lockAdult();
    return false;
  }
  return true;
}

export const unlockUntil = () => Number(readStored(UNLOCK_KEY)?.until) || null;
export const unlockAdult = () => writeStored(UNLOCK_KEY, { until: Date.now() + UNLOCK_MS });
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
    response = await fetch(apiUrl(path), {
      method,
      headers: { "Content-Type": "application/json", ...(context ? { "X-Session-Token": context.token } : {}) },
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
  return { ok: true, account: payload.account };
}

export const signIn = (username, password) =>
  openSession("session", { username: String(username ?? "").trim(), password: String(password ?? "") });

export const signUp = ({ username, displayName, password }) =>
  openSession("accounts", {
    username: String(username ?? "").trim(),
    displayName: String(displayName ?? "").trim(),
    password: String(password ?? "")
  });

export async function signOut() {
  ++authGeneration;
  const context = captureSessionContext();
  writeStored(SESSION_KEY, null);
  lockAdult();
  if (!context) return;
  try {
    await fetch(apiUrl("session"), { method: "DELETE", headers: { "X-Session-Token": context.token } });
  } catch {
    // The server-side token expires by itself.
  }
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
  if (result.offline) {
    if (await matchesVerifier(typed, getSession()?.offline)) return { ok: true, offline: true };
    return { ok: false, error: getSession()?.offline ? "Wrong password." : OFFLINE };
  }
  if (!isCurrentSession(result.context)) return { ok: false, stale: true, error: "The account changed while checking." };
  if (result.response.status === 429) return { ok: false, error: retryMessage(result.payload) };
  if (result.response.status === 401) return { ok: false, expired: true, error: "The session ended. Sign in again." };
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
