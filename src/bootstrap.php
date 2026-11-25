<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';

date_default_timezone_set('UTC');

set_exception_handler(static function (Throwable $e): void {
    error_log(sprintf(
        '[%s] %s in %s:%d',
        get_class($e),
        $e->getMessage(),
        $e->getFile(),
        $e->getLine()
    ));

    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, 'Unhandled error: ' . $e->getMessage() . PHP_EOL);
        exit(1);
    }

    json_error(500, 'An unexpected server error occurred.');
});

if (PHP_SAPI !== 'cli' && session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
