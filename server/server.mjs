import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./api.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PORT = Number(process.env.PORT || 5180);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BACKUPS = Number(process.env.MAX_BACKUPS || 60);

const api = createApi({ dataDir: DATA_DIR, maxBackups: MAX_BACKUPS });

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

function ensureDirs() {
  api.ensureDir(DATA_DIR);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        fail(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", fail);
  });
}

function isBlockedPath(resolved) {
  const relative = path.relative(PUBLIC_DIR, resolved);
  if (relative.startsWith("..")) return true;

  const isWithin = (directory) => {
    const candidate = path.relative(path.resolve(directory), resolved);
    return candidate === "" || (!candidate.startsWith("..") && !path.isAbsolute(candidate));
  };
  if (isWithin(DATA_DIR)) return true;

  const parts = relative.split(path.sep);
  if (parts[0] === "server" || parts[0] === ".git" || parts[0] === "node_modules") return true;
  return relative !== "index.html"
    && relative !== "styles.css"
    && parts[0] !== "assets"
    && parts[0] !== "src";
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.normalize(path.join(PUBLIC_DIR, filePath));

  if (resolved !== PUBLIC_DIR && !resolved.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    // SPA fallback: unknown routes serve the app shell.
    const index = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(index)) {
      res.writeHead(200, {
        "Content-Type": MIME[".html"],
        "Cache-Control": "no-cache"
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(fs.readFileSync(index));
      return;
    }
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (isBlockedPath(resolved)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  // Le HTML, la feuille de style et les modules forment un tout : les
  // garder une heure en cache livrerait un mélange d'ancien et de neuf
  // après un déploiement. Seules les images, jamais modifiées en place,
  // gardent un cache long.
  const ext = path.extname(resolved).toLowerCase();
  const cacheable = new Set([".svg", ".jpg", ".jpeg", ".png", ".webp", ".ico"]);
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": cacheable.has(ext) ? "public, max-age=3600" : "no-cache"
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(fs.readFileSync(resolved));
}


/* ---------- API ----------
   Ce serveur fournit le même contrat en développement et en production. */

const stringField = (payload, key) => (typeof payload?.[key] === "string" ? payload[key] : "");

function requireSession(req, res) {
  const session = api.sessionFor(req.headers["x-session-token"]);
  if (!session) {
    sendJson(res, 401, { error: "not signed in" });
    return null;
  }
  return session;
}

function refuseAttempt(res, account, failures, now) {
  if (account) {
    const index = api.readAccounts();
    index.accounts[account.id] = { ...account, failures: [...failures, now].slice(-api.limits.MAX_FAILED_ATTEMPTS) };
    api.writeAccounts(index);
  }
  // Une réponse instantanée invite à essayer mille fois de suite.
  setTimeout(() => sendJson(res, 401, { error: "wrong username or password" }), 300);
}

function refuseTooManyAttempts(res, failures, now) {
  const retryAfter = Math.max(1, api.limits.ATTEMPT_WINDOW_SECONDS - (now - Math.min(...failures)));
  res.setHeader("Retry-After", String(retryAfter));
  sendJson(res, 429, { error: "too many attempts", retryAfter });
}

function clearFailures(account) {
  if (!account.failures?.length) return;
  const index = api.readAccounts();
  index.accounts[account.id] = { ...account, failures: [] };
  api.writeAccounts(index);
}

async function readJsonBody(req, res, limit) {
  try {
    return JSON.parse(await readBody(req, limit));
  } catch {
    sendJson(res, 400, { error: "invalid JSON" });
    return null;
  }
}

async function handleSignUp(req, res) {
  const payload = await readJsonBody(req, res, 4 * 1024);
  if (!payload) return;

  const username = api.normalizeUsername(stringField(payload, "username"));
  const password = stringField(payload, "password");
  let displayName = stringField(payload, "displayName").trim();

  const problem = api.usernameProblem(username) || api.passwordProblem(password);
  if (problem) {
    sendJson(res, 400, { error: problem });
    return;
  }
  if (!displayName) displayName = username;
  if (displayName.length > api.limits.MAX_DISPLAY_NAME_LENGTH) {
    sendJson(res, 400, { error: "the class name is too long" });
    return;
  }

  const index = api.readAccounts();
  if (api.findByUsername(index, username)) {
    sendJson(res, 409, { error: "this username is already taken" });
    return;
  }

  const account = api.newAccount(username, displayName, password);
  api.ensureDir(path.join(api.accountDirectory(account.id), "backups"));
  index.accounts[account.id] = account;
  api.writeAccounts(index);

  sendJson(res, 201, { ok: true, token: api.issueToken(account.id), account: api.publicAccount(account) });
}

async function handleSignIn(req, res) {
  const payload = await readJsonBody(req, res, 4 * 1024);
  if (!payload) return;

  const username = api.normalizeUsername(stringField(payload, "username"));
  const index = api.readAccounts();
  const account = api.findByUsername(index, username);
  const now = Math.floor(Date.now() / 1000);
  const failures = account ? api.recentFailures(account.failures, now) : [];

  if (failures.length >= api.limits.MAX_FAILED_ATTEMPTS) {
    refuseTooManyAttempts(res, failures, now);
    return;
  }
  if (!account || !api.passwordMatches(stringField(payload, "password"), account.hash)) {
    refuseAttempt(res, account, failures, now);
    return;
  }

  clearFailures(account);
  sendJson(res, 200, { ok: true, token: api.issueToken(account.id), account: api.publicAccount(account) });
}

async function handleVerify(req, res) {
  const session = requireSession(req, res);
  if (!session) return;
  const payload = await readJsonBody(req, res, 4 * 1024);
  if (!payload) return;

  const { account } = session;
  const now = Math.floor(Date.now() / 1000);
  const failures = api.recentFailures(account.failures, now);

  if (failures.length >= api.limits.MAX_FAILED_ATTEMPTS) {
    refuseTooManyAttempts(res, failures, now);
    return;
  }
  if (!api.passwordMatches(stringField(payload, "password"), account.hash)) {
    refuseAttempt(res, account, failures, now);
    return;
  }

  clearFailures(account);
  sendJson(res, 200, { ok: true });
}

async function handlePasswordChange(req, res) {
  const session = requireSession(req, res);
  if (!session) return;
  const payload = await readJsonBody(req, res, 4 * 1024);
  if (!payload) return;

  const { account, token } = session;
  const now = Math.floor(Date.now() / 1000);
  const failures = api.recentFailures(account.failures, now);

  if (failures.length >= api.limits.MAX_FAILED_ATTEMPTS) {
    refuseTooManyAttempts(res, failures, now);
    return;
  }
  if (!api.passwordMatches(stringField(payload, "current"), account.hash)) {
    refuseAttempt(res, account, failures, now);
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
  index.accounts[account.id] = { ...account, hash: api.hashPassword(next), updatedAt, failures: [] };
  api.writeAccounts(index);
  /* Changer le mot de passe déconnecte les autres appareils. */
  api.revokeAccountTokens(account.id, token);

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

  const state = await readJsonBody(req, res, 10 * 1024 * 1024);
  if (!state) return;
  if (!Array.isArray(state.classes)) {
    sendJson(res, 400, { error: "not a Game of More state" });
    return;
  }

  state.updatedAt = new Date().toISOString();
  api.writeState(directory, state);
  sendJson(res, 200, { ok: true, updatedAt: state.updatedAt });
}

const API_ROUTES = {
  "/api/accounts": { POST: handleSignUp },
  "/api/session": {
    POST: handleSignIn,
    DELETE: async (req, res) => {
      api.revokeToken(req.headers["x-session-token"] || "");
      sendJson(res, 200, { ok: true });
    }
  },
  "/api/session/verify": { POST: handleVerify },
  "/api/session/password": { PUT: handlePasswordChange },
  "/api/state": { GET: handleState, HEAD: handleState, PUT: handleState }
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const { pathname } = url;

  if (pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const route = API_ROUTES[pathname];
  if (route) {
    const handler = route[req.method];
    if (!handler) {
      res.writeHead(405, { Allow: Object.keys(route).join(", ") });
      res.end("Method not allowed");
      return;
    }
    try {
      await handler(req, res);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "not found" });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  serveStatic(req, res, pathname);
});

ensureDirs();
api.bootstrapAccounts();
server.listen(PORT, HOST, () => {
  console.log(`Game of More backend on http://${HOST}:${PORT}`);
  console.log(`data directory: ${DATA_DIR}`);
});
