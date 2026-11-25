<?php
declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dbPath = __DIR__ . '/../database/app.sqlite';
    $schemaPath = __DIR__ . '/../database/schema.sql';
    $needsInit = !file_exists($dbPath) || filesize($dbPath) === 0;

    $dir = dirname($dbPath);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    $pdo->exec('PRAGMA foreign_keys = ON;');

    if ($needsInit) {
        $schemaSql = file_get_contents($schemaPath);
        if ($schemaSql === false) {
            throw new RuntimeException('Unable to read database/schema.sql.');
        }
        $pdo->exec($schemaSql);
    }

    return $pdo;
}
