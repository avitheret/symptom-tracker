import { useState, useMemo } from 'react';
import { Heart, Zap } from 'lucide-react';
import { formatDateHeader } from '../utils/analytics';
import { useApp } from '../contexts/AppContext';
import type { TrackingEntry, Condition, DailyCheckIn, TriggerLog } from '../types';

interface Props {
  entries: TrackingEntry[];
  conditions: Condition[];
}

function severityColor(s: number) {
  if (s >= 7) return 'text-red-500 bg-red-50';
  if (s >= 4) return 'text-amber-600 bg-amber-50';
  return 'text-green-600 bg-green-50';
}

type TimelineEvent =
  | { kind: 'entry'; time: string; data: TrackingEntry }
  | { kind: 'checkin'; time: string; data: DailyCheckIn }
  | { kind: 'trigger'; time: string; data: TriggerLog };

export default function HealthTimeline({ entries, conditions }: Props) {
  const { state } = useApp();
  const patientId = state.activePatientId ?? '';
  const checkIns = state.checkIns.filter(c => c.patientId === patientId);
  const triggerLogs = state.triggerLogs.filter(t => t.patientId === patientId);

  const [filterConditionId, setFilterConditionId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCheckIns, setShowCheckIns] = useState(true);
  const [showTriggers, setShowTriggers] = useState(true);

  const filteredEntries = useMemo(() => {
    return [...entries].filter(e => {
      if (filterConditionId && e.conditionId !== filterConditionId) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    });
  }, [entries, filterConditionId, dateFrom, dateTo]);

  const filteredCheckIns = useMemo(() => {
    if (!showCheckIns) return [];
    return checkIns.filter(c => {
      if (dateFrom && c.date < dateFrom) return false;
      if (dateTo && c.date > dateTo) return false;
      return true;
    });
  }, [checkIns, showCheckIns, dateFrom, dateTo]);

  const filteredTriggers = useMemo(() => {
    if (!showTriggers) return [];
    return triggerLogs.filter(t => {
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    });
  }, [triggerLogs, showTriggers, dateFrom, dateTo]);

  // Group all events by date
  const grouped = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};

    for (const e of filteredEntries) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push({ kind: 'entry', time: e.time, data: e });
    }
    for (const c of filteredCheckIns) {
      if (!map[c.date]) map[c.date] = [];
      map[c.date].push({ kind: 'checkin', time: c.time, data: c });
    }
    for (const t of filteredTriggers) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push({ kind: 'trigger', time: t.time, data: t });
    }

    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, events]) => ({
        date,
        events: [...events].sort((a, b) => b.time.localeCompare(a.time)),
      }));
  }, [filteredEntries, filteredCheckIns, filteredTriggers]);

  const hasFilters = filterConditionId || dateFrom || dateTo;
  const totalEvents = grouped.reduce((s, g) => s + g.events.length, 0);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        {/* Row 1: condition filter + event count */}
        <div className="flex items-center gap-3">
          <select
            value={filterConditionId}
            onChange={e => setFilterConditionId(e.target.value)}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px]"
          >
            <option value="">All Conditions</option>
            {conditions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{totalEvents} events</span>
        </div>

        {/* Row 2: date range — stacked on mobile, inline on sm+ */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px]"
            />
            <span className="text-slate-400 text-xs flex-shrink-0">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px]"
            />
          </div>
          {hasFilters && (
            <button
              onClick={() => { setFilterConditionId(''); setDateFrom(''); setDateTo(''); }}
              className="text-sm text-blue-600 hover:underline font-medium py-1 min-h-[36px] sm:flex-shrink-0"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Row 3: type toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowCheckIns(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-colors min-h-[36px] ${
              showCheckIns ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            <Heart size={12} />Check-Ins
          </button>
          <button
            onClick={() => setShowTriggers(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-colors min-h-[36px] ${
              showTriggers ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            <Zap size={12} />Triggers
          </button>
        </div>
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400 text-sm">
          No events match the selected filters.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ date, events }) => {
            const label = formatDateHeader(date);
            return (
              <div key={date} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Day header */}
                <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">{label}</p>
                  <span className="text-xs text-slate-400">{events.length} {events.length === 1 ? 'event' : 'events'}</span>
                </div>
                {/* Events */}
                <div className="divide-y divide-slate-50">
                  {events.map((event, idx) => {
                    if (event.kind === 'entry') {
                      const entry = event.data;
                      const cond = conditions.find(c => c.id === entry.conditionId);
                      return (
                        <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                          <span className="text-xs text-slate-400 tabular-nums w-10 flex-shrink-0 pt-0.5">{entry.time}</span>
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                            style={{ backgroundColor: cond?.color ?? '#94a3b8' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{entry.symptomName}</p>
                            <p className="text-xs text-slate-400">{entry.conditionName}</p>
                            {entry.triggers && entry.triggers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {entry.triggers.map(t => (
                                  <span key={t} className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-xs">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {entry.notes && (
                              <p className="text-xs text-slate-500 mt-1 italic">{entry.notes}</p>
                            )}
                          </div>
                          <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full flex-shrink-0 ${severityColor(entry.severity)}`}>
                            {entry.severity}/10
                          </span>
                        </div>
                      );
                    }

                    if (event.kind === 'checkin') {
                      const ci = event.data;
                      return (
                        <div key={`ci-${idx}`} className="flex items-start gap-3 px-5 py-3 bg-rose-50/30">
                          <span className="text-xs text-slate-400 tabular-nums w-10 flex-shrink-0 pt-0.5">{ci.time}</span>
                          <div className="p-1 bg-rose-100 rounded-full flex-shrink-0 mt-0.5">
                            <Heart size={11} className="text-rose-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-rose-700">Daily Check-In</p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                              <span>Health {ci.healthScore}/10</span>
                              <span>·</span>
                              <span>Sleep {ci.sleepHours}h</span>
                              <span>·</span>
                              <span>Energy {ci.energy}/10</span>
                              <span>·</span>
                              <span className={
                                ci.stress === 'high' ? 'text-red-500' :
                                ci.stress === 'medium' ? 'text-amber-500' : 'text-green-600'
                              }>
                                {ci.stress} stress
                              </span>
                            </div>
                            {ci.notes && (
                              <p className="text-xs text-slate-500 mt-0.5 italic">{ci.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (event.kind === 'trigger') {
                      const tl = event.data;
                      return (
                        <div key={tl.id} className="flex items-start gap-3 px-5 py-3 bg-amber-50/30">
                          <span className="text-xs text-slate-400 tabular-nums w-10 flex-shrink-0 pt-0.5">{tl.time}</span>
                          <div className="p-1 bg-amber-100 rounded-full flex-shrink-0 mt-0.5">
                            <Zap size={11} className="text-amber-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-amber-700">Trigger Log</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tl.triggers.map(t => (
                                <span key={t} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                  {t}
                                </span>
                              ))}
                            </div>
                            {tl.notes && (
                              <p className="text-xs text-slate-500 mt-0.5 italic">{tl.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
