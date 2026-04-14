/**
 * BadDaySheet — quick bulk log sheet
 *
 * Voice path: tap mic → SpeechRecognition → parseVoiceTranscript (Claude)
 *             → auto-fill severity + note.
 * Submit: one TrackingEntry per active condition (first symptom), at the
 *         chosen severity.
 */

import { useState, useRef } from 'react';
import { CloudRain, Mic, Loader2, Check, Info } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getSpeechRecognition } from '../utils/speech';
import { parseVoiceTranscript } from '../utils/nlpVoiceParser';
import { Sheet } from './ui';

interface Props {
  onClose: () => void;
}

export default function BadDaySheet({ onClose }: Props) {
  const { state, getPatientConditions, addEntry } = useApp();
  const [severity, setSeverity] = useState(7);
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null);

  const conditions = getPatientConditions(state.activePatientId ?? '');

  // ── Voice tap-to-speak ────────────────────────────────────────────────────

  function startVoice() {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setVoiceFeedback('Voice not supported in this browser');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recog: any = new SpeechRecognitionCtor();
    recog.lang = 'en-US';
    recog.continuous = false;
    recog.interimResults = false;
    recogRef.current = recog;

    setListening(true);
    setVoiceFeedback(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      const transcript: string = e.results[e.results.length - 1][0].transcript;
      setListening(false);
      setParsing(true);

      parseVoiceTranscript(transcript, {
        conditions,
        medicationSchedules: (state.medicationSchedules ?? []).filter(
          s => s.patientId === state.activePatientId && s.status === 'active'
        ),
        supplementSchedules: (state.supplementSchedules ?? []).filter(
          s => s.patientId === state.activePatientId && s.status === 'active'
        ),
      })
        .then(parsed => {
          // Pull severity from first parsed symptom, averaged if multiple
          if (parsed.symptoms.length > 0) {
            const avg = Math.round(
              parsed.symptoms.reduce((sum, s) => sum + s.severity, 0) / parsed.symptoms.length
            );
            setSeverity(Math.min(10, Math.max(1, avg)));
          }
          if (parsed.notes) setNote(parsed.notes);
          setVoiceFeedback(`"${transcript}"`);
        })
        .catch(() => {
          // Fallback: use transcript as note
          setNote(transcript);
          setVoiceFeedback(`"${transcript}"`);
        })
        .finally(() => setParsing(false));
    };

    recog.onerror = () => {
      setListening(false);
      setParsing(false);
      setVoiceFeedback("Couldn't hear you — try again");
    };

    recog.onend = () => {
      setListening(false);
    };

    recog.start();
  }

  function stopVoice() {
    recogRef.current?.stop();
    setListening(false);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit() {
    const loggable = conditions.filter(c => c.symptoms.length > 0);
    if (loggable.length === 0) return;

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const condition of loggable) {
      const symptom = condition.symptoms[0];
      addEntry({
        conditionId: condition.id,
        conditionName: condition.name,
        symptomId: symptom.id,
        symptomName: symptom.name,
        date,
        time,
        severity,
        notes: note.trim() || 'Bad day',
        sourceType: 'manual',
      });
    }

    onClose();
  }

  // ── Severity colour + label ───────────────────────────────────────────────

  const severityColour =
    severity >= 8 ? 'text-red-500' :
    severity >= 6 ? 'text-amber-500' :
    severity >= 4 ? 'text-yellow-500' :
    'text-green-500';

  const severityLabel =
    severity >= 9 ? 'Severe' :
    severity >= 7 ? 'High' :
    severity >= 5 ? 'Moderate' :
    severity >= 3 ? 'Mild' :
    'Very mild';

  const loggable = conditions.filter(c => c.symptoms.length > 0);

  return (
    <Sheet
      title="Bad Day"
      subtitle={
        loggable.length > 0
          ? `Log severity for ${loggable.length} condition${loggable.length !== 1 ? 's' : ''}`
          : 'No conditions with symptoms yet'
      }
      icon={<CloudRain size={18} className="text-rose-500" />}
      onClose={onClose}
    >
      {/* ── Voice button ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <button
          onPointerDown={listening ? stopVoice : startVoice}
          disabled={parsing}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
            listening
              ? 'bg-rose-50 border-rose-200'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            listening ? 'bg-rose-500' : 'bg-slate-700'
          }`}>
            {parsing
              ? <Loader2 size={16} className="text-white animate-spin" />
              : <Mic size={16} className="text-white" />
            }
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className={`text-sm font-semibold ${listening ? 'text-rose-700' : 'text-slate-800'}`}>
              {listening ? 'Listening… tap to stop' :
               parsing  ? 'Parsing…' :
               'Describe how you feel'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {voiceFeedback ?? 'Voice → Claude → fills severity + note'}
            </p>
          </div>
          {listening && (
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
          )}
        </button>
      </div>

      {/* ── Severity slider ───────────────────────────────────────────────── */}
      <div className="px-4 pt-5 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Overall severity</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold tabular-nums ${severityColour}`}>{severity}</span>
            <span className="text-xs text-slate-400">/10 · {severityLabel}</span>
          </div>
        </div>

        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={severity}
          onChange={e => setSeverity(Number(e.target.value))}
          className="w-full h-2 rounded-full cursor-pointer accent-rose-500"
        />

        <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
          <span>1 — Very mild</span>
          <span>5 — Moderate</span>
          <span>10 — Severe</span>
        </div>
      </div>

      {/* ── Note ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          maxLength={200}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-shadow"
        />
      </div>

      {/* ── Conditions preview ────────────────────────────────────────────── */}
      {loggable.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Logging for
          </p>
          <div className="flex flex-wrap gap-2">
            {loggable.map(c => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 bg-slate-50 text-slate-600"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
                <span className="text-slate-400">· {c.symptoms[0].name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Info row ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3">
        <div className="flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
          <Info size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            Logs the primary symptom of each condition. Use the full log for per-symptom detail.
          </span>
        </div>
      </div>

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-6">
        <button
          onClick={handleSubmit}
          disabled={loggable.length === 0 || parsing}
          className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white font-semibold text-sm py-3.5 rounded-2xl transition-all min-h-[52px] shadow-sm"
        >
          <Check size={16} />
          Log Bad Day — {severity}/10
          {loggable.length > 1 && (
            <span className="text-rose-200 font-normal text-xs">
              ({loggable.length} conditions)
            </span>
          )}
        </button>
        {loggable.length === 0 && (
          <p className="text-center text-xs text-slate-400 mt-2">
            Add a condition with at least one symptom to use this feature
          </p>
        )}
      </div>
    </Sheet>
  );
}
