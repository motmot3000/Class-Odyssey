import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./api.mjs";
import { createStaticHandler } from "./static.mjs";
import { isStateDocument } from "../src/state-schema.mjs";

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

// Behind the VPS reverse proxy every socket comes from 127.0.0.1, so the client
// address must come from the proxy headers. Opt in only when a trusted proxy
// fronts the server (TRUST_PROXY=1); otherwise a client could spoof the header.
// The container port is published on the loopback, so only Caddy can reach it.
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
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
  rateLimit
} = {}) {
  const api = createApi({ dataDir, founderUsername, founderPassword, maxBackups });
  const limiter = createRateLimiter(rateLimit);
  api.ensureDir(dataDir);
  api.bootstrapAccounts();
  const serveStatic = createStaticHandler({ publicDir, dataDir });

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
    const username = api.normalizeUsername(stringField(payload, "username"));
    const password = stringField(payload, "password");
    const email = stringField(payload, "email").trim();
    const displayName = cleanDisplayName(stringField(payload, "displayName")) || username;
    const problem = api.usernameProblem(username) || api.passwordProblem(password) || api.emailProblem(email);
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
    const index = api.readAccounts();
    if (api.findByUsername(index, username)) {
      // Match the expensive successful path and avoid confirming account existence.
      await api.hashPassword(password);
      sendJson(res, 400, { error: "account could not be created" });
      return;
    }
    const account = await api.newAccount(username, displayName, password, "teacher", email);
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
    const account = api.findByUsername(index, username);
    let matches = false;
    if (account) matches = await api.passwordMatches(stringField(payload, "password"), account.hash);
    else await api.hashPassword(stringField(payload, "password"));
    if (!matches) {
      limiter.record(rateKey);
      await equalizedRefusal(res);
      return;
    }
    limiter.clear(rateKey);
    const updated = { ...account, lastLoginAt: new Date().toISOString() };
    index.accounts[account.id] = updated;
    api.writeAccounts(index);
    sendJson(res, 200, { ok: true, token: api.issueToken(account.id), account: api.publicAccount(updated) });
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
    if (!await api.passwordMatches(stringField(payload, "password"), session.account.hash)) {
      limiter.record(rateKey);
      await equalizedRefusal(res);
      return;
    }
    limiter.clear(rateKey);
    sendJson(res, 200, { ok: true });
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
    index.accounts[accountId] = { ...target, hash: await api.hashPassword(password), updatedAt: new Date().toISOString() };
    api.writeAccounts(index);
    api.revokeAccountTokens(accountId);
    sendJson(res, 200, { ok: true });
  }

  return http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname === "/api/health" && req.method === "GET") return sendJson(res, 200, { ok: true });
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
      if (pathname === "/api/session/password" && req.method === "PUT") return await handlePasswordChange(req, res);
      if (pathname === "/api/account/settings" && req.method === "PUT") return await handleSettings(req, res);
      if (pathname === "/api/state" && ["GET", "HEAD", "PUT"].includes(req.method)) return await handleState(req, res);
      if (pathname === "/api/admin/accounts" && req.method === "GET") return handleAdminList(req, res);
      const resetMatch = pathname.match(/^\/api\/admin\/accounts\/([0-9a-f]{24})\/password$/);
      if (resetMatch && req.method === "PUT") return await handleAdminReset(req, res, resetMatch[1]);
      if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "not found" });
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405).end("Method not allowed");
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
