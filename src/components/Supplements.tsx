/**
 * Supplements — top-level section with tabbed view:
 *   Log  |  Schedules  |  My List
 */
import { useMemo, useState } from 'react';
import { FlaskConical, Trash2, Download, ChevronDown, Plus, CalendarClock, Database } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { SupplementLog, SupplementSchedule } from '../types';
import SupplementScheduleList from './SupplementScheduleList';
import SupplementDatabase from './SupplementDatabase';
import { TabBar, EmptyState } from './ui';
import type { TabItem } from './ui';

// ── Tab definitions ──────────────────────────────────────────────────────────

type SupTab = 'log' | 'schedules' | 'mylist';

const TABS: TabItem<SupTab>[] = [
  { id: 'log',       label: 'Log',       icon: <FlaskConical size={14} /> },
  { id: 'schedules', label: 'Schedules', icon: <CalendarClock size={14} /> },
  { id: 'mylist',    label: 'My List',   icon: <Database size={14} /> },
];

// ── CSV export ────────────────────────────────────────────────────────────────

function supplementCsvExport(logs: SupplementLog[]) {
  const header = 'Name,Dosage,Form,Date,Day,Time,Notes';
  const rows = logs.map(l =>
    [
      `"${l.name.replace(/"/g, '""')}"`,
      l.dosage ?? '',
      l.form ?? '',
      l.date,
      l.dayOfWeek,
      l.time,
      `"${l.notes.replace(/"/g, '""')}"`,
    ].join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `supplement-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Log list sub-component ────────────────────────────────────────────────────

function SupLogList({ logs, onDelete }: { logs: SupplementLog[]; onDelete: (id: string) => void }) {
  const [visibleCount, setVisibleCount] = useState(5);
  const visible = logs.slice(0, visibleCount);
  const hasMore = visibleCount < logs.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="divide-y divide-slate-50">
        {visible.map(log => (
          <div key={log.id} className="flex items-start gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group min-h-[60px]">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 bg-teal-100">
              <FlaskConical size={14} className="text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-slate-900">{log.name}</span>
                {log.dosage && (
                  <span className="text-xs text-slate-400">{log.dosage}</span>
                )}
                {log.form && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{log.form}</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {log.date} · {log.dayOfWeek} · {log.time}
              </p>
              {log.notes && (
                <p className="text-xs text-slate-500 mt-1 italic">{log.notes}</p>
              )}
            </div>
            <button
              onClick={() => onDelete(log.id)}
              className="text-slate-300 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-red-50 min-h-[36px] min-w-[36px] flex items-center justify-center flex-shrink-0"
              title="Delete log"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setVisibleCount(c => c + 5)}
          className="w-full py-3 text-sm text-teal-600 font-medium hover:bg-teal-50 transition-colors flex items-center justify-center gap-1.5 border-t border-slate-100"
        >
          <ChevronDown size={14} />
          Show more ({logs.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}

// ── Log tab content ───────────────────────────────────────────────────────────

function LogTab({ onOpenSupplementModal }: { onOpenSupplementModal?: () => void }) {
  const { state, deleteSupplementLog } = useApp();

  const logs = useMemo(
    () =>
      (state.supplementLogs ?? [])
        .filter(l => l.patientId === state.activePatientId)
        .sort((a, b) => {
          const dc = b.date.localeCompare(a.date);
          return dc !== 0 ? dc : b.time.localeCompare(a.time);
        }),
    [state.supplementLogs, state.activePatientId]
  );

  const stats = useMemo(() => {
    if (logs.length === 0) return null;
    const nameCounts: Record<string, number> = {};
    for (const l of logs) {
      nameCounts[l.name] = (nameCounts[l.name] ?? 0) + 1;
    }
    const mostUsed = Object.entries(nameCounts).sort(([, a], [, b]) => b - a)[0];
    return { mostUsed: mostUsed?.[0], mostUsedCount: mostUsed?.[1] };
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <EmptyState
          icon={<FlaskConical size={22} />}
          title="No supplements logged yet"
          description='Say "Hey Tracker, log vitamin D" or tap the button to record a supplement.'
          action={onOpenSupplementModal ? { label: 'Log Supplement', onClick: onOpenSupplementModal, icon: <Plus size={15} /> } : undefined}
          compact
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 gap-3">
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
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{logs.length} log{logs.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => supplementCsvExport(logs)}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-medium hover:bg-teal-700 transition-colors min-h-[36px]"
        >
          <Download size={13} />Export CSV
        </button>
      </div>

      <SupLogList logs={logs} onDelete={deleteSupplementLog} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  onOpenSupplementModal?: () => void;
  onOpenScheduleModal?: () => void;
  onEditSchedule?: (schedule: SupplementSchedule) => void;
}

export default function Supplements({ onOpenSupplementModal, onOpenScheduleModal, onEditSchedule }: Props) {
  const [tab, setTab] = useState<SupTab>('log');

  return (
    <div className="space-y-4">
      <TabBar tabs={TABS} active={tab} onChange={setTab} compact />

      {tab === 'log' && (
        <LogTab onOpenSupplementModal={onOpenSupplementModal} />
      )}

      {tab === 'schedules' && onOpenScheduleModal && (
        <SupplementScheduleList
          onAdd={onOpenScheduleModal}
          onEdit={s => onEditSchedule?.(s)}
        />
      )}

      {tab === 'mylist' && (
        <SupplementDatabase />
      )}
    </div>
  );
}
