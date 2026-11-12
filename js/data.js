// js/data.js
// Global constants, area definitions, and sample data for the Water Outage Reporting Board.

'use strict';

// 8 recognized municipal areas
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

// Issue type mappings for display
const ISSUE_TYPES = {
  'no-water': 'No Water',
  'low-pressure': 'Low Pressure',
  'dirty-water': 'Dirty Water',
  'pipe-burst': 'Pipe Burst'
};

// Status labels
const STATUSES = {
  'reported': 'Reported',
  'verified': 'Verified',
  'in-progress': 'In Progress',
  'resolved': 'Resolved',
  'stale': 'Stale'
};

// Allowed state transitions based on the status model
const ALLOWED_TRANSITIONS = {
  'reported': ['verified', 'in-progress', 'stale'],
  'verified': ['in-progress'],
  'in-progress': ['resolved', 'stale'],
  'resolved': ['reported'],
  'stale': ['reported', 'in-progress']
};

// Helper timestamp offsets to ensure dynamic timestamps when testing offline
const nowMs = Date.now();
const ONE_HOUR = 60 * 60 * 1000;

// 8 realistic sample reports meeting all assignment constraints:
// - All 5 statuses represented (reported, verified, in-progress, resolved, stale)
// - Both confirmed (verified: true) and unverified (verified: false)
// - One pair of near-duplicate reports in the same area within 2 hours (rep-002 and rep-003)
// - One stale report older than 24 hours (rep-006)
// - Multiple reports with reportCount > 1 (rep-001, rep-004, rep-005, rep-007)
// - Data provenance source field ('resident', 'neighbor', or 'utility staff')
const SAMPLE_REPORTS = [
  {
    id: 'rep-001',
    area: 'Block A',
    issueType: 'no-water',
    description: 'Complete water outage across streets 4 through 8 since early this morning.',
    contact: '03001234567',
    status: 'verified',
    verified: true,
    createdAt: new Date(nowMs - 7 * ONE_HOUR).toISOString(),
    updatedAt: new Date(nowMs - 2 * ONE_HOUR).toISOString(),
    timeNoticed: new Date(nowMs - 8 * ONE_HOUR).toISOString().slice(0, 16),
    mergedInto: null,
    source: 'resident',
    reportCount: 5
  },
  {
    id: 'rep-002',
    area: 'Block B',
    issueType: 'low-pressure',
    description: 'Very weak water flow on 2nd floor apartments. Pumps cannot fill overhead tanks.',
    contact: '03217654321',
    status: 'reported',
    verified: false,
    createdAt: new Date(nowMs - 1.5 * ONE_HOUR).toISOString(),
    updatedAt: new Date(nowMs - 1.5 * ONE_HOUR).toISOString(),
    timeNoticed: new Date(nowMs - 2 * ONE_HOUR).toISOString().slice(0, 16),
    mergedInto: null,
    source: 'resident',
    reportCount: 1
  },
  {
    // Near-duplicate of rep-002: same area (Block B), same issueType (low-pressure), within 2 hours
    id: 'rep-003',
    area: 'Block B',
    issueType: 'low-pressure',
    description: 'Low water pressure noticed in commercial block next to main boulevard.',
    contact: '',
    status: 'reported',
    verified: false,
    createdAt: new Date(nowMs - 0.7 * ONE_HOUR).toISOString(),
    updatedAt: new Date(nowMs - 0.7 * ONE_HOUR).toISOString(),
    timeNoticed: new Date(nowMs - 1 * ONE_HOUR).toISOString().slice(0, 16),
    mergedInto: null,
    source: 'neighbor',
    reportCount: 1
  },
  {
    id: 'rep-004',
    area: 'Old Town',
    issueType: 'dirty-water',
    description: 'Brown muddy tap water coming out since yesterday evening. Odor is also present.',
    contact: '03459876543',
    status: 'in-progress',
    verified: true,
    createdAt: new Date(nowMs - 18 * ONE_HOUR).toISOString(),
    updatedAt: new Date(nowMs - 4 * ONE_HOUR).toISOString(),
    timeNoticed: new Date(nowMs - 20 * ONE_HOUR).toISOString().slice(0, 16),
    mergedInto: null,
    source: 'resident',
    reportCount: 3
  },
  {
    id: 'rep-005',
    area: 'Green Park',
    issueType: 'pipe-burst',
    description: 'Underground feeder pipe cracked near community park. Water gushing onto pavement.',
    contact: '',
    status: 'resolved',
    verified: true,
    createdAt: new Date(nowMs - 42 * ONE_HOUR).toISOString(),
    updatedAt: new Date(nowMs - 5 * ONE_HOUR).toISOString(),
    timeNoticed: new Date(nowMs - 43 * ONE_HOUR).toISOString().slice(0, 16),
    mergedInto: null,
    source: 'utility staff',
    reportCount: 6
  },
  {
    // Stale report: not updated for more than 24 hours (30 hours ago) and not resolved
    id: 'rep-006',
    area: 'Station Colony',
    issueType: 'no-water',
    description: 'Supply cut off without prior warning near railway colony quarters.',
    contact: '03124567890',
    status: 'stale',
    verified: false,
    createdAt: new Date(nowMs - 32 * ONE_HOUR).toISOString(),
    updatedAt: new Date(nowMs - 30 * ONE_HOUR).toISOString(),
    timeNoticed: new Date(nowMs - 33 * ONE_HOUR).toISOString().slice(0, 16),
    mergedInto: null,
    source: 'resident',
    reportCount: 1
  },
  {
    id: 'rep-007',
    area: 'Market Road',
    issueType: 'pipe-burst',
    description: 'Broken water conduit leaking into side alley. Valve isolation required.',
    contact: '',
    status: 'in-progress',
    verified: true,
    createdAt: new Date(nowMs - 12 * ONE_HOUR).toISOString(),
    updatedAt: new Date(nowMs - 3 * ONE_HOUR).toISOString(),
    timeNoticed: new Date(nowMs - 13 * ONE_HOUR).toISOString().slice(0, 16),
    mergedInto: null,
    source: 'utility staff',
    reportCount: 2
  },
  {
    id: 'rep-008',
    area: 'University Road',
    issueType: 'low-pressure',
    description: 'Fluctuating low water pressure during peak morning hours near student hostel.',
    contact: '03335557799',
    status: 'reported',
    verified: false,
    createdAt: new Date(nowMs - 3 * ONE_HOUR).toISOString(),
    updatedAt: new Date(nowMs - 3 * ONE_HOUR).toISOString(),
    timeNoticed: new Date(nowMs - 4 * ONE_HOUR).toISOString().slice(0, 16),
    mergedInto: null,
    source: 'neighbor',
    reportCount: 1
  }
];

// 3 realistic sample notices with timestamps
const SAMPLE_NOTICES = [
  {
    id: 'not-001',
    title: 'Green Park Pipe Burst Fixed',
    message: 'Maintenance crews replaced the damaged 8-inch main line in Green Park. Normal pressure restored.',
    timestamp: new Date(nowMs - 5 * ONE_HOUR).toISOString()
  },
  {
    id: 'not-002',
    title: 'Line Flushing in Old Town Sector 3',
    message: 'Turbidity investigation underway. Crews are flushing fire hydrants; do not consume tap water unboiled.',
    timestamp: new Date(nowMs - 4 * ONE_HOUR).toISOString()
  },
  {
    id: 'not-003',
    title: 'Booster Pump Assessment in Block B',
    message: 'Multiple low-pressure complaints received for Block B. Technical inspectors deployed.',
    timestamp: new Date(nowMs - 40 * 60 * 1000).toISOString()
  }
];

// Expose constants to window or global scope for explicit access
const globalScope = typeof window !== 'undefined' ? window : globalThis;
globalScope.AREAS = AREAS;
globalScope.ISSUE_TYPES = ISSUE_TYPES;
globalScope.STATUSES = STATUSES;
globalScope.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
globalScope.SAMPLE_REPORTS = SAMPLE_REPORTS;
globalScope.SAMPLE_NOTICES = SAMPLE_NOTICES;
