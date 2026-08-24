import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./api.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_DIR = path.join(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error("payload too large");
        error.status = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonObject(req, res, limit = 4 * 1024) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req, limit));
  } catch (error) {
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

function clientAddress(req) {
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
    const displayName = stringField(payload, "displayName").trim() || username;
    const problem = api.usernameProblem(username) || api.passwordProblem(password);
    if (problem) {
      sendJson(res, 400, { error: problem });
      return;
    }
    if (displayName.length > api.limits.MAX_DISPLAY_NAME_LENGTH) {
      sendJson(res, 400, { error: "the class name is too long" });
      return;
    }
    const index = api.readAccounts();
    if (api.findByUsername(index, username)) {
      // Match the expensive successful path and avoid confirming account existence.
      api.hashPassword(password);
      sendJson(res, 400, { error: "account could not be created" });
      return;
    }
    const account = api.newAccount(username, displayName, password);
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
    if (account) matches = api.passwordMatches(stringField(payload, "password"), account.hash);
    else api.hashPassword(stringField(payload, "password"));
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
    const session = requireSession(req, res);
    if (!session) return;
    const rateKey = throttle(req, res, "verify");
    if (!rateKey) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    if (!api.passwordMatches(stringField(payload, "password"), session.account.hash)) {
      limiter.record(rateKey);
      await equalizedRefusal(res);
      return;
    }
    limiter.clear(rateKey);
    sendJson(res, 200, { ok: true });
  }

  async function handlePasswordChange(req, res) {
    const session = requireSession(req, res);
    if (!session) return;
    const payload = await readJsonObject(req, res);
    if (!payload) return;
    if (!api.passwordMatches(stringField(payload, "current"), session.account.hash)) {
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
    index.accounts[session.account.id] = { ...session.account, hash: api.hashPassword(next), updatedAt };
    api.writeAccounts(index);
    api.revokeAccountTokens(session.account.id, session.token);
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
    const state = await readJsonObject(req, res, 10 * 1024 * 1024);
    if (!state) return;
    if (!Array.isArray(state.classes)
      || !state.classes.every((classroom) => classroom && typeof classroom === "object" && Array.isArray(classroom.pupils))
      || !Number.isSafeInteger(state.revision) || state.revision < 0) {
      sendJson(res, 400, { error: "not a Game of More state" });
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

  function handleAdminList(req, res) {
    if (!requireAdmin(req, res)) return;
    const counts = api.activeSessionCounts();
    const accounts = Object.values(api.readAccounts().accounts).map((account) => {
      const state = api.readState(api.accountDirectory(account.id));
      const pupilCount = state?.classes.reduce((sum, classroom) => sum + (Array.isArray(classroom?.pupils) ? classroom.pupils.length : 0), 0) || 0;
      return {
        id: account.id,
        username: account.username,
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
    index.accounts[accountId] = { ...target, hash: api.hashPassword(password), updatedAt: new Date().toISOString() };
    api.writeAccounts(index);
    api.revokeAccountTokens(accountId);
    sendJson(res, 200, { ok: true });
  }

  function isBlockedPath(resolved) {
    const relative = path.relative(publicDir, resolved);
    if (relative.startsWith("..")) return true;
    const dataRelative = path.relative(path.resolve(dataDir), resolved);
    if (dataRelative === "" || (!dataRelative.startsWith("..") && !path.isAbsolute(dataRelative))) return true;
    const parts = relative.split(path.sep);
    if (["server", ".git", "node_modules"].includes(parts[0])) return true;
    return relative !== "index.html" && relative !== "styles.css" && parts[0] !== "assets" && parts[0] !== "src";
  }

  function serveStatic(req, res, pathname) {
    const resolved = path.normalize(path.join(publicDir, pathname === "/" ? "/index.html" : pathname));
    if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    let target = resolved;
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(publicDir, "index.html");
    if (!fs.existsSync(target) || isBlockedPath(target)) {
      res.writeHead(404).end("Not found");
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const cacheable = new Set([".svg", ".jpg", ".jpeg", ".png", ".webp", ".ico"]);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": cacheable.has(ext) ? "public, max-age=3600" : "no-cache"
    });
    if (req.method === "HEAD") res.end();
    else res.end(fs.readFileSync(target));
  }

  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    try {
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
  server.listen(port, host, () => console.log(`Game of More backend on http://${host}:${port}`));
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
