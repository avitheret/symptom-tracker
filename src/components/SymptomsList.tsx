import { Plus, Zap } from 'lucide-react';
import type { Condition, TrackingEntry } from '../types';

interface Props {
  condition: Condition;
  entries: TrackingEntry[];
  onAddSymptom: () => void;
  onLog: () => void;
}

export default function SymptomsList({ condition, entries, onAddSymptom, onLog }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="h-2 w-full" style={{ backgroundColor: condition.color }} />
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{condition.name}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {condition.symptoms.length} symptom{condition.symptoms.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onLog}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 shadow-sm"
            style={{ backgroundColor: condition.color }}
          >
            <Zap size={14} />Log Symptom
          </button>
        </div>
      </div>

      {/* Symptoms */}
      {condition.symptoms.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-slate-400 text-sm">No symptoms yet for this condition.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {condition.symptoms.map(s => {
            const logCount = entries.filter(e => e.symptomId === s.id).length;
            return (
              <div key={s.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{logCount} log{logCount !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={onLog}
                  className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Log
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add symptom */}
      <div className="px-6 py-4 border-t border-slate-100">
        <button
          onClick={onAddSymptom}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 py-1 transition-colors"
        >
          <Plus size={14} />Add Symptom
        </button>
      </div>
    </div>
  );
}
