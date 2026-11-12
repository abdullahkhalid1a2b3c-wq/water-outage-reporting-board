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

