/**
 * nlpVoiceParser — Free-form NLP voice transcript parsing via Claude API.
 *
 * Sends raw voice transcript to Claude for structured extraction of:
 * symptoms, medications, supplements, and notes.
 */
import type { Condition, MedicationSchedule, SupplementSchedule } from '../types';

// ── Result types ────────────────────────────────────────────────────────────

export interface ParsedSymptom {
  symptomName: string;
  conditionHint?: string;   // matched condition name if identifiable
  severity: number;         // 1–10
  notes?: string;
}

export interface ParsedMedication {
  name: string;
  dosage?: string;
  route?: string;
}

export interface ParsedSupplement {
  name: string;
  dosage?: string;
}

export interface NLPParseResult {
  symptoms: ParsedSymptom[];
  medications: ParsedMedication[];
  supplements: ParsedSupplement[];
  notes: string;
  confidence: 'high' | 'medium' | 'low';
  transcript: string;
}

// ── Context builder ─────────────────────────────────────────────────────────

interface ParseContext {
  conditions: Condition[];
  medicationSchedules: MedicationSchedule[];
  supplementSchedules: SupplementSchedule[];
}

function buildContextBlock(ctx: ParseContext): string {
  const conditionLines = ctx.conditions.map(c =>
    `  - ${c.name}: symptoms=[${c.symptoms.map(s => s.name).join(', ')}]`
  ).join('\n');

  const medLines = ctx.medicationSchedules
    .filter(m => m.status === 'active')
    .map(m => `  - ${m.name} (${m.dosage || 'unknown dose'})`)
    .join('\n');

  const suppLines = ctx.supplementSchedules
    .filter(s => s.status === 'active')
    .map(s => `  - ${s.name} (${s.dosage || 'unknown dose'})`)
    .join('\n');

  return [
    conditionLines ? `KNOWN CONDITIONS & SYMPTOMS:\n${conditionLines}` : '',
    medLines ? `ACTIVE MEDICATIONS:\n${medLines}` : '',
    suppLines ? `ACTIVE SUPPLEMENTS:\n${suppLines}` : '',
  ].filter(Boolean).join('\n\n');
}

// ── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(transcript: string, ctx: ParseContext): string {
  const context = buildContextBlock(ctx);

  return `You are a medical symptom tracker assistant. Parse the following voice transcript into structured data.

${context ? `The user tracks these:\n${context}\n` : ''}
VOICE TRANSCRIPT: "${transcript}"

Extract ALL of the following from the transcript. Return ONLY a JSON object, no other text.

{
  "symptoms": [
    { "symptomName": "string", "conditionHint": "string or null", "severity": 1-10, "notes": "string or null" }
  ],
  "medications": [
    { "name": "string", "dosage": "string or null", "route": "string or null" }
  ],
  "supplements": [
    { "name": "string", "dosage": "string or null" }
  ],
  "notes": "any extra context or free text that doesn't fit above categories",
  "confidence": "high" | "medium" | "low"
}

RULES:
- Match to known conditions/symptoms/medications/supplements when possible (fuzzy match OK)
- If a severity number is mentioned ("level 8", "8 out of 10", "severity 8"), use it. Default to 5 if unspecified.
- "took" / "taken" / "had" before a medication or supplement name = log it
- If the transcript is ambiguous or you can't extract anything meaningful, set confidence to "low"
- Return empty arrays for categories with no matches — never omit fields
- For medication/supplement names, prefer the exact name from the known lists above
- Keep notes brief — capture what doesn't fit structured fields`;
}

// ── Main parser ─────────────────────────────────────────────────────────────

export async function parseVoiceTranscript(
  transcript: string,
  ctx: ParseContext,
): Promise<NLPParseResult> {
  const prompt = buildPrompt(transcript, ctx);

  const response = await fetch('/.netlify/functions/claude-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 401) throw new Error('AI service not configured');
    if (response.status === 429) throw new Error('Rate limited — try again in a moment');
    throw new Error(`API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '';

  // Parse JSON — handle markdown code blocks
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      symptoms: [],
      medications: [],
      supplements: [],
      notes: '',
      confidence: 'low',
      transcript,
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    symptoms:    Array.isArray(parsed.symptoms)    ? parsed.symptoms    : [],
    medications: Array.isArray(parsed.medications)  ? parsed.medications : [],
    supplements: Array.isArray(parsed.supplements)  ? parsed.supplements : [],
    notes:       typeof parsed.notes === 'string'   ? parsed.notes       : '',
    confidence:  ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    transcript,
  };
}

/** Quick check: does the result contain anything actionable? */
export function hasContent(result: NLPParseResult): boolean {
  return result.symptoms.length > 0
    || result.medications.length > 0
    || result.supplements.length > 0
    || result.notes.length > 0;
}
