import { useMemo } from 'react';
import { Check, Clock, X, Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatTime12 } from '../utils/notifications';
import { normSupp } from '../utils/supplementMatcher';
import { SectionHeader, Card, Badge } from './ui';

type DoseStatus = 'upcoming' | 'due' | 'overdue' | 'taken';

interface DoseItem {
  scheduleId: string;
  name: string;
  dosage: string;
  doseTime: string;
  status: DoseStatus;
  route?: string;
  conditionId?: string;
  conditionName?: string;
}

interface Props {
  onAddSchedule: () => void;
}

export default function MedScheduleWidget({ onAddSchedule }: Props) {
  const { state, addMedicationLog } = useApp();

  const today = new Date().toISOString().slice(0, 10);

  const schedules = state.medicationSchedules.filter(
    s => s.patientId === state.activePatientId && s.status === 'active'
  );

  const todayLogs = state.medicationLogs.filter(
    l => l.patientId === state.activePatientId && l.date === today
  );

  const doses = useMemo((): DoseItem[] => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const items: DoseItem[] = [];

    for (const schedule of schedules) {
      for (const doseTime of schedule.doseTimes) {
        const [dh, dm] = doseTime.split(':').map(Number);
        const doseMins = dh * 60 + dm;

        // Check if taken: name (normalized) + date only — no exact time check,
        // since voice logs record wall-clock time rather than scheduled dose time.
        const taken = todayLogs.some(
          l => normSupp(l.name) === normSupp(schedule.name)
        );

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
          route: schedule.route,
          conditionId: schedule.conditionId,
          conditionName: schedule.conditionName,
        });
      }
    }

    // Sort: due first, then overdue, then upcoming, then taken
    const ORDER: Record<DoseStatus, number> = { due: 0, overdue: 1, upcoming: 2, taken: 3 };
    items.sort((a, b) => {
      const ord = ORDER[a.status] - ORDER[b.status];
      if (ord !== 0) return ord;
      return a.doseTime.localeCompare(b.doseTime);
    });

    return items;
  }, [schedules, todayLogs]);

  function markAsTaken(dose: DoseItem) {
    addMedicationLog({
      name: dose.name,
      type: 'medication',
      dosage: dose.dosage,
      route: dose.route,
      date: today,
      time: dose.doseTime,
      conditionId: dose.conditionId,
      conditionName: dose.conditionName,
      effectiveness: 'moderate',
      notes: 'Taken on schedule',
    });
  }

  // No schedules — show setup CTA
  if (schedules.length === 0) {
    return (
      <div>
        <SectionHeader title="Meds Schedule" />
        <Card dashed interactive>
          <button
            onClick={onAddSchedule}
            className="w-full flex items-center justify-center gap-2 py-4 text-slate-400 hover:text-teal-600 transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">Set up medication schedule</span>
          </button>
        </Card>
      </div>
    );
  }

  const allTaken = doses.length > 0 && doses.every(d => d.status === 'taken');
  const remaining = doses.filter(d => d.status !== 'taken').length;

  return (
    <div>
      <SectionHeader
        title="Meds Schedule"
        action={{ label: '+ Add', onClick: onAddSchedule }}
      />
      <Card padding={false}>
        {/* Status summary header */}
        {allTaken ? (
          <div className="flex items-center justify-center gap-2 px-4 pt-3 pb-2">
            <Check size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-600">All doses complete ✓</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500 px-4 pt-3 pb-1">
            {remaining} of {doses.length} dose{doses.length !== 1 ? 's' : ''} remaining
          </p>
        )}

        {/* Timeline rows */}
        <div className="px-4 pb-3">
          {doses.map((dose, i) => (
            <div
              key={`${dose.scheduleId}-${dose.doseTime}-${i}`}
              className={`flex items-center gap-3 py-3 ${i < doses.length - 1 ? 'border-b border-slate-50' : ''}`}
            >
              {/* Status circle */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                dose.status === 'taken'
                  ? 'bg-emerald-100'
                  : dose.status === 'due'
                  ? 'bg-teal-500 animate-pulse'
                  : dose.status === 'overdue'
                  ? 'bg-red-100'
                  : 'bg-slate-100'
              }`}>
                {dose.status === 'taken' ? (
                  <Check size={16} className="text-emerald-600" />
                ) : dose.status === 'due' ? (
                  <Clock size={16} className="text-white" />
                ) : dose.status === 'overdue' ? (
                  <X size={16} className="text-red-500" />
                ) : (
                  <Clock size={16} className="text-slate-400" />
                )}
              </div>

              {/* Center content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-400">
                  {formatTime12(dose.doseTime)}
                </p>
                <p className={`text-sm font-semibold truncate ${
                  dose.status === 'taken' ? 'line-through text-slate-400' : 'text-slate-900'
                }`}>
                  {dose.name}
                  {dose.dosage && (
                    <span className="font-normal"> {dose.dosage}</span>
                  )}
                </p>
              </div>

              {/* Action button */}
              {dose.status === 'taken' ? (
                <Badge variant="success">
                  <Check size={10} className="inline mr-0.5" />Done
                </Badge>
              ) : dose.status === 'due' ? (
                <button
                  onClick={() => markAsTaken(dose)}
                  className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl min-h-[36px] hover:bg-teal-700 active:scale-95 transition-all"
                >
                  Take Now
                </button>
              ) : dose.status === 'overdue' ? (
                <button
                  onClick={() => markAsTaken(dose)}
                  className="px-3 py-2 bg-red-500 text-white text-xs font-semibold rounded-xl min-h-[36px] hover:bg-red-600 active:scale-95 transition-all"
                >
                  Log Now
                </button>
              ) : (
                <button
                  onClick={() => markAsTaken(dose)}
                  className="px-3 py-2 border border-slate-200 text-slate-500 text-xs font-medium rounded-xl min-h-[36px] hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Mark Taken
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
