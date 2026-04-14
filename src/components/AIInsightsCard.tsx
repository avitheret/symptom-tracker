import { useState, useEffect } from 'react';
import { Sparkles, AlertTriangle, AlertCircle, Info, Lightbulb, Activity, Pill, X, Loader2, FileText, Zap, CheckCircle2, Shield } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { generateInsights, getCachedInsights } from '../utils/claudeInsights';
import { Button, Badge, SectionHeader, Skeleton } from './ui';


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

const CONFIDENCE_BADGE: Record<string, { variant: 'success' | 'warning' | 'default'; label: string }> = {
  high:   { variant: 'success', label: 'High confidence' },
  medium: { variant: 'warning', label: 'Medium' },
  low:    { variant: 'default', label: 'Low' },
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

function SkeletonInsightCard() {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
      <div className="flex gap-2.5 pr-6">
        <Skeleton className="h-5 w-5 flex-shrink-0" />
        <div className="space-y-2 min-w-0 flex-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-3 w-[60%]" />
        </div>
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  );
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

  // Provenance from first insight (all share same counts)
  const provenance = patientInsights[0];

  // Load cached insights on mount
  useEffect(() => {
    if (!patient || patientInsights.length > 0) return;
    const patientEntries = state.entries.filter(
      e => e.patientId === patient.id &&
      e.reviewStatus !== 'to_review' &&
      e.reviewStatus !== 'disapproved'
    );
    const patientMeds = state.medicationLogs.filter(m => m.patientId === patient.id);
    const patientSupps = (state.supplementLogs ?? []).filter(s => s.patientId === patient.id);
    const cached = getCachedInsights(patient.id, patientEntries, patientMeds, patientSupps);
    if (cached) setAIInsights(cached);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id]);

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
      const patientSupps = (state.supplementLogs ?? []).filter(s => s.patientId === patient.id);

      const insights = await generateInsights({
        patientId: patient.id,
        patientName: patient.name,
        diagnosis: patient.diagnosis ?? 'Not specified',
        entries: patientEntries,
        checkIns: patientCheckIns,
        medications: patientMeds,
        supplementLogs: patientSupps,
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
          <span className="text-xs font-semibold text-violet-700">Multi-Factor Analysis</span>
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

          {/* Provenance label */}
          {!loading && provenance?.entryCount != null && provenance?.daySpan != null && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Shield size={10} />
              <span>Based on {provenance.entryCount} entries over {provenance.daySpan} days</span>
            </div>
          )}

          {/* Skeleton loaders while generating */}
          {loading && (
            <>
              {[1, 2, 3].map(i => (
                <SkeletonInsightCard key={`skeleton-${i}`} />
              ))}
            </>
          )}

          {/* Insights list */}
          {!loading && patientInsights.map(insight => {
            const style = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
            const CatIcon = CATEGORY_ICON[insight.category] ?? Lightbulb;
            const conf = insight.confidence ? CONFIDENCE_BADGE[insight.confidence] : null;

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

                {/* Content */}
                <div className="flex gap-2.5 pr-6">
                  <CatIcon size={15} className={`flex-shrink-0 mt-0.5 ${style.icon}`} />
                  <div className="space-y-2 min-w-0">
                    <p className="text-sm text-slate-800 leading-relaxed">{insight.content}</p>

                    {/* Factor chips */}
                    {insight.factors && insight.factors.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {insight.factors.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 text-[10px] font-medium text-slate-600">
                            <Zap size={8} className="text-amber-500" />{f}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actionable suggestion */}
                    {insight.actionable && (
                      <div className="flex items-start gap-1.5 bg-white/70 rounded-lg px-2.5 py-1.5">
                        <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-600 leading-relaxed">{insight.actionable}</p>
                      </div>
                    )}

                    {/* Confidence badge */}
                    {conf && (
                      <Badge variant={conf.variant} className="text-[9px]">
                        {conf.label}
                      </Badge>
                    )}
                  </div>
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
