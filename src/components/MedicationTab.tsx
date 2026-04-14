import { useMemo, useState } from 'react';
import { Trash2, Download, Pill, Stethoscope, TrendingUp, ChevronDown, Plus } from 'lucide-react';
import { EmptyState } from './ui';
import { useApp } from '../contexts/AppContext';
import { EFFECTIVENESS_LABELS } from '../types';
import type { EffectivenessRating, MedicationLog, MedicationSchedule } from '../types';
import MedScheduleList from './MedScheduleList';

const EFFECTIVENESS_BADGE: Record<EffectivenessRating, string> = {
  no_effect: 'bg-slate-100 text-slate-500',
  slight: 'bg-yellow-100 text-yellow-700',
  moderate: 'bg-blue-100 text-blue-700',
  major: 'bg-green-100 text-green-700',
};

// Numeric score for averaging effectiveness
const EFFECTIVENESS_SCORE: Record<EffectivenessRating, number> = {
  no_effect: 0,
  slight: 1,
  moderate: 2,
  major: 3,
};

function medCsvExport(logs: MedicationLog[]) {
  const header = 'Name,Type,Dosage,Route,Date,Day,Time,Condition,Effectiveness,Notes';
  const rows = logs.map(l =>
    [
      `"${l.name.replace(/"/g, '""')}"`,
      l.type,
      l.dosage ?? '',
      l.route ?? '',
      l.date,
      l.dayOfWeek,
      l.time,
      l.conditionName ?? '',
      EFFECTIVENESS_LABELS[l.effectiveness],
      `"${l.notes.replace(/"/g, '""')}"`,
    ].join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medication-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function MedLogList({ logs, deleteMedicationLog }: { logs: MedicationLog[]; deleteMedicationLog: (id: string) => void }) {
  const [visibleCount, setVisibleCount] = useState(5);
  const visible = logs.slice(0, visibleCount);
  const hasMore = visibleCount < logs.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="divide-y divide-slate-50">
        {visible.map(log => (
          <div key={log.id} className="flex items-start gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group min-h-[60px]">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
              log.type === 'medication' ? 'bg-violet-100' : 'bg-blue-100'
            }`}>
              {log.type === 'medication'
                ? <Pill size={14} className="text-violet-600" />
                : <Stethoscope size={14} className="text-blue-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-slate-900">{log.name}</span>
                {log.dosage && (
                  <span className="text-xs text-slate-400">{log.dosage}</span>
                )}
                {log.route && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{log.route}</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {log.date} · {log.dayOfWeek} · {log.time}
                {log.conditionName && ` · ${log.conditionName}`}
              </p>
              {log.notes && (
                <p className="text-xs text-slate-500 mt-1 italic">{log.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${EFFECTIVENESS_BADGE[log.effectiveness]}`}>
                {EFFECTIVENESS_LABELS[log.effectiveness]}
              </span>
              <button
                onClick={() => deleteMedicationLog(log.id)}
                className="text-slate-300 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Delete log"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setVisibleCount(c => c + 5)}
          className="w-full py-3 text-sm text-violet-600 font-medium hover:bg-violet-50 transition-colors flex items-center justify-center gap-1.5 border-t border-slate-100"
        >
          <ChevronDown size={14} />
          Show more ({logs.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}

interface Props {
  onOpenMedSchedule?: () => void;
  onEditMedSchedule?: (schedule: MedicationSchedule) => void;
}

export default function MedicationTab({ onOpenMedSchedule, onEditMedSchedule }: Props = {}) {
  const { state, deleteMedicationLog } = useApp();

  const logs = useMemo(
    () =>
      state.medicationLogs
        .filter(m => m.patientId === state.activePatientId)
        .sort((a, b) => {
          const dc = b.date.localeCompare(a.date);
          return dc !== 0 ? dc : b.time.localeCompare(a.time);
        }),
    [state.medicationLogs, state.activePatientId]
  );

  // Summary stats
  const stats = useMemo(() => {
    if (logs.length === 0) return null;

    // Most used medication/treatment
    const nameCounts: Record<string, number> = {};
    for (const l of logs) {
      nameCounts[l.name] = (nameCounts[l.name] ?? 0) + 1;
    }
    const mostUsed = Object.entries(nameCounts).sort(([, a], [, b]) => b - a)[0];

    // Average effectiveness per name
    const nameScores: Record<string, { total: number; count: number }> = {};
    for (const l of logs) {
      if (!nameScores[l.name]) nameScores[l.name] = { total: 0, count: 0 };
      nameScores[l.name].total += EFFECTIVENESS_SCORE[l.effectiveness];
      nameScores[l.name].count++;
    }
    const bestEntry = Object.entries(nameScores)
      .filter(([, v]) => v.count >= 2)
      .map(([name, v]) => ({ name, avg: v.total / v.count }))
      .sort((a, b) => b.avg - a.avg)[0];

    const majorCount = logs.filter(l => l.effectiveness === 'major').length;

    return { mostUsed: mostUsed?.[0], mostUsedCount: mostUsed?.[1], bestMed: bestEntry?.name, majorCount };
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="space-y-4">
        {onOpenMedSchedule && (
          <MedScheduleList
            onAdd={onOpenMedSchedule}
            onEdit={s => onEditMedSchedule?.(s)}
          />
        )}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <EmptyState
            icon={<Pill size={22} />}
            title="No medications logged yet"
            description='Say "Hey Tracker, log medication" or tap the button to record a dose.'
            action={onOpenMedSchedule ? { label: 'Add Medication Schedule', onClick: onOpenMedSchedule, icon: <Plus size={15} /> } : undefined}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Medication Schedule section */}
      {onOpenMedSchedule && (
        <MedScheduleList
          onAdd={onOpenMedSchedule}
          onEdit={s => onEditMedSchedule?.(s)}
        />
      )}

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Logs</p>
          </div>
          {stats.mostUsed && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
              <p className="text-sm font-bold text-slate-900 truncate" title={stats.mostUsed}>{stats.mostUsed}</p>
              <p className="text-xs text-slate-500 mt-0.5">Most Logged ({stats.mostUsedCount}×)</p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center col-span-2 sm:col-span-1">
            <div className="flex items-center justify-center gap-1.5">
              <TrendingUp size={16} className="text-green-500" />
              <p className="text-2xl font-bold text-slate-900">{stats.majorCount}</p>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Major Relief Episodes</p>
          </div>
        </div>
      )}

      {/* Export + label */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{logs.length} log{logs.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => medCsvExport(logs)}
          className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-xs font-medium hover:bg-violet-700 transition-colors min-h-[44px]"
        >
          <Download size={13} />Export CSV
        </button>
      </div>

      {/* Log list */}
      <MedLogList logs={logs} deleteMedicationLog={deleteMedicationLog} />

      {/* Safety note */}
      <p className="text-xs text-slate-400 text-center px-4">
        This log is for personal tracking only and does not constitute medical advice. Always follow your prescriber's instructions.
      </p>
    </div>
  );
}
