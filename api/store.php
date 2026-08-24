<?php

declare(strict_types=1);

/* ============================================================
   store.php — écritures sûres sur disque
   Tout ce qui touche au stockage passe par ici : réponses JSON, dossier
   de données, écriture atomique et verrous. Les autres fichiers ne
   manipulent jamais un descripteur eux-mêmes.
   ============================================================ */

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

function ensureDirectory(string $directory): void
{
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('could not create data directory');
    }
}

function timestamp(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
}

function writeAll(string $file, string $contents): void
{
    $handle = fopen($file, 'xb');
    if ($handle === false) {
        throw new RuntimeException('could not create temporary file');
    }

    try {
        $written = 0;
        $length = strlen($contents);
        while ($written < $length) {
            $count = fwrite($handle, substr($contents, $written));
            if ($count === false || $count === 0) {
                throw new RuntimeException('could not write file');
            }
            $written += $count;
        }
        if (!fflush($handle)) {
            throw new RuntimeException('could not flush file');
        }
    } finally {
        fclose($handle);
    }
}

/* Fichier temporaire puis `rename` : une coupure de courant laisse l'ancien
   fichier intact, jamais un fichier à moitié écrit. */
function writeJsonAtomic(string $file, array|object $data): void
{
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        throw new RuntimeException('could not encode data');
    }

    $temporary = $file . '.tmp-' . bin2hex(random_bytes(8));
    try {
        writeAll($temporary, $json . "\n");
        chmod($temporary, 0600);
        if (!rename($temporary, $file)) {
            throw new RuntimeException('could not replace file');
        }
    } finally {
        if (is_file($temporary)) {
            unlink($temporary);
        }
    }
}

/** @return ?array<string, mixed> */
function readJsonFile(string $file): ?array
{
    if (!is_file($file)) {
        return null;
    }

    $raw = file_get_contents($file);
    if ($raw === false) {
        error_log('Game of More: could not read ' . basename($file));
        return null;
    }

    try {
        $parsed = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable $error) {
        error_log('Game of More: invalid file ' . basename($file) . ': ' . $error->getMessage());
        return null;
    }

    return is_array($parsed) ? $parsed : null;
}

/**
 * Exécute $work en tenant le verrou. `sendJson` sort du script sans repasser
 * ici : la fin du processus relâche alors le verrou, ce qui suffit.
 */
function withLock(string $lockFile, int $mode, callable $work): mixed
{
    $lock = fopen($lockFile, 'c+');
    if ($lock === false) {
        throw new RuntimeException('could not open lock');
    }
    chmod($lockFile, 0600);

    try {
        if (!flock($lock, $mode)) {
            throw new RuntimeException('could not acquire lock');
        }
        $result = $work();
        flock($lock, LOCK_UN);
        return $result;
    } finally {
        fclose($lock);
    }
}

/** @return array<string, mixed> */
function readJsonBody(int $maxBytes): array
{
    $announced = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($announced > $maxBytes) {
        sendJson(413, ['error' => 'payload too large']);
    }

    $body = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($body === false) {
        sendJson(400, ['error' => 'could not read request body']);
    }
    if (strlen($body) > $maxBytes) {
        sendJson(413, ['error' => 'payload too large']);
    }

    try {
        $parsed = json_decode($body, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        sendJson(400, ['error' => 'invalid JSON']);
    }

    return is_array($parsed) ? $parsed : [];
}

function stringField(array $payload, string $key): string
{
    $value = $payload[$key] ?? null;
    return is_string($value) ? $value : '';
}

/* mbstring n'est pas garanti sur un hébergement mutualisé. */
function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
}
