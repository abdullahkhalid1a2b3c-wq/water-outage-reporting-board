<?php
declare(strict_types=1);

require_once __DIR__ . '/../../src/bootstrap.php';
require_once __DIR__ . '/../../src/db.php';
require_once __DIR__ . '/../../src/response.php';
require_once __DIR__ . '/../../src/csrf.php';
require_once __DIR__ . '/../../src/auth.php';
require_once __DIR__ . '/../../src/validate.php';

const STALE_HOURS = 24;
const VERIFY_THRESHOLD = 3;
const DUPLICATE_WINDOW_SECONDS = 2 * 3600;

function is_report_stale(array $row): bool
{
    if (($row['status'] ?? '') === 'resolved') {
        return false;
    }
    $updatedTs = strtotime((string) ($row['updated_at'] ?? ''));
    if ($updatedTs === false) {
        return false;
    }
    return $updatedTs < (time() - STALE_HOURS * 3600);
}

function get_user_confirmed_report_ids(PDO $pdo, ?array $user): array
{
    if ($user === null) {
        return [];
    }
    $stmt = $pdo->prepare('SELECT report_id FROM report_confirmations WHERE user_id = :user_id');
    $stmt->execute([':user_id' => (int) $user['id']]);
    $ids = [];
    foreach ($stmt->fetchAll() as $row) {
        $ids[(int) $row['report_id']] = true;
    }
    return $ids;
}

function format_report(array $row, ?array $user, array $confirmedIds): array
{
    $ownerId = (int) $row['owner_id'];
    $isAdmin = $user !== null && ($user['role'] ?? '') === 'admin';
    $isOwner = $user !== null && (int) ($user['id'] ?? 0) === $ownerId;

    $formatted = [
        'id' => (int) $row['id'],
        'area' => (string) $row['area'],
        'issue_type' => (string) $row['issue_type'],
        'description' => (string) $row['description'],
        'time_noticed' => (string) $row['time_noticed'],
        'status' => (string) $row['status'],
        'verified' => ((int) $row['verified']) === 1,
        'owner_id' => $ownerId,
        'owner_name' => (string) ($row['owner_name'] ?? ''),
        'source' => (string) $row['source'],
        'report_count' => (int) $row['report_count'],
        'created_at' => (string) $row['created_at'],
        'updated_at' => (string) $row['updated_at'],
        'stale' => is_report_stale($row),
        'can_edit' => $isAdmin || $isOwner,
        'confirmed_by_me' => $user !== null && isset($confirmedIds[(int) $row['id']]),
    ];

    if ($isAdmin || $isOwner) {
        $formatted['contact'] = (string) $row['contact'];
    }

    return $formatted;
}

function fetch_report_by_id(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare(
        'SELECT r.*, u.display_name AS owner_name
         FROM reports r
         JOIN users u ON u.id = r.owner_id
         WHERE r.id = :id
         LIMIT 1'
    );
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function parse_report_id(): int
{
    $raw = $_GET['id'] ?? '';
    if (!is_string($raw) || !ctype_digit($raw) || (int) $raw <= 0) {
        json_error(400, 'A valid numeric report id is required.');
    }
    return (int) $raw;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$pdo = db();
$user = current_user();

if ($method === 'GET') {
    $where = [];
    $params = [];

    $area = trim((string) ($_GET['area'] ?? ''));
    if ($area !== '') {
        if (!in_array($area, VALID_AREAS, true)) {
            json_error(422, 'Invalid area filter.', ['area' => 'Unrecognized area.']);
        }
        $where[] = 'r.area = :area';
        $params[':area'] = $area;
    }

    $status = trim((string) ($_GET['status'] ?? ''));
    if ($status !== '') {
        if (!in_array($status, VALID_STATUSES, true)) {
            json_error(422, 'Invalid status filter.', ['status' => 'Unrecognized status.']);
        }
        if ($status === 'stale') {
            $where[] = "r.status != 'resolved' AND r.updated_at < :stale_cutoff";
            $params[':stale_cutoff'] = gmdate('Y-m-d\TH:i:s\Z', time() - STALE_HOURS * 3600);
        } else {
            $where[] = 'r.status = :status';
            $params[':status'] = $status;
        }
    }

    $verified = trim((string) ($_GET['verified'] ?? ''));
    if ($verified !== '') {
        if (!in_array($verified, ['confirmed', 'unverified'], true)) {
            json_error(422, 'Invalid verified filter.', ['verified' => 'Must be confirmed or unverified.']);
        }
        $where[] = $verified === 'confirmed' ? 'r.verified = 1' : 'r.verified = 0';
    }

    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '') {
        $escapedQ = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q);
        $likePattern = '%' . $escapedQ . '%';
        $where[] = "(r.area LIKE :q1 ESCAPE '\\' OR r.description LIKE :q2 ESCAPE '\\' OR r.issue_type LIKE :q3 ESCAPE '\\')";
        $params[':q1'] = $likePattern;
        $params[':q2'] = $likePattern;
        $params[':q3'] = $likePattern;
    }

    $sort = trim((string) ($_GET['sort'] ?? 'newest'));
    $orderMap = [
        'newest' => 'r.created_at DESC, r.id DESC',
        'oldest' => 'r.created_at ASC, r.id ASC',
        'most-reports' => 'r.report_count DESC, r.created_at DESC',
    ];
    if (!isset($orderMap[$sort])) {
        json_error(422, 'Invalid sort option.', ['sort' => 'Must be newest, oldest, or most-reports.']);
    }

    $sql = 'SELECT r.*, u.display_name AS owner_name
            FROM reports r
            JOIN users u ON u.id = r.owner_id';
    if ($where !== []) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY ' . $orderMap[$sort];

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $confirmedIds = get_user_confirmed_report_ids($pdo, $user);
    $reports = array_map(
        static fn(array $row): array => format_report($row, $user, $confirmedIds),
        $rows
    );

    // Compute board-wide summary counts using the same STALE_HOURS rule
    $allRows = $pdo->query('SELECT status, verified, updated_at FROM reports')->fetchAll();
    $counts = [
        'total' => count($allRows),
        'confirmed' => 0,
        'unverified' => 0,
        'resolved' => 0,
        'stale' => 0,
    ];
    foreach ($allRows as $r) {
        if ((int) $r['verified'] === 1) {
            $counts['confirmed']++;
        } else {
            $counts['unverified']++;
        }
        if ($r['status'] === 'resolved') {
            $counts['resolved']++;
        }
        if (is_report_stale($r)) {
            $counts['stale']++;
        }
    }

    json_response(200, [
        'reports' => $reports,
        'counts' => $counts,
        'user' => $user,
    ]);
}

if ($method === 'POST') {
    $user = require_login();
    csrf_verify();
    $action = trim((string) ($_GET['action'] ?? ''));

    // POST /api/reports.php?id=ID&action=confirm
    if ($action === 'confirm') {
        $id = parse_report_id();
        $existing = fetch_report_by_id($pdo, $id);
        if ($existing === null) {
            json_error(404, 'Report not found.');
        }

        $nowIso = gmdate('Y-m-d\TH:i:s\Z');
        $pdo->beginTransaction();

        try {
            $insertConfirm = $pdo->prepare(
                'INSERT INTO report_confirmations (report_id, user_id, created_at)
                 VALUES (:report_id, :user_id, :created_at)'
            );
            $insertConfirm->execute([
                ':report_id' => $id,
                ':user_id' => (int) $user['id'],
                ':created_at' => $nowIso,
            ]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            if ($e->getCode() === '23000') {
                json_error(409, 'You already confirmed this report.');
            }
            throw $e;
        }

        $newCount = (int) $existing['report_count'] + 1;
        $newVerified = ($newCount >= VERIFY_THRESHOLD || (int) $existing['verified'] === 1) ? 1 : 0;
        $newStatus = $existing['status'];
        if ($newVerified === 1 && $newStatus === 'reported') {
            $newStatus = 'verified';
        }

        $updateStmt = $pdo->prepare(
            'UPDATE reports
             SET report_count = :report_count,
                 verified = :verified,
                 status = :status,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $updateStmt->execute([
            ':report_count' => $newCount,
            ':verified' => $newVerified,
            ':status' => $newStatus,
            ':updated_at' => $nowIso,
            ':id' => $id,
        ]);

        $pdo->commit();

        $updated = fetch_report_by_id($pdo, $id);
        $confirmedIds = get_user_confirmed_report_ids($pdo, $user);

        json_response(200, [
            'report' => format_report($updated, $user, $confirmedIds),
        ]);
    }

    // Create a new report
    $body = read_json_body();
    $errors = validate_report_input($body);
    if ($errors !== []) {
        json_error(422, 'Validation failed.', $errors);
    }

    $area = trim((string) $body['area']);
    $issueType = trim((string) $body['issue_type']);
    $description = trim((string) $body['description']);
    $contact = trim((string) ($body['contact'] ?? ''));
    $timeNoticed = trim((string) $body['time_noticed']);
    $nowIso = gmdate('Y-m-d\TH:i:s\Z');
    $cutoffIso = gmdate('Y-m-d\TH:i:s\Z', time() - DUPLICATE_WINDOW_SECONDS);

    // Server-side duplicate detection within the last 2 hours
    $dupStmt = $pdo->prepare(
        "SELECT r.*, u.display_name AS owner_name
         FROM reports r
         JOIN users u ON u.id = r.owner_id
         WHERE r.area = :area
           AND r.issue_type = :issue_type
           AND r.status != 'resolved'
           AND r.created_at >= :cutoff
         ORDER BY r.created_at DESC
         LIMIT 1"
    );
    $dupStmt->execute([
        ':area' => $area,
        ':issue_type' => $issueType,
        ':cutoff' => $cutoffIso,
    ]);
    $duplicate = $dupStmt->fetch();

    if ($duplicate !== false) {
        $onDuplicate = trim((string) ($body['on_duplicate'] ?? ''));
        if ($onDuplicate === 'merge') {
            $pdo->beginTransaction();
            try {
                $newCount = (int) $duplicate['report_count'] + 1;
                $newVerified = ($newCount >= VERIFY_THRESHOLD || (int) $duplicate['verified'] === 1) ? 1 : 0;
                $newStatus = $duplicate['status'];
                if ($newVerified === 1 && $newStatus === 'reported') {
                    $newStatus = 'verified';
                }

                $mergeStmt = $pdo->prepare(
                    'UPDATE reports
                     SET report_count = :report_count,
                         verified = :verified,
                         status = :status,
                         updated_at = :updated_at
                     WHERE id = :id'
                );
                $mergeStmt->execute([
                    ':report_count' => $newCount,
                    ':verified' => $newVerified,
                    ':status' => $newStatus,
                    ':updated_at' => $nowIso,
                    ':id' => (int) $duplicate['id'],
                ]);
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }

            $mergedReport = fetch_report_by_id($pdo, (int) $duplicate['id']);
            $confirmedIds = get_user_confirmed_report_ids($pdo, $user);

            json_response(200, [
                'report' => format_report($mergedReport, $user, $confirmedIds),
                'merged' => true,
            ]);
        }

        if ($onDuplicate !== 'new') {
            $confirmedIds = get_user_confirmed_report_ids($pdo, $user);
            json_response(409, [
                'error' => 'A similar unresolved report was submitted recently for this area.',
                'duplicate' => format_report($duplicate, $user, $confirmedIds),
            ]);
        }
    }

    $source = ($user['role'] ?? '') === 'admin' ? 'utility staff' : 'resident';

    $insertStmt = $pdo->prepare(
        'INSERT INTO reports (
            area, issue_type, description, contact, time_noticed,
            status, verified, owner_id, source, report_count, created_at, updated_at
        ) VALUES (
            :area, :issue_type, :description, :contact, :time_noticed,
            :status, :verified, :owner_id, :source, :report_count, :created_at, :updated_at
        )'
    );
    $insertStmt->execute([
        ':area' => $area,
        ':issue_type' => $issueType,
        ':description' => $description,
        ':contact' => $contact,
        ':time_noticed' => $timeNoticed,
        ':status' => 'reported',
        ':verified' => 0,
        ':owner_id' => (int) $user['id'],
        ':source' => $source,
        ':report_count' => 1,
        ':created_at' => $nowIso,
        ':updated_at' => $nowIso,
    ]);

    $createdId = (int) $pdo->lastInsertId();
    $created = fetch_report_by_id($pdo, $createdId);

    json_response(201, [
        'report' => format_report($created, $user, []),
    ]);
}

if ($method === 'PUT') {
    $user = require_login();
    csrf_verify();
    $id = parse_report_id();

    $existing = fetch_report_by_id($pdo, $id);
    if ($existing === null) {
        json_error(404, 'Report not found.');
    }

    $body = read_json_body();

    // Reject attempts to tamper with protected fields
    if (
        array_key_exists('owner_id', $body)
        || array_key_exists('created_at', $body)
        || array_key_exists('report_count', $body)
    ) {
        json_error(403, 'Protected fields (owner_id, created_at, report_count) cannot be modified.');
    }

    $isAdmin = ($user['role'] ?? '') === 'admin';
    $isOwner = (int) $existing['owner_id'] === (int) $user['id'];

    if (!$isAdmin && !$isOwner) {
        json_error(403, 'You do not have permission to edit this report.');
    }

    if (!$isAdmin) {
        if ($existing['status'] !== 'reported') {
            json_error(403, 'Residents can only edit their own reports while status is reported.');
        }
        if (
            array_key_exists('status', $body)
            || array_key_exists('verified', $body)
            || array_key_exists('reconfirm', $body)
        ) {
            json_error(403, 'Only administrators can modify status, verification, or re-confirm reports.');
        }
    }

    $candidate = [
        'area' => array_key_exists('area', $body) ? $body['area'] : $existing['area'],
        'issue_type' => array_key_exists('issue_type', $body) ? $body['issue_type'] : $existing['issue_type'],
        'description' => array_key_exists('description', $body) ? $body['description'] : $existing['description'],
        'contact' => array_key_exists('contact', $body) ? $body['contact'] : $existing['contact'],
        'time_noticed' => array_key_exists('time_noticed', $body) ? $body['time_noticed'] : $existing['time_noticed'],
    ];

    $errors = validate_report_input($candidate);
    if ($errors !== []) {
        json_error(422, 'Validation failed.', $errors);
    }

    $newStatus = (string) $existing['status'];
    $newVerified = (int) $existing['verified'];

    if ($isAdmin && array_key_exists('status', $body)) {
        $requestedStatus = trim((string) $body['status']);
        $statusErr = validate_status($requestedStatus);
        if ($statusErr !== null) {
            json_error(422, 'Validation failed.', ['status' => $statusErr]);
        }
        if ($requestedStatus !== $existing['status']) {
            if (!is_allowed_transition((string) $existing['status'], $requestedStatus)) {
                json_error(409, "Invalid status transition from '{$existing['status']}' to '{$requestedStatus}'.");
            }
            $newStatus = $requestedStatus;
            if ($newStatus === 'verified') {
                $newVerified = 1;
            }
        }
    }

    if ($isAdmin && array_key_exists('verified', $body)) {
        $newVerified = ((bool) $body['verified']) ? 1 : 0;
    }

    if ($isAdmin && !empty($body['reconfirm']) && $newStatus === 'stale') {
        $newStatus = $newVerified === 1 ? 'verified' : 'reported';
    }

    $nowIso = gmdate('Y-m-d\TH:i:s\Z');

    $updateStmt = $pdo->prepare(
        'UPDATE reports
         SET area = :area,
             issue_type = :issue_type,
             description = :description,
             contact = :contact,
             time_noticed = :time_noticed,
             status = :status,
             verified = :verified,
             updated_at = :updated_at
         WHERE id = :id'
    );
    $updateStmt->execute([
        ':area' => trim((string) $candidate['area']),
        ':issue_type' => trim((string) $candidate['issue_type']),
        ':description' => trim((string) $candidate['description']),
        ':contact' => trim((string) $candidate['contact']),
        ':time_noticed' => trim((string) $candidate['time_noticed']),
        ':status' => $newStatus,
        ':verified' => $newVerified,
        ':updated_at' => $nowIso,
        ':id' => $id,
    ]);

    $updated = fetch_report_by_id($pdo, $id);
    $confirmedIds = get_user_confirmed_report_ids($pdo, $user);

    json_response(200, [
        'report' => format_report($updated, $user, $confirmedIds),
    ]);
}

if ($method === 'DELETE') {
    $user = require_login();
    csrf_verify();
    $id = parse_report_id();

    $existing = fetch_report_by_id($pdo, $id);
    if ($existing === null) {
        json_error(404, 'Report not found.');
    }

    $isAdmin = ($user['role'] ?? '') === 'admin';
    $isOwner = (int) $existing['owner_id'] === (int) $user['id'];

    if (!$isAdmin && (!$isOwner || $existing['status'] !== 'reported')) {
        json_error(403, 'You can only delete your own reports while status is reported.');
    }

    $delStmt = $pdo->prepare('DELETE FROM reports WHERE id = :id');
    $delStmt->execute([':id' => $id]);

    json_response(200, [
        'deleted' => true,
        'id' => $id,
    ]);
}

header('Allow: GET, POST, PUT, DELETE');
json_error(405, 'Method not allowed.');
