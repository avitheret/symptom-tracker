import { Clock, CalendarDays, TrendingUp, Link2, Zap, Activity } from 'lucide-react';
import type { PatternInsight, Confidence } from '../types';

interface Props {
  patterns: PatternInsight[];
  entryCount: number;
}

const CONFIDENCE_BADGE: Record<Confidence, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-green-100 text-green-700',
};

const TYPE_ICON: Record<PatternInsight['type'], React.ReactNode> = {
  'time-of-day': <Clock size={16} />,
  'day-of-week': <CalendarDays size={16} />,
  'trend': <TrendingUp size={16} />,
  'co-occurrence': <Link2 size={16} />,
  'trigger': <Zap size={16} />,
  'checkin': <Activity size={16} />,
};

const TYPE_COLOR: Record<PatternInsight['type'], string> = {
  'time-of-day': 'border-blue-400 bg-blue-50 text-blue-600',
  'day-of-week': 'border-purple-400 bg-purple-50 text-purple-600',
  'trend': 'border-amber-400 bg-amber-50 text-amber-600',
  'co-occurrence': 'border-blue-400 bg-blue-50 text-blue-600',
  'trigger': 'border-rose-400 bg-rose-50 text-rose-600',
  'checkin': 'border-sky-400 bg-sky-50 text-sky-600',
};

export default function InsightPatterns({ patterns, entryCount }: Props) {
  if (entryCount < 5) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <p className="text-slate-500 text-sm font-medium">Not enough data yet</p>
        <p className="text-slate-400 text-xs mt-1">Log at least 5 symptoms to discover patterns.</p>
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
        <p className="text-slate-400 text-sm">No strong patterns found yet. Keep logging!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {patterns.map(p => (
        <div key={p.id} className={`bg-white rounded-2xl border-l-4 shadow-sm overflow-hidden ${TYPE_COLOR[p.type].split(' ')[0]}`}>
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl flex-shrink-0 ${TYPE_COLOR[p.type].split(' ').slice(1).join(' ')}`}>
                {TYPE_ICON[p.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_BADGE[p.confidence]}`}>
                    {p.confidence} confidence
                  </span>
                </div>
                <p className="text-sm text-slate-600">{p.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-slate-400">
                    {p.dateRange.from} – {p.dateRange.to}
                  </span>
                  <span className="text-xs text-slate-400">
                    {p.supportingCount} supporting events
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Safety disclaimer */}
      <p className="text-xs text-slate-400 text-center pt-2">
        Patterns are based on your logged data and are not medical diagnoses. Always consult a healthcare professional.
      </p>
    </div>
  );
}
