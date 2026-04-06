import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_FORMS, SUPPLEMENT_FREQUENCY_LABELS } from '../types';
import type { SupplementSchedule, SupplementFrequency } from '../types';
import { Sheet, Button } from './ui';

interface Props {
  onClose: () => void;
  editSchedule?: SupplementSchedule;
}

const FREQUENCIES: SupplementFrequency[] = ['daily', 'twice_daily', 'weekly', 'as_needed'];

export default function SupplementScheduleModal({ onClose, editSchedule }: Props) {
  const { addSupplementSchedule, updateSupplementSchedule } = useApp();

  const [name,          setName]          = useState(editSchedule?.name ?? '');
  const [dosage,        setDosage]        = useState(editSchedule?.dosage ?? '');
  const [form,          setForm]          = useState(editSchedule?.form ?? '');
  const [frequency,     setFrequency]     = useState<SupplementFrequency>(editSchedule?.frequency ?? 'daily');
  const [reminderTime,  setReminderTime]  = useState(editSchedule?.reminderTime ?? '08:00');
  const [notes,         setNotes]         = useState(editSchedule?.notes ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name:         name.trim(),
      dosage:       dosage.trim() || undefined,
      form:         (form as typeof SUPPLEMENT_FORMS[number]) || undefined,
      frequency,
      reminderTime: frequency !== 'as_needed' ? reminderTime : undefined,
      notes:        notes.trim() || undefined,
      status:       'active' as const,
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

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Supplement Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputCls}
            placeholder="e.g. Vitamin D, Magnesium…"
            autoFocus
            required
          />
        </div>

        {/* Dosage + Form */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dosage</label>
            <input
              type="text"
              value={dosage}
              onChange={e => setDosage(e.target.value)}
              className={inputCls}
              placeholder="e.g. 1000 IU"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Form</label>
            <select value={form} onChange={e => setForm(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              {SUPPLEMENT_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Frequency</label>
          <div className="grid grid-cols-2 gap-2">
            {FREQUENCIES.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  frequency === f
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300'
                }`}
              >
                {SUPPLEMENT_FREQUENCY_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Reminder time (not for as_needed) */}
        {frequency !== 'as_needed' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reminder time</label>
            <input
              type="time"
              value={reminderTime}
              onChange={e => setReminderTime(e.target.value)}
              className={inputCls}
            />
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
