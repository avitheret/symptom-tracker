/**
 * FoodLogModal — log a meal by voice (auto-starts) or manually.
 * Recording starts immediately on open.
 * Auto-stops after 5 s of silence, or when user says "Log meal".
 * If foods are extracted → auto-submits and closes.
 * If extraction fails → falls back to manual form.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { UtensilsCrossed, Plus, X, Square, Loader2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { MEAL_TYPES } from '../types';
import type { MealType } from '../types';
import { Sheet, Button, Chip } from './ui';
import { getSpeechRecognition } from '../utils/speech';
import { extractFoodLog, guessMealType } from '../utils/foodLogExtractor';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props { onClose: () => void; }
type DictateState = 'listening' | 'analysing' | 'idle' | 'error';

const SILENCE_MS = 5000;
const STOP_PHRASES = ['log meal', 'log it', 'done recording', 'submit meal'];

export default function FoodLogModal({ onClose }: Props) {
  const { addFoodLog } = useApp();

  const [date,        setDate]        = useState(todayStr());
  const [time,        setTime]        = useState(nowTime());
  const [mealType,    setMealType]    = useState<MealType>(guessMealType());
  const [foods,       setFoods]       = useState<string[]>([]);
  const [foodInput,   setFoodInput]   = useState('');
  const [notes,       setNotes]       = useState('');
  const [error,       setError]       = useState('');
  const [dictate,     setDictate]     = useState<DictateState>('idle');
  const [dictateErr,  setDictateErr]  = useState('');
  const [liveText,    setLiveText]    = useState('');

  // Refs so async callbacks always see latest values
  const recognitionRef  = useRef<ReturnType<typeof getSpeechRecognition> | null>(null);
  const transcriptRef   = useRef('');
  const silenceTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBusyRef       = useRef(false);
  const dateRef         = useRef(date);
  const timeRef         = useRef(time);

  useEffect(() => { dateRef.current = date; }, [date]);
  useEffect(() => { timeRef.current = time; }, [time]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
  }, []);

  const stopRecognition = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, [clearSilenceTimer]);

  // Stop recording, call Claude, auto-submit if foods found
  const stopAndAnalyse = useCallback(async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;

    const transcript = transcriptRef.current.trim();
    stopRecognition();

    if (!transcript) { setDictate('idle'); isBusyRef.current = false; return; }

    setDictate('analysing');
    try {
      const result = await extractFoodLog(transcript);
      if (result.foods.length > 0) {
        // Auto-submit
        addFoodLog({
          date: dateRef.current,
          time: timeRef.current,
          mealType: result.mealType,
          foods: result.foods,
          notes: (result.notes || '').trim(),
        });
        onClose();
      } else {
        // No foods extracted — fall back to manual form
        setMealType(result.mealType);
        if (result.notes) setNotes(result.notes);
        setDictate('idle');
      }
    } catch {
      setDictate('error');
      setDictateErr('Could not analyse voice note. Please add items manually.');
    }
    isBusyRef.current = false;
  }, [addFoodLog, onClose, stopRecognition]);

  // ── Voice recording ───────────────────────────────────────────────────────

  const startDictation = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setDictateErr('Speech recognition not supported in this browser.');
      setDictate('error');
      return;
    }

    isBusyRef.current = false;
    transcriptRef.current = '';
    setDictate('listening');
    setDictateErr('');
    setLiveText('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recognitionRef.current = rec;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + ' ';
      const t = full.trim();
      transcriptRef.current = t;
      setLiveText(t);

      // Stop phrase → strip it and submit
      const lower = t.toLowerCase();
      const hit = STOP_PHRASES.find(p => lower.includes(p));
      if (hit) {
        transcriptRef.current = t.replace(new RegExp(hit, 'gi'), '').trim();
        stopAndAnalyse();
        return;
      }

      // Reset silence timer
      clearSilenceTimer();
      silenceTimer.current = setTimeout(() => stopAndAnalyse(), SILENCE_MS);
    };

    rec.onerror = (e: { error: string }) => {
      clearSilenceTimer();
      recognitionRef.current = null;
      setDictate('error');
      setDictateErr(
        e.error === 'not-allowed'
          ? 'Microphone access denied. Please check permissions.'
          : 'Could not access microphone. Please try again.'
      );
    };

    rec.onend = () => { recognitionRef.current = null; };

    try {
      rec.start();
    } catch {
      clearSilenceTimer();
      recognitionRef.current = null;
      setDictate('error');
      setDictateErr('Could not start microphone.');
    }
  }, [clearSilenceTimer, stopAndAnalyse]);

  // Auto-start on open; cleanup on unmount
  useEffect(() => {
    startDictation();
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Manual submit ──────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (foods.length === 0) { setError('Add at least one food item.'); return; }
    addFoodLog({ date, time, mealType, foods, notes: notes.trim() });
    onClose();
  }

  const meal = MEAL_TYPES.find(m => m.id === mealType)!;
  const isRecording = dictate === 'listening';
  const isAnalysing = dictate === 'analysing';

  return (
    <Sheet
      title="Log Meal"
      subtitle={isRecording ? 'Listening…' : isAnalysing ? 'Processing…' : 'Record what you ate'}
      icon={<UtensilsCrossed size={16} className="text-emerald-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* ── Recording / Analysing status ────────────────────────── */}
        {(isRecording || isAnalysing) && (
          <div className={`rounded-xl border px-4 py-3 space-y-2 ${
            isRecording ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {isRecording ? (
                  <>
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-sm font-medium text-red-700">Recording</p>
                  </>
                ) : (
                  <>
                    <Loader2 size={14} className="animate-spin text-slate-500" />
                    <p className="text-sm font-medium text-slate-600">Analysing…</p>
                  </>
                )}
              </div>
              {isRecording && (
                <button
                  type="button"
                  onClick={() => stopAndAnalyse()}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Square size={10} fill="currentColor" />
                  Stop
                </button>
              )}
            </div>
            {isRecording && (
              <p className="text-xs text-slate-500 leading-relaxed">
                {liveText
                  ? <span className="italic text-slate-700">"{liveText}"</span>
                  : 'Speak now — stops after 5 s of silence or say "Log meal"'}
              </p>
            )}
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {dictate === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
            <p className="text-xs text-red-600">{dictateErr}</p>
            <button
              type="button"
              onClick={startDictation}
              className="text-xs font-medium text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Date & Time ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[48px] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
            <input
              type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[48px] bg-white"
            />
          </div>
        </div>

        {/* ── Meal type chips ─────────────────────────────────────── */}
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

        {/* ── Food item input ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Food items <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text" value={foodInput} onChange={e => setFoodInput(e.target.value)}
              onKeyDown={handleFoodKeyDown} placeholder="e.g. Pasta, Coffee, Banana…"
              className="flex-1 border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[48px] bg-white"
            />
            <Button type="button" variant="secondary" size="md" onClick={addFood}
              disabled={!foodInput.trim()} iconLeft={<Plus size={15} />}>
              Add
            </Button>
          </div>
          {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
        </div>

        {/* ── Selected foods ──────────────────────────────────────── */}
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
          </div>
        )}

        {/* ── Notes ──────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notes <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Portion size, how it made you feel, where you ate…"
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none bg-white"
          />
        </div>

        {/* ── Buttons ─────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-1 pb-safe">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={isAnalysing}
            className="flex-1 !bg-emerald-500 hover:!bg-emerald-600 active:!bg-emerald-700">
            Log Meal
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
