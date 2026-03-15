// ── Activity Logger ──────────────────────────────────────────────────────────
// Lightweight localStorage-based activity log for the admin panel.
// Writes to a separate key ('st-activity-log') so it doesn't affect app state.

import type { ActivityLogEntry, ActivityCategory } from '../types';

const STORAGE_KEY = 'st-activity-log';
const MAX_ENTRIES = 500;

// ── Action Constants ────────────────────────────────────────────────────────

export const ACTIONS = {
  ADD_ENTRY: 'add_entry',
  UPDATE_ENTRY: 'update_entry',
  DELETE_ENTRY: 'delete_entry',
  CHECK_IN: 'check_in',
  LOG_TRIGGER: 'log_trigger',
  LOG_MEDICATION: 'log_medication',
  ADD_NOTE: 'add_note',
  CREATE_PATIENT: 'create_patient',
  DELETE_PATIENT: 'delete_patient',
  ADD_CONDITION: 'add_condition',
  ADD_MED_SCHEDULE: 'add_med_schedule',
  UPDATE_MED_SCHEDULE: 'update_med_schedule',
  DELETE_MED_SCHEDULE: 'delete_med_schedule',
  GENERATE_INSIGHTS: 'generate_insights',
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
} as const;

// ── Internal Helpers ────────────────────────────────────────────────────────

function loadLog(): ActivityLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLog(entries: ActivityLogEntry[]): void {
  // Keep only the most recent MAX_ENTRIES
  const trimmed = entries.slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function generateId(): string {
  return `al-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Append an activity log entry */
export function logActivity(
  action: string,
  label: string,
  category: ActivityCategory,
  metadata?: Record<string, string>,
): void {
  const entry: ActivityLogEntry = {
    id: generateId(),
    action,
    label,
    category,
    timestamp: Date.now(),
    metadata,
  };
  const log = loadLog();
  log.unshift(entry); // newest first
  saveLog(log);
}

/** Get activity log entries sorted newest-first */
export function getActivityLog(limit = 100, offset = 0): ActivityLogEntry[] {
  const log = loadLog();
  return log.slice(offset, offset + limit);
}

/** Get total count of activity log entries */
export function getActivityLogCount(): number {
  return loadLog().length;
}

/** Clear all activity log entries */
export function clearActivityLog(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Get aggregated stats for the admin dashboard */
export function getActivityStats(): {
  byCategory: Record<ActivityCategory, number>;
  byDay: Array<{ date: string; count: number }>;
  total: number;
} {
  const log = loadLog();

  // Count by category
  const byCategory: Record<ActivityCategory, number> = {
    tracking: 0,
    medication: 0,
    checkin: 0,
    trigger: 0,
    note: 0,
    patient: 0,
    settings: 0,
    system: 0,
  };
  for (const entry of log) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  }

  // Count by day (last 30 days)
  const dayCounts: Record<string, number> = {};
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const entry of log) {
    if (entry.timestamp >= thirtyDaysAgo) {
      const date = new Date(entry.timestamp).toISOString().slice(0, 10);
      dayCounts[date] = (dayCounts[date] ?? 0) + 1;
    }
  }
  const byDay = Object.entries(dayCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { byCategory, byDay, total: log.length };
}
