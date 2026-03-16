/**
 * dailyExplainer — "Why am I feeling like this?" engine
 * Gathers all data for today + yesterday and asks Claude to explain likely causes.
 */
import type { TrackingEntry, DailyCheckIn, TriggerLog, MedicationLog, Condition } from '../types';
import { getObservationsForDate, getLatestObservation } from './weatherService';

// ── Output types ──────────────────────────────────────────────────────────────

export interface ConditionExplanation {
  condition: string;
  conditionColor?: string;
  possibleCauses: string[];
  mostLikelyCause: string;
}

export interface DailyExplanation {
  date: string;
  generatedAt: number;
  conditionExplanations: ConditionExplanation[];
  overallSummary: string;
  noSymptoms: boolean;
  dataNote?: string;  // e.g. "Based on limited data"
}

// ── localStorage cache (one per day) ──────────────────────────────────────────

const CACHE_KEY = 'st-daily-explanation';

export function getCachedExplanation(date: string): DailyExplanation | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: DailyExplanation = JSON.parse(raw);
    return cached.date === date ? cached : null;
  } catch {
    return null;
  }
}

function cacheExplanation(exp: DailyExplanation): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(exp)); } catch { /* quota */ }
}

// ── Build context for today ───────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatCheckIn(ci: DailyCheckIn | undefined, label: string): string {
  if (!ci) return `${label}: no check-in recorded`;
  return `${label}: sleep ${ci.sleepHours}h, stress ${ci.stress}, energy ${ci.energy}/10, mood ${ci.mood}/10, health ${ci.healthScore}/10`;
}

function buildPrompt(params: {
  today: string;
  yesterday: string;
  patientName: string;
  diagnosis: string;
  conditions: Condition[];
  todayEntries: TrackingEntry[];
  todayCheckIn: DailyCheckIn | undefined;
  yesterdayCheckIn: DailyCheckIn | undefined;
  todayTriggers: TriggerLog[];
  todayMeds: MedicationLog[];
  recentEntries: TrackingEntry[];   // last 7 days for context
}): string {
  const {
    today, yesterday, patientName, diagnosis, conditions,
    todayEntries, todayCheckIn, yesterdayCheckIn,
    todayTriggers, todayMeds, recentEntries,
  } = params;

  // Weather for today
  const todayWeather = getObservationsForDate(today);
  const latestWeather = todayWeather[todayWeather.length - 1] ?? getLatestObservation();
  let weatherSummary = 'No weather data available.';
  if (latestWeather) {
    const f = latestWeather.derivedFlags;
    const flags: string[] = [];
    if (f.pressureDropDetected) flags.push(`barometric pressure dropped ${Math.abs(f.pressureChange6h).toFixed(1)} hPa in 6 hours`);
    else if (f.pressureRiseDetected) flags.push(`barometric pressure rising`);
    else flags.push(`pressure stable (${latestWeather.barometricPressure} hPa)`);
    if (f.humidityHigh) flags.push(`high humidity (${latestWeather.humidity}%)`);
    if (f.stormDetected) flags.push('thunderstorm conditions');
    else if (f.severeWeather) flags.push(`severe weather: ${latestWeather.weatherCondition}`);
    if (f.rapidTemperatureChange) flags.push(`rapid temperature swing (${f.temperatureChange24h > 0 ? '+' : ''}${f.temperatureChange24h.toFixed(1)}°C in 24h)`);
    weatherSummary = `${latestWeather.temperature}°C, ${latestWeather.weatherCondition}, humidity ${latestWeather.humidity}%. Notable: ${flags.join('; ')}.`;
  }

  // Symptoms today
  const symptomLines = todayEntries.length === 0
    ? 'No symptoms logged today.'
    : todayEntries.map(e =>
        `- ${e.symptomName} (${e.conditionName}): severity ${e.severity}/10${e.duration ? `, duration ${e.duration}` : ''}${e.notes ? `, notes: "${e.notes}"` : ''}`
      ).join('\n');

  // Triggers today
  const triggerLines = todayTriggers.length === 0
    ? 'No triggers logged today.'
    : todayTriggers.flatMap(t => t.triggers).join(', ');

  // Meds today
  const medLines = todayMeds.length === 0
    ? 'No medications logged today.'
    : todayMeds.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`).join(', ');

  // Recent pattern context (last 7 days, excluding today)
  const recentNonToday = recentEntries.filter(e => e.date !== today);
  const recentSymptomDays = new Set(recentNonToday.map(e => e.date)).size;
  const recentContext = recentNonToday.length > 0
    ? `Past 7 days: ${recentNonToday.length} symptom entries across ${recentSymptomDays} days.`
    : 'No recent symptom history in the past 7 days.';

  const conditionList = conditions.map(c => c.name).join(', ');

  return `You are a compassionate health assistant helping a patient understand why they may be feeling the way they do today. Analyze the data below and explain likely contributing factors in plain, simple language.

IMPORTANT RULES:
- Use cautious, non-diagnostic language ("may be contributing", "could be linked to", "possible cause")
- Never claim medical certainty or provide diagnosis
- Be specific — reference actual numbers from the data (e.g. "5h sleep vs your usual 7h")
- Keep each cause bullet point short (under 10 words)
- If there are no symptoms today, say so positively
- End with the single most likely trigger/cause

PATIENT: ${patientName}
MEDICAL BACKGROUND: ${diagnosis || 'Not specified'}
CONDITIONS: ${conditionList}

TODAY (${today}):
SYMPTOMS:
${symptomLines}

TRIGGERS LOGGED: ${triggerLines}
MEDICATIONS: ${medLines}
${formatCheckIn(todayCheckIn, 'CHECK-IN')}
WEATHER: ${weatherSummary}

YESTERDAY (${yesterday}):
${formatCheckIn(yesterdayCheckIn, 'CHECK-IN')} (Note: yesterday's sleep directly affects today)

RECENT CONTEXT: ${recentContext}

${todayEntries.length === 0
  ? 'No symptoms were logged today. Provide a brief positive note.'
  : `Explain the likely causes for today's ${todayEntries.map(e => e.conditionName).filter((v,i,a)=>a.indexOf(v)===i).join(' and ')} symptoms.`
}

Respond with ONLY valid JSON in this exact format:
{
  "conditionExplanations": [
    {
      "condition": "Condition name",
      "possibleCauses": ["Cause 1 with specific detail", "Cause 2", "Cause 3"],
      "mostLikelyCause": "The single most likely cause in plain language"
    }
  ],
  "overallSummary": "1-2 sentence plain-language summary of today",
  "dataNote": "Optional: note if data is limited, e.g. 'No check-in data — add a check-in for better accuracy'"
}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function explainToday(params: {
  patientName: string;
  diagnosis: string;
  conditions: Condition[];
  entries: TrackingEntry[];
  checkIns: DailyCheckIn[];
  triggerLogs: TriggerLog[];
  medicationLogs: MedicationLog[];
  forceRefresh?: boolean;
}): Promise<DailyExplanation> {
  const today = todayStr();
  const yesterday = yesterdayStr();

  // Return cached if available and not forcing refresh
  if (!params.forceRefresh) {
    const cached = getCachedExplanation(today);
    if (cached) return cached;
  }

  const todayEntries    = params.entries.filter(e => e.date === today && e.reviewStatus !== 'disapproved');
  const todayCheckIn    = params.checkIns.find(c => c.date === today);
  const yesterdayCheckIn = params.checkIns.find(c => c.date === yesterday);
  const todayTriggers   = params.triggerLogs.filter(t => t.date === today);
  const todayMeds       = params.medicationLogs.filter(m => m.date === today);
  const sevenDaysAgo    = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentEntries   = params.entries.filter(e =>
    e.date >= sevenDaysAgo.toISOString().slice(0, 10) &&
    e.reviewStatus !== 'disapproved'
  );

  // Build condition color map for richer display
  const conditionColorMap = Object.fromEntries(params.conditions.map(c => [c.name, c.color]));

  const prompt = buildPrompt({
    today, yesterday,
    patientName: params.patientName,
    diagnosis: params.diagnosis,
    conditions: params.conditions,
    todayEntries, todayCheckIn, yesterdayCheckIn,
    todayTriggers, todayMeds, recentEntries,
  });

  const response = await fetch('/.netlify/functions/claude-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('AI service not configured. Please check your API key.');
    if (response.status === 429) throw new Error('Rate limited — please try again in a moment.');
    throw new Error(`Could not generate explanation (${response.status}).`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse AI response. Please try again.');

  const parsed = JSON.parse(jsonMatch[0]) as {
    conditionExplanations: Array<{ condition: string; possibleCauses: string[]; mostLikelyCause: string }>;
    overallSummary: string;
    dataNote?: string;
  };

  const result: DailyExplanation = {
    date: today,
    generatedAt: Date.now(),
    noSymptoms: todayEntries.length === 0,
    conditionExplanations: parsed.conditionExplanations.map(ce => ({
      ...ce,
      conditionColor: conditionColorMap[ce.condition],
    })),
    overallSummary: parsed.overallSummary,
    dataNote: parsed.dataNote,
  };

  cacheExplanation(result);
  return result;
}
