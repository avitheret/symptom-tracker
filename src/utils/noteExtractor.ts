import type {
  Condition, ExtractionResult, ExtractionTimestamp,
  ExtractedSymptom, ExtractedMedication, ExtractedTrigger, ExtractedCheckIn,
  ExtractedItem,
} from '../types';

// ── Known Medications ───────────────────────────────────────────────────────
const KNOWN_MEDICATIONS: Record<string, string> = {
  ibuprofen: 'Ibuprofen', advil: 'Ibuprofen', motrin: 'Ibuprofen',
  acetaminophen: 'Acetaminophen', tylenol: 'Acetaminophen', paracetamol: 'Acetaminophen',
  aspirin: 'Aspirin',
  naproxen: 'Naproxen', aleve: 'Naproxen',
  sumatriptan: 'Sumatriptan', imitrex: 'Sumatriptan',
  rizatriptan: 'Rizatriptan', maxalt: 'Rizatriptan',
  topiramate: 'Topiramate', topamax: 'Topiramate',
  amitriptyline: 'Amitriptyline',
  propranolol: 'Propranolol',
  metoprolol: 'Metoprolol',
  gabapentin: 'Gabapentin', neurontin: 'Gabapentin',
  pregabalin: 'Pregabalin', lyrica: 'Pregabalin',
  duloxetine: 'Duloxetine', cymbalta: 'Duloxetine',
  sertraline: 'Sertraline', zoloft: 'Sertraline',
  fluoxetine: 'Fluoxetine', prozac: 'Fluoxetine',
  omeprazole: 'Omeprazole', prilosec: 'Omeprazole',
  loratadine: 'Loratadine', claritin: 'Loratadine',
  cetirizine: 'Cetirizine', zyrtec: 'Cetirizine',
  diphenhydramine: 'Diphenhydramine', benadryl: 'Diphenhydramine',
  melatonin: 'Melatonin',
  metformin: 'Metformin',
  lisinopril: 'Lisinopril',
  atorvastatin: 'Atorvastatin', lipitor: 'Atorvastatin',
  prednisone: 'Prednisone',
  amoxicillin: 'Amoxicillin',
  hydroxyzine: 'Hydroxyzine',
  cyclobenzaprine: 'Cyclobenzaprine', flexeril: 'Cyclobenzaprine',
  magnesium: 'Magnesium',
  'vitamin d': 'Vitamin D',
  'vitamin b12': 'Vitamin B12',
  zinc: 'Zinc',
  'fish oil': 'Fish Oil',
  turmeric: 'Turmeric',
  cbd: 'CBD',
  excedrin: 'Excedrin',
};

// ── Trigger Keywords ────────────────────────────────────────────────────────
const TRIGGER_KEYWORDS: Record<string, string> = {
  stress: 'Stress', stressed: 'Stress', stressful: 'Stress', tense: 'Stress', tension: 'Stress',
  'poor sleep': 'Poor sleep', insomnia: 'Poor sleep', sleepless: 'Poor sleep',
  alcohol: 'Alcohol', beer: 'Alcohol', wine: 'Alcohol', whiskey: 'Alcohol', vodka: 'Alcohol',
  'weather change': 'Weather change', weather: 'Weather change', humid: 'Weather change',
  storm: 'Weather change', barometric: 'Weather change',
  exercise: 'Exercise', workout: 'Exercise', gym: 'Exercise', running: 'Exercise',
  caffeine: 'Caffeine', coffee: 'Caffeine',
  'screen time': 'Screen time', screens: 'Screen time',
  'food': 'Food/Diet', 'junk food': 'Food/Diet', spicy: 'Food/Diet',
  period: 'Hormonal', menstrual: 'Hormonal', hormonal: 'Hormonal', pms: 'Hormonal',
};

// ── Severity Keywords ───────────────────────────────────────────────────────
const SEVERITY_WORDS: Record<string, number> = {
  slight: 2, light: 2, mild: 3, minor: 3,
  moderate: 5, medium: 5,
  bad: 6, strong: 7, serious: 7,
  severe: 8, intense: 8,
  terrible: 9, horrible: 9, awful: 9,
  excruciating: 10, unbearable: 10, worst: 10, extreme: 10,
};

// ── Symptom Aliases ─────────────────────────────────────────────────────────
// Maps common spoken/written phrases → symptom names from PREDEFINED_CONDITIONS
const SYMPTOM_ALIASES: Record<string, string[]> = {
  'Throbbing headache': ['headache', 'head pain', 'head ache'],
  'Nausea': ['nausea', 'nauseous', 'queasy', 'sick to my stomach'],
  'Light sensitivity': ['light sensitivity', 'photophobia', 'sensitive to light'],
  'Sound sensitivity': ['sound sensitivity', 'noise sensitivity', 'phonophobia'],
  'Visual aura': ['visual aura', 'aura'],
  'Vomiting': ['vomiting', 'throwing up', 'threw up', 'vomited'],
  'Neck stiffness': ['neck stiffness', 'stiff neck', 'neck pain'],
  'Dizziness': ['dizziness', 'dizzy', 'lightheaded', 'vertigo'],
  'Abdominal pain': ['abdominal pain', 'stomach pain', 'stomach ache', 'belly pain', 'stomach cramps'],
  'Bloating': ['bloating', 'bloated', 'gassy'],
  'Diarrhea': ['diarrhea', 'loose stools'],
  'Constipation': ['constipation', 'constipated'],
  'Cramping': ['cramping', 'cramps'],
  'Joint pain': ['joint pain', 'joint ache', 'aching joints'],
  'Joint stiffness': ['joint stiffness', 'stiff joints'],
  'Swelling': ['swelling', 'swollen'],
  'Morning stiffness': ['morning stiffness'],
  'Fatigue': ['fatigue', 'exhausted', 'tiredness', 'worn out', 'fatigued'],
  'Shortness of breath': ['shortness of breath', 'breathless', "can't breathe", 'difficulty breathing'],
  'Wheezing': ['wheezing', 'wheeze'],
  'Chest tightness': ['chest tightness', 'chest tight', 'tight chest'],
  'Coughing': ['coughing', 'cough'],
  'Increased thirst': ['increased thirst', 'very thirsty', 'thirsty'],
  'Frequent urination': ['frequent urination', 'peeing a lot'],
  'Blurred vision': ['blurred vision', 'blurry vision', 'vision problems'],
  'Excessive worry': ['excessive worry', 'worrying', 'worried'],
  'Restlessness': ['restlessness', 'restless', 'agitated'],
  'Racing heart': ['racing heart', 'heart racing', 'palpitations', 'rapid heartbeat'],
  'Sweating': ['sweating', 'sweaty', 'perspiring'],
  'Trembling': ['trembling', 'tremors', 'shaking'],
  'Difficulty concentrating': ['difficulty concentrating', "can't concentrate", 'brain fog', 'foggy'],
  'Sleep disturbance': ['sleep disturbance', 'trouble sleeping', "can't sleep"],
  'Persistent sadness': ['sadness', 'feeling sad', 'feeling down', 'depressed'],
  'Loss of interest': ['loss of interest', 'no interest', 'apathy'],
  'Widespread pain': ['widespread pain', 'body pain', 'pain all over', 'all over pain'],
  'Cognitive difficulties (fog)': ['brain fog', 'cognitive difficulties', 'mental fog', 'foggy thinking'],
  'Itching': ['itching', 'itchy', 'pruritus'],
  'Dry skin': ['dry skin'],
  'Redness': ['redness', 'red skin', 'inflamed skin'],
  'Rash': ['rash', 'skin rash', 'hives'],
  'Butterfly rash': ['butterfly rash', 'face rash', 'facial rash'],
  'Hair loss': ['hair loss', 'losing hair'],
  'Headache': ['headache', 'head pain'],
  'Nosebleeds': ['nosebleed', 'nosebleeds', 'nose bleed'],
  'Flushing': ['flushing', 'face flushing', 'hot flush'],
  'Mouth sores': ['mouth sores', 'mouth ulcers'],
  'Fever': ['fever', 'high temperature', 'febrile'],
};

// ── Time Parsing ────────────────────────────────────────────────────────────

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseTimestamp(text: string, noteDate: Date): ExtractionTimestamp {
  const lower = text.toLowerCase();

  // "at 3 PM", "at 3:30 pm", "at 8", "around 3 PM"
  const amPm = lower.match(/\b(?:at|around|about)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (amPm) {
    let h = parseInt(amPm[1]);
    const m = parseInt(amPm[2] ?? '0');
    if (amPm[3] === 'pm' && h < 12) h += 12;
    if (amPm[3] === 'am' && h === 12) h = 0;
    return { date: formatDateStr(noteDate), time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, inferred: false };
  }

  // Bare "3 PM" / "8:30 am" not preceded by "at"
  const bareAmPm = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (bareAmPm) {
    let h = parseInt(bareAmPm[1]);
    const m = parseInt(bareAmPm[2] ?? '0');
    if (bareAmPm[3] === 'pm' && h < 12) h += 12;
    if (bareAmPm[3] === 'am' && h === 12) h = 0;
    return { date: formatDateStr(noteDate), time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, inferred: false };
  }

  // "at 14:30"
  const h24 = lower.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
  if (h24) {
    return { date: formatDateStr(noteDate), time: `${String(parseInt(h24[1])).padStart(2, '0')}:${h24[2]}`, inferred: false };
  }

  // Relative time phrases
  if (/\bthis morning\b|early morning|early today/.test(lower))
    return { date: formatDateStr(noteDate), time: '08:00', inferred: true };
  if (/\bthis afternoon\b|after lunch|midday|around noon/.test(lower))
    return { date: formatDateStr(noteDate), time: '13:00', inferred: true };
  if (/\bthis evening\b|tonight/.test(lower))
    return { date: formatDateStr(noteDate), time: '19:00', inferred: true };
  if (/\blast night\b/.test(lower)) {
    const yesterday = new Date(noteDate);
    yesterday.setDate(yesterday.getDate() - 1);
    return { date: formatDateStr(yesterday), time: '22:00', inferred: true };
  }

  // Default: note creation time
  return { date: formatDateStr(noteDate), time: formatTimeStr(noteDate), inferred: true };
}

// ── Severity Parsing ────────────────────────────────────────────────────────

function parseSeverity(text: string): { severity: number; found: boolean } {
  const lower = text.toLowerCase();
  for (const [word, value] of Object.entries(SEVERITY_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) {
      return { severity: value, found: true };
    }
  }
  // Numeric: "7/10", "severity 8", "pain level 6"
  const numMatch = lower.match(/\b(?:severity|pain\s+level|level)\s+(\d{1,2})\b/) ??
                   lower.match(/\b(\d{1,2})\s*\/\s*10\b/);
  if (numMatch) {
    const n = Math.min(10, Math.max(1, parseInt(numMatch[1])));
    return { severity: n, found: true };
  }
  return { severity: 5, found: false };
}

// ── Symptom Extraction ──────────────────────────────────────────────────────

function extractSymptoms(text: string, conditions: Condition[]): ExtractedSymptom[] {
  const lower = text.toLowerCase();
  const results: ExtractedSymptom[] = [];
  const seen = new Set<string>(); // prevent duplicates by symptomId
  const { severity: globalSeverity, found: severityFound } = parseSeverity(text);
  let counter = 0;

  for (const condition of conditions) {
    for (const symptom of condition.symptoms) {
      if (seen.has(symptom.id)) continue;

      // Get alias keywords for this symptom name, or fall back to the name itself
      const aliases = SYMPTOM_ALIASES[symptom.name] ?? [symptom.name.toLowerCase()];

      for (const alias of aliases) {
        // Word-boundary match for multi-word aliases, contains for single words ≥5 chars
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) {
          seen.add(symptom.id);
          results.push({
            type: 'symptom',
            id: `es-${counter++}`,
            symptomId: symptom.id,
            symptomName: symptom.name,
            conditionId: condition.id,
            conditionName: condition.name,
            severity: globalSeverity,
            inferredSeverity: !severityFound,
            matchedText: alias,
          });
          break; // found this symptom, no need to check more aliases
        }
      }
    }
  }

  return results;
}

// ── Medication Extraction ───────────────────────────────────────────────────

function extractMedications(text: string): ExtractedMedication[] {
  const lower = text.toLowerCase();
  const results: ExtractedMedication[] = [];
  const seen = new Set<string>(); // by canonical name
  let counter = 0;

  // Match known medications
  // Sort by key length descending so "vitamin b12" matches before "vitamin"
  const sortedKeys = Object.keys(KNOWN_MEDICATIONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const canonical = KNOWN_MEDICATIONS[key];
    if (seen.has(canonical)) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) {
      seen.add(canonical);

      // Try to find dosage nearby: "400mg", "400 mg", "2 tablets"
      let dosage = '';
      const dosageRe = new RegExp(
        `${escaped}\\s+(?:of\\s+)?(\\d+(?:\\.\\d+)?\\s*(?:mg|g|ml|mcg|tablets?|pills?|caps?|capsules?|drops?|puffs?))`,
        'i'
      );
      const dosageMatch = lower.match(dosageRe);
      if (dosageMatch) {
        dosage = dosageMatch[1].trim();
      } else {
        // Try dosage before the medication name: "400mg ibuprofen"
        const preDosageRe = new RegExp(
          `(\\d+(?:\\.\\d+)?\\s*(?:mg|g|ml|mcg))\\s+(?:of\\s+)?${escaped}`,
          'i'
        );
        const preMatch = lower.match(preDosageRe);
        if (preMatch) dosage = preMatch[1].trim();
      }

      results.push({
        type: 'medication',
        id: `em-${counter++}`,
        name: canonical,
        dosage,
        matchedText: key,
      });
    }
  }

  // Also look for "took X" pattern where X might not be in our dictionary
  const tookMatch = lower.match(/\btook\s+(?:an?\s+)?([a-z][a-z\s]{2,20}?)(?:\s+\d|\s*$|[.,;])/);
  if (tookMatch) {
    const candidate = tookMatch[1].trim();
    // Only add if not already found and not a common non-medication word
    const skip = new Set(['my', 'the', 'some', 'a', 'an', 'it', 'nap', 'walk', 'break', 'bath', 'shower', 'rest', 'day off', 'note']);
    if (!seen.has(candidate) && !skip.has(candidate) && candidate.length > 2) {
      // Check if it's close enough to a known medication
      const matchedKnown = sortedKeys.find(k => candidate.includes(k) || k.includes(candidate));
      if (matchedKnown && !seen.has(KNOWN_MEDICATIONS[matchedKnown])) {
        seen.add(KNOWN_MEDICATIONS[matchedKnown]);
        results.push({
          type: 'medication',
          id: `em-${counter++}`,
          name: KNOWN_MEDICATIONS[matchedKnown],
          dosage: '',
          matchedText: candidate,
        });
      }
    }
  }

  return results;
}

// ── Trigger Extraction ──────────────────────────────────────────────────────

function extractTriggers(text: string): ExtractedTrigger[] {
  const lower = text.toLowerCase();
  const results: ExtractedTrigger[] = [];
  const seen = new Set<string>(); // by trigger name
  let counter = 0;

  // Sort by key length descending so multi-word triggers match first
  const sortedKeys = Object.keys(TRIGGER_KEYWORDS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const triggerName = TRIGGER_KEYWORDS[key];
    if (seen.has(triggerName)) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) {
      seen.add(triggerName);
      results.push({
        type: 'trigger',
        id: `et-${counter++}`,
        triggerName,
        matchedText: key,
      });
    }
  }

  return results;
}

// ── Check-In Extraction ─────────────────────────────────────────────────────

function extractCheckIn(text: string): ExtractedCheckIn | null {
  const lower = text.toLowerCase();
  const fields: ExtractedCheckIn = {
    type: 'checkin',
    id: 'ec-0',
    matchedFields: [],
  };

  // Stress
  if (/\bstress\s+(?:was\s+|is\s+|level\s+)?(?:very\s+)?high\b|very\s+stressed|high\s+stress/.test(lower)) {
    fields.stress = 'high'; fields.matchedFields.push('stress');
  } else if (/\bstress\s+(?:was\s+|is\s+)?(?:low|minimal)\b|low\s+stress|not\s+(?:very\s+)?stressed/.test(lower)) {
    fields.stress = 'low'; fields.matchedFields.push('stress');
  } else if (/\bstress\s+(?:was\s+|is\s+)?(?:medium|moderate|some)\b|somewhat\s+stressed|a\s+bit\s+stressed/.test(lower)) {
    fields.stress = 'medium'; fields.matchedFields.push('stress');
  }

  // Sleep hours: "slept 4 hours", "4 hours of sleep", "got 6 hours sleep"
  const sleepMatch = lower.match(/\bslept?\s+(?:only\s+|about\s+|around\s+)?(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\b/) ??
                     lower.match(/\b(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\s+(?:of\s+)?sleep\b/) ??
                     lower.match(/\bgot\s+(?:only\s+)?(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\b/);
  if (sleepMatch) {
    fields.sleepHours = Math.min(24, parseFloat(sleepMatch[1]));
    fields.matchedFields.push('sleep');
  }

  // Energy
  if (/\benergy\s+(?:was\s+|is\s+)?(?:low|poor|bad|terrible)\b|low\s+energy|no\s+energy|drained|exhausted/.test(lower)) {
    fields.energy = 3; fields.matchedFields.push('energy');
  } else if (/\benergy\s+(?:was\s+|is\s+)?(?:high|great|good)\b|high\s+energy|energetic|full\s+of\s+energy/.test(lower)) {
    fields.energy = 8; fields.matchedFields.push('energy');
  } else if (/\benergy\s+(?:was\s+|is\s+)?(?:medium|moderate|ok(?:ay)?)\b/.test(lower)) {
    fields.energy = 5; fields.matchedFields.push('energy');
  }

  // Mood
  if (/\bmood\s+(?:was\s+|is\s+)?(?:bad|low|poor|sad|terrible|down)\b|feeling\s+(?:sad|down|depressed|low|awful|terrible)/.test(lower)) {
    fields.mood = 3; fields.matchedFields.push('mood');
  } else if (/\bmood\s+(?:was\s+|is\s+)?(?:good|great|happy|fine|positive|excellent)\b|feeling\s+(?:good|great|happy|positive|fine)/.test(lower)) {
    fields.mood = 8; fields.matchedFields.push('mood');
  } else if (/\bmood\s+(?:was\s+|is\s+)?(?:ok(?:ay)?|average|so-so|meh)\b/.test(lower)) {
    fields.mood = 5; fields.matchedFields.push('mood');
  }

  // Health score: "overall 7/10", "health 6/10"
  const scoreMatch = lower.match(/\b(?:overall|health|health\s+score)\s+(\d{1,2})\s*\/\s*10\b/);
  if (scoreMatch) {
    fields.healthScore = Math.min(10, Math.max(1, parseInt(scoreMatch[1])));
    fields.matchedFields.push('healthScore');
  }

  return fields.matchedFields.length > 0 ? fields : null;
}

// ── Main Extraction Function ────────────────────────────────────────────────

export function extractFromNote(
  noteId: string,
  text: string,
  conditions: Condition[],
  noteDate: Date,
): ExtractionResult {
  const items: ExtractedItem[] = [];

  // 1. Symptoms
  items.push(...extractSymptoms(text, conditions));

  // 2. Medications
  items.push(...extractMedications(text));

  // 3. Triggers (skip if already matched as check-in stress)
  const triggers = extractTriggers(text);
  items.push(...triggers);

  // 4. Check-in data
  const checkIn = extractCheckIn(text);
  if (checkIn) items.push(checkIn);

  // 5. Timestamp
  const timestamp = parseTimestamp(text, noteDate);

  return {
    noteId,
    noteText: text,
    extractedAt: Date.now(),
    timestamp,
    items,
    hasItems: items.length > 0,
  };
}
