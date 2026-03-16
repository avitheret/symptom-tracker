import { useState } from 'react';
import { Plus, X, AlertTriangle } from 'lucide-react';
import type { Condition } from '../types';

interface Props {
  condition: Condition;
  entryCount: number;
  lastEntryDate?: string;
  onLog: () => void;
  onClick: () => void;
  onRemove?: () => void;
}

/** Returns hex color with given opacity as rgba */
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function ConditionCard({ condition, entryCount, lastEntryDate, onLog, onClick, onRemove }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const bgTint    = hexToRgba(condition.color, 0.08);
  const badgeTint = hexToRgba(condition.color, 0.15);

  if (confirmRemove) {
    return (
      <div
        className="rounded-2xl border border-red-100 shadow-sm overflow-hidden bg-red-50 p-4 flex flex-col gap-3"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Remove {condition.name}?</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Your existing logs will be kept. You can re-add this condition anytime.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmRemove(false)}
            className="flex-1 py-2 text-sm font-medium text-slate-600 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { setConfirmRemove(false); onRemove?.(); }}
            className="flex-1 py-2 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      style={{ backgroundColor: bgTint }}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Color dot + name + remove button */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: condition.color, outline: `2px solid ${condition.color}`, outlineOffset: '1px' }}
            />
            <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">{condition.name}</h3>
          </div>
          {onRemove && (
            <button
              onClick={e => { e.stopPropagation(); setConfirmRemove(true); }}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors -mr-1 -mt-1"
              title="Remove condition"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: badgeTint, color: condition.color }}
          >
            {entryCount} log{entryCount !== 1 ? 's' : ''}
          </span>
          {lastEntryDate && (
            <span className="text-xs text-slate-400">Last: {lastEntryDate}</span>
          )}
        </div>

        <p className="text-xs text-slate-400">
          {condition.symptoms.length} symptom{condition.symptoms.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Log button */}
      <div className="px-4 pb-4">
        <button
          className="w-full text-sm font-semibold py-2.5 rounded-xl text-white active:opacity-80 transition-opacity flex items-center justify-center gap-1.5 min-h-[44px]"
          style={{ backgroundColor: condition.color }}
          onClick={e => { e.stopPropagation(); onLog(); }}
        >
          <Plus size={15} />Log Symptom
        </button>
      </div>
    </div>
  );
}
