# Live-Change Cheat Sheet (Examiner Quick Reference)

These 6 small edits map directly to the current codebase. None of them require changing the architecture.

---

## 1. Change the stale threshold from 24 hours to 1 hour
- **File:** `public/api/reports.php`
- **Constant:** `STALE_HOURS` (line 11)
- **Edit:**
  ```php
  const STALE_HOURS = 1;
  ```
- **Database / Re-seed needed?** No. `is_report_stale()` and the `status=stale` SQL filter both read `STALE_HOURS` dynamically.

---

## 2. Add a new issue type `"no-pressure"`
Four places must stay in sync:
1. **Validator (`src/validate.php`):** Add `'no-pressure'` to `VALID_ISSUE_TYPES` (lines 15–20):
   ```php
   const VALID_ISSUE_TYPES = [
       'no-water',
       'low-pressure',
       'no-pressure',
       'dirty-water',
       'pipe-burst',
   ];
   ```
2. **SQLite `CHECK` constraint (`database/schema.sql`):** Update line 17:
   ```sql
   issue_type TEXT NOT NULL CHECK (issue_type IN ('no-water', 'low-pressure', 'no-pressure', 'dirty-water', 'pipe-burst')),
   ```
3. **HTML dropdown (`public/index.php`):** Add `<option value="no-pressure">No Pressure</option>` inside `#input-type` (lines 101–107).
4. **Frontend label map (`public/js/app.js`):** Add `'no-pressure': 'No Pressure'` to `ISSUE_TYPES` (lines 21–26).
- **Database / Re-seed needed?** **Yes.** SQLite does not alter existing table `CHECK` constraints automatically. Delete `database/app.sqlite` and run `php database/seed.php` so the schema is recreated with the updated `CHECK` constraint.

---

## 3. Change the duplicate window to 6 hours
- **File:** `public/api/reports.php`
- **Constant:** `DUPLICATE_WINDOW_SECONDS` (line 13)
- **Edit:**
  ```php
  const DUPLICATE_WINDOW_SECONDS = 6 * 3600;
  ```
- **Optional UI text sync (`public/js/app.js`):** In `showDuplicateChoicePrompt()` (line 1094), update `"within the last 2 hours"` to `"within the last 6 hours"`.
- **Database / Re-seed needed?** No.

---

## 4. Require a 20-character minimum description
1. **Server validator (`src/validate.php`):** In `validate_report_input()` (lines 69–71):
   ```php
   if ($descLen < 20 || $descLen > 300) {
       $errors['description'] = 'Description must be between 20 and 300 characters.';
   }
   ```
2. **HTML form (`public/index.php`):** Update `#input-desc` (lines 114–116) `minlength="20"` and placeholder text `(20–300 characters)`.
3. **Inline edit form (`public/js/app.js`):** In `buildInlineEditForm()` (line 621), update `descTa.minLength = 20;`.
- **Database / Re-seed needed?** No.

---

## 5. Make login lock after 3 attempts instead of 5
- **File:** `src/auth.php`
- **Constant:** `LOGIN_MAX_ATTEMPTS` (line 7)
- **Edit:**
  ```php
  const LOGIN_MAX_ATTEMPTS = 3;
  ```
- **Database / Re-seed needed?** No. (If your current browser session is already mid-attempt, clear cookies or log in with a fresh session.)

---

## 6. Show 5 reports per page
Currently `GET /api/reports.php` returns all matching reports and `public/js/app.js` renders the full array. To paginate at 5 per page:
1. **Backend (`public/api/reports.php`):** Inside `if ($method === 'GET')` (after building `$sql` around line 161):
   ```php
   $perPage = 5;
   $page = max(1, (int) ($_GET['page'] ?? 1));
   $offset = ($page - 1) * $perPage;
   $sql .= ' LIMIT :limit OFFSET :offset';

   $stmt = $pdo->prepare($sql);
   foreach ($params as $key => $val) {
       $stmt->bindValue($key, $val);
   }
   $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
   $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
   $stmt->execute();
   ```
   Include `'page' => $page, 'per_page' => $perPage` in the `json_response(200, [...])` payload.
2. **Frontend (`public/js/app.js`):** Track `let currentPage = 1;`, pass `params.set('page', String(currentPage));` in `buildReportsQueryString()`, reset `currentPage = 1` when filters change, and add Prev/Next buttons that increment/decrement `currentPage` and call `loadReports()`.
- **Database / Re-seed needed?** No.
