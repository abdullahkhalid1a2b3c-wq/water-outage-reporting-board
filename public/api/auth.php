<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/db.php';
require_once __DIR__ . '/../../src/response.php';
require_once __DIR__ . '/../../src/csrf.php';
require_once __DIR__ . '/../../src/auth.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
    json_response(200, [
        'user' => current_user(),
        'csrf_token' => csrf_token(),
    ]);
}

if ($method === 'POST') {
    csrf_verify();
    $body = read_json_body();
    $action = trim((string) ($body['action'] ?? ''));

    if ($action === 'login') {
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        $fields = [];
        if ($username === '') {
            $fields['username'] = 'Username is required.';
        }
        if ($password === '') {
            $fields['password'] = 'Password is required.';
        }
        if ($fields !== []) {
            json_error(422, 'Please provide both username and password.', $fields);
        }

        $user = login($username, $password);
        json_response(200, [
            'user' => $user,
            'csrf_token' => csrf_token(),
        ]);
    }

    if ($action === 'logout') {
        logout();
        session_start();
        session_regenerate_id(true);
        json_response(200, [
            'user' => null,
            'csrf_token' => csrf_token(),
            'message' => 'Logged out successfully.',
        ]);
    }

    json_error(422, 'Invalid auth action.');
}

header('Allow: GET, POST');
json_error(405, 'Method not allowed.');
