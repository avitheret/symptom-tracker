import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type {
  AIInsight, Condition, DailyCheckIn, ExtractionResult, ExtractionStatus,
  ExtractedCheckIn, ExtractedMedication, ExtractedSupplement, ExtractedSymptom, ExtractedTrigger,
  FoodLog, MedicationLog, MedicationSchedule, NotificationPreferences, Note,
  Patient, PatientCondition, SupplementDatabaseEntry, Symptom,
  SupplementLog, SupplementSchedule,
  TrackingEntry, TriggerLog, View,
} from '../types';
import { SUPPLEMENT_TIME_WINDOWS } from '../types';
import { CLOUD_ENABLED, supabase } from '../lib/supabase';
import { computeDoseTimes } from '../utils/notifications';
import { logActivity, ACTIONS } from '../utils/activityLogger';
import { PREDEFINED_CONDITIONS } from '../data/medicalData';
import { generateSampleData, generateSampleTriggerLogs, generateSampleCheckIns, generateSampleMedicationLogs, generateTodayDemoEntries, DEMO_INJECT_KEY } from '../data/sampleData';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAYS[new Date(y, m - 1, d).getDay()];
}

// ── State ──────────────────────────────────────────────────────────────────
interface State {
  patients: Patient[];
  activePatientId: string | null;
  entries: TrackingEntry[];
  triggerLogs: TriggerLog[];
  checkIns: DailyCheckIn[];
  medicationLogs: MedicationLog[];
  foodLogs: FoodLog[];
  notes: Note[];
  aiInsights: AIInsight[];
  medicationSchedules: MedicationSchedule[];
  supplementLogs: SupplementLog[];
  supplementSchedules: SupplementSchedule[];
  supplementDatabase: SupplementDatabaseEntry[];
  notificationPrefs: NotificationPreferences;
  selectedConditionId: string | null;
  view: View;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: false,
  reminderWindowMinutes: 2,
  soundEnabled: true,
};

const initialState: State = {
  patients: [],
  activePatientId: null,
  entries: [],
  triggerLogs: [],
  checkIns: [],
  medicationLogs: [],
  foodLogs: [],
  notes: [],
  aiInsights: [],
  medicationSchedules: [],
  supplementLogs: [],
  supplementSchedules: [],
  supplementDatabase: [],
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  selectedConditionId: null,
  view: 'dashboard',
};

// ── Actions ────────────────────────────────────────────────────────────────
type Action =
  | { type: 'CREATE_PATIENT'; patient: Patient }
  | { type: 'UPDATE_PATIENT'; id: string; patch: Partial<Pick<Patient, 'name' | 'dateOfBirth' | 'notes' | 'diagnosis'>> }
  | { type: 'DELETE_PATIENT'; id: string }
  | { type: 'SET_ACTIVE_PATIENT'; id: string }
  | { type: 'ADD_CONDITION_TO_PATIENT'; patientId: string; conditionId: string }
  | { type: 'REMOVE_CONDITION_FROM_PATIENT'; patientId: string; conditionId: string }
  | { type: 'ADD_CUSTOM_CONDITION'; patientId: string; condition: Condition }
  | { type: 'ADD_SYMPTOM_TO_PATIENT'; patientId: string; conditionId: string; symptom: Symptom }
  | { type: 'ADD_ENTRY'; entry: Omit<TrackingEntry, 'id' | 'dayOfWeek' | 'createdAt'> }
  | { type: 'BULK_ADD_ENTRIES'; entries: TrackingEntry[] }
  | { type: 'DELETE_ENTRY'; id: string }
  | { type: 'UPDATE_ENTRY'; id: string; patch: Partial<Omit<TrackingEntry, 'id' | 'patientId' | 'createdAt'>> }
  | { type: 'ADD_TRIGGER_LOG'; log: Omit<TriggerLog, 'id' | 'dayOfWeek' | 'createdAt'> }
  | { type: 'BULK_ADD_TRIGGER_LOGS'; logs: TriggerLog[] }
  | { type: 'DELETE_TRIGGER_LOG'; id: string }
  | { type: 'ADD_CHECKIN'; checkIn: Omit<DailyCheckIn, 'id' | 'dayOfWeek' | 'createdAt'> }
  | { type: 'UPDATE_CHECKIN'; id: string; patch: Partial<Omit<DailyCheckIn, 'id' | 'patientId' | 'createdAt'>> }
  | { type: 'BULK_ADD_CHECKINS'; checkIns: DailyCheckIn[] }
  | { type: 'ADD_MEDICATION_LOG'; log: Omit<MedicationLog, 'id' | 'dayOfWeek' | 'createdAt'> }
  | { type: 'DELETE_MEDICATION_LOG'; id: string }
  | { type: 'BULK_ADD_MEDICATION_LOGS'; logs: MedicationLog[] }
  | { type: 'ADD_FOOD_LOG'; log: Omit<FoodLog, 'id' | 'dayOfWeek' | 'createdAt'> }
  | { type: 'UPDATE_FOOD_LOG'; id: string; updates: Partial<Omit<FoodLog, 'id' | 'patientId'>> }
  | { type: 'DELETE_FOOD_LOG'; id: string }
  | { type: 'ADD_NOTE'; note: Note }
  | { type: 'UPDATE_NOTE'; id: string; text: string; updatedAt: number }
  | { type: 'DELETE_NOTE'; id: string }
  | { type: 'UPDATE_NOTE_EXTRACTION'; id: string; patch: Partial<Pick<Note, 'extractionStatus' | 'extractedAt' | 'linkedLogIds'>> }
  | { type: 'SET_AI_INSIGHTS'; insights: AIInsight[] }
  | { type: 'DISMISS_AI_INSIGHT'; id: string }
  | { type: 'ADD_MED_SCHEDULE'; schedule: MedicationSchedule }
  | { type: 'UPDATE_MED_SCHEDULE'; id: string; patch: Partial<Omit<MedicationSchedule, 'id' | 'patientId' | 'createdAt'>> }
  | { type: 'DELETE_MED_SCHEDULE'; id: string }
  | { type: 'ADD_SUPPLEMENT_LOG'; log: Omit<SupplementLog, 'id' | 'dayOfWeek' | 'createdAt'> }
  | { type: 'BULK_ADD_SUPPLEMENT_LOGS'; logs: SupplementLog[] }
  | { type: 'DELETE_SUPPLEMENT_LOG'; id: string }
  | { type: 'ADD_SUPPLEMENT_SCHEDULE'; schedule: SupplementSchedule }
  | { type: 'UPDATE_SUPPLEMENT_SCHEDULE'; id: string; patch: Partial<Omit<SupplementSchedule, 'id' | 'patientId' | 'createdAt'>> }
  | { type: 'DELETE_SUPPLEMENT_SCHEDULE'; id: string }
  | { type: 'SET_SUPPLEMENT_DATABASE'; entries: SupplementDatabaseEntry[] }
  | { type: 'DELETE_SUPPLEMENT_DATABASE_ENTRY'; id: string }
  | { type: 'SET_NOTIFICATION_PREFS'; prefs: Partial<NotificationPreferences> }
  | { type: 'SELECT_CONDITION'; id: string | null }
  | { type: 'SET_VIEW'; view: View }
  | { type: 'LOAD'; state: State };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD':
      return action.state;

    case 'CREATE_PATIENT': {
      const isFirstPatient = state.patients.length === 0;
      return {
        ...state,
        patients: [...state.patients, action.patient],
        activePatientId: isFirstPatient ? action.patient.id : state.activePatientId,
      };
    }

    case 'UPDATE_PATIENT':
      return {
        ...state,
        patients: state.patients.map(p =>
          p.id === action.id ? { ...p, ...action.patch } : p
        ),
      };

    case 'DELETE_PATIENT': {
      const remaining = state.patients.filter(p => p.id !== action.id);
      const newActive = remaining.find(p => p.isDefault)?.id ?? remaining[0]?.id ?? null;
      return {
        ...state,
        patients: remaining,
        activePatientId: state.activePatientId === action.id ? newActive : state.activePatientId,
        entries: state.entries.filter(e => e.patientId !== action.id),
        triggerLogs: state.triggerLogs.filter(t => t.patientId !== action.id),
        checkIns: state.checkIns.filter(c => c.patientId !== action.id),
        medicationLogs: state.medicationLogs.filter(m => m.patientId !== action.id),
        foodLogs: state.foodLogs.filter(l => l.patientId !== action.id),
        medicationSchedules: state.medicationSchedules.filter(s => s.patientId !== action.id),
        supplementLogs: (state.supplementLogs ?? []).filter(l => l.patientId !== action.id),
        supplementSchedules: (state.supplementSchedules ?? []).filter(s => s.patientId !== action.id),
        supplementDatabase: (state.supplementDatabase ?? []).filter(e => e.patientId !== action.id),
      };
    }

    case 'SET_ACTIVE_PATIENT':
      return { ...state, activePatientId: action.id };

    case 'ADD_CONDITION_TO_PATIENT': {
      const already = state.patients
        .find(p => p.id === action.patientId)
        ?.conditions.some(c => c.conditionId === action.conditionId);
      if (already) return state;
      const newPc: PatientCondition = {
        conditionId: action.conditionId,
        customSymptoms: [],
        addedAt: Date.now(),
      };
      return {
        ...state,
        patients: state.patients.map(p =>
          p.id === action.patientId
            ? { ...p, conditions: [...p.conditions, newPc] }
            : p
        ),
      };
    }

    case 'REMOVE_CONDITION_FROM_PATIENT':
      return {
        ...state,
        patients: state.patients.map(p =>
          p.id === action.patientId
            ? { ...p, conditions: p.conditions.filter(c => c.conditionId !== action.conditionId) }
            : p
        ),
      };

    case 'ADD_CUSTOM_CONDITION':
      return {
        ...state,
        patients: state.patients.map(p =>
          p.id === action.patientId
            ? { ...p, customConditions: [...p.customConditions, action.condition] }
            : p
        ),
      };

    case 'ADD_SYMPTOM_TO_PATIENT': {
      const { patientId, conditionId, symptom } = action;
      return {
        ...state,
        patients: state.patients.map(p => {
          if (p.id !== patientId) return p;

          // Check if it's a predefined condition
          if (p.conditions.some(c => c.conditionId === conditionId)) {
            return {
              ...p,
              conditions: p.conditions.map(c =>
                c.conditionId === conditionId
                  ? { ...c, customSymptoms: [...c.customSymptoms, symptom] }
                  : c
              ),
            };
          }

          // Must be a custom condition
          return {
            ...p,
            customConditions: p.customConditions.map(cc =>
              cc.id === conditionId
                ? { ...cc, symptoms: [...cc.symptoms, symptom] }
                : cc
            ),
          };
        }),
      };
    }

    case 'ADD_ENTRY': {
      const entry: TrackingEntry = {
        ...action.entry,
        id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dayOfWeek: getDayOfWeek(action.entry.date),
        createdAt: Date.now(),
      };
      return { ...state, entries: [...state.entries, entry] };
    }

    case 'BULK_ADD_ENTRIES':
      return { ...state, entries: [...state.entries, ...action.entries] };

    case 'DELETE_ENTRY':
      return { ...state, entries: state.entries.filter(e => e.id !== action.id) };

    case 'UPDATE_ENTRY':
      return {
        ...state,
        entries: state.entries.map(e =>
          e.id === action.id
            ? {
                ...e,
                ...action.patch,
                dayOfWeek: action.patch.date ? getDayOfWeek(action.patch.date) : e.dayOfWeek,
              }
            : e
        ),
      };

    case 'ADD_TRIGGER_LOG': {
      const log: TriggerLog = {
        ...action.log,
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dayOfWeek: getDayOfWeek(action.log.date),
        createdAt: Date.now(),
      };
      return { ...state, triggerLogs: [...state.triggerLogs, log] };
    }

    case 'BULK_ADD_TRIGGER_LOGS':
      return { ...state, triggerLogs: [...state.triggerLogs, ...action.logs] };

    case 'DELETE_TRIGGER_LOG':
      return { ...state, triggerLogs: state.triggerLogs.filter(t => t.id !== action.id) };

    case 'ADD_CHECKIN': {
      const checkIn: DailyCheckIn = {
        ...action.checkIn,
        id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dayOfWeek: getDayOfWeek(action.checkIn.date),
        createdAt: Date.now(),
      };
      // One check-in per day per patient — replace existing if same date
      const filtered = state.checkIns.filter(
        c => !(c.patientId === checkIn.patientId && c.date === checkIn.date)
      );
      return { ...state, checkIns: [...filtered, checkIn] };
    }

    case 'UPDATE_CHECKIN':
      return {
        ...state,
        checkIns: state.checkIns.map(c =>
          c.id === action.id
            ? { ...c, ...action.patch, dayOfWeek: action.patch.date ? getDayOfWeek(action.patch.date) : c.dayOfWeek }
            : c
        ),
      };

    case 'BULK_ADD_CHECKINS':
      return { ...state, checkIns: [...state.checkIns, ...action.checkIns] };

    case 'ADD_MEDICATION_LOG': {
      const log: MedicationLog = {
        ...action.log,
        id: `ml-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dayOfWeek: getDayOfWeek(action.log.date),
        createdAt: Date.now(),
      };
      return { ...state, medicationLogs: [...state.medicationLogs, log] };
    }

    case 'DELETE_MEDICATION_LOG':
      return { ...state, medicationLogs: state.medicationLogs.filter(m => m.id !== action.id) };

    case 'BULK_ADD_MEDICATION_LOGS':
      return { ...state, medicationLogs: [...state.medicationLogs, ...action.logs] };

    case 'ADD_FOOD_LOG': {
      const log: FoodLog = {
        ...action.log,
        id: `fl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dayOfWeek: getDayOfWeek(action.log.date),
        createdAt: Date.now(),
      };
      return { ...state, foodLogs: [...state.foodLogs, log] };
    }

    case 'UPDATE_FOOD_LOG':
      return {
        ...state,
        foodLogs: state.foodLogs.map(l =>
          l.id === action.id
            ? {
                ...l,
                ...action.updates,
                dayOfWeek: action.updates.date ? getDayOfWeek(action.updates.date) : l.dayOfWeek,
              }
            : l
        ),
      };

    case 'DELETE_FOOD_LOG':
      return { ...state, foodLogs: state.foodLogs.filter(l => l.id !== action.id) };

    case 'ADD_NOTE':
      return { ...state, notes: [...state.notes, action.note] };

    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === action.id ? { ...n, text: action.text, updatedAt: action.updatedAt } : n
        ),
      };

    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.id) };

    case 'UPDATE_NOTE_EXTRACTION':
      return {
        ...state,
        notes: state.notes.map(n =>
          n.id === action.id ? { ...n, ...action.patch } : n
        ),
      };

    case 'SET_AI_INSIGHTS':
      return { ...state, aiInsights: action.insights };

    case 'DISMISS_AI_INSIGHT':
      return {
        ...state,
        aiInsights: state.aiInsights.map(i =>
          i.id === action.id ? { ...i, dismissed: true } : i
        ),
      };

    case 'ADD_MED_SCHEDULE':
      return { ...state, medicationSchedules: [...state.medicationSchedules, action.schedule] };

    case 'UPDATE_MED_SCHEDULE':
      return {
        ...state,
        medicationSchedules: state.medicationSchedules.map(s =>
          s.id === action.id ? { ...s, ...action.patch, updatedAt: Date.now() } : s
        ),
      };

    case 'DELETE_MED_SCHEDULE':
      return { ...state, medicationSchedules: state.medicationSchedules.filter(s => s.id !== action.id) };

    case 'ADD_SUPPLEMENT_LOG': {
      const log: SupplementLog = {
        ...action.log,
        id: `sl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dayOfWeek: getDayOfWeek(action.log.date),
        createdAt: Date.now(),
      };
      return { ...state, supplementLogs: [...(state.supplementLogs ?? []), log] };
    }

    case 'BULK_ADD_SUPPLEMENT_LOGS':
      return { ...state, supplementLogs: [...(state.supplementLogs ?? []), ...action.logs] };

    case 'DELETE_SUPPLEMENT_LOG':
      return { ...state, supplementLogs: (state.supplementLogs ?? []).filter(l => l.id !== action.id) };

    case 'ADD_SUPPLEMENT_SCHEDULE':
      return { ...state, supplementSchedules: [...(state.supplementSchedules ?? []), action.schedule] };

    case 'UPDATE_SUPPLEMENT_SCHEDULE':
      return {
        ...state,
        supplementSchedules: (state.supplementSchedules ?? []).map(s =>
          s.id === action.id ? { ...s, ...action.patch, updatedAt: Date.now() } : s
        ),
      };

    case 'DELETE_SUPPLEMENT_SCHEDULE':
      return { ...state, supplementSchedules: (state.supplementSchedules ?? []).filter(s => s.id !== action.id) };

    case 'SET_SUPPLEMENT_DATABASE':
      return { ...state, supplementDatabase: action.entries };

    case 'DELETE_SUPPLEMENT_DATABASE_ENTRY':
      return { ...state, supplementDatabase: state.supplementDatabase.filter(e => e.id !== action.id) };

    case 'SET_NOTIFICATION_PREFS':
      return { ...state, notificationPrefs: { ...state.notificationPrefs, ...action.prefs } };

    case 'SELECT_CONDITION':
      return { ...state, selectedConditionId: action.id };

    case 'SET_VIEW':
      return { ...state, view: action.view };

    default:
      return state;
  }
}

// ── Storage & Initialization ───────────────────────────────────────────────
const V1_KEY = 'symptom-tracker-v1';
const STORAGE_KEY = 'symptom-tracker-v2';

function migrateV1ToV2(): State | null {
  try {
    const raw = localStorage.getItem(V1_KEY);
    if (!raw) return null;

    const v1 = JSON.parse(raw) as {
      conditions?: Array<{ id: string; name: string; color: string; symptoms: Array<{ id: string; name: string; conditionId: string }> }>;
      entries?: Array<Record<string, unknown>>;
      selectedConditionId?: string | null;
    };

    const patientId = `pat-${Date.now()}`;
    const predefinedIds = new Set(PREDEFINED_CONDITIONS.map(c => c.id));
    const patientConditions: PatientCondition[] = [];
    const customConditions: Condition[] = [];

    for (const c of (v1.conditions ?? [])) {
      if (predefinedIds.has(c.id)) {
        const predefined = PREDEFINED_CONDITIONS.find(p => p.id === c.id)!;
        const predefinedSymIds = new Set(predefined.symptoms.map(s => s.id));
        const customSymptoms = c.symptoms.filter(s => !predefinedSymIds.has(s.id));
        patientConditions.push({ conditionId: c.id, customSymptoms, addedAt: Date.now() });
      } else {
        customConditions.push(c as Condition);
      }
    }

    const defaultPatient: Patient = {
      id: patientId,
      userId: null,
      name: 'Me',
      isDefault: true,
      conditions: patientConditions,
      customConditions,
      createdAt: Date.now(),
    };

    const entries: TrackingEntry[] = (v1.entries ?? []).map(e => ({
      ...(e as Omit<TrackingEntry, 'patientId'>),
      patientId,
    }));

    return {
      patients: [defaultPatient],
      activePatientId: patientId,
      entries,
      triggerLogs: [],
      checkIns: [],
      medicationLogs: [],
      foodLogs: [],
      notes: [],
      aiInsights: [],
      medicationSchedules: [],
      supplementLogs: [],
      supplementSchedules: [],
      supplementDatabase: [],
      notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      selectedConditionId: (v1.selectedConditionId as string | null) ?? null,
      view: 'dashboard',
    };
  } catch {
    return null;
  }
}

function loadInitialState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      if ((saved.patients?.length ?? 0) > 0) {
        return {
          patients: saved.patients ?? [],
          activePatientId: saved.activePatientId ?? null,
          entries: saved.entries ?? [],
          triggerLogs: saved.triggerLogs ?? [],
          checkIns: saved.checkIns ?? [],
          medicationLogs: saved.medicationLogs ?? [],
          foodLogs: saved.foodLogs ?? [],
          notes: saved.notes ?? [],
          aiInsights: saved.aiInsights ?? [],
          medicationSchedules: saved.medicationSchedules ?? [],
          supplementLogs: saved.supplementLogs ?? [],
          supplementSchedules: saved.supplementSchedules ?? [],
          supplementDatabase: saved.supplementDatabase ?? [],
          notificationPrefs: saved.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS,
          selectedConditionId: saved.selectedConditionId ?? null,
          view: 'dashboard',
        };
      }
    }

    // Try migrating from v1
    const migrated = migrateV1ToV2();
    if (migrated) {
      localStorage.removeItem(V1_KEY);
      return migrated;
    }

    // Brand new session — create a default anonymous patient
    const defaultPatient: Patient = {
      id: `pat-${Date.now()}`,
      userId: null,
      name: 'Me',
      isDefault: true,
      conditions: [],
      customConditions: [],
      createdAt: Date.now(),
    };
    return {
      ...initialState,
      patients: [defaultPatient],
      activePatientId: defaultPatient.id,
    };
  } catch {
    return initialState;
  }
}

// ── Context ────────────────────────────────────────────────────────────────
interface ContextValue {
  state: State;
  createPatient: (name: string, conditionIds: string[], extra?: { dateOfBirth?: string; notes?: string; diagnosis?: string }) => void;
  updatePatient: (id: string, patch: Partial<Pick<Patient, 'name' | 'dateOfBirth' | 'notes' | 'diagnosis'>>) => void;
  deletePatient: (id: string) => void;
  setActivePatient: (id: string) => void;
  addConditionToPatient: (patientId: string, conditionId: string) => void;
  removeConditionFromPatient: (patientId: string, conditionId: string) => void;
  addCustomCondition: (patientId: string, name: string, color: string) => void;
  addSymptom: (conditionId: string, name: string) => void;
  addEntry: (entry: Omit<TrackingEntry, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => void;
  deleteEntry: (id: string) => void;
  updateEntry: (id: string, patch: Partial<Omit<TrackingEntry, 'id' | 'patientId' | 'createdAt'>>) => void;
  approveEntry: (id: string) => void;
  disapproveEntry: (id: string) => void;
  addTriggerLog: (log: Omit<TriggerLog, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => void;
  deleteTriggerLog: (id: string) => void;
  addCheckIn: (checkIn: Omit<DailyCheckIn, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => void;
  updateCheckIn: (id: string, patch: Partial<Omit<DailyCheckIn, 'id' | 'patientId' | 'createdAt'>>) => void;
  getTodayCheckIn: () => DailyCheckIn | undefined;
  addMedicationLog: (log: Omit<MedicationLog, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => void;
  deleteMedicationLog: (id: string) => void;
  addFoodLog: (log: Omit<FoodLog, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => void;
  updateFoodLog: (id: string, updates: Partial<Omit<FoodLog, 'id' | 'patientId'>>) => void;
  deleteFoodLog: (id: string) => void;
  addNote: (text: string, sourceType: Note['sourceType']) => string | undefined;
  updateNote: (id: string, text: string) => void;
  deleteNote: (id: string) => void;
  updateNoteExtraction: (id: string, patch: Partial<Pick<Note, 'extractionStatus' | 'extractedAt' | 'linkedLogIds'>>) => void;
  confirmNoteExtraction: (result: ExtractionResult) => void;
  setAIInsights: (insights: AIInsight[]) => void;
  dismissAIInsight: (id: string) => void;
  addMedSchedule: (input: Omit<MedicationSchedule, 'id' | 'patientId' | 'createdAt' | 'updatedAt' | 'doseTimes'>) => void;
  updateMedSchedule: (id: string, patch: Partial<Omit<MedicationSchedule, 'id' | 'patientId' | 'createdAt'>>) => void;
  deleteMedSchedule: (id: string) => void;
  addSupplementLog: (log: Omit<SupplementLog, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => void;
  deleteSupplementLog: (id: string) => void;
  addSupplementSchedule: (input: Omit<SupplementSchedule, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>) => void;
  updateSupplementSchedule: (id: string, patch: Partial<Omit<SupplementSchedule, 'id' | 'patientId' | 'createdAt'>>) => void;
  deleteSupplementSchedule: (id: string) => void;
  loadSupplementDatabase: (patientId: string) => Promise<void>;
  setSupplementDatabase: (entries: SupplementDatabaseEntry[]) => void;
  deleteSupplementDatabaseEntry: (id: string) => Promise<void>;
  setNotificationPrefs: (prefs: Partial<NotificationPreferences>) => void;
  selectCondition: (id: string | null) => void;
  setView: (view: View) => void;
  getActivePatient: () => Patient | undefined;
  getPatientConditions: (patientId: string) => Condition[];
  loadSampleData: () => void;
  injectTodayDemoEntries: () => void;
  syncWithCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;
}

const AppContext = createContext<ContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Initialize synchronously from localStorage to avoid race with the persist effect
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  // Persist to localStorage whenever relevant state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        patients: state.patients,
        activePatientId: state.activePatientId,
        entries: state.entries,
        triggerLogs: state.triggerLogs,
        checkIns: state.checkIns,
        medicationLogs: state.medicationLogs,
        foodLogs: state.foodLogs,
        notes: state.notes,
        aiInsights: state.aiInsights,
        medicationSchedules: state.medicationSchedules,
        supplementLogs: state.supplementLogs,
        supplementSchedules: state.supplementSchedules,
        supplementDatabase: state.supplementDatabase,
        notificationPrefs: state.notificationPrefs,
        selectedConditionId: state.selectedConditionId,
      }));
    } catch {
      // ignore quota errors
    }
  }, [state.patients, state.activePatientId, state.entries, state.triggerLogs, state.checkIns, state.medicationLogs, state.foodLogs, state.notes, state.aiInsights, state.medicationSchedules, state.supplementLogs, state.supplementSchedules, state.supplementDatabase, state.notificationPrefs, state.selectedConditionId]);

  const createPatient = useCallback((name: string, conditionIds: string[], extra?: { dateOfBirth?: string; notes?: string; diagnosis?: string }) => {
    const id = `pat-${Date.now()}`;
    const isFirst = state.patients.length === 0;
    const patient: Patient = {
      id,
      userId: null,
      name: name.trim() || 'Me',
      dateOfBirth: extra?.dateOfBirth || undefined,
      notes: extra?.notes || undefined,
      diagnosis: extra?.diagnosis || undefined,
      isDefault: isFirst,
      conditions: conditionIds.map(conditionId => ({
        conditionId,
        customSymptoms: [],
        addedAt: Date.now(),
      })),
      customConditions: [],
      createdAt: Date.now(),
    };
    dispatch({ type: 'CREATE_PATIENT', patient });
    logActivity(ACTIONS.CREATE_PATIENT, `Created patient "${patient.name}"`, 'patient');
  }, [state.patients.length]);

  const updatePatient = useCallback((
    id: string,
    patch: Partial<Pick<Patient, 'name' | 'dateOfBirth' | 'notes' | 'diagnosis'>>
  ) => {
    dispatch({ type: 'UPDATE_PATIENT', id, patch });
  }, []);

  const deletePatient = useCallback((id: string) => {
    dispatch({ type: 'DELETE_PATIENT', id });
    logActivity(ACTIONS.DELETE_PATIENT, 'Deleted patient', 'patient');
  }, []);

  const setActivePatient = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_PATIENT', id });
  }, []);

  const addConditionToPatient = useCallback((patientId: string, conditionId: string) => {
    dispatch({ type: 'ADD_CONDITION_TO_PATIENT', patientId, conditionId });
  }, []);

  const removeConditionFromPatient = useCallback((patientId: string, conditionId: string) => {
    dispatch({ type: 'REMOVE_CONDITION_FROM_PATIENT', patientId, conditionId });
  }, []);

  const addCustomCondition = useCallback((patientId: string, name: string, color: string) => {
    const condition: Condition = {
      id: `custom-${Date.now()}`,
      name,
      color,
      symptoms: [],
    };
    dispatch({ type: 'ADD_CUSTOM_CONDITION', patientId, condition });
  }, []);

  const addSymptom = useCallback((conditionId: string, name: string) => {
    const patientId = state.activePatientId;
    if (!patientId) return;
    const symptom: Symptom = {
      id: `sym-${Date.now()}`,
      name,
      conditionId,
    };
    dispatch({ type: 'ADD_SYMPTOM_TO_PATIENT', patientId, conditionId, symptom });
  }, [state.activePatientId]);

  const addEntry = useCallback(
    (entry: Omit<TrackingEntry, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => {
      const patientId = state.activePatientId;
      if (!patientId) return;
      dispatch({ type: 'ADD_ENTRY', entry: { ...entry, patientId } });
      logActivity(ACTIONS.ADD_ENTRY, `Logged ${entry.symptomName} → ${entry.conditionName} (${entry.severity}/10)`, 'tracking');
    },
    [state.activePatientId]
  );

  const deleteEntry = useCallback((id: string) => {
    dispatch({ type: 'DELETE_ENTRY', id });
    logActivity(ACTIONS.DELETE_ENTRY, 'Deleted symptom entry', 'tracking');
  }, []);

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<TrackingEntry, 'id' | 'patientId' | 'createdAt'>>) => {
      dispatch({ type: 'UPDATE_ENTRY', id, patch });
      logActivity(ACTIONS.UPDATE_ENTRY, 'Updated symptom entry', 'tracking');
    }, []
  );

  const approveEntry = useCallback((id: string) => {
    dispatch({ type: 'UPDATE_ENTRY', id, patch: { reviewStatus: 'approved' } });
  }, []);

  const disapproveEntry = useCallback((id: string) => {
    dispatch({ type: 'UPDATE_ENTRY', id, patch: { reviewStatus: 'disapproved' } });
  }, []);

  const setAIInsights = useCallback((insights: AIInsight[]) => {
    dispatch({ type: 'SET_AI_INSIGHTS', insights });
  }, []);

  const dismissAIInsight = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_AI_INSIGHT', id });
  }, []);

  const addMedSchedule = useCallback(
    (input: Omit<MedicationSchedule, 'id' | 'patientId' | 'createdAt' | 'updatedAt' | 'doseTimes'>) => {
      const patientId = state.activePatientId;
      if (!patientId) return;
      const doseTimes = computeDoseTimes(input.firstDoseTime, input.intervalHours, input.frequency);
      const schedule: MedicationSchedule = {
        ...input,
        id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        patientId,
        doseTimes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      dispatch({ type: 'ADD_MED_SCHEDULE', schedule });
      logActivity(ACTIONS.ADD_MED_SCHEDULE, `Scheduled ${input.name} ${input.dosage}`, 'medication');
    },
    [state.activePatientId]
  );

  const updateMedSchedule = useCallback((id: string, patch: Partial<Omit<MedicationSchedule, 'id' | 'patientId' | 'createdAt'>>) => {
    // If frequency/interval/firstDoseTime changes, recompute doseTimes
    const existing = state.medicationSchedules.find(s => s.id === id);
    if (existing && (patch.frequency !== undefined || patch.intervalHours !== undefined || patch.firstDoseTime !== undefined)) {
      const freq = patch.frequency ?? existing.frequency;
      const interval = patch.intervalHours ?? existing.intervalHours;
      const firstDose = patch.firstDoseTime ?? existing.firstDoseTime;
      patch = { ...patch, doseTimes: computeDoseTimes(firstDose, interval, freq) };
    }
    dispatch({ type: 'UPDATE_MED_SCHEDULE', id, patch });
    logActivity(ACTIONS.UPDATE_MED_SCHEDULE, 'Updated medication schedule', 'medication');
  }, [state.medicationSchedules]);

  const deleteMedSchedule = useCallback((id: string) => {
    dispatch({ type: 'DELETE_MED_SCHEDULE', id });
    logActivity(ACTIONS.DELETE_MED_SCHEDULE, 'Deleted medication schedule', 'medication');
  }, []);

  const setNotificationPrefs = useCallback((prefs: Partial<NotificationPreferences>) => {
    dispatch({ type: 'SET_NOTIFICATION_PREFS', prefs });
  }, []);

  const addTriggerLog = useCallback(
    (log: Omit<TriggerLog, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => {
      const patientId = state.activePatientId;
      if (!patientId) return;
      dispatch({ type: 'ADD_TRIGGER_LOG', log: { ...log, patientId } });
      logActivity(ACTIONS.LOG_TRIGGER, `Logged triggers: ${log.triggers.join(', ')}`, 'trigger');
    },
    [state.activePatientId]
  );

  const deleteTriggerLog = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TRIGGER_LOG', id });
  }, []);

  const addCheckIn = useCallback(
    (checkIn: Omit<DailyCheckIn, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => {
      const patientId = state.activePatientId;
      if (!patientId) return;
      dispatch({ type: 'ADD_CHECKIN', checkIn: { ...checkIn, patientId } });
      logActivity(ACTIONS.CHECK_IN, `Check-in: health ${checkIn.healthScore}/10`, 'checkin');
    },
    [state.activePatientId]
  );

  const updateCheckIn = useCallback((id: string, patch: Partial<Omit<DailyCheckIn, 'id' | 'patientId' | 'createdAt'>>) => {
    dispatch({ type: 'UPDATE_CHECKIN', id, patch });
  }, []);

  const getTodayCheckIn = useCallback((): DailyCheckIn | undefined => {
    const today = new Date().toISOString().slice(0, 10);
    return state.checkIns.find(
      c => c.patientId === state.activePatientId && c.date === today
    );
  }, [state.checkIns, state.activePatientId]);

  const addMedicationLog = useCallback(
    (log: Omit<MedicationLog, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => {
      const patientId = state.activePatientId;
      if (!patientId) return;
      dispatch({ type: 'ADD_MEDICATION_LOG', log: { ...log, patientId } });
      logActivity(ACTIONS.LOG_MEDICATION, `Logged ${log.name}${log.dosage ? ' ' + log.dosage : ''}`, 'medication');
    },
    [state.activePatientId]
  );

  const deleteMedicationLog = useCallback((id: string) => {
    dispatch({ type: 'DELETE_MEDICATION_LOG', id });
  }, []);

  const addFoodLog = useCallback((log: Omit<FoodLog, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => {
    const patientId = state.activePatientId;
    if (!patientId) return;
    dispatch({ type: 'ADD_FOOD_LOG', log: { ...log, patientId } });
  }, [state.activePatientId]);

  const updateFoodLog = useCallback((id: string, updates: Partial<Omit<FoodLog, 'id' | 'patientId'>>) => {
    dispatch({ type: 'UPDATE_FOOD_LOG', id, updates });
  }, []);

  const deleteFoodLog = useCallback((id: string) => {
    dispatch({ type: 'DELETE_FOOD_LOG', id });
  }, []);

  const addNote = useCallback((text: string, sourceType: Note['sourceType']): string | undefined => {
    const patientId = state.activePatientId;
    if (!patientId) return undefined;
    const note: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      patientId,
      text: text.trim(),
      createdAt: Date.now(),
      sourceType,
    };
    dispatch({ type: 'ADD_NOTE', note });
    logActivity(ACTIONS.ADD_NOTE, `Added ${sourceType} note`, 'note');
    return note.id;
  }, [state.activePatientId]);

  const updateNote = useCallback((id: string, text: string) => {
    dispatch({ type: 'UPDATE_NOTE', id, text: text.trim(), updatedAt: Date.now() });
  }, []);

  const deleteNote = useCallback((id: string) => {
    dispatch({ type: 'DELETE_NOTE', id });
  }, []);

  const updateNoteExtraction = useCallback((
    id: string,
    patch: Partial<Pick<Note, 'extractionStatus' | 'extractedAt' | 'linkedLogIds'>>,
  ) => {
    dispatch({ type: 'UPDATE_NOTE_EXTRACTION', id, patch });
  }, []);

  const confirmNoteExtraction = useCallback((result: ExtractionResult) => {
    const patientId = state.activePatientId;
    if (!patientId) return;

    const { noteId, timestamp, items } = result;
    const linkedLogIds: string[] = [];
    const now = Date.now();
    const uid = () => Math.random().toString(36).slice(2, 7);

    // ── Symptom entries ──────────────────────────────────────────────────────
    const symptomEntries: TrackingEntry[] = [];
    for (const item of items) {
      if (item.type !== 'symptom') continue;
      const s = item as ExtractedSymptom;
      const id = `e-${now}-${uid()}`;
      linkedLogIds.push(id);
      symptomEntries.push({
        id,
        patientId,
        conditionId: s.conditionId,
        conditionName: s.conditionName,
        symptomId: s.symptomId,
        symptomName: s.symptomName,
        date: timestamp.date,
        dayOfWeek: getDayOfWeek(timestamp.date),
        time: timestamp.time,
        severity: s.severity,
        notes: '',
        createdAt: now,
        sourceNoteId: noteId,
        extractedFromNote: true,
        inferredTimestamp: timestamp.inferred,
      });
    }
    if (symptomEntries.length > 0) {
      dispatch({ type: 'BULK_ADD_ENTRIES', entries: symptomEntries });
    }

    // ── Trigger logs ─────────────────────────────────────────────────────────
    const triggerItems = items.filter(i => i.type === 'trigger') as ExtractedTrigger[];
    if (triggerItems.length > 0) {
      const id = `tl-${now}-${uid()}`;
      linkedLogIds.push(id);
      const logs: TriggerLog[] = [{
        id,
        patientId,
        date: timestamp.date,
        dayOfWeek: getDayOfWeek(timestamp.date),
        time: timestamp.time,
        triggers: triggerItems.map(t => t.triggerName),
        notes: '',
        createdAt: now,
        sourceNoteId: noteId,
        extractedFromNote: true,
        inferredTimestamp: timestamp.inferred,
      }];
      dispatch({ type: 'BULK_ADD_TRIGGER_LOGS', logs });
    }

    // ── Medication logs ──────────────────────────────────────────────────────
    const medItems = items.filter(i => i.type === 'medication') as ExtractedMedication[];
    if (medItems.length > 0) {
      const medLogs: MedicationLog[] = medItems.map(m => {
        const id = `ml-${now}-${uid()}`;
        linkedLogIds.push(id);
        return {
          id,
          patientId,
          name: m.name,
          type: 'medication' as const,
          dosage: m.dosage || undefined,
          date: timestamp.date,
          dayOfWeek: getDayOfWeek(timestamp.date),
          time: timestamp.time,
          effectiveness: 'no_effect' as const,
          notes: '',
          createdAt: now,
          sourceNoteId: noteId,
          extractedFromNote: true,
          inferredTimestamp: timestamp.inferred,
        };
      });
      dispatch({ type: 'BULK_ADD_MEDICATION_LOGS', logs: medLogs });
    }

    // ── Check-in ─────────────────────────────────────────────────────────────
    const checkInItem = items.find(i => i.type === 'checkin') as ExtractedCheckIn | undefined;
    if (checkInItem) {
      const id = `ci-${now}-${uid()}`;
      linkedLogIds.push(id);
      dispatch({
        type: 'ADD_CHECKIN',
        checkIn: {
          patientId,
          date: timestamp.date,
          time: timestamp.time,
          healthScore: checkInItem.healthScore ?? 5,
          stress: checkInItem.stress ?? 'medium',
          sleepHours: checkInItem.sleepHours ?? 7,
          energy: checkInItem.energy ?? 5,
          mood: checkInItem.mood ?? 5,
          notes: '',
        },
      });
    }

    // ── Supplement logs ────────────────────────────────────────────────────────
    const supplementItems = items.filter(
      (i): i is ExtractedSupplement => i.type === 'supplement'
    );
    if (supplementItems.length > 0) {
      const supplementLogEntries: SupplementLog[] = supplementItems.map(s => {
        const id = `sl-${now}-${uid()}`;
        linkedLogIds.push(id);
        const time = s.timeWindow
          ? SUPPLEMENT_TIME_WINDOWS[s.timeWindow].start
          : timestamp.time;
        return {
          id,
          patientId,
          name: s.name,
          date: timestamp.date,
          dayOfWeek: getDayOfWeek(timestamp.date),
          time,
          notes: '',
          createdAt: now,
          sourceNoteId: noteId,
          extractedFromNote: true,
        };
      });
      dispatch({ type: 'BULK_ADD_SUPPLEMENT_LOGS', logs: supplementLogEntries });
    }

    // ── Update note status ───────────────────────────────────────────────────
    dispatch({
      type: 'UPDATE_NOTE_EXTRACTION',
      id: noteId,
      patch: {
        extractionStatus: 'confirmed' as ExtractionStatus,
        extractedAt: now,
        linkedLogIds,
      },
    });
  }, [state.activePatientId]);

  const selectCondition = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_CONDITION', id });
  }, []);

  const setView = useCallback((view: View) => {
    dispatch({ type: 'SET_VIEW', view });
  }, []);

  const getActivePatient = useCallback((): Patient | undefined => {
    return state.patients.find(p => p.id === state.activePatientId);
  }, [state.patients, state.activePatientId]);

  const getPatientConditions = useCallback((patientId: string): Condition[] => {
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) return [];

    const result: Condition[] = [];

    // Merge predefined conditions with patient's custom symptoms
    for (const pc of patient.conditions) {
      const predefined = PREDEFINED_CONDITIONS.find(c => c.id === pc.conditionId);
      if (predefined) {
        result.push({
          ...predefined,
          symptoms: [...predefined.symptoms, ...pc.customSymptoms],
        });
      }
    }

    // Add fully custom conditions
    result.push(...patient.customConditions);

    return result;
  }, [state.patients]);

  const loadSampleData = useCallback(() => {
    const patientId = state.activePatientId;
    if (!patientId) return;
    for (const conditionId of ['migraine', 'anxiety', 'arthritis', 'ibs', 'diabetes']) {
      dispatch({ type: 'ADD_CONDITION_TO_PATIENT', patientId, conditionId });
    }
    dispatch({ type: 'BULK_ADD_ENTRIES', entries: generateSampleData(patientId) });
    dispatch({ type: 'BULK_ADD_TRIGGER_LOGS', logs: generateSampleTriggerLogs(patientId) });
    dispatch({ type: 'BULK_ADD_CHECKINS', checkIns: generateSampleCheckIns(patientId) });
    dispatch({ type: 'BULK_ADD_MEDICATION_LOGS', logs: generateSampleMedicationLogs(patientId) });
  }, [state.activePatientId]);

  const injectTodayDemoEntries = useCallback(() => {
    const patientId = state.activePatientId;
    if (!patientId) return;
    const today = new Date().toISOString().slice(0, 10);
    const entries = generateTodayDemoEntries(patientId);
    dispatch({ type: 'BULK_ADD_ENTRIES', entries });
    localStorage.setItem(DEMO_INJECT_KEY, today);
  }, [state.activePatientId]);

  const addSupplementLog = useCallback(
    (log: Omit<SupplementLog, 'id' | 'dayOfWeek' | 'createdAt' | 'patientId'>) => {
      const patientId = state.activePatientId;
      if (!patientId) return;
      dispatch({ type: 'ADD_SUPPLEMENT_LOG', log: { ...log, patientId } });
    },
    [state.activePatientId]
  );

  const deleteSupplementLog = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SUPPLEMENT_LOG', id });
  }, []);

  const addSupplementSchedule = useCallback(
    (input: Omit<SupplementSchedule, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>) => {
      const patientId = state.activePatientId;
      if (!patientId) return;
      const schedule: SupplementSchedule = {
        ...input,
        id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        patientId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      dispatch({ type: 'ADD_SUPPLEMENT_SCHEDULE', schedule });
    },
    [state.activePatientId]
  );

  const updateSupplementSchedule = useCallback((id: string, patch: Partial<Omit<SupplementSchedule, 'id' | 'patientId' | 'createdAt'>>) => {
    dispatch({ type: 'UPDATE_SUPPLEMENT_SCHEDULE', id, patch });
  }, []);

  const deleteSupplementSchedule = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SUPPLEMENT_SCHEDULE', id });
  }, []);

  const loadSupplementDatabase = useCallback(async (patientId: string) => {
    if (!CLOUD_ENABLED || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('supplement_database')
        .select('id, patient_id, name, time_window, quantity, description')
        .eq('patient_id', patientId);
      if (error) { console.error('loadSupplementDatabase:', error); return; }
      const entries: SupplementDatabaseEntry[] = (data ?? []).map(r => ({
        id: r.id,
        patientId: r.patient_id,
        name: r.name,
        timeWindow: r.time_window,
        quantity: r.quantity,
        description: r.description,
      }));
      dispatch({ type: 'SET_SUPPLEMENT_DATABASE', entries });
    } catch (err) {
      console.error('loadSupplementDatabase:', err);
    }
  }, []);

  const setSupplementDatabase = useCallback((entries: SupplementDatabaseEntry[]) => {
    dispatch({ type: 'SET_SUPPLEMENT_DATABASE', entries });
  }, []);

  const deleteSupplementDatabaseEntry = useCallback(async (id: string) => {
    if (CLOUD_ENABLED && supabase) {
      try {
        await supabase.from('supplement_database').delete().eq('id', id);
      } catch (err) {
        console.error('deleteSupplementDatabaseEntry:', err);
      }
    }
    dispatch({ type: 'DELETE_SUPPLEMENT_DATABASE_ENTRY', id });
  }, []);

  const syncWithCloud = useCallback(async () => {
    await new Promise(r => setTimeout(r, 800));
  }, []);

  const loadFromCloud = useCallback(async () => {
    await new Promise(r => setTimeout(r, 800));
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        createPatient,
        updatePatient,
        deletePatient,
        setActivePatient,
        addConditionToPatient,
        removeConditionFromPatient,
        addCustomCondition,
        addSymptom,
        addEntry,
        deleteEntry,
        updateEntry,
        approveEntry,
        disapproveEntry,
        addTriggerLog,
        deleteTriggerLog,
        addCheckIn,
        updateCheckIn,
        getTodayCheckIn,
        addMedicationLog,
        deleteMedicationLog,
        addFoodLog,
        updateFoodLog,
        deleteFoodLog,
        addNote,
        updateNote,
        deleteNote,
        updateNoteExtraction,
        confirmNoteExtraction,
        setAIInsights,
        dismissAIInsight,
        addMedSchedule,
        updateMedSchedule,
        deleteMedSchedule,
        addSupplementLog,
        deleteSupplementLog,
        addSupplementSchedule,
        updateSupplementSchedule,
        deleteSupplementSchedule,
        loadSupplementDatabase,
        setSupplementDatabase,
        deleteSupplementDatabaseEntry,
        setNotificationPrefs,
        selectCondition,
        setView,
        getActivePatient,
        getPatientConditions,
        loadSampleData,
        injectTodayDemoEntries,
        syncWithCloud,
        loadFromCloud,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
