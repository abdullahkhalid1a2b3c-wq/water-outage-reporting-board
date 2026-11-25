<?php
declare(strict_types=1);

function json_response(int $status, array $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_THROW_ON_ERROR);
    exit;
}

function json_error(int $status, string $message, array $fields = []): never
{
    $payload = ['error' => $message];
    if ($fields !== []) {
        $payload['fields'] = $fields;
    }
    json_response($status, $payload);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        json_error(400, 'Invalid JSON request body.');
    }

    if (!is_array($decoded)) {
        json_error(400, 'JSON request body must be an object.');
    }

    return $decoded;
}
