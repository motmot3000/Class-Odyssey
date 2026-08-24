import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_MAX_BACKUPS = 60;

function emptyState() {
  return {
    revision: 0,
    activeClassId: "7p",
    selectedPupilId: null,
    selectMode: false,
    selectedPupilIds: [],
    classes: [
      { id: "7p", name: "7P", pupils: [] },
      { id: "8p", name: "8P", pupils: [] }
    ],
    events: []
  };
}

export function createApi({ dataDir, founderUsername, founderPassword, maxBackups = DEFAULT_MAX_BACKUPS }) {
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
    const files = backupFiles(directory, prefix).reverse();
    while (files.length > maxBackups) fs.rmSync(files.shift());
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

  function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(String(password), salt, 32);
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
  }

  function passwordMatches(password, hash) {
    const [scheme, saltHex, expectedHex] = String(hash || "").split("$");
    if (scheme !== "scrypt" || !/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{64}$/.test(expectedHex)) return false;
    const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, "hex"), 32);
    return crypto.timingSafeEqual(actual, Buffer.from(expectedHex, "hex"));
  }

  function newAccount(username, displayName, password, role = "teacher") {
    const now = new Date().toISOString();
    return {
      id: crypto.randomBytes(12).toString("hex"),
      username,
      displayName,
      role,
      hash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null
    };
  }

  function validAccountsIndex(index) {
    return index && typeof index === "object" && index.accounts && typeof index.accounts === "object" && !Array.isArray(index.accounts);
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

  function parseStateFile(file) {
    const state = readJsonFile(file);
    if (!state || !Array.isArray(state.classes)
      || !state.classes.every((classroom) => classroom && typeof classroom === "object" && Array.isArray(classroom.pupils))) {
      throw new Error("not a Game of More state");
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
        if (role !== account.role) {
          index.accounts[id] = { ...account, role };
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
    const account = newAccount(username, `Classes de ${username}`, founderPassword, "admin");
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
    return Object.fromEntries(Object.entries(readSessions()).filter(([, session]) => Number(session.expiresAt) > now));
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
    displayName: account.displayName,
    role: account.role || "teacher",
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt || null
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
    emptyState,
    ensureDir,
    limits: { MAX_DISPLAY_NAME_LENGTH }
  };
}
