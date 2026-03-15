// ── Content Manager ──────────────────────────────────────────────────────────
// Simple i18n-like system for admin-editable UI text.
// Reads overrides from localStorage, falls back to defaults.

const STORAGE_KEY = 'st-content-overrides';

// ── Default Content Map ─────────────────────────────────────────────────────

export const DEFAULT_CONTENT: Record<string, string> = {
  // Navigation
  'nav.home': 'Home',
  'nav.track': 'Track',
  'nav.reports': 'Reports',
  'nav.insights': 'Insights',
  'nav.notes': 'Notes',
  'nav.patients': 'Patients',
  'nav.dashboard': 'Dashboard',
  'nav.conditions': 'Conditions',

  // Header buttons
  'btn.checkIn': 'Check In',
  'btn.triggers': 'Triggers',
  'btn.meds': 'Meds',
  'btn.logSymptom': 'Log Symptom',
  'btn.exportCsv': 'Export CSV',
  'btn.addCondition': 'Add Condition',
  'btn.signIn': 'Sign In',

  // Section headers
  'section.myConditions': 'My Conditions',
  'section.recentLog': 'Recent Log',
  'section.quickLog': 'Quick Log',
  'section.medSchedule': 'Meds Schedule',
  'section.healthForecast': 'Health Forecast',
  'section.dailyCheckin': 'Daily Check-in',
  'section.voiceReview': 'Pending Review',

  // Empty states
  'empty.noLogs': 'No symptoms logged yet',
  'empty.noMeds': 'No medications logged yet',
  'empty.noNotes': 'No notes yet',
  'empty.noConditions': 'No conditions added yet',

  // App identity
  'app.name': 'SymptomTrack',
  'app.tagline': 'Track your symptoms and spot patterns',
  'app.greeting.morning': 'Good morning!',
  'app.greeting.afternoon': 'Good afternoon!',
  'app.greeting.evening': 'Good evening!',
};

// ── Content Key Groups (for admin UI) ───────────────────────────────────────

export interface ContentGroup {
  label: string;
  keys: string[];
}

export const CONTENT_GROUPS: ContentGroup[] = [
  {
    label: 'Navigation',
    keys: ['nav.home', 'nav.track', 'nav.reports', 'nav.insights', 'nav.notes', 'nav.patients', 'nav.dashboard', 'nav.conditions'],
  },
  {
    label: 'Buttons',
    keys: ['btn.checkIn', 'btn.triggers', 'btn.meds', 'btn.logSymptom', 'btn.exportCsv', 'btn.addCondition', 'btn.signIn'],
  },
  {
    label: 'Section Headers',
    keys: ['section.myConditions', 'section.recentLog', 'section.quickLog', 'section.medSchedule', 'section.healthForecast', 'section.dailyCheckin', 'section.voiceReview'],
  },
  {
    label: 'Empty States',
    keys: ['empty.noLogs', 'empty.noMeds', 'empty.noNotes', 'empty.noConditions'],
  },
  {
    label: 'App Identity',
    keys: ['app.name', 'app.tagline', 'app.greeting.morning', 'app.greeting.afternoon', 'app.greeting.evening'],
  },
];

// ── Internal Helpers ────────────────────────────────────────────────────────

let _cache: Record<string, string> | null = null;

function loadOverrides(): Record<string, string> {
  if (_cache) return _cache;
  try {
    _cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return _cache!;
  } catch {
    _cache = {};
    return {};
  }
}

function saveOverrides(overrides: Record<string, string>): void {
  _cache = overrides;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Get translated text for a key. Returns override if set, else default. */
export function t(key: string): string {
  const overrides = loadOverrides();
  return overrides[key] ?? DEFAULT_CONTENT[key] ?? key;
}

/** Set a custom text override for a key */
export function setContentOverride(key: string, value: string): void {
  const overrides = loadOverrides();
  overrides[key] = value;
  saveOverrides({ ...overrides });
}

/** Remove a single content override (reverts to default) */
export function resetContentOverride(key: string): void {
  const overrides = loadOverrides();
  delete overrides[key];
  saveOverrides({ ...overrides });
}

/** Clear all content overrides */
export function resetAllContentOverrides(): void {
  _cache = null;
  localStorage.removeItem(STORAGE_KEY);
}

/** Get all current overrides */
export function getContentOverrides(): Record<string, string> {
  return { ...loadOverrides() };
}

/** Check if a key has been overridden */
export function isOverridden(key: string): boolean {
  return key in loadOverrides();
}

/** Invalidate the in-memory cache (call after import/reset) */
export function invalidateContentCache(): void {
  _cache = null;
}
