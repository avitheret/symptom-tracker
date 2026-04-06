import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_FORMS } from '../types';
import { Sheet, Button } from './ui';

interface Props {
  onClose: () => void;
  initialName?: string;
}

export default function SupplementModal({ onClose, initialName = '' }: Props) {
  const { addSupplementLog } = useApp();

  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [name,   setName]   = useState(initialName);
  const [dosage, setDosage] = useState('');
  const [form,   setForm]   = useState('');
  const [date,   setDate]   = useState(today);
  const [time,   setTime]   = useState(currentTime);
  const [notes,  setNotes]  = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addSupplementLog({
      name:   name.trim(),
      dosage: dosage.trim() || undefined,
      form:   (form as typeof SUPPLEMENT_FORMS[number]) || undefined,
      date,
      time,
      notes:  notes.trim(),
    });
    onClose();
  }

  return (
    <Sheet
      title="Log Supplement"
      icon={<FlaskConical size={16} className="text-teal-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

        {/* ── Name ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Supplement Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Vitamin D, Magnesium, Omega-3…"
            required
            autoFocus={!initialName}
            className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[48px] bg-white"
          />
        </div>

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
              max={today}
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
