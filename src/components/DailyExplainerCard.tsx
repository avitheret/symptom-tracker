/**
 * DailyExplainerCard — "Why am I feeling like this?" / "Explain today"
 * One button → Claude analyses all today's data → structured explanation.
 */
import { useState, useCallback } from 'react';
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { explainToday, getCachedExplanation, type DailyExplanation } from '../utils/dailyExplainer';
import { hexToRgba } from '../utils/colorUtils';

export default function DailyExplainerCard() {
  const { state, getActivePatient, getPatientConditions } = useApp();
  const today = new Date().toISOString().slice(0, 10);

  const activePatient = getActivePatient();
  const conditions    = activePatient ? getPatientConditions(activePatient.id) : [];

  const [result, setResult]   = useState<DailyExplanation | null>(() => getCachedExplanation(today, activePatient?.id));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const patientEntries       = state.entries.filter(e => e.patientId === state.activePatientId);
  const patientCheckIns      = state.checkIns.filter(c => c.patientId === state.activePatientId);
  const patientTriggers      = state.triggerLogs.filter(t => t.patientId === state.activePatientId);
  const patientMeds          = state.medicationLogs.filter(m => m.patientId === state.activePatientId);
  const patientSuppLogs      = (state.supplementLogs ?? []).filter(s => s.patientId === state.activePatientId);
  const patientSuppSchedules = (state.supplementSchedules ?? []).filter(s => s.patientId === state.activePatientId);

  const run = useCallback(async (force = false) => {
    if (!activePatient) return;
    setLoading(true);
    setError(null);
    try {
      const explanation = await explainToday({
        patientId:   activePatient.id,
        patientName: activePatient.name,
        diagnosis:   activePatient.diagnosis ?? '',
        conditions,
        entries:              patientEntries,
        checkIns:             patientCheckIns,
        triggerLogs:          patientTriggers,
        medicationLogs:       patientMeds,
        supplementLogs:       patientSuppLogs,
        supplementSchedules:  patientSuppSchedules,
        forceRefresh: force,
      });
      setResult(explanation);
      setExpanded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activePatient, conditions, patientEntries, patientCheckIns, patientTriggers, patientMeds, patientSuppLogs, patientSuppSchedules]);

  // ── No result yet — show the button ──────────────────────────────────────────
  if (!result && !loading && !error) {
    return (
      <div
        className="rounded-2xl border border-violet-100 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)' }}
      >
        <div className="px-4 py-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-1.5 bg-violet-100 rounded-xl">
              <Sparkles size={15} className="text-violet-600" />
            </div>
            <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">Daily Explainer</span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-0.5">Why am I feeling like this?</p>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            Tap to get an AI analysis of today's possible triggers and contributing factors.
          </p>
          <button
            onClick={() => run()}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 active:bg-violet-800 rounded-xl transition-colors"
          >
            <Sparkles size={14} />
            Explain today
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="rounded-2xl border border-violet-100 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)' }}
      >
        <div className="px-4 py-4 flex items-center gap-3">
          <Loader2 size={18} className="text-violet-500 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Analysing your day…</p>
            <p className="text-xs text-slate-400">Looking at symptoms, supplements, sleep, stress, and weather</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
        <div className="flex items-start gap-2.5">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Could not generate explanation</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
        <button
          onClick={() => run()}
          className="mt-3 w-full py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Result ────────────────────────────────────────────────────────────────────
  if (!result) return null;

  return (
    <div
      className="rounded-2xl border border-violet-100 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)' }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
      >
        <div className="p-1.5 bg-violet-100 rounded-xl flex-shrink-0">
          {result.noSymptoms
            ? <CheckCircle2 size={15} className="text-violet-600" />
            : <Sparkles size={15} className="text-violet-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-violet-700 uppercase tracking-wide block">
            Daily Explainer · {result.date}
          </span>
          <p className="text-sm font-semibold text-slate-800 mt-0.5 leading-snug line-clamp-2">
            {result.overallSummary}
          </p>
        </div>
        {expanded
          ? <ChevronUp size={14} className="text-violet-300 flex-shrink-0" />
          : <ChevronDown size={14} className="text-violet-300 flex-shrink-0" />}
      </button>

      {/* Expandable detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-violet-100/60">

          {/* No symptoms state */}
          {result.noSymptoms && (
            <div className="pt-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              <p className="text-sm text-slate-700">No symptoms logged today — that's a good sign!</p>
            </div>
          )}

          {/* Per-condition breakdowns */}
          {result.conditionExplanations.map((ce, i) => (
            <div
              key={i}
              className="pt-3"
            >
              {/* Condition title */}
              <div className="flex items-center gap-2 mb-2">
                {ce.conditionColor && (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ce.conditionColor }}
                  />
                )}
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Possible causes of today's {ce.condition}
                </p>
              </div>

              {/* Cause bullets */}
              <div
                className="rounded-xl p-3 space-y-1.5"
                style={{ backgroundColor: ce.conditionColor ? hexToRgba(ce.conditionColor, 0.07) : 'rgba(139,92,246,0.07)' }}
              >
                {ce.possibleCauses.map((cause, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ce.conditionColor ?? '#8b5cf6' }}
                    />
                    <p className="text-xs text-slate-700 leading-relaxed">{cause}</p>
                  </div>
                ))}
              </div>

              {/* Most likely */}
              <div
                className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ backgroundColor: ce.conditionColor ? hexToRgba(ce.conditionColor, 0.15) : 'rgba(139,92,246,0.15)' }}
              >
                <span className="text-xs" aria-hidden>⚡</span>
                <p className="text-xs font-semibold"
                  style={{ color: ce.conditionColor ?? '#7c3aed' }}>
                  Most likely trigger: {ce.mostLikelyCause}
                </p>
              </div>
            </div>
          ))}

          {/* Data note */}
          {result.dataNote && (
            <p className="text-[10px] text-violet-500/80 italic pt-1 leading-relaxed">
              ℹ️ {result.dataNote}
            </p>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-slate-400 italic leading-relaxed">
              AI estimate based on your logged data — not medical advice
            </p>
            <button
              onClick={() => run(true)}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] font-medium text-violet-500 hover:text-violet-700 transition-colors disabled:opacity-40"
              title="Refresh explanation"
            >
              <RefreshCw size={10} />
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
