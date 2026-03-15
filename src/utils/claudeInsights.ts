import type { AIInsight, InsightCategory, InsightSeverity, TrackingEntry, DailyCheckIn, MedicationLog, Condition } from '../types';

interface InsightInput {
  patientName: string;
  diagnosis: string;
  entries: TrackingEntry[];
  checkIns: DailyCheckIn[];
  medications: MedicationLog[];
  conditions: Condition[];
}

interface ClaudeInsightItem {
  content: string;
  category: InsightCategory;
  severity: InsightSeverity;
}

function summarizeEntries(entries: TrackingEntry[]): string {
  if (entries.length === 0) return 'No symptom entries in the last 30 days.';

  const last30 = entries
    .filter(e => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return e.date >= cutoff.toISOString().slice(0, 10);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  if (last30.length === 0) return 'No symptom entries in the last 30 days.';

  // Group by symptom
  const bySymptom: Record<string, { count: number; avgSev: number; dates: string[] }> = {};
  for (const e of last30) {
    const key = `${e.symptomName} (${e.conditionName})`;
    if (!bySymptom[key]) bySymptom[key] = { count: 0, avgSev: 0, dates: [] };
    bySymptom[key].count++;
    bySymptom[key].avgSev += e.severity;
    if (bySymptom[key].dates.length < 3) bySymptom[key].dates.push(e.date);
  }

  const lines = Object.entries(bySymptom).map(([name, data]) => {
    const avg = (data.avgSev / data.count).toFixed(1);
    return `- ${name}: ${data.count} occurrences, avg severity ${avg}/10, recent dates: ${data.dates.join(', ')}`;
  });

  return `Last 30 days (${last30.length} total entries):\n${lines.join('\n')}`;
}

function summarizeCheckIns(checkIns: DailyCheckIn[]): string {
  const last14 = checkIns
    .filter(c => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);
      return c.date >= cutoff.toISOString().slice(0, 10);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (last14.length === 0) return 'No check-in data available.';

  const avgSleep = (last14.reduce((s, c) => s + c.sleepHours, 0) / last14.length).toFixed(1);
  const avgEnergy = (last14.reduce((s, c) => s + c.energy, 0) / last14.length).toFixed(1);
  const avgMood = (last14.reduce((s, c) => s + c.mood, 0) / last14.length).toFixed(1);
  const avgHealth = (last14.reduce((s, c) => s + c.healthScore, 0) / last14.length).toFixed(1);
  const stressCounts = { low: 0, medium: 0, high: 0 };
  last14.forEach(c => stressCounts[c.stress]++);

  return `Last 14 days (${last14.length} check-ins): avg sleep ${avgSleep}h, avg energy ${avgEnergy}/10, avg mood ${avgMood}/10, avg health ${avgHealth}/10, stress: ${stressCounts.low} low / ${stressCounts.medium} medium / ${stressCounts.high} high`;
}

function summarizeMedications(medications: MedicationLog[]): string {
  if (medications.length === 0) return 'No medications logged.';

  const last30 = medications
    .filter(m => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return m.date >= cutoff.toISOString().slice(0, 10);
    });

  if (last30.length === 0) return 'No recent medication logs.';

  const byName: Record<string, { count: number; effectiveness: string[] }> = {};
  for (const m of last30) {
    if (!byName[m.name]) byName[m.name] = { count: 0, effectiveness: [] };
    byName[m.name].count++;
    byName[m.name].effectiveness.push(m.effectiveness);
  }

  return Object.entries(byName)
    .map(([name, data]) => `- ${name}: ${data.count} doses, effectiveness: ${data.effectiveness.join(', ')}`)
    .join('\n');
}

export async function generateInsights(input: InsightInput): Promise<AIInsight[]> {
  const { patientName, diagnosis, entries, checkIns, medications, conditions } = input;

  const conditionList = conditions.map(c =>
    `${c.name} (tracking: ${c.symptoms.map(s => s.name).join(', ')})`
  ).join('\n');

  const prompt = `You are a knowledgeable health advisor assistant. A patient is using a symptom tracking app and wants insights about their symptoms in the context of their medical background.

IMPORTANT GUIDELINES:
- Provide actionable, specific insights based on the data patterns
- Relate observations to the patient's medical background when relevant
- Flag concerning patterns that may warrant medical attention
- Suggest practical tips for symptom management
- NEVER provide diagnosis or claim certainty — always recommend consulting their doctor
- Keep each insight concise (1-3 sentences)

PATIENT: ${patientName}
MEDICAL BACKGROUND: ${diagnosis}

CONDITIONS BEING TRACKED:
${conditionList}

SYMPTOM DATA:
${summarizeEntries(entries)}

WELLNESS CHECK-INS:
${summarizeCheckIns(checkIns)}

MEDICATIONS:
${summarizeMedications(medications)}

Respond with a JSON array of 3-5 insights. Each insight must have:
- "content": the insight text (1-3 sentences)
- "category": one of "alert", "tip", "pattern", "medication"
- "severity": one of "urgent" (needs medical attention), "warning" (notable concern), "info" (general observation/tip)

Use "urgent" sparingly — only for patterns that genuinely suggest the patient should contact their healthcare provider soon.

Respond ONLY with a valid JSON array, no other text.`;

  const response = await fetch('/.netlify/functions/claude-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
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

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse AI response. Please try again.');

  const parsed: ClaudeInsightItem[] = JSON.parse(jsonMatch[0]);
  const patientId = entries[0]?.patientId ?? '';
  const now = Date.now();

  return parsed.map((item, i) => ({
    id: `ai-${now}-${i}`,
    patientId,
    content: item.content,
    category: item.category,
    severity: item.severity,
    generatedAt: now,
  }));
}
