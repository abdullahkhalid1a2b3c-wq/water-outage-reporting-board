# Water Outage Reporting Board — Design Document

## 1. User & Problem

**User:** A resident of a neighborhood with unreliable municipal water supply.

**Problem:** When water stops flowing, residents have no quick way to know whether the outage affects only their house, their street, or a wider area. They phone neighbors, post on social media, and wait — unsure if authorities are aware or if supply has already resumed elsewhere.

**Need:** A lightweight board where anyone can report a water outage for their area, see at a glance which areas are currently affected, and know whether a report has been confirmed by other residents or is still unverified.

---

## 2. Core Workflow (6 Steps)

1. **View the board** — The resident opens the page and sees a list of active outage reports, each showing area name, issue type, status, and whether it is confirmed or unverified.
2. **Filter / search** — The resident narrows the list by area, status, or verification state to find reports relevant to their neighborhood.
3. **Submit a report** — If no matching report exists, the resident fills in area, issue type, a short description, and optional contact info. The report is saved with status `reported` and marked unverified.
4. **Verify or flag** — Another resident viewing an existing report can confirm they are also affected (incrementing the report count and potentially marking it verified) or flag it as inaccurate.
5. **Moderate** — A moderator (simulated via a toggle) can merge duplicate reports, advance a report's status (e.g. `reported → in-progress → resolved`), edit details, or delete spam.
6. **Review outcome** — The resident checks back and sees timestamped status updates and notices. Stale reports (no update for a configurable period) are automatically flagged so the board stays current.

---

## 3. Wireframes (ASCII)

### Mobile (≤ 480 px, single column)

```
┌──────────────────────────┐
│  💧 Water Outage Board   │
│  [☰ Menu]                │
├──────────────────────────┤
│ Filter: [Area ▾] [Status ▾] │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ ● Gulberg  — No Water│ │
│ │   Status: VERIFIED ✔ │ │
│ │   2 hrs ago          │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ ○ Johar Town — Low P.│ │
│ │   Status: REPORTED   │ │
│ │   45 min ago         │ │
│ └──────────────────────┘ │
│         ...              │
├──────────────────────────┤
│  [ + Report Outage ]     │
└──────────────────────────┘
```

### Tablet (481–1024 px, two columns)

```
┌─────────────────────────────────────────┐
│  💧 Water Outage Board     [+ Report]   │
├───────────────┬─────────────────────────┤
│ Filters       │ Report Cards (grid)     │
│               │ ┌─────────┐ ┌─────────┐│
│ Area  [▾]     │ │Gulberg  │ │Model T. ││
│ Status[▾]     │ │VERIFIED✔│ │REPORTED ││
│ Verified[▾]   │ │2 hrs ago│ │45m ago  ││
│               │ └─────────┘ └─────────┘│
│               │ ┌─────────┐ ┌─────────┐│
│               │ │Johar T. │ │DHA Ph.5 ││
│               │ │IN-PROG  │ │STALE ⚠  ││
│               │ └─────────┘ └─────────┘│
├───────────────┴─────────────────────────┤
│  Notices / status log (collapsible)     │
└─────────────────────────────────────────┘
```

### Desktop (≥ 1025 px, three-panel)

```
┌──────────────────────────────────────────────────────────┐
│  💧 Water Outage Reporting Board              [+ Report] │
├────────────┬──────────────────────────┬───────────────────┤
│  Sidebar   │  Report List / Grid      │  Detail Panel     │
│            │                          │                   │
│ Filters    │ ┌────────┐ ┌────────┐   │ Area: Gulberg     │
│ Area  [▾]  │ │Gulberg │ │Model T.│   │ Type: No Water    │
│ Status[▾]  │ │VERIFIED│ │REPORTED│   │ Status: VERIFIED  │
│ Verified   │ └────────┘ └────────┘   │ Reports: 5        │
│ [✔][○]     │ ┌────────┐ ┌────────┐   │ Desc: Water cut   │
│            │ │Johar T.│ │DHA 5   │   │  since 6 AM ...   │
│ ────────── │ │IN-PROG │ │STALE ⚠ │   │                   │
│ Stats      │ └────────┘ └────────┘   │ ── Status Log ──  │
│ Active: 4  │                          │ 09:15 Reported    │
│ Resolved:2 │                          │ 09:40 Verified    │
│ Stale: 1   │                          │ 10:02 Notice added│
│            │                          │ [Confirm] [Flag]  │
├────────────┴──────────────────────────┴───────────────────┤
│  Moderator bar (if toggled on): [Merge] [Edit] [Delete]  │
└──────────────────────────────────────────────────────────┘
```

---

## 4. WDLC Stages

| Stage | Application to This Project |
|---|---|
| **Planning** | Define scope: a client-side-only outage board using localStorage; identify the target user (neighborhood resident) and the skills to demonstrate (CRUD, filtering, moderation, provenance). |
| **Analysis** | Gather requirements from the assignment brief: area-based reports, verification, duplicate merging, status model, timestamped notices, confirmed-vs-unverified distinction, stale-data handling. |
| **Design** | Produce wireframes (above), define the data model and status-transition rules, and plan the file/module structure (`data.js` for model, `app.js` for UI). |
| **Development** | Implement semantic HTML, responsive CSS, and vanilla JS with no libraries; write CRUD helpers against localStorage; build filtering, moderation, and merge logic. |
| **Testing** | Manually test each CRUD path, status transition, merge, and filter on Chrome, Firefox, and mobile viewports; verify localStorage persistence survives refresh and clear. |
| **Deployment** | For Assignment 1, deployment means opening `index.html` from the file system; the app must work fully offline with no server. |
| **Maintenance** | Handle stale-data expiry, display friendly errors when localStorage is full or unavailable, and keep the design extensible for the server-side migration in Assignments 2 and 3. |

---

## 5. Client vs. Server Responsibilities

| Concern | Assignment 1 (Client Only) | Assignments 2 & 3 (Client + Server) |
|---|---|---|
| Data storage | localStorage (JSON) | Server-side database (e.g. MongoDB, PostgreSQL) |
| CRUD operations | JS functions read/write localStorage directly | REST or GraphQL API; client sends HTTP requests |
| Validation | Client-side only (JS) | Duplicated on server; server is authoritative |
| Authentication | None; moderator mode via a UI toggle | Login system with roles (resident, moderator, admin) |
| Duplicate merging | Client-side merge by matching area + issueType | Server-side merge with conflict resolution and audit log |
| Stale-data detection | Timer compares `updatedAt` against current time in JS | Server cron job marks stale; pushes updates via WebSocket |
| Data provenance | `source` field set to `"user"` or `"seed"` locally | Server stamps `source` with authenticated user ID and IP |
| Notifications | In-page notices only | Email / push notifications from server |
| Offline support | Full (it is the only mode) | Service worker caches shell; syncs when back online |

---

## 6. Data Model — Report

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Unique identifier generated client-side. |
| `area` | string | Neighborhood or zone name (e.g. "Gulberg", "DHA Phase 5"). |
| `issueType` | string | Category of the problem: `"no-water"`, `"low-pressure"`, `"discolored"`, `"scheduled"`. |
| `description` | string | Free-text details provided by the reporter. |
| `contact` | string | Optional phone or email for follow-up. |
| `status` | string | Current status (see §7). One of: `reported`, `verified`, `in-progress`, `resolved`, `stale`. |
| `verified` | boolean | `true` once the report count meets the verification threshold (default ≥ 3). |
| `createdAt` | string (ISO 8601) | Timestamp when the report was first submitted. |
| `updatedAt` | string (ISO 8601) | Timestamp of the most recent status change or edit. |
| `mergedInto` | string \| null | `id` of the report this one was merged into, or `null`. |
| `source` | string | Provenance tag: `"user"` for resident submissions, `"seed"` for preloaded demo data. |
| `reportCount` | number | How many residents have confirmed this same outage. Starts at 1. |

---

## 7. Status Model & Transitions

```
                ┌──────────┐
        ┌──────►│ verified │───────┐
        │       └──────────┘       │
        │                          ▼
  ┌──────────┐              ┌─────────────┐        ┌──────────┐
  │ reported │─────────────►│ in-progress │───────►│ resolved │
  └──────────┘              └─────────────┘        └──────────┘
        │                          │
        │       ┌──────────┐       │
        └──────►│  stale   │◄──────┘
                └──────────┘
```

**Allowed transitions:**

| From | To | Trigger |
|---|---|---|
| `reported` | `verified` | `reportCount` reaches the verification threshold, or moderator manually verifies. |
| `reported` | `in-progress` | Moderator marks work underway (skips verification). |
| `reported` | `stale` | No update for a configurable period (default 24 h). |
| `verified` | `in-progress` | Moderator marks work underway. |
| `in-progress` | `resolved` | Moderator confirms water supply restored. |
| `in-progress` | `stale` | No update for a configurable period while in progress. |
| `resolved` | `reported` | Resident re-reports the same issue (outage recurred). |

> A report with `mergedInto` set is hidden from the main board; its `reportCount` is added to the target report.

---

## Assignment 2 — PHP, PDO/SQLite & Fetch Architecture

### 1. Database Schema (SQLite)

| Table | Columns & Constraints | Foreign Keys, Checks & Indexes |
|---|---|---|
| `users` | `id` INTEGER PK, `username` TEXT UNIQUE NOT NULL, `password_hash` TEXT NOT NULL, `role` TEXT NOT NULL DEFAULT `'resident'`, `display_name` TEXT NOT NULL | `CHECK (role IN ('resident', 'admin'))` |
| `reports` | `id` INTEGER PK, `area` TEXT NOT NULL, `issue_type` TEXT NOT NULL, `description` TEXT NOT NULL, `contact` TEXT, `time_noticed` TEXT, `status` TEXT NOT NULL DEFAULT `'reported'`, `verified` INTEGER NOT NULL DEFAULT 0, `owner_id` INTEGER NOT NULL, `source` TEXT NOT NULL DEFAULT `'user'`, `report_count` INTEGER NOT NULL DEFAULT 1, `created_at` TEXT NOT NULL, `updated_at` TEXT NOT NULL | FK `owner_id REFERENCES users(id) ON DELETE CASCADE`; `CHECK (issue_type IN ('no-water', 'low-pressure', 'discolored', 'scheduled'))`; `CHECK (status IN ('reported', 'verified', 'in-progress', 'resolved', 'stale'))`; `INDEX idx_reports_area ON reports(area)`; `INDEX idx_reports_status ON reports(status)` |
| `report_confirmations` | `id` INTEGER PK, `report_id` INTEGER NOT NULL, `user_id` INTEGER NOT NULL, `created_at` TEXT NOT NULL | FK `report_id REFERENCES reports(id) ON DELETE CASCADE`; FK `user_id REFERENCES users(id) ON DELETE CASCADE`; `UNIQUE (report_id, user_id)` |
| `notices` | `id` INTEGER PK, `title` TEXT NOT NULL, `message` TEXT NOT NULL, `author_id` INTEGER NOT NULL, `created_at` TEXT NOT NULL | FK `author_id REFERENCES users(id) ON DELETE CASCADE` |

### 2. Roles & Session Ownership

- **Roles (`resident`, `admin`):** Stored in `users.role` and mirrored in the PHP session (`$_SESSION['user']`) upon authentication.
- **`resident`:** Can browse reports/notices, submit new reports, confirm existing reports once, and edit or delete **only their own** reports (`reports.owner_id === $_SESSION['user']['id']`).
- **`admin`:** Sees moderation controls; can verify reports, update any report's status (`reported → verified → in-progress → resolved → stale`), delete any report, and create or delete official notices.

### 3. API Design

| Method | URL | Who May Call | Success | Error Codes |
|---|---|---|---|---|
| `GET` | `/api/auth.php` | Anyone (returns current user or `null` + CSRF token) | `200` | — |
| `POST` | `/api/auth.php` | Anyone (`login` / `register`); Authenticated (`logout`) | `200`, `201` | `401`, `403`, `409`, `422` |
| `GET` | `/api/reports.php` | Anyone (supports `area`, `status`, `verified`, `q`, `sort` query params) | `200` | `422` |
| `POST` | `/api/reports.php` | Authenticated (`resident`, `admin`) | `201` | `401`, `403`, `422` |
| `PATCH` | `/api/reports.php?id={id}` | Owner (`resident`) for edits; any authenticated user for `confirm`; `admin` for status/verify | `200` | `401`, `403`, `404`, `409`, `422` |
| `DELETE` | `/api/reports.php?id={id}` | Owner (`resident`) or `admin` | `200` | `401`, `403`, `404` |
| `GET` | `/api/notices.php` | Anyone | `200` | — |
| `POST` | `/api/notices.php` | `admin` only | `201` | `401`, `403`, `422` |
| `DELETE` | `/api/notices.php?id={id}` | `admin` only | `200` | `401`, `403`, `404` |

### 4. Request Flow (Resident Submits a Report)

1. **Browser:** Resident submits the report form; JS prevents default reload and shows a loading state.
2. **Fetch:** `app.js` sends `fetch('/api/reports.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(payload) })` using `async/await`.
3. **PHP & Auth/CSRF:** `bootstrap.php` starts the session; `auth.php` confirms a logged-in user (`401` if not); `csrf.php` validates `X-CSRF-Token` (`403` on mismatch).
4. **Validation:** `validate.php` checks `area`, `issue_type`, `description`, `contact`, and `time_noticed` (`422` with field errors if invalid).
5. **PDO & SQLite:** `db.php` executes a prepared `INSERT INTO reports (...) VALUES (?, ...)` with `owner_id` taken from `$_SESSION['user']['id']`.
6. **JSON Response:** `response.php` sends HTTP `201` with the newly created report record as JSON.
7. **DOM Update:** `app.js` clears the loading indicator, inserts the new report card into the board, updates summary counts, and shows a success message without reloading.

### 5. Security Controls

| Threat | Mitigation |
|---|---|
| **SQL Injection** | Prepared statements (`PDO::prepare` + bound parameters) for every query containing user input. |
| **XSS** | Server-side output encoding (`htmlspecialchars($val, ENT_QUOTES, 'UTF-8')`) for HTML templates; `textContent` / safe DOM rendering in JS. |
| **CSRF** | Per-session cryptographic token (`random_bytes(32)`) sent in `X-CSRF-Token` and verified with `hash_equals()` on all `POST`/`PATCH`/`DELETE` requests. |
| **Session Fixation** | `session_regenerate_id(true)` on login and registration; `HttpOnly` and `SameSite=Lax` session cookies. |
| **Password Storage** | `password_hash($password, PASSWORD_DEFAULT)` at registration/seed and `password_verify()` on login. |
| **Authorization** | Server-side role (`admin` vs `resident`) and ownership (`owner_id === $_SESSION['user']['id']`) checks before every mutation; client UI hides controls only for UX. |

### 6. Client vs. Server Responsibilities (Assignment 2)

| Concern | Client (Browser / `app.js`) | Server (PHP 8.5 + SQLite) |
|---|---|---|
| **Data Storage** | Non-sensitive UI preference only (e.g., last selected sort order in `localStorage`) | Authoritative persistence of `users`, `reports`, `report_confirmations`, and `notices` in SQLite |
| **Rendering & UX** | Renders JSON into DOM cards, manages loading/success/empty/error states via `fetch` | Serves initial HTML shell (`public/index.php`) and JSON API responses |
| **Validation** | Immediate inline form feedback for UX | Authoritative validation (`validate.php`), returning `422` on invalid input |
| **Auth & Ownership** | Displays login/logout UI and role-appropriate buttons | Manages PHP sessions, password verification, CSRF tokens, and ownership/role enforcement |


