import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Sheet, Button, Chip } from './ui';

interface Props {
  onClose: () => void;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime()  {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const STRESS_OPTIONS: Array<{ value: 'low' | 'medium' | 'high'; label: string; color: string }> = [
  { value: 'low',    label: 'Low',    color: '#22c55e' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high',   label: 'High',   color: '#ef4444' },
];

/** Slider row: label + coloured number + range input + legend */
function ScoreSlider({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label:    string;
  value:    number;
  onChange: (v: number) => void;
  low:      string;
  high:     string;
}) {
  const color =
    value <= 3 ? 'text-red-500' :
    value <= 6 ? 'text-amber-500' : 'text-green-600';

  const pct = ((value - 1) / 9) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className={`text-xl font-bold tabular-nums leading-none ${color}`}>
          {value}<span className="text-sm font-medium text-slate-400">/10</span>
        </span>
      </div>
      <input
        type="range"
        min={1} max={10}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-600 cursor-pointer"
        style={{
          background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
        }}
      />
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export default function CheckInModal({ onClose }: Props) {
  const { addCheckIn, getTodayCheckIn } = useApp();
  const existing = getTodayCheckIn();

  const [date,        setDate]        = useState(existing?.date        ?? todayStr());
  const [time,        setTime]        = useState(existing?.time        ?? nowTime());
  const [healthScore, setHealthScore] = useState(existing?.healthScore ?? 7);
  const [stress,      setStress]      = useState<'low'|'medium'|'high'>(existing?.stress ?? 'low');
  const [sleepHours,  setSleepHours]  = useState(existing?.sleepHours  ?? 7);
  const [energy,      setEnergy]      = useState(existing?.energy      ?? 7);
  const [mood,        setMood]        = useState(existing?.mood        ?? 7);
  const [notes,       setNotes]       = useState(existing?.notes       ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addCheckIn({ date, time, healthScore, stress, sleepHours, energy, mood, notes: notes.trim() });
    onClose();
  }

  const sleepPct = (sleepHours / 12) * 100;

  return (
    <Sheet
      title="Daily Check-In"
      subtitle={existing ? "Update today's wellness entry" : 'How are you feeling today?'}
      icon={<Heart size={16} className="text-rose-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* ── Date & Time ────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[48px] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[48px] bg-white"
            />
          </div>
        </div>

        {/* ── Health, Energy, Mood sliders ───────────── */}
        <ScoreSlider
          label="Overall Health"
          value={healthScore}
          onChange={setHealthScore}
          low="Poor"
          high="Excellent"
        />
        <ScoreSlider
          label="Energy Level"
          value={energy}
          onChange={setEnergy}
          low="Exhausted"
          high="Energised"
        />
        <ScoreSlider
          label="Mood"
          value={mood}
          onChange={setMood}
          low="Very Low"
          high="Great"
        />

        {/* ── Sleep slider ───────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-sm font-medium text-slate-700">Sleep Hours</label>
            <span className="text-xl font-bold tabular-nums text-blue-600 leading-none">
              {sleepHours}<span className="text-sm font-medium text-slate-400">h</span>
            </span>
          </div>
          <input
            type="range"
            min={0} max={12} step={0.5}
            value={sleepHours}
            onChange={e => setSleepHours(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
            style={{
              background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${sleepPct}%, #e2e8f0 ${sleepPct}%, #e2e8f0 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0h</span>
            <span>12h</span>
          </div>
        </div>

        {/* ── Stress level chips ─────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2.5">Stress Level</label>
          <div className="flex gap-2">
            {STRESS_OPTIONS.map(opt => (
              <Chip
                key={opt.value}
                selected={stress === opt.value}
                activeColor={opt.color}
                shape="rect"
                onClick={() => setStress(opt.value)}
                className="flex-1 justify-center min-h-[48px]"
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ── Notes ─────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything notable today…"
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
          />
        </div>

        {/* ── Action buttons ────────────────────────── */}
        <div className="flex gap-3 pt-1 pb-safe">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="flex-1 bg-rose-500 hover:bg-rose-600 active:bg-rose-700"
          >
            {existing ? 'Update Check-In' : 'Save Check-In'}
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
