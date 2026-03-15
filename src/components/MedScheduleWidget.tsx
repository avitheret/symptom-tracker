import { useMemo } from 'react';
import { Check, AlertTriangle, Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatTime12 } from '../utils/notifications';
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

        // Check if taken (match by name + today's date + approximate time)
        const taken = todayLogs.some(
          l => l.name.toLowerCase() === schedule.name.toLowerCase() && l.time === doseTime
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

  return (
    <div>
      <SectionHeader title="Meds Schedule" />
      <Card padding>
        {allTaken ? (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">All doses taken today!</p>
              <p className="text-xs text-slate-400">{doses.length} medication{doses.length !== 1 ? 's' : ''} completed</p>
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
                {/* Time */}
                <div className={`text-xs font-bold w-16 flex-shrink-0 ${
                  dose.status === 'due' ? 'text-teal-700' :
                  dose.status === 'overdue' ? 'text-amber-700' :
                  dose.status === 'taken' ? 'text-slate-400 line-through' :
                  'text-slate-600'
                }`}>
                  {formatTime12(dose.doseTime)}
                </div>

                {/* Med info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    dose.status === 'taken' ? 'text-slate-400 line-through' : 'text-slate-800'
                  }`}>
                    {dose.name}
                    {dose.dosage && <span className="font-normal text-slate-500"> {dose.dosage}</span>}
                  </p>
                </div>

                {/* Status / Action */}
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
