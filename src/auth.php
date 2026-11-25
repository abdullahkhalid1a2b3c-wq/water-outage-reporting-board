<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 30;

function login(string $username, string $password): array
{
    $now = time();
    $attempts = $_SESSION['login_attempts'] ?? ['count' => 0, 'locked_until' => 0];

    if (($attempts['locked_until'] ?? 0) > $now) {
        $remaining = (int) $attempts['locked_until'] - $now;
        json_error(429, "Too many failed login attempts. Please wait {$remaining} seconds before trying again.");
    }

    // Reset expired lockout counter
    if (($attempts['locked_until'] ?? 0) > 0 && $attempts['locked_until'] <= $now) {
        $attempts = ['count' => 0, 'locked_until' => 0];
    }

    $stmt = db()->prepare(
        'SELECT id, username, password_hash, role, display_name
         FROM users
         WHERE username = :username
         LIMIT 1'
    );
    $stmt->execute([':username' => trim($username)]);
    $user = $stmt->fetch();

    if ($user === false || !password_verify($password, (string) $user['password_hash'])) {
        $count = (int) ($attempts['count'] ?? 0) + 1;
        $lockedUntil = $count >= LOGIN_MAX_ATTEMPTS ? $now + LOGIN_LOCKOUT_SECONDS : 0;
        $_SESSION['login_attempts'] = [
            'count' => $count,
            'locked_until' => $lockedUntil,
        ];

        json_error(401, 'Invalid username or password.');
    }

    unset($_SESSION['login_attempts']);
    session_regenerate_id(true);

    $sessionUser = [
        'id' => (int) $user['id'],
        'username' => (string) $user['username'],
        'role' => (string) $user['role'],
        'display_name' => (string) $user['display_name'],
    ];

    $_SESSION['user'] = $sessionUser;

    return $sessionUser;
}

function logout(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => (bool) $params['secure'],
                'httponly' => (bool) $params['httponly'],
                'samesite' => $params['samesite'] ?: 'Lax',
            ]
        );
    }

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function current_user(): ?array
{
    $user = $_SESSION['user'] ?? null;
    return is_array($user) ? $user : null;
}

function require_login(): array
{
    $user = current_user();
    if ($user === null) {
        json_error(401, 'Authentication required.');
    }
    return $user;
}

function require_admin(): array
{
    $user = require_login();
    if (($user['role'] ?? '') !== 'admin') {
        json_error(403, 'Administrator privileges required.');
    }
    return $user;
}
