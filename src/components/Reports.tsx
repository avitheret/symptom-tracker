import { useState, useMemo, useEffect } from 'react';
import { Trash2, Download, BarChart2, List, TrendingUp, Stethoscope, GitMerge, Pill, Zap, Brain, Cloud, UtensilsCrossed } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../contexts/AppContext';
import DoctorReport from './DoctorReport';
import CorrelationCharts from './CorrelationCharts';
import MedicationTab from './MedicationTab';
import RootCauseCard from './RootCauseCard';
import WeatherReportSection from './WeatherReportSection';
import FoodLogSection from './FoodLogSection';
import TrackingModal from './TrackingModal';
import SwipeableRow from './SwipeableRow';
import { Button, Card, Chip, TabBar, SectionHeader, EmptyState, Badge } from './ui';
import type { TabItem } from './ui';
import type { TrackingEntry, FoodLog } from '../types';
import { MEAL_TYPES } from '../types';

type Range     = '7d' | '30d' | '90d' | 'all';
type ChartType = 'line' | 'bar';
type ReportTab = 'chart' | 'log' | 'triggers' | 'rootCauses' | 'weather' | 'food' | 'medications' | 'correlations' | 'doctor';

const RANGE_OPTIONS: Array<{ id: Range; label: string }> = [
  { id: '7d',  label: '7 Days'   },
  { id: '30d', label: '30 Days'  },
  { id: '90d', label: '90 Days'  },
  { id: 'all', label: 'All Time' },
];

const REPORT_TABS: TabItem<ReportTab>[] = [
  { id: 'chart',        label: 'Chart',        icon: <BarChart2   size={14} /> },
  { id: 'log',          label: 'Log',          icon: <List        size={14} /> },
  { id: 'triggers',     label: 'Triggers',     icon: <Zap         size={14} /> },
  { id: 'rootCauses',   label: 'Root Causes',  icon: <Brain       size={14} /> },
  { id: 'weather',      label: 'Weather',      icon: <Cloud           size={14} /> },
  { id: 'food',         label: 'Food',         icon: <UtensilsCrossed size={14} /> },
  { id: 'medications',  label: 'Meds',         icon: <Pill            size={14} /> },
  { id: 'correlations', label: 'Correlations', icon: <GitMerge    size={14} /> },
  { id: 'doctor',       label: 'Doctor',       icon: <Stethoscope size={14} /> },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function csvExport(entries: TrackingEntry[]) {
  const header = 'Symptom,Condition,Date,Day,Time,Severity,Notes,ReviewStatus,Source';
  const rows   = entries.map(e =>
    [e.symptomName, e.conditionName, e.date, e.dayOfWeek, e.time, e.severity,
      `"${e.notes.replace(/"/g, '""')}"`,
      e.reviewStatus ?? 'approved',
      e.sourceType ?? 'manual'].join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `symptom-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { state, deleteEntry, deleteFoodLog, getPatientConditions, getActivePatient } = useApp();

  const [range,             setRange]             = useState<Range>('30d');
  const [chartType,         setChartType]         = useState<ChartType>('line');
  const [filterConditionId, setFilterConditionId] = useState('');
  const [filterSymptomId,   setFilterSymptomId]   = useState('');
  const [tab,               setTab]               = useState<ReportTab>('chart');
  const [reviewFilter,      setReviewFilter]      = useState<'' | 'to_review'>('');
  const [editTarget,        setEditTarget]        = useState<TrackingEntry | null>(null);

  useEffect(() => {
    setFilterConditionId('');
    setFilterSymptomId('');
  }, [state.activePatientId]);

  const conditions     = getPatientConditions(state.activePatientId ?? '');
  const patientEntries = state.entries.filter(e => e.patientId === state.activePatientId);
  const cutoff         =
    range === 'all' ? '' :
    range === '7d'  ? daysAgo(7)  :
    range === '30d' ? daysAgo(30) : daysAgo(90);

  // ── Filtered entries ──────────────────────────────────────────
  const filtered = useMemo(() => {
    return [...patientEntries]
      .filter(e => {
        // Hide disapproved entries by default
        if (e.reviewStatus === 'disapproved') return false;
        // Review status filter
        if (reviewFilter === 'to_review' && e.reviewStatus !== 'to_review') return false;
        if (cutoff && e.date < cutoff) return false;
        if (filterConditionId && e.conditionId !== filterConditionId) return false;
        if (filterSymptomId   && e.symptomId   !== filterSymptomId)   return false;
        return true;
      })
      .sort((a, b) => {
        const cmp = b.date.localeCompare(a.date);
        return cmp !== 0 ? cmp : b.time.localeCompare(a.time);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientEntries, cutoff, filterConditionId, filterSymptomId, reviewFilter]);

  // ── Approved-only subset (for stats & charts) ───────────────
  const approvedFiltered = useMemo(() =>
    filtered.filter(e => e.reviewStatus !== 'to_review' && e.reviewStatus !== 'disapproved'),
    [filtered],
  );

  // ── Food logs filtered by date range ─────────────────────────
  const filteredMeals = useMemo((): FoodLog[] => {
    return state.foodLogs
      .filter(l => l.patientId === state.activePatientId)
      .filter(l => !cutoff || l.date >= cutoff)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.foodLogs, state.activePatientId, cutoff]);

  // Count of pending-review entries (for filter chip badge)
  const pendingReviewCount = patientEntries.filter(e => e.reviewStatus === 'to_review').length;

  // ── Stats (approved entries only) ─────────────────────────────
  const avgSev     = approvedFiltered.length
    ? (approvedFiltered.reduce((s, e) => s + e.severity, 0) / approvedFiltered.length).toFixed(1)
    : '—';
  const maxSev     = approvedFiltered.length ? Math.max(...approvedFiltered.map(e => e.severity)) : '—';
  const uniqueDays = new Set(approvedFiltered.map(e => e.date)).size;

  // ── Chart data (approved entries only) ────────────────────────
  const chartData = useMemo(() => {
    const byDate: Record<string, number[]> = {};
    approvedFiltered.forEach(e => { byDate[e.date] = [...(byDate[e.date] ?? []), e.severity]; });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sev]) => ({
        date:        date.slice(5),
        avgSeverity: parseFloat((sev.reduce((s, v) => s + v, 0) / sev.length).toFixed(1)),
        count:       sev.length,
      }));
  }, [approvedFiltered]);

  // ── Trigger data ──────────────────────────────────────────────
  const patientTriggerLogs = useMemo(() =>
    state.triggerLogs
      .filter(t => t.patientId === state.activePatientId && (!cutoff || t.date >= cutoff))
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
  [state.triggerLogs, state.activePatientId, cutoff]);

  const triggerFreqData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of patientTriggerLogs) {
      for (const t of log.triggers) { counts[t] = (counts[t] ?? 0) + 1; }
    }
    return Object.entries(counts)
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [patientTriggerLogs]);

  // ── Derived filter values ─────────────────────────────────────
  const availableSymptoms = filterConditionId
    ? conditions.find(c => c.id === filterConditionId)?.symptoms ?? []
    : [];
  const conditionColor = filterConditionId
    ? (conditions.find(c => c.id === filterConditionId)?.color ?? '#6366f1')
    : '#6366f1';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* ── Page header ──────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-400 mt-0.5">Analyse your symptom history and trends.</p>
      </div>

      {/* ── Summary stats ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Entries',      value: approvedFiltered.length },
          { label: 'Avg Severity', value: avgSev          },
          { label: 'Peak',         value: maxSev          },
          { label: 'Active Days',  value: uniqueDays      },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter card ───────────────────────────────────── */}
      <Card padding={false}>
        <div className="p-4 space-y-3">

          {/* Time range chips */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Time Range
            </p>
            <div className="flex gap-2 flex-wrap">
              {RANGE_OPTIONS.map(r => (
                <Chip
                  key={r.id}
                  selected={range === r.id}
                  activeColor="#4f46e5"
                  size="sm"
                  onClick={() => setRange(r.id)}
                >
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Condition chips */}
          {conditions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Condition
              </p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 flex-wrap">
                <Chip
                  selected={filterConditionId === ''}
                  activeColor="#6366f1"
                  size="sm"
                  onClick={() => { setFilterConditionId(''); setFilterSymptomId(''); }}
                >
                  All
                </Chip>
                {conditions.map(c => (
                  <Chip
                    key={c.id}
                    selected={filterConditionId === c.id}
                    activeColor={c.color}
                    dotColor={filterConditionId !== c.id ? c.color : undefined}
                    size="sm"
                    onClick={() => { setFilterConditionId(c.id); setFilterSymptomId(''); }}
                  >
                    {c.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Symptom chips (conditional on condition selection) */}
          {filterConditionId && availableSymptoms.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Symptom
              </p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 flex-wrap">
                <Chip
                  selected={filterSymptomId === ''}
                  activeColor={conditionColor}
                  size="sm"
                  onClick={() => setFilterSymptomId('')}
                >
                  All
                </Chip>
                {availableSymptoms.map(s => (
                  <Chip
                    key={s.id}
                    selected={filterSymptomId === s.id}
                    activeColor={conditionColor}
                    size="sm"
                    onClick={() => setFilterSymptomId(s.id)}
                  >
                    {s.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Review status filter */}
          {pendingReviewCount > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Review Status
              </p>
              <div className="flex gap-2 flex-wrap">
                <Chip
                  selected={reviewFilter === ''}
                  activeColor="#6366f1"
                  size="sm"
                  onClick={() => setReviewFilter('')}
                >
                  All
                </Chip>
                <Chip
                  selected={reviewFilter === 'to_review'}
                  activeColor="#f59e0b"
                  size="sm"
                  onClick={() => setReviewFilter('to_review')}
                >
                  To Review ({pendingReviewCount})
                </Chip>
              </div>
            </div>
          )}

          {/* Chart type toggle + export */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-50">
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setChartType('line')}
                title="Line chart"
                className={`p-2 rounded-lg transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center ${
                  chartType === 'line' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <TrendingUp size={15} />
              </button>
              <button
                onClick={() => setChartType('bar')}
                title="Bar chart"
                className={`p-2 rounded-lg transition-colors min-h-[34px] min-w-[34px] flex items-center justify-center ${
                  chartType === 'bar' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <BarChart2 size={15} />
              </button>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => csvExport(filtered)}
              disabled={filtered.length === 0}
              iconLeft={<Download size={13} />}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Tab bar ───────────────────────────────────────── */}
      <TabBar tabs={REPORT_TABS} active={tab} onChange={setTab} />

      {/* ── Chart tab ─────────────────────────────────────── */}
      {tab === 'chart' && (
        <Card>
          {chartData.length === 0 ? (
            <EmptyState
              icon={<BarChart2 size={24} />}
              title="No data to display"
              description="Try adjusting the filters or logging some symptoms."
              compact
            />
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-700 mb-4">
                Average Severity &amp; Frequency Over Time
              </p>
              <ResponsiveContainer width="100%" height={260}>
                {chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis yAxisId="left"  domain={[0, 10]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(15,23,42,0.08)' }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      yAxisId="left" type="monotone" dataKey="avgSeverity" name="Avg Severity"
                      stroke={conditionColor} strokeWidth={2.5}
                      dot={{ r: 3, fill: conditionColor }} activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right" type="monotone" dataKey="count" name="# Entries"
                      stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" dot={false}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(15,23,42,0.08)' }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="avgSeverity" name="Avg Severity" fill={conditionColor} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="count"       name="# Entries"    fill="#e2e8f0"       radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </>
          )}
        </Card>
      )}

      {/* ── Log tab ───────────────────────────────────────── */}
      {tab === 'log' && (() => {
        type LogItem =
          | { kind: 'symptom'; data: TrackingEntry; ts: number }
          | { kind: 'meal';    data: FoodLog;        ts: number };

        const combined: LogItem[] = [
          ...filtered.map(e  => ({ kind: 'symptom' as const, data: e,  ts: e.createdAt  })),
          ...filteredMeals.map(l => ({ kind: 'meal'    as const, data: l,  ts: l.createdAt  })),
        ].sort((a, b) => b.ts - a.ts);

        return (
          <Card padding={false}>
            {combined.length === 0 ? (
              <EmptyState
                icon={<List size={24} />}
                title="No entries found"
                description="Try adjusting the date range or condition filter."
                compact
              />
            ) : (
              <>
                <p className="text-xs text-slate-400 text-center py-2 bg-slate-50 border-b border-slate-100 sm:hidden">
                  Tap to edit symptoms · Swipe left to delete
                </p>
                <div className="divide-y divide-slate-50">
                  {combined.map(item => {
                    if (item.kind === 'meal') {
                      const log  = item.data;
                      const meal = MEAL_TYPES.find(m => m.id === log.mealType)!;
                      return (
                        <SwipeableRow key={`meal-${log.id}`} onDelete={() => deleteFoodLog(log.id)}>
                          <div className="flex items-start gap-3 px-4 py-4 min-h-[60px] group">
                            <span className="text-base flex-shrink-0 mt-0.5">{meal.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900 truncate">{log.foods.join(', ')}</span>
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{meal.label}</span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {log.date} · {log.dayOfWeek} · {log.time}
                              </p>
                              {log.notes && (
                                <p className="text-xs text-slate-500 mt-1 italic">{log.notes}</p>
                              )}
                            </div>
                          </div>
                        </SwipeableRow>
                      );
                    }
                    const entry = item.data;
                    const cond  = conditions.find(c => c.id === entry.conditionId);
                    const severityClass =
                      entry.severity >= 7 ? 'text-red-500' :
                      entry.severity >= 4 ? 'text-amber-500' : 'text-green-500';
                    return (
                      <SwipeableRow key={`sym-${entry.id}`} onDelete={() => deleteEntry(entry.id)}>
                        <div
                          className="flex items-start gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group min-h-[60px] cursor-pointer"
                          onClick={() => setEditTarget(entry)}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                            style={{ backgroundColor: cond?.color ?? '#94a3b8' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900">{entry.symptomName}</span>
                              {entry.reviewStatus === 'to_review' && <Badge variant="warning">Review</Badge>}
                              <span className="text-xs text-slate-400">–</span>
                              <span className="text-xs text-slate-500">{entry.conditionName}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {entry.date} · {entry.dayOfWeek} · {entry.time}
                            </p>
                            {entry.notes && (
                              <p className="text-xs text-slate-500 mt-1 italic">{entry.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-sm font-bold tabular-nums ${severityClass}`}>
                              {entry.severity}/10
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
                              className="hidden sm:flex text-slate-300 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-red-50 min-h-[36px] min-w-[36px] items-center justify-center"
                              title="Delete entry"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </SwipeableRow>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        );
      })()}

      {/* ── Edit entry modal ────────────────────────────────── */}
      {editTarget && (() => {
        const editCondition = conditions.find(c => c.id === editTarget.conditionId);
        return editCondition ? (
          <TrackingModal
            condition={editCondition}
            existingEntry={editTarget}
            onClose={() => setEditTarget(null)}
          />
        ) : null;
      })()}

      {/* ── Triggers tab ──────────────────────────────────── */}
      {tab === 'triggers' && (
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Trigger Frequency" />
            {triggerFreqData.length === 0 ? (
              <EmptyState
                icon={<Zap size={24} />}
                title="No triggers logged"
                description="Log triggers when recording symptoms to see frequency analysis."
                compact
              />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(160, triggerFreqData.length * 34)}
              >
                <BarChart
                  data={triggerFreqData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number"   tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                  <YAxis type="category" dataKey="trigger" tick={{ fontSize: 11 }} stroke="#94a3b8" width={100} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}
                    formatter={(v) => [`${v} time${v !== 1 ? 's' : ''}`, 'Logged']}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card padding={false}>
            <div className="px-4 pt-3 pb-1 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Trigger Log</p>
            </div>
            {patientTriggerLogs.length === 0 ? (
              <EmptyState
                title="No trigger entries"
                description="No triggers logged for the selected period."
                compact
              />
            ) : (
              <div className="divide-y divide-slate-50">
                {patientTriggerLogs.map(log => (
                  <div key={log.id} className="px-4 py-3.5 min-h-[60px]">
                    <p className="text-xs text-slate-400 mb-1.5">
                      {log.date} · {log.dayOfWeek} · {log.time}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {log.triggers.map(t => (
                        <span
                          key={t}
                          className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    {log.notes && (
                      <p className="text-xs text-slate-500 mt-1.5 italic">{log.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Root Causes tab ──────────────────────────────── */}
      {tab === 'rootCauses' && (
        <RootCauseCard
          conditionId={filterConditionId || undefined}
          dateFrom={cutoff || undefined}
          dateTo={undefined}
        />
      )}

      {/* ── Weather tab ───────────────────────────────────── */}
      {tab === 'weather' && (
        <WeatherReportSection
          entries={patientEntries}
          dateFrom={cutoff || undefined}
        />
      )}

      {/* ── Food Log tab ──────────────────────────────────── */}
      {tab === 'food' && <FoodLogSection />}

      {/* ── Correlations tab ──────────────────────────────── */}
      {tab === 'correlations' && <CorrelationCharts />}

      {/* ── Medications tab (log-only, no schedule management) */}
      {tab === 'medications' && <MedicationTab />}

      {/* ── Doctor report tab ─────────────────────────────── */}
      {tab === 'doctor' && (
        <DoctorReport
          entries={patientEntries}
          conditions={conditions}
          patientName={getActivePatient()?.name ?? 'Patient'}
          triggerLogs={state.triggerLogs.filter(t => t.patientId === state.activePatientId)}
          checkIns={state.checkIns.filter(c => c.patientId === state.activePatientId)}
          medicationLogs={state.medicationLogs.filter(m => m.patientId === state.activePatientId)}
        />
      )}
    </div>
  );
}
