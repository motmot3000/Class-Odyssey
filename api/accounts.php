<?php

declare(strict_types=1);

require_once __DIR__ . '/store.php';

/* ============================================================
   accounts.php — comptes enseignants et sessions
   Chaque enseignant a son compte, son dossier et ses sauvegardes. Rien
   n'est partagé entre deux comptes : ni l'état du jeu, ni les héros, ni
   les sauvegardes horodatées.
   ============================================================ */

/* Le compte de départ, créé au premier démarrage avec les données déjà
   présentes. Il se change ensuite depuis la console, comme les autres. */
const FOUNDER_USERNAME = 'motmot3000';
const FOUNDER_PASSWORD = '121517';
const FOUNDER_DISPLAY_NAME = 'Classes de motmot3000';

const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 60;

/* Freinage des essais : de quoi décourager un élève qui teste des dates
   d'anniversaire, sans jamais enfermer l'enseignant plus de cinq minutes. */
const MAX_FAILED_ATTEMPTS = 10;
const ATTEMPT_WINDOW_SECONDS = 300;

/* Un mois : l'enseignant se reconnecte à la rentrée, pas à chaque leçon. */
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function accountsFile(): string
{
    return dataDirectory() . DIRECTORY_SEPARATOR . 'accounts.json';
}

function sessionsFile(): string
{
    return dataDirectory() . DIRECTORY_SEPARATOR . 'sessions.json';
}

function accountsLockFile(): string
{
    return dataDirectory() . DIRECTORY_SEPARATOR . 'accounts.lock';
}

/* L'identifiant du compte entre dans un chemin de fichier : il ne peut être
   qu'une suite d'hexadécimaux produite ici, jamais une saisie. */
function accountDirectory(string $accountId): string
{
    if (preg_match('/^[0-9a-f]{24}$/', $accountId) !== 1) {
        throw new RuntimeException('bad account id');
    }
    return dataDirectory() . DIRECTORY_SEPARATOR . 'accounts' . DIRECTORY_SEPARATOR . $accountId;
}

function normalizeUsername(string $username): string
{
    return strtolower(trim($username));
}

function usernameProblem(string $username): ?string
{
    if (preg_match('/^[a-z0-9][a-z0-9._-]{2,31}$/', $username) !== 1) {
        return 'the username needs 3 to 32 characters: letters, digits, dot, dash or underscore';
    }
    return null;
}

function passwordProblem(string $password): ?string
{
    if (textLength(trim($password)) < MIN_PASSWORD_LENGTH) {
        return 'the password needs at least ' . MIN_PASSWORD_LENGTH . ' characters';
    }
    if (textLength($password) > MAX_PASSWORD_LENGTH) {
        return 'the password is too long';
    }
    return null;
}

/** @return array{accounts: array<string, array<string, mixed>>} */
function readAccounts(): array
{
    $stored = readJsonFile(accountsFile());
    $accounts = is_array($stored['accounts'] ?? null) ? $stored['accounts'] : [];
    return ['accounts' => $accounts];
}

function writeAccounts(array $index): void
{
    writeJsonAtomic(accountsFile(), $index);
}

/** @return ?array<string, mixed> */
function findAccountByUsername(array $index, string $username): ?array
{
    foreach ($index['accounts'] as $account) {
        if (($account['username'] ?? null) === $username) {
            return $account;
        }
    }
    return null;
}

/**
 * Premier démarrage : le compte fondateur adopte l'état déjà stocké, pour
 * que la mise en service ne fasse perdre aucune classe.
 */
function bootstrapAccounts(): void
{
    if (is_file(accountsFile())) {
        return;
    }

    withLock(accountsLockFile(), LOCK_EX, static function (): void {
        if (is_file(accountsFile())) {
            return;
        }

        $account = newAccount(FOUNDER_USERNAME, FOUNDER_DISPLAY_NAME, FOUNDER_PASSWORD);
        $directory = accountDirectory($account['id']);
        ensureDirectory($directory);
        ensureDirectory($directory . DIRECTORY_SEPARATOR . 'backups');

        $legacyState = dataDirectory() . DIRECTORY_SEPARATOR . 'state.json';
        if (is_file($legacyState)) {
            $adopted = $directory . DIRECTORY_SEPARATOR . 'state.json';
            if (copy($legacyState, $adopted)) {
                chmod($adopted, 0600);
                // L'ancien fichier est conservé sous un autre nom : une
                // reprise ratée doit rester réparable à la main.
                rename($legacyState, $legacyState . '.migrated');
            } else {
                error_log('Game of More: could not adopt the existing state');
            }
        }

        writeAccounts(['accounts' => [$account['id'] => $account]]);
    });
}

/** @return array<string, mixed> */
function newAccount(string $username, string $displayName, string $password): array
{
    $now = timestamp();
    return [
        'id' => bin2hex(random_bytes(12)),
        'username' => $username,
        'displayName' => $displayName,
        'hash' => password_hash($password, PASSWORD_DEFAULT),
        'createdAt' => $now,
        'updatedAt' => $now,
        'failures' => [],
    ];
}

/** @return list<int> */
function recentFailures(array $failures, int $now): array
{
    $recent = [];
    foreach ($failures as $at) {
        if ((is_int($at) || (is_string($at) && ctype_digit($at))) && (int) $at > $now - ATTEMPT_WINDOW_SECONDS) {
            $recent[] = (int) $at;
        }
    }
    return $recent;
}

/** @return never */
function refuseAttempt(array $index, ?array $account, array $failures, int $now): void
{
    if ($account !== null) {
        $account['failures'] = array_slice([...$failures, $now], -MAX_FAILED_ATTEMPTS);
        $index['accounts'][$account['id']] = $account;
        writeAccounts($index);
    }
    // Une réponse instantanée invite à essayer mille fois de suite.
    usleep(300_000);
    sendJson(401, ['error' => 'wrong username or password']);
}

/** @return never */
function refuseTooManyAttempts(array $failures, int $now): void
{
    $retryAfter = max(1, ATTEMPT_WINDOW_SECONDS - ($now - min($failures)));
    header('Retry-After: ' . $retryAfter);
    sendJson(429, ['error' => 'too many attempts', 'retryAfter' => $retryAfter]);
}

/** Ce que le navigateur a le droit de connaître d'un compte. */
function publicAccount(array $account): array
{
    return [
        'id' => $account['id'],
        'username' => $account['username'],
        'displayName' => $account['displayName'],
    ];
}

/* ---------- Sessions ---------- */

function tokenKey(string $token): string
{
    return hash('sha256', $token);
}

/** @return array<string, array<string, mixed>> */
function readSessions(): array
{
    $stored = readJsonFile(sessionsFile());
    return is_array($stored) ? $stored : [];
}

function issueToken(string $accountId): string
{
    $token = bin2hex(random_bytes(32));
    $now = time();

    withLock(accountsLockFile(), LOCK_EX, static function () use ($token, $accountId, $now): void {
        $sessions = [];
        foreach (readSessions() as $key => $session) {
            if ((int) ($session['expiresAt'] ?? 0) > $now) {
                $sessions[$key] = $session;
            }
        }
        $sessions[tokenKey($token)] = [
            'accountId' => $accountId,
            'createdAt' => timestamp(),
            'expiresAt' => $now + SESSION_TTL_SECONDS,
        ];
        writeJsonAtomic(sessionsFile(), $sessions);
    });

    return $token;
}

function revokeToken(string $token): void
{
    withLock(accountsLockFile(), LOCK_EX, static function () use ($token): void {
        $sessions = readSessions();
        unset($sessions[tokenKey($token)]);
        writeJsonAtomic(sessionsFile(), $sessions);
    });
}

function revokeAccountTokens(string $accountId, ?string $keepToken = null): void
{
    withLock(accountsLockFile(), LOCK_EX, static function () use ($accountId, $keepToken): void {
        $kept = [];
        $keepKey = $keepToken === null ? null : tokenKey($keepToken);
        foreach (readSessions() as $key => $session) {
            if (($session['accountId'] ?? null) !== $accountId || $key === $keepKey) {
                $kept[$key] = $session;
            }
        }
        writeJsonAtomic(sessionsFile(), $kept);
    });
}

/* Le jeton voyage dans un en-tête à nous : `Authorization` est parfois
   retiré par Apache avant d'atteindre PHP, celui-ci arrive toujours. */
function requestToken(): string
{
    $token = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? '';
    return is_string($token) ? trim($token) : '';
}

/** @return array{account: array<string, mixed>, token: string} */
function requireSession(): array
{
    $token = requestToken();
    if ($token === '') {
        sendJson(401, ['error' => 'not signed in']);
    }

    $session = readSessions()[tokenKey($token)] ?? null;
    if (!is_array($session) || (int) ($session['expiresAt'] ?? 0) <= time()) {
        sendJson(401, ['error' => 'session expired']);
    }

    $index = readAccounts();
    $account = $index['accounts'][$session['accountId'] ?? ''] ?? null;
    if (!is_array($account)) {
        sendJson(401, ['error' => 'session expired']);
    }

    return ['account' => $account, 'token' => $token];
}
