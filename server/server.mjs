import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const PORT = Number(process.env.PORT || 5180);
const MAX_BACKUPS = Number(process.env.MAX_BACKUPS || 60);

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
  ".glb": "model/gltf-binary",
  ".ico": "image/x-icon"
};

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function parseStateFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const state = JSON.parse(raw);
  if (!state || !Array.isArray(state.classes)) throw new Error("not a Game of More state");
  return state;
}

function backupFiles() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith("state-") && name.endsWith(".json"))
    .sort()
    .reverse()
    .map((name) => path.join(BACKUP_DIR, name));
}

function readState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return parseStateFile(STATE_FILE);
    } catch {
      // Continue through the backups below.
    }
  }

  for (const backup of backupFiles() || []) {
    try {
      const state = parseStateFile(backup);
      console.warn(`Recovered state from backup: ${backup}`);
      return state;
    } catch {
      // Try the next older backup.
    }
  }
  return null;
}

function writeState(state) {
  ensureDirs();

  // Rotate a timestamped backup of the previous state before overwriting.
  if (fs.existsSync(STATE_FILE)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(STATE_FILE, path.join(BACKUP_DIR, `state-${stamp}.json`));
  }

  // Atomic write: temp file then rename, so a crash never corrupts the state.
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmp, STATE_FILE);

  pruneBackups();
}

function pruneBackups() {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith("state-") && name.endsWith(".json"))
    .sort();
  while (files.length > MAX_BACKUPS) {
    fs.rmSync(path.join(BACKUP_DIR, files.shift()));
  }
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
  if (isWithin(DATA_DIR) || isWithin(BACKUP_DIR)) return true;

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const { pathname } = url;

  if (pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/state") {
    try {
      if (req.method === "GET") {
        const state = readState();
        sendJson(res, state ? 200 : 404, state || { error: "no state yet" });
        return;
      }

      if (req.method === "PUT") {
        const body = await readBody(req);
        let state;
        try {
          state = JSON.parse(body);
        } catch {
          sendJson(res, 400, { error: "invalid JSON" });
          return;
        }
        if (!state || !Array.isArray(state.classes)) {
          sendJson(res, 400, { error: "not a Game of More state" });
          return;
        }
        state.updatedAt = new Date().toISOString();
        writeState(state);
        sendJson(res, 200, { ok: true, updatedAt: state.updatedAt });
        return;
      }

      res.writeHead(405, { Allow: "GET, PUT" });
      res.end("Method not allowed");
      return;
    } catch (error) {
      sendJson(res, 500, { error: error.message });
      return;
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  serveStatic(req, res, pathname);
});

ensureDirs();
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Game of More backend on http://127.0.0.1:${PORT}`);
  console.log(`state file: ${STATE_FILE}`);
});
