/**
 * StoolView — the "Stool" tab — shows history of bowel movement logs.
 */

import { useState, useMemo } from 'react';
import { Plus, Trash2, Droplets, BarChart2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { StoolLog } from '../types';
import StoolLogModal from './StoolLogModal';

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatDate(dateStr: string): string {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS_SHORT[date.getDay()]}, ${MONTHS_SHORT[m - 1]} ${d}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Bristol color helpers ─────────────────────────────────────────────────────

function bristolColors(type: number) {
  if (type <= 2) return { bg: 'bg-amber-100',  text: 'text-amber-800',  ring: 'ring-amber-200'  };
  if (type <= 4) return { bg: 'bg-green-100',   text: 'text-green-800',  ring: 'ring-green-200'  };
  if (type <= 6) return { bg: 'bg-orange-100',  text: 'text-orange-800', ring: 'ring-orange-200' };
  return           { bg: 'bg-red-100',    text: 'text-red-800',    ring: 'ring-red-200'    };
}

const BRISTOL_LABEL: Record<number, string> = {
  1: 'Hard lumps', 2: 'Lumpy', 3: 'Cracked', 4: 'Smooth',
  5: 'Soft blobs', 6: 'Mushy', 7: 'Liquid',
};

// ── Log card ──────────────────────────────────────────────────────────────────

function LogCard({ log, onDelete }: { log: StoolLog; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const colors = bristolColors(log.bristolType);

  const flags: string[] = [];
  if (log.greasy)             flags.push('Greasy');
  if (log.floats)             flags.push('Floats');
  if (log.incompleteEmptying) flags.push('Incomplete');
  if (log.urgency !== 'none') flags.push(log.urgency === 'urgent' ? 'Urgent' : 'Soon');
  if (log.pain !== 'none')    flags.push(`Pain: ${log.pain}`);
  if (log.smell === 'strong') flags.push('Strong smell');
  log.unusualFeatures.forEach(f => flags.push(f.charAt(0).toUpperCase() + f.slice(1)));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
      <div className="flex items-start gap-3">
        {/* Bristol badge */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl ${colors.bg} ring-1 ${colors.ring}`}>
          <span className={`text-lg font-black leading-none ${colors.text}`}>{log.bristolType}</span>
          <span className={`text-[9px] font-medium ${colors.text} opacity-70 leading-tight`}>type</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">
              {BRISTOL_LABEL[log.bristolType]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colors.bg} ${colors.text}`}>
              {log.amount}
            </span>
          </div>

          <p className="text-xs text-slate-400 mt-0.5">
            {formatDate(log.date)} · {formatTime(log.time)}
          </p>

          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {flags.map(flag => (
                <span key={flag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {flag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <div>
          {confirmDelete ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 min-h-[36px]"
              >
                Keep
              </button>
              <button
                onClick={onDelete}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-red-600 text-white font-semibold min-h-[36px]"
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-xl text-slate-300 hover:text-red-400 hover:bg-red-50 active:scale-90 transition-all"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Grouped by date ───────────────────────────────────────────────────────────

function groupByDate(logs: StoolLog[]): Array<{ date: string; logs: StoolLog[] }> {
  const map = new Map<string, StoolLog[]>();
  for (const log of logs) {
    const existing = map.get(log.date) ?? [];
    existing.push(log);
    map.set(log.date, existing);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      logs: items.sort((a, b) => b.createdAt - a.createdAt),
    }));
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ logs }: { logs: StoolLog[] }) {
  if (logs.length === 0) return null;

  const last7 = logs.filter(l => l.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const avgPerDay = last7.length / 7;

  const healthyCount = logs.filter(l => l.bristolType >= 3 && l.bristolType <= 4).length;
  const healthyPct = Math.round((healthyCount / logs.length) * 100);

  const avgType = Math.round(logs.reduce((s, l) => s + l.bristolType, 0) / logs.length * 10) / 10;

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {[
        { label: 'Total', value: logs.length },
        { label: 'Avg/day (7d)', value: avgPerDay.toFixed(1) },
        { label: 'Healthy %', value: `${healthyPct}%` },
      ].map(({ label, value }) => (
        <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm py-3 text-center">
          <p className="text-lg font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        </div>
      ))}
      <div className="col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs text-slate-500">Avg Bristol type</span>
        <span className={`text-sm font-bold ${avgType >= 3 && avgType <= 4 ? 'text-green-600' : avgType < 3 ? 'text-amber-600' : 'text-orange-600'}`}>
          {avgType} — {avgType <= 2 ? 'Constipated' : avgType <= 4 ? 'Healthy range' : avgType <= 5 ? 'Slightly loose' : 'Very loose'}
        </span>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface Props {
  onOpenReports?: () => void;
}

export default function StoolView({ onOpenReports }: Props) {
  const { state, deleteStoolLog, setView } = useApp();
  const [showModal, setShowModal] = useState(false);

  const logs = useMemo(() =>
    state.stoolLogs
      .filter(l => l.patientId === state.activePatientId)
      .sort((a, b) => b.createdAt - a.createdAt),
    [state.stoolLogs, state.activePatientId]
  );

  const grouped = useMemo(() => groupByDate(logs), [logs]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stool Log</h1>
          {logs.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">{logs.length} entr{logs.length !== 1 ? 'ies' : 'y'}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              onClick={() => onOpenReports ? onOpenReports() : setView('reports')}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 active:scale-95 transition-all min-h-[44px]"
            >
              <BarChart2 size={15} />
              Reports
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl min-h-[44px] active:scale-95 transition-transform shadow-sm"
          >
            <Plus size={15} />
            Log
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar logs={logs} />

      {/* Empty state */}
      {logs.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
            <Droplets size={28} className="text-blue-400" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-700">No logs yet</p>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              Track each bowel movement to spot patterns and share with your doctor.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl min-h-[44px] active:scale-95 transition-transform"
          >
            <Plus size={15} />
            Log your first entry
          </button>
        </div>
      )}

      {/* Log list grouped by date */}
      {grouped.map(({ date, logs: dayLogs }) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-slate-500">{formatDate(date)}</p>
            <span className="text-xs text-slate-300">({dayLogs.length})</span>
          </div>
          {dayLogs.map(log => (
            <LogCard
              key={log.id}
              log={log}
              onDelete={() => deleteStoolLog(log.id)}
            />
          ))}
        </div>
      ))}

      {/* Log modal */}
      {showModal && <StoolLogModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
