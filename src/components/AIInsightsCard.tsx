import { useState } from 'react';
import { Sparkles, AlertTriangle, AlertCircle, Info, Lightbulb, Activity, Pill, X, Loader2, FileText } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { generateInsights } from '../utils/claudeInsights';
import { Button, SectionHeader } from './ui';


const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string; Icon: typeof AlertTriangle }> = {
  urgent:  { border: 'border-red-200',    bg: 'bg-red-50',    icon: 'text-red-500',    Icon: AlertTriangle },
  warning: { border: 'border-amber-200',  bg: 'bg-amber-50',  icon: 'text-amber-500',  Icon: AlertCircle },
  info:    { border: 'border-blue-200',   bg: 'bg-blue-50',   icon: 'text-blue-500',   Icon: Info },
};

const CATEGORY_ICON: Record<string, typeof Lightbulb> = {
  alert: AlertTriangle,
  tip: Lightbulb,
  pattern: Activity,
  medication: Pill,
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AIInsightsCard() {
  const { state, setAIInsights, dismissAIInsight, getActivePatient, getPatientConditions } = useApp();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const patient = getActivePatient();
  const patientInsights = state.aiInsights.filter(
    i => i.patientId === state.activePatientId && !i.dismissed
  );
  const latestTimestamp = patientInsights.length > 0
    ? Math.max(...patientInsights.map(i => i.generatedAt))
    : 0;

  const hasDiagnosis = !!patient?.diagnosis;

  async function handleGenerate() {
    if (!patient) return;

    setLoading(true);
    setError('');
    try {
      const patientConditions = getPatientConditions(patient.id);
      const patientEntries = state.entries.filter(
        e => e.patientId === patient.id &&
        e.reviewStatus !== 'to_review' &&
        e.reviewStatus !== 'disapproved'
      );
      const patientCheckIns = state.checkIns.filter(c => c.patientId === patient.id);
      const patientMeds = state.medicationLogs.filter(m => m.patientId === patient.id);

      const insights = await generateInsights({
        patientName: patient.name,
        diagnosis: patient.diagnosis ?? 'Not specified',
        entries: patientEntries,
        checkIns: patientCheckIns,
        medications: patientMeds,
        conditions: patientConditions,
      });

      setAIInsights(insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SectionHeader title="AI Insights" />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header bar */}
        <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-blue-50 border-b border-slate-100 flex items-center gap-2">
          <div className="p-1.5 bg-violet-200 rounded-lg">
            <Sparkles size={13} className="text-violet-700" />
          </div>
          <span className="text-xs font-semibold text-violet-700">AI-Powered</span>
          {latestTimestamp > 0 && (
            <span className="ml-auto text-xs text-slate-400">{timeAgo(latestTimestamp)}</span>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* Diagnosis prompt */}
          {!hasDiagnosis && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
              <div className="p-2 bg-amber-200 rounded-lg">
                <FileText size={14} className="text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">Add Medical Background</p>
                <p className="text-xs text-amber-600">
                  Go to Track &rarr; Patients &rarr; Edit to add your diagnosis for better insights
                </p>
              </div>
            </div>
          )}

          {/* Insights list */}
          {patientInsights.map(insight => {
            const style = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
            const CatIcon = CATEGORY_ICON[insight.category] ?? Lightbulb;
            return (
              <div
                key={insight.id}
                className={`relative rounded-xl border p-3 ${style.border} ${style.bg}`}
              >
                <button
                  onClick={() => dismissAIInsight(insight.id)}
                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/60 transition-colors"
                >
                  <X size={13} />
                </button>
                <div className="flex gap-2.5 pr-6">
                  <CatIcon size={15} className={`flex-shrink-0 mt-0.5 ${style.icon}`} />
                  <p className="text-sm text-slate-800 leading-relaxed">{insight.content}</p>
                </div>
              </div>
            );
          })}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Generate button */}
          <Button
            variant="primary"
            size="lg"
            onClick={handleGenerate}
            disabled={loading}
            iconLeft={loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            className="w-full"
          >
            {loading ? 'Analyzing...' : patientInsights.length > 0 ? 'Refresh Insights' : 'Generate Insights'}
          </Button>

          {/* Disclaimer */}
          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            AI insights are for informational purposes only. Always consult your healthcare provider.
          </p>
        </div>
      </div>
    </div>
  );
}
