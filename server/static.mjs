import fs from "node:fs";
import path from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".glb": "model/gltf-binary", ".ico": "image/x-icon"
};
const CACHEABLE_IMAGES = new Set([".svg", ".jpg", ".jpeg", ".png", ".webp", ".ico"]);
const ENTRIES = new Set(["index.html", "styles.css", "items-3d.html", "character-lab.html", "character-detail-study.html"]);
const PROTOTYPE_TYPES = new Set([".html", ".css", ".js", ".mjs", ".glb", ".webp"]);

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/** Hash routing needs no catch-all HTML fallback. A missing JS/GLB/image must
 * be a 404 so callers can show recovery UI instead of trying to parse HTML.
 * Resolve symlinks before serving anything; an assets/ alias must not expose
 * account data, server sources, dotfiles, or files outside the public tree.
 */
export function createStaticHandler({ publicDir, dataDir }) {
  const root = fs.realpathSync(publicDir);
  const privateRoot = fs.realpathSync(dataDir);
  function allowed(target) {
    if (!inside(root, target) || inside(privateRoot, target)) return false;
    const relative = path.relative(root, target);
    const parts = relative.split(path.sep);
    if (parts.some(part => part.startsWith("."))) return false;
    return ENTRIES.has(relative) || ["assets", "src"].includes(parts[0])
      || (parts[0] === "prototype" && parts[1] === "sheikah" && PROTOTYPE_TYPES.has(path.extname(target)));
  }
  return function serveStatic(req, res, pathname) {
    const notFound = () => res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    let target;
    let stat;
    try {
      const decoded = decodeURIComponent(pathname);
      if (decoded.includes("\0") || decoded.includes("\\")) return notFound();
      target = path.resolve(root, `.${decoded}`);
      if (!inside(root, target)) return notFound();
      if (fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
      target = fs.realpathSync(target);
      if (!allowed(target)) return notFound();
      stat = fs.statSync(target);
      if (!stat.isFile()) return notFound();
    } catch { return notFound(); }

    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": CACHEABLE_IMAGES.has(ext) ? "public, max-age=3600" : "no-cache"
    });
    if (req.method === "HEAD") return res.end();
    // Large catalogues must not block sign-in and state requests while reading.
    const stream = fs.createReadStream(target);
    stream.on("error", error => res.destroy(error));
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  };
}
