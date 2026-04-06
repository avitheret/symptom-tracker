import { useState, useMemo } from 'react';
import { BarChart2, Layers, Clock, Zap, FlaskConical } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { gatherAllPatterns, detectClusters } from '../utils/analytics';
import InsightPatterns from './InsightPatterns';
import InsightClusters from './InsightClusters';
import InsightTriggers from './InsightTriggers';
import HealthTimeline from './HealthTimeline';
import ContributingFactors from './ContributingFactors';
import { TabBar } from './ui';
import type { TabItem } from './ui';

type InsightTab = 'patterns' | 'clusters' | 'timeline' | 'triggers' | 'factors';

const INSIGHT_TABS: TabItem<InsightTab>[] = [
  { id: 'patterns',  label: 'Patterns',  icon: <BarChart2    size={14} /> },
  { id: 'clusters',  label: 'Clusters',  icon: <Layers       size={14} /> },
  { id: 'timeline',  label: 'Timeline',  icon: <Clock        size={14} /> },
  { id: 'triggers',  label: 'Triggers',  icon: <Zap          size={14} /> },
  { id: 'factors',   label: 'Factors',   icon: <FlaskConical size={14} /> },
];

export default function Insights() {
  const { state, getPatientConditions } = useApp();
  const [tab, setTab] = useState<InsightTab>('patterns');

  const patientEntries = useMemo(
    () => state.entries.filter(e =>
      e.patientId === state.activePatientId &&
      e.reviewStatus !== 'to_review' &&
      e.reviewStatus !== 'disapproved'
    ),
    [state.entries, state.activePatientId],
  );

  const conditions = getPatientConditions(state.activePatientId ?? '');
  const patterns   = useMemo(() => gatherAllPatterns(patientEntries),  [patientEntries]);
  const clusters   = useMemo(() => detectClusters(patientEntries),     [patientEntries]);

  // Supplement log count for context display
  const supplementCount = useMemo(
    () => (state.supplementLogs ?? []).filter(l => l.patientId === state.activePatientId).length,
    [state.supplementLogs, state.activePatientId],
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* ── Page header ──────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Insights</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Patterns, clusters, and timeline from {patientEntries.length} symptoms
          {supplementCount > 0 && `, ${supplementCount} supplement log${supplementCount !== 1 ? 's' : ''}`}.
        </p>
      </div>

      {/* ── Tab bar ───────────────────────────────────────── */}
      <TabBar tabs={INSIGHT_TABS} active={tab} onChange={setTab} />

      {/* ── Tab content ───────────────────────────────────── */}
      {tab === 'patterns'  && <InsightPatterns patterns={patterns} entryCount={patientEntries.length} />}
      {tab === 'clusters'  && <InsightClusters clusters={clusters} entryCount={patientEntries.length} />}
      {tab === 'timeline'  && <HealthTimeline  entries={patientEntries} conditions={conditions} />}
      {tab === 'triggers'  && <InsightTriggers />}
      {tab === 'factors'   && <ContributingFactors />}
    </div>
  );
}
