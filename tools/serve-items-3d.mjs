import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.blend': 'application/octet-stream' };
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const requested = decodeURIComponent(url.pathname === '/' ? '/items-3d.html' : url.pathname);
    // The workshop shows the deployed avatars, so the live base characters
    // (assets/character-stylized) must be servable next to the baked items.
    const allowed = requested === '/items-3d.html' || requested === '/src/items-3d.css' || requested.startsWith('/assets/items-3d/') || requested.startsWith('/assets/character-stylized/') || requested.startsWith('/assets/brand/');
    const file = path.resolve(root, `.${requested}`);
    if (!allowed || !file.startsWith(root + path.sep) || !(await stat(file)).isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
});
const port = Number(process.env.PORT || 5201);
server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Atelier items 3D : http://localhost:${port}/items-3d.html`));
