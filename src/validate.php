<?php
declare(strict_types=1);

const VALID_AREAS = [
    'Block A',
    'Block B',
    'Block C',
    'Market Road',
    'Green Park',
    'Old Town',
    'Station Colony',
    'University Road',
];

const VALID_ISSUE_TYPES = [
    'no-water',
    'low-pressure',
    'dirty-water',
    'pipe-burst',
];

const VALID_STATUSES = [
    'reported',
    'verified',
    'in-progress',
    'resolved',
    'stale',
];

const ALLOWED_TRANSITIONS = [
    'reported' => ['verified', 'in-progress', 'stale'],
    'verified' => ['in-progress'],
    'in-progress' => ['resolved', 'stale'],
    'resolved' => ['reported'],
    'stale' => ['reported', 'in-progress'],
];

function utf8_length(string $s): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($s, 'UTF-8');
    }
    if (function_exists('iconv_strlen')) {
        $len = iconv_strlen($s, 'UTF-8');
        if ($len !== false) {
            return $len;
        }
    }
    $count = preg_match_all('/./us', $s);
    return $count === false ? strlen($s) : $count;
}

function validate_report_input(array $data): array
{
    $errors = [];

    $area = trim((string) ($data['area'] ?? ''));
    if (!in_array($area, VALID_AREAS, true)) {
        $errors['area'] = 'Please select a recognized municipal area.';
    }

    $issueType = trim((string) ($data['issue_type'] ?? ''));
    if (!in_array($issueType, VALID_ISSUE_TYPES, true)) {
        $errors['issue_type'] = 'Please select a valid issue type.';
    }

    $description = trim((string) ($data['description'] ?? ''));
    $descLen = utf8_length($description);
    if ($descLen < 15 || $descLen > 300) {
        $errors['description'] = 'Description must be between 15 and 300 characters.';
    }

    $contact = trim((string) ($data['contact'] ?? ''));
    if ($contact !== '' && preg_match('/^\d{11}$/', $contact) !== 1) {
        $errors['contact'] = 'Contact must be empty or exactly 11 digits.';
    }

    $timeNoticed = trim((string) ($data['time_noticed'] ?? ''));
    if ($timeNoticed === '') {
        $errors['time_noticed'] = 'Time noticed is required.';
    } else {
        try {
            $dt = new DateTimeImmutable($timeNoticed);
            if ($dt->getTimestamp() > time()) {
                $errors['time_noticed'] = 'Time noticed cannot be in the future.';
            }
        } catch (Throwable) {
            $errors['time_noticed'] = 'Time noticed must be a valid date and time.';
        }
    }

    if (array_key_exists('status', $data) && $data['status'] !== null && $data['status'] !== '') {
        $statusError = validate_status((string) $data['status']);
        if ($statusError !== null) {
            $errors['status'] = $statusError;
        }
    }

    return $errors;
}

function validate_status(string $status): ?string
{
    if (!in_array(trim($status), VALID_STATUSES, true)) {
        return 'Invalid status value.';
    }
    return null;
}

function is_allowed_transition(string $from, string $to): bool
{
    if ($from === $to) {
        return false;
    }
    return in_array($to, ALLOWED_TRANSITIONS[$from] ?? [], true);
}

function validate_notice_input(array $data): array
{
    $errors = [];

    $title = trim((string) ($data['title'] ?? ''));
    $titleLen = utf8_length($title);
    if ($titleLen < 3 || $titleLen > 80) {
        $errors['title'] = 'Notice title must be between 3 and 80 characters.';
    }

    $message = trim((string) ($data['message'] ?? ''));
    $msgLen = utf8_length($message);
    if ($msgLen < 5 || $msgLen > 500) {
        $errors['message'] = 'Notice message must be between 5 and 500 characters.';
    }

    return $errors;
}
