import { useState, useEffect, useRef, useCallback } from 'react';
import { getSpeechRecognition } from '../utils/speech';
import type { MealType, MealPrefill, SupplementTimeWindow, SupplementDatabaseEntry } from '../types';
import { extractTimeFromTranscript } from '../utils/foodLogExtractor';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceState =
  | 'unsupported'       // SpeechRecognition API not in this browser
  | 'idle'              // Available but not listening
  | 'denied'            // Mic permission denied — show instructions
  | 'wake-listening'    // Listening quietly for wake word
  | 'command-listening' // Wake word heard — waiting for a command
  | 'confirmed';        // Command matched — brief confirmation state

export type VoiceCommand =
  | 'LOG_SYMPTOM'
  | 'CHECK_IN'
  | 'LOG_TRIGGER'
  | 'LOG_MEDICATION'
  | 'LOG_MEAL'
  | 'LOG_SUPPLEMENT'
  | 'OPEN_REPORTS'
  | 'OPEN_INSIGHTS'
  | 'OPEN_HOME'
  | 'OPEN_LOG'
  | 'OPEN_CONDITIONS'
  | 'OPEN_NOTES'
  | 'OPEN_SUPPLEMENTS'
  | 'ADD_NOTE'
  | 'CANCEL';

export interface CommandMatch {
  command: VoiceCommand;
  label: string;
}

/** Spoken supplement data extracted from a voice command. */
export interface SupplementPrefill {
  name?: string;              // e.g. "Vitamin D", "Magnesium"
  timeWindow?: SupplementTimeWindow;  // e.g. 'morning', 'breakfast'
  quantity?: string;          // e.g. "1000mg", "2 capsules"
}

/** Spoken symptom + condition extracted from an inline voice command. */
export interface SymptomPrefill {
  symptomName:   string;  // raw spoken name, fuzzy-matched in the caller
  conditionHint: string;  // raw spoken condition, fuzzy-matched in the caller
  severity?:     number;  // parsed from spoken word (mild→3, moderate→5, severe→7, extreme→9)
}

// MealPrefill is defined in src/types/index.ts and re-exported here for callers
// that import it from the hook (keeps their import paths stable).
export type { MealPrefill };

interface UseVoiceCommandsOptions {
  onCommand: (command: VoiceCommand, label: string, prefill?: SymptomPrefill, mealPrefill?: MealPrefill, supplementPrefill?: SupplementPrefill) => void;
  supplementDatabase?: SupplementDatabaseEntry[];
}

// ─── Debug logging ───────────────────────────────────────────────────────────
// Off by default. Enable with: localStorage.setItem('voice-debug', '1')

const VOICE_DEBUG = typeof window === 'undefined' ? false
  : localStorage.getItem('voice-debug') === '1';
function vlog(...args: unknown[]) {
  if (VOICE_DEBUG) console.log('[Voice]', ...args);
}

// ─── Wake phrase detection ────────────────────────────────────────────────────
// Two-layer approach:
//   1. Exact phrase list for fast matching of known STT outputs
//   2. Fuzzy regex fallback that catches any "hey/okay + tr*ck*" pattern,
//      so we don't need to enumerate every possible STT misrecognition.

const WAKE_PHRASES = [
  'hey tracker',
  'hey track',
  'okay tracker',
  'ok tracker',
  'a tracker',
  // Common STT misrecognitions (from real console logs)
  'hey tricker',    // #1 most frequent misrecognition on Chrome Desktop
  'hey trick',      // interim form — catches it before Chrome finalises to "tricker"
  'hey track her',
  'hey tractor',
  'a track her',
  'a tricker',
  'hey trigger',
  'hey trucker',
  'hey docker',
];

/**
 * Fuzzy regex: catches "hey/okay/ok + tr[aeiou]ck[a-z]*" patterns.
 * This handles any STT variant we haven't seen yet — e.g. "hey trecker",
 * "hey traker", "hey trooker", etc. The prefix group also matches common
 * STT mishearings of "hey" like "a" or "eh".
 */
const WAKE_FUZZY_RE = /(?:hey|okay|ok|a|eh)\s+tr[a-z]*ck[a-z]*/;

/**
 * Normalize text for wake phrase matching: strip punctuation, collapse spaces.
 * STT engines often emit "hey, tracker" or "hey tracker." which would fail a
 * raw `includes()` check against "hey tracker".
 */
function normalizeForWake(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')           // smart & straight apostrophes
    .replace(/[^\w\s]/g, ' ')       // all other punctuation → space
    .replace(/\s+/g, ' ')           // collapse multiple spaces
    .trim();
}

// ─── Command matching ─────────────────────────────────────────────────────────

const COMMAND_PATTERNS: Array<{ patterns: string[]; command: VoiceCommand; label: string }> = [
  {
    patterns: ['add log', 'log symptom', 'new symptom', 'add symptom', 'log a symptom', 'record symptom'],
    command: 'LOG_SYMPTOM',
    label: 'Log Symptom',
  },
  {
    patterns: ['check in', 'add check', 'daily check', 'checkin', 'check-in', 'daily check in'],
    command: 'CHECK_IN',
    label: 'Daily Check-In',
  },
  {
    patterns: ['log trigger', 'add trigger', 'new trigger', 'record trigger'],
    command: 'LOG_TRIGGER',
    label: 'Log Trigger',
  },
  {
    patterns: ['log med', 'add med', 'medication', 'log pill', 'add pill', 'log meds', 'add meds', 'log treatment', 'add treatment'],
    command: 'LOG_MEDICATION',
    label: 'Log Medication',
  },
  {
    patterns: ['log supplement', 'log supplements', 'add supplement', 'add supplements', 'log vitamin', 'add vitamin', 'log mineral', 'add mineral', 'log probiotic', 'log probiotics', 'add probiotic', 'add probiotics', 'log omega', 'add omega', 'log magnesium', 'add magnesium', 'log zinc', 'add zinc', 'log vitamin d', 'log vitamin c', 'supplement', 'took my vitamins', 'took my vitamin', 'took my supplement', 'took my supplements', 'took supplements', 'took my', 'took a', 'log my pills', 'add my pills', 'morning supplements', 'breakfast supplements', 'lunch supplements', 'dinner supplements', 'bedtime supplements'],
    command: 'LOG_SUPPLEMENT',
    label: 'Log Supplement',
  },
  {
    patterns: [
      'add meal', 'log meal', 'add a meal', 'log a meal', 'food log', 'log food', 'add food',
      'log breakfast', 'add breakfast',
      'log lunch',     'add lunch',
      'log dinner',    'add dinner',
      'log snack',     'add snack',
      'log brunch',    'add brunch',
      'log supper',    'add supper',
    ],
    command: 'LOG_MEAL',
    label: 'Log Meal',
  },
  {
    patterns: ['open report', 'go to report', 'show report', 'reports', 'view report'],
    command: 'OPEN_REPORTS',
    label: 'Open Reports',
  },
  {
    patterns: ['insight', 'open insight', 'show insight', 'view insight', 'analytics'],
    command: 'OPEN_INSIGHTS',
    label: 'Open Insights',
  },
  {
    patterns: ['go home', 'open home', 'dashboard', 'home screen', 'main screen'],
    command: 'OPEN_HOME',
    label: 'Go Home',
  },
  {
    patterns: ['open log', 'view log', 'my log', 'history', 'log history'],
    command: 'OPEN_LOG',
    label: 'Open Log',
  },
  {
    patterns: ['conditions', 'my conditions', 'open conditions', 'show conditions'],
    command: 'OPEN_CONDITIONS',
    label: 'Open Conditions',
  },
  {
    patterns: ['notes', 'open notes', 'my notes', 'show notes', 'view notes'],
    command: 'OPEN_NOTES',
    label: 'Open Notes',
  },
  {
    patterns: ['supplements', 'open supplements', 'my supplements', 'show supplements', 'view supplements'],
    command: 'OPEN_SUPPLEMENTS',
    label: 'Open Supplements',
  },
  {
    patterns: ['add note', 'new note', 'quick note', 'take note', 'note this'],
    command: 'ADD_NOTE',
    label: 'Add Note',
  },
];

const CANCEL_PHRASES = ['cancel', 'stop', 'never mind', 'nevermind', 'go back', 'exit'];

function matchCommand(transcript: string): CommandMatch | null {
  const t = transcript.toLowerCase().trim();

  if (CANCEL_PHRASES.some(p => t.includes(p))) {
    return { command: 'CANCEL', label: 'Cancelled' };
  }

  for (const { patterns, command, label } of COMMAND_PATTERNS) {
    if (patterns.some(p => t.includes(p))) {
      return { command, label };
    }
  }

  return null;
}

// ─── Inline-command helpers ───────────────────────────────────────────────────

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// ── Severity word → numeric mapping ──────────────────────────────────────────
const SEVERITY_WORDS: Record<string, number> = {
  mild: 3, slight: 3, minor: 3,
  moderate: 5, medium: 5,
  severe: 7, bad: 7, intense: 7, strong: 7,
  extreme: 9, terrible: 9, worst: 9,
};
const SEVERITY_PATTERN = Object.keys(SEVERITY_WORDS).join('|');

// Matches: "[log|add|record] [a] [symptom] [severity] <name> to|for|in <condition>"
// The verb, "symptom" keyword, and severity qualifier are all optional so it
// works even when speech recognition drops the leading word.
// Group 1 = severity word (optional), Group 2 = symptom name, Group 3 = condition hint.
const INLINE_SYMPTOM_RE = new RegExp(
  `(?:(?:log|add|record|new)\\s+)?(?:a\\s+)?(?:symptom\\s+)?` +
  `(?:(${SEVERITY_PATTERN})\\s+)?` +
  `(.+?)\\s+(?:to|for|in|under|on)\\s+(.+)`,
  'i',
);

function extractInlineSymptom(textAfterWake: string): SymptomPrefill | null {
  const t = textAfterWake.trim();
  if (!t) return null;
  const m = t.match(INLINE_SYMPTOM_RE);
  if (!m) return null;
  const severityWord  = m[1]?.toLowerCase();
  // Strip leading filler words that the regex may have captured
  const symptomName   = m[2].replace(/^(?:a|an|the|symptom)\s+/i, '').trim();
  const conditionHint = m[3].trim();
  if (!symptomName || !conditionHint) return null;
  const severity = severityWord ? SEVERITY_WORDS[severityWord] : undefined;
  return { symptomName, conditionHint, severity };
}

// ── Meal prefill extraction ───────────────────────────────────────────────────

/**
 * Maps spoken meal keywords to valid MealType values.
 * "brunch" → 'breakfast',  "supper" → 'dinner' (closest canonical type).
 */
const MEAL_KEYWORD_MAP: Record<string, MealType> = {
  breakfast: 'breakfast',
  lunch:     'lunch',
  dinner:    'dinner',
  snack:     'snack',
  brunch:    'breakfast',
  supper:    'dinner',
};

/**
 * Extract meal type AND optional time from spoken text.
 * Returns null only if neither was found.
 */
function extractMealPrefill(text: string): MealPrefill | null {
  const t = text.toLowerCase();

  let mealType: MealType | undefined;
  for (const [keyword, mt] of Object.entries(MEAL_KEYWORD_MAP)) {
    if (t.includes(keyword)) { mealType = mt; break; }
  }

  const time = extractTimeFromTranscript(t) ?? undefined;

  if (mealType === undefined && time === undefined) return null;
  return { mealType, time };
}

// ── Supplement prefill extraction ─────────────────────────────────────────────

/**
 * Extract supplement name from spoken text.
 * e.g. "log vitamin d" → { name: "Vitamin D" }
 *      "add magnesium supplement" → { name: "Magnesium" }
 */
const INLINE_SUPPLEMENT_RE = /(?:log|add|record)\s+(?:a\s+)?(?:supplement\s+)?(.+?)(?:\s+supplement)?$/i;

/** Time-window keywords for voice commands like "log morning supplements" */
const TIME_WINDOW_KEYWORDS: Record<string, SupplementTimeWindow> = {
  morning: 'morning',
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  bed: 'bed',
  bedtime: 'bed',
  evening: 'dinner',
};

function extractSupplementPrefill(
  text: string,
  dbEntries?: SupplementDatabaseEntry[],
): SupplementPrefill | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  // Check for time-window patterns: "log morning supplements", "took my breakfast supplements"
  for (const [keyword, tw] of Object.entries(TIME_WINDOW_KEYWORDS)) {
    if (t.includes(keyword) && (t.includes('supplement') || t.includes('vitamin'))) {
      return { timeWindow: tw };
    }
  }

  // Check for "took my <name>" pattern — fuzzy match against database
  const tookMatch = t.match(/(?:took|take|had)\s+(?:my\s+)?(.+)/i);
  if (tookMatch && dbEntries?.length) {
    const spoken = tookMatch[1].replace(/\b(supplement|vitamin|pill|capsule)s?\b/gi, '').trim();
    if (spoken) {
      const match = fuzzyMatchSupplement(spoken, dbEntries);
      if (match) {
        return { name: match.name, quantity: match.quantity };
      }
    }
  }

  // Standard regex extraction
  const m = t.match(INLINE_SUPPLEMENT_RE);
  if (!m) return null;
  const raw = m[1]
    .replace(/\b(supplement|vitamin|mineral)\b/gi, '')
    .trim();
  if (!raw) return null;

  // Try matching against database entries for richer prefill
  if (dbEntries?.length) {
    const match = fuzzyMatchSupplement(raw, dbEntries);
    if (match) {
      return { name: match.name, quantity: match.quantity };
    }
  }

  return { name: toTitleCase(raw) };
}

/** Fuzzy-match spoken text against supplement database names. */
function fuzzyMatchSupplement(
  spoken: string,
  entries: SupplementDatabaseEntry[],
): SupplementDatabaseEntry | undefined {
  const s = spoken.toLowerCase().trim();
  if (s.length < 2) return undefined;
  return (
    entries.find(e => e.name.toLowerCase() === s) ??
    entries.find(e => e.name.toLowerCase().startsWith(s)) ??
    entries.find(e => s.startsWith(e.name.toLowerCase()) && e.name.length >= 3) ??
    entries.find(e => e.name.toLowerCase().includes(s) || s.includes(e.name.toLowerCase()))
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceCommands({ onCommand, supplementDatabase }: UseVoiceCommandsOptions) {
  const SR = getSpeechRecognition();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (VOICE_DEBUG && typeof window !== 'undefined' && !(window as any).__voiceInitLogged) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__voiceInitLogged = true;
    console.log('[Voice] init:', SR ? 'SpeechRecognition available' : 'NOT SUPPORTED',
      '| platform:', navigator.userAgent.includes('iPhone') ? 'iOS' :
        navigator.userAgent.includes('Android') ? 'Android' : 'Desktop');
  }

  const [state, setState] = useState<VoiceState>(SR ? 'wake-listening' : 'unsupported');

  const recognitionRef = useRef<AnySpeechRecognition | null>(null);
  const stateRef = useRef<VoiceState>(state);
  const commandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Rolling buffer of NEW result text with timestamps — allows cross-session
  // wake phrase matching while evicting stale entries.
  const transcriptBufferRef = useRef<Array<{ text: string; at: number }>>([]);
  // Track whether we've ever received a result (for first-load auto-retry).
  const hasReceivedResultRef = useRef(false);
  const autoRetryRef = useRef(0);
  // Backoff: track how many times we've restarted quickly to prevent mic flashing.
  const lastStartTimeRef = useRef<number>(0);
  const rapidRestartCountRef = useRef<number>(0);

  // ── Session tracking ──────────────────────────────────────────────────────
  // Each session gets a unique ID. Handlers check if their session is still
  // current before modifying state. This prevents stale onend/onerror handlers
  // (from React StrictMode double-mount, or aborted sessions) from clobbering
  // a legitimately running session.
  const sessionIdRef = useRef(0);

  // ── Stable callback ref ───────────────────────────────────────────────────
  // Avoids stale closures: onresult always calls the latest onCommand, even if
  // startRecognition was created before the latest onCommand was set.
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const supplementDbRef = useRef(supplementDatabase);
  supplementDbRef.current = supplementDatabase;

  stateRef.current = state;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (healthTimerRef.current) clearTimeout(healthTimerRef.current);
  }, []);

  const vibrate = (ms: number) => navigator.vibrate?.(ms);

  // ── Recognition lifecycle ────────────────────────────────────────────────

  const stopRecognition = useCallback(() => {
    sessionIdRef.current++; // Invalidate any running session's handlers
    clearTimers();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) { /* ignore */ }
      recognitionRef.current = null;
    }
  }, [clearTimers]);

  const startRecognition = useCallback(() => {
    if (!SR || stateRef.current === 'idle' || stateRef.current === 'unsupported') return;

    // If something is still referenced, abort it first (shouldn't normally happen)
    if (recognitionRef.current) {
      vlog('startRecognition: aborting lingering session');
      try { recognitionRef.current.abort(); } catch (_) { /* ignore */ }
      recognitionRef.current = null;
    }

    // ── Create new session with unique ID ──────────────────────────────────
    const thisSession = ++sessionIdRef.current;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    // ── Audio health monitoring ──────────────────────────────────────────
    let audioStarted = false;
    let sessionResultCount = 0;

    recognition.onaudiostart = () => {
      audioStarted = true;
      vlog(`[s${thisSession}] audio started`);
    };

    recognition.onresult = (event: AnySpeechRecognition) => {
      // ── Stale session guard ──────────────────────────────────────────
      if (sessionIdRef.current !== thisSession) {
        vlog(`[s${thisSession}] stale onresult — ignoring`);
        return;
      }

      hasReceivedResultRef.current = true;
      sessionResultCount++;
      rapidRestartCountRef.current = 0; // recognition is working — reset backoff

      // ── Only read NEW results (from resultIndex onward) ──
      // event.results accumulates ALL text since recognition.start().
      // Without slicing, old commands re-enter the buffer and ghost-fire.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newResults = (Array.from(event.results) as any[]).slice(event.resultIndex);
      // hasFinal = true when the user has paused/finished speaking this segment.
      // Used in command-listening to avoid firing LOG_SYMPTOM mid-phrase.
      const hasFinal = newResults.some(r => r.isFinal);
      const newText  = newResults
        .map(r => r[0].transcript)
        .join(' ')
        .toLowerCase()
        .trim();

      if (!newText) return;

      vlog(`[s${thisSession}] transcript:`, newText, hasFinal ? '(final)' : '(interim)');

      // Rolling buffer of recent NEW text with timestamps — catches wake
      // phrases that span across session restarts. Evict entries > 5 s old.
      const now = Date.now();
      const buf = transcriptBufferRef.current;
      buf.push({ text: newText, at: now });
      // Keep last 10 entries and discard anything older than 5 seconds
      const cutoff = now - 5000;
      const fresh = buf.filter(e => e.at >= cutoff).slice(-10);
      transcriptBufferRef.current = fresh;
      const partial = fresh.map(e => e.text).join(' ').toLowerCase();

      if (stateRef.current === 'wake-listening') {
        // ── Apply normalization before wake phrase matching ──
        const normalised = normalizeForWake(partial);
        vlog(`[s${thisSession}] wake check | normalised:`, normalised);

        // Layer 1: exact phrase list (fast)
        let matchedPhrase = WAKE_PHRASES.find(phrase => normalised.includes(phrase));
        // Layer 2: fuzzy regex fallback (catches unknown STT variants)
        let fuzzyMatch: RegExpMatchArray | null = null;
        if (!matchedPhrase) {
          fuzzyMatch = normalised.match(WAKE_FUZZY_RE);
          if (fuzzyMatch) matchedPhrase = fuzzyMatch[0];
        }

        if (matchedPhrase) {
          vlog(`[s${thisSession}] ✅ WAKE PHRASE MATCHED:`, matchedPhrase,
            fuzzyMatch ? '(fuzzy)' : '(exact)');
          // Grab text spoken AFTER the wake phrase — may contain an inline command
          const wakeEnd   = normalised.lastIndexOf(matchedPhrase) + matchedPhrase.length;
          const afterWake = normalised.slice(wakeEnd).trim();
          const inline    = extractInlineSymptom(afterWake);

          transcriptBufferRef.current = [];
          vibrate(80);

          if (inline) {
            // ── Inline full command: "Hey Tracker, log Dizziness to Migraine" ──
            // Skip command-listening; confirm immediately and pass prefill data.
            clearTimers();
            vibrate(120);
            const label = `Log ${toTitleCase(inline.symptomName)} → ${toTitleCase(inline.conditionHint)}`;
            setState('confirmed');
            onCommandRef.current('LOG_SYMPTOM', label, inline);
            confirmTimerRef.current = setTimeout(() => {
              if (stateRef.current === 'confirmed') {
                transcriptBufferRef.current = [];
                setState('wake-listening');
              }
            }, 2000);
          } else {
            // ── Check if a command was spoken right after the wake phrase ──
            // e.g. "Hey Tracker, add note" or "Hey Tracker open reports" in one breath.
            const afterWakeCmd = afterWake ? matchCommand(afterWake) : null;
            if (afterWakeCmd && afterWakeCmd.command !== 'CANCEL') {
              clearTimers();
              vibrate(120);
              setState('confirmed');
              const wakeMealPrefill = afterWakeCmd.command === 'LOG_MEAL'
                ? extractMealPrefill(afterWake) ?? undefined
                : undefined;
              const wakeSupPrefill = afterWakeCmd.command === 'LOG_SUPPLEMENT'
                ? extractSupplementPrefill(afterWake, supplementDbRef.current) ?? undefined
                : undefined;
              const wakeSupLabel = wakeSupPrefill?.name ? `Log ${wakeSupPrefill.name}` : wakeSupPrefill?.timeWindow ? `Log ${wakeSupPrefill.timeWindow} supplements` : afterWakeCmd.label;
              onCommandRef.current(afterWakeCmd.command, wakeSupPrefill ? wakeSupLabel : afterWakeCmd.label, undefined, wakeMealPrefill, wakeSupPrefill);
              confirmTimerRef.current = setTimeout(() => {
                if (stateRef.current === 'confirmed') {
                  transcriptBufferRef.current = [];
                  setState('wake-listening');
                }
              }, 2000);
            } else {
              // ── Normal wake word — enter command-listening mode ──
              setState('command-listening');
              commandTimerRef.current = setTimeout(() => {
                if (stateRef.current === 'command-listening') {
                  transcriptBufferRef.current = [];
                  setState('wake-listening');
                }
              }, 7000);
            }
          }

          // Abort recognition so event.results resets on restart
          try { recognition.abort(); } catch (_) { /* onend will restart */ }
        }
      } else if (stateRef.current === 'command-listening') {
        const match = matchCommand(partial);

        // ── Shared confirm helper ───────────────────────────────────────────
        const confirmCommand = (
          command: VoiceCommand,
          label: string,
          prefill?: SymptomPrefill,
          mealPrefill?: MealPrefill,
          supplementPrefill?: SupplementPrefill,
        ) => {
          clearTimers();
          vibrate(120);
          transcriptBufferRef.current = [];
          try { recognition.abort(); } catch (_) { /* onend will restart */ }
          setState('confirmed');
          onCommandRef.current(command, label, prefill, mealPrefill, supplementPrefill);
          confirmTimerRef.current = setTimeout(() => {
            if (stateRef.current === 'confirmed') {
              transcriptBufferRef.current = [];
              setState('wake-listening');
            }
          }, 2000);
        };

        if (match?.command === 'LOG_SYMPTOM') {
          // Wait for a FINAL result before acting: the user may still be saying
          // "log symptom Dizziness to Migraine" — firing on the interim "log symptom"
          // fragment would open a blank modal before the name/condition are spoken.
          if (!hasFinal) return;
          const prefill = extractInlineSymptom(newText) ?? undefined;
          const label   = prefill
            ? `Log ${toTitleCase(prefill.symptomName)} → ${toTitleCase(prefill.conditionHint)}`
            : match.label;
          confirmCommand('LOG_SYMPTOM', label, prefill);

        } else if (match) {
          // All other commands fire immediately on interim results (fast response).
          if (match.command === 'CANCEL') {
            clearTimers();
            transcriptBufferRef.current = [];
            try { recognition.abort(); } catch (_) { /* onend will restart */ }
            setState('wake-listening');
          } else if (match.command === 'LOG_MEAL') {
            // Extract meal type from spoken phrase (breakfast/lunch/dinner/snack/brunch/supper)
            const mealPrefill = extractMealPrefill(partial) ?? undefined;
            confirmCommand(match.command, match.label, undefined, mealPrefill);
          } else if (match.command === 'LOG_SUPPLEMENT') {
            // Extract supplement name from spoken phrase
            const supPrefill = extractSupplementPrefill(partial, supplementDbRef.current) ?? undefined;
            const label = supPrefill?.name ? `Log ${supPrefill.name}` : supPrefill?.timeWindow ? `Log ${supPrefill.timeWindow} supplements` : match.label;
            confirmCommand(match.command, label, undefined, undefined, supPrefill);
          } else {
            confirmCommand(match.command, match.label);
          }

        } else if (hasFinal) {
          // No standard command matched, but speech is complete — check for a bare
          // inline symptom phrase: "log Dizziness to Migraine" / "Dizziness to Migraine"
          const prefill = extractInlineSymptom(newText);
          if (prefill) {
            const label = `Log ${toTitleCase(prefill.symptomName)} → ${toTitleCase(prefill.conditionHint)}`;
            confirmCommand('LOG_SYMPTOM', label, prefill);
          }
        }
      }
    };

    recognition.onend = () => {
      // ── Stale session guard ──────────────────────────────────────────────
      // If this session was superseded (e.g. React StrictMode double-mount,
      // or stopRecognition was called), do nothing — the new session handles it.
      if (sessionIdRef.current !== thisSession) {
        vlog(`[s${thisSession}] stale onend — ignoring (current: s${sessionIdRef.current})`);
        return;
      }

      recognitionRef.current = null;
      if (healthTimerRef.current) clearTimeout(healthTimerRef.current);
      const s = stateRef.current;
      // Don't restart if deliberately stopped or permission denied
      if (s === 'idle' || s === 'unsupported' || s === 'denied') return;

      // ── Smarter backoff ────────────────────────────────────────────────
      // Only escalate for very rapid restarts (< 500 ms). Sessions that last
      // a normal amount of time (even without speech) should restart immediately
      // so the user's next "Hey Tracker" is heard right away.
      const elapsed = Date.now() - lastStartTimeRef.current;
      if (elapsed < 500) {
        rapidRestartCountRef.current = Math.min(rapidRestartCountRef.current + 1, 5);
      } else {
        // Session lasted long enough — reset backoff
        rapidRestartCountRef.current = 0;
      }
      // Delay: 0 ms (normal) → 200 ms → 400 ms → 800 ms → 1.5 s → 3 s → 5 s
      const delay = rapidRestartCountRef.current === 0
        ? 0
        : Math.min(200 * Math.pow(2, rapidRestartCountRef.current - 1), 5000);

      vlog(`[s${thisSession}] session ended after`, elapsed,
        'ms | results:', sessionResultCount,
        '| audio:', audioStarted,
        '| backoff:', rapidRestartCountRef.current,
        '| restart in', delay, 'ms');

      if (delay === 0) {
        // Restart immediately via microtask — minimizes gap where speech is lost
        Promise.resolve().then(() => {
          if (sessionIdRef.current === thisSession) startRecognition();
        });
      } else {
        restartTimerRef.current = setTimeout(() => {
          if (sessionIdRef.current === thisSession) startRecognition();
        }, delay);
      }
    };

    recognition.onerror = (event: AnySpeechRecognition) => {
      // ── Stale session guard ──────────────────────────────────────────────
      if (sessionIdRef.current !== thisSession) {
        vlog(`[s${thisSession}] stale onerror — ignoring`);
        return;
      }

      vlog(`[s${thisSession}] ⚠️ error:`, event.error, '| message:', event.message ?? 'none');

      // IMPORTANT: Do NOT set recognitionRef.current = null here.
      // onend fires after onerror and handles lifecycle (restart scheduling).
      // Clearing the ref here would create a race condition where a re-render
      // triggers startRecognition() between onerror and onend, leading to
      // overlapping sessions.

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        // Eagerly update stateRef so the onend handler (which fires right after)
        // sees 'denied' and does NOT schedule a restart into another denial loop.
        stateRef.current = 'denied';
        setState('denied');
      }
    };

    // ── Start the session ────────────────────────────────────────────────
    // Set recognitionRef AFTER .start() succeeds to avoid referencing a
    // non-started instance (which would block future startRecognition calls).
    try {
      lastStartTimeRef.current = Date.now();
      recognition.start();
      recognitionRef.current = recognition;

      vlog(`[s${thisSession}] session started (state:`, stateRef.current,
        '| buffer:', transcriptBufferRef.current.length, 'entries',
        '| backoff:', rapidRestartCountRef.current, ')');

      // ── Session health timer ───────────────────────────────────────────
      // If no results arrive within 10 s, this session is likely a zombie.
      // Abort so onend restarts it. Works for every session, not just first.
      healthTimerRef.current = setTimeout(() => {
        if (sessionResultCount === 0 && sessionIdRef.current === thisSession) {
          vlog(`[s${thisSession}] health check: no results in 10 s — restarting`);
          try { recognition.abort(); } catch (_) { /* onend will restart */ }
        }
      }, 10000);

      // Some browsers silently ignore auto-start without a prior user gesture.
      // Auto-retry up to 2 times by aborting after 4s if no results arrived.
      if (!hasReceivedResultRef.current && autoRetryRef.current < 2) {
        autoRetryRef.current++;
        setTimeout(() => {
          if (!hasReceivedResultRef.current && sessionIdRef.current === thisSession
              && stateRef.current === 'wake-listening') {
            vlog(`[s${thisSession}] auto-retry: no results ever — aborting to retry`);
            try { recognition.abort(); } catch (_) { /* onend will restart */ }
          }
        }, 4000);
      }
    } catch (e) {
      vlog(`[s${thisSession}] start() threw:`, e);
      // .start() failed — recognitionRef was never set, so future calls won't be blocked.
      // Schedule a retry after a short delay.
      restartTimerRef.current = setTimeout(() => {
        if (sessionIdRef.current === thisSession) startRecognition();
      }, 200);
    }
  }, [SR, clearTimers]); // ← No longer depends on onCommand (uses onCommandRef)

  // ── Sync recognition with state ──────────────────────────────────────────

  useEffect(() => {
    if (state === 'idle' || state === 'unsupported' || state === 'denied') {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [state, startRecognition, stopRecognition]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, [stopRecognition]);

  // ── Public API ───────────────────────────────────────────────────────────

  const enableWakeWord = useCallback(() => {
    if (state === 'unsupported') return;
    setState('wake-listening'); // also retries from 'denied'
  }, [state]);

  const disableWakeWord = useCallback(() => {
    stopRecognition();
    setState('idle');
  }, [stopRecognition]);

  const toggleWakeWord = useCallback(() => {
    if (state === 'idle') enableWakeWord();
    else disableWakeWord();
  }, [state, enableWakeWord, disableWakeWord]);

  // Manual tap-to-activate: tap button while in wake-listening → jump to command mode
  const manualActivate = useCallback(() => {
    if (state === 'idle' || state === 'denied') {
      enableWakeWord();
    } else if (state === 'wake-listening') {
      clearTimers();
      transcriptBufferRef.current = [];
      vibrate(80);
      setState('command-listening');
      // Abort so event.results resets
      stopRecognition();
      commandTimerRef.current = setTimeout(() => {
        if (stateRef.current === 'command-listening') {
          transcriptBufferRef.current = [];
          setState('wake-listening');
        }
      }, 7000);
    } else if (state === 'command-listening' || state === 'confirmed') {
      stopRecognition();
      transcriptBufferRef.current = [];
      setState('wake-listening');
    }
  }, [state, enableWakeWord, clearTimers, stopRecognition]);

  return {
    state,
    isSupported: state !== 'unsupported',
    isActive: state !== 'idle' && state !== 'unsupported',
    enableWakeWord,
    disableWakeWord,
    toggleWakeWord,
    manualActivate,
  };
}
