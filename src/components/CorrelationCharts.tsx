import { useMemo } from 'react';
import {
  ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getDailyCorrelationData, getTriggerFrequency } from '../utils/analytics';

const STRESS_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
      {message}
    </div>
  );
}

export default function CorrelationCharts() {
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
  const checkIns = useMemo(
    () => state.checkIns.filter(c => c.patientId === patientId),
    [state.checkIns, patientId],
  );
  const triggerLogs = useMemo(
    () => state.triggerLogs.filter(t => t.patientId === patientId),
    [state.triggerLogs, patientId],
  );

  const correlationData = useMemo(
    () => getDailyCorrelationData(checkIns, patientEntries),
    [checkIns, patientEntries],
  );

  const sleepScatter = useMemo(
    () => correlationData.filter(d => d.entryCount > 0),
    [correlationData],
  );

  const stressBarData = useMemo(() => {
    const groups: Record<string, { totalCount: number; totalSev: number; n: number }> = {
      low: { totalCount: 0, totalSev: 0, n: 0 },
      medium: { totalCount: 0, totalSev: 0, n: 0 },
      high: { totalCount: 0, totalSev: 0, n: 0 },
    };
    for (const d of correlationData) {
      groups[d.stress].totalCount += d.entryCount;
      groups[d.stress].totalSev += d.avgSeverity;
      groups[d.stress].n++;
    }
    return (['low', 'medium', 'high'] as const).map(s => ({
      stress: s.charAt(0).toUpperCase() + s.slice(1),
      stressKey: s,
      avgCount: groups[s].n ? parseFloat((groups[s].totalCount / groups[s].n).toFixed(1)) : 0,
      avgSeverity: groups[s].n ? parseFloat((groups[s].totalSev / groups[s].n).toFixed(1)) : 0,
      days: groups[s].n,
    }));
  }, [correlationData]);

  const triggerFreq = useMemo(
    () => getTriggerFrequency(triggerLogs, patientEntries).slice(0, 8),
    [triggerLogs, patientEntries],
  );

  return (
    <div className="space-y-6">
      {/* Sleep vs Severity Scatter */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={16} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-700">Sleep Hours vs Symptom Severity</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Each dot is a day with a check-in and at least one logged symptom. Coloured by stress level.
        </p>
        {sleepScatter.length < 3 ? (
          <EmptyState message="Not enough data — log more check-ins and symptoms." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="sleepHours"
                name="Sleep Hours"
                domain={[0, 12]}
                type="number"
                label={{ value: 'Sleep (hrs)', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#94a3b8' }}
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
              />
              <YAxis
                dataKey="avgSeverity"
                name="Avg Severity"
                domain={[0, 10]}
                label={{ value: 'Severity', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }}
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                formatter={(value: number | undefined, name: string | undefined) => [
                  name === 'sleepHours' ? `${value ?? 0}h` : `${value ?? 0}/10`,
                  name === 'sleepHours' ? 'Sleep' : 'Avg Severity',
                ]}
              />
              <Scatter data={sleepScatter} fill="#6366f1">
                {sleepScatter.map((d, i) => (
                  <Cell key={i} fill={STRESS_COLORS[d.stress] ?? '#6366f1'} fillOpacity={0.75} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 mt-2 justify-center">
          {(['low', 'medium', 'high'] as const).map(s => (
            <div key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STRESS_COLORS[s] }} />
              {s.charAt(0).toUpperCase() + s.slice(1)} stress
            </div>
          ))}
        </div>
      </div>

      {/* Stress vs Symptom Count & Severity */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Stress Level vs Symptom Load</h3>
        <p className="text-xs text-slate-400 mb-4">
          Average daily symptom count and severity for each stress level.
        </p>
        {correlationData.length < 3 ? (
          <EmptyState message="Not enough check-in data yet." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={stressBarData}
              margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="stress" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="left" domain={[0, 'auto']} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                formatter={(value: number | undefined, name: string | undefined) => [
                  name === 'avgCount' ? `${value ?? 0} symptoms` : `${value ?? 0}/10`,
                  name === 'avgCount' ? 'Avg Daily Symptoms' : 'Avg Severity',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="avgCount" name="Avg Daily Symptoms" radius={[4, 4, 0, 0]}>
                {stressBarData.map(d => (
                  <Cell key={d.stressKey} fill={STRESS_COLORS[d.stressKey]} fillOpacity={0.8} />
                ))}
              </Bar>
              <Bar yAxisId="right" dataKey="avgSeverity" name="Avg Severity" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Trigger Frequency Bar */}
      {triggerLogs.length >= 3 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Top Triggers</h3>
          <p className="text-xs text-slate-400 mb-4">
            How often each trigger has been logged, with high-severity co-occurrence highlighted.
          </p>
          {triggerFreq.length === 0 ? (
            <EmptyState message="No trigger logs found." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, triggerFreq.length * 36)}>
              <BarChart
                data={triggerFreq}
                layout="vertical"
                margin={{ top: 5, right: 40, bottom: 5, left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <YAxis dataKey="trigger" type="category" tick={{ fontSize: 11 }} stroke="#94a3b8" width={76} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                  formatter={(value: number | undefined, name: string | undefined) => [
                    value ?? 0,
                    name === 'count' ? 'Total logs' : 'With high-severity (≥7)',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="Total logs" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                <Bar dataKey="highSevCount" name="With high-severity (≥7)" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center pb-2">
        Correlations shown here are observational. Consult your healthcare provider for clinical interpretation.
      </p>
    </div>
  );
}
