import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Info, Shield, BarChart3 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { analyzeRootCauses } from '../utils/rootCauseEngine';
import type { RootCauseFactor, RootCauseResult } from '../utils/rootCauseEngine';
import { Card, Chip, SectionHeader, Badge, EmptyState } from './ui';

// ── Factor bar colors ────────────────────────────────────────────────────────

const BAR_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
];

const UNKNOWN_COLOR = '#cbd5e1'; // slate-300

// ── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const variant = level === 'high' ? 'success' : level === 'medium' ? 'warning' : 'neutral' as const;
  return <Badge variant={variant}>{level} confidence</Badge>;
}

function DataStrengthIndicator({ strength }: { strength: RootCauseResult['dataStrength'] }) {
  const config = {
    insufficient: { label: 'Insufficient data', color: 'text-slate-400', bg: 'bg-slate-50', bars: 0 },
    weak:         { label: 'Limited data',       color: 'text-amber-500', bg: 'bg-amber-50', bars: 1 },
    moderate:     { label: 'Moderate data',      color: 'text-blue-500',  bg: 'bg-blue-50',  bars: 2 },
    strong:       { label: 'Strong data',        color: 'text-green-500', bg: 'bg-green-50', bars: 3 },
  }[strength];

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg}`}>
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`w-1.5 rounded-full ${i < config.bars ? config.color.replace('text-', 'bg-') : 'bg-slate-200'}`}
            style={{ height: 8 + i * 3 }}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}

// ── Factor Row ───────────────────────────────────────────────────────────────

function FactorRow({ factor, color, rank }: { factor: RootCauseFactor; color: string; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left group"
      >
        <div className="flex items-center gap-3">
          {/* Rank */}
          <span className="text-xs font-bold text-slate-300 w-4 text-right tabular-nums">
            {rank}
          </span>

          {/* Bar + label */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-slate-800 truncate">{factor.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-lg font-black tabular-nums" style={{ color }}>
                  {factor.probabilityPercent}%
                </span>
                {expanded
                  ? <ChevronUp size={14} className="text-slate-400" />
                  : <ChevronDown size={14} className="text-slate-400" />
                }
              </div>
            </div>

            {/* Horizontal bar */}
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${factor.probabilityPercent}%`,
                  backgroundColor: color,
                }}
              />
            </div>

            {/* Brief explanation */}
            <p className="text-xs text-slate-400 mt-1">{factor.explanation}</p>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="ml-7 mt-2.5 space-y-2">
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            {factor.details.map((detail, i) => (
              <div key={i} className="flex items-start gap-2">
                <Info size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 px-1">
            <ConfidenceBadge level={factor.confidence} />
            <span className="text-xs text-slate-400">
              {factor.episodesMatched} of {factor.totalEpisodes} episodes
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface Props {
  conditionId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default function RootCauseCard({ conditionId, dateFrom, dateTo }: Props) {
  const { state, getPatientConditions } = useApp();
  const conditions = getPatientConditions(state.activePatientId ?? '');

  const [selectedConditionId, setSelectedConditionId] = useState(conditionId ?? '');

  const patientEntries = useMemo(
    () => state.entries.filter(e => e.patientId === state.activePatientId),
    [state.entries, state.activePatientId],
  );
  const patientTriggerLogs = useMemo(
    () => state.triggerLogs.filter(t => t.patientId === state.activePatientId),
    [state.triggerLogs, state.activePatientId],
  );
  const patientCheckIns = useMemo(
    () => state.checkIns.filter(c => c.patientId === state.activePatientId),
    [state.checkIns, state.activePatientId],
  );
  const patientMedLogs = useMemo(
    () => state.medicationLogs.filter(m => m.patientId === state.activePatientId),
    [state.medicationLogs, state.activePatientId],
  );

  const result = useMemo(() =>
    analyzeRootCauses({
      entries: patientEntries,
      checkIns: patientCheckIns,
      triggerLogs: patientTriggerLogs,
      medicationLogs: patientMedLogs,
      conditions,
      conditionId: selectedConditionId || undefined,
      dateFrom,
      dateTo,
    }),
    [patientEntries, patientCheckIns, patientTriggerLogs, patientMedLogs, conditions, selectedConditionId, dateFrom, dateTo],
  );

  return (
    <div className="space-y-4">
      <SectionHeader title="Probable Trigger Breakdown" />

      {/* Condition filter */}
      {!conditionId && conditions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Chip
            selected={selectedConditionId === ''}
            activeColor="#6366f1"
            size="sm"
            onClick={() => setSelectedConditionId('')}
          >
            All Conditions
          </Chip>
          {conditions.map(c => (
            <Chip
              key={c.id}
              selected={selectedConditionId === c.id}
              activeColor={c.color}
              dotColor={selectedConditionId !== c.id ? c.color : undefined}
              size="sm"
              onClick={() => setSelectedConditionId(c.id)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg">
              <BarChart3 size={14} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {result.entityName}
              </h3>
              {result.dateRange.from && (
                <p className="text-xs text-slate-400">
                  {result.dateRange.from} – {result.dateRange.to} · {result.totalEpisodes} episodes · {result.totalDaysAnalyzed} days
                </p>
              )}
            </div>
          </div>
          <DataStrengthIndicator strength={result.dataStrength} />
        </div>

        {/* Insufficient data state */}
        {result.dataStrength === 'insufficient' ? (
          <EmptyState
            icon={<BarChart3 size={24} />}
            title="Not enough data yet"
            description="Log at least 3 symptom episodes with triggers, check-ins, or medications to see a probable trigger breakdown."
            compact
          />
        ) : (
          <>
            {/* Weak data warning */}
            {result.dataStrength === 'weak' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 mb-4">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Limited data available. These estimates may change significantly as you log more entries. Consider these early indicators rather than reliable probabilities.
                </p>
              </div>
            )}

            {/* Factor list */}
            {result.factors.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {result.factors.map((factor, i) => (
                  <FactorRow
                    key={factor.name}
                    factor={factor}
                    color={BAR_COLORS[i % BAR_COLORS.length]}
                    rank={i + 1}
                  />
                ))}

                {/* Unknown/Other bucket */}
                {result.unknownPercent > 0 && (
                  <div className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-300 w-4 text-right tabular-nums">
                        {result.factors.length + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-slate-400 italic">Unknown / Other</span>
                          <span className="text-lg font-black tabular-nums text-slate-300">
                            {result.unknownPercent}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${result.unknownPercent}%`,
                              backgroundColor: UNKNOWN_COLOR,
                            }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Factors not captured by current tracking data
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<BarChart3 size={24} />}
                title="No clear trigger patterns found"
                description="Your logged data doesn't show strong associations yet. Try logging triggers and daily check-ins consistently to improve analysis."
                compact
              />
            )}
          </>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-2 mt-4 pt-3 border-t border-slate-100">
          <Shield size={12} className="text-slate-300 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {result.disclaimer}
          </p>
        </div>
      </Card>
    </div>
  );
}
