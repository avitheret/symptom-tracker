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
