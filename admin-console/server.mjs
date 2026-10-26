/* Local operator proxy. The backend key stays on this server, not in the
 * browser. Anyone able to reach this listener can perform admin operations.
 */
import http from "node:http";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/console.css", ["console.css", "text/css; charset=utf-8"]],
  ["/console.js", ["console.js", "application/javascript; charset=utf-8"]],
  ["/favicon.svg", ["../assets/brand/icons/favicon-dark.svg", "image/svg+xml"]],
  ["/brand-logo.svg", ["../assets/brand/svg/class-odyssey-horizontal-dark.svg", "image/svg+xml"]]
]);
const API_PATH = /^\/api\/(?:overview|audit|support(?:\/[0-9a-f]{16})?|accounts\/[0-9a-f]{24}(?:\/sessions)?)$/;
const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };

function json(res, status, body) {
  res.writeHead(status, { ...NO_STORE, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function inCidr(ip, cidr) {
  if (!cidr) return true;
  const [network, bits] = cidr.split("/");
  if (net.isIP(network) !== 4 || net.isIP(ip) !== 4 || !/^\d+$/.test(bits) || Number(bits) > 32) return false;
  const numeric = (value) => value.split(".").reduce((sum, part) => (sum << 8) | Number(part), 0) >>> 0;
  const mask = Number(bits) === 0 ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0;
  return (numeric(ip) & mask) === (numeric(network) & mask);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new Error("payload too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createConsoleServer({
  apiUrl = process.env.CONSOLE_API_URL || "http://127.0.0.1:5180",
  key = process.env.ADMIN_CONSOLE_KEY,
  host = process.env.CONSOLE_HOST || "127.0.0.1",
  allowedCidr = process.env.CONSOLE_ALLOWED_CIDR || "",
  fetchImpl = fetch
} = {}) {
  if (!key || key.length < 32) throw new Error("ADMIN_CONSOLE_KEY must contain at least 32 characters");
  const upstream = new URL(apiUrl);
  if (upstream.username || upstream.password || upstream.search || upstream.hash || (upstream.protocol !== "https:" && !(upstream.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(upstream.hostname)))) {
    throw new Error("CONSOLE_API_URL must be an HTTPS URL (HTTP is only allowed for loopback testing)");
  }
  if (allowedCidr && !inCidr(allowedCidr.split("/")[0], allowedCidr)) throw new Error("CONSOLE_ALLOWED_CIDR must be a valid IPv4 CIDR");

  const hosts = new Set(["localhost", "127.0.0.1", "[::1]", host]);
  if (host === "0.0.0.0") {
    for (const addresses of Object.values(os.networkInterfaces())) {
      for (const address of addresses || []) if (address.family === "IPv4") hosts.add(address.address);
    }
  }
  return http.createServer(async (req, res) => {
    const requestHost = String(req.headers.host || "");
    const hostname = requestHost.replace(/:\d+$/, "");
    const ip = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
    if (!hosts.has(hostname) || (!net.isIP(ip) || (!ip.startsWith("127.") && ip !== "::1" && !inCidr(ip, allowedCidr)))) return json(res, 403, { error: "Accès réseau refusé" });
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (assets.has(pathname) && req.method === "GET") {
      const [name, type] = assets.get(pathname);
      const content = fs.readFileSync(path.join(root, name));
      res.writeHead(200, { ...NO_STORE, "Content-Type": type, "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" });
      return res.end(content);
    }
    if (!API_PATH.test(pathname)) return json(res, 404, { error: "Introuvable" });
    const allowedMethod = ["/api/overview", "/api/audit", "/api/support"].includes(pathname) ? ["GET"] : pathname.startsWith("/api/support/") ? ["PATCH"] : pathname.endsWith("/sessions") ? ["DELETE"] : ["PATCH", "DELETE"];
    if (!allowedMethod.includes(req.method)) return json(res, 405, { error: "Méthode non autorisée" });
    if (req.method !== "GET" && (req.headers.origin !== `http://${requestHost}` || (!pathname.endsWith("/sessions") && !String(req.headers["content-type"] || "").startsWith("application/json")))) {
      return json(res, 403, { error: "Origine de la requête refusée" });
    }
    const remotePath = `/api/console${pathname.slice(4)}`;
    try {
      const body = req.method === "PATCH" || (req.method === "DELETE" && !pathname.endsWith("/sessions")) ? await readBody(req) : undefined;
      const target = new URL(`${upstream.pathname.replace(/\/$/, "")}${remotePath}`, upstream.origin);
      const response = await fetchImpl(target, {
        method: req.method,
        headers: { "X-Console-Key": key, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(12000)
      });
      const text = await response.text();
      if (!response.headers.get("content-type")?.includes("application/json")) return json(res, 502, { error: "Le backend a répondu dans un format inattendu. Vérifier son déploiement et l’URL configurée." });
      res.writeHead(response.status, { ...NO_STORE, "Content-Type": "application/json; charset=utf-8" });
      return res.end(text);
    } catch (error) {
      console.error("Console upstream unavailable:", error.message);
      return json(res, 502, { error: "Connexion au backend impossible. Vérifier l’URL et la connexion réseau." });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.CONSOLE_HOST || "127.0.0.1";
  const port = Number(process.env.CONSOLE_PORT || 5191);
  createConsoleServer({ host }).listen(port, host, () => console.log(`Console Class Odyssey : http://${host}:${port}`));
}
