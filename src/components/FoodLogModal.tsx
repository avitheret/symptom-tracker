/**
 * FoodLogModal — log a meal manually or by voice.
 * Voice note: user dictates → Claude extracts meal type + food items → pre-fills form.
 */
import { useState, useRef, useCallback } from 'react';
import { UtensilsCrossed, Plus, X, Mic, MicOff, Loader2 } from 'lucide-react';
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

interface Props {
  onClose: () => void;
}

type DictateState = 'idle' | 'listening' | 'analysing' | 'error';

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

  const recognitionRef = useRef<ReturnType<typeof getSpeechRecognition> | null>(null);
  const transcriptRef  = useRef('');

  // ── Food item helpers ──────────────────────────────────────────────────────

  function addFood() {
    const trimmed = foodInput.trim();
    if (!trimmed) return;
    if (!foods.includes(trimmed)) setFoods(prev => [...prev, trimmed]);
    setFoodInput('');
    setError('');
  }

  function removeFood(f: string) {
    setFoods(prev => prev.filter(x => x !== f));
  }

  function handleFoodKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addFood(); }
  }

  // ── Voice dictation ────────────────────────────────────────────────────────

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const startDictation = useCallback(async () => {
    const SR = getSpeechRecognition();
    if (!SR) { setDictateErr('Speech recognition not supported in this browser.'); setDictate('error'); return; }

    setDictate('listening');
    setDictateErr('');
    transcriptRef.current = '';

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    recognitionRef.current = rec;

    rec.onresult = (e: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcriptRef.current += e.results[i][0].transcript + ' ';
      }
    };

    rec.onerror = () => {
      stopRecognition();
      setDictate('error');
      setDictateErr('Could not access microphone. Please check permissions.');
    };

    rec.onend = async () => {
      recognitionRef.current = null;
      const transcript = transcriptRef.current.trim();
      if (!transcript) { setDictate('idle'); return; }

      setDictate('analysing');
      try {
        const result = await extractFoodLog(transcript);
        setMealType(result.mealType);
        if (result.foods.length > 0) setFoods(result.foods);
        if (result.notes) setNotes(result.notes);
        setDictate('idle');
      } catch {
        setDictate('error');
        setDictateErr('Could not analyse voice note. Please add items manually.');
      }
    };

    try {
      rec.start();
    } catch {
      setDictate('error');
      setDictateErr('Could not start microphone.');
    }
  }, [stopRecognition]);

  function handleMicToggle() {
    if (dictate === 'listening') {
      stopRecognition(); // triggers onend → analyse
    } else if (dictate === 'idle' || dictate === 'error') {
      startDictation();
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (foods.length === 0) { setError('Add at least one food item.'); return; }
    addFoodLog({ date, time, mealType, foods, notes: notes.trim() });
    onClose();
  }

  const meal = MEAL_TYPES.find(m => m.id === mealType)!;

  return (
    <Sheet
      title="Log Meal"
      subtitle="Record what you ate — manually or by voice"
      icon={<UtensilsCrossed size={16} className="text-emerald-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* ── Date & Time ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[48px] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[48px] bg-white"
            />
          </div>
        </div>

        {/* ── Meal type chips ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2.5">Meal type</label>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map(m => (
              <Chip
                key={m.id}
                selected={mealType === m.id}
                activeColor="#10b981"
                size="sm"
                onClick={() => setMealType(m.id)}
              >
                {m.emoji} {m.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ── Voice dictation ─────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Voice note</p>
              <p className="text-xs text-slate-400">Say what you ate — the app will extract it</p>
            </div>
            <button
              type="button"
              onClick={handleMicToggle}
              disabled={dictate === 'analysing'}
              className={[
                'w-11 h-11 rounded-full flex items-center justify-center transition-colors',
                dictate === 'listening'
                  ? 'bg-red-500 text-white animate-pulse'
                  : dictate === 'analysing'
                  ? 'bg-slate-200 text-slate-400'
                  : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200',
              ].join(' ')}
            >
              {dictate === 'analysing'
                ? <Loader2 size={18} className="animate-spin" />
                : dictate === 'listening'
                ? <MicOff size={18} />
                : <Mic size={18} />}
            </button>
          </div>
          {dictate === 'listening' && (
            <p className="text-xs text-emerald-600 font-medium animate-pulse">
              Listening… tap the mic again when done.
            </p>
          )}
          {dictate === 'analysing' && (
            <p className="text-xs text-slate-500">Analysing your note…</p>
          )}
          {dictateErr && (
            <p className="text-xs text-red-500">{dictateErr}</p>
          )}
        </div>

        {/* ── Food item input ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Food items <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={foodInput}
              onChange={e => setFoodInput(e.target.value)}
              onKeyDown={handleFoodKeyDown}
              placeholder={`e.g. Pasta, Coffee, Banana…`}
              className="flex-1 border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[48px] bg-white"
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={addFood}
              disabled={!foodInput.trim()}
              iconLeft={<Plus size={15} />}
            >
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
                <span
                  key={f}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium"
                >
                  {f}
                  <button
                    type="button"
                    onClick={() => removeFood(f)}
                    className="text-emerald-500 hover:text-emerald-700 ml-0.5 p-0.5"
                  >
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
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Portion size, how it made you feel, where you ate…"
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none bg-white"
          />
        </div>

        {/* ── Buttons ─────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-1 pb-safe">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="flex-1 !bg-emerald-500 hover:!bg-emerald-600 active:!bg-emerald-700"
          >
            Log Meal
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
