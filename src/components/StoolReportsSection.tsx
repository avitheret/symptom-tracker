/**
 * StoolReportsSection — charts and insights for bowel movement data.
 * Used inside the Reports tab.
 */

import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useApp } from '../contexts/AppContext';
import type { StoolLog } from '../types';
import { SectionHeader, Card } from './ui';

// ── Helpers ───────────────────────────────────────────────────────────────────

function bristolColor(type: number): string {
  if (type <= 2) return '#d97706'; // amber
  if (type <= 4) return '#16a34a'; // green
  if (type <= 6) return '#ea580c'; // orange
  return '#dc2626';                 // red
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun'];

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${MONTHS_SHORT[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

// ── Insight generator ─────────────────────────────────────────────────────────

function generateInsights(logs: StoolLog[]): string[] {
  if (logs.length < 3) return [];
  const insights: string[] = [];

  const healthy = logs.filter(l => l.bristolType >= 3 && l.bristolType <= 4);
  const healthyPct = Math.round((healthy.length / logs.length) * 100);
  if (healthyPct >= 70)
    insights.push(`${healthyPct}% of your logs are in the healthy range (Bristol types 3–4).`);
  else if (healthyPct < 40)
    insights.push(`Only ${healthyPct}% of logs are in the healthy range — consider tracking diet and hydration.`);

  const avgType = logs.reduce((s, l) => s + l.bristolType, 0) / logs.length;
  if (avgType < 2.5)
    insights.push('Your average Bristol type suggests constipation. Increasing fibre and water may help.');
  else if (avgType > 5.5)
    insights.push('Your average Bristol type suggests loose stools. Note any dietary triggers.');

  // Frequency
  const dates = new Set(logs.map(l => l.date));
  const daysCovered = dates.size;
  const logsPerDay = logs.length / Math.max(daysCovered, 1);
  if (logsPerDay >= 3)
    insights.push(`You average ${logsPerDay.toFixed(1)} movements per day — above average. Consider speaking to your doctor if this is new.`);
  else if (logsPerDay < 0.6)
    insights.push('Less than one movement per day on average. Fibre, hydration, and movement can help regularity.');

  // Urgency
  const urgentCount = logs.filter(l => l.urgency !== 'none').length;
  const urgentPct = Math.round((urgentCount / logs.length) * 100);
  if (urgentPct >= 30)
    insights.push(`Urgency reported in ${urgentPct}% of logs. This pattern is worth discussing with your doctor.`);

  // Unusual features
  const bloodCount = logs.filter(l => l.unusualFeatures.includes('blood')).length;
  if (bloodCount > 0)
    insights.push(`Blood noted in ${bloodCount} log${bloodCount > 1 ? 's' : ''}. Please consult a doctor if this is persistent or new.`);

  // Time of day
  const morning   = logs.filter(l => { const h = parseInt(l.time, 10); return h >= 5  && h < 12; }).length;
  const afternoon = logs.filter(l => { const h = parseInt(l.time, 10); return h >= 12 && h < 17; }).length;
  const evening   = logs.filter(l => { const h = parseInt(l.time, 10); return h >= 17 || h < 5;  }).length;
  const peak = morning >= afternoon && morning >= evening ? 'morning' :
               afternoon >= morning && afternoon >= evening ? 'afternoon' : 'evening';
  if (logs.length >= 5)
    insights.push(`Most movements occur in the ${peak} — this is normal gastrocolic reflex timing.`);

  return insights.slice(0, 4);
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  range?: '7d' | '30d' | '90d' | 'all';
}

export default function StoolReportsSection({ range = '30d' }: Props) {
  const { state } = useApp();

  const allLogs = useMemo(() =>
    state.stoolLogs.filter(l => l.patientId === state.activePatientId),
    [state.stoolLogs, state.activePatientId]
  );

  const cutoff = range === '7d' ? daysAgo(7) : range === '30d' ? daysAgo(30) : range === '90d' ? daysAgo(90) : '1970-01-01';

  const logs = useMemo(() =>
    allLogs.filter(l => l.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date)),
    [allLogs, cutoff]
  );

  if (allLogs.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        No stool logs yet. Tap <strong>Log</strong> on the Stool tab to start tracking.
      </div>
    );
  }

  // ── Chart 1: Bristol type distribution ───────────────────────────────────
  const bristolDist = ([1, 2, 3, 4, 5, 6, 7] as const).map(t => ({
    type: `Type ${t}`,
    t,
    count: logs.filter(l => l.bristolType === t).length,
  }));

  // ── Chart 2: Logs per day (frequency) ────────────────────────────────────
  const byDate: Record<string, number> = {};
  for (const log of logs) byDate[log.date] = (byDate[log.date] ?? 0) + 1;
  const frequencyData = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date: shortDate(date), count }));

  // ── Chart 3: Average Bristol type per day over time ────────────────────
  const avgByDate: Record<string, number[]> = {};
  for (const log of logs) {
    if (!avgByDate[log.date]) avgByDate[log.date] = [];
    avgByDate[log.date].push(log.bristolType);
  }
  const typeOverTime = Object.entries(avgByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, vals]) => ({
      date: shortDate(date),
      avg: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
    }));

  // ── Chart 4: Unusual features frequency ──────────────────────────────────
  const featureCounts: Record<string, number> = {};
  for (const log of logs) {
    for (const f of log.unusualFeatures) {
      featureCounts[f] = (featureCounts[f] ?? 0) + 1;
    }
  }
  const featureData = Object.entries(featureCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([feat, count]) => ({
      feat: feat.charAt(0).toUpperCase() + feat.slice(1),
      count,
    }));

  // ── Chart 5: Urgency breakdown ────────────────────────────────────────────
  const urgencyData = [
    { label: 'None',   count: logs.filter(l => l.urgency === 'none').length,   color: '#16a34a' },
    { label: 'Soon',   count: logs.filter(l => l.urgency === 'soon').length,   color: '#d97706' },
    { label: 'Urgent', count: logs.filter(l => l.urgency === 'urgent').length, color: '#dc2626' },
  ].filter(d => d.count > 0);

  const insights = generateInsights(logs);

  return (
    <div className="space-y-6">

      {/* AI-style insights */}
      {insights.length > 0 && (
        <div>
          <SectionHeader title="Insights" />
          <Card padding={false}>
            {insights.map((insight, i) => (
              <div key={i} className={`px-4 py-3 text-sm text-slate-700 leading-relaxed ${i < insights.length - 1 ? 'border-b border-slate-50' : ''}`}>
                {insight}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Bristol type distribution */}
      <div>
        <SectionHeader title="Bristol Type Distribution" />
        <Card>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={bristolDist} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="type" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v} logs`, 'Count']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {bristolDist.map(entry => (
                  <Cell key={entry.t} fill={bristolColor(entry.t)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 pt-1 pb-2 text-xs text-slate-500">
            <span><span className="inline-block w-2.5 h-2.5 rounded bg-amber-500 mr-1" />1–2 Constipated</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded bg-green-600 mr-1" />3–4 Healthy</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded bg-orange-600 mr-1" />5–6 Loose</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded bg-red-600 mr-1" />7 Liquid</span>
          </div>
        </Card>
      </div>

      {/* Average Bristol type over time */}
      {typeOverTime.length >= 3 && (
        <div>
          <SectionHeader title="Bristol Type Trend" />
          <Card>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={typeOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis domain={[1, 7]} ticks={[1,2,3,4,5,6,7]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`Type ${v}`, 'Avg Bristol']} />
                {/* Healthy band annotation */}
                <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-center text-slate-400 pb-2">Average Bristol type per day — types 3–4 are healthy</p>
          </Card>
        </div>
      )}

      {/* Daily frequency */}
      {frequencyData.length >= 3 && (
        <div>
          <SectionHeader title="Daily Frequency" />
          <Card>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={frequencyData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v}`, 'Movements']} />
                <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Urgency breakdown */}
      {urgencyData.length > 1 && (
        <div>
          <SectionHeader title="Urgency" />
          <Card>
            <div className="flex gap-3">
              {urgencyData.map(d => (
                <div key={d.label} className="flex-1 text-center py-3 rounded-xl" style={{ background: d.color + '15' }}>
                  <p className="text-xl font-bold" style={{ color: d.color }}>{d.count}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{d.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Unusual features */}
      {featureData.length > 0 && (
        <div>
          <SectionHeader title="Unusual Features" />
          <Card padding={false}>
            {featureData.map(({ feat, count }, i) => (
              <div
                key={feat}
                className={`flex items-center justify-between px-4 py-3 ${i < featureData.length - 1 ? 'border-b border-slate-50' : ''}`}
              >
                <span className="text-sm text-slate-700">{feat}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${(count / logs.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500 w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

    </div>
  );
}
