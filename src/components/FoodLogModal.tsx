/**
 * FoodLogModal — log or edit a meal by voice (zero extra taps) or manually.
 *
 * Voice flow:
 *   1. Auto-starts recording on mount.
 *   2. 5 s silence / stop phrase → stops, analyses, pre-fills form — stays open.
 *   3. A secondary save listener activates when idle; say "save log", "save it",
 *      "save meal", or "submit log" to confirm. Tap "Save" is always available.
 *   4. 15 s no-speech timeout drops to idle (mic never stuck).
 *
 * Edit flow: pass `editTarget` to pre-fill all fields and call updateFoodLog on save.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { UtensilsCrossed, Plus, X, Square, Loader2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { MEAL_TYPES } from '../types';
import type { FoodLog, MealType } from '../types';
import { Sheet, Button, Chip } from './ui';
import { getSpeechRecognition } from '../utils/speech';
import { extractFoodLog, extractTimeFromTranscript, guessMealType } from '../utils/foodLogExtractor';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  onClose: () => void;
  /** Pre-select this meal type (extracted from the voice command that opened the modal). */
  initialMealType?: MealType;
  /** Pre-fill the time field (HH:MM 24h, extracted from the voice command). */
  initialTime?: string;
  /** When set, the modal edits an existing log entry rather than creating a new one. */
  editTarget?: FoodLog;
}

type DictateState = 'listening' | 'analysing' | 'idle' | 'error';

const SILENCE_MS   = 5000;
const NO_SPEECH_MS = 15000; // give up if mic is silent for 15 s from the start
const STOP_PHRASES = ['log meal', 'log it', 'done recording', 'submit meal'];
const SAVE_PHRASES = ['save log', 'save it', 'save meal', 'submit log'];

export default function FoodLogModal({ onClose, initialMealType, initialTime, editTarget }: Props) {
  const { addFoodLog, updateFoodLog } = useApp();

  // Pre-fill from editTarget (edit mode) → voice prefill → sensible defaults (add mode)
  const [date,       setDate]       = useState(editTarget?.date     ?? todayStr());
  const [time,       setTime]       = useState(editTarget?.time     ?? initialTime ?? nowTime());
  const [mealType,   setMealType]   = useState<MealType>(editTarget?.mealType ?? initialMealType ?? guessMealType());
  const [foods,      setFoods]      = useState<string[]>(editTarget?.foods    ?? []);
  const [foodInput,  setFoodInput]  = useState('');
  const [notes,      setNotes]      = useState(editTarget?.notes    ?? '');
  const [error,      setError]      = useState('');
  const [dictate,    setDictate]    = useState<DictateState>('idle');
  const [dictateErr, setDictateErr] = useState('');
  const [liveText,   setLiveText]   = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef    = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveListenerRef   = useRef<any>(null);
  const transcriptRef     = useRef('');
  const silenceTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noSpeechTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBusyRef         = useRef(false);
  const dateRef           = useRef(date);
  const timeRef           = useRef(time);

  useEffect(() => { dateRef.current = date; }, [date]);
  useEffect(() => { timeRef.current = time; }, [time]);

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

  // ── Save logic (shared by button and voice save listener) ────────────────

  const saveLog = useCallback((
    d: string, t: string, mt: MealType, f: string[], n: string,
  ) => {
    if (f.length === 0) { setError('Add at least one food item.'); return; }
    if (editTarget) {
      updateFoodLog(editTarget.id, { date: d, time: t, mealType: mt, foods: f, notes: n.trim() });
    } else {
      addFoodLog({ date: d, time: t, mealType: mt, foods: f, notes: n.trim() });
    }
    onClose();
  }, [addFoodLog, updateFoodLog, editTarget, onClose]);

  // Keep a stable ref so the save listener can always call the latest closure.
  const saveLogRef = useRef(saveLog);
  useEffect(() => { saveLogRef.current = saveLog; }, [saveLog]);

  // Stable refs for current form values — read by the save listener without stale closures.
  const formValuesRef = useRef({ date, time, mealType, foods, notes });
  useEffect(() => {
    formValuesRef.current = { date, time, mealType, foods, notes };
  }, [date, time, mealType, foods, notes]);

  // ── Stop + analyse (NO auto-submit — populates form, keeps modal open) ───

  const stopAndAnalyse = useCallback(async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;

    const transcript = transcriptRef.current.trim();
    stopRecognition();

    if (!transcript) { setDictate('idle'); isBusyRef.current = false; return; }

    setDictate('analysing');
    try {
      const result = await extractFoodLog(transcript);

      // Extract spoken time ("at 2pm", "at noon", etc.) and apply visibly.
      const spokenTime = extractTimeFromTranscript(transcript);
      if (spokenTime) {
        setTime(spokenTime);
        timeRef.current = spokenTime;
      }

      // Populate form fields — keep modal open for review.
      if (result.foods.length > 0) setFoods(result.foods);
      setMealType(result.mealType);
      if (result.notes) setNotes(result.notes);
      setDictate('idle');
    } catch (e) {
      setDictate('error');
      setDictateErr(e instanceof Error ? e.message : 'Could not analyse voice note. Please add items manually.');
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
        stopAndAnalyse();
        return;
      }

      clearSilenceTimer();
      silenceTimer.current = setTimeout(() => stopAndAnalyse(), SILENCE_MS);
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
  }, [clearNoSpeechTimer, clearSilenceTimer, stopAndAnalyse, stopRecognition]);

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
  // Listens for "save log / save it / save meal / submit log" while the form
  // is open and not currently recording. Restarts on iOS recognition end.

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
          const { date: d, time: tm, mealType: mt, foods: f, notes: n } = formValuesRef.current;
          saveLogRef.current(d, tm, mt, f, n);
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

  // ── Food item helpers ──────────────────────────────────────────────────────

  function addFood() {
    const trimmed = foodInput.trim();
    if (!trimmed) return;
    if (!foods.includes(trimmed)) setFoods(prev => [...prev, trimmed]);
    setFoodInput('');
    setError('');
  }

  function removeFood(f: string) { setFoods(prev => prev.filter(x => x !== f)); }

  function handleFoodKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addFood(); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveLog(date, time, mealType, foods, notes);
  }

  const meal        = MEAL_TYPES.find(m => m.id === mealType)!;
  const isRecording = dictate === 'listening';
  const isAnalysing = dictate === 'analysing';
  const showSaveHint = dictate === 'idle' && foods.length > 0;
  const submitLabel  = editTarget ? 'Save changes' : 'Log Meal';

  return (
    <Sheet
      title={editTarget ? 'Edit Meal' : 'Log Meal'}
      subtitle={isRecording ? 'Listening…' : isAnalysing ? 'Processing…' : 'Record what you ate'}
      icon={<UtensilsCrossed size={16} className="text-emerald-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* ── Recording ────────────────────────────────────────────── */}
        {isRecording && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <p className="text-sm font-medium text-red-700">Recording</p>
              </div>
              <button
                type="button"
                onClick={() => stopAndAnalyse()}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Square size={10} fill="currentColor" />
                Stop
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {liveText
                ? <span className="italic text-slate-700">"{liveText}"</span>
                : 'Speak now — stops after 5 s of silence or say "Log meal"'}
            </p>
          </div>
        )}

        {/* ── Analysing ────────────────────────────────────────────── */}
        {isAnalysing && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-2.5">
            <Loader2 size={14} className="animate-spin text-slate-500" />
            <p className="text-sm font-medium text-slate-600">Analysing your note…</p>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────── */}
        {dictate === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
            <p className="text-xs text-red-600">{dictateErr}</p>
            <button type="button" onClick={startDictation}
              className="text-xs font-medium text-red-700 underline">
              Try again
            </button>
          </div>
        )}

        {/* ── Date & Time ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[48px] bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[48px] bg-white" />
          </div>
        </div>

        {/* ── Meal type ────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2.5">Meal type</label>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map(m => (
              <Chip key={m.id} selected={mealType === m.id} activeColor="#10b981" size="sm" onClick={() => setMealType(m.id)}>
                {m.emoji} {m.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ── Food item input ──────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Food items <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input type="text" value={foodInput} onChange={e => setFoodInput(e.target.value)}
              onKeyDown={handleFoodKeyDown} placeholder="e.g. Pasta, Coffee, Banana…"
              className="flex-1 border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[48px] bg-white" />
            <Button type="button" variant="secondary" size="md" onClick={addFood}
              disabled={!foodInput.trim()} iconLeft={<Plus size={15} />}>
              Add
            </Button>
          </div>
          {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
        </div>

        {/* ── Selected foods ───────────────────────────────────────── */}
        {foods.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">
              {meal.emoji} {meal.label}: {foods.length} item{foods.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {foods.map(f => (
                <span key={f}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">
                  {f}
                  <button type="button" onClick={() => removeFood(f)}
                    className="text-emerald-500 hover:text-emerald-700 ml-0.5 p-0.5">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>

            {/* Voice save hint — shows after dictation populates foods */}
            {showSaveHint && (
              <p className="text-xs text-emerald-600 mt-2.5 leading-relaxed">
                ✓ Review your log and say <span className="font-semibold">"save log"</span> or tap Save
              </p>
            )}
          </div>
        )}

        {/* ── Notes ───────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notes <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Portion size, how it made you feel, where you ate…"
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none bg-white" />
        </div>

        {/* ── Buttons ─────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-1 pb-safe">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={isAnalysing}
            className="flex-1 !bg-emerald-500 hover:!bg-emerald-600 active:!bg-emerald-700">
            {submitLabel}
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
