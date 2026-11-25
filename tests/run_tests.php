<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('This test runner can only be executed from the command line.');
}

$baseUrl = rtrim($argv[1] ?? 'http://localhost:8000', '/');

// 1. Reset database using seed.php
echo "Seeding database...\n";
$seedCmd = 'php ' . escapeshellarg(__DIR__ . '/../database/seed.php');
exec($seedCmd, $seedOutput, $seedCode);
if ($seedCode !== 0) {
    fwrite(STDERR, "Failed to run database/seed.php (exit {$seedCode})\n");
    exit(1);
}
echo implode("\n", $seedOutput) . "\n\n";

$residentJar = tempnam(sys_get_temp_dir(), 'wob_res_');
$adminJar = tempnam(sys_get_temp_dir(), 'wob_adm_');

$passed = 0;
$failed = 0;

function http_request(
    string $baseUrl,
    string $method,
    string $path,
    ?string $rawBody = null,
    ?string $cookieFile = null,
    ?string $csrfToken = null
): array {
    $ch = curl_init($baseUrl . $path);
    $headers = ['Accept: application/json'];

    if ($rawBody !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($csrfToken !== null && $csrfToken !== '') {
        $headers[] = 'X-CSRF-Token: ' . $csrfToken;
    }

    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 10,
    ]);

    if ($rawBody !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody);
    }
    if ($cookieFile !== null) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    }

    $responseBody = curl_exec($ch);
    if ($responseBody === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException("cURL error for {$method} {$path}: {$err}");
    }

    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($responseBody, true);
    return [
        'status' => $status,
        'body' => is_array($decoded) ? $decoded : null,
        'raw' => $responseBody,
    ];
}

function record_result(string $id, string $name, bool $ok, int $status, string $detail = ''): void
{
    global $passed, $failed;
    if ($ok) {
        $passed++;
        echo sprintf("[PASS] %-4s %-32s (HTTP %d)%s\n", $id, $name, $status, $detail !== '' ? " - {$detail}" : '');
    } else {
        $failed++;
        echo sprintf("[FAIL] %-4s %-32s (HTTP %d)%s\n", $id, $name, $status, $detail !== '' ? " - {$detail}" : '');
    }
}

try {
    // Authenticate resident1
    $authInit = http_request($baseUrl, 'GET', '/api/auth.php', null, $residentJar);
    $resCsrf = (string) ($authInit['body']['csrf_token'] ?? '');

    $loginRes = http_request(
        $baseUrl,
        'POST',
        '/api/auth.php',
        json_encode(['action' => 'login', 'username' => 'resident1', 'password' => 'Resident#2026'], JSON_THROW_ON_ERROR),
        $residentJar,
        $resCsrf
    );
    if ($loginRes['status'] !== 200) {
        throw new RuntimeException('Could not log in as resident1: HTTP ' . $loginRes['status']);
    }
    $resCsrf = (string) ($loginRes['body']['csrf_token'] ?? $resCsrf);

    // T1: Invalid input (empty description + invalid area) -> 422 with field errors
    $t1 = http_request(
        $baseUrl,
        'POST',
        '/api/reports.php',
        json_encode([
            'area' => 'Invalid Zone',
            'issue_type' => 'no-water',
            'description' => '',
            'time_noticed' => gmdate('Y-m-d\TH:i', time() - 600),
        ], JSON_THROW_ON_ERROR),
        $residentJar,
        $resCsrf
    );
    $t1Ok = $t1['status'] === 422
        && isset($t1['body']['fields']['area'], $t1['body']['fields']['description']);
    record_result('T1', 'Invalid input', $t1Ok, $t1['status']);

    // T2: Missing input (empty body) -> 422 or 400
    $t2 = http_request($baseUrl, 'POST', '/api/reports.php', '', $residentJar, $resCsrf);
    $t2Ok = in_array($t2['status'], [400, 422], true);
    record_result('T2', 'Missing input', $t2Ok, $t2['status']);

    // T3: Successful create -> 201
    $t3 = http_request(
        $baseUrl,
        'POST',
        '/api/reports.php',
        json_encode([
            'area' => 'Block C',
            'issue_type' => 'pipe-burst',
            'description' => 'Main valve leaking onto Block C street corner since early morning.',
            'contact' => '03001112233',
            'time_noticed' => gmdate('Y-m-d\TH:i', time() - 1800),
        ], JSON_THROW_ON_ERROR),
        $residentJar,
        $resCsrf
    );
    $createdId = (int) ($t3['body']['report']['id'] ?? 0);
    $t3Ok = $t3['status'] === 201 && $createdId > 0;
    record_result('T3', 'Successful create', $t3Ok, $t3['status'], "id={$createdId}");

    // T4: Successful update -> 200 and verify new description with GET
    $newDesc = 'Updated: Main valve leaking heavily onto Block C street corner.';
    $t4Put = http_request(
        $baseUrl,
        'PUT',
        '/api/reports.php?id=' . $createdId,
        json_encode(['description' => $newDesc], JSON_THROW_ON_ERROR),
        $residentJar,
        $resCsrf
    );
    $t4Get = http_request($baseUrl, 'GET', '/api/reports.php?area=Block+C');
    $foundUpdated = false;
    foreach (($t4Get['body']['reports'] ?? []) as $rep) {
        if ((int) $rep['id'] === $createdId && $rep['description'] === $newDesc) {
            $foundUpdated = true;
            break;
        }
    }
    $t4Ok = $t4Put['status'] === 200 && $t4Get['status'] === 200 && $foundUpdated;
    record_result('T4', 'Successful update', $t4Ok, $t4Put['status']);

    // T5: Unauthorized request without login -> 401
    $t5 = http_request(
        $baseUrl,
        'POST',
        '/api/reports.php',
        json_encode([
            'area' => 'Block A',
            'issue_type' => 'no-water',
            'description' => 'Testing unauthorized submission without session cookie.',
            'time_noticed' => gmdate('Y-m-d\TH:i', time() - 600),
        ], JSON_THROW_ON_ERROR),
        null,
        null
    );
    record_result('T5', 'Unauthorized (no login)', $t5['status'] === 401, $t5['status']);

    // T6: CSRF missing on logged-in POST -> 403
    $t6 = http_request(
        $baseUrl,
        'POST',
        '/api/reports.php',
        json_encode([
            'area' => 'Block A',
            'issue_type' => 'no-water',
            'description' => 'Testing missing CSRF token on authenticated POST request.',
            'time_noticed' => gmdate('Y-m-d\TH:i', time() - 600),
        ], JSON_THROW_ON_ERROR),
        $residentJar,
        null
    );
    record_result('T6', 'Missing CSRF token', $t6['status'] === 403, $t6['status']);

    // T7: Ownership check (resident1 tries to edit & delete resident2's report id=3) -> 403
    $t7Put = http_request(
        $baseUrl,
        'PUT',
        '/api/reports.php?id=3',
        json_encode(['description' => 'Attempting to overwrite another resident report.'], JSON_THROW_ON_ERROR),
        $residentJar,
        $resCsrf
    );
    $t7Del = http_request($baseUrl, 'DELETE', '/api/reports.php?id=3', null, $residentJar, $resCsrf);
    $t7Ok = $t7Put['status'] === 403 && $t7Del['status'] === 403;
    record_result('T7', 'Ownership enforcement', $t7Ok, $t7Del['status'], "PUT={$t7Put['status']}, DELETE={$t7Del['status']}");

    // T8: Invalid status transition by admin (resolved id=5 -> in-progress) -> 409
    $admInit = http_request($baseUrl, 'GET', '/api/auth.php', null, $adminJar);
    $admCsrf = (string) ($admInit['body']['csrf_token'] ?? '');
    $admLogin = http_request(
        $baseUrl,
        'POST',
        '/api/auth.php',
        json_encode(['action' => 'login', 'username' => 'admin', 'password' => 'Admin#2026'], JSON_THROW_ON_ERROR),
        $adminJar,
        $admCsrf
    );
    $admCsrf = (string) ($admLogin['body']['csrf_token'] ?? $admCsrf);

    $t8 = http_request(
        $baseUrl,
        'PUT',
        '/api/reports.php?id=5',
        json_encode(['status' => 'in-progress'], JSON_THROW_ON_ERROR),
        $adminJar,
        $admCsrf
    );
    record_result('T8', 'Invalid status transition', $t8['status'] === 409, $t8['status']);

    // T9: Duplicate detection (409) then merge (200)
    $dupPayload = [
        'area' => 'Block C',
        'issue_type' => 'pipe-burst',
        'description' => 'Duplicate pipe burst report in Block C submitted within 2 hours.',
        'time_noticed' => gmdate('Y-m-d\TH:i', time() - 300),
    ];
    $t9Conflict = http_request(
        $baseUrl,
        'POST',
        '/api/reports.php',
        json_encode($dupPayload, JSON_THROW_ON_ERROR),
        $residentJar,
        $resCsrf
    );
    $t9Merge = http_request(
        $baseUrl,
        'POST',
        '/api/reports.php',
        json_encode($dupPayload + ['on_duplicate' => 'merge'], JSON_THROW_ON_ERROR),
        $residentJar,
        $resCsrf
    );
    $t9Ok = $t9Conflict['status'] === 409
        && isset($t9Conflict['body']['duplicate']['id'])
        && $t9Merge['status'] === 200
        && (int) ($t9Merge['body']['report']['report_count'] ?? 0) === 2;
    record_result('T9', 'Duplicate detect & merge', $t9Ok, $t9Merge['status'], "conflict={$t9Conflict['status']}, merge={$t9Merge['status']}");

    // T10: Double confirm ("I'm affected too" twice on id=3) -> 200 then 409
    $t10First = http_request($baseUrl, 'POST', '/api/reports.php?id=3&action=confirm', '{}', $residentJar, $resCsrf);
    $t10Second = http_request($baseUrl, 'POST', '/api/reports.php?id=3&action=confirm', '{}', $residentJar, $resCsrf);
    $t10Ok = $t10First['status'] === 200 && $t10Second['status'] === 409;
    record_result('T10', 'Double confirm blocked', $t10Ok, $t10Second['status'], "first={$t10First['status']}, second={$t10Second['status']}");

    // T11: SQL injection attempt in search q -> 200 with no data leak or error
    $t11 = http_request($baseUrl, 'GET', '/api/reports.php?q=' . urlencode("' OR 1=1 -- "));
    $t11Ok = $t11['status'] === 200 && is_array($t11['body']['reports'] ?? null) && count($t11['body']['reports']) === 0;
    record_result('T11', 'SQL injection in search', $t11Ok, $t11['status']);

    // T12: XSS payload stored as plain text in JSON and rendered safely via textContent
    $xssDesc = 'Water has <script>alert(1)</script> strange odor today.';
    $t12 = http_request(
        $baseUrl,
        'POST',
        '/api/reports.php',
        json_encode([
            'area' => 'Market Road',
            'issue_type' => 'dirty-water',
            'description' => $xssDesc,
            'time_noticed' => gmdate('Y-m-d\TH:i', time() - 300),
        ], JSON_THROW_ON_ERROR),
        $residentJar,
        $resCsrf
    );
    $appJsSource = file_get_contents(__DIR__ . '/../public/js/app.js') ?: '';
    $usesTextContent = str_contains($appJsSource, 'descPara.textContent = r.description')
        && !str_contains($appJsSource, 'innerHTML');
    $t12Ok = $t12['status'] === 201
        && ($t12['body']['report']['description'] ?? '') === $xssDesc
        && $usesTextContent;
    record_result('T12', 'XSS plain-text & textContent', $t12Ok, $t12['status']);
} finally {
    @unlink($residentJar);
    @unlink($adminJar);
}

echo "\nSummary: Passed {$passed} / " . ($passed + $failed) . ", Failed {$failed}\n";
exit($failed > 0 ? 1 : 0);
