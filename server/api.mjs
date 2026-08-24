/* ============================================================
   api.mjs — l'API du serveur de développement
   Comptes enseignants, sessions par jeton et état de jeu isolé par compte.
   Ce module est utilisé par le serveur Node local et par le conteneur de
   production.
   ============================================================ */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const FOUNDER_USERNAME = "motmot3000";
export const FOUNDER_PASSWORD = "121517";
const FOUNDER_DISPLAY_NAME = "Classes de motmot3000";

const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 60;
const MAX_FAILED_ATTEMPTS = 10;
const ATTEMPT_WINDOW_SECONDS = 300;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_MAX_BACKUPS = 60;

export function createApi({ dataDir, maxBackups = DEFAULT_MAX_BACKUPS }) {
  const accountsFile = path.join(dataDir, "accounts.json");
  const sessionsFile = path.join(dataDir, "sessions.json");

  const ensureDir = (directory) => fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const accountDirectory = (accountId) => {
    if (!/^[0-9a-f]{24}$/.test(accountId)) throw new Error("bad account id");
    return path.join(dataDir, "accounts", accountId);
  };

  function readJsonFile(file) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  }

  function writeJsonAtomic(file, data) {
    ensureDir(path.dirname(file));
    const tmp = `${file}.tmp-${crypto.randomBytes(6).toString("hex")}`;
    fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  /* ---------- Comptes ---------- */

  const readAccounts = () => ({ accounts: readJsonFile(accountsFile)?.accounts || {} });
  const writeAccounts = (index) => writeJsonAtomic(accountsFile, index);

  const normalizeUsername = (username) => String(username || "").trim().toLowerCase();

  function usernameProblem(username) {
    return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)
      ? null
      : "the username needs 3 to 32 characters: letters, digits, dot, dash or underscore";
  }

  function passwordProblem(password) {
    if (String(password).trim().length < MIN_PASSWORD_LENGTH) {
      return `the password needs at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (String(password).length > MAX_PASSWORD_LENGTH) return "the password is too long";
    return null;
  }

  function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    return `scrypt$${salt}$${crypto.scryptSync(password, salt, 32).toString("hex")}`;
  }

  function passwordMatches(password, hash) {
    const [scheme, salt, expected] = String(hash || "").split("$");
    if (scheme !== "scrypt" || !salt || !expected) return false;
    const derived = crypto.scryptSync(String(password), salt, 32).toString("hex");
    return derived.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(expected, "hex"));
  }

  function newAccount(username, displayName, password) {
    const now = new Date().toISOString();
    return {
      id: crypto.randomBytes(12).toString("hex"),
      username,
      displayName,
      hash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
      failures: []
    };
  }

  const findByUsername = (index, username) =>
    Object.values(index.accounts).find((account) => account.username === username) || null;

  const recentFailures = (failures, now) =>
    (Array.isArray(failures) ? failures : []).filter((at) => Number.isInteger(at) && at > now - ATTEMPT_WINDOW_SECONDS);

  /* Premier démarrage : le compte fondateur adopte l'état déjà stocké. */
  function bootstrapAccounts() {
    if (fs.existsSync(accountsFile)) return;
    ensureDir(dataDir);

    const account = newAccount(FOUNDER_USERNAME, FOUNDER_DISPLAY_NAME, FOUNDER_PASSWORD);
    const directory = accountDirectory(account.id);
    ensureDir(path.join(directory, "backups"));

    const legacyState = path.join(dataDir, "state.json");
    if (fs.existsSync(legacyState)) {
      fs.copyFileSync(legacyState, path.join(directory, "state.json"));
      fs.renameSync(legacyState, `${legacyState}.migrated`);
    }

    writeAccounts({ accounts: { [account.id]: account } });
  }

  /* ---------- Sessions ---------- */

  const tokenKey = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
  const readSessions = () => readJsonFile(sessionsFile) || {};

  function issueToken(accountId) {
    const token = crypto.randomBytes(32).toString("hex");
    const now = Math.floor(Date.now() / 1000);
    const sessions = Object.fromEntries(
      Object.entries(readSessions()).filter(([, session]) => Number(session.expiresAt) > now)
    );
    sessions[tokenKey(token)] = {
      accountId,
      createdAt: new Date().toISOString(),
      expiresAt: now + SESSION_TTL_SECONDS
    };
    writeJsonAtomic(sessionsFile, sessions);
    return token;
  }

  function revokeToken(token) {
    const sessions = readSessions();
    delete sessions[tokenKey(token)];
    writeJsonAtomic(sessionsFile, sessions);
  }

  function revokeAccountTokens(accountId, keepToken) {
    const keepKey = keepToken ? tokenKey(keepToken) : null;
    const kept = Object.fromEntries(
      Object.entries(readSessions()).filter(([key, session]) => session.accountId !== accountId || key === keepKey)
    );
    writeJsonAtomic(sessionsFile, kept);
  }

  function sessionFor(token) {
    if (!token) return null;
    const session = readSessions()[tokenKey(token)];
    if (!session || Number(session.expiresAt) <= Math.floor(Date.now() / 1000)) return null;
    const account = readAccounts().accounts[session.accountId];
    return account ? { account, token } : null;
  }

  /* ---------- État d'un compte ---------- */

  function backupFiles(backupDir) {
    if (!fs.existsSync(backupDir)) return [];
    return fs
      .readdirSync(backupDir)
      .filter((name) => name.startsWith("state-") && name.endsWith(".json"))
      .sort()
      .reverse()
      .map((name) => path.join(backupDir, name));
  }

  function parseStateFile(file) {
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!state || !Array.isArray(state.classes)) throw new Error("not a Game of More state");
    return state;
  }

  function readState(directory) {
    const stateFile = path.join(directory, "state.json");
    if (fs.existsSync(stateFile)) {
      try {
        return parseStateFile(stateFile);
      } catch {
        // Continue through the backups below.
      }
    }
    for (const backup of backupFiles(path.join(directory, "backups"))) {
      try {
        return parseStateFile(backup);
      } catch {
        // Try the next older backup.
      }
    }
    return null;
  }

  function writeState(directory, state) {
    const backupDir = path.join(directory, "backups");
    ensureDir(backupDir);
    const stateFile = path.join(directory, "state.json");

    if (fs.existsSync(stateFile)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(stateFile, path.join(backupDir, `state-${stamp}.json`));
    }
    writeJsonAtomic(stateFile, state);

    const files = backupFiles(backupDir).reverse();
    while (files.length > maxBackups) fs.rmSync(files.shift());
  }

  const publicAccount = (account) => ({
    id: account.id,
    username: account.username,
    displayName: account.displayName
  });

  return {
    bootstrapAccounts,
    accountDirectory,
    readAccounts,
    writeAccounts,
    writeState,
    readState,
    findByUsername,
    normalizeUsername,
    usernameProblem,
    passwordProblem,
    passwordMatches,
    hashPassword,
    newAccount,
    recentFailures,
    issueToken,
    revokeToken,
    revokeAccountTokens,
    sessionFor,
    publicAccount,
    ensureDir,
    limits: { MAX_FAILED_ATTEMPTS, ATTEMPT_WINDOW_SECONDS, MAX_DISPLAY_NAME_LENGTH }
  };
}
