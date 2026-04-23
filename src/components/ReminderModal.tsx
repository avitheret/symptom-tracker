import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Reminder, ReminderRepeat } from '../types';
import { Sheet, Button } from './ui';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  reminder?: Reminder; // undefined = add mode
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REPEAT_OPTIONS: Array<{ value: ReminderRepeat; label: string }> = [
  { value: 'hourly',  label: 'Hourly'   },
  { value: 'daily',   label: 'Daily'    },
  { value: 'weekly',  label: 'Weekly'   },
  { value: 'monthly', label: 'Monthly'  },
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FULL_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReminderModal({ reminder, onClose }: Props) {
  const { state, addReminder, updateReminder } = useApp();

  const isEdit = reminder !== undefined;

  // Form state
  const [title, setTitle]       = useState(reminder?.title ?? '');
  const [time, setTime]         = useState(reminder?.time ?? '08:00');
  const [repeat, setRepeat]     = useState<ReminderRepeat>(reminder?.repeat ?? 'daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(reminder?.daysOfWeek ?? [1]); // Mon default
  const [dayOfMonth, setDayOfMonth] = useState<number>(reminder?.dayOfMonth ?? 1);
  const [enabled, setEnabled]   = useState(reminder?.enabled ?? true);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  const inputCls =
    'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-white';

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required.';
    if (!time) errs.time = 'Time is required.';
    if (repeat === 'weekly' && daysOfWeek.length === 0)
      errs.days = 'Select at least one day.';
    if (repeat === 'monthly' && !dayOfMonth)
      errs.dayOfMonth = 'Select a day of the month.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Day of week toggle ──────────────────────────────────────────────────────

  function toggleDay(day: number) {
    setDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  function handleSave() {
    if (!validate()) return;

    const payload = {
      patientId: state.activePatientId!,
      title: title.trim(),
      time,
      repeat,
      daysOfWeek: repeat === 'weekly' ? daysOfWeek : undefined,
      dayOfMonth: repeat === 'monthly' ? dayOfMonth : undefined,
      enabled,
    };

    if (isEdit) {
      updateReminder(reminder.id, {
        title:      payload.title,
        time:       payload.time,
        repeat:     payload.repeat,
        daysOfWeek: payload.daysOfWeek,
        dayOfMonth: payload.dayOfMonth,
        enabled:    payload.enabled,
      });
    } else {
      addReminder(payload);
    }
    onClose();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Sheet
      title={isEdit ? 'Edit Reminder' : 'Add Reminder'}
      subtitle={isEdit ? reminder.title : 'Set up a new notification'}
      icon={<Bell size={15} className="text-violet-500" />}
      onClose={onClose}
    >
      <div className="px-5 py-5 space-y-5 pb-8">

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Title <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: '' })); }}
            className={inputCls}
            placeholder="e.g. Take morning pills"
            autoFocus
          />
          {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title}</p>}
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Time <span className="text-rose-400">*</span>
          </label>
          <input
            type="time"
            value={time}
            onChange={e => { setTime(e.target.value); setErrors(prev => ({ ...prev, time: '' })); }}
            className={inputCls}
          />
          {errors.time && <p className="text-xs text-rose-500 mt-1">{errors.time}</p>}
        </div>

        {/* Repeat */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Repeat</label>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
            {REPEAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRepeat(opt.value)}
                className={`py-2 text-xs font-semibold rounded-lg transition-all min-h-[36px] ${
                  repeat === opt.value
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Days of week (Weekly only) */}
        {repeat === 'weekly' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Days of week</label>
            <div className="flex gap-2">
              {DAY_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={FULL_DAY_LABELS[idx]}
                  onClick={() => toggleDay(idx)}
                  className={`flex-1 min-h-[44px] rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    daysOfWeek.includes(idx)
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'border border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {errors.days && <p className="text-xs text-rose-500 mt-1">{errors.days}</p>}
          </div>
        )}

        {/* Day of month (Monthly only) */}
        {repeat === 'monthly' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Day of month</label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDayOfMonth(day)}
                  className={`w-10 h-10 rounded-xl text-xs font-semibold transition-all active:scale-95 flex-shrink-0 ${
                    dayOfMonth === day
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600 bg-white'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {errors.dayOfMonth && (
              <p className="text-xs text-rose-500 mt-1">{errors.dayOfMonth}</p>
            )}
          </div>
        )}

        {/* Active toggle */}
        <button
          type="button"
          onClick={() => setEnabled((v: boolean) => !v)}
          className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors min-h-[56px] ${
            enabled
              ? 'bg-violet-50 border-violet-200 text-violet-700'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <Bell size={16} className={enabled ? 'text-violet-500' : 'text-slate-400'} />
          <div className="text-left flex-1">
            <p className="text-sm font-semibold">
              {enabled ? 'Enabled' : 'Disabled'}
            </p>
            <p className="text-xs opacity-70">
              {enabled ? 'Reminder is active' : 'Reminder is paused'}
            </p>
          </div>
          {/* Toggle pill */}
          <div
            className={`w-11 h-6 rounded-full flex items-center transition-colors flex-shrink-0 ${
              enabled ? 'bg-violet-500 justify-end' : 'bg-slate-300 justify-start'
            }`}
          >
            <div className="w-5 h-5 bg-white rounded-full shadow-sm mx-0.5" />
          </div>
        </button>

        {/* Actions */}
        <div className="flex gap-3 pt-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Button
            variant="primary"
            size="lg"
            className="flex-1 bg-violet-600 hover:bg-violet-700"
            onClick={handleSave}
            disabled={!title.trim() || !time}
          >
            {isEdit ? 'Save Changes' : 'Add Reminder'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
