// public/js/app.js
// Client-side controller for Water Outage Reporting Board (Assignment 2).
// Uses Fetch API + async/await; all state is persisted on the PHP/SQLite server.

'use strict';

/* ═══════════════════════════════════════════════════════════
   Display Constants & Allowed Transitions
   ═══════════════════════════════════════════════════════════ */
const AREAS = [
  'Block A',
  'Block B',
  'Block C',
  'Market Road',
  'Green Park',
  'Old Town',
  'Station Colony',
  'University Road'
];

const ISSUE_TYPES = {
  'no-water': 'No Water',
  'low-pressure': 'Low Pressure',
  'dirty-water': 'Dirty Water',
  'pipe-burst': 'Pipe Burst'
};

const STATUSES = {
  'reported': 'Reported',
  'verified': 'Verified',
  'in-progress': 'In Progress',
  'resolved': 'Resolved',
  'stale': 'Stale'
};

const ALLOWED_TRANSITIONS = {
  'reported': ['verified', 'in-progress', 'stale'],
  'verified': ['in-progress'],
  'in-progress': ['resolved', 'stale'],
  'resolved': ['reported'],
  'stale': ['reported', 'in-progress']
};

const SORT_PREF_KEY = 'wob_pref_sort';
const VALID_SORTS = ['newest', 'oldest', 'most-reports'];

/* ═══════════════════════════════════════════════════════════
   Application State
   ═══════════════════════════════════════════════════════════ */
let currentUser = null;
let csrfToken = '';
let reports = [];
let summaryCounts = { total: 0, confirmed: 0, unverified: 0, resolved: 0, stale: 0 };
let notices = [];
let reportsAbortController = null;
let searchDebounceTimer = null;

/* ═══════════════════════════════════════════════════════════
   DOM Element References
   ═══════════════════════════════════════════════════════════ */
// Auth
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const userBar = document.getElementById('user-bar');
const userStatusText = document.getElementById('user-status-text');
const roleBadge = document.getElementById('role-badge');
const btnLogout = document.getElementById('btn-logout');
const statusAnnouncement = document.getElementById('status-announcement');
const reportAuthHint = document.getElementById('report-auth-hint');

// Report Form
const reportForm = document.getElementById('report-form');
const inputArea = document.getElementById('input-area');
const inputType = document.getElementById('input-type');
const inputDesc = document.getElementById('input-desc');
const inputContact = document.getElementById('input-contact');
const inputTime = document.getElementById('input-time');
const inputConsent = document.getElementById('input-consent');
const btnSubmitReport = document.getElementById('btn-submit-report');
const descCount = document.getElementById('desc-count');
const formStatus = document.getElementById('form-status');

const reportErrorEls = {
  area: document.getElementById('error-area'),
  issue_type: document.getElementById('error-issue_type'),
  description: document.getElementById('error-description'),
  contact: document.getElementById('error-contact'),
  time_noticed: document.getElementById('error-time_noticed'),
  consent: document.getElementById('error-consent')
};

// Filters
const filterArea = document.getElementById('filter-area');
const filterStatus = document.getElementById('filter-status');
const filterVerified = document.getElementById('filter-verified');
const filterSearch = document.getElementById('filter-search');
const filterSort = document.getElementById('filter-sort');
const btnClearFilters = document.getElementById('btn-clear-filters');

// Summary Counters
const countTotal = document.getElementById('count-total');
const countConfirmed = document.getElementById('count-confirmed');
const countUnverified = document.getElementById('count-unverified');
const countResolved = document.getElementById('count-resolved');
const countStale = document.getElementById('count-stale');

// Reports List & States
const reportsLoading = document.getElementById('reports-loading');
const reportsError = document.getElementById('reports-error');
const reportsErrorText = document.getElementById('reports-error-text');
const btnRetryReports = document.getElementById('btn-retry-reports');
const reportsList = document.getElementById('reports-list');
const emptyState = document.getElementById('empty-state');

// Admin Dashboard
const adminDashboard = document.getElementById('admin-dashboard');

// Notices & States
const noticesLoading = document.getElementById('notices-loading');
const noticesError = document.getElementById('notices-error');
const noticesErrorText = document.getElementById('notices-error-text');
const btnRetryNotices = document.getElementById('btn-retry-notices');
const noticesList = document.getElementById('notices-list');
const noticesEmpty = document.getElementById('notices-empty');
const noticeForm = document.getElementById('notice-form');
const noticeTitle = document.getElementById('notice-title');
const noticeMessage = document.getElementById('notice-message');
const btnSubmitNotice = document.getElementById('btn-submit-notice');
const noticeErrorEls = {
  title: document.getElementById('error-notice-title'),
  message: document.getElementById('error-notice-message')
};

/* ═══════════════════════════════════════════════════════════
   1. Fetch API Helper
   ═══════════════════════════════════════════════════════════ */

async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (method !== 'GET' && method !== 'HEAD') {
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    if (options.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  let response;
  try {
    response = await fetch(path, {
      ...options,
      method,
      headers,
      credentials: 'same-origin'
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw err;
    }
    const networkErr = new Error('Cannot reach the server. Please check your connection and try again.');
    networkErr.status = 0;
    networkErr.fields = {};
    throw networkErr;
  }

  let data = null;
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message = (data && typeof data.error === 'string')
      ? data.error
      : `Request failed (${response.status})`;
    const apiErr = new Error(message);
    apiErr.status = response.status;
    apiErr.fields = (data && data.fields && typeof data.fields === 'object') ? data.fields : {};
    apiErr.data = data;
    throw apiErr;
  }

  return data;
}

/* ═══════════════════════════════════════════════════════════
   2. UI Feedback & Date Helpers
   ═══════════════════════════════════════════════════════════ */

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}

function announceStatus(msg) {
  if (statusAnnouncement) {
    statusAnnouncement.textContent = msg;
  }
}

function showFormStatus(msg, statusClass = '') {
  if (!formStatus) return;
  formStatus.replaceChildren();
  formStatus.textContent = msg;
  formStatus.className = `form-status ${statusClass}`;
}

function formatReadableDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function toLocalDatetimeValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString.slice(0, 16);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toUtcIsoFromLocalInput(localVal) {
  if (!localVal) return '';
  const d = new Date(localVal);
  return Number.isNaN(d.getTime()) ? localVal : d.toISOString();
}

function setInitialTimeNoticed() {
  if (!inputTime) return;
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  const localIso = new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
  inputTime.value = localIso;
  const maxIso = new Date(now.getTime() - offsetMs + 5 * 60000).toISOString().slice(0, 16);
  inputTime.max = maxIso;
}

function setButtonBusy(button, busy, busyLabel, defaultLabel) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? busyLabel : defaultLabel;
}

/* ═══════════════════════════════════════════════════════════
   3. Non-Sensitive Sort Preference (localStorage)
   ═══════════════════════════════════════════════════════════ */

function loadSortPreference() {
  if (!filterSort) return;
  try {
    const saved = localStorage.getItem(SORT_PREF_KEY);
    if (saved && VALID_SORTS.includes(saved)) {
      filterSort.value = saved;
    }
  } catch {
    // Ignore storage access errors
  }
}

function saveSortPreference(sortVal) {
  if (!VALID_SORTS.includes(sortVal)) return;
  try {
    localStorage.setItem(SORT_PREF_KEY, sortVal);
  } catch {
    // Ignore storage access errors
  }
}

/* ═══════════════════════════════════════════════════════════
   4. Authentication & Role UI
   ═══════════════════════════════════════════════════════════ */

function isAdmin() {
  return currentUser !== null && currentUser.role === 'admin';
}

function applyAuthToUI() {
  const loggedIn = currentUser !== null;

  if (loginForm) loginForm.hidden = loggedIn;
  if (userBar) userBar.hidden = !loggedIn;
  if (reportAuthHint) reportAuthHint.hidden = loggedIn;

  if (loggedIn && userStatusText && roleBadge) {
    userStatusText.textContent = `Logged in as ${currentUser.display_name} (${currentUser.role})`;
    roleBadge.textContent = currentUser.role;
    roleBadge.className = `role-badge ${isAdmin() ? 'role-badge-admin' : 'role-badge-resident'}`;
  }

  if (noticeForm) {
    noticeForm.hidden = !isAdmin();
  }

  if (adminDashboard) {
    adminDashboard.hidden = !isAdmin();
    if (!isAdmin()) {
      adminDashboard.replaceChildren();
    } else {
      renderAdminDashboard();
    }
  }
}

async function initAuth() {
  const data = await api('api/auth.php');
  currentUser = data.user || null;
  csrfToken = data.csrf_token || '';
  applyAuthToUI();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = loginUsername ? loginUsername.value.trim() : '';
  const password = loginPassword ? loginPassword.value : '';

  if (!username || !password) {
    showToast('Please enter both username and password.', 'error');
    return;
  }

  setButtonBusy(btnLogin, true, 'Signing in...', 'Log in');
  try {
    const data = await api('api/auth.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username, password })
    });
    currentUser = data.user;
    csrfToken = data.csrf_token || csrfToken;
    if (loginForm) loginForm.reset();
    applyAuthToUI();
    announceStatus(`Logged in as ${currentUser.display_name} (${currentUser.role})`);
    showToast(`Welcome, ${currentUser.display_name}!`, 'success');
    await Promise.all([loadReports(), loadNotices()]);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonBusy(btnLogin, false, 'Signing in...', 'Log in');
  }
}

async function handleLogout() {
  setButtonBusy(btnLogout, true, 'Logging out...', 'Logout');
  try {
    const data = await api('api/auth.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'logout' })
    });
    currentUser = null;
    csrfToken = data.csrf_token || '';
    applyAuthToUI();
    announceStatus('Logged out');
    showToast('You have been logged out.', 'info');
    await Promise.all([loadReports(), loadNotices()]);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonBusy(btnLogout, false, 'Logging out...', 'Logout');
  }
}

/* ═══════════════════════════════════════════════════════════
   5. Summary & Admin Dashboard
   ═══════════════════════════════════════════════════════════ */

function updateSummary() {
  if (countTotal) countTotal.textContent = String(summaryCounts.total ?? 0);
  if (countConfirmed) countConfirmed.textContent = String(summaryCounts.confirmed ?? 0);
  if (countUnverified) countUnverified.textContent = String(summaryCounts.unverified ?? 0);
  if (countResolved) countResolved.textContent = String(summaryCounts.resolved ?? 0);
  if (countStale) countStale.textContent = String(summaryCounts.stale ?? 0);
}

function renderAdminDashboard() {
  if (!adminDashboard || !isAdmin()) return;
  adminDashboard.replaceChildren();

  const heading = document.createElement('h2');
  heading.id = 'admin-heading';
  heading.textContent = 'Admin Moderator Dashboard';
  adminDashboard.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';

  // 1. Needs Moderation
  const moderationCard = document.createElement('div');
  moderationCard.className = 'dashboard-card';

  const unverified = reports.filter(r => !r.verified && r.status !== 'resolved');
  const modHeader = document.createElement('h3');
  modHeader.textContent = `Needs Moderation (${unverified.length})`;
  moderationCard.appendChild(modHeader);

  if (unverified.length === 0) {
    const emptyP = document.createElement('p');
    emptyP.className = 'dashboard-empty';
    emptyP.textContent = 'All active reports in this view have been verified.';
    moderationCard.appendChild(emptyP);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'dashboard-list';
    unverified.forEach(r => {
      const li = document.createElement('li');
      const textSpan = document.createElement('span');
      textSpan.className = 'dashboard-list-text';
      textSpan.textContent = `${r.area} — ${ISSUE_TYPES[r.issue_type] || r.issue_type} (${r.report_count} rpt)`;

      const btnVerify = document.createElement('button');
      btnVerify.type = 'button';
      btnVerify.className = 'btn btn-sm btn-primary';
      btnVerify.textContent = 'Verify';
      btnVerify.addEventListener('click', () => handleVerifyReport(r.id, btnVerify));

      li.appendChild(textSpan);
      li.appendChild(btnVerify);
      ul.appendChild(li);
    });
    moderationCard.appendChild(ul);
  }
  grid.appendChild(moderationCard);

  // 2. Stale Reports
  const staleCard = document.createElement('div');
  staleCard.className = 'dashboard-card';

  const staleList = reports.filter(r => r.stale);
  const staleHeader = document.createElement('h3');
  staleHeader.textContent = `Stale Reports (${staleList.length})`;
  staleCard.appendChild(staleHeader);

  if (staleList.length === 0) {
    const emptyP = document.createElement('p');
    emptyP.className = 'dashboard-empty';
    emptyP.textContent = 'No stale reports detected.';
    staleCard.appendChild(emptyP);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'dashboard-list';
    staleList.forEach(r => {
      const li = document.createElement('li');
      const textSpan = document.createElement('span');
      textSpan.className = 'dashboard-list-text';
      textSpan.textContent = `${r.area} — updated ${formatReadableDate(r.updated_at)}`;

      const btnReconf = document.createElement('button');
      btnReconf.type = 'button';
      btnReconf.className = 'btn btn-sm btn-primary';
      btnReconf.textContent = 'Re-confirm';
      btnReconf.addEventListener('click', () => handleReconfirmReport(r.id, btnReconf));

      li.appendChild(textSpan);
      li.appendChild(btnReconf);
      ul.appendChild(li);
    });
    staleCard.appendChild(ul);
  }
  grid.appendChild(staleCard);

  // 3. Reports per Area Breakdown
  const tableCard = document.createElement('div');
  tableCard.className = 'dashboard-card dashboard-card-full';

  const tableHeader = document.createElement('h3');
  tableHeader.textContent = 'Reports per Area Breakdown';
  tableCard.appendChild(tableHeader);

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-responsive';

  const table = document.createElement('table');
  table.className = 'admin-table';

  const caption = document.createElement('caption');
  caption.textContent = 'Summary of outage reports across all municipal areas';
  table.appendChild(caption);

  const thead = document.createElement('thead');
  const theadRow = document.createElement('tr');
  ['Area', 'Total Reports', 'Confirmed', 'Unverified'].forEach(text => {
    const th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.textContent = text;
    theadRow.appendChild(th);
  });
  thead.appendChild(theadRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  let grandTotal = 0;
  let grandConfirmed = 0;
  let grandUnverified = 0;

  AREAS.forEach(areaName => {
    const areaReports = reports.filter(r => r.area === areaName);
    const totalCount = areaReports.length;
    const confirmedCount = areaReports.filter(r => r.verified).length;
    const unverifiedCount = totalCount - confirmedCount;

    grandTotal += totalCount;
    grandConfirmed += confirmedCount;
    grandUnverified += unverifiedCount;

    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.setAttribute('scope', 'row');
    th.textContent = areaName;
    tr.appendChild(th);

    [totalCount, confirmedCount, unverifiedCount].forEach(val => {
      const td = document.createElement('td');
      td.textContent = String(val);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const tfoot = document.createElement('tfoot');
  const tfootRow = document.createElement('tr');
  const thFoot = document.createElement('th');
  thFoot.setAttribute('scope', 'row');
  thFoot.textContent = 'All Areas';
  tfootRow.appendChild(thFoot);

  [grandTotal, grandConfirmed, grandUnverified].forEach(val => {
    const td = document.createElement('td');
    td.textContent = String(val);
    tfootRow.appendChild(td);
  });
  tfoot.appendChild(tfootRow);
  table.appendChild(tfoot);

  tableWrapper.appendChild(table);
  tableCard.appendChild(tableWrapper);
  grid.appendChild(tableCard);
  adminDashboard.appendChild(grid);
}

/* ═══════════════════════════════════════════════════════════
   6. Report Card Builder & Inline Edit
   ═══════════════════════════════════════════════════════════ */

function buildInlineEditForm(r, card) {
  const form = document.createElement('form');
  form.className = 'inline-edit-form';
  form.noValidate = true;

  const makeGroup = (labelText, inputEl, errorKey) => {
    const group = document.createElement('div');
    group.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = labelText;
    const errSpan = document.createElement('span');
    errSpan.className = 'field-error';
    errSpan.dataset.field = errorKey;
    group.appendChild(label);
    group.appendChild(inputEl);
    group.appendChild(errSpan);
    return group;
  };

  const areaSel = document.createElement('select');
  AREAS.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    if (a === r.area) opt.selected = true;
    areaSel.appendChild(opt);
  });

  const typeSel = document.createElement('select');
  Object.entries(ISSUE_TYPES).forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (val === r.issue_type) opt.selected = true;
    typeSel.appendChild(opt);
  });

  const descTa = document.createElement('textarea');
  descTa.rows = 3;
  descTa.required = true;
  descTa.minLength = 15;
  descTa.maxLength = 300;
  descTa.value = r.description;

  const contactInput = document.createElement('input');
  contactInput.type = 'tel';
  contactInput.pattern = '[0-9]{11}';
  contactInput.value = r.contact || '';

  const timeInput = document.createElement('input');
  timeInput.type = 'datetime-local';
  timeInput.required = true;
  timeInput.value = toLocalDatetimeValue(r.time_noticed || '');

  form.appendChild(makeGroup('Area', areaSel, 'area'));
  form.appendChild(makeGroup('Issue Type', typeSel, 'issue_type'));
  form.appendChild(makeGroup('Description', descTa, 'description'));
  form.appendChild(makeGroup('Contact (optional)', contactInput, 'contact'));
  form.appendChild(makeGroup('Time Noticed', timeInput, 'time_noticed'));

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'btn btn-sm btn-secondary';
  btnCancel.textContent = 'Cancel';
  btnCancel.addEventListener('click', () => form.remove());

  const btnSave = document.createElement('button');
  btnSave.type = 'submit';
  btnSave.className = 'btn btn-sm btn-primary';
  btnSave.textContent = 'Save Changes';

  actions.appendChild(btnCancel);
  actions.appendChild(btnSave);
  form.appendChild(actions);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });

    setButtonBusy(btnSave, true, 'Saving...', 'Save Changes');
    try {
      const data = await api(`api/reports.php?id=${r.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          area: areaSel.value,
          issue_type: typeSel.value,
          description: descTa.value.trim(),
          contact: contactInput.value.trim(),
          time_noticed: toUtcIsoFromLocalInput(timeInput.value)
        })
      });
      replaceReportInState(data.report);
      showToast(`Updated report for ${data.report.area}.`, 'success');
    } catch (err) {
      if (err.status === 422 && err.fields) {
        Object.entries(err.fields).forEach(([field, msg]) => {
          const span = form.querySelector(`.field-error[data-field="${field}"]`);
          if (span) span.textContent = msg;
        });
      }
      showToast(err.message, 'error');
    } finally {
      setButtonBusy(btnSave, false, 'Saving...', 'Save Changes');
    }
  });

  card.appendChild(form);
}

function createReportCardElement(r) {
  const card = document.createElement('article');
  card.className = `report-card border-${r.status}`;
  card.setAttribute('role', 'listitem');
  card.id = `report-${r.id}`;

  // 1. Header with Badges
  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';

  const statusBadge = document.createElement('span');
  statusBadge.className = `status-badge status-${r.status}`;
  statusBadge.textContent = STATUSES[r.status] || r.status;
  cardHeader.appendChild(statusBadge);

  const verifBadge = document.createElement('span');
  if (r.verified) {
    verifBadge.className = 'badge badge-confirmed';
    verifBadge.textContent = `Confirmed ✔ (${r.report_count})`;
  } else {
    verifBadge.className = 'badge badge-unverified';
    verifBadge.textContent = `Unverified (${r.report_count})`;
  }
  cardHeader.appendChild(verifBadge);

  if (r.status === 'resolved') {
    const resBadge = document.createElement('span');
    resBadge.className = 'badge badge-resolved';
    resBadge.textContent = 'Resolved';
    cardHeader.appendChild(resBadge);
  }

  if (r.stale) {
    const staleBadge = document.createElement('span');
    staleBadge.className = 'badge badge-stale';
    staleBadge.textContent = 'Stale (needs update)';
    cardHeader.appendChild(staleBadge);
  }

  card.appendChild(cardHeader);

  // 2. Area & Issue Type
  const areaTitle = document.createElement('h3');
  areaTitle.className = 'card-area';
  areaTitle.textContent = r.area;
  card.appendChild(areaTitle);

  const issueSubtitle = document.createElement('div');
  issueSubtitle.className = 'card-type';
  issueSubtitle.textContent = `Issue: ${ISSUE_TYPES[r.issue_type] || r.issue_type}`;
  card.appendChild(issueSubtitle);

  // 3. Description
  const descPara = document.createElement('p');
  descPara.className = 'card-desc';
  descPara.textContent = r.description;
  card.appendChild(descPara);

  // 4. Metadata Row
  const metaDiv = document.createElement('div');
  metaDiv.className = 'card-meta';

  const timeNoticedSpan = document.createElement('span');
  timeNoticedSpan.textContent = `Noticed: ${formatReadableDate(r.time_noticed || r.created_at)}`;
  metaDiv.appendChild(timeNoticedSpan);

  const updatedSpan = document.createElement('span');
  updatedSpan.textContent = `Updated: ${formatReadableDate(r.updated_at)}`;
  metaDiv.appendChild(updatedSpan);

  const countSpan = document.createElement('span');
  countSpan.textContent = `Reports: ${r.report_count}`;
  metaDiv.appendChild(countSpan);

  const sourceSpan = document.createElement('span');
  sourceSpan.className = 'card-provenance';
  sourceSpan.textContent = `Source: ${r.source || 'resident'}`;
  metaDiv.appendChild(sourceSpan);

  card.appendChild(metaDiv);

  // 5. Contact (only returned by server to owner or admin)
  if (typeof r.contact === 'string' && r.contact.trim() !== '') {
    const contactPara = document.createElement('p');
    contactPara.style.fontSize = 'var(--text-xs)';
    contactPara.style.color = 'var(--color-text-muted)';
    contactPara.style.marginBottom = 'var(--space-xs)';
    contactPara.textContent = `Contact: ${r.contact}`;
    card.appendChild(contactPara);
  }

  // 6. Action Buttons (shown based on server-provided can_edit / role)
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card-actions';

  if (currentUser && r.status !== 'resolved') {
    const btnAffect = document.createElement('button');
    btnAffect.type = 'button';
    btnAffect.className = 'btn btn-sm btn-primary';
    if (r.confirmed_by_me) {
      btnAffect.textContent = 'You confirmed this';
      btnAffect.disabled = true;
    } else {
      btnAffect.textContent = "I'm affected too";
      btnAffect.addEventListener('click', () => handleConfirmReport(r.id, btnAffect));
    }
    actionsDiv.appendChild(btnAffect);
  }

  // Edit button: admin always, resident only for their own while status === 'reported'
  if (r.can_edit && (isAdmin() || r.status === 'reported')) {
    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'btn btn-sm btn-secondary';
    btnEdit.textContent = 'Edit';
    btnEdit.addEventListener('click', () => {
      const existingForm = card.querySelector('.inline-edit-form');
      if (existingForm) {
        existingForm.remove();
      } else {
        buildInlineEditForm(r, card);
      }
    });
    actionsDiv.appendChild(btnEdit);
  }

  // Admin moderation controls
  if (isAdmin()) {
    if (!r.verified && r.status !== 'resolved') {
      const btnVerify = document.createElement('button');
      btnVerify.type = 'button';
      btnVerify.className = 'btn btn-sm btn-secondary';
      btnVerify.textContent = 'Verify';
      btnVerify.addEventListener('click', () => handleVerifyReport(r.id, btnVerify));
      actionsDiv.appendChild(btnVerify);
    }

    const allowed = ALLOWED_TRANSITIONS[r.status] || [];
    allowed.forEach(nextStatus => {
      if (nextStatus === 'verified' && !r.verified) return;
      const btnTransition = document.createElement('button');
      btnTransition.type = 'button';
      btnTransition.className = 'btn btn-sm btn-secondary';
      btnTransition.textContent = `Mark ${STATUSES[nextStatus] || nextStatus}`;
      btnTransition.addEventListener('click', () => handleStatusTransition(r.id, nextStatus, btnTransition));
      actionsDiv.appendChild(btnTransition);
    });

    if (r.stale) {
      const btnReconfirm = document.createElement('button');
      btnReconfirm.type = 'button';
      btnReconfirm.className = 'btn btn-sm btn-secondary';
      btnReconfirm.textContent = 'Re-confirm Outage';
      btnReconfirm.addEventListener('click', () => handleReconfirmReport(r.id, btnReconfirm));
      actionsDiv.appendChild(btnReconfirm);
    }
  }

  // Delete button: admin always, resident only for their own while status === 'reported'
  if (r.can_edit && (isAdmin() || r.status === 'reported')) {
    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'btn btn-sm btn-danger';
    btnDelete.textContent = 'Delete';
    btnDelete.addEventListener('click', () => handleDeleteReport(r.id, r.area, btnDelete));
    actionsDiv.appendChild(btnDelete);
  }

  if (actionsDiv.children.length > 0) {
    card.appendChild(actionsDiv);
  }

  return card;
}

function replaceReportInState(updatedReport) {
  const idx = reports.findIndex(item => item.id === updatedReport.id);
  if (idx !== -1) {
    reports[idx] = updatedReport;
  } else {
    reports.unshift(updatedReport);
  }

  const existingCard = document.getElementById(`report-${updatedReport.id}`);
  const newCard = createReportCardElement(updatedReport);
  if (existingCard && existingCard.parentNode) {
    existingCard.parentNode.replaceChild(newCard, existingCard);
  } else if (reportsList) {
    reportsList.prepend(newCard);
    if (emptyState) emptyState.hidden = true;
  }

  if (isAdmin()) renderAdminDashboard();
}

/* ═══════════════════════════════════════════════════════════
   7. Loading & Filtering Reports
   ═══════════════════════════════════════════════════════════ */

function buildReportsQueryString() {
  const params = new URLSearchParams();
  if (filterArea && filterArea.value) params.set('area', filterArea.value);
  if (filterStatus && filterStatus.value) params.set('status', filterStatus.value);
  if (filterVerified && filterVerified.value) params.set('verified', filterVerified.value);
  if (filterSearch && filterSearch.value.trim()) params.set('q', filterSearch.value.trim());
  if (filterSort && filterSort.value) params.set('sort', filterSort.value);
  const qs = params.toString();
  return qs ? `api/reports.php?${qs}` : 'api/reports.php';
}

function renderReportsList() {
  if (!reportsList) return;
  reportsList.replaceChildren();

  if (reports.length === 0) {
    if (emptyState) {
      emptyState.textContent = 'No reports match your filters.';
      emptyState.hidden = false;
    }
  } else {
    if (emptyState) emptyState.hidden = true;
    reports.forEach(r => {
      reportsList.appendChild(createReportCardElement(r));
    });
  }

  updateSummary();
  if (isAdmin()) renderAdminDashboard();
}

async function loadReports() {
  if (reportsAbortController) {
    reportsAbortController.abort();
  }
  reportsAbortController = new AbortController();

  if (reportsLoading) reportsLoading.hidden = false;
  if (reportsError) reportsError.hidden = true;
  if (emptyState) emptyState.hidden = true;

  try {
    const data = await api(buildReportsQueryString(), {
      signal: reportsAbortController.signal
    });
    reports = Array.isArray(data.reports) ? data.reports : [];
    summaryCounts = data.counts || summaryCounts;
    if (reportsLoading) reportsLoading.hidden = true;
    renderReportsList();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return;
    }
    if (reportsLoading) reportsLoading.hidden = true;
    if (reportsList) reportsList.replaceChildren();
    if (reportsError && reportsErrorText) {
      reportsErrorText.textContent = err.message || 'Unable to load outage reports.';
      reportsError.hidden = false;
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   8. Report Actions (Confirm, Verify, Status, Reconfirm, Delete)
   ═══════════════════════════════════════════════════════════ */

async function handleConfirmReport(id, btn) {
  setButtonBusy(btn, true, 'Saving...', "I'm affected too");
  try {
    const data = await api(`api/reports.php?id=${id}&action=confirm`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    replaceReportInState(data.report);
    summaryCounts.confirmed = reports.filter(r => r.verified).length;
    summaryCounts.unverified = reports.filter(r => !r.verified).length;
    updateSummary();
    showToast(`Confirmation recorded for ${data.report.area}.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    setButtonBusy(btn, false, 'Saving...', "I'm affected too");
  }
}

async function handleVerifyReport(id, btn) {
  const rep = reports.find(r => r.id === id);
  const nextStatus = rep && rep.status === 'reported' ? 'verified' : (rep ? rep.status : 'verified');
  setButtonBusy(btn, true, 'Saving...', 'Verify');
  try {
    const data = await api(`api/reports.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ verified: true, status: nextStatus })
    });
    replaceReportInState(data.report);
    showToast(`Verified report for ${data.report.area}.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    setButtonBusy(btn, false, 'Saving...', 'Verify');
  }
}

async function handleStatusTransition(id, nextStatus, btn) {
  const label = `Mark ${STATUSES[nextStatus] || nextStatus}`;
  setButtonBusy(btn, true, 'Saving...', label);
  try {
    const data = await api(`api/reports.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus })
    });
    replaceReportInState(data.report);
    if (nextStatus === 'resolved') {
      summaryCounts.resolved += 1;
      updateSummary();
    }
    showToast(`Status updated to ${STATUSES[nextStatus] || nextStatus}.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    setButtonBusy(btn, false, 'Saving...', label);
  }
}

async function handleReconfirmReport(id, btn) {
  setButtonBusy(btn, true, 'Saving...', 'Re-confirm Outage');
  try {
    const data = await api(`api/reports.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ reconfirm: true })
    });
    replaceReportInState(data.report);
    showToast(`Re-confirmed outage for ${data.report.area}.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    setButtonBusy(btn, false, 'Saving...', 'Re-confirm Outage');
  }
}

async function handleDeleteReport(id, areaName, btn) {
  if (!window.confirm(`Delete the outage report for ${areaName}? This action cannot be undone.`)) {
    return;
  }
  setButtonBusy(btn, true, 'Deleting...', 'Delete');
  try {
    await api(`api/reports.php?id=${id}`, { method: 'DELETE' });
    reports = reports.filter(r => r.id !== id);
    const card = document.getElementById(`report-${id}`);
    if (card) card.remove();
    if (reports.length === 0 && emptyState) {
      emptyState.textContent = 'No reports match your filters.';
      emptyState.hidden = false;
    }
    summaryCounts.total = Math.max(0, (summaryCounts.total || 1) - 1);
    updateSummary();
    if (isAdmin()) renderAdminDashboard();
    showToast(`Report for ${areaName} deleted.`, 'info');
  } catch (err) {
    showToast(err.message, 'error');
    setButtonBusy(btn, false, 'Deleting...', 'Delete');
  }
}

/* ═══════════════════════════════════════════════════════════
   9. Report Form Submission & Duplicate Resolution
   ═══════════════════════════════════════════════════════════ */

function clearReportFormErrors() {
  Object.values(reportErrorEls).forEach(el => {
    if (el) el.textContent = '';
  });
  if (reportForm) {
    reportForm.querySelectorAll('input, select, textarea').forEach(el => el.classList.remove('touched'));
  }
}

function applyServerFieldErrors(errorMap, elementsMap) {
  let firstFocused = false;
  Object.entries(errorMap || {}).forEach(([field, msg]) => {
    const errEl = elementsMap[field];
    if (errEl) {
      errEl.textContent = msg;
      const inputEl = errEl.previousElementSibling;
      if (inputEl) {
        inputEl.classList.add('touched');
        if (!firstFocused) {
          inputEl.focus();
          firstFocused = true;
        }
      }
    }
  });
}

function showDuplicateChoicePrompt(existingReport, payload) {
  if (!formStatus) return;
  formStatus.replaceChildren();
  formStatus.className = 'form-status status-error';

  const promptBox = document.createElement('div');
  promptBox.style.cssText = 'padding: 0.5rem; background: var(--amber-50); border: 1px solid var(--amber-600); border-radius: var(--radius); margin-top: 0.5rem;';

  const msgPara = document.createElement('p');
  msgPara.style.color = 'var(--amber-800)';
  msgPara.style.marginBottom = '0.5rem';
  msgPara.textContent = `A similar outage was reported in ${existingReport.area} within the last 2 hours. Merge into the existing report or submit as new?`;
  promptBox.appendChild(msgPara);

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '0.5rem';
  btnGroup.style.flexWrap = 'wrap';

  const btnMerge = document.createElement('button');
  btnMerge.type = 'button';
  btnMerge.className = 'btn btn-sm btn-primary';
  btnMerge.textContent = `Merge into existing report (${existingReport.report_count} reports)`;
  btnMerge.addEventListener('click', () => submitReportPayload({ ...payload, on_duplicate: 'merge' }, btnMerge));

  const btnNew = document.createElement('button');
  btnNew.type = 'button';
  btnNew.className = 'btn btn-sm btn-secondary';
  btnNew.textContent = 'Submit as new';
  btnNew.addEventListener('click', () => submitReportPayload({ ...payload, on_duplicate: 'new' }, btnNew));

  btnGroup.appendChild(btnMerge);
  btnGroup.appendChild(btnNew);
  promptBox.appendChild(btnGroup);
  formStatus.appendChild(promptBox);
}

async function submitReportPayload(payload, triggerBtn = btnSubmitReport) {
  const defaultText = triggerBtn === btnSubmitReport ? 'Submit Report' : triggerBtn.textContent;
  setButtonBusy(triggerBtn, true, 'Saving...', defaultText);
  try {
    const data = await api('api/reports.php', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (data.merged) {
      replaceReportInState(data.report);
      showFormStatus(`Merged with existing report for ${data.report.area}.`, 'status-success');
      showToast(`Merged into report for ${data.report.area}.`, 'success');
    } else {
      reports.unshift(data.report);
      summaryCounts.total += 1;
      summaryCounts.unverified += 1;
      renderReportsList();
      showFormStatus(`Outage reported successfully for ${data.report.area}.`, 'status-success');
      showToast(`Report submitted for ${data.report.area}.`, 'success');
    }

    if (reportForm) reportForm.reset();
    setInitialTimeNoticed();
    if (descCount) descCount.textContent = '0 / 300';
  } catch (err) {
    if (err.status === 409 && err.data && err.data.duplicate) {
      showDuplicateChoicePrompt(err.data.duplicate, payload);
      return;
    }
    if (err.status === 422 && err.fields) {
      applyServerFieldErrors(err.fields, reportErrorEls);
      showFormStatus('Please correct the highlighted errors before submitting.', 'status-error');
    } else {
      showFormStatus(err.message, 'status-error');
    }
    showToast(err.message, 'error');
  } finally {
    setButtonBusy(triggerBtn, false, 'Saving...', defaultText);
  }
}

async function handleReportFormSubmit(e) {
  e.preventDefault();
  clearReportFormErrors();

  if (!currentUser) {
    showFormStatus('Please log in before submitting a report.', 'status-error');
    showToast('Please log in to submit a report.', 'error');
    return;
  }

  if (inputConsent && !inputConsent.checked) {
    if (reportErrorEls.consent) {
      reportErrorEls.consent.textContent = 'You must confirm that this report is accurate.';
    }
    inputConsent.focus();
    return;
  }

  const payload = {
    area: inputArea ? inputArea.value : '',
    issue_type: inputType ? inputType.value : '',
    description: inputDesc ? inputDesc.value.trim() : '',
    contact: inputContact ? inputContact.value.trim() : '',
    time_noticed: inputTime ? toUtcIsoFromLocalInput(inputTime.value) : ''
  };

  await submitReportPayload(payload, btnSubmitReport);
}

/* ═══════════════════════════════════════════════════════════
   10. Notices (Load, Create, Delete)
   ═══════════════════════════════════════════════════════════ */

function createNoticeElement(notice) {
  const li = document.createElement('li');
  li.id = `notice-${notice.id}`;

  if (isAdmin()) {
    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'notice-delete';
    btnDel.textContent = 'Delete';
    btnDel.addEventListener('click', () => handleDeleteNotice(notice.id, btnDel));
    li.appendChild(btnDel);
  }

  const titleHeading = document.createElement('h3');
  titleHeading.className = 'notice-title';
  titleHeading.textContent = notice.title;
  li.appendChild(titleHeading);

  const timeDiv = document.createElement('div');
  timeDiv.className = 'notice-time';
  const timeEl = document.createElement('time');
  timeEl.dateTime = notice.created_at;
  timeEl.textContent = formatReadableDate(notice.created_at);
  timeDiv.appendChild(timeEl);
  li.appendChild(timeDiv);

  const msgPara = document.createElement('p');
  msgPara.className = 'notice-message';
  msgPara.textContent = notice.message;
  li.appendChild(msgPara);

  return li;
}

function renderNoticesList() {
  if (!noticesList) return;
  noticesList.replaceChildren();

  if (notices.length === 0) {
    if (noticesEmpty) noticesEmpty.hidden = false;
    return;
  }
  if (noticesEmpty) noticesEmpty.hidden = true;

  notices.forEach(notice => {
    noticesList.appendChild(createNoticeElement(notice));
  });
}

async function loadNotices() {
  if (noticesLoading) noticesLoading.hidden = false;
  if (noticesError) noticesError.hidden = true;
  if (noticesEmpty) noticesEmpty.hidden = true;

  try {
    const data = await api('api/notices.php');
    notices = Array.isArray(data.notices) ? data.notices : [];
    if (noticesLoading) noticesLoading.hidden = true;
    renderNoticesList();
  } catch (err) {
    if (noticesLoading) noticesLoading.hidden = true;
    if (noticesList) noticesList.replaceChildren();
    if (noticesError && noticesErrorText) {
      noticesErrorText.textContent = err.message || 'Unable to load notices.';
      noticesError.hidden = false;
    }
  }
}

async function handleNoticeSubmit(e) {
  e.preventDefault();
  Object.values(noticeErrorEls).forEach(el => { if (el) el.textContent = ''; });

  const title = noticeTitle ? noticeTitle.value.trim() : '';
  const message = noticeMessage ? noticeMessage.value.trim() : '';

  setButtonBusy(btnSubmitNotice, true, 'Saving...', 'Post Notice');
  try {
    const data = await api('api/notices.php', {
      method: 'POST',
      body: JSON.stringify({ title, message })
    });
    notices.unshift(data.notice);
    renderNoticesList();
    if (noticeForm) noticeForm.reset();
    showToast('Notice published successfully.', 'success');
  } catch (err) {
    if (err.status === 422 && err.fields) {
      applyServerFieldErrors(err.fields, noticeErrorEls);
    }
    showToast(err.message, 'error');
  } finally {
    setButtonBusy(btnSubmitNotice, false, 'Saving...', 'Post Notice');
  }
}

async function handleDeleteNotice(id, btn) {
  if (!window.confirm('Delete this notice?')) return;
  setButtonBusy(btn, true, 'Deleting...', 'Delete');
  try {
    await api(`api/notices.php?id=${id}`, { method: 'DELETE' });
    notices = notices.filter(n => n.id !== id);
    renderNoticesList();
    showToast('Notice deleted.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
    setButtonBusy(btn, false, 'Deleting...', 'Delete');
  }
}

/* ═══════════════════════════════════════════════════════════
   11. Event Bindings & Boot
   ═══════════════════════════════════════════════════════════ */

function bindEventListeners() {
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  if (inputDesc && descCount) {
    inputDesc.addEventListener('input', () => {
      const len = inputDesc.value.length;
      descCount.textContent = `${len} / 300`;
      descCount.style.color = len > 300 ? 'var(--color-danger)' : 'var(--color-text-muted)';
    });
  }

  if (reportForm) {
    reportForm.addEventListener('submit', handleReportFormSubmit);
    reportForm.addEventListener('reset', () => {
      clearReportFormErrors();
      showFormStatus('', '');
      setTimeout(() => {
        setInitialTimeNoticed();
        if (descCount) descCount.textContent = '0 / 300';
      }, 0);
    });
  }

  [inputArea, inputType, inputDesc, inputContact, inputTime, inputConsent].forEach(el => {
    if (!el) return;
    el.addEventListener('blur', () => el.classList.add('touched'));
  });

  if (filterArea) filterArea.addEventListener('change', loadReports);
  if (filterStatus) filterStatus.addEventListener('change', loadReports);
  if (filterVerified) filterVerified.addEventListener('change', loadReports);
  if (filterSort) {
    filterSort.addEventListener('change', () => {
      saveSortPreference(filterSort.value);
      loadReports();
    });
  }
  if (filterSearch) {
    filterSearch.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        loadReports();
      }, 300);
    });
  }
  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      if (filterArea) filterArea.value = '';
      if (filterStatus) filterStatus.value = '';
      if (filterVerified) filterVerified.value = '';
      if (filterSearch) filterSearch.value = '';
      if (filterSort) {
        filterSort.value = 'newest';
        saveSortPreference('newest');
      }
      loadReports();
    });
  }

  if (btnRetryReports) btnRetryReports.addEventListener('click', loadReports);
  if (btnRetryNotices) btnRetryNotices.addEventListener('click', loadNotices);
  if (noticeForm) noticeForm.addEventListener('submit', handleNoticeSubmit);
}

document.addEventListener('DOMContentLoaded', async () => {
  loadSortPreference();
  setInitialTimeNoticed();
  bindEventListeners();

  try {
    await initAuth();
  } catch (err) {
    showToast(err.message || 'Unable to verify session.', 'error');
  }

  await Promise.all([loadReports(), loadNotices()]);
});
