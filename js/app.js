// js/app.js
// Client-side controller for Water Outage Reporting Board.
// Implements CRUD, moderation, filtering, duplicate handling, and stale-data detection.

'use strict';

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */
const STALE_HOURS = 24;
const DUPLICATE_WINDOW_HOURS = 2;
const STORAGE_KEY = 'water_outage_board_data';

/* ═══════════════════════════════════════════════════════════
   Application State
   ═══════════════════════════════════════════════════════════ */
let reports = [];
let notices = [];
let pendingDuplicate = null; // Stores data if a near-duplicate is detected on submit

/* ═══════════════════════════════════════════════════════════
   DOM Element References
   ═══════════════════════════════════════════════════════════ */
// Form
const reportForm = document.getElementById('report-form');
const inputArea = document.getElementById('input-area');
const inputType = document.getElementById('input-type');
const inputDesc = document.getElementById('input-desc');
const inputContact = document.getElementById('input-contact');
const inputTime = document.getElementById('input-time');
const inputConsent = document.getElementById('input-consent');
const descCount = document.getElementById('desc-count');
const formStatus = document.getElementById('form-status');

// Per-field error containers
const errorArea = document.getElementById('error-area');
const errorType = document.getElementById('error-type');
const errorDesc = document.getElementById('error-desc');
const errorContact = document.getElementById('error-contact');
const errorTime = document.getElementById('error-time');
const errorConsent = document.getElementById('error-consent');

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

// Reports list & empty state
const reportsList = document.getElementById('reports-list');
const emptyState = document.getElementById('empty-state');

// Notices
const noticesList = document.getElementById('notices-list');
const noticesEmpty = document.getElementById('notices-empty');
const noticeForm = document.getElementById('notice-form');
const noticeTitle = document.getElementById('notice-title');
const noticeMessage = document.getElementById('notice-message');

/* ═══════════════════════════════════════════════════════════
   1. Storage & Initialization
   ═══════════════════════════════════════════════════════════ */

/**
 * Helper predicates to validate stored entities against data model schema.
 */
function isValidReport(r) {
  return (
    r &&
    typeof r === 'object' &&
    typeof r.id === 'string' &&
    typeof r.area === 'string' &&
    typeof r.issueType === 'string' &&
    typeof r.description === 'string' &&
    typeof r.status === 'string'
  );
}

function isValidNotice(n) {
  return (
    n &&
    typeof n === 'object' &&
    typeof n.id === 'string' &&
    typeof n.title === 'string' &&
    typeof n.message === 'string'
  );
}

/**
 * Loads data from localStorage with try/catch; falls back to sample data on missing/corrupt data.
 */
function loadData() {
  let fallbackNeeded = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      fallbackNeeded = true;
    } else {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.reports) || !Array.isArray(parsed.notices)) {
        fallbackNeeded = true;
      } else {
        const validReports = parsed.reports.filter(isValidReport);
        const validNotices = parsed.notices.filter(isValidNotice);
        if (validReports.length === 0 && parsed.reports.length > 0) {
          fallbackNeeded = true;
        } else {
          reports = validReports;
          notices = validNotices;
        }
      }
    }
  } catch (err) {
    console.error('Storage error:', err);
    fallbackNeeded = true;
  }

  if (fallbackNeeded) {
    resetToSampleData(false);
    showStorageWarning('Notice: Loaded initial sample data (local storage was empty or corrupted).');
  }
}

/**
 * Saves current reports and notices to localStorage with error handling.
 */
function saveData() {
  try {
    const payload = JSON.stringify({ reports, notices });
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
    showStorageWarning('Error: Could not save data. Browser storage may be full or disabled.');
    return false;
  }
}

/**
 * Resets board data to the sample set defined in data.js.
 */
function resetToSampleData(shouldNotify = true) {
  // Deep copy sample data so runtime mutations do not alter seeds
  reports = JSON.parse(JSON.stringify(window.SAMPLE_REPORTS || []));
  notices = JSON.parse(JSON.stringify(window.SAMPLE_NOTICES || []));
  saveData();
  renderAll();
  if (shouldNotify) {
    showFormStatus('All sample reports and notices have been reset.', 'status-success');
  }
}

/**
 * Displays a visible banner warning if storage fails or falls back.
 */
function showStorageWarning(msg) {
  let warningBanner = document.getElementById('storage-warning');
  if (!warningBanner) {
    warningBanner = document.createElement('div');
    warningBanner.id = 'storage-warning';
    warningBanner.setAttribute('role', 'alert');
    warningBanner.style.cssText =
      'background: var(--amber-100); color: var(--amber-800); border: 1px solid var(--amber-600); padding: 0.75rem 1rem; border-radius: var(--radius); margin-bottom: 1rem; font-weight: 600; font-size: 0.9rem;';
    const main = document.getElementById('main-content');
    if (main) main.insertBefore(warningBanner, main.firstChild);
  }
  warningBanner.textContent = msg;
}

/* ═══════════════════════════════════════════════════════════
   2. Date & Time Helpers
   ═══════════════════════════════════════════════════════════ */

/**
 * Formats an ISO date string into a friendly relative or calendar string.
 */
function formatReadableDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (60 * 1000));
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

/**
 * Determines whether a non-resolved report is older than STALE_HOURS without an update.
 */
function isReportStale(report) {
  if (report.status === 'resolved') return false;
  if (report.status === 'stale') return true;
  const updatedTime = new Date(report.updatedAt).getTime();
  const elapsedHours = (Date.now() - updatedTime) / (1000 * 60 * 60);
  return elapsedHours >= STALE_HOURS;
}

/**
 * Pre-populates the datetime-local input with the current local time.
 */
function setInitialTimeNoticed() {
  if (!inputTime) return;
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  const localIso = new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
  inputTime.value = localIso;
  inputTime.max = localIso; // Prevent selecting future time
}

/* ═══════════════════════════════════════════════════════════
   3. Summary Statistics
   ═══════════════════════════════════════════════════════════ */

/**
 * Recalculates and updates the 5 board statistics counters.
 */
function updateSummary() {
  const activeReports = reports.filter(r => r.mergedInto === null);

  let total = activeReports.length;
  let confirmed = 0;
  let unverified = 0;
  let resolved = 0;
  let stale = 0;

  activeReports.forEach(r => {
    if (r.verified) confirmed++;
    else unverified++;

    if (r.status === 'resolved') resolved++;
    if (isReportStale(r)) stale++;
  });

  if (countTotal) countTotal.textContent = total;
  if (countConfirmed) countConfirmed.textContent = confirmed;
  if (countUnverified) countUnverified.textContent = unverified;
  if (countResolved) countResolved.textContent = resolved;
  if (countStale) countStale.textContent = stale;
}

/* ═══════════════════════════════════════════════════════════
   4. Report Card Builder (Safe DOM manipulation via textContent)
   ═══════════════════════════════════════════════════════════ */

/**
 * Builds a single DOM article element for a report card without innerHTML on user data.
 */
function createReportCardElement(r) {
  const card = document.createElement('article');
  card.className = `report-card border-${r.status}`;
  card.setAttribute('role', 'listitem');
  card.id = `report-${r.id}`;

  // 1. Header with Badges
  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';

  // Status Badge
  const statusBadge = document.createElement('span');
  statusBadge.className = `status-badge status-${r.status}`;
  statusBadge.textContent = window.STATUSES[r.status] || r.status;
  cardHeader.appendChild(statusBadge);

  // Verification Badge
  const verifBadge = document.createElement('span');
  if (r.verified) {
    verifBadge.className = 'badge badge-confirmed';
    verifBadge.textContent = `Confirmed ✔ (${r.reportCount})`;
  } else {
    verifBadge.className = 'badge badge-unverified';
    verifBadge.textContent = `Unverified (${r.reportCount})`;
  }
  cardHeader.appendChild(verifBadge);

  // Resolved badge if resolved
  if (r.status === 'resolved') {
    const resBadge = document.createElement('span');
    resBadge.className = 'badge badge-resolved';
    resBadge.textContent = 'Resolved';
    cardHeader.appendChild(resBadge);
  }

  // Stale Badge if overdue
  if (isReportStale(r)) {
    const staleBadge = document.createElement('span');
    staleBadge.className = 'badge badge-stale';
    staleBadge.textContent = 'Stale (needs update)';
    cardHeader.appendChild(staleBadge);
  }

  card.appendChild(cardHeader);

  // 2. Area title
  const areaTitle = document.createElement('h3');
  areaTitle.className = 'card-area';
  areaTitle.textContent = r.area;
  card.appendChild(areaTitle);

  // 3. Issue Type
  const issueSubtitle = document.createElement('div');
  issueSubtitle.className = 'card-type';
  const issueLabel = window.ISSUE_TYPES[r.issueType] || r.issueType;
  issueSubtitle.textContent = `Issue: ${issueLabel}`;
  card.appendChild(issueSubtitle);

  // 4. Description (safe textContent)
  const descPara = document.createElement('p');
  descPara.className = 'card-desc';
  descPara.textContent = r.description;
  card.appendChild(descPara);

  // 5. Metadata Row
  const metaDiv = document.createElement('div');
  metaDiv.className = 'card-meta';

  const timeNoticedSpan = document.createElement('span');
  timeNoticedSpan.textContent = `Noticed: ${formatReadableDate(r.timeNoticed || r.createdAt)}`;
  metaDiv.appendChild(timeNoticedSpan);

  const updatedSpan = document.createElement('span');
  updatedSpan.textContent = `Updated: ${formatReadableDate(r.updatedAt)}`;
  metaDiv.appendChild(updatedSpan);

  const countSpan = document.createElement('span');
  countSpan.textContent = `Reports: ${r.reportCount}`;
  metaDiv.appendChild(countSpan);

  const sourceSpan = document.createElement('span');
  sourceSpan.className = 'card-provenance';
  const provenanceText = r.provenanceHistory && r.provenanceHistory.length > 1
    ? `Source: ${r.source || 'resident'} (+${r.provenanceHistory.length - 1} merged)`
    : `Source: ${r.source || 'resident'}`;
  sourceSpan.textContent = provenanceText;
  metaDiv.appendChild(sourceSpan);

  card.appendChild(metaDiv);

  // 6. Contact info if provided
  if (r.contact && r.contact.trim()) {
    const contactPara = document.createElement('p');
    contactPara.style.fontSize = 'var(--text-xs)';
    contactPara.style.color = 'var(--color-text-muted)';
    contactPara.style.marginBottom = 'var(--space-xs)';
    contactPara.textContent = `Contact: ${r.contact}`;
    card.appendChild(contactPara);
  }

  // 7. Moderation & Action Buttons Row
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card-actions';

  // "Verify" button (if not already verified and not resolved)
  if (!r.verified && r.status !== 'resolved') {
    const btnVerify = document.createElement('button');
    btnVerify.type = 'button';
    btnVerify.className = 'btn btn-sm btn-primary';
    btnVerify.textContent = 'Verify';
    btnVerify.setAttribute('aria-label', `Verify outage report for ${r.area}`);
    btnVerify.addEventListener('click', () => handleVerifyReport(r.id));
    actionsDiv.appendChild(btnVerify);
  }

  // Allowed Status Transition Buttons
  const allowed = window.ALLOWED_TRANSITIONS[r.status] || [];
  allowed.forEach(nextStatus => {
    // Skip 'verified' as a direct button if it duplicates the Verify button above
    if (nextStatus === 'verified' && !r.verified) return;

    const btnTransition = document.createElement('button');
    btnTransition.type = 'button';
    btnTransition.className = 'btn btn-sm btn-secondary';
    btnTransition.textContent = `Mark ${window.STATUSES[nextStatus] || nextStatus}`;
    btnTransition.setAttribute('aria-label', `Mark status as ${window.STATUSES[nextStatus] || nextStatus} for ${r.area}`);
    btnTransition.addEventListener('click', () => handleStatusTransition(r.id, nextStatus));
    actionsDiv.appendChild(btnTransition);
  });

  // Stale Re-confirm button
  if (isReportStale(r)) {
    const btnReconfirm = document.createElement('button');
    btnReconfirm.type = 'button';
    btnReconfirm.className = 'btn btn-sm btn-primary';
    btnReconfirm.textContent = 'Re-confirm Outage';
    btnReconfirm.setAttribute('aria-label', `Re-confirm outage report for ${r.area}`);
    btnReconfirm.addEventListener('click', () => handleReconfirmReport(r.id));
    actionsDiv.appendChild(btnReconfirm);
  }

  // Delete button with confirmation
  const btnDelete = document.createElement('button');
  btnDelete.type = 'button';
  btnDelete.className = 'btn btn-sm btn-danger';
  btnDelete.textContent = 'Delete';
  btnDelete.setAttribute('aria-label', `Delete outage report for ${r.area}`);
  btnDelete.addEventListener('click', () => handleDeleteReport(r.id, r.area));
  actionsDiv.appendChild(btnDelete);

  card.appendChild(actionsDiv);
  return card;
}

/* ═══════════════════════════════════════════════════════════
   5. Filtering & Sorting
   ═══════════════════════════════════════════════════════════ */

/**
 * Returns filtered and sorted list of reports based on user filter selections.
 */
function getFilteredAndSortedReports() {
  const areaVal = filterArea ? filterArea.value : '';
  const statusVal = filterStatus ? filterStatus.value : '';
  const verifiedVal = filterVerified ? filterVerified.value : '';
  const searchVal = filterSearch ? filterSearch.value.trim().toLowerCase() : '';
  const sortVal = filterSort ? filterSort.value : 'newest';

  // Only examine unmerged reports
  let result = reports.filter(r => r.mergedInto === null);

  // Filter: Area
  if (areaVal) {
    result = result.filter(r => r.area === areaVal);
  }

  // Filter: Status
  if (statusVal) {
    if (statusVal === 'stale') {
      result = result.filter(r => isReportStale(r));
    } else {
      result = result.filter(r => r.status === statusVal);
    }
  }

  // Filter: Verification
  if (verifiedVal === 'confirmed') {
    result = result.filter(r => r.verified === true);
  } else if (verifiedVal === 'unverified') {
    result = result.filter(r => r.verified === false);
  }

  // Filter: Keyword Search (area, description, issue type)
  if (searchVal) {
    result = result.filter(r => {
      const areaMatch = r.area.toLowerCase().includes(searchVal);
      const descMatch = r.description.toLowerCase().includes(searchVal);
      const issueLabel = (window.ISSUE_TYPES[r.issueType] || r.issueType).toLowerCase();
      const typeMatch = issueLabel.includes(searchVal);
      return areaMatch || descMatch || typeMatch;
    });
  }

  // Sort
  result.sort((a, b) => {
    if (sortVal === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortVal === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortVal === 'most-reports') {
      return b.reportCount - a.reportCount;
    }
    return 0;
  });

  return result;
}

/**
 * Renders report cards in the list container and toggles the empty-state message.
 */
function renderReports() {
  if (!reportsList) return;
  reportsList.innerHTML = '';

  const visibleReports = getFilteredAndSortedReports();

  if (visibleReports.length === 0) {
    if (emptyState) {
      if (reports.length === 0) {
        emptyState.textContent = 'No outage reports currently on the board. Use the form above to submit a report.';
      } else {
        emptyState.textContent = 'No reports match your current filters. Adjust your filter selections or click "Clear Filters".';
      }
      emptyState.hidden = false;
    }
  } else {
    if (emptyState) emptyState.hidden = true;
    visibleReports.forEach(r => {
      const card = createReportCardElement(r);
      reportsList.appendChild(card);
    });
  }

  updateSummary();
}

/**
 * Resets all filter controls to defaults and re-renders the report board.
 */
function handleClearFilters() {
  if (filterArea) filterArea.value = '';
  if (filterStatus) filterStatus.value = '';
  if (filterVerified) filterVerified.value = '';
  if (filterSearch) filterSearch.value = '';
  if (filterSort) filterSort.value = 'newest';
  renderReports();
}

/* ═══════════════════════════════════════════════════════════
   6. Moderation Handlers
   ═══════════════════════════════════════════════════════════ */

/**
 * Verifies a report: sets verified to true, advances status to verified, updates timestamp.
 */
function handleVerifyReport(id) {
  const rep = reports.find(r => r.id === id);
  if (!rep) return;
  rep.verified = true;
  if (rep.status === 'reported') {
    rep.status = 'verified';
  }
  rep.updatedAt = new Date().toISOString();
  saveData();
  renderAll();
  showFormStatus(`Report for ${rep.area} marked as confirmed & verified.`, 'status-success');
}

/**
 * Updates a report's status to an allowed next state.
 */
function handleStatusTransition(id, nextStatus) {
  const rep = reports.find(r => r.id === id);
  if (!rep) return false;

  const allowed = window.ALLOWED_TRANSITIONS[rep.status] || [];
  if (!allowed.includes(nextStatus)) {
    showFormStatus(
      `Invalid status transition: Cannot change from "${window.STATUSES[rep.status] || rep.status}" directly to "${window.STATUSES[nextStatus] || nextStatus}".`,
      'status-error'
    );
    return false;
  }

  rep.status = nextStatus;
  if (nextStatus === 'verified') {
    rep.verified = true;
  }
  rep.updatedAt = new Date().toISOString();
  saveData();
  renderAll();
  showFormStatus(`Status updated to "${window.STATUSES[nextStatus]}" for ${rep.area}.`, 'status-success');
  return true;
}

/**
 * Refreshes the updatedAt timestamp on a stale report to re-confirm it.
 */
function handleReconfirmReport(id) {
  const rep = reports.find(r => r.id === id);
  if (!rep) return;
  rep.updatedAt = new Date().toISOString();
  if (rep.status === 'stale') {
    rep.status = rep.verified ? 'verified' : 'reported';
  }
  rep.reportCount += 1;
  saveData();
  renderAll();
  showFormStatus(`Outage re-confirmed for ${rep.area}. Timestamp updated.`, 'status-success');
}

/**
 * Deletes a report after asking user confirmation.
 */
function handleDeleteReport(id, areaName) {
  const confirmed = window.confirm(`Delete the outage report for ${areaName}? This action cannot be undone.`);
  if (!confirmed) return;

  reports = reports.filter(r => r.id !== id);
  saveData();
  renderAll();
  showFormStatus(`Report for ${areaName} deleted.`, 'status-success');
}

/* ═══════════════════════════════════════════════════════════
   7. Form Validation & Submission
   ═══════════════════════════════════════════════════════════ */

/**
 * Clears all inline error messages and invalid styles.
 */
function clearFormErrors() {
  const errorSpans = [errorArea, errorType, errorDesc, errorContact, errorTime, errorConsent];
  errorSpans.forEach(el => {
    if (el) el.textContent = '';
  });
  if (reportForm) {
    const inputs = reportForm.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.classList.remove('touched'));
  }
}

/**
 * Displays status feedback inside the aria-live form-status container.
 */
function showFormStatus(msg, statusClass) {
  if (!formStatus) return;
  formStatus.textContent = msg;
  formStatus.className = `form-status ${statusClass || ''}`;
}

/**
 * Performs custom JS checks alongside native HTML5 constraint validation.
 */
function validateForm() {
  clearFormErrors();
  let isValid = true;
  let firstInvalidEl = null;

  // 1. Area
  if (!inputArea.value) {
    if (errorArea) errorArea.textContent = 'Please choose an affected area.';
    inputArea.classList.add('touched');
    if (!firstInvalidEl) firstInvalidEl = inputArea;
    isValid = false;
  }

  // 2. Issue Type
  if (!inputType.value) {
    if (errorType) errorType.textContent = 'Please select the type of outage.';
    inputType.classList.add('touched');
    if (!firstInvalidEl) firstInvalidEl = inputType;
    isValid = false;
  }

  // 3. Description (required, min 15, max 300, cannot be whitespace only)
  const descVal = inputDesc.value.trim();
  if (!descVal || descVal.length < 15) {
    if (errorDesc) errorDesc.textContent = 'Description must be at least 15 characters (cannot be empty spaces).';
    inputDesc.classList.add('touched');
    if (!firstInvalidEl) firstInvalidEl = inputDesc;
    isValid = false;
  } else if (descVal.length > 300) {
    if (errorDesc) errorDesc.textContent = 'Description must not exceed 300 characters.';
    inputDesc.classList.add('touched');
    if (!firstInvalidEl) firstInvalidEl = inputDesc;
    isValid = false;
  }

  // 4. Contact (optional, 11 digits pattern if provided)
  const contactVal = inputContact.value.trim();
  if (contactVal && !/^[0-9]{11}$/.test(contactVal)) {
    if (errorContact) errorContact.textContent = 'Phone number must be exactly 11 digits.';
    inputContact.classList.add('touched');
    if (!firstInvalidEl) firstInvalidEl = inputContact;
    isValid = false;
  }

  // 5. Time Noticed (required, cannot be in future or invalid)
  if (!inputTime.value) {
    if (errorTime) errorTime.textContent = 'Please specify when the outage was noticed.';
    inputTime.classList.add('touched');
    if (!firstInvalidEl) firstInvalidEl = inputTime;
    isValid = false;
  } else {
    const noticedDate = new Date(inputTime.value);
    if (isNaN(noticedDate.getTime())) {
      if (errorTime) errorTime.textContent = 'Please enter a valid date and time.';
      inputTime.classList.add('touched');
      if (!firstInvalidEl) firstInvalidEl = inputTime;
      isValid = false;
    } else if (noticedDate.getTime() > Date.now()) {
      if (errorTime) errorTime.textContent = 'Time noticed cannot be in the future.';
      inputTime.classList.add('touched');
      if (!firstInvalidEl) firstInvalidEl = inputTime;
      isValid = false;
    }
  }

  // 6. Consent checkbox
  if (!inputConsent.checked) {
    if (errorConsent) errorConsent.textContent = 'You must confirm that this report is accurate.';
    inputConsent.classList.add('touched');
    if (!firstInvalidEl) firstInvalidEl = inputConsent;
    isValid = false;
  }

  // Focus the first invalid element for immediate keyboard accessibility
  if (!isValid && firstInvalidEl) {
    firstInvalidEl.focus();
  }

  return isValid;
}

/**
 * Finds near-duplicate non-resolved reports in the same area & type within DUPLICATE_WINDOW_HOURS.
 */
function findExistingNearDuplicate(area, issueType) {
  const windowMs = DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000;
  const now = Date.now();

  return reports.find(r => {
    if (r.mergedInto !== null || r.status === 'resolved') return false;
    if (r.area !== area || r.issueType !== issueType) return false;

    const reportTime = new Date(r.createdAt).getTime();
    return Math.abs(now - reportTime) <= windowMs;
  });
}

/**
 * Creates and appends a brand new report to state and storage.
 */
function submitNewReport(reportData) {
  const newReport = {
    id: `rep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    area: reportData.area,
    issueType: reportData.issueType,
    description: reportData.description,
    contact: reportData.contact,
    timeNoticed: reportData.timeNoticed,
    status: 'reported',
    verified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mergedInto: null,
    source: 'resident',
    reportCount: 1
  };

  reports.unshift(newReport);
  saveData();
  renderAll();

  reportForm.reset();
  setInitialTimeNoticed();
  if (descCount) descCount.textContent = '0 / 300';
  showFormStatus(`Outage reported successfully for ${newReport.area}! Status: Reported (Unverified).`, 'status-success');
}

/**
 * Merges report submission into an existing near-duplicate report.
 */
function mergeIntoExistingReport(existingReportId, newReportData) {
  const target = reports.find(r => r.id === existingReportId);
  if (!target) {
    submitNewReport(newReportData);
    return;
  }

  target.reportCount += 1;
  target.updatedAt = new Date().toISOString();

  // Explicitly maintain data provenance history across duplicate merges
  if (!Array.isArray(target.provenanceHistory)) {
    target.provenanceHistory = [target.source || 'resident'];
  }
  target.provenanceHistory.push('resident');

  // If report count reaches 3, automatically confirm/verify
  if (target.reportCount >= 3 && !target.verified) {
    target.verified = true;
    if (target.status === 'reported') target.status = 'verified';
  }

  saveData();
  renderAll();

  reportForm.reset();
  setInitialTimeNoticed();
  if (descCount) descCount.textContent = '0 / 300';
  showFormStatus(`Merged with existing report for ${target.area}. Total confirmations: ${target.reportCount} (provenance recorded).`, 'status-success');
}

/**
 * Displays an interactive duplicate resolution offering "Merge into existing report" or "Submit as new".
 */
function showDuplicateChoicePrompt(existingReport, newReportData) {
  if (!formStatus) return;
  formStatus.innerHTML = ''; // Only used to construct the decision container buttons
  formStatus.className = 'form-status status-error';

  const promptBox = document.createElement('div');
  promptBox.style.cssText = 'padding: 0.5rem; background: var(--amber-50); border: 1px solid var(--amber-600); border-radius: var(--radius); margin-top: 0.5rem;';

  const msgPara = document.createElement('p');
  msgPara.style.color = 'var(--amber-800)';
  msgPara.style.marginBottom = '0.5rem';
  msgPara.textContent = `A similar outage was reported in ${existingReport.area} within the last 2 hours. Would you like to merge into the existing report or submit a new entry?`;
  promptBox.appendChild(msgPara);

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '0.5rem';
  btnGroup.style.flexWrap = 'wrap';

  // Merge button
  const btnMerge = document.createElement('button');
  btnMerge.type = 'button';
  btnMerge.className = 'btn btn-sm btn-primary';
  btnMerge.textContent = `Merge into existing report (${existingReport.reportCount} reports)`;
  btnMerge.addEventListener('click', () => {
    mergeIntoExistingReport(existingReport.id, newReportData);
  });
  btnGroup.appendChild(btnMerge);

  // Submit as new button
  const btnNew = document.createElement('button');
  btnNew.type = 'button';
  btnNew.className = 'btn btn-sm btn-secondary';
  btnNew.textContent = 'Submit as new';
  btnNew.addEventListener('click', () => {
    submitNewReport(newReportData);
  });
  btnGroup.appendChild(btnNew);

  promptBox.appendChild(btnGroup);
  formStatus.appendChild(promptBox);
}

/**
 * Handles the submit event on the report form.
 */
function handleFormSubmit(e) {
  e.preventDefault();

  if (!validateForm()) {
    showFormStatus('Please correct the highlighted errors before submitting.', 'status-error');
    return;
  }

  const formData = {
    area: inputArea.value,
    issueType: inputType.value,
    description: inputDesc.value.trim(),
    contact: inputContact.value.trim(),
    timeNoticed: inputTime.value
  };

  // Check for duplicates in the same area & issue within DUPLICATE_WINDOW_HOURS
  const nearDuplicate = findExistingNearDuplicate(formData.area, formData.issueType);
  if (nearDuplicate) {
    showDuplicateChoicePrompt(nearDuplicate, formData);
  } else {
    submitNewReport(formData);
  }
}

/* ═══════════════════════════════════════════════════════════
   8. Notices Section
   ═══════════════════════════════════════════════════════════ */

/**
 * Renders all board notices ordered newest first. Safe DOM nodes with textContent.
 */
function renderNotices() {
  if (!noticesList) return;
  noticesList.innerHTML = '';

  if (notices.length === 0) {
    if (noticesEmpty) noticesEmpty.hidden = false;
    return;
  }
  if (noticesEmpty) noticesEmpty.hidden = true;

  // Newest notices first
  const sortedNotices = [...notices].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  sortedNotices.forEach(notice => {
    const li = document.createElement('li');

    // Semantic Title under <h2>Notices</h2>
    const titleHeading = document.createElement('h3');
    titleHeading.className = 'notice-title';
    titleHeading.textContent = notice.title;
    li.appendChild(titleHeading);

    // Timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'notice-time';
    const timeEl = document.createElement('time');
    timeEl.dateTime = notice.timestamp;
    timeEl.textContent = formatReadableDate(notice.timestamp);
    timeDiv.appendChild(timeEl);
    li.appendChild(timeDiv);

    // Message
    const msgPara = document.createElement('p');
    msgPara.className = 'notice-message';
    msgPara.textContent = notice.message;
    li.appendChild(msgPara);

    noticesList.appendChild(li);
  });
}

/**
 * Handles posting a new notice with title and message validation.
 */
function handleNoticeSubmit(e) {
  e.preventDefault();
  const titleVal = noticeTitle.value.trim();
  const messageVal = noticeMessage.value.trim();

  if (!titleVal || !messageVal) {
    alert('Please enter both a title and message for the notice.');
    return;
  }

  const newNotice = {
    id: `not-${Date.now().toString(36)}`,
    title: titleVal,
    message: messageVal,
    timestamp: new Date().toISOString()
  };

  notices.unshift(newNotice);
  saveData();
  renderNotices();

  noticeForm.reset();
}

/* ═══════════════════════════════════════════════════════════
   9. "Reset sample data" Button
   ═══════════════════════════════════════════════════════════ */

/**
 * Injects a "Reset sample data" button into the footer if not already present in HTML.
 */
function setupResetButton() {
  let resetBtn = document.getElementById('btn-reset-data');
  if (!resetBtn) {
    resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = 'btn-reset-data';
    resetBtn.className = 'btn btn-sm btn-secondary';
    resetBtn.style.marginTop = '0.5rem';
    resetBtn.textContent = 'Reset Sample Data';

    const footer = document.querySelector('footer.site-footer');
    if (footer) {
      footer.appendChild(resetBtn);
    }
  }

  resetBtn.addEventListener('click', () => {
    const confirmReset = window.confirm('Reset all outage reports and notices to the initial assignment sample data?');
    if (confirmReset) {
      resetToSampleData(true);
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   10. Master Render & Event Bindings
   ═══════════════════════════════════════════════════════════ */

/**
 * Convenience orchestrator to re-render reports, notices, and counters.
 */
function renderAll() {
  renderReports();
  renderNotices();
}

/**
 * Attaches all form, filter, and input event handlers.
 */
function bindEventListeners() {
  // Live character counter on description
  if (inputDesc && descCount) {
    inputDesc.addEventListener('input', () => {
      const len = inputDesc.value.length;
      descCount.textContent = `${len} / 300`;
      if (len > 300) {
        descCount.style.color = 'var(--color-danger)';
      } else {
        descCount.style.color = 'var(--color-text-muted)';
      }
    });
  }

  // Form submit and reset
  if (reportForm) {
    reportForm.addEventListener('submit', handleFormSubmit);
    reportForm.addEventListener('reset', () => {
      clearFormErrors();
      showFormStatus('', '');
      setTimeout(() => {
        setInitialTimeNoticed();
        if (descCount) descCount.textContent = '0 / 300';
      }, 0);
    });
  }

  // Live validation feedback on blur
  const monitoredInputs = [inputArea, inputType, inputDesc, inputContact, inputTime, inputConsent];
  monitoredInputs.forEach(input => {
    if (!input) return;
    input.addEventListener('blur', () => {
      input.classList.add('touched');
    });
  });

  // Filter events
  if (filterArea) filterArea.addEventListener('change', renderReports);
  if (filterStatus) filterStatus.addEventListener('change', renderReports);
  if (filterVerified) filterVerified.addEventListener('change', renderReports);
  if (filterSearch) filterSearch.addEventListener('input', renderReports);
  if (filterSort) filterSort.addEventListener('change', renderReports);
  if (btnClearFilters) btnClearFilters.addEventListener('click', handleClearFilters);

  // Notice form
  if (noticeForm) {
    noticeForm.addEventListener('submit', handleNoticeSubmit);
  }
}

/* ═══════════════════════════════════════════════════════════
   DOM Ready
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setInitialTimeNoticed();
  setupResetButton();
  bindEventListeners();
  renderAll();
});
