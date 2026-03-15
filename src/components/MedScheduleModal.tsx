import { useState, useMemo } from 'react';
import { Clock, Bell } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { computeDoseTimes, formatTime12 } from '../utils/notifications';
import { MEDICATION_ROUTES } from '../types';
import type { MedicationSchedule } from '../types';
import { Sheet, Button } from './ui';

interface Props {
  onClose: () => void;
  editSchedule?: MedicationSchedule;
}

export default function MedScheduleModal({ onClose, editSchedule }: Props) {
  const { state, addMedSchedule, updateMedSchedule, getPatientConditions } = useApp();

  const [name, setName] = useState(editSchedule?.name ?? '');
  const [dosage, setDosage] = useState(editSchedule?.dosage ?? '');
  const [route, setRoute] = useState(editSchedule?.route ?? '');
  const [frequency, setFrequency] = useState(editSchedule?.frequency ?? 2);
  const [intervalHours, setIntervalHours] = useState(editSchedule?.intervalHours ?? 12);
  const [firstDoseTime, setFirstDoseTime] = useState(editSchedule?.firstDoseTime ?? '08:00');
  const [conditionId, setConditionId] = useState(editSchedule?.conditionId ?? '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(editSchedule?.notificationsEnabled ?? true);
  const [notes, setNotes] = useState(editSchedule?.notes ?? '');

  const conditions = getPatientConditions(state.activePatientId ?? '');

  // Compute dose times live
  const doseTimes = useMemo(
    () => computeDoseTimes(firstDoseTime, intervalHours, frequency),
    [firstDoseTime, intervalHours, frequency]
  );

  function handleFrequencyChange(val: number) {
    const f = Math.max(1, Math.min(12, val));
    setFrequency(f);
    if (f > 0) setIntervalHours(Math.round((24 / f) * 10) / 10);
  }

  function handleIntervalChange(val: number) {
    const i = Math.max(1, Math.min(24, val));
    setIntervalHours(i);
    if (i > 0) setFrequency(Math.max(1, Math.round(24 / i)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const condition = conditions.find(c => c.id === conditionId);

    if (editSchedule) {
      updateMedSchedule(editSchedule.id, {
        name: name.trim(),
        dosage: dosage.trim(),
        route: route || undefined,
        frequency,
        intervalHours,
        firstDoseTime,
        conditionId: conditionId || undefined,
        conditionName: condition?.name ?? undefined,
        notificationsEnabled,
        notes: notes.trim() || undefined,
      });
    } else {
      addMedSchedule({
        name: name.trim(),
        dosage: dosage.trim(),
        route: route || undefined,
        frequency,
        intervalHours,
        firstDoseTime,
        status: 'active',
        conditionId: conditionId || undefined,
        conditionName: condition?.name ?? undefined,
        notificationsEnabled,
        notes: notes.trim() || undefined,
      });
    }
    onClose();
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white';

  return (
    <Sheet
      title={editSchedule ? 'Edit Medication' : 'Add Medication Schedule'}
      subtitle="Set up recurring medication with dose times"
      icon={<Clock size={16} className="text-teal-500" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
        {/* Medication Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Medication Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputCls}
            placeholder="e.g. Naproxen"
            autoFocus
            required
          />
        </div>

        {/* Dosage */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Dosage</label>
          <input
            type="text"
            value={dosage}
            onChange={e => setDosage(e.target.value)}
            className={inputCls}
            placeholder="e.g. 1000mg"
          />
        </div>

        {/* Route */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Route</label>
          <select
            value={route}
            onChange={e => setRoute(e.target.value)}
            className={inputCls}
          >
            <option value="">— Select —</option>
            {MEDICATION_ROUTES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Frequency & Interval */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Times per day</label>
            <input
              type="number"
              value={frequency}
              onChange={e => handleFrequencyChange(Number(e.target.value))}
              className={inputCls}
              min={1}
              max={12}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hours between</label>
            <input
              type="number"
              value={intervalHours}
              onChange={e => handleIntervalChange(Number(e.target.value))}
              className={inputCls}
              min={1}
              max={24}
              step={0.5}
            />
          </div>
        </div>

        {/* First Dose Time */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">First dose at</label>
          <input
            type="time"
            value={firstDoseTime}
            onChange={e => setFirstDoseTime(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Live Dose Times Preview */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-teal-700 mb-2">
            <Clock size={12} className="inline mr-1" />
            Daily dose schedule
          </p>
          <div className="flex flex-wrap gap-2">
            {doseTimes.map((t, i) => (
              <span
                key={i}
                className="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-lg text-xs font-semibold"
              >
                {formatTime12(t)}
              </span>
            ))}
          </div>
        </div>

        {/* Related Condition */}
        {conditions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Related condition</label>
            <select
              value={conditionId}
              onChange={e => setConditionId(e.target.value)}
              className={inputCls}
            >
              <option value="">— None —</option>
              {conditions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Notifications Toggle */}
        <button
          type="button"
          onClick={() => setNotificationsEnabled(v => !v)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            notificationsEnabled
              ? 'bg-teal-50 border-teal-200 text-teal-700'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <Bell size={16} className={notificationsEnabled ? 'text-teal-500' : 'text-slate-400'} />
          <div className="text-left flex-1">
            <p className="text-sm font-medium">Dose reminders</p>
            <p className="text-xs opacity-70">
              {notificationsEnabled ? 'You will be notified when doses are due' : 'No notifications for this medication'}
            </p>
          </div>
          <div className={`w-10 h-6 rounded-full flex items-center transition-colors ${
            notificationsEnabled ? 'bg-teal-500 justify-end' : 'bg-slate-300 justify-start'
          }`}>
            <div className="w-5 h-5 bg-white rounded-full shadow-sm mx-0.5" />
          </div>
        </button>

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
            className="flex-1"
            disabled={!name.trim()}
          >
            {editSchedule ? 'Save Changes' : 'Add Schedule'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
