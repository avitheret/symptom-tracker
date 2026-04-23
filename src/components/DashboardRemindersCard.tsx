import { useState, useCallback } from 'react';
import { Bell, Check, Plus, ChevronRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatTime12 } from '../utils/notifications';
import type { Reminder } from '../types';

// ── localStorage helpers ──────────────────────────────────────────────────────

const DONE_KEY = 'st-reminders-done';

type DoneRecord = Record<string, boolean>; // key = "{YYYY-MM-DD}|{reminderId}" or "{YYYY-MM-DD}|{reminderId}|{HH}"

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDone(): DoneRecord {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? '{}') as DoneRecord;
  } catch {
    return {};
  }
}

function saveDone(record: DoneRecord): void {
  // Prune entries older than 2 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const pruned: DoneRecord = {};
  for (const [key, val] of Object.entries(record)) {
    const datepart = key.split('|')[0];
    if (datepart && datepart >= cutoffStr) {
      pruned[key] = val;
    }
  }
  localStorage.setItem(DONE_KEY, JSON.stringify(pruned));
}

function doneKey(reminderId: string, hourStr?: string): string {
  const today = getToday();
  return hourStr ? `${today}|${reminderId}|${hourStr}` : `${today}|${reminderId}`;
}

// ── "Due today" filtering ─────────────────────────────────────────────────────

function isTodayDue(reminder: Reminder): boolean {
  if (!reminder.enabled) return false;

  const now = new Date();
  const dayOfWeek = now.getDay();       // 0 = Sun
  const dayOfMonth = now.getDate();     // 1–31

  switch (reminder.repeat) {
    case 'daily':
      return true;
    case 'hourly':
      return true;
    case 'weekly':
      return (reminder.daysOfWeek ?? []).includes(dayOfWeek);
    case 'monthly':
      return reminder.dayOfMonth === dayOfMonth;
    default:
      return false;
  }
}

/**
 * For hourly reminders: compute the NEXT upcoming occurrence (HH:00+MM) as HH:MM.
 * The reminder fires at :MM of every hour. Returns the next future fire time string.
 */
function nextHourlyTime(reminder: Reminder): string {
  const now = new Date();
  const mm = parseInt(reminder.time.split(':')[1] ?? '0', 10);

  const candidate = new Date(now);
  candidate.setMinutes(mm, 0, 0);

  // If we've already passed :MM this hour, advance to next hour
  if (candidate <= now) {
    candidate.setHours(candidate.getHours() + 1);
  }

  const hh = String(candidate.getHours()).padStart(2, '0');
  const mins = String(candidate.getMinutes()).padStart(2, '0');
  return `${hh}:${mins}`;
}

// ── Exported helper for Dashboard badge count ─────────────────────────────────

export function countDueTodayReminders(
  reminders: Reminder[],
  activePatientId: string,
): number {
  return reminders.filter(
    r => r.patientId === activePatientId && isTodayDue(r)
  ).length;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onAddReminder: () => void;
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps {
  reminder: Reminder;
  isDone: boolean;
  displayTime: string;
  onToggle: () => void;
}

function ReminderRow({ reminder, isDone, displayTime, onToggle }: RowProps) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {/* Circle checkbox */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center min-h-[44px] min-w-[44px] -mx-1.5 transition-all active:scale-95"
      >
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
            isDone
              ? 'bg-emerald-400 border-emerald-400'
              : 'border-white/30 bg-transparent'
          }`}
        >
          {isDone && <Check size={14} strokeWidth={3} className="text-white" />}
        </div>
      </button>

      {/* Title */}
      <p
        className={`flex-1 text-sm font-medium min-w-0 truncate transition-all ${
          isDone ? 'line-through opacity-40 text-white' : 'text-white'
        }`}
      >
        {reminder.title}
      </p>

      {/* Time badge */}
      <span
        className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-lg ${
          isDone
            ? 'bg-white/10 text-white/40'
            : 'bg-white/15 text-white/80'
        }`}
      >
        {displayTime}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const MAX_VISIBLE = 4;

export default function DashboardRemindersCard({ onAddReminder }: Props) {
  const { state, setView } = useApp();
  const [done, setDone] = useState<DoneRecord>(() => loadDone());

  const reminders = (state.reminders ?? []).filter(
    r => r.patientId === state.activePatientId && isTodayDue(r)
  );

  const toggleDone = useCallback((reminder: Reminder) => {
    const now = new Date();
    const hourStr = reminder.repeat === 'hourly'
      ? String(now.getHours()).padStart(2, '0')
      : undefined;
    const key = doneKey(reminder.id, hourStr);
    setDone(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveDone(next);
      return next;
    });
  }, []);

  function isRowDone(reminder: Reminder): boolean {
    const now = new Date();
    const hourStr = reminder.repeat === 'hourly'
      ? String(now.getHours()).padStart(2, '0')
      : undefined;
    return !!done[doneKey(reminder.id, hourStr)];
  }

  function getDisplayTime(reminder: Reminder): string {
    if (reminder.repeat === 'hourly') {
      return formatTime12(nextHourlyTime(reminder));
    }
    return formatTime12(reminder.time);
  }

  const visible = reminders.slice(0, MAX_VISIBLE);
  const overflow = reminders.length - MAX_VISIBLE;

  if (reminders.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur rounded-2xl p-4 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={15} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white/90">Today's Reminders</h3>
        </div>
        <div className="flex flex-col items-center py-3 gap-3">
          <p className="text-sm text-white/50">No reminders today</p>
          <button
            onClick={onAddReminder}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-semibold rounded-xl min-h-[44px] transition-all"
          >
            <Plus size={14} />
            Add Reminder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl p-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white/90">Today's Reminders</h3>
        </div>
        <button
          onClick={onAddReminder}
          aria-label="Add reminder"
          className="p-1.5 hover:bg-white/15 active:scale-95 rounded-lg transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <Plus size={15} className="text-white/70" />
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/10">
        {visible.map(r => (
          <ReminderRow
            key={r.id}
            reminder={r}
            isDone={isRowDone(r)}
            displayTime={getDisplayTime(r)}
            onToggle={() => toggleDone(r)}
          />
        ))}
      </div>

      {/* Overflow link */}
      {overflow > 0 && (
        <button
          onClick={() => setView('reminders' as Parameters<typeof setView>[0])}
          className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-medium text-white/60 hover:text-white/90 transition-colors min-h-[36px]"
        >
          +{overflow} more
          <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}
