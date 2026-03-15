import { useMemo } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { detectTriggerPatterns, getTriggerFrequency } from '../utils/analytics';

export default function InsightTriggers() {
  const { state } = useApp();

  const patientId = state.activePatientId ?? '';
  const patientEntries = useMemo(
    () => state.entries.filter(e =>
      e.patientId === patientId &&
      e.reviewStatus !== 'to_review' &&
      e.reviewStatus !== 'disapproved'
    ),
    [state.entries, patientId],
  );
  const triggerLogs = useMemo(
    () => state.triggerLogs.filter(t => t.patientId === patientId),
    [state.triggerLogs, patientId],
  );

  const insights = useMemo(
    () => detectTriggerPatterns(patientEntries, triggerLogs),
    [patientEntries, triggerLogs],
  );

  const freqItems = useMemo(
    () => getTriggerFrequency(triggerLogs, patientEntries),
    [triggerLogs, patientEntries],
  );

  if (triggerLogs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
        <Zap size={32} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">No trigger data yet</p>
        <p className="text-slate-400 text-sm mt-1">
          Use the Triggers button in the header to log factors that may affect your symptoms.
        </p>
      </div>
    );
  }

  const maxCount = freqItems[0]?.count ?? 1;

  return (
    <div className="space-y-5">
      {/* Insights cards */}
      {insights.length > 0 && (
        <div className="space-y-3">
          {insights.map(insight => (
            <div
              key={insight.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-50 rounded-xl flex-shrink-0 mt-0.5">
                  <AlertTriangle size={16} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        insight.confidence === 'high'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {insight.confidence} confidence
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{insight.description}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {insight.dateRange.from} – {insight.dateRange.to} · {insight.supportingCount} supporting events
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trigger frequency chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Trigger Frequency</h3>
        <div className="space-y-2.5">
          {freqItems.slice(0, 10).map(item => {
            const barWidth = Math.round((item.count / maxCount) * 100);
            const highPct = item.count > 0 ? Math.round((item.highSevCount / item.count) * 100) : 0;
            return (
              <div key={item.trigger}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">{item.trigger}</span>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {item.highSevCount > 0 && (
                      <span className="text-red-500 font-medium">{highPct}% high-sev</span>
                    )}
                    <span className="tabular-nums font-medium text-slate-600">{item.count}×</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Based on {triggerLogs.length} trigger log{triggerLogs.length !== 1 ? 's' : ''}.
          "High-sev" indicates days with any symptom ≥7/10.
        </p>
      </div>

      {/* Recent trigger logs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Recent Trigger Logs</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {[...triggerLogs]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 15)
            .map(log => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <div className="p-1.5 bg-amber-50 rounded-lg flex-shrink-0 mt-0.5">
                  <Zap size={12} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {log.triggers.map(t => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    {log.date} · {log.dayOfWeek} · {log.time}
                    {log.conditionName && ` · ${log.conditionName}`}
                  </p>
                  {log.notes && (
                    <p className="text-xs text-slate-500 mt-0.5 italic">{log.notes}</p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
