/**
 * StoolWidget — compact dashboard card for stool log.
 * Shows today's count + last log details + quick "Log" button.
 */

import { useState, useMemo } from 'react';
import { Plus, Droplets } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import StoolLogModal from './StoolLogModal';

function bristolColors(type: number) {
  if (type <= 2) return { bg: 'bg-amber-100', text: 'text-amber-700' };
  if (type <= 4) return { bg: 'bg-green-100',  text: 'text-green-700' };
  if (type <= 6) return { bg: 'bg-orange-100', text: 'text-orange-700' };
  return           { bg: 'bg-red-100',   text: 'text-red-700' };
}

const BRISTOL_SHORT: Record<number, string> = {
  1: 'Hard', 2: 'Lumpy', 3: 'Cracked', 4: 'Smooth', 5: 'Blobs', 6: 'Mushy', 7: 'Liquid',
};

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function StoolWidget() {
  const { state, setView } = useApp();
  const [showModal, setShowModal] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const patientLogs = useMemo(() =>
    state.stoolLogs.filter(l => l.patientId === state.activePatientId),
    [state.stoolLogs, state.activePatientId]
  );

  const todayLogs = useMemo(() =>
    patientLogs.filter(l => l.date === today).sort((a, b) => b.createdAt - a.createdAt),
    [patientLogs, today]
  );

  const lastLog = useMemo(() =>
    patientLogs.length > 0
      ? patientLogs.reduce((a, b) => a.createdAt > b.createdAt ? a : b)
      : null,
    [patientLogs]
  );

  const lastIsToday = lastLog?.date === today;

  return (
    <section>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <button
            onClick={() => setView('stool')}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Droplets size={15} className="text-blue-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">Stool Log</p>
              {todayLogs.length > 0 ? (
                <p className="text-xs text-slate-400">{todayLogs.length} today</p>
              ) : (
                <p className="text-xs text-slate-400">None logged today</p>
              )}
            </div>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl min-h-[36px] active:scale-95 transition-transform"
          >
            <Plus size={13} />
            Log
          </button>
        </div>

        {/* Content */}
        {lastLog ? (
          <div className="px-4 pb-4">
            <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-3">
              {/* Bristol badge */}
              {(() => {
                const colors = bristolColors(lastLog.bristolType);
                return (
                  <div className={`flex-shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-xl ${colors.bg}`}>
                    <span className={`text-base font-black leading-none ${colors.text}`}>{lastLog.bristolType}</span>
                    <span className="text-[8px] text-slate-400 leading-tight">type</span>
                  </div>
                );
              })()}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">
                  {BRISTOL_SHORT[lastLog.bristolType]} · {lastLog.amount}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lastIsToday ? `Today ${formatTime(lastLog.time)}` : `${lastLog.date} ${formatTime(lastLog.time)}`}
                </p>
                {/* Flag pills */}
                {(lastLog.greasy || lastLog.floats || lastLog.urgency !== 'none' || lastLog.unusualFeatures.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lastLog.greasy && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Greasy</span>}
                    {lastLog.floats && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Floats</span>}
                    {lastLog.urgency !== 'none' && <span className="text-[10px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full capitalize">{lastLog.urgency}</span>}
                    {lastLog.unusualFeatures.slice(0, 2).map(f => (
                      <span key={f} className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full capitalize">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mini today summary if multiple logs */}
            {todayLogs.length > 1 && (
              <p className="text-xs text-slate-400 text-center mt-2">
                + {todayLogs.length - 1} more today
              </p>
            )}
          </div>
        ) : (
          <div className="px-4 pb-5 text-center space-y-2">
            <p className="text-sm text-slate-500">No entries yet</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[200px] mx-auto">
              Log each bowel movement to spot patterns
            </p>
          </div>
        )}
      </div>

      {showModal && <StoolLogModal onClose={() => setShowModal(false)} />}
    </section>
  );
}
