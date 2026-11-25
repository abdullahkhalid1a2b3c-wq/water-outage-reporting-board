-- SQLite schema for Water Outage Reporting Board
-- Assignment 2

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'resident' CHECK (role IN ('resident', 'admin')),
    display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area TEXT NOT NULL,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('no-water', 'low-pressure', 'dirty-water', 'pipe-burst')),
    description TEXT NOT NULL,
    contact TEXT NOT NULL DEFAULT '',
    time_noticed TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'verified', 'in-progress', 'resolved', 'stale')),
    verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'resident',
    report_count INTEGER NOT NULL DEFAULT 1 CHECK (report_count >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_confirmations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE (report_id, user_id)
);

CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_area ON reports(area);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
