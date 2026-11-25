<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/db.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('This script can only be run from the command line.');
}

$pdo = db();
$now = time();

$iso = static function (int $offsetSeconds) use ($now): string {
    return gmdate('Y-m-d\TH:i:s\Z', $now + $offsetSeconds);
};

$localNoticed = static function (int $offsetSeconds) use ($now): string {
    return gmdate('Y-m-d\TH:i', $now + $offsetSeconds);
};

$pdo->beginTransaction();

try {
    // Clear existing data in reverse foreign-key order
    $pdo->exec('DELETE FROM report_confirmations');
    $pdo->exec('DELETE FROM notices');
    $pdo->exec('DELETE FROM reports');
    $pdo->exec('DELETE FROM users');
    $pdo->exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'reports', 'report_confirmations', 'notices')");

    // 1. Seed 3 demo users
    $users = [
        ['username' => 'admin', 'password' => 'Admin#2026', 'role' => 'admin', 'display_name' => 'Municipal Admin'],
        ['username' => 'resident1', 'password' => 'Resident#2026', 'role' => 'resident', 'display_name' => 'Ayesha Khan'],
        ['username' => 'resident2', 'password' => 'Resident#2027', 'role' => 'resident', 'display_name' => 'Bilal Ahmed'],
    ];

    $userStmt = $pdo->prepare(
        'INSERT INTO users (username, password_hash, role, display_name)
         VALUES (:username, :password_hash, :role, :display_name)'
    );

    $userIds = [];
    foreach ($users as $u) {
        $userStmt->execute([
            ':username' => $u['username'],
            ':password_hash' => password_hash($u['password'], PASSWORD_DEFAULT),
            ':role' => $u['role'],
            ':display_name' => $u['display_name'],
        ]);
        $userIds[$u['username']] = (int) $pdo->lastInsertId();
    }

    // 2. Seed 8 Assignment 1 sample reports
    $hour = 3600;
    $reports = [
        [
            'area' => 'Block A',
            'issue_type' => 'no-water',
            'description' => 'Complete water outage across streets 4 through 8 since early this morning.',
            'contact' => '03001234567',
            'time_noticed' => $localNoticed(-8 * $hour),
            'status' => 'verified',
            'verified' => 1,
            'owner_id' => $userIds['resident1'],
            'source' => 'resident',
            'report_count' => 5,
            'created_at' => $iso(-7 * $hour),
            'updated_at' => $iso(-2 * $hour),
        ],
        [
            'area' => 'Block B',
            'issue_type' => 'low-pressure',
            'description' => 'Very weak water flow on 2nd floor apartments. Pumps cannot fill overhead tanks.',
            'contact' => '03217654321',
            'time_noticed' => $localNoticed(-2 * $hour),
            'status' => 'reported',
            'verified' => 0,
            'owner_id' => $userIds['resident1'],
            'source' => 'resident',
            'report_count' => 1,
            'created_at' => $iso((int) (-1.5 * $hour)),
            'updated_at' => $iso((int) (-1.5 * $hour)),
        ],
        [
            // Near-duplicate of report #2: same area (Block B), same issue_type (low-pressure), within 2 hours
            'area' => 'Block B',
            'issue_type' => 'low-pressure',
            'description' => 'Low water pressure noticed in commercial block next to main boulevard.',
            'contact' => '',
            'time_noticed' => $localNoticed(-1 * $hour),
            'status' => 'reported',
            'verified' => 0,
            'owner_id' => $userIds['resident2'],
            'source' => 'neighbor',
            'report_count' => 1,
            'created_at' => $iso(-42 * 60),
            'updated_at' => $iso(-42 * 60),
        ],
        [
            'area' => 'Old Town',
            'issue_type' => 'dirty-water',
            'description' => 'Brown muddy tap water coming out since yesterday evening. Odor is also present.',
            'contact' => '03459876543',
            'time_noticed' => $localNoticed(-20 * $hour),
            'status' => 'in-progress',
            'verified' => 1,
            'owner_id' => $userIds['resident2'],
            'source' => 'resident',
            'report_count' => 3,
            'created_at' => $iso(-18 * $hour),
            'updated_at' => $iso(-4 * $hour),
        ],
        [
            'area' => 'Green Park',
            'issue_type' => 'pipe-burst',
            'description' => 'Underground feeder pipe cracked near community park. Water gushing onto pavement.',
            'contact' => '',
            'time_noticed' => $localNoticed(-43 * $hour),
            'status' => 'resolved',
            'verified' => 1,
            'owner_id' => $userIds['admin'],
            'source' => 'utility staff',
            'report_count' => 6,
            'created_at' => $iso(-42 * $hour),
            'updated_at' => $iso(-5 * $hour),
        ],
        [
            // Stale report: not updated for > 24 hours
            'area' => 'Station Colony',
            'issue_type' => 'no-water',
            'description' => 'Supply cut off without prior warning near railway colony quarters.',
            'contact' => '03124567890',
            'time_noticed' => $localNoticed(-33 * $hour),
            'status' => 'stale',
            'verified' => 0,
            'owner_id' => $userIds['resident1'],
            'source' => 'resident',
            'report_count' => 1,
            'created_at' => $iso(-32 * $hour),
            'updated_at' => $iso(-30 * $hour),
        ],
        [
            'area' => 'Market Road',
            'issue_type' => 'pipe-burst',
            'description' => 'Broken water conduit leaking into side alley. Valve isolation required.',
            'contact' => '',
            'time_noticed' => $localNoticed(-13 * $hour),
            'status' => 'in-progress',
            'verified' => 1,
            'owner_id' => $userIds['admin'],
            'source' => 'utility staff',
            'report_count' => 2,
            'created_at' => $iso(-12 * $hour),
            'updated_at' => $iso(-3 * $hour),
        ],
        [
            'area' => 'University Road',
            'issue_type' => 'low-pressure',
            'description' => 'Fluctuating low water pressure during peak morning hours near student hostel.',
            'contact' => '03335557799',
            'time_noticed' => $localNoticed(-4 * $hour),
            'status' => 'reported',
            'verified' => 0,
            'owner_id' => $userIds['resident2'],
            'source' => 'neighbor',
            'report_count' => 1,
            'created_at' => $iso(-3 * $hour),
            'updated_at' => $iso(-3 * $hour),
        ],
    ];

    $reportStmt = $pdo->prepare(
        'INSERT INTO reports (
            area, issue_type, description, contact, time_noticed,
            status, verified, owner_id, source, report_count, created_at, updated_at
        ) VALUES (
            :area, :issue_type, :description, :contact, :time_noticed,
            :status, :verified, :owner_id, :source, :report_count, :created_at, :updated_at
        )'
    );

    $reportIds = [];
    foreach ($reports as $index => $r) {
        $reportStmt->execute([
            ':area' => $r['area'],
            ':issue_type' => $r['issue_type'],
            ':description' => $r['description'],
            ':contact' => $r['contact'],
            ':time_noticed' => $r['time_noticed'],
            ':status' => $r['status'],
            ':verified' => $r['verified'],
            ':owner_id' => $r['owner_id'],
            ':source' => $r['source'],
            ':report_count' => $r['report_count'],
            ':created_at' => $r['created_at'],
            ':updated_at' => $r['updated_at'],
        ]);
        $reportIds[$index + 1] = (int) $pdo->lastInsertId();
    }

    // 3. Seed sample report confirmations
    $confirmations = [
        ['report_id' => $reportIds[1], 'user_id' => $userIds['resident2'], 'created_at' => $iso(-6 * $hour)],
        ['report_id' => $reportIds[1], 'user_id' => $userIds['admin'], 'created_at' => $iso(-5 * $hour)],
        ['report_id' => $reportIds[4], 'user_id' => $userIds['resident1'], 'created_at' => $iso(-16 * $hour)],
        ['report_id' => $reportIds[5], 'user_id' => $userIds['resident1'], 'created_at' => $iso(-38 * $hour)],
    ];

    $confirmStmt = $pdo->prepare(
        'INSERT INTO report_confirmations (report_id, user_id, created_at)
         VALUES (:report_id, :user_id, :created_at)'
    );

    foreach ($confirmations as $c) {
        $confirmStmt->execute([
            ':report_id' => $c['report_id'],
            ':user_id' => $c['user_id'],
            ':created_at' => $c['created_at'],
        ]);
    }

    // 4. Seed 3 sample notices
    $notices = [
        [
            'title' => 'Green Park Pipe Burst Fixed',
            'message' => 'Maintenance crews replaced the damaged 8-inch main line in Green Park. Normal pressure restored.',
            'author_id' => $userIds['admin'],
            'created_at' => $iso(-5 * $hour),
        ],
        [
            'title' => 'Line Flushing in Old Town Sector 3',
            'message' => 'Turbidity investigation underway. Crews are flushing fire hydrants; do not consume tap water unboiled.',
            'author_id' => $userIds['admin'],
            'created_at' => $iso(-4 * $hour),
        ],
        [
            'title' => 'Booster Pump Assessment in Block B',
            'message' => 'Multiple low-pressure complaints received for Block B. Technical inspectors deployed.',
            'author_id' => $userIds['admin'],
            'created_at' => $iso(-40 * 60),
        ],
    ];

    $noticeStmt = $pdo->prepare(
        'INSERT INTO notices (title, message, author_id, created_at)
         VALUES (:title, :message, :author_id, :created_at)'
    );

    foreach ($notices as $n) {
        $noticeStmt->execute([
            ':title' => $n['title'],
            ':message' => $n['message'],
            ':author_id' => $n['author_id'],
            ':created_at' => $n['created_at'],
        ]);
    }

    $pdo->commit();

    echo "Seed completed successfully:\n";
    echo "  - Users inserted: " . count($users) . " (admin, resident1, resident2)\n";
    echo "  - Reports inserted: " . count($reports) . "\n";
    echo "  - Confirmations inserted: " . count($confirmations) . "\n";
    echo "  - Notices inserted: " . count($notices) . "\n";
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, 'Seed failed: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
