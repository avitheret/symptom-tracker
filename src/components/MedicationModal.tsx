import { useState } from 'react';
import { Pill, Stethoscope } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { EFFECTIVENESS_LABELS, MEDICATION_ROUTES } from '../types';
import type { EffectivenessRating } from '../types';
import { Sheet, Button, Chip } from './ui';

interface Props {
  onClose: () => void;
}

/** Active colour for each effectiveness rating */
const EFFECTIVENESS_COLOR: Record<EffectivenessRating, string> = {
  no_effect: '#94a3b8',
  slight:    '#eab308',
  moderate:  '#3b82f6',
  major:     '#22c55e',
};

export default function MedicationModal({ onClose }: Props) {
  const { state, addMedicationLog, getPatientConditions } = useApp();
  const conditions = getPatientConditions(state.activePatientId ?? '');

  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [type,          setType]          = useState<'medication' | 'treatment'>('medication');
  const [name,          setName]          = useState('');
  const [dosage,        setDosage]        = useState('');
  const [route,         setRoute]         = useState('');
  const [date,          setDate]          = useState(today);
  const [time,          setTime]          = useState(currentTime);
  const [conditionId,   setConditionId]   = useState('');
  const [effectiveness, setEffectiveness] = useState<EffectivenessRating>('moderate');
  const [notes,         setNotes]         = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const selectedCondition = conditions.find(c => c.id === conditionId);
    addMedicationLog({
      name:          name.trim(),
      type,
      dosage:        dosage.trim() || undefined,
      route:         route || undefined,
      date,
      time,
      conditionId:   conditionId || undefined,
      conditionName: selectedCondition?.name,
      effectiveness,
      notes:         notes.trim(),
    });
    onClose();
  }

  return (
    <Sheet
      title="Log Medication / Treatment"
      icon={<Pill size={16} className="text-violet-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* ── Type toggle ──────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2.5">Type</label>
          <div className="flex gap-2">
            <Chip
              selected={type === 'medication'}
              activeColor="#7c3aed"
              shape="rect"
              onClick={() => setType('medication')}
              className="flex-1 justify-center min-h-[44px]"
            >
              <Pill size={14} className="mr-1" />Medication
            </Chip>
            <Chip
              selected={type === 'treatment'}
              activeColor="#7c3aed"
              shape="rect"
              onClick={() => setType('treatment')}
              className="flex-1 justify-center min-h-[44px]"
            >
              <Stethoscope size={14} className="mr-1" />Treatment
            </Chip>
          </div>
        </div>

        {/* ── Name ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {type === 'medication' ? 'Medication Name' : 'Treatment Name'}{' '}
            <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={
              type === 'medication'
                ? 'e.g. Ibuprofen, Sumatriptan…'
                : 'e.g. Ice pack, Massage, Physio…'
            }
            required
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 min-h-[48px] bg-white"
          />
        </div>

        {/* ── Dosage & Route (medications only) ───────── */}
        {type === 'medication' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Dosage</label>
              <input
                type="text"
                value={dosage}
                onChange={e => setDosage(e.target.value)}
                placeholder="e.g. 400mg"
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 min-h-[48px] bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Route</label>
              <select
                value={route}
                onChange={e => setRoute(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 min-h-[48px]"
              >
                <option value="">Select…</option>
                {MEDICATION_ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── Date & Time ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 min-h-[48px] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 min-h-[48px] bg-white"
            />
          </div>
        </div>

        {/* ── Related condition ────────────────────────── */}
        {conditions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Related Condition <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              value={conditionId}
              onChange={e => setConditionId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 min-h-[48px]"
            >
              <option value="">Not condition-specific</option>
              {conditions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {/* ── Effectiveness chips ──────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2.5">Effectiveness</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(EFFECTIVENESS_LABELS) as EffectivenessRating[]).map(r => (
              <Chip
                key={r}
                selected={effectiveness === r}
                activeColor={EFFECTIVENESS_COLOR[r]}
                shape="rect"
                onClick={() => setEffectiveness(r)}
                className="justify-center min-h-[44px]"
              >
                {EFFECTIVENESS_LABELS[r]}
              </Chip>
            ))}
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
            placeholder="Side effects, timing notes, how you felt…"
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-white"
          />
        </div>

        {/* ── Action buttons ───────────────────────────── */}
        <div className="flex gap-3 pt-1 pb-safe">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={!name.trim()}
            className="flex-1 bg-violet-600 hover:bg-violet-700 active:bg-violet-800"
          >
            Save Log
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
