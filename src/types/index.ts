export interface Symptom {
  id: string;
  name: string;
  conditionId: string;
}

export interface Condition {
  id: string;
  name: string;
  color: string;
  symptoms: Symptom[];
}

export interface PatientCondition {
  conditionId: string;       // references a PREDEFINED_CONDITIONS id
  customSymptoms: Symptom[]; // user-added symptoms beyond the predefined set
  addedAt: number;
}

export interface Patient {
  id: string;
  userId: string | null;         // null = local/anonymous
  name: string;
  dateOfBirth?: string;
  notes?: string;
  diagnosis?: string;            // free-text medical background, e.g. "Pancreatic cancer stage 4"
  isDefault: boolean;            // the primary patient (created at signup or first run)
  conditions: PatientCondition[]; // references to predefined conditions
  customConditions: Condition[];  // fully custom conditions (not from predefined list)
  createdAt: number;
}

export interface TrackingEntry {
  id: string;
  patientId: string;          // scopes entry to a patient
  conditionId: string;
  conditionName: string;
  symptomId: string;
  symptomName: string;
  date: string;               // YYYY-MM-DD
  dayOfWeek: string;          // e.g. "Monday"
  time: string;               // HH:MM (24h)
  severity: number;           // 1–10
  notes: string;
  triggers?: string[];        // optional trigger names linked to this episode
  createdAt: number;          // timestamp for sorting
  sourceNoteId?: string;
  extractedFromNote?: boolean;
  inferredTimestamp?: boolean;
  // ── Voice review workflow ──
  reviewStatus?: ReviewStatus;       // undefined = approved (backward compat)
  sourceType?: EntrySourceType;       // undefined = manual
  sourceTranscript?: string;          // raw voice transcript that created this entry
}

export type ReviewStatus = 'approved' | 'to_review' | 'disapproved';
export type EntrySourceType = 'manual' | 'voice' | 'note_extraction';

// ── Trigger Tracking ────────────────────────────────────────────────────────

export const PREDEFINED_TRIGGERS = [
  'Food/Diet', 'Stress', 'Poor sleep', 'Weather change',
  'Exercise', 'Alcohol', 'Caffeine', 'Screen time', 'Hormonal',
] as const;

export type PredefinedTrigger = typeof PREDEFINED_TRIGGERS[number];

export interface TriggerLog {
  id: string;
  patientId: string;
  date: string;               // YYYY-MM-DD
  dayOfWeek: string;
  time: string;               // HH:MM
  triggers: string[];         // list of trigger names (predefined or custom)
  conditionId?: string;
  conditionName?: string;
  notes: string;
  createdAt: number;
  sourceNoteId?: string;
  extractedFromNote?: boolean;
  inferredTimestamp?: boolean;
}

// ── Daily Check-In ──────────────────────────────────────────────────────────

export interface DailyCheckIn {
  id: string;
  patientId: string;
  date: string;               // YYYY-MM-DD (one per day per patient)
  dayOfWeek: string;
  time: string;               // HH:MM
  healthScore: number;        // 1–10
  stress: 'low' | 'medium' | 'high';
  sleepHours: number;         // 0–12
  energy: number;             // 1–10
  mood: number;               // 1–10
  notes: string;
  createdAt: number;
}

// ── Dashboard Widgets ───────────────────────────────────────────────────────

export type WidgetId = 'stats' | 'forecast' | 'checkin' | 'voiceReview' | 'quickActions' | 'conditions' | 'recentLog' | 'medSchedule';

export const WIDGET_DEFS: Record<WidgetId, { label: string; description: string }> = {
  stats:        { label: 'Summary Stats',    description: 'Total entries, weekly count, average severity' },
  forecast:     { label: 'Health Forecast',  description: "Tomorrow's predicted symptom activity" },
  checkin:      { label: 'Daily Check-In',   description: "Today's wellness check-in status" },
  voiceReview:  { label: 'Voice Review',     description: 'Pending voice-logged entries awaiting review' },
  quickActions: { label: 'Quick Log',        description: 'Fast symptom logging by condition' },
  conditions:   { label: 'My Conditions',    description: 'Grid of all tracked conditions' },
  recentLog:    { label: 'Recent Entries',   description: 'Last 5 logged symptoms' },
  medSchedule:  { label: 'Meds Schedule',   description: 'Upcoming medication doses & reminders' },
};

export const DEFAULT_WIDGETS: WidgetId[] = ['stats', 'forecast', 'checkin', 'voiceReview', 'quickActions', 'conditions', 'recentLog', 'medSchedule'];

// ── Existing analytics types ─────────────────────────────────────────────────

export const ONBOARDING_CONDITION_LIMIT = 1;

export type View = 'dashboard' | 'conditions' | 'reports' | 'insights' | 'patients' | 'notes' | 'admin';

// ── Notes ─────────────────────────────────────────────────────────────────────

export type ExtractionStatus = 'none' | 'pending' | 'confirmed' | 'skipped';

export interface Note {
  id: string;
  patientId: string;
  text: string;
  createdAt: number;
  updatedAt?: number;
  sourceType: 'typed' | 'voice';
  extractionStatus?: ExtractionStatus;
  extractedAt?: number;
  linkedLogIds?: string[];
}

// ── Note Extraction ──────────────────────────────────────────────────────────

export interface ExtractedSymptom {
  type: 'symptom';
  id: string;
  symptomId: string;
  symptomName: string;
  conditionId: string;
  conditionName: string;
  severity: number;
  inferredSeverity: boolean;
  matchedText: string;
}

export interface ExtractedMedication {
  type: 'medication';
  id: string;
  name: string;
  dosage: string;
  matchedText: string;
}

export interface ExtractedTrigger {
  type: 'trigger';
  id: string;
  triggerName: string;
  matchedText: string;
}

export interface ExtractedCheckIn {
  type: 'checkin';
  id: string;
  stress?: 'low' | 'medium' | 'high';
  sleepHours?: number;
  energy?: number;
  mood?: number;
  healthScore?: number;
  matchedFields: string[];
}

export type ExtractedItem = ExtractedSymptom | ExtractedMedication | ExtractedTrigger | ExtractedCheckIn;

export interface ExtractionTimestamp {
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM
  inferred: boolean;
}

export interface ExtractionResult {
  noteId: string;
  noteText: string;
  extractedAt: number;
  timestamp: ExtractionTimestamp;
  items: ExtractedItem[];
  hasItems: boolean;
}

export type Confidence = 'low' | 'medium' | 'high';

export interface PatternInsight {
  id: string;
  type: 'time-of-day' | 'day-of-week' | 'trend' | 'co-occurrence' | 'trigger' | 'checkin';
  title: string;
  description: string;
  confidence: Confidence;
  dateRange: { from: string; to: string };
  supportingCount: number;
}

export interface SymptomCluster {
  id: string;
  clusterName: string;
  symptoms: Array<{ symptomId: string; symptomName: string; conditionName: string }>;
  occurrenceCount: number;
  dateRange: { from: string; to: string };
  avgSeverity: number;
}

export interface TrendResult {
  direction: 'improving' | 'worsening' | 'stable';
  percentChange: number;
  windowDays: number;
}

export interface ForecastResult {
  prediction: string;
  confidence: Confidence;
  basis: Array<'day-of-week' | 'recent-trend' | 'cluster-density' | 'poor-sleep' | 'high-stress' | 'recent-triggers'>;
  disclaimer: string;
}

// ── Medication & Treatment Tracking ─────────────────────────────────────────

export type EffectivenessRating = 'no_effect' | 'slight' | 'moderate' | 'major';

export const EFFECTIVENESS_LABELS: Record<EffectivenessRating, string> = {
  no_effect: 'No effect',
  slight: 'Slight relief',
  moderate: 'Moderate relief',
  major: 'Major relief',
};

export const MEDICATION_ROUTES = ['Oral', 'Topical', 'Injection', 'Inhaled', 'Sublingual', 'Other'] as const;
export type MedicationRoute = typeof MEDICATION_ROUTES[number];

export interface MedicationLog {
  id: string;
  patientId: string;
  name: string;
  type: 'medication' | 'treatment';
  dosage?: string;
  route?: string;
  date: string;               // YYYY-MM-DD
  dayOfWeek: string;
  time: string;               // HH:MM
  conditionId?: string;
  conditionName?: string;
  effectiveness: EffectivenessRating;
  notes: string;
  createdAt: number;
  sourceNoteId?: string;
  extractedFromNote?: boolean;
  inferredTimestamp?: boolean;
}

// ── Medication Schedule ──────────────────────────────────────────────────────

export interface MedicationSchedule {
  id: string;
  patientId: string;
  name: string;                    // "Naproxen"
  dosage: string;                  // "1000mg"
  route?: string;                  // reuse MEDICATION_ROUTES
  frequency: number;               // doses per day (e.g. 2)
  intervalHours: number;           // hours between doses (e.g. 12)
  firstDoseTime: string;           // "08:00" (24h)
  doseTimes: string[];             // computed: ["08:00", "20:00"]
  status: 'active' | 'paused';
  conditionId?: string;
  conditionName?: string;
  notes?: string;
  notificationsEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationPreferences {
  enabled: boolean;                // master toggle
  reminderWindowMinutes: number;   // +/- window for triggering (default 2)
  soundEnabled: boolean;
}

// ── Activity Log (Admin Panel) ────────────────────────────────────────────────

export type ActivityCategory = 'tracking' | 'medication' | 'checkin' | 'trigger' | 'note' | 'patient' | 'settings' | 'system';

export interface ActivityLogEntry {
  id: string;
  action: string;
  label: string;
  category: ActivityCategory;
  timestamp: number;
  metadata?: Record<string, string>;
}

// ── Contributing Factors (Causal Analysis) ───────────────────────────────────

export interface ContributingFactor {
  factor: string;
  weight: number;             // 0–100 percentage
  description: string;
  dataPoints: number;
}

export interface ContributingFactorsResult {
  conditionId?: string;
  conditionName?: string;
  factors: ContributingFactor[];
  dateRange: { from: string; to: string };
  totalEntries: number;
  confidence: Confidence;
  disclaimer: string;
}

// ── AI Insights ──────────────────────────────────────────────────────────────

