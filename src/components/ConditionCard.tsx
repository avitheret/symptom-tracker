import { Plus } from 'lucide-react';
import type { Condition } from '../types';

interface Props {
  condition: Condition;
  entryCount: number;
  lastEntryDate?: string;
  onLog: () => void;
  onClick: () => void;
}

/** Returns hex color with given opacity as rgba */
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function ConditionCard({ condition, entryCount, lastEntryDate, onLog, onClick }: Props) {
  const bgTint = hexToRgba(condition.color, 0.08);
  const badgeTint = hexToRgba(condition.color, 0.15);

  return (
    <div
      className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      style={{ backgroundColor: bgTint }}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Color dot + name */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: condition.color, outline: `2px solid ${condition.color}`, outlineOffset: '1px' }}
            />
            <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">{condition.name}</h3>
          </div>
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
