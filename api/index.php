<?php

declare(strict_types=1);

require_once __DIR__ . '/store.php';
require_once __DIR__ . '/accounts.php';

/* ============================================================
   index.php — l'API de Game of More
   Une porte d'entrée : /api/health, les comptes, les sessions, puis
   l'état du jeu, toujours celui du compte connecté.
   ============================================================ */

const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_SMALL_BODY_BYTES = 4 * 1024;
const MAX_BACKUPS = 60;

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

/* ---------- État d'un compte ---------- */

function parseStateFile(string $file): object
{
    $raw = file_get_contents($file);
    if ($raw === false) {
        throw new RuntimeException('could not read state');
    }

    $state = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
    if (!is_object($state) || !isset($state->classes) || !is_array($state->classes)) {
        throw new RuntimeException('not a Game of More state');
    }

    return $state;
}

/** @return list<string> */
function backupFiles(string $backupDir): array
{
    $files = glob($backupDir . DIRECTORY_SEPARATOR . 'state-*.json');
    if ($files === false) {
        return [];
    }
    rsort($files, SORT_STRING);
    return array_values($files);
}

function readState(string $stateFile, string $backupDir): ?object
{
    if (is_file($stateFile)) {
        try {
            return parseStateFile($stateFile);
        } catch (Throwable $error) {
            error_log('Game of More: invalid state file: ' . $error->getMessage());
        }
    }

    foreach (backupFiles($backupDir) as $backup) {
        try {
            $state = parseStateFile($backup);
            error_log('Game of More: recovered state from backup ' . basename($backup));
            return $state;
        } catch (Throwable) {
            // Try the next older backup.
        }
    }

    return null;
}

function pruneBackups(string $backupDir): void
{
    foreach (array_slice(backupFiles($backupDir), MAX_BACKUPS) as $file) {
        if (!unlink($file) && is_file($file)) {
            error_log('Game of More: could not prune backup ' . basename($file));
        }
    }
}

function writeState(array|object $state, string $stateFile, string $backupDir): void
{
    if (is_file($stateFile)) {
        $stamp = gmdate('Y-m-d\TH-i-s') . '-' . sprintf('%06d', (int) ((microtime(true) * 1_000_000) % 1_000_000)) . 'Z';
        $backup = $backupDir . DIRECTORY_SEPARATOR . 'state-' . $stamp . '.json';
        if (!copy($stateFile, $backup)) {
            throw new RuntimeException('could not back up previous state');
        }
        chmod($backup, 0600);
    }

    writeJsonAtomic($stateFile, $state);
    pruneBackups($backupDir);
}

/* ---------- Comptes et sessions ---------- */

/** @return never */
function handleSignUp(): void
{
    $payload = readJsonBody(MAX_SMALL_BODY_BYTES);
    $username = normalizeUsername(stringField($payload, 'username'));
    $password = stringField($payload, 'password');
    $displayName = trim(stringField($payload, 'displayName'));

    $problem = usernameProblem($username) ?? passwordProblem($password);
    if ($problem !== null) {
        sendJson(400, ['error' => $problem]);
    }
    if ($displayName === '') {
        $displayName = $username;
    }
    if (textLength($displayName) > MAX_DISPLAY_NAME_LENGTH) {
        sendJson(400, ['error' => 'the class name is too long']);
    }

    $account = withLock(accountsLockFile(), LOCK_EX, static function () use ($username, $displayName, $password): array {
        $index = readAccounts();
        if (findAccountByUsername($index, $username) !== null) {
            sendJson(409, ['error' => 'this username is already taken']);
        }

        $account = newAccount($username, $displayName, $password);
        $directory = accountDirectory($account['id']);
        ensureDirectory($directory);
        ensureDirectory($directory . DIRECTORY_SEPARATOR . 'backups');

        $index['accounts'][$account['id']] = $account;
        writeAccounts($index);
        return $account;
    });

    sendJson(201, ['ok' => true, 'token' => issueToken($account['id']), 'account' => publicAccount($account)]);
}

/** @return never */
function handleSignIn(): void
{
    $payload = readJsonBody(MAX_SMALL_BODY_BYTES);
    $username = normalizeUsername(stringField($payload, 'username'));
    $password = stringField($payload, 'password');

    $index = readAccounts();
    $account = findAccountByUsername($index, $username);
    $now = time();
    $failures = $account === null ? [] : recentFailures($account['failures'] ?? [], $now);

    if (count($failures) >= MAX_FAILED_ATTEMPTS) {
        refuseTooManyAttempts($failures, $now);
    }
    if ($account === null || !password_verify($password, (string) ($account['hash'] ?? ''))) {
        refuseAttempt($index, $account, $failures, $now);
    }

    if (($account['failures'] ?? []) !== []) {
        $account['failures'] = [];
        $index['accounts'][$account['id']] = $account;
        writeAccounts($index);
    }

    sendJson(200, ['ok' => true, 'token' => issueToken($account['id']), 'account' => publicAccount($account)]);
}

/** @return never */
function handleVerify(): void
{
    ['account' => $account] = requireSession();
    $payload = readJsonBody(MAX_SMALL_BODY_BYTES);
    $now = time();
    $failures = recentFailures($account['failures'] ?? [], $now);

    if (count($failures) >= MAX_FAILED_ATTEMPTS) {
        refuseTooManyAttempts($failures, $now);
    }
    if (!password_verify(stringField($payload, 'password'), (string) ($account['hash'] ?? ''))) {
        refuseAttempt(readAccounts(), $account, $failures, $now);
    }

    if (($account['failures'] ?? []) !== []) {
        $index = readAccounts();
        $account['failures'] = [];
        $index['accounts'][$account['id']] = $account;
        writeAccounts($index);
    }

    sendJson(200, ['ok' => true]);
}

/** @return never */
function handlePasswordChange(): void
{
    ['account' => $account, 'token' => $token] = requireSession();
    $payload = readJsonBody(MAX_SMALL_BODY_BYTES);
    $now = time();
    $failures = recentFailures($account['failures'] ?? [], $now);

    if (count($failures) >= MAX_FAILED_ATTEMPTS) {
        refuseTooManyAttempts($failures, $now);
    }
    if (!password_verify(stringField($payload, 'current'), (string) ($account['hash'] ?? ''))) {
        refuseAttempt(readAccounts(), $account, $failures, $now);
    }

    $next = stringField($payload, 'next');
    $problem = passwordProblem($next);
    if ($problem !== null) {
        sendJson(400, ['error' => $problem]);
    }

    $updatedAt = withLock(accountsLockFile(), LOCK_EX, static function () use ($account, $next): string {
        $index = readAccounts();
        $stored = $index['accounts'][$account['id']] ?? null;
        if (!is_array($stored)) {
            sendJson(401, ['error' => 'session expired']);
        }
        $stored['hash'] = password_hash($next, PASSWORD_DEFAULT);
        $stored['updatedAt'] = timestamp();
        $stored['failures'] = [];
        $index['accounts'][$account['id']] = $stored;
        writeAccounts($index);
        return (string) $stored['updatedAt'];
    });

    /* Changer le mot de passe déconnecte les autres appareils : c'est le
       geste qu'on fait justement quand un mot de passe a fuité. */
    revokeAccountTokens($account['id'], $token);

    sendJson(200, ['ok' => true, 'updatedAt' => $updatedAt]);
}

/* ---------- État du jeu ---------- */

/** @return never */
function handleState(string $method): void
{
    ['account' => $account] = requireSession();

    $directory = accountDirectory($account['id']);
    $backupDir = $directory . DIRECTORY_SEPARATOR . 'backups';
    ensureDirectory($directory);
    ensureDirectory($backupDir);

    $stateFile = $directory . DIRECTORY_SEPARATOR . 'state.json';
    $lockFile = $directory . DIRECTORY_SEPARATOR . 'state.lock';

    if ($method === 'GET' || $method === 'HEAD') {
        $state = withLock($lockFile, LOCK_SH, static fn (): ?object => readState($stateFile, $backupDir));
        sendJson($state === null ? 404 : 200, $state ?? ['error' => 'no state yet']);
    }

    $state = readJsonBody(MAX_BODY_BYTES);
    if (!isset($state['classes']) || !is_array($state['classes'])) {
        sendJson(400, ['error' => 'not a Game of More state']);
    }
    $state['updatedAt'] = timestamp();

    withLock($lockFile, LOCK_EX, static function () use ($state, $stateFile, $backupDir): void {
        writeState($state, $stateFile, $backupDir);
    });

    sendJson(200, ['ok' => true, 'updatedAt' => $state['updatedAt']]);
}

/** @return never */
function methodNotAllowed(string $allow): void
{
    header('Allow: ' . $allow);
    sendJson(405, ['error' => 'method not allowed']);
}

/* ---------- Routage ---------- */

$route = trim((string) ($_GET['route'] ?? ''), '/');
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($route === 'health') {
    if ($method !== 'GET' && $method !== 'HEAD') {
        methodNotAllowed('GET, HEAD');
    }
    sendJson(200, ['ok' => true, 'storage' => 'infomaniak']);
}

try {
    ensureDirectory(dataDirectory());
    bootstrapAccounts();

    if ($route === 'accounts') {
        if ($method !== 'POST') {
            methodNotAllowed('POST');
        }
        handleSignUp();
    }

    if ($route === 'session') {
        if ($method === 'POST') {
            handleSignIn();
        }
        if ($method === 'DELETE') {
            revokeToken(requestToken());
            sendJson(200, ['ok' => true]);
        }
        methodNotAllowed('POST, DELETE');
    }

    if ($route === 'session/verify') {
        if ($method !== 'POST') {
            methodNotAllowed('POST');
        }
        handleVerify();
    }

    if ($route === 'session/password') {
        if ($method !== 'PUT') {
            methodNotAllowed('PUT');
        }
        handlePasswordChange();
    }

    if ($route === 'state') {
        if ($method !== 'GET' && $method !== 'HEAD' && $method !== 'PUT') {
            methodNotAllowed('GET, HEAD, PUT');
        }
        handleState($method);
    }

    sendJson(404, ['error' => 'not found']);
} catch (Throwable $error) {
    error_log('Game of More API: ' . $error->getMessage());
    sendJson(500, ['error' => 'storage unavailable']);
}
