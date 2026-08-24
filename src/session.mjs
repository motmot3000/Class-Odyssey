/* ============================================================
   session.mjs — le compte de l'enseignant
   Deux portes, un seul mot de passe. La première ouvre l'application sur
   les données d'un compte : l'enseignant la franchit, puis la classe
   navigue librement. La seconde ouvre la console : retaper le mot de
   passe prouve que c'est bien l'adulte qui tient l'appareil.

   Portée honnête : la seconde porte empêche un élève d'attribuer des
   points, elle ne remplace pas une autorisation côté serveur — voir
   BACKEND.md.
   ============================================================ */

import { apiUrl } from "./api.mjs";

const SESSION_KEY = "game-of-more:session";
const UNLOCK_KEY = "game-of-more:adult";

/* Une journée d'école : assez long pour ne pas retaper le mot de passe
   entre deux périodes, assez court pour qu'un écran oublié se referme. */
const UNLOCK_MS = 8 * 60 * 60 * 1000;

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 128;

const PBKDF2_ROUNDS = 150_000;

/* ---------- Mémoire de l'appareil ---------- */

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
    // Stockage indisponible (navigation privée…) : la session ne survivra
    // pas au rechargement, mais l'écran courant fonctionne.
  }
}

export function getSession() {
  const session = readStored(SESSION_KEY);
  if (!session?.token || !session?.account?.id) return null;
  return session;
}

export const getAccount = () => getSession()?.account ?? null;
export const isSignedIn = () => getSession() !== null;

export function sessionHeaders() {
  const token = getSession()?.token;
  return token ? { "X-Session-Token": token } : {};
}

/* ---------- Vérificateur hors ligne ----------
   Une classe sans wifi doit continuer à recevoir des points. À la
   connexion, l'appareil garde de quoi reconnaître le mot de passe sans
   le serveur : une dérivation lente, salée, propre à cet appareil — et
   jamais le mot de passe lui-même. */

async function deriveVerifier(password, saltHex) {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const salt = Uint8Array.from(saltHex.match(/../g).map((byte) => parseInt(byte, 16)));
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

/* ---------- Porte 2 : la console ---------- */

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

/* ---------- Règles partagées ---------- */

export function validateNewPassword(next, confirmation) {
  const chosen = String(next ?? "");
  if (chosen.trim().length < MIN_PASSWORD_LENGTH) {
    return `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (chosen.length > MAX_PASSWORD_LENGTH) {
    return `The password cannot be longer than ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (String(confirmation ?? "") !== chosen) {
    return "The two passwords do not match.";
  }
  return "";
}

/* ---------- Dialogue avec le serveur ---------- */

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/* Un hébergement statique répond bien quelque chose à /api/… — une page
   d'erreur, un « method not allowed » en texte. Seul le type de la réponse
   dit si une vraie API se trouve au bout du fil. */
const looksLikeApi = (response) => (response.headers?.get("content-type") || "").includes("json");

function retryMessage(payload) {
  const seconds = Number(payload?.retryAfter);
  const minutes = Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds / 60)) : 5;
  return `Too many wrong tries. Wait ${minutes} minute${minutes > 1 ? "s" : ""} and try again.`;
}

const OFFLINE = "The server is unreachable. Check the connection and try again.";

async function callApi(path, { method = "POST", body } = {}) {
  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers: { "Content-Type": "application/json", ...sessionHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    return { offline: true };
  }
  if (!looksLikeApi(response)) return { offline: true };
  return { response, payload: await readJson(response) };
}

async function openSession(path, credentials) {
  const { offline, response, payload } = await callApi(path, { body: credentials });
  if (offline) return { ok: false, error: OFFLINE };
  if (response.status === 429) return { ok: false, error: retryMessage(payload) };
  if (response.status === 401) return { ok: false, error: "Wrong username or password." };
  if (response.status === 409) return { ok: false, error: "This username is already taken." };
  if (!response.ok) return { ok: false, error: payload?.error || "The server refused the request." };
  if (!payload?.token || !payload?.account) return { ok: false, error: "The server sent an unexpected answer." };

  writeStored(SESSION_KEY, {
    token: payload.token,
    account: payload.account,
    offline: await makeVerifier(credentials.password)
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

/* La déconnexion vaut même sans réseau : l'appareil oublie d'abord, le
   serveur est prévenu si la ligne le permet. */
export async function signOut() {
  const token = getSession()?.token;
  writeStored(SESSION_KEY, null);
  lockAdult();
  if (!token) return;
  try {
    await fetch(apiUrl("session"), { method: "DELETE", headers: { "X-Session-Token": token } });
  } catch {
    // Le jeton expirera de lui-même côté serveur.
  }
}

/* Appelée quand le serveur ne reconnaît plus le jeton : l'appareil se
   déconnecte sans rien demander à personne. */
export function forgetSession() {
  writeStored(SESSION_KEY, null);
  lockAdult();
}

export async function verifyPassword(password) {
  const typed = String(password ?? "");
  if (!typed) return { ok: false, error: "Type the password first." };

  const { offline, response, payload } = await callApi("session/verify", { body: { password: typed } });

  if (offline) {
    const stored = getSession()?.offline;
    if (await matchesVerifier(typed, stored)) return { ok: true, offline: true };
    return { ok: false, error: stored ? "Wrong password." : OFFLINE };
  }
  if (response.status === 429) return { ok: false, error: retryMessage(payload) };
  if (response.status === 401) {
    if (payload?.error === "not signed in" || payload?.error === "session expired") {
      return { ok: false, expired: true, error: "The session ended. Sign in again." };
    }
    return { ok: false, error: "Wrong password." };
  }
  if (!response.ok) return { ok: false, error: "The server could not check the password. Try again." };
  return { ok: true };
}

export async function changePassword(current, next) {
  const { offline, response, payload } = await callApi("session/password", {
    method: "PUT",
    body: { current: String(current ?? ""), next: String(next ?? "") }
  });

  if (offline) return { ok: false, error: "The password can only be changed with the server reachable." };
  if (response.status === 429) return { ok: false, error: retryMessage(payload) };
  if (response.status === 401) return { ok: false, error: "The current password is wrong." };
  if (!response.ok) return { ok: false, error: payload?.error || "The server refused the new password." };

  /* Le vérificateur hors ligne doit suivre le nouveau mot de passe, sinon
     la console refuserait de s'ouvrir à la prochaine coupure. */
  const session = getSession();
  if (session) writeStored(SESSION_KEY, { ...session, offline: await makeVerifier(String(next ?? "")) });
  return { ok: true };
}
