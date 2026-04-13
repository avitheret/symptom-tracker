import { useMemo } from 'react';
import { Mic } from 'lucide-react';
import type { VoiceState } from '../hooks/useVoiceCommands';
import { fuzzyMatchSupplementName } from '../utils/supplementMatcher';

interface Props {
  voiceState: VoiceState;
  transcript: string;
  onStop: () => void;
  /** Canonical names from the user's supplement + medication schedules.
   *  Used to correct STT misrecognitions in the displayed transcript. */
  knownNames?: string[];
}

// ─── Transcript correction ────────────────────────────────────────────────────
// The STT API may split drug names into ordinary words, e.g. "Wellbutrin" →
// "Well Between". This function slides a window over transcript tokens and
// replaces any window that fuzzy-matches a known name with the canonical form.
function correctTranscript(raw: string, knownNames: string[]): string {
  if (!raw || knownNames.length === 0) return raw;

  const items = knownNames.map(name => ({ name }));
  const tokens = raw.trim().split(/\s+/);
  const result: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    let matched = false;
    // Try windows longest→shortest so multi-word names win over subsets
    for (let len = Math.min(4, tokens.length - i); len >= 1; len--) {
      const window = tokens.slice(i, i + len).join(' ');
      // Require the window to have enough substance to avoid false-positives
      // (single short tokens are matched only if they're an exact/prefix match)
      if (len === 1 && window.length < 4) break;
      const match = fuzzyMatchSupplementName(window, items);
      if (match) {
        result.push(match.name);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result.push(tokens[i]);
      i++;
    }
  }

  return result.join(' ');
}

// ─── Simple entity extraction from spoken transcript ──────────────────────────
const SEVERITY_MAP: Record<string, string> = {
  mild: 'Mild', slight: 'Mild', minor: 'Mild',
  moderate: 'Moderate', medium: 'Moderate',
  severe: 'Severe', bad: 'Severe', intense: 'Severe',
  extreme: 'Extreme', terrible: 'Extreme',
};

interface Entity {
  text: string;
  type: 'symptom' | 'supplement';
}

function extractEntities(transcript: string): Entity[] {
  if (!transcript) return [];
  const entities: Entity[] = [];
  const t = transcript.toLowerCase();

  // Detect supplement names (Vitamin X, common supplement names)
  const suppPatterns = [
    /vitamin\s+[a-z0-9]+/gi,
    /omega[-\s]?\d+/gi,
    /magnesium/gi, /zinc/gi, /iron/gi, /calcium/gi, /probiotics?/gi,
    /melatonin/gi, /creatine/gi, /collagen/gi,
  ];
  const foundSupps = new Set<string>();
  for (const re of suppPatterns) {
    const matches = transcript.match(re);
    if (matches) {
      for (const m of matches) {
        const key = m.toLowerCase();
        if (!foundSupps.has(key)) {
          foundSupps.add(key);
          // Title-case the supplement name
          entities.push({
            text: m.replace(/\b\w/g, c => c.toUpperCase()),
            type: 'supplement',
          });
        }
      }
    }
  }

  // Detect symptom patterns: "[severity] <symptom>" after "have" / "log" / "feeling"
  const severityWords = Object.keys(SEVERITY_MAP).join('|');
  const symptomRe = new RegExp(
    `(?:have|log|feeling|experiencing|had)?\\s*(?:a\\s+)?(?:(${severityWords})\\s+)?(headache|migraine|pain|nausea|fatigue|dizziness|anxiety|stress|insomnia|bloating|cramp|ache|fever|cough|rash|itch)`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = symptomRe.exec(t)) !== null) {
    const severity = m[1] ? SEVERITY_MAP[m[1].toLowerCase()] : null;
    const name = m[2].charAt(0).toUpperCase() + m[2].slice(1);
    const label = severity ? `${name} (${severity})` : name;
    if (!entities.some(e => e.text === label && e.type === 'symptom')) {
      entities.push({ text: label, type: 'symptom' });
    }
  }

  return entities;
}

// ─── Wave bars — pre-defined heights and delays without inline styles ─────────
// 28 bars with staggered animation via CSS classes defined in index.css
const WAVE_BARS = [
  'wave-1','wave-2','wave-3','wave-4','wave-5','wave-6','wave-7',
  'wave-8','wave-9','wave-10','wave-11','wave-12','wave-13','wave-14',
  'wave-15','wave-16','wave-17','wave-18','wave-19','wave-20','wave-21',
  'wave-22','wave-23','wave-24','wave-25','wave-26','wave-27','wave-28',
];

export default function VoiceEntryOverlay({ voiceState, transcript, onStop, knownNames }: Props) {
  if (voiceState !== 'command-listening') return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const displayTranscript = useMemo(
    () => correctTranscript(transcript, knownNames ?? []),
    [transcript, knownNames],
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const entities = useMemo(() => extractEntities(displayTranscript), [displayTranscript]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#1a1f3c] flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="pt-14 pb-4 text-center">
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">Voice Entry</p>
      </div>

      {/* ── Transcript area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
        <div className="text-center space-y-3 max-w-sm w-full">
          <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Transcript</p>
          <p className={`text-white font-bold leading-snug transition-all duration-200 ${
            displayTranscript ? 'text-3xl' : 'text-2xl opacity-40'
          }`}>
            {displayTranscript || 'Listening…'}
          </p>
        </div>

        {/* ── Entity chips ───────────────────────────────────────────────── */}
        {entities.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 max-w-xs">
            {entities.map((entity, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold ${
                  entity.type === 'symptom'
                    ? 'bg-[#2d6af0]/80 text-white'
                    : 'bg-[#f59e0b]/80 text-white'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  entity.type === 'symptom' ? 'bg-white/30' : 'bg-white/30'
                }`}>✓</span>
                {entity.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Wave animation ─────────────────────────────────────────────── */}
      <div className="px-8 pb-4">
        <div className="flex items-center justify-center gap-[3px] h-16">
          {WAVE_BARS.map((cls) => (
            <div
              key={cls}
              className={`w-[3px] rounded-full bg-gradient-to-b from-blue-400 via-purple-400 to-pink-400 ${cls}`}
            />
          ))}
        </div>
      </div>

      {/* ── Stop button ────────────────────────────────────────────────── */}
      <div className="pb-12 flex flex-col items-center gap-3">
        <button
          onClick={onStop}
          className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
        >
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <Mic size={24} className="text-white/70" />
          </div>
          <span className="text-white/60 text-xs font-medium">Stop Listening</span>
        </button>
      </div>
    </div>
  );
}
