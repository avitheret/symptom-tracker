import { useState, useMemo } from 'react';
import { FlaskConical, AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { analyzeContributingFactors } from '../utils/analytics';

const CONFIDENCE_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-green-100 text-green-700',
};

const FACTOR_COLORS = [
  { bar: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
  { bar: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  { bar: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  { bar: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
  { bar: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
];

export default function ContributingFactors() {
  const { state, getPatientConditions } = useApp();

  const patientEntries = useMemo(
    () => state.entries.filter(e =>
      e.patientId === state.activePatientId &&
      e.reviewStatus !== 'to_review' &&
      e.reviewStatus !== 'disapproved'
    ),
    [state.entries, state.activePatientId]
  );
  const patientCheckIns = useMemo(
    () => state.checkIns.filter(c => c.patientId === state.activePatientId),
    [state.checkIns, state.activePatientId]
  );
  const patientTriggerLogs = useMemo(
    () => state.triggerLogs.filter(t => t.patientId === state.activePatientId),
    [state.triggerLogs, state.activePatientId]
  );

  const conditions = getPatientConditions(state.activePatientId ?? '');
  const [conditionId, setConditionId] = useState('');

  const result = useMemo(
    () => analyzeContributingFactors(
      patientEntries,
      patientCheckIns,
      patientTriggerLogs,
      conditionId || undefined,
    ),
    [patientEntries, patientCheckIns, patientTriggerLogs, conditionId]
  );

  const hasEnoughData = patientEntries.length >= 5;

  return (
    <div className="space-y-5">

      {/* Condition filter */}
      {conditions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Filter by Condition</label>
          <select
            value={conditionId}
            onChange={e => setConditionId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px]"
          >
            <option value="">All conditions</option>
            {conditions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Insufficient data state */}
      {!hasEnoughData && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center space-y-3">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
            <FlaskConical size={24} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Not enough data yet</p>
          <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
            Log at least 5 symptoms and complete daily check-ins to unlock contributing factor analysis.
          </p>
        </div>
      )}

      {/* No result (enough data but no pattern found) */}
      {hasEnoughData && !result && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center space-y-3">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
            <FlaskConical size={24} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No patterns detected yet</p>
          <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
            Complete more daily check-ins alongside your symptom logs to identify contributing factors. We need at least 3 high-severity entries with matching check-in data.
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Header card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <FlaskConical size={18} className="text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Estimated Contributing Factors
                    {result.conditionName && <span className="text-slate-400 font-normal"> — {result.conditionName}</span>}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_BADGE[result.confidence]}`}>
                    {result.confidence} confidence
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Based on {result.totalEntries} logged episodes · {result.dateRange.from} to {result.dateRange.to}
                </p>
              </div>
            </div>

            {/* Factor bars */}
            <div className="space-y-4">
              {result.factors.map((factor, idx) => {
                const color = FACTOR_COLORS[idx % FACTOR_COLORS.length];
                return (
                  <div key={factor.factor}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-sm font-semibold ${color.text}`}>{factor.factor}</span>
                      <span className={`text-sm font-bold ${color.text}`}>{factor.weight}%</span>
                    </div>
                    {/* Bar */}
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color.bar} rounded-full transition-all duration-700`}
                        style={{ width: `${factor.weight}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{factor.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {factor.dataPoints} data point{factor.dataPoints !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {result.disclaimer}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
