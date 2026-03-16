import type { DailyCheckIn, MedicationLog, TrackingEntry, TriggerLog } from '../types';
import type { EffectivenessRating } from '../types';
import { daysAgoStr } from '../utils/analytics';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayOfWeek(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAYS[new Date(y, m - 1, d).getDay()];
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function padTime(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Mirrors medicalData.ts symptom ID convention: `${conditionId}-s${index+1}`
const SAMPLE_POOLS: Array<{
  conditionId: string;
  conditionName: string;
  color: string;
  symptoms: Array<{ id: string; name: string }>;
}> = [
  {
    conditionId: 'migraine',
    conditionName: 'Migraine',
    color: '#6366f1',
    symptoms: [
      { id: 'migraine-s1', name: 'Throbbing headache' },
      { id: 'migraine-s2', name: 'Nausea' },
      { id: 'migraine-s3', name: 'Light sensitivity' },
      { id: 'migraine-s4', name: 'Sound sensitivity' },
    ],
  },
  {
    conditionId: 'anxiety',
    conditionName: 'Anxiety',
    color: '#8b5cf6',
    symptoms: [
      { id: 'anxiety-s1', name: 'Excessive worry' },
      { id: 'anxiety-s3', name: 'Racing heart' },
      { id: 'anxiety-s4', name: 'Sweating' },
      { id: 'anxiety-s8', name: 'Sleep disturbance' },
    ],
  },
  {
    conditionId: 'arthritis',
    conditionName: 'Arthritis',
    color: '#ef4444',
    symptoms: [
      { id: 'arthritis-s1', name: 'Joint pain' },
      { id: 'arthritis-s2', name: 'Joint stiffness' },
      { id: 'arthritis-s5', name: 'Morning stiffness' },
      { id: 'arthritis-s7', name: 'Fatigue' },
    ],
  },
  {
    conditionId: 'ibs',
    conditionName: 'Irritable Bowel Syndrome (IBS)',
    color: '#f59e0b',
    symptoms: [
      { id: 'ibs-s1', name: 'Abdominal pain' },
      { id: 'ibs-s2', name: 'Bloating' },
      { id: 'ibs-s5', name: 'Cramping' },
      { id: 'ibs-s6', name: 'Gas' },
    ],
  },
  {
    conditionId: 'diabetes',
    conditionName: 'Diabetes',
    color: '#10b981',
    symptoms: [
      { id: 'diabetes-s1', name: 'Increased thirst' },
      { id: 'diabetes-s3', name: 'Fatigue' },
      { id: 'diabetes-s4', name: 'Blurred vision' },
      { id: 'diabetes-s6', name: 'Tingling hands/feet' },
    ],
  },
];

const SAMPLE_TRIGGERS = ['Stress', 'Poor sleep', 'Food/Diet', 'Weather change', 'Exercise', 'Caffeine', 'Alcohol'];
const STRESS_LEVELS: DailyCheckIn['stress'][] = ['low', 'medium', 'high'];
const MOODS = [3, 4, 5, 6, 7, 7, 8]; // skewed slightly positive

export function generateSampleTriggerLogs(patientId: string): TriggerLog[] {
  const logs: TriggerLog[] = [];
  let counter = 0;
  // ~30 trigger logs spread over last 60 days
  for (let i = 0; i < 30; i++) {
    const daysBack = rnd(0, 59);
    const date = daysAgoStr(daysBack);
    const count = rnd(1, 3);
    const shuffled = [...SAMPLE_TRIGGERS].sort(() => Math.random() - 0.5);
    const triggers = shuffled.slice(0, count);
    counter++;
    logs.push({
      id: `demo-tl-${counter}-${Math.random().toString(36).slice(2, 6)}`,
      patientId,
      date,
      dayOfWeek: dayOfWeek(date),
      time: padTime(rnd(6, 22), rnd(0, 59)),
      triggers,
      notes: '',
      createdAt: new Date(date).getTime() + rnd(0, 86400000),
    });
  }
  return logs;
}

export function generateSampleCheckIns(patientId: string): DailyCheckIn[] {
  const checkIns: DailyCheckIn[] = [];
  // One check-in every 1-2 days for last 45 days
  const usedDates = new Set<string>();
  let counter = 0;
  for (let i = 0; i < 45; i++) {
    if (Math.random() < 0.6) continue; // ~40% of days have a check-in
    const date = daysAgoStr(i);
    if (usedDates.has(date)) continue;
    usedDates.add(date);
    counter++;
    const stress = STRESS_LEVELS[rnd(0, 2)];
    const sleepHours = rnd(4, 9) + (Math.random() < 0.5 ? 0.5 : 0);
    const healthScore = stress === 'high' ? rnd(3, 6) : stress === 'medium' ? rnd(5, 8) : rnd(6, 9);
    checkIns.push({
      id: `demo-ci-${counter}-${Math.random().toString(36).slice(2, 6)}`,
      patientId,
      date,
      dayOfWeek: dayOfWeek(date),
      time: padTime(rnd(7, 10), rnd(0, 59)),
      healthScore,
      stress,
      sleepHours,
      energy: sleepHours >= 7 ? rnd(6, 9) : rnd(3, 6),
      mood: MOODS[rnd(0, MOODS.length - 1)],
      notes: '',
      createdAt: new Date(date).getTime() + rnd(0, 36000000),
    });
  }
  return checkIns;
}

const SAMPLE_MEDS: Array<{
  name: string;
  type: 'medication' | 'treatment';
  dosage?: string;
  route?: string;
  conditionId?: string;
  conditionName?: string;
}> = [
  { name: 'Ibuprofen', type: 'medication', dosage: '400mg', route: 'Oral', conditionId: 'migraine', conditionName: 'Migraine' },
  { name: 'Sumatriptan', type: 'medication', dosage: '50mg', route: 'Oral', conditionId: 'migraine', conditionName: 'Migraine' },
  { name: 'Paracetamol', type: 'medication', dosage: '1g', route: 'Oral' },
  { name: 'Sertraline', type: 'medication', dosage: '50mg', route: 'Oral', conditionId: 'anxiety', conditionName: 'Anxiety' },
  { name: 'Naproxen', type: 'medication', dosage: '500mg', route: 'Oral', conditionId: 'arthritis', conditionName: 'Arthritis' },
  { name: 'Diclofenac gel', type: 'medication', dosage: '1%', route: 'Topical', conditionId: 'arthritis', conditionName: 'Arthritis' },
  { name: 'Peppermint tea', type: 'treatment', conditionId: 'ibs', conditionName: 'Irritable Bowel Syndrome (IBS)' },
  { name: 'Heat pad', type: 'treatment', conditionId: 'arthritis', conditionName: 'Arthritis' },
  { name: 'Cold compress', type: 'treatment', conditionId: 'migraine', conditionName: 'Migraine' },
  { name: 'Deep breathing', type: 'treatment', conditionId: 'anxiety', conditionName: 'Anxiety' },
  { name: 'Stretching', type: 'treatment', conditionId: 'arthritis', conditionName: 'Arthritis' },
  { name: 'Metformin', type: 'medication', dosage: '500mg', route: 'Oral', conditionId: 'diabetes', conditionName: 'Diabetes' },
];

const EFFECTIVENESS_OPTIONS: EffectivenessRating[] = ['no_effect', 'slight', 'moderate', 'major'];

export function generateSampleMedicationLogs(patientId: string): MedicationLog[] {
  const logs: MedicationLog[] = [];
  let counter = 0;
  // ~28 logs spread over 90 days
  for (let i = 0; i < 28; i++) {
    const daysBack = rnd(0, 89);
    const date = daysAgoStr(daysBack);
    const med = SAMPLE_MEDS[rnd(0, SAMPLE_MEDS.length - 1)];
    // Bias effectiveness towards moderate/major
    const effBias: EffectivenessRating[] = ['slight', 'moderate', 'moderate', 'major', 'major', 'no_effect'];
    const effectiveness = effBias[rnd(0, effBias.length - 1)];
    counter++;
    logs.push({
      id: `demo-ml-${counter}-${Math.random().toString(36).slice(2, 6)}`,
      patientId,
      name: med.name,
      type: med.type,
      dosage: med.dosage,
      route: med.route,
      date,
      dayOfWeek: dayOfWeek(date),
      time: padTime(rnd(7, 22), rnd(0, 59)),
      conditionId: med.conditionId,
      conditionName: med.conditionName,
      effectiveness,
      notes: '',
      createdAt: new Date(date).getTime() + rnd(0, 86400000),
    });
  }
  // Sort newest first
  return logs.sort((a, b) => b.createdAt - a.createdAt);
}

void EFFECTIVENESS_OPTIONS; // suppress unused warning

export function generateSampleData(patientId: string): TrackingEntry[] {
  const entries: TrackingEntry[] = [];
  let counter = 0;

  /** Build a single TrackingEntry for the given pool/symptom-index/time */
  function make(
    pool:        (typeof SAMPLE_POOLS)[number],
    symptomIdx:  number,
    daysBack:    number,
    hour:        number,
    minute:      number,
    severity:    number,
  ): TrackingEntry {
    const date    = daysAgoStr(daysBack);
    const symptom = pool.symptoms[symptomIdx % pool.symptoms.length];
    counter++;
    return {
      id:            `demo-${counter}-${Math.random().toString(36).slice(2, 6)}`,
      patientId,
      conditionId:   pool.conditionId,
      conditionName: pool.conditionName,
      symptomId:     symptom.id,
      symptomName:   symptom.name,
      date,
      dayOfWeek:     dayOfWeek(date),
      time:          padTime(hour, minute),
      severity,
      notes:         '',
      createdAt:     new Date(`${date}T${padTime(hour, minute)}:00`).getTime(),
    };
  }

  const [migraine, anxiety, arthritis, ibs, diabetes] = SAMPLE_POOLS;

  // ── 1. Migraine evening clusters ──────────────────────────────────────────
  // Throbbing headache (0) + Nausea (1) + Light sensitivity (2) within ~75 min
  // → cluster fingerprint appears 10×, co-occurrence pair appears 10×
  for (const d of [3, 7, 11, 14, 18, 22, 27, 32, 40, 50]) {
    entries.push(make(migraine, 0, d, 18, rnd( 0, 15), rnd(7, 9)));  // headache
    entries.push(make(migraine, 1, d, 18, rnd(30, 50), rnd(6, 8)));  // nausea
    entries.push(make(migraine, 2, d, 19, rnd( 0, 15), rnd(6, 8)));  // light sensitivity
  }

  // ── 2. Anxiety morning clusters ───────────────────────────────────────────
  // Excessive worry (0) + Racing heart (1) within ~40 min every cluster day
  for (const d of [2, 6, 10, 16, 23, 31, 39, 48]) {
    entries.push(make(anxiety, 0, d, 8, rnd( 0, 20), rnd(5, 8)));  // worry
    entries.push(make(anxiety, 1, d, 8, rnd(25, 45), rnd(4, 7)));  // racing heart
  }

  // ── 3. Arthritis morning stiffness clusters ───────────────────────────────
  // Joint stiffness (1) + Morning stiffness (2) within ~40 min
  for (const d of [4, 9, 15, 21, 28, 36, 46]) {
    entries.push(make(arthritis, 1, d, 7, rnd( 0, 20), rnd(4, 7)));  // joint stiffness
    entries.push(make(arthritis, 2, d, 7, rnd(25, 45), rnd(3, 6)));  // morning stiffness
  }

  // ── 4. IBS afternoon clusters ─────────────────────────────────────────────
  // Abdominal pain (0) + Bloating (1) within ~45 min
  for (const d of [5, 12, 19, 26, 33, 42, 52]) {
    entries.push(make(ibs, 0, d, 13, rnd( 0, 20), rnd(4, 8)));  // abdominal pain
    entries.push(make(ibs, 1, d, 13, rnd(25, 50), rnd(3, 7)));  // bloating
  }

  // ── 5. Monday symptom spike ───────────────────────────────────────────────
  // Find the last 9 Mondays; add 4 evening entries each → ratio ≈ 2.1×
  const today = new Date();
  let mondayCount = 0;
  for (let i = 1; i <= 80 && mondayCount < 9; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d.getDay() !== 1) continue; // not Monday
    mondayCount++;
    entries.push(make(migraine,  0, i, 17, rnd( 0, 30), rnd(6, 9)));  // headache
    entries.push(make(anxiety,   0, i, 18, rnd( 0, 30), rnd(5, 8)));  // worry
    entries.push(make(arthritis, 0, i, 18, rnd(30, 59), rnd(4, 7)));  // joint pain
    entries.push(make(migraine,  3, i, 19, rnd( 0, 30), rnd(5, 8)));  // sound sensitivity
  }

  // ── 6. Random evening-biased scatter ─────────────────────────────────────
  // Fills out remaining conditions and variety; ~60 % of slots are evening
  const pools = [migraine, anxiety, arthritis, ibs, diabetes];
  for (let i = 0; i < 28; i++) {
    const pool       = pools[rnd(0, pools.length - 1)];
    const symptomIdx = rnd(0, pool.symptoms.length - 1);
    const daysBack   = rnd(0, 58);
    const rand       = Math.random();
    const hour       = rand < 0.60 ? rnd(17, 20)   // Evening 60 %
                     : rand < 0.80 ? rnd( 6, 11)   // Morning 20 %
                     :               rnd(12, 16);   // Afternoon 20 %
    entries.push(make(pool, symptomIdx, daysBack, hour, rnd(0, 59), rnd(2, 8)));
  }

  // ── 7. Diabetes afternoon entries ─────────────────────────────────────────
  for (let i = 0; i < 8; i++) {
    entries.push(make(diabetes, rnd(0, 3), rnd(0, 55), rnd(14, 19), rnd(0, 59), rnd(3, 7)));
  }

  return entries.sort((a, b) => b.createdAt - a.createdAt);
}

// ── Daily demo top-up (for testing "Explain today") ───────────────────────────
// Generates ~20 realistic entries for today spread across all 5 conditions.
// Call this once per day to keep today's data fresh for the Daily Explainer.

const DAILY_DEMO_NOTES = [
  'Came on suddenly', 'Worse after screen time', 'Mild but persistent',
  'Worse in the morning', 'Improved after rest', 'After a stressful meeting',
  '', '', '', '',  // blanks for variety
];

export function generateTodayDemoEntries(patientId: string): TrackingEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  const entries: TrackingEntry[] = [];
  let counter = Date.now();

  function makeToday(
    pool: (typeof SAMPLE_POOLS)[number],
    symptomIdx: number,
    hour: number,
    minute: number,
    severity: number,
  ): TrackingEntry {
    const symptom = pool.symptoms[symptomIdx % pool.symptoms.length];
    const note = DAILY_DEMO_NOTES[rnd(0, DAILY_DEMO_NOTES.length - 1)];
    counter++;
    return {
      id: `demo-today-${counter}-${Math.random().toString(36).slice(2, 6)}`,
      patientId,
      conditionId:   pool.conditionId,
      conditionName: pool.conditionName,
      symptomId:     symptom.id,
      symptomName:   symptom.name,
      date:          today,
      dayOfWeek:     dayOfWeek(today),
      time:          padTime(hour, minute),
      severity,
      notes:         note,
      createdAt:     new Date(`${today}T${padTime(hour, minute)}:00`).getTime(),
    };
  }

  const [migraine, anxiety, arthritis, ibs, diabetes] = SAMPLE_POOLS;

  // Morning cluster: anxiety + arthritis stiffness
  entries.push(makeToday(anxiety,   0, 7, rnd( 0, 20), rnd(5, 8)));  // worry
  entries.push(makeToday(anxiety,   1, 7, rnd(25, 45), rnd(4, 7)));  // racing heart
  entries.push(makeToday(arthritis, 2, 7, rnd(30, 55), rnd(4, 7)));  // morning stiffness
  entries.push(makeToday(arthritis, 1, 8, rnd( 0, 20), rnd(3, 6)));  // joint stiffness

  // Mid-morning: IBS
  entries.push(makeToday(ibs, 0, 10, rnd( 0, 20), rnd(4, 7)));  // abdominal pain
  entries.push(makeToday(ibs, 1, 10, rnd(25, 50), rnd(3, 6)));  // bloating
  entries.push(makeToday(ibs, 2, 11, rnd( 0, 30), rnd(3, 5)));  // cramping

  // Afternoon: migraine building
  entries.push(makeToday(migraine, 2, 13, rnd( 0, 20), rnd(4, 6)));  // light sensitivity
  entries.push(makeToday(migraine, 3, 13, rnd(25, 45), rnd(3, 6)));  // sound sensitivity
  entries.push(makeToday(diabetes, 1, 14, rnd( 0, 30), rnd(4, 7)));  // fatigue
  entries.push(makeToday(diabetes, 3, 14, rnd(30, 59), rnd(3, 6)));  // tingling

  // Evening: migraine peak
  entries.push(makeToday(migraine, 0, 17, rnd( 0, 15), rnd(7, 9)));  // throbbing headache
  entries.push(makeToday(migraine, 1, 17, rnd(20, 45), rnd(6, 8)));  // nausea
  entries.push(makeToday(migraine, 2, 18, rnd( 0, 20), rnd(6, 8)));  // light sensitivity
  entries.push(makeToday(anxiety,  3, 18, rnd(30, 59), rnd(4, 7)));  // sleep disturbance

  // Late evening scatter
  entries.push(makeToday(arthritis, 0, 19, rnd( 0, 30), rnd(4, 7)));  // joint pain
  entries.push(makeToday(arthritis, 3, 19, rnd(30, 59), rnd(3, 6)));  // fatigue
  entries.push(makeToday(ibs,       3, 20, rnd( 0, 30), rnd(3, 5)));  // gas
  entries.push(makeToday(diabetes,  0, 20, rnd(30, 59), rnd(3, 5)));  // increased thirst
  entries.push(makeToday(migraine,  3, 21, rnd( 0, 30), rnd(5, 7)));  // sound sensitivity

  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

export const DEMO_INJECT_KEY = 'st-demo-last-inject';
