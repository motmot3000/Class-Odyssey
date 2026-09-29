import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import maxmind from "maxmind";
import { createApi } from "./api.mjs";
import { createGoogleAuth } from "./google.mjs";
import { createStaticHandler } from "./static.mjs";
import { createMailer, passwordResetEmail } from "./mail.mjs";
import { cleanSupportText, createSupportStore, supportLimits } from "./support.mjs";
import { isStateDocument } from "../src/state-schema.mjs";
import { TERMS_VERSION } from "../src/terms.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_DIR = path.join(__dirname, "..");

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let rejected = false;
    req.on("data", (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > limit) {
        rejected = true;
        chunks.length = 0;
        const error = new Error("payload too large");
        error.status = 413;
        reject(error);
        // Drain the remaining body; destroying the socket would discard the 413.
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => { if (!rejected) resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("aborted", () => reject(new Error("request aborted")));
    req.on("error", reject);
  });
}

async function readJsonObject(req, res, limit = 4 * 1024) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req, limit));
  } catch (error) {
    if (req.aborted || res.destroyed) return null;
    sendJson(res, error.status || 400, { error: error.status ? "payload too large" : "invalid JSON" });
    return null;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    sendJson(res, 400, { error: "JSON body must be an object" });
    return null;
  }
  return payload;
}

const stringField = (payload, key) => (typeof payload[key] === "string" ? payload[key] : "");

// Strip control and bidirectional characters that could spoof the interface.
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
function cleanDisplayName(value) {
  return String(value || "").replace(UNSAFE_NAME_CHARS, "").replace(/\s+/g, " ").trim();
}

// Recovery codes are compared without leaking timing information.
function safeEqualHex(expected, actual) {
  if (typeof expected !== "string" || typeof actual !== "string" || expected.length !== actual.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
  } catch {
    return false;
  }
}

// Behind the VPS reverse proxy every socket comes from 127.0.0.1, so the client
// address must come from the proxy headers. Opt in only when a trusted proxy
// fronts the server (TRUST_PROXY=1); otherwise a client could spoof the header.
// The container port is published on the loopback, so only Caddy can reach it.
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const ACCESS_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
function recordAccess(account, req) {
  const raw = clientAddress(req).replace(/^::ffff:/, "");
  const ip = net.isIP(raw) ? raw : null;
  const at = new Date().toISOString();
  const recent = Array.isArray(account.recentAccesses) ? account.recentAccesses : [];
  return {
    ...account,
    lastLoginAt: at,
    recentAccesses: ip ? [{ ip, at }, ...recent.filter((entry) => entry.ip !== ip && Date.parse(entry.at) > Date.now() - ACCESS_RETENTION_MS)].slice(0, 5) : recent
  };
}
function clientAddress(req) {
  if (TRUST_PROXY) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length) {
      const first = forwarded.split(",")[0].trim();
      if (first) return first.slice(0, 64);
    }
    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) return realIp.trim().slice(0, 64);
  }
  return req.socket.remoteAddress || "unknown";
}

function createRateLimiter({ maxAttempts = 10, windowMs = 5 * 60 * 1000 } = {}) {
  const attempts = new Map();
  function recent(key) {
    const cutoff = Date.now() - windowMs;
    const values = (attempts.get(key) || []).filter((at) => at > cutoff);
    if (values.length) attempts.set(key, values);
    else attempts.delete(key);
    return values;
  }
  return {
    check(key) {
      const values = recent(key);
      if (values.length < maxAttempts) return null;
      return Math.max(1, Math.ceil((values[0] + windowMs - Date.now()) / 1000));
    },
    record(key) {
      attempts.set(key, [...recent(key), Date.now()]);
    },
    clear(key) {
      attempts.delete(key);
    }
  };
}

export function createGameServer({
  dataDir = process.env.DATA_DIR || path.join(__dirname, "data"),
  publicDir = DEFAULT_PUBLIC_DIR,
  founderUsername = process.env.FOUNDER_USERNAME,
  founderPassword = process.env.FOUNDER_PASSWORD,
  maxBackups = Number(process.env.MAX_BACKUPS || 60),
  googleClientId = process.env.GOOGLE_CLIENT_ID,
  googleClientSecret = process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri = process.env.GOOGLE_REDIRECT_URI,
  mailer: mailerOption,
  support: supportOption,
  consoleKey = process.env.ADMIN_CONSOLE_KEY,
  geoIpDbPath = process.env.GEOIP_DB,
  fetchImpl,
  rateLimit
} = {}) {
  const api = createApi({ dataDir, founderUsername, founderPassword, maxBackups });
  const limiter = createRateLimiter(rateLimit);
  const mailer = mailerOption ?? createMailer({ fetchImpl });
  const support = supportOption ?? createSupportStore({ dataDir });
  const RESET_TTL_MS = 15 * 60 * 1000;
  const RESET_MAX_ATTEMPTS = 5;
  // "user-bug" = reports sent from the in-app beta notice.
  const SUPPORT_CATEGORIES = new Set(["user-bug", "bug", "billing", "class", "account", "other"]);
  const google = createGoogleAuth({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    redirectUri: googleRedirectUri,
    trustProxy: TRUST_PROXY,
    fetchImpl
  });
  api.ensureDir(dataDir);
  api.bootstrapAccounts();
  const serveStatic = createStaticHandler({ publicDir, dataDir });
  const geoReader = geoIpDbPath ? maxmind.open(geoIpDbPath).catch((error) => {
    console.warn(`GeoIP database unavailable: ${error.message}`);
    return null;
  }) : Promise.resolve(null);
  const auditFile = path.join(dataDir, "admin-audit.jsonl");

  function consoleAuthorized(req, res) {
    if (typeof consoleKey !== "string" || consoleKey.length < 32) {
      sendJson(res, 404, { error: "not found" });
      return false;
    }
    const received = req.headers["x-console-key"];
    const expectedHash = crypto.createHash("sha256").update(consoleKey).digest();
    const actualHash = crypto.createHash("sha256").update(typeof received === "string" ? received : "").digest();
    if (!crypto.timingSafeEqual(expectedHash, actualHash)) {
      sendJson(res, 401, { error: "unauthorized" });
      return false;
    }
    return true;
  }

  function audit(action, accountId) {
    const entry = { at: new Date().toISOString(), action, accountId };
    fs.appendFileSync(auditFile, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
    if (fs.statSync(auditFile).size > 1024 * 1024) {
      const lines = fs.readFileSync(auditFile, "utf8").trim().split("\n").slice(-500);
      fs.writeFileSync(auditFile, `${lines.join("\n")}\n`, { mode: 0o600 });
    }
  }

  function recentAudit() {
    if (!fs.existsSync(auditFile)) return [];
    return fs.readFileSync(auditFile, "utf8").trim().split("\n").filter(Boolean).slice(-100).reverse().map((line) => JSON.parse(line));
  }

  function requireSession(req, res) {
    const session = api.sessionFor(req.headers["x-session-token"]);
    if (!session) sendJson(res, 401, { error: "not signed in" });
    return session;
  }

  function requireAdmin(req, res) {
    const session = requireSession(req, res);
    if (!session) return null;
    if (session.account.role !== "admin") {
      sendJson(res, 403, { error: "admin access required" });
      return null;
    }
    return session;
  }

  function throttle(req, res, action) {
    const key = `${action}:${clientAddress(req)}`;
    const retryAfter = limiter.check(key);
    if (retryAfter) {
      res.setHeader("Retry-After", String(retryAfter));
      sendJson(res, 429, { error: "too many attempts", retryAfter });
      return null;
    }
    return key;
  }

  async function equalizedRefusal(res, message = "wrong username or password") {
    await new Promise((resolve) => setTimeout(resolve, 250));
    sendJson(res, 401, { error: message });
  }

  async function handleSignUp(req, res) {
    const rateKey = throttle(req, res, "signup");
    if (!rateKey) return;
    limiter.record(rateKey);
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    // The client only sends the email and password. The email is the account
    // identity (username), and the display name defaults to its local part.
    // A username is still honored when explicitly provided (founder tooling).
    const email = stringField(payload, "email").trim();
    const explicitUsername = api.normalizeUsername(stringField(payload, "username"));
    const username = explicitUsername || api.normalizeUsername(email);
    const password = stringField(payload, "password");
    const displayName = cleanDisplayName(stringField(payload, "displayName")) || api.usernameFromEmail(email) || username;
    const problem = (explicitUsername ? api.usernameProblem(explicitUsername) : null) || api.passwordProblem(password) || api.emailProblem(email);
    if (problem) {
      sendJson(res, 400, { error: problem });
      return;
    }
    if (displayName.length > api.limits.MAX_DISPLAY_NAME_LENGTH) {
      sendJson(res, 400, { error: "the class name is too long" });
      return;
    }
    if (email.length > api.limits.MAX_EMAIL_LENGTH) {
      sendJson(res, 400, { error: "the email is too long" });
      return;
    }
    // Creating an account requires an explicit acceptance of the legal texts.
    if (payload.termsAccepted !== true) {
      sendJson(res, 400, { error: "the terms must be accepted" });
      return;
    }
    const index = api.readAccounts();
    if (api.findByUsername(index, username) || api.findByEmail(index, email)) {
      // Match the expensive successful path and avoid confirming account existence.
      await api.hashPassword(password);
      sendJson(res, 400, { error: "account could not be created" });
      return;
    }
    const account = recordAccess(await api.newAccount(username, displayName, password, "teacher", email), req);
    account.terms = { acceptedAt: new Date().toISOString(), version: TERMS_VERSION };
    api.createAccountWithState(index, account);
    sendJson(res, 201, { ok: true, token: api.issueToken(account.id), account: api.publicAccount(account) });
  }

  async function handleSignIn(req, res) {
    const rateKey = throttle(req, res, "signin");
    if (!rateKey) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    const username = api.normalizeUsername(stringField(payload, "username"));
    const index = api.readAccounts();
    // The gate accepts either the email or the derived username.
    let account = api.findByUsername(index, username);
    if (!account && username.includes("@")) account = api.findByEmail(index, username);
    let matches = false;
    if (account && !account.googleOnly) matches = await api.passwordMatches(stringField(payload, "password"), account.hash);
    else await api.hashPassword(stringField(payload, "password"));
    if (!matches || account?.status === "suspended") {
      limiter.record(rateKey);
      await equalizedRefusal(res);
      return;
    }
    limiter.clear(rateKey);
    const updated = recordAccess(account, req);
    index.accounts[account.id] = updated;
    api.writeAccounts(index);
    sendJson(res, 200, { ok: true, token: api.issueToken(account.id), account: api.publicAccount(updated) });
  }

  /* A verified Google email either opens the matching account or creates one.
   * The random hash is replaced with a teacher-console password after consent. */
  async function handleGoogleLogin(claims, req) {
    const email = String(claims.email || "").trim().toLowerCase();
    const index = api.readAccounts();
    let account = api.findByEmail(index, email);
    const created = !account;
    if (!account) {
      // The verified email is the identity; the display name defaults to its
      // local part unless the provider supplies a real name.
      const username = api.normalizeUsername(email);
      const displayName = cleanDisplayName(String(claims.name || "")).slice(0, api.limits.MAX_DISPLAY_NAME_LENGTH) || api.usernameFromEmail(email) || username;
      account = await api.newAccount(username, displayName, crypto.randomBytes(32).toString("base64url"), "teacher", email);
      account.googleOnly = true;
      account.teacherPasswordSetupRequired = true;
      api.createAccountWithState(index, account);
    }
    if (account.status === "suspended") return null;
    const updated = recordAccess(account, req);
    index.accounts[account.id] = updated;
    api.writeAccounts(index);
    return { token: api.issueToken(account.id, "google"), account: api.publicAccount(updated), created };
  }

  async function handleVerify(req, res) {
    let session = requireSession(req, res);
    if (!session) return;
    const rateKey = throttle(req, res, "verify");
    if (!rateKey) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    // The request body may arrive after another request revoked this token.
    session = requireSession(req, res);
    if (!session) return;
    if (session.account.teacherPasswordSetupRequired) return sendJson(res, 403, { error: "teacher password not set" });
    if (!await api.passwordMatches(stringField(payload, "password"), session.account.hash)) {
      limiter.record(rateKey);
      await equalizedRefusal(res);
      return;
    }
    limiter.clear(rateKey);
    sendJson(res, 200, { ok: true });
  }

  async function handleTeacherPasswordSetup(req, res) {
    let session = requireSession(req, res);
    if (!session) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    session = requireSession(req, res);
    if (!session) return;
    const index = api.readAccounts();
    const account = index.accounts[session.account.id];
    if (!account?.googleOnly || account.teacherPasswordSetupRequired !== true) {
      return sendJson(res, 409, { error: "teacher password already configured" });
    }
    const password = stringField(payload, "password");
    const problem = api.passwordProblem(password);
    if (problem) return sendJson(res, 400, { error: problem });
    const updated = { ...account, hash: await api.hashPassword(password), teacherPasswordSetupRequired: false, updatedAt: new Date().toISOString() };
    index.accounts[account.id] = updated;
    api.writeAccounts(index);
    api.revokeAccountTokens(account.id, session.token);
    sendJson(res, 200, { ok: true, account: api.publicAccount(updated) });
  }

  /* A fresh Google sign-in proves control of the verified email and permits
   * recovering the console password without knowing the previous password. */
  async function handleTeacherPasswordRecovery(req, res) {
    let session = requireSession(req, res);
    if (!session) return;
    const age = Date.now() - Date.parse(session.createdAt);
    if (!session.account.googleOnly || session.authMethod !== "google" ||
        !Number.isFinite(age) || age < 0 || age > 5 * 60 * 1000) {
      return sendJson(res, 403, { error: "sign in with Google again to reset the console password" });
    }
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    session = requireSession(req, res);
    if (!session) return;
    if (session.authMethod !== "google" || Date.now() - Date.parse(session.createdAt) > 5 * 60 * 1000) {
      return sendJson(res, 403, { error: "sign in with Google again to reset the console password" });
    }
    const password = stringField(payload, "password");
    const problem = api.passwordProblem(password);
    if (problem) return sendJson(res, 400, { error: problem });
    const index = api.readAccounts();
    const account = index.accounts[session.account.id];
    if (!account?.googleOnly) return sendJson(res, 403, { error: "Google account required" });
    const updated = { ...account, hash: await api.hashPassword(password), teacherPasswordSetupRequired: false, updatedAt: new Date().toISOString() };
    index.accounts[account.id] = updated;
    api.writeAccounts(index);
    api.revokeAccountTokens(account.id, session.token);
    sendJson(res, 200, { ok: true, account: api.publicAccount(updated) });
  }

  async function handlePasswordChange(req, res) {
    let session = requireSession(req, res);
    if (!session) return;
    const rateKey = throttle(req, res, "password-change");
    if (!rateKey) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    session = requireSession(req, res);
    if (!session) return;
    if (!await api.passwordMatches(stringField(payload, "current"), session.account.hash)) {
      limiter.record(rateKey);
      await equalizedRefusal(res);
      return;
    }
    const next = stringField(payload, "next");
    const problem = api.passwordProblem(next);
    if (problem) {
      sendJson(res, 400, { error: problem });
      return;
    }
    const index = api.readAccounts();
    const updatedAt = new Date().toISOString();
    index.accounts[session.account.id] = { ...session.account, hash: await api.hashPassword(next), updatedAt };
    api.writeAccounts(index);
    api.revokeAccountTokens(session.account.id, session.token);
    limiter.clear(rateKey);
    sendJson(res, 200, { ok: true, updatedAt });
  }

  /* Display name and email (which is also the login identity) are editable.
   * Moving the email moves the username with it, so sign-in stays one field. */
  async function handleProfile(req, res) {
    let session = requireSession(req, res);
    if (!session) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    session = requireSession(req, res);
    if (!session) return;
    const index = api.readAccounts();
    const account = index.accounts[session.account.id];
    if (!account) return sendJson(res, 404, { error: "account not found" });
    const next = { ...account };
    let changed = false;
    if (Object.hasOwn(payload, "displayName")) {
      const name = cleanDisplayName(payload.displayName);
      if (typeof payload.displayName !== "string" || !name || name.length > api.limits.MAX_DISPLAY_NAME_LENGTH) {
        return sendJson(res, 400, { error: "the display name is not valid" });
      }
      next.displayName = name;
      changed = true;
    }
    if (Object.hasOwn(payload, "email")) {
      const email = String(payload.email || "").trim();
      const problem = api.emailProblem(email);
      if (problem) return sendJson(res, 400, { error: problem });
      const normalized = api.normalizeUsername(email);
      const holder = api.findByEmail(index, email) || api.findByUsername(index, normalized);
      if (holder && holder.id !== account.id) return sendJson(res, 409, { error: "this email address is already used" });
      next.email = email;
      next.username = normalized;
      changed = true;
    }
    if (!changed) return sendJson(res, 200, { ok: true, account: api.publicAccount(account) });
    next.updatedAt = new Date().toISOString();
    index.accounts[account.id] = next;
    api.writeAccounts(index);
    sendJson(res, 200, { ok: true, account: api.publicAccount(next) });
  }

  /* Recovery request. The reply is generic so it never confirms whether an
   * address is registered; the code is emailed once a mailer is configured. */
  async function handlePasswordResetRequest(req, res) {
    const rateKey = throttle(req, res, "password-reset");
    if (!rateKey) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    limiter.record(rateKey);
    const email = stringField(payload, "email").trim();
    const lang = stringField(payload, "lang") === "en" ? "en" : "fr";
    const index = api.readAccounts();
    const account = api.findByEmail(index, email);
    if (account) {
      const code = api.generateResetCode();
      index.accounts[account.id] = {
        ...account,
        passwordReset: {
          key: api.resetCodeKey(code, account.id),
          expiresAt: Date.now() + RESET_TTL_MS,
          attempts: 0,
          requestedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };
      api.writeAccounts(index);
      const message = passwordResetEmail({ code, minutes: Math.round(RESET_TTL_MS / 60000), lang });
      const delivery = await mailer.send({ to: account.email, ...message });
      // With no mail provider configured the beta stays usable locally: the
      // code is written to the server log instead of being returned in the API.
      if (!delivery.delivered && process.env.NODE_ENV !== "production") {
        console.warn(`[mail] reset code for ${account.email}: ${code}`);
      }
    }
    sendJson(res, 200, { ok: true, delivered: mailer.enabled });
  }

  async function handlePasswordResetConfirm(req, res) {
    const rateKey = throttle(req, res, "password-reset-confirm");
    if (!rateKey) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    const email = stringField(payload, "email").trim();
    const code = stringField(payload, "code").trim();
    const next = stringField(payload, "next");
    const problem = api.passwordProblem(next);
    if (problem) return sendJson(res, 400, { error: problem });
    const index = api.readAccounts();
    const account = api.findByEmail(index, email);
    const reset = account?.passwordReset;
    const valid = Boolean(account && reset
      && Number.isFinite(reset.expiresAt) && reset.expiresAt > Date.now()
      && (reset.attempts || 0) < RESET_MAX_ATTEMPTS
      && /^[0-9]{6}$/.test(code)
      && safeEqualHex(reset.key, api.resetCodeKey(code, account.id)));
    if (!valid) {
      limiter.record(rateKey);
      if (account) {
        index.accounts[account.id] = { ...account, passwordReset: { ...reset, attempts: (reset?.attempts || 0) + 1 } };
        api.writeAccounts(index);
      }
      return sendJson(res, 400, { error: "the code is invalid or has expired" });
    }
    limiter.clear(rateKey);
    index.accounts[account.id] = {
      ...account,
      hash: await api.hashPassword(next),
      passwordReset: null,
      updatedAt: new Date().toISOString()
    };
    api.writeAccounts(index);
    api.revokeAccountTokens(account.id);
    sendJson(res, 200, { ok: true });
  }

  /* Help requests land in the shared inbox the admin console reads. */
  async function handleSupportMessage(req, res) {
    const session = requireSession(req, res);
    if (!session) return;
    const rateKey = throttle(req, res, "support-message");
    if (!rateKey) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    const message = cleanSupportText(payload.message, supportLimits.MAX_MESSAGE_LENGTH);
    if (!message) return sendJson(res, 400, { error: "write a message first" });
    limiter.record(rateKey);
    const entry = support.add({
      accountId: session.account.id,
      username: session.account.username,
      displayName: session.account.displayName,
      email: session.account.email || "",
      category: SUPPORT_CATEGORIES.has(payload.category) ? payload.category : "other",
      subject: cleanSupportText(payload.subject, supportLimits.MAX_SUBJECT_LENGTH),
      message
    });
    sendJson(res, 201, { ok: true, id: entry.id });
  }

  async function handleState(req, res) {
    const session = requireSession(req, res);
    if (!session) return;
    const directory = api.accountDirectory(session.account.id);
    if (req.method === "GET" || req.method === "HEAD") {
      const state = api.readState(directory);
      sendJson(res, state ? 200 : 404, state || { error: "no state yet" });
      return;
    }
    const state = await readJsonObject(req, res, api.limits.MAX_STATE_BYTES);
    if (!state) return;
    if (!requireSession(req, res)) return;
    if (!isStateDocument(state) || !Number.isSafeInteger(state.revision) || state.revision < 0) {
      sendJson(res, 400, { error: "not a Class Odyssey state" });
      return;
    }
    const current = api.readState(directory);
    const currentRevision = current?.revision || 0;
    if (state.revision !== currentRevision) {
      sendJson(res, 409, { error: "state revision conflict", revision: currentRevision });
      return;
    }
    const updatedAt = new Date().toISOString();
    const revision = currentRevision + 1;
    api.writeState(directory, { ...state, revision, updatedAt });
    sendJson(res, 200, { ok: true, revision, updatedAt });
  }

  /* Settings are account-scoped and additive: a partial patch only touches the
   * keys it sends, so preferences survive and stay changeable later. */
  async function handleSettings(req, res) {
    const session = requireSession(req, res);
    if (!session) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    const index = api.readAccounts();
    const account = index.accounts[session.account.id];
    if (!account) {
      sendJson(res, 404, { error: "account not found" });
      return;
    }
    const current = api.settingsWithDefaults(account.settings);
    const next = {
      language: current.language,
      theme: current.theme,
      onboarding: { ...current.onboarding }
    };
    if (Object.hasOwn(payload, "language") && (payload.language === null || payload.language === "fr" || payload.language === "en")) {
      next.language = payload.language;
    }
    if (Object.hasOwn(payload, "theme") && (payload.theme === null || payload.theme === "light" || payload.theme === "dark")) {
      next.theme = payload.theme;
    }
    if (payload.onboarding && typeof payload.onboarding === "object" && !Array.isArray(payload.onboarding)) {
      if (Object.hasOwn(payload.onboarding, "completed")) next.onboarding.completed = Boolean(payload.onboarding.completed);
      if (Number.isSafeInteger(payload.onboarding.step) && payload.onboarding.step >= 0) next.onboarding.step = payload.onboarding.step;
    }
    index.accounts[account.id] = { ...account, settings: next, updatedAt: new Date().toISOString() };
    api.writeAccounts(index);
    sendJson(res, 200, { ok: true, account: api.publicAccount(index.accounts[account.id]) });
  }

  /* Records the acceptance of the legal texts for accounts whose flow could not
   * show the sign-up checkbox (Google) and renews it when the revision changes. */
  function handleTerms(req, res) {
    const session = requireSession(req, res);
    if (!session) return;
    const index = api.readAccounts();
    const account = index.accounts[session.account.id];
    if (!account) {
      sendJson(res, 404, { error: "account not found" });
      return;
    }
    // Already accepted at the current revision: keep the original timestamp.
    if (account.terms?.acceptedAt && account.terms.version === TERMS_VERSION) {
      sendJson(res, 200, { ok: true, account: api.publicAccount(account) });
      return;
    }
    const updatedAt = new Date().toISOString();
    index.accounts[account.id] = { ...account, terms: { acceptedAt: updatedAt, version: TERMS_VERSION }, updatedAt };
    api.writeAccounts(index);
    sendJson(res, 200, { ok: true, account: api.publicAccount(index.accounts[account.id]) });
  }

  function handleAdminList(req, res) {
    if (!requireAdmin(req, res)) return;
    const counts = api.activeSessionCounts();
    const accounts = Object.values(api.readAccounts().accounts).map((account) => {
      const state = api.readState(api.accountDirectory(account.id));
      const pupilCount = state?.classes.reduce((sum, classroom) => sum + (Array.isArray(classroom?.pupils) ? classroom.pupils.length : 0), 0) || 0;
      return {
        id: account.id,
        username: account.username,
        email: account.email || "",
        role: account.role || "teacher",
        createdAt: account.createdAt,
        lastLoginAt: account.lastLoginAt || null,
        activeSessionCount: counts[account.id] || 0,
        pupilCount
      };
    }).sort((a, b) => a.username.localeCompare(b.username));
    sendJson(res, 200, { accounts });
  }

  async function handleAdminReset(req, res, accountId) {
    const session = requireAdmin(req, res);
    if (!session) return;
    if (accountId === session.account.id) {
      sendJson(res, 400, { error: "use your account settings to change your own password" });
      return;
    }
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    if (!requireAdmin(req, res)) return;
    const password = stringField(payload, "password");
    const problem = api.passwordProblem(password);
    if (problem) {
      sendJson(res, 400, { error: problem });
      return;
    }
    const index = api.readAccounts();
    const target = index.accounts[accountId];
    if (!target) {
      sendJson(res, 404, { error: "account not found" });
      return;
    }
    index.accounts[accountId] = { ...target, hash: await api.hashPassword(password), teacherPasswordSetupRequired: false, updatedAt: new Date().toISOString() };
    api.writeAccounts(index);
    api.revokeAccountTokens(accountId);
    sendJson(res, 200, { ok: true });
  }

  async function consoleAccount(account, counts, reader) {
    const state = api.readState(api.accountDirectory(account.id));
    const classes = Array.isArray(state?.classes) ? state.classes : [];
    const accesses = (Array.isArray(account.recentAccesses) ? account.recentAccesses : [])
      .filter((entry) => net.isIP(entry.ip) && Date.parse(entry.at) > Date.now() - ACCESS_RETENTION_MS)
      .slice(0, 5).map(({ ip, at }) => {
        const location = reader?.get(ip);
        const city = location?.city?.names?.fr || location?.city?.names?.en;
        const country = location?.country?.names?.fr || location?.country?.names?.en;
        return { ip, at, location: [city, country].filter(Boolean).join(", ") || null };
      });
    return {
      id: account.id, username: account.username, displayName: account.displayName,
      email: account.email || "", role: account.role || "teacher", status: account.status || "active",
      createdAt: account.createdAt, updatedAt: account.updatedAt, lastLoginAt: account.lastLoginAt || null,
      terms: account.terms || null, activeSessionCount: counts[account.id] || 0,
      classCount: classes.length,
      pupilCount: classes.reduce((sum, classroom) => sum + (Array.isArray(classroom.pupils) ? classroom.pupils.length : 0), 0),
      classes: classes.map((classroom) => ({ name: classroom.name || "Classe sans nom", pupilCount: Array.isArray(classroom.pupils) ? classroom.pupils.length : 0 })),
      moderationNote: account.moderationNote || "", recentAccesses: accesses
    };
  }

  async function handleConsole(req, res, pathname) {
    if (!consoleAuthorized(req, res)) return;
    if (req.method === "GET" && pathname === "/api/console/overview") {
      const index = api.readAccounts();
      const counts = api.activeSessionCounts();
      const reader = await geoReader;
      const accounts = await Promise.all(Object.values(index.accounts).map((account) => consoleAccount(account, counts, reader)));
      accounts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return sendJson(res, 200, { accounts, supportUnread: support.unreadCount(), geoipAvailable: Boolean(reader), subscriptionsAvailable: false, updatedAt: new Date().toISOString() });
    }
    if (req.method === "GET" && pathname === "/api/console/audit") return sendJson(res, 200, { entries: recentAudit() });
    if (pathname === "/api/console/support" && req.method === "GET") {
      return sendJson(res, 200, { messages: support.list(), unread: support.unreadCount() });
    }
    const supportMatch = pathname.match(/^\/api\/console\/support\/([0-9a-f]{16})$/);
    if (supportMatch && req.method === "PATCH") {
      const payload = await readJsonObject(req, res);
      if (!payload || !consoleAuthorized(req, res)) return;
      if (!Object.keys(payload).length || Object.keys(payload).some((key) => !["status", "note"].includes(key))) return sendJson(res, 400, { error: "unsupported fields" });
      if (Object.hasOwn(payload, "status") && !["open", "read", "done"].includes(payload.status)) return sendJson(res, 400, { error: "invalid status" });
      if (Object.hasOwn(payload, "note") && (typeof payload.note !== "string" || payload.note.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(payload.note))) return sendJson(res, 400, { error: "invalid note" });
      const updated = support.update(supportMatch[1], payload);
      if (!updated) return sendJson(res, 404, { error: "message not found" });
      audit("support.updated", updated.accountId);
      return sendJson(res, 200, { message: updated });
    }
    const match = pathname.match(/^\/api\/console\/accounts\/([0-9a-f]{24})(?:\/(sessions))?$/);
    if (!match) return sendJson(res, 404, { error: "not found" });
    const [, id, section] = match;
    const index = api.readAccounts();
    const account = index.accounts[id];
    if (!account) return sendJson(res, 404, { error: "account not found" });
    if (account.role === "admin") return sendJson(res, 403, { error: "founder account is protected" });

    if (section === "sessions" && req.method === "DELETE") {
      api.revokeAccountTokens(id);
      audit("sessions.revoked", id);
      return sendJson(res, 200, { ok: true });
    }
    if (!section && req.method === "PATCH") {
      const payload = await readJsonObject(req, res);
      if (!payload || !consoleAuthorized(req, res)) return;
      if (!Object.keys(payload).length || Object.keys(payload).some((key) => !["displayName", "status", "moderationNote"].includes(key))) {
        return sendJson(res, 400, { error: "unsupported fields" });
      }
      const next = { ...account };
      if (Object.hasOwn(payload, "displayName")) {
        const name = cleanDisplayName(payload.displayName);
        if (typeof payload.displayName !== "string" || !name || name.length > api.limits.MAX_DISPLAY_NAME_LENGTH) return sendJson(res, 400, { error: "invalid display name" });
        next.displayName = name;
      }
      if (Object.hasOwn(payload, "status")) {
        if (!["active", "suspended"].includes(payload.status)) return sendJson(res, 400, { error: "invalid status" });
        next.status = payload.status;
      }
      if (Object.hasOwn(payload, "moderationNote")) {
        const note = cleanDisplayName(payload.moderationNote);
        if (typeof payload.moderationNote !== "string" || note.length > 500) return sendJson(res, 400, { error: "invalid note" });
        next.moderationNote = note;
      }
      next.updatedAt = new Date().toISOString();
      index.accounts[id] = next;
      api.writeAccounts(index);
      if (next.status === "suspended") api.revokeAccountTokens(id);
      audit(next.status !== (account.status || "active") ? `account.${next.status}` : "account.updated", id);
      return sendJson(res, 200, { ok: true });
    }
    if (!section && req.method === "DELETE") {
      const payload = await readJsonObject(req, res);
      if (!payload || !consoleAuthorized(req, res)) return;
      if (payload.confirmUsername !== account.username) return sendJson(res, 400, { error: "username confirmation does not match" });
      api.deleteAccount(index, id);
      audit("account.deleted", id);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 405, { error: "method not allowed" });
  }

  return http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname === "/api/health" && req.method === "GET") return sendJson(res, 200, { ok: true });
      if (pathname === "/api/config" && req.method === "GET") return sendJson(res, 200, { google: google.enabled });
      if (pathname === "/api/auth/google" && req.method === "GET") return google.start(req, res);
      if (pathname === "/api/auth/google/callback" && req.method === "GET") return await google.callback(req, res, (claims) => handleGoogleLogin(claims, req));
      if (pathname === "/api/auth/google/exchange" && req.method === "POST") {
        const payload = await readJsonObject(req, res);
        if (!payload) return;
        const login = google.consumeExchangeCode(stringField(payload, "code"));
        if (!login) return sendJson(res, 400, { error: "google sign-in expired" });
        return sendJson(res, 200, { ok: true, token: login.token, account: login.account, created: login.created === true });
      }
      if (pathname === "/api/accounts" && req.method === "POST") return await handleSignUp(req, res);
      if (pathname === "/api/session") {
        if (req.method === "POST") return await handleSignIn(req, res);
        if (req.method === "GET") {
          const session = requireSession(req, res);
          if (session) sendJson(res, 200, { account: api.publicAccount(session.account) });
          return;
        }
        if (req.method === "DELETE") {
          api.revokeToken(req.headers["x-session-token"] || "");
          return sendJson(res, 200, { ok: true });
        }
      }
      if (pathname === "/api/session/verify" && req.method === "POST") return await handleVerify(req, res);
      if (pathname === "/api/account/teacher-password" && req.method === "PUT") return await handleTeacherPasswordSetup(req, res);
      if (pathname === "/api/account/teacher-password/recover" && req.method === "PUT") return await handleTeacherPasswordRecovery(req, res);
      if (pathname === "/api/session/password" && req.method === "PUT") return await handlePasswordChange(req, res);
      if (pathname === "/api/account/settings" && req.method === "PUT") return await handleSettings(req, res);
      if (pathname === "/api/account/profile" && req.method === "PUT") return await handleProfile(req, res);
      if (pathname === "/api/account/terms" && req.method === "PUT") return handleTerms(req, res);
      if (pathname === "/api/session/password/reset" && req.method === "POST") return await handlePasswordResetRequest(req, res);
      if (pathname === "/api/session/password/reset/confirm" && req.method === "POST") return await handlePasswordResetConfirm(req, res);
      if (pathname === "/api/support/messages" && req.method === "POST") return await handleSupportMessage(req, res);
      if (pathname === "/api/state" && ["GET", "HEAD", "PUT"].includes(req.method)) return await handleState(req, res);
      if (pathname.startsWith("/api/console/")) return await handleConsole(req, res, pathname);
      if (pathname === "/api/admin/accounts" && req.method === "GET") return handleAdminList(req, res);
      const resetMatch = pathname.match(/^\/api\/admin\/accounts\/([0-9a-f]{24})\/password$/);
      if (resetMatch && req.method === "PUT") return await handleAdminReset(req, res, resetMatch[1]);
      if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "not found" });
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405).end("Method not allowed");
        return;
      }
      // One URL per page: /index.html canonicalises to the site root.
      if (pathname === "/index.html") {
        res.writeHead(301, { Location: "/", "Cache-Control": "no-store" }).end();
        return;
      }
      serveStatic(req, res, pathname);
    } catch (error) {
      if (!res.headersSent) sendJson(res, 500, { error: "internal server error" });
      console.error(error);
    }
  });
}

export function startServer(options = {}) {
  const server = createGameServer(options);
  const port = Number(options.port ?? process.env.PORT ?? 5180);
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  const retryOnFreePort = (error) => {
    if (error.code !== "EADDRINUSE") throw error;
    console.warn(`Port ${port} déjà utilisé ; attribution automatique d'un port libre.`);
    // Bind directly to an OS-assigned port, avoiding a probe-then-listen race.
    server.listen(0, host);
  };
  if (options.autoPort && port !== 0) server.once("error", retryOnFreePort);
  server.once("listening", () => {
    server.off("error", retryOnFreePort);
    const urlHost = host.includes(":") ? `[${host}]` : host;
    console.log(`Class Odyssey backend on http://${urlHost}:${server.address().port}`);
  });
  server.listen(port, host);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer({ autoPort: process.argv.includes("--auto-port") });
}
