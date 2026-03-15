import { Printer } from 'lucide-react';
import { detectTrend, getTriggerFrequency } from '../utils/analytics';
import type { TrackingEntry, Condition, TriggerLog, DailyCheckIn, MedicationLog } from '../types';
import { EFFECTIVENESS_LABELS } from '../types';

interface Props {
  entries: TrackingEntry[];
  conditions: Condition[];
  patientName: string;
  triggerLogs?: TriggerLog[];
  checkIns?: DailyCheckIn[];
  medicationLogs?: MedicationLog[];
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DoctorReport({ entries, conditions, patientName, triggerLogs = [], checkIns = [], medicationLogs = [] }: Props) {
  const today = getTodayStr();
  const dates = entries.map(e => e.date).sort();
  const periodFrom = dates[0] ?? today;
  const periodTo = dates[dates.length - 1] ?? today;

  // Symptom frequency table data
  const symptomMap: Record<string, {
    symptomName: string;
    conditionName: string;
    episodes: number;
    severities: number[];
  }> = {};
  for (const e of entries) {
    if (!symptomMap[e.symptomId]) {
      symptomMap[e.symptomId] = {
        symptomName: e.symptomName,
        conditionName: e.conditionName,
        episodes: 0,
        severities: [],
      };
    }
    symptomMap[e.symptomId].episodes++;
    symptomMap[e.symptomId].severities.push(e.severity);
  }
  const symptomRows = Object.values(symptomMap)
    .sort((a, b) => b.episodes - a.episodes)
    .map(s => ({
      ...s,
      avgSeverity: (s.severities.reduce((a, v) => a + v, 0) / s.severities.length).toFixed(1),
      peakSeverity: Math.max(...s.severities),
    }));

  const uniqueDays = new Set(entries.map(e => e.date)).size;
  const conditionsTracked = new Set(entries.map(e => e.conditionId)).size;
  const uniqueSymptoms = Object.keys(symptomMap).length;

  const trend = detectTrend(entries);

  // Trigger summary
  const triggerFreq = getTriggerFrequency(triggerLogs, entries).slice(0, 10);

  // Check-in averages
  const ciCount = checkIns.length;
  const ciAvgHealth = ciCount ? (checkIns.reduce((s, c) => s + c.healthScore, 0) / ciCount).toFixed(1) : null;
  const ciAvgSleep = ciCount ? (checkIns.reduce((s, c) => s + c.sleepHours, 0) / ciCount).toFixed(1) : null;
  const ciAvgEnergy = ciCount ? (checkIns.reduce((s, c) => s + c.energy, 0) / ciCount).toFixed(1) : null;
  const ciStressDist = ciCount ? {
    low: checkIns.filter(c => c.stress === 'low').length,
    medium: checkIns.filter(c => c.stress === 'medium').length,
    high: checkIns.filter(c => c.stress === 'high').length,
  } : null;
  // Medication summary
  const medMap: Record<string, { name: string; type: string; count: number; effectivenessCounts: Record<string, number> }> = {};
  for (const m of medicationLogs) {
    const key = `${m.name}|${m.type}`;
    if (!medMap[key]) medMap[key] = { name: m.name, type: m.type, count: 0, effectivenessCounts: {} };
    medMap[key].count++;
    medMap[key].effectivenessCounts[m.effectiveness] = (medMap[key].effectivenessCounts[m.effectiveness] ?? 0) + 1;
  }
  const medRows = Object.values(medMap).sort((a, b) => b.count - a.count);

  const trendLabel: Record<typeof trend.direction, string> = {
    improving: 'Improving',
    worsening: 'Worsening',
    stable: 'Stable',
  };
  const trendDesc: Record<typeof trend.direction, string> = {
    improving: `Average symptom severity has decreased by ${Math.abs(trend.percentChange).toFixed(0)}% over the past ${trend.windowDays} days compared to the prior ${trend.windowDays} days.`,
    worsening: `Average symptom severity has increased by ${trend.percentChange.toFixed(0)}% over the past ${trend.windowDays} days compared to the prior ${trend.windowDays} days.`,
    stable: `Average symptom severity has remained relatively stable over the past ${trend.windowDays} days.`,
  };

  return (
    <div>
      {/* Print button — hidden in print */}
      <div className="flex justify-end mb-4 no-print">
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-900 transition-colors"
        >
          <Printer size={14} />Print / Save PDF
        </button>
      </div>

      <div id="doctor-report" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">Clinical Symptom Summary</h1>
          <div className="mt-2 space-y-0.5">
            <p className="text-sm text-slate-600"><span className="font-medium">Patient:</span> {patientName}</p>
            <p className="text-sm text-slate-600"><span className="font-medium">Generated:</span> {today}</p>
            <p className="text-sm text-slate-600"><span className="font-medium">Period covered:</span> {periodFrom} to {periodTo}</p>
          </div>
        </div>

        {/* Overview */}
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Overview</h2>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                ['Total episodes logged', entries.length],
                ['Unique symptoms tracked', uniqueSymptoms],
                ['Conditions tracked', conditionsTracked],
                ['Active days', uniqueDays],
              ].map(([label, value]) => (
                <tr key={String(label)} className="border border-slate-200">
                  <td className="px-4 py-2 font-medium text-slate-700 bg-slate-50 w-64">{label}</td>
                  <td className="px-4 py-2 text-slate-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Symptom frequency */}
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Symptom Frequency</h2>
          {symptomRows.length === 0 ? (
            <p className="text-sm text-slate-400">No symptom data available.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-4 py-2 text-left font-semibold text-slate-700">Symptom</th>
                  <th className="border border-slate-200 px-4 py-2 text-left font-semibold text-slate-700">Condition</th>
                  <th className="border border-slate-200 px-4 py-2 text-center font-semibold text-slate-700">Episodes</th>
                  <th className="border border-slate-200 px-4 py-2 text-center font-semibold text-slate-700">Avg Severity</th>
                  <th className="border border-slate-200 px-4 py-2 text-center font-semibold text-slate-700">Peak</th>
                </tr>
              </thead>
              <tbody>
                {symptomRows.map(r => (
                  <tr key={r.symptomName + r.conditionName} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-4 py-2 font-medium text-slate-800">{r.symptomName}</td>
                    <td className="border border-slate-200 px-4 py-2 text-slate-600">{r.conditionName}</td>
                    <td className="border border-slate-200 px-4 py-2 text-center tabular-nums">{r.episodes}</td>
                    <td className="border border-slate-200 px-4 py-2 text-center tabular-nums">{r.avgSeverity}/10</td>
                    <td className="border border-slate-200 px-4 py-2 text-center tabular-nums">{r.peakSeverity}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Trend assessment */}
        {entries.length >= 6 && (
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-3">Trend Assessment</h2>
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-sm">
                <span className="font-semibold text-slate-800">Overall trend ({trend.windowDays}-day window):</span>{' '}
                <span className={
                  trend.direction === 'improving' ? 'text-green-600 font-medium' :
                  trend.direction === 'worsening' ? 'text-red-600 font-medium' :
                  'text-slate-600 font-medium'
                }>
                  {trendLabel[trend.direction]}
                </span>
              </p>
              <p className="text-sm text-slate-600 mt-1">{trendDesc[trend.direction]}</p>
            </div>
          </div>
        )}

        {/* Conditions summary */}
        {conditions.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-3">Conditions Monitored</h2>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              {conditions.map(c => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Trigger summary */}
        {triggerFreq.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-3">
              Reported Triggers ({triggerLogs.length} logs)
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-4 py-2 text-left font-semibold text-slate-700">Trigger</th>
                  <th className="border border-slate-200 px-4 py-2 text-center font-semibold text-slate-700">Occurrences</th>
                  <th className="border border-slate-200 px-4 py-2 text-center font-semibold text-slate-700">With High-Severity Day</th>
                </tr>
              </thead>
              <tbody>
                {triggerFreq.map(t => (
                  <tr key={t.trigger} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-4 py-2 font-medium text-slate-800">{t.trigger}</td>
                    <td className="border border-slate-200 px-4 py-2 text-center tabular-nums">{t.count}</td>
                    <td className="border border-slate-200 px-4 py-2 text-center tabular-nums">
                      {t.highSevCount > 0 ? `${t.highSevCount} (${Math.round((t.highSevCount / t.count) * 100)}%)` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-2">
              "High-severity day" = any day with a symptom rated ≥ 7/10.
            </p>
          </div>
        )}

        {/* Medication & Treatment Summary */}
        {medRows.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-3">
              Medications &amp; Treatments ({medicationLogs.length} logs)
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-4 py-2 text-left font-semibold text-slate-700">Name</th>
                  <th className="border border-slate-200 px-4 py-2 text-left font-semibold text-slate-700">Type</th>
                  <th className="border border-slate-200 px-4 py-2 text-center font-semibold text-slate-700">Times Used</th>
                  <th className="border border-slate-200 px-4 py-2 text-left font-semibold text-slate-700">Most Common Outcome</th>
                </tr>
              </thead>
              <tbody>
                {medRows.map(r => {
                  const topOutcome = Object.entries(r.effectivenessCounts).sort(([, a], [, b]) => b - a)[0];
                  return (
                    <tr key={r.name + r.type} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-4 py-2 font-medium text-slate-800">{r.name}</td>
                      <td className="border border-slate-200 px-4 py-2 text-slate-600 capitalize">{r.type}</td>
                      <td className="border border-slate-200 px-4 py-2 text-center tabular-nums">{r.count}</td>
                      <td className="border border-slate-200 px-4 py-2 text-slate-600">
                        {topOutcome ? EFFECTIVENESS_LABELS[topOutcome[0] as keyof typeof EFFECTIVENESS_LABELS] : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-2">
              Outcomes reflect patient-reported relief ratings. This data is for reference only.
            </p>
          </div>
        )}

        {/* Daily check-in summary */}
        {ciCount > 0 && ciAvgHealth && ciAvgSleep && ciAvgEnergy && ciStressDist && (
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-3">
              Daily Wellness Check-ins ({ciCount} entries)
            </h2>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {[
                  ['Average Health Score', `${ciAvgHealth}/10`],
                  ['Average Sleep', `${ciAvgSleep} hours`],
                  ['Average Energy', `${ciAvgEnergy}/10`],
                  ['Stress: Low / Medium / High', `${ciStressDist.low} / ${ciStressDist.medium} / ${ciStressDist.high} days`],
                ].map(([label, value]) => (
                  <tr key={String(label)} className="border border-slate-200">
                    <td className="px-4 py-2 font-medium text-slate-700 bg-slate-50 w-64">{label}</td>
                    <td className="px-4 py-2 text-slate-900">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Disclaimer */}
        <div className="disclaimer border border-slate-300 rounded-lg p-4 bg-slate-50">
          <p className="text-xs text-slate-500 italic">
            <span className="font-semibold not-italic text-slate-600">Disclaimer:</span>{' '}
            This report was generated from patient self-reported symptom data using the Symptom Tracker app.
            It is intended as a supplementary reference for healthcare professionals and does not constitute
            a clinical assessment, diagnosis, or medical record. All data should be interpreted in the context
            of a full clinical evaluation by a qualified healthcare provider.
          </p>
        </div>
      </div>
    </div>
  );
}
