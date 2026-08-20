<?php

declare(strict_types=1);

const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_BACKUPS = 60;

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

/** @return never */
function sendJson(int $status, array|object $payload): void
{
    $body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($body === false) {
        $status = 500;
        $body = '{"error":"could not encode response"}';
    }

    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Length: ' . strlen($body));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
        echo $body;
    }
    exit;
}

function dataDirectory(): string
{
    $configured = getenv('GAME_OF_MORE_DATA_DIR');
    if (is_string($configured) && trim($configured) !== '') {
        return rtrim($configured, DIRECTORY_SEPARATOR);
    }

    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'var';
}

function ensureDataDirectories(string $dataDir, string $backupDir): void
{
    foreach ([$dataDir, $backupDir] as $directory) {
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('could not create data directory');
        }
    }
}

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

function writeAll(string $file, string $contents): void
{
    $handle = fopen($file, 'xb');
    if ($handle === false) {
        throw new RuntimeException('could not create temporary state');
    }

    try {
        $written = 0;
        $length = strlen($contents);
        while ($written < $length) {
            $count = fwrite($handle, substr($contents, $written));
            if ($count === false || $count === 0) {
                throw new RuntimeException('could not write state');
            }
            $written += $count;
        }
        if (!fflush($handle)) {
            throw new RuntimeException('could not flush state');
        }
    } finally {
        fclose($handle);
    }
}

function pruneBackups(string $backupDir): void
{
    $files = backupFiles($backupDir);
    foreach (array_slice($files, MAX_BACKUPS) as $file) {
        if (!unlink($file) && is_file($file)) {
            error_log('Game of More: could not prune backup ' . basename($file));
        }
    }
}

function timestamp(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
}

function writeState(object $state, string $stateFile, string $backupDir): void
{
    if (is_file($stateFile)) {
        $stamp = gmdate('Y-m-d\TH-i-s') . '-' . sprintf('%06d', (int) ((microtime(true) * 1_000_000) % 1_000_000)) . 'Z';
        $backup = $backupDir . DIRECTORY_SEPARATOR . 'state-' . $stamp . '.json';
        if (!copy($stateFile, $backup)) {
            throw new RuntimeException('could not back up previous state');
        }
        chmod($backup, 0600);
    }

    $json = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        throw new RuntimeException('could not encode state');
    }
    $json .= "\n";

    $temporary = $stateFile . '.tmp-' . bin2hex(random_bytes(8));
    try {
        writeAll($temporary, $json);
        chmod($temporary, 0600);
        if (!rename($temporary, $stateFile)) {
            throw new RuntimeException('could not replace state');
        }
    } finally {
        if (is_file($temporary)) {
            unlink($temporary);
        }
    }

    pruneBackups($backupDir);
}

$route = trim((string) ($_GET['route'] ?? ''), '/');
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($route === 'health') {
    if ($method !== 'GET' && $method !== 'HEAD') {
        header('Allow: GET, HEAD');
        sendJson(405, ['error' => 'method not allowed']);
    }
    sendJson(200, ['ok' => true, 'storage' => 'infomaniak']);
}

if ($route !== 'state') {
    sendJson(404, ['error' => 'not found']);
}

$dataDir = dataDirectory();
$backupDir = $dataDir . DIRECTORY_SEPARATOR . 'backups';
$stateFile = $dataDir . DIRECTORY_SEPARATOR . 'state.json';
$lockFile = $dataDir . DIRECTORY_SEPARATOR . 'state.lock';

try {
    ensureDataDirectories($dataDir, $backupDir);
    $lock = fopen($lockFile, 'c+');
    if ($lock === false) {
        throw new RuntimeException('could not open state lock');
    }
    chmod($lockFile, 0600);

    if ($method === 'GET' || $method === 'HEAD') {
        try {
            if (!flock($lock, LOCK_SH)) {
                throw new RuntimeException('could not lock state');
            }
            $state = readState($stateFile, $backupDir);
            flock($lock, LOCK_UN);
        } finally {
            fclose($lock);
        }
        sendJson($state === null ? 404 : 200, $state ?? ['error' => 'no state yet']);
    }

    if ($method !== 'PUT') {
        fclose($lock);
        header('Allow: GET, HEAD, PUT');
        sendJson(405, ['error' => 'method not allowed']);
    }

    $announcedLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($announcedLength > MAX_BODY_BYTES) {
        fclose($lock);
        sendJson(413, ['error' => 'payload too large']);
    }

    $body = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
    if ($body === false) {
        fclose($lock);
        sendJson(400, ['error' => 'could not read request body']);
    }
    if (strlen($body) > MAX_BODY_BYTES) {
        fclose($lock);
        sendJson(413, ['error' => 'payload too large']);
    }

    try {
        $state = json_decode($body, false, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        fclose($lock);
        sendJson(400, ['error' => 'invalid JSON']);
    }
    if (!is_object($state) || !isset($state->classes) || !is_array($state->classes)) {
        fclose($lock);
        sendJson(400, ['error' => 'not a Game of More state']);
    }

    $state->updatedAt = timestamp();
    try {
        if (!flock($lock, LOCK_EX)) {
            throw new RuntimeException('could not lock state');
        }
        writeState($state, $stateFile, $backupDir);
        flock($lock, LOCK_UN);
    } finally {
        fclose($lock);
    }

    sendJson(200, ['ok' => true, 'updatedAt' => $state->updatedAt]);
} catch (Throwable $error) {
    error_log('Game of More API: ' . $error->getMessage());
    sendJson(500, ['error' => 'storage unavailable']);
}
