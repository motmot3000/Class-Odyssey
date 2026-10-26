#!/usr/bin/env node
/* Go Live launcher.
 *
 * Orca's Go Live runs `npm run dev` and opens the first local URL the command
 * prints. The 3D workshop is the surface we want on screen, so its URL is
 * announced before either server starts; the game then runs alongside on its
 * own fixed port, ready for the workshop's "Lancer l'application en temps
 * réel" button.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_PORT = '5180';
const ATELIER_PORT = '5201';
const ATELIER_URL = `http://127.0.0.1:${ATELIER_PORT}/items-3d.html`;

console.log(`Atelier 3D : ${ATELIER_URL}`);
console.log(`Application : http://127.0.0.1:${APP_PORT} (sign in with your .env credentials)`);
console.log('Ctrl+C pour arrêter les deux serveurs.');

let shuttingDown = false;
const children = [];

function shutdown(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try { child.kill(signal); } catch { /* already gone */ }
  }
  setTimeout(() => process.exit(0), 200).unref();
}

function start(label, args, env) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit'
  });
  child.on('error', error => {
    console.error(`${label} : ${error.message}`);
    shutdown();
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`${label} s'est arrêté (${signal || code}).`);
    shutdown();
  });
  children.push(child);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start('Application', ['--env-file-if-exists=.env', 'server/server.mjs'], {
  PORT: APP_PORT,
  HOST: '127.0.0.1'
});
start('Atelier 3D', ['tools/serve-items-3d.mjs'], {
  PORT: ATELIER_PORT,
  HOST: '127.0.0.1'
});
