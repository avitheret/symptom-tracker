import type { SymptomCluster } from '../types';

interface Props {
  clusters: SymptomCluster[];
  entryCount: number;
}

function severityColor(s: number) {
  if (s >= 7) return 'text-red-600';
  if (s >= 4) return 'text-amber-600';
  return 'text-green-600';
}

export default function InsightClusters({ clusters, entryCount }: Props) {
  if (entryCount < 5) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <p className="text-slate-500 text-sm font-medium">Not enough data yet</p>
        <p className="text-slate-400 text-xs mt-1">Log at least 5 symptoms to detect clusters.</p>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
        <p className="text-slate-400 text-sm">No symptom clusters detected yet. Keep logging to reveal patterns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Clusters are groups of symptoms that tend to appear together within a 2-hour window.
      </p>
      {clusters.map(cluster => (
        <div key={cluster.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-sm font-semibold text-slate-900 leading-snug">{cluster.clusterName}</p>
            <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 whitespace-nowrap">
              {cluster.occurrenceCount}× occurred
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {cluster.symptoms.map(s => (
              <span
                key={s.symptomId}
                className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full"
              >
                <span className="font-medium">{s.symptomName}</span>
                <span className="text-slate-400"> · {s.conditionName}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>
              Avg severity: <span className={`font-semibold ${severityColor(cluster.avgSeverity)}`}>{cluster.avgSeverity}/10</span>
            </span>
            <span>{cluster.dateRange.from} – {cluster.dateRange.to}</span>
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-400 text-center pt-2">
        Clusters highlight co-occurring symptoms and are not medical diagnoses. Consult your doctor for evaluation.
      </p>
    </div>
  );
}
