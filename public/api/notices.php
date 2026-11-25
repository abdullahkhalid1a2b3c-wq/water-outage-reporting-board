<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/db.php';
require_once __DIR__ . '/../../src/response.php';
require_once __DIR__ . '/../../src/csrf.php';
require_once __DIR__ . '/../../src/auth.php';
require_once __DIR__ . '/../../src/validate.php';

function format_notice(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'title' => (string) $row['title'],
        'message' => (string) $row['message'],
        'author_id' => (int) $row['author_id'],
        'author_name' => (string) ($row['author_name'] ?? ''),
        'created_at' => (string) $row['created_at'],
    ];
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$pdo = db();

if ($method === 'GET') {
    $stmt = $pdo->query(
        'SELECT n.*, u.display_name AS author_name
         FROM notices n
         JOIN users u ON u.id = n.author_id
         ORDER BY n.created_at DESC, n.id DESC'
    );
    $notices = array_map('format_notice', $stmt->fetchAll());

    json_response(200, ['notices' => $notices]);
}

if ($method === 'POST') {
    $admin = require_admin();
    csrf_verify();
    $body = read_json_body();

    $errors = validate_notice_input($body);
    if ($errors !== []) {
        json_error(422, 'Validation failed.', $errors);
    }

    $nowIso = gmdate('Y-m-d\TH:i:s\Z');
    $stmt = $pdo->prepare(
        'INSERT INTO notices (title, message, author_id, created_at)
         VALUES (:title, :message, :author_id, :created_at)'
    );
    $stmt->execute([
        ':title' => trim((string) $body['title']),
        ':message' => trim((string) $body['message']),
        ':author_id' => (int) $admin['id'],
        ':created_at' => $nowIso,
    ]);

    $id = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare(
        'SELECT n.*, u.display_name AS author_name
         FROM notices n
         JOIN users u ON u.id = n.author_id
         WHERE n.id = :id
         LIMIT 1'
    );
    $fetch->execute([':id' => $id]);
    $created = $fetch->fetch();

    json_response(201, [
        'notice' => format_notice($created),
    ]);
}

if ($method === 'DELETE') {
    require_admin();
    csrf_verify();

    $rawId = $_GET['id'] ?? '';
    if (!is_string($rawId) || !ctype_digit($rawId) || (int) $rawId <= 0) {
        json_error(400, 'A valid numeric notice id is required.');
    }
    $id = (int) $rawId;

    $check = $pdo->prepare('SELECT id FROM notices WHERE id = :id LIMIT 1');
    $check->execute([':id' => $id]);
    if ($check->fetch() === false) {
        json_error(404, 'Notice not found.');
    }

    $del = $pdo->prepare('DELETE FROM notices WHERE id = :id');
    $del->execute([':id' => $id]);

    json_response(200, [
        'deleted' => true,
        'id' => $id,
    ]);
}

header('Allow: GET, POST, DELETE');
json_error(405, 'Method not allowed.');
