/**
 * SupplementScheduleWidget — dashboard widget mirroring MedScheduleWidget.
 * Shows today's supplement schedule with "Mark as taken" actions.
 */
import { useMemo } from 'react';
import { Check, AlertTriangle, Plus, FlaskConical } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_TIME_WINDOWS } from '../types';
import type { SupplementTimeWindow } from '../types';
import { SectionHeader, Card, Badge } from './ui';

type DoseStatus = 'upcoming' | 'due' | 'overdue' | 'taken';

interface DoseItem {
  scheduleId: string;
  name: string;
  dosage?: string;
  doseTime: string;
  status: DoseStatus;
  form?: string;
  timeWindow?: SupplementTimeWindow;
}

interface Props {
  onAddSchedule: () => void;
}

/** Get the dose time for a schedule — uses timeWindow start, falls back to reminderTime or 08:00. */
function getScheduleDoseTime(schedule: { timeWindow?: SupplementTimeWindow; reminderTime?: string }): string {
  if (schedule.timeWindow && SUPPLEMENT_TIME_WINDOWS[schedule.timeWindow]) {
    return SUPPLEMENT_TIME_WINDOWS[schedule.timeWindow].start;
  }
  return schedule.reminderTime ?? '08:00';
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default function SupplementScheduleWidget({ onAddSchedule }: Props) {
  const { state, addSupplementLog } = useApp();

  const today = new Date().toISOString().slice(0, 10);

  const schedules = (state.supplementSchedules ?? []).filter(
    s => s.patientId === state.activePatientId && s.status === 'active'
  );

  const todayLogs = (state.supplementLogs ?? []).filter(
    l => l.patientId === state.activePatientId && l.date === today
  );

  const doses = useMemo((): DoseItem[] => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const items: DoseItem[] = [];

    for (const schedule of schedules) {
      // as_needed schedules don't show on dashboard
      if (schedule.frequency === 'as_needed') continue;

      const doseTime = getScheduleDoseTime(schedule);
      const [dh, dm] = doseTime.split(':').map(Number);
      const doseMins = dh * 60 + dm;

      // Taken if any log for this supplement exists today — regardless of time.
      // Normalise names so STT variants like "Omega-3" match schedule "Omega 3".
      const normName = (n: string) => n.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
      const taken = todayLogs.some(l => normName(l.name) === normName(schedule.name));

      let status: DoseStatus;
      if (taken) {
        status = 'taken';
      } else if (currentMins > doseMins + 30) {
        status = 'overdue';
      } else if (Math.abs(currentMins - doseMins) <= 5) {
        status = 'due';
      } else {
        status = 'upcoming';
      }

      items.push({
        scheduleId: schedule.id,
        name: schedule.name,
        dosage: schedule.dosage,
        doseTime,
        status,
        form: schedule.form,
        timeWindow: schedule.timeWindow,
      });
    }

    const ORDER: Record<DoseStatus, number> = { due: 0, overdue: 1, upcoming: 2, taken: 3 };
    items.sort((a, b) => {
      const ord = ORDER[a.status] - ORDER[b.status];
      if (ord !== 0) return ord;
      return a.doseTime.localeCompare(b.doseTime);
    });

    return items;
  }, [schedules, todayLogs]);

  function markAsTaken(dose: DoseItem) {
    addSupplementLog({
      name: dose.name,
      dosage: dose.dosage,
      form: dose.form as typeof import('../types').SUPPLEMENT_FORMS[number] | undefined,
      date: today,
      time: dose.doseTime,
      notes: 'Taken on schedule',
    });
  }

  // No schedules — show setup CTA
  if (schedules.length === 0) {
    return (
      <div>
        <SectionHeader title="Supplement Schedule" />
        <Card dashed interactive>
          <button
            onClick={onAddSchedule}
            className="w-full flex items-center justify-center gap-2 py-4 text-slate-400 hover:text-teal-600 transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">Set up supplement schedule</span>
          </button>
        </Card>
      </div>
    );
  }

  // All as_needed — show a simple summary
  if (doses.length === 0) {
    return (
      <div>
        <SectionHeader title="Supplement Schedule" />
        <Card padding>
          <div className="flex items-center gap-3 py-2">
            <FlaskConical size={16} className="text-teal-500" />
            <div>
              <p className="text-sm text-slate-700 font-medium">
                {schedules.length} supplement{schedules.length !== 1 ? 's' : ''} tracked
              </p>
              <p className="text-xs text-slate-400">All set to "as needed" — log when you take them</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const allTaken = doses.length > 0 && doses.every(d => d.status === 'taken');

  return (
    <div>
      <SectionHeader title="Supplement Schedule" />
      <Card padding>
        {allTaken ? (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">All supplements taken today!</p>
              <p className="text-xs text-slate-400">{doses.length} dose{doses.length !== 1 ? 's' : ''} completed</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {doses.map((dose, i) => (
              <div
                key={`${dose.scheduleId}-${dose.doseTime}-${i}`}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                  dose.status === 'due'
                    ? 'bg-teal-50 border border-teal-200'
                    : dose.status === 'overdue'
                    ? 'bg-amber-50 border border-amber-200'
                    : dose.status === 'taken'
                    ? 'bg-slate-50 border border-slate-100'
                    : 'bg-white border border-slate-100'
                }`}
              >
                <div className={`text-xs font-bold w-16 flex-shrink-0 ${
                  dose.status === 'due' ? 'text-teal-700' :
                  dose.status === 'overdue' ? 'text-amber-700' :
                  dose.status === 'taken' ? 'text-slate-400 line-through' :
                  'text-slate-600'
                }`}>
                  {formatTime12(dose.doseTime)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    dose.status === 'taken' ? 'text-slate-400 line-through' : 'text-slate-800'
                  }`}>
                    {dose.name}
                    {dose.dosage && <span className="font-normal text-slate-500"> {dose.dosage}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {dose.timeWindow ? SUPPLEMENT_TIME_WINDOWS[dose.timeWindow].label : 'Daily'}
                  </p>
                </div>

                {dose.status === 'taken' ? (
                  <Badge variant="success">
                    <Check size={10} className="inline mr-0.5" />Done
                  </Badge>
                ) : dose.status === 'overdue' ? (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-amber-500" />
                    <button
                      onClick={() => markAsTaken(dose)}
                      className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors"
                    >
                      Take
                    </button>
                  </div>
                ) : dose.status === 'due' ? (
                  <button
                    onClick={() => markAsTaken(dose)}
                    className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors animate-pulse"
                  >
                    Take Now
                  </button>
                ) : (
                  <button
                    onClick={() => markAsTaken(dose)}
                    className="px-2.5 py-1 border border-slate-200 text-slate-500 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
                  >
                    Mark Taken
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
