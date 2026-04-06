/**
 * SupplementModal — log a supplement by voice (zero extra taps) or manually.
 *
 * Voice flow (mirrors FoodLogModal exactly):
 *   1. Auto-starts recording on mount.
 *   2. 5 s silence → stops, extracts name/dosage/time, pre-fills form — stays open.
 *   3. A secondary save listener activates when idle; say "save log", "save it",
 *      "save supplement", or "submit" to confirm. Tap "Save" is always available.
 *   4. 15 s no-speech timeout drops to idle (mic never stuck).
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FlaskConical, Mic, Square, Loader2, ChevronDown, Check } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_FORMS, SUPPLEMENT_TIME_WINDOWS } from '../types';
import type { SupplementTimeWindow, SupplementDatabaseEntry } from '../types';
import { Sheet, Button } from './ui';
import { getSpeechRecognition } from '../utils/speech';
import { extractSupplementLog } from '../utils/supplementExtractor';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  onClose: () => void;
  initialName?: string;
  initialTimeWindow?: SupplementTimeWindow;
  initialQuantity?: string;
}

type DictateState = 'listening' | 'analysing' | 'idle' | 'error';

const SILENCE_MS   = 5000;
const NO_SPEECH_MS = 15000;
const STOP_PHRASES = ['log supplement', 'log it', 'done recording', 'submit'];
const SAVE_PHRASES = ['save log', 'save it', 'save supplement', 'submit'];

export default function SupplementModal({ onClose, initialName = '', initialTimeWindow, initialQuantity }: Props) {
  const { state, addSupplementLog } = useApp();

  // ── Database entries for this patient ──────────────────────────────────────
  const dbEntries = useMemo(
    () => (state.supplementDatabase ?? []).filter(e => e.patientId === state.activePatientId),
    [state.supplementDatabase, state.activePatientId]
  );

  // Look up initial database entry
  const dbMatch = useMemo(() => {
    if (!initialName) return undefined;
    return dbEntries.find(e => e.name.toLowerCase() === initialName.toLowerCase());
  }, [initialName, dbEntries]);

  const [name,       setName]       = useState(initialName);
  const [dosage,     setDosage]     = useState(initialQuantity ?? dbMatch?.quantity ?? '');
  const [form,       setForm]       = useState('');
  const [date,       setDate]       = useState(todayStr());
  const [time,       setTime]       = useState(
    initialTimeWindow
      ? SUPPLEMENT_TIME_WINDOWS[initialTimeWindow].start
      : dbMatch
        ? SUPPLEMENT_TIME_WINDOWS[dbMatch.timeWindow].start
        : nowTime()
  );
  const [notes,      setNotes]      = useState('');
  const [dictate,    setDictate]    = useState<DictateState>('idle');
  const [dictateErr, setDictateErr] = useState('');
  const [liveText,   setLiveText]   = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');

  // Track active database match (updates when name changes)
  const activeDbEntry = useMemo(
    () => dbEntries.find(e => e.name.toLowerCase() === name.toLowerCase()),
    [name, dbEntries]
  );

  const description = activeDbEntry?.description ?? '';

  // Filtered picker list
  const filteredDbEntries = useMemo(() => {
    if (!pickerFilter.trim()) return dbEntries;
    const f = pickerFilter.toLowerCase();
    return dbEntries.filter(e => e.name.toLowerCase().includes(f));
  }, [dbEntries, pickerFilter]);

  // ── Select a database entry — fills all fields ────────────────────────────
  const selectDbEntry = useCallback((entry: SupplementDatabaseEntry) => {
    setName(entry.name);
    setDosage(entry.quantity);
    setTime(SUPPLEMENT_TIME_WINDOWS[entry.timeWindow].start);
    setShowPicker(false);
    setPickerFilter('');
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveListenerRef = useRef<any>(null);
  const transcriptRef   = useRef('');
  const silenceTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noSpeechTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBusyRef       = useRef(false);

  // ── Timers ────────────────────────────────────────────────────────────────

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
  }, []);

  const clearNoSpeechTimer = useCallback(() => {
    if (noSpeechTimer.current) { clearTimeout(noSpeechTimer.current); noSpeechTimer.current = null; }
  }, []);

  // ── Stop dictation recognition ────────────────────────────────────────────

  const stopRecognition = useCallback(() => {
    clearSilenceTimer();
    clearNoSpeechTimer();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, [clearSilenceTimer, clearNoSpeechTimer]);

  // ── Save logic ────────────────────────────────────────────────────────────

  const saveLog = useCallback((
    n: string, d: string, dos: string, frm: string, t: string, nt: string,
  ) => {
    if (!n.trim()) return;
    addSupplementLog({
      name:   n.trim(),
      dosage: dos.trim() || undefined,
      form:   (frm as typeof SUPPLEMENT_FORMS[number]) || undefined,
      date:   d,
      time:   t,
      notes:  nt.trim(),
    });
    onClose();
  }, [addSupplementLog, onClose]);

  const saveLogRef = useRef(saveLog);
  useEffect(() => { saveLogRef.current = saveLog; }, [saveLog]);

  const formValuesRef = useRef({ name, dosage, form, date, time, notes });
  useEffect(() => {
    formValuesRef.current = { name, dosage, form, date, time, notes };
  }, [name, dosage, form, date, time, notes]);

  // ── Stop + extract (NO auto-submit — populates form, keeps modal open) ───

  const stopAndExtract = useCallback(() => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;

    const transcript = transcriptRef.current.trim();
    stopRecognition();

    if (!transcript) { setDictate('idle'); isBusyRef.current = false; return; }

    setDictate('analysing');
    try {
      const result = extractSupplementLog(transcript);
      if (result.name)   setName(result.name);
      if (result.dosage) setDosage(result.dosage);
      if (result.time)   setTime(result.time);
      if (result.notes)  setNotes(result.notes);
      setDictate('idle');
    } catch {
      setDictate('error');
      setDictateErr('Could not process voice note. Please fill in manually.');
    }
    isBusyRef.current = false;
  }, [stopRecognition]);

  // ── Start dictation ───────────────────────────────────────────────────────

  const startDictation = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) { setDictate('idle'); return; }

    // Stop any running save listener before claiming the mic.
    if (saveListenerRef.current) {
      try { saveListenerRef.current.abort(); } catch { /* ignore */ }
      saveListenerRef.current = null;
    }

    isBusyRef.current = false;
    transcriptRef.current = '';
    setDictate('listening');
    setDictateErr('');
    setLiveText('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';
    recognitionRef.current = rec;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      clearNoSpeechTimer();

      let full = '';
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + ' ';
      const t = full.trim();
      transcriptRef.current = t;
      setLiveText(t);

      const lower = t.toLowerCase();
      const hit   = STOP_PHRASES.find(p => lower.includes(p));
      if (hit) {
        transcriptRef.current = t.replace(new RegExp(hit, 'gi'), '').trim();
        stopAndExtract();
        return;
      }

      clearSilenceTimer();
      silenceTimer.current = setTimeout(() => stopAndExtract(), SILENCE_MS);
    };

    rec.onerror = (e: { error: string }) => {
      stopRecognition();
      setDictate('error');
      setDictateErr(
        e.error === 'not-allowed'
          ? 'Microphone access denied. Please check your browser settings.'
          : 'Could not access microphone.'
      );
    };

    rec.onend = () => {
      recognitionRef.current = null;
      clearSilenceTimer();
      clearNoSpeechTimer();
      setDictate(prev => prev === 'listening' ? 'idle' : prev);
    };

    try {
      rec.start();
      noSpeechTimer.current = setTimeout(() => {
        stopRecognition();
        setDictate('idle');
      }, NO_SPEECH_MS);
    } catch {
      recognitionRef.current = null;
      setDictate('idle');
    }
  }, [clearNoSpeechTimer, clearSilenceTimer, stopAndExtract, stopRecognition]);

  // Auto-start on mount; cleanup on unmount
  useEffect(() => {
    startDictation();
    return () => {
      clearSilenceTimer();
      clearNoSpeechTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
      if (saveListenerRef.current) {
        try { saveListenerRef.current.abort(); } catch { /* ignore */ }
        saveListenerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save voice listener — active when idle ────────────────────────────────
  useEffect(() => {
    if (dictate !== 'idle') return;

    const SR = getSpeechRecognition();
    if (!SR) return;

    let active = true;

    function startSaveListener() {
      if (!active || !SR) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = new (SR as any)();
      rec.continuous     = true;
      rec.interimResults = true;
      rec.lang           = 'en-US';
      saveListenerRef.current = rec;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        let full = '';
        for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + ' ';
        const t = full.trim().toLowerCase();
        if (SAVE_PHRASES.some(p => t.includes(p))) {
          const fv = formValuesRef.current;
          saveLogRef.current(fv.name, fv.date, fv.dosage, fv.form, fv.time, fv.notes);
        }
      };

      rec.onerror = () => { saveListenerRef.current = null; };
      rec.onend = () => {
        saveListenerRef.current = null;
        if (active) setTimeout(() => startSaveListener(), 300);
      };

      try { rec.start(); } catch { saveListenerRef.current = null; }
    }

    startSaveListener();

    return () => {
      active = false;
      if (saveListenerRef.current) {
        try { saveListenerRef.current.abort(); } catch { /* ignore */ }
        saveListenerRef.current = null;
      }
    };
  }, [dictate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit handler ────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveLog(name, date, dosage, form, time, notes);
  }

  return (
    <Sheet
      title="Log Supplement"
      icon={<FlaskConical size={16} className="text-teal-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* ── Voice status ─────────────────────────────── */}
        {dictate === 'listening' && (
          <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center animate-pulse">
              <Mic size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-teal-700">Listening…</p>
              {liveText && (
                <p className="text-xs text-teal-600 mt-0.5 truncate italic">{liveText}</p>
              )}
            </div>
            <button
              type="button"
              onClick={stopAndExtract}
              className="p-2 text-teal-600 hover:bg-teal-100 rounded-lg transition-colors"
              title="Stop"
            >
              <Square size={16} />
            </button>
          </div>
        )}

        {dictate === 'analysing' && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <Loader2 size={18} className="text-slate-400 animate-spin" />
            <p className="text-sm text-slate-600">Processing…</p>
          </div>
        )}

        {dictate === 'error' && dictateErr && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{dictateErr}</p>
            <button
              type="button"
              onClick={startDictation}
              className="text-xs text-red-700 font-medium mt-1 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Save hint — shown when name is filled and dictation idle */}
        {name.trim() && dictate === 'idle' && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Mic size={14} className="text-emerald-500 flex-shrink-0" />
            <p className="text-xs text-emerald-700">
              Review your log and say <strong>"save log"</strong> or tap Save
            </p>
          </div>
        )}

        {/* ── Name (with database picker) ─────────────── */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Supplement Name <span className="text-red-400">*</span>
          </label>

          {/* Quick-pick chips from database */}
          {dbEntries.length > 0 && !showPicker && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {dbEntries.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => selectDbEntry(entry)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[32px] ${
                    name.toLowerCase() === entry.name.toLowerCase()
                      ? 'bg-teal-500 text-white'
                      : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                  }`}
                >
                  {name.toLowerCase() === entry.name.toLowerCase() && <Check size={12} />}
                  {entry.name}
                </button>
              ))}
            </div>
          )}

          {/* Text input — still allows freeform entry */}
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (dbEntries.length > 0) setShowPicker(true); setPickerFilter(e.target.value); }}
              onFocus={() => { if (dbEntries.length > 0 && !name) setShowPicker(true); }}
              placeholder={dbEntries.length > 0 ? 'Tap above or type a name…' : 'e.g. Vitamin D, Magnesium, Omega-3…'}
              required
              autoFocus={!initialName && dictate !== 'listening'}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[48px] bg-white pr-10"
            />
            {dbEntries.length > 0 && (
              <button
                type="button"
                onClick={() => { setShowPicker(!showPicker); setPickerFilter(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <ChevronDown size={16} className={`transition-transform ${showPicker ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* Dropdown list */}
          {showPicker && filteredDbEntries.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {filteredDbEntries.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => selectDbEntry(entry)}
                  className="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors flex items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900">{entry.name}</span>
                    <span className="text-slate-400 ml-2 text-xs">{entry.quantity}</span>
                    {entry.description && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{entry.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {SUPPLEMENT_TIME_WINDOWS[entry.timeWindow].label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Description (read-only from database) ────── */}
        {description && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Description <span className="text-slate-400 font-normal">(from list)</span>
            </label>
            <div className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 text-sm text-slate-600 min-h-[48px]">
              {description}
            </div>
          </div>
        )}

        {/* ── Dosage & Form ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Dosage</label>
            <input
              type="text"
              value={dosage}
              onChange={e => setDosage(e.target.value)}
              placeholder="e.g. 1000 IU"
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[48px] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Form</label>
            <select
              value={form}
              onChange={e => setForm(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[48px]"
            >
              <option value="">Select…</option>
              {SUPPLEMENT_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* ── Date & Time ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[48px] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[48px] bg-white"
            />
          </div>
        </div>

        {/* ── Notes ────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notes <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="With food, timing notes…"
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none bg-white"
          />
        </div>

        {/* ── Actions ──────────────────────────────────── */}
        <div className="flex gap-3 pt-1 pb-safe">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={!name.trim()}
            className="flex-1 bg-teal-600 hover:bg-teal-700 active:bg-teal-800"
          >
            Save Log
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
