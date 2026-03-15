import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { generateForecast } from '../utils/analytics';

const BASIS_LABELS: Record<string, string> = {
  'day-of-week': 'Weekly pattern',
  'recent-trend': 'Rising trend',
  'cluster-density': 'High activity',
  'poor-sleep': 'Poor sleep',
  'high-stress': 'High stress',
  'recent-triggers': 'Recent triggers',
};

const CONFIDENCE_STYLES = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
};

export default function ForecastCard() {
  const { state } = useApp();

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

  const forecast = useMemo(
    () => generateForecast(patientEntries, patientCheckIns, patientTriggerLogs),
    [patientEntries, patientCheckIns, patientTriggerLogs]
  );

  if (!forecast) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-amber-200 rounded-xl">
            <TrendingUp size={15} className="text-amber-700" />
          </div>
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Health Forecast</span>
          <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold ${CONFIDENCE_STYLES[forecast.confidence]}`}>
            {forecast.confidence.charAt(0).toUpperCase() + forecast.confidence.slice(1)} confidence
          </span>
        </div>
        <p className="text-sm font-medium text-amber-900 leading-relaxed">{forecast.prediction}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {forecast.basis.map(b => (
            <span key={b} className="text-xs bg-amber-200/70 text-amber-800 px-2.5 py-1 rounded-full font-medium">
              {BASIS_LABELS[b] ?? b}
            </span>
          ))}
        </div>
        <p className="text-xs text-amber-600/80 mt-3 italic leading-relaxed">{forecast.disclaimer}</p>
      </div>
    </div>
  );
}
