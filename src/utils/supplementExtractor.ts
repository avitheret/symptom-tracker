/**
 * supplementExtractor — extract structured supplement data from a voice transcript.
 * Lightweight local extraction (no AI proxy needed).
 */
import { extractTimeFromTranscript } from './foodLogExtractor';

export interface ExtractedSupplement {
  name?: string;
  dosage?: string;
  time?: string;    // HH:MM 24h
  notes?: string;
}

// ── Meal reference → time mapping ─────────────────────────────────────────────
const MEAL_TIME_MAP: Array<{ pattern: RegExp; time: string }> = [
  { pattern: /\bwith\s+breakfast\b/i, time: '08:00' },
  { pattern: /\bwith\s+lunch\b/i,    time: '12:00' },
  { pattern: /\bwith\s+dinner\b/i,   time: '18:00' },
  { pattern: /\bbefore\s+bed\b/i,    time: '22:00' },
  { pattern: /\bat\s+bedtime\b/i,    time: '22:00' },
];

// ── Dosage patterns ────────────────────────────────────────────────────────────
// Matches: "1000mg", "500 IU", "2 capsules", "1 tablet", "2.5ml", "2 gummies"
const DOSAGE_RE = /\b(\d+(?:\.\d+)?)\s*(mg|mcg|ug|µg|iu|ml|g|capsule|capsules|tablet|tablets|gummy|gummies|drop|drops|scoop|scoops|softgel|softgels)\b/i;

// ── Known supplement names ────────────────────────────────────────────────────
// Each entry is [regex, canonical name].
const KNOWN_SUPPLEMENTS: Array<[RegExp, string]> = [
  [/\bvitamin\s*d3?\b/i,        'Vitamin D'],
  [/\bvitamin\s*d2\b/i,         'Vitamin D2'],
  [/\bvitamin\s*c\b/i,          'Vitamin C'],
  [/\bvitamin\s*b12\b/i,        'Vitamin B12'],
  [/\bvitamin\s*b6\b/i,         'Vitamin B6'],
  [/\bvitamin\s*b\s*complex\b/i, 'Vitamin B Complex'],
  [/\bvitamin\s*a\b/i,          'Vitamin A'],
  [/\bvitamin\s*e\b/i,          'Vitamin E'],
  [/\bvitamin\s*k\b/i,          'Vitamin K'],
  [/\bd2\b/i,                    'Vitamin D2'],
  [/\bd3\b/i,                    'Vitamin D3'],
  [/\bomega[\s-]*3\b/i,         'Omega-3'],
  [/\bfish\s*oil\b/i,           'Fish Oil'],
  [/\bmagnesium\b/i,            'Magnesium'],
  [/\bcalcium\b/i,              'Calcium'],
  [/\biron\b/i,                  'Iron'],
  [/\bzinc\b/i,                  'Zinc'],
  [/\bselenium\b/i,             'Selenium'],
  [/\bpotassium\b/i,            'Potassium'],
  [/\bprobiotic\b/i,            'Probiotic'],
  [/\bprebiotic\b/i,            'Prebiotic'],
  [/\bturmeric\b/i,             'Turmeric'],
  [/\bcurcumin\b/i,             'Curcumin'],
  [/\bashwagandha\b/i,          'Ashwagandha'],
  [/\bmelatonin\b/i,            'Melatonin'],
  [/\bcreatine\b/i,             'Creatine'],
  [/\bcollagen\b/i,             'Collagen'],
  [/\bbiotin\b/i,               'Biotin'],
  [/\bfolic\s*acid\b/i,         'Folic Acid'],
  [/\bfolate\b/i,               'Folate'],
  [/\bcoq10\b/i,                'CoQ10'],
  [/\bglucosamine\b/i,          'Glucosamine'],
  [/\bchondroitin\b/i,          'Chondroitin'],
  [/\bspirulina\b/i,            'Spirulina'],
  [/\bchlorella\b/i,            'Chlorella'],
  [/\bl[\s-]*theanine\b/i,      'L-Theanine'],
  [/\bwhey\s*protein\b/i,       'Whey Protein'],
  [/\bprotein\s*powder\b/i,     'Protein Powder'],
  [/\bmultivitamin\b/i,         'Multivitamin'],
];

/**
 * Extract supplement log data from a voice transcript.
 * Returns an object with whichever fields could be extracted.
 */
export function extractSupplementLog(transcript: string): ExtractedSupplement {
  const result: ExtractedSupplement = {};

  // 1. Extract time — reuse the food-log extractor (covers "at 2pm", "at noon", etc.)
  const clockTime = extractTimeFromTranscript(transcript);
  if (clockTime) result.time = clockTime;

  // 1b. Meal-reference times ("with breakfast", "before bed")
  if (!result.time) {
    for (const { pattern, time } of MEAL_TIME_MAP) {
      if (pattern.test(transcript)) {
        result.time = time;
        break;
      }
    }
  }

  // 2. Extract dosage
  const dosageMatch = transcript.match(DOSAGE_RE);
  if (dosageMatch) {
    const amount = dosageMatch[1];
    let unit = dosageMatch[2];
    // Normalise unit
    if (/^iu$/i.test(unit)) unit = 'IU';
    else if (/^(mg|mcg|ug|µg|ml|g)$/i.test(unit)) unit = unit.toLowerCase();
    result.dosage = `${amount} ${unit}`;
  }

  // 3. Extract supplement name from known list
  for (const [re, canonical] of KNOWN_SUPPLEMENTS) {
    if (re.test(transcript)) {
      result.name = canonical;
      break;
    }
  }

  // 4. Collect leftover as notes — strip known parts
  let remaining = transcript;
  // Strip time phrases
  remaining = remaining.replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '');
  remaining = remaining.replace(/\bwith\s+(?:breakfast|lunch|dinner)\b/gi, '');
  remaining = remaining.replace(/\bbefore\s+bed\b/gi, '');
  remaining = remaining.replace(/\bat\s+bedtime\b/gi, '');
  // Strip dosage
  if (dosageMatch) remaining = remaining.replace(DOSAGE_RE, '');
  // Strip supplement name (the matched regex)
  if (result.name) {
    for (const [re] of KNOWN_SUPPLEMENTS) {
      if (re.test(remaining)) { remaining = remaining.replace(re, ''); break; }
    }
  }
  // Strip command words
  remaining = remaining
    .replace(/\b(?:log|add|record|took|take|taking|had|have)\b/gi, '')
    .replace(/\b(?:supplement|vitamin|mineral)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (remaining.length > 2) result.notes = remaining;

  return result;
}
