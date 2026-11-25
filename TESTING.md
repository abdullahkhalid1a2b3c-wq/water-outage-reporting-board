# Assignment 2 — Testing Documentation

## How to Run the Automated Test Suite

1. Start the PHP built-in development server from the project root:
   ```bash
   php -S localhost:8000 -t public
   ```
2. In a second terminal, run the CLI test suite:
   ```bash
   php tests/run_tests.php
   ```
   The script automatically resets the SQLite database via `php database/seed.php`, executes T1–T12 using cURL with separate cookie jars for `resident1` and `admin`, prints `PASS` or `FAIL` with the HTTP status code for each case, and exits with a non-zero code if any test fails.

## Test Cases

| ID | Purpose | Steps | Expected Result | Actual Result |
|---|---|---|---|---|
| **T1** | Invalid input rejected | Logged-in `POST /api/reports.php` with invalid `area` and empty `description` | `422` with `fields.area` and `fields.description` errors | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T2** | Missing input rejected | Logged-in `POST /api/reports.php` with empty request body | `400` or `422` validation error | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T3** | Successful create | Logged-in `POST /api/reports.php` with valid `Block C` `pipe-burst` report | `201` with created `report.id` | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T4** | Successful update | Owner `PUT /api/reports.php?id={id}` with new `description`, then `GET /api/reports.php?area=Block+C` | `200` and `GET` returns updated `description` | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T5** | Unauthorized access blocked | Unauthenticated `POST /api/reports.php` without session cookie | `401 Unauthorized` | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T6** | CSRF protection enforced | Logged-in `POST /api/reports.php` without `X-CSRF-Token` header | `403 Forbidden` | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T7** | Ownership enforcement | `resident1` sends `PUT` and `DELETE` to `resident2`'s report (`id=3`) | `403 Forbidden` for both `PUT` and `DELETE` | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T8** | Invalid status transition blocked | `admin` sends `PUT /api/reports.php?id=5` (`resolved` → `in-progress`) | `409 Conflict` | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T9** | Duplicate detection & merge | Submit same `Block C` `pipe-burst` again; then resend with `on_duplicate: "merge"` | First returns `409` with `duplicate`; merge returns `200` with `report_count: 2` | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T10** | Double confirm blocked | `resident1` calls `POST /api/reports.php?id=3&action=confirm` twice | First returns `200`; second returns `409` | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T11** | SQL injection resistance | `GET /api/reports.php?q=%27%20OR%201%3D1%20--%20` | `200` with empty `reports: []` and no SQL error | Pending live `pdo_sqlite` run (`php -l` passed) |
| **T12** | XSS prevention | `POST /api/reports.php` with `<script>alert(1)</script>` in `description`; verify JSON & `app.js` `textContent` | `201` with plain-text JSON; `app.js` uses `textContent` and zero `innerHTML` | Pending live `pdo_sqlite` run (`php -l` passed) |
