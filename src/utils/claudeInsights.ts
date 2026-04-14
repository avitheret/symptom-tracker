/**
 * claudeInsights — Multi-factor correlation insights via Claude API.
 *
 * Gathers 90 days of symptoms, medications, supplements, weather, and sleep/wellness
 * data, then sends to Claude to identify multi-factor patterns.
 */
import type {
  AIInsight, InsightCategory, InsightSeverity,
  TrackingEntry, DailyCheckIn, MedicationLog, SupplementLog,
  Condition,
} from '../types';
import { getStoredObservations, type WeatherObservation } from './weatherService';

// ── Input ───────────────────────────────────────────────────────────────────

export interface InsightInput {
  patientId: string;
  patientName: string;
  diagnosis: string;
  entries: TrackingEntry[];
  checkIns: DailyCheckIn[];
  medications: MedicationLog[];
  supplementLogs: SupplementLog[];
  conditions: Condition[];
}

// ── Response shape from Claude ──────────────────────────────────────────────

interface ClaudeMultiInsight {
  content: string;
  factors: string[];
  category: InsightCategory;
  severity: InsightSeverity;
  confidence: 'high' | 'medium' | 'low';
  actionable: string;
}

// ── Cache ───────────────────────────────────────────────────────────────────

const CACHE_KEY = 'st-mf-insights';

interface CachedInsights {
  patientId: string;
  insights: AIInsight[];
  generatedAt: number;
  entryHash: string;   // quick change-detection fingerprint
}

function computeEntryHash(entries: TrackingEntry[], meds: MedicationLog[], supps: SupplementLog[]): string {
  const counts = `e${entries.length}m${meds.length}s${supps.length}`;
  const latest = [
    ...entries.map(e => e.createdAt),
    ...meds.map(m => m.createdAt),
    ...supps.map(s => s.createdAt),
  ].sort((a, b) => b - a)[0] ?? 0;
  return `${counts}-${latest}`;
}

export function getCachedInsights(patientId: string, entries: TrackingEntry[], meds: MedicationLog[], supps: SupplementLog[]): AIInsight[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedInsights = JSON.parse(raw);
    if (cached.patientId !== patientId) return null;
    // Invalidate if data changed
    if (cached.entryHash !== computeEntryHash(entries, meds, supps)) return null;
    // Invalidate after 24h
    if (Date.now() - cached.generatedAt > 24 * 60 * 60 * 1000) return null;
    return cached.insights;
  } catch {
    return null;
  }
}

function cacheInsights(patientId: string, insights: AIInsight[], entries: TrackingEntry[], meds: MedicationLog[], supps: SupplementLog[]) {
  const payload: CachedInsights = {
    patientId,
    insights,
    generatedAt: Date.now(),
    entryHash: computeEntryHash(entries, meds, supps),
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // quota exceeded — non-critical
  }
}

// ── Data summarisation (90-day window) ──────────────────────────────────────

function cutoffDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function summarizeEntries(entries: TrackingEntry[]): string {
  const cut = cutoffDate(90);
  const recent = entries.filter(e => e.date >= cut).sort((a, b) => b.date.localeCompare(a.date));
  if (recent.length === 0) return 'No symptom entries in the last 90 days.';

  const bySymptom: Record<string, { count: number; totalSev: number; dates: string[] }> = {};
  for (const e of recent) {
    const key = `${e.symptomName} (${e.conditionName})`;
    if (!bySymptom[key]) bySymptom[key] = { count: 0, totalSev: 0, dates: [] };
    bySymptom[key].count++;
    bySymptom[key].totalSev += e.severity;
    if (bySymptom[key].dates.length < 5) bySymptom[key].dates.push(e.date);
  }

  const lines = Object.entries(bySymptom).map(([name, d]) =>
    `- ${name}: ${d.count}x, avg severity ${(d.totalSev / d.count).toFixed(1)}/10, dates: ${d.dates.join(', ')}`
  );
  return `Last 90 days (${recent.length} entries):\n${lines.join('\n')}`;
}

function summarizeCheckIns(checkIns: DailyCheckIn[]): string {
  const cut = cutoffDate(90);
  const recent = checkIns.filter(c => c.date >= cut).sort((a, b) => b.date.localeCompare(a.date));
  if (recent.length === 0) return 'No wellness check-in data.';

  const avgSleep = (recent.reduce((s, c) => s + c.sleepHours, 0) / recent.length).toFixed(1);
  const avgEnergy = (recent.reduce((s, c) => s + c.energy, 0) / recent.length).toFixed(1);
  const avgMood = (recent.reduce((s, c) => s + c.mood, 0) / recent.length).toFixed(1);
  const avgHealth = (recent.reduce((s, c) => s + c.healthScore, 0) / recent.length).toFixed(1);
  const stressCounts = { low: 0, medium: 0, high: 0 };
  recent.forEach(c => stressCounts[c.stress]++);

  // Day-level sleep × symptom co-occurrence
  const poorSleepDays = recent.filter(c => c.sleepHours < 6).map(c => c.date);
  const goodSleepDays = recent.filter(c => c.sleepHours >= 7.5).map(c => c.date);

  return `${recent.length} check-ins over 90 days:
  avg sleep ${avgSleep}h, energy ${avgEnergy}/10, mood ${avgMood}/10, health ${avgHealth}/10
  stress: ${stressCounts.low} low / ${stressCounts.medium} medium / ${stressCounts.high} high
  poor sleep (<6h) on ${poorSleepDays.length} days: ${poorSleepDays.slice(0, 5).join(', ') || 'none'}
  good sleep (≥7.5h) on ${goodSleepDays.length} days`;
}

function summarizeMedications(medications: MedicationLog[]): string {
  const cut = cutoffDate(90);
  const recent = medications.filter(m => m.date >= cut);
  if (recent.length === 0) return 'No medication logs in 90 days.';

  const byName: Record<string, { count: number; effectiveness: string[] }> = {};
  for (const m of recent) {
    if (!byName[m.name]) byName[m.name] = { count: 0, effectiveness: [] };
    byName[m.name].count++;
    byName[m.name].effectiveness.push(m.effectiveness);
  }

  return Object.entries(byName)
    .map(([name, d]) => `- ${name}: ${d.count} doses, effectiveness: ${d.effectiveness.join(', ')}`)
    .join('\n');
}

function summarizeSupplements(supplementLogs: SupplementLog[]): string {
  const cut = cutoffDate(90);
  const recent = supplementLogs.filter(s => s.date >= cut);
  if (recent.length === 0) return 'No supplement logs in 90 days.';

  const byName: Record<string, { count: number; dates: string[] }> = {};
  for (const s of recent) {
    if (!byName[s.name]) byName[s.name] = { count: 0, dates: [] };
    byName[s.name].count++;
    if (byName[s.name].dates.length < 3) byName[s.name].dates.push(s.date);
  }

  return Object.entries(byName)
    .map(([name, d]) => `- ${name}: ${d.count} doses, recent: ${d.dates.join(', ')}`)
    .join('\n');
}

function summarizeWeather(observations: WeatherObservation[]): string {
  const cut = cutoffDate(90);
  const recent = observations.filter(o => o.date >= cut);
  if (recent.length === 0) return 'No weather data available.';

  // One representative row per date
  const byDate: Record<string, WeatherObservation> = {};
  for (const o of recent) byDate[o.date] = o;
  const days = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));

  const pressureDropDays = days.filter(d => d.derivedFlags.pressureDropDetected).map(d => d.date);
  const stormDays = days.filter(d => d.derivedFlags.stormDetected || d.derivedFlags.severeWeather).map(d => d.date);
  const highHumidityDays = days.filter(d => d.derivedFlags.humidityHigh).map(d => d.date);
  const tempSwingDays = days.filter(d => d.derivedFlags.rapidTemperatureChange).map(d => d.date);

  const avgTemp = (days.reduce((s, d) => s + d.temperature, 0) / days.length).toFixed(1);
  const avgHumidity = (days.reduce((s, d) => s + d.humidity, 0) / days.length).toFixed(0);
  const avgPressure = (days.reduce((s, d) => s + d.barometricPressure, 0) / days.length).toFixed(0);

  return `${days.length} weather days tracked:
  avg temp ${avgTemp}°C, humidity ${avgHumidity}%, pressure ${avgPressure} hPa
  pressure drops (>4 hPa/6h): ${pressureDropDays.length} days — ${pressureDropDays.slice(0, 5).join(', ') || 'none'}
  storms: ${stormDays.length} days — ${stormDays.slice(0, 5).join(', ') || 'none'}
  high humidity (>80%): ${highHumidityDays.length} days
  temp swings (>8°C/24h): ${tempSwingDays.length} days — ${tempSwingDays.slice(0, 5).join(', ') || 'none'}`;
}

// ── Day-level co-occurrence matrix ──────────────────────────────────────────
// Helps Claude see which factors coincide on which dates.

function buildCoOccurrenceTable(
  entries: TrackingEntry[],
  checkIns: DailyCheckIn[],
  observations: WeatherObservation[],
  medications: MedicationLog[],
  supplementLogs: SupplementLog[],
): string {
  const cut = cutoffDate(90);

  // Collect all dates with any data
  const dates = new Set<string>();
  entries.filter(e => e.date >= cut).forEach(e => dates.add(e.date));
  checkIns.filter(c => c.date >= cut).forEach(c => dates.add(c.date));
  observations.filter(o => o.date >= cut).forEach(o => dates.add(o.date));

  if (dates.size === 0) return '';

  // Build lookup maps
  const symptomByDate: Record<string, { names: string[]; maxSev: number }> = {};
  for (const e of entries.filter(x => x.date >= cut)) {
    if (!symptomByDate[e.date]) symptomByDate[e.date] = { names: [], maxSev: 0 };
    if (!symptomByDate[e.date].names.includes(e.symptomName)) symptomByDate[e.date].names.push(e.symptomName);
    symptomByDate[e.date].maxSev = Math.max(symptomByDate[e.date].maxSev, e.severity);
  }

  const checkInByDate: Record<string, DailyCheckIn> = {};
  for (const c of checkIns.filter(x => x.date >= cut)) checkInByDate[c.date] = c;

  const obsByDate: Record<string, WeatherObservation> = {};
  for (const o of observations.filter(x => x.date >= cut)) obsByDate[o.date] = o;

  const medByDate: Record<string, string[]> = {};
  for (const m of medications.filter(x => x.date >= cut)) {
    if (!medByDate[m.date]) medByDate[m.date] = [];
    if (!medByDate[m.date].includes(m.name)) medByDate[m.date].push(m.name);
  }

  const suppByDate: Record<string, string[]> = {};
  for (const s of supplementLogs.filter(x => x.date >= cut)) {
    if (!suppByDate[s.date]) suppByDate[s.date] = [];
    if (!suppByDate[s.date].includes(s.name)) suppByDate[s.date].push(s.name);
  }

  // Build rows (most recent 30 days to keep prompt size reasonable)
  const sorted = Array.from(dates).sort((a, b) => b.localeCompare(a)).slice(0, 30);
  const rows = sorted.map(date => {
    const sx = symptomByDate[date];
    const ci = checkInByDate[date];
    const wx = obsByDate[date];
    const md = medByDate[date];
    const sp = suppByDate[date];

    const parts: string[] = [date];
    parts.push(sx ? `sx:${sx.names.join('+')} sev:${sx.maxSev}` : 'sx:none');
    parts.push(ci ? `sleep:${ci.sleepHours}h energy:${ci.energy} mood:${ci.mood} stress:${ci.stress}` : 'checkin:none');
    parts.push(wx ? `temp:${Math.round(wx.temperature)}°C hum:${wx.humidity}% pΔ6h:${wx.derivedFlags.pressureChange6h.toFixed(1)} ${wx.derivedFlags.pressureDropDetected ? 'PDROP' : ''} ${wx.derivedFlags.stormDetected ? 'STORM' : ''}`.trim() : 'wx:none');
    parts.push(md ? `meds:${md.join('+')}` : '');
    parts.push(sp ? `supps:${sp.join('+')}` : '');

    return parts.filter(Boolean).join(' | ');
  });

  return `DAY-BY-DAY CO-OCCURRENCE (most recent 30 days):\n${rows.join('\n')}`;
}

// ── Count helpers for provenance ────────────────────────────────────────────

function countDataSpan(entries: TrackingEntry[], checkIns: DailyCheckIn[], meds: MedicationLog[], supps: SupplementLog[]): { entryCount: number; daySpan: number } {
  const cut = cutoffDate(90);
  const allDates = new Set<string>();

  const filteredEntries = entries.filter(e => e.date >= cut);
  const filteredCheckIns = checkIns.filter(c => c.date >= cut);
  const filteredMeds = meds.filter(m => m.date >= cut);
  const filteredSupps = supps.filter(s => s.date >= cut);

  [...filteredEntries, ...filteredCheckIns, ...filteredMeds, ...filteredSupps].forEach(x => allDates.add(x.date));

  return {
    entryCount: filteredEntries.length + filteredCheckIns.length + filteredMeds.length + filteredSupps.length,
    daySpan: allDates.size,
  };
}

// ── Main API call ───────────────────────────────────────────────────────────

export async function generateInsights(input: InsightInput): Promise<AIInsight[]> {
  const { patientId, patientName, diagnosis, entries, checkIns, medications, supplementLogs, conditions } = input;

  const weatherObs = getStoredObservations();
  const { entryCount, daySpan } = countDataSpan(entries, checkIns, medications, supplementLogs);

  const conditionList = conditions.map(c =>
    `${c.name} (tracking: ${c.symptoms.map(s => s.name).join(', ')})`
  ).join('\n');

  const coOccurrence = buildCoOccurrenceTable(entries, checkIns, weatherObs, medications, supplementLogs);

  const prompt = `You are a health pattern analyst. A patient uses a symptom tracking app that records symptoms, medications, supplements, weather conditions, and daily wellness check-ins. Your job is to identify MULTI-FACTOR patterns — combinations of 2+ co-occurring factors that correlate with symptom changes.

PATIENT: ${patientName}
MEDICAL BACKGROUND: ${diagnosis || 'Not specified'}

CONDITIONS BEING TRACKED:
${conditionList}

SYMPTOM DATA:
${summarizeEntries(entries)}

WELLNESS CHECK-INS (sleep, energy, mood, stress):
${summarizeCheckIns(checkIns)}

MEDICATIONS:
${summarizeMedications(medications)}

SUPPLEMENTS:
${summarizeSupplements(supplementLogs)}

WEATHER:
${summarizeWeather(weatherObs)}

${coOccurrence}

TASK: Identify multi-factor patterns. For each insight:
1. Name the COMBINATION of factors (at least 2 co-occurring factors per insight)
2. State the direction and magnitude of the correlation
3. Give confidence: "high" (clear pattern, many data points), "medium" (suggestive, moderate data), "low" (possible, limited data)
4. Suggest ONE specific actionable change

Respond with a JSON array of 3-5 insights. Each must have:
- "content": plain English insight (2-3 sentences). Reference specific data points.
- "factors": array of factor names involved, e.g. ["pressure drop", "poor sleep", "high stress"]
- "category": one of "alert", "tip", "pattern", "medication"
- "severity": "urgent" | "warning" | "info"
- "confidence": "high" | "medium" | "low"
- "actionable": one sentence suggesting a specific change

IMPORTANT:
- Each insight MUST reference at least 2 co-occurring factors
- Use actual numbers and dates from the data
- "urgent" only if the pattern genuinely suggests contacting a healthcare provider
- Never diagnose — always recommend consulting their doctor for concerning patterns

Respond ONLY with a valid JSON array, no other text.`;

  const response = await fetch('/.netlify/functions/claude-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 401) throw new Error('AI service configuration error. Please contact support.');
    if (response.status === 429) throw new Error('Rate limited. Please wait a moment and try again.');
    throw new Error(`API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse AI response. Please try again.');

  const parsed: ClaudeMultiInsight[] = JSON.parse(jsonMatch[0]);
  const now = Date.now();

  const insights: AIInsight[] = parsed.map((item, i) => ({
    id: `ai-${now}-${i}`,
    patientId,
    content: item.content,
    category: item.category,
    severity: item.severity,
    generatedAt: now,
    factors: Array.isArray(item.factors) ? item.factors : [],
    confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium',
    actionable: typeof item.actionable === 'string' ? item.actionable : '',
    entryCount,
    daySpan,
  }));

  // Cache results
  cacheInsights(patientId, insights, entries, medications, supplementLogs);

  return insights;
}
