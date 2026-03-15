import { useState } from 'react';
import { Zap, Plus, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { PREDEFINED_TRIGGERS } from '../types';
import { Sheet, Button, Chip } from './ui';

interface Props {
  onClose: () => void;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime()  {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TriggerModal({ onClose }: Props) {
  const { addTriggerLog, state, getPatientConditions } = useApp();
  const conditions = getPatientConditions(state.activePatientId ?? '');

  const [date,             setDate]             = useState(todayStr());
  const [time,             setTime]             = useState(nowTime());
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [customInput,      setCustomInput]      = useState('');
  const [conditionId,      setConditionId]      = useState('');
  const [notes,            setNotes]            = useState('');
  const [error,            setError]            = useState('');

  function toggleTrigger(t: string) {
    setSelectedTriggers(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
    setError('');
  }

  function addCustomTrigger() {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!selectedTriggers.includes(trimmed)) {
      setSelectedTriggers(prev => [...prev, trimmed]);
    }
    setCustomInput('');
    setError('');
  }

  function handleCustomKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addCustomTrigger(); }
  }

  function removeTrigger(t: string) {
    setSelectedTriggers(prev => prev.filter(x => x !== t));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedTriggers.length === 0) { setError('Select at least one trigger.'); return; }
    const cond = conditions.find(c => c.id === conditionId);
    addTriggerLog({
      date,
      time,
      triggers:      selectedTriggers,
      conditionId:   cond?.id,
      conditionName: cond?.name,
      notes:         notes.trim(),
    });
    onClose();
  }

  return (
    <Sheet
      title="Log Triggers"
      subtitle="Record factors that may affect your symptoms"
      icon={<Zap size={16} className="text-amber-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* ── Date & Time ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[48px] bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Time</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[48px] bg-white"
            />
          </div>
        </div>

        {/* ── Trigger chips ────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2.5">
            Triggers <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TRIGGERS.map(t => (
              <Chip
                key={t}
                selected={selectedTriggers.includes(t)}
                activeColor="#f59e0b"
                size="sm"
                onClick={() => toggleTrigger(t)}
              >
                {t}
              </Chip>
            ))}
          </div>
          {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
        </div>

        {/* ── Custom trigger input ─────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Custom Trigger
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              placeholder="e.g. Hot weather, Travel…"
              className="flex-1 border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[48px] bg-white"
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={addCustomTrigger}
              disabled={!customInput.trim()}
              iconLeft={<Plus size={15} />}
            >
              Add
            </Button>
          </div>
        </div>

        {/* ── Selected trigger summary ─────────────────── */}
        {selectedTriggers.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Selected:</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedTriggers.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTrigger(t)}
                    className="text-amber-500 hover:text-amber-700 ml-0.5 p-0.5"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Related condition ────────────────────────── */}
        {conditions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Related Condition <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              value={conditionId}
              onChange={e => setConditionId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white min-h-[48px]"
            >
              <option value="">None / General</option>
              {conditions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Notes ────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notes <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Context or observations…"
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white"
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
            className="flex-1 !bg-amber-500 hover:!bg-amber-600 active:!bg-amber-700"
          >
            Log Triggers
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
