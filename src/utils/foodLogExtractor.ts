/**
 * foodLogExtractor — extract structured meal data from a voice transcript.
 * Calls the Claude proxy and returns mealType + food items.
 */
import type { MealType } from '../types';

export interface ExtractedFoodLog {
  mealType: MealType;
  foods: string[];
  notes: string;
}

/**
 * Extract a clock time from a spoken transcript and return it as HH:MM (24h).
 * Returns null when no time phrase is found.
 *
 * Handles:
 *   Named anchors  — "at noon" (12:00), "at midnight" (00:00),
 *                    "at lunchtime" (12:00), "at dinnertime" (18:00),
 *                    "at breakfast time" (08:00)
 *   "half X"       — "at half 2" → 14:30 (1–6 → PM, 7–11 → AM, 12 → 12:30)
 *   12-hour am/pm  — "at 2pm", "at 2:30pm", "at 2 pm"
 *   24-hour        — "at 14:00", "at 09:30"
 */
export function extractTimeFromTranscript(text: string): string | null {
  const t = text.toLowerCase();

  // 1. Named anchor times (checked before numeric patterns to avoid false matches)
  if (/\b(?:at\s+)?breakfast\s*time\b/.test(t))              return '08:00';
  if (/\b(?:at\s+)?(?:dinner\s*time|dinnertime)\b/.test(t)) return '18:00';
  if (/\b(?:at\s+)?lunchtime\b/.test(t))                    return '12:00';
  if (/\b(?:at\s+)?noon\b/.test(t))                         return '12:00';
  if (/\b(?:at\s+)?midnight\b/.test(t))                     return '00:00';

  // 2. "at half X" — British English shorthand for X:30
  //    1–6  → assume PM (14:30 for "half 2", meal-context heuristic)
  //    7–11 → assume AM (07:30 for "half 7")
  //    12   → 12:30
  const halfM = t.match(/\bat\s+half\s+(\d{1,2})\b/);
  if (halfM) {
    let h = parseInt(halfM[1], 10);
    if (h === 12) return '12:30';
    if (h >= 1 && h <= 6) h += 12;   // PM
    // h 7–11 stays as AM
    return `${String(h).padStart(2, '0')}:30`;
  }

  // 3. 12-hour with explicit am/pm: "at 2pm", "at 2:30pm", "at 10:15 am"
  const ampmM = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (ampmM) {
    let h  = parseInt(ampmM[1], 10);
    const m = parseInt(ampmM[2] ?? '0', 10);
    if (ampmM[3] === 'am') { if (h === 12) h = 0; }
    else                   { if (h !== 12) h += 12; }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // 4. 24-hour: "at 14:00", "at 09:30" — only when no am/pm follows
  const h24M = t.match(/\bat\s+((?:0?\d|1\d|2[0-3])):([0-5]\d)\b(?!\s*(?:am|pm))/);
  if (h24M) {
    const h = parseInt(h24M[1], 10);
    const m = parseInt(h24M[2], 10);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return null;
}

/** Guess meal type from current hour if Claude can't determine it. */
export function guessMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 6  && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 17 && h < 21) return 'dinner';
  return 'snack';
}

export async function extractFoodLog(transcript: string): Promise<ExtractedFoodLog> {
  const prompt = `Extract structured meal information from this voice note. Return ONLY valid JSON.

Voice note: "${transcript}"

Rules:
- mealType must be exactly one of: "breakfast", "lunch", "dinner", "snack"
- Infer mealType from context clues (e.g. "morning coffee" → breakfast, "had with my salad at noon" → lunch)
- foods: array of individual food/drink items, each capitalised (e.g. ["Pasta", "Garlic bread", "Red wine"])
- notes: any extra context not captured in foods (e.g. portion size, how it made them feel, where they ate). Empty string if none.

Respond with ONLY this JSON:
{"mealType": "lunch", "foods": ["Item 1", "Item 2"], "notes": ""}`;

  const response = await fetch('/.netlify/functions/claude-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    let msg = `Server error (${response.status})`;
    try { const e = await response.json(); if (e?.error) msg = e.error; } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse response.');

  const parsed = JSON.parse(match[0]) as Partial<ExtractedFoodLog>;
  const validMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  return {
    mealType: validMealTypes.includes(parsed.mealType as MealType) ? parsed.mealType as MealType : guessMealType(),
    foods: Array.isArray(parsed.foods) ? parsed.foods.filter(Boolean) : [],
    notes: parsed.notes ?? '',
  };
}
