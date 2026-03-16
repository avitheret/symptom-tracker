import type { TrackingEntry, DailyCheckIn, TriggerLog, MedicationLog, Condition } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RootCauseFactor {
  name: string;
  probabilityPercent: number;
  confidence: 'low' | 'medium' | 'high';
  episodesMatched: number;
  totalEpisodes: number;
  baselineRate: number;        // how often factor appears on symptom-free days (0–1)
  episodeRate: number;         // how often factor appears before symptom days (0–1)
  liftOverBaseline: number;    // episodeRate / baselineRate ratio
  avgSeverityWith: number;
  avgSeverityWithout: number;
  explanation: string;
  details: string[];           // supporting evidence lines
}

export interface RootCauseResult {
  entityName: string;          // condition or symptom name
  entityType: 'condition' | 'symptom';
  dateRange: { from: string; to: string };
  factors: RootCauseFactor[];
  unknownPercent: number;
  dataStrength: 'insufficient' | 'weak' | 'moderate' | 'strong';
  totalEpisodes: number;
  totalDaysAnalyzed: number;
  disclaimer: string;
}

// ── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_LOOKBACK_DAYS = 1; // check same day + previous day for triggers/check-ins

const MIN_EPISODES_FOR_ANALYSIS = 3;
const MIN_EPISODES_FOR_MEDIUM_CONFIDENCE = 7;
const MIN_EPISODES_FOR_HIGH_CONFIDENCE = 15;

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

function allDatesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

// ── Factor Extractors ────────────────────────────────────────────────────────
// Each extractor determines if a candidate factor was "present" on a given date
// by looking at check-ins, trigger logs, or medication logs within the time window.

interface FactorPresence {
  name: string;
  presentDates: Set<string>;   // dates where this factor was active
}

function extractCheckInFactors(
  checkIns: DailyCheckIn[],
  allDates: string[],
): FactorPresence[] {
  const ciByDate: Record<string, DailyCheckIn> = {};
  for (const ci of checkIns) ciByDate[ci.date] = ci;

  const factors: FactorPresence[] = [
    { name: 'Poor sleep', presentDates: new Set() },
    { name: 'High stress', presentDates: new Set() },
    { name: 'Low energy', presentDates: new Set() },
    { name: 'Low mood', presentDates: new Set() },
  ];

  for (const date of allDates) {
    // Check same day and previous day
    for (let lag = 0; lag <= DEFAULT_LOOKBACK_DAYS; lag++) {
      const lookDate = addDays(date, -lag);
      const ci = ciByDate[lookDate];
      if (!ci) continue;

      if (ci.sleepHours < 6) factors[0].presentDates.add(date);
      if (ci.stress === 'high') factors[1].presentDates.add(date);
      if (ci.energy <= 4) factors[2].presentDates.add(date);
      if (ci.mood <= 4) factors[3].presentDates.add(date);
    }
  }

  return factors;
}

function extractTriggerFactors(
  triggerLogs: TriggerLog[],
  allDates: string[],
): FactorPresence[] {
  // Build date → triggers lookup
  const triggersByDate: Record<string, Set<string>> = {};
  for (const tl of triggerLogs) {
    if (!triggersByDate[tl.date]) triggersByDate[tl.date] = new Set();
    for (const t of tl.triggers) triggersByDate[tl.date].add(t);
  }

  // Also gather triggers from entry-level triggers
  // Collect all unique trigger names
  const allTriggerNames = new Set<string>();
  for (const tl of triggerLogs) {
    for (const t of tl.triggers) allTriggerNames.add(t);
  }

  const factors: FactorPresence[] = [];
  for (const triggerName of allTriggerNames) {
    const presentDates = new Set<string>();
    for (const date of allDates) {
      for (let lag = 0; lag <= DEFAULT_LOOKBACK_DAYS; lag++) {
        const lookDate = addDays(date, -lag);
        if (triggersByDate[lookDate]?.has(triggerName)) {
          presentDates.add(date);
        }
      }
    }
    factors.push({ name: triggerName, presentDates });
  }

  return factors;
}

function extractEntryTriggerFactors(
  entries: TrackingEntry[],
  allDates: string[],
): FactorPresence[] {
  // Some entries have inline triggers[] — extract those too
  const triggersByDate: Record<string, Set<string>> = {};
  for (const e of entries) {
    if (e.triggers && e.triggers.length > 0) {
      if (!triggersByDate[e.date]) triggersByDate[e.date] = new Set();
      for (const t of e.triggers) triggersByDate[e.date].add(t);
    }
  }

  const allTriggerNames = new Set<string>();
  for (const triggers of Object.values(triggersByDate)) {
    for (const t of triggers) allTriggerNames.add(t);
  }

  const factors: FactorPresence[] = [];
  for (const triggerName of allTriggerNames) {
    const presentDates = new Set<string>();
    for (const date of allDates) {
      for (let lag = 0; lag <= DEFAULT_LOOKBACK_DAYS; lag++) {
        const lookDate = addDays(date, -lag);
        if (triggersByDate[lookDate]?.has(triggerName)) {
          presentDates.add(date);
        }
      }
    }
    factors.push({ name: triggerName, presentDates });
  }

  return factors;
}

function extractMedicationFactors(
  medLogs: MedicationLog[],
  allDates: string[],
): FactorPresence[] {
  // Check for medication gaps (missed doses on schedule)
  // For now, just track medication presence/absence
  const medsByDate: Record<string, Set<string>> = {};
  for (const m of medLogs) {
    if (!medsByDate[m.date]) medsByDate[m.date] = new Set();
    medsByDate[m.date].add(m.name);
  }

  // Only create a "No medication taken" factor if there's a pattern of taking meds
  const totalMedDays = Object.keys(medsByDate).length;
  if (totalMedDays < 5) return [];

  const factors: FactorPresence[] = [];
  const noMedDates = new Set<string>();
  for (const date of allDates) {
    if (!medsByDate[date] || medsByDate[date].size === 0) {
      noMedDates.add(date);
    }
  }

  if (noMedDates.size > 0 && noMedDates.size < allDates.length * 0.9) {
    factors.push({ name: 'No medication taken', presentDates: noMedDates });
  }

  return factors;
}

// ── Core Scoring Engine ──────────────────────────────────────────────────────

interface ScoredFactor {
  name: string;
  rawScore: number;
  episodesMatched: number;
  totalEpisodes: number;
  baselineRate: number;
  episodeRate: number;
  liftOverBaseline: number;
  avgSeverityWith: number;
  avgSeverityWithout: number;
  explanation: string;
  details: string[];
}

function scoreFactor(
  factor: FactorPresence,
  symptomDates: Set<string>,
  symptomFreeDates: Set<string>,
  severityByDate: Record<string, number>,
  totalEpisodes: number,
): ScoredFactor | null {
  // How often factor appears before symptom episodes
  let episodesWithFactor = 0;
  for (const date of symptomDates) {
    if (factor.presentDates.has(date)) episodesWithFactor++;
  }

  // How often factor appears on symptom-free days (baseline)
  let baselineDaysWithFactor = 0;
  for (const date of symptomFreeDates) {
    if (factor.presentDates.has(date)) baselineDaysWithFactor++;
  }

  const episodeRate = symptomDates.size > 0 ? episodesWithFactor / symptomDates.size : 0;
  const baselineRate = symptomFreeDates.size > 0 ? baselineDaysWithFactor / symptomFreeDates.size : 0;

  // Skip factors that never appear before episodes
  if (episodesWithFactor === 0) return null;

  // Lift: how much more likely is the factor before episodes vs baseline
  // A lift of 2.0 means factor is 2x more common before episodes
  const lift = baselineRate > 0 ? episodeRate / baselineRate : (episodeRate > 0 ? 3.0 : 0);

  // Severity association: average severity on days with vs without factor
  const sevsWithFactor: number[] = [];
  const sevsWithoutFactor: number[] = [];
  for (const date of symptomDates) {
    const sev = severityByDate[date];
    if (sev === undefined) continue;
    if (factor.presentDates.has(date)) sevsWithFactor.push(sev);
    else sevsWithoutFactor.push(sev);
  }

  const avgSevWith = sevsWithFactor.length > 0
    ? sevsWithFactor.reduce((s, v) => s + v, 0) / sevsWithFactor.length : 0;
  const avgSevWithout = sevsWithoutFactor.length > 0
    ? sevsWithoutFactor.reduce((s, v) => s + v, 0) / sevsWithoutFactor.length : 0;

  // Severity bonus: higher severity with factor present
  const severityBonus = avgSevWith > avgSevWithout ? 1 + (avgSevWith - avgSevWithout) / 10 : 1;

  // Composite raw score:
  // - Frequency: how often factor co-occurs (episodeRate)
  // - Lift: how much more vs baseline (lift, capped at 5)
  // - Severity: does it worsen symptoms
  // - Consistency: penalize factors that appear too few times
  const cappedLift = Math.min(lift, 5);
  const consistencyFactor = Math.min(1, episodesWithFactor / 3); // ramp up to full weight at 3+ matches

  const rawScore = episodeRate * cappedLift * severityBonus * consistencyFactor;

  if (rawScore < 0.01) return null;

  // Build explanation
  const pctEpisodes = Math.round(episodeRate * 100);
  const explanation = `Present before ${pctEpisodes}% of episodes (${episodesWithFactor} of ${symptomDates.size})`;

  const details: string[] = [];
  details.push(`Appeared before ${episodesWithFactor} of ${symptomDates.size} symptom episodes`);

  if (baselineRate > 0) {
    const pctBaseline = Math.round(baselineRate * 100);
    if (lift > 1.3) {
      details.push(`${(lift).toFixed(1)}× more common on symptom days than symptom-free days (${pctEpisodes}% vs ${pctBaseline}%)`);
    } else {
      details.push(`Similar frequency on symptom-free days (${pctBaseline}%), reducing confidence`);
    }
  } else if (episodesWithFactor > 0) {
    details.push(`Not observed on symptom-free days — strong association signal`);
  }

  if (avgSevWith > 0 && avgSevWithout > 0 && avgSevWith > avgSevWithout + 0.5) {
    details.push(`Average severity ${avgSevWith.toFixed(1)}/10 when present vs ${avgSevWithout.toFixed(1)}/10 without`);
  }

  return {
    name: factor.name,
    rawScore,
    episodesMatched: episodesWithFactor,
    totalEpisodes,
    baselineRate,
    episodeRate,
    liftOverBaseline: lift,
    avgSeverityWith: parseFloat(avgSevWith.toFixed(1)),
    avgSeverityWithout: parseFloat(avgSevWithout.toFixed(1)),
    explanation,
    details,
  };
}

// ── Normalization ────────────────────────────────────────────────────────────

function normalizeToPercentages(
  scored: ScoredFactor[],
): { factors: RootCauseFactor[]; unknownPercent: number } {
  if (scored.length === 0) return { factors: [], unknownPercent: 100 };

  const totalRaw = scored.reduce((s, f) => s + f.rawScore, 0);

  // Reserve an "unknown" bucket based on overall data coverage
  // If factors explain a lot, unknown is small; if factors are weak, unknown grows
  const maxCoverage = Math.max(...scored.map(f => f.episodeRate));
  const unknownBase = Math.max(5, Math.round((1 - maxCoverage) * 30));

  const allocatable = 100 - unknownBase;
  const factors: RootCauseFactor[] = scored
    .map(f => {
      const pct = Math.round((f.rawScore / totalRaw) * allocatable);
      const confidence: 'low' | 'medium' | 'high' =
        f.episodesMatched >= MIN_EPISODES_FOR_HIGH_CONFIDENCE ? 'high' :
        f.episodesMatched >= MIN_EPISODES_FOR_MEDIUM_CONFIDENCE ? 'medium' : 'low';
      return {
        name: f.name,
        probabilityPercent: pct,
        confidence,
        episodesMatched: f.episodesMatched,
        totalEpisodes: f.totalEpisodes,
        baselineRate: f.baselineRate,
        episodeRate: f.episodeRate,
        liftOverBaseline: parseFloat(f.liftOverBaseline.toFixed(1)),
        avgSeverityWith: f.avgSeverityWith,
        avgSeverityWithout: f.avgSeverityWithout,
        explanation: f.explanation,
        details: f.details,
      };
    })
    .filter(f => f.probabilityPercent >= 1)
    .sort((a, b) => b.probabilityPercent - a.probabilityPercent);

  // Redistribute rounding remainders
  const factorSum = factors.reduce((s, f) => s + f.probabilityPercent, 0);
  const unknownPercent = 100 - factorSum;

  return { factors, unknownPercent };
}

// ── Main Engine ──────────────────────────────────────────────────────────────

export interface RootCauseInput {
  entries: TrackingEntry[];
  checkIns: DailyCheckIn[];
  triggerLogs: TriggerLog[];
  medicationLogs: MedicationLog[];
  conditions: Condition[];
  conditionId?: string;        // filter to specific condition
  symptomId?: string;          // filter to specific symptom
  dateFrom?: string;           // YYYY-MM-DD
  dateTo?: string;             // YYYY-MM-DD
}

export function analyzeRootCauses(input: RootCauseInput): RootCauseResult {
  const {
    entries, checkIns, triggerLogs, medicationLogs, conditions,
    conditionId, symptomId, dateFrom, dateTo,
  } = input;

  // Filter entries: approved only, by condition/symptom/date
  let filtered = entries.filter(e =>
    e.reviewStatus !== 'to_review' &&
    e.reviewStatus !== 'disapproved'
  );
  if (conditionId) filtered = filtered.filter(e => e.conditionId === conditionId);
  if (symptomId) filtered = filtered.filter(e => e.symptomId === symptomId);
  if (dateFrom) filtered = filtered.filter(e => e.date >= dateFrom);
  if (dateTo) filtered = filtered.filter(e => e.date <= dateTo);

  // Determine entity name
  const entityName = symptomId
    ? (filtered[0]?.symptomName ?? 'Selected Symptom')
    : conditionId
      ? (conditions.find(c => c.id === conditionId)?.name ?? filtered[0]?.conditionName ?? 'Selected Condition')
      : 'All Symptoms';
  const entityType = symptomId ? 'symptom' as const : 'condition' as const;

  const disclaimer = 'These probabilities are estimates based on patterns in your logged data. They are not a medical diagnosis or scientifically proven causation. Always consult your healthcare provider.';

  // Not enough data
  if (filtered.length < MIN_EPISODES_FOR_ANALYSIS) {
    return {
      entityName,
      entityType,
      dateRange: { from: dateFrom ?? '', to: dateTo ?? '' },
      factors: [],
      unknownPercent: 100,
      dataStrength: 'insufficient',
      totalEpisodes: filtered.length,
      totalDaysAnalyzed: 0,
      disclaimer,
    };
  }

  // Determine date range for analysis
  const allEntryDates = filtered.map(e => e.date).sort();
  const analysisFrom = dateFrom ?? allEntryDates[0];
  const analysisTo = dateTo ?? allEntryDates[allEntryDates.length - 1];
  const allDates = allDatesBetween(analysisFrom, analysisTo);

  // Symptom days vs symptom-free days
  const symptomDates = new Set(filtered.map(e => e.date));
  const symptomFreeDates = new Set(allDates.filter(d => !symptomDates.has(d)));

  // Average severity per symptom day
  const severityByDate: Record<string, number> = {};
  const severityBuckets: Record<string, number[]> = {};
  for (const e of filtered) {
    if (!severityBuckets[e.date]) severityBuckets[e.date] = [];
    severityBuckets[e.date].push(e.severity);
  }
  for (const [date, sevs] of Object.entries(severityBuckets)) {
    severityByDate[date] = sevs.reduce((s, v) => s + v, 0) / sevs.length;
  }

  const totalEpisodes = symptomDates.size;

  // Gather all candidate factors
  const allFactors: FactorPresence[] = [
    ...extractCheckInFactors(checkIns, allDates),
    ...extractTriggerFactors(triggerLogs, allDates),
    ...extractEntryTriggerFactors(filtered, allDates),
    ...extractMedicationFactors(medicationLogs, allDates),
  ];

  // Deduplicate factors by name (trigger logs + entry triggers may overlap)
  const factorMap = new Map<string, FactorPresence>();
  for (const f of allFactors) {
    const existing = factorMap.get(f.name);
    if (existing) {
      // Merge present dates
      for (const d of f.presentDates) existing.presentDates.add(d);
    } else {
      factorMap.set(f.name, { name: f.name, presentDates: new Set(f.presentDates) });
    }
  }

  // Score each factor
  const scoredFactors: ScoredFactor[] = [];
  for (const factor of factorMap.values()) {
    const scored = scoreFactor(factor, symptomDates, symptomFreeDates, severityByDate, totalEpisodes);
    if (scored) scoredFactors.push(scored);
  }

  // Sort by raw score descending
  scoredFactors.sort((a, b) => b.rawScore - a.rawScore);

  // Take top factors (avoid clutter)
  const topFactors = scoredFactors.slice(0, 8);

  // Normalize to percentages
  const { factors, unknownPercent } = normalizeToPercentages(topFactors);

  // Determine data strength
  const dataStrength: RootCauseResult['dataStrength'] =
    totalEpisodes >= MIN_EPISODES_FOR_HIGH_CONFIDENCE && factors.length >= 3 ? 'strong' :
    totalEpisodes >= MIN_EPISODES_FOR_MEDIUM_CONFIDENCE && factors.length >= 2 ? 'moderate' :
    totalEpisodes >= MIN_EPISODES_FOR_ANALYSIS ? 'weak' : 'insufficient';

  return {
    entityName,
    entityType,
    dateRange: { from: analysisFrom, to: analysisTo },
    factors,
    unknownPercent,
    dataStrength,
    totalEpisodes,
    totalDaysAnalyzed: allDates.length,
    disclaimer,
  };
}
