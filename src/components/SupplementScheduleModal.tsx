import { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_TIME_WINDOWS } from '../types';
import type { SupplementSchedule, SupplementTimeWindow, SupplementDatabaseEntry } from '../types';
import { Sheet, Button } from './ui';

interface Props {
  onClose: () => void;
  editSchedule?: SupplementSchedule;
  supplementPrefill?: { name?: string; timeWindow?: SupplementTimeWindow; quantity?: string };
}

const TIME_WINDOW_KEYS = Object.keys(SUPPLEMENT_TIME_WINDOWS) as SupplementTimeWindow[];

const TIME_WINDOW_DISPLAY: Record<SupplementTimeWindow, string> = {
  morning:   'First Thing 7-8am',
  breakfast: 'With Breakfast 8-9am',
  lunch:     'With Lunch 12-2pm',
  dinner:    'With Dinner 6-8pm',
  bed:       'Before Bed 9-11pm',
};

export default function SupplementScheduleModal({ onClose, editSchedule, supplementPrefill }: Props) {
  const { state, addSupplementSchedule, updateSupplementSchedule } = useApp();

  const dbEntries: SupplementDatabaseEntry[] = useMemo(
    () => (state.supplementDatabase ?? []).filter(e => e.patientId === state.activePatientId),
    [state.supplementDatabase, state.activePatientId],
  );

  const [name,          setName]          = useState(editSchedule?.name ?? supplementPrefill?.name ?? '');
  const [notes,         setNotes]         = useState(editSchedule?.notes ?? '');
  const [timeWindow,    setTimeWindow]    = useState<SupplementTimeWindow | ''>(editSchedule?.timeWindow ?? supplementPrefill?.timeWindow ?? '');
  const [quantity,      setQuantity]      = useState(editSchedule?.quantity ?? supplementPrefill?.quantity ?? '');
  const [description,   setDescription]   = useState(editSchedule?.description ?? '');

  // Auto-fill from supplementDatabase when name matches
  function handleNameChange(val: string) {
    setName(val);
    const match = dbEntries.find(e => e.name.toLowerCase() === val.toLowerCase().trim());
    if (match) {
      if (!timeWindow) setTimeWindow(match.timeWindow);
      if (!quantity) setQuantity(match.quantity);
      if (!description) setDescription(match.description);
    }
  }

  function selectDbEntry(entry: SupplementDatabaseEntry) {
    setName(entry.name);
    setTimeWindow(entry.timeWindow);
    setQuantity(entry.quantity);
    setDescription(entry.description);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name:         name.trim(),
      frequency:    'daily' as const,
      notes:        notes.trim() || undefined,
      status:       'active' as const,
      timeWindow:   (timeWindow as SupplementTimeWindow) || undefined,
      quantity:     quantity.trim() || undefined,
      description:  description.trim() || undefined,
    };

    if (editSchedule) {
      updateSupplementSchedule(editSchedule.id, payload);
    } else {
      addSupplementSchedule(payload);
    }
    onClose();
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white';

  return (
    <Sheet
      title={editSchedule ? 'Edit Supplement' : 'Add Supplement Schedule'}
      subtitle="Track recurring supplements with optional reminders"
      icon={<Clock size={16} className="text-teal-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* Quick-pick from database */}
        {!editSchedule && dbEntries.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quick Pick</label>
            <div className="flex flex-wrap gap-1.5">
              {dbEntries.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => selectDbEntry(entry)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    name === entry.name
                      ? 'bg-teal-500 text-white border-teal-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                  }`}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Supplement Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            className={inputCls}
            placeholder="e.g. Vitamin D, Magnesium…"
            autoFocus
            required
          />
        </div>

        {/* Timing chips */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Timing</label>
          <div className="flex flex-wrap gap-2">
            {TIME_WINDOW_KEYS.map(tw => (
              <button
                key={tw}
                type="button"
                onClick={() => setTimeWindow(timeWindow === tw ? '' : tw)}
                className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors min-h-[44px] active:scale-[0.98] ${
                  timeWindow === tw
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                }`}
              >
                {TIME_WINDOW_DISPLAY[tw]}
              </button>
            ))}
          </div>
        </div>

        {/* QTY */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">QTY</label>
          <input
            type="text"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className={inputCls}
            placeholder="e.g. 2 capsules, 1000mg"
          />
        </div>

        {/* What For (read-only when auto-filled) */}
        {description && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">What For</label>
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
              {description}
            </p>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={`${inputCls} resize-none`}
            rows={2}
            placeholder="e.g. Take with food"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="flex-1 bg-teal-600 hover:bg-teal-700"
            disabled={!name.trim()}
          >
            {editSchedule ? 'Save Changes' : 'Add Schedule'}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
        </div>

      </form>
    </Sheet>
  );
}
