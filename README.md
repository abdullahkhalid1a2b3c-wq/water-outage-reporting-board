💧 Water Outage Reporting Board

Web Engineering, Assignment 1: Client-Side Web Application Assigned project idea: #23, Water Outage Reporting Board

🔗 Live demo: https://water-outage-reporting-board.vercel.app/

A responsive, interactive web app where neighbourhood residents report water outages, see which areas are affected, and tell the difference between confirmed and unverified reports. A simulated utility Admin can verify, update and clean up reports. It is built with only semantic HTML, CSS and vanilla JavaScript. There is no framework, no library and no backend. All data is stored in the browser.

Table of Contents
The Problem
The Purpose and the Solution
Who Uses It
Core Workflow
Features in Detail
Roles: Resident and Admin
How It Works Behind the Scenes
Responsive Design
Accessibility
Tech Stack
Project Structure
Run It Yourself
Quick Demo Script
Testing Checklist
Client vs Server: What Runs Where
WDLC Stages
Limitations
Future Work: Assignments 2 and 3
Screenshots
Attribution and AI Disclosure
1. The Problem

In many neighbourhoods, water supply is unreliable. When the water stops, residents face several problems:

They do not know whether only their street is affected or the whole area.
Complaints are scattered across phone calls, WhatsApp groups and word of mouth.
Ten people report the same outage, and the utility cannot tell whether it is one problem or ten.
Nobody knows whether a report is real and verified or just a rumour.
Old reports stay visible long after the water has come back, so the information goes stale.
2. The Purpose and the Solution

The Water Outage Reporting Board is one shared place where:

Residents report an outage in seconds.
Everyone can see which areas have problems right now.
Reports are clearly labelled Confirmed or Unverified, so people know what to trust.
Duplicate reports are merged instead of cluttering the board.
Old, un-updated reports are flagged as Stale so nobody relies on outdated information.
A utility moderator (Admin) can verify, update status, post notices and remove bad entries.

This project is a client-side prototype. Everything runs in the browser and saves to localStorage, so it works without a backend. In Assignments 2 and 3 the same idea will be extended with a server and database.

3. Who Uses It
User	Need
Resident (main user)	"Is my area affected? Has anyone else reported it? Is the report confirmed? How do I report it?"
Admin / Utility moderator (simulated)	"Which reports need verifying? Which are stale? What is the situation per area? I need to post updates for the public."
4. Core Workflow
The resident opens the board and sees the summary counts and the report cards.
They check their area using the filters or search.
If their problem is not already listed, they fill in the report form (area, issue type, description, time noticed).
If a similar report already exists (same area and issue within 2 hours), the app asks: merge into the existing report or submit as new.
The report appears as Unverified. Other residents who are also affected press "I'm affected too".
The Admin verifies the report, and the badge becomes Confirmed.
The Admin updates its status (In Progress, then Resolved) and posts a notice for the public.
If a report is not updated for 24 hours, it is flagged Stale until someone re-confirms it.
5. Features in Detail
Reporting
Outage report form with these fields:
Area: 8 areas (Block A, Block B, Block C, Market Road, Green Park, Old Town, Station Colony, University Road)
Issue type: No Water, Low Pressure, Dirty Water, Pipe Burst
Description: 15 to 300 characters, with a live character counter
Contact number: optional, 11 digits
Time noticed: date and time picker, not allowed in the future
Consent checkbox
Validation has two layers:
Browser validation through HTML attributes (required, minlength, maxlength, pattern, input types)
Extra JavaScript checks, such as a whitespace-only description, a future time and a wrong phone length
Clear error message under each field, and focus moves to the first invalid field.
Success and status messages are announced through an aria-live region.
Duplicate Detection and Merging
When a report is submitted, the app looks for an unresolved report in the same area with the same issue type created within the last 2 hours (DUPLICATE_WINDOW_HOURS).
If one is found, the user chooses Merge into existing report or Submit as new.
Merging increases the report count, updates the timestamp and records the new source in a provenance history.
When a report reaches 3 confirmations, it is automatically marked as verified.
Verified vs Unverified (Data Provenance)
Every report is clearly marked Confirmed ✔ (green) or Unverified (amber). The badges contain text, so colour is not the only signal.
Every report stores its source: resident, neighbor or utility staff.
Merged reports keep a record of the extra sources that were merged in.
Status Model

Each report moves through defined states, and only valid transitions are allowed:

From	Allowed next status
Reported	Verified, In Progress, Stale
Verified	In Progress
In Progress	Resolved, Stale
Resolved	Reported (reopen)
Stale	Reported, In Progress

Invalid jumps are blocked and an error message is shown.

Stale-Data Handling
A report that is not resolved and has not been updated for 24 hours (STALE_HOURS) is flagged with a red Stale badge.
The Admin can press Re-confirm Outage to refresh the timestamp.
The summary counter and the Stale filter both use the same time-based check.
Search, Filter and Sort
Filter by Area, Status and Verification (All, Confirmed, Unverified).
Live keyword search across area, description and issue type.
Sort by Newest, Oldest or Most Reports.
A Clear Filters button resets everything.
An empty-state message appears when nothing matches.
Live Summary Counters

A bar at the top of the board shows Total, Confirmed, Unverified, Resolved and Stale counts. It updates after every change.

Notices Board
A timestamped feed of public notices, newest first.
Admin users can post new notices (title and message are validated).
Safe Storage
Data is saved to localStorage inside try/catch.
If the stored data is missing or corrupted, the app falls back to the sample data and shows a visible warning instead of crashing.
Text from users is inserted with textContent, not innerHTML, which protects against script injection (XSS).
6. Roles: Resident and Admin

Because this assignment is client-side only, roles are a simulation. Use the "Viewing as" switcher in the header to change role. The choice is remembered after a page refresh.

Ability	Resident	Admin
View reports, filters, search, sort, notices	✅	✅
Submit an outage report	✅	✅
"I'm affected too" button (once per report)	✅	✅
Verify a report	❌	✅
Change report status	❌	✅
Re-confirm a stale report	❌	✅
Delete a report	❌	✅
Post a notice	❌	✅
Reset sample data	❌	✅
Admin Dashboard (needs moderation, stale list, per-area table)	❌	✅

How it is built: admin buttons and forms are not just hidden with CSS. They are not created in the page at all when the role is Resident. The handler functions also check the role again before doing anything, as a second layer.

⚠️ Important: this is only a demonstration. A user could still change the role from the browser console. Real login, sessions and server-side permission checks will be added in the later assignments.

7. How It Works Behind the Scenes

Data model (one report):

id, area, issueType, description, contact, timeNoticed,
status, verified, createdAt, updatedAt,
mergedInto, source, reportCount

Main idea of the code:

data.js defines the areas, issue types, statuses, allowed transitions and the sample reports and notices.
app.js loads data from localStorage, or from the samples if storage is empty or corrupt.
The data lives in two arrays: reports and notices.
Every change (submit, verify, status update, delete, merge) updates the array, saves to localStorage, and re-renders the page from the array.
Rendering builds the cards with DOM methods (createElement, textContent, addEventListener).
Filters read the control values, filter and sort the array, and render the result.

Key constants (easy to change):

Constant	Default	Meaning
STALE_HOURS	24	Hours without an update before a report is stale
DUPLICATE_WINDOW_HOURS	2	Time window used to detect duplicate reports
STORAGE_KEY	water_outage_board_data	localStorage key for the data
8. Responsive Design

The layout is mobile-first and uses CSS Grid and Flexbox, with two media-query breakpoints:

Screen	Width	Layout
Mobile	under 600px	One column. Form, filters, cards and notices are stacked
Tablet	600px and up	Report cards in 2 columns
Desktop	1024px and up	Sidebar form on the left, content on the right
Large desktop	1280px and up	Report cards in 3 columns

Other design choices: CSS variables for colours, spacing and type, the box-sizing: border-box model, a variety of selectors (element, class, ID, descendant, child, attribute, pseudo-classes) and a water-themed blue and teal palette.

9. Accessibility
Semantic HTML: header, nav, main, section, article, aside, footer, with one h1 and a logical heading order.
Skip link to jump straight to the main content.
Every input has a visible label, and the correct input types are used (tel, datetime-local, search).
aria-live regions announce form results and role changes.
Full keyboard use: every button and control can be reached with Tab and used with Enter or Space.
Visible focus rings through :focus-visible.
Status is never shown by colour alone. Every badge has text.
The admin table uses <caption> and <th scope>.
10. Tech Stack
Part	Technology
Structure	HTML5 (semantic)
Styling	Plain CSS3 (variables, Grid, Flexbox, media queries)
Logic	Vanilla JavaScript (ES6+)
Storage	Browser localStorage
Hosting	Vercel (static site)

Not used: React, Vue, Angular, jQuery, Bootstrap, Tailwind, templates, icon fonts, any external library or backend.

11. Project Structure
webdevASS1/
├── index.html        # Page structure: form, filters, report list, notices, role switcher
├── DESIGN.md         # Design note: user, WDLC, wireframes, client vs server, data model
├── README.md         # This file
├── css/
│   └── style.css     # Design tokens, layout, components, responsive rules
├── js/
│   ├── data.js       # Constants and 8 sample reports plus 3 sample notices
│   └── app.js        # App logic: validation, duplicates, filters, roles, storage
└── screenshots/      # Images used in this README
12. Run It Yourself

No installation or build step is needed.

Option A: open the file directly

Download the repository (Code, then Download ZIP) or clone it from GitHub.
Open the project folder.
Double-click index.html. It opens in any modern browser (Chrome, Edge, Firefox, Safari).

Option B: use a local server

bash
cd webdevASS1
python -m http.server 8000

Then visit http://localhost:8000.

Option C: use the live site Open https://water-outage-reporting-board.vercel.app/

Reset the data: switch to Admin and press Reset Sample Data, or clear this site's data in your browser settings.

13. Quick Demo Script

A 2-minute tour of everything:

Open the app as Resident. Note the summary counters and the green Confirmed and amber Unverified badges.
Filter and search: choose an area, then a status, then search "pipe". Try a nonsense search to see the empty state.
Submit a report (for example Block C, No Water). A new Unverified card appears at the top.
Submit the same report again. The duplicate prompt appears. Choose Merge. The count goes up and no new card is created.
Press "I'm affected too" on any card. The button then disables.
Switch to Admin with "Viewing as". The Admin Dashboard and moderation buttons appear.
Verify a report, then move it to In Progress and Resolved. Watch the counters change.
Post a notice. It appears at the top with a timestamp.
Refresh the page. Everything, including your role, is still there.
Try a bad submission (empty form, spaces only, future time). Errors appear and nothing is saved.
14. Testing Checklist
Test	Expected result
Submit an empty form	Errors shown, no report created
Description with only spaces	Rejected
Future date and time	Rejected
Phone number that is not 11 digits	Rejected
Same area and issue within 2 hours	Merge prompt appears
Filters with no match	Empty-state message
Delete, then Cancel in the dialog	Nothing is deleted
Invalid status jump	Blocked with an error message
Corrupted data in localStorage	Warning shown, sample data restored
Resident role	No admin buttons or forms exist in the page
Refresh the page	Data and role are kept
Screen widths 375px, 768px, 1280px	Layout adapts, no sideways scrolling
Keyboard only (Tab)	Everything reachable with a visible focus ring
15. Client vs Server: What Runs Where
Task	Now (Assignment 1, in the browser)	Later (with a server)
Showing the page and styling	Browser	Browser
Form validation	Browser (HTML and JavaScript)	Browser and server (never trust the client alone)
Storing reports and notices	localStorage	Database
Duplicate detection and merging	JavaScript in the browser	Server-side logic and a database query
Stale-data check	JavaScript using the current time	Server-side scheduled job
Roles and permissions	Simulated with a switcher	Real login, sessions and permission checks on every request
Sharing data between users	Not possible, each browser has its own data	All users share one database
16. WDLC Stages (Web Development Life Cycle)
Planning: chose the problem (unreliable water supply and untrusted reports) and set the scope: a client-side prototype.
Analysis: identified the users (Resident, Admin), the needs and the requirements: reporting, verification, merging, status, filtering and stale data.
Design: wireframes for mobile, tablet and desktop, the data model, the status model and the colour palette (see DESIGN.md).
Development: wrote semantic HTML, mobile-first CSS and vanilla JavaScript, in steps.
Testing: manual tests for the workflow, edge cases, responsive layout, keyboard use and accessibility (Lighthouse).
Deployment: pushed to GitHub and deployed as a static site on Vercel.
Maintenance: planned improvements through Assignments 2 and 3 (backend, database, real authentication).
17. Known Limitations
Data is stored per browser. Two people on different devices do not see each other's reports.
Roles are simulated, not secure. There is no real login.
Clearing browser data removes all reports.
The merge feature counts confirmations and records the sources. It does not store a separate merged record.
All names, phone numbers and descriptions are fictional sample data.
18. Future Work: Assignments 2 and 3
A backend server and REST API with a real database, so all users share the same reports.
Real authentication and server-side role checks.
Server-side validation and moderation rules.
Automatic stale-report handling on the server.
Notifications and a real map or area view.
19. Screenshots
Desktop views
Resident view (1280px+)	Admin view (1280px+)
Desktop Resident View	Desktop Admin View
Report sidebar, live filter bar and confirmed outage cards with "I'm affected too"	Header role switcher, Admin Dashboard, needs-moderation list and area table
Feature gallery
Screenshot	Description
desktop-resident-view.png	Full desktop UI in Resident view
desktop-admin-view.png	Full desktop UI in Admin view with the dashboard and a toast message
admin-moderator-dashboard.png	Admin dashboard and area breakdown table
report-form.png	Outage form with validation, character counter and time picker
report-form-submission-success.png	Form showing the success message
report-card-resident-view.png	Report card with badges, metadata and "I'm affected too"
filter-bar.png	Area, Status, Verification, Search and Sort controls
filters-and-summary-stats.png	Filter bar with the live summary counters
notices-board-resident-view.png	Public notices feed
notices-admin-add-notice-form.png	"Add a Notice" form, visible only to Admin
20. Attribution and AI Disclosure

Attribution

No external JavaScript libraries, UI frameworks, CSS preprocessors, icon fonts, templates or other runtime dependencies were used.
The app is written only with vanilla HTML5, CSS3 and JavaScript.
No credentials, API keys or real personal data are included. All sample names, numbers and reports are fictional.

AI assistance disclosure An AI assistant was used during development for planning, syntax suggestions, code review and help writing documentation. I read, tested, debugged and modified the code, styles and documents myself, and I can explain how each part works.

Web Engineering, Assignment 1. Idea #23: Water Outage Reporting Board.
