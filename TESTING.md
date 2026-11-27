# Assignment 2 — Testing Documentation

**Last verified:** 2026-11-27  
**Result:** 12 / 12 passed, 0 failed (saved in [`tests/last_run.txt`](tests/last_run.txt))

## How to Run the Automated Test Suite

### Windows (PowerShell)
1. Seed the database and start the PHP built-in development server in terminal 1:
   ```powershell
   php database/seed.php
   php -S localhost:8000 -t public
   ```
2. In terminal 2, run the CLI test suite and save output:
   ```powershell
   php tests/run_tests.php | Tee-Object -FilePath tests/last_run.txt
   ```

### Linux / macOS
1. Seed the database and start the PHP built-in development server in terminal 1:
   ```bash
   php database/seed.php
   php -S localhost:8000 -t public
   ```
2. In terminal 2, run the CLI test suite and save output:
   ```bash
   php tests/run_tests.php | tee tests/last_run.txt
   ```

The script automatically resets the SQLite database via `php database/seed.php`, executes T1–T12 using cURL with separate cookie jars for `resident1` and `admin`, prints `PASS` or `FAIL` with the HTTP status code for each case, and exits with a non-zero code if any test fails.

## Test Cases

| ID | Purpose | Steps | Expected Result | Actual Result |
|---|---|---|---|---|
| **T1** | Invalid input rejected | Logged-in `POST /api/reports.php` with invalid `area` and empty `description` | `422` with `fields.area` and `fields.description` errors | `PASS` — HTTP `422` (`fields.area` & `fields.description` returned) |
| **T2** | Missing input rejected | Logged-in `POST /api/reports.php` with empty request body | `400` or `422` validation error | `PASS` — HTTP `422` |
| **T3** | Successful create | Logged-in `POST /api/reports.php` with valid `Block C` `pipe-burst` report | `201` with created `report.id` | `PASS` — HTTP `201` (`id=9`) |
| **T4** | Successful update | Owner `PUT /api/reports.php?id={id}` with new `description`, then `GET /api/reports.php?area=Block+C` | `200` and `GET` returns updated `description` | `PASS` — HTTP `200` |
| **T5** | Unauthorized access blocked | Unauthenticated `POST /api/reports.php` without session cookie | `401 Unauthorized` | `PASS` — HTTP `401` |
| **T6** | CSRF protection enforced | Logged-in `POST /api/reports.php` without `X-CSRF-Token` header | `403 Forbidden` | `PASS` — HTTP `403` |
| **T7** | Ownership enforcement | `resident1` sends `PUT` and `DELETE` to `resident2`'s report (`id=3`) | `403 Forbidden` for both `PUT` and `DELETE` | `PASS` — HTTP `403` (`PUT=403`, `DELETE=403`) |
| **T8** | Invalid status transition blocked | `admin` sends `PUT /api/reports.php?id=5` (`resolved` → `in-progress`) | `409 Conflict` | `PASS` — HTTP `409` |
| **T9** | Duplicate detection & merge | Submit same `Block C` `pipe-burst` again; then resend with `on_duplicate: "merge"` | First returns `409` with `duplicate`; merge returns `200` with `report_count: 2` | `PASS` — HTTP `409` conflict, HTTP `200` merge |
| **T10** | Double confirm blocked | `resident1` calls `POST /api/reports.php?id=3&action=confirm` twice | First returns `200`; second returns `409` | `PASS` — HTTP `200` first, HTTP `409` second |
| **T11** | SQL injection resistance | `GET /api/reports.php?q=%27%20OR%201%3D1%20--%20` | `200` with empty `reports: []` and no SQL error | `PASS` — HTTP `200` |
| **T12** | XSS prevention | `POST /api/reports.php` with `<script>alert(1)</script>` in `description`; verify JSON & `app.js` `textContent` | `201` with plain-text JSON; `app.js` uses `textContent` and zero `innerHTML` | `PASS` — HTTP `201` (plain-text JSON & `textContent` verified) |
