import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { isStateDocument } from "../src/state-schema.mjs";

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 60;
const MAX_CLASS_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 160;
const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;
const DEFAULT_MAX_BACKUPS = 60;
// A real classroom state is far smaller; these caps bound the disk a single
// account can use without limiting how many accounts exist.
const MAX_STATE_BYTES = 4 * 1024 * 1024;
const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
// Bound scrypt's memory so a burst of hashing cannot exhaust the container.
const SCRYPT_OPTIONS = { maxmem: 64 * 1024 * 1024 };
const scrypt = promisify(crypto.scrypt);

export const DEFAULT_SETTINGS = Object.freeze({ language: null, theme: null, onboarding: Object.freeze({ completed: false, step: 0 }) });

/* Account settings are additive: missing or invalid values fall back to the
 * neutral defaults so legacy accounts and partial updates stay renderable. */
export function settingsWithDefaults(settings) {
  const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  const onboarding = source.onboarding && typeof source.onboarding === "object" && !Array.isArray(source.onboarding)
    ? source.onboarding
    : {};
  return {
    language: source.language === "fr" || source.language === "en" ? source.language : null,
    theme: source.theme === "light" || source.theme === "dark" ? source.theme : null,
    onboarding: {
      completed: Boolean(onboarding.completed),
      step: Number.isSafeInteger(onboarding.step) && onboarding.step >= 0 ? onboarding.step : 0
    }
  };
}

function emailProblem(email) {
  const value = String(email || "").trim();
  if (!value) return "an email address is required";
  if (value.length > MAX_EMAIL_LENGTH) return "the email address is too long";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "the email address is not valid";
  return null;
}

function emptyState() {
  return {
    revision: 0,
    activeClassId: null,
    selectedPupilId: null,
    selectMode: false,
    selectedPupilIds: [],
    classes: [],
    events: []
  };
}

export function createApi({ dataDir, founderUsername, founderPassword, maxBackups = DEFAULT_MAX_BACKUPS }) {
  if (!Number.isSafeInteger(maxBackups) || maxBackups < 0) {
    throw new Error("MAX_BACKUPS must be a non-negative safe integer");
  }
  const accountsFile = path.join(dataDir, "accounts.json");
  const sessionsFile = path.join(dataDir, "sessions.json");
  const accountBackupsDir = path.join(dataDir, "account-backups");

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
    const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
    try {
      fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmp, file);
    } finally {
      if (fs.existsSync(tmp)) fs.rmSync(tmp);
    }
  }

  function backupFiles(directory, prefix = "state-") {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory)
      .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
      .sort()
      .reverse()
      .map((name) => path.join(directory, name));
  }

  function timestampedName(prefix) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${prefix}${stamp}-${crypto.randomBytes(3).toString("hex")}.json`;
  }

  function pruneBackups(directory, prefix) {
    const files = backupFiles(directory, prefix).reverse(); // oldest first
    while (files.length > maxBackups) fs.rmSync(files.shift());
    // Cap total backup bytes as well, so one large state cannot grow the disk
    // without bound even while staying under the version count.
    let total = 0;
    for (const file of files) {
      try { total += fs.statSync(file).size; } catch { /* skip unreadable */ }
    }
    while (files.length && total > MAX_BACKUP_BYTES) {
      const oldest = files.shift();
      try { total -= fs.statSync(oldest).size; } catch { /* skip unreadable */ }
      fs.rmSync(oldest);
    }
  }

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

  async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const derived = await scrypt(String(password), salt, 32, SCRYPT_OPTIONS);
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
  }

  // Startup-only: the founder hash is computed once, before the server accepts
  // requests, so a synchronous derivation here never blocks a live event loop.
  function hashPasswordSync(password) {
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(String(password), salt, 32, SCRYPT_OPTIONS);
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
  }

  async function passwordMatches(password, hash) {
    const [scheme, saltHex, expectedHex] = String(hash || "").split("$");
    if (scheme !== "scrypt" || !/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{64}$/.test(expectedHex)) return false;
    const expected = Buffer.from(expectedHex, "hex");
    const actual = await scrypt(String(password), Buffer.from(saltHex, "hex"), 32, SCRYPT_OPTIONS);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  function buildAccount(username, displayName, role, hash, email = "") {
    const now = new Date().toISOString();
    return {
      id: crypto.randomBytes(12).toString("hex"),
      username,
      email: String(email || "").trim(),
      displayName,
      role,
      hash,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      terms: null,
      settings: settingsWithDefaults(null)
    };
  }

  async function newAccount(username, displayName, password, role = "teacher", email = "") {
    return buildAccount(username, displayName, role, await hashPassword(password), email);
  }

  function validAccountsIndex(index) {
    return index && typeof index === "object" && index.accounts && typeof index.accounts === "object" && !Array.isArray(index.accounts)
      && Object.entries(index.accounts).every(([id, account]) => account && typeof account === "object"
        && account.id === id && /^[0-9a-f]{24}$/.test(id)
        && typeof account.username === "string" && typeof account.hash === "string");
  }

  function readAccounts() {
    const current = readJsonFile(accountsFile);
    if (validAccountsIndex(current)) return current;
    for (const backup of backupFiles(accountBackupsDir, "accounts-")) {
      const recovered = readJsonFile(backup);
      if (validAccountsIndex(recovered)) {
        console.warn(`Recovered account index from backup: ${backup}`);
        return recovered;
      }
    }
    if (fs.existsSync(accountsFile)) throw new Error("account index is corrupt and no backup is usable");
    return { accounts: {} };
  }

  function writeAccounts(index, { backup = true } = {}) {
    if (!validAccountsIndex(index)) throw new Error("invalid account index");
    writeJsonAtomic(accountsFile, index);
    if (backup) {
      ensureDir(accountBackupsDir);
      fs.copyFileSync(accountsFile, path.join(accountBackupsDir, timestampedName("accounts-")));
      pruneBackups(accountBackupsDir, "accounts-");
    }
  }

  const findByUsername = (index, username) =>
    Object.values(index.accounts).find((account) => account.username === username) || null;

  const findByEmail = (index, email) =>
    Object.values(index.accounts).find((account) => String(account.email || "").trim().toLowerCase() === String(email || "").trim().toLowerCase()) || null;

  // Accounts identify themselves by email; the username used for storage and
  // state folders is derived once from the address so users type only the
  // email and a password.
  function usernameFromEmail(email) {
    const local = String(email || "").split("@")[0].toLowerCase()
      .replace(/[^a-z0-9._-]/g, "_")
      .replace(/^[._-]+/, "")
      .replace(/[._-]+$/, "");
    if (/^[a-z0-9][a-z0-9._-]{2,31}$/.test(local)) return local;
    const padded = `teacher-${local}`.slice(0, 32).replace(/[^a-z0-9._-]$/, "");
    if (/^[a-z0-9][a-z0-9._-]{2,31}$/.test(padded)) return padded;
    return `teacher-${crypto.randomBytes(4).toString("hex")}`;
  }

  /* Google sign-in creates a free username when the address local part is
   * already taken, instead of refusing the account. */
  function availableUsername(index, base) {
    const candidate = /^[a-z0-9][a-z0-9._-]{2,31}$/.test(base) ? base : usernameFromEmail(base);
    let username = candidate;
    let counter = 2;
    while (findByUsername(index, username)) {
      const room = Math.max(3, 32 - String(counter).length - 1);
      username = `${candidate.slice(0, room)}-${counter}`;
      counter += 1;
      if (counter > 1000) return `teacher-${crypto.randomBytes(4).toString("hex")}`;
    }
    return username;
  }

  function parseStateFile(file) {
    const state = readJsonFile(file);
    if (!isStateDocument(state)) {
      throw new Error("not a Class Odyssey state");
    }
    const revision = Number.isSafeInteger(state.revision) && state.revision >= 0 ? state.revision : 0;
    return { ...state, revision };
  }

  function readState(directory) {
    const stateFile = path.join(directory, "state.json");
    if (fs.existsSync(stateFile)) {
      try {
        return parseStateFile(stateFile);
      } catch {
        // Fall through to this account's backups.
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

  function writeState(directory, state, { backup = true } = {}) {
    const backupDir = path.join(directory, "backups");
    const stateFile = path.join(directory, "state.json");
    ensureDir(backupDir);
    if (backup && fs.existsSync(stateFile)) {
      fs.copyFileSync(stateFile, path.join(backupDir, timestampedName("state-")));
    }
    writeJsonAtomic(stateFile, state);
    if (backup) pruneBackups(backupDir, "state-");
  }

  function createAccountWithState(index, account, state = emptyState()) {
    const directory = accountDirectory(account.id);
    if (fs.existsSync(directory)) throw new Error("account directory already exists");
    ensureDir(path.join(directory, "backups"));
    try {
      writeState(directory, state, { backup: false });
      writeAccounts({ accounts: { ...index.accounts, [account.id]: account } });
    } catch (error) {
      if (!readAccounts().accounts[account.id]) fs.rmSync(directory, { recursive: true, force: true });
      throw error;
    }
  }

  function bootstrapAccounts() {
    if (fs.existsSync(accountsFile) || backupFiles(accountBackupsDir, "accounts-").length) {
      const needsRestore = !validAccountsIndex(readJsonFile(accountsFile));
      const index = readAccounts();
      const founder = normalizeUsername(founderUsername);
      let changed = false;
      for (const [id, account] of Object.entries(index.accounts)) {
        const role = founder && account.username === founder ? "admin" : (account.role || "teacher");
        const email = typeof account.email === "string" ? account.email : "";
        // Backfill settings and email on legacy accounts without touching data.
        const settings = account.settings === undefined ? settingsWithDefaults(null) : account.settings;
        if (role !== account.role || email !== account.email || settings !== account.settings) {
          index.accounts[id] = { ...account, role, email, settings };
          changed = true;
        }
      }
      if (changed || needsRestore) writeAccounts(index);
      return;
    }
    const username = normalizeUsername(founderUsername);
    if (!founderUsername || !founderPassword) {
      throw new Error("FOUNDER_USERNAME and FOUNDER_PASSWORD are required for first initialization");
    }
    const problem = usernameProblem(username) || passwordProblem(founderPassword);
    if (problem) throw new Error(`invalid founder credentials: ${problem}`);

    ensureDir(dataDir);
    const account = buildAccount(username, `Classes de ${username}`, "admin", hashPasswordSync(founderPassword));
    const directory = accountDirectory(account.id);
    ensureDir(path.join(directory, "backups"));
    const legacyState = path.join(dataDir, "state.json");
    try {
      const state = fs.existsSync(legacyState) ? parseStateFile(legacyState) : emptyState();
      writeState(directory, state, { backup: false });
      // accounts.json is the initialization commit point.
      writeAccounts({ accounts: { [account.id]: account } }, { backup: false });
      if (fs.existsSync(legacyState)) {
        let migrated = path.join(dataDir, "state.json.migrated");
        if (fs.existsSync(migrated)) migrated = path.join(dataDir, `state.json.migrated-${Date.now()}`);
        fs.renameSync(legacyState, migrated);
      }
    } catch (error) {
      if (!fs.existsSync(accountsFile)) fs.rmSync(directory, { recursive: true, force: true });
      throw error;
    }
  }

  const tokenKey = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
  const readSessions = () => {
    const sessions = readJsonFile(sessionsFile);
    return sessions && typeof sessions === "object" && !Array.isArray(sessions) ? sessions : {};
  };
  const writeSessions = (sessions) => writeJsonAtomic(sessionsFile, sessions);

  function liveSessions() {
    const now = Math.floor(Date.now() / 1000);
    return Object.fromEntries(Object.entries(readSessions()).filter(([, session]) => session
      && typeof session.accountId === "string" && Number.isFinite(Number(session.expiresAt))
      && Number(session.expiresAt) > now));
  }

  function issueToken(accountId) {
    const token = crypto.randomBytes(32).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const sessions = liveSessions();
    sessions[tokenKey(token)] = {
      accountId,
      createdAt: new Date().toISOString(),
      expiresAt: now + SESSION_TTL_SECONDS
    };
    writeSessions(sessions);
    return token;
  }

  function revokeToken(token) {
    if (!token) return;
    const sessions = liveSessions();
    delete sessions[tokenKey(token)];
    writeSessions(sessions);
  }

  function revokeAccountTokens(accountId, keepToken = null) {
    const keepKey = keepToken ? tokenKey(keepToken) : null;
    const sessions = Object.fromEntries(
      Object.entries(liveSessions()).filter(([key, session]) => session.accountId !== accountId || key === keepKey)
    );
    writeSessions(sessions);
  }

  function sessionFor(token) {
    if (!token) return null;
    const session = liveSessions()[tokenKey(token)];
    if (!session) return null;
    const account = readAccounts().accounts[session.accountId];
    return account ? { account, token } : null;
  }

  function activeSessionCounts() {
    const counts = {};
    for (const session of Object.values(liveSessions())) counts[session.accountId] = (counts[session.accountId] || 0) + 1;
    return counts;
  }

  const publicAccount = (account) => ({
    id: account.id,
    username: account.username,
    email: account.email || "",
    displayName: account.displayName,
    role: account.role || "teacher",
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt || null,
    terms: account.terms && typeof account.terms === "object" && account.terms.acceptedAt
      ? { acceptedAt: account.terms.acceptedAt, version: account.terms.version || null }
      : null,
    settings: settingsWithDefaults(account.settings)
  });

  return {
    bootstrapAccounts,
    accountDirectory,
    readAccounts,
    writeAccounts,
    createAccountWithState,
    writeState,
    readState,
    findByUsername,
    findByEmail,
    usernameFromEmail,
    availableUsername,
    normalizeUsername,
    usernameProblem,
    passwordProblem,
    passwordMatches,
    hashPassword,
    newAccount,
    issueToken,
    revokeToken,
    revokeAccountTokens,
    sessionFor,
    activeSessionCounts,
    publicAccount,
    settingsWithDefaults,
    emailProblem,
    emptyState,
    ensureDir,
    limits: { MAX_DISPLAY_NAME_LENGTH, MAX_CLASS_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_STATE_BYTES }
  };
}
