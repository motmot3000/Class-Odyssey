import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.blend': 'application/octet-stream' };
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const requested = decodeURIComponent(url.pathname === '/' ? '/character-detail-study.html' : url.pathname);
    const file = await realpath(path.resolve(root, `.${requested}`));
    const canonical = '/' + path.relative(root, file).split(path.sep).join('/');
    const allowed = ['/character-detail-study.html', '/src/character-detail-study.css', '/src/character-detail-study.mjs', '/assets/favicon.svg'].includes(canonical) || canonical.startsWith('/assets/character-detail-study/') || canonical.startsWith('/assets/characters-approved/faces-v1/');
    if (!allowed || !file.startsWith(root + path.sep) || !(await stat(file)).isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
});
const port = Number(process.env.PORT || 5202);
server.listen(port, '127.0.0.1', () => console.log(`Présentation des personnages : http://127.0.0.1:${port}/character-detail-study.html`));
